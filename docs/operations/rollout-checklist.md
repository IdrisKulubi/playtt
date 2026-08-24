# Phase 7 progressive rollout checklist

Every stage needs entry metrics, kill switches, manual fallback, rollback, and an observation period.

## Stages

| Stage | Entry criteria | Exit evidence |
| --- | --- | --- |
| Internal staff / simulator | Software gates pass on `/admin/certification` | `pnpm test:operations` green |
| Preview / staging | Isolated credentials, test providers | `pnpm ops:verify-env` + DR rehearsal report |
| Operator-attended Table 01 pilot | Single-table acceptance doc signed | Physical journey recording |
| Progressive first-venue rollout | Replay + devices stable for 7 days | Health/alerts clean |
| Ten-table observation | Ten resources configured | Ten-table acceptance doc |
| Second venue / tenant pilot | Multi-tenant isolation proven | Cross-tenant test evidence |
| General availability | All gates green or waived with owner sign-off | GA approval record |

## Kill switches

- Disable replay per venue/resource.
- Disable automation commands per venue.
- Fall back to booking/payment-only mode.

## Required before GA

- SLOs, alerts, on-call ownership, and runbooks live.
- `OPS_ALERT_DISPATCH_ENABLED` verified in production.
- Booking/payment-only safe mode rehearsed.
- Security review has no unresolved critical/high findings.
