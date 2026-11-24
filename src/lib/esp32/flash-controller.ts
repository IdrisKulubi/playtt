/*
 * Flashes the published PlayTT controller firmware from the browser
 * (public/firmware/esp32-controller, produced by scripts/publish-esp32-firmware.mjs).
 *
 * Each file goes to its own offset (bootloader 0x0, partition table 0x8000,
 * app 0x10000). The NVS area in between is never written, so an update keeps
 * the controller's Wi-Fi and registration.
 */

export type FirmwareManifest = {
  name: string
  chip: string
  version: string
  builtAt: string
  flashMode: "dio" | "qio" | "dout" | "qout"
  flashFreq: "80m" | "40m"
  flashSize: "16MB" | "8MB" | "4MB"
  files: { path: string; address: number; size: number; sha256: string }[]
}

export const FIRMWARE_MANIFEST_URL = "/firmware/esp32-controller/manifest.json"

export async function loadFirmwareManifest(): Promise<FirmwareManifest> {
  const response = await fetch(FIRMWARE_MANIFEST_URL, { cache: "no-store" })
  if (!response.ok) throw new Error("No firmware has been published yet.")
  return (await response.json()) as FirmwareManifest
}

async function sha256Hex(data: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", data as BufferSource)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

export async function flashControllerFirmware(input: {
  port: SerialPort
  manifest: FirmwareManifest
  onProgress: (percent: number, label: string) => void
  onLog?: (line: string) => void
}) {
  const { ESPLoader, Transport } = await import("esptool-js")
  const { manifest, onProgress, onLog } = input

  onProgress(0, "Downloading firmware…")
  const fileArray = await Promise.all(
    manifest.files.map(async (file) => {
      const response = await fetch(file.path, { cache: "no-store" })
      if (!response.ok) throw new Error(`Couldn't download ${file.path}.`)
      const data = new Uint8Array(await response.arrayBuffer())
      if ((await sha256Hex(data)) !== file.sha256) {
        throw new Error("The firmware download was corrupted. Reload the page and try again.")
      }
      return { data, address: file.address }
    }),
  )

  const transport = new Transport(input.port, false)
  const loader = new ESPLoader({
    transport,
    baudrate: 460800,
    terminal: {
      clean: () => undefined,
      write: (data: string) => onLog?.(data),
      writeLine: (data: string) => onLog?.(data),
    },
  })

  try {
    onProgress(2, "Connecting to the chip…")
    const chip = await loader.main()
    if (!chip.toUpperCase().includes(manifest.chip.replace("esp32", "ESP32-").toUpperCase())) {
      throw new Error(`This board is a ${chip}, but the firmware is for ${manifest.chip.toUpperCase()}.`)
    }

    const totalBytes = fileArray.reduce((sum, file) => sum + file.data.length, 0)
    const written = new Array(fileArray.length).fill(0)
    await loader.writeFlash({
      fileArray,
      flashMode: manifest.flashMode,
      flashFreq: manifest.flashFreq,
      flashSize: manifest.flashSize,
      eraseAll: false,
      compress: true,
      reportProgress: (fileIndex, bytesWritten) => {
        written[fileIndex] = bytesWritten
        const done = written.reduce((sum, value) => sum + value, 0)
        onProgress(Math.min(99, 5 + Math.round((done / totalBytes) * 94)), "Installing…")
      },
    })

    onProgress(100, "Restarting…")
    await loader.after("hard_reset")
  } finally {
    await transport.disconnect().catch(() => undefined)
  }
}
