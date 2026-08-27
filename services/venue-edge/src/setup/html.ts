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
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>VenueEdge setup</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: system-ui, sans-serif;
        line-height: 1.5;
      }
      body {
        margin: 2rem auto;
        max-width: 48rem;
        padding: 0 1rem;
      }
      h1 { margin-bottom: 0.25rem; }
      h2 { margin-top: 0; font-size: 1.1rem; }
      .muted { color: #666; }
      .card {
        border: 1px solid #ccc;
        border-radius: 8px;
        padding: 1rem;
        margin-top: 1rem;
      }
      label { display: block; margin-top: 0.5rem; font-size: 0.9rem; }
      input, select {
        width: 100%;
        box-sizing: border-box;
        padding: 0.4rem;
        margin-top: 0.25rem;
      }
      .row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
      button {
        margin-top: 0.75rem;
        padding: 0.5rem 1rem;
        cursor: pointer;
      }
      button.inline { margin-top: 0; margin-right: 0.5rem; }
      #message, #nvr-message, #camera-message, #mapping-message, #commissioning-message { margin-top: 0.75rem; }
      .nvr-item, .camera-item, .resource-item {
        border-top: 1px solid #ddd;
        padding-top: 0.75rem;
        margin-top: 0.75rem;
      }
      .badge { font-size: 0.85rem; }
    </style>
  </head>
  <body>
    <h1>VenueEdge setup</h1>
    <p class="muted">Local loopback wizard for venue-edge commissioning.</p>
    <div class="card">
      <p><strong>Enrollment:</strong> ${statusLabel}</p>
      <p>${lockState}</p>
      <p class="muted">${expiresCopy}</p>
      <button id="lock-btn" type="button" ${disabledAttr}>
        Lock setup and close wizard
      </button>
      <p id="message" class="muted"></p>
    </div>

    ${input.enrollmentStatus === "enrolled" ? "" : `
    <div class="card">
      <h2>Connect to PlayTT</h2>
      <p class="muted">Create a one-time pairing code at PlayTT /nvr, then enter it here. Long-lived device credentials stay in protected local storage.</p>
      <form id="enrollment-form">
        <label>Pairing code<input name="pairingCode" autocomplete="one-time-code" required maxlength="32" ${disabledAttr} /></label>
        <button type="submit" ${disabledAttr}>Pair this VenueEdge</button>
      </form>
      <p id="enrollment-message" class="muted"></p>
    </div>`}

    <div class="card">
      <h2>NVR connections</h2>
      <p class="muted">Add VIGI NVRs on the venue LAN. Passwords stay in protected local storage.</p>

      <form id="nvr-form">
        <label>Label<input name="label" required ${disabledAttr} /></label>
        <div class="row">
          <label>Host<input name="host" placeholder="192.168.0.240" required ${disabledAttr} /></label>
          <label>RTSP port<input name="rtspPort" type="number" value="554" required ${disabledAttr} /></label>
        </div>
        <div class="row">
          <label>Username<input name="username" required ${disabledAttr} /></label>
          <label>Password<input name="password" type="password" required ${disabledAttr} /></label>
        </div>
        <div class="row">
          <label>Test channel<input name="testChannelKey" value="1" ${disabledAttr} /></label>
          <label>Vendor<select name="vendor" ${disabledAttr}><option value="vigi">VIGI</option></select></label>
        </div>
        <button type="submit" ${disabledAttr}>Add NVR</button>
        <button type="button" id="discover-btn" class="inline" ${disabledAttr}>Test reachability</button>
      </form>
      <p id="nvr-message" class="muted"></p>
      <div id="nvr-list"></div>
    </div>

    <div class="card">
      <h2>Cameras</h2>
      <p class="muted">Enumerate or manually add channels per NVR. Enable capture only for selected cameras.</p>

      <form id="camera-form">
        <div class="row">
          <label>NVR<select name="nvrId" id="camera-nvr-select" required ${disabledAttr}></select></label>
          <label>Channel<input name="channelKey" placeholder="1" required ${disabledAttr} /></label>
        </div>
        <div class="row">
          <label>Label<input name="label" placeholder="Court 1 main" ${disabledAttr} /></label>
          <label>Stream<select name="streamProfile" ${disabledAttr}>
            <option value="main">main</option>
            <option value="sub">sub</option>
          </select></label>
        </div>
        <button type="submit" ${disabledAttr}>Add camera manually</button>
      </form>
      <p id="camera-message" class="muted"></p>
      <div id="camera-list"></div>
    </div>

    <div class="card">
      <h2>Resource mapping</h2>
      <p class="muted">Map enabled cameras to authorized PlayTT resources with ordered failover.</p>
      <p id="mapping-config-hint" class="muted"></p>
      <div id="resource-list"></div>
      <p id="mapping-message" class="muted"></p>
    </div>

    <div class="card">
      <h2>Commissioning</h2>
      <p class="muted">
        Test every enabled camera, capture a 15-second local preview, run failover drills,
        then publish a redacted snapshot and complete commissioning before production capture.
      </p>
      <p class="muted">
        <strong>Clock skew:</strong> sync NTP on the NVR.
        <strong>Wave test:</strong> wave at the camera during the 15-second preview clip to confirm live video.
      </p>
      <pre id="commissioning-checklist" class="muted"></pre>
      <button type="button" id="commissioning-test-all" ${disabledAttr}>Test all enabled cameras</button>
      <button type="button" id="commissioning-publish" class="inline" ${disabledAttr}>Publish snapshot</button>
      <button type="button" id="commissioning-complete" class="inline" ${disabledAttr}>Complete commissioning</button>
      <video id="commissioning-preview" controls style="max-width:100%; margin-top:1rem; display:none;"></video>
      <p id="commissioning-message" class="muted"></p>
    </div>

    <script>
      const token = ${JSON.stringify(input.setupToken)};
      const setupLocked = ${JSON.stringify(input.setupLocked)};

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
          throw new Error(body?.error || "Request failed (" + response.status + ")");
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
          "Enumeration finished. Created " + result.created.length + " camera(s).";
      }

      async function loadCameras() {
        const data = await api("/api/setup/cameras");
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
          (checklist.completed ? "✓" : "○") + " Commissioning complete",
        ];
        if (checklist.blockingReasons.length > 0) {
          lines.push("Blocking:\\n" + checklist.blockingReasons.join("\\n"));
        }
        document.getElementById("commissioning-checklist").textContent = lines.join("\\n");
        document.getElementById("commissioning-complete").disabled =
          setupLocked || !checklist.canComplete;
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
        document.getElementById("commissioning-message").textContent = "Completing commissioning…";
        try {
          await api("/api/setup/commissioning/complete", { method: "POST", body: "{}" });
          await loadCommissioning();
          document.getElementById("commissioning-message").textContent =
            "Commissioning complete. Production capture is enabled.";
        } catch (error) {
          document.getElementById("commissioning-message").textContent = error.message;
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

          if (!setupLocked && resource.enabled) {
            const modeSelect = document.createElement("select");
            modeSelect.innerHTML =
              "<option value='automatic'>automatic</option><option value='manual'>manual</option>";
            modeSelect.value = policy.selectionMode;
            const failbackCheck = document.createElement("input");
            failbackCheck.type = "checkbox";
            failbackCheck.checked = policy.failover.autoFailback;
            const cameraSelect = document.createElement("select");
            for (const camera of enabledCameras) {
              const opt = document.createElement("option");
              opt.value = camera.id;
              opt.textContent = camera.label + " (" + camera.nvrLabel + ")";
              cameraSelect.appendChild(opt);
            }
            const addBtn = document.createElement("button");
            addBtn.textContent = "Add candidate";
            addBtn.className = "inline";
            addBtn.onclick = async () => {
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
                    enabledCameras.find((c) => c.id === cameraSelect.value)?.label ??
                    cameraSelect.value,
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
        const message = document.getElementById("message");
        message.textContent = "Locking setup…";
        await api("/api/setup/lock", { method: "POST", body: "{}" });
        message.textContent =
          "Setup locked. You can close this tab. VenueEdge keeps running.";
        document.getElementById("lock-btn").disabled = true;
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
