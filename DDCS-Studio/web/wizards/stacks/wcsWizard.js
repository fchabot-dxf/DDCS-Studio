/**
 * wizards/stacks/wcsWizard.js — WCS (Work Coordinate System)
 *
 * REWRITTEN AS A BLOCK STACK: the wizard's only implementation is `wcsStack(params)` → ONE dialect-aware `wcszero` atom,
 * emitted bare (a macro snippet, not a cutting program). The form and the Blocks view are two editors of this one stack.
 *
 * t475 — DIALECT-AWARE: the whole WCS-set flow rides the `wcszero` atom (dialect.wcsZeroAtCurrent), resolved PER-POST at
 * EMIT — M350: direct #805+ register writes (dump-grounded: SAVE_WCS_XY_AUTO/COPY_WCS, byte-identical to the old emit);
 * rs274/grbl: G10 L20; v41/dm500: G90 G92. This replaced the old build-time getDialect + M350-hardcoded #880 assigns that
 * leaked M350 registers onto every controller. The auto|fixed × axes × sync forks are COMPUTED inside the atom.
 */
import { newBlock } from '../../blocks/blockEmitter.js';

/** WCS params → [ wcszero ]. The one source of truth for both displays. */
export function wcsStack(params = {}) {
    const b = newBlock('wcszero');
    b.params = { sys: params.sys || '0', axisX: !!params.axisX, axisY: !!params.axisY, axisZ: !!params.axisZ, sync: !!params.sync, slave: params.slave || '3' };
    return [b];
}
