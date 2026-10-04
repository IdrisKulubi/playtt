import type { VenueEdgeInstallationDetailView, VenueEdgeInstallationFleetView, VenueEdgeLifecycleStage } from "@/server/replays/venue-edge-fleet"

export type InstallationSetupSummary = Pick<VenueEdgeInstallationFleetView, "commissionedAt" | "readiness" | "checklistBlockers" | "nextAction">

export function setupPresentation(installation: InstallationSetupSummary | null) {
  const complete = Boolean(installation?.commissionedAt) && !installation?.checklistBlockers.some((blocker) => blocker.code !== "HOST_SLEEP_RISK")
  return {
    complete,
    title: complete ? "Setup complete" : "VenueEdge is connected",
    detail: complete ? "Commissioning is complete. View the installation to monitor VenueEdge." : "Open the installation to review the next required step.",
    action: complete ? "View installation" : installation?.nextAction.label ?? "Continue setup",
  }
}

export function isSetupStageComplete(installation: VenueEdgeInstallationDetailView, stage: VenueEdgeLifecycleStage) {
  switch (stage) {
    case "pair_device": return !["pending_setup", "waiting_for_install", "revoked"].includes(installation.connectivity)
    case "add_nvr": return installation.reportedTopology.topology.nvrCount > 0
    case "review_cameras": return installation.reportedTopology.topology.enabledCameraCount > 0
    case "map_tables": return Boolean(installation.commissioningSnapshot?.resourceRoutes?.some((route) => route.enabled !== false))
    case "publish_config": return installation.desiredTopology.revisionVersion !== null && installation.desiredTopology.revisionVersion === installation.appliedTopology.revisionVersion && installation.configApplicationStatus === "applied" && !installation.checklistBlockers.some((blocker) => blocker.stage === "publish_config")
    case "complete_commissioning": return Boolean(installation.commissionedAt)
  }
}
