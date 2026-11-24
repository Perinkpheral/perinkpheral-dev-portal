// SPDX-License-Identifier: MIT
// Copyright (c) 2026 GrakovNe
import russian from './now-playing.ru.mjs'

export const appName = 'now-playing'
const pinBase = 'https://clients.plex.tv/api/v2/pins'
const resourceUrl = 'https://plex.tv/api/v2/resources?includeHttps=1&includeRelay=0'
const product = 'perINKpheral Now Playing'
const slots = [1, 2, 3]
const fields = { server:'url', player1:'url', player2:'url', player3:'url', token:'secret', connection:'secret', refresh:'choice' }
const refreshValues = ['15 s', '30 s', '1 min']

export function address(value, device = false) {
  let url
  try { url = new URL(value.trim()) }
  catch { throw Error('Enter an address starting with http:// or https://.') }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      (!device && (url.pathname !== '/' || url.search || url.hash))) throw Error('Enter a server or device address without sign-in data or a path.')
  return url.origin
}

function localAddress(host) {
  const label = host.toLowerCase().replace(/\.$/, '')
  if (/^\[(?:fc[0-9a-f]{2}|fd[0-9a-f]{2}|fe[89ab][0-9a-f]):/.test(label) || label === '[::1]') return true
  const direct = label.match(/^([0-9]+)-([0-9]+)-([0-9]+)-([0-9]+)\.[a-f0-9]+\.plex\.direct$/)
  const parts = direct ? direct.slice(1).map(Number) : label.split('.').map(Number)
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 169 && parts[1] === 254 || parts[0] === 192 && parts[1] === 168 ||
    parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31
}

function serverAddress(value) {
  const origin = address(value)
  const url = new URL(origin)
  const name = url.hostname
  if (url.protocol === 'http:' && !localAddress(name) && !name.endsWith('.local') &&
      !name.endsWith('.lan') && (name.includes('.') || name.startsWith('[')))
    throw Error('Use HTTPS for a custom Internet address.')
  return origin
}

export function setupMessage(data) {
  return data?.perinkpheral === 'app' && data.name === appName && Array.isArray(data.settings) &&
    Object.entries(fields).every(([key, type]) => data.settings.some(field => field?.key === key && field.type === type && !field.hidden))
}

function value(value, label) {
  if (typeof value !== 'string' || value.length > 255 || /[^\x20-\x7e]/.test(value))
    throw Error(`${label} must fit the device’s 255-byte printable ASCII limit.`)
  return value
}

function proxyHeader(origin, authorization) {
  if (!authorization || authorization === 'none') return {}
  if (!origin.startsWith('https:')) throw Error('Proxy Authorization requires an HTTPS server address.')
  const header = value(authorization, 'Server Authorization header')
  if (!/^[A-Za-z][A-Za-z0-9-]* \S.*$/.test(header))
    throw Error('Enter the full Authorization header value issued by your proxy operator.')
  return { Authorization:header }
}

export function settings({ server, token, server_auth, serverId = '', players = [], refresh }) {
  if (!refreshValues.includes(refresh)) throw Error('Choose a refresh interval.')
  if (!token) throw Error('Enter a Plex server access key.')
  if (/[^\x21-\x7e]/.test(serverId)) throw Error('Server identifier must use printable ASCII without spaces.')
  if (players.length > slots.length) throw Error('The device has three player slots.')
  const ids = new Set()
  const origins = {}
  const receivers = slots.map((slot, index) => {
    const { id = '', origin = '', token: key = '' } = players[index] || {}
    if (id.length > 127 || /[^\x21-\x7e]/.test(id)) throw Error('Player identifier must fit 127 printable ASCII bytes without spaces.')
    if (/[^\x21-\x7e]/.test(key)) throw Error('Player access key must use printable ASCII without spaces.')
    if ((origin || key) && !id) throw Error('Enter a player identifier before configuring a direct address.')
    if (id && !serverId) throw Error('Enter or discover the server identifier before selecting a player.')
    if (key && !origin) throw Error('Enter the direct player address for its access key.')
    if (id && ids.has(id)) throw Error('Choose a different player for each slot.')
    ids.add(id)
    origins[`player${slot}`] = value(origin ? serverAddress(origin) : '', 'Player address')
    return [id, key]
  })
  while (receivers.length && !receivers.at(-1)[0]) receivers.pop()
  const connection = JSON.stringify({s:serverId, r:receivers})
  const origin = value(serverAddress(server), 'Server address')
  const proxy = proxyHeader(origin, server_auth)
  return {
    server:origin, ...origins, token:value(token, 'Server access key'),
    connection:value(connection, 'Server and player identifiers and access keys'),
    refresh,
    ...(server_auth === 'none' ? { server_auth:'none' } : proxy.Authorization ? { server_auth:proxy.Authorization } : {})
  }
}

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/, '')
}

function claim(object) {
  return base64url(new TextEncoder().encode(JSON.stringify(object)))
}

function headers(controller, extra = {}) {
  return {
    Accept:'application/json',
    'X-Plex-Client-Identifier':controller,
    'X-Plex-Product':product,
    'X-Plex-Version':'1',
    ...extra
  }
}

async function responseJson(url, init) {
  const response = await fetch(url, { cache:'no-store', credentials:'omit', redirect:'error', referrerPolicy:'no-referrer', ...init })
  if (response.status === 429) throw Error('Plex is limiting requests. Wait a little and try again.')
  if (!response.ok) throw Error('The server refused the request. Check the connection and sign in again if needed.')
  try { return await response.json() }
  catch { throw Error('The server returned an unreadable response.') }
}

export async function startPlex(controller, signal) {
  if (!crypto.subtle) throw Error('Open this page over HTTPS in a current browser to sign in.')
  let pair
  try {
    pair = await crypto.subtle.generateKey('Ed25519', false, ['sign', 'verify'])
  } catch {
    throw Error('This browser cannot sign in with Plex. Update the browser or enter your server and access key manually.')
  }
  const { kty, crv, x } = await crypto.subtle.exportKey('jwk', pair.publicKey)
  const kid = base64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({ crv, kty, x }))).then(digest => new Uint8Array(digest)))
  const pin = await responseJson(pinBase, {
    signal, method:'POST', headers:headers(controller, { 'Content-Type':'application/json' }),
    body:JSON.stringify({ strong:true, jwk:{ kty, crv, x, kid, alg:'EdDSA' } })
  })
  if (!Number.isSafeInteger(pin.id) || pin.id <= 0 || typeof pin.code !== 'string' || !/^[a-zA-Z0-9]{1,128}$/.test(pin.code))
    throw Error('Plex did not return a valid sign-in request.')
  const expires = Date.parse(pin.expiresAt) || (Number.isFinite(pin.expiresIn) ? Date.now() + pin.expiresIn * 1000 : 0)
  if (expires <= Date.now()) throw Error('Plex returned an expired sign-in request.')
  const approval = new URL('https://app.plex.tv/auth')
  approval.hash = '?' + new URLSearchParams({ clientID:controller, code:pin.code, 'context[device][product]':product })
  return { approval:approval.href, expires, id:pin.id, controller, key:pair.privateKey, kid }
}

export async function pollPlex(login, signal) {
  const now = Math.floor(Date.now() / 1000)
  const input = claim({ alg:'EdDSA', typ:'JWT', kid:login.kid }) + '.' +
    claim({ aud:'plex.tv', iss:login.controller, iat:now, exp:now+90 })
  const signature = await crypto.subtle.sign('Ed25519', login.key, new TextEncoder().encode(input))
  const url = new URL(`${pinBase}/${login.id}`)
  // Plex's PIN exchange requires a signed device proof here. It is short-lived
  // and separate from the account and server access tokens, which go in headers.
  url.searchParams.set('deviceJWT', input + '.' + base64url(new Uint8Array(signature)))
  const pin = await responseJson(url.href, { signal, headers:headers(login.controller) })
  if (!pin.authToken) return null
  if (typeof pin.authToken !== 'string' || /[^\x21-\x7e]/.test(pin.authToken)) throw Error('Plex did not return a valid account token.')
  const resources = await responseJson(resourceUrl, { signal, headers:headers(login.controller, { 'X-Plex-Token':pin.authToken }) })
  return { servers:personalServers(resources), players:personalPlayers(resources) }
}

function ownedResources(resources, capabilities) {
  if (!Array.isArray(resources)) throw Error('Plex did not return a list of servers.')
  return resources.filter(resource => resource && [true, 1, '1'].includes(resource.owned) &&
    typeof resource.provides === 'string' && resource.provides.split(',').some(cap => capabilities.includes(cap.trim())) &&
    typeof resource.clientIdentifier === 'string' && resource.clientIdentifier)
}

function connections(resource) {
  return (Array.isArray(resource.connections) ? resource.connections : []).flatMap(connection => {
    try {
      if ([true, 1, '1'].includes(connection.relay)) return []
      const origin = address(connection.uri)
      const local = [true, 1, '1'].includes(connection.local) && localAddress(new URL(origin).hostname)
      return local || origin.startsWith('https:') ? [{ origin, local }] : []
    } catch { return [] }
  }).sort((a,b) => Number(b.origin.startsWith('https:')) - Number(a.origin.startsWith('https:')))
}

export function personalServers(resources) {
  return ownedResources(resources,['server']).map(resource => {
    const addresses = connections(resource)
    return { name:String(resource.name || 'Plex server'), id:resource.clientIdentifier,
      origin:addresses.find(connection => connection.local)?.origin || '', token:resource.accessToken ?? '',
      listed:addresses.map(connection => connection.origin) }
  })
}

export function personalPlayers(resources) {
  return ownedResources(resources,['player','client']).flatMap(resource => {
    const direct = connections(resource).find(connection => connection.local)
    return direct ? [{ name:String(resource.name || resource.product || 'Plex player'), id:resource.clientIdentifier,
      origin:direct.origin, token:resource.accessToken ?? '' }] : []
  })
}

export async function listPlayers(server, token, controller, signal, authorization) {
  const origin = serverAddress(server)
  const options = { signal, headers:headers(controller, {
    'X-Plex-Token':value(token,'Server access key'), ...proxyHeader(origin, authorization)
  }) }
  const [identity, clients] = await Promise.all([
    responseJson(origin + '/identity', options),
    responseJson(origin + '/clients', options)
  ])
  const id = identity?.MediaContainer?.machineIdentifier
  if (typeof id !== 'string' || !id) throw Error('The server did not provide an identity.')
  const devices = clients?.MediaContainer?.Server
  return { id, devices:Array.isArray(devices) ? devices.flatMap(device => {
    return typeof device?.machineIdentifier === 'string' && device.machineIdentifier ?
      [{ id:device.machineIdentifier, name:String(device.name || device.product || 'Plex player') }] : []
  }) : [] }
}

async function verifyServer(server, token, controller, signal, authorization) {
  const origin = serverAddress(server)
  const identity = await responseJson(origin + '/identity', {
    signal, headers:token ? headers(controller, {
      'X-Plex-Token':value(token,'Server access key'), ...proxyHeader(origin, authorization)
    }) : { Accept:'application/json' }
  })
  return identity?.MediaContainer?.machineIdentifier
}

if (typeof document !== 'undefined') init()

function preferredLanguage() {
  try {
    const saved = sessionStorage.getItem('now-playing-lang') || localStorage.getItem('perinkpheral-lang')
    if (saved === 'en' || saved === 'ru') return saved
  } catch { /* Browser storage may be unavailable. */ }
  return navigator.language?.toLowerCase().startsWith('ru') ? 'ru' : 'en'
}

function localize(language, text, replacements = {}) {
  const messages = language === 'ru' ? russian : {}
  const limit = text.match(/^(.+) (must fit the device’s 255-byte printable ASCII limit\.|must use printable ASCII without spaces\.)$/)
  if (limit && language === 'ru') {
    text = '{label} ' + limit[2]
    replacements = { label:messages[limit[1]] || limit[1] }
  }
  return (messages[text] || text).replace(/\{([a-z]+)\}/g, (match, key) => replacements[key] ?? match)
}

function init() {
  const byId = id => document.getElementById(id)
  const show = (id, visible = true) => { byId(id).hidden = !visible }
  const slotId = (name, slot) => `${name}-${slot}`
  for (const slot of slots) {
    const copy = byId('player-slot').content.cloneNode(true)
    copy.querySelectorAll('[id]').forEach(node => { node.id = slotId(node.id,slot) })
    copy.querySelectorAll('label').forEach(node => { node.htmlFor = slotId(node.htmlFor,slot) })
    const section = copy.querySelector('details')
    section.id = slotId('slot',slot)
    section.open = slot === 1
    byId('player-slots').append(copy)
  }
  let language = preferredLanguage()
  const t = (text,replacements) => localize(language,text,replacements)
  const staticText = []
  const nodes = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  while (nodes.nextNode()) {
    const node = nodes.currentNode
    if (node.data.trim()) staticText.push([node,node.data])
  }
  const feedback = new Map()
  function report(id, text, replacements) {
    feedback.set(id,[text,replacements])
    byId(id).textContent = t(text,replacements)
  }
  const activity = text => report('activity',text)
  function changeLanguage() {
    document.documentElement.lang = language
    document.title = t('Now Playing setup · perINKpheral')
    byId('language').value = language
    byId('cloud-server').placeholder = t('Use the server’s LAN address')
    for (const [node,text] of staticText) node.data = text.replace(text.trim(),t(text.trim()))
    for (const slot of slots) byId(slotId('slot',slot)).querySelector('summary').textContent = t('Player {number}',{number:slot})
    const placeholders = slots.map(slot => [slotId('receiver',slot),'Enter details or leave empty'])
    for (const [id,text] of [...placeholders, ['server-choice','Choose a server']]) {
      const placeholder = byId(id).querySelector('option[value=""]')
      if (placeholder) placeholder.textContent = t(text)
    }
    for (const [id,[text,replacements]] of feedback) byId(id).textContent = t(text,replacements)
  }
  changeLanguage()
  byId('language').addEventListener('change', () => {
    language = byId('language').value
    try { sessionStorage.setItem('now-playing-lang',language) } catch { /* The tab still changes language. */ }
    changeLanguage()
  })
  let peer = null, handshake = null, mode = '', matches = [], signIn = null, probe = null, peers = [], cloudPlayers = [], supportsProxy = false
  const opener = window.top === window ? window.opener : null
  const controller = crypto.randomUUID()
  const text = id => byId(id).value
  const choose = (id, selected) => { byId(id).value = selected }
  const fail = error => { if (error?.name !== 'AbortError') activity(error instanceof TypeError ? 'The browser could not reach the address. Check TLS and allow local-network access if prompted.' : (error?.message || 'Setup could not continue.')) }

  function bind() {
    peer = null
    byId('setup').disabled = true
    try {
      const expected = address(text('device'), true)
      if (!opener || !handshake || handshake.origin !== expected)
        throw Error('This window is not connected to the device address you entered. Open setup again from that device.')
      peer = expected
      supportsProxy = handshake.supportsProxy
      byId('device').readOnly = true
      byId('bind').disabled = true
      byId('setup').disabled = false
      show('proxy-settings', supportsProxy)
      choose('server', handshake.values?.server || '')
      if (refreshValues.includes(handshake.values?.refresh)) choose('refresh', handshake.values.refresh)
      report('peer','Device confirmed at {address}.',{address:expected})
    } catch (error) {
      report('peer',error.message)
    }
  }

  window.addEventListener('message', event => {
    if (!opener || event.source !== opener || peer || !setupMessage(event.data)) return
    try {
      if (address(event.origin) !== event.origin) return
      handshake = { origin:event.origin, values:event.data.values,
        supportsProxy:event.data.settings.some(field => field?.key === 'server_auth' && field.type === 'secret' && !field.hidden) }
      report('peer','The device tab responded. Verify its address above.')
    } catch { /* A null or non-HTTP origin cannot receive settings. */ }
  })
  opener?.postMessage({ perinkpheral:'ready' }, '*')
  byId('bind').addEventListener('click', bind)

  function resetOptions(select, placeholder) {
    byId(select).replaceChildren(new Option(t(placeholder), ''))
  }

  function clearPlayers() {
    probe?.abort()
    probe = null
    peers = []
    for (const slot of slots) {
      resetOptions(slotId('receiver',slot),'Enter details or leave empty')
      for (const field of ['player-id','player','player-token']) choose(slotId(field,slot),'')
    }
  }
  function showPlayers(discovered = []) {
    peers = [...cloudPlayers, ...discovered.filter(player => !cloudPlayers.some(cloud => cloud.id === player.id))]
    for (const slot of slots) {
      const select = slotId('receiver',slot)
      resetOptions(select,'Enter details or leave empty')
      peers.forEach((player,i) => byId(select).add(new Option(player.origin ? `${player.name} · ${player.origin}` : player.name, String(i))))
      const current = peers.findIndex(player => player.id === text(slotId('player-id',slot)))
      if (current >= 0) choose(select,String(current))
    }
  }
  function clearProxyInput() {
    choose('server-auth','')
    byId('clear-auth').checked = false
  }
  function updateProxyInput() {
    try {
      byId('server-auth').disabled = !supportsProxy || !serverAddress(selection()?.origin || '').startsWith('https:')
    } catch { byId('server-auth').disabled = true }
  }
  function proxyInput() {
    if (!supportsProxy) return ''
    return byId('clear-auth').checked ? 'none' : text('server-auth')
  }
  function saveProxyInput(server, players) {
    const value = proxyInput()
    if (value || !supportsProxy) return value
    const previous = handshake.values?.server
    // The firmware keeps blank secrets, even when setting an empty address
    // for the first time. Never attach an old unbound proxy key to that address.
    const samePlayers = slots.every((slot,index) => {
      const origin = players[index].origin
      return (origin ? serverAddress(origin) : '') === (handshake.values?.[`player${slot}`] || '')
    })
    return previous && serverAddress(server) === previous && samePlayers ? '' : 'none'
  }
  function cancelProbe() {
    probe?.abort()
    probe = null
    activity('')
  }
  for (const id of ['server-auth', 'clear-auth', 'cloud-confirm', 'refresh']) {
    byId(id).addEventListener('input', cancelProbe)
  }

  function switchMode(next) {
    signIn?.abort()
    signIn = null
    clearPlayers()
    mode = next
    clearProxyInput()
    matches = []
    cloudPlayers = []
    resetOptions('server-choice','Choose a server')
    show('cloud', next === 'cloud')
    show('manual-settings', next === 'manual')
    show('target-settings', next === 'manual')
    show('approve', false)
    show('cancel', false)
    show('server-choice-label', false)
    show('server-choice', false)
    show('custom-cloud', false)
    byId('cloud-confirm').checked = false
    if (next === 'cloud') choose('cloud-server', text('server'))
    updateProxyInput()
    activity('')
  }

  function selection() {
    if (mode === 'manual') return { origin:text('server'), token:text('token'), id:text('server-id') }
    if (text('server-choice') === '') return null
    const selected = matches[Number(text('server-choice'))]
    if (!selected) return null
    const custom = text('cloud-server').trim()
    if (!custom) return selected
    const origin = serverAddress(custom)
    return { ...selected, origin, custom:true }
  }

  async function authorizeServer(selected, signal) {
    const authorization = proxyInput()
    if (!selected.origin) throw Error('Enter your server address.')
    if (selected.custom && !byId('cloud-confirm').checked)
      throw Error('Confirm the exact address before using its Plex access key.')
    if (selected.custom && !selected.listed.includes(selected.origin)) {
      const publicId = await verifyServer(selected.origin, '', controller, signal)
      if (publicId !== selected.id)
        throw Error('This address did not identify itself as your selected Plex server. No access key was sent.')
    }
    const id = await verifyServer(selected.origin, selected.token, controller, signal, authorization)
    if (id !== selected.id) throw Error('The server answered with a different identity.')
  }

  byId('manual').addEventListener('click', () => switchMode('manual'))
  byId('signin').addEventListener('click', async () => {
    switchMode('cloud')
    const attempt = signIn = new AbortController()
    show('cancel')
    activity('Preparing Plex sign-in…')
    try {
      const login = await startPlex(controller, attempt.signal)
      if (signIn !== attempt) return
      byId('approve').href = login.approval
      show('approve')
      activity('Open Plex sign-in and approve this connection. Then return here.')
      while (Date.now() < login.expires && signIn === attempt) {
        await new Promise(resolve => setTimeout(resolve,5000))
        if (signIn !== attempt || Date.now() >= login.expires) break
        const resources = await pollPlex(login, attempt.signal)
        if (signIn !== attempt) return
        if (resources === null) continue
        matches = resources.servers
        cloudPlayers = resources.players
        show('approve', false)
        show('cancel', false)
        signIn = null
        if (!matches.length) {
          activity('Plex found no personal LAN server. You can enter your server manually.')
          return
        }
        matches.forEach((item,i) => byId('server-choice').add(new Option(item.origin ? `${item.name} · ${item.origin}` : item.name, String(i))))
        show('server-choice-label')
        show('server-choice')
        activity('Choose a server. Your existing device address will stay as it is until you save a new one.')
        return
      }
      if (signIn === attempt) {
        signIn = null
        show('approve', false)
        show('cancel', false)
        activity('This sign-in request expired. Start again.')
      }
    } catch (error) {
      if (signIn === attempt) {
        signIn = null
        show('approve', false)
        show('cancel', false)
        fail(error)
      }
    }
  })
  byId('cancel').addEventListener('click', () => {
    switchMode('cloud')
    activity('Sign-in cancelled.')
  })
  byId('server-choice').addEventListener('change', () => {
    clearPlayers()
    showPlayers()
    clearProxyInput()
    const chosen = text('server-choice') !== ''
    show('custom-cloud', chosen)
    show('target-settings', chosen)
    byId('cloud-confirm').checked = false
    updateProxyInput()
    activity('')
  })
  function updateCloudApproval() {
    const custom = text('cloud-server').trim()
    show('cloud-confirm-label', Boolean(custom))
    report('cloud-confirm-text',custom ? 'I trust {address} to receive this server’s access key.' : '',{address:custom})
  }
  byId('cloud-server').addEventListener('input', () => {
    clearPlayers()
    showPlayers()
    clearProxyInput()
    byId('cloud-confirm').checked = false
    updateCloudApproval()
    updateProxyInput()
  })
  byId('server-choice').addEventListener('change', updateCloudApproval)
  byId('server').addEventListener('input', () => {
    choose('server-id','')
    clearProxyInput()
    clearPlayers()
    updateProxyInput()
  })
  byId('token').addEventListener('input', clearPlayers)
  byId('server-id').addEventListener('input', cancelProbe)
  for (const slot of slots) {
    const receiver = slotId('receiver',slot)
    const playerId = slotId('player-id',slot)
    const origin = slotId('player',slot)
    const key = slotId('player-token',slot)
    byId(key).addEventListener('input', cancelProbe)
    for (const field of [origin,playerId]) byId(field).addEventListener('input', () => {
      cancelProbe()
      choose(key,'')
      choose(receiver,'')
    })
    byId(receiver).addEventListener('change', () => {
      cancelProbe()
      const player = text(receiver) === '' ? null : peers[Number(text(receiver))]
      choose(playerId,player?.id || '')
      choose(origin,player?.origin || '')
      choose(key,typeof player?.token === 'string' ? player.token : '')
    })
  }
  byId('probe').addEventListener('click', async () => {
    probe?.abort()
    try {
      const selected = selection()
      if (!selected?.token) throw Error('Choose a server and enter its access key first.')
      const attempt = probe = new AbortController()
      const authorization = proxyInput()
      activity('Connecting to the selected server…')
      if (mode === 'cloud') await authorizeServer(selected, attempt.signal)
      const result = await listPlayers(selected.origin, selected.token, controller, attempt.signal, authorization)
      if (probe !== attempt) return
      if (selected.id && result.id !== selected.id) throw Error('The server answered with a different identity.')
      if (mode === 'manual') choose('server-id',result.id)
      showPlayers(result.devices)
      activity(peers.length ? 'Choose the players you want to use.' : 'No players are visible now. You can enter a player or leave the slots empty.')
    } catch (error) { fail(error) }
  })
  byId('fill').addEventListener('click', async () => {
    try {
      if (!peer || !opener || opener.closed) throw Error('Open setup again from your device.')
      const selected = selection()
      if (!selected) throw Error('Choose a Plex server.')
      const players = slots.map(slot => ({
        id:text(slotId('player-id',slot)), origin:text(slotId('player',slot)), token:text(slotId('player-token',slot))
      }))
      const values = settings({
        server:selected.origin, token:selected.token, serverId:selected.id || '', players,
        refresh:text('refresh'), server_auth:saveProxyInput(selected.origin,players)
      })
      if (mode === 'cloud') {
        const check = new AbortController()
        probe?.abort()
        probe = check
        byId('fill').disabled = true
        activity('Verifying the selected server…')
        try {
          await authorizeServer(selected, check.signal)
          if (probe !== check) return
        } finally {
          byId('fill').disabled = false
        }
      }
      if (opener.closed) throw Error('Open setup again from your device.')
      opener.postMessage({ perinkpheral:'settings', values }, peer)
      choose('token','')
      slots.forEach(slot => choose(slotId('player-token',slot),''))
      clearProxyInput()
      matches = []
      cloudPlayers = []
      peers = []
      byId('setup').disabled = true
      activity('Return to your device tab. Review the fields and select Save.')
    } catch (error) { fail(error) }
  })
}
