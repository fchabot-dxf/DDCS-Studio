# 05 — POST-FLASH RE-VERIFICATION, and the questions injection makes cheap

**Written 2026-09-04 from the Ranchy seat, for whoever holds the Expert.** Numbered `05` because an
`04-modbus-slave-test-plan.md` exists on the `wizards-as-data-blocks` branch and has not merged — do not
renumber this one to fill the gap.

⛔ **NOTHING HERE HAS BEEN RUN.** This is a plan, not a result. Every item is `[TO TEST]` until someone
executes it and tags it in `FINDINGS.md`.

---

## ⭐ WHY NOW — the instrument changed, not just the firmware

The owner flashed to `2026-09-02-00`, which brings **§30 injection** (FC16 → register `3000`) and therefore
**§31 the universal variable reader**. Two things follow, and the second is the bigger one.

**1. The cost collapsed.** A question that needed a `.nc` written, transferred over SMB, run at the pendant
and read off a dialog now costs one injected line and one register read.

**2. ⭐⭐ THE WHOLE-FILE-REJECT FAILURE MODE IS GONE.** This is why `COS`/`SIN`/`SQRT` are still unknown after
months: `V13_trig.nc` hit a syntax error on its ATAN line, the controller rejected the **whole file** (safety
rule 3), and the three functions after it were never evaluated. Injection executes **one line at a time**, so a
failing test cannot blind the tests behind it. Every item below is independently observable for the first time.

### The recipe (§31)

```
1. inject   #915 = <expression or #target>     ← FC16, reg 3000, ASCII, one line, ⛔ NO trailing \n, <=246 B
2. read     register 7330                      ← = 6500 + 2*415, the same slot over Modbus
3. inject   #915 = 0                           ← RESTORE. Do not skip this.
```

⛔⛔ **CORRECTED 2026-09-05 — the original line here said "trailing `\n`", copied from §30's own protocol
note, and that newline turned out to be THE CAUSE of the ~25% frame loss FAIRY chased for a day** (the
"[3+3] mystery"): the vendor's own tool never sends one. Five findings were retracted over stale values from
lost frames before the `\n` was found. See FINDINGS.md's retraction. ⇒ **Send the bare line.** And carry
FAIRY's method rule: on this channel a NEGATIVE result (rejected / no-op / refuses) is worth nothing without
an acknowledged FC16 frame or a pendant photograph — a lost frame leaves the previous value, which reads as a
plausible answer.

⚠ **Scratch-slot note, superseded in part:** `#915` worked and its restore discipline stands, but FAIRY's
variables map (2026-09-05) establishes the real rule — **`#0`–`#499` is the macro scratch space; `#N≥500` is
`Pr(N-500)`**, so `#915` is parameter H16 by construction, not by luck. Prefer a low scratch var where the
register map can reach it; `context/` has the map.

⚠ **Why `#915`:** H16 tool-length offset — unused on this machine, holds 0, range ±9999.999. A narrow-range
parameter would **silently clamp or reject** the value and you would read a lie. ⛔ Leaving a live value in an
H slot is the latent hazard §17/§22 already chased once.

### ⛔ Two limits that shape every test below

- **§32 — a RUNNING OR PAUSED macro's writes are invisible over Modbus until it completes.** Mid-macro reads
  return `0.0000`. This method tests line-at-a-time behaviour; it cannot observe a running program's interior.
- **Multi-line control flow still needs a real file.** `GOTO`, loops and label handling cannot be exercised
  one line at a time.

### ⚠ AND CHECK THE GUARD DOESN'T FALSE-REJECT YOU FIRST

`tools/modbus_inject.py` **refuses in code** any payload containing a G or M code, an axis letter followed by
a value, a feed/spindle word, or a tool change. That guard is correct and stays. But note that **`SIN` and
`SQRT` both begin with `S`, the spindle word** — before concluding a trig function is broken, confirm the
payload actually reached the controller rather than being refused locally. A false reject and a real syntax
error look nothing alike once you check, and everything alike if you don't.

---

## 1. ⭐ THE TRIG GAP — three lines, no motion, no file, do this first

Open since the `V13_trig` abort. Nothing about them is hard; they were simply unobservable.

| inject | read `7330` | expect |
|---|---|---|
| `#915 = SQRT[16]` | | `4` |
| `#915 = COS[0]` | | `1` |
| `#915 = SIN[0]` | | `0` |

⇒ Then tag `FINDINGS` "Still open: COS / SIN / SQRT on the Expert" as resolved either way, and reconcile
`trigEvidence.js`. Add a second value per function (e.g. `SQRT[2]`, `COS[90]`) — **`COS[90]` also settles
degrees vs radians**, which nothing has ever established here and which silently changes every emitted arc.

## 2. THE OPERATOR SET — same shape

`EQ` is confirmed; `NE` / `LT` / `GT` are untested. Comparison results are readable the same way where the
dialect allows an expression; where it does not, note it and fold them into a real file with §3.

## 3. ⭐⭐ THE DIFFERENTIAL SWEEP — the highest-leverage item here, and it is a METHOD

Every variable on the controller is now readable. That makes **variable discovery by differencing** possible
for the first time:

```
snapshot a variable range  →  change ONE machine state  →  snapshot again  →  diff
```

What it retires, all currently `[HYPOTHESIS]` or open:

- `#162` / `#166` / `#167` — candidate travel / soft-limit values (`#162=-776`, `#166=756`). Change a soft
  limit in the parameter screen, re-sweep, see which moved. Cross-check against `setting[]` via §28
  (`reg = 6500 + 2*index`) — **two independent sources for one fact, which is what makes it attested.**
- `#671` (`=50`, ≈ our default block height) / `#675` (`=400`, ≈ a probe feed).
- ⭐ **"Find the system var holding the live alarm code"** — long open, and now straightforward: trigger a
  known alarm, sweep, diff. That one finding lets the gateway log *which* error instead of *that* one happened.
- `#1000`-family I/O / alarm vars, flagged as *"may or may not be safe — untested in isolation"*.

⚠ Sweep READS only. Nothing in this section writes a controller variable other than the `#915` scratch slot.

## 4. ⚠ THE ELEVEN STALE FINDINGS — triage, do not assume

`FINDINGS.md` carries **11 entries explicitly pinned to `fw 2025-06-19-00`** — the firmware the machine no
longer runs — out of 96 `[CONFIRMED]` total. They are neither right nor wrong today; they are **unassessed**.
The non-motion ones are near-free with this instrument (ATAN's comma form, the operator set, the
leading-whitespace parser question `[TO TEST · t1450]`, which injection tests directly by sending an indented
line).

⭐ **And the other 85 are the quieter problem: they carry no firmware pin at all**, so there is no way to tell
whether a flash touched them. Worth adopting a pin on every new `[CONFIRMED]` from here.

## 5. ⛔ `G10 L20` — highest value, and the ONLY one here that moves an axis

`[CONFIRMED 2026-06-19, fw 2025-06-19-00]` it was **broken AND dangerous**: `G10 L20 P6 X25` produced
**motion** from an axis word in a command that should only set an offset. Studio routes around it today.

⇒ If the flash fixed it, that routing can go. If it did not, it is confirmed for the current firmware and the
workaround is justified rather than inherited.

⛔ **This one cannot use the injection channel at all** — `modbus_inject.py` refuses G-codes by design, and
that guard is not to be relaxed for a test. It needs a real motion-free `.nc` at the pendant, with the same
care the original `V1_G10_WCS.nc` used (scratch `G59 P6`, save/restore `#830`), the owner present, and room
for the axis to move if it misbehaves again.

⭐ Do **1–4 first**. They are free, they are safe, and they will teach you more about this firmware's dialect
before you ask it to move anything.
