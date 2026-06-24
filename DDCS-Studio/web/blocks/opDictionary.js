/**
 * blocks/opDictionary.js — the DECLARED op dictionary + the self-describing marker codec.
 *
 * THE CONTRACT (a format, not a language):
 *   A posted op carries a marker comment that DECLARES its record, e.g.
 *       ( @DDCS:1 {"op":"drill","patternDia":50,"holeDia":6,"depth":10,"feed":300} )
 *   Re-import READS that declaration — it never guesses intent from motion. (docs/MULTI-OP-STACKING.md:
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
 * the whole reason for the dictionary: editing the vocabulary is a one-line change, not a refactor.
 *
 * Pure module — no DOM/window deps.
 */

export const MARKER_VERSION = 1;
const SENTINEL = '@DDCS';

// ── the dictionary (schema: type + G-code address + canonical marker name) ──────────────────
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
export const DICT = {
    drill: {
        pattern: Enum(), x0: N('X'), y0: N('Y'), cols: N(), rows: N(), dx: N(), dy: N(), count: N(),
        spacing: N(), angle: N(), dia: N(null, 'patternDia'), startAngle: N(), w: N(), h: N(), nx: N(), ny: N(),
        skip: Str(), method: Enum(), depth: N('Z'), peck: N(), holeDia: N(), toolDia: N(), pitch: N(),
        ramp: Enum(), feed: N('F'), clearance: N(), wcs: Enum(), ...PLACE,
    },
    surfacing: {
        toolDia: N(), stepoverPct: N(), clearance: N(), feed: N('F'), plunge: N(), originX: N('X'),
        originY: N('Y'), w: N(), h: N(), depth: N('Z'), stepdown: N(), strategy: Enum(), wcs: Enum(), ...PLACE,
    },
    slot: {
        ax: N('X'), ay: N('Y'), bx: N('X'), by: N('Y'), width: N(), toolDia: N(), stepoverPct: N(),
        depth: N('Z'), stepdown: N(), feed: N('F'), plunge: N(), clearance: N(), wcs: Enum(), pattern: Enum(),
        cols: N(), rows: N(), dx: N(), dy: N(), count: N(), spacing: N(), angle: N(), dia: N(null, 'patternDia'),
        startAngle: N(), w: N(), h: N(), nx: N(), ny: N(), skip: Str(), ...PLACE,
    },
    edge: {
        axis: Enum(), dir: Enum(), wcs: Enum(), dist: N(null, 'maxDist'), retract: N(), radius: N(),
        f_fast: N('F', 'feedFast'), f_slow: N('F', 'feedSlow'), port: N(), level: N(null, 'triggerLevel'),
    },
    atc_change: {
        method: Enum(), x: N('X'), y: N('Y'), z: N('Z'), zClear: N('Z'), fixedT: N('T'),
        waitSpindle: Bool(), dustCover: Bool(), confirm: Bool(), magazine: Struct(),
    },
    homing: { axes: Struct(), config: Struct(), machine: Struct(), softLimits: Bool() },
    pocket: {
        shape: Enum(), originX: N('X'), originY: N('Y'), dia: N(), sides: N(), w: N(), h: N(),
        toolDia: N(), stepoverPct: N(), wallOffset: N(), strategy: Enum(), depth: N('Z'), stepdown: N(),
        feed: N('F'), plunge: N(), clearance: N(), wcs: Enum(), ...PLACE,
    },
    contour: {
        shape: Enum(), originX: N('X'), originY: N('Y'), dia: N(), sides: N(), w: N(), h: N(),
        side: Enum(), toolDia: N(), depth: N('Z'), stepdown: N(), feed: N('F'), plunge: N(), clearance: N(),
        wcs: Enum(), ...PLACE,
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
        featureType: Enum(), approach: Enum(), axis: Enum(), dir1: Enum(), dir2: Enum(), twoAxis: Bool(),
        findBoth: Bool(), circular: Bool(), wcs: Enum(), dist: N(null, 'maxDist'), retract: N(), safeZ: N(),
        clearOver: N(), f_fast: N('F', 'feedFast'), f_slow: N('F', 'feedSlow'), port: N(), syncA: Bool(), slave: Enum(),
    },
    corner: {
        corner: Enum(), probeSeq: Enum(), probeZ: Bool(), probeZFirst: Bool(), wcs: Enum(), dist: N(null, 'maxDist'),
        retract: N(), f_fast: N('F', 'feedFast'), f_slow: N('F', 'feedSlow'), port: N(), level: N(null, 'triggerLevel'),
        safeZ: N(), travelDist: N(), scanDepth: N(), radius: N(), sources: Struct(), syncA: Bool(), slave: Enum(),
    },
    alignment: {
        checkAxis: Enum(), probeDir: Enum(), safeZ: N(), dist: N(null, 'maxDist'), retract: N(),
        f_fast: N('F', 'feedFast'), f_slow: N('F', 'feedSlow'), port: N(), level: N(null, 'triggerLevel'),
        tolerance: N(), sources: Struct(),
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
        dist: N(null, 'maxDist'), retract: N(), safeZ: N(), f_fast: N('F', 'feedFast'), f_slow: N('F', 'feedSlow'),
        port: N(), sources: Struct(),
    },
    rotary_center: {
        method: Enum(), approach: Enum(), datum: Enum(), wcs: Enum(), level: N(null, 'triggerLevel'), diameter: N(),
        dist: N(null, 'maxDist'), retract: N(), safeZ: N(), f_fast: N('F', 'feedFast'), f_slow: N('F', 'feedSlow'),
        port: N(), sources: Struct(),
    },
    text: {
        text: Str(), rpm: N('S'), dir: Enum(), height: N(), spacing: N(), align: Enum(), x: N('X'), y: N('Y'),
        strokeWidth: N(), toolDia: N(), stepoverPct: N(), depth: N('Z'), stepdown: N(), feed: N('F'), plunge: N(),
        clearance: N(), ...PLACE,
    },
    // circular: delegates to middleStack (circularWizard.js → middleStack(toMiddleParams(params))) — no own params; see `middle`.
};

// ── marker codec (op record <-> ( @DDCS:v {…} ) comment), mapping internal keys <-> canon names ──
const escParens = (s) => s.replace(/\(/g, '\\u0028').replace(/\)/g, '\\u0029');   // keep payload paren-free
const canonOf = (opType, key) => (DICT[opType] && DICT[opType][key] && DICT[opType][key].canon) || key;
function revCanon(opType) {                          // marker (canon) key -> internal param key
    const spec = DICT[opType] || {}, m = {};
    for (const key in spec) m[spec[key].canon || key] = key;
    return m;
}

/** Build the marker comment line for an op record. `params` = the op's single-source-of-truth params. */
export function markerLine(opType, params) {
    const rec = { op: opType };
    for (const k in (params || {})) rec[canonOf(opType, k)] = params[k];
    return `( ${SENTINEL}:${MARKER_VERSION} ${escParens(JSON.stringify(rec))} )`;
}

/** True if a line is a DDCS op marker (cheap sentinel test). */
export const isMarker = (line) => /^\(\s*@DDCS:\d+\s/.test(String(line).trim());

/** Parse a line → { opType, params, v } (params back in internal keys) or null if not a marker. */
export function parseMarker(line) {
    const m = String(line).match(/^\(\s*@DDCS:(\d+)\s+(.*?)\s*\)\s*$/);
    if (!m) return null;
    let rec;
    try { rec = JSON.parse(m[2]); } catch (_) { return null; }
    if (!rec || typeof rec.op !== 'string') return null;
    const opType = rec.op, rev = revCanon(opType), params = {};
    for (const k in rec) { if (k === 'op') continue; params[rev[k] || k] = rec[k]; }
    return { opType, params, v: Number(m[1]) };
}

/** Validate an op record against the dictionary → warning strings ([] = clean, or op not catalogued). */
export function validate(opType, params) {
    const spec = DICT[opType];
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
