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
 * VARIANT FORKS (t1043 rulings, ENCODED in camTypeOf): pocket shape 'circle' -> cpocket; drill method 'helical' -> bore;
 * middle -> boss (featureType === 'boss') else inside, but ONLY when BOTH-AXIS (twoAxis||findBoth) since the CAM inside/
 * boss generators are fixed both-axis centre probes — a single-axis middle is {unsupported} (never emit a wrong slot).
 * UNSUPPORTED (no generator / known gap): pocket polygon/ellipse, drill pattern 'single', middle single-axis, contour.
 */
import { cornerSlot, edgeSlot, probeZSlot, insideCentreSlot, bossCentreSlot, alignmentSlot } from './probeToSlot.js';
import { pocketSlot, circlePocketSlot, surfacingSlot } from './millToSlot.js';
import { slotFromOp } from './opToSlot.js';
import { stepoverMm } from '../wizards/ops/pocketfill.js';   // t1043 — the CANONICAL exported stepoverPct->mm: max(0.2, max(0.1,toolDia)*stepoverPct/100). surfacingWizard.js:24-27 computes the identical formula inline (its absent-param defaults differ — 12/60 vs 6/40 — but are unreachable when the op provides toolDia+pct); the seed test verifies surface stepover == the real surfacingStack value.

// The clean 1:1 opType -> CAM generator type. pocket/drill are the DEFAULT arm; their variant arms are gated in camTypeOf.
export const OPTYPE_TO_CAM = { surfacing: 'surface', corner: 'corner', edge: 'edge', slot: 'slot', pocket: 'pocket', drill: 'drill' };

// The op types the S1c picker should offer (each has at least one working arm). Per-op variants may still be unsupported
// (seedFromOp returns {unsupported}): pocket polygon/ellipse, drill pattern 'single', middle single-axis. contour excluded.
export const SUPPORTED_OPTYPES = ['pocket', 'surfacing', 'corner', 'edge', 'slot', 'drill', 'middle'];
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
    cpocket: {},
    slot: {},
    drill: { posX: 'x0', posY: 'y0' },
    bore: { posX: 'x0', posY: 'y0' },
    inside: { maxProbe: 'dist', fast: 'f_fast', slow: 'f_slow' },   // middle -> inside; middle op stores dist/f_fast/f_slow
    boss: { maxProbe: 'dist', fast: 'f_fast', slow: 'f_slow' },     // middle -> boss (op has no plain safeZ -> generator default)
};

// DERIVE[camType][fieldKey] = (op.params) -> value. For fields with NO direct op source (pocket/surface/cpocket store
// stepoverPct %, the generator wants absolute stepover mm). Mirrors the wizard one-source via the exported stepoverMm.
const DERIVE = {
    pocket: { stepover: stepoverMm },
    cpocket: { stepover: stepoverMm },
    surface: { stepover: stepoverMm },
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

// S1d — ENUM options per field key (shared across generators: corner/wcs/axis mean the same everywhere). GROUNDED
// one-source (t1047, do NOT invent): the friendly `label` + the program-op `op` value come from the wizard defs
// (cornerData.js:186/190/191, wizardOptions.WCS_OPTIONS, index.html p_axis/p_dir); the CAM `value` (int) is the macro's
// branch convention (probeToSlot.js field legends "1FL 2FR 3BL 4BR" etc. + the IF corner EQ 2 THEN … macro bodies). The
// wizard value ORDER matches the CAM int order in every case (positional). corner is 1-based; the rest 0-based.
export const ENUM_OPTIONS = {
    corner: [{ label: 'Front-Left', value: 1, op: 'FL' }, { label: 'Front-Right', value: 2, op: 'FR' }, { label: 'Back-Left', value: 3, op: 'BL' }, { label: 'Back-Right', value: 4, op: 'BR' }],
    wcs: [{ label: 'Active', value: 0, op: 'active' }, { label: 'G54', value: 1, op: 'G54' }, { label: 'G55', value: 2, op: 'G55' }, { label: 'G56', value: 3, op: 'G56' }, { label: 'G57', value: 4, op: 'G57' }, { label: 'G58', value: 5, op: 'G58' }, { label: 'G59', value: 6, op: 'G59' }],
    probeZ: [{ label: 'No', value: 0, op: false }, { label: 'Yes', value: 1, op: true }],
    seq: [{ label: 'Y then X', value: 0, op: 'YX' }, { label: 'X then Y', value: 1, op: 'XY' }],
    axis: [{ label: 'X', value: 0, op: 'X' }, { label: 'Y', value: 1, op: 'Y' }],
    checkAxis: [{ label: 'X', value: 0, op: 'X' }, { label: 'Y', value: 1, op: 'Y' }],
    dir: [{ label: 'Positive', value: 0, op: 'pos' }, { label: 'Negative', value: 1, op: 'neg' }],
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
            if (shape === 'circle') return { camType: 'cpocket' };   // t1043 ruling — circle -> circlePocketSlot
            return { unsupported: `pocket shape "${shape}" has no CAM generator (only rect + circle exist)` };   // polygon/ellipse
        }
        case 'drill': {
            // t1043 ruling — pattern 'single' has no slotFromOp pattern (known S1 gap); otherwise method decides drill vs bore.
            if ((p.pattern || 'single') === 'single') return { unsupported: 'drill/bore pattern "single" has no slotFromOp pattern (circle/grid/line/rect only) — known S1 gap' };
            return { camType: (p.method || 'peck') === 'helical' ? 'bore' : 'drill' };
        }
        case 'middle': {
            // t1043 ruling — the CAM inside/boss generators are FIXED BOTH-AXIS centre probes (no single-axis variant). A
            // single-axis middle would probe an axis the operator didn't intend -> mark unsupported (never emit a wrong slot).
            // `circular` is covered either way (insideCentreSlot always re-centres X; "harmless for a rectangle"). featureType picks the arm.
            if (!(p.twoAxis || p.findBoth)) return { unsupported: 'middle single-axis probe: the CAM inside/boss slot is BOTH-AXIS only (enable Find both axes)' };
            return { camType: p.featureType === 'boss' ? 'boss' : 'inside' };
        }
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
    const alias = PARAM_ALIAS[camType] || {}, nb = NON_BAKEABLE[camType] || [], derive = DERIVE[camType] || {};
    const fields = genFieldsFor(camType, params).map((f) => {
        const opts = ENUM_OPTIONS[f.key];
        let value, meta;
        if (opts) {   // ENUM — map the op's string/bool value to the CAM int (S1d); the friendly dropdown lives on `enum`
            const opVal = params[alias[f.key] || f.key];
            const opt = opts.find((o) => o.op === opVal) || opts.find((o) => o.value === opVal);
            value = opt ? opt.value : f.def;
            meta = { type: 'enum', enum: opts };
        } else if (derive[f.key]) { value = derive[f.key](params); meta = { type: f.type }; }   // DERIVED (e.g. stepover from stepoverPct)
        else { const opKey = alias[f.key] || f.key; value = params[opKey] !== undefined ? params[opKey] : f.def; meta = { type: f.type }; }   // op value via alias, else the generator default
        return { key: f.key, label: f.label, def: f.def, value, exposed: true, bakeable: !nb.includes(f.key), ...meta };
    });
    return { camType, fields };
}
