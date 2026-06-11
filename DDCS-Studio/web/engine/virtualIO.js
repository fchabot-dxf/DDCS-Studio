/**
 * virtualIO.js — Virtual I/O State Registry & Handshake Truth Table
 *
 * Simulates digital hardware I/O handshakes for the DDCS Expert M350 when no
 * real controller is connected. This lets the Studio execution engine run macro
 * sequences (ATC, spindle clamp/unclamp, drawbar, etc.) end-to-end without
 * requiring physical hardware.
 *
 * Architecture:
 *   - ioState         : live Map-based state for all virtual outputs + inputs.
 *   - M3K_TRUTH_TABLE : declarative rules — "when output X fires, flip input Y
 *                       after delayMs milliseconds" — derived from Golden Run logs.
 *   - setVirtualOutput: the main entry point. Called by the execution engine
 *                       whenever a macro output assignment is evaluated.
 *   - triggerVirtualHandshake: fires the physical-travel delay, then sets the
 *                       responding input and dispatches an `io_change` CustomEvent
 *                       that unblocks any wait loops in the execution engine.
 *   - resetVirtualIO  : call at the start of every new program run.
 *
 * Integration point:
 *   When the Studio execution engine evaluates an MSETDATA or macro variable
 *   assignment that corresponds to a digital output, it should call:
 *
 *       import { setVirtualOutput } from './virtualIO.js';
 *       setVirtualOutput('OUT_SPINDLE_UNCLAMP', true);
 *
 *   The engine can then listen for confirmation:
 *
 *       window.addEventListener('io_change', (e) => {
 *           if (e.detail.pin === 'IN_DRAWBAR_OPEN' && e.detail.state === true) {
 *               // handshake received — resume macro execution
 *           }
 *       });
 *
 * Controller target: DDCS Expert M350 (studio machine — Ultimate Bee 1010).
 * Do NOT assume these mappings apply to the bench V4.1 — Modbus serial is
 * absent on the V4.1 firmware. (See controllers/README.md in ddcs-pc-bridge.)
 *
 * Confidence: [HYPOTHESIS] — pin names and delays are estimated from sniffed
 * Golden Run logs. Tag confirmed mappings with [CONFIRMED] once bench-tested.
 */

// ---------------------------------------------------------------------------
// I/O State Registry
// ---------------------------------------------------------------------------

/**
 * Live virtual I/O state.
 * @type {{ outputs: Map<string, boolean>, inputs: Map<string, boolean> }}
 */
export const ioState = {
    /** Digital outputs — things the controller commands (e.g. solenoids, relays) */
    outputs: new Map(),
    /** Digital inputs — sensor feedback lines (e.g. limit switches, proximity sensors) */
    inputs: new Map(),
};

// ---------------------------------------------------------------------------
// Hardware Pin Mapping
// ---------------------------------------------------------------------------

/**
 * Maps raw physical pin numbers (e.g. from M10 P4 or M31 P5) to the semantic
 * virtual I/O names used in the truth table.
 */
export const HARDWARE_PIN_MAP = {
    OUT_4: 'OUT_SPINDLE_UNCLAMP',
    OUT_5: 'OUT_SPINDLE_CLAMP',
    IN_4: 'IN_PROBE',          // Standard probe input
    IN_5: 'IN_DRAWBAR_CLOSED', // Clamp sensor (Wizard default)
    IN_6: 'IN_DRAWBAR_OPEN',   // Unclamp sensor
};

/**
 * Helper to resolve a raw pin number and mode to a virtual pin name.
 * @param {number} port - The P argument from M-codes
 * @param {'IN'|'OUT'} mode - Whether this is an input or output port
 * @returns {string} The semantic pin name, or a fallback (e.g. "OUT_99")
 */
export function resolveVirtualPin(port, mode) {
    const key = `${mode}_${port}`;
    return HARDWARE_PIN_MAP[key] || key;
}

// ---------------------------------------------------------------------------
// Truth Table
// ---------------------------------------------------------------------------

/**
 * M3K_TRUTH_TABLE — declarative handshake rules.
 *
 * Each key is a digital output pin name. When that output is asserted (set true),
 * the rule describes which input sensor responds, how long physical travel takes,
 * and what state the sensor lands in.
 *
 * delayMs: simulates real-world pneumatic/mechanical travel time.
 *   ATC pneumatics: ~400–600 ms (source: Golden Run log timestamps [HYPOTHESIS])
 *   Drawbar:        ~300–500 ms ([HYPOTHESIS])
 *
 * Add new rows as you confirm mappings from the sniffed Golden Run logs.
 */
const M3K_TRUTH_TABLE = {
    // -----------------------------------------------------------------------
    // ATC / Spindle clamp cycle
    // -----------------------------------------------------------------------

    /** Unclamp solenoid fires → drawbar open sensor confirms */
    OUT_SPINDLE_UNCLAMP: {
        targetInput: 'IN_DRAWBAR_OPEN',
        delayMs: 450,            // [HYPOTHESIS] pneumatic travel time ~450 ms
        setState: true,
        description: 'Spindle unclamp solenoid → drawbar-open proximity sensor',
        sideEffects: [
            { pin: 'IN_DRAWBAR_CLOSED', state: false },
        ],
    },

    /** Unclamp solenoid turns off (single acting) → drawbar closed sensor confirms */
    OUT_SPINDLE_UNCLAMP_OFF: {
        targetInput: 'IN_DRAWBAR_CLOSED',
        delayMs: 400,            // [HYPOTHESIS] pneumatic travel time
        setState: true,
        description: 'Spindle unclamp solenoid OFF → drawbar-closed proximity sensor',
        sideEffects: [
            { pin: 'IN_DRAWBAR_OPEN', state: false },
        ],
    },

    /** Clamp solenoid fires → drawbar closed sensor confirms */
    OUT_SPINDLE_CLAMP: {
        targetInput: 'IN_DRAWBAR_CLOSED',
        delayMs: 400,            // [HYPOTHESIS]
        setState: true,
        description: 'Spindle clamp solenoid → drawbar-closed proximity sensor',
        // Side effect: clamp also de-asserts the open sensor
        sideEffects: [
            { pin: 'IN_DRAWBAR_OPEN', state: false },
        ],
    },

    // -----------------------------------------------------------------------
    // ATC magazine carousel
    // -----------------------------------------------------------------------

    /** Carousel advance command → carousel-at-position sensor */
    OUT_CAROUSEL_ADVANCE: {
        targetInput: 'IN_CAROUSEL_AT_POS',
        delayMs: 600,            // [HYPOTHESIS] motor + decel time
        setState: true,
        description: 'Carousel advance → carousel-at-position proximity sensor',
    },

    /** Carousel retract (home) */
    OUT_CAROUSEL_RETRACT: {
        targetInput: 'IN_CAROUSEL_AT_HOME',
        delayMs: 600,            // [HYPOTHESIS]
        setState: true,
        description: 'Carousel retract → carousel-at-home proximity sensor',
    },

    // -----------------------------------------------------------------------
    // DDCS native ATC dialect (M154/M155 drawbar · M300/M302-304 sensors · M305/306 cover)
    // Ports for these are CONFIGURED ON THE CONTROLLER (params #1120-#1199, #1250-52),
    // so the sim models them as semantic pins, not numbered ones.
    // -----------------------------------------------------------------------

    /** M154 — tool release output ON → collet opens */
    OUT_TOOL_RELEASE: {
        targetInput: 'IN_TOOL_OPEN',         // M303 waits on this
        delayMs: 450,
        setState: true,
        description: 'M154 tool release → tool-open sensor',
        sideEffects: [
            { pin: 'IN_TOOL_LOCKED', state: false },
            { pin: 'IN_TOOL_CLOSED', state: false },
        ],
    },

    /** M155 — tool release output OFF (lock) → collet clamps */
    OUT_TOOL_RELEASE_OFF: {
        targetInput: 'IN_TOOL_LOCKED',       // M302 waits on this
        delayMs: 400,
        setState: true,
        description: 'M155 tool lock → tool-locked sensor',
        sideEffects: [
            { pin: 'IN_TOOL_OPEN', state: false },
            { pin: 'IN_TOOL_CLOSED', state: true },   // M304 waits on this
        ],
    },

    /** M305 — dust cover open */
    OUT_DUST_COVER: {
        targetInput: 'IN_DUST_COVER_OPEN',
        delayMs: 600,
        setState: true,
        description: 'M305 dust cover open → cover sensor',
    },

    /** M306 — dust cover close */
    OUT_DUST_COVER_OFF: {
        targetInput: 'IN_DUST_COVER_OPEN',
        delayMs: 600,
        setState: false,
        description: 'M306 dust cover close → cover sensor releases',
    },

    /** M3/M4 — spindle running → "stopped" sensor drops */
    OUT_SPINDLE: {
        targetInput: 'IN_SPINDLE_STOPPED',
        delayMs: 100,
        setState: false,
        description: 'Spindle start → spindle-stopped sensor clears',
    },

    /** M5 — spindle off → spins down, then the stopped sensor confirms (M300 waits on it) */
    OUT_SPINDLE_OFF: {
        targetInput: 'IN_SPINDLE_STOPPED',
        delayMs: 800,
        setState: true,
        description: 'Spindle stop → spindle-stopped sensor (spin-down)',
    },

    // -----------------------------------------------------------------------
    // Air blast / coolant
    // -----------------------------------------------------------------------

    /** Air-blast valve open → pressure-present sensor (near-instant) */
    OUT_AIR_BLAST: {
        targetInput: 'IN_AIR_PRESSURE_OK',
        delayMs: 80,             // [HYPOTHESIS] valve open time
        setState: true,
        description: 'Air-blast valve → air-pressure-present sensor',
    },

    // -----------------------------------------------------------------------
    // Probe collision detection
    // -----------------------------------------------------------------------

    /** Probe attempted to exceed stock bounds → collision alarm flags (no delay) */
    PROBE_COLLISION: {
        targetInput: 'IN_PROBE_COLLISION',
        delayMs: 0,              // Immediate — no physical travel
        setState: true,
        description: 'Probe hit stock boundary → collision alarm',
    },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Pending handshake timers — cancelled on reset so a previous run's in-flight
 *  pneumatic delay can't flip a sensor in the middle of the next run. */
const _pendingHandshakes = new Set();

/**
 * Reset all virtual I/O state. Call this at the start of every new program run
 * to avoid stale sensor states from a previous execution bleeding into the next.
 */
export function resetVirtualIO() {
    for (const id of _pendingHandshakes) clearTimeout(id);
    _pendingHandshakes.clear();
    ioState.outputs.clear();
    ioState.inputs.clear();
    console.log('[VIRTUAL IO] State reset — all pins cleared.');
}

/**
 * Set a virtual digital output and trigger any matching handshake simulation.
 *
 * This is the primary integration point. The Studio execution engine should call
 * this whenever it evaluates a macro assignment that drives a physical output.
 *
 * @param {string}  pin   - Output pin name (must match an M3K_TRUTH_TABLE key to trigger simulation)
 * @param {boolean} value - New state for the output
 */
export function setVirtualOutput(pin, value) {
    const prev = ioState.outputs.get(pin);
    ioState.outputs.set(pin, value);

    if (prev !== value) {
        console.log(`[VIRTUAL IO] Output ${pin}: ${prev ?? 'undefined'} → ${value}`);
    }

    triggerVirtualHandshake(pin, value);
}

/**
 * Read the current state of a virtual input pin.
 *
 * Execution engine wait loops should poll this (or listen to `io_change` events)
 * rather than accessing ioState.inputs directly, so the interface stays stable.
 *
 * @param {string} pin - Input pin name
 * @returns {boolean} Current state, or false if pin has never been set
 */
export function getVirtualInput(pin) {
    return ioState.inputs.get(pin) ?? false;
}

/**
 * Forcibly set a virtual input pin — for test injection and debug overrides.
 * This bypasses the truth-table delay and fires `io_change` immediately.
 *
 * @param {string}  pin   - Input pin name
 * @param {boolean} state - State to inject
 */
export function injectVirtualInput(pin, state) {
    ioState.inputs.set(pin, state);
    console.log(`[VIRTUAL IO] Injected input ${pin} = ${state}`);
    _dispatchIoChange(pin, state);
}

/**
 * Simulate the physical handshake when an output fires.
 *
 * Looks up the output pin in M3K_TRUTH_TABLE, waits `delayMs` milliseconds
 * (simulating pneumatic/mechanical travel), then:
 *   1. Sets the responding input in ioState.inputs
 *   2. Applies any declared side-effects
 *   3. Dispatches an `io_change` CustomEvent on window so the execution engine
 *      can unblock any wait loops that are watching for this input.
 *
 * @param {string} outputPin - The output pin that just changed to true
 * @param {boolean} state - The new state of the output pin
 */
export function triggerVirtualHandshake(outputPin, state = true) {
    // Check for a rule specific to the state (e.g., 'OUT_SPINDLE_UNCLAMP_OFF')
    const stateRuleKey = `${outputPin}_${state ? 'ON' : 'OFF'}`;
    const rule = M3K_TRUTH_TABLE[stateRuleKey] || (state === true ? M3K_TRUTH_TABLE[outputPin] : null);

    if (!rule) {
        // No simulation rule for this transition.
        return;
    }

    console.log(
        `[VIRTUAL IO] Output ${outputPin} (${state ? 'ON' : 'OFF'}). ` +
        `Simulating ${rule.description} with ${rule.delayMs} ms delay…`
    );

    const id = setTimeout(() => {
        _pendingHandshakes.delete(id);
        ioState.inputs.set(rule.targetInput, rule.setState);
        console.log(`[VIRTUAL IO] Input ${rule.targetInput} → ${rule.setState} (handshake complete)`);
        _dispatchIoChange(rule.targetInput, rule.setState);

        if (rule.sideEffects) {
            for (const fx of rule.sideEffects) {
                ioState.inputs.set(fx.pin, fx.state);
                console.log(`[VIRTUAL IO] Side-effect: input ${fx.pin} → ${fx.state}`);
                _dispatchIoChange(fx.pin, fx.state);
            }
        }
    }, rule.delayMs);
    _pendingHandshakes.add(id);
}

/**
 * Trigger a probe collision alarm (when a probe attempts to exceed stock bounds).
 * Sets IN_PROBE_COLLISION input and dispatches io_change event.
 * Execution continues — this is just a flag for the macro to detect.
 */
export function triggerProbeCollision() {
    const pin = 'IN_PROBE_COLLISION';
    ioState.inputs.set(pin, true);
    console.log(`[VIRTUAL IO] Probe collision detected — alarm ${pin} asserted`);
    _dispatchIoChange(pin, true);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Dispatch the standard `io_change` CustomEvent on window.
 * Execution engine wait loops listen for this to unblock.
 *
 * @param {string}  pin   - The pin that changed
 * @param {boolean} state - Its new state
 */
function _dispatchIoChange(pin, state) {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(
            new CustomEvent('io_change', {
                detail: { pin, state },
                bubbles: false,
                cancelable: false,
            })
        );
    }
}

// ---------------------------------------------------------------------------
// Debug helpers (console-accessible via window.virtualIO in dev)
// ---------------------------------------------------------------------------

/**
 * Expose a debug handle on window in non-production builds.
 * Allows manual testing from the browser console:
 *   window.virtualIO.setOutput('OUT_SPINDLE_UNCLAMP', true)
 *   window.virtualIO.dumpState()
 */
if (typeof window !== 'undefined') {
    window.virtualIO = {
        setOutput: setVirtualOutput,
        getInput: getVirtualInput,
        injectInput: injectVirtualInput,
        reset: resetVirtualIO,
        dumpState() {
            console.group('[VIRTUAL IO] Current state');
            console.log('Outputs:', Object.fromEntries(ioState.outputs));
            console.log('Inputs: ', Object.fromEntries(ioState.inputs));
            console.groupEnd();
        },
        truthTable: M3K_TRUTH_TABLE,
    };
}
