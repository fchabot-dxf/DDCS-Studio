# grbl v1.1 — Command / Dialect Reference (captured)

> Captured from the official grbl v1.1 Commands wiki (gnea/grbl). This is the
> "dump" of grbl's accepted G-code dialect — the target spec Studio's emitter
> must conform to for the grbl path. grbl is the **easy** target: Studio already
> emits flat `G0–G3`, so the milling wizards port with little change.
> Source: https://github.com/gnea/grbl/wiki/Grbl-v1.1-Commands

## Supported G-codes
**Motion / coordinate:**
`G0` rapid · `G1` linear · `G2`/`G3` arcs (I/J/K or R) · `G4` dwell ·
`G10 L2` / `G10 L20` set work-coordinate offset · `G20` inch · `G21` mm ·
`G28`/`G30` go to predefined · `G28.1`/`G30.1` store predefined ·
`G38.2`/`G38.3`/`G38.4`/`G38.5` probing · `G43.1` dynamic tool-length offset ·
`G49` cancel TLO · `G53` machine-coordinate move · `G80` cancel motion mode ·
`G90` absolute · `G91` incremental · `G91.1` arc-IJK incremental ·
`G92` set offset · `G92.1` clear offset.

**Plane / WCS / feed:**
`G17`/`G18`/`G19` plane · `G54`–`G59` work coordinate systems ·
`G93` inverse-time · `G94` units/min.

## Supported M-codes
`M0` stop · `M1` optional stop · `M2`/`M30` end ·
`M3` spindle CW · `M4` spindle CCW · `M5` spindle off ·
`M7` mist · `M8` flood · `M9` coolant off ·
`T` tool select (parser state only — no auto tool change).

## `$` system commands
`$$`/`$x=val` view/set settings · `$#` view params (G54–G59, G28/30, G92, TLO,
**probe result**) · `$G` parser modes · `$I` build info · `$N`/`$Nx=line` startup
blocks · `$C` check-mode (parse, no motion) · `$X` kill alarm lock · `$H` homing
cycle · `$J=…` jog · `$RST=$|#|*` reset · `$SLP` sleep.

## Real-time commands (single byte, not queued)
`?` status · `~` cycle-start/resume · `!` feed-hold · `0x18` (Ctrl-X) soft-reset ·
`0x84` safety-door · `0x85` jog-cancel · feed overrides `0x90–0x94` · rapid
overrides `0x95–0x97` · spindle overrides `0x99–0x9D` · `0x9E` spindle-stop
toggle · `0xA0` flood toggle · `0xA1` mist toggle.

## Probing (the key bit for porting probe wizards)
- `G38.2` probe toward, **error/ALARM if no contact** (the safe default).
- `G38.3` probe toward, no error on no-contact.
- `G38.4`/`G38.5` probe away (stop on loss of contact), with/without error.
- **Result is NOT a program variable.** It is reported asynchronously and read
  back via `$#` as: `[PRB:X,Y,Z:flag]` where `flag` = `1` success / `0` fail.
- ⇒ Branching on a probe result happens **host-side** (the sender reads `[PRB:]`
  and decides), never inside the program. This is the core architectural fact
  for the grbl path. Cross-ref `../FINDINGS.md`.

## Explicitly NOT supported (why the "smart" wizards relocate host-side)
- `#variables`, expressions / math
- `IF` / `GOTO` / conditional branching
- subroutines / macros (`M98`/`M99`)
- canned cycles (`G81`/`G82`/`G83`) — **Studio already flattens these, so OK**
- any loop / programming-logic construct

grbl parses every incoming line as G-code (except `$` commands and the real-time
single-byte commands) and executes strictly line-by-line.

## grblHAL note
grblHAL (32-bit fork) extends this with real `M6` tool-change (manual/semi/auto via
driver+plugin), `M66` wait-on-input, and more — but still **no `#var`/`IF`/`GOTO`
macro language**. Extended-codes reference TODO (wiki fetch was blocked; pull from
grblHAL/core wiki when reachable). `[TO PULL]`
