/**
 * wizards/ops/saferetract.js — the SHARED SAFE-HEIGHT RETRACT atom (t822).
 *
 * The SYSTEM safety retract to the machine-frame safe-Z margin (safeZframe.js). It REPLACES the error-handler's
 * incremental `G91 / G0 Z#17 / G90` — which, firing from an UNKNOWN Z after a probe MISS, COMPOUNDS into the top
 * switch (the crash the user hit). ONE dialect-agnostic block; the per-post rendering (register vs literal vs
 * work-frame degrade) happens at EMIT time, because the stack is built once and emitMapped renders per controller:
 *   Expert  — G53 needs a #VAR (a literal fails on M350) → read the boot-seeded register #520, with an INLINE
 *             unset-guard (register 0/unset → seed the declared margin, NEVER `G53 Z0` = the top switch). Defense-in-
 *             depth: sysstart.nc OWNS the init; this guard covers a machine that never got the boot push.
 *   V4.1    — no Studio boot macro writes a register (advstart is the honest UNVERIFIED stub) → bake the literal,
 *             staged in a free var (#190) to match the CONFIRMED `G0 G53 Z#var` firmware form.
 *   DM500   — direct G53 is NOT dump-grounded (factory reaches machine frame only via M98 P100/P101 subprograms;
 *             the #395 gate is a setting NAME, not usage) → DEGRADE to an ABSOLUTE WORK-FRAME clearance (kills the
 *             compounding crash vector) + an honest comment. DM500-direct-G53-confirm is on the user-gated list.
 *   grbl / rs274 / centroid — the DEFAULT below: machine-frame `G53 [G0] Z<margin>` via dialect.machineMove (a
 *             literal coord is native there). No register, no boot — the emit is the one source.
 * The margin RESOLVES to a number in the block params at build time (valid-by-construction; safeZMarginNeg()).
 */
import { num, r3 } from './util.js';
import { SAFEZ_MARGIN_DEFAULT, wrapMachineFrame, clearModeOf } from './safeZframe.js';
import { distModeBlock } from './distmode.js';
import { moveBlock } from './move.js';

// t913 B2b-1 — the CLEARANCE HOP atom: a capped relative lift for a planned traverse (the 'hop' clearance mode). Folds per
// post at emit: Expert (dialect.safeHop) emits the IF/GOTO cap (lift to min(saved probe Z + hopDist, machine margin)); posts
// with NO real flow-skip (grbl 'none', rs274 O-word-runs-not-skips, centroid) DEGRADE to a plain relative hop + an honest
// 'uncapped on this post' comment (byte-safe = the pre-B2a relative form). The paired G53 return (safeTraverseStack emitDrop →
// safeZParkBlock ret) brings the tool back to the SAVED probe Z on every post, so the hop nets zero by construction. HIDDEN
// from the palette (wizard-composed only, like safetraverse). The guard/cap LABELS are rewritten unique per program by
// uniquifySafeRetractLabels (blockEmitter) before the fold, so several hops never collide their forward-jump labels.
export const safeHopBlock = {
    type: 'safehop', label: 'Clearance Hop', kind: 'leaf', category: 'Move', hidden: true,
    defaults: { hopDist: 15, saveVar: '#95', margin: -SAFEZ_MARGIN_DEFAULT, guardLabel: 82, capLabel: 83 },
    fields: ['hopDist', 'saveVar', 'margin', 'guardLabel', 'capLabel'],
    scratch: [[95, 95]],   // t1085 — the saved-machine-Z var. The DIALECT's safeHop declares its own extra scratch (Expert #42/#43, V4.1 #190/#191)
    emit: (p, dx, dy, dialect) => {
        const opts = {
            hopDist: r3(num(p.hopDist, 15)), saveVar: p.saveVar || '#95',
            margin: r3(num(p.margin, -SAFEZ_MARGIN_DEFAULT)), guardLabel: num(p.guardLabel, 82), capLabel: num(p.capLabel, 83),
        };
        // Expert (and any post that defines safeHop) — the capped machine-frame hop → G90-wrap the G53 (t856).
        if (dialect && typeof dialect.safeHop === 'function') return wrapMachineFrame(dialect, dialect.safeHop(opts), p.restore);
        // DEGRADE — no cap flow on this controller: a plain RELATIVE hop + the honest note. NO G53 → no wrap; the paired G53
        // return (emitDrop) still nets it back to the saved Z (the return is absolute-to-saved, honest regardless of the lift).
        return [`( Clearance hop ${opts.hopDist}mm - uncapped on this controller )`, `G0 Z${opts.hopDist}`];
    },
};

// t901 — the SAFETRAVERSE BUNDLE atom: a declared block that COMPOSES a safe-height lift (saferetract) + shaped XY travel +
// a descend/return onto the target (reusing the t897 save/return-Z pairing). A TRANSPARENT container — its children ARE the
// composed atoms (built by safeTraverseStack), and blockEmitter emits them in order (byte-identical to the inline builder it
// wraps; NO marker in the live projection). One brick in Blocks; the primitives stay first-class (wizards use the bundle,
// machinists author from primitives). `emit` here is the childless fallback ([]); the real lines come from its children.
export const safeTraverseBlock = {
    type: 'safetraverse', label: 'Safe Traverse', kind: 'leaf', category: 'Move',
    defaults: { to: 'wall2', shape: 'dogleg' }, fields: ['to', 'shape'],
    // t903 — HIDDEN from the DRAGGABLE palette/toolbox until P2.5 makes it standalone-functional (a childless drop is inert;
    // no broken affordance ships — the empty-dropdown lesson). It STAYS in BLOCKS (newBlock, wizard-composed use) + keeps its
    // Blockly def (so a wizard-composed safetraverse brick still renders). The flag is read by buildToolbox + the Blocks palette.
    hidden: true,
    emit: () => [],
};

export const safeRetractBlock = {
    type: 'saferetract', label: 'Safe-Z Retract', kind: 'leaf', category: 'Move',
    // margin = the machine-frame margin as a NEGATIVE machine Z (below home); workClear = the work-frame clearance var
    // for the DM500 degrade (the wizard's own safe-Z); label = the Expert unset-guard's forward-jump label.
    defaults: { margin: -SAFEZ_MARGIN_DEFAULT, workClear: '#17', label: 91 }, fields: ['margin', 'workClear', 'label'],
    scratch: [[17, 17]],   // t1085 — the work-frame clearance var read on the DM500 degrade
    emit: (p, dx, dy, dialect) => {
        const opts = { margin: r3(num(p.margin, -SAFEZ_MARGIN_DEFAULT)), workClear: p.workClear || '#17', label: num(p.label, 91) };
        const core = (dialect && typeof dialect.safeRetract === 'function')
            ? dialect.safeRetract(opts)
            // DEFAULT — machine-frame rapid to the literal margin (grbl/rs274/centroid: a literal G53 coord is native).
            : ['( Safe-Z retract - machine frame )', ...dialect.machineMove('Z', String(opts.margin))];
        // t856 SAFETY — the retract's G53 must run under G90 (a G53-under-G91 could move INCREMENTALLY). Force G90
        // explicit before it on EVERY post; restore G91 when the surrounding body is incremental (p.restore='inc').
        return wrapMachineFrame(dialect, core, p.restore);
    },
};

// t931 B2b-2c (Option B) — the CLEARLIFT FOLDING ATOM: ONE leaf whose EMIT folds max / hop / plane on its VALUE params
// (clearMode/hopDist/planeZ), so a data-op carries ONE block and re-emits the chosen mode with NO structural fork and NO
// spurious assign #var (the corner M2-template fit; unifies the corner+middle clearance-lift DECLARE, in the safehop/
// saferetract/safetraverse vocabulary). It DELEGATES to the existing atom emits so the G-code is BYTE-IDENTICAL to the
// clearLiftNodes it replaces: max → safeRetractBlock (the #520 machine margin), hop → safeHopBlock (the capped hop), plane →
// distmode/move (the absolute work-Z). Its guard/cap labels are uniquified per the resolved clearMode (max=1 / hop=2 /
// plane=0) by uniquifySafeRetractLabels. HIDDEN (wizard-composed only). The paired save (#95) + the G53 return are the
// CALLER's (corner probeWallR / middle safeTraverseStack), so this block emits ONLY the lift.
export const clearLiftBlock = {
    type: 'clearlift', label: 'Clearance Lift', kind: 'leaf', category: 'Move', hidden: true,
    defaults: { clearMode: 'hop', hopDist: 15, planeZ: 10, saveVar: '#95', margin: -SAFEZ_MARGIN_DEFAULT, workClear: '#17', guardLabel: 91, capLabel: 92 },   // t941 B2b-4 — default hop (a bare clearlift block; the callers pass clearMode explicitly)
    fields: ['clearMode', 'hopDist', 'planeZ', 'saveVar', 'margin', 'workClear', 'guardLabel', 'capLabel', 'planeFellBack'],
    scratch: [[17, 17], [95, 95]],   // t1085 — it resolves to the retract (#17) or the hop (#95) depending on clearMode, so it owns both
    emit: (p, dx, dy, dialect) => {
        const mode = clearModeOf(p.clearMode);
        // t961 — the plane-guarantee backstop: when Plane was requested but not guaranteed (WCS!=Active or no Z-datum-first), the
        // caller folded it to Hop and set planeFellBack → emit an honest comment (defense-in-depth; the same param on both the
        // form path (clearLiftNode) and the twin path (postInstantiate) → byte-identical).
        const lead = p.planeFellBack ? ['( Clearance plane needs the Active WCS + a Z datum - using Hop )'] : [];
        if (mode === 'hop') return [...lead, ...safeHopBlock.emit({ hopDist: p.hopDist, saveVar: p.saveVar, margin: p.margin, guardLabel: p.guardLabel, capLabel: p.capLabel, restore: p.restore }, dx, dy, dialect)];
        if (mode === 'plane') return [...distModeBlock.emit({ dist: 'abs' }), ...moveBlock.emit({ mode: 'rapid', z: String(r3(num(p.planeZ, 10))) }, dx, dy, dialect), ...distModeBlock.emit({ dist: 'inc' })];
        // 'max' — delegate to the safe-Z retract (byte-identical to a direct safeRetractNode; the guardLabel is the #520 unset-guard label)
        return [...lead, ...safeRetractBlock.emit({ margin: p.margin, workClear: p.workClear, label: p.guardLabel, restore: p.restore }, dx, dy, dialect)];
    },
};
