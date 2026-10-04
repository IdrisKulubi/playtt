import assert from "node:assert/strict"
import test from "node:test"
import vm from "node:vm"
import { renderSetupPage } from "../src/setup/html.ts"

test("completed checklist replaces readiness UI and restores it if completion is invalidated", async () => {
  const html = renderSetupPage({ enrollmentStatus: "enrolled", setupLocked: false, expiresAt: null, setupToken: "test", cloudDashboardUrl: null })
  const functionSource = html.slice(html.indexOf("async function loadCommissioning()"), html.indexOf("async function runFailoverDrill"))
  const elements = new Map()
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, { dataset: {}, classList: { toggle(name, enabled) { this[name] = enabled } } })
    return elements.get(id)
  }
  const checklist = {
    completed: true, enrolled: true, failoverReady: true, published: true, configApplied: true,
    latestCloudConfigReceived: true, enabledCameraCount: 1, allEnabledCamerasTested: true,
    allEnabledCamerasPreviewed: true, canComplete: true, blockingReasons: [],
  }
  const context = vm.createContext({
    api: async () => ({ checklist }), document: { getElementById: element }, workflow: {},
    setupLocked: false, currentStage: 6, commissioningPollTimer: null,
    setCompleteStatus() {}, renderStages() {}, clearTimeout() {}, setTimeout() {},
  })
  vm.runInContext(functionSource, context)
  await context.loadCommissioning()
  assert.equal(element("completion-heading").textContent, "Setup complete")
  assert.equal(element("completion-success").hidden, false)
  assert.equal(element("commissioning-final-checklist").hidden, true)
  assert.equal(element("commissioning-complete").dataset.mode, "sync")
  assert.equal(element("commissioning-complete").classList.secondary, true)
  assert.equal(element("lock-btn").classList.secondary, false)

  checklist.completed = false
  checklist.canComplete = false
  await context.loadCommissioning()
  assert.equal(element("completion-heading").textContent, "Complete commissioning")
  assert.equal(element("completion-success").hidden, true)
  assert.equal(element("commissioning-final-checklist").hidden, false)
  assert.equal(element("commissioning-complete").disabled, true)
  assert.equal(element("lock-btn").classList.secondary, true)
})
