# Conformance corpus — DDCS Expert as parser oracle (ACTIVE)

**Status: corpus CAPTURED (Phase 1). Static validator pass DONE `[2026-06-10]` — see below.
Dynamic engine-replay still [PLANNED] (needs the machine for the "as-measured" side).**

## Idea
DDCS-Studio's execution engine (`DDCS-Studio/web/engine/`) emulates the
Expert's G-code/macro semantics. Today it is built from documented ground truth (ddcs-expert
skill + official Variables-ENG list). The wired bridge lets us replace "as-documented" with
"as-measured":

1. `corpus/` — tiny .nc probes, ONE parser behavior each. Every probe writes its observable
   result into user variables (#1100+) or a #1505 message.
2. Bridge delivers a probe, operator runs it, result returns via the completion-sentinel /
   run-state `.env` channel.
3. Each result lands twice:
   - `FINDINGS.md` entry tagged `[CONFIRMED]`
   - a fixture file replayed by the Studio engine's tests — engine output MUST match.

## Static pass — validator vs the captured corpus `[done 2026-06-10]`

Phase-1 landed **59 real on-controller programs** (`assets/capture/20260610T163337Z/{CNCDISK,SYSDISK}/*.nc`)
— the `slib-*` libraries, `key-1..7` one-key probes, edge/corner finders, CAM/roughing output, the 3D probe.
Ran them all through Studio's shared validator (`web/shared/js/validate/validate.js`), no machine needed:

- **0 E- (errors)** across all 59 → the validator never false-rejects real DDCS code; its error rules hold.
- **`W-G10` ×5** on `3D PROBE G55.nc`, `key-5.nc`, `key-6.nc` — all `G10 L20 P2` (set G55). These are
  on-controller macros, so the blanket *"G10 is broken"* warning looks **too broad**: the `L20 P` form may
  actually work. `[TO TEST — Phase 2]` run `key-6`, confirm `G10 L20 P2` sets G55 with no spurious motion;
  if it does, narrow `W-G10` to the offending form instead of warning on all G10.
- **`W-CH1620` ×1** on `slib-m.nc:58` — the library's pause M-code writes `#1620` on purpose. Correct; noise.

Replaying these through the **engine** (compare emulated output to as-measured) is the dynamic step below —
that still needs the machine for the "as-measured" side.

## First questions to ask the machine
- IF syntax: does the bare form (`IF #1922!=2 GOTO1`) parse, or only bracketed?
  (conditional-syntax-card.md has conflicting evidence)
- Empty G31 words (`G31 X#8 F#3 P#5 L Q`): error, or defaults?
- After a G31 MISS: exact value of #1920/#1921/#1922; does #1925-1927 keep the stale
  value from the previous probe?
- Unset #variable read: 0, or error?
- Nested parens inside ( comments ): accepted?
- Multi-digit GOTO labels; EQ/NE rejection.

## Rules
- Expert fixtures validate ONLY the Expert emulation. V4.1 results stay in v4.1/ (two-controller rule).
- Probes must be motion-free where possible (assignments + IF/GOTO + #1505) so they are safe
  to run unattended on the bench and the real machine alike.
