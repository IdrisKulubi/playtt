# Personal activity stats

Open **Activity → Stats**. Choose Year, Month, or Day; use the arrows or tap the period title to select a date. Select Table time, Sessions, or Spending to change the chart. Tap a bar, then Details, to inspect its bookings. Year and month details offer another level of drill-down.

## Data and totals

- `GET /api/activity/stats?period=year|month|day&date=YYYY-MM-DD` uses the authenticated account and resolved tenant.
- Calendar periods use Africa/Nairobi. Spending is grouped by the booking's scheduled date, rather than the payment transaction date.
- Sessions and table time include completed bookings and confirmed bookings whose reservation has ended. They exclude cancelled, pending, and future confirmed bookings. Reserved duration is not a measurement of time actually played.
- KES spending sums successful booking payments, including modification payments. Failed attempts and fully refunded payments are excluded. Partial refund amounts are not stored, so those payments remain included and the interface discloses this limitation.
- Average paid per booking includes all bookings in the selected period. Previous-period totals compare whole calendar periods.
- Live stats are the default. `EXPO_PUBLIC_LIVE_PLAYER_STATS=false` enables an explicit offline demonstration labelled Sample. A failed live request never substitutes sample values.

## Share images

Share your table story opens a preview for the selected period:

- Story card is the default, with PlayTT branding and a dark background.
- Transparent exports contain the lettering and logo, with light or dark ink options. The checkerboard is a preview and is excluded from the PNG.
- Spending is hidden unless Include spending is enabled. Offline demo exports retain a Sample watermark.
- Share image invokes the native share sheet; Save to Photos requests photo write access. The image is a PNG at 1080 × 1920.

The app exports an image for the user to share. It does not publish to social accounts automatically.

## Development and verification

Run the web backend separately and point `EXPO_PUBLIC_API_URL` at it. Restart Metro after installing the new `react-native-view-shot` dependency. Custom native builds need rebuilding to include the dependency; Expo Go support follows the installed SDK.

- Backend boundary and scoping tests: `node --test src/server/activity/aggregate.test.mjs` from the repo root.
- Mobile helper and interaction tests are alongside their modules; use the mobile Jest setup when its dependencies are available.
- Validate contracts with `node scripts/validate-api-contracts.mjs`.
- On-device acceptance: verify chart scrolling and date drills, light/dark themes, large text, image/logo rendering, PNG alpha after saving, the native share sheet, photo-permission denial, and gallery saving.

The design extends the existing Space Grotesk, cyan accents, adaptive theme, and native glass controls. It does not change the global design system.
