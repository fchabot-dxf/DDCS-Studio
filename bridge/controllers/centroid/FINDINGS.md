# Centroid (Acorn / CNC12) — Port Findings (candidate target, NOT owned yet)

**Unit:** none yet — Centroid **Acorn** board (ARM motion CPU, Ethernet) + **CNC12**
Windows software. **Scope:** Centroid CNC12 as a target. From the CNC12 macro manual
(extracted to `assets/…txt`) — **not tested on owned hardware.**
**Studio-side:** [`../PORTING-GRBL-MACH3.md`](../PORTING-GRBL-MACH3.md). **Dialect:**
Centroid CNC12 — its own concrete dialect (in-program `#var`/branching, Fanuc-Macro-B-*style*
but **not** interchangeable with DDCS or Fanuc). See [`../MACHINE-PRIMITIVES-MAP.md`](../MACHINE-PRIMITIVES-MAP.md) §9.

> Tags: `[DUMP]` from the extracted Centroid macro doc · `[DOCS]` · `[ANALYSIS]` · `[TO CONFIRM]`.

---

## What it is
- Centroid = 30-yr industrial CNC-control maker; **Acorn** is the ~$300 DIY board + CNC12
  software. Popular DIY/retrofit/prosumer; mill/lathe/router/plasma/laser. `[DOCS]`
- Macros = `.mac` G&M-code programs — Fanuc-Macro-B-*style* (`#vars`, `IF…THEN…GOTO/ELSE`,
  `[ ]` expressions, `G65` args `A`→`#1` 20-deep, `M98`) but its **own variant** (the
  `THEN/ELSE` form and `M115` probe are not pure Fanuc). `[DUMP]`
- **Conceptually close to DDCS** (both branch in-program with `#vars`) but a **distinct
  dialect**, not a shared one: Centroid uses `IF…THEN…ELSE` / `M115` probe / `G10`/`G92` WCS;
  DDCS uses `!=` no-`THEN` / `G31`+`#1920` / `#805+` WCS. **Real Fanuc Macro B runs on
  neither.** Translation is concept-level re-authoring, not number-remapping. `[ANALYSIS]`

## Variables `[DUMP]`
- **User:** `#100-#149` (volatile), `#150-#159` (non-volatile). G65 locals `#1-#33`.
- **System:** `#4120` requested tool · `#4203` tool-in-spindle · `#4201` graphing · `#4202`
  searching · `#5044` (axis). Many read-only (set by CNC12).
- **Parameters:** `#9000-#9999` (param N = `#9000+N`): `#9012` probe tool#, `#9014` fast-probe
  rate, `#9015` slow-probe rate, `#9071` tool-touch height. Write via `G10 P<param> R<val>`.
- **Inputs:** `#50001..#500NN` = input-N state (`#50005` = input 5). `IF #50001` is the
  convention to force a look-ahead stop.

## Probing `[DUMP]` — the notable exception vs every other target
- **Not `G31`.** Uses `M115/M116/M125/M126` (move-until-input): `M115` to contact, `M116`
  retract-until-clear, `M125/M126` no-contact positioning. `M115` **cancels with an ERROR**
  if the bound is reached without contact → no-contact protection is built in.
- Machine **stops at contact**; you then define the point with `G92`/`G10` — there is no
  separate trigger-position variable to read. ⇒ the DDCS fast/slow + `IF…GOTO` collapses
  into an `M115`/`M116` pair: *less* code.

## I/O & messaging `[DUMP]`
- **Outputs:** by output # — `M67/M87` (out7 on/off), `M94/M95` (activate/deactivate),
  `M62-65` family. `[TO CONFIRM]` exact numbering per Acorn Wizard.
- **Inputs:** `#500NN` states; `M100/M101`.
- **Messages:** `M225 #t "msg"` (display), `M224 #t "prompt" #ret` (operator input).

## WCS / tool
- **WCS set:** `G92 X[..]` (set position) or `G10 P<param> R[..]` (write param); `G53` machine moves.
- **Tool:** `T` sets `#4120`; tool table; ATC pattern `G65/M98 P[#4120+9100]` → per-slot sub.

## Capability matrix
onControllerMacros ✅ (Macro B `.mac`) · variables ✅ · flowControl native `IF/GOTO/ELSE`
+ `G65`/`M98` · probe **`M115/M116`** (not G31) · inProgramProbeResult ✅ (stop-at-contact
+ `G92`) · cannedCycles ✅ · toolTable ✅ · wcsSet `G10`/`G92` · transport: file on the CNC12 PC.

## DDCS → Centroid (corner probe)
- `G31 X#8 F#3 P#5` + `IF #1920!=2 GOTO1` → `M115 /X P#8 F#9014` (+ `M116`/`M115` slow two-pass).
- `#[#70]=#102` WCS write → `G10 P<G54_X> R[..]` or `G92 X[..]`.
- `#1505=1` prompt → `M225 #100 "..."`.
- `IF/GOTO/N` → identical.

## Open / TO CONFIRM
- [ ] System-variable numbers for current machine position + active-WCS offset params
  (mill operators manual §11.2.16 full var list — not in the macro intro doc).
- [ ] Output M-code numbering on the Acorn Wizard (`M62-65` vs `M67/M87` vs `M94/95`).
- [ ] Whether a probe trigger-position var exists, or it's strictly stop-at-contact + `G92`.

## Assets
- `assets/Centroid_CNC12_Macro_Programming.pdf` + `.txt` (extracted, readable).

Cross-ref: [`../MACHINE-PRIMITIVES-MAP.md`](../MACHINE-PRIMITIVES-MAP.md) §9 (Macro-B family),
[`../PORTING-GRBL-MACH3.md`](../PORTING-GRBL-MACH3.md).
