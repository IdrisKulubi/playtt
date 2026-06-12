# Phase 6 — Hardware Automation (deferred)

## Scope

- Lights on 2 minutes before session (Tuya/Sonoff)
- 5-minute warning: amber flash + push notification
- Session end: lock engages, table lights off
- Cron/queue via `session_events` table

## Dependencies

- Phase 5 access working
- Hardware provider configs per `location_id`

## Procurement

Physical device list, brands, and wiring: [`../hardware/pod-hardware-guide.md`](../hardware/pod-hardware-guide.md)
