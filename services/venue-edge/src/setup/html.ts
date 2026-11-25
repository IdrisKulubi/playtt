import type { SetupEnrollmentStatus } from "./status"

export function renderSetupPage(input: {
  enrollmentStatus: SetupEnrollmentStatus
  setupLocked: boolean
  expiresAt: string | null
  setupToken: string
  cloudDashboardUrl: string | null
}): string {
  const statusLabel =
    input.enrollmentStatus === "enrolled"
      ? "Enrolled"
      : input.enrollmentStatus === "revoked"
        ? "Pairing required"
        : "Not enrolled"

  const lockState = input.setupLocked
    ? "Setup is locked. The VenueEdge service continues running."
    : "Setup session is active."

  const expiresCopy = input.expiresAt
    ? `Session expires at ${input.expiresAt}.`
    : "No active setup session."

  const disabledAttr = input.setupLocked ? "disabled" : ""

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>PlayTT VenueEdge setup</title>
    <style>
      :root {
        color-scheme: light;
        font-family: "Space Grotesk", Inter, ui-sans-serif, system-ui, sans-serif;
        line-height: 1.5;
        --bg: #f5f8fc; --surface: #ffffff; --surface-soft: #eef4fa;
        --ink: #0f172a; --muted: #53657d; --border: #d9e3ee;
        --primary: #00b7ff; --primary-ink: #041019;
        --success: #138a4b; --warning: #a86500; --danger: #c92a2a;
        --space-2xs: .25rem; --space-xs: .5rem; --space-sm: .75rem;
        --space-md: 1rem; --space-lg: 1.5rem; --space-xl: 2rem; --space-2xl: 3rem;
        --radius-sm: .375rem; --radius-md: .625rem; --radius-lg: .875rem;
        --motion: 220ms cubic-bezier(.22,1,.36,1);
      }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; background: var(--bg); color: var(--ink); }
      button, input, select { font: inherit; }
      input, select { min-height: 2.5rem; }
      summary { min-height: 2.25rem; }
      button {
        min-height: 2.25rem; border: 1px solid transparent; border-radius: 999px;
        padding: .4rem .95rem; font-size: .9rem; font-weight: 600; line-height: 1.2;
        cursor: pointer; transition: background-color 120ms ease, transform 100ms ease-out;
      }
      button:active:not(:disabled) { transform: scale(.97); }
      /* One filled primary action per area; everything else is quieter. */
      button:not(.secondary):not(.quiet):not(.inline):not(.link) { background: var(--primary); color: var(--primary-ink); }
      button.secondary, button.inline { border-color: var(--border); background: var(--surface); color: var(--ink); }
      button.secondary:hover:not(:disabled), button.inline:hover:not(:disabled) { background: var(--surface-soft); }
      button.quiet { background: transparent; color: var(--muted); }
      button.quiet:hover:not(:disabled) { color: var(--ink); }
      button.link { min-height: auto; padding: 0; border: 0; border-radius: 0; background: transparent; color: #006d99; font-weight: 600; }
      button.link:hover:not(:disabled) { text-decoration: underline; }
      button.link.danger { color: var(--danger); }
      button:disabled { cursor: not-allowed; opacity: .45; }
      select:disabled, input:disabled { cursor: not-allowed; opacity: .55; }
      @keyframes ve-spin { to { transform: rotate(360deg); } }
      .busy-row { display: flex; align-items: flex-start; gap: var(--space-sm); }
      .spinner {
        width: 1rem; height: 1rem; margin-top: .2rem; border-radius: 50%;
        border: 2px solid var(--border); border-top-color: var(--primary);
        animation: ve-spin .7s linear infinite; flex: 0 0 auto;
      }
      .spinner[hidden] { display: none; }
      button:focus-visible, input:focus-visible, select:focus-visible, summary:focus-visible {
        outline: 3px solid color-mix(in srgb, var(--primary) 45%, transparent); outline-offset: 2px;
      }
      h1, h2, h3, p { margin-top: 0; }
      h1 { margin-bottom: var(--space-2xs); font-size: 1.35rem; letter-spacing: -.02em; }
      h2 { margin-bottom: var(--space-xs); font-size: 1.75rem; line-height: 1.2; letter-spacing: -.025em; text-wrap: balance; }
      h3 { margin-bottom: var(--space-xs); font-size: 1rem; }
      .muted { color: var(--muted); }
      .shell { min-height: 100vh; display: grid; grid-template-columns: 17rem minmax(0, 1fr); }
      .rail { background: var(--surface); border-right: 1px solid var(--border); padding: var(--space-xl) var(--space-lg); }
      .brand { display: flex; align-items: baseline; gap: var(--space-xs); margin-bottom: var(--space-2xl); }
      .brand strong { color: #007fb3; font-size: 1.4rem; }
      .steps { display: grid; gap: var(--space-xs); list-style: none; padding: 0; margin: 0; }
      .step { width: 100%; display: grid; grid-template-columns: 2rem 1fr; gap: var(--space-sm); align-items: center; padding: var(--space-sm); border-radius: var(--radius-md); color: var(--muted); text-align: left; }
      .step:hover { background: var(--surface-soft); color: var(--ink); }
      .step-dot { width: 2rem; height: 2rem; display: grid; place-items: center; border: 1px solid var(--border); border-radius: 50%; font-weight: 650; }
      .step[data-state="current"] { background: #e8f7ff; color: #006d99; }
      .step[data-state="current"] .step-dot { border-color: var(--primary); background: var(--primary); color: var(--primary-ink); }
      .step[data-state="complete"] { color: var(--ink); }
      .step[data-state="complete"] .step-dot { border-color: var(--success); background: var(--success); color: white; }
      .step small { display: block; color: var(--muted); }
      .rail-footer { margin-top: var(--space-2xl); padding-top: var(--space-lg); border-top: 1px solid var(--border); }
      .workspace { min-width: 0; display: flex; flex-direction: column; }
      .topbar { display: flex; justify-content: space-between; gap: var(--space-lg); padding: var(--space-lg) var(--space-xl); border-bottom: 1px solid var(--border); background: var(--surface); }
      .topbar p { margin: 0; }
      .status { display: inline-flex; align-items: center; gap: var(--space-xs); font-size: .875rem; font-weight: 650; }
      .status::before { content: ""; width: .55rem; height: .55rem; border-radius: 50%; background: var(--success); }
      main { width: min(100%, 68rem); margin: 0 auto; padding: var(--space-2xl) var(--space-xl) 7rem; }
      .stage { animation: stage-in var(--motion); }
      .stage[hidden] { display: none; }
      .stage-intro { max-width: 68ch; margin-bottom: var(--space-xl); }
      .panel { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-lg); }
      .panel + .panel, form + .panel, .panel + form { margin-top: var(--space-lg); }
      .row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-sm); }
      label { display: block; margin-top: var(--space-sm); font-size: .875rem; font-weight: 650; }
      input, select { width: 100%; margin-top: var(--space-2xs); padding: .7rem .8rem; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface); color: var(--ink); }
      input[type="checkbox"] { width: auto; min-height: auto; }
      .actions { display: flex; flex-wrap: wrap; gap: var(--space-xs); margin-top: var(--space-md); }
      .form-message, #enrollment-message, #nvr-message, #camera-message, #mapping-message, #commissioning-message, .busy-row {
        position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0);
      }
      .toast-stack {
        position: fixed; top: var(--space-lg); right: var(--space-lg); z-index: 80;
        display: grid; gap: var(--space-sm); width: min(24.5rem, calc(100vw - 2rem));
        pointer-events: none;
      }
      .toast {
        pointer-events: auto; display: grid; grid-template-columns: 1fr auto; align-items: start; gap: .6rem;
        padding: .75rem .85rem .75rem 1rem; border: 1px solid var(--border); border-radius: .875rem;
        background: color-mix(in srgb, var(--surface) 94%, transparent);
        -webkit-backdrop-filter: blur(16px) saturate(160%); backdrop-filter: blur(16px) saturate(160%);
        box-shadow: 0 10px 30px rgba(15, 23, 42, .12);
        animation: toast-in var(--motion);
      }
      .toast[data-kind="info"] { grid-template-columns: auto 1fr auto; }
      .toast .spinner { margin-top: .15rem; }
      .toast strong { display: block; font-size: .9rem; letter-spacing: -.005em; }
      .toast[data-kind="error"] strong { color: var(--danger); }
      .toast p, .toast li { margin: .15rem 0 0; color: var(--muted); font-size: .86rem; }
      .toast .toast-plain { margin: 0; color: var(--ink); font-size: .9rem; }
      .toast ul { margin: .35rem 0 0; padding-left: 1.1rem; }
      .toast button { min-width: 1.75rem; min-height: 1.75rem; padding: 0; border: 0; background: transparent; color: var(--muted); font-size: .9rem; }
      @media (prefers-reduced-transparency: reduce) { .toast { background: var(--surface); backdrop-filter: none; } }
      @keyframes toast-in { from { opacity: 0; transform: translateY(-.4rem) scale(.98); } to { opacity: 1; transform: none; } }
      button.inline { margin: 0; }
      .nvr-item, .resource-item { padding: var(--space-md) 0; border-top: 1px solid var(--border); }
      .camera-item { display: grid; grid-template-columns: minmax(15rem, 22rem) minmax(0, 1fr); gap: var(--space-lg); padding: var(--space-lg) 0; border-top: 1px solid var(--border); }
      .camera-live { position: relative; min-height: 11rem; overflow: hidden; border-radius: var(--radius-md); background: var(--ink); color: white; }
      .camera-live img { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: contain; }
      .camera-live-state { position: absolute; left: var(--space-sm); bottom: var(--space-sm); border-radius: 999px; padding: .2rem .55rem; background: rgba(4,16,25,.82); color: white; font-size: .78rem; }
      .camera-heading { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-xs); }
      .camera-meta { margin: var(--space-xs) 0; }
      .technical-output { margin-top: var(--space-sm); padding: var(--space-sm); border-radius: var(--radius-md); background: #101827; color: #dce9f8; font: .8rem/1.5 ui-monospace, SFMono-Regular, Consolas, monospace; }
      .check { display: flex; align-items: center; gap: .5rem; margin: 0; font-size: .92rem; font-weight: 600; cursor: pointer; }
      .check input { width: 1.05rem; height: 1.05rem; min-height: 0; margin: 0; accent-color: #007fb3; }
      .camera-group + .camera-group { margin-top: var(--space-xl); }
      .camera-group > h3 { display: flex; flex-wrap: wrap; align-items: baseline; gap: .5rem; margin: 0 0 var(--space-xs); }
      .camera-group > h3 span { color: var(--muted); font-weight: 500; font-size: .9rem; }
      .camera-actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-xs); margin-top: var(--space-sm); }
      .quiet-actions { display: flex; flex-wrap: wrap; gap: var(--space-md); margin-top: var(--space-sm); font-size: .88rem; }
      .camera-status { margin: var(--space-xs) 0 0; font-size: .9rem; }
      .camera-status[data-state="error"] { color: var(--danger); }
      .camera-status[data-state="ready"] { color: var(--success); }
      .table-card { padding: var(--space-lg) 0; border-top: 1px solid var(--border); }
      .table-card:first-child { border-top: 0; padding-top: 0; }
      .table-card:last-child { padding-bottom: 0; }
      .table-card-head { display: flex; justify-content: space-between; align-items: baseline; gap: var(--space-md); }
      .table-card-head h3 { margin: 0; font-size: 1.05rem; }
      .table-card-state { color: var(--muted); font-size: .88rem; white-space: nowrap; }
      .table-card-state[data-state="ready"] { color: var(--success); }
      .table-card-state[data-state="attention"] { color: var(--warning); }
      .table-notes { margin: var(--space-sm) 0 0; padding: 0; list-style: none; color: var(--warning); font-size: .88rem; }
      .table-notes li + li { margin-top: .2rem; }
      .table-card details { margin-top: var(--space-sm); padding-top: 0; border-top: 0; }
      .table-card details summary { width: fit-content; color: var(--muted); font-size: .88rem; font-weight: 600; min-height: 2rem; }
      .advanced { display: grid; gap: var(--space-sm); padding-top: var(--space-xs); }
      .advanced p { margin: 0; font-size: .85rem; }
      .credential-recovery { display: grid; grid-template-columns: minmax(12rem, 1fr) auto; align-items: end; gap: var(--space-sm); margin: var(--space-sm) 0; padding: var(--space-sm); border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface-soft); }
      .credential-recovery p { grid-column: 1 / -1; margin: 0; }
      .badge { display: inline-flex; border-radius: 999px; padding: .15rem .5rem; background: var(--surface-soft); color: var(--muted); font-size: .8rem; }
      pre { white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; }
      details { margin-top: var(--space-lg); border-top: 1px solid var(--border); padding-top: var(--space-md); }
      summary { cursor: pointer; display: flex; align-items: center; font-weight: 650; }
      .review { margin: var(--space-lg) 0; padding: var(--space-md) var(--space-lg); border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); }
      .review p { margin: .25rem 0 0; }
      .review .actions { margin-top: var(--space-sm); }
      .review[data-empty="true"] { margin: var(--space-sm) 0; padding: 0; border: 0; background: transparent; }
      .review-list { margin: var(--space-md) 0 0; padding-left: 1.25rem; }
      .footer-actions { position: fixed; right: 0; bottom: 0; left: 17rem; z-index: 40; display: flex; justify-content: space-between; gap: var(--space-md); padding: var(--space-md) var(--space-xl) max(var(--space-md), env(safe-area-inset-bottom)); border-top: 1px solid var(--border); background: color-mix(in srgb, var(--surface) 96%, transparent); }
      video { display: none; width: min(100%, 42rem); margin-top: var(--space-lg); border-radius: var(--radius-md); background: var(--ink); }
      @keyframes stage-in { from { opacity: .55; transform: translateY(.35rem); } to { opacity: 1; transform: none; } }
      @media (max-width: 800px) {
        .shell { display: block; }
        .rail { position: sticky; top: 0; z-index: 20; border-right: 0; border-bottom: 1px solid var(--border); padding: var(--space-sm) var(--space-md); }
        .brand, .rail-footer, .step span { display: none; }
        .steps { display: flex; justify-content: space-between; gap: var(--space-2xs); }
        .step { display: block; padding: var(--space-2xs); background: transparent !important; }
        .topbar { padding: var(--space-md); }
        main { padding: var(--space-xl) var(--space-md) 7rem; }
        .footer-actions { left: 0; padding-inline: var(--space-md); }
      }
      @media (max-width: 700px) { .camera-item { grid-template-columns: 1fr; } }
      @media (max-width: 560px) { .row, .credential-recovery { grid-template-columns: 1fr; } h2 { font-size: 1.45rem; } }
      @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; } }
    </style>
  </head>
  <body>
    <div class="shell">
      <aside class="rail" aria-label="Setup progress">
        <div class="brand"><strong>PlayTT</strong><span>VenueEdge</span></div>
        <ol class="steps">
          ${["Pair device", "Add NVR", "Review cameras", "Map tables", "Publish & apply", "Commission"].map((label, index) => `<li><button type="button" class="step quiet" data-step-item="${index + 1}" data-state="upcoming"><span class="step-dot">${index + 1}</span><span>${label}<small>Not started</small></span></button></li>`).join("")}
        </ol>
        <div class="rail-footer"><p class="muted">Setup stays local. NVR passwords never leave this PC.</p></div>
      </aside>
      <div class="workspace">
        <header class="topbar">
          <div><h1>VenueEdge setup</h1><p class="muted">${lockState} ${expiresCopy}</p></div>
          <span class="status" id="enrollment-status">${statusLabel}</span>
        </header>
        <main>
          <section class="stage" data-stage="1">
            <div class="stage-intro"><h2>Pair this venue PC</h2><p class="muted">Connect VenueEdge to the correct PlayTT venue before adding equipment.</p></div>
            <div class="panel">
              ${input.enrollmentStatus === "enrolled" ? `<h3>Paired with PlayTT</h3><p class="muted">This PC has protected device credentials and is ready for equipment setup.</p><details><summary>Pair with a different code</summary><p class="muted">Use this if PlayTT admin asks you to replace this PC, or it was paired to the wrong venue. Your NVRs, cameras and table mappings stay on this PC; you only enter a new pairing code.</p><div class="actions"><button type="button" id="reset-pairing-btn" class="secondary" ${disabledAttr}>Reset pairing</button></div><p id="reset-pairing-message" class="muted" aria-live="polite"></p></details>` :`<h3>${input.enrollmentStatus === "revoked" ? "Cloud connection removed" : "Connect this venue PC"}</h3><p class="muted">${input.enrollmentStatus === "revoked" ? "This installation no longer exists in PlayTT. Create a new pairing code in the admin dashboard and enter it below." : "Create a one-time pairing code in the PlayTT admin dashboard and enter it below."}</p><form id="enrollment-form"><label>One-time pairing code<input name="pairingCode" autocomplete="one-time-code" required maxlength="32" ${disabledAttr} /></label><div class="actions"><button type="submit" ${disabledAttr}>Pair this VenueEdge</button></div></form>`}
              <p id="enrollment-message" class="muted" aria-live="polite"></p>
            </div>
          </section>

          <section class="stage" data-stage="2" hidden>
            <div class="stage-intro"><h2>Add the venue NVR</h2><p class="muted">Pick the recorder this PC found on the network, then enter its login. You can also type the address yourself.</p></div>
            <div class="panel" id="nvr-finder">
              <div class="actions"><button type="button" id="find-nvrs-btn" class="secondary" ${disabledAttr}>Find recorders on this network</button></div>
              <p id="find-nvrs-message" class="muted" aria-live="polite"></p>
              <div id="find-nvrs-results"></div>
            </div>
            <form id="nvr-form" class="panel">
              <label>Recorder name<input name="label" placeholder="Main NVR" required ${disabledAttr} /></label>
              <div class="row"><label>Host or IP address<input name="host" placeholder="192.168.0.240" required ${disabledAttr} /></label><label>RTSP port<input name="rtspPort" type="number" value="554" required ${disabledAttr} /></label></div>
              <div class="row"><label>Username<input name="username" required ${disabledAttr} /></label><label>Password<input name="password" type="password" required ${disabledAttr} /></label></div>
              <details><summary>Technician details</summary><div class="row"><label>Test channel<input name="testChannelKey" value="1" ${disabledAttr} /></label><label>Vendor<select name="vendor" ${disabledAttr}><option value="vigi">VIGI</option></select></label></div></details>
              <div class="actions"><button type="submit" id="add-nvr-btn" ${disabledAttr}>Verify &amp; add NVR</button><button type="button" id="discover-btn" class="secondary" ${disabledAttr}>Test network only</button></div>
              <p id="nvr-message" class="form-message" role="status" aria-live="polite"></p>
              <div id="nvr-list"></div>
            </form>
          </section>

          <section class="stage" data-stage="3" hidden>
            <div class="stage-intro"><h2>Review cameras</h2><p class="muted">Each camera on the recorder is listed once. Tick the ones that film a table, then check them. You'll choose which table each one films in the next step.</p></div>
            <div class="actions"><button id="prepare-cameras" type="button">Check selected cameras</button><button id="scan-cameras" type="button" class="secondary">Scan recorder again</button></div>
            <div id="topology-review" class="review" aria-live="polite"><p class="muted">Checking cameras…</p></div>
            <p id="camera-message" class="muted" aria-live="polite"></p><div id="camera-list"></div>
            <details><summary>Technician: add a channel manually</summary><form id="camera-form" class="panel">
              <h3>Add a channel manually</h3>
              <div class="row"><label>NVR<select name="nvrId" id="camera-nvr-select" required ${disabledAttr}></select></label><label>Channel<input name="channelKey" placeholder="1" required ${disabledAttr} /></label></div>
              <div class="row"><label>Camera name<input name="label" placeholder="Table 1 main" ${disabledAttr} /></label><label>Stream<select name="streamProfile" ${disabledAttr}><option value="main">Main</option><option value="sub">Sub</option></select></label></div>
              <div class="actions"><button type="submit" class="secondary" ${disabledAttr}>Add camera manually</button></div>
            </form></details>
          </section>

          <section class="stage" data-stage="4" hidden>
            <div class="stage-intro"><h2>Choose a camera for each table</h2><p class="muted">Pick the camera that films each table. A backup camera is optional; if the main one stops, replays switch to the backup by themselves.</p></div>
            <div class="panel"><p id="mapping-config-hint" class="muted"></p><div id="resource-list"></div><p id="mapping-message" class="muted" aria-live="polite"></p></div>
          </section>

          <section class="stage" data-stage="5" hidden>
            <div class="stage-intro"><h2>Publish and apply configuration</h2><p class="muted">Publish the cameras and table mappings to PlayTT. Passwords stay on this PC. PlayTT applies the setup and this PC picks it up within seconds.</p></div>
            <div class="panel"><pre id="commissioning-checklist" class="muted"></pre><div class="actions"><button type="button" id="commissioning-test-all" class="secondary" ${disabledAttr}>Check cameras again</button><button type="button" id="commissioning-publish" ${disabledAttr}>Publish to PlayTT</button>${input.cloudDashboardUrl ? `<button type="button" id="open-cloud-dashboard" class="secondary">Open PlayTT admin</button>` : ""}</div><video id="commissioning-preview" controls></video><p id="commissioning-message" class="muted" aria-live="polite"></p></div>
          </section>

          <section class="stage" data-stage="6" hidden>
            <div class="stage-intro"><h2 id="completion-heading">Complete commissioning</h2><p id="completion-description" class="muted">Finish after every preview and failover check passes and the latest cloud configuration is applied on this PC.</p></div>
            <div class="panel"><h3 id="completion-panel-heading">Final readiness check</h3><pre id="commissioning-final-checklist" class="muted"></pre><p id="completion-success" role="status" hidden>Camera previews and failover checks passed. Your PlayTT configuration is applied on this PC. VenueEdge is ready to capture replays.</p><div class="actions"><button type="button" id="commissioning-complete" ${disabledAttr}>Complete commissioning</button><button type="button" id="lock-btn" class="secondary" ${disabledAttr}>Lock setup and close</button></div><p class="muted busy-row" aria-live="polite"><span id="complete-spinner" class="spinner" hidden></span><span id="complete-status"></span></p></div>
          </section>
        </main>
        <nav class="footer-actions" aria-label="Stage navigation">
          <button id="stage-back" type="button" class="secondary">Back</button>
          <button id="stage-next" type="button">Continue</button>
        </nav>
      </div>
    </div>
    <div id="toast-stack" class="toast-stack" aria-live="polite" aria-relevant="additions"></div>

    <script>
      const token = ${JSON.stringify(input.setupToken)};
      let setupLocked = ${JSON.stringify(input.setupLocked)};
      const cloudDashboardUrl = ${JSON.stringify(input.cloudDashboardUrl)};
      const initialEnrollmentStatus = ${JSON.stringify(input.enrollmentStatus)};
      const workflow = {
        enrolled: ${JSON.stringify(input.enrollmentStatus === "enrolled")},
        nvrCount: 0,
        cameraCount: 0,
        topologyClean: false,
        failoverReady: false,
        tablesMapped: false,
        published: false,
        configApplied: false,
        // "published" | "needs_approval" | "failed" | null (from the last Publish click)
        autoPublishStatus: null,
        completed: false,
        enabledCameraCount: 0,
        camerasTested: false,
        camerasPreviewed: false,
      };
      const savedStage = sessionStorage.getItem("venue-edge-stage");
      let resumeFromSavedProgress = savedStage === null;
      let currentStage = Math.min(6, Math.max(1, Number(savedStage || (workflow.enrolled ? 2 : 1))));
      let topologyProposal = null;
      let commissioningPollTimer = null;
      let setupStatusPollTimer = null;
      let camerasReady = false;
      let preparingCameras = false;
      let liveViewPauseDepth = 0;
      let renderedStage = null;
      const toastNodes = new Map();
      const toastTimers = new Map();
      const toastLastText = new Map();

      function inferToastKind(text, state) {
        if (state === "error") return "error";
        if (state === "success") return "success";
        const value = String(text || "").toLowerCase();
        if (/fail|error|could not|couldn't|invalid|required|reject|unavailable|timed out|not found/.test(value)) return "error";
        if (state === "checking" || /…$/.test(String(text || "").trim())) return "info";
        if (/complete|ready|saved|restored|finished|passed|verified|received|looks good|captured|removed/.test(value)) return "success";
        return "info";
      }

      function toastTitle(kind) {
        if (kind === "warning") return "Before you continue";
        if (kind === "error") return "Needs attention";
        return "";
      }

      function dismissToast(key) {
        const node = toastNodes.get(key);
        const timer = toastTimers.get(key);
        if (timer) clearTimeout(timer);
        toastTimers.delete(key);
        toastNodes.delete(key);
        toastLastText.delete(key);
        if (node && node.parentNode) node.parentNode.removeChild(node);
      }

      function showToast(options) {
        const message = typeof options === "string" ? options : options.message;
        const items = typeof options === "string" ? null : options.items;
        if (!message && !(items && items.length)) return;
        const kind = typeof options === "string" ? inferToastKind(message) : (options.kind || inferToastKind(message, options.state));
        const key = typeof options === "string" ? "notice" : (options.key || "notice");
        const persist = typeof options === "object" && options.persist != null
          ? options.persist
          : kind === "warning" || kind === "error";
        const title = typeof options === "object" && options.title ? options.title : toastTitle(kind);
        const stack = document.getElementById("toast-stack");
        if (!stack) return;
        dismissToast(key);
        const toast = document.createElement("div");
        toast.className = "toast";
        toast.dataset.kind = kind;
        toast.setAttribute("role", kind === "error" || kind === "warning" ? "alert" : "status");
        const body = document.createElement("div");
        if (title) {
          const heading = document.createElement("strong");
          heading.textContent = title;
          body.appendChild(heading);
        }
        if (message) {
          const copy = document.createElement("p");
          if (!title) copy.className = "toast-plain";
          copy.textContent = message;
          body.appendChild(copy);
        }
        if (items && items.length) {
          const list = document.createElement("ul");
          for (const item of items) {
            const row = document.createElement("li");
            row.textContent = item;
            list.appendChild(row);
          }
          body.appendChild(list);
        }
        const close = document.createElement("button");
        close.type = "button";
        close.className = "quiet";
        close.setAttribute("aria-label", "Dismiss notification");
        close.textContent = "✕";
        close.addEventListener("click", () => dismissToast(key));
        if (kind === "info") {
          const spinner = document.createElement("span");
          spinner.className = "spinner";
          spinner.setAttribute("aria-hidden", "true");
          toast.appendChild(spinner);
        }
        toast.appendChild(body);
        toast.appendChild(close);
        stack.appendChild(toast);
        toastNodes.set(key, toast);
        toastLastText.set(key, message || items.join("\\n"));
        // Progress toasts are replaced when the work finishes; the long timer
        // is only a safety net so a lost update can never leave one stuck.
        const readingTime = Math.min(12000, 2400 + String(message || "").length * 45);
        const lifetime = !persist ? Math.max(kind === "success" ? 3200 : 5200, readingTime) : kind === "info" ? 120000 : 0;
        if (lifetime) toastTimers.set(key, setTimeout(() => dismissToast(key), lifetime));
        const keys = [...toastNodes.keys()].filter((existing) => existing !== "stage-guidance");
        while (keys.length > 2) dismissToast(keys.shift());
      }

      function bindNoticeToasts() {
        const ids = ["enrollment-message", "nvr-message", "camera-message", "mapping-message", "commissioning-message", "complete-status"];
        for (const id of ids) {
          const el = document.getElementById(id);
          if (!el) continue;
          const sync = () => {
            const text = (el.textContent || "").trim();
            const toastKey = id === "commissioning-message" || id === "complete-status"
              ? "commissioning-progress"
              : id;
            if (!text) { dismissToast(toastKey); return; }
            if (toastLastText.get(toastKey) === text) return;
            const kind = inferToastKind(text, el.dataset.state);
            // A state applies to one message only, so an old "checking" state
            // can't make a later error look like progress.
            delete el.dataset.state;
            showToast({
              message: text,
              key: toastKey,
              kind: kind,
              persist: kind === "error" || kind === "warning" || kind === "info",
            });
          };
          new MutationObserver(sync).observe(el, { childList: true, characterData: true, subtree: true });
        }
      }
      bindNoticeToasts();

      function setCompleteStatus(text, spinning) {
        const status = document.getElementById("complete-status");
        const spinner = document.getElementById("complete-spinner");
        if (status) status.textContent = text;
        if (spinner) spinner.hidden = !spinning;
      }

      function stageComplete(stage) {
        if (stage === 1) return workflow.enrolled;
        if (stage === 2) return workflow.nvrCount > 0;
        if (stage === 3) return workflow.cameraCount > 0 && workflow.topologyClean && camerasReady;
        if (stage === 4) return workflow.failoverReady && workflow.tablesMapped;
        if (stage === 5) return workflow.published && workflow.configApplied;
        return workflow.completed;
      }

      function requirementsForStage(stage) {
        const requirements = [];
        if (stage === 1 && !workflow.enrolled) requirements.push("Pair this PC using a code from PlayTT admin.");
        if (stage === 2 && workflow.nvrCount === 0) requirements.push("Add the venue NVR and confirm its address and credentials.");
        if (stage === 3) {
          if (workflow.cameraCount === 0) requirements.push("Choose Scan recorder again to load the cameras connected to the NVR.");
          if (workflow.cameraCount > 0 && workflow.enabledCameraCount === 0) requirements.push("Tick at least one camera that films a table.");
          if (!workflow.topologyClean) requirements.push("Sort out the camera list issue shown above the cameras.");
          if (workflow.enabledCameraCount > 0 && (!workflow.camerasTested || !workflow.camerasPreviewed)) requirements.push("Choose Check selected cameras and wait for every check to finish.");
        }
        if (stage === 4 && !workflow.tablesMapped) requirements.push("Choose a camera for at least one table.");
        else if (stage === 4 && !workflow.failoverReady) requirements.push("Choose a camera for every table. If a table has a backup camera, wait for its switch-over check to finish.");
        if (stage === 5) {
          if (!workflow.published) requirements.push("Choose Publish to PlayTT.");
          else if (!workflow.configApplied) {
            requirements.push(
              workflow.autoPublishStatus === "needs_approval" || workflow.autoPublishStatus === "failed"
                ? "In PlayTT admin, publish this installation's configuration, then keep this PC online while it applies."
                : "Keep this PC online while it applies the configuration. This takes a few seconds.",
            );
          }
        }
        if (stage === 6 && !workflow.completed) requirements.push("Complete the final commissioning check.");
        return requirements;
      }

      function showStageGuidance() {
        const requirements = requirementsForStage(currentStage);
        if (requirements.length === 0) {
          dismissToast("stage-guidance");
          return;
        }
        showToast({
          key: "stage-guidance",
          kind: "warning",
          title: "Before you continue",
          items: requirements,
          persist: true,
        });
      }

      function renderStages() {
        if (resumeFromSavedProgress) {
          currentStage = 6;
          for (let stage = 1; stage <= 6; stage += 1) {
            if (!stageComplete(stage)) {
              currentStage = stage;
              break;
            }
          }
        }
        if (renderedStage === 3 && currentStage !== 3) {
          void pauseLiveViews();
        }
        document.querySelectorAll("[data-stage]").forEach((section) => {
          section.hidden = Number(section.dataset.stage) !== currentStage;
        });
        // First visit to "Add NVR" with nothing added yet: look for recorders straight away.
        if (currentStage === 2 && workflow.nvrCount === 0 && !nvrSearchDone && workflow.enrolled) {
          void findRecordersOnNetwork();
        }
        document.querySelectorAll(".camera-live img").forEach((image, index) => {
          if (currentStage === 3 && index < 4 && !image.getAttribute("src") && image.dataset.liveUrl) image.src = image.dataset.liveUrl;
          if (currentStage !== 3 && image.getAttribute("src")) image.removeAttribute("src");
        });
        document.querySelectorAll("[data-step-item]").forEach((item) => {
          const step = Number(item.dataset.stepItem);
          const state = workflow.completed && stageComplete(step) ? "complete" : step === currentStage ? "current" : stageComplete(step) ? "complete" : "upcoming";
          item.dataset.state = state;
          const dot = item.querySelector(".step-dot");
          const detail = item.querySelector("small");
          if (dot) dot.textContent = state === "complete" ? "✓" : String(step);
          if (detail) detail.textContent = state === "complete" ? "Completed" : state === "current" ? "Current step" : "Not started";
        });
        const back = document.getElementById("stage-back");
        const next = document.getElementById("stage-next");
        back.disabled = currentStage === 1;
        next.hidden = currentStage === 6;
        next.textContent = "Continue";
        if (stageComplete(currentStage)) dismissToast("stage-guidance");
        sessionStorage.setItem("venue-edge-stage", String(currentStage));
        if (renderedStage !== currentStage) {
          // A step's notices belong to that step; don't carry them to the next one.
          const toastStage = { "enrollment-message": 1, "nvr-message": 2, "camera-message": 3, "mapping-message": 4, "commissioning-progress": 5 };
          for (const [key, stage] of Object.entries(toastStage)) {
            if (stage !== currentStage && !(key === "commissioning-progress" && currentStage === 6)) dismissToast(key);
          }
          renderedStage = currentStage;
          window.scrollTo({ top: 0, behavior: "instant" });
        }
      }

      document.getElementById("stage-back")?.addEventListener("click", () => {
        resumeFromSavedProgress = false;
        currentStage = Math.max(1, currentStage - 1);
        dismissToast("stage-guidance");
        renderStages();
      });
      document.querySelectorAll("[data-step-item]").forEach((item) => {
        item.addEventListener("click", () => {
          const requestedStage = Number(item.dataset.stepItem);
          if (requestedStage > currentStage && !stageComplete(requestedStage)) {
            showToast({
              key: "stage-navigation",
              kind: "info",
              title: "Finish the current step first",
              message: "You can revisit completed stages at any time.",
            });
            return;
          }
          resumeFromSavedProgress = false;
          currentStage = requestedStage;
          dismissToast("stage-guidance");
          renderStages();
        });
      });
      document.getElementById("stage-next")?.addEventListener("click", async () => {
        resumeFromSavedProgress = false;
        if (!stageComplete(currentStage)) {
          showStageGuidance();
          return;
        }
        currentStage = Math.min(6, currentStage + 1);
        dismissToast("stage-guidance");
        renderStages();
      });

      async function loadTopologyReview() {
        const data = await api("/api/setup/topology/review");
        topologyProposal = data.proposal;
        const review = document.getElementById("topology-review");
        const notices = topologyProposal.issues.filter((issue) => issue.severity === "notice");
        const problems = topologyProposal.issues.filter((issue) => issue.severity !== "notice");
        workflow.topologyClean = problems.length === 0;
        const summary = "<p class='muted'>" + escapeHtml(cameraSummaryText) + "</p>";
        review.dataset.empty = String(topologyProposal.issues.length === 0);
        if (topologyProposal.issues.length === 0) {
          review.innerHTML = summary;
          renderStages();
          return;
        }

        const selectedCount = topologyProposal.deleteNvrIds.length + topologyProposal.deleteCameraIds.length + topologyProposal.renames.length;
        review.innerHTML =
          "<strong>" + (problems.length > 0 ? "Some cameras need attention" : "Check your recorders") + "</strong>" +
          summary +
          "<ul class='review-list'>" +
          topologyProposal.issues.map((issue) => "<li>" + escapeHtml(issue.message) + "</li>").join("") +
          "</ul>" +
          (problems.some((issue) => issue.code === "duplicate_channel" && issue.severity === "blocking")
            ? "<p>Untick one of the two copies, then this list updates.</p>"
            : "") +
          "<div class='actions'>" +
          (problems.length > 0 && selectedCount > 0
            ? "<button type='button' id='apply-topology-review'>Remove " + selectedCount + " unused " + (selectedCount === 1 ? "entry" : "entries") + "</button>"
            : "") +
          (notices.length > 0 ? "<button type='button' class='secondary' id='open-recorders'>Manage recorders</button>" : "") +
          "</div>";
        document.getElementById("open-recorders")?.addEventListener("click", () => {
          resumeFromSavedProgress = false;
          currentStage = 2;
          renderStages();
        });

        document.getElementById("apply-topology-review")?.addEventListener("click", async (event) => {
          const button = event.currentTarget;
          if (button.dataset.confirmed !== "true") {
            button.dataset.confirmed = "true";
            button.textContent = "Confirm removal";
            return;
          }
          button.disabled = true;
          button.textContent = "Removing…";
          try {
            const result = await api("/api/setup/topology/review/apply", {
              method: "POST",
              body: JSON.stringify({
                fingerprint: topologyProposal.fingerprint,
                deleteNvrIds: topologyProposal.deleteNvrIds,
                deleteCameraIds: topologyProposal.deleteCameraIds,
                renames: topologyProposal.renames,
              }),
            });
            topologyProposal = result.proposal;
            await loadNvrs();
            document.getElementById("camera-message").textContent = "Removed the unused entries.";
          } catch (error) {
            button.disabled = false;
            button.dataset.confirmed = "false";
            button.textContent = "Try again";
            document.getElementById("camera-message").textContent = error.message;
          }
        });
        renderStages();
      }

      renderStages();

      async function api(path, options = {}) {
        const headers = {
          "Content-Type": "application/json",
          "X-VenueEdge-Setup-Token": token,
          ...(options.headers || {}),
        };
        const controller = new AbortController();
        const timeoutMs = options.timeoutMs || 30000;
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const response = await fetch(path, { ...options, headers, signal: controller.signal });
          const text = await response.text();
          let body = null;
          try { body = text ? JSON.parse(text) : null; } catch { body = { message: text }; }
          if (!response.ok) {
            throw new Error(body?.error || body?.message || "Request failed (" + response.status + ")");
          }
          return body;
        } catch (error) {
          if (controller.signal.aborted) {
            throw new Error("The request timed out. Check the connection and retry; your saved setup is preserved.");
          }
          throw error;
        } finally {
          clearTimeout(timeout);
        }
      }

      function formatTestSummary(lastTest) {
        if (!lastTest) return "Not tested yet.";
        const checks = lastTest.checks
          .map((c) => (c.passed ? "✓" : "✗") + " " + c.message)
          .join("\\n");
        const diagnosis = !lastTest.passed && lastTest.diagnostic
          ? "Problem: " + lastTest.diagnostic.summary + "\\nNext: " + lastTest.diagnostic.action + "\\n\\n"
          : "";
        return lastTest.passed
          ? "Last test passed.\\n" + checks
          : diagnosis + "Check results:\\n" + checks;
      }

      function formatTechnicalDetails(lastTest) {
        const diagnostic = lastTest?.diagnostic;
        if (!diagnostic) return "No technical probe details were recorded. Run Test camera again with VenueEdge 0.2.8.";
        return [
          "Code: " + diagnostic.code,
          "FFmpeg exit code: " + (diagnostic.exitCode ?? "none"),
          "Timed out: " + (diagnostic.timedOut ? "yes" : "no"),
          "Detected codec: " + (diagnostic.detectedCodec ?? "none"),
          "\\nLast safe FFmpeg output:\\n" + (diagnostic.output || "No FFmpeg output was returned."),
        ].join("\\n");
      }

      document.getElementById("enrollment-form")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const message = document.getElementById("enrollment-message");
        const form = new FormData(event.currentTarget);
        message.textContent = "Pairing VenueEdge…";
        try {
          await api("/api/setup/enroll", {
            method: "POST",
            body: JSON.stringify({ pairingCode: form.get("pairingCode") }),
          });
          message.textContent = "Pairing complete. Reloading setup…";
          window.location.reload();
        } catch (error) {
          message.textContent = error.message;
        }
      });

      document.getElementById("reset-pairing-btn")?.addEventListener("click", async () => {
        const message = document.getElementById("reset-pairing-message");
        const ok = window.confirm(
          "Reset this PC's pairing?\\n\\nIt stops sending replays to PlayTT until you enter a new pairing code. NVRs, cameras and table mappings are kept.",
        );
        if (!ok) return;
        message.textContent = "Resetting pairing…";
        try {
          await api("/api/setup/reset-pairing", {
            method: "POST",
            body: JSON.stringify({ confirmation: "RESET PAIRING" }),
          });
          message.textContent = "Pairing reset. Reloading so you can enter the new code…";
          window.location.reload();
        } catch (error) {
          message.textContent = error.message;
        }
      });

      async function loadNvrs() {
        const data = await api("/api/setup/nvrs");
        workflow.nvrCount = data.nvrs.length;
        const cameraCountsByNvr = {};
        try {
          for (const camera of (await api("/api/setup/cameras")).cameras) {
            cameraCountsByNvr[camera.nvrId] = (cameraCountsByNvr[camera.nvrId] || 0) + 1;
          }
        } catch {
          // Counts are informational only.
        }
        const list = document.getElementById("nvr-list");
        list.innerHTML = "";
        const nvrSelect = document.getElementById("camera-nvr-select");
        if (nvrSelect) {
          nvrSelect.innerHTML = "";
        }
        for (const nvr of data.nvrs) {
          if (nvrSelect) {
            const option = document.createElement("option");
            option.value = nvr.id;
            option.textContent = nvr.label + " (" + nvr.host + ")";
            nvrSelect.appendChild(option);
          }
          const item = document.createElement("div");
          item.className = "nvr-item";
          const nvrCameraCount = cameraCountsByNvr[nvr.id] || 0;
          const nvrStatus = !nvr.enabled
            ? "Turned off — its cameras aren't used."
            : !nvr.hasPassword
              ? "Password needed on this PC."
              : nvr.lastTest
                ? (nvr.lastTest.passed ? "Connected." : "Last connection check failed.")
                : "";
          item.innerHTML =
            "<strong>" + escapeHtml(nvr.label) + "</strong>" +
            "<p class='muted' style='margin:.15rem 0 0'>" + escapeHtml(nvr.host) + (nvr.rtspPort === 554 ? "" : ":" + nvr.rtspPort) +
            " · " + nvrCameraCount + (nvrCameraCount === 1 ? " camera" : " cameras") +
            " · signs in as " + escapeHtml(nvr.username) + "</p>" +
            (nvrStatus ? "<p style='margin:.15rem 0 0'>" + nvrStatus + "</p>" : "");
          if (!setupLocked) {
            {
              const credentialForm = document.createElement("form");
              credentialForm.className = "credential-recovery";
              const credentialCopy = document.createElement("p");
              credentialCopy.className = "muted";
              credentialCopy.textContent = nvr.hasPassword
                ? "Camera access failing? Verify a corrected username and password here."
                : "Restore credentials to start real video buffering. The password stays protected on this PC.";
              const usernameLabel = document.createElement("label");
              usernameLabel.textContent = "NVR username";
              const usernameInput = document.createElement("input");
              usernameInput.value = nvr.username;
              usernameInput.required = true;
              usernameInput.autocomplete = "username";
              usernameLabel.appendChild(usernameInput);
              const passwordLabel = document.createElement("label");
              passwordLabel.textContent = "NVR password";
              const passwordInput = document.createElement("input");
              passwordInput.type = "password";
              passwordInput.required = true;
              passwordInput.autocomplete = "current-password";
              passwordInput.placeholder = "Enter password";
              passwordLabel.appendChild(passwordInput);
              const savePasswordBtn = document.createElement("button");
              savePasswordBtn.type = "submit";
              savePasswordBtn.textContent = "Verify & save credentials";
              credentialForm.append(credentialCopy, usernameLabel, passwordLabel, savePasswordBtn);
              credentialForm.onsubmit = async (event) => {
                event.preventDefault();
                savePasswordBtn.disabled = true;
                savePasswordBtn.textContent = "Verifying…";
                const message = document.getElementById("nvr-message");
                message.dataset.state = "checking";
                message.textContent = "Checking the corrected credentials against the live stream…";
                try {
                  await api("/api/setup/nvrs/" + nvr.id, {
                    method: "PATCH",
                    body: JSON.stringify({
                      username: usernameInput.value,
                      password: passwordInput.value,
                    }),
                    timeoutMs: 25000,
                  });
                  await loadNvrs();
                  const refreshedMessage = document.getElementById("nvr-message");
                  refreshedMessage.dataset.state = "success";
                  refreshedMessage.textContent = "Credentials verified and saved. Return to Review cameras and scan again.";
                } catch (error) {
                  savePasswordBtn.disabled = false;
                  savePasswordBtn.textContent = "Verify & save credentials";
                  message.dataset.state = "error";
                  message.textContent = error instanceof Error ? error.message : "Could not verify the credentials.";
                  passwordInput.focus();
                }
              };
              const credentialDetails = document.createElement("details");
              const credentialSummary = document.createElement("summary");
              credentialSummary.textContent = nvr.hasPassword
                ? "Change NVR credentials"
                : "NVR credentials required";
              credentialDetails.open = !nvr.hasPassword;
              credentialDetails.append(credentialSummary, credentialForm);
              item.appendChild(credentialDetails);
            }
            const nvrActions = document.createElement("div");
            nvrActions.className = "quiet-actions";
            const testBtn = document.createElement("button");
            testBtn.type = "button";
            testBtn.textContent = "Check connection";
            testBtn.className = "link";
            testBtn.onclick = () => testNvr(nvr.id);
            const enumerateBtn = document.createElement("button");
            enumerateBtn.type = "button";
            enumerateBtn.textContent = "Scan for cameras";
            enumerateBtn.className = "link";
            enumerateBtn.onclick = () => enumerateCameras(nvr.id);
            const disableBtn = document.createElement("button");
            disableBtn.type = "button";
            disableBtn.textContent = nvr.enabled ? "Turn off" : "Turn on";
            disableBtn.className = "link";
            disableBtn.onclick = () => toggleNvr(nvr);
            const deleteBtn = document.createElement("button");
            deleteBtn.type = "button";
            deleteBtn.textContent = "Remove";
            deleteBtn.className = "link danger";
            deleteBtn.onclick = () => {
              const ok = window.confirm(
                "Remove " + nvr.label + " (" + nvr.host + ")?\\n\\n" +
                (nvrCameraCount ? "Its " + nvrCameraCount + " cameras and any tables using them are removed from this PC too. " : "") +
                "You can add the recorder again later.",
              );
              if (ok) removeNvr(nvr.id);
            };
            nvrActions.append(testBtn, enumerateBtn, disableBtn, deleteBtn);
            item.append(nvrActions);
          }
          list.appendChild(item);
        }
        await loadCameras();
        renderStages();
      }

      async function testNvr(id) {
        const message = document.getElementById("nvr-message");
        message.dataset.state = "checking";
        message.textContent = "Checking the connection to the recorder…";
        try {
          const outcome = await api("/api/setup/nvrs/" + id + "/test", { method: "POST", body: "{}", timeoutMs: 60000 });
          await loadNvrs();
          const passed = outcome && (outcome.passed ?? (outcome.result && outcome.result.passed));
          message.dataset.state = passed === false ? "error" : "success";
          message.textContent = passed === false ? describeFailedTest("The recorder", outcome) : "Recorder connection checked.";
        } catch (error) {
          message.dataset.state = "error";
          message.textContent = error.message;
        }
      }

      async function toggleNvr(nvr) {
        try {
          await api("/api/setup/nvrs/" + nvr.id, {
            method: "PATCH",
            body: JSON.stringify({ enabled: !nvr.enabled }),
          });
          await loadNvrs();
          await loadResources();
        } catch (error) {
          document.getElementById("nvr-message").textContent = error.message;
        }
      }

      async function removeNvr(id) {
        try {
          await api("/api/setup/nvrs/" + id, { method: "DELETE", body: "{}" });
          await loadNvrs();
          await loadResources();
          await loadCommissioning();
          const message = document.getElementById("nvr-message");
          message.dataset.state = "success";
          message.textContent = "Recorder removed.";
        } catch (error) {
          document.getElementById("nvr-message").textContent = error.message;
        }
      }

      async function enumerateCameras(nvrId) {
        const message = document.getElementById("camera-message");
        message.dataset.state = "checking";
        message.textContent = "Scanning the recorder for cameras…";
        return withLiveViewsPaused(async () => {
          try {
            const result = await api("/api/setup/nvrs/" + nvrId + "/cameras/enumerate", {
              method: "POST",
              body: "{}",
              timeoutMs: 240000,
            });
            await loadCameras();
            const found = result.created.length + result.updated.length;
            if (found === 0) {
              const firstFailure = result.failures?.[0];
              message.dataset.state = "error";
              message.textContent = firstFailure
                ? "No cameras found. Channel " + firstFailure.channelKey + ": " + firstFailure.summary + " " + firstFailure.action
                : "No cameras found. Check that camera channels are enabled on the NVR.";
            } else {
              const problems = (result.failures || []).length;
              const notes = (result.notes || []).map((note) => note.message);
              message.dataset.state = problems > 0 ? "error" : "success";
              message.textContent =
                "Found " + found + " camera" + (found === 1 ? "" : "s") + "." +
                (problems > 0
                  ? " " + problems + " channel" + (problems === 1 ? "" : "s") + " had a problem: " +
                    result.failures.map((failure) => "channel " + failure.channelKey + " (" + failure.summary + ")").join("; ") + "."
                  : "") +
                (notes.length > 0 ? " " + notes.join(" ") : "");
            }
          } catch (error) {
            message.dataset.state = "error";
            message.setAttribute("role", "alert");
            message.textContent = error.message;
            throw error;
          }
        });
      }

      async function discoverAllCameras() {
        const button = document.getElementById("scan-cameras");
        button.disabled = true;
        try {
          await withLiveViewsPaused(async () => {
            const data = await api("/api/setup/nvrs");
            for (const nvr of data.nvrs.filter((nvr) => nvr.enabled)) await enumerateCameras(nvr.id);
          });
        } catch (error) {
          document.getElementById("camera-message").textContent = error.message;
        } finally { button.disabled = setupLocked; }
      }
      document.getElementById("scan-cameras")?.addEventListener("click", discoverAllCameras);

      function describeFailedTest(label, outcome) {
        const diagnostic = outcome && (outcome.diagnostic || (outcome.result && outcome.result.diagnostic));
        if (diagnostic && diagnostic.summary) {
          return label + ": " + diagnostic.summary + (diagnostic.action ? " " + diagnostic.action : "");
        }
        const failed = outcome && outcome.result && outcome.result.checks
          ? outcome.result.checks.find((check) => !check.passed)
          : null;
        return label + ": " + (failed ? failed.message : "no video came through.") +
          " Check the camera is powered and shows a picture on the recorder, then check again.";
      }

      async function prepareSelectedCameras() {
        if (preparingCameras) return;
        preparingCameras = true;
        const button = document.getElementById("prepare-cameras");
        const message = document.getElementById("camera-message");
        button.disabled = true;
        button.textContent = "Checking…";
        const problems = [];
        try {
          await pauseLiveViews();
          await new Promise((resolve) => setTimeout(resolve, 350));
          const data = await api("/api/setup/cameras");
          const selected = data.cameras.filter((camera) => camera.enabled && camera.nvrEnabled !== false);
          if (!selected.length) throw new Error("Tick at least one camera that films a table.");
          for (const [index, camera] of selected.entries()) {
            message.dataset.state = "checking";
            message.textContent = "Checking " + camera.label + " (" + (index + 1) + " of " + selected.length + ")…";
            try {
              const result = await api("/api/setup/cameras/" + camera.id + "/test", { method: "POST", body: "{}", timeoutMs: 180000 });
              if (result.passed === false) { problems.push(describeFailedTest(camera.label, result)); continue; }
              message.dataset.state = "checking";
              message.textContent = "Recording a 15-second sample from " + camera.label + "…";
              await api("/api/setup/cameras/" + camera.id + "/preview", { method: "POST", body: "{}", timeoutMs: 90000 });
            } catch (error) {
              problems.push(camera.label + ": " + error.message);
            }
          }
          await loadCameras();
          await loadCommissioning();
          if (problems.length) {
            message.dataset.state = "error";
            message.textContent = (problems.length === 1 ? "" : problems.length + " cameras need attention. ") + problems.join(" ");
          } else {
            message.dataset.state = "success";
            message.textContent = selected.length === 1 ? "The camera is ready." : "All " + selected.length + " cameras are ready.";
          }
        } catch (error) {
          message.dataset.state = "error";
          message.textContent = error.message;
        }
        finally { preparingCameras = false; button.disabled = setupLocked; button.textContent = "Check selected cameras"; resumeLiveViews(); }
      }
      document.getElementById("prepare-cameras")?.addEventListener("click", prepareSelectedCameras);

      function escapeHtml(value) {
        return String(value == null ? "" : value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
      }

      let cameraSummaryText = "";

      async function loadCameras() {
        const data = await api("/api/setup/cameras");
        // Cameras on a turned-off recorder are never used, so don't list them.
        const cameras = data.cameras.filter((camera) => camera.nvrEnabled !== false);
        const hiddenCount = data.cameras.length - cameras.length;
        workflow.cameraCount = cameras.length;
        const list = document.getElementById("camera-list");
        await pauseLiveViews();
        list.innerHTML = "";
        const recorderIds = [...new Set(cameras.map((camera) => camera.nvrId))];
        const selectedCount = cameras.filter((camera) => camera.enabled).length;
        cameraSummaryText = cameras.length === 0
          ? "No cameras yet. Choose Scan recorder again."
          : cameras.length + (cameras.length === 1 ? " camera" : " cameras") +
            (recorderIds.length === 1 ? " on " + cameras[0].nvrLabel : " on " + recorderIds.length + " recorders") +
            " · " + selectedCount + " ticked for replays" +
            (hiddenCount > 0 ? " · " + hiddenCount + " on a turned-off recorder not shown" : "") + ".";
        let group = null;
        for (const camera of cameras) {
          if (!group || group.dataset.nvrId !== camera.nvrId) {
            group = document.createElement("section");
            group.className = "camera-group";
            group.dataset.nvrId = camera.nvrId;
            const groupCameras = cameras.filter((entry) => entry.nvrId === camera.nvrId);
            const groupHeading = document.createElement("h3");
            groupHeading.textContent = camera.nvrLabel + " ";
            const groupMeta = document.createElement("span");
            groupMeta.textContent = (camera.nvrHost ? camera.nvrHost + " · " : "") + groupCameras.length + (groupCameras.length === 1 ? " camera" : " cameras");
            groupHeading.appendChild(groupMeta);
            group.appendChild(groupHeading);
            list.appendChild(group);
          }
          const item = document.createElement("div");
          item.className = "camera-item";

          const live = document.createElement("div");
          live.className = "camera-live";
          const liveImage = document.createElement("img");
          liveImage.dataset.cameraId = camera.id;
          liveImage.alt = "Live view from " + camera.label;
          liveImage.loading = "lazy";
          const liveState = document.createElement("span");
          liveState.className = "camera-live-state";
          liveState.textContent = "Connecting…";
          const refreshLiveView = () => {
            liveState.textContent = "Connecting…";
            const active = [...document.querySelectorAll(".camera-live img[src]")].filter((image) => image !== liveImage);
            if (active.length >= 4) active[0].removeAttribute("src");
            liveImage.src = "/api/setup/cameras/" + camera.id + "/live.mjpeg?setup_token=" + encodeURIComponent(token) + "&view=" + Date.now();
          };
          liveImage.onload = () => { liveState.textContent = "Live"; };
          liveImage.onerror = () => { liveState.textContent = "Live view unavailable"; };
          liveImage.dataset.liveUrl = "/api/setup/cameras/" + camera.id + "/live.mjpeg?setup_token=" + encodeURIComponent(token);
          liveState.textContent = "Live view opens during camera review";
          live.append(liveImage, liveState);

          const info = document.createElement("div");
          const heading = document.createElement("div");
          heading.className = "camera-heading";
          const nameInput = document.createElement("input");
          nameInput.value = camera.label;
          nameInput.setAttribute("aria-label", "Camera name for channel " + camera.channelKey);
          nameInput.disabled = setupLocked;
          nameInput.onchange = async () => {
            try {
              await api("/api/setup/cameras/" + camera.id, { method: "PATCH", body: JSON.stringify({ label: nameInput.value }) });
              await loadCommissioning();
              document.getElementById("camera-message").textContent = "Camera name saved.";
            } catch (error) { document.getElementById("camera-message").textContent = error.message; }
          };
          heading.append(nameInput);
          const meta = document.createElement("p");
          meta.className = "muted camera-meta";
          meta.textContent = "Channel " + camera.channelKey +
            (camera.streamProfile === "sub" ? " · lower-resolution stream (main stream isn't H.264)" : "") +
            (camera.codec === "h265" ? " · sends H.265, which replays can't use yet" : "");
          const status = document.createElement("p");
          status.className = "camera-status";
          if (!camera.lastTest) {
            status.textContent = camera.enabled ? "Not checked yet." : "";
          } else if (camera.lastTest.passed) {
            status.dataset.state = "ready";
            status.textContent = camera.enabled ? "Working." : "Picture found.";
          } else {
            status.dataset.state = "error";
            status.textContent = describeFailedTest("Last check failed", { diagnostic: camera.lastTest.diagnostic, result: { checks: camera.lastTest.checks } });
          }
          // "buffer_stale" only means replay recording hasn't started yet (it starts
          // after Publish), so it isn't a camera problem during setup.
          if ((camera.healthStatus === "unhealthy" || camera.healthStatus === "degraded") && camera.healthReasonCode !== "buffer_stale") {
            status.textContent += (status.textContent ? " " : "") + "The video dropped out recently.";
          }
          info.append(heading, meta, status);
          if (camera.lastTest && !camera.lastTest.passed) {
            const technical = document.createElement("details");
            const technicalSummary = document.createElement("summary");
            technicalSummary.textContent = "Technical details";
            const technicalOutput = document.createElement("pre");
            technicalOutput.className = "technical-output";
            technicalOutput.textContent = formatTestSummary(camera.lastTest) + "\\n\\n" + formatTechnicalDetails(camera.lastTest);
            const copyButton = document.createElement("button");
            copyButton.type = "button";
            copyButton.className = "inline";
            copyButton.textContent = "Copy diagnostics";
            copyButton.onclick = async () => {
              try {
                await navigator.clipboard.writeText(technicalOutput.textContent);
                copyButton.textContent = "Copied";
              } catch {
                copyButton.textContent = "Select the details above to copy";
              }
            };
            technical.append(technicalSummary, technicalOutput, copyButton);
            info.appendChild(technical);
          }
          if (!setupLocked) {
            const actions = document.createElement("div");
            actions.className = "camera-actions";
            const useLabel = document.createElement("label");
            useLabel.className = "check";
            const useBox = document.createElement("input");
            useBox.type = "checkbox";
            useBox.checked = camera.enabled;
            useBox.onchange = () => toggleCamera(camera, useBox);
            useLabel.append(useBox, document.createTextNode("Use for replay clips"));
            actions.append(useLabel);
            info.appendChild(actions);

            const more = document.createElement("div");
            more.className = "quiet-actions";
            const testBtn = document.createElement("button");
            testBtn.type = "button";
            testBtn.textContent = "Check this camera";
            testBtn.className = "link";
            testBtn.onclick = () => testCamera(camera.id);
            const refreshBtn = document.createElement("button");
            refreshBtn.type = "button";
            refreshBtn.textContent = "Reload picture";
            refreshBtn.className = "link";
            refreshBtn.onclick = refreshLiveView;
            const deleteBtn = document.createElement("button");
            deleteBtn.type = "button";
            deleteBtn.textContent = "Remove";
            deleteBtn.className = "link danger";
            deleteBtn.onclick = () => {
              if (window.confirm("Remove " + camera.label + " from this list? Scanning the recorder again brings it back.")) removeCamera(camera.id);
            };
            more.append(testBtn, refreshBtn, deleteBtn);
            info.appendChild(more);
          }
          item.append(live, info);
          group.appendChild(item);
        }
        await loadTopologyReview();
        renderStages();
      }

      async function testCamera(id) {
        const message = document.getElementById("camera-message");
        message.dataset.state = "checking";
        message.textContent = "Checking the camera…";
        await pauseLiveViews();
        await new Promise((resolve) => setTimeout(resolve, 350));
        try {
          const result = await api("/api/setup/cameras/" + id + "/test", { method: "POST", body: "{}", timeoutMs: 180000 });
          await loadCameras();
          await loadCommissioning();
          const label = (await api("/api/setup/cameras")).cameras.find((camera) => camera.id === id)?.label || "This camera";
          message.dataset.state = result.passed ? "success" : "error";
          message.textContent = result.passed ? label + " is working." : describeFailedTest(label, result);
        } catch (error) {
          message.textContent = error.message;
          resumeLiveViews();
        }
      }

      async function pauseLiveViews() {
        document.querySelectorAll(".camera-live img[src]").forEach((image) => image.removeAttribute("src"));
        try {
          await api("/api/setup/cameras/live/stop", { method: "POST", body: "{}" });
        } catch {
          // The browser-side source removal still releases previews on older agents.
        }
      }

      // Recorders allow only a few simultaneous RTSP sessions, so live views must be
      // released before probing channels. Nesting keeps them closed for the whole scan.
      async function withLiveViewsPaused(run) {
        if (liveViewPauseDepth === 0) {
          await pauseLiveViews();
          await new Promise((resolve) => setTimeout(resolve, 350));
        }
        liveViewPauseDepth += 1;
        try {
          return await run();
        } finally {
          liveViewPauseDepth -= 1;
          if (liveViewPauseDepth === 0) resumeLiveViews();
        }
      }

      function resumeLiveViews() {
        if (currentStage !== 3) return;
        document.querySelectorAll(".camera-live img[data-live-url]").forEach((image, index) => {
          if (index < 4) image.src = image.dataset.liveUrl + "&view=" + Date.now();
        });
      }

      async function capturePreview(id) {
        document.getElementById("commissioning-message").textContent = "Capturing 15-second preview…";
        await api("/api/setup/cameras/" + id + "/preview", { method: "POST", body: "{}" });
        const video = document.getElementById("commissioning-preview");
        video.style.display = "block";
        video.src =
          "/api/setup/cameras/" + id + "/preview.mp4?setup_token=" + encodeURIComponent(token);
        await loadCommissioning();
        document.getElementById("commissioning-message").textContent = "Preview captured.";
      }

      async function loadCommissioning() {
        const data = await api("/api/setup/commissioning");
        const checklist = data.checklist;
        const lines = [
          (checklist.allEnabledCamerasTested ? "✓" : "○") + " Selected cameras checked",
          (checklist.allEnabledCamerasPreviewed ? "✓" : "○") + " 15-second sample recorded from each camera",
          (checklist.failoverReady ? "✓" : "○") + " Backup cameras switch over correctly",
          (checklist.enrolled ? "✓" : "○") + " Paired with PlayTT",
          (checklist.published ? "✓" : "○") + " Setup sent to PlayTT",
          (checklist.latestCloudConfigReceived ? "✓" : "○") + " PlayTT's latest setup received",
          (checklist.configApplied ? "✓" : "○") + " PlayTT and this PC agree on the setup",
          (checklist.completed ? "✓" : "○") + " Setup finished",
        ];
        if (checklist.blockingReasons.length > 0) {
          lines.push("\\nStill to do:\\n" + checklist.blockingReasons.join("\\n"));
        }
        if (checklist.recommendedReasons && checklist.recommendedReasons.length > 0) {
          lines.push("\\nRecommended:\\n" + checklist.recommendedReasons.join("\\n"));
        }
        workflow.enrolled = checklist.enrolled;
        workflow.failoverReady = checklist.failoverReady;
        workflow.published = checklist.published;
        workflow.configApplied = checklist.configApplied;
        workflow.completed = checklist.completed;
        document.getElementById("completion-heading").textContent = checklist.completed ? "Setup complete" : "Complete commissioning";
        document.getElementById("completion-description").textContent = checklist.completed
          ? "This venue PC has completed commissioning. You can lock setup and close this tab; VenueEdge keeps running."
          : "Finish after every preview and failover check passes and the latest cloud configuration is applied on this PC.";
        document.getElementById("completion-panel-heading").textContent = checklist.completed ? "✓ VenueEdge is ready" : "Final readiness check";
        document.getElementById("completion-success").hidden = !checklist.completed;
        document.getElementById("commissioning-final-checklist").hidden = checklist.completed;
        document.getElementById("commissioning-complete").classList.toggle("secondary", checklist.completed);
        document.getElementById("lock-btn").classList.toggle("secondary", !checklist.completed);
        workflow.enabledCameraCount = checklist.enabledCameraCount;
        workflow.camerasTested = checklist.allEnabledCamerasTested;
        workflow.camerasPreviewed = checklist.allEnabledCamerasPreviewed;
        camerasReady = checklist.allEnabledCamerasTested && checklist.allEnabledCamerasPreviewed;
        if (checklist.configApplied && currentStage === 5) currentStage = 6;
        document.getElementById("commissioning-checklist").textContent = lines.join("\\n");
        document.getElementById("commissioning-final-checklist").textContent = lines.join("\\n");
        const completeButton = document.getElementById("commissioning-complete");
        if (checklist.completed) {
          completeButton.dataset.mode = "sync";
          completeButton.textContent = "Sync completion with PlayTT";
          completeButton.disabled = setupLocked;
        } else {
          completeButton.dataset.mode = "complete";
          completeButton.textContent = "Complete commissioning";
          completeButton.disabled = setupLocked || !checklist.canComplete;
        }
        const publishButton = document.getElementById("commissioning-publish");
        if (publishButton && publishButton.dataset.busy !== "true") {
          publishButton.disabled =
            setupLocked ||
            !checklist.enrolled ||
            checklist.enabledCameraCount === 0 ||
            !checklist.allEnabledCamerasTested ||
            !checklist.allEnabledCamerasPreviewed ||
            !checklist.failoverReady;
        }
        if (checklist.completed) {
          setCompleteStatus("Commissioning complete. Cloud configuration is applied locally.", false);
        } else if (checklist.published && !checklist.configApplied) {
          if (currentStage > 5) currentStage = 5;
          if (checklist.latestCloudConfigReceived) {
            setCompleteStatus("PlayTT sent a configuration, but it does not match this PC. Publish the latest reviewed snapshot again in PlayTT admin.", false);
            document.getElementById("commissioning-message").textContent = "Configuration received. The camera and recorder list differs from this PC, so commissioning cannot continue yet.";
          } else if (workflow.autoPublishStatus === "needs_approval" || workflow.autoPublishStatus === "failed") {
            setCompleteStatus("Waiting for PlayTT admin to publish this setup.", false);
          } else {
            setCompleteStatus("Applying the configuration from PlayTT…", true);
          }
        }
        if (commissioningPollTimer) clearTimeout(commissioningPollTimer);
        if (checklist.published && !checklist.configApplied) {
          commissioningPollTimer = setTimeout(() => {
            loadCommissioning().catch((error) => setCompleteStatus(error.message, false));
          }, 2000);
        }
        renderStages();
      }

      // Checks locally that the backup camera takes over when the main one fails.
      // It only simulates a failure; no camera is touched.
      async function runFailoverDrill(resourceId, label) {
        const message = document.getElementById("mapping-message");
        message.dataset.state = "checking";
        message.textContent = "Checking that " + label + " switches to its backup…";
        try {
          const response = await api("/api/setup/resources/" + resourceId + "/failover-drill", { method: "POST", body: "{}" });
          message.dataset.state = "success";
          message.textContent = response.result && response.result.skipped ? label + " is set." : label + " switches to its backup correctly.";
        } catch (error) {
          message.dataset.state = "error";
          message.textContent = label + ": the backup camera didn't take over in the test. Check both cameras work in Review cameras, then choose Check switch-over again.";
        }
      }

      document.getElementById("commissioning-test-all")?.addEventListener("click", async () => {
        document.getElementById("commissioning-message").textContent = "Testing enabled cameras…";
        await api("/api/setup/commissioning/test-enabled", { method: "POST", body: "{}" });
        await loadCameras();
        await loadCommissioning();
        document.getElementById("commissioning-message").textContent = "Enabled camera tests finished.";
      });

      document.getElementById("commissioning-publish")?.addEventListener("click", async () => {
        const publishButton = document.getElementById("commissioning-publish");
        publishButton.disabled = true;
        publishButton.dataset.busy = "true";
        publishButton.textContent = "Publishing…";
        document.getElementById("commissioning-message").textContent = "Sending this setup to PlayTT…";
        try {
          const result = await api("/api/setup/commissioning/publish", { method: "POST", body: "{}" });
          const autoPublish = result && result.autoPublish;
          workflow.autoPublishStatus = autoPublish ? autoPublish.status : "needs_approval";
          const message = document.getElementById("commissioning-message");
          if (autoPublish && autoPublish.status === "published") {
            message.textContent = "Published to PlayTT (version " + autoPublish.revisionVersion + "). Applying it on this PC now; this screen continues by itself.";
          } else if (autoPublish && autoPublish.status === "failed") {
            message.textContent = "PlayTT saved this setup but couldn't publish it: " + autoPublish.message + " Publish it from PlayTT admin; this screen continues by itself.";
          } else {
            message.textContent = "PlayTT saved this setup. This venue requires an admin to approve changes: publish it in PlayTT admin and this screen continues by itself.";
          }
          await loadCommissioning();
        } catch (error) {
          document.getElementById("commissioning-message").textContent = error.message;
        } finally {
          publishButton.dataset.busy = "false";
          publishButton.textContent = "Publish to PlayTT";
          await loadCommissioning().catch(() => {});
        }
      });

      document.getElementById("open-cloud-dashboard")?.addEventListener("click", () => {
        if (cloudDashboardUrl) window.open(cloudDashboardUrl, "_blank", "noopener,noreferrer");
      });

      document.getElementById("commissioning-complete")?.addEventListener("click", async () => {
        const completeBtn = document.getElementById("commissioning-complete");
        const syncOnly = completeBtn.dataset.mode === "sync";
        completeBtn.disabled = true;
        completeBtn.dataset.busy = "true";
        setCompleteStatus(syncOnly ? "Syncing completion with PlayTT…" : "Publishing final snapshot to PlayTT…", true);
        try {
          await api(
            syncOnly ? "/api/setup/commissioning/publish" : "/api/setup/commissioning/complete",
            { method: "POST", body: "{}" },
          );
          setCompleteStatus(
            syncOnly
              ? "Completion synced. PlayTT admin will update automatically."
              : "Snapshot accepted. Refreshing local checklist…",
            !syncOnly,
          );
          await loadCommissioning();
        } catch (error) {
          setCompleteStatus(error.message, false);
          completeBtn.disabled = setupLocked;
        } finally {
          completeBtn.dataset.busy = "false";
        }
      });

      async function toggleCamera(camera, checkbox) {
        if (checkbox) checkbox.disabled = true;
        try {
          await api("/api/setup/cameras/" + camera.id, {
            method: "PATCH",
            body: JSON.stringify({ enabled: !camera.enabled }),
          });
          await loadCameras();
          await loadResources();
          await loadCommissioning();
        } catch (error) {
          if (checkbox) { checkbox.checked = camera.enabled; checkbox.disabled = false; }
          document.getElementById("camera-message").textContent = error.message;
        }
      }

      async function removeCamera(id) {
        await api("/api/setup/cameras/" + id, { method: "DELETE", body: "{}" });
        await loadCameras();
        await loadResources();
      }

      function humanMappingWarning(warning) {
        const text = String(warning.message || "");
        const name = text.replace(/ (is disabled for PlayTT capture|health is .*|is also mapped to .*)\\.?$/, "");
        if (warning.code === "camera_disabled") return name + " is no longer ticked for replays. Choose another camera, or tick it again in Review cameras.";
        if (warning.code === "camera_unhealthy") return name + " has had video drop-outs recently. Check its cable and power.";
        if (warning.code === "duplicate_mapping") return name + " also films another table. That's fine if one camera covers both.";
        if (warning.code === "missing_camera") return "A camera chosen earlier no longer exists. Choose another camera.";
        if (warning.code === "unknown_resource") return "PlayTT no longer lists this table.";
        return text;
      }

      function cameraOptionLabel(camera, multipleRecorders) {
        const mentionsChannel = new RegExp("(^|\\\\D)" + camera.channelKey + "(\\\\D|$)").test(camera.label);
        return camera.label + (multipleRecorders ? " — " + camera.nvrLabel : "") + (mentionsChannel ? "" : " · channel " + camera.channelKey);
      }

      const autoCleanedResources = new Set();
      const openAdvancedResources = new Set();
      let resourcesGeneration = 0;

      async function loadResources() {
        const generation = ++resourcesGeneration;
        const resourcesData = await api("/api/setup/resources");
        const hint = document.getElementById("mapping-config-hint");
        hint.textContent = resourcesData.needsConfig
          ? "Tables appear here once this PC is paired and PlayTT has sent the venue's table list."
          : resourcesData.resources.length === 0 ? "PlayTT hasn't listed any tables for this venue yet." : "";

        const camerasData = await api("/api/setup/cameras");
        const usable = camerasData.cameras.filter((camera) => camera.enabled && camera.nvrEnabled !== false);
        const multipleRecorders = new Set(usable.map((camera) => camera.nvrId)).size > 1;
        const list = document.getElementById("resource-list");
        // Build off-screen so overlapping refreshes can't duplicate tables.
        const fragment = document.createDocumentFragment();
        let unmappedTables = 0;

        for (const resource of resourcesData.resources) {
          const policy = (await api("/api/setup/resources/" + resource.id + "/policy")).policy;
          const ordered = [...policy.candidates].sort((a, b) => a.priority - b.priority);
          const usableIds = new Set(usable.map((camera) => camera.id));
          // Skip cameras that are no longer ticked, so the first working one becomes the main camera.
          const working = ordered.filter((candidate) => usableIds.has(candidate.cameraId));
          const primary = working[0] ? working[0].cameraId : "";
          const backup = working[1] ? working[1].cameraId : "";

          const card = document.createElement("article");
          card.className = "table-card";
          const head = document.createElement("div");
          head.className = "table-card-head";
          const title = document.createElement("h3");
          title.textContent = resource.label;
          const state = document.createElement("span");
          state.className = "table-card-state";
          // PlayTT marks a table "enabled" only once a published setup routes a
          // camera to it, so on a first setup every table arrives disabled.
          // That must not stop the operator from choosing its camera.
          if (!primary) {
            unmappedTables += 1;
            state.dataset.state = "attention";
            state.textContent = "Needs a camera";
          } else {
            state.dataset.state = "ready";
            state.textContent = backup ? "Camera and backup set" : "Camera set";
          }
          head.append(title, state);
          card.appendChild(head);

          const fields = document.createElement("div");
          fields.className = "row";
          const primaryLabel = document.createElement("label");
          primaryLabel.textContent = "Camera";
          const primarySelect = document.createElement("select");
          const backupLabel = document.createElement("label");
          backupLabel.textContent = "Backup camera (optional)";
          const backupSelect = document.createElement("select");
          primarySelect.appendChild(new Option(usable.length ? "Choose a camera" : "No cameras ticked yet", ""));
          backupSelect.appendChild(new Option("No backup", ""));
          for (const camera of usable) {
            primarySelect.appendChild(new Option(cameraOptionLabel(camera, multipleRecorders), camera.id));
            backupSelect.appendChild(new Option(cameraOptionLabel(camera, multipleRecorders), camera.id));
          }
          primarySelect.value = primary;
          backupSelect.value = backup;
          const syncBackupOptions = () => {
            for (const option of backupSelect.options) option.disabled = option.value !== "" && option.value === primarySelect.value;
            backupSelect.disabled = setupLocked || !primarySelect.value;
          };
          primarySelect.disabled = setupLocked || usable.length === 0;
          syncBackupOptions();
          primaryLabel.appendChild(primarySelect);
          backupLabel.appendChild(backupSelect);
          fields.append(primaryLabel, backupLabel);
          card.appendChild(fields);

          if (usable.length === 0) {
            const empty = document.createElement("p");
            empty.className = "muted";
            empty.textContent = "Go back to Review cameras and tick the cameras that film tables.";
            card.appendChild(empty);
          }

          const notes = policy.warnings.map(humanMappingWarning);
          const removedCount = ordered.filter((candidate) => !usableIds.has(candidate.cameraId)).length;
          const primaryCamera = usable.find((camera) => camera.id === primary);
          const backupCamera = usable.find((camera) => camera.id === backup);
          if (primaryCamera && backupCamera && primaryCamera.nvrId === backupCamera.nvrId && primaryCamera.channelKey === backupCamera.channelKey) {
            notes.push("The backup is the same camera as the main one (channel " + primaryCamera.channelKey + "), so it won't help if that camera stops. Pick a different camera as the backup, or choose No backup.");
          }
          if (notes.length > 0) {
            const noteList = document.createElement("ul");
            noteList.className = "table-notes";
            for (const note of [...new Set(notes)]) {
              const li = document.createElement("li");
              li.textContent = note;
              noteList.appendChild(li);
            }
            card.appendChild(noteList);
          }

          const advanced = document.createElement("details");
          advanced.open = openAdvancedResources.has(resource.id);
          advanced.addEventListener("toggle", () => {
            if (advanced.open) openAdvancedResources.add(resource.id);
            else openAdvancedResources.delete(resource.id);
          });
          const advancedSummary = document.createElement("summary");
          advancedSummary.textContent = "Advanced";
          const advancedBody = document.createElement("div");
          advancedBody.className = "advanced";
          const autoLabel = document.createElement("label");
          autoLabel.className = "check";
          const autoBox = document.createElement("input");
          autoBox.type = "checkbox";
          autoBox.checked = policy.selectionMode !== "manual";
          autoLabel.append(autoBox, document.createTextNode("Switch to the backup automatically when the main camera fails"));
          const failbackLabel = document.createElement("label");
          failbackLabel.className = "check";
          const failbackBox = document.createElement("input");
          failbackBox.type = "checkbox";
          failbackBox.checked = policy.failover.autoFailback;
          failbackLabel.append(failbackBox, document.createTextNode("Switch back to the main camera once it recovers"));
          const drillBtn = document.createElement("button");
          drillBtn.type = "button";
          drillBtn.className = "inline";
          drillBtn.textContent = "Check switch-over again";
          drillBtn.style.justifySelf = "start";
          drillBtn.disabled = setupLocked || !resource.enabled || !backup;
          drillBtn.onclick = async () => {
            drillBtn.disabled = true;
            await runFailoverDrill(resource.id, resource.label);
            await loadCommissioning();
            drillBtn.disabled = false;
          };
          const advancedNote = document.createElement("p");
          advancedNote.className = "muted";
          advancedNote.textContent = "A camera counts as failed after " + policy.failover.failureThreshold + " missed checks; it's trusted again after " + policy.failover.healthyThreshold + " good ones.";
          autoBox.disabled = failbackBox.disabled = setupLocked || !primary;
          advancedBody.append(autoLabel, failbackLabel, advancedNote, drillBtn);
          advanced.append(advancedSummary, advancedBody);
          card.appendChild(advanced);

          const save = async () => {
            if (setupLocked) return;
            if (backupSelect.value === primarySelect.value) backupSelect.value = "";
            syncBackupOptions();
            const chosen = [primarySelect.value, backupSelect.value].filter(Boolean);
            primarySelect.disabled = backupSelect.disabled = true;
            const saved = await savePolicy(resource.id, resource.label, {
              selectionMode: autoBox.checked ? "automatic" : "manual",
              autoFailback: failbackBox.checked,
              candidates: chosen.map((cameraId, index) => ({
                cameraId,
                priority: index + 1,
                captureModes: ["edge_buffer"],
                enabled: true,
              })),
            });
            if (saved && resource.enabled && chosen.length > 0) {
              await runFailoverDrill(resource.id, resource.label);
            }
            await loadResources();
            await loadCommissioning();
          };
          primarySelect.onchange = save;
          backupSelect.onchange = save;
          autoBox.onchange = save;
          failbackBox.onchange = save;

          if (removedCount > 0 && !setupLocked && primary && !autoCleanedResources.has(resource.id)) {
            autoCleanedResources.add(resource.id);
            // An unticked camera is still on this table's list; saving drops it
            // so later changes aren't rejected.
            void save();
          }
          fragment.appendChild(card);
        }
        if (generation === resourcesGeneration) {
          list.replaceChildren(fragment);
          // At least one table needs a camera; tables left empty simply won't record replays.
          workflow.tablesMapped = !resourcesData.needsConfig &&
            resourcesData.resources.length > unmappedTables;
          renderStages();
        }
      }

      async function savePolicy(resourceId, label, payload) {
        const message = document.getElementById("mapping-message");
        message.dataset.state = "checking";
        message.textContent = "Saving " + label + "…";
        try {
          await api("/api/setup/resources/" + resourceId + "/policy", {
            method: "PUT",
            body: JSON.stringify(payload),
          });
          message.dataset.state = "success";
          message.textContent = label + " saved.";
          return true;
        } catch (error) {
          message.dataset.state = "error";
          message.textContent = "Couldn't save " + label + ": " + error.message;
          return false;
        }
      }

      document.getElementById("camera-form")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.target;
        const payload = {
          nvrId: form.nvrId.value,
          channelKey: form.channelKey.value,
          label: form.label.value || undefined,
          streamProfile: form.streamProfile.value,
        };
        document.getElementById("camera-message").textContent = "Saving camera…";
        await api("/api/setup/cameras", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        form.channelKey.value = "";
        form.label.value = "";
        await loadCameras();
        document.getElementById("camera-message").textContent = "Camera saved.";
      });

      document.getElementById("nvr-form")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.target;
        const submitButton = document.getElementById("add-nvr-btn");
        const message = document.getElementById("nvr-message");
        const payload = {
          label: form.label.value,
          host: form.host.value,
          rtspPort: Number(form.rtspPort.value),
          username: form.username.value,
          password: form.password.value,
          testChannelKey: form.testChannelKey.value,
          vendor: form.vendor.value,
        };
        submitButton.disabled = true;
        submitButton.textContent = "Checking credentials…";
        message.dataset.state = "checking";
        message.textContent = "Connecting to the NVR and verifying the username and password…";
        try {
          const saved = await api("/api/setup/nvrs", {
            method: "POST",
            body: JSON.stringify(payload),
            timeoutMs: 25000,
          });
          form.password.value = "";
          message.dataset.state = "success";
          message.textContent = "Login accepted. Looking for cameras…";
          await loadNvrs();
          resumeFromSavedProgress = false;
          currentStage = 3;
          renderStages();
          // The scan shows its own progress; one toast at a time.
          message.textContent = "";
          try { await enumerateCameras(saved.nvr.id); }
          catch (error) { document.getElementById("camera-message").textContent = "NVR added. " + error.message + " Use Scan recorder again to retry."; }
        } catch (error) {
          message.dataset.state = "error";
          message.setAttribute("role", "alert");
          message.textContent = error.message;
          form.password.focus();
        } finally {
          submitButton.disabled = setupLocked;
          submitButton.textContent = "Verify & add NVR";
        }
      });

      // Finds recorders on the LAN and fills the form when one is picked.
      // var without an initializer: renderStages() runs before this line, and
      // re-initialising here would reset the flag and start a second search.
      var nvrSearchDone;
      var nvrSearchRunning;
      async function findRecordersOnNetwork() {
        const button = document.getElementById("find-nvrs-btn");
        const message = document.getElementById("find-nvrs-message");
        const results = document.getElementById("find-nvrs-results");
        if (!button || !message || !results || nvrSearchRunning) return;
        nvrSearchDone = true;
        nvrSearchRunning = true;
        button.disabled = true;
        message.dataset.state = "checking";
        message.textContent = "Looking for recorders on this network… (about 5 seconds)";
        results.innerHTML = "";
        try {
          const data = await api("/api/setup/nvrs/find-on-network", { method: "POST", body: "{}", timeoutMs: 45000 });
          const found = (data.recorders || []).filter((item) => item.rtspOpen || item.likelyRecorder);
          if (found.length === 0) {
            message.dataset.state = "error";
            message.textContent = "No recorders found. Check the NVR is powered on and plugged into the same router as this PC, or type its address below.";
            return;
          }
          message.dataset.state = "success";
          message.textContent = found.length === 1 ? "Found 1 device. Tap it to fill in the form." : "Found " + found.length + " devices. Tap the recorder to fill in the form.";
          const seenRecorders = new Set();
          for (const item of found) {
            const pick = document.createElement("button");
            pick.type = "button";
            pick.className = "secondary";
            pick.style.display = "block";
            pick.style.width = "100%";
            pick.style.textAlign = "left";
            pick.style.marginTop = "8px";
            const title = item.name || item.model || (item.likelyRecorder ? "Recorder" : "Video device");
            const detail = [item.host, item.model && item.model !== title ? item.model : null, item.likelyRecorder ? "recorder" : null, item.alreadyAdded ? "already added" : null]
              .filter(Boolean)
              .join(" · ");
            pick.textContent = title + " — " + detail;
            pick.disabled = item.alreadyAdded;
            pick.addEventListener("click", () => {
              const form = document.getElementById("nvr-form");
              form.host.value = item.host;
              form.rtspPort.value = String(item.rtspPort || 554);
              if (!form.label.value) form.label.value = item.name || "Main NVR";
              form.username.focus();
              const nvrMessage = document.getElementById("nvr-message");
              if (nvrMessage) {
                nvrMessage.dataset.state = "";
                nvrMessage.textContent = "Address filled in. Enter the NVR's username and password, then choose Verify & add NVR.";
              }
            });
            if (!seenRecorders.has(item.host + ":" + item.rtspPort)) results.appendChild(pick);
            seenRecorders.add(item.host + ":" + item.rtspPort);
          }
        } catch (error) {
          message.dataset.state = "error";
          message.textContent = error.message;
        } finally {
          button.disabled = false;
          nvrSearchRunning = false;
        }
      }
      document.getElementById("find-nvrs-btn")?.addEventListener("click", () => void findRecordersOnNetwork());

      document.getElementById("discover-btn")?.addEventListener("click", async () => {
        const form = document.getElementById("nvr-form");
        const payload = {
          host: form.host.value,
          rtspPort: Number(form.rtspPort.value),
        };
        const message = document.getElementById("nvr-message");
        message.dataset.state = "checking";
        message.textContent = "Checking whether this PC can reach the NVR…";
        try {
          const result = await api("/api/setup/nvrs/discover", {
            method: "POST",
            body: JSON.stringify(payload),
          });
          message.dataset.state = result.reachable ? "success" : "error";
          message.textContent = result.message + (result.reachable ? " This does not verify the username or password." : "");
        } catch (error) {
          message.dataset.state = "error";
          message.textContent = error.message;
        }
      });

      document.getElementById("lock-btn")?.addEventListener("click", async () => {
        const lockBtn = document.getElementById("lock-btn");
        lockBtn.disabled = true;
        setCompleteStatus("Locking setup…", true);
        try {
          await api("/api/setup/lock", { method: "POST", body: "{}" });
          setupLocked = true;
          document.getElementById("commissioning-complete").disabled = true;
          lockBtn.textContent = "Setup locked";
          setCompleteStatus("Setup locked. You can close this tab. VenueEdge keeps running.", false);
        } catch (error) {
          setCompleteStatus(error.message, false);
          lockBtn.disabled = setupLocked;
        }
      });

      async function pollSetupStatus() {
        try {
          const status = await api("/api/setup/status");
          if (status.enrollmentStatus !== initialEnrollmentStatus) {
            sessionStorage.setItem("venue-edge-stage", "1");
            window.location.reload();
            return;
          }
        } catch (error) {
          // The normal page actions surface session and connectivity errors.
        }
        setupStatusPollTimer = setTimeout(pollSetupStatus, 5000);
      }

      if (!setupLocked) {
        loadNvrs().catch((error) => {
          document.getElementById("nvr-message").textContent = error.message;
        });
        loadResources().catch((error) => {
          document.getElementById("mapping-message").textContent = error.message;
        });
        loadCommissioning().catch((error) => {
          document.getElementById("commissioning-message").textContent = error.message;
        });
      }
          if (new URLSearchParams(window.location.search).get("technician") === "1") {
            document.querySelectorAll("details").forEach((detail) => { detail.open = true; });
          }
          setupStatusPollTimer = setTimeout(pollSetupStatus, 5000);
        </script>
  </body>
</html>`
}
