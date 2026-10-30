# PlayTT teaser · beat map

- 12 s loop, 1440×1440, 60 fps, 120 BPM → 1 beat = 0.5 s, 24 beats = 6 bars
- Look: navy `#07111d`, card `#101b2b`, border `#203149`, accent `#00b7ff`, white type, muted `#92a6bf`. One accent only.
- Reference style: "Apple Watch UI bumper": one shape that never cuts, springs, cursor-driven.
- The shape: a blue ping-pong ball. It becomes every UI state and ends as the ball in the PlayTT logo, then drops back to frame 0.
- Music: Mixkit ~120 BPM track. The drop lands on beat 20 (10.0 s), the logo reveal.

| Beat | Time | State | Sound |
|---|---|---|---|
| 0 | 0.0 | Ball falls into frame, bounces on a thin table line | ball tick |
| 1 | 0.5 | Second, smaller bounce | ball tick |
| 2 | 1.0 | Ball stretches into a pill button **"Book a table"** | soft whoosh |
| 3 | 1.5 | Cursor clicks it | click |
| 4 | 2.0 | Button grows into a card: day chips **Today · Tue · Wed · Thu** | pop |
| 5 | 2.5 | Time slots cascade in: 07:00 … 22:00 | ticks |
| 6 | 3.0 | Cursor picks **19:00**, the slot fills blue | click |
| 7 | 3.5 | **Pay** → loader ring → check **"Booked · Table 1"** | success |
| 8 | 4.0 | Card morphs into the **wall TV** (bezel, 16:9) showing **BLUE 9 · RED 9** | whoosh |
| 9 | 4.5 | Camera eases down: the table edge and its two scoring buttons, blue and red | none |
| 10 | 5.0 | Blue button pressed → TV flips to **10 · 9** | click + tick |
| 11 | 5.5 | Blue again → **11 · 9**, "Game · Blue" | click + tick |
| 12 | 6.0 | TV screen becomes a **replay card** (coded top-down rally, ball trail) | whoosh |
| 13 | 6.5 | Play icon morphs to pause, rally plays | click |
| 14 | 7.0 | Cursor scrubs the progress bar back | scrub |
| 15 | 7.5 | Toast **"Saved to your replays"** | toast |
| 16 | 8.0 | Card becomes **AI analytics**: shot-placement heatmap on a table half | rise |
| 17 | 8.5 | Rally-length bars draw in | ticks |
| 18 | 9.0 | Tooltip on hover: **"Forehand 62%"** | tick |
| 19 | 9.5 | Badge **"AI insights · coming soon"**; corner label **"Example data"** | none |
| 20 | 10.0 | **DROP**: card collapses into the ball, ball arcs over the table into the **PlayTT logo** | impact |
| 21 | 10.5 | **"Table tennis for anyone."** | none |
| 22 | 11.0 | **"Anytime. Any day. Coming soon to Nairobi."** | none |
| 23 | 11.5 | Words exit; logo melts back to the ball at frame-0 position and speed | tick (loop) |

## Copy rules
- Analytics numbers are illustrative and stay labelled "Example data".
- Analytics carries "coming soon". No claims about venues, prices or dates.
- No em/en dashes in on-screen copy.

## Layers (back to front)
background · table line · shape (ball / button / card / TV / replay / chart) · content per state (own enter/exit mask) · scoring buttons · cursor · text lines · labels
