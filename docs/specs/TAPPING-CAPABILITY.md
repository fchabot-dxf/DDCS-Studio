# Tapping capability — DDCS Expert M350 · V4.1 · DM500 (dump-grounded report)

**Question (user, 2026-07-11):** machinists tap a lot — can DDCS do it?
**Method:** evidence from the repo's own firmware dumps only (files cited per claim). No hardware was exercised; "no evidence" means *not found in the dump*, not proven-impossible.

## Verdict at a glance

| | Rigid tapping (encoder-synced, G84-style) | Floating-holder tapping (M3 · pitch-locked G1 · M4 out) |
|---|---|---|
| **Expert M350** | **Hardware-conditional YES** — the firmware has a dedicated TAP spindle mode and supports the spindle driven as a closed-loop axis; needs a servo/encoder spindle build | YES |
| **V4.1** | **No evidence** in the 2025-04-04 firmware (axis-driven-spindle plumbing exists, but zero tap strings) | YES |
| **DM500** | **No** — spindle is switch+analog only, no axis mapping, no orient | YES (if the spindle can reverse) |

Every DDCS post Studio emits can run the floating-holder cycle today — it is plain `M3 / G1 Z F / M4 / G1 Z F` code.

## Evidence per controller

### Expert M350 (capture `bridge/controllers/expert-m350/assets/capture/20260610T163337Z/SYSDISK/`)
- `msg_utf8` string **#44 "TAP"** sits in the spindle-mode row (#41 FWD · #42 REV · #43 JOG · **#44 TAP** · #45 PRCE STOP) — a firmware-level tapping spindle mode exists in the HMI.
- `eng` (settings dictionary): five axis-pulse entries carry the note *"When the axis is used to drive the spindle, the unit of this parameter is the number of pulses per revolution"* — the spindle can be a **controlled axis with a declared pulses/rev**, the hardware prerequisite for rigid tapping.
- `M19.nc` ships in the stock macro set — **spindle orient**, which exists for tapping/ATC work.
- Not found: a literal `G84`/`G74` string in `msg_utf8` or `tools/appcode` (string search only; the binary may encode cycles differently). The TAP mode's exact G-code surface is **unverified on hardware**.
- **Practical bar:** rigid tapping on the Expert requires the machine to be *built* for it — a spindle driven as an axis (servo) or encoder-fed. A plain VFD router spindle does not qualify on any controller.

### V4.1 (firmware `bridge/controllers/v4.1/assets/firmware/.../ddcsv4` — 2025-04-04)
- `eng` **#188 "Spindle interface type": Analog | PUL/DIR** and **#189 "Spindle mapping axis": X/Y/Z/A** — the *plumbing* for an axis-driven spindle exists.
- Zero hits for tap / tapping / rigid / G84 / G74 across `eng`, `msg-eng`, and the `ddcsv4.out` firmware binary (string search). No `M19` orient macro (stock set: M3/M4/M5/M6/m30).
- **Conclusion:** no evidenced tapping mode in this firmware build. Honest N/A — a newer firmware could differ; re-check on the next dump.

### DM500 (install package `bridge/controllers/dm500/install/`)
- `eng` spindle surface is switch-level only: M3/M5 response (#222), response duration (#224), active level (#227), analog speed (#98/#220/#221). **No spindle-axis mapping, no PUL/DIR interface, no orient, zero tap strings** in `eng` / `motion.out` / `tc`.
- **Conclusion:** no rigid tapping, definitively for this package. Floating-holder tapping only, and only if the spindle wiring supports reverse (M4 exists as a command; reversing is a VFD/wiring question, not a controller one).

## The machinist's path that works today (all three)
Tension-compression (floating) tap holder:
1. `M3 S<low rpm>` and let it stabilize.
2. Feed down with the pitch-locked feed — **metric: F = RPM × pitch (mm/min)** · **imperial: F = RPM ÷ TPI × 25.4 (mm-mode)**.
3. At depth: `M4` (reverse) and feed out at the same F.
4. The holder's float absorbs the small sync error. Low RPM, no peck unless the holder is rated for it.

## Studio status + the ratified next step
- Studio today: **no tapping wizard**; the engine/dialects have no G84/G74 handling (grep: `web/wizards/dialects/`, `web/engine/`).
- **Backlog (user-ratified 2026-07-11): a Tapping data-twin wizard** — thread preset table with **metric coarse + fine, imperial UNC/UNF, and extended pitch types**, plus custom pitch; the wizard derives the pitch-locked feed from RPM (both unit systems), emits the floating-holder cycle (dialect-portable), and offers a **rigid (G84-style) variant gated on a DECLARED per-profile spindle capability** (spindle-as-axis / encoder — the post-gating grey-with-why pattern; Expert-only until other firmware shows evidence).
