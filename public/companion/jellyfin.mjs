// SPDX-License-Identifier: MIT
// Copyright (c) 2026 GrakovNe
const mediaId = /^(?:[0-9a-f]{32}|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/i
const comparable = id => id.replaceAll('-','').toLowerCase()

export function jellyfinAddress(input, acceptOrigin) {
  const match = input.trim().match(/^(https?:\/\/[^/?#\\\s]+)(\/[^?#\\\s]*)?$/i)
  if (!match || /[@%]/.test(match[1]))
    throw Error('Enter a Jellyfin server address with an optional base path and no sign-in data.')
  const origin = acceptOrigin(match[1])
  if (origin.length > 255) throw Error('The Jellyfin server address is too long for the device.')
  const base = (match[2] || '').replace(/\/$/,'')
  if (base && (base.length > 127 || base.slice(1).split('/').some(segment =>
    !/^[A-Za-z0-9._~-]+$/.test(segment) || segment === '.' || segment === '..')))
    throw Error('Enter a valid Jellyfin base path, such as /jellyfin.')
  return {origin, base}
}

function jellyfinHeader(device, token = '') {
  if (!mediaId.test(device)) throw Error('Could not identify this device for Jellyfin.')
  if (token && !/^[A-Za-z0-9._~-]+$/.test(token))
    throw Error('Enter a valid Jellyfin user access token.')
  const auth = `MediaBrowser Client="Now Playing", Device="perINKpheral", DeviceId="${device}", Version="0.1.0"` +
    (token ? `, Token="${token}"` : '')
  if (auth.length > 255) throw Error('The Jellyfin access token is too long for device requests.')
  return auth
}

async function request(server, path, { device, token, method = 'GET', body, signal }) {
  const headers = {Accept:'application/json'}
  if (device) headers.Authorization = jellyfinHeader(device,token)
  if (body) headers['Content-Type'] = 'application/json'
  const timeout = AbortSignal.timeout(15000)
  let result
  try {
    result = await fetch(server.origin + server.base + path, {
      method, headers, signal:signal ? AbortSignal.any([signal,timeout]) : timeout,
      body:body ? JSON.stringify(body) : undefined,
      redirect:'error', credentials:'omit', referrerPolicy:'no-referrer', cache:'no-store'
    })
  } catch (error) {
    if (error?.name === 'TimeoutError') throw Error('Jellyfin did not respond in time.')
    throw error
  }
  if (!result.ok) {
    if (path.startsWith('/QuickConnect/') && [401,403,404].includes(result.status))
      throw Error('Quick Connect is unavailable or expired. Start again or enter a user access token.')
    if ([400,401,403].includes(result.status) && path === '/Users/Me')
      throw Error('Use a Jellyfin user access token for this server.')
    throw Error('Jellyfin rejected the request. Check the address or start sign-in again.')
  }
  try { return await result.json() }
  catch { throw Error('This address did not return a valid Jellyfin response.') }
}

export async function inspectJellyfin(server, signal) {
  const info = await request(server,'/System/Info/Public',{signal})
  if (!mediaId.test(info?.Id) || info?.ProductName !== 'Jellyfin Server')
    throw Error('This address did not identify itself as a Jellyfin server.')
  return {...server, id:info.Id}
}

export async function beginQuickConnect(server, device, signal) {
  const active = await request(server,'/QuickConnect/Enabled',{device,signal})
  if (active !== true) throw Error('Quick Connect is disabled. Enter a Jellyfin user access token.')
  const status = await request(server,'/QuickConnect/Initiate',{device,method:'POST',signal})
  if (!/^[A-Za-z0-9]{6}$/.test(status?.Code) || typeof status?.Secret !== 'string' ||
      !status.Secret || status.Secret.length > 255)
    throw Error('Jellyfin did not provide a valid Quick Connect code.')
  return { code:status.Code, secret:status.Secret }
}

export async function pollQuickConnect(server, device, secret, signal) {
  const query = new URLSearchParams({secret})
  const status = await request(server,'/QuickConnect/Connect?' + query,{device,signal})
  if (status?.Authenticated !== true) return null
  const auth = await request(server,'/Users/AuthenticateWithQuickConnect',{
    device, method:'POST', body:{Secret:secret},signal
  })
  if (typeof auth?.AccessToken !== 'string' || !auth.AccessToken || !mediaId.test(auth?.User?.Id) ||
      (auth.ServerId && (!mediaId.test(auth.ServerId) || comparable(auth.ServerId) !== comparable(server.id))))
    throw Error('Jellyfin did not authorize an account on the selected server.')
  jellyfinHeader(device,auth.AccessToken)
  return {token:auth.AccessToken, user:auth.User.Id}
}

export async function verifyJellyfinToken(server, device, token, signal) {
  if (!token) throw Error('Enter a Jellyfin user access token.')
  const user = await request(server,'/Users/Me',{device,token,signal})
  if (!mediaId.test(user?.Id)) throw Error('Use a Jellyfin user access token for this server.')
  return {token, user:user.Id}
}

export function jellyfinSettings(server, device, auth, refresh) {
  if (!['15 s','30 s','1 min'].includes(refresh)) throw Error('Choose a refresh interval.')
  if (!mediaId.test(server?.id) || !mediaId.test(auth?.user) || typeof auth?.token !== 'string' || !auth.token)
    throw Error('Verify a Jellyfin account before filling device settings.')
  jellyfinHeader(device,auth.token)
  const connection = JSON.stringify({j:1,b:server.base,d:device,u:auth.user,s:server.id})
  if (connection.length > 255) throw Error('Shorten the Jellyfin base path to fit the device settings.')
  return { server:server.origin, token:auth.token, player1:'', player2:'', player3:'',
    server_auth:'none', connection, refresh }
}
