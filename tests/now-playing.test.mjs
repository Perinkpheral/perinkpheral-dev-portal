// SPDX-License-Identifier: MIT
import assert from 'node:assert/strict'
import test from 'node:test'
import { address, listPlayers, personalServers, pollPlex, settings, setupMessage, startPlex } from '../public/companion/now-playing.mjs'

const controller = 'c047d13a-fcb5-4832-bb85-857b87c299dc'
const manual = { server:'https://media.example.org', player:'', token:'own-access-key',
  player_token:'', serverId:'', receiverId:'', controller, refresh:'15 s' }
const local = { owned:true, provides:'server', clientIdentifier:'owner-server', name:'Library',
  accessToken:'resource-token', connections:[{ uri:'https://192-168-1-2.abb12.plex.direct:32400', local:true, relay:false }]}

test('manual HTTPS configuration preserves exact server and works without cloud identity', () => {
  assert.deepEqual(settings(manual), {server:manual.server, player:'', token:manual.token, player_token:'none', connection:JSON.stringify({c:controller,s:'',p:''}), refresh:'15 s'})
  assert.throws(() => settings({...manual, token:'a'.repeat(256)}), /255-byte/)
  assert.throws(() => settings({...manual, token:'abc\r\ndef'}), /255-byte/)
  assert.throws(() => settings({...manual, serverId:'a'.repeat(230)}), /255-byte/)
  assert.throws(() => settings({...manual, server:'http://media.example.org'}), /HTTPS/)
  assert.throws(() => settings({...manual, server:'http://[2001:db8::1]'}), /HTTPS/)
  for (const origin of ['http://[fd34::1]', 'http://[fe80::1]', 'http://[::1]', 'http://169.254.1.2'])
    assert.equal(settings({...manual,server:origin}).server,origin)
  assert.equal(settings({...manual,server_auth:'Bearer operator-key'}).server_auth,'Bearer operator-key')
  assert.equal(settings({...manual,server_auth:'none'}).server_auth,'none')
  assert.throws(() => settings({...manual,server:'http://192.168.1.2',server_auth:'Bearer operator-key'}),/HTTPS/)
  assert.throws(() => settings({...manual, server:'https://name:key@media.example.org'}), /sign-in data/)
  assert.throws(() => address('https://media.example.org/?token=abc'), /sign-in data/)
  assert.throws(() => settings({...manual, receiverId:'receiver'}), /server identifier/)
  assert.throws(() => settings({...manual, player:'http://192.168.1.9'}), /player identifier/)
  assert.deepEqual(JSON.parse(settings({...manual, serverId:'server', receiverId:'player'}).connection), {c:controller,s:'server',p:'player'})
})

test('bridge accepts only the target app and six visible fields with the expected kinds', () => {
  const fields = {server:'url', player:'url', token:'secret', player_token:'secret', connection:'secret', refresh:'choice'}
  const message = { perinkpheral:'app', name:'now-playing', settings:Object.entries(fields).map(([key,type])=>({key,type})) }
  assert.ok(setupMessage(message))
  assert.ok(!setupMessage({...message,name:'other'}))
  assert.ok(!setupMessage({...message,settings:message.settings.slice(1)}))
  assert.ok(!setupMessage({...message,settings:[...message.settings.slice(1), {key:'server',type:'url',hidden:true}]}))
})

test('only owned servers get candidates, and only LAN addresses are offered without explicit entry', () => {
  const extra = (uri, options) => ({...local,connections:[{uri,local:true,...options}]})
  const servers = personalServers([
    local, {...local,owned:false}, {...local,provides:'client'},
    extra('https://external.example.org'), extra('https://192.168.0.2',{relay:true}),
    extra('https://192.168.0.3',{local:false}), extra('https://user:key@192.168.0.5'),
    extra('https://192-168-0-5.a.plex.direct.evil.example'), extra('https://10.1.1.9/sessions?token=secret'),
  ])
  assert.equal(servers.length,7)
  assert.equal(servers[0].origin,'https://192-168-1-2.abb12.plex.direct:32400')
  assert.ok(servers.slice(1).every(server => server.origin === ''))
  assert.deepEqual(servers[1].listed,['https://external.example.org'])
  assert.deepEqual(servers[2].listed,[])
  assert.deepEqual(servers.at(-1).listed,[])
})

test('Ed25519 PIN uses a short-lived proof and keeps the account bearer on Plex endpoints', async t => {
  let jwk, posted
  t.mock.method(globalThis, 'fetch', async (input, options) => {
    const url = new URL(input)
    assert.equal(options.credentials,'omit')
    assert.equal(options.redirect,'error')
    if (options.method==='POST') {
      assert.equal(url.href,'https://clients.plex.tv/api/v2/pins')
      posted = JSON.parse(options.body)
      jwk = posted.jwk
      return Response.json({id:7,code:'abcdXYZ',expiresIn:180})
    }
    if (url.host==='clients.plex.tv') {
      assert.equal(url.pathname,'/api/v2/pins/7')
      const [header, payload, sig] = url.searchParams.get('deviceJWT').split('.')
      const decode = text => JSON.parse(Buffer.from(text,'base64url').toString('utf8'))
      assert.equal(decode(header).kid,jwk.kid)
      assert.deepEqual([decode(payload).aud,decode(payload).iss],['plex.tv',controller])
      const key = await crypto.subtle.importKey('jwk',jwk,'Ed25519',false,['verify'])
      assert.ok(await crypto.subtle.verify('Ed25519',key,Buffer.from(sig,'base64url'),Buffer.from(header+'.'+payload)))
      return Response.json({authToken:'account-bearer'})
    }
    assert.equal(url.origin,'https://plex.tv')
    assert.equal(options.headers['X-Plex-Token'],'account-bearer')
    return Response.json([local])
  })
  const pin = await startPlex(controller)
  assert.equal(posted.strong,true)
  assert.equal(new URL(pin.approval).origin,'https://app.plex.tv')
  assert.deepEqual((await pollPlex(pin)).servers.map(server => server.token),['resource-token'])
})

test('player discovery only sends the chosen server token to that origin and exposes no query credentials', async t => {
  t.mock.method(globalThis, 'fetch', async (input, options) => {
    const url = new URL(input)
    assert.equal(url.origin,'https://media.example.org')
    assert.equal(url.search,'')
    assert.equal(options.headers['X-Plex-Token'],'own-access-key')
    if (url.pathname==='/identity') return Response.json({MediaContainer:{machineIdentifier:'server'}})
    assert.equal(url.pathname,'/clients')
    return Response.json({MediaContainer:{Server:[{name:'Music',machineIdentifier:'receiver'}]}})
  })
  assert.deepEqual(await listPlayers('https://media.example.org','own-access-key',controller), { id:'server', devices:[{id:'receiver',name:'Music'}] })
})
