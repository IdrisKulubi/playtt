"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import {
  GroupedList,
  GroupedSection,
  LargeTitle,
  SectionFooter,
  SectionHeader,
  ValueRow,
  textActionClass,
} from "@/components/admin/admin-grouped"
import {
  ControllerSerial,
  isWebSerialSupported,
  type ControllerInfo,
  type ScanResult,
  type WifiNetwork,
} from "@/lib/esp32/controller-serial"
import {
  flashControllerFirmware,
  loadFirmwareManifest,
  type FirmwareManifest,
} from "@/lib/esp32/flash-controller"

type Venue = { id: string; name: string }
type Table = { id: string; name: string; venueId: string }

type Phase =
  | { kind: "disconnected" }
  | { kind: "connecting" }
  | { kind: "connected" }
  | { kind: "no_firmware" }
  | { kind: "busy"; label: string; percent?: number }

const STAGE_LABEL: Record<ControllerInfo["stage"], string> = {
  not_set_up: "Not set up",
  connecting_wifi: "Connecting to Wi-Fi",
  syncing_time: "Syncing time",
  registering: "Registering with PlayTT",
  waiting_assignment: "Waiting for a table",
  ready: "Online and scoring",
  error: "Needs attention",
}

const ERROR_HELP: Record<string, string> = {
  DEVICE_REVOKED: "This controller was revoked. Register it again below.",
  ENROLLMENT_CONSUMED: "Its enrollment code was already used. Register it again below.",
  ENROLLMENT_EXPIRED: "Its enrollment code expired. Register it again below.",
  ENROLLMENT_INVALID: "Its enrollment code isn't valid. Register it again below.",
  DEVICE_FORBIDDEN: "It isn't assigned to a table yet.",
}

const EMPTY_NETWORK: WifiNetwork = { ssid: "", password: "" }

function signalLabel(rssi?: number) {
  if (rssi === undefined) return ""
  if (rssi >= -60) return "strong signal"
  if (rssi >= -72) return "good signal"
  return "weak signal"
}

export function AdminControllerSetup({
  venues,
  tables,
  canManage,
}: {
  venues: Venue[]
  tables: Table[]
  canManage: boolean
}) {
  const [supported, setSupported] = useState(true)
  const [phase, setPhase] = useState<Phase>({ kind: "disconnected" })
  const [info, setInfo] = useState<ControllerInfo | null>(null)
  const [manifest, setManifest] = useState<FirmwareManifest | null>(null)
  const [networks, setNetworks] = useState<WifiNetwork[]>([{ ...EMPTY_NETWORK }])
  const [scan, setScan] = useState<ScanResult[]>([])
  const [scanning, setScanning] = useState(false)
  const [venueId, setVenueId] = useState(venues[0]?.id ?? "")
  const [tableId, setTableId] = useState("")
  const [log, setLog] = useState<string[]>([])
  const connection = useRef<ControllerSerial | null>(null)

  const venueTables = tables.filter((table) => table.venueId === venueId)

  useEffect(() => {
    setSupported(isWebSerialSupported())
    loadFirmwareManifest().then(setManifest).catch(() => setManifest(null))
    return () => {
      void connection.current?.close()
    }
  }, [])

  useEffect(() => {
    if (!venueTables.some((table) => table.id === tableId)) setTableId(venueTables[0]?.id ?? "")
  }, [venueTables, tableId])

  const appendLog = useCallback((line: string) => {
    setLog((current) => [...current.slice(-199), line])
  }, [])

  const attach = useCallback(
    (serial: ControllerSerial) => {
      connection.current = serial
      serial.onLog(appendLog)
      serial.onDisconnect(() => {
        connection.current = null
        setPhase((current) => (current.kind === "busy" ? current : { kind: "disconnected" }))
      })
    },
    [appendLog],
  )

  const refreshInfo = useCallback(async () => {
    const serial = connection.current
    if (!serial) return null
    const next = await serial.info()
    setInfo(next)
    return next
  }, [])

  async function connect() {
    setPhase({ kind: "connecting" })
    try {
      const serial = await ControllerSerial.request()
      attach(serial)
      try {
        const current = await serial.waitUntilResponsive(6000)
        setInfo(current)
        setPhase({ kind: "connected" })
      } catch {
        // Port opened but nothing answers: blank board or other firmware.
        setInfo(null)
        setPhase({ kind: "no_firmware" })
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotFoundError") {
        setPhase({ kind: "disconnected" })
        return
      }
      toast.error(error instanceof Error ? error.message : "Couldn't open the controller.")
      setPhase({ kind: "disconnected" })
    }
  }

  async function disconnect() {
    await connection.current?.close()
    connection.current = null
    setInfo(null)
    setPhase({ kind: "disconnected" })
  }

  /** The controller restarts after saving; its USB drops, so reopen it and wait for it to answer. */
  async function reconnectAfterRestart(label: string) {
    setPhase({ kind: "busy", label })
    await connection.current?.close()
    connection.current = null
    await new Promise((resolve) => window.setTimeout(resolve, 2500))
    const serial = await ControllerSerial.reconnect()
    attach(serial)
    const current = await serial.waitUntilResponsive()
    setInfo(current)
    return current
  }

  async function runScan() {
    if (!connection.current) return
    setScanning(true)
    try {
      setScan(await connection.current.scan())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Scan failed.")
    } finally {
      setScanning(false)
    }
  }

  function validNetworks() {
    const filled = networks.filter((network) => network.ssid.trim())
    for (const network of filled) {
      if (network.password && network.password.length < 8) {
        toast.error(`The password for ${network.ssid} must be at least 8 characters.`)
        return null
      }
    }
    if (filled.length === 0) {
      toast.error("Add at least one Wi-Fi network.")
      return null
    }
    return filled.map((network) => ({ ssid: network.ssid.trim(), password: network.password }))
  }

  async function saveWifi() {
    const list = validNetworks()
    if (!list || !connection.current) return
    try {
      setPhase({ kind: "busy", label: "Saving Wi-Fi…" })
      await connection.current.setWifi(list)
      const current = await reconnectAfterRestart("Restarting and joining Wi-Fi…")
      setNetworks([{ ...EMPTY_NETWORK }])
      setPhase({ kind: "connected" })
      toast.success(current.wifi.connected ? `Connected to ${current.wifi.ssid}.` : "Saved. It's joining the network now.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save the Wi-Fi.")
      setPhase(connection.current ? { kind: "connected" } : { kind: "disconnected" })
    }
  }

  async function register() {
    if (!connection.current || !info) return
    if (!venueId || !tableId) {
      toast.error("Choose a venue and a table.")
      return
    }
    const typed = networks.some((network) => network.ssid.trim())
    const list = typed ? validNetworks() : undefined
    if (typed && !list) return
    if (!list && (info.networks ?? []).length === 0) {
      toast.error("Add the venue's Wi-Fi first.")
      return
    }

    try {
      setPhase({ kind: "busy", label: "Creating a registration code…" })
      const enrollmentResponse = await fetch("/api/operator/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: venueId, deviceType: "esp32_controller" }),
      })
      const enrollmentPayload = (await enrollmentResponse.json().catch(() => ({}))) as {
        data?: { enrollment?: { enrollmentCode?: string } }
        message?: string
      }
      const enrollmentCode = enrollmentPayload.data?.enrollment?.enrollmentCode
      if (!enrollmentResponse.ok || !enrollmentCode) {
        throw new Error(enrollmentPayload.message ?? "Couldn't create a registration code.")
      }

      setPhase({ kind: "busy", label: "Sending details to the controller…" })
      const ack = await connection.current.register({
        enrollmentCode,
        server: window.location.origin,
        ...(list ? { networks: list } : {}),
      })

      await reconnectAfterRestart("Restarting, joining Wi-Fi and registering…")

      setPhase({ kind: "busy", label: "Waiting for it to appear in PlayTT…" })
      const deviceId = await waitForDevice(venueId, ack.hardwareUid)

      setPhase({ kind: "busy", label: "Assigning it to the table…" })
      const assignResponse = await fetch("/api/operator/devices/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, locationId: venueId, resourceId: tableId, role: "score_input" }),
      })
      if (!assignResponse.ok) {
        const error = (await assignResponse.json().catch(() => ({}))) as { message?: string }
        throw new Error(
          `${error.message ?? "Couldn't assign it."} Finish on the Devices page: it's registered and waiting for a table.`,
        )
      }

      setPhase({ kind: "busy", label: "Waiting for it to go online…" })
      await waitForStage("ready", 60000)
      setNetworks([{ ...EMPTY_NETWORK }])
      setPhase({ kind: "connected" })
      toast.success(`Ready. Scoring ${tables.find((table) => table.id === tableId)?.name ?? "the table"}.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Registration didn't finish.")
      setPhase(connection.current ? { kind: "connected" } : { kind: "disconnected" })
      void refreshInfo().catch(() => undefined)
    }
  }

  async function waitForDevice(locationId: string, hardwareUid: string) {
    const started = Date.now()
    while (Date.now() - started < 120000) {
      const response = await fetch(`/api/operator/devices?locationId=${locationId}`, { cache: "no-store" })
      if (response.ok) {
        const payload = (await response.json()) as { data?: { devices?: { id: string; hardwareUid: string }[] } }
        const device = payload.data?.devices?.find((candidate) => candidate.hardwareUid === hardwareUid)
        if (device) return device.id
      }
      const current = await refreshInfo().catch(() => null)
      if (current?.stage === "error" && current.lastError) {
        throw new Error(ERROR_HELP[current.lastError] ?? `PlayTT refused it (${current.lastError}).`)
      }
      await new Promise((resolve) => window.setTimeout(resolve, 3000))
    }
    throw new Error("It didn't register within 2 minutes. Check the Wi-Fi details and the log below.")
  }

  async function waitForStage(stage: ControllerInfo["stage"], timeoutMs: number) {
    const started = Date.now()
    while (Date.now() - started < timeoutMs) {
      const current = await refreshInfo().catch(() => null)
      if (current?.stage === stage) return
      await new Promise((resolve) => window.setTimeout(resolve, 3000))
    }
  }

  async function installFirmware() {
    if (!manifest) return
    const serial = connection.current
    const port = serial?.rawPort
    try {
      setPhase({ kind: "busy", label: "Preparing…", percent: 0 })
      await serial?.close()
      connection.current = null
      const target = port ?? (await navigator.serial.requestPort({ filters: [{ usbVendorId: 0x303a }] }))
      await flashControllerFirmware({
        port: target,
        manifest,
        onLog: appendLog,
        onProgress: (percent, label) => setPhase({ kind: "busy", label, percent }),
      })
      setPhase({ kind: "busy", label: "Starting the new firmware…" })
      await new Promise((resolve) => window.setTimeout(resolve, 3000))
      const next = await ControllerSerial.reconnect(30000)
      attach(next)
      setInfo(await next.waitUntilResponsive(20000))
      setPhase({ kind: "connected" })
      toast.success(`Firmware ${manifest.version} installed.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Installing failed."
      toast.error(
        /sync|connect|timed out/i.test(message)
          ? "Couldn't reach the chip. Hold BOOT, tap RESET, let go of BOOT, then try again."
          : message,
      )
      setPhase({ kind: "disconnected" })
    }
  }

  // ---------- render ----------

  if (!supported) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <LargeTitle title="Use Chrome or Edge" subtitle="Setting up a controller needs a browser that can talk to USB devices." />
        <p className="px-4 text-[15px] text-muted-foreground">
          Open this page in Google Chrome or Microsoft Edge on a Windows, Mac or ChromeOS computer. Safari, Firefox and phones
          can&apos;t connect to USB devices.
        </p>
      </div>
    )
  }

  const busy = phase.kind === "busy" || phase.kind === "connecting"
  const updateAvailable = Boolean(manifest && info && info.firmware !== manifest.version)

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <LargeTitle
        title={
          phase.kind === "disconnected" || phase.kind === "connecting"
            ? "Connect a controller"
            : phase.kind === "no_firmware"
              ? "Install PlayTT"
              : info
                ? STAGE_LABEL[info.stage]
                : "Working…"
        }
        subtitle={
          phase.kind === "busy"
            ? `${phase.label}${phase.percent !== undefined ? ` ${phase.percent}%` : ""}`
            : info
              ? `Controller ${info.board} · firmware ${info.firmware}`
              : "Plug the ESP32 into this computer with a USB data cable."
        }
        accessory={
          phase.kind === "disconnected" || phase.kind === "connecting" ? (
            <button
              type="button"
              onClick={() => void connect()}
              disabled={busy}
              className="h-10 rounded-full bg-primary px-5 text-[15px] font-semibold text-primary-foreground transition-transform duration-100 active:scale-[0.97] disabled:opacity-50"
            >
              {phase.kind === "connecting" ? "Connecting…" : "Connect"}
            </button>
          ) : (
            <button type="button" className={textActionClass} onClick={() => void disconnect()} disabled={busy}>
              Disconnect
            </button>
          )
        }
      />

      {phase.kind === "busy" && phase.percent !== undefined ? (
        <div className="px-4">
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-foreground/70 transition-[width]" style={{ width: `${phase.percent}%` }} />
          </div>
          <p className="mt-2 text-[13px] text-muted-foreground">Keep the controller plugged in until this finishes.</p>
        </div>
      ) : null}

      {phase.kind === "disconnected" || phase.kind === "connecting" ? (
        <GroupedSection header="Before you start" footer="Chrome will ask you to pick the device; choose the one called USB JTAG/serial debug unit.">
          <ValueRow label="1. Use the port labelled USB" value="not COM / UART" />
          <ValueRow label="2. Use a data cable" value="charge-only cables won't show up" />
          <ValueRow label="3. Press Connect" value="then pick the controller" />
        </GroupedSection>
      ) : null}

      {phase.kind === "no_firmware" ? (
        <GroupedSection
          header="No PlayTT firmware found"
          footer="New boards and boards running other software need this once. If it can't reach the chip, hold BOOT, tap RESET, let go of BOOT and try again."
        >
          <ValueRow label="Firmware to install" value={manifest ? manifest.version : "None published"} />
          <li className="px-4 py-3">
            <button
              type="button"
              disabled={!manifest || !canManage}
              onClick={() => void installFirmware()}
              className="h-10 w-full rounded-full bg-primary text-[15px] font-semibold text-primary-foreground disabled:opacity-40"
            >
              Install PlayTT firmware
            </button>
          </li>
        </GroupedSection>
      ) : null}

      {info && phase.kind !== "no_firmware" ? (
        <>
          <GroupedSection header="Status">
            <ValueRow
              label="Wi-Fi"
              value={
                info.wifi.connected
                  ? `${info.wifi.ssid}, ${signalLabel(info.wifi.rssi)}`
                  : (info.networks ?? []).length > 0
                    ? "Not connected"
                    : "None saved"
              }
            />
            <ValueRow label="Saved networks" value={(info.networks ?? []).join(", ") || "None"} />
            <ValueRow label="PlayTT" value={info.registered ? "Registered" : "Not registered"} />
            {info.lastError ? (
              <ValueRow label="Problem" value={info.lastError} detail={ERROR_HELP[info.lastError]} />
            ) : null}
            {info.hotspot ? <ValueRow label="Setup hotspot" value={`PlayTT-Setup-${info.board}`} /> : null}
            <ValueRow
              label="Firmware"
              value={info.firmware}
              detail={updateAvailable && manifest ? `Version ${manifest.version} is available.` : undefined}
            />
          </GroupedSection>

          {canManage ? (
            <>
              <section>
                <SectionHeader
                  accessory={
                    <button type="button" className={textActionClass} disabled={busy || scanning} onClick={() => void runScan()}>
                      {scanning ? "Scanning…" : "Scan for networks"}
                    </button>
                  }
                >
                  Wi-Fi
                </SectionHeader>
                <GroupedList>
                  {networks.map((network, index) => (
                    <li key={index} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
                      <input
                        value={network.ssid}
                        onChange={(event) =>
                          setNetworks((current) => current.map((item, i) => (i === index ? { ...item, ssid: event.target.value } : item)))
                        }
                        list="controller-wifi-scan"
                        placeholder={index === 0 ? "Network name" : "Backup network (optional)"}
                        maxLength={32}
                        disabled={busy}
                        className="rounded-lg bg-muted/60 px-3 py-2 text-[15px] outline-none focus:ring-2 focus:ring-ring"
                      />
                      <input
                        type="password"
                        value={network.password}
                        onChange={(event) =>
                          setNetworks((current) =>
                            current.map((item, i) => (i === index ? { ...item, password: event.target.value } : item)),
                          )
                        }
                        placeholder="Password"
                        maxLength={64}
                        autoComplete="new-password"
                        disabled={busy}
                        className="rounded-lg bg-muted/60 px-3 py-2 text-[15px] outline-none focus:ring-2 focus:ring-ring"
                      />
                      {networks.length > 1 ? (
                        <button
                          type="button"
                          className="text-[13px] text-muted-foreground"
                          onClick={() => setNetworks((current) => current.filter((_, i) => i !== index))}
                        >
                          Remove
                        </button>
                      ) : (
                        <span />
                      )}
                    </li>
                  ))}
                </GroupedList>
                <datalist id="controller-wifi-scan">
                  {scan.map((result) => (
                    <option key={result.ssid} value={result.ssid}>
                      {signalLabel(result.rssi)}
                    </option>
                  ))}
                </datalist>
                <SectionFooter>
                  Only 2.4 GHz networks work. Add up to 3; it tries them in order, so a backup router or phone hotspot keeps
                  it online if the main Wi-Fi changes. Saving replaces the saved list.
                </SectionFooter>
                <div className="mt-3 flex items-center justify-end gap-5 px-4">
                  {networks.length < 3 ? (
                    <button
                      type="button"
                      className={textActionClass}
                      disabled={busy}
                      onClick={() => setNetworks((current) => [...current, { ...EMPTY_NETWORK }])}
                    >
                      Add backup network
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy || !networks.some((network) => network.ssid.trim())}
                    onClick={() => void saveWifi()}
                    className="h-10 rounded-full bg-primary px-5 text-[15px] font-semibold text-primary-foreground transition-transform duration-100 active:scale-[0.97] disabled:opacity-40"
                  >
                    Save Wi-Fi
                  </button>
                </div>
              </section>

              <section>
                <SectionHeader>{info.registered ? "Move to another table" : "Register and assign"}</SectionHeader>
                <GroupedList>
                  <li className="flex items-center justify-between gap-4 px-4 py-2.5">
                    <label htmlFor="setup-venue" className="text-[15px]">
                      Venue
                    </label>
                    <select
                      id="setup-venue"
                      value={venueId}
                      onChange={(event) => setVenueId(event.target.value)}
                      disabled={busy}
                      className="max-w-[60%] rounded-lg bg-muted/60 px-3 py-2 text-[15px] outline-none"
                    >
                      {venues.map((venue) => (
                        <option key={venue.id} value={venue.id}>
                          {venue.name}
                        </option>
                      ))}
                    </select>
                  </li>
                  <li className="flex items-center justify-between gap-4 px-4 py-2.5">
                    <label htmlFor="setup-table" className="text-[15px]">
                      Table
                    </label>
                    <select
                      id="setup-table"
                      value={tableId}
                      onChange={(event) => setTableId(event.target.value)}
                      disabled={busy || venueTables.length === 0}
                      className="max-w-[60%] rounded-lg bg-muted/60 px-3 py-2 text-[15px] outline-none"
                    >
                      {venueTables.length === 0 ? <option value="">No tables at this venue</option> : null}
                      {venueTables.map((table) => (
                        <option key={table.id} value={table.id}>
                          {table.name}
                        </option>
                      ))}
                    </select>
                  </li>
                </GroupedList>
                <SectionFooter>
                  {info.registered
                    ? "This registers it as a new device and moves it to the chosen table. Revoke the old entry on the Devices page afterwards."
                    : "Creates the registration code, sends it with the Wi-Fi above (or the saved Wi-Fi), and assigns it as the table's score buttons."}
                </SectionFooter>
                <div className="mt-3 flex justify-end px-4">
                  <button
                    type="button"
                    disabled={busy || !tableId}
                    onClick={() => void register()}
                    className="h-10 rounded-full bg-primary px-5 text-[15px] font-semibold text-primary-foreground transition-transform duration-100 active:scale-[0.97] disabled:opacity-40"
                  >
                    {info.registered ? "Register again" : "Register and assign"}
                  </button>
                </div>
              </section>

              <GroupedSection
                header="Firmware"
                footer="Updates keep the saved Wi-Fi and registration. The controller restarts when it's done."
              >
                <ValueRow label="On this controller" value={info.firmware} />
                <ValueRow label="Latest" value={manifest?.version ?? "None published"} />
                <li className="flex justify-end px-4 py-3">
                  <button
                    type="button"
                    className={textActionClass}
                    disabled={busy || !manifest}
                    onClick={() => void installFirmware()}
                  >
                    {updateAvailable ? `Update to ${manifest?.version}` : "Reinstall firmware"}
                  </button>
                </li>
              </GroupedSection>
            </>
          ) : (
            <p className="px-4 text-[15px] text-muted-foreground">Only venue managers can change controller settings.</p>
          )}
        </>
      ) : null}

      {log.length > 0 ? (
        <details className="group">
          <summary className="cursor-pointer list-none px-4 text-[13px] text-primary">
            <span className="group-open:hidden">Show device log</span>
            <span className="hidden group-open:inline">Hide device log</span>
          </summary>
          <pre className="mt-2 max-h-72 overflow-auto rounded-2xl bg-card p-4 font-mono text-[11px] leading-relaxed text-muted-foreground ring-1 ring-border/60">
            {log.join("\n")}
          </pre>
        </details>
      ) : null}
    </div>
  )
}
