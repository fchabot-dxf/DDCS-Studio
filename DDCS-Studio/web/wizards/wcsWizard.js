/**
 * DDCS Studio - WCS (Work Coordinate System) Wizard
 *
 * REWRITTEN AS A BLOCK STACK: the wizard's only implementation is `wcsStack(params)` → ONE dialect-aware `wcszero` atom,
 * emitted bare (a macro snippet, not a cutting program). The form and the Blocks view are two editors of this one stack.
 *
 * t475 — DIALECT-AWARE: the whole WCS-set flow rides the `wcszero` atom (dialect.wcsZeroAtCurrent), resolved PER-POST at
 * EMIT — M350: direct #805+ register writes (dump-grounded: SAVE_WCS_XY_AUTO/COPY_WCS, byte-identical to the old emit);
 * rs274/grbl: G10 L20; v41/dm500: G90 G92. This replaced the old build-time getDialect + M350-hardcoded #880 assigns that
 * leaked M350 registers onto every controller. The auto|fixed × axes × sync forks are COMPUTED inside the atom.
 */
import { newBlock, emitMapped } from '../blocks/blockEmitter.js';
import { recordOp } from '../blocks/opRecord.js';
import { resolveActivePost } from './dialects/index.js';
import { getActiveProfile } from '../shared/js/profiles/controllerProfiles.js';

/** WCS params → [ wcszero ]. The one source of truth for both displays. */
export function wcsStack(params = {}) {
    const b = newBlock('wcszero');
    b.params = { sys: params.sys || '0', axisX: !!params.axisX, axisY: !!params.axisY, axisZ: !!params.axisZ, sync: !!params.sync, slave: params.slave || '3' };
    return [b];
}

export class WCSWizard {
    constructor() {
        this.wcsBaseMap = { '54': 805, '55': 810, '56': 815, '57': 820, '58': 825, '59': 830 };
    }

    generate(params) {
        recordOp('wcs', params);   // let the Blocks tab open this op as its stack
        // Preview the ACTIVE post's WCS-set (the wcszero atom is dialect-aware at emit) — reflects a post override the same
        // way the old build-time getDialect did, so a v41/rs274 profile shows its G92 / G10 form, not the M350 default.
        let dialect = null; try { dialect = resolveActivePost(getActiveProfile().id); } catch (_) { /* default */ }
        return emitMapped(wcsStack(params), dialect ? { dialect } : {}).text;   // a snippet: no Program Start/End blocks
    }

    getWCSName(sys) { return sys === '0' ? 'Active WCS' : `G${sys}`; }
    getWCSBase(sys) { return sys === '0' ? 'Auto-detected' : (this.wcsBaseMap[sys] || 'Unknown'); }
    isValidWCS(sys) { return sys === '0' || (sys >= '54' && sys <= '59'); }
}
