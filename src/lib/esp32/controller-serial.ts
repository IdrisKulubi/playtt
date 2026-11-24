/*
 * Browser <-> PlayTT ESP32 controller over USB (Web Serial; Chrome/Edge desktop).
 * Protocol: send one JSON object per line; the firmware answers with a line
 * "@@PLAYTT {json}". Everything else on the wire is human-readable log output.
 * See firmware/esp32-controller/main/playtt_serial.h.
 */

export const ESPRESSIF_USB_VENDOR_ID = 0x303a
const REPLY_PREFIX = "@@PLAYTT "

export type ControllerInfo = {
  type: "info"
  firmware: string
  board: string
  stage:
    | "not_set_up"
    | "connecting_wifi"
    | "syncing_time"
    | "registering"
    | "waiting_assignment"
    | "ready"
    | "error"
  lastError: string
  hotspot: boolean
  uptimeSeconds: number
  setupComplete?: boolean
  registered?: boolean
  deviceId?: string
  hardwareUid?: string
  server?: string
  networks?: string[]
  wifi: { connected: boolean; ssid: string; rssi?: number; ip?: string }
  secondsSinceHeartbeat?: number
}

export type ScanResult = { ssid: string; rssi: number; secure: boolean }
export type WifiNetwork = { ssid: string; password: string }

type Reply = { type: string; ok?: boolean; message?: string; [key: string]: unknown }

export function isWebSerialSupported() {
  return typeof navigator !== "undefined" && "serial" in navigator
}

export class ControllerSerial {
  private port: SerialPort
  private reader: ReadableStreamDefaultReader<string> | null = null
  private writer: WritableStreamDefaultWriter<string> | null = null
  private readLoop: Promise<void> | null = null
  private closed = false
  private waiters: { type: string; resolve: (reply: Reply) => void }[] = []
  private logListener: ((line: string) => void) | null = null
  private disconnectListener: (() => void) | null = null

  private constructor(port: SerialPort) {
    this.port = port
  }

  /** Asks the user to pick the controller's USB port, then opens it. */
  static async request(): Promise<ControllerSerial> {
    const port = await navigator.serial.requestPort({ filters: [{ usbVendorId: ESPRESSIF_USB_VENDOR_ID }] })
    const connection = new ControllerSerial(port)
    await connection.open()
    return connection
  }

  /**
   * Reopens a port the user already granted, without a prompt. The ESP32-S3's
   * USB drops and re-enumerates on every restart, so this is used to reconnect.
   */
  static async reconnect(timeoutMs = 20000): Promise<ControllerSerial> {
    const started = Date.now()
    while (Date.now() - started < timeoutMs) {
      const ports = await navigator.serial.getPorts()
      const port = ports.find((candidate) => candidate.getInfo().usbVendorId === ESPRESSIF_USB_VENDOR_ID)
      if (port) {
        try {
          const connection = new ControllerSerial(port)
          await connection.open()
          return connection
        } catch {
          // Still enumerating; try again shortly.
        }
      }
      await new Promise((resolve) => window.setTimeout(resolve, 1000))
    }
    throw new Error("Couldn't reconnect to the controller. Unplug it, plug it back in and press Connect.")
  }

  get rawPort() {
    return this.port
  }

  onLog(listener: (line: string) => void) {
    this.logListener = listener
  }

  onDisconnect(listener: () => void) {
    this.disconnectListener = listener
  }

  private async open() {
    await this.port.open({ baudRate: 115200 })
    // Keep DTR/RTS low: toggling them resets ESP32 boards.
    await this.port.setSignals({ dataTerminalReady: false, requestToSend: false }).catch(() => undefined)

    const decoder = new TextDecoderStream()
    void this.port.readable!.pipeTo(decoder.writable as WritableStream<Uint8Array>).catch(() => undefined)
    this.reader = decoder.readable.getReader()

    const encoder = new TextEncoderStream()
    void encoder.readable.pipeTo(this.port.writable!).catch(() => undefined)
    this.writer = encoder.writable.getWriter()

    this.readLoop = this.pump()
  }

  private async pump() {
    let buffer = ""
    try {
      while (!this.closed && this.reader) {
        const { value, done } = await this.reader.read()
        if (done) break
        buffer += value
        let newline = buffer.search(/\r?\n/)
        while (newline >= 0) {
          const line = buffer.slice(0, newline)
          buffer = buffer.slice(newline + (buffer[newline] === "\r" ? 2 : 1))
          this.handleLine(line)
          newline = buffer.search(/\r?\n/)
        }
      }
    } catch {
      // Unplugged or closed.
    }
    if (!this.closed) this.disconnectListener?.()
  }

  private handleLine(rawLine: string) {
    // Strip ANSI colour codes from ESP-IDF logs.
    const line = rawLine.replace(/\x1b\[[0-9;]*m/g, "")
    const index = line.indexOf(REPLY_PREFIX)
    if (index >= 0) {
      try {
        const reply = JSON.parse(line.slice(index + REPLY_PREFIX.length)) as Reply
        const waiterIndex = this.waiters.findIndex((waiter) => waiter.type === reply.type || reply.type === "error")
        if (waiterIndex >= 0) {
          const [waiter] = this.waiters.splice(waiterIndex, 1)
          waiter.resolve(reply)
        }
      } catch {
        // Partial or garbled line; ignore.
      }
      return
    }
    if (line.trim()) this.logListener?.(line)
  }

  private async send(payload: Record<string, unknown>) {
    if (!this.writer) throw new Error("Not connected.")
    await this.writer.write(`${JSON.stringify(payload)}\n`)
  }

  private request<T extends Reply>(payload: Record<string, unknown>, type: string, timeoutMs = 8000): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.waiters = this.waiters.filter((waiter) => waiter.resolve !== done)
        reject(new Error("The controller didn't answer. Check it's running PlayTT firmware."))
      }, timeoutMs)
      const done = (reply: Reply) => {
        window.clearTimeout(timer)
        if (reply.type === "error" || reply.ok === false) {
          reject(new Error(reply.message ?? "The controller rejected the request."))
        } else {
          resolve(reply as T)
        }
      }
      this.waiters.push({ type, resolve: done })
      this.send(payload).catch((error: unknown) => {
        window.clearTimeout(timer)
        reject(error instanceof Error ? error : new Error("Couldn't write to the controller."))
      })
    })
  }

  info() {
    return this.request<ControllerInfo & Reply>({ cmd: "info" }, "info", 4000)
  }

  async scan(): Promise<ScanResult[]> {
    const reply = await this.request<Reply & { networks: ScanResult[] }>({ cmd: "scan" }, "scan", 20000)
    return reply.networks ?? []
  }

  setWifi(networks: WifiNetwork[]) {
    return this.request({ cmd: "set_wifi", networks }, "set_wifi")
  }

  register(input: { enrollmentCode: string; server: string; networks?: WifiNetwork[] }) {
    return this.request<Reply & { hardwareUid: string }>({ cmd: "register", ...input }, "register")
  }

  reboot() {
    return this.request({ cmd: "reboot" }, "reboot")
  }

  /** Waits until the controller answers `info` again (e.g. after a restart). */
  async waitUntilResponsive(timeoutMs = 30000) {
    const started = Date.now()
    while (Date.now() - started < timeoutMs) {
      try {
        return await this.info()
      } catch {
        await new Promise((resolve) => window.setTimeout(resolve, 1500))
      }
    }
    throw new Error("The controller didn't come back after restarting.")
  }

  /** Releases the port (needed before flashing, which opens it separately). */
  async close() {
    this.closed = true
    try {
      await this.reader?.cancel()
    } catch {
      // Already closed.
    }
    try {
      await this.writer?.close()
    } catch {
      // Already closed.
    }
    await this.readLoop?.catch(() => undefined)
    // pipeTo locks need a moment to release before the port can close.
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        await this.port.close()
        return
      } catch {
        await new Promise((resolve) => window.setTimeout(resolve, 100))
      }
    }
  }
}
