# DDCS M350 — Syntax & Behavior to Verify at the Machine

Runtime-behavior claims that a **static dump cannot settle** and where the `ddcs-expert`
skill (V1.22, Jan 2026) may be **outdated vs the current firmware**. These need confirming
**on the machine**, then recording in [Expert `FINDINGS.md`](../../bridge/controllers/expert-m350/FINDINGS.md) with a confidence tag.

**Authority model** (see memory `ddcs-ground-truth-reference`):
- **Dump** = truth for *values & addressing* (params, soft limits, WCS table, `macro = param + 500`).
- **Skill** = reference for *runtime behavior* the dump can't show (priming bug, operators, IF/GOTO).
- **This machine** = the tiebreaker where the two overlap (e.g. G10).

> ⚠️ **Run only when physically at the machine.** Several tests **write WCS/tool offsets or command
> motion** — not read-only (see memory `live-cnc-readonly-when-away`).
> **Take a fresh dump first** (you already capture these) so you can diff/restore.
> Where a test writes an offset, use a **scratch WCS (G59)** or save→restore the value.

---

## P0 — Blocks sim / dialect correctness

### V1. Does `G10 L20` actually work? (headline skill-vs-dump conflict)
- **Skill says:** "G10 is BROKEN" (Core Truth #1) — but its example is `G10 L2`.
- **Dump says:** captured macro `3D PROBE G55.nc` uses `G10 L20 P2 Z[#110]` and `G10 L20 P2 X[#111] Y[#111]`.
- **Test (scratch on G59):**
  ```gcode
  G53 G0 Z#var      ; (park safe first; #var=0)
  G59
  G10 L20 P6 X10    ; set G59 X work-offset so current X reads 10
  ; read back:
  #100 = #830       ; G59 X offset register (macro #805+[6-1]*5 = 830)
  #1505 = 1(G59 X off = #100 /expected the indirect-write value)
  ```
- **Record:** does `#830` reflect the `G10 L20` write? Is current-pos rezeroed? → `[CONFIRMED]`/`[HYPOTHESIS]`.
- **Why it matters:** the sim/atoms must know whether a `G10 L20` is a real offset write or a no-op.
- **Adjudicate the two methods (the actual conflict):** they are NOT interchangeable arithmetic.
  Direct write stores the *machine coord of the origin* (`#830 = #880`, or `#880 − target`);
  `G10 L20 P6 X<W>` takes a *target work value* and stores `machine − W` internally. Run both
  to the same intended origin and confirm `#830` ends up identical:
  ```gcode
  ; method A — G10 L20 to make current read X25
  G10 L20 P6 X25
  #100 = #830
  ; method B — direct write of the same intent (machine − 25)
  #830 = #880 - 25
  #101 = #830
  #1505 = 1(A=#100 /B=#101 /must match)
  ```
  If A≠B, the dialect's `setWorkOffset` value-semantics are wrong somewhere — fix before trusting either.

### V2. Is `G10 L2` broken, specifically?
- Same setup, `G10 L2 P6 X10`. Confirm it fails / misbehaves (skill claim) vs `L20`.

### V3. Exact accepted `G53` form
- **Dump (`snippets.nc`):** `#99=0` then `G53 Z#99` — **variable, no `G0`**.
- **Skill:** `G53 G0 Z#var`. Other controllers use `G0 G53`.
- **Test:** try, one at a time, recording which execute and which error:
  `G53 Z#v` · `G53 G0 Z#v` · `G53 G0 Z0` (literal) · `G53 Z0` (literal).
- **Why it matters:** the generated end-program footer + the sim's G53 handling must match the only accepted form.

### V3b. `G28` — configured, or truly inert?
- **Skill / memory:** "G28 ≠ machine zero" and "G28 not configured" — the footer uses `G53` *because* G28 can't be trusted.
- **Dump:** homing reference at `#122-126`; `#220 "Go to home before processing"`.
- **Test (park safe first, expendable line):** run `G28` / `G28 Z#v` and observe — move, error, or no-op? If it moves, to where (machine zero vs `#122-124` vs the G28 reference)?
- **Why it matters:** confirms the dialect must keep emitting `G53` (never `G28`) for retract/park, and tells the sim how to treat any `G28` it encounters.

### V4. Active-WCS variable `#578` — writable?
- **Known:** `#578` reads active WCS (1=G54…6=G59); dump param `#78`=1.
- **Test:** can you *switch* WCS by writing `#578 = 2`, or only via the `G55` command?
  ```gcode
  #578 = 2
  #100 = #578
  #1505 = 1(active WCS now = #100)
  ```
- **Why it matters:** how the sim/atoms select a WCS.

### V5. Soft-limit sentinel semantics
- **Dump:** `#161/#163` (neg X/Z) = `-9999`, `#168` (pos Z) = `9999`; `#155` (enable) = ?
- **Question:** does `±9999` mean "axis soft limit disabled", and does `#155=0` globally disable?
- **Test:** read `#655` (= enable, param #155 + 500) in a macro; on the controller UI confirm whether Z is bounded. Jog toward the sentinel end (carefully) and see if a soft-limit alarm fires.
- **Why it matters:** Phase-2 envelope must treat sentinels as "no limit", not draw a ±9999 box.

---

## P1 — Sim layers (tool length, frame)

### V6. Tool-length offset write + `G43`
- **Dump:** H01–H16 at param `#400-#415` → macro `#900-#915` (via +500).
- **Test:**
  ```gcode
  #900 = 12.5       ; set H01 length offset
  ; confirm on the Tool/H table UI it now reads 12.5
  ```
  Then: is `G43 H1` honored, or must offsets be applied by direct register math (house style)?
- **Why it matters:** the tool-length sim layer needs to know if depths come from `G43` or direct writes.

### V7. Machine-zero ↔ work relationship
- **Dump:** mach-zero offset `#235-237`=0,0,0; mach-pos-after-home `#122-124`=5,−5,−5.
- **Test:** home all, then read DRO:
  ```gcode
  #100=#880  #101=#881  #102=#882   ; X/Y/Z machine DRO
  #1505 = 1(DRO after home X#100 /Y#101 /Z#102)
  ```
  Confirm = 5, −5, −5 (validates the sim's G53 origin assumption).

### V8. Dual-Y gantry: A column = slaved Y
- **Dump:** WCS `base+3` (A, e.g. `#808`) mirrors `base+1` (Y, `#806`).
- **Test:** set a new Y work-zero, read `#806` and `#808`; confirm A tracks Y. → confirms sim can ignore A/B and use X/Y/Z.

---

## P2 — Macro-generation correctness (not sim-critical, but verify before relying)

### V9. Variable-priming freeze
- **Skill:** `#1153 = #880` (persistent ← system) freezes; must prime via a local var first.
- **Test (expendable program):** confirm direct assignment to a `#1153+` var from `#880+` hangs, and the prime-via-local pattern doesn't. Record which ranges need priming.

### V10. Operators: C-style vs FANUC words
- **Skill:** `==`/`!=`/`<`/`>` only; `EQ`/`NE` unreliable.
- **Test:** `IF #100==5 GOTO1` vs `IF #100 EQ 5 GOTO1`.

### V11. IF/GOTO strictness
- No brackets on a simple `IF`, no space before label, `N1`–`N99` labels.
- **Test:** `IF #v!=2 GOTO1` (ok) vs `IF [#v!=2] GOTO1` and `GOTO 1` (expect fail).

---

## Recording results
For each: update [Expert `FINDINGS.md`](../../bridge/controllers/expert-m350/FINDINGS.md) with the tag, the exact form tried, and the
observed result. Anything that **contradicts the skill** → also note it so the dialect
(`DDCS-Studio/web/wizards/dialects/ddcs-expert-m350.js`) and the sim engine can be corrected.
