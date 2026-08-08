# DDCS Expert (M350) — At-Machine Verification: HANDOFF

Status of the at-machine verification pass against the checklist in
[`../../../../docs/VERIFY-AT-MACHINE.md`](../../../../docs/VERIFY-AT-MACHINE.md).
Full evidence + reasoning lives in [`../FINDINGS.md`](../FINDINGS.md) (search the `V# RESULT` headers).
This file is the quick "where are we / how to resume" sheet.

**Machine:** DDCS Expert M350, Ultimate Bee 1010 (studio). Firmware **2025-06-19-00**.
**Last worked:** 2026-06-23.

---

## How to resume (operational)

- **Controller file share is mapped to `N:\`** on this PC (= CNCDISK, `/local/`). Drop a `.nc` there and it
  shows up in the controller's program list. Push from the repo with:
  `Copy-Item bridge/controllers/expert-m350/verify\*.nc N:\ -Force`
- All test macros live in [`./`](.) (`bridge/controllers/expert-m350/verify/`). Each is **self-contained**:
  primes vars, saves/restores any state it touches, reports via on-screen `#1505=-5000(text %f)` popups.
- **Reading results:** the `-5000` message is a **blocking popup** (Enter/Esc). Read the numbers off it; the
  user-var viewer is fiddly, so macros also leave values in slots `#48x–#49x` if needed.
- **Macro Enable must be Open** (`Pr76` / `#576=1`) or macros won't run.

## Safety rules learned the hard way (READ BEFORE WRITING A TEST)

1. **`(...)` comments CANNOT NEST.** `(a (b) c)` closes at the first `)` and the rest parses as code →
   `syntax error`. Bit us twice (V1 line 2, IF_neg_test line 3). **No inner parens, no `[]`, in comments.**
2. **`G10 L20/L2` with an axis word MOVES the machine** (V1). Never emit it. Set WCS offsets by direct
   register write `#[805+(wcs-1)*5+ax]=...`.
3. **Whole-file parse before run:** any syntax error aborts the *entire* file (nothing executes) — so test one
   risky form per file, and a syntax error = "that form rejected, nothing ran, state pristine."
4. **`M30` does not move here** (`#730=0`) — safe to let test macros finish. Re-check `#730` if the operator
   changes the end-program return mode.
5. **To test an unknown MOTION command safely:** borrow **G59 as a zero-offset scratch frame** (save offsets →
   write 0 → `G59` to select → verify offset reads 0 → human-gate on header=G59 & Abs==Mach), then command the
   **current** position so the move is zero-distance under any interpretation. Pattern is in `V3a_g53_var_noG0.nc`.

---

## Done ✅ (all `[CONFIRMED on machine]`, see FINDINGS `V# RESULT`)

| Test | File | Result |
|---|---|---|
| **V1** G10 L20 | `V1_G10_WCS.nc` ⚠️DANGER | **Broken + DANGEROUS** — wrote no offset, axis word ran as a G90/G01 move (Mach X 5→73.286). Never emit `G10 L2/L20` + axis word. |
| **V3** G53 form | `V3a/V3b` | `G53 <axis>#var` accepted **with and without G0**. Matches dialect emit. Literals inconclusive (low-value). |
| **V4** `#578` writable | `V4_active_wcs.nc` | Writable (`#578=2` switched, restored). |
| **#578 vs G-word** | `DIAG_g53setup.nc` | G-word WCS select switches the frame (header→G59, Abs==Mach) but **`#578` does NOT track it** → `readActiveWcs` stale after an in-program `G54..G59`. |
| **M30 end-move** | `READ_endmode.nc` | `#730=0` → M30 doesn't move; `#569=5.0` safe-Z. |
| **V5** soft limits | `V5_read_softlimits.nc` | `#655 enable=1` but ends read ±9999 = per-axis "no limit" sentinel. Envelope must treat ±9999 as unbounded. |
| **V10** operators | `V10_operators.nc` | FANUC **`EQ` works** (contradicts skill). Symbolic `==`/`!=` also fine. |
| **V11** GOTO-space | `V11_gotospace.nc` | **`GOTO 1` (space) accepted** (contradicts `E-GOTOSPACE`). |
| **IF neg-decimal** | `IF_neg_test.nc` | Compares vs negative decimals work → `ifGoto` may emit negative operands. |
| **V8** dual-Y gantry | `V8_read_gantry.nc` | `#806 Yoff == #808 Aoff` (−665.944) → A tracks Y in the WCS table; sim can ignore A/B. |
| **V6** tool-length (write) | `V6_set/V6_restore.nc` | macro `#900` = param `#400` = H01 offset (panel showed 12.5). H01–H16 = `#900-#915` = `#400-#415` (+500). Register-writable; no `G43` needed for the write. |

## Left to do — NO MOTION, drop and run (do these first: nothing moves, nothing is saved or restored)

| Test | Question | Run order / how to read |
|---|---|---|
| **V13** trig | Does the macro parser have `COS` / `SIN` / `SQRT` / `ATAN`? **The single decider for four declared boundaries** (see `DDCS-Studio/web/data/trigEvidence.js` — what each answer changes, written before the visit). | **1.** `V13_trig.nc` — probes all four in one run. If it reaches the end (`#601=100`) you are done in one go. Its *abort* is evidence too: it is the only file that can show whether an **unknown function fails LOUD** at all, which is the question the corpus rule turns on. **2.** if it aborted: `V13c_sqrt.nc` (**SQRT first — three shipped boundaries wait on it**), then `V13a_cos.nc`, `V13b_sin.nc`, `V13d_atan.nc`. One function per file (rule 3) so none can blind another. Each pops its own result. **Three outcomes, all useful:** expected value = works · a *different* number = parsed but silently wrong (write the number down) · no popup + syntax error = rejected, loud, nothing ran. |
| **V14** WCS pos | Are `#790`/`#791` (X/Y work position) readable? `#792`=Z is factory-proven. | Jog off-zero on all 3 axes, write down the workpiece DRO, run `V14_wcs_pos.nc`, compare. |
| **V15** indent | Does the parser tolerate leading spaces (Studio's default emit style)? | `V15_indent.nc` — 3 sections; a syntax error's line number says which construct broke. |
| **V12** IF..THEN | Is the inline `IF cond THEN #x=n` clamp accepted, or only `IF..GOTO`? | `V12_ifthen.nc` — no popup = the form is rejected. |
| **V13e** ATAN order | `ATAN dy/dx` order — Studio's alignment angle assumes it; no HW confirmed | `V13e_atan_order.nc` — **2657**=Studio order OK · **6343**=mirrored (fix parser) · **2250**=not-atan2 · none=rejected. Do **after** V13d confirms two-operand atan runs. |
| **V17d** unclosed `[` | `[1 + 2` with no close → CLOSE / truncate / ALARM? | `V17d_unclosed.nc` — **3**=closed (sim matches) · **none**=alarmed (sim too lenient → tighten gate) · other=third way. |
| **V17e** divide-by-zero | literal `/0` → rejected at load or tolerated? | `V17e_divzero.nc` — **none**=rejected at load (tighten gate) · **-99999**=inert · other=firmware computed something for 1/0. |

> ℹ **Mirror of V4.1 `S6f/S6g/S6h` (added 2026-08-08).** `S6a/b/c` already have twins (`V17a/b/c`); `S6e` partial is settled (Expert whole-file-rejects, rule 3); WHILE (`S5n`) is already `[CONFIRMED]` in FINDINGS (factory `WHILE…DOn…ENDn`, both spacings). `V17d`/`V17e` still open.

> ✅ **V13 ATAN RESOLVED 2026-08-08 (see FINDINGS `V13 RESULT`).** `V13_trig` aborted on the **slash** ATAN line; `V13f_atan_comma` returned **2657** ⇒ two-operand ATAN works via the **COMMA form `ATAN[y, x]`**, order correct (dy-over-dx). **`V13d`/`V13e` are superseded** (both use the rejected slash form). **DEFECT logged:** `probeToSlot.js:538` + `alignmentWizard.js:158` emit the slash form → unparseable on the Expert; fix = comma emit (desk task, needs the suite). **COS/SIN/SQRT still open** → run `V13c_sqrt`, `V13a_cos`, `V13b_sin`.

> ⚠ **t1466 — a comment can fake a failure, and it nearly did.** Safety rule 1 below is not cosmetic: `V13_trig.nc`
> carried five bracketed comment lines and V12/V14/V15 carried more. A parse abort caused by a *comment* reads
> exactly like the *test* failing — a false negative that costs a whole visit. All are now stripped, and
> `DDCS-Studio/tests/trig-lift-plan-1466.spec.js` LOCK 5 fails the build if any `.nc` here re-introduces one.

## Left to do — ALL need a deliberate MOTION setup (Z clearance, low rapid override, hand on feed-hold)

| Test | Question | How to approach |
|---|---|---|
| **V3b** | `G28` — configured or inert? Does it move, and to where? | Park safe, expendable line, watch where it goes. |
| **V6 (G43 half)** | Is `G43 H1` actually HONORED (applies offset on a Z move), or direct register math only? | Set `#900`, `G43 H1`, make a small Z move, see if it shifts by the offset. |
| **V7** | Formal homed-DRO read (only seen incidentally = Mach 5/−5/−5). | Home all, read `#880/#881/#882`. |
| **V16** helical arc | Does a `G2/G3` interpolate a **Z** in the same block? **PLANAR arcs are richly attested (7361 captured lines); the HELICAL form appears ZERO times** and the M350 reference documents no `G02/G03` at all. | `V16_helical_arc.nc` — **tool OUT, spindle off**, park with 12mm free in −X / 6mm in Y / 2mm down, rapid override low, hand on feed-hold. One 5mm circle descending 1mm in G91, then it puts the 1mm back. Reads `#792` either side and reports the **drop**. `1.000` = works · **`0.000` = the arc ran and the Z was SILENTLY IGNORED** · no popup = rejected, loud. |

> ⚠ **V16 is not only a gate on a future feature — it checks emit that ALREADY SHIPS.** The circle-contour ramp
> entry (`wizards/ops/contour.js`, one site, inventoried by `tests/helical-arc-evidence-1472.spec.js` LOCK 4) has
> been sending a helical `G3` to real machines on a capability nobody has confirmed. A `0.000` here means those
> entry circles have been cut at one depth instead of descending.

## Deferred / not pursued
- **V2** (G10 L2 specifically) — folded into V1 (any axis-word G10 is dangerous).
- **V9** (variable-priming freeze) — **skipped on purpose:** deliberately triggering the freeze risks a
  controller wedge/reboot, and we already prime everywhere (house style). Not worth the risk.
- **V3c/V3d** (literal-G53) — low-value; the dialect emits `#var`, never bare literals.

## Dialect follow-ups (web/wizards/dialects/ddcs-expert-m350.js)
- `readActiveWcs: #578` is **stale after a G-word WCS switch** — note/guard it.
- Linter: relax **`EQ`** and **`GOTO`-space** from error → warning on the Expert.
- `setWorkOffset` already correct (direct register write); the "G10 L20 also works" note was removed.
