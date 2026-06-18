# Probe config source — per-field controller/override glyph

Design settled 2026-06-12. Lets generated macros read probe config from the controller's
own parameter page (Brad's `macro_cam13` pattern: `F#632 P#1078 L#1080`) instead of baking
Studio values — per field, via an in-input glyph, no toggle rows.

## UI

- Each controller-backed input gets a small **controller glyph** inside the field
  (right adornment, matches the v10.6/10.7 line-icon family).
  - **Dim** = Studio value (editable, current behaviour).
  - **Lit** = read from controller: input read-only, displays the var (`#632`),
    tooltip "Reads Pr132 'probing speed' at runtime — click to override".
- Fields without a controller equivalent show no glyph — the UI is the documentation
  of what's controller-resident.
- State is **global per field, not per wizard**: `probes.sources = { port:'ctrl', … }`.
- Profile-aware: glyph set comes from the controller profile; unavailable = hidden or
  disabled-with-tooltip. Convention-tier fields use a hollow glyph variant.
- Default: Expert profile ships with port/level/speed/retract lit.
- Generated code mirrors the glyph: `#3=#632 ( probing speed - controller Pr132 )`
  vs `#3=200 ( probing speed - Studio )`.

## Variable map (lives in the controller PROFILE, not generators)

| Config | Expert M350 | V4.1 |
|---|---|---|
| Probe port | `#1078` (Pr578) ✓ production-proven | Pr156 → macro # **unconfirmed** (Pr-offset bench item) |
| Probe level | `#1080` (Pr580) ✓ | Pr182 → same caveat |
| Probing speed (fast/approach) | `#632` (Pr132) ✓ | — none |
| Detection times (averaging) | `#631` (Pr131) ✓ | — none |
| Retraction after probe | `#640` (Pr140) | — none |
| Setter port / level | `#1075` / `#1077` (Pr575/577, official list) | — single probe input |
| Setter block thickness | `#633` (Pr133) | not in param table |
| Fixed probe pos X/Y/Z/4th/5th | `#635–#639` | not in param table |
| Probe mode / 2nd-probe switch / scan gate | `#1502` / `#1508` / `#576` (Pr76 must be Open) | — |

No native var anywhere for: slow feed, max scan stroke/extent, safe Z.

## Convention tier — `#1170+` persistent block

Official "user storage" slots; `#1170` = probe radius is already our production convention
(`set_probe_radius.nc`). Extend & formalize (written by a Studio-generated setup macro,
slot map documented in its comments):

| Slot | Meaning |
|---|---|
| `#1170` | Probe radius (existing convention) |
| `#1171` | Slow/precision feed |
| `#1172` | Max scan stroke |
| `#1173` | Safe Z |
| `#1174–#1175` | reserved |

## Implementation notes (v1)

- Wizards `toNum()`-coerce params — controller mode must be an explicit flag into the
  generators, not a `'#1078'` string smuggled through `port` (it would coerce to default).
- All 7 probing views already pull port/level from `settings.probes` → single choke point.
- Config blocks are uniform (`#3/#4/#5` assignments per wizard) → swap the assignment,
  `twoPassProbe` untouched except level accepting a var string (`L#1080` is valid DDCS).
- **Simulator must seed** the profile's controller vars from Studio settings
  (`createVarStore`, `GcodeExecutionEngine.js:130`) or preview runs with feed/port = 0.
- ATC setter wizards (atcLength/atcToolCheck) included: `#1075/#1077/#633/#635-7` are in
  the official variable list (not derived).
- V4.1 unlock conditions (already bench items): Pr→macro offset test (does Pr1 = `#500`?),
  `#1170+` persistence via `PERSISTENCE_WRITE/READ`.

Related: `CAM-MENU-RESEARCH.md` §5b/§6 (the `#2070` pattern + Cam13 techniques these
generators absorb), `BENCH-CHECKLIST.md` §2–3.
