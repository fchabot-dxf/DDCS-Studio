# ATC Macros & Virtual IO Integration

This plan outlines the steps to resolve the ATC generator syntax errors, align the generated macros with the best practices documented in the DDCS Expert skill references, and properly integrate Limit Switches and generic M-codes into the Execution Engine using `virtualIO.js`.

## Proposed Changes

### Engine Support for Custom IO and Limit Switches

#### [MODIFY] [GcodeExecutionEngine.js](file:///c:/Users/danse/APPS/ddcs-studio-project/ddcs-studio-modular/src/engine/GcodeExecutionEngine.js)
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

#### [MODIFY] [atcChangeWizard.js](file:///c:/Users/danse/APPS/ddcs-studio-project/ddcs-studio-modular/src/wizards/atcChangeWizard.js)
1. **Syntax Fix**: Remove the nested parentheses `( Tool Released )` from the comments which broke the regex comment stripper in the syntax validator.
2. **Standard Alignment**: 
   - Ensure the `G53` moves rely completely on variables and lack `G0` on the same line to match DDCS V1.22 rules (already currently implemented as `G53 Z#3`, but will add comments explaining why).
   - Verify `IF[... EQ ...]` usage via `dialect.js`.

#### [MODIFY] [atcLengthWizard.js](file:///c:/Users/danse/APPS/ddcs-studio-project/ddcs-studio-modular/src/wizards/atcLengthWizard.js)
1. Ensure the probe logic uses `#1922` safety checks and standard `G31` probe variables properly aligned with the community patterns.

#### [MODIFY] [virtualIO.js](file:///c:/Users/danse/APPS/ddcs-studio-project/ddcs-studio-modular/src/virtualIO.js)
1. Export a mapping between numeric DDCS ports (e.g., `4`, `5`) and the descriptive `M3K_TRUTH_TABLE` pin names (e.g., `OUT_SPINDLE_UNCLAMP`, `IN_DRAWBAR_OPEN`) so the engine can look up generic `P` arguments.

## Open Questions
> [!IMPORTANT]
> The engine currently handles `MSETDATA` commands. In standard DDCS macros, port activation is typically done with `M10 Px` / `M11 Px` and input polling with `M31 Px` / `M33 Px`. Are you using `MSETDATA` in any specific macros that I should preserve, or should I primarily focus on `M10`/`M11`/`M31`/`M33` for the virtual IO handshakes?

## Verification Plan
1. Trigger an ATC Tool Change macro through the Engine.
2. Validate that `M10 P4` triggers `virtualIO.js` to begin its 450ms delay.
3. Validate that the engine pauses at `M33 P5` and successfully resumes 450ms later once `virtualIO` sets the sensor state.
4. Verify the syntax checks report `valid: true` without invalid expression errors.
