// SPDX-License-Identifier: MIT
type ResetLines = { setDTR(value: boolean): Promise<unknown>; setRTS(value: boolean): Promise<unknown> }

export async function openMonitorPort(port: Pick<SerialPort, 'open' | 'close'>) {
  let timedOut = false
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      port.open({ baudRate: 115200 }).then(() => {
        // Web Serial cannot cancel an open. A late success belongs to the expired
        // attempt, never to a retry or to the page's monitor cleanup.
        if (timedOut) void port.close().catch(() => {})
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          timedOut = true
          reject(new Error('Monitor port open timed out'))
        }, 10_000)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

export function isFlashVerificationError(error: unknown) {
  // esptool-js 0.7.0 exposes MD5 mismatch only through this ESPError message.
  return error instanceof Error && error.message === 'MD5 of file does not match data in flash!'
}

// USB-JTAG needs the boot pin released before RTS pulses; esptool-js's default
// hard reset can leave the C6 in its ROM loader.
export async function restartTransport(line: ResetLines | null) {
  if (!line) return
  try {
    await line.setDTR(false)
    await line.setRTS(true)
    await new Promise((resolve) => setTimeout(resolve, 100))
    await line.setRTS(false)
  } catch {
    // Unplugging the board must not prevent releasing the browser's port.
  }
}
