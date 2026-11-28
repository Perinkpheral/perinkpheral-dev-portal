// Where things are: the repositories, the files in them, the author.

const GITHUB = 'https://github.com/perinkpheral'

export const repo = {
  firmware: `${GITHUB}/perinkpheral-os`,
  apps: `${GITHUB}/perinkpheral-apps`,
  clion: `${GITHUB}/perinkpheral-clion-plugin`,
  homeAssistant: `${GITHUB}/perinkpheral-hacs`,
  portal: `${GITHUB}/perinkpheral-dev-portal`,
}

const blob = (path: string) => `${repo.firmware}/blob/main/${path}`
const caseDirectory = 'https://cdn.jsdelivr.net/gh/Perinkpheral/perinkpheral-os@91dbbd36dff98d9de0bbd1dcf9c23f8ef82e1f91/hardware/step/rev1'

export const caseFiles = {
  frame: `${caseDirectory}/01-frame-with-logo.3mf`,
  back: `${caseDirectory}/02-back-panel.3mf`,
  base: `${caseDirectory}/03-base-cover.3mf`,
  bottom: `${caseDirectory}/04-bottom.3mf`,
  bracket: `${caseDirectory}/05-corner-bracket.3mf`,
  caps: `${caseDirectory}/06-button-caps-x4.3mf`,
  feet: `${caseDirectory}/07-optional-tpu-feet-x6.3mf`,
  archive: `${caseDirectory}/perinkpheral-print-3mf.zip`,
  step: `${caseDirectory}/perinkpheral.step`,
}

export const files = {
  hostApi: blob('sdk/host_api.h'),
  xmlApi: blob('sdk/host/xml.h'),
  sdkLib: `${repo.firmware}/tree/main/sdk/lib`,
  hello: `${repo.firmware}/tree/main/sdk/apps/hello`,
  pollFormats: `${repo.firmware}/tree/main/docs/examples/poll-formats`,
  cmake: `${repo.firmware}/tree/main/sdk/cmake`,
  companion: blob('sdk/companion/example.html'),
  guidePdf: 'https://github.com/Perinkpheral/perinkpheral-os/releases/latest/download/perinkpheral-app-guide.pdf',
  guidePdfRu: 'https://github.com/Perinkpheral/perinkpheral-os/releases/latest/download/perinkpheral-app-guide.ru.pdf',
  hardwareNotes: blob('hardware/README.md'),
  partitions: blob('firmware/partitions.csv'),
  security: blob('SECURITY.md'),
  openapi: blob('docs/api/openapi.yaml'),
  stressReport: blob('docs/testing/stress-2026-11-27.md'),
  license: blob('LICENSE'),
  releases: `${repo.firmware}/releases`,
  catalog: `${repo.apps}/tree/main/catalog`,
}

export const author = {
  name: 'Max Grakov',
  email: 'grakovne@gmail.com',
  telegram: 'perinkpheral',
  github: GITHUB,
}
