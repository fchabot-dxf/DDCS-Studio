/**
 * viz/opSimContext.js — the SIM INTENT layer: a declared op-type → preview-render-intent translation.
 *
 * "Declare, never infer" applied to the 3D preview. The render decisions that depend on WHAT KIND OF OP is being
 * previewed — does it need the 4th-axis rotary rig? must it pin to the machine envelope (G53 tool changes)? does it
 * carry an ATC magazine? — used to be scattered as per-wizard-view `preview*(true)` calls, so any GENERIC consumer
 * (the Blocks-tab preview, which renders whatever op is active) silently missed them. This module is the single
 * declared source: every consumer asks `opSimContext(opType)` instead of hard-coding its own slice.
 *
 * The op TYPE decides — NOT the stock shape (a rectangular part on a rotary axis is a valid setup, so the rig is
 * gated on the op, not `stock.shape === 'cylinder'`). Pure + side-effect-free, so it's testable as plain data.
 *
 * Scope (v1): the op-type-driven INTENT flags below. Stock/profile-driven RENDER DETAIL (the actual stock-geometry
 * mesh, the envelope box, the magazine pocket coordinates) stays in the renderer — it consumes these flags + the
 * stock/profile data. A future revision can widen the signature to (opType, stock, profile) and return declared
 * geometry too; today's consumers only need the flags.
 */

// 4th-axis fixture (chuck + tailstock): the rotary probe ops frame a bar/part on the A-axis.
const ROTARY_RIG = new Set(['rotary_clock', 'rotary_center']);
// Pin to the MACHINE frame so the envelope always draws: ATC tool changes are inherently G53 (even when a given
// trace — auto-change with no tool, warmup/drawbar with no motion, the table-write macro — doesn't reach a G53).
// NOTE: a machine-frame-TOOL op (toolMachineFrame — homing, atc_test/change/table) is NOT listed here: it IMPLIES
// forceMachine (a machine-frame tool op always draws the envelope), derived below (t590 E3 — one intent, not three flags).
const FORCE_MACHINE = new Set(['atc_length', 'atc_check', 'atc_warmup', 'atc_change', 'atc_test', 'atc_table']);
// Render the tool in RAW machine coords + ignore the workpiece for collision: homing (a switch-seek). This is THE declared
// "machine-frame op" intent — it IMPLIES forceMachine (draw the envelope) AND seatAtStart (seat the initial position), so an
// op declares it ONCE instead of three coupled flags. (The ATC twins declare toolMachine via their own sim block → USER_INTENT.)
const MACHINE_FRAME_TOOL = new Set(['homing']);
// Carries an ATC magazine (pockets + tool stubs on the envelope): the ops that actually move tools to/from pockets.
const WITH_MAGAZINE = new Set(['atc_change', 'atc_table']);

// Custom ops (user_*) DECLARE their full preview intent — NOTHING is inferred from their motion. userOps registers
// whatever `def.sim` declares (the same way the panel block declares panel type). The axis letter doesn't carry
// intent for an open-world op authored by an unknown user on an unknown machine (A could be a rotary, a non-rotary
// attachment, anything) — a built-in's A-move is safe to read as rotary only because WE authored it. So unlike the
// static sets above (which gate BUILT-IN types we authored), custom ops never guess from atoms. Built-ins use the
// static sets; custom ops use their declared intent; everything else is all-false.
const USER_INTENT = new Map();

/** Register a custom op's declared preview intent (or clear it with intent=null). Called by userOps on
 *  register/delete so a user_* op gets the same preview treatment as a built-in. */
export function setUserSimIntent(opType, intent) {
    if (intent) USER_INTENT.set(opType, intent); else USER_INTENT.delete(opType);
}

/**
 * The declared preview intent for an op type:
 *   - showRotaryRig: show the 4th-axis chuck + tailstock rig.
 *   - forceMachine:  pin to the machine frame (always draw the envelope), regardless of whether the trace hits G53.
 *   - showMagazine:  this op carries an ATC magazine to render (the pocket DATA comes from the profile separately).
 * A registered custom op uses its declared intent; built-ins use the static sets; everything else is all-false
 * (the default local-frame, no-rig, no-magazine preview).
 */
export function opSimContext(opType) {
    // t590 E3 — the "machine-frame op" intent (toolMachineFrame) IMPLIES forceMachine + seatAtStart: a machine-frame tool op
    // always draws the envelope and seats its initial position at the Start. So an op declares ONE intent, not three coupled
    // flags; forceMachine/seatAtStart derive here (byte-identical — homing/the ATC twins already set all three).
    const u = USER_INTENT.get(opType);
    const tmf = u ? !!u.toolMachineFrame : MACHINE_FRAME_TOOL.has(opType);
    return {
        showRotaryRig: u ? !!u.showRotaryRig : ROTARY_RIG.has(opType),
        forceMachine: tmf || (u ? !!u.forceMachine : FORCE_MACHINE.has(opType)),   // machine-frame tool ⟹ force the envelope
        showMagazine: u ? !!u.showMagazine : WITH_MAGAZINE.has(opType),
        toolMachineFrame: tmf,
        seatAtStart: tmf || (u ? !!u.seatAtStart : false),   // machine-frame tool ⟹ seat at the Start (alignment opts in without tmf)
    };
}

/**
 * The UNION intent for a whole PROGRAM (a stack of ops) — for a generic preview (the Blocks tab) that renders
 * multiple ops at once: show the rig if ANY op is rotary, force the envelope if ANY op needs it, etc. A single-op
 * wizard preview just uses opSimContext(op.type) directly. Empty / no ops → the all-false default.
 */
export function programSimContext(opTypes) {
    return (opTypes || []).reduce((acc, t) => {
        const c = opSimContext(t);
        return {
            showRotaryRig: acc.showRotaryRig || c.showRotaryRig,
            forceMachine: acc.forceMachine || c.forceMachine,
            showMagazine: acc.showMagazine || c.showMagazine,
        };
    }, { showRotaryRig: false, forceMachine: false, showMagazine: false });
}
