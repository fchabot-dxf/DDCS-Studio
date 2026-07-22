/**
 * data/opCamMap.js — CAM Builder S1b: the DECLARED bridge from a program op (opType + BARE op.params) to a CAM slot
 * generator + a seeded expose/bake field table. DATA layer only — no UI. Verified by assertion before S1c hides it.
 *
 * Grounded facts (t1041, do NOT invent):
 *  - op.params keys are BARE (depth, toolDia, w, ax…) — the p_/sf_/c_ prefixes are DOM field ids only.
 *  - The generator field keys (probeToSlot/millToSlot/opToSlot SPECs) mostly match op.params 1:1; PARAM_ALIAS lists the
 *    genuine RENAMES per CAM type (generatorKey -> opParamsKey). Unlisted keys alias to themselves.
 *  - NON_BAKEABLE per CAM type = the guard/branch param keys that MUST stay Expose-only (the SAFETY floor): baking a
 *    branch selector (corner/seq/probeZ/wcs, edge axis/dir, …) or a validity-guard driver (surface stepover/stepdown/
 *    toolDia/clearance — the `IF x LE 0 GOTO error` lines) would silently freeze a path/guard the operator can't see.
 *
 * GATED (variant-dependent, non-1:1) — camTypeOf returns { unsupported } until the advisor rules the disambiguation:
 *    middle -> inside (featureType != 'boss') / boss (featureType === 'boss');  pocket shape 'circle' -> cpocket;
 *    drill method 'helical' -> bore.  Also: pocket polygon/ellipse + drill pattern 'single' have NO generator; contour
 *    has NO generator (excluded from S1). See the S1b pass note.
 */
import { cornerSlot, edgeSlot, probeZSlot, insideCentreSlot, bossCentreSlot, alignmentSlot } from './probeToSlot.js';
import { pocketSlot, circlePocketSlot, surfacingSlot } from './millToSlot.js';
import { slotFromOp } from './opToSlot.js';

// The clean 1:1 opType -> CAM generator type. pocket/drill are the DEFAULT arm; their variant arms are gated in camTypeOf.
export const OPTYPE_TO_CAM = { surfacing: 'surface', corner: 'corner', edge: 'edge', slot: 'slot', pocket: 'pocket', drill: 'drill' };

// The op types the S1c picker should offer (each has at least one working arm today). middle is pending the gate; contour excluded.
export const SUPPORTED_OPTYPES = ['pocket', 'surfacing', 'corner', 'edge', 'slot', 'drill'];
export const isCamableType = (opType) => SUPPORTED_OPTYPES.includes(opType);

// PARAM_ALIAS[camType] = { generatorFieldKey: opParamsKey } — ONLY the renames; unlisted keys alias to themselves.
// (Grounded from the op.params bare keys + the generator SPECs. stepover has NO op source — pocket/surface store
//  stepoverPct (%) — so it is intentionally UNLISTED: it stays unseeded and shows the generator default until a
//  toolDia*%/100 derivation lands. See the pass note value-semantics.)
export const PARAM_ALIAS = {
    corner: { seq: 'probeSeq', maxProbe: 'dist', travel: 'travelDist', scan: 'scanDepth', fast: 'f_fast', slow: 'f_slow' },
    edge: { maxProbe: 'dist', fast: 'f_fast', slow: 'f_slow' },
    surface: {},
    pocket: {},
    slot: {},
    drill: { posX: 'x0', posY: 'y0' },
    bore: { posX: 'x0', posY: 'y0' },
    cpocket: {},
};

// NON_BAKEABLE[camType] = generator field keys that MUST be Expose-only (Bake greyed). The SAFETY floor.
export const NON_BAKEABLE = {
    corner: ['corner', 'seq', 'probeZ', 'wcs'],   // branch selectors (IF corner/seq/probeZ; wcsBase branches on wcs)
    edge: ['axis', 'dir', 'wcs'],                 // IF axis/dir branch selectors + wcs
    align: ['checkAxis', 'dir', 'wcs'],
    zprobe: ['wcs'], inside: ['wcs'], boss: ['wcs'],
    surface: ['stepover', 'stepdown', 'toolDia', 'clearance'],   // IF x LE 0 GOTO error — validity guards
    pocket: [],    // guards are on COMPUTED #vars (x0/x1 from w/h/toolDia) — flagged for the advisor (geometry bake is safe: the guard still fires on the literals)
    cpocket: [],
    drill: [], bore: [], slot: [],   // only WHILE/IF-THEN loop bounds — baking a fixed count/depth still loops correctly
};

/** The generator's field list for a CAM type (one-source: read the SPEC keys off the generator itself, no duplication). */
function genFieldsFor(camType, params) {
    const GEN = { corner: cornerSlot, edge: edgeSlot, surface: surfacingSlot, pocket: pocketSlot, cpocket: circlePocketSlot,
        zprobe: probeZSlot, inside: insideCentreSlot, boss: bossCentreSlot, align: alignmentSlot };
    if (GEN[camType]) return GEN[camType](new Set(), 0).fields;
    if (camType === 'slot') return slotFromOp('slot', '', new Set(), 0).fields;
    if (camType === 'drill' || camType === 'bore') return slotFromOp(camType, params.pattern || 'circle', new Set(), 0).fields;
    return [];
}

/**
 * Resolve a program op to its CAM generator type. Returns { camType } for a clean mapping, or { unsupported: reason }
 * for a gated variant / excluded op. PURE — reads only op.opType + op.params.
 */
export function camTypeOf(op) {
    const t = op && op.opType, p = (op && op.params) || {};
    switch (t) {
        case 'surfacing': return { camType: 'surface' };
        case 'corner': return { camType: 'corner' };
        case 'edge': return { camType: 'edge' };
        case 'slot': return { camType: 'slot' };
        case 'pocket': {
            const shape = p.shape || 'rect';
            if (shape === 'rect') return { camType: 'pocket' };
            if (shape === 'circle') return { unsupported: 'pocket shape "circle" -> cpocket: GATED (non-1:1) pending the advisor ruling' };
            return { unsupported: `pocket shape "${shape}" has no CAM generator (only rect + circle exist)` };
        }
        case 'drill': {
            if ((p.method || 'peck') === 'helical') return { unsupported: 'drill method "helical" -> bore: GATED (non-1:1) pending the advisor ruling' };
            if ((p.pattern || 'single') === 'single') return { unsupported: 'drill pattern "single" has no slotFromOp pattern (circle/grid/line/rect only)' };
            return { camType: 'drill' };
        }
        case 'middle': return { unsupported: 'middle -> inside (featureType != boss) OR boss (featureType === boss): GATED pending the advisor ruling' };
        case 'contour': return { unsupported: 'contour has NO CAM generator (excluded from S1)' };
        default: return { unsupported: `opType "${t}" is not CAM-able` };
    }
}

/**
 * S1b — seed the expose/bake field table from ONE program op. PURE. Returns { camType, fields } or { unsupported }.
 * Each field: { key (generator field key), value (op.params via PARAM_ALIAS, else the generator default), exposed:true,
 * bakeable (NOT in NON_BAKEABLE) }. Enum values (corner/wcs/axis/dir/…) are pulled RAW here (strings); the enum<->int
 * conversion is S1d. No UI.
 */
export function seedFromOp(op) {
    const r = camTypeOf(op);
    if (r.unsupported) return { unsupported: r.unsupported };
    const camType = r.camType, params = (op && op.params) || {};
    const alias = PARAM_ALIAS[camType] || {}, nb = NON_BAKEABLE[camType] || [];
    const fields = genFieldsFor(camType, params).map((f) => {
        const opKey = alias[f.key] || f.key;
        const value = params[opKey] !== undefined ? params[opKey] : f.def;   // op value via alias, else the generator default
        return { key: f.key, value, exposed: true, bakeable: !nb.includes(f.key) };
    });
    return { camType, fields };
}
