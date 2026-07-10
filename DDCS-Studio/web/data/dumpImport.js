/**
 * data/dumpImport.js — STUDIO-SIDE dump-folder mapper (t666). No gateway, no network: the user copies a controller's
 * disk to USB and drops the WHOLE folder into Studio; this recognizes the files it knows (setting / eng / coord) and
 * derives machine geometry + WCS, landing in the SAME pull-review modal (found files + raw→derived rows + Apply).
 *
 * It is a FAITHFUL JS port of the gateway's Python mapper (bridge/bridge-app/fairy/ops.py) so the two can't drift —
 * the cross-language golden spec (tests/dump-import-golden.spec.js) asserts this reproduces the EXACT values the Python
 * tests pin. Read-only over the dropped bytes. Declare-never-infer: geometry is derived from the eng dictionary BY NAME
 * (V4.1 / DM500) or the confirmed Expert index map — never by reverse-engineering an unknown layout.
 *
 * DM500 caveat (grounded this turn): its `setting` binary is NOT the index=offset·8 layout Expert/V4.1 use (decoding the
 * eng param numbers yields out-of-range garbage), so DM500 VALUES stay honest-N/A — the eng still NAMES the fields
 * (by-name), the review shows the resolved param + "value N/A (DM500 setting layout ungrounded)". Refine on a real dump.
 */

const SENTINEL = 9999.0;

/** Decode a little-endian float64 array (index N = param #N, offset N*8). Accepts ArrayBuffer / TypedArray / Buffer. */
export function readF64(buf) {
    const ab = buf instanceof ArrayBuffer ? buf
        : (buf && buf.buffer) ? buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
        : buf;
    const dv = new DataView(ab);
    const n = Math.floor(dv.byteLength / 8);
    const out = new Array(n);
    for (let i = 0; i < n; i++) out[i] = dv.getFloat64(i * 8, true);
    return out;
}

/** Parse the self-describing `eng` param dictionary → { index: { name, unit, group, type, enums } }. Ports _parse_eng:
 *  captures -tN / -s1"name" / -s2"unit" / -mN / -iN"enum"; -min/-max are intentionally ignored (as in Python). */
export function parseEng(text) {
    const out = {};
    for (const line of String(text || '').split(/\r?\n/)) {
        const m = /^\s*#(\d+)\b/.exec(line);
        if (!m) continue;
        const nm = /-s1"([^"]*)"/.exec(line);
        const un = /-s2"([^"]*)"/.exec(line);
        const grp = /-m(\d+)/.exec(line);
        const typ = /-t(\d+)/.exec(line);
        const enums = {};
        let e; const rx = /-i(\d+)"([^"]*)"/g;
        while ((e = rx.exec(line)) !== null) enums[parseInt(e[1], 10)] = e[2];
        out[parseInt(m[1], 10)] = {
            name: nm ? nm[1] : '', unit: un ? un[1] : '',
            group: grp ? parseInt(grp[1], 10) : null, type: typ ? parseInt(typ[1], 10) : null, enums,
        };
    }
    return out;
}

/** Controller id from the decoded `setting` param count (ports detect_controller's thresholds + the DM500 extension). */
export function controllerFromParamCount(n) {
    if (n >= 20000) return 'ddcs-v3-dm500';          // ~21250
    if (n >= 1400) return 'ddcs-v41';                // ~1500
    if (n >= 900 && n <= 1100) return 'ddcs-expert-m350';   // ~1000
    return null;
}

const round4 = (x) => Math.round(x * 1e4) / 1e4;

// ── Expert-M350 — the confirmed index map (ports _map_geometry_to_profile). Values grounded (index = offset). ──
const EXP = { softNeg: [161, 162, 163], softPos: [166, 167, 168], homingDir: [112, 113, 114],
    homingSpeed: [107, 108, 109], precision: 118, machZero: [235, 236, 237], activeWcs: 78, wcsBase: 305, wcsStride: 5 };

function farReach(neg, pos) {
    const ns = Math.abs(neg) >= SENTINEL, ps = Math.abs(pos) >= SENTINEL;
    if (ns && ps) return null;
    if (ns) return pos;
    if (ps) return neg;
    if (neg === 0 && pos === 0) return null;
    return Math.abs(neg) >= Math.abs(pos) ? neg : pos;
}
function homeSign(neg, pos, dirBit) {
    const no = Math.abs(neg) < SENTINEL, po = Math.abs(pos) < SENTINEL;
    if (no && po && (neg + pos) !== 0) return (neg + pos) > 0 ? 1 : -1;
    if (po && pos !== 0) return pos > 0 ? 1 : -1;
    if (no && neg !== 0) return neg > 0 ? 1 : -1;
    if (dirBit == null) return null;
    return Math.trunc(dirBit) === 0 ? 1 : -1;
}
function homeEdge(neg, pos, dirBit) {
    const fr = farReach(neg, pos);
    const sl = fr == null ? null : (fr >= 0 ? 'min' : 'max');
    const de = dirBit == null ? null : (Math.trunc(dirBit) === 0 ? 'min' : 'max');
    return [sl || de, !!(sl && de && sl !== de)];
}

export function mapExpertGeometry(params) {
    const at = (i, d = 0) => { const v = params[i]; return typeof v === 'number' ? v : d; };
    const neg = EXP.softNeg.map((i) => at(i, -SENTINEL)), pos = EXP.softPos.map((i) => at(i, SENTINEL));
    const dir = EXP.homingDir.map((i) => at(i, null));
    const ax = ['x', 'y', 'z'];
    const travel = {}, edge = {}, conflict = {}, hd = {}, sl = {};
    ax.forEach((a, i) => {
        const fr = farReach(neg[i], pos[i]);
        travel[a] = fr == null ? null : round4(Math.abs(fr));
        const [e, c] = homeEdge(neg[i], pos[i], dir[i]);
        edge[a] = e; conflict[a] = c; hd[a] = homeSign(neg[i], pos[i], dir[i]);
    });
    return {
        travel,
        softLimits: { xMin: at(EXP.softNeg[0]), xMax: at(EXP.softPos[0]), yMin: at(EXP.softNeg[1]), yMax: at(EXP.softPos[1]), zMin: at(EXP.softNeg[2]), zMax: at(EXP.softPos[2]) },
        homingDir: { x: Math.trunc(at(EXP.homingDir[0])), y: Math.trunc(at(EXP.homingDir[1])), z: Math.trunc(at(EXP.homingDir[2])) },
        homeDir: hd, homeEdge: edge, homeEdgeConflict: conflict,
        homingFeeds: { speed: { x: at(EXP.homingSpeed[0]), y: at(EXP.homingSpeed[1]), z: at(EXP.homingSpeed[2]) }, precision: at(EXP.precision) },
        machZero: { x: at(EXP.machZero[0]), y: at(EXP.machZero[1]), z: at(EXP.machZero[2]) },
    };
}
export function mapExpertWcs(params) {
    const at = (i, d = 0) => { const v = params[i]; return typeof v === 'number' ? v : d; };
    let active = at(EXP.activeWcs, 1); active = (active >= 1 && active <= 6) ? Math.trunc(active) : 1;
    const table = {};
    for (let w = 0; w < 6; w++) { const b = EXP.wcsBase + w * EXP.wcsStride; table['g' + (54 + w)] = [round4(at(b)), round4(at(b + 1)), round4(at(b + 2))]; }
    const base = EXP.wcsBase + (active - 1) * EXP.wcsStride;
    return { active, workOrigin: { x: round4(at(base)), y: round4(at(base + 1)), z: round4(at(base + 2)) }, table };
}

// ── V4.1 / DM500 — DERIVE BY NAME from the eng (ports _v41_geo_indices + _map_geometry_to_profile_v41). ──
const ENG_NAME = {
    enable: 'enable\\s+soft',
    softNeg: 'soft.?limited\\s+po\\w+\\s+value\\s+of\\s+{AX}--',
    softPos: 'soft.?limited\\s+po\\w+\\s+value\\s+of\\s+{AX}\\+\\+',
    homeDir: '{AX}\\s+axis\\s+home\\s+direction',
    seek: '{AX}\\s+axis\\s+home\\s+search\\s+speed',
    slow: '{AX}\\s+axis\\s+home\\s+positioning\\s+speed',
};
export function byNameIndices(eng) {
    const keys = Object.keys(eng).map(Number).sort((a, b) => a - b);
    const find = (pat) => { const rx = new RegExp(pat, 'i'); for (const i of keys) { if (rx.test(eng[i].name)) return i; } return null; };
    const idx = { enable: find(ENG_NAME.enable) };
    for (const role of ['softNeg', 'softPos', 'homeDir', 'seek', 'slow']) {
        idx[role] = { x: find(ENG_NAME[role].replace('{AX}', 'X')), y: find(ENG_NAME[role].replace('{AX}', 'Y')), z: find(ENG_NAME[role].replace('{AX}', 'Z')) };
    }
    return idx;
}
/** grounded=false (DM500) → indices resolve by-name but VALUES are N/A (the setting layout is ungrounded). */
export function mapByNameGeometry(params, engText, grounded = true) {
    const eng = parseEng(engText);
    const gi = byNameIndices(eng);
    const has = (i) => grounded && i != null && i >= 0 && i < params.length;
    const at = (i, d = 0) => { if (!has(i)) return d; const v = params[i]; return typeof v === 'number' ? v : d; };
    const ax = ['x', 'y', 'z'];
    const negI = gi.softNeg, posI = gi.softPos, dirI = gi.homeDir, seekI = gi.seek, slowI = gi.slow;
    const val = (i) => (has(i) ? at(i) : null);   // N/A when ungrounded / unresolved
    const travel = {}, edge = {}, conflict = {}, hd = {}, sl = {};
    ax.forEach((a) => {
        const neg = at(negI[a], -SENTINEL), pos = at(posI[a], SENTINEL);
        const dir = has(dirI[a]) ? at(dirI[a], null) : null;
        if (grounded) {
            const fr = farReach(neg, pos);
            travel[a] = fr == null ? null : round4(Math.abs(fr));
            const [e, c] = homeEdge(neg, pos, dir); edge[a] = e; conflict[a] = c; hd[a] = homeSign(neg, pos, dir);
        } else { travel[a] = null; edge[a] = null; conflict[a] = false; hd[a] = null; }
    });
    const speed = { x: val(seekI.x), y: val(seekI.y), z: val(seekI.z) };
    const anySpeed = grounded && (speed.x || speed.y || speed.z);
    const enable = has(gi.enable) ? at(gi.enable, 1) : null;
    return {
        travel,
        softLimits: { xMin: val(negI.x), xMax: val(posI.x), yMin: val(negI.y), yMax: val(posI.y), zMin: val(negI.z), zMax: val(posI.z) },
        homeDir: hd, homeEdge: edge, homeEdgeConflict: conflict,
        homingFeeds: anySpeed ? { speed, precision: val(slowI.x) } : null,
        machZero: null,
        softLimitEnabled: enable == null ? null : !!Math.trunc(enable),
        _indices: gi,   // provenance for the review's raw rows (which eng # each field resolved to)
        _grounded: grounded,
    };
}

const V41_ACTIVE_WCS = 16, V41_COORD_STRIDE = 6;
/** V4.1 WCS from coord1 (54×f64, block 1 = G54, stride 6). activeEnum = setting #16. Ports _map_wcs_to_profile_v41. */
export function mapCoordWcs(coord1, activeEnum) {
    if (!coord1 || coord1.length < 7 * V41_COORD_STRIDE) return null;
    const cell = (block, ax) => { const v = coord1[block * V41_COORD_STRIDE + ax]; return typeof v === 'number' ? round4(v) : 0; };
    const table = {};
    for (let w = 0; w < 6; w++) table['g' + (54 + w)] = [cell(w + 1, 0), cell(w + 1, 1), cell(w + 1, 2)];
    const enum_ = Number.isFinite(activeEnum) ? Math.trunc(activeEnum) : 0;
    const active = (enum_ >= 1 && enum_ <= 6) ? enum_ : 1;
    const wo = table['g' + (53 + active)];
    return { active, workOrigin: { x: wo[0], y: wo[1], z: wo[2] }, table };
}

/** Classify a dropped file by NAME (the disk convention). Read-only; never trusts extension over the known set. */
export function classifyFile(name) {
    const base = String(name).split(/[\\/]/).pop().toLowerCase();
    if (base === 'setting') return 'setting';
    if (base === 'eng') return 'eng';
    if (base === 'coord1' || base === 'coordinate') return 'coord';
    return null;
}

/**
 * Recognize a dropped dump. `files` = [{ name, text?, buffer? }] (text for eng, ArrayBuffer/bytes for setting/coord).
 * Returns { controllerId, recognized:[{name,role}], unrecognized:[name], geometry, wcs, grounded, note }.
 */
export function recognizeDump(files) {
    let settingParams = null, engText = null, coordParams = null;
    const recognized = [], unrecognized = [];
    for (const f of files || []) {
        const role = classifyFile(f.name);
        if (role === 'setting' && f.buffer != null) { settingParams = readF64(f.buffer); recognized.push({ name: f.name, role }); }
        else if (role === 'eng' && f.text != null) { engText = f.text; recognized.push({ name: f.name, role }); }
        else if (role === 'coord' && f.buffer != null) { coordParams = readF64(f.buffer); recognized.push({ name: f.name, role }); }
        else unrecognized.push(f.name);
    }
    // Identify the controller: prefer the setting size; else the eng shape (has soft-limit names) → treat as by-name.
    let controllerId = settingParams ? controllerFromParamCount(settingParams.length) : null;
    if (!controllerId && engText) controllerId = 'ddcs-v3-dm500';   // eng-only drop (no setting) — by-name, values N/A
    let geometry = null, wcs = null, grounded = false, note = '';
    if (controllerId === 'ddcs-expert-m350' && settingParams) {
        geometry = mapExpertGeometry(settingParams); wcs = mapExpertWcs(settingParams); grounded = true;
    } else if (controllerId === 'ddcs-v41' && settingParams) {
        geometry = engText ? mapByNameGeometry(settingParams, engText, true) : null; grounded = !!engText;
        wcs = coordParams ? mapCoordWcs(coordParams, settingParams[V41_ACTIVE_WCS]) : null;
        if (!engText) note = 'Drop the eng file too — V4.1 geometry is derived from it by name.';
    } else if (controllerId === 'ddcs-v3-dm500') {
        // DM500 setting layout is ungrounded → NAMES resolve by-name, VALUES stay N/A (honest; refine on a real dump).
        geometry = engText ? mapByNameGeometry(settingParams || [], engText, false) : null;
        grounded = false;
        note = 'DM500 geometry is named from the eng, but its setting layout is not yet grounded — values show N/A until a real dump confirms them.';
    }
    return { controllerId, recognized, unrecognized, geometry, wcs, grounded, note };
}
