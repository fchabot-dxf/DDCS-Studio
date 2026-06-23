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

## Left to do — ALL need a deliberate MOTION setup (Z clearance, low rapid override, hand on feed-hold)

| Test | Question | How to approach |
|---|---|---|
| **V3b** | `G28` — configured or inert? Does it move, and to where? | Park safe, expendable line, watch where it goes. |
| **V6** | Tool-length offset write + is `G43 H` honored, or direct register math only? | Write `#900=12.5`, check H-table; try `G43 H1`. |
| **V8** | Dual-Y gantry: does A (`#808`) track Y (`#806`) on a new Y zero? | Set a Y work-zero, read both registers. |
| **V7** | Formal homed-DRO read (only seen incidentally = Mach 5/−5/−5). | Home all, read `#880/#881/#882`. |

## Deferred / not pursued
- **V2** (G10 L2 specifically) — folded into V1 (any axis-word G10 is dangerous).
- **V9** (variable-priming freeze) — **skipped on purpose:** deliberately triggering the freeze risks a
  controller wedge/reboot, and we already prime everywhere (house style). Not worth the risk.
- **V3c/V3d** (literal-G53) — low-value; the dialect emits `#var`, never bare literals.

## Dialect follow-ups (web/wizards/dialects/ddcs-expert-m350.js)
- `readActiveWcs: #578` is **stale after a G-word WCS switch** — note/guard it.
- Linter: relax **`EQ`** and **`GOTO`-space** from error → warning on the Expert.
- `setWorkOffset` already correct (direct register write); the "G10 L20 also works" note was removed.
