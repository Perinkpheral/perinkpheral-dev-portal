// SPDX-License-Identifier: MIT
import { expect, test } from '@playwright/test'

const portal = 'http://127.0.0.1:4181'
const device = 'http://localhost:4181'
const pms = 'https://media.example.test'
const schema = { server:'url', player:'url', token:'secret', player_token:'secret', connection:'secret', refresh:'choice', server_auth:'secret' }

async function companion(page, context, current = '', russian = false) {
  await context.route(`${device}/test-companion-device`, route => route.fulfill({
    contentType:'text/html',
    body:`<!doctype html><button id="launch">Open setup</button><script>
      let popup;
      window.received = [];
      document.querySelector('button').onclick = () => {
        popup = window.open(${JSON.stringify(portal+'/companion/now-playing.html')}, 'setup');
      };
      window.addEventListener('message', event => {
        if (event.source !== popup || event.origin !== ${JSON.stringify(portal)}) return;
        received.push(event.data);
        if (event.data.perinkpheral === 'ready') popup.postMessage({
          perinkpheral:'app',name:'now-playing',title:'Now Playing',
          settings:${JSON.stringify(Object.entries(schema).map(([key,type])=>({key,type})))},
          values:{server:${JSON.stringify(current)}, refresh:'30 s'}
        }, ${JSON.stringify(portal)});
      });
    </script>`
  }))
  await page.goto(`${device}/test-companion-device`)
  const [popup] = await Promise.all([
    page.waitForEvent('popup'), page.getByRole('button',{name:'Open setup'}).click()
  ])
  await expect(popup.getByRole('status').first()).toContainText(russian ? 'Вкладка устройства ответила' : 'The device tab responded')
  return popup
}

async function confirm(popup) {
  await popup.locator('#device').fill(device)
  await popup.locator('#bind').click()
}

for (const locale of ['en-US','ru-RU']) {
  const russian = locale === 'ru-RU'
  test.describe(locale, () => {
    test.use({locale})
    test('manual setup refuses the wrong device or a long token and sends only from an explicitly confirmed tab', async ({page, context}) => {
      const popup = await companion(page,context,'',russian)
      await popup.locator('#device').fill('http://192.168.1.42')
      await popup.locator('#bind').click()
      await expect(popup.locator('#manual')).toBeDisabled()
      await expect(popup.getByRole('status').first()).toContainText(russian ? 'не связано' : 'not connected')
      await confirm(popup)
      await popup.locator('#manual').click()
      await popup.locator('#server').fill(pms)
      await popup.locator('#token').fill('x'.repeat(256))
      await popup.locator('#fill').click()
      await expect(popup.getByText(russian ? /255 печатных символов/ : /255-byte/)).toBeVisible()
      expect(await page.evaluate(()=>window.received)).toEqual([{perinkpheral:'ready'}])
      await popup.locator('#token').fill('manual-scoped-key')
      await popup.locator('#proxy-settings summary').click()
      await popup.locator('#server-auth').fill('Bearer proxy-key')
      await popup.locator('#fill').click()
      await expect(popup.getByText(russian ? 'Вернитесь во вкладку устройства. Проверьте поля и нажмите «Сохранить».' : 'Return to your device tab. Review the fields and select Save.')).toBeVisible()
      const messages = await page.evaluate(()=>window.received)
      const {connection,...fields} = messages[1].values
      expect(fields).toEqual({server:pms, player:'', token:'manual-scoped-key', player_token:'none', refresh:'30 s', server_auth:'Bearer proxy-key'})
      expect(JSON.parse(connection)).toMatchObject({c:expect.stringMatching(/^[\da-f-]{36}$/),s:'',p:''})
      if (russian) {
        await popup.locator('#language').selectOption('en')
        await expect(popup.getByRole('heading',{name:'Now Playing setup'})).toBeVisible()
        await expect(popup.getByText('Return to your device tab. Review the fields and select Save.')).toBeVisible()
      }
    })

    test('Plex sign-in preserves custom PMS, checks an unlisted origin without credentials, and pins a scoped local player', async ({page, context}) => {
      let identity = 'wrong-server'
      const probes = []
      const cors = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'*', 'Access-Control-Allow-Methods':'GET, POST' }
      await context.route('https://clients.plex.tv/api/v2/pins**', route => {
        const request = route.request()
        if (request.method()==='POST') {
          expect(request.postDataJSON().jwk.crv).toBe('Ed25519')
          return route.fulfill({ json:{id:42,code:'AQWERTY',expiresIn:180}, headers:cors })
        }
        expect(new URL(request.url()).searchParams.has('deviceJWT')).toBeTruthy()
        return route.fulfill({ json:{authToken:'mock-account-only'}, headers:cors })
      })
      await context.route('https://plex.tv/api/v2/resources?*', route => {
        expect(route.request().headers()['x-plex-token']).toBe('mock-account-only')
        return route.fulfill({ headers:cors, json:[
          { name:'Personal server', owned:true, provides:'server', clientIdentifier:'server1', accessToken:'owned-server-key',
            connections:[{uri:'http://192.168.1.11:32400',local:true}] },
          { name:'Plexamp', owned:true, provides:'player', clientIdentifier:'player1', accessToken:'owned-player-key',
            connections:[{uri:'http://192.168.1.22:43519',local:true}] }
        ] })
      })
      await context.route(`${pms}/identity`, route => {
        probes.push(route.request().headers()['x-plex-token'] || null)
        return route.fulfill({ headers:cors, json:{MediaContainer:{machineIdentifier:identity}} })
      })
      const popup = await companion(page,context,pms,russian)
      await confirm(popup)
      await popup.locator('#signin').click()
      await expect(popup.locator('#approve')).toHaveAttribute('href',/^https:\/\/app\.plex\.tv\/auth#\?/)
      await expect(popup.locator('#server-choice')).toBeVisible({timeout:10000})
      await popup.locator('#server-choice').selectOption('0')
      await expect(popup.locator('#cloud-server')).toHaveValue(pms)
      await popup.locator('#receiver').selectOption('0')
      await popup.locator('#fill').click()
      await expect(popup.getByText(russian ? 'Подтвердите точный адрес, прежде чем использовать ключ доступа Plex.' : 'Confirm the exact address before using its Plex access key.')).toBeVisible()
      expect(probes).toEqual([])
      await popup.locator('#cloud-confirm').check()
      await popup.locator('#fill').click()
      await expect(popup.getByText(russian ? /Ключ доступа не отправлен/ : /No access key was sent/)).toBeVisible()
      expect(probes).toEqual([null])
      expect(await page.evaluate(()=>window.received)).toHaveLength(1)
      identity = 'server1'
      await popup.locator('#fill').click()
      await expect(popup.getByText(russian ? 'Вернитесь во вкладку устройства. Проверьте поля и нажмите «Сохранить».' : 'Return to your device tab. Review the fields and select Save.')).toBeVisible()
      expect(probes).toEqual([null, null, 'owned-server-key'])
      const {connection,...fields} = (await page.evaluate(()=>window.received))[1].values
      expect(fields).toEqual({server:pms,player:'http://192.168.1.22:43519',token:'owned-server-key',player_token:'owned-player-key',refresh:'30 s'})
      expect(JSON.parse(connection)).toMatchObject({s:'server1',p:'player1'})
    })
  })
}
