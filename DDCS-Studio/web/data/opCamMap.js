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
import { stepoverPctOf } from '../wizards/ops/surfaceraster.js';   // t1363 — the ONE reading of a stored stepover
import { stepoverMm } from '../wizards/ops/pocketfill.js';   // t1043 — the CANONICAL exported stepoverPct->mm: max(0.2, max(0.1,toolDia)*stepoverPct/100). surfacingWizard.js:24-27 computes the identical formula inline (its absent-param defaults differ — 12/60 vs 6/40 — but are unreachable when the op provides toolDia+pct); the seed test verifies surface stepover == the real surfacingStack value.
import { builtinTypeForTwin } from '../blocks/wizardLibrary.js';   // t1049 — the DECLARED twin->built-in bridge (inverts opensAs->type/variant). Real programs use data-op TWINS (user_surfacing_data …), not the bare built-in optypes.
import { getUserDef, camFieldsFromStack, flattenBlocks } from '../blocks/userOps.js';           // U2 — the LIVE def registry (template + bindings) for the UNIVERSAL fallback; t1095 — the block-native pendant-field rows (S2); t1101 — flatten for the S4b identity re-derive
import { classifyExposable } from './exposeClassifier.js';   // U1 — per-binding exposable/geometry classification for the universal seed

// The clean 1:1 opType -> CAM generator type. pocket/drill are the DEFAULT arm; their variant arms are gated in camTypeOf.
export const OPTYPE_TO_CAM = { surfacing: 'surface', corner: 'corner', edge: 'edge', slot: 'slot', pocket: 'pocket', drill: 'drill' };

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// t1323 (USER SCREENSHOT) — THE TWO ENUM CLASSES. The param table walked only value fields, so a dropdown param had no row
// at all: on Surfacing, zMode (Normal | Skim) was simply MISSING, and the footer already promised enum support. But the two
// kinds of enum are not one feature — they differ in WHAT READS THE VALUE, and that decides everything else:
//
//   VALUE enum   (corner, wcs, axis, dir…)  the MACRO reads it as a number at RUN time → the pendant can hold it → the
//                                           full Expose treatment: a friendly label picks it, the slot stores its int.
//   BUILD enum   (zMode)                    it changes the PROGRAM'S SHAPE — the G91 wrap either exists in the emitted
//                                           macro or it does not. No number on a pendant can conjure a line that was
//                                           never built → BAKE-ONLY: pick the mode the slot bakes, Expose greyed WITH
//                                           its reason (postGating's rule: grey and say why, never hide).
//
// AND THE CLASS IS ALREADY DECLARED — it is not a new flag and not a guess. A def's binding carries `blockIndex`: the
// socket its value lands in. A STRUCTURAL binding has blockIndex == null, i.e. NO SOCKET — so there is physically nowhere
// for a runtime value to go; it can only fork the build. That is the whole distinction, already written down at every
// param, so this only names it.
// t1323 AMENDED (USER, live) — a build enum is NOT bake-only after all. It has THREE declared dispositions, because the
// macro can carry BOTH arms and jump between them on the pendant mirror numeral — the runtime-branch pattern the corner
// generator has always used (`IF #seq EQ 1 GOTO 20`), generalized:
//   BAKE            frozen at build; the slot contains ONE shape.                                   ← THE DEFAULT
//   EXPOSE AS VALUE the macro reads it as a number at run time (value enums only — they have a socket).
//   EXPOSE AS BRANCH the macro carries EVERY arm and IF/GOTOs on the mirror, so the shape is chosen AT THE MACHINE.
// DEFAULT = BAKE, per the user's ruling: a macro should not carry possibility-space unless someone asks for it. Branch
// is a per-param, per-slot OPT-IN, and it is REFUSED (with its reason shown) when the arms would bloat the macro.
export const BUILD_ENUM_REASON = 'changes the program shape — pick the shape the slot bakes, or expose it as a runtime branch';
// The arm budget: a branch duplicates the WHOLE op body once per arm, so 2–3 is a readable macro and more is bloat.
export const BRANCH_ARM_CAP = 3;
export const branchRefusal = (n) => `${n} arms would duplicate the program ${n} times — too big for one macro; bake the shape instead`;

/** The enum class of a def binding: 'value' (a socket carries it at runtime) | 'build' (no socket → it forks the build). */
export function enumClassOf(b) {
    if (!b || b.type !== 'enum') return null;
    return b.blockIndex != null ? 'value' : 'build';
}

/** A def's BUILD-TIME enums as table rows: {key,label,value,options:[{value,label}]}. `params` supplies the op's current
 *  pick (else the binding default). Empty for a def with no structural enums — which is every op but Surfacing today. */
/**
 * t1341 — THE ENTRY GATE. A ramp or helix descent has GEOMETRY, and part of that geometry is baked at build time
 * (the distance to the area centre, the rotation constants) because computing it live would need a square root or
 * trig the controller has not been verified to have — see wizards/ops/surfaceraster.js.
 *
 * That baking is exactly right on the WIZARD path: the text is fixed at build values and stays consistent forever.
 * It is NOT safe under a pendant. If an operator dials the stepover-% or the stepdown on a slot whose entry ramps,
 * the raster re-derives around a descent that does not — a KINKED entry, and a possible gouge. So a slot with a
 * ramp or helix entry marks exactly those two knobs BAKE-ONLY, with the reason on the control, and a plunge-entry
 * slot keeps them fully exposable because a straight plunge has no geometry to kink.
 *
 * The improvement turn (pendant-true entries: the +X declared run vector, or live SQRT once V13 settles it) is what
 * LIFTS this gate, and it does so with its own proof rather than by relaxing this one.
 */
export const ENTRY_GEOMETRY_KNOBS = ['stepoverPct', 'stepdown'];
export const ENTRY_GATE_REASON = 'changes the entry geometry, which this descent bakes at build — baked when built';
export const entryHasGeometry = (params) => { const e = (params && params.entry) || 'plunge'; return e === 'ramp' || e === 'helix'; };

export function buildEnumFields(def, params) {
    const p = params || {};
    return ((def && def.bindings) || []).filter((b) => enumClassOf(b) === 'build').map((b) => {
        const opts = ((b.widgetConfig && b.widgetConfig.options) || []).map((o) => Array.isArray(o) ? { value: o[1], label: o[0] } : { value: o, label: String(o) });
        const value = (p[b.param] !== undefined && p[b.param] !== '') ? p[b.param] : b.default;
        const arms = opts.length ? opts : [{ value: b.default, label: String(b.default) }];
        // BRANCHABLE = the arms fit the budget. Not branchable → Expose greyed with the REFUSAL as its reason (never
        // hidden: postGating's rule). Branchable → Expose is offered but NOT preselected; `exposed:false` is the
        // declared default, so a slot only carries both arms when someone deliberately ticks it.
        const branchable = arms.length > 1 && arms.length <= BRANCH_ARM_CAP;
        return { key: b.param, label: b.label || b.param, def: b.default, value, units: '', type: 'enum',
            buildEnum: arms, branchable,
            exposed: false, exposable: branchable, bakeable: true,
            _exposeTip: branchable ? 'Expose as a BRANCH: the macro carries every arm and jumps on the pendant number, so the shape is chosen at the machine' : branchRefusal(arms.length),
            _branch: true };
    });
}

// t1175 AUTO-GLYPH — camType (camTypeOf) -> the tileset glyph id (web/assets/svg/tileset.svg) that pictures that op. A fresh
// CAM slot's default icon is this glyph, centred, with no name text. An unmapped camType (e.g. substack) resolves to null →
// the icon editor falls back to the slot-name text, so it never breaks.
export const CAMTYPE_GLYPH = {
    surface: 'surface', corner: 'corner', edge: 'edge', slot: 'slot',
    pocket: 'pocket_rect', cpocket: 'pocket_round', drill: 'drill', bore: 'bore',
    inside: 'probe_center', boss: 'boss_round', universal: 'contour',
};
// t1177 Part D — the FULL op -> glyph resolver (advisor synthesis, "wire by opType"): camType WINS for the 8 generators +
// inside/boss (a BOSS middle stays boss_round — opType never overrides it); a UNIVERSAL op falls to its specific opType glyph,
// else contour. OPTYPE_GLYPH is free inert data, so every auto-only glyph is wired — alignment works today, the rest
// auto-produce once their op becomes a CAM slot.
export const OPTYPE_GLYPH = { alignment: 'align_two', homing: 'home', rotary_center: 'rotary_axis', rotary_clock: 'clock_dial', atc_change: 'tool_change', atc_table: 'tool_table', tap: 'tap', text: 'engrave', contour: 'contour', middle: 'probe_center' };
export function glyphForOp(op) {
    if (!op) return null;
    // An AUTHORING op carries its already-resolved camType/universal but NOT params (a fresh camTypeOf would misresolve
    // pocket-shape / drill-method → regress cpocket→pocket_round, bore→bore), so use the stored values when present; else
    // derive from a raw program op.
    const r = (op.camType != null || op.universal != null) ? { camType: op.camType, universal: !!op.universal } : camTypeOf(op);
    if (!r.universal && r.camType) return CAMTYPE_GLYPH[r.camType] || null;
    return OPTYPE_GLYPH[baseOf(op.opType).baseType] || CAMTYPE_GLYPH.universal || null;
}

// The op types the S1c picker should offer (each has at least one working arm). Per-op variants may still be unsupported
// (seedFromOp returns {unsupported}): pocket polygon/ellipse, drill pattern 'single', middle single-axis. contour excluded.
export const SUPPORTED_OPTYPES = ['pocket', 'surfacing', 'corner', 'edge', 'slot', 'drill', 'middle'];
// Accepts a built-in opType OR a data-op twin (user_*_data) — normalized via the declared bridge (defined below). U2 —
// widened past the 8 premium generators: ANY op with a registered def (every user_* twin/fork) is CAM-able via the universal
// unroll path, so the picker offers EVERY op. A generator arm stays the PREMIUM path for the 8 standard shapes (camTypeOf).
export const isCamableType = (opType) => SUPPORTED_OPTYPES.includes(baseOf(opType).baseType) || !!getUserDef(opType);

// t1073 — is this opType a data-op TWIN of one of the 8 CAM-generator ops (surfacing/pocket/corner/edge/slot/drill/bore/middle)?
// The DECLARED "Customize as blocks" affordance-gate (op menu / wizard list / CAM builder): only these forkable-into-a-sub-unit
// twins surface a Customize entry (not the other ~17 opensAs twins: comm/wcs/homing/atc/…). Base-type membership, so it is
// params-INDEPENDENT (all 8 surface) — editWizardDef then wraps the ones whose DEFAULT variant is a live generator
// (surfacing/pocket/corner/edge/slot); drill/bore/middle default to a universal variant (t1069 Finding 2) → a plain fork.
export function isCamGeneratorTwin(opType) {
    const t = builtinTypeForTwin(opType);   // {type, variant} for a data-op twin (opensAs target), null otherwise
    return !!t && (SUPPORTED_OPTYPES.includes(t.type) || t.type === 'bore');
}

// PARAM_ALIAS[camType] = { generatorFieldKey: opParamsKey } — ONLY the renames; unlisted keys alias to themselves.
// (Grounded from the op.params bare keys + the generator SPECs. stepover has NO op source — pocket/surface store
//  stepoverPct (%) — so it is intentionally UNLISTED: it stays unseeded and shows the generator default until a
//  toolDia*%/100 derivation lands. See the pass note value-semantics.)
// An alias value may be a STRING (one op key) or an ARRAY of candidate keys (first present wins) — the built-in + its
// data-op twin can name the SAME field differently (corner: built-in `probeZ`, twin `probeZFirst`).
export const PARAM_ALIAS = {
    corner: { seq: 'probeSeq', maxProbe: 'dist', travel: 'travelDist', scan: 'scanDepth', fast: 'f_fast', slow: 'f_slow', probeZ: ['probeZ', 'probeZFirst'] },
    edge: { maxProbe: 'dist', fast: 'f_fast', slow: 'f_slow' },
    surface: {},
    pocket: {},
    cpocket: {},
    slot: {},
    // t1051 — posX/posY = the op's PLACED position (originX/originY), NOT the pattern-local origin x0/y0 (default 0). The
    // drill/bore CAM slot runs at the WCS origin with posX/posY as the pattern anchor + has NO separate #20/#21 offset, so
    // it must carry the placement. x0/y0 structurally cancels through the placement datum-corner attach (grounded), so
    // originX alone is right (never originX+x0). The fallback ['originX','x0'] keeps the built-in path identical (drillView
    // force-sets x0===originX). CAVEAT flagged to the advisor: a CIRCLE pattern's centre-vs-min-corner MAY differ by dia/2 —
    // not fixed here (the built-in centres the circle at originX, so it's ambiguous; the x0->originX fix is certain).
    drill: { posX: ['originX', 'x0'], posY: ['originY', 'y0'] },
    bore: { posX: ['originX', 'x0'], posY: ['originY', 'y0'] },
    inside: { maxProbe: 'dist', fast: 'f_fast', slow: 'f_slow' },   // middle -> inside; middle op stores dist/f_fast/f_slow
    boss: { maxProbe: 'dist', fast: 'f_fast', slow: 'f_slow' },     // middle -> boss (op has no plain safeZ -> generator default)
};

// DERIVE[camType][fieldKey] = (op.params) -> value. For fields with NO direct op source (pocket/surface/cpocket store
// stepoverPct %, the generator wants absolute stepover mm). Mirrors the wizard one-source via the exported stepoverMm.
const DERIVE = {
    pocket: { stepover: stepoverMm },     // pocket twin keeps stepoverPct + toolDia → derive
    cpocket: { stepover: stepoverMm },
    // surfacing: the BUILT-IN op stores stepoverPct+toolDia (derive); the data-op TWIN precomputes a FLAT `stepover` and has
    // NO stepoverPct/toolDia (surfacingData.js) — so use the flat value if present, else derive. Mirrors surfacingWizard.js:27.
    // t1325 — the surface generator's field is now the PERCENTAGE (the mm is derived in its macro header). Seeding it
    // reads the op's own intent where the op has it (the built-in stores stepoverPct), and RECOVERS it from the twin's
    // flat mm where it does not — pct = mm / toolØ · 100, computed ONCE here rather than left to drift.
    // t1363 — ONE SOURCE: this now CALLS the atom's declared `stepoverPctOf` instead of restating it. The recovery
    // still runs against the tool Ø the SLOT will actually carry (the op's, else the generator field's own default),
    // which is what the override argument is for — recovering against anything else changes the cut: a 9.6mm stepover
    // is 80% of the Ø12 default, and calling it 60% would quietly widen the raster.
    // ONE BEHAVIOUR CHANGE, deliberate: a typed `stepoverPct` of 0 used to be treated here as ABSENT and silently
    // replaced by 60, while both emitters treated it as a real zero and let the program refuse at its own
    // `IF #44 <= 0 GOTO 91` guard. That was the dual reading; the emitters' rule wins, because a silent 60 is a
    // raster the operator never asked for and a loud refusal is not.
    surface: { stepoverPct: (p, toolDia) => stepoverPctOf(p, toolDia) },
};

// NON_BAKEABLE[camType] = generator field keys that MUST be Expose-only (Bake greyed). t1047 amend (user + advisor
// verified): CHOICE params (corner/wcs/axis/seq/probeZ/dir) ARE BAKEABLE — every probe/mill field appears only in IF
// CONDITIONS, arithmetic, or #var assignments (never as a GOTO/label TARGET), so a baked valid literal CONSTANT-FOLDS to
// valid G-code (e.g. corner=1 → `IF 1 EQ 2 THEN …` = an always-false no-op; the signs resolve correctly). The enum
// dropdown / numeric min-max CONSTRAINS the baked value to valid options + the live preview confirms it before save
// (valid-by-construction), so the dropdown serves BOTH expose and bake. Motive: authors bake a choice to make a
// single-purpose, clearly-illustrated slot (four clean FL/BL/BR/FR slots vs one ambiguous icon). Only a param that
// STRUCTURALLY breaks when literalized would stay here — none of the CAM params do. surface's numeric validity guards
// (IF x LE 0 GOTO error) are kept Expose-only for now (they'd fold safely too — flagged to the advisor).
export const NON_BAKEABLE = {
    surface: ['stepover', 'stepdown', 'toolDia', 'clearance'],
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
// t1049 — normalize a program op's opType to its built-in base type (+ variant). A DATA-OP TWIN (user_*_data — what real
// programs are built from) resolves via the declared opensAs bridge; a built-in op passes through. So camTypeOf/isCamableType
// work on the twins users actually insert, not just built-ins.
function baseOf(opType) {
    const twin = opType && builtinTypeForTwin(opType);   // null for a built-in / unknown opType
    return twin ? { baseType: twin.type, variant: twin.variant } : { baseType: opType, variant: undefined };
}

export function camTypeOf(op) {
    const p = (op && op.params) || {};
    const { baseType: t, variant } = baseOf(op && op.opType);
    switch (t) {
        case 'surfacing':
            // t1323 — the BUILD enum decides the ARM. surfacingSlot emits ONE fixed macro shape (absolute, WCS-referenced);
            // Skim is a whole-op G91 program that does not exist in it. Same ruling as pocket-polygon and single-axis middle
            // below: a variant the generator cannot express routes to the UNIVERSAL unroll, which builds from the op's own
            // stack — so the skim shape has exactly ONE source (skimStructure's postInstantiate), never a second macro here
            // that could drift from it.
            if (p.zMode === 'skim') return { universal: true, reason: 'Skim surfacing is a whole-op RELATIVE (G91) program shape the surface generator cannot express → universal (unrolls the skim stack as built)' };
            return { camType: 'surface' };
        case 'corner': return { camType: 'corner' };
        case 'edge': return { camType: 'edge' };
        case 'slot': return { camType: 'slot' };
        case 'pocket': {
            const shape = p.shape || 'rect';
            if (shape === 'rect') return { camType: 'pocket' };
            if (shape === 'circle') return { camType: 'cpocket' };   // t1043 ruling — circle -> circlePocketSlot
            return { universal: true, reason: `pocket shape "${shape}" has no CAM generator (only rect + circle) → universal` };   // polygon/ellipse → the unrolled long-tail path
        }
        case 'drill': {
            // t1089 — pattern 'single' now routes to the GENERATOR like every other pattern. It used to fall through to the
            // universal unroll (the t1043 S1 gap: slotFromOp had no 'single'), which was the WORST arm for it — measured at
            // t1087, the universal path could not expose depth/peck AT ALL, because drill.js peckDrill drove a JS `while` loop
            // that unrolls the peck sequence and bakes every Z literal at build time. A single hole is just a degenerate
            // pattern (count 1 at the anchor), so opToSlot declares it and depth/peck become live #2600 knobs driven by a
            // MACRO loop instead. NB this is the DEFAULT drill pattern (DRILL_DEFAULTS.pattern === 'single'), so it is the
            // common case, not an edge one. It's a bore when the built-in op sets method:'helical' OR the twin resolves to
            // variant:'bore' (user_bore_data — the twin has no `method`).
            return { camType: (variant === 'bore' || (p.method || 'peck') === 'helical') ? 'bore' : 'drill' };
        }
        case 'middle': {
            // t1043 ruling — the CAM inside/boss generators are FIXED BOTH-AXIS centre probes (no single-axis variant). A
            // single-axis middle would probe an axis the operator didn't intend -> mark unsupported (never emit a wrong slot).
            // `circular` is covered either way (insideCentreSlot always re-centres X; "harmless for a rectangle"). featureType picks the arm.
            if (!(p.twoAxis || p.findBoth)) return { universal: true, reason: 'middle single-axis: the inside/boss generator is BOTH-AXIS only → universal (unrolls the single-axis probe as authored)' };
            return { camType: p.featureType === 'boss' ? 'boss' : 'inside' };
        }
        case 'contour': return { universal: true, reason: 'contour has NO CAM generator → universal' };   // (user_contour_data resolves here too)
        default: return { universal: true };   // U2 — ANY unrecognized op (a forked/custom user_* op) routes to the universal unroll path (seedFromOp reads its def bindings)
    }
}

/**
 * S3 — the LAZY materializer: a def's value bindings → a cam_table block (one cam_field per binding, in binding PRE-ORDER),
 * mode = the classifier default (exposable → expose, non-exposable → bake at the binding default), label from the binding.
 * Consuming it via stackToSlot's cam_table branch (S2) reproduces today's DEFAULT field set exactly (makeAuthOp seeds
 * exposable→exposed / non-exposable→baked-at-value, which the materializer mirrors) → BYTE-NEUTRAL. The inverse of
 * camFieldsFromStack. Returns null when the def has no value bindings (nothing to declare). PURE — no injection, no side
 * effect; the caller decides where to place it (and must re-derive binding blockIndex if it injects into a mouth).
 */
export function camTableFromBindings(def) {
    const valueBindings = ((def && def.bindings) || []).filter((b) => b && b.blockIndex != null);
    if (!valueBindings.length) return null;
    const cls = classifyExposable(def);
    const children = valueBindings.map((b) => {
        const exposable = !!(cls[b.param] && cls[b.param].exposable);
        return { type: 'cam_field', params: {
            param: b.param, label: b.label || '', mode: exposable ? 'expose' : 'bake',
            baked: exposable ? '' : String(b.default),   // a bake row inlines the binding default (matches makeAuthOp's baked=value)
            units: b.units || '', dflt: '', nmin: '', nmax: '',
        } };
    });
    return { type: 'cam_table', params: {}, children };
}

/**
 * S4b core — materialize a cam_table INTO a def (the reusable, hook-agnostic step). Injects camTableFromBindings into the
 * user_root PRESENTATION mouth and re-derives EVERY binding's blockIndex BY IDENTITY over the post-injection flatten (the
 * wrapForkAtSave pattern): flattenBlocks visits uiChildren BEFORE children, so the shift is non-uniform and a blanket +1+N
 * would corrupt a uiChildren binding — instead each binding's ORIGINAL block object is found at its NEW index. Mutates `def`
 * in place (template + bindings). BYTE-NEUTRAL by construction: the materialized rows reproduce today's default field set
 * (camTableFromBindings mirrors makeAuthOp) and the cam_table emits []. Idempotent: a no-op when the def has no value bindings
 * or already carries a cam_table. Returns def. NOTHING calls this yet — the HOOK (the WHERE) is gated to the advisor (t1101).
 */
export function materializeCamTable(def) {
    if (!def || !Array.isArray(def.template)) return def;
    const root = def.template.find((b) => b && b.type === 'user_root');
    if (!root) return def;
    if (flattenBlocks(def.template).some((b) => b && b.type === 'cam_table')) return def;   // already materialized — idempotent
    const ct = camTableFromBindings(def);
    if (!ct) return def;   // no value bindings — nothing to declare
    const flatBefore = flattenBlocks(def.template);
    root.uiChildren = [ct, ...(root.uiChildren || [])];   // the cam_table leads the Presentation mouth
    const flatAfter = flattenBlocks(def.template);
    (def.bindings || []).forEach((b) => {
        if (!b || b.blockIndex == null) return;
        const ref = flatBefore[b.blockIndex]; const ni = ref ? flatAfter.indexOf(ref) : -1;   // BY IDENTITY (never a blanket shift)
        if (ni >= 0) b.blockIndex = ni;
    });
    return def;
}

/** UNIVERSAL seed — read the def BINDINGS directly (param names are the def's own; NO PARAM_ALIAS/DERIVE). Each value binding
 *  becomes a field seeded from op.params, with an `exposable` flag from exposeClassifier (value-role AND not under a fold).
 *  Geometry/other params are exposable:false → the table greys Expose + bake-forces them. Returns {unsupported} if the op has
 *  no registered def or no value bindings (the honest floor). */
function seedUniversal(op, reason) {
    const def = getUserDef(op && op.opType);
    // No registered def (a bare built-in optype has none — real programs use user_*_data twins): fall back to camTypeOf's
    // reason (why no dedicated generator) so the message stays informative, else a plain no-def note.
    if (!def) return { unsupported: reason || `no registered def for "${op && op.opType}" — cannot build a universal slot` };
    const valueBindings = (def.bindings || []).filter((b) => b && b.blockIndex != null);   // structural (guard) bindings have no socket
    if (!valueBindings.length) return { unsupported: reason || `"${op && op.opType}" has no value bindings to expose or bake` };
    const params = (op && op.params) || {};
    // t1410 — the op's OWN params decide which arm a guarded def will build, so the classification is asked about that
    // arm rather than about the guarded superset (which fails closed and exposes nothing). Same call `stackToSlot` makes.
    const cls = classifyExposable(def, params);
    const fieldFor = (b, over) => {                                     // one seed field; `over` = the cam_field row overriding label/mode/value (S2)
        const raw = params[b.param];
        const value = (over && over.mode === 'bake' && over.baked != null) ? over.baked
            : (raw !== undefined && raw !== '') ? raw : (over && over.dflt != null ? over.dflt : b.default);
        const exposable = !!(cls[b.param] && cls[b.param].exposable);
        // t1410 — THE WHY, CARRIED. macrosApp shows `_exposeTip` on the Expose control and otherwise falls back to a
        // generic "geometry / fold-driven". The classifier already computes the real reason per param — including the
        // ARM's own words when the op sits on a poorer one — so a greyed knob can say WHICH setting to change to get
        // it back, instead of leaving the operator to guess.
        const tip = (!exposable && cls[b.param] && cls[b.param].reason) ? { _exposeTip: cls[b.param].reason } : {};
        return { key: b.param, label: (over && over.label) || b.label || b.param, def: (over && over.dflt != null) ? over.dflt : b.default,
            value, units: (over && over.units != null) ? over.units : (b.units || ''), type: b.type,
            exposed: over ? (over.mode !== 'bake') : true, bakeable: true, exposable, ...tip };   // over-mode drives expose/bake; else exposed by default
    };
    // t1095 (block-native params S2) — ADDITIVE-BY-FALLBACK. A cam_table in the template makes its cam_field ROWS the field
    // declaration: seed order = block order, expose/bake = the row mode, label/units/default from the row (binding = wiring).
    // No cam_table (every op today) → the UNCHANGED binding-order seed → byte-identical.
    const camRows = camFieldsFromStack(def.template);
    let fields;
    if (camRows.length) {
        const bindingByParam = {}; valueBindings.forEach((b) => { bindingByParam[b.param] = b; });
        fields = camRows.map((row) => { const b = bindingByParam[row.param]; return b ? fieldFor(b, row) : null; }).filter(Boolean);
    } else {
        fields = valueBindings.map((b) => fieldFor(b));
    }
    // t1323 — the BUILD-time enums ride ALONGSIDE the value fields (they are rows, not sockets): the operator sees which
    // shape the slot bakes, greyed out of Expose with its reason, instead of a param that silently does not exist.
    return { camType: 'universal', universal: true, fields: fields.concat(buildEnumFields(def, params)) };
}

/**
 * S1b — seed the expose/bake field table from ONE program op. PURE. Returns { camType, fields } or { unsupported }.
 * Each field: { key (generator field key), value (op.params via PARAM_ALIAS, else the generator default), exposed:true,
 * bakeable (NOT in NON_BAKEABLE) }. Enum values (corner/wcs/axis/dir/…) are pulled RAW here (strings); the enum<->int
 * conversion is S1d. No UI.
 */
export function seedFromOp(op) {
    const r = camTypeOf(op);
    if (r.universal) return seedUniversal(op, r.reason);   // U2 — the universal (def-bindings-derived) seed for any non-generator op
    if (r.unsupported) return { unsupported: r.unsupported };
    const camType = r.camType, params = (op && op.params) || {};
    const alias = PARAM_ALIAS[camType] || {}, nb = NON_BAKEABLE[camType] || [], derive = DERIVE[camType] || {};
    // Read a field's op value via its alias — a STRING key or an ARRAY of candidates (first present wins: built-in vs twin).
    const readParam = (fkey) => { const a = alias[fkey], keys = Array.isArray(a) ? a : [a || fkey]; for (const k of keys) if (params[k] !== undefined) return params[k]; return undefined; };
    const genFields = genFieldsFor(camType, params);
    // t1325 — the tool Ø the slot will CARRY (the op's own, else the generator's field default): a derive that
    // recovers a percentage from a stored mm has to divide by the very number the macro will multiply back.
    const toolDiaCarried = (() => { const v = readParam('toolDia'); if (v !== undefined && v !== '') return Number(v); const f = genFields.find((x) => x.key === 'toolDia'); return f ? Number(f.def) : NaN; })();
    const fields = genFields.map((f) => {
        const opts = ENUM_OPTIONS[f.key];
        let value, meta;
        if (opts) {   // ENUM — map the op's string/bool value to the CAM int (S1d); the friendly dropdown lives on `enum`
            const opVal = readParam(f.key);
            const opt = opts.find((o) => o.op === opVal) || opts.find((o) => o.value === opVal);
            value = opt ? opt.value : f.def;
            meta = { type: 'enum', enum: opts };
        } else if (derive[f.key]) { value = derive[f.key](params, toolDiaCarried); meta = { type: f.type }; }   // DERIVED (e.g. stepover from stepoverPct / the twin's flat stepover)
        else { const opVal = readParam(f.key); value = opVal !== undefined ? opVal : f.def; meta = { type: f.type }; }   // op value via alias, else the generator default
        return { key: f.key, label: f.label, def: f.def, value, exposed: true, bakeable: !nb.includes(f.key), ...meta };
    });
    // t1341 — THE ENTRY GATE, applied to the generator arm's own fields: a ramp/helix slot cannot expose the knobs
    // that move the descent's baked geometry. Grey with the reason, never hidden (postGating's rule).
    if (entryHasGeometry(params)) {
        for (const f of fields) {
            if (!ENTRY_GEOMETRY_KNOBS.includes(f.key)) continue;
            f.exposable = false; f.exposed = false; f._exposeTip = ENTRY_GATE_REASON;
        }
    }
    // t1323 — a BUILD enum lives on the DEF, not on the generator's field list, so it is appended on the generator arm too.
    // On this arm it is always sitting at the value that KEEPS this camType (a shape-forking pick routed to universal
    // above), so the row states the shape being built and stays greyed — informative, never a control that lies.
    return { camType, fields: fields.concat(buildEnumFields(getUserDef(op && op.opType), params)) };
}
