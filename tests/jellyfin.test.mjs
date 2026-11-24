// SPDX-License-Identifier: MIT
import assert from 'node:assert/strict'
import test from 'node:test'
import { beginQuickConnect, inspectJellyfin, jellyfinAddress, jellyfinSettings, pollQuickConnect, verifyJellyfinToken } from '../public/companion/jellyfin.mjs'

const id = '05d70ef986894468845aae54acccdb00'
const user = 'cbe1c1fdcb9d4bec88aa5eb100f7ddeb'
const device = '6f8e58b9-ba36-4e14-8054-e0aab1098ce3'
const server = {origin:'https://media.example.test',base:'/jellyfin',id}
const auth = {user,token:'fixture-user-key'}
const validateOrigin = value => new URL(value).origin

test('the explicit server origin and prefix are preserved without path traversal or credentials', () => {
  assert.deepEqual(jellyfinAddress(server.origin+'/jellyfin/',validateOrigin),{origin:server.origin,base:'/jellyfin'})
  assert.deepEqual(jellyfinAddress(server.origin,validateOrigin),{origin:server.origin,base:''})
  for (const value of [
    server.origin+'/x/../jellyfin', server.origin+'/%2e%2e', server.origin+'//jellyfin',
    server.origin+'/jellyfin?token=abc', server.origin+'/jellyfin#x', 'https://user:secret@media.example.test',
    server.origin+'\\example.test', 'file:///jellyfin', server.origin+'/foo/%2Fother'
  ]) assert.throws(() => jellyfinAddress(value,validateOrigin))
})

test('Quick Connect uses only the selected base path and a transient protocol secret', async t => {
  const observed=[]
  const secret='transient&secret'
  t.mock.method(globalThis,'fetch',async (url,options) => {
    const target=new URL(url)
    assert.equal(target.origin,server.origin)
    assert.equal(options.redirect,'error')
    assert.equal(options.credentials,'omit')
    assert.equal(options.referrerPolicy,'no-referrer')
    const route=target.pathname.replace('/jellyfin','')
    observed.push([options.method,route])
    switch (route) {
      case '/System/Info/Public':
        assert.equal(options.headers.Authorization,undefined)
        return Response.json({Id:id,ProductName:'Jellyfin Server'})
      case '/QuickConnect/Enabled':
        return Response.json(true)
      case '/QuickConnect/Initiate':
        assert.match(options.headers.Authorization,/^MediaBrowser /)
        assert.match(options.headers.Authorization,new RegExp(`DeviceId="${device}"`))
        return Response.json({Code:'123456',Secret:secret})
      case '/QuickConnect/Connect':
        assert.equal(target.searchParams.get('secret'),secret)
        return Response.json({Authenticated:true})
      case '/Users/AuthenticateWithQuickConnect':
        assert.deepEqual(JSON.parse(options.body),{Secret:secret})
        return Response.json({User:{Id:user},ServerId:id,AccessToken:auth.token})
      default: assert.fail('unexpected request')
    }
  })
  assert.deepEqual(await inspectJellyfin(server),server)
  assert.deepEqual(await beginQuickConnect(server,device),{code:'123456',secret})
  assert.deepEqual(await pollQuickConnect(server,device,secret),auth)
  assert.deepEqual(observed,[
    ['GET','/System/Info/Public'],['GET','/QuickConnect/Enabled'],['POST','/QuickConnect/Initiate'],
    ['GET','/QuickConnect/Connect'],['POST','/Users/AuthenticateWithQuickConnect']
  ])
  assert.deepEqual(jellyfinSettings(server,device,auth,'30 s'),{
    server:server.origin, player1:'',player2:'',player3:'',server_auth:'none',refresh:'30 s',token:auth.token,
    connection:JSON.stringify({j:1,b:'/jellyfin',d:device,u:user,s:id})
  })
})

test('invalid tokens, a server API key, disabled Quick Connect and changed identity fail closed', async t => {
  let response
  let requests=0
  t.mock.method(globalThis,'fetch',async () => { requests++; return response.clone() })
  await assert.rejects(verifyJellyfinToken(server,device,'invalid"token'),/valid Jellyfin user/)
  await assert.rejects(verifyJellyfinToken(server,device,'x'.repeat(222)),/too long/)
  assert.equal(requests,0)
  response=Response.json({}, {status:400})
  await assert.rejects(verifyJellyfinToken(server,device,'server-api-key'),/user access token/)
  response=Response.json(false)
  await assert.rejects(beginQuickConnect(server,device),/disabled/)
  response=Response.json({Id:id,ProductName:'Unexpected'})
  await assert.rejects(inspectJellyfin(server),/identify/)
  response=Response.json({Authenticated:false})
  assert.equal(await pollQuickConnect(server,device,'pending'),null)
  assert.throws(() => jellyfinSettings({...server,base:'/'+ 'x'.repeat(128)},device,auth,'15 s'),/Shorten/)
})
