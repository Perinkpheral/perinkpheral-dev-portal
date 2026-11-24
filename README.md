<img src="public/favicon.svg" width="96" alt="The perINKpheral mark: two corners of an empty frame">

# perINKpheral developer portal

Source for [perinkpheral.dev](https://perinkpheral.dev), the perINKpheral site
in English and Russian. Includes documentation for Perinkpheral OS and the browser flasher.

[Getting started](https://perinkpheral.dev/start) -
[Hardware](https://perinkpheral.dev/hardware) -
[Web flasher](https://perinkpheral.dev/flash) -
[Device setup](https://perinkpheral.dev/setup) -
[Firmware](https://perinkpheral.dev/firmware) -
[Developer documentation](https://perinkpheral.dev/sdk).
Application guide (PDF):
[English](https://github.com/Perinkpheral/perinkpheral-os/releases/latest/download/perinkpheral-app-guide.pdf),
[Russian](https://github.com/Perinkpheral/perinkpheral-os/releases/latest/download/perinkpheral-app-guide.ru.pdf).

## Development

Requires Node.js 22.12 or later. CI uses Node.js 22; tests use its built-in TypeScript stripping.

```sh
npm ci
npm run images
npm run dev
npm run check
npx playwright install chromium
npm run test:browser
npm run build
```

The development server uses `http://localhost:5173`. The build writes static
pages for both languages to `dist/`.

Browser tests mock the serial connection and network responses; they do not flash a device.

CI renders the showcase, checks and builds every push. Each successful push to `main` publishes
the site to GitHub Pages and creates a release.

## Repository

- `src/pages/` - page content; `src/content/` - navigation, metadata and external links.
- `src/components/` - shared interface components, including the guide's lower navigation.
- `public/` - images, domain configuration and font licenses.
- `scripts/` - page prerendering and image preparation.

The setup path is Start → Hardware → Flash → Device setup. Hardware owns assembly
instructions, Flash owns USB installation, and Device setup owns Wi-Fi and app
installation. Start is an overview. Keep a detailed instruction in its owning page
and link to it from the others. Update both languages, `src/content/pages.ts` and
internal anchors when moving a section.

## Sources and generated files

- [Firmware and SDK](https://github.com/Perinkpheral/perinkpheral-os) own device behavior,
  recovery, API references, guide PDFs and release files. The flasher reads that
  repository's Pages index directly.
- [Applications](https://github.com/perinkpheral/perinkpheral-apps) own the catalog and
  app screenshots used as source material.
- [CLion plugin](https://github.com/perinkpheral/perinkpheral-clion-plugin) and
  [Home Assistant integration](https://github.com/perinkpheral/perinkpheral-hacs) own
  their integration instructions.

`npm run build` generates `dist/` and a temporary `dist-ssr/`; neither is committed.
`npm run images` builds the eight showcase applications, captures their screens in
the real simulator, and composites the case pictures. It needs Java 21+, a C compiler,
wasi-sdk 34 (`WASI_SDK_PATH`), ffmpeg and cwebp. By default it uses sibling checkouts
`../perinkpheral-os` and `../perinkpheral-apps`; override them with `PERINKPHERAL` and
`PERINKPHERAL_APPS`. CI checks out both repositories' `main` and runs this before
building the site. `public/screens/sources.json` records the exact revisions used.
After an application release that changes a showcase frame, update and review the
pictures and commit them; the CI run of that commit publishes the new showcase. Runs on other
branches and pull requests only build and check.

The inputs in `assets/showcase/` fix the time, settings and mock responses. All values
are demonstration data, including NVIDIA's rising price series; no live accounts or
market data are used. Frames are generated in temporary folders, separate from the
applications' reviewed regression baselines, and each is compared with its reviewed
picture, `assets/showcase/<name>.png`: a frame that differs fails the build and nothing
is published. After a deliberate change, `npm run screens -- --update` writes the
pictures anew; look at each one before committing it. The generated app screens and case
composites are ignored by git and included in the deployed site.

`assets/renders/` holds three blank case views at 1600 x 1067, encoded as lossless WebP.
They are reduced from the original 6000 x 4000 PNGs under the firmware repository's
local `hardware/render/`. CI needs only these committed sources. Other case angles
and the SDK's `kit-*` illustrations are static assets in `public/`.

To refresh the static case angles after an enclosure change, encode the production
PNGs at the two gallery widths with the same WebP settings:

```sh
for angle in back back34r buttons left right top; do
    for width in 800 1600; do
        cwebp -quiet -q 80 -resize "$width" 0 \
            "${PERINKPHERAL:-../perinkpheral-os}/hardware/render/perinkpheral_$angle.png" \
            -o "public/renders/$angle-$width.webp"
    done
done
```

After running `npm run images`, refresh the link preview from the Weather
composite, keeping the centered 1200 x 630 crop and JPEG quality:

```sh
ffmpeg -loglevel error -y -i public/renders/hero-weather-1600.webp \
    -vf 'crop=1600:840,scale=1200:630:flags=lanczos,format=yuvj420p' \
    -q:v 3 -frames:v 1 -update 1 public/og.jpg
```

## Now Playing companion

The device opens `public/companion/now-playing.html` at
`https://perinkpheral.dev/companion/now-playing.html`. The page is static and uses
the firmware's two-window settings bridge. The user confirms the device tab's
exact origin, fills its form, and presses Save on the device. The companion
never sends credentials in a wildcard message. It follows the portal or browser
language, with an English/Russian switch on the same URL.

Manual setup accepts an explicit HTTP LAN or HTTPS server origin and its Plex
access key independently of discovery. Plex sign-in uses Plex's hosted Ed25519
PIN/JWK flow. The browser keeps its ephemeral signing key and account JWT in
memory and passes only scoped server and player resource keys to the approved
device. The official PIN exchange takes a short-lived signed device proof.
Access keys stay in headers or device form values, outside navigable URLs.

An existing custom address stays selected through sign-in. The companion asks
before using a scoped server key at a custom origin. If Plex did not list that
origin, it first compares the public identity without credentials. An identity
match alone conveys no ownership. Cloud player selection may supply an owned
player's local address for the device to verify after Save. Browser discovery
depends on server CORS, HTTPS and local-network access. Browser-only reverse
proxy cookies cannot be handed off. An operator-issued Authorization value
can be supplied explicitly for the selected HTTPS server, separately from the
Plex token and any player token.

The flow rejects values that exceed 255 bytes. A missing direct player key
replaces the saved key with the app's disabled value, since the firmware retains
blank secrets on Save. Proxy Authorization can be removed explicitly through
the setup form. Address changes can clear unchanged credentials, so re-enter
the proxy value if it is still needed.

Run `node --test tests/now-playing.test.mjs` and
`npm run test:browser -- tests/browser/now-playing.spec.mjs` for the offline
companion checks. These test the bridge and mocked authentication. A real
account and saved configuration still require qualification.

[Official Plex Media Server authentication documentation](https://developer.plex.tv/pms/)

## License

[MIT](LICENSE). Departure Mono and Jersey use SIL OFL 1.1:
[Departure Mono](public/licenses/OFL-DepartureMono.txt),
[Jersey](public/licenses/OFL-Jersey.txt).
