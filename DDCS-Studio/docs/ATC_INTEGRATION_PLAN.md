# ATC Macros & Virtual IO Integration

This plan outlines the steps to resolve the ATC generator syntax errors, align the generated macros with the best practices documented in the DDCS Expert skill references, and properly integrate Limit Switches and generic M-codes into the Execution Engine using `virtualIO.js`.

## Proposed Changes

### Engine Support for Custom IO and Limit Switches

#### [MODIFY] [GcodeExecutionEngine.js](file:///c:/Users/danse/APPS/ddcs-studio-project/DDCS-Studio/web/engine/GcodeExecutionEngine.js)
Currently, the engine parses `M10`, `M11`, `M31`, and `M33`, but ignores them. We will add logic inside `_executeStep` to handle these specific DDCS commands:
1. **Output Control (`M10` / `M11`)**: 
   - When encountering `M10 P#var` (Output ON), we will map the generic output port number (e.g. `P4`) to its `virtualIO` equivalent (e.g. `OUT_SPINDLE_UNCLAMP`) and call `setVirtualOutput(pin, true)`.
   - When encountering `M11 P#var` (Output OFF), we will call `setVirtualOutput(pin, false)`.
2. **Input Polling (`M31` / `M33`)**:
   - `M31 P#var` waits for an input to turn ON.
   - `M33 P#var` waits for an input to turn OFF.
   - The engine's `_executeStep` will pause execution (`return false` without advancing the `ip`) while querying `getVirtualInput(pin)` until the state matches the expectation, allowing `virtualIO.js` delays to play out.
3. **Limit Switches (`M31` / `M33` alias)**:
   - We will support mapping standard limit switches and tool setter inputs (like `IN_PROBE_COLLISION` or `IN_DRAWBAR_OPEN`) to physical DDCS input pin integers.

### Fix ATC Generators & Align with DDCS Expert Standards

#### [MODIFY] [atcChangeWizard.js](file:///c:/Users/danse/APPS/ddcs-studio-project/DDCS-Studio/web/wizards/atcChangeWizard.js)
1. **Syntax Fix**: Remove the nested parentheses `( Tool Released )` from the comments which broke the regex comment stripper in the syntax validator.
2. **Standard Alignment**: 
   - Ensure the `G53` moves rely completely on variables and lack `G0` on the same line to match DDCS V1.22 rules (already currently implemented as `G53 Z#3`, but will add comments explaining why).
   - Verify `IF[... EQ ...]` usage via `dialect.js`.

#### [MODIFY] [atcLengthWizard.js](file:///c:/Users/danse/APPS/ddcs-studio-project/DDCS-Studio/web/wizards/atcLengthWizard.js)
1. Ensure the probe logic uses `#1922` safety checks and standard `G31` probe variables properly aligned with the community patterns.

#### [MODIFY] [virtualIO.js](file:///c:/Users/danse/APPS/ddcs-studio-project/DDCS-Studio/web/virtualIO.js)
1. Export a mapping between numeric DDCS ports (e.g., `4`, `5`) and the descriptive `M3K_TRUTH_TABLE` pin names (e.g., `OUT_SPINDLE_UNCLAMP`, `IN_DRAWBAR_OPEN`) so the engine can look up generic `P` arguments.

## Open Questions
> [!IMPORTANT]
> The engine currently handles `MSETDATA` commands. In standard DDCS macros, port activation is typically done with `M10 Px` / `M11 Px` and input polling with `M31 Px` / `M33 Px`. Are you using `MSETDATA` in any specific macros that I should preserve, or should I primarily focus on `M10`/`M11`/`M31`/`M33` for the virtual IO handshakes?

> [!NOTE]
> **DDCS-expert finding (the data needed to answer the above).** The **only [CONFIRMED]** output
> scheme in the M350 V1.22 references is **discrete paired M-codes per fixed port**, not a parametric
> `M<code> P<port>` form:
>
> | Output | ON | OFF |
> |--------|----|-----|
> | OUT01 | M50 | M51 |
> | OUT02 | M52 | M53 |
> | OUT10 | M68 | M69 |
> | OUT21 | M90 | M91 |
>
> `M10/M11/M31/M33 P<port>` (what the wizards + engine use today) and the `MSETDATA[code,…]` codes
> (`120/121/130/140`) are **[HYPOTHESIS]** — not present in any [CONFIRMED] reference. The simulation is
> self-consistent with them, but **real-hardware behavior is unverified.** Deciding the convention needs
> two answers only you have: (a) which scheme your firmware actually accepts for outputs, and (b) which
> physical `OUTxx` the drawbar solenoid + clamp sensor are wired to. Until then I have **not** rewritten
> the convention — see Status below for what was safe to do without that decision.

## Verification Plan
1. Trigger an ATC Tool Change macro through the Engine.
2. Validate that `M10 P4` triggers `virtualIO.js` to begin its 450ms delay.
3. Validate that the engine pauses at `M33 P5` and successfully resumes 450ms later once `virtualIO` sets the sensor state.
4. Verify the syntax checks report `valid: true` without invalid expression errors.

-----

## Status — DDCS validation pass (Opus 4.8, 2026-06-09)

Validated the generators + engine against the [CONFIRMED] DDCS-expert references and fixed what was
unambiguous. Items needing your hardware/firmware call are left for you (see Open Questions).

### ✅ Done / verified

- **Engine already implements the IO handshakes** the plan asked for — `M10`/`M11` (output via
  `setVirtualOutput`), `M31`/`M33` (input-wait pause), `MSETDATA[…]`, and `G31` probe status
  (`#1920-1922` / `#1925-1927`). The plan's "engine ignores them" premise is **stale**; that work is in
  `GcodeExecutionEngine.js` `_executeStep`.
- **`atcLengthWizard.js` is DDCS-correct** — `G31 … P L Q` → `IF #1922!=2 GOTO1` → `#101=#1927`, then
  `#[1430 + #1300 - 1] = length` exactly matches the confirmed probe + tool-table patterns
  (`#1300` = active tool, `#1430+T-1` = tool-N length offset, `#1922`/`#1927` = probe status/trigger-Z).
- **`atcChangeWizard.js` syntax fixes applied** (both regenerate `valid:true`):
  - **Priming freeze-bug fixed** — `#1155=#880` / `#1156=#881` (system→persistent = ❌ freeze per
    CORE_TRUTH §4) → washed to `#1155=#880 + 0` / `#1156=#881 + 0`.
  - **3-digit label fixed** — `N999`/`GOTO999` (flagged "use caution, may cause parser errors") → `N9`/`GOTO9`.
  - Comments are paren-free (the nested-paren comment-stripper bug is not present in current output).
- **Engine gap filled: `M6 Tn → #1300`** — added to `_executeStep` so tool-length/offset macros that read
  `#1300` simulate correctly (previously `#1300`=0 → the wizard always hit "No tool number set").
  Verified: `M6 T3` ⇒ `#1300 == 3`.

### ⚠️ Found, deliberately NOT changed (needs your call / hardware)

- ~~**IO M-code convention** — generators + engine use `M10/M11/M31/M33 P<port>` ([HYPOTHESIS])~~
  **RESOLVED** by the controller dump: this machine has no such I/O. The **generator** no longer emits it
  (manual rewrite, above). The **engine** still carries the M10/M11/M31/M33 handling as a sim-only
  convenience — harmless, but it is not the M350's real scheme (real outputs = discrete `M50/M51 … M90/M91`
  via `slib-m.nc` `O10050-62`; real automation = Modbus `MSETDATA`).
- **`virtualIO.js` pin map + delays are [HYPOTHESIS]** (estimated from Golden-Run logs) — `HARDWARE_PIN_MAP`
  (`OUT_4`/`OUT_5`, `IN_5`/`IN_6`) and the 400–600 ms travel times need bench confirmation, then re-tag [CONFIRMED].
- ~~**`MSETDATA_OUTPUT_MAP` codes are placeholders**~~ **REMOVED** — `MSETDATA` is now modelled as the real
  6-arg Modbus transfer (no output-code map; it was never how `MSETDATA` works).
- ~~**`atcChangeWizard` operator-confirm** (`#1505=1(…)` then `IF #1505==0 GOTO9`)~~ **RESOLVED** — the
  manual rewrite drops the `IF #1505==0 GOTO9` guard; the wizard now relies on the blocking `#1505=1(…)`
  prompt alone (community-confirmed to block execution). If a hard Cycle-Start pause is preferred, add `M0`.

### I/O convention — RESOLVED by the controller dump (`bridge/controllers/expert-m350/FINDINGS.md`)

The real machine answers the open question — and the answer is that the premise was wrong:

- **This M350 (Ultimate Bee 1010) has NO drawbar / ATC digital I/O at all.** Its confirmed I/O is:
  probe / tool-setter / home **inputs** (sensed via `G31`, statuses `#1920-1929`); spindle + coolant via
  the standard `M3/M5/M7-M9`; and a **Modbus RTU serial channel** (`MSETDATA` push / `MGETDATA` pull,
  6-arg register transfer — confirmed live 2026-06-06) for PC↔controller status/commands. There is **no
  drawbar solenoid, no clamp sensor, no GPIO output** for tool change. Tool change is the firmware
  **`T.nc` / `ALL_T.nc`** hook — manual on this machine.
- ⇒ The `M10/M11/M31/M33 P<port>` digital I/O in `atcChangeWizard.js` + the engine is **fiction for this
  machine** — those codes map to hardware that isn't there. There is no digital-pin "convention" to pick;
  the machine's automation convention is **Modbus `MSETDATA`** (push = proven-safe; `MGETDATA` pull
  **hard-wedges the controller → reboot**, so it's dangerous).
- ~~**Engine mismatch (real bug):** `_handleMSetData` treated `MSETDATA[code,state]` as a 2-arg digital
  output with a placeholder map.~~ **FIXED (2026-06-10):** `GcodeExecutionEngine._handleModbus` now models
  the real 6-arg form **`[startVar, slave#, regAddr, byteLen, funcCode, excVar]`** for both `MSETDATA`
  (push — reads `#startVar..` and traces the transfer, sets `#excVar`=0) and `MGETDATA` (pull — traced;
  no slave answers in the browser sim). Matches the validator's `E-MARGS`; the bogus output-code map is gone.

**Resolution — option 1 IMPLEMENTED (Opus 4.8, 2026-06-10):**
- ✅ **`atcChangeWizard.js` is now a real manual tool change** — stop spindle/coolant → save pos (washed)
  → park (`G53` safe-Z then XY, variables) → **blocking `#1505` operator prompt** → `M30`. The fictional
  `M10/M11/M31/M33` drawbar I/O, the `#4/#5` port config, and the orphaned `N9/GOTO9` are gone. Regenerates
  `valid:true` and **clean** under the (machine-grounded) validator; the engine runs it to `M30`.
- ✅ **Dead UI removed** — the "Drawbar Out Port" / "Clamp In Port" fields are gone from `index.html` +
  `views/atcViews.js` (panel relabelled "MANUAL TOOL CHANGE PARK").
- ✅ **Tool-setter port fixed to IN02** — `settingsPanel.js` default `setterPin: 4 → 2` and
  `atcLengthWizard` fallback `4 → 2` (the confirmed fixed Tool Setter is **IN02**; port 4 = unwired IN04).

**Option 2 — DONE (2026-06-10):** the engine now has real 6-arg `MSETDATA`/`MGETDATA` (Modbus) handling
(see the Engine-mismatch line above). `virtualIO.js` remains a sim-only abstraction for a *hypothetical*
pneumatic ATC, tagged [HYPOTHESIS] — not used by the (manual) tool-change wizard.

### Remaining engine gaps (lower priority, no decision needed)

- No spindle/coolant modal tracking (`M3/M4/M5`, `M7/M8/M9`) — silently ignored (fine for motion sim).
- No `G4/G04` dwell handling — IO-settle delays in real macros are skipped.
- Discrete DDCS output M-codes (`M50/M51 …`) unhandled — same root as the convention decision above.
