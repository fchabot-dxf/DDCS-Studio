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
import { SAFEZ_MARGIN_DEFAULT, wrapMachineFrame } from './safeZframe.js';

export const safeRetractBlock = {
    type: 'saferetract', label: 'Safe-Z Retract', kind: 'leaf', category: 'Move',
    // margin = the machine-frame margin as a NEGATIVE machine Z (below home); workClear = the work-frame clearance var
    // for the DM500 degrade (the wizard's own safe-Z); label = the Expert unset-guard's forward-jump label.
    defaults: { margin: -SAFEZ_MARGIN_DEFAULT, workClear: '#17', label: 91 }, fields: ['margin', 'workClear', 'label'],
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
