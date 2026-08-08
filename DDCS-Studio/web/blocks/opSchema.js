/**
 * blocks/opSchema.js — the DECLARED op SCHEMA registry + the self-describing marker codec.
 *
 * SCHEMA (not a plain lookup): it declares the STRUCTURE of every op — param names, types, G-code address,
 * canon (marker) rename, and the form-field binding (`.field`). It drives the validator, form seeding
 * (paramFields), and the marker round-trip. One declared source of truth.
 *
 * THE CONTRACT (a format, not a language):
 *   A posted op carries a marker comment that DECLARES its record, e.g.
 *       ( @DDCS:1 {"op":"drill","patternDia":50,"holeDia":6,"depth":10,"feed":300} )
 *   Re-import READS that declaration — it never guesses intent from motion. (docs/archive/MULTI-OP-STACKING.md:
 *   "op params are the source of truth; G-code is a one-way projection; never invert it.")
 *
 *   - SENTINEL  @DDCS:<v>  — v = format version (bump when the contract changes).
 *   - PAYLOAD   = the op record as JSON: { op, ...params } — but keyed by each param's CANON name.
 *   - CARRIER   = a ( ... ) comment (safe/ignored on M350/V4.1/DM500). Parens in the payload are
 *                 \u-escaped so a string value like "(c)" can't close the comment early.
 *
 * VOCABULARY LIVES HERE. Each param's `canon` is the CLEAN name the MARKER uses when the internal
 * op.params key is a conflict/ambiguity. Renaming a marker key = change ONE `canon` below; the
 * wizard / op.params key never moves, and emit+parse both read this one table (no drift). That is
 * the whole reason for the schema registry: editing the vocabulary is a one-line change, not a refactor.
 *
 * Pure module — no DOM/window deps.
 */

export const MARKER_VERSION = 1;
const SENTINEL = '@DDCS';

// ── the schema registry (per op: param type + G-code address + canonical marker name) ──────────────────
// type: number|enum|string|bool|structured.  addr: standard G-code address (F/S/T/coords) or null.
// canon: clean marker name (omit when the internal key is already clean).
const N = (addr = null, canon = null) => ({ type: 'number', addr, ...(canon && { canon }) });
const Enum = (canon = null) => ({ type: 'enum', addr: null, ...(canon && { canon }) });
const Str = (canon = null) => ({ type: 'string', addr: null, ...(canon && { canon }) });
const Bool = (canon = null) => ({ type: 'bool', addr: null, ...(canon && { canon }) });
const Struct = (canon = null) => ({ type: 'structured', addr: null, ...(canon && { canon }) });
// Placement params (ride the PlaceOnStock wrapper) — shared by the geometric ops.
const PLACE = { stockAttach: Enum(), pathDatum: Enum(), offX: N(), offY: N(), offZ: N() };

// Representative coverage (every param SHAPE). Remaining ops are mechanical transcriptions of the
// G1 catalogue — add as data; renames are one-line `canon` edits.
export const SCHEMA = {
    drill: {
        pattern: Enum(), x0: N('X'), y0: N('Y'), cols: N(), rows: N(), dx: N(), dy: N(), count: N(),
        spacing: N(), angle: N(), dia: N(null, 'patternDia'), startAngle: N(), w: N(), h: N(), nx: N(), ny: N(),
        skip: Str(), method: Enum(), depth: N('Z'), peck: N(), holeDia: N(), toolDia: N(), pitch: N(),
        ramp: Enum(), feed: N('F'), clearance: N(), wcs: Enum(), ...PLACE,
    },
    surfacing: {
        toolDia: N(), stepoverPct: N(), clearance: N(), feed: N('F'), plunge: N(), rpm: N('S'), originX: N('X'),
        originY: N('Y'), w: N(), h: N(), depth: N('Z'), stepdown: N(), strategy: Enum(), wcs: Enum(), zMode: Enum(), ...PLACE,   // t1609 — zMode ('normal'|'skim'): without the schema+bind entry, EDITING a stored Skim op silently reseeded the field to Normal
    },
    slot: {
        ax: N('X'), ay: N('Y'), bx: N('X'), by: N('Y'), width: N(), toolDia: N(), stepoverPct: N(),
        depth: N('Z'), stepdown: N(), feed: N('F'), plunge: N(), rpm: N('S'), clearance: N(), originX: N('X'),
        originY: N('Y'), wcs: Enum(), pattern: Enum(),
        cols: N(), rows: N(), dx: N(), dy: N(), count: N(), spacing: N(), angle: N(), dia: N(null, 'patternDia'),
        startAngle: N(), w: N(), h: N(), nx: N(), ny: N(), skip: Str(), ...PLACE,
    },
    edge: {
        axis: Enum(), dir: Enum(), wcs: Enum(), dist: N(null, 'maxDist'), retract: N(), radius: N(),
        f_fast: N('F', 'feedFast'), f_slow: N('F', 'feedSlow'), port: N(), level: N(null, 'triggerLevel'),
        syncA: Bool(), slave: Enum(), qStop: N(),
    },
    // the probe-surface BLOCK's declared surface: `result` holds the TRUE (radius-compensated) wall on `axis`/`dir`.
    // The block emits this marker; the sim reads it to place the disc/datum ON the surface (replaces the Part-2 macro scan).
    'probe-surface': { result: Str(), axis: Enum(), dir: Enum() },
    atc_change: {
        method: Enum(), x: N('X'), y: N('Y'), z: N('Z'), zClear: N('Z'), fixedT: N('T'), orient: Bool(),
        waitSpindle: Bool(), dustCover: Bool(), confirm: Bool(), magazine: Struct(), callMacro: Bool(),   // INC-B: call the installed T.nc (default) vs inline
    },
    homing: { axes: Struct(), config: Struct(), machine: Struct(), softLimits: Bool() },
    pocket: {
        shape: Enum(), originX: N('X'), originY: N('Y'), dia: N(), sides: N(), w: N(), h: N(),
        toolDia: N(), stepoverPct: N(), wallOffset: N(), strategy: Enum(), depth: N('Z'), stepdown: N(),
        feed: N('F'), plunge: N(), rpm: N('S'), clearance: N(), wcs: Enum(), ...PLACE,
    },
    contour: {
        shape: Enum(), originX: N('X'), originY: N('Y'), dia: N(), sides: N(), w: N(), h: N(),
        side: Enum(), toolDia: N(), depth: N('Z'), stepdown: N(), feed: N('F'), plunge: N(), rpm: N('S'),
        clearance: N(), wcs: Enum(), ...PLACE,
    },
    wcs: {
        sys: Enum('wcs'), axisX: Bool(), axisY: Bool(), axisZ: Bool(), sync: Bool(), slave: Enum(),
    },
    comm: {
        type: Enum(), slot1: Str(), slot2: Str(), slot3: Str(), slot4: Str(), msg: Str(), popupMode: Enum(),
        statusColor: N(), statusMode: Enum(), statusDwell: N(), id: Str('destVar'), dest: Str('copyTo'),
        val: N(null, 'value'), cycle: N(),
    },
    middle: {
        featureType: Enum(), approach: Enum(), inAxis: Enum(), transAxis: Enum(), axis: Enum(), dir1: Enum(), dir2: Enum(), twoAxis: Bool(),
        findBoth: Bool(), circular: Bool(), probeZ: Bool(), wcs: Enum(), dist: N(null, 'maxDist'), retract: N(), safeZ: N(), safeZFrame: Enum(),
        clearMode: Enum(), hopDist: N(), planeZ: N(),   // t913 B2b-1 — the declared clearance mode + its per-mode fields (round-trip the mode; the form lands in B2b-2)
        clearOver: N(), crossX: Str(), crossY: Str(), diagTravel: Str(), diagPrimary: Str(), f_fast: N('F', 'feedFast'), f_slow: N('F', 'feedSlow'), port: N(), syncA: Bool(), slave: Enum(), qStop: N(),
    },
    corner: {
        corner: Enum(), probeSeq: Enum(), probeZ: Bool(), probeZFirst: Bool(), wcs: Enum(), dist: N(null, 'maxDist'),
        retract: N(), f_fast: N('F', 'feedFast'), f_slow: N('F', 'feedSlow'), port: N(), level: N(null, 'triggerLevel'),
        safeZ: N(), travelDist: N(), scanDepth: N(), radius: N(), sources: Struct(), syncA: Bool(), slave: Enum(), qStop: N(),
        clearMode: Enum(), hopDist: N(), planeZ: N(),   // t931 B2b-2c — the declared clearance mode + its per-mode fields (round-trip via the clearlift atom's value params)
    },
    alignment: {
        checkAxis: Enum(), probeDir: Enum(), safeZ: N(), safeZFrame: Enum(), dist: N(null, 'maxDist'), retract: N(),
        f_fast: N('F', 'feedFast'), f_slow: N('F', 'feedSlow'), port: N(), level: N(null, 'triggerLevel'),
        tolerance: N(), sources: Struct(), qStop: N(),
        // t506 — the ONE-SOURCE probe points (fractions of the stock) + the travel mode; round-trip through the op marker.
        travel: Enum(), ax: N(), ay: N(), bx: N(), by: N(),
    },
    atc_length: {
        blockHeight: N(), safeZ: N(), maxDist: N(), retract: N(), f_fast: N('F', 'feedFast'),
        f_slow: N('F', 'feedSlow'), port: N(), level: N(null, 'triggerLevel'), sources: Struct(),
    },
    atc_check: {
        blockHeight: N(), safeZ: N(), maxDist: N(), retract: N(), f_fast: N('F', 'feedFast'),
        f_slow: N('F', 'feedSlow'), port: N(), level: N(null, 'triggerLevel'), tolerance: N(), sources: Struct(),
    },
    atc_warmup: { rpm1: N('S'), time1: N(), rpm2: N('S'), time2: N() },
    atc_test: {
        mode: Enum(), cycles: N(), dwellMs: N(), magazine: Struct(), first: N(), count: N(), zClear: N('Z'), descend: Bool(),
    },
    atc_table: { tools: Struct(), magazine: Struct(), includeLengths: Bool(), includePockets: Bool() },
    rotary_clock: {
        action: Enum(), reference: Enum(), wcs: Enum(), level: N(null, 'triggerLevel'), span: N(),
        dist: N(null, 'maxDist'), retract: N(), safeZ: N(), safeZFrame: Enum(), f_fast: N('F', 'feedFast'), f_slow: N('F', 'feedSlow'),
        port: N(), sources: Struct(), qStop: N(),
    },
    rotary_center: {
        method: Enum(), approach: Enum(), datum: Enum(), wcs: Enum(), level: N(null, 'triggerLevel'), diameter: N(),
        dist: N(null, 'maxDist'), retract: N(), safeZ: N(), safeZFrame: Enum(), f_fast: N('F', 'feedFast'), f_slow: N('F', 'feedSlow'),
        port: N(), sources: Struct(), qStop: N(),
    },
    text: {
        text: Str(), rpm: N('S'), dir: Enum(), height: N(), width: N(), slant: N(), rotation: N(), spacing: N(), lineSpacing: N(), align: Enum(), x: N('X'), y: N('Y'),
        strokeWidth: N(), toolDia: N(), stepoverPct: N(), depth: N('Z'), stepdown: N(), feed: N('F'), plunge: N(),
        clearance: N(), originX: N('X'), originY: N('Y'), ...PLACE,
    },
    circular: {   // own form params (circularWizard); circularStack maps them onto middleStack at emit
        featureType: Enum(), wcs: Enum(), dist: N(null, 'maxDist'), retract: N(), safeZ: N(),
        f_fast: N('F', 'feedFast'), f_slow: N('F', 'feedSlow'), qStop: N(),
    },
};

// ── the form-field binding (op param → its form field id), FOLDED into each SCHEMA param as `.field` below ──
// EDIT seeding: the inverse of each view's update() reads. wizardManager._seedForm() restores these into the
// form when re-opening a wizard to edit an op (op.params = single truth; value vs checkbox decided by element
// type at seed time). drill has a custom view.setForm (pattern variants), atc_length is Settings-driven, homing
// has no form-field map — so they're absent here. This column folds ONTO the SCHEMA param entries (one source of
// truth: SCHEMA[op][param].field); consumers read it via paramFields(). A binding whose param isn't in SCHEMA is an
// orphan (BIND_ORPHANS) — structurally-caught drift, asserted empty by protocol-validator.spec.js.
const FIELD_BIND = {
    surfacing: { originX: 'sf_originX', originY: 'sf_originY', offZ: 'sf_offZ', pathDatum: 'sf_pathDatum', stockAttach: 'sf_stockAttach', w: 'sf_w', h: 'sf_h', strategy: 'sf_strategy', toolDia: 'sf_toolDia', stepoverPct: 'sf_stepoverPct', depth: 'sf_depth', stepdown: 'sf_stepdown', clearance: 'sf_clearance', feed: 'sf_feed', plunge: 'sf_plunge', rpm: 'sf_rpm', zMode: 'sf_zMode' },
    pocket: { shape: 'p_shape', strategy: 'p_strategy', originX: 'p_originX', originY: 'p_originY', offZ: 'p_offZ', pathDatum: 'p_pathDatum', stockAttach: 'p_stockAttach', w: 'p_w', h: 'p_h', dia: 'p_dia', sides: 'p_sides', toolDia: 'p_toolDia', stepoverPct: 'p_stepoverPct', depth: 'p_depth', stepdown: 'p_stepdown', clearance: 'p_clearance', feed: 'p_feed', plunge: 'p_plunge', rpm: 'p_rpm' },
    contour: { shape: 'ct_shape', side: 'ct_side', originX: 'ct_originX', originY: 'ct_originY', offZ: 'ct_offZ', pathDatum: 'ct_pathDatum', stockAttach: 'ct_stockAttach', w: 'ct_w', h: 'ct_h', dia: 'ct_dia', sides: 'ct_sides', wcs: 'ct_wcs', toolDia: 'ct_toolDia', depth: 'ct_depth', stepdown: 'ct_stepdown', clearance: 'ct_clearance', feed: 'ct_feed', plunge: 'ct_plunge', rpm: 'ct_rpm' },
    slot: { ax: 'sl_ax', ay: 'sl_ay', bx: 'sl_bx', by: 'sl_by', width: 'sl_width', originX: 'sl_offX', originY: 'sl_offY', offZ: 'sl_offZ', pathDatum: 'sl_pathDatum', stockAttach: 'sl_stockAttach', toolDia: 'sl_toolDia', stepoverPct: 'sl_stepoverPct', depth: 'sl_depth', stepdown: 'sl_stepdown', clearance: 'sl_clearance', feed: 'sl_feed', plunge: 'sl_plunge', rpm: 'sl_rpm' },
    text: { text: 'tx_text', x: 'tx_x', y: 'tx_y', originX: 'tx_offX', originY: 'tx_offY', offZ: 'tx_offZ', pathDatum: 'tx_pathDatum', stockAttach: 'tx_stockAttach', height: 'tx_height', width: 'tx_width', slant: 'tx_slant', rotation: 'tx_rotation', spacing: 'tx_spacing', lineSpacing: 'tx_lineSpacing', align: 'tx_align', strokeWidth: 'tx_strokeWidth', toolDia: 'tx_toolDia', stepoverPct: 'tx_stepoverPct', depth: 'tx_depth', stepdown: 'tx_stepdown', clearance: 'tx_clearance', feed: 'tx_feed', plunge: 'tx_plunge', rpm: 'tx_rpm' },
    corner: { corner: 'c_corner', probeZ: 'c_probe_z_first', syncA: 'c_sync_a', slave: 'c_slave', probeSeq: 'c_probe_seq', wcs: 'c_wcs', dist: 'c_dist', retract: 'c_retract', f_fast: 'c_feed_fast', f_slow: 'c_feed_slow', qStop: 'c_q', safeZ: 'c_safe_z', travelDist: 'c_travel_dist', scanDepth: 'c_scan_depth', radius: 'c_radius' },
    edge: { axis: 'p_axis', dir: 'p_dir', wcs: 'p_wcs', dist: 'p_dist', retract: 'p_retract', syncA: 'p_sync_a', slave: 'p_slave', f_fast: 'p_feed_fast', f_slow: 'p_feed_slow', qStop: 'p_q' },
    middle: { featureType: 'm_type', inAxis: 'm_inaxis', transAxis: 'm_transaxis', clearOver: 'm_clear', crossX: 'm_crossX', crossY: 'm_crossY', diagTravel: 'm_diag_travel', diagPrimary: 'm_diag_primary', axis: 'm_axis', findBoth: 'm_both', circular: 'm_circular', probeZ: 'm_probe_z_first', syncA: 'm_sync_a', slave: 'm_slave', wcs: 'm_wcs', dist: 'm_dist', retract: 'm_retract', safeZ: 'm_safe_z', safeZFrame: 'm_safe_z_frame', f_fast: 'm_feed_fast', f_slow: 'm_feed_slow', qStop: 'm_q', dir1: 'm_dir', dir2: 'm_dir2' },
    wcs: { sys: 'w_sys', axisX: 'w_x', axisY: 'w_y', axisZ: 'w_z', sync: 'w_sync', slave: 'w_slave' },
    alignment: { checkAxis: 'al_check_axis', probeDir: 'al_probe_dir', tolerance: 'al_tolerance', dist: 'al_dist', retract: 'al_retract', safeZ: 'al_safe_z', safeZFrame: 'al_safe_z_frame', f_fast: 'al_feed_fast', f_slow: 'al_feed_slow', qStop: 'al_q' },
    circular: { featureType: 'circ_type', wcs: 'circ_wcs', dist: 'circ_dist', retract: 'circ_retract', safeZ: 'circ_safe_z', f_fast: 'circ_feed_fast', f_slow: 'circ_feed_slow', qStop: 'circ_q' },
    rotary_clock: { action: 'rcl_action', reference: 'rcl_reference', span: 'rcl_span', wcs: 'rcl_wcs', dist: 'rcl_dist', retract: 'rcl_retract', safeZ: 'rcl_safe_z', safeZFrame: 'rcl_safe_z_frame', f_fast: 'rcl_feed_fast', f_slow: 'rcl_feed_slow', qStop: 'rcl_q' },
    rotary_center: { method: 'rc_method', approach: 'rc_approach', datum: 'rc_datum', diameter: 'rc_diameter', wcs: 'rc_wcs', dist: 'rc_dist', retract: 'rc_retract', safeZ: 'rc_safe_z', safeZFrame: 'rc_safe_z_frame', f_fast: 'rc_feed_fast', f_slow: 'rc_feed_slow', qStop: 'rc_q' },
    comm: { type: 'c_type', msg: 'c_msg', val: 'c_val', cycle: 'c_cycle', popupMode: 'c_popup_mode', id: 'c_id', dest: 'c_dest', slot1: 'c_slot1', slot2: 'c_slot2', slot3: 'c_slot3', slot4: 'c_slot4', statusColor: 'c_status_color', statusMode: 'c_status_mode', statusDwell: 'c_status_dwell' },
    atc_check: { tolerance: 'atc_check_tol' },
    atc_warmup: { rpm1: 'atc_warmup_rpm1', time1: 'atc_warmup_time1', rpm2: 'atc_warmup_rpm2', time2: 'atc_warmup_time2' },
    atc_change: { method: 'atc_change_method', x: 'atc_change_x', y: 'atc_change_y', z: 'atc_change_z', zClear: 'atc_change_zclear', fixedT: 'atc_change_fixedt', orient: 'atc_change_orient', waitSpindle: 'atc_change_m300', dustCover: 'atc_change_cover', confirm: 'atc_change_confirm' },
    atc_test: { mode: 'atc_test_mode', cycles: 'atc_test_cycles', dwellMs: 'atc_test_dwell', first: 'atc_test_first', count: 'atc_test_count', zClear: 'atc_test_zclear', descend: 'atc_test_descend' },
    atc_table: { includeLengths: 'atc_table_lengths', includePockets: 'atc_table_pockets' },
};

// Fold the field-id column ONTO each SCHEMA param (one source of truth: SCHEMA[op][param].field). A binding whose
// param isn't catalogued has nowhere to land → recorded in BIND_ORPHANS (the protocol validator asserts []).
export const BIND_ORPHANS = [];
for (const op in FIELD_BIND) for (const k in FIELD_BIND[op]) {
    if (SCHEMA[op] && SCHEMA[op][k]) SCHEMA[op][k].field = FIELD_BIND[op][k];
    else BIND_ORPHANS.push(`${op}.${k}`);
}

// ── the FEDERATED user layer (MID #6) ───────────────────────────────────────────────────────────────────────
// SCHEMA above is the PRISTINE built-in layer — the FIELD_BIND fold attaches `.field` to it at load, and nothing
// else mutates it. USER-authored ops register their spec into USER_SCHEMA, a SEPARATE object, so the built-ins
// stay forkable/resettable and a distribution-install can be validated against an isolated layer. Read both
// layers through specOf(); the helpers below (paramFields/canonOf/revCanon/validate) all resolve via specOf so a
// user op gets its form binding, marker canon + validation. Precedence is BUILT-IN-FIRST — user opTypes are
// `user_`-prefixed (USER_OP_PREFIX), so the key spaces are disjoint and precedence is academic today; Stage-6
// forking (a user op OVERRIDING a built-in key) would flip it to user-first.
const USER_SCHEMA = Object.create(null);

/** Resolve an op's param-spec across the federated layers (built-in pristine layer, then the user layer). */
export function specOf(opType) { return SCHEMA[opType] || USER_SCHEMA[opType] || null; }

/** Install a USER op's spec into the user layer (the wizard-maker calls this — see blocks/userOps.js). */
export function registerUserSpec(opType, spec) { USER_SCHEMA[opType] = spec; }
/** Remove a USER op's spec from the user layer. */
export function unregisterUserSpec(opType) { delete USER_SCHEMA[opType]; }

/** The { param → form-field id } binding for an op, derived from its spec — the replacement for PARAM_FIELDS. */
export function paramFields(opType) {
    const spec = specOf(opType) || {}, out = {};
    for (const k in spec) if (spec[k].field) out[k] = spec[k].field;
    return out;
}

// ── marker codec (op record <-> ( @DDCS:v {…} ) comment), mapping internal keys <-> canon names ──
const escParens = (s) => s.replace(/\(/g, '\\u0028').replace(/\)/g, '\\u0029');   // keep payload paren-free
const canonOf = (opType, key) => { const s = specOf(opType); return (s && s[key] && s[key].canon) || key; };
function revCanon(opType) {                          // marker (canon) key -> internal param key
    const spec = specOf(opType) || {}, m = {};
    for (const key in spec) m[spec[key].canon || key] = key;
    return m;
}

/** Build the marker comment line for an op record. `params` = the op's single-source-of-truth params. `defV` (opt)
 *  = the op's declared per-def version stamp (N1) — additive payload key, stamped last, only when > 0 (a versioned
 *  user def; built-ins pass 0 → unstamped). It's the def-change→rebuild signal, NOT the format `MARKER_VERSION`. */
export function markerLine(opType, params, defV) {
    const rec = { op: opType };
    for (const k in (params || {})) rec[canonOf(opType, k)] = params[k];
    if (defV && defV > 0) rec.defV = defV;
    return `( ${SENTINEL}:${MARKER_VERSION} ${escParens(JSON.stringify(rec))} )`;
}

/** True if a line is a DDCS op marker (cheap sentinel test). */
export const isMarker = (line) => /^\(\s*@DDCS:\d+\s/.test(String(line).trim());

/** Parse a line → { opType, params, v, defV } (params back in internal keys) or null if not a marker.
 *  `defV` = the stamped per-def version (0 when absent — a legacy pre-versioning file). `v` = the format version. */
export function parseMarker(line) {
    const m = String(line).match(/^\(\s*@DDCS:(\d+)\s+(.*?)\s*\)\s*$/);
    if (!m) return null;
    let rec;
    try { rec = JSON.parse(m[2]); } catch (_) { return null; }
    if (!rec || typeof rec.op !== 'string') return null;
    const opType = rec.op, rev = revCanon(opType), params = {};
    for (const k in rec) { if (k === 'op' || k === 'defV') continue; params[rev[k] || k] = rec[k]; }   // defV is a reserved marker key, not a param
    return { opType, params, v: Number(m[1]), defV: Number(rec.defV) || 0 };
}

/** Validate an op record against the schema → warning strings ([] = clean, or op not catalogued). */
export function validate(opType, params) {
    const spec = specOf(opType);
    if (!spec) return [];
    const w = [];
    for (const k in (params || {})) {
        const d = spec[k];
        if (!d) { w.push(`unknown param "${k}" for ${opType}`); continue; }
        const v = params[k];
        if (v == null) continue;
        if (d.type === 'number' && typeof v !== 'number') w.push(`"${k}" should be a number (got ${typeof v})`);
        else if (d.type === 'bool' && typeof v !== 'boolean') w.push(`"${k}" should be a bool (got ${typeof v})`);
        else if (d.type === 'structured' && typeof v !== 'object') w.push(`"${k}" should be structured`);
    }
    return w;
}
