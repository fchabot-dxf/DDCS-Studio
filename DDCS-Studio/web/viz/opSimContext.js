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
// trace — auto-change with no tool, warmup/drawbar with no motion, the table-write macro — doesn't reach a G53),
// and homing/sysstart is a machine-frame operation.
const FORCE_MACHINE = new Set(['atc_length', 'atc_check', 'atc_warmup', 'atc_change', 'atc_test', 'atc_table', 'homing']);
// Carries an ATC magazine (pockets + tool stubs on the envelope): the ops that actually move tools to/from pockets.
const WITH_MAGAZINE = new Set(['atc_change', 'atc_table']);

/**
 * The declared preview intent for an op type:
 *   - showRotaryRig: show the 4th-axis chuck + tailstock rig.
 *   - forceMachine:  pin to the machine frame (always draw the envelope), regardless of whether the trace hits G53.
 *   - showMagazine:  this op carries an ATC magazine to render (the pocket DATA comes from the profile separately).
 * Unknown / cutting ops get all-false (the default local-frame, no-rig, no-magazine preview).
 */
export function opSimContext(opType) {
    return {
        showRotaryRig: ROTARY_RIG.has(opType),
        forceMachine: FORCE_MACHINE.has(opType),
        showMagazine: WITH_MAGAZINE.has(opType),
    };
}
