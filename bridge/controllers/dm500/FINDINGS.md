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

## THE VALUE LAYOUT IS CRACKED (2026-08-18) — a self-describing text-record format
DM500 does **NOT** store a flat f64 array indexed by eng `#idx` like Expert/V4.1 — reading `setting[#idx]`
as f64 gave astronomical garbage because those "f64s" are actually **ASCII bytes**. Ruled out first
(f64 identity/offset-swept/stride, f32 variants — all noise). The real format, found by hexdump:

**Each parameter is a record `[float32 value][name string\0][unit string\0][enum labels…]`.** The value is
a **little-endian float32 in the 4 bytes IMMEDIATELY BEFORE its name string.** The names are the eng's
`-s1` strings verbatim (`"minimum log radius of 4axis machining"`, `"Soft-limited postion value of X--"`).

**Decode = for each eng `-s1` name, find that `name\0` in the bytes, read the float32 at `pos-4`.** Verified:
**244/244 matched params fall in their eng-declared min/max** (vs garbage under any index scheme). Robust
form must search by EXACT name (a regex that greedily eats printable value-bytes mis-aligns the start).

### Grounded profile of THIS capture (a real, coherent ~400×400×20 machine)
| role | # | X | Y | Z |
|---|---|---|---|---|
| pulse equivalency | 34-36 | 640 | 640 | 640 |
| max speed (M_Ctrl) | 41-43 | 16000 | 16000 | 16000 |
| home speed | 56-58 | 1600 | 1600 | 1600 |
| home direction | 64-66 | 0 | 0 | 0 |
| soft-limit −− | 375-77 | -400 | -400 | -20 |
| soft-limit ++ | 379-81 | 400 | 400 | 20 |
Active WCS (#16)=1 (G54) · enable soft-limit (#374)=0 · G0 speed (#80)=3000 · max spindle (#98)=24000.

WCS G54-G59 offset TABLE + machine-zero still not located as named records (may be a separate coord file
not in this capture, or non-`-s1` records) — the ENVELOPE/homing/feeds ARE grounded.

## NEXT — wire it into the importer
`dumpImport.js` DM500 branch should switch from "values N/A" to **parse-by-name** (float32 before each eng
name), reusing the eng it already reads. Add a DM500 golden from this in-repo capture (envelope ±400/±20,
pulse 640, active WCS G54) — cross-language pinned like Expert/V4.1. See memory `var-read-address-systems`.
