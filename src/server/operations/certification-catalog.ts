import type { CertificationGate } from "./certification-types.ts"

export const PHASE5_SOFTWARE_GATES: CertificationGate[] = [
  {
    id: "p5_access_test_suite",
    title: "Access automation test suite",
    kind: "software",
    status: "pass",
    summary: "Lifecycle, relay, and notification tests run via pnpm test:access.",
    evidencePath: "src/server/access/access.test.mjs",
    runbookPath: null,
  },
  {
    id: "p5_simulator_certification",
    title: "Simulator certification golden path",
    kind: "software",
    status: "pass",
    summary:
      "Provision/modify/revoke and two-venue isolation pass in pnpm certify:phase5.",
    evidencePath: "scripts/certify-phase5-access.mjs",
    runbookPath: null,
  },
  {
    id: "p5_pilot_flag_tooling",
    title: "Pilot flag rollout tooling",
    kind: "software",
    status: "pass",
    summary:
      "Commissioning-gated tenant flag enablement is available for operators.",
    evidencePath: "scripts/enable-phase5-pilot-flags.mjs",
    runbookPath: "docs/operations/certification/phase5-pilot-rollout.md",
  },
]

export const PHASE5_HARDWARE_GATES: CertificationGate[] = [
  {
    id: "p5_keypad_window",
    title: "Physical TTLock keypad window",
    kind: "hardware",
    status: "manual",
    summary:
      "V4 passcode accepted only inside validFrom/validUntil on a commissioned lock.",
    evidencePath: null,
    runbookPath: "docs/operations/certification/ttlock-keypad-acceptance.md",
  },
  {
    id: "p5_two_venue_doors",
    title: "Two-venue shared entrance and resource doors",
    kind: "hardware",
    status: "manual",
    summary:
      "One booking opens assigned locks; unrelated venue lock rejects the code.",
    evidencePath: null,
    runbookPath: "docs/operations/certification/phase5-two-venue-acceptance.md",
  },
  {
    id: "p5_pilot_rollout",
    title: "Pilot rollout and live_access enablement",
    kind: "process",
    status: "manual",
    summary:
      "Hurlingham / Table 01 commissioned before live_access; flags stay independent.",
    evidencePath: null,
    runbookPath: "docs/operations/certification/phase5-pilot-rollout.md",
  },
]

export const PHASE7_SOFTWARE_GATES: CertificationGate[] = [
  {
    id: "p7_health_overview",
    title: "Tenant and venue health overview",
    kind: "software",
    status: "pass",
    summary: "Admin health dashboard and venue strips are available.",
    evidencePath: "src/app/admin/health/page.tsx",
    runbookPath: null,
  },
  {
    id: "p7_booking_timeline",
    title: "Correlated booking timeline",
    kind: "software",
    status: "pass",
    summary: "Operators can trace payment through replay on booking detail.",
    evidencePath: "src/app/admin/bookings/[id]/page.tsx",
    runbookPath: null,
  },
  {
    id: "p7_alerts_runbooks",
    title: "Derived alerts and runbooks",
    kind: "software",
    status: "pass",
    summary: "Active alerts map to recovery runbooks in the operations module.",
    evidencePath: "src/server/operations/alert-catalog.ts",
    runbookPath: null,
  },
  {
    id: "p7_external_paging",
    title: "External on-call paging",
    kind: "software",
    status: "pass",
    summary: "Webhook dispatch cron and audited paging are configured in code.",
    evidencePath: "src/app/api/cron/operational-alerts/route.ts",
    runbookPath: null,
  },
  {
    id: "p7_alert_acknowledge",
    title: "Audited alert acknowledgement",
    kind: "software",
    status: "pass",
    summary: "Operators can acknowledge active alerts with audit trail.",
    evidencePath: "src/app/api/admin/alerts/acknowledge/route.ts",
    runbookPath: null,
  },
  {
    id: "p7_environment_isolation",
    title: "Environment isolation checks",
    kind: "software",
    status: "pass",
    summary: "Deployment isolation is evaluated from runtime environment variables.",
    evidencePath: "src/app/admin/environment/page.tsx",
    runbookPath: null,
  },
  {
    id: "p7_operations_tests",
    title: "Operations test suite",
    kind: "software",
    status: "pass",
    summary: "Automated operations module tests run via pnpm test:operations.",
    evidencePath: "package.json",
    runbookPath: null,
  },
  {
    id: "p7_dr_tooling",
    title: "DR rehearsal tooling",
    kind: "software",
    status: "pass",
    summary: "DR smoke runner and recovery runbooks exist.",
    evidencePath: "scripts/rehearse-dr-smoke.mjs",
    runbookPath: null,
  },
]

export const PHASE7_HARDWARE_GATES: CertificationGate[] = [
  {
    id: "p7_network_certification",
    title: "Venue network certification",
    kind: "hardware",
    status: "manual",
    summary:
      "VLAN/firewall isolation and measured WAN capacity require pilot venue hardware.",
    evidencePath: null,
    runbookPath: "docs/operations/runbooks/venue-network.md",
  },
  {
    id: "p7_single_table_acceptance",
    title: "Single-table physical acceptance",
    kind: "hardware",
    status: "manual",
    summary:
      "Table 01 journey with TTLock, ESP32 scoring, display, and replay requires physical hardware.",
    evidencePath: null,
    runbookPath: "docs/operations/certification/single-table-acceptance.md",
  },
  {
    id: "p7_ten_table_acceptance",
    title: "Ten-table acceptance",
    kind: "hardware",
    status: "manual",
    summary:
      "Concurrent multi-resource load and isolation require ten configured tables.",
    evidencePath: null,
    runbookPath: "docs/operations/certification/ten-table-acceptance.md",
  },
  {
    id: "p7_rollout_gates",
    title: "Progressive rollout and GA approval",
    kind: "hardware",
    status: "manual",
    summary:
      "Pilot venue observation windows and owner sign-off are process gates.",
    evidencePath: null,
    runbookPath: "docs/operations/rollout-checklist.md",
  },
]
