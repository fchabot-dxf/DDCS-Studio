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

// t714 (R-A) — the ONE DECLARED table for the BUILT-IN op types, mirroring EXACTLY what each op's data-twin declares in
// its `def.sim` block (userOps resolveSimMeta: rotary→rig, machine→forceMachine, magazine→showMagazine, toolMachine→tmf,
// seatStart→seat). The built-in VIEWS now READ opSimContext(type) instead of hard-coding preview*(true), so the built-in
// and the twin get the SAME intent BY CONSTRUCTION — retiring the imperative-vs-declared drift (the alignment-seat class).
// 4th-axis fixture (chuck + tailstock): the rotary probe ops frame a bar/part on the A-axis.
const ROTARY_RIG = new Set(['rotary_clock', 'rotary_center']);
// Pin to the MACHINE frame so the envelope always draws (forceMachine ONLY — not the machine-frame-TOOL ops below, which
// derive forceMachine from tmf). ONLY the ATC no-tool-move ops are machine-frame here. The PROBE ops (corner/edge/middle/
// alignment/rotary) are PART-frame — they probe the datum-placed stock; their twins' old sim{machine:true} was declared-but-
// DEAD (the pre-t714 applySimIntent ignored plain forceMachine), and t714's R-B #7 (which honors it) would wrongly force the
// envelope on them — so those twin declarations were corrected to machine:false + they are NOT listed here.
const FORCE_MACHINE = new Set(['atc_length', 'atc_check', 'atc_warmup']);
// Render the tool in RAW machine coords + ignore the workpiece for collision (a G53 machine-frame tool op). This is THE
// declared "machine-frame op" intent — it IMPLIES forceMachine (draw the envelope) AND seatAtStart (seat the initial
// position), so an op declares it ONCE instead of three coupled flags. Mirrors the twins' sim{toolMachine:true}.
const MACHINE_FRAME_TOOL = new Set(['homing', 'atc_change', 'atc_test', 'atc_table']);
// Carries an ATC magazine (pockets + tool stubs on the envelope): the ops that actually move tools to/from pockets, plus
// warmup (its twin declares magazine:true — the rack tiles). Mirrors the twins' sim{magazine:true}.
const WITH_MAGAZINE = new Set(['atc_change', 'atc_table', 'atc_test', 'atc_warmup']);
// SEAT the trace/engine initial position at the Start (marker A) WITHOUT the machine-frame tool render — an in-place probe
// on the part frame whose drawn path must begin at A, not origin (alignment; the twin declares sim{seatStart:true}, t570).
const SEAT_AT_START = new Set(['alignment']);
// t1203 (USER RULING — [[probes-never-read-wcs]]): a PROBE op probes FOR the WCS, so it must NEVER map its picture through
// the DECLARED WCS table — that table describes a DIFFERENT (previously measured, possibly stale) setup, not the one being
// previewed. Its machine-frame G53 excursions render via the honest margin approximation (g53ApproxForViz) EVEN WHEN a WCS
// row is declared. Declared per-type here (never inferred from probe ATOMS: atc_length/atc_check push raw probe atoms but
// are machine-frame tool-setter ops, and inference would contradict this module's own doctrine below).
const PROBES_FOR_WCS = new Set(['corner', 'edge', 'middle', 'alignment', 'rotary_clock', 'rotary_center']);

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
        seatAtStart: tmf || SEAT_AT_START.has(opType) || (u ? !!u.seatAtStart : false),   // machine-frame tool ⟹ seat; alignment seats WITHOUT tmf
        probesForWcs: u ? !!u.probesForWcs : PROBES_FOR_WCS.has(opType),   // t1203 — this op PRODUCES the WCS → never render through the declared table
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
            toolMachineFrame: acc.toolMachineFrame || c.toolMachineFrame,   // t714 (R-B #6) — keep the full intent in the union so a whole-program consumer (editor/Blocks) can seat + machine-frame the tool
            seatAtStart: acc.seatAtStart || c.seatAtStart,
            probesForWcs: acc.probesForWcs || c.probesForWcs,   // t1203 — ANY probe op in the program ⟹ don't render through the declared WCS table
        };
    }, { showRotaryRig: false, forceMachine: false, showMagazine: false, toolMachineFrame: false, seatAtStart: false, probesForWcs: false });
}

/**
 * t756 (R-C) — THE ONE seam that applies a WHOLE-PROGRAM declared intent to a preview PANEL (the shared
 * createPreviewPanel return). Both the EDITOR preview and the BLOCKS preview call this with their program's op types,
 * so editor == Blocks == wizard BY CONSTRUCTION (they all resolve from opSimContext / programSimContext; the wizard
 * single-op views use the mgr-based applyPreviewIntent, same source). Retires the imperative per-flag preview calls
 * (the Blocks tab's setRotaryFixture-only, the editor's nothing) → one declared apply. The panel setters early-return
 * when unchanged, so this is idempotent + re-entrancy-safe to call on every render.
 */
export function applyProgramIntent(panel, opTypes) {
    if (!panel) return;
    const ctx = programSimContext(opTypes);
    try {
        if (panel.setRotaryFixture) panel.setRotaryFixture(!!ctx.showRotaryRig);          // 4th-axis rig if ANY op is rotary
        if (panel.setForceMachine) panel.setForceMachine(!!ctx.forceMachine);            // envelope/machine frame (ATC/homing)
        if (panel.setToolMachineFrame) panel.setToolMachineFrame(!!ctx.toolMachineFrame);  // raw-machine-coords tool (G53)
        if (panel.setSeatAtStart) panel.setSeatAtStart(!!ctx.seatAtStart);               // seat the initial pos at the Start (alignment)
        if (panel.setProbesForWcs) panel.setProbesForWcs(!!ctx.probesForWcs);            // t1203 — a probe program never renders through the declared WCS table
    } catch (_) { /* a panel may lack a setter — harmless */ }
}
