/**
 * wizards/ops/setworkoffset.js — SET WCS OFFSET (Machine): write the active WCS axis offset = value.
 *
 * The G10-equivalent that probe routines end with (distinct from `wcs`, which only SELECTS G54-59).
 * PROFILE-AWARE: Expert → indirect `#[805+[wcs-1]*5+ax]=value`; V4.1/DM500 → `G90 G92 <axis>value`;
 * RS274NGC → `G10 L20 P<wcs> <axis>value`. `wcs` defaults to `#578` (the active-WCS index).
 */
import { num } from './util.js';
import { wrapMachineFrame } from './safeZframe.js';   // t1868 — the ONE declared modal-restore mechanism, reused not hand-rolled

/** Resolve a WCS selector to the emit-form index, IDEMPOTENTLY — the SAFETY NET so no block can leak the raw word into
 *  the G-code: `active` → the active-WCS register `#578` · `G54`..`G59` → the 1-based index (Gnn − 53) · an ALREADY-
 *  resolved value (`#578` / a plain index / a `#var` / an expression) passes THROUGH UNCHANGED. The wizard already bakes
 *  this upstream (mkSWO's `wcsArg`, rotaryCenterWizard.js:48) so EVERY existing emit stays BYTE-IDENTICAL across all
 *  dialects; only a block carrying a RAW `active`/`Gnn` (a Blocks edit / an older loaded program) is resolved here
 *  instead of emitting the unrecognized word (`active` outside a comment → the DDCS parser rejects it). VALID-BY-
 *  CONSTRUCTION: resolution lives in the atom's emit, so it cannot be bypassed by any path that feeds the block a raw wcs. */
export function resolveWcsIndex(wcs) {
    if (wcs === 'active') return '#578';
    const m = /^G(\d+)$/.exec(String(wcs == null ? '' : wcs).trim());
    if (m) return String(parseInt(m[1], 10) - 53);
    return wcs;   // already resolved (#578 / index / expression / #var) → unchanged (idempotent)
}

/** THE WCS SELECTOR VOCABULARY, declared where the resolver above defines its meaning — the ONE list, imported by the
 *  Blockly bridge for its `wcs` dropdown instead of a second hand-typed copy. `WCS_SELECTORS` is the selector form a
 *  wizard offers; `WCS_SELECTORS_REG` adds the already-resolved active-WCS REGISTER `#578`, which the two atoms that
 *  default to it must be able to hold (t1520 — a dropdown that cannot represent its own atom's default silently
 *  rewrites it on the way through the canvas). */
export const WCS_SELECTORS = ['active', 'G54', 'G55', 'G56', 'G57', 'G58', 'G59', 'G59P1', 'G59P2', 'G59P3', 'G59P4', 'G59P5', 'G59P6', 'G59P7', 'G59P8', 'G59P9', 'G59P10'];
export const WCS_SELECTORS_REG = ['#578', ...WCS_SELECTORS];

export const setWorkOffsetBlock = {
    type: 'setworkoffset', label: 'Set WCS Offset', kind: 'leaf', category: 'Coordinates',
    defaults: { wcs: '#578', axis: 'X', value: '#50' }, fields: ['wcs', 'axis', 'value'],
    selects: { wcs: WCS_SELECTORS_REG },   // t1520 — its own default `#578` is IN the vocabulary it offers
    scratch: [[50, 50]],   // t1085 — the default value var it READS (#578 is the firmware active-WCS reg)
    emit: (p, dx, dy, dialect) => {
        const core = dialect.setWorkOffset(resolveWcsIndex(p.wcs || '#578'), p.axis || 'X',
            (p.value === '' || p.value == null) ? 0 : (typeof p.value === 'number' ? num(p.value, 0) : p.value));
        // t1868 — see wcsIndirect.js's own identical note: setWorkOffset's G92 datum forms carry a G90 that
        // otherwise leaks into the next relative move. Opt-in restore, wizard-set, mirrors saferetractNode.
        return (p.restore === 'inc' || p.restore === 'G91') ? wrapMachineFrame(dialect, core, p.restore) : core;
    },
};
