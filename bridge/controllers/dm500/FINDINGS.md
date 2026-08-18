# DM500 (V3) — controller findings

## The dump is IN THIS REPO (no external dump needed)
`bridge/controllers/dm500/` already holds a real DM500 capture:
- `setting` — 170000 bytes = **21250 float64 slots** (matches dumpImport's `n >= 20000 → dm500`).
- `install/eng` — the self-describing param dictionary (24494 bytes, **same `#idx -t.. -s1"name" -s2"unit"
  -min= -max=` format as Expert/V4.1**; 311 params, indices 1–2049).
- `install/{chs,custom}` — localized name tables; `upgrade log.txt` — fw 20260408 (adds `#2049` fix-probe
  safe height).

## THE MAP — DM500 geometry roles → eng param index (built from the real eng, 2026-08-18)
Same role structure as Expert/V4.1, DM500's OWN indices. `#16 current coordinate system` matches V4.1's
active-WCS param exactly.

| role | eng index | range |
|---|---|---|
| active WCS (`current coordinate system`) | **#16** | 1–7 (1=G54…6=G59, 7=MACH) |
| pulse equivalency X/Y/Z/A | #34 / #35 / #36 / #38 | 50–99999 P/unit |
| home enable X/Y/Z/A | #52 / #53 / #54 / #55 | bool |
| home speed X/Y/Z/A | #56 / #57 / #58 / #59 | 1–99999 |
| home signal level X/Y/Z/A | #60 / #61 / #62 / #63 | bool |
| **home direction X/Y/Z/A** | #64 / #65 / #66 / #67 | 0=`--` / 1=`++` |
| back-off after home X/Y/Z/A | #83 / #84 / #85 / #86 | 0–99 / 0–360 |
| axis-DIR (A/B phase) X/Y/Z/A | #234 / #235 / #236 / #237 | bool |
| enable software limit | #374 | bool |
| **soft-limit value X--/Y--/Z--/A--** | #375 / #376 / #377 / #378 | ±9999 |
| **soft-limit value X++/Y++/Z++/A++** | #379 / #380 / #381 / #382 | ±9999 |
| G0 speed (rapid) | #80 | 1–99999 |
| max spindle speed | #98 | 99–99999 |
| tool-sensor thickness / probe level | #69 / #70 | — |
| initial probe pos X/Y/Z | #72 / #73 / #74 | ±9999 |
| hard-limit enable −/+ per axis | #400–407 | bool |
| hard-limit electric level −/+ | #408–415 | bool |

Note vs Expert: soft-limits are COORDINATE values here (#375–382) as on Expert (#161–168), but home
DIRECTION is #64–67 (Expert #112–114). WCS G54–G59 offset TABLE + machine-zero storage NOT yet located
(no `coord1`-style file in this capture — may live inside `setting` or a coord file not captured).

## THE VALUE LAYOUT IS NOT CRACKED (the real "ungrounded" part)
Reading `setting[engIndex]` as f64 (what works for Expert/V4.1) yields **astronomical garbage** (e.g. `#43
Z-max-speed` = 8e169). Tested and REJECTED, scored by non-zero-values-in-declared-range:
- f64 identity `slot=#idx` → 28/51 (garbage)
- f64 offset `slot=#idx+k` (k swept −5…21249) → best frac 0.74 @ ~20 hits = noise, no clean base
- f64 stride `#idx*2 / *3` → poor
- **f32** (`170000/4 = 42500` slots), identity / `*2` / base-swept → poor (`*2` ≡ f64 identity)

So DM500 does NOT store params as a flat array indexed by eng `#idx` (unlike Expert/V4.1). Its firmware
serializes settings by an internal structure; the eng `#idx` is a UI id, not the storage slot. Plausible
non-zero values (|v|<1e5) number ~1569 and are scattered across ALL 21250 slots — no contiguous param block.

## TO GROUND THE VALUES — the unblock (needs the machine, cheap)
Pick ONE well-known parameter, read its value off the DM500 screen, and I locate that exact number in the
`setting` bytes to anchor the layout — e.g. **X pulse equivalency (#34)**, or **G0 speed (#80)**, or a
**soft-limit (#375)**. One or two anchors + the eng ranges should reveal the slot function
(base/stride/record layout). Alternatively: two dumps differing by ONE changed param → diff the bytes.
Until then DM500 stays on the honest by-name path (names shown, values N/A) — do NOT emit values from the
uncracked layout. See memory `var-read-address-systems` + `ddcs-firmware-downloads`.
