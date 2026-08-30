import type { SetupEnrollmentStatus } from "./status"

export function renderSetupPage(input: {
  enrollmentStatus: SetupEnrollmentStatus
  setupLocked: boolean
  expiresAt: string | null
  setupToken: string
}): string {
  const statusLabel =
    input.enrollmentStatus === "enrolled"
      ? "Enrolled"
      : input.enrollmentStatus === "revoked"
        ? "Revoked"
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
      button, input, select, summary { min-height: 2.75rem; }
      button { border: 0; border-radius: 999px; padding: .7rem 1rem; font-weight: 650; cursor: pointer; }
      button:not(.secondary):not(.quiet) { background: var(--primary); color: var(--primary-ink); }
      button.secondary { border: 1px solid var(--border); background: var(--surface); color: var(--ink); }
      button.quiet { background: transparent; color: var(--muted); }
      button:disabled { cursor: not-allowed; opacity: .5; }
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
      .step { display: grid; grid-template-columns: 2rem 1fr; gap: var(--space-sm); align-items: center; padding: var(--space-sm); border-radius: var(--radius-md); color: var(--muted); }
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
      button.inline { margin: 0; border: 1px solid var(--border); background: var(--surface); color: var(--ink); }
      .nvr-item, .camera-item, .resource-item { padding: var(--space-md) 0; border-top: 1px solid var(--border); }
      .badge { display: inline-flex; border-radius: 999px; padding: .15rem .5rem; background: var(--surface-soft); color: var(--muted); font-size: .8rem; }
      pre { white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; }
      details { margin-top: var(--space-lg); border-top: 1px solid var(--border); padding-top: var(--space-md); }
      summary { cursor: pointer; display: flex; align-items: center; font-weight: 650; }
      .review { margin: var(--space-lg) 0; padding: var(--space-lg); border: 1px solid #e3b35d; border-radius: var(--radius-lg); background: #fff9ed; }
      .review[data-empty="true"] { border-color: #bfe4cf; background: #f1fbf5; }
      .review-list { margin: var(--space-md) 0 0; padding-left: 1.25rem; }
      .footer-actions { position: fixed; right: 0; bottom: 0; left: 17rem; display: flex; justify-content: space-between; gap: var(--space-md); padding: var(--space-md) var(--space-xl) max(var(--space-md), env(safe-area-inset-bottom)); border-top: 1px solid var(--border); background: color-mix(in srgb, var(--surface) 96%, transparent); }
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
      @media (max-width: 560px) { .row { grid-template-columns: 1fr; } h2 { font-size: 1.45rem; } }
      @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; } }
    </style>
  </head>
  <body>
    <div class="shell">
      <aside class="rail" aria-label="Setup progress">
        <div class="brand"><strong>PlayTT</strong><span>VenueEdge</span></div>
        <ol class="steps">
          ${["Pair device", "Add NVR", "Review cameras", "Map tables", "Publish config", "Commission"].map((label, index) => `<li class="step" data-step-item="${index + 1}" data-state="upcoming"><span class="step-dot">${index + 1}</span><span>${label}<small>Not started</small></span></li>`).join("")}
        </ol>
        <div class="rail-footer"><p class="muted">Setup stays local. NVR passwords never leave this PC.</p></div>
      </aside>
      <div class="workspace">
        <header class="topbar">
          <div><h1>VenueEdge setup</h1><p class="muted">${lockState} ${expiresCopy}</p></div>
          <span class="status">${statusLabel}</span>
        </header>
        <main>
          <section class="stage" data-stage="1">
            <div class="stage-intro"><h2>Pair this venue PC</h2><p class="muted">Connect VenueEdge to the correct PlayTT venue before adding equipment.</p></div>
            <div class="panel">
              ${input.enrollmentStatus === "enrolled" ? `<h3>Paired with PlayTT</h3><p class="muted">This PC has protected device credentials and is ready for equipment setup.</p>` : `<form id="enrollment-form"><label>One-time pairing code<input name="pairingCode" autocomplete="one-time-code" required maxlength="32" ${disabledAttr} /></label><div class="actions"><button type="submit" ${disabledAttr}>Pair this VenueEdge</button></div></form>`}
              <p id="enrollment-message" class="muted" aria-live="polite"></p>
            </div>
          </section>

          <section class="stage" data-stage="2" hidden>
            <div class="stage-intro"><h2>Add the venue NVR</h2><p class="muted">Enter the recorder on this venue network. We prevent the same host and RTSP port from being added twice.</p></div>
            <form id="nvr-form" class="panel">
              <label>Recorder name<input name="label" placeholder="Main NVR" required ${disabledAttr} /></label>
              <div class="row"><label>Host or IP address<input name="host" placeholder="192.168.0.240" required ${disabledAttr} /></label><label>RTSP port<input name="rtspPort" type="number" value="554" required ${disabledAttr} /></label></div>
              <div class="row"><label>Username<input name="username" required ${disabledAttr} /></label><label>Password<input name="password" type="password" required ${disabledAttr} /></label></div>
              <details><summary>Technician details</summary><div class="row"><label>Test channel<input name="testChannelKey" value="1" ${disabledAttr} /></label><label>Vendor<select name="vendor" ${disabledAttr}><option value="vigi">VIGI</option></select></label></div></details>
              <div class="actions"><button type="submit" ${disabledAttr}>Add NVR</button><button type="button" id="discover-btn" class="secondary" ${disabledAttr}>Test reachability</button></div>
              <p id="nvr-message" class="muted" aria-live="polite"></p>
              <div id="nvr-list"></div>
            </form>
          </section>

          <section class="stage" data-stage="3" hidden>
            <div class="stage-intro"><h2>Review cameras</h2><p class="muted">Scan every channel, keep valid video sources, and review duplicates before anything is removed.</p></div>
            <div id="topology-review" class="review" aria-live="polite"><strong>Checking topology…</strong></div>
            <form id="camera-form" class="panel">
              <h3>Add a channel manually</h3>
              <div class="row"><label>NVR<select name="nvrId" id="camera-nvr-select" required ${disabledAttr}></select></label><label>Channel<input name="channelKey" placeholder="1" required ${disabledAttr} /></label></div>
              <div class="row"><label>Camera name<input name="label" placeholder="Table 1 main" ${disabledAttr} /></label><label>Stream<select name="streamProfile" ${disabledAttr}><option value="main">Main</option><option value="sub">Sub</option></select></label></div>
              <div class="actions"><button type="submit" class="secondary" ${disabledAttr}>Add camera manually</button></div>
              <p id="camera-message" class="muted" aria-live="polite"></p><div id="camera-list"></div>
            </form>
          </section>

          <section class="stage" data-stage="4" hidden>
            <div class="stage-intro"><h2>Map cameras to tables</h2><p class="muted">Choose the primary and fallback camera for each PlayTT table, then verify failover.</p></div>
            <div class="panel"><p id="mapping-config-hint" class="muted"></p><div id="resource-list"></div><p id="mapping-message" class="muted" aria-live="polite"></p></div>
          </section>

          <section class="stage" data-stage="5" hidden>
            <div class="stage-intro"><h2>Publish configuration</h2><p class="muted">Test enabled cameras and send a credential-free topology snapshot to PlayTT. 15-second previews are recommended, not required to continue.</p></div>
            <div class="panel"><pre id="commissioning-checklist" class="muted"></pre><div class="actions"><button type="button" id="commissioning-test-all" class="secondary" ${disabledAttr}>Test enabled cameras</button><button type="button" id="commissioning-publish" ${disabledAttr}>Publish snapshot</button></div><video id="commissioning-preview" controls></video><p id="commissioning-message" class="muted" aria-live="polite"></p></div>
          </section>

          <section class="stage" data-stage="6" hidden>
            <div class="stage-intro"><h2>Complete commissioning</h2><p class="muted">Finish after cameras are tested and the snapshot is published. Cloud configuration can apply later in the background.</p></div>
            <div class="panel"><h3>Final readiness check</h3><pre id="commissioning-final-checklist" class="muted"></pre><div class="actions"><button type="button" id="commissioning-complete" ${disabledAttr}>Complete commissioning</button><button type="button" id="lock-btn" class="secondary" ${disabledAttr}>Lock setup and close</button></div><p class="muted busy-row" aria-live="polite"><span id="complete-spinner" class="spinner" hidden></span><span id="complete-status"></span></p></div>
          </section>
        </main>
        <nav class="footer-actions" aria-label="Stage navigation"><button id="stage-back" type="button" class="secondary">Back</button><button id="stage-next" type="button">Continue</button></nav>
      </div>
    </div>

    <script>
      const token = ${JSON.stringify(input.setupToken)};
      const setupLocked = ${JSON.stringify(input.setupLocked)};
      const workflow = {
        enrolled: ${JSON.stringify(input.enrollmentStatus === "enrolled")},
        nvrCount: 0,
        cameraCount: 0,
        topologyClean: false,
        failoverReady: false,
        published: false,
        completed: false,
      };
      let currentStage = Math.min(6, Math.max(1, Number(sessionStorage.getItem("venue-edge-stage") || (workflow.enrolled ? 2 : 1))));
      let topologyProposal = null;

      function setCompleteStatus(text, spinning) {
        const status = document.getElementById("complete-status");
        const spinner = document.getElementById("complete-spinner");
        if (status) status.textContent = text;
        if (spinner) spinner.hidden = !spinning;
      }

      function stageComplete(stage) {
        if (stage === 1) return workflow.enrolled;
        if (stage === 2) return workflow.nvrCount > 0;
        if (stage === 3) return workflow.cameraCount > 0 && workflow.topologyClean;
        if (stage === 4) return workflow.failoverReady;
        if (stage === 5) return workflow.published;
        return workflow.completed;
      }

      function renderStages() {
        document.querySelectorAll("[data-stage]").forEach((section) => {
          section.hidden = Number(section.dataset.stage) !== currentStage;
        });
        document.querySelectorAll("[data-step-item]").forEach((item) => {
          const step = Number(item.dataset.stepItem);
          const state = step === currentStage ? "current" : stageComplete(step) ? "complete" : "upcoming";
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
        next.textContent = stageComplete(currentStage) ? "Continue" : "Review requirements";
        sessionStorage.setItem("venue-edge-stage", String(currentStage));
        window.scrollTo({ top: 0, behavior: "smooth" });
      }

      document.getElementById("stage-back")?.addEventListener("click", () => {
        currentStage = Math.max(1, currentStage - 1);
        renderStages();
      });
      document.getElementById("stage-next")?.addEventListener("click", () => {
        if (!stageComplete(currentStage)) {
          const messageId = currentStage === 2 ? "nvr-message" : currentStage === 3 ? "camera-message" : currentStage === 4 ? "mapping-message" : currentStage === 6 ? "complete-status" : "commissioning-message";
          const message = document.getElementById(messageId);
          if (message) message.textContent = "Finish the requirements in this step before continuing.";
          return;
        }
        currentStage = Math.min(6, currentStage + 1);
        renderStages();
      });

      async function loadTopologyReview() {
        const data = await api("/api/setup/topology/review");
        topologyProposal = data.proposal;
        const review = document.getElementById("topology-review");
        workflow.topologyClean = topologyProposal.issues.length === 0;
        review.dataset.empty = String(workflow.topologyClean);
        if (workflow.topologyClean) {
          review.innerHTML = "<strong>Topology looks good</strong><p>No duplicate recorders or suspicious camera channels need review.</p>";
          renderStages();
          return;
        }

        const selectedCount = topologyProposal.deleteNvrIds.length + topologyProposal.deleteCameraIds.length + topologyProposal.renames.length;
        review.innerHTML =
          "<strong>We found setup issues</strong>" +
          "<p>Review the proposed changes. Nothing is removed until you confirm.</p>" +
          "<ul class='review-list'>" +
          topologyProposal.issues.map((issue) => "<li>" + issue.message + "</li>").join("") +
          "</ul>" +
          (selectedCount > 0
            ? "<div class='actions'><button type='button' id='apply-topology-review'>Review " + selectedCount + " changes</button></div>"
            : "<p><strong>Manual review required.</strong> Resolve enabled or mapped conflicts before cleanup.</p>");

        document.getElementById("apply-topology-review")?.addEventListener("click", async (event) => {
          const button = event.currentTarget;
          if (button.dataset.confirmed !== "true") {
            button.dataset.confirmed = "true";
            button.textContent = "Confirm reviewed cleanup";
            return;
          }
          button.disabled = true;
          button.textContent = "Applying cleanup…";
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
            document.getElementById("camera-message").textContent = "Reviewed cleanup applied. Publish a new snapshot when the remaining cameras are ready.";
          } catch (error) {
            button.disabled = false;
            button.dataset.confirmed = "false";
            button.textContent = "Review changes again";
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
        const response = await fetch(path, { ...options, headers });
        const text = await response.text();
        const body = text ? JSON.parse(text) : null;
        if (!response.ok) {
          throw new Error(body?.error || body?.message || "Request failed (" + response.status + ")");
        }
        return body;
      }

      function formatTestSummary(lastTest) {
        if (!lastTest) return "Not tested yet.";
        const checks = lastTest.checks
          .map((c) => (c.passed ? "✓" : "✗") + " " + c.message)
          .join("\\n");
        return lastTest.passed
          ? "Last test passed.\\n" + checks
          : "Last test failed.\\n" + checks;
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

      async function loadNvrs() {
        const data = await api("/api/setup/nvrs");
        workflow.nvrCount = data.nvrs.length;
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
          item.innerHTML =
            "<strong>" + nvr.label + "</strong> " +
            "<span class='badge'>" + (nvr.enabled ? "enabled" : "disabled") + "</span><br>" +
            nvr.host + ":" + nvr.rtspPort + " · " + nvr.username +
            " · key " + nvr.localConnectionKey +
            (nvr.hasPassword ? "" : " · <em>no password</em>") +
            "<pre class='muted'>" + formatTestSummary(nvr.lastTest) + "</pre>";
          if (!setupLocked) {
            const testBtn = document.createElement("button");
            testBtn.textContent = "Run test";
            testBtn.className = "inline";
            testBtn.onclick = () => testNvr(nvr.id);
            const enumerateBtn = document.createElement("button");
            enumerateBtn.textContent = "Enumerate cameras";
            enumerateBtn.className = "inline";
            enumerateBtn.onclick = () => enumerateCameras(nvr.id);
            const disableBtn = document.createElement("button");
            disableBtn.textContent = nvr.enabled ? "Disable" : "Enable";
            disableBtn.className = "inline";
            disableBtn.onclick = () => toggleNvr(nvr);
            const deleteBtn = document.createElement("button");
            deleteBtn.textContent = "Remove";
            deleteBtn.className = "inline";
            deleteBtn.onclick = () => removeNvr(nvr.id);
            item.append(testBtn, enumerateBtn, disableBtn, deleteBtn);
          }
          list.appendChild(item);
        }
        await loadCameras();
        renderStages();
      }

      async function testNvr(id) {
        document.getElementById("nvr-message").textContent = "Running NVR tests…";
        await api("/api/setup/nvrs/" + id + "/test", { method: "POST", body: "{}" });
        await loadNvrs();
        document.getElementById("nvr-message").textContent = "Test finished.";
      }

      async function toggleNvr(nvr) {
        await api("/api/setup/nvrs/" + nvr.id, {
          method: "PATCH",
          body: JSON.stringify({ enabled: !nvr.enabled }),
        });
        await loadNvrs();
      }

      async function removeNvr(id) {
        await api("/api/setup/nvrs/" + id, { method: "DELETE", body: "{}" });
        await loadNvrs();
      }

      async function enumerateCameras(nvrId) {
        document.getElementById("camera-message").textContent = "Enumerating channels…";
        const result = await api("/api/setup/nvrs/" + nvrId + "/cameras/enumerate", {
          method: "POST",
          body: "{}",
        });
        await loadCameras();
        document.getElementById("camera-message").textContent =
          "Scan finished. Probed " + result.probed + " channel(s): " +
          result.created.length + " added, " + result.updated.length + " refreshed, " +
          result.unavailable.length + " unavailable.";
      }

      async function loadCameras() {
        const data = await api("/api/setup/cameras");
        workflow.cameraCount = data.cameras.length;
        const list = document.getElementById("camera-list");
        list.innerHTML = "";
        for (const camera of data.cameras) {
          const item = document.createElement("div");
          item.className = "camera-item";
          item.innerHTML =
            "<strong>" + camera.label + "</strong> " +
            "<span class='badge'>" + (camera.enabled ? "capture enabled" : "capture disabled") + "</span><br>" +
            camera.nvrLabel + " · ch " + camera.channelKey + " · " + camera.streamProfile +
            " · " + camera.codec +
            (camera.healthStatus ? " · health " + camera.healthStatus : "") +
            "<pre class='muted'>" + formatTestSummary(camera.lastTest) + "</pre>";
          if (!setupLocked) {
            const testBtn = document.createElement("button");
            testBtn.textContent = "Test camera";
            testBtn.className = "inline";
            testBtn.onclick = () => testCamera(camera.id);
            const previewBtn = document.createElement("button");
            previewBtn.textContent = "Capture 15s preview";
            previewBtn.className = "inline";
            previewBtn.onclick = () => capturePreview(camera.id);
            const enableBtn = document.createElement("button");
            enableBtn.textContent = camera.enabled ? "Disable capture" : "Enable capture";
            enableBtn.className = "inline";
            enableBtn.onclick = () => toggleCamera(camera);
            const deleteBtn = document.createElement("button");
            deleteBtn.textContent = "Remove";
            deleteBtn.className = "inline";
            deleteBtn.onclick = () => removeCamera(camera.id);
            item.append(testBtn, previewBtn, enableBtn, deleteBtn);
          }
          list.appendChild(item);
        }
        await loadTopologyReview();
        renderStages();
      }

      async function testCamera(id) {
        document.getElementById("camera-message").textContent = "Running camera test…";
        await api("/api/setup/cameras/" + id + "/test", { method: "POST", body: "{}" });
        await loadCameras();
        await loadCommissioning();
        document.getElementById("camera-message").textContent = "Camera test finished.";
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
          (checklist.allEnabledCamerasTested ? "✓" : "○") + " All enabled cameras tested",
          (checklist.allEnabledCamerasPreviewed ? "✓" : "○") + " 15-second previews captured",
          (checklist.failoverReady ? "✓" : "○") + " Failover drills complete",
          (checklist.enrolled ? "✓" : "○") + " Paired with PlayTT",
          (checklist.published ? "✓" : "○") + " Snapshot published",
          (checklist.configApplied ? "✓" : "○") + " Cloud configuration applied locally",
          (checklist.completed ? "✓" : "○") + " Commissioning complete",
        ];
        if (checklist.blockingReasons.length > 0) {
          lines.push("Required:\\n" + checklist.blockingReasons.join("\\n"));
        }
        if (checklist.recommendedReasons && checklist.recommendedReasons.length > 0) {
          lines.push("Recommended:\\n" + checklist.recommendedReasons.join("\\n"));
        }
        workflow.enrolled = checklist.enrolled;
        workflow.failoverReady = checklist.failoverReady;
        workflow.published = checklist.published;
        workflow.completed = checklist.completed;
        document.getElementById("commissioning-checklist").textContent = lines.join("\\n");
        document.getElementById("commissioning-final-checklist").textContent = lines.join("\\n");
        document.getElementById("commissioning-complete").disabled =
          setupLocked || !checklist.canComplete;
        if (checklist.completed) {
          setCompleteStatus(
            checklist.configApplied
              ? "Commissioning complete. Cloud configuration is applied locally."
              : "Commissioning complete. Cloud configuration will apply when PlayTT publishes it — you can lock setup now.",
            false,
          );
        }
        renderStages();
      }

      async function runFailoverDrill(resourceId) {
        document.getElementById("mapping-message").textContent = "Running failover drill…";
        await api("/api/setup/resources/" + resourceId + "/failover-drill", {
          method: "POST",
          body: "{}",
        });
        await loadResources();
        await loadCommissioning();
        document.getElementById("mapping-message").textContent = "Failover drill finished.";
      }

      document.getElementById("commissioning-test-all")?.addEventListener("click", async () => {
        document.getElementById("commissioning-message").textContent = "Testing enabled cameras…";
        await api("/api/setup/commissioning/test-enabled", { method: "POST", body: "{}" });
        await loadCameras();
        await loadCommissioning();
        document.getElementById("commissioning-message").textContent = "Enabled camera tests finished.";
      });

      document.getElementById("commissioning-publish")?.addEventListener("click", async () => {
        document.getElementById("commissioning-message").textContent = "Publishing snapshot…";
        try {
          await api("/api/setup/commissioning/publish", { method: "POST", body: "{}" });
          await loadCommissioning();
          document.getElementById("commissioning-message").textContent = "Snapshot published.";
        } catch (error) {
          document.getElementById("commissioning-message").textContent = error.message;
        }
      });

      document.getElementById("commissioning-complete")?.addEventListener("click", async () => {
        const completeBtn = document.getElementById("commissioning-complete");
        completeBtn.disabled = true;
        completeBtn.dataset.busy = "true";
        setCompleteStatus("Publishing final snapshot to PlayTT…", true);
        try {
          await api("/api/setup/commissioning/complete", { method: "POST", body: "{}" });
          setCompleteStatus("Snapshot accepted. Refreshing local checklist…", true);
          await loadCommissioning();
        } catch (error) {
          setCompleteStatus(error.message, false);
          completeBtn.disabled = setupLocked;
        } finally {
          completeBtn.dataset.busy = "false";
        }
      });

      async function toggleCamera(camera) {
        await api("/api/setup/cameras/" + camera.id, {
          method: "PATCH",
          body: JSON.stringify({ enabled: !camera.enabled }),
        });
        await loadCameras();
        await loadResources();
      }

      async function removeCamera(id) {
        await api("/api/setup/cameras/" + id, { method: "DELETE", body: "{}" });
        await loadCameras();
        await loadResources();
      }

      async function loadResources() {
        const resourcesData = await api("/api/setup/resources");
        const hint = document.getElementById("mapping-config-hint");
        if (resourcesData.needsConfig) {
          hint.textContent =
            "Mapping needs pairing and a published venue Config v2 with authorized resources.";
        } else {
          hint.textContent = "";
        }

        const camerasData = await api("/api/setup/cameras");
        const enabledCameras = camerasData.cameras.filter((c) => c.enabled);
        const list = document.getElementById("resource-list");
        list.innerHTML = "";

        for (const resource of resourcesData.resources) {
          const item = document.createElement("div");
          item.className = "resource-item";
          item.innerHTML =
            "<strong>" + resource.label + "</strong> " +
            "<span class='badge'>" + (resource.enabled ? "enabled" : "disabled") + "</span>";

          const policyData = await api("/api/setup/resources/" + resource.id + "/policy");
          const policy = policyData.policy;
          let liveCandidates = policy.candidates.map((c) => ({
            cameraId: c.cameraId,
            priority: c.priority,
            captureModes: c.captureModes,
            enabled: c.enabled,
            cameraLabel: c.cameraLabel,
          }));

          const warnings = policy.warnings
            .map((w) => w.code + ": " + w.message)
            .join("\\n");

          function renderCandidatesText() {
            return liveCandidates
              .map(
                (c, index) =>
                  (index + 1) + ". " + (c.cameraLabel || c.cameraId) +
                  " (prio " + c.priority + ", " + c.captureModes.join(", ") + ")",
              )
              .join("\\n");
          }

          const detail = document.createElement("pre");
          detail.className = "muted";
          detail.textContent =
            "Mode: " + policy.selectionMode +
            " · failback " + (policy.failover.autoFailback ? "on" : "off") +
            "\\nCandidates:\\n" + (renderCandidatesText() || "none") +
            (warnings ? "\\nWarnings:\\n" + warnings : "");

          item.appendChild(detail);

          const candidateControls = document.createElement("div");

          function renumberCandidates(candidates) {
            return candidates.map((candidate, index) => ({
              ...candidate,
              priority: index + 1,
            }));
          }

          function renderCandidateControls() {
            candidateControls.innerHTML = "";
            liveCandidates.forEach((candidate, index) => {
              const row = document.createElement("div");
              row.className = "camera-item";
              row.textContent =
                (index + 1) + ". " + (candidate.cameraLabel || candidate.cameraId);
              if (!setupLocked) {
                const upBtn = document.createElement("button");
                upBtn.textContent = "Move up";
                upBtn.className = "inline";
                upBtn.disabled = index === 0;
                upBtn.onclick = async () => {
                  const next = [...liveCandidates];
                  const [entry] = next.splice(index, 1);
                  next.splice(index - 1, 0, entry);
                  liveCandidates = renumberCandidates(next);
                  renderCandidateControls();
                  detail.textContent =
                    "Mode: " + modeSelect.value +
                    " · failback " + (failbackCheck.checked ? "on" : "off") +
                    "\\nCandidates:\\n" + (renderCandidatesText() || "none") +
                    (warnings ? "\\nWarnings:\\n" + warnings : "");
                  await savePolicy(resource.id, {
                    selectionMode: modeSelect.value,
                    autoFailback: failbackCheck.checked,
                    candidates: liveCandidates.map((c) => ({
                      cameraId: c.cameraId,
                      priority: c.priority,
                      captureModes: c.captureModes,
                      enabled: c.enabled,
                    })),
                  });
                };
                const downBtn = document.createElement("button");
                downBtn.textContent = "Move down";
                downBtn.className = "inline";
                downBtn.disabled = index === liveCandidates.length - 1;
                downBtn.onclick = async () => {
                  const next = [...liveCandidates];
                  const [entry] = next.splice(index, 1);
                  next.splice(index + 1, 0, entry);
                  liveCandidates = renumberCandidates(next);
                  renderCandidateControls();
                  detail.textContent =
                    "Mode: " + modeSelect.value +
                    " · failback " + (failbackCheck.checked ? "on" : "off") +
                    "\\nCandidates:\\n" + (renderCandidatesText() || "none") +
                    (warnings ? "\\nWarnings:\\n" + warnings : "");
                  await savePolicy(resource.id, {
                    selectionMode: modeSelect.value,
                    autoFailback: failbackCheck.checked,
                    candidates: liveCandidates.map((c) => ({
                      cameraId: c.cameraId,
                      priority: c.priority,
                      captureModes: c.captureModes,
                      enabled: c.enabled,
                    })),
                  });
                };
                row.append(upBtn, downBtn);
              }
              candidateControls.appendChild(row);
            });
          }

          if (!setupLocked) {
            const modeSelect = document.createElement("select");
            modeSelect.innerHTML =
              "<option value='automatic'>automatic</option><option value='manual'>manual</option>";
            modeSelect.value = policy.selectionMode;
            const failbackCheck = document.createElement("input");
            failbackCheck.type = "checkbox";
            failbackCheck.checked = policy.failover.autoFailback;
            const cameraSelect = document.createElement("select");
            const mappableCameras = camerasData.cameras.filter((c) => c.enabled);
            const cameraPool =
              mappableCameras.length > 0 ? mappableCameras : camerasData.cameras;
            if (cameraPool.length === 0) {
              const empty = document.createElement("option");
              empty.value = "";
              empty.textContent = "No cameras yet — enable capture on a camera above";
              cameraSelect.appendChild(empty);
              cameraSelect.disabled = true;
            } else {
              for (const camera of cameraPool) {
                const opt = document.createElement("option");
                opt.value = camera.id;
                opt.textContent =
                  camera.label +
                  " (" +
                  camera.nvrLabel +
                  ")" +
                  (camera.enabled ? "" : " — capture disabled");
                opt.disabled = !camera.enabled;
                cameraSelect.appendChild(opt);
              }
            }
            if (mappableCameras.length === 0) {
              const help = document.createElement("p");
              help.className = "muted";
              help.textContent =
                "Enable capture on ch1 (or another H.264 camera) in the Cameras section, then reload this page.";
              item.appendChild(help);
            }
            const addBtn = document.createElement("button");
            addBtn.textContent = "Add candidate";
            addBtn.className = "inline";
            addBtn.disabled = mappableCameras.length === 0;
            addBtn.onclick = async () => {
              if (!cameraSelect.value) {
                return;
              }
              const nextPriority =
                liveCandidates.length === 0
                  ? 1
                  : Math.max(...liveCandidates.map((c) => c.priority)) + 1;
              liveCandidates = renumberCandidates([
                ...liveCandidates,
                {
                  cameraId: cameraSelect.value,
                  priority: nextPriority,
                  captureModes: ["edge_buffer"],
                  enabled: true,
                  cameraLabel:
                    camerasData.cameras.find((c) => c.id === cameraSelect.value)
                      ?.label ?? cameraSelect.value,
                },
              ]);
              renderCandidateControls();
              detail.textContent =
                "Mode: " + modeSelect.value +
                " · failback " + (failbackCheck.checked ? "on" : "off") +
                "\\nCandidates:\\n" + (renderCandidatesText() || "none") +
                (warnings ? "\\nWarnings:\\n" + warnings : "");
              await savePolicy(resource.id, {
                selectionMode: modeSelect.value,
                autoFailback: failbackCheck.checked,
                candidates: liveCandidates.map((c) => ({
                  cameraId: c.cameraId,
                  priority: c.priority,
                  captureModes: c.captureModes,
                  enabled: c.enabled,
                })),
              });
            };
            const saveBtn = document.createElement("button");
            saveBtn.textContent = "Save policy";
            saveBtn.className = "inline";
            saveBtn.onclick = async () => {
              await savePolicy(resource.id, {
                selectionMode: modeSelect.value,
                autoFailback: failbackCheck.checked,
                candidates: liveCandidates.map((c) => ({
                  cameraId: c.cameraId,
                  priority: c.priority,
                  captureModes: c.captureModes,
                  enabled: c.enabled,
                })),
              });
            };
            const drillBtn = document.createElement("button");
            drillBtn.textContent = "Run failover drill";
            drillBtn.className = "inline";
            drillBtn.onclick = () => runFailoverDrill(resource.id);
            renderCandidateControls();
            item.append(
              candidateControls,
              modeSelect,
              failbackCheck,
              cameraSelect,
              addBtn,
              saveBtn,
              drillBtn,
            );
          }

          list.appendChild(item);
        }
      }

      async function savePolicy(resourceId, payload) {
        document.getElementById("mapping-message").textContent = "Saving mapping…";
        await api("/api/setup/resources/" + resourceId + "/policy", {
          method: "PUT",
          body: JSON.stringify({
            ...payload,
            failureThreshold: 3,
            cooldownSeconds: 60,
            healthyThreshold: 2,
          }),
        });
        await loadResources();
        document.getElementById("mapping-message").textContent = "Mapping saved.";
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
        const payload = {
          label: form.label.value,
          host: form.host.value,
          rtspPort: Number(form.rtspPort.value),
          username: form.username.value,
          password: form.password.value,
          testChannelKey: form.testChannelKey.value,
          vendor: form.vendor.value,
        };
        document.getElementById("nvr-message").textContent = "Saving NVR…";
        await api("/api/setup/nvrs", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        form.password.value = "";
        await loadNvrs();
        document.getElementById("nvr-message").textContent = "NVR saved.";
      });

      document.getElementById("discover-btn")?.addEventListener("click", async () => {
        const form = document.getElementById("nvr-form");
        const payload = {
          host: form.host.value,
          rtspPort: Number(form.rtspPort.value),
        };
        const result = await api("/api/setup/nvrs/discover", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        document.getElementById("nvr-message").textContent = result.message;
      });

      document.getElementById("lock-btn")?.addEventListener("click", async () => {
        const lockBtn = document.getElementById("lock-btn");
        lockBtn.disabled = true;
        setCompleteStatus("Locking setup…", true);
        try {
          await api("/api/setup/lock", { method: "POST", body: "{}" });
          setCompleteStatus("Setup locked. You can close this tab. VenueEdge keeps running.", false);
        } catch (error) {
          setCompleteStatus(error.message, false);
          lockBtn.disabled = setupLocked;
        }
      });

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
    </script>
  </body>
</html>`
}
