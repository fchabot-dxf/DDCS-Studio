/**
 * DDCS Studio — Settings panel (a sibling header tab to STUDIO and GATEWAY).
 *
 * A header ⚙ button opens an overlay with two L1 groups:
 *   - General:  Profile · Appearance · Variables · Program · Feedback · Network · About
 *   - Hardware: Machine · Spindle · Input · Output · ATC  (subsystems added via "+ Add")
 *
 * Settings persist to localStorage and broadcast `ddcs:settings-changed` so the
 * 3D preview can redraw. The viewer reads them via window.ddcsGetSettings().
 */
import { UIUtils } from './uiUtils.js';
import { CONTROLLER_PROFILES, getActiveProfile, setActiveProfile, registerProfile } from '../shared/js/profiles/controllerProfiles.js';
import { listPosts, getActivePostId, setActivePostId, isPostVerified, getDialect } from '../wizards/dialects/index.js';
import { makeClient } from '../shared/js/client.js';
import { renderIoTable, renderMagazineTable } from './ioTable.js';
import { toolProfileSvg } from '../viz/toolProfile.js';
import { THEMES } from './themes.js';
import { generateToolChangeNc } from '../data/atcGenerator.js';
import { renderCloudLogin } from './cloudAccount.js';

const DDCS_SETTINGS_KEY = 'ddcs_studio_settings';

// --- Tool library ----------------------------------------------------------
// atc.tools[i] is the record for tool i+1 (T-word). `length` is the controller
// tool-length offset written to #[baseVar + i] (#1430 = T1); the other fields are
// the Studio-side tool library the Mill wizards pick from. Not ATC-specific — the
// Tool table tab is always present, so this works for manual tool change too.
export const TOOL_TYPES = ['endmill', 'drill', 'ballnose', 'chamfer', 'vbit', 'spotdrill', 'face', 'tap', 'reamer', 'engraver', 'other'];
// A small starter library so the Mill wizards have tools to pick on a fresh install. Seeded into a new install's
// defaults and, once, into an existing install with an empty library (the `toolsSeeded` flag means clearing it
// stays cleared). Plain editable records — feeds/speeds are conservative starting points; tune per material.
export const STANDARD_TOOLS = [
    { num: 1, name: '6mm Flat Endmill',  type: 'endmill',  dia: 6,     flutes: 2, length: '', rpm: 18000, feed: 1200, plunge: 400 },
    { num: 2, name: '1/8" Flat Endmill', type: 'endmill',  dia: 3.175, flutes: 2, length: '', rpm: 18000, feed: 800,  plunge: 300 },
    { num: 3, name: '6mm Ball Nose',     type: 'ballnose', dia: 6,     flutes: 2, length: '', rpm: 18000, feed: 1000, plunge: 350 },
    { num: 4, name: '60° V-Bit',         type: 'vbit',     dia: 6,     flutes: 1, length: '', rpm: 18000, feed: 600,  plunge: 200 },
];
const standardTools = () => STANDARD_TOOLS.map((t) => ({ ...t }));
// Coerce a legacy bare-number slot (was the length offset) — or a partial object — into the
// full record. `num` is the tool number (T-word); `fallbackNum` supplies it for legacy entries
// that pre-date sparse storage (dense index + 1). Empty/blank fields read as "unset".
export function normalizeTool(t, fallbackNum) {
    const fb = (fallbackNum != null) ? fallbackNum : '';
    if (typeof t === 'number') return { num: fb, name: '', type: '', dia: '', flutes: '', length: t, rpm: '', feed: '', plunge: '' };
    const o = (t && typeof t === 'object') ? t : {};
    return {
        num: (o.num != null && o.num !== '') ? o.num : fb,
        name: o.name || '', type: o.type || '',
        dia: o.dia ?? '', flutes: o.flutes ?? '', length: o.length ?? '',
        rpm: o.rpm ?? '', feed: o.feed ?? '', plunge: o.plunge ?? '',
    };
}
// The library as a sparse list of real tools: normalized, with a tool number, blanks dropped.
// Legacy dense storage (index = tool−1) migrates here — index+1 becomes the tool number.
export function libraryTools(atc) {
    const tools = Array.isArray(atc && atc.tools) ? atc.tools : [];
    return tools.map((t, i) => normalizeTool(t, i + 1)).filter((t) =>
        t.name || t.type || t.dia !== '' || t.flutes !== '' || t.length !== '' || t.rpm !== '' || t.feed !== '' || t.plunge !== '');
}

// Built-in stock presets. Shape ∈ boss|pocket|cylinder; dimensions are separate (mm).
// A flat board suits 3-axis work; rotary stock is a 3" block or Ø3" cylinder. Users can
// save their own (any shape) on top of these — see stockTemplates in settings.
export const STOCK_TEMPLATES = [
    { name: '3-axis plate (small)', x: 150, y: 100, z: 20, shape: 'boss' },
    { name: '3-axis board (large)', x: 400, y: 300, z: 18, shape: 'boss' },
    { name: 'Rotary block 3″', x: 150, y: 76.2, z: 76.2, shape: 'boss' },
    { name: 'Rotary cylinder Ø3″', x: 150, y: 76.2, z: 76.2, shape: 'cylinder' },
];
const SETTINGS_DEFAULTS = {
    stock:   { x: 100, y: 80, z: 20, shape: 'boss', show: true, datum: 'nnp', pin: 'origin' },
    stockTemplates: [],   // user-saved presets: { name, x, y, z, shape }
    // Travel x/y/z are SIGNED (sign = home direction). workOrigin = the active WCS offset (machine coords of
    // part-zero), kept in sync from wcs.table[active-1]. wcs = the G54–G59 table pulled from the controller.
    machine: { x: 300, y: 300, z: 120, show: true, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: null } },
    view:    { theta: -1.5708, phi: 1.0472 }, // 3D preview start orientation (front: +X right, +Y back)
    probes:  {
        probePin: 3, probeLevel: 0,        // IN03 = YunKia V6 3D probe (confirmed)
        setterPin: 2, setterLevel: 0,      // IN02 = fixed Tool Setter (confirmed); was 4 (IN04 = unwired)
        setterX: 10, setterY: 10, setterZ: -50, setterW: 20, setterH: 20,
        // 3D-probe global defaults the touch-probe wizards (corner/edge/middle/circular/alignment/rotary)
        // start from. radius drives radius compensation; feeds/retract/safeZ/maxDist/qStop seed each op.
        radius: 2.0, fastFeed: 200, slowFeed: 50, retract: 2, safeZ: 10, maxDist: 100, qStop: 1,
        // Per-field source: 'studio' = literal from the form (current behaviour) | 'ctrl' = generated
        // code reads the controller's own parameter at runtime (e.g. F#632 P#1078 — see
        // PROBE-CONFIG-SOURCE.md). Only fields the active controller profile lists in probeVars
        // can be 'ctrl'; the wizard inputs show a controller glyph to flip each one.
        sources: { port: 'studio', level: 'studio', fastFeed: 'studio', retract: 'studio',
                   setterPort: 'studio', setterLevel: 'studio', blockHeight: 'studio' },
    },
    limits: {
        xMinPin: '', xMinLevel: 0, xMaxPin: '', xMaxLevel: 0,
        yMinPin: '', yMinLevel: 0, yMaxPin: '', yMaxLevel: 0,
        zMinPin: '', zMinLevel: 0, zMaxPin: '', zMaxLevel: 0
    },
    // Which hardware tabs are shown (manual toggles, persisted). Defaults match the M350 profile:
    // Probes + Limits on, ATC off (no clutter unless you have a tool changer). Fully manual so non-bridge
    // users can configure for accurate simulation; a controller profile just presets these.
    hardwareTabs: { probes: true, atc: false, limits: true, spindle: false },
    // 3D/2D toolpath preview (read by viz/createPreviewPanel via window.ddcsGetSettings().preview).
    preview: { followDamp: 50, showRapids: true, defaultView: '3d', defaultSpeed: 1, followDefault: true, autoLoop: true, gridStep: 0 },
    // Composing assists (Blocks suggestions, Studio editor autocomplete, ghost next-block).
    compose: { suggestions: true, autocomplete: true, ghost: true },
    // ATC: tool-length probe defaults (consumed by the Tool Length wizard) + the tool-offset table.
    // baseVar = DDCS tool-offset table base (#1430 = tool 1); tools[i] = stored length for tool i+1.
    atc: {
        baseVar: 1430, tools: standardTools(),
        blockHeight: 50, safeZ: 10, maxDist: 100, retract: 3, fFast: 300, fSlow: 50, qStop: 1,
        magType: 'straight', magazine: []   // magType: straight|disk; magazine[]: {pocket,tool,name,x,y,z}
    },
    // Toolhead fitted to the machine. spindle/router is the working type; plasma/laser are stubs.
    // Type-specific config lives in its own object (spindle below; plasma/laser TBD).
    head: { type: 'spindle' },
    // Spindle / VFD — Studio-side authoring defaults. The DDCS controller owns the live spindle
    // params (PWM/analog, max RPM #582); these seed generated M3/M4 + S words, spin-up/down dwell,
    // and the warm-up wizard target. Added via the Head tab's "Add head".
    spindle: { maxRpm: 24000, defaultRpm: 18000, dir: 'cw', spinUp: 3, spinDown: 3 },
    // End-of-program routine — the safe footer appended to generated programs. DDCS note: G53
    // machine-coord moves are verified; G28 is NOT configured, so retract/park use G53. Global
    // default; per-wizard overrides can layer on top later.
    endProgram: { spindleOff: true, coolantOff: true, retract: true, retractZ: 0, park: false, parkX: 0, parkY: 0, end: 'M30' },
    // Dynamic machine I/O — the new source of truth; seeded from probes/limits on first load.
    inputs: [],
    outputs: [],
    // Custom controller macros (PART OF THE PROFILE): each = { id, name, trigger, body }. trigger.kind =
    // 'mcode' (O100nn → Mnn, called from a program) | 'kbutton' (key-1..7.nc, a panel button) | 'program'
    // (a named .nc). Authored in the Macros tab; rides in Export/Import/cloud via buildProfile.
    macros: [],
    // Axis roles — X/Y/Z linear; A/B optionally rotary. The sim reads this to spin the solid on a
    // rotary-axis move (around the declared Cartesian axis). Two rotary axes are allowed (A and B).
    motors: {
        x: { role: 'linear' }, y: { role: 'linear' }, z: { role: 'linear' },
        a: { role: 'unused', around: 'x' },
        b: { role: 'unused', around: 'y' }
    }
};

// ── Dynamic I/O model (inputs[] / outputs[]) ────────────────────────────────
// On first load we seed inputs[] from the legacy flat probes/limits so nothing is lost.
// syncFlatFromIO() mirrors edits back to the flat fields so the sim + wizards keep working
// until they read the arrays directly (stage 3). Pin ranges: inputs 1–24, outputs 1–20.
const LIMIT_AXES = [
    ['x_min', 'Limit X−', 'xMinPin', 'xMinLevel'], ['x_max', 'Limit X+', 'xMaxPin', 'xMaxLevel'],
    ['y_min', 'Limit Y−', 'yMinPin', 'yMinLevel'], ['y_max', 'Limit Y+', 'yMaxPin', 'yMaxLevel'],
    ['z_min', 'Limit Z−', 'zMinPin', 'zMinLevel'], ['z_max', 'Limit Z+', 'zMaxPin', 'zMaxLevel'],
];

function migrateIO(s) {
    if (!Array.isArray(s.inputs)) s.inputs = [];
    if (!Array.isArray(s.outputs)) s.outputs = [];
    if (s.inputs.length === 0) {
        const p = s.probes || {};
        s.inputs.push({ id: 'probe', type: 'probe', label: '3D Probe', pin: p.probePin ?? '', level: p.probeLevel ?? 0 });
        s.inputs.push({ id: 'setter', type: 'setter', label: 'Tool Setter', pin: p.setterPin ?? '', level: p.setterLevel ?? 0,
            x: p.setterX, y: p.setterY, z: p.setterZ, w: p.setterW, h: p.setterH });
        const L = s.limits || {};
        for (const [axis, label, pinK, lvlK] of LIMIT_AXES) {
            if (L[pinK] !== '' && L[pinK] != null) s.inputs.push({ id: 'limit_' + axis, type: 'limit', axis, label, pin: L[pinK], level: L[lvlK] || 0 });
        }
    }
    return s;
}

// Mirror inputs[] back into the flat probes/limits the sim + wizards still read (stage-2 interim).
function syncFlatFromIO(s) {
    const first = (t) => (s.inputs || []).find(i => i.type === t);
    const probe = first('probe'), setter = first('setter');
    s.probes = s.probes || {};
    if (probe) { s.probes.probePin = probe.pin; s.probes.probeLevel = probe.level; }
    if (setter) Object.assign(s.probes, { setterPin: setter.pin, setterLevel: setter.level, setterX: setter.x, setterY: setter.y, setterZ: setter.z, setterW: setter.w, setterH: setter.h });
    s.limits = s.limits || {};
    for (const [, , pinK, lvlK] of LIMIT_AXES) { s.limits[pinK] = ''; s.limits[lvlK] = 0; }
    for (const inp of (s.inputs || [])) {
        if (inp.type !== 'limit') continue;
        const row = LIMIT_AXES.find(a => a[0] === inp.axis);
        if (row) { s.limits[row[2]] = inp.pin; s.limits[row[3]] = inp.level || 0; }
    }
}

let _ddcsSettings = loadSettings();
// Migrate any legacy dense / bare-number tool storage to the sparse library shape (one pass, idempotent).
if (_ddcsSettings.atc) _ddcsSettings.atc.tools = libraryTools(_ddcsSettings.atc);

function loadSettings() {
    try {
        const raw = localStorage.getItem(DDCS_SETTINGS_KEY);
        if (raw) {
            const p = JSON.parse(raw);
            const merged = migrateIO({
                toolsSeeded: p.toolsSeeded === true,
                stock: { ...SETTINGS_DEFAULTS.stock, ...(p.stock || {}) },
                stockTemplates: Array.isArray(p.stockTemplates) ? p.stockTemplates : [],
                machine: { ...SETTINGS_DEFAULTS.machine, ...(p.machine || {}) },
                view: { ...SETTINGS_DEFAULTS.view, ...(p.view || {}) },
                probes: { ...SETTINGS_DEFAULTS.probes, ...(p.probes || {}),
                          sources: { ...SETTINGS_DEFAULTS.probes.sources, ...((p.probes || {}).sources || {}) } },
                limits: { ...SETTINGS_DEFAULTS.limits, ...(p.limits || {}) },
                hardwareTabs: { ...SETTINGS_DEFAULTS.hardwareTabs, ...(p.hardwareTabs || {}) },
                preview: { ...SETTINGS_DEFAULTS.preview, ...(p.preview || {}) },
                compose: { ...SETTINGS_DEFAULTS.compose, ...(p.compose || {}) },
                atc: { ...SETTINGS_DEFAULTS.atc, ...(p.atc || {}) },
                head: { ...SETTINGS_DEFAULTS.head, ...(p.head || {}) },
                spindle: { ...SETTINGS_DEFAULTS.spindle, ...(p.spindle || {}) },
                endProgram: { ...SETTINGS_DEFAULTS.endProgram, ...(p.endProgram || {}) },
                motors: { ...SETTINGS_DEFAULTS.motors, ...(p.motors || {}) },
                inputs: Array.isArray(p.inputs) ? p.inputs : [],
                outputs: Array.isArray(p.outputs) ? p.outputs : [],
                macros: Array.isArray(p.macros) ? p.macros : [],
            });
            // One-time seed of the starter tool library into an existing install (empty + never seeded before).
            if (!merged.toolsSeeded && (!Array.isArray(merged.atc.tools) || merged.atc.tools.length === 0)) {
                merged.atc.tools = standardTools();
            }
            merged.toolsSeeded = true;
            return merged;
        }
    } catch (e) { /* ignore */ }
    return migrateIO(JSON.parse(JSON.stringify(SETTINGS_DEFAULTS)));
}

export function saveSettings() {
    try { localStorage.setItem(DDCS_SETTINGS_KEY, JSON.stringify(_ddcsSettings)); } catch (e) { /* ignore */ }
    window.dispatchEvent(new CustomEvent('ddcs:settings-changed', { detail: _ddcsSettings }));
}

export function getSettings() { return _ddcsSettings; }
export function getInputs() { return _ddcsSettings.inputs || []; }
export function getOutputs() { return _ddcsSettings.outputs || []; }
// Rotary axes for the sim: { a: 'x' } = axis A is rotary around X (the 3D view spins on those axes' moves).
// Extensible toward 5-axis: a future `parent` field per axis adds the nested kinematic chain.
export function getRotaryAxes() {
    const m = _ddcsSettings.motors || {};
    const out = {};
    for (const ax of ['a', 'b']) { if (m[ax] && m[ax].role === 'rotary') out[ax] = m[ax].around || 'x'; }
    return out;
}
// Push inputs[] edits back into the flat probes/limits the sim + wizards still read (stage-2 interim).
export function syncIO() { syncFlatFromIO(_ddcsSettings); saveSettings(); }

// ── Probe config source (PROBE-CONFIG-SOURCE.md) ─────────────────────────────
// A field is controller-resident when the user flipped it to 'ctrl' AND the active
// profile has a native var for it. Returns { ctrl, pr, label } when lit, else null.
export function probeSrc(field) {
    const pv = (getActiveProfile().probeVars || {})[field];
    if (!pv) return null;
    return (_ddcsSettings.probes.sources || {})[field] === 'ctrl' ? pv : null;
}
// Whether the active profile supports the field at all (drives glyph visibility).
export function probeSrcAvailable(field) {
    return !!(getActiveProfile().probeVars || {})[field];
}
export function setProbeSrc(field, mode) {
    if (!_ddcsSettings.probes.sources) _ddcsSettings.probes.sources = {};
    _ddcsSettings.probes.sources[field] = mode === 'ctrl' ? 'ctrl' : 'studio';
    saveSettings();   // broadcasts ddcs:settings-changed → open wizard re-renders
}
/** Resolve the lit fields among `fields` → { field: {ctrl,pr,label} } for generator params. */
export function resolveProbeSources(fields) {
    const out = {};
    for (const f of fields) { const s = probeSrc(f); if (s) out[f] = s; }
    return out;
}
window.ddcsProbeSrc = probeSrc;
window.ddcsProbeSrcAvailable = probeSrcAvailable;
window.ddcsSetProbeSrc = setProbeSrc;
window.ddcsResolveProbeSources = resolveProbeSources;

// The WCS table (G54–G59 offsets, machine coords of each part-zero) + which one is active. workOrigin (used by
// the sim for G53/program placement) is derived from the active row. Pulled from the controller, editable offline.
const WCS_NAMES = ['G54', 'G55', 'G56', 'G57', 'G58', 'G59'];
function syncWorkOrigin(m) {
    const w = m.wcs, r = w && w.table && w.table[(w.active || 1) - 1];
    m.workOrigin = r ? { x: num(r.x, 0), y: num(r.y, 0), z: num(r.z, 0) } : { x: 0, y: 0, z: 0 };
}
function renderWcsTable(host, machine) {
    if (!host) return;
    machine.wcs = machine.wcs || { active: 1, table: null };
    const w = machine.wcs;
    if (!Array.isArray(w.table)) w.table = WCS_NAMES.map(() => ({ x: '', y: '', z: '' }));
    if (!w.active) w.active = 1;
    const GRID = 'display:grid; grid-template-columns:30px 42px 1fr 1fr 1fr; gap:6px; align-items:center;';
    host.innerHTML = '';
    const head = document.createElement('div');
    head.style.cssText = GRID + ' font-size:10px; color:var(--text-dim); padding:0 2px 3px;';
    head.innerHTML = '<span>act</span><span>WCS</span><span>X</span><span>Y</span><span>Z</span>';
    host.appendChild(head);
    w.table.forEach((row, i) => {
        const tr = document.createElement('div');
        tr.style.cssText = GRID + ' padding:2px;';
        const rb = document.createElement('input'); rb.type = 'radio'; rb.name = 'wcs_active'; rb.checked = w.active === i + 1;
        rb.title = 'Active WCS — positions the program in the envelope';
        rb.addEventListener('change', () => { w.active = i + 1; syncWorkOrigin(machine); saveSettings(); });
        const lab = document.createElement('span'); lab.textContent = WCS_NAMES[i]; lab.style.cssText = 'font-weight:600; font-size:11px;';
        tr.appendChild(rb); tr.appendChild(lab);
        ['x', 'y', 'z'].forEach((k) => {
            const inp = document.createElement('input'); inp.type = 'number'; inp.step = '0.001'; inp.value = row[k] ?? '';
            inp.style.cssText = 'width:100%; box-sizing:border-box;';
            inp.addEventListener('change', () => { row[k] = inp.value === '' ? '' : Number(inp.value); if (w.active === i + 1) syncWorkOrigin(machine); saveSettings(); });
            tr.appendChild(inp);
        });
        host.appendChild(tr);
    });
}

let _fillSettingsInputs = null;

// Merge incoming settings (e.g. from an imported / cloud-loaded profile), persist, and refresh the panel.
// Restores the FULL persisted config (mirrors the load-merge) so a loaded profile brings back the magazine,
// tool library, macros, I/O, head, etc. — not just a subset.
export function applySettings(incoming) {
    if (!incoming || typeof incoming !== 'object') return;
    const D = SETTINGS_DEFAULTS, S = _ddcsSettings;
    if (incoming.stock) S.stock = { ...D.stock, ...S.stock, ...incoming.stock };
    if (incoming.machine) S.machine = { ...D.machine, ...S.machine, ...incoming.machine };
    if (incoming.probes) S.probes = { ...D.probes, ...S.probes, ...incoming.probes, sources: { ...D.probes.sources, ...((S.probes || {}).sources || {}), ...((incoming.probes || {}).sources || {}) } };
    if (incoming.limits) S.limits = { ...D.limits, ...S.limits, ...incoming.limits };
    if (incoming.atc) S.atc = { ...D.atc, ...S.atc, ...incoming.atc };
    if (incoming.head) S.head = { ...D.head, ...S.head, ...incoming.head };
    if (incoming.spindle) S.spindle = { ...D.spindle, ...S.spindle, ...incoming.spindle };
    if (incoming.endProgram) S.endProgram = { ...D.endProgram, ...S.endProgram, ...incoming.endProgram };
    if (incoming.motors) S.motors = { ...D.motors, ...S.motors, ...incoming.motors };
    if (incoming.hardwareTabs) S.hardwareTabs = { ...D.hardwareTabs, ...S.hardwareTabs, ...incoming.hardwareTabs };
    if (incoming.preview) S.preview = { ...D.preview, ...S.preview, ...incoming.preview };
    if (incoming.compose) S.compose = { ...D.compose, ...S.compose, ...incoming.compose };
    if (incoming.view) S.view = { ...D.view, ...S.view, ...incoming.view };
    if (Array.isArray(incoming.stockTemplates)) S.stockTemplates = incoming.stockTemplates;
    if (Array.isArray(incoming.inputs)) { S.inputs = incoming.inputs; syncFlatFromIO(S); }
    if (Array.isArray(incoming.outputs)) S.outputs = incoming.outputs;
    if (Array.isArray(incoming.macros)) S.macros = incoming.macros;
    saveSettings();
    if (_fillSettingsInputs) _fillSettingsInputs();
}

function buildSettingsOverlay() {
    const parent = document.getElementById('settings-app');
    if (!parent) return;
    if (parent.querySelector('.settings-body')) return;
        parent.classList.remove('hidden');
    parent.innerHTML = `
        <style>
            #settings-app { display: flex; flex-direction: column; }
            #settings-app .settings-head { padding: 8px 16px; border-bottom: 1px solid var(--border); background: var(--panel); flex: 0 0 auto; display: flex; align-items: center; }
            #settings-app .settings-main-tab, #settings-app .settings-main-tab:hover, #settings-app .settings-main-tab:active { position: relative; padding: 6px 6px; font-size: 12.5px; font-weight: 700; letter-spacing: 1px; font-family: inherit; color: var(--text-dim); background: transparent; border: none; border-radius: 0; box-shadow: none; text-shadow: none; filter: none; transform: none; cursor: pointer; transition: 120ms; }
            #settings-app .settings-main-tab:hover, #settings-app .settings-main-tab.active { color: var(--text-main); }
            #settings-app .settings-main-tab.active::after { content: ''; position: absolute; left: 4px; right: 4px; bottom: -8px; height: 3px; background: var(--accent); border-radius: var(--radius, 3px) var(--radius, 3px) 0 0; }
            #settings-app .settings-body { display: flex; flex-direction: row; flex: 1; min-height: 0; overflow: hidden; }
            #settings-app .settings-sidebar { width: 160px; flex: 0 0 160px; display: flex; flex-direction: column; gap: 2px; padding: 12px 8px; border-right: 1px solid var(--border); background: var(--panel); overflow-y: auto; }
            #settings-app .settings-sidebar .settings-tab { display: block; width: 100%; text-align: left; padding: 7px 12px; font-size: 12.5px; font-weight: 600; border-radius: var(--radius, 4px); border: none; background: transparent; color: var(--text-dim); cursor: pointer; transition: 120ms; }
            #settings-app .settings-sidebar .settings-tab:hover { background: var(--bg); color: var(--text-main); }
            #settings-app .settings-sidebar .settings-tab.active { background: var(--bg); color: var(--text-main); border-left: 3px solid var(--accent); padding-left: 9px; }
            #settings-app .settings-sidebar .sidebar-group-label { font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--text-dim); padding: 8px 12px 4px; opacity: .6; }
            #settings-app .settings-sidebar .sidebar-group-label:first-child { padding-top: 2px; }
            #settings-app .settings-content { flex: 1; min-width: 0; overflow-y: auto; padding: 16px 20px; background: var(--bg); }
            #settings-app .settings-foot { flex: 0 0 auto; padding: 8px 16px; border-top: 1px solid var(--border); background: var(--panel); display: flex; gap: 8px; }
            #settings-app .settings-head { justify-content: space-between; }
            #settings-app .settings-close { margin-left: auto; background: transparent; border: none; box-shadow: none; text-shadow: none; color: var(--text-dim); font-size: 17px; line-height: 1; cursor: pointer; padding: 4px 8px; min-height: 0; border-radius: var(--radius, 4px); }
            #settings-app .settings-close:hover { color: var(--text-main); background: var(--bg); }
            #settings-app .settings-foot { justify-content: flex-end; }
            #settings-app .settings-done { background: var(--accent); color: #fff; border: none; border-radius: var(--radius, 5px); padding: 7px 24px; font-size: 13px; font-weight: 600; cursor: pointer; transition: filter 120ms; }
            #settings-app .settings-done:hover { filter: brightness(1.12); }
        </style>
            <div class="settings-head">
                <div style="display: flex; align-items: center; gap: 16px;">
                    <div class="settings-tabs" style="display: flex; gap: 8px;">
                        <button class="settings-main-tab active" data-group="general">General</button>
                        <button class="settings-main-tab" data-group="hardware">Hardware</button>
                    </div>
                </div>
                <button class="settings-close" type="button" title="Close (Esc)" aria-label="Close settings" onclick="window.closeSettings && window.closeSettings()">✕</button>
            </div>
            <div class="settings-body">
                <div class="settings-sidebar">
                    <div class="sidebar-group-label" data-group-label="general">General</div>
                    <button class="settings-tab active" data-group="general" data-target="set_tab_profile">Profile</button>
                    <button class="settings-tab" data-group="general" data-target="set_tab_appearance">Appearance</button>
                    <button class="settings-tab" data-group="general" data-target="set_tab_preview">Preview</button>
                    <button class="settings-tab" data-group="general" data-target="set_tab_compose">Editor</button>
                    <button class="settings-tab" data-group="general" data-target="set_tab_variables">Variables</button>
                    <button class="settings-tab" data-group="general" data-target="set_tab_program">Program</button>
                    <button class="settings-tab" data-group="general" data-target="set_tab_gateway">Gateway</button>
                    <button class="settings-tab" data-group="general" data-target="set_tab_cloud">Cloud</button>
                    <button class="settings-tab" data-group="general" data-target="set_tab_faq">FAQ</button>
                    <button class="settings-tab" data-group="general" data-target="set_tab_feedback">Feedback</button>
                    <button class="settings-tab" data-group="general" data-target="set_tab_about">About</button>
                    <div class="sidebar-group-label" data-group-label="hardware" style="display:none;">Hardware</div>
                    <button class="settings-tab" data-group="hardware" data-target="set_tab_machine" style="display:none;">Machine</button>
                    <button class="settings-tab" data-group="hardware" data-target="set_tab_spindle" style="display:none;">Head</button>
                    <button class="settings-tab" data-group="hardware" data-target="set_tab_input" style="display:none;">Input</button>
                    <button class="settings-tab" data-group="hardware" data-target="set_tab_output" style="display:none;">Output</button>
                    <button class="settings-tab" data-group="hardware" data-target="set_tab_atc" style="display:none;">Tool table</button>
                </div>
                <div class="settings-content">
                <!-- GENERAL: PREVIEW (3D/2D toolpath view + simulation) -->
                <div id="set_tab_preview" style="display:none;">
                    <div class="settings-section">
                        <div class="settings-section-title">TOOLPATH PREVIEW</div>
                        <div class="settings-field">Default view
                            <select id="set_pv_view"><option value="3d">3D</option><option value="2d">2D (top-down)</option></select>
                        </div>
                        <div class="settings-field">Default play speed
                            <select id="set_pv_speed"><option value="1">1×</option><option value="2">2×</option><option value="5">5×</option><option value="10">10×</option></select>
                        </div>
                        <label class="settings-check"><input type="checkbox" id="set_pv_rapids"> Show rapid moves (yellow) in the 3D view</label>
                        <div class="settings-field" style="margin-top:10px">Grid spacing
                            <select id="set_pv_gridstep" title="Floor-grid line spacing. The grid is linked to the machine envelope; Auto picks a tidy step for its size.">
                                <option value="0">Auto</option>
                                <option value="5">5 mm</option>
                                <option value="10">10 mm</option>
                                <option value="20">20 mm</option>
                                <option value="25">25 mm</option>
                                <option value="50">50 mm</option>
                                <option value="100">100 mm</option>
                            </select>
                        </div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">FOLLOW CAMERA</div>
                        <div class="settings-hint">Toggle the follow-cam (the ⌖ button in the preview bar) to keep the tool centred while playing. Damping smooths how fast the camera catches up.</div>
                        <label class="settings-check"><input type="checkbox" id="set_pv_follow_default"> Centre-lock the camera when a preview opens</label>
                        <label class="settings-check"><input type="checkbox" id="set_pv_autoloop"> Auto-play in a loop when a preview opens</label>
                        <div class="settings-field" style="margin-top:10px">Centre-lock damping — <span id="set_pv_followdamp_val">50%</span>
                            <input type="range" id="set_pv_followdamp" min="0" max="100" step="5" style="width:100%; max-width:280px;">
                        </div>
                        <div class="settings-hint">Low = snaps to the tool · High = smooth, gentle follow.</div>
                    </div>
                </div>
                <!-- GENERAL: COMPOSING (authoring assists — Blocks suggestions + Studio editor autocomplete) -->
                <div id="set_tab_compose" style="display:none;">
                    <div class="settings-section">
                        <div class="settings-section-title">EDITOR ASSISTS</div>
                        <div class="settings-hint">Authoring help across both editors — the Blocks tab and the Studio text editor. All optional.</div>
                        <label class="settings-check"><input type="checkbox" id="set_cp_suggestions"> Block suggestions — the "Suggested next" chip strip in the Blocks tab</label>
                        <label class="settings-check"><input type="checkbox" id="set_cp_autocomplete"> Editor autocomplete — context suggestions at the cursor in the Studio editor</label>
                        <label class="settings-check"><input type="checkbox" id="set_cp_ghost"> Suggestion box — a floating box of likely next blocks on the canvas (click, or Tab takes the first)</label>
                    </div>
                </div>
                <!-- GENERAL: PROFILE -->
                <div id="set_tab_profile">
                    <div class="settings-section">
                        <div class="settings-section-title">CONTROLLER</div>
                        <div class="settings-row">
                            <select id="set_profile" title="Controller profile — presets the hardware your machine has" style="background:#222; color:#ddd; border:1px solid #888; font-size:13px; padding:4px 8px;"></select>
                            <button class="toolbar-btn settings-io" id="set_profile_pull" title="Fetch this machine's profile (tabs + pins) from the bridged controller. Offline controllers like the DDCS 3.1: use Import profile.">↧ Pull from controller</button>
                        </div>
                        <div class="settings-hint">Which controller you have (DDCS Expert, 4.1, …) — sets the G-code dialect/post and presets your hardware tabs. (The <b>Profile</b> below saves your actual settings + variables for it.)</div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">POST PROCESSOR</div>
                        <div class="settings-row">
                            <select id="set_post" title="Which controller's G-code to generate. 'Follow machine profile' uses your machine's native post; override to emit code for another controller." style="background:#222; color:#ddd; border:1px solid #888; font-size:13px; padding:4px 8px;"></select>
                        </div>
                        <div class="settings-hint" id="set_post_hint">Which controller's G-code the Blocks view generates. Defaults to your machine's post; override to target another controller.</div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">PROFILE (settings + variables)</div>
                        <div class="settings-row">
                            <button class="toolbar-btn settings-io" id="set_profile_export">⬇ Export profile</button>
                            <button class="toolbar-btn settings-io" id="set_profile_import">⬆ Import profile</button>
                            <button class="toolbar-btn settings-io" id="set_profile_cloud_save">☁ Save to cloud</button>
                            <button class="toolbar-btn settings-io" id="set_profile_cloud_load">☁ Load from cloud</button>
                        </div>
                        <div class="settings-hint">One JSON with your machine/stock/limits + user variables. The desktop app saves it to a local file automatically; <b>Save/Load to cloud</b> keeps named profiles in your own Google Drive (Settings → Cloud) — pull at the machine, load on a remote PC for a faithful sim.</div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">EDITOR</div>
                        <label class="settings-check"><input type="checkbox" id="set_suggest_on"> Smart suggestion bar (predictive keys above the keyboard)</label>
                        <div class="settings-hint">A phone-style row suggesting the likely next G-code / macro token. Turning it off hides the row and reclaims the space.</div>
                    </div>
                    <!-- legacy hardware-tab toggles kept hidden so profile gating still works (replaced by the Input/Output tables) -->
                    <div style="display:none">
                        <input type="checkbox" id="set_show_probes"><input type="checkbox" id="set_show_atc"><input type="checkbox" id="set_show_limits">
                    </div>
                </div>

                <!-- GENERAL: VARIABLES -->
                <div id="set_tab_variables" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">VARIABLES (CSV)</div>
                        <div class="settings-row">
                            <label class="toolbar-btn settings-io">📂 Import CSV<input type="file" id="set_csv_input" accept=".csv,text/csv" style="display:none"></label>
                            <button class="toolbar-btn settings-io" id="set_export">⬇ Export CSV</button>
                            <span class="settings-hint" id="set_var_count"></span>
                        </div>
                    </div>
                </div>

                <!-- GENERAL: FAQ -->
                <div id="set_tab_faq" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">FREQUENTLY ASKED</div>
                        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">What is DDCS Studio?</summary><div class="settings-hint" style="margin-top:6px;">A companion app for DDCS Expert / M350 controllers: wizards that generate G-code, a CAM-pack builder, a full toolpath simulator, and a gateway to send programs to the machine.</div></details>
                        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">Do I need the desktop app?</summary><div class="settings-hint" style="margin-top:6px;">To talk to a real controller, yes — the desktop app is the <b>gateway</b> (it reaches your machine's CNCDISK share on the LAN). The hosted web page can design + simulate offline, but can't reach a machine.</div></details>
                        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">How do I send a program to the controller?</summary><div class="settings-hint" style="margin-top:6px;">Open the <b>Gateway</b> tab, point it at your controller share (Settings → Gateway), then Send. System macros (T.nc, key-<i>N</i>.nc, slib-m.nc) are written to SYSDISK and backed up first.</div></details>
                        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">Which controllers are supported?</summary><div class="settings-hint" style="margin-top:6px;">DDCS <b>Expert / M350</b> is the primary, fully-mapped target. V4.1 and a few others have partial support — the post/dialect switches with the selected profile.</div></details>
                        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">How do I add a probe, ATC, or spindle?</summary><div class="settings-hint" style="margin-top:6px;">Settings → <b>Hardware</b> → use <b>+ Add</b> on the relevant tab. Adding an ATC also seeds the essential drawbar + sensor I/O.</div></details>
                        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">How do I simulate a program before running it?</summary><div class="settings-hint" style="margin-top:6px;">Press <b>▶</b> in the preview bar. The simulator runs the full G-code through the execution engine — resolving #vars, IF/GOTO loops and probes — so parametric/probe macros play correctly, not just straight moves.</div></details>
                        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">What does "Pull from controller" do?</summary><div class="settings-hint" style="margin-top:6px;">Reads your machine's live settings — WCS table, tool lengths, ATC magazine, travel/soft-limits — into a review modal so you can adopt them. Needs the gateway + a connected controller. It never writes the firmware-owned <code>camsetting</code>.</div></details>
                        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">What is a CAM pack?</summary><div class="settings-hint" style="margin-top:6px;">A DDCS Expert <b>CAM-menu pack</b> — parameterized macro slots for the controller's on-board CAM page. Build, simulate and export one (USB-ready .zip) in the <b>Macros</b> tab → CAM Pack Builder.</div></details>
                        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">Can I use Studio on my phone?</summary><div class="settings-hint" style="margin-top:6px;">Yes — the UI is responsive. Your desktop app serves Studio on your LAN; open the URL shown in Settings → Gateway from a phone/laptop on the same wifi.</div></details>
                        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">How do I update Studio?</summary><div class="settings-hint" style="margin-top:6px;">The desktop app shows an in-app banner when a new release is published, with a one-click update. The web version updates automatically on load.</div></details>
                        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">Cloud vs Gateway — what's the difference?</summary><div class="settings-hint" style="margin-top:6px;">The <b>Gateway</b> is the local desktop app that talks to <i>your machine</i> over the LAN (send programs, read settings, write macros). <b>Cloud</b> is optional <i>project storage</i> (e.g. Google Drive), separate from the machine — it syncs your profiles and programs across devices. You can use the Gateway with no Cloud, and Cloud with no machine connected.</div></details>
                        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">What is the virtual I/O panel?</summary><div class="settings-hint" style="margin-top:6px;">The <b>I/O</b> button in the preview bar opens a floating panel showing the controller's inputs/outputs. During a simulation it <b>auto-answers sensors</b> so probe / M-code wait loops terminate hands-free; you can also flip inputs manually to test your logic.</div></details>
                        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">Why does a probe in the sim run to the limit?</summary><div class="settings-hint" style="margin-top:6px;">A probe (G31) traces its full travel until it has <b>stock</b> to stop on. Set the Stock (the 📦 button) so the probe contacts the surface — then it stops at the real face instead of the soft-limit.</div></details>
                        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">Why do some ops need me to jog the start position first?</summary><div class="settings-hint" style="margin-top:6px;">Some ops — especially <b>incremental / relative probes</b> — run <i>from the tool's current position</i>, not an absolute coordinate. Set where it begins by jogging the machine there (or dragging the <b>①</b> start handle in the preview) before running; otherwise the op traces from zero and can probe the wrong spot.</div></details>
                        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">Found a bug or have an idea?</summary><div class="settings-hint" style="margin-top:6px;">Settings → <b>Feedback</b> → <b>🐛 Report a bug</b>. Tell us what you did and what you expected.</div></details>
                    </div>
                </div>

                <!-- GENERAL: FEEDBACK -->
                <div id="set_tab_feedback" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">FEEDBACK</div>
                        <div class="settings-row">
                            <button class="toolbar-btn settings-io" id="set_report">🐛 Report a bug</button>
                        </div>
                    </div>
                </div>

                <!-- GENERAL: NETWORK (cloud account + machine network) -->
                <div id="set_tab_gateway" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">CONTROLLER</div>
                        <div class="settings-hint">Point the gateway at your controller's CNCDISK share — or scan the LAN to find it. Needs the gateway (the desktop app); the hosted page can't reach a machine on your network.</div>
                        <div id="set_machinenet_mount" style="margin-top:8px"></div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">LAN ACCESS</div>
                        <div class="settings-hint">Open Studio from a phone/laptop on the same wifi — your exe serves it. Use this URL, not the hosted page.</div>
                        <div id="set_lan_mount" style="margin-top:8px"></div>
                    </div>
                </div>

                <!-- GENERAL: CLOUD (project storage — separate from the machine) -->
                <div id="set_tab_cloud" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">CLOUD STORAGE</div>
                        <div class="settings-hint">Sign in to save &amp; sync your projects to your own Google Drive — files go straight to your account, we never see them.</div>
                        <div id="set_cloud_mount" style="margin-top:8px"></div>
                    </div>
                </div>

                <!-- GENERAL: APPEARANCE -->
                <div id="set_tab_appearance" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">THEME</div>
                        <div class="settings-row">
                            <select id="set_theme" title="UI theme"></select>
                        </div>
                        <div class="settings-hint">Switches the whole UI skin. Saved on this device.</div>
                    </div>
                </div>

                <!-- GENERAL: PROGRAM (end-of-program routine) -->
                <div id="set_tab_program" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">END OF PROGRAM</div>
                        <div class="settings-hint">The safe footer appended to generated programs. On the DDCS, retract &amp; park use <b>G53</b> machine coordinates (G28 isn't configured).</div>
                        <label class="settings-check"><input type="checkbox" id="set_end_spindleoff"> Stop spindle (M5)</label>
                        <label class="settings-check"><input type="checkbox" id="set_end_coolantoff"> Coolant off (M9)</label>
                        <label class="settings-check"><input type="checkbox" id="set_end_retract"> Retract Z to safe height (G53)</label>
                        <div class="settings-grid">
                            <label>Safe Z (G53, mm)<input type="number" id="set_end_retractz" step="1"></label>
                        </div>
                        <label class="settings-check"><input type="checkbox" id="set_end_park"> Park XY for unload (G53)</label>
                        <div class="settings-grid">
                            <label>Park X (G53)<input type="number" id="set_end_parkx" step="1"></label>
                            <label>Park Y (G53)<input type="number" id="set_end_parky" step="1"></label>
                        </div>
                        <div class="settings-grid">
                            <label>Program end<select id="set_end_end"><option value="M30">M30 (end + rewind)</option><option value="M2">M2 (end)</option><option value="none">None</option></select></label>
                        </div>
                        <div class="settings-row" style="margin-top:8px;">
                            <button class="toolbar-btn settings-io" id="set_end_insert">⬇ Insert end-of-program</button>
                        </div>
                        <div class="settings-hint">Drops the footer into the editor at the cursor. Global default; per-wizard overrides are planned.</div>
                    </div>
                </div>

                <!-- (Macros + CAM Builder promoted to the MACROS main tab — see ui/macrosApp.js) -->

                <!-- GENERAL: ABOUT -->
                <div id="set_tab_about" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">DDCS STUDIO</div>
                        <div class="settings-hint">Version <b id="set_about_ver">—</b></div>
                        <div class="settings-hint">Modular G-code generator &amp; 3D simulator for the DDCS Expert / FOINNC M350 controller.</div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">CREDITS</div>
                        <div class="settings-hint">Built by Frédéric Chabot · MIT License</div>
                    </div>
                </div>

                <!-- MACHINE TAB -->
                <div id="set_tab_machine" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">MACHINE ENVELOPE (mm)</div>
                        <div class="settings-hint">Travel per axis. The <b>sign sets the home direction</b>: <code>X 300</code> homes at one end and travels +X; <code>X -300</code> homes at the other end and travels −X. (Home = machine 0.)</div>
                        <div class="settings-grid">
                            <label>Travel X<input type="number" id="set_mach_x" step="1"></label>
                            <label>Travel Y<input type="number" id="set_mach_y" step="1"></label>
                            <label>Travel Z<input type="number" id="set_mach_z" step="1"></label>
                        </div>
                        <label class="settings-check"><input type="checkbox" id="set_mach_show"> Show machine envelope in 3D</label>
                        <div class="settings-section-title sub">WORK COORDINATE SYSTEM (G54–G59)</div>
                        <div class="settings-hint">Where each part-zero sits in machine coordinates — <b>↧ Pull from controller</b> reads these (no typing). The active WCS positions your program in the envelope and makes <code>G53</code> moves draw correctly.</div>
                        <div id="set_mach_wcs_table"></div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">AXES</div>
                        <div class="settings-hint">X/Y/Z are linear. Set A/B to <b>rotary</b> for a 4th/5th rotary axis — the 3D sim then spins the part on those axes' moves. One machine config covers both 3-axis and rotary jobs (the program decides).</div>
                        <div class="settings-grid">
                            <label>A — role<select id="set_axis_a_role"><option value="unused">Unused</option><option value="linear">Linear</option><option value="rotary">Rotary</option></select></label>
                            <label>A — spins around<select id="set_axis_a_around"><option value="x">X</option><option value="y">Y</option><option value="z">Z</option></select></label>
                            <label>B — role<select id="set_axis_b_role"><option value="unused">Unused</option><option value="linear">Linear</option><option value="rotary">Rotary</option></select></label>
                            <label>B — spins around<select id="set_axis_b_around"><option value="x">X</option><option value="y">Y</option><option value="z">Z</option></select></label>
                        </div>
                    </div>
                </div>

                <!-- HARDWARE: SPINDLE -->
                <div id="set_tab_spindle" style="display:none">
                    <div class="settings-section" id="set_spin_add" style="display:none">
                        <div class="settings-section-title">HEAD</div>
                        <div class="settings-hint">Add the machine's toolhead — spindle / router today (plasma &amp; laser coming). Sets speed/direction and inserts M3/M4 + S into programs.</div>
                        <button class="toolbar-btn settings-io" id="set_spin_add_btn">➕ Add head</button>
                    </div>
                    <div id="set_spin_config" style="display:none">
                        <div class="settings-section">
                            <div class="settings-section-title">HEAD</div>
                            <div class="settings-grid">
                                <label>Type<select id="set_head_type"><option value="spindle">Router / Spindle</option><option value="plasma">Plasma</option><option value="laser">Laser</option></select></label>
                            </div>
                        </div>
                        <div id="set_head_spindle">
                            <div class="settings-section">
                                <div class="settings-section-title">SPINDLE / VFD</div>
                                <div class="settings-grid">
                                    <label>Max RPM<input type="number" id="set_spin_maxrpm" min="0" step="100"></label>
                                    <label>Default RPM<input type="number" id="set_spin_defrpm" min="0" step="100"></label>
                                    <label>Direction<select id="set_spin_dir"><option value="cw">M3 — clockwise</option><option value="ccw">M4 — counter-clockwise</option></select></label>
                                </div>
                                <div class="settings-grid">
                                    <label>Spin-up dwell (s)<input type="number" id="set_spin_up" min="0" step="0.1"></label>
                                    <label>Spin-down dwell (s)<input type="number" id="set_spin_down" min="0" step="0.1"></label>
                                </div>
                            </div>
                        </div>
                        <div id="set_head_plasma" style="display:none">
                            <div class="settings-section">
                                <div class="settings-section-title">PLASMA</div>
                                <div class="settings-hint">Coming soon — pierce height/delay, THC (torch-height control), arc-OK input.</div>
                            </div>
                        </div>
                        <div id="set_head_laser" style="display:none">
                            <div class="settings-section">
                                <div class="settings-section-title">LASER</div>
                                <div class="settings-hint">Coming soon — power %, PWM / M-code mapping.</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- LIMITS TAB -->
                <div id="set_tab_limits" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">LIMIT SWITCHES</div>
                        <div class="settings-section-title sub">X AXIS</div>
                        <div class="settings-grid">
                            <label>Min Pin<input type="number" id="set_x_min_pin" min="0" step="1"></label>
                            <label>Active Level<select id="set_x_min_level"><option value="0">0 (NC)</option><option value="1">1 (NO)</option></select></label>
                            <label>Max Pin<input type="number" id="set_x_max_pin" min="0" step="1"></label>
                            <label>Active Level<select id="set_x_max_level"><option value="0">0 (NC)</option><option value="1">1 (NO)</option></select></label>
                        </div>
                        <div class="settings-section-title sub">Y AXIS</div>
                        <div class="settings-grid">
                            <label>Min Pin<input type="number" id="set_y_min_pin" min="0" step="1"></label>
                            <label>Active Level<select id="set_y_min_level"><option value="0">0 (NC)</option><option value="1">1 (NO)</option></select></label>
                            <label>Max Pin<input type="number" id="set_y_max_pin" min="0" step="1"></label>
                            <label>Active Level<select id="set_y_max_level"><option value="0">0 (NC)</option><option value="1">1 (NO)</option></select></label>
                        </div>
                        <div class="settings-section-title sub">Z AXIS</div>
                        <div class="settings-grid">
                            <label>Min Pin<input type="number" id="set_z_min_pin" min="0" step="1"></label>
                            <label>Active Level<select id="set_z_min_level"><option value="0">0 (NC)</option><option value="1">1 (NO)</option></select></label>
                            <label>Max Pin<input type="number" id="set_z_max_pin" min="0" step="1"></label>
                            <label>Active Level<select id="set_z_max_level"><option value="0">0 (NC)</option><option value="1">1 (NO)</option></select></label>
                        </div>
                        <div class="settings-hint">Set the pin inputs used for hard limits. Leave empty if unused.</div>
                    </div>
                </div>

                <!-- PROBES TAB -->
                <div id="set_tab_probes" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title sub">3D PROBE (PINS)</div>
                        <div class="settings-grid">
                            <label>Input Pin<input type="number" id="set_probe_pin" min="0" step="1"></label>
                            <label>Active Level<select id="set_probe_level"><option value="0">0 (NC)</option><option value="1">1 (NO)</option></select></label>
                        </div>
                        <div class="settings-section-title sub">TOOL SETTER (PINS & LOCATION)</div>
                        <div class="settings-grid">
                            <label>Input Pin<input type="number" id="set_setter_pin" min="0" step="1"></label>
                            <label>Active Level<select id="set_setter_level"><option value="0">0 (NC)</option><option value="1">1 (NO)</option></select></label>
                        </div>
                        <div class="settings-grid">
                            <label>Loc X<input type="number" id="set_setter_x" step="0.1"></label>
                            <label>Loc Y<input type="number" id="set_setter_y" step="0.1"></label>
                            <label>Loc Z<input type="number" id="set_setter_z" step="0.1"></label>
                            <label>Width<input type="number" id="set_setter_w" step="0.1" min="1"></label>
                            <label>Height<input type="number" id="set_setter_h" step="0.1" min="1"></label>
                        </div>
                        <div class="settings-hint">Used by generators for G31 commands, and by engine to simulate physical collisions accurately.</div>
                    </div>
                </div>

                <!-- HARDWARE: INPUT -->
                <div id="set_tab_input" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">INPUTS</div>
                        <div class="settings-hint">Add the inputs your machine has — probes, limit switches, sensors. Pins 1–24, one use each. Wizards read probe pins from here.</div>
                        <div id="io_input_table"></div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">3D PROBE DEFAULTS</div>
                        <div class="settings-hint">What the touch-probe wizards (corner, edge, middle, circular, alignment, rotary) start from each time. <b>Stylus radius</b> drives radius compensation; pin &amp; level come from the 3D-probe input row above.</div>
                        <div class="settings-grid">
                            <label>Stylus radius (mm)<input type="number" id="set_pd_radius" min="0" step="0.1"></label>
                            <label>Fast feed<input type="number" id="set_pd_ffast" min="0" step="1"></label>
                            <label>Slow feed<input type="number" id="set_pd_fslow" min="0" step="1"></label>
                            <label>Retract (mm)<input type="number" id="set_pd_retract" min="0" step="0.1"></label>
                            <label>Safe Z (mm)<input type="number" id="set_pd_safez" step="1"></label>
                            <label>Max search (mm)<input type="number" id="set_pd_maxdist" min="0" step="1"></label>
                            <label>Q-stop<input type="number" id="set_pd_qstop" min="0" max="2" step="1"></label>
                        </div>
                    </div>
                </div>

                <!-- HARDWARE: OUTPUT -->
                <div id="set_tab_output" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">OUTPUTS</div>
                        <div class="settings-hint">Coolant, drawbar, dust cover, etc. Pins 1–20. The ATC tab adds its drawbar / dust-cover / carousel-rotate here.</div>
                        <div id="io_output_table"></div>
                    </div>
                </div>

                <!-- TOOL TABLE TAB (always present; "+ Add tool changer (ATC)" lives here) -->
                <div id="set_tab_atc" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">TOOL LIBRARY&nbsp;&nbsp;(length offset → #[base + tool − 1])</div>
                        <div class="settings-grid">
                            <label>Base variable<input type="number" id="set_atc_basevar" step="1"></label>
                        </div>
                        <div id="set_atc_libsummary" style="margin-top:8px;"></div>
                        <div class="settings-row" style="margin-top:8px;">
                            <button class="toolbar-btn settings-io" id="set_atc_library">🛠 Tool library…</button>
                            <button class="toolbar-btn settings-io" id="set_atc_insert">⬇ Insert tool table</button>
                        </div>
                        <div class="settings-hint">"Tool library" lists the tools you own (Ø, flutes, feeds/speeds) — the Mill wizards and the ATC magazine pick from it. "Insert tool table" drops the #var = length offsets (tools that have a length) into the editor to push them to the controller.</div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">TOOL LENGTH PROBE (defaults for the Tool Length wizard)</div>
                        <div class="settings-grid">
                            <label>Block height (mm)<input type="number" id="set_atc_blockheight" step="0.1"></label>
                            <label>Safe Z (mm)<input type="number" id="set_atc_safez" step="0.1"></label>
                            <label>Max search (mm)<input type="number" id="set_atc_maxdist" step="1"></label>
                            <label>Retract (mm)<input type="number" id="set_atc_retract" step="0.1"></label>
                            <label>Fast feed<input type="number" id="set_atc_ffast" step="1"></label>
                            <label>Slow feed<input type="number" id="set_atc_fslow" step="1"></label>
                            <label>Q-stop<input type="number" id="set_atc_qstop" step="1"></label>
                        </div>
                        <div class="settings-hint">Tool-setter pin &amp; location live in the Input tab. The Tool Length wizard probes against the setter and writes the result to the tool table above.</div>
                    </div>
                    <div class="settings-section" id="set_atc_add" style="display:none">
                        <div class="settings-section-title">TOOL CHANGER (ATC)</div>
                        <div class="settings-hint">Add an automatic tool changer to set up the magazine and generate the T.nc tool-change macro. This adds the drawbar (and, for a disk magazine, carousel-rotate / index) I/O to Output/Input.</div>
                        <button class="toolbar-btn settings-io" id="set_atc_add_btn">➕ Add tool changer (ATC)</button>
                    </div>
                    <div id="set_atc_magazine_wrap" style="display:none">
                        <div class="settings-section">
                            <div class="settings-section-title">TOOL MAGAZINE</div>
                            <div class="settings-hint">Straight = each pocket has a park XYZ; disk = one pickup + rotate-to-pocket (auto-adds rotate / index I/O). The drawbar lives in Output.</div>
                            <div id="atc_magazine"></div>
                            <div class="settings-row" style="margin-top:12px;">
                                <button class="toolbar-btn settings-io" id="atc_gen_tnc">⚙ Generate T.nc</button>
                                <button class="toolbar-btn settings-io" id="atc_dl_tnc" style="display:none">⬇ Download T.nc</button>
                                <span style="flex:1"></span>
                                <button class="toolbar-btn settings-io" id="set_atc_remove_btn" title="Remove the ATC subsystem and its drawbar + sensor I/O rows">🗑 Remove tool changer</button>
                            </div>
                            <div class="settings-hint">Builds the tool-change macro from the table above. Save it as <b>T.nc</b> on the controller — review &amp; dry-run first (generated template).</div>
                            <textarea id="atc_tnc_out" readonly spellcheck="false" style="display:none; width:100%; height:240px; margin-top:8px; font:12px/1.45 monospace; background:#1a1a1a; color:#d8d8d8; border:1px solid #888; border-radius:4px; padding:8px; box-sizing:border-box;"></textarea>
                        </div>
                    </div>
                </div>

                        </div><!-- end settings-content -->
                </div><!-- end settings-body -->
                <div class="settings-foot">
                    <button class="settings-done" type="button" onclick="window.closeSettings && window.closeSettings()">Done</button>
                </div>
            `;
    wireSettingsOverlay(parent);
}

// MACHINE NETWORK (Network tab): live controller connection through the gateway. Only meaningful when the
// app is served by the gateway/exe (same-origin /api) — the hosted Cloudflare page can't reach a local machine.
async function renderMachineNet(mount) {
    if (!mount) return;
    mount.textContent = 'Checking gateway…';
    let d = null;
    try { d = await (await fetch('/api/descriptor')).json(); } catch (e) { d = null; }
    if (!d) {
        mount.innerHTML = '<div class="settings-hint">Run the <b>desktop app</b> (the gateway) to connect a '
            + 'controller — the hosted page can\'t reach a machine on your LAN.</div>';
        return;
    }
    const connected = !!d.controller_connected;
    const fam = (d.controller_family && d.controller_family !== 'unknown') ? d.controller_family : '';
    const dest = d.dest || '';
    const wrap = document.createElement('div');
    wrap.innerHTML =
        '<div class="cloud-status' + (connected ? '' : ' muted') + '">'
        + (connected ? 'Connected' + (fam ? ' · ' + fam : '') + (dest ? ' · ' + dest : '')
                     : 'Not connected' + (dest ? ' · ' + dest : ' — no controller share set')) + '</div>'
        + '<label style="display:block;margin-top:8px">Controller share (SMB)'
        + '<input id="mn_dest" type="text" placeholder="\\\\10.0.0.50\\cncdisk" value="' + dest.replace(/"/g, '&quot;') + '"></label>'
        + '<div style="display:flex;gap:8px;margin-top:8px;align-items:center">'
        + '<button class="op-btn" data-mn="save">Save &amp; connect</button>'
        + '<button class="op-btn" data-mn="scan">🔍 Scan LAN</button>'
        + '<span class="mn-msg" style="flex:1"></span></div>'
        + '<div class="mn-results" style="margin-top:6px"></div>';
    mount.replaceChildren(wrap);
    const msg = wrap.querySelector('.mn-msg');
    const results = wrap.querySelector('.mn-results');

    async function save(val) {
        const v = (val != null ? val : wrap.querySelector('#mn_dest').value).trim();
        if (!v) { msg.textContent = 'Enter a share path.'; return; }
        msg.textContent = 'Saving…';
        try {
            const r = await (await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dest: v }) })).json();
            if (r && r.ok === false) { msg.textContent = r.error || 'Save failed.'; return; }
        } catch (e) { msg.textContent = 'Save failed (gateway unreachable).'; return; }
        renderMachineNet(mount);   // re-read status after applying
    }
    async function scan() {
        msg.textContent = 'Scanning the LAN…'; results.textContent = '';
        let list = [];
        try { list = ((await (await fetch('/api/scan')).json()).controllers) || []; } catch (e) { msg.textContent = 'Scan failed.'; return; }
        msg.textContent = list.length ? (list.length + ' found — pick one') : 'No controllers found on the LAN.';
        results.replaceChildren(...list.map((c) => {
            const b = document.createElement('button');
            b.className = 'op-btn';
            b.style.cssText = 'display:block;width:100%;text-align:left;margin-top:4px';
            b.textContent = (c.family || 'controller') + ' · ' + c.ip + '  (' + c.dest + ')';
            b.addEventListener('click', () => save(c.dest));
            return b;
        }));
    }
    wrap.addEventListener('click', (e) => {
        const t = e.target.closest('[data-mn]'); if (!t) return;
        if (t.dataset.mn === 'save') save(); else scan();
    });
}

// LAN ACCESS (Network tab): the URL + QR other devices on the wifi use to reach THIS exe-served Studio
// (the "personal cloud" — your exe serving the LAN, not Cloudflare). Needs the gateway; QR is generated
// server-side (/api/lan-qr, pure-python SVG, offline).
async function renderLanAccess(mount) {
    if (!mount) return;
    mount.textContent = 'Checking…';
    let c = null;
    try { c = await (await fetch('/api/config')).json(); } catch (e) { c = null; }
    if (!c) { mount.innerHTML = '<div class="settings-hint">Available in the desktop app (the gateway).</div>'; return; }
    const port = location.port || c.port || 8765;
    const lanOn = c.host === '0.0.0.0';
    const lanIp = c.lan_ip || '';
    const lanUrl = (lanOn && lanIp) ? ('http://' + lanIp + ':' + port + '/') : '';
    // No on/off toggle — the gateway serves the LAN by default (config host=0.0.0.0); we just surface the URLs + QR
    // so other devices can connect. (To restrict to this PC, set host to 127.0.0.1 in the gateway config.)
    const wrap = document.createElement('div');
    wrap.innerHTML =
        '<div class="cloud-status">This PC: <code>http://localhost:' + port + '</code></div>'
        + (lanUrl
            ? '<div class="cloud-status" style="margin-top:4px">On your wifi: <code>' + lanUrl + '</code></div>'
              + '<div class="settings-hint" style="margin-top:2px">Other devices on the same network can open this — scan the code or share the link.</div>'
              + '<img src="/api/lan-qr" alt="Scan to open on your phone" width="148" height="148" style="margin-top:8px;background:#fff;border-radius:6px;padding:6px" '
              + 'onerror="this.style.display=\'none\'">'
            : '<div class="settings-hint" style="margin-top:4px">Served on this PC only — set <code>host</code> to <code>0.0.0.0</code> in the gateway config to allow other devices.</div>');
    mount.replaceChildren(wrap);
}

function wireSettingsOverlay(ov) {
    const q = (id) => ov.querySelector('#' + id);
    const num = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };

    renderCloudLogin(q('set_cloud_mount'));   // cloud account login (Network tab) — shared with the Project Manager drawer
    renderMachineNet(q('set_machinenet_mount'));   // MACHINE NETWORK: live controller connection via the gateway
    renderLanAccess(q('set_lan_mount'));   // LAN ACCESS: shareable URL + QR for the exe-served Studio

    function updateVarCount() {
        const db = window.ddcsStudio && window.ddcsStudio.variableDB;
        const el = q('set_var_count');
        if (el && db) el.textContent = `${db.getAll().length} variables loaded`;
    }

    function fill() {
        const s = _ddcsSettings;
        if (!s.hardwareTabs) s.hardwareTabs = { probes: true, atc: false, limits: true };
        q('set_show_probes').checked = s.hardwareTabs.probes !== false;
        q('set_show_atc').checked = s.hardwareTabs.atc === true;
        q('set_show_limits').checked = s.hardwareTabs.limits !== false;
        const pv = s.preview || (s.preview = { ...SETTINGS_DEFAULTS.preview });
        if (q('set_pv_view')) q('set_pv_view').value = pv.defaultView || '3d';
        if (q('set_pv_speed')) q('set_pv_speed').value = String(pv.defaultSpeed || 1);
        if (q('set_pv_rapids')) q('set_pv_rapids').checked = pv.showRapids !== false;
        if (q('set_pv_gridstep')) q('set_pv_gridstep').value = String(pv.gridStep || 0);
        if (q('set_pv_follow_default')) q('set_pv_follow_default').checked = pv.followDefault !== false;
        if (q('set_pv_autoloop')) q('set_pv_autoloop').checked = pv.autoLoop !== false;
        const cp = s.compose || (s.compose = { ...SETTINGS_DEFAULTS.compose });
        if (q('set_cp_suggestions')) q('set_cp_suggestions').checked = cp.suggestions !== false;
        if (q('set_cp_autocomplete')) q('set_cp_autocomplete').checked = cp.autocomplete !== false;
        if (q('set_cp_ghost')) q('set_cp_ghost').checked = cp.ghost !== false;
        if (q('set_pv_followdamp')) {
            const d = Number.isFinite(pv.followDamp) ? pv.followDamp : 50;
            q('set_pv_followdamp').value = String(d);
            const lbl = q('set_pv_followdamp_val'); if (lbl) lbl.textContent = d + '%';
        }
        const ad = SETTINGS_DEFAULTS.atc, a = s.atc || (s.atc = {});
        q('set_atc_blockheight').value = a.blockHeight ?? ad.blockHeight;
        q('set_atc_safez').value = a.safeZ ?? ad.safeZ;
        q('set_atc_maxdist').value = a.maxDist ?? ad.maxDist;
        q('set_atc_retract').value = a.retract ?? ad.retract;
        q('set_atc_ffast').value = a.fFast ?? ad.fFast;
        q('set_atc_fslow').value = a.fSlow ?? ad.fSlow;
        q('set_atc_qstop').value = a.qStop ?? ad.qStop;
        q('set_atc_basevar').value = a.baseVar ?? ad.baseVar;
                renderLibSummary();
        q('set_mach_x').value = s.machine.x;
        q('set_mach_y').value = s.machine.y;
        q('set_mach_z').value = s.machine.z;
        renderWcsTable(q('set_mach_wcs_table'), s.machine);
        q('set_mach_show').checked = !!s.machine.show;
        if (q('set_axis_a_role')) {
            const mo = s.motors || {};
            q('set_axis_a_role').value = (mo.a && mo.a.role) || 'unused';
            q('set_axis_a_around').value = (mo.a && mo.a.around) || 'x';
            q('set_axis_b_role').value = (mo.b && mo.b.role) || 'unused';
            q('set_axis_b_around').value = (mo.b && mo.b.around) || 'y';
        }

        q('set_probe_pin').value = s.probes.probePin;
        q('set_probe_level').value = s.probes.probeLevel;
        q('set_setter_pin').value = s.probes.setterPin;
        q('set_setter_level').value = s.probes.setterLevel;
        q('set_setter_x').value = s.probes.setterX;
        q('set_setter_y').value = s.probes.setterY;
        q('set_setter_z').value = s.probes.setterZ;
        q('set_setter_w').value = s.probes.setterW;
        q('set_setter_h').value = s.probes.setterH;

        const prd = SETTINGS_DEFAULTS.probes;
        if (q('set_pd_radius')) {
            q('set_pd_radius').value = s.probes.radius ?? prd.radius;
            q('set_pd_ffast').value = s.probes.fastFeed ?? prd.fastFeed;
            q('set_pd_fslow').value = s.probes.slowFeed ?? prd.slowFeed;
            q('set_pd_retract').value = s.probes.retract ?? prd.retract;
            q('set_pd_safez').value = s.probes.safeZ ?? prd.safeZ;
            q('set_pd_maxdist').value = s.probes.maxDist ?? prd.maxDist;
            q('set_pd_qstop').value = s.probes.qStop ?? prd.qStop;
        }

        q('set_x_min_pin').value = s.limits.xMinPin;
        q('set_x_min_level').value = s.limits.xMinLevel;
        q('set_x_max_pin').value = s.limits.xMaxPin;
        q('set_x_max_level').value = s.limits.xMaxLevel;
        q('set_y_min_pin').value = s.limits.yMinPin;
        q('set_y_min_level').value = s.limits.yMinLevel;
        q('set_y_max_pin').value = s.limits.yMaxPin;
        q('set_y_max_level').value = s.limits.yMaxLevel;
        q('set_z_min_pin').value = s.limits.zMinPin;
        q('set_z_min_level').value = s.limits.zMinLevel;
        q('set_z_max_pin').value = s.limits.zMaxPin;
        q('set_z_max_level').value = s.limits.zMaxLevel;

        const sp = s.spindle || (s.spindle = {}), spd = SETTINGS_DEFAULTS.spindle;
        if (q('set_spin_maxrpm')) {
            q('set_spin_maxrpm').value = sp.maxRpm ?? spd.maxRpm;
            q('set_spin_defrpm').value = sp.defaultRpm ?? spd.defaultRpm;
            q('set_spin_dir').value = sp.dir || spd.dir;
            q('set_spin_up').value = sp.spinUp ?? spd.spinUp;
            q('set_spin_down').value = sp.spinDown ?? spd.spinDown;
        }
        if (q('set_head_type')) { q('set_head_type').value = (s.head && s.head.type) || 'spindle'; applyHeadType(); }
        const ep = s.endProgram || (s.endProgram = {}), epd = SETTINGS_DEFAULTS.endProgram;
        if (q('set_end_end')) {
            q('set_end_spindleoff').checked = ep.spindleOff !== false;
            q('set_end_coolantoff').checked = ep.coolantOff !== false;
            q('set_end_retract').checked = ep.retract !== false;
            q('set_end_retractz').value = ep.retractZ ?? epd.retractZ;
            q('set_end_park').checked = ep.park === true;
            q('set_end_parkx').value = ep.parkX ?? epd.parkX;
            q('set_end_parky').value = ep.parkY ?? epd.parkY;
            q('set_end_end').value = ep.end || epd.end;
        }

        updateVarCount();
    }
    fill();
    _fillSettingsInputs = fill;

    // --- Subsystem gating: the Spindle + Tool-table tabs are always present; this toggles each tab's
    //     in-tab "Add" button vs its config section based on whether the subsystem has been added. ---
    function applyHardwareTabs() {
        const ht = _ddcsSettings.hardwareTabs || {};
        const show = (id, on) => { const e = ov.querySelector('#' + id); if (e) e.style.display = on ? '' : 'none'; };
        show('set_spin_config', ht.spindle === true);
        show('set_spin_add', ht.spindle !== true);
        show('set_atc_magazine_wrap', ht.atc === true);
        show('set_atc_add', ht.atc !== true);
    }
    // Head type (spindle/plasma/laser) → show the matching config; plasma/laser are stubs for now.
    function applyHeadType() {
        const t = (_ddcsSettings.head && _ddcsSettings.head.type) || 'spindle';
        const show = (id, on) => { const e = ov.querySelector('#' + id); if (e) e.style.display = on ? '' : 'none'; };
        show('set_head_spindle', t === 'spindle');
        show('set_head_plasma', t === 'plasma');
        show('set_head_laser', t === 'laser');
    }
    // Post processor picker — which controller's G-code the Blocks view emits (live).
    const postSel = q('set_post');
    function fillPostOptions() {
        if (!postSel) return;
        const machinePost = getDialect(getActiveProfile().id);
        postSel.innerHTML = ['<option value="auto">Follow controller (' + machinePost.name + ')</option>']
            .concat(listPosts().map((p) => '<option value="' + p.id + '">' + p.name + (p.verified ? '  ✓' : '  ⚠ unverified') + '</option>'))
            .join('');
        postSel.value = getActivePostId();
        updatePostHint();
    }
    function updatePostHint() {
        const hint = q('set_post_hint'); if (!hint) return;
        const id = getActivePostId();
        if (id === 'auto') { hint.textContent = 'Following the controller (' + getDialect(getActiveProfile().id).name + '). Override to generate for another controller.'; hint.style.color = ''; }
        else if (!isPostVerified(id)) { hint.textContent = '⚠ Unverified post — dump-derived, simulator/reference only. Not validated on hardware.'; hint.style.color = '#e0a020'; }
        else { hint.textContent = 'Generating for ' + getDialect(id).name + ' (verified).'; hint.style.color = ''; }
    }
    if (postSel) {
        fillPostOptions();
        postSel.addEventListener('change', () => {
            setActivePostId(postSel.value);
            updatePostHint();
            if (window.ddcsRefreshBlocks) window.ddcsRefreshBlocks();   // live re-emit the Blocks view
        });
    }

    const profileSel = q('set_profile');
    function fillProfileOptions() {
        if (!profileSel) return;
        profileSel.innerHTML = Object.values(CONTROLLER_PROFILES)
            .map((p) => '<option value="' + p.id + '">' + p.name + (p.source === 'controller' ? ' (from controller)' : '') + '</option>')
            .join('');
        profileSel.value = getActiveProfile().id;
    }
    if (profileSel) {
        fillProfileOptions();
        profileSel.addEventListener('change', () => {
            const p = setActiveProfile(profileSel.value);   // a profile just PRESETS the toggles
            // Switch the variable list to match the controller (Expert / V4.1 / V3-DM500).
            const vdb = window.ddcsStudio && window.ddcsStudio.variableDB;
            if (p && p.varFamily && vdb) vdb.setControllerVars(p.varFamily);
            _ddcsSettings.hardwareTabs = {
                probes: p.hardwareTabs.includes('probes'),
                atc: p.hardwareTabs.includes('atc'),
                limits: p.hardwareTabs.includes('limits'),
            };
            saveSettings();
            fill();
            applyHardwareTabs();
            fillPostOptions();   // refresh the "Follow machine profile (…)" label for the new machine
        });
        // When a gateway answers (same-origin in the gateway-served/exe face, or via the ?api= dev
        // override), fetch the controller's own profile and offer it in the list (shown as
        // "… (from controller)"). Silently ignored if offline / not bridged (hosted Studio).
        makeClient().profile().then((p) => {
            if (p && p.id && Array.isArray(p.hardwareTabs)) { registerProfile(p); fillProfileOptions(); }
        }).catch(() => { /* no gateway — leave builtins */ });

        // "Pull from controller" → the review modal: it reads ALL machine data, tags each value "changed" vs
        // factory "default", and you tick what to apply. Everything here is PROFILE data — equally settable by
        // hand and saved/loaded via Export/Import profile (the desktop app auto-saves it on every change).
        const pullBtn = q('set_profile_pull');
        if (pullBtn) pullBtn.addEventListener('click', () => openImportModal());
    }

    // Apply a controller-sourced profile (from the gateway): set hardware tabs + rebuild inputs[] from its pin map.
    function applyControllerProfile(p) {
        if (!p) return;
        if (Array.isArray(p.hardwareTabs)) {
            _ddcsSettings.hardwareTabs = {
                probes: p.hardwareTabs.includes('probes'),
                atc: p.hardwareTabs.includes('atc'),
                limits: p.hardwareTabs.includes('limits'),
            };
        }
        const pn = p.pins;
        if (pn) {
            const ins = [];
            if (pn.probe !== '' && pn.probe != null) ins.push({ id: 'probe', type: 'probe', label: '3D Probe', pin: pn.probe, level: pn.probeLevel || 0 });
            if (pn.setter !== '' && pn.setter != null) ins.push({ id: 'setter', type: 'setter', label: 'Tool Setter', pin: pn.setter, level: pn.setterLevel || 0, x: 10, y: 10, z: -50, w: 20, h: 20 });
            const lim = pn.limits || {};
            const LMAP = [['xMin', 'x_min', 'Limit X−'], ['xMax', 'x_max', 'Limit X+'], ['yMin', 'y_min', 'Limit Y−'], ['yMax', 'y_max', 'Limit Y+'], ['zMin', 'z_min', 'Limit Z−'], ['zMax', 'z_max', 'Limit Z+']];
            for (const [k, axis, label] of LMAP) {
                if (lim[k] !== '' && lim[k] != null) ins.push({ id: 'limit_' + axis, type: 'limit', axis, label, pin: lim[k], level: lim[k + 'Level'] || 0 });
            }
            _ddcsSettings.inputs = ins;
            syncFlatFromIO(_ddcsSettings);
        }
        // Machine-frame geometry from the dump: travel (envelope) + the active WCS work origin (→ the sim's
        // G53 offset, machine coords of part-zero). Per-axis travel may be null (soft-limit disabled) → keep default.
        const m = _ddcsSettings.machine || (_ddcsSettings.machine = {});
        if (p.geometry && p.geometry.travel) {
            const t = p.geometry.travel;
            if (t.x != null && t.x > 0) m.x = t.x;
            if (t.y != null && t.y > 0) m.y = t.y;
            if (t.z != null && t.z > 0) m.z = t.z;
        }
        if (p.wcs && p.wcs.workOrigin) {
            const wo = p.wcs.workOrigin;
            m.workOrigin = { x: +wo.x || 0, y: +wo.y || 0, z: +wo.z || 0 };
        }
        saveSettings();
        fill();
        applyHardwareTabs();
    }
    applyHardwareTabs();

    // Profile load (profileStore.applyProfile) calls this after switching the controller, to re-sync the
    // CONTROLLER dropdown + post selector + hardware tabs to the loaded profile's controller.
    window.ddcsRefreshControllerUI = () => { try { fillProfileOptions(); fillPostOptions(); applyHardwareTabs(); fill(); } catch (e) { /* */ } };

    // --- Centralized "Pull from controller": read ALL machine data, then review each value (changed-vs-default)
    //     and tick what to apply. Everything pulled is PROFILE data — also settable by hand, saved via Export. ---
    function activeDialect() {
        const pid = getActivePostId();
        return getDialect(pid && pid !== 'auto' ? pid : getActiveProfile().id);
    }
    function upsertToolLength(a, num, len) {
        a.tools = a.tools || [];
        let rec = a.tools.find((t) => parseInt(t && t.num, 10) === num);
        if (!rec) { rec = normalizeTool({}, num); rec.num = num; a.tools.push(rec); }
        rec.length = len;
    }
    async function applyHardwareProfile(p) {   // tabs + pin map → inputs[]/outputs[]; also switches the active dialect
        if (!p || !p.id) throw new Error('no profile');
        registerProfile(p); setActiveProfile(p.id);
        applyControllerProfile(p);
        const vdb = window.ddcsStudio && window.ddcsStudio.variableDB;     // switch the #var list to the controller
        const ap = getActiveProfile(); if (ap && ap.varFamily && vdb) vdb.setControllerVars(ap.varFamily);
        fillProfileOptions();
        fillPostOptions();   // refresh "Follow machine profile (…)" so the post/dialect matches the pulled controller
        const it = ov.querySelector('#io_input_table'); if (it) renderIoTable(it, 'input', getInputs(), syncIO);
        const ot = ov.querySelector('#io_output_table'); if (ot) renderIoTable(ot, 'output', getOutputs(), syncIO);
    }
    // Read everything off the controller → review candidates. Each carries `changed` = differs from the factory
    // default (setting vs default_setting; non-zero for the ATC/uservar tables that have no default file).
    async function scanController() {
        // Read using the CONNECTED controller's dialect (from its profile), not the current active one — otherwise
        // the #var numbers (pockets/tooltable/WCS) won't match the machine we're actually pulling from.
        let hwProfile = null;
        try { hwProfile = await makeClient().profile(); } catch (e) { /* offline */ }
        const d = (hwProfile && hwProfile.id) ? getDialect(hwProfile.id) : activeDialect();
        const atc = d.vars && d.vars.atc;
        const tb = (d.vars && d.vars.toolTable) || 1430;
        const wcsBase = (d.vars && d.vars.wcsBase) || 805, wcsStride = (d.vars && d.vars.wcsStride) || 5, activeWcsVar = (d.vars && d.vars.activeWcs) || 578;
        const MAX = 24;                                   // pockets/tools scanned (most magazines ≤ 24)
        const need = new Set([activeWcsVar]);
        for (let k = 0; k < 6 * wcsStride; k++) need.add(wcsBase + k);
        for (let i = 0; i < MAX; i++) { need.add(tb + i); if (atc) { need.add(atc.pocketX + i); need.add(atc.pocketY + i); need.add(atc.pocketZ + i); } }
        let values = {}, connected = false;
        try { const res = await makeClient().readVars([...need].map(String)); connected = !!(res && res.connected); values = (res && res.values) || {}; } catch (e) { /* offline */ }
        const obj = (n) => { const x = values[String(n)]; return x && x.available ? x : null; };   // {value,userSet,default?}
        const cands = [], notes = [];   // notes = explicit "not readable / not available / at default" rows
        // Hardware & I/O
        if (hwProfile && hwProfile.id) { connected = true; cands.push({ group: 'Hardware & I/O', label: `Profile “${hwProfile.name}”`, value: 'tabs + pin map', changed: true, kind: 'hardware', data: hwProfile }); }
        else notes.push({ group: 'Hardware & I/O', label: 'Not available', value: 'no gateway profile', kind: 'note' });
        // ATC magazine (pocket XYZ tables)
        let magReadable = false, magCount = 0;
        if (atc) for (let i = 0; i < MAX; i++) {
            const x = obj(atc.pocketX + i), y = obj(atc.pocketY + i), z = obj(atc.pocketZ + i);
            if (x || y || z) magReadable = true;
            const xx = x ? x.value : 0, yy = y ? y.value : 0, zz = z ? z.value : 0;
            if (!xx && !yy && !zz) continue;
            magCount++;
            cands.push({ group: 'ATC magazine', label: `Pocket ${i + 1} (T${i + 1})`, value: `X${xx} Y${yy} Z${zz}`, changed: [x, y, z].some((o) => o && o.userSet), kind: 'magazine', data: { pocket: i + 1, tool: i + 1, name: '', x: xx, y: yy, z: zz } });
        }
        if (!atc) notes.push({ group: 'ATC magazine', label: 'Not available on this controller', value: 'no mapped ATC model', kind: 'note' });
        else if (!magReadable) notes.push({ group: 'ATC magazine', label: 'Not readable', value: 'controller returned nothing', kind: 'note' });
        else if (!magCount) notes.push({ group: 'ATC magazine', label: 'No taught pockets', value: 'all at default (0)', kind: 'note' });
        // Tool lengths
        let lenReadable = false, lenCount = 0;
        for (let i = 0; i < MAX; i++) {
            const L = obj(tb + i); if (L) lenReadable = true;
            if (!L || L.value === 0) continue;
            lenCount++;
            cands.push({ group: 'Tool lengths', label: `T${i + 1} length`, value: String(L.value), changed: !!L.userSet, kind: 'length', data: { num: i + 1, length: L.value } });
        }
        if (!lenReadable) notes.push({ group: 'Tool lengths', label: 'Not readable on this controller', value: '—', kind: 'note' });
        else if (!lenCount) notes.push({ group: 'Tool lengths', label: 'None set', value: 'all at default (0)', kind: 'note' });
        // WCS table — read all 6 systems (G54–G59) + the active index. Builds the full table for Settings → Machine.
        const idxO = obj(activeWcsVar); const active = (idxO && idxO.value >= 1 && idxO.value <= 6) ? Math.round(idxO.value) : 1;
        const table = []; let anyWcs = false;
        for (let g = 0; g < 6; g++) {
            const b = wcsBase + g * wcsStride; const gx = obj(b), gy = obj(b + 1), gz = obj(b + 2);
            if (gx || gy || gz) anyWcs = true;
            table.push({ x: gx ? gx.value : 0, y: gy ? gy.value : 0, z: gz ? gz.value : 0 });
        }
        if (anyWcs) {
            const ar = table[active - 1] || { x: 0, y: 0, z: 0 };
            cands.push({ group: 'WCS table (G54–G59)', label: `${WCS_NAMES[active - 1]} active`, value: `X${ar.x} Y${ar.y} Z${ar.z}`, changed: false, kind: 'wcs', data: { table, active } });
        } else notes.push({ group: 'WCS table (G54–G59)', label: 'Not readable / all zero', value: '—', kind: 'note' });
        // Machine envelope / travel — from the controller's soft-limit params (gateway /api/profile geometry).
        const tv = hwProfile && hwProfile.geometry && hwProfile.geometry.travel;
        const mc = _ddcsSettings.machine || {};
        if (tv && [tv.x, tv.y, tv.z].some((v) => v != null && v > 0)) {
            const tx = (tv.x > 0 ? tv.x : mc.x), ty = (tv.y > 0 ? tv.y : mc.y), tz = (tv.z > 0 ? tv.z : mc.z);
            const changed = (tv.x > 0 && tv.x !== mc.x) || (tv.y > 0 && tv.y !== mc.y) || (tv.z > 0 && tv.z !== mc.z);
            // homeDir (±1 per axis) = the homing direction → the travel SIGN. From geometry.homeDir when the gateway
            // exposes the controller's homing-direction param, else inferred from a signed travel value.
            const hd = (hwProfile.geometry && hwProfile.geometry.homeDir) || null;
            cands.push({ group: 'Machine envelope', label: 'Travel X/Y/Z', value: `${tx} × ${ty} × ${tz} mm`, changed, kind: 'travel', data: { x: tv.x, y: tv.y, z: tv.z, homeDir: hd } });
        } else if (hwProfile && hwProfile.id) {
            notes.push({ group: 'Machine envelope', label: 'Not set', value: 'soft limits off — keeping current', kind: 'note' });
        }
        return { connected, candidates: cands.concat(notes), controller: (hwProfile && hwProfile.id) ? { id: hwProfile.id, name: hwProfile.name } : null };
    }
    async function applyCandidates(checked) {
        const a = _ddcsSettings.atc || (_ddcsSettings.atc = {});
        const mag = checked.filter((c) => c.kind === 'magazine').map((c) => c.data).sort((x, y) => x.pocket - y.pocket);
        if (mag.length) {
            a.magazine = mag;
            // The magazine's tool # selects from the Tool library — make sure each pulled tool exists there,
            // else the dropdown can't show it and the number is lost. Create a minimal stub if missing.
            a.tools = a.tools || [];
            mag.forEach((p) => { const tn = Number(p.tool); if (tn > 0 && !a.tools.some((t) => parseInt(t && t.num, 10) === tn)) a.tools.push(normalizeTool({}, tn)); });
        }
        checked.filter((c) => c.kind === 'length').forEach((c) => upsertToolLength(a, c.data.num, c.data.length));
        const wcs = checked.find((c) => c.kind === 'wcs');
        if (wcs) { const m = (_ddcsSettings.machine || (_ddcsSettings.machine = {})); m.wcs = { active: wcs.data.active, table: wcs.data.table }; syncWorkOrigin(m); }
        const tvc = checked.find((c) => c.kind === 'travel');
        if (tvc) {
            const mm = _ddcsSettings.machine || (_ddcsSettings.machine = {});
            const hd = tvc.data.homeDir || {};
            // Travel SIGN = homing direction: use the pulled homeDir if present, else the pulled value's own sign,
            // else keep the user's current sign. Magnitude is the controller's soft-limit span.
            const set = (cur, v, dir) => { const mag = Math.abs(v || 0); if (!mag) return cur; const s = dir || (v < 0 ? -1 : (cur < 0 ? -1 : 1)); return s * mag; };
            mm.x = set(mm.x, tvc.data.x, hd.x); mm.y = set(mm.y, tvc.data.y, hd.y); mm.z = set(mm.z, tvc.data.z, hd.z);
        }
        for (const c of checked.filter((c) => c.kind === 'hardware')) { try { await applyHardwareProfile(c.data); } catch (e) { /* ignore */ } }
        saveSettings(); fill();
        const mt = ov.querySelector('#atc_magazine'); if (mt) renderMagazineTable(mt, _ddcsSettings.atc, atcOnChange);
        renderLibSummary();
    }
    let _importCands = [];
    let _importController = null;   // the connected controller {id,name} for the "will switch profile" banner
    function buildImportModal() {
        if (document.getElementById('import-modal')) return;
        const m = document.createElement('div');
        m.id = 'import-modal';
        m.innerHTML = `
            <style>
                #import-modal { position: fixed; inset: 0; z-index: 1000; display: none; align-items: center; justify-content: center; background: rgba(0,0,0,.5); }
                #import-modal.active { display: flex; }
                #import-modal .im-panel { background: var(--panel); color: var(--text-main); border: 1px solid var(--border); border-radius: var(--radius, 6px); width: min(620px, 95vw); max-height: 88vh; display: flex; flex-direction: column; box-shadow: 0 12px 40px rgba(0,0,0,.5); }
                #import-modal .im-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--border); font-weight: 700; letter-spacing: .5px; }
                #import-modal .im-head button { background: transparent; border: none; color: var(--text-dim); font-size: 18px; cursor: pointer; }
                #import-modal .im-body { overflow: auto; padding: 4px 14px 10px; min-height: 80px; }
                #import-modal .im-empty { padding: 24px 8px; text-align: center; color: var(--text-dim); }
                #import-modal .im-banner { margin: 8px 2px 2px; padding: 8px 10px; border-radius: 4px; font-size: 12px; background: rgba(224,160,32,.16); border: 1px solid rgba(224,160,32,.5); color: var(--text-main); }
                #import-modal .im-group { font-size: 10.5px; text-transform: uppercase; letter-spacing: .5px; color: var(--text-dim); padding: 12px 4px 4px; font-weight: 700; }
                #import-modal .im-row { display: grid; grid-template-columns: 22px 1fr auto auto; align-items: center; gap: 8px; padding: 5px 4px; border-bottom: 1px solid var(--border); cursor: pointer; }
                #import-modal .im-lbl { font-weight: 600; }
                #import-modal .im-val { font-family: monospace; font-size: 11.5px; color: var(--text-dim); }
                #import-modal .im-tag { font-size: 9.5px; text-transform: uppercase; letter-spacing: .5px; padding: 2px 6px; border-radius: 3px; white-space: nowrap; }
                #import-modal .im-tag.chg { background: rgba(60,180,90,.22); color: #3cb24f; }
                #import-modal .im-tag.def { background: rgba(128,128,128,.18); color: var(--text-dim); }
                #import-modal .im-tag.na { background: transparent; color: var(--text-dim); font-style: italic; }
                #import-modal .im-note-row { cursor: default; opacity: .85; }
                #import-modal .im-foot { padding: 10px 16px; border-top: 1px solid var(--border); display: flex; align-items: center; gap: 10px; }
                #import-modal .im-only { font-size: 11.5px; color: var(--text-dim); display: flex; align-items: center; gap: 5px; cursor: pointer; }
            </style>
            <div class="im-panel">
                <div class="im-head"><span>↧ Pull from controller</span><button id="import-close" title="Close">✕</button></div>
                <div class="im-body" id="import-body"></div>
                <div class="im-foot">
                    <label class="im-only"><input type="checkbox" id="import-only" checked> Show only changed</label>
                    <span style="flex:1"></span>
                    <button class="toolbar-btn settings-io" id="import-cancel">Cancel</button>
                    <button class="toolbar-btn settings-io" id="import-apply" disabled>Apply</button>
                </div>
            </div>`;
        document.body.appendChild(m);
        const close = () => m.classList.remove('active');
        m.querySelector('#import-close').addEventListener('click', close);
        m.querySelector('#import-cancel').addEventListener('click', close);
        m.addEventListener('mousedown', (e) => { if (e.target === m) close(); });
    }
    function renderImportReview() {
        const m = document.getElementById('import-modal');
        const body = m.querySelector('#import-body');
        const applyBtn = m.querySelector('#import-apply');
        const onlyChanged = m.querySelector('#import-only').checked;
        const isNote = (c) => c.kind === 'note';
        if (!_importCands.length) { body.innerHTML = '<div class="im-empty">Nothing readable on the controller.</div>'; applyBtn.disabled = true; return; }
        const shown = _importCands.filter((c) => isNote(c) || !onlyChanged || c.changed);   // status notes always shown
        const hiddenDefaults = _importCands.filter((c) => !isNote(c) && !c.changed).length;
        const groups = {};
        shown.forEach((c) => { (groups[c.group] = groups[c.group] || []).push(c); });
        let html = '';
        if (_importController && _importController.id && _importController.id !== getActiveProfile().id) {   // pulling will change the dialect
            html += `<div class="im-banner">Connected controller: <b>${_importController.name}</b> — applying <b>Hardware &amp; I/O</b> switches your machine profile + post from <b>${getActiveProfile().name}</b> to it.</div>`;
        }
        Object.keys(groups).forEach((g) => {
            html += `<div class="im-group">${g}</div>`;
            groups[g].forEach((c) => {
                if (isNote(c)) {   // explicit "not readable / not available / at default" — informational, not tickable
                    html += `<div class="im-row im-note-row"><span></span><span class="im-lbl">${c.label}</span><span class="im-val">${c.value}</span><span class="im-tag na">n/a</span></div>`;
                    return;
                }
                const i = _importCands.indexOf(c);
                html += `<label class="im-row"><input type="checkbox" data-cand="${i}"${c.checked ? ' checked' : ''}>`
                    + `<span class="im-lbl">${c.label}</span><span class="im-val">${c.value}</span>`
                    + `<span class="im-tag ${c.changed ? 'chg' : 'def'}">${c.changed ? 'changed' : 'default'}</span></label>`;
            });
        });
        if (onlyChanged && hiddenDefaults) html += `<div class="im-empty">+${hiddenDefaults} value${hiddenDefaults > 1 ? 's' : ''} at factory default — untick “Show only changed” to add them.</div>`;
        body.innerHTML = html;
        body.querySelectorAll('[data-cand]').forEach((cb) => cb.addEventListener('change', () => { _importCands[+cb.dataset.cand].checked = cb.checked; updateApply(); }));
        updateApply();
    }
    function updateApply() {
        const applyBtn = document.querySelector('#import-apply');
        const n = _importCands.filter((c) => c.checked).length;
        applyBtn.disabled = !n; applyBtn.textContent = n ? `Apply ${n}` : 'Apply';
    }
    async function openImportModal() {
        buildImportModal();
        const m = document.getElementById('import-modal');
        const body = m.querySelector('#import-body');
        _importCands = [];
        body.innerHTML = '<div class="im-empty">Reading the controller…</div>';
        m.querySelector('#import-apply').disabled = true;
        m.classList.add('active');
        let scan;
        try { scan = await scanController(); } catch (e) { scan = { connected: false, candidates: [] }; }
        if (!scan.connected) { body.innerHTML = '<div class="im-empty">Not bridged to a controller — run the desktop app / gateway, or Import a saved profile instead.</div>'; return; }
        _importController = scan.controller || null;
        _importCands = scan.candidates.map((c) => ({ ...c, checked: !!c.changed }));   // pre-tick what the operator changed
        renderImportReview();
        m.querySelector('#import-only').onchange = renderImportReview;
        m.querySelector('#import-apply').onclick = async () => {
            const checked = _importCands.filter((c) => c.checked);
            const btn = m.querySelector('#import-apply'); btn.disabled = true; btn.textContent = 'Applying…';
            try { await applyCandidates(checked); m.classList.remove('active'); }
            catch (e) { body.innerHTML = '<div class="im-empty">Apply failed: ' + (e && e.message ? e.message : e) + '</div>'; }
        };
    }

    // --- Tool library: a sparse list of the tools you own. Length offset → #[base + num − 1].
    //     The tab shows a summary; the modal is the editor; the Mill wizards + magazine pick from it. ---
    function renderLibSummary() {
        const cont = q('set_atc_libsummary');
        if (!cont) return;
        const tools = libraryTools(_ddcsSettings.atc || {});
        if (!tools.length) { cont.innerHTML = '<span class="settings-hint">No tools yet — open the library to add them.</span>'; return; }
        const chips = tools.map((t) => 'T' + t.num + (t.name ? ' ' + t.name : (t.dia !== '' ? ' Ø' + t.dia : ''))).join('  ·  ');
        cont.innerHTML = '<span class="settings-hint">' + tools.length + ' tool' + (tools.length > 1 ? 's' : '') + ':  ' + chips + '</span>';
    }
    const _atcInsert = q('set_atc_insert');
    if (_atcInsert) {
        _atcInsert.addEventListener('click', () => {
            const a = _ddcsSettings.atc || {};
            const base = parseInt(a.baseVar, 10) || 1430;
            const lines = [];
            libraryTools(a).forEach((t) => {
                const v = t.length, n = parseInt(t.num, 10);
                if (v === '' || v == null || !Number.isFinite(Number(v)) || !Number.isFinite(n)) return;
                lines.push('#' + (base + n - 1) + '=' + Number(v) + ' ( T' + n + (t.name ? ' ' + t.name : '') + ' length )');
            });
            if (!lines.length) { alert('No tool lengths set in the library.'); return; }
            const code = '( Tool table )\n' + lines.join('\n') + '\n';
            const em = (window.ddcsStudio && window.ddcsStudio.editorManager) || window.editorManager;
            if (em && typeof em.insert === 'function') em.insert(code);
        });
    }

    // --- Tool library modal: the sparse editor (＋ Add / ✕ remove tools, full per-tool record) ---
    function nextToolNum(tools) {
        let mx = 0;
        (tools || []).forEach((t) => { const n = parseInt(t && t.num, 10); if (Number.isFinite(n) && n > mx) mx = n; });
        return mx + 1;
    }
    function lenVarLabel(num, base) {
        const n = parseInt(num, 10);
        return Number.isFinite(n) ? '#' + (base + n - 1) : '#—';
    }
    function renderToolLibRows() {
        const body = document.getElementById('toollib-rows');
        if (!body) return;
        const a = _ddcsSettings.atc || {};
        const base = parseInt(a.baseVar, 10) || 1430;
        const tools = a.tools || (a.tools = []);
        const opt = (cur) => '<option value="">—</option>' +
            TOOL_TYPES.map((ty) => '<option value="' + ty + '"' + (ty === cur ? ' selected' : '') + '>' + ty + '</option>').join('');
        const cell = (i, f, val, step) =>
            '<td><input type="number" step="' + (step || 'any') + '" data-tool="' + i + '" data-field="' + f + '" value="' + (val === '' || val == null ? '' : val) + '"></td>';
        if (!tools.length) { body.innerHTML = '<tr><td colspan="11" class="tl-empty">No tools yet — “＋ Add tool” to start your library.</td></tr>'; return; }
        let html = '';
        tools.forEach((raw, i) => {
            const t = normalizeTool(raw, i + 1);
            html += '<tr>' +
                '<td class="tl-numcell"><input type="number" step="1" min="1" max="99" data-tool="' + i + '" data-field="num" value="' + (t.num === '' || t.num == null ? '' : t.num) + '"><span class="tl-var" data-var="' + i + '">' + lenVarLabel(t.num, base) + '</span></td>' +
                '<td><input type="text" data-tool="' + i + '" data-field="name" value="' + String(t.name).replace(/"/g, '&quot;') + '" placeholder="e.g. 6mm flat 2F"></td>' +
                '<td><select data-tool="' + i + '" data-field="type">' + opt(t.type) + '</select></td>' +
                '<td class="tl-prof" data-prof="' + i + '">' + toolProfileSvg(t, { w: 26, h: 40 }) + '</td>' +
                cell(i, 'dia', t.dia) + cell(i, 'flutes', t.flutes, '1') + cell(i, 'length', t.length, '0.001') +
                cell(i, 'rpm', t.rpm, '1') + cell(i, 'feed', t.feed, '1') + cell(i, 'plunge', t.plunge, '1') +
                '<td><button class="tl-del" data-del="' + i + '" title="Remove tool">✕</button></td>' +
                '</tr>';
        });
        body.innerHTML = html;
    }
    function buildToolLibModal() {
        if (document.getElementById('toollib-modal')) return;
        const m = document.createElement('div');
        m.id = 'toollib-modal';
        m.innerHTML = `
            <style>
                #toollib-modal { position: fixed; inset: 0; z-index: 1000; display: none; align-items: center; justify-content: center; background: rgba(0,0,0,.5); }
                #toollib-modal.active { display: flex; }
                #toollib-modal .tl-panel { background: var(--panel); color: var(--text-main); border: 1px solid var(--border); border-radius: var(--radius, 6px); width: min(980px, 95vw); max-height: 88vh; display: flex; flex-direction: column; box-shadow: 0 12px 40px rgba(0,0,0,.5); }
                #toollib-modal .tl-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--border); font-weight: 700; letter-spacing: .5px; }
                #toollib-modal .tl-head button { background: transparent; border: none; color: var(--text-dim); font-size: 18px; cursor: pointer; }
                #toollib-modal .tl-body { overflow: auto; padding: 8px 16px 16px; }
                #toollib-modal table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
                #toollib-modal th { position: sticky; top: 0; background: var(--panel); text-align: left; font-size: 10.5px; letter-spacing: .5px; text-transform: uppercase; color: var(--text-dim); padding: 6px 6px; border-bottom: 1px solid var(--border); }
                #toollib-modal td { padding: 3px 4px; border-bottom: 1px solid var(--border); vertical-align: middle; }
                #toollib-modal .tl-numcell { white-space: nowrap; }
                #toollib-modal .tl-numcell input { width: 46px; }
                #toollib-modal .tl-var { display: inline-block; margin-left: 6px; font-size: 10px; color: var(--text-dim); }
                #toollib-modal .tl-prof { text-align: center; width: 34px; }
                #toollib-modal .tl-prof svg { display: block; margin: 0 auto; }
                #toollib-modal .tl-empty { padding: 16px; text-align: center; color: var(--text-dim); }
                #toollib-modal input, #toollib-modal select { width: 100%; box-sizing: border-box; background: var(--bg); color: var(--text-main); border: 1px solid var(--border); border-radius: 3px; padding: 4px 6px; font: inherit; }
                #toollib-modal td:nth-child(4) input, #toollib-modal td:nth-child(5) input, #toollib-modal td:nth-child(6) input,
                #toollib-modal td:nth-child(7) input, #toollib-modal td:nth-child(8) input, #toollib-modal td:nth-child(9) input { width: 70px; }
                #toollib-modal .tl-del { width: auto; background: transparent; border: none; color: var(--text-dim); cursor: pointer; font-size: 14px; padding: 2px 6px; }
                #toollib-modal .tl-del:hover { color: #d66; }
                #toollib-modal .tl-foot { padding: 10px 16px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; gap: 8px; }
                #toollib-modal .tl-hint { font-size: 11px; color: var(--text-dim); }
            </style>
            <div class="tl-panel">
                <div class="tl-head"><span>🛠 Tool library</span><button id="toollib-close" title="Close">✕</button></div>
                <div class="tl-body">
                    <table>
                        <thead><tr>
                            <th>Tool #</th><th>Name</th><th>Type</th><th>Profile</th><th>Ø mm</th><th>Flutes</th><th>Length</th><th>RPM</th><th>Feed</th><th>Plunge</th><th></th>
                        </tr></thead>
                        <tbody id="toollib-rows"></tbody>
                    </table>
                </div>
                <div class="tl-foot">
                    <button class="toolbar-btn settings-io" id="toollib-add">＋ Add tool</button>
                    <span class="tl-hint">Tool # → length offset #[base + #−1]. Feeds in mm/min. The Mill wizards' Tool ▾ and the ATC magazine read this list.</span>
                    <button class="toolbar-btn settings-io" id="toollib-done">Done</button>
                </div>
            </div>`;
        document.body.appendChild(m);
        const close = () => m.classList.remove('active');
        m.querySelector('#toollib-close').addEventListener('click', close);
        m.querySelector('#toollib-done').addEventListener('click', close);
        m.addEventListener('mousedown', (e) => { if (e.target === m) close(); });   // click backdrop
        m.addEventListener('input', (e) => {
            const t = e.target;
            if (t.dataset.tool == null || !t.dataset.field) return;
            const i = parseInt(t.dataset.tool, 10), f = t.dataset.field;
            const a = _ddcsSettings.atc; a.tools = a.tools || [];
            const rec = normalizeTool(a.tools[i], i + 1);
            let val = t.value;
            if (f !== 'name' && f !== 'type') val = (val === '') ? '' : parseFloat(val);
            rec[f] = val;
            a.tools[i] = rec;
            saveSettings();
            if (f === 'num') {   // update the #var label inline (don't re-render — keeps focus)
                const span = m.querySelector('.tl-var[data-var="' + i + '"]');
                if (span) span.textContent = lenVarLabel(rec.num, parseInt(a.baseVar, 10) || 1430);
            }
            if (f === 'type' || f === 'dia' || f === 'length') {   // redraw the silhouette in place (keeps focus)
                const cellEl = m.querySelector('.tl-prof[data-prof="' + i + '"]');
                if (cellEl) cellEl.innerHTML = toolProfileSvg(rec, { w: 26, h: 40 });
            }
            renderLibSummary();
        });
        m.addEventListener('click', (e) => {
            if (e.target.id === 'toollib-add') {
                const a = _ddcsSettings.atc; a.tools = a.tools || [];
                a.tools.push(normalizeTool({}, nextToolNum(a.tools)));
                saveSettings(); renderToolLibRows(); renderLibSummary();
                return;
            }
            const del = e.target.dataset ? e.target.dataset.del : null;
            if (del != null) {
                const a = _ddcsSettings.atc; a.tools = a.tools || [];
                a.tools.splice(parseInt(del, 10), 1);
                saveSettings(); renderToolLibRows(); renderLibSummary();
            }
        });
    }
    const _atcLibrary = q('set_atc_library');
    if (_atcLibrary) {
        _atcLibrary.addEventListener('click', () => {
            buildToolLibModal();
            renderToolLibRows();
            document.getElementById('toollib-modal').classList.add('active');
        });
    }

    const closeOv = () => {
        saveSettings();
        ov.classList.remove('active');
        setTimeout(() => { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 300);
    };

    const onInput = () => {
        const s = _ddcsSettings;
        if (!s.hardwareTabs) s.hardwareTabs = {};
        s.hardwareTabs.probes = q('set_show_probes').checked;
        s.hardwareTabs.atc = q('set_show_atc').checked;
        s.hardwareTabs.limits = q('set_show_limits').checked;
        applyHardwareTabs();
        const pv = s.preview || (s.preview = { ...SETTINGS_DEFAULTS.preview });
        if (q('set_pv_view')) pv.defaultView = q('set_pv_view').value;
        if (q('set_pv_speed')) pv.defaultSpeed = num(q('set_pv_speed').value, 1);
        if (q('set_pv_rapids')) pv.showRapids = q('set_pv_rapids').checked;
        if (q('set_pv_gridstep')) pv.gridStep = num(q('set_pv_gridstep').value, 0);
        if (q('set_pv_follow_default')) pv.followDefault = q('set_pv_follow_default').checked;
        if (q('set_pv_autoloop')) pv.autoLoop = q('set_pv_autoloop').checked;
        const cp = s.compose || (s.compose = { ...SETTINGS_DEFAULTS.compose });
        if (q('set_cp_suggestions')) cp.suggestions = q('set_cp_suggestions').checked;
        if (q('set_cp_autocomplete')) cp.autocomplete = q('set_cp_autocomplete').checked;
        if (q('set_cp_ghost')) cp.ghost = q('set_cp_ghost').checked;
        if (q('set_pv_followdamp')) {
            pv.followDamp = num(q('set_pv_followdamp').value, 50);
            const lbl = q('set_pv_followdamp_val'); if (lbl) lbl.textContent = pv.followDamp + '%';
        }
        const a = s.atc || (s.atc = {});
        a.blockHeight = num(q('set_atc_blockheight').value, a.blockHeight);
        a.safeZ = num(q('set_atc_safez').value, a.safeZ);
        a.maxDist = num(q('set_atc_maxdist').value, a.maxDist);
        a.retract = num(q('set_atc_retract').value, a.retract);
        a.fFast = num(q('set_atc_ffast').value, a.fFast);
        a.fSlow = num(q('set_atc_fslow').value, a.fSlow);
        a.qStop = num(q('set_atc_qstop').value, a.qStop);
        const _nb = num(q('set_atc_basevar').value, a.baseVar);
        if (_nb !== a.baseVar) { a.baseVar = _nb; renderLibSummary(); }   // base var shifts every #var
        s.machine.x = num(q('set_mach_x').value, s.machine.x);
        s.machine.y = num(q('set_mach_y').value, s.machine.y);
        s.machine.z = num(q('set_mach_z').value, s.machine.z);
        // ox/oy/oz removed; workOrigin is derived from the WCS table (renderWcsTable persists it on edit/pull).
        s.machine.show = q('set_mach_show').checked;

        s.probes.probePin = num(q('set_probe_pin').value, s.probes.probePin);
        s.probes.probeLevel = num(q('set_probe_level').value, s.probes.probeLevel);
        s.probes.setterPin = num(q('set_setter_pin').value, s.probes.setterPin);
        s.probes.setterLevel = num(q('set_setter_level').value, s.probes.setterLevel);
        s.probes.setterX = num(q('set_setter_x').value, s.probes.setterX);
        s.probes.setterY = num(q('set_setter_y').value, s.probes.setterY);
        s.probes.setterZ = num(q('set_setter_z').value, s.probes.setterZ);
        s.probes.setterW = num(q('set_setter_w').value, s.probes.setterW);
        s.probes.setterH = num(q('set_setter_h').value, s.probes.setterH);

        if (q('set_pd_radius')) {
            s.probes.radius = num(q('set_pd_radius').value, s.probes.radius);
            s.probes.fastFeed = num(q('set_pd_ffast').value, s.probes.fastFeed);
            s.probes.slowFeed = num(q('set_pd_fslow').value, s.probes.slowFeed);
            s.probes.retract = num(q('set_pd_retract').value, s.probes.retract);
            s.probes.safeZ = num(q('set_pd_safez').value, s.probes.safeZ);
            s.probes.maxDist = num(q('set_pd_maxdist').value, s.probes.maxDist);
            s.probes.qStop = num(q('set_pd_qstop').value, s.probes.qStop);
        }

        s.limits.xMinPin = q('set_x_min_pin').value ? num(q('set_x_min_pin').value, null) : null;
        s.limits.xMinLevel = num(q('set_x_min_level').value, s.limits.xMinLevel);
        s.limits.xMaxPin = q('set_x_max_pin').value ? num(q('set_x_max_pin').value, null) : null;
        s.limits.xMaxLevel = num(q('set_x_max_level').value, s.limits.xMaxLevel);
        s.limits.yMinPin = q('set_y_min_pin').value ? num(q('set_y_min_pin').value, null) : null;
        s.limits.yMinLevel = num(q('set_y_min_level').value, s.limits.yMinLevel);
        s.limits.yMaxPin = q('set_y_max_pin').value ? num(q('set_y_max_pin').value, null) : null;
        s.limits.yMaxLevel = num(q('set_y_max_level').value, s.limits.yMaxLevel);
        s.limits.zMinPin = q('set_z_min_pin').value ? num(q('set_z_min_pin').value, null) : null;
        s.limits.zMinLevel = num(q('set_z_min_level').value, s.limits.zMinLevel);
        s.limits.zMaxPin = q('set_z_max_pin').value ? num(q('set_z_max_pin').value, null) : null;
        s.limits.zMaxLevel = num(q('set_z_max_level').value, s.limits.zMaxLevel);

        const sp = s.spindle || (s.spindle = {});
        if (q('set_spin_maxrpm')) {
            sp.maxRpm = num(q('set_spin_maxrpm').value, sp.maxRpm);
            sp.defaultRpm = num(q('set_spin_defrpm').value, sp.defaultRpm);
            sp.dir = q('set_spin_dir').value || sp.dir;
            sp.spinUp = num(q('set_spin_up').value, sp.spinUp);
            sp.spinDown = num(q('set_spin_down').value, sp.spinDown);
        }
        if (q('set_head_type')) { s.head = s.head || {}; s.head.type = q('set_head_type').value || 'spindle'; applyHeadType(); }
        const ep = s.endProgram || (s.endProgram = {});
        if (q('set_end_end')) {
            ep.spindleOff = q('set_end_spindleoff').checked;
            ep.coolantOff = q('set_end_coolantoff').checked;
            ep.retract = q('set_end_retract').checked;
            ep.retractZ = num(q('set_end_retractz').value, ep.retractZ);
            ep.park = q('set_end_park').checked;
            ep.parkX = num(q('set_end_parkx').value, ep.parkX);
            ep.parkY = num(q('set_end_parky').value, ep.parkY);
            ep.end = q('set_end_end').value || ep.end;
        }

        saveSettings();
    };
    ov.querySelectorAll('input[type="number"], input[type="checkbox"], input[type="range"], select').forEach(el => {
        el.addEventListener('input', onInput);
        el.addEventListener('change', onInput);
    });

    // Smart suggestion bar toggle (not part of the settings model — just localStorage + an event the bar listens for).
    const _sg = q('set_suggest_on');
    if (_sg) {
        _sg.checked = localStorage.getItem('ddcs_suggest_on') !== 'off';
        _sg.addEventListener('change', () => {
            try { localStorage.setItem('ddcs_suggest_on', _sg.checked ? 'on' : 'off'); } catch (e) { /* ignore */ }
            window.dispatchEvent(new CustomEvent('ddcs:suggest-changed'));
        });
    }

    // Appearance: theme picker + keyboard-drawer height (own localStorage, not the settings model).
    const _theme = q('set_theme');
    if (_theme) {
        const tm = window.ddcsStudio && window.ddcsStudio.themeManager;
        const cur = (tm && tm.getCurrent && tm.getCurrent()) || localStorage.getItem('ddcs_theme') || THEMES[0];
        _theme.innerHTML = THEMES.map(t => `<option value="${t}">${t.charAt(0).toUpperCase() + t.slice(1)}</option>`).join('');
        _theme.value = cur;
        _theme.addEventListener('change', () => {
            const tm2 = window.ddcsStudio && window.ddcsStudio.themeManager;
            if (tm2 && tm2.setCurrent) tm2.setCurrent(_theme.value);
            else { document.body.setAttribute('data-theme', _theme.value); try { localStorage.setItem('ddcs_theme', _theme.value); } catch (e) { /* ignore */ } }
        });
    }
    const _aboutVer = q('set_about_ver');
    if (_aboutVer) { const v = document.querySelector('.ver'); _aboutVer.textContent = v ? v.textContent.trim() : 'V10.20'; }

    // Spindle / Program → insert generated G-code into the editor (mirrors the ATC "Insert tool table").
    const _emInsert = (code) => {
        const em = (window.ddcsStudio && window.ddcsStudio.editorManager) || window.editorManager;
        if (em && typeof em.insert === 'function') em.insert(code);
    };
    const _endInsert = q('set_end_insert');
    if (_endInsert) _endInsert.addEventListener('click', () => {
        const ep = _ddcsSettings.endProgram || {};
        const lines = ['( End of program - DDCS Studio )'];
        if (ep.spindleOff !== false) lines.push('M5   ( spindle off )');
        if (ep.coolantOff !== false) lines.push('M9   ( coolant off )');
        if (ep.retract !== false) { lines.push('#101 = ' + num(ep.retractZ, 0) + '   ( safe Z - G53 needs a variable )'); lines.push('G53 G0 Z#101   ( retract )'); }
        if (ep.park === true) { lines.push('#102 = ' + num(ep.parkX, 0) + '  #103 = ' + num(ep.parkY, 0)); lines.push('G53 G0 X#102 Y#103   ( park for unload )'); }
        if (ep.end && ep.end !== 'none') lines.push(ep.end);
        _emInsert(lines.join('\n') + '\n');
    });

    // CSV import
    q('set_csv_input').addEventListener('change', (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = (ev) => {
            const db = window.ddcsStudio && window.ddcsStudio.variableDB;
            if (db) db.loadFromCSV(ev.target.result);
            if (window.refreshDeckVariables) window.refreshDeckVariables();
            updateVarCount();
        };
        r.readAsText(f);
    });
    // CSV export
    q('set_export').addEventListener('click', () => {
        const db = window.ddcsStudio && window.ddcsStudio.variableDB;
        if (db) UIUtils.downloadFile('ddcs_variables.csv', db.exportCSV());
    });

    // Report a bug (moved here from the header)
    q('set_report').addEventListener('click', () => {
        const code = (document.getElementById('editor') || {}).value || '';
        const body = 'Version: V10.20\n\nDescribe your feedback or bug below:\n\n' + (code ? '--- Editor Code ---\n' + code : '(editor empty)');
        window.location.href = 'mailto:dansemur@gmail.com?subject=' + encodeURIComponent('DDCS Studio Feedback / Bug Report') + '&body=' + encodeURIComponent(body);
    });

    // Profile import/export (JSON = settings + user variables)
    q('set_profile_export').addEventListener('click', () => { if (window.ddcsExportProfile) window.ddcsExportProfile(); });
    q('set_profile_import').addEventListener('click', () => { if (window.ddcsImportProfile) window.ddcsImportProfile(); });

    // Cloud profile save/load — named profiles in the user's own Google Drive (Settings → Cloud). Remote-sim leg.
    const cloudSave = q('set_profile_cloud_save');
    if (cloudSave) cloudSave.addEventListener('click', async () => {
        if (!window.ddcsSaveProfileToCloud) return;
        let def = ''; try { def = getActiveProfile().name || ''; } catch (e) { /* */ }
        const name = window.prompt('Save this profile to your cloud as:', def || 'My machine');
        if (!name) return;
        const orig = cloudSave.textContent; cloudSave.disabled = true; cloudSave.textContent = 'Saving…';
        try { const n = await window.ddcsSaveProfileToCloud(name); alert('Saved “' + n + '” to your cloud.'); }
        catch (e) { alert('Cloud save failed: ' + (e && e.message ? e.message : e)); }
        finally { cloudSave.disabled = false; cloudSave.textContent = orig; }
    });
    const cloudLoad = q('set_profile_cloud_load');
    if (cloudLoad) cloudLoad.addEventListener('click', () => openCloudProfilePicker());

    async function openCloudProfilePicker() {
        let items = [];
        try { items = (await window.ddcsListCloudProfiles()) || []; }
        catch (e) { alert('Could not reach your cloud: ' + (e && e.message ? e.message : e)); return; }
        if (!items.length) { alert('No cloud profiles yet — sign in (Settings → Cloud) and use “Save to cloud”.'); return; }
        let m = document.getElementById('cloudprof-modal');
        if (!m) {
            m = document.createElement('div'); m.id = 'cloudprof-modal';
            m.innerHTML = '<style>'
                + '#cloudprof-modal { position:fixed; inset:0; z-index:1000; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,.5); }'
                + '#cloudprof-modal .cp-panel { background:var(--panel); color:var(--text-main); border:1px solid var(--border); border-radius:var(--radius,6px); width:min(460px,94vw); max-height:80vh; display:flex; flex-direction:column; box-shadow:0 12px 40px rgba(0,0,0,.5); }'
                + '#cloudprof-modal .cp-head { display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-bottom:1px solid var(--border); font-weight:700; }'
                + '#cloudprof-modal .cp-head button { background:transparent; border:none; color:var(--text-dim); font-size:18px; cursor:pointer; }'
                + '#cloudprof-modal .cp-body { overflow:auto; padding:6px 12px 12px; }'
                + '#cloudprof-modal .cp-row { display:flex; align-items:center; gap:10px; padding:8px 4px; border-bottom:1px solid var(--border); }'
                + '#cloudprof-modal .cp-name { flex:1; font-weight:600; } #cloudprof-modal .cp-date { font-size:11px; color:var(--text-dim); }'
                + '</style><div class="cp-panel"><div class="cp-head"><span>☁ Load profile from cloud</span><button data-cp="x">✕</button></div><div class="cp-body" id="cloudprof-body"></div></div>';
            document.body.appendChild(m);
            m.addEventListener('mousedown', (e) => { if (e.target === m || (e.target.dataset && e.target.dataset.cp === 'x')) m.remove(); });
        }
        const body = m.querySelector('#cloudprof-body');
        body.innerHTML = items.map((it) => {
            const d = it.savedAt ? new Date(it.savedAt).toLocaleString() : '';
            return '<div class="cp-row"><span class="cp-name">' + it.name + '</span><span class="cp-date">' + d + '</span>'
                + '<button class="toolbar-btn settings-io" data-load="' + it.id + '">Load</button>'
                + '<button class="op-btn" data-del="' + it.id + '" title="Delete">✕</button></div>';
        }).join('');
        body.querySelectorAll('[data-load]').forEach((b) => b.addEventListener('click', async () => {
            if (!confirm('Load this profile? It replaces your current settings + variables.')) return;
            b.disabled = true; b.textContent = 'Loading…';
            try { await window.ddcsLoadCloudProfile(b.dataset.load); m.remove(); fill(); applyHardwareTabs(); alert('Profile loaded.'); }
            catch (e) { alert('Load failed: ' + (e && e.message ? e.message : e)); b.disabled = false; b.textContent = 'Load'; }
        }));
        body.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
            if (!confirm('Delete this cloud profile?')) return;
            try { await window.ddcsDeleteCloudProfile(b.dataset.del); openCloudProfilePicker(); }
            catch (e) { alert('Delete failed: ' + (e && e.message ? e.message : e)); }
        }));
    }

    // ATC: generate a T.nc tool-change macro from the magazine table (client-side; review before running).
    const genTnc = q('atc_gen_tnc');
    if (genTnc) genTnc.addEventListener('click', () => {
        const nc = generateToolChangeNc(_ddcsSettings.atc, getOutputs());
        const out = q('atc_tnc_out'); if (out) { out.value = nc; out.style.display = 'block'; }
        const dl = q('atc_dl_tnc'); if (dl) dl.style.display = '';
    });
    const dlTnc = q('atc_dl_tnc');
    if (dlTnc) dlTnc.addEventListener('click', () => {
        const out = q('atc_tnc_out'); if (out && out.value) UIUtils.downloadFile('T.nc', out.value);
    });

    // Machine → AXES: persist axis roles on change so the sim knows which axes are rotary (+ orientation).
    ['a', 'b'].forEach((ax) => {
        const role = q('set_axis_' + ax + '_role'), around = q('set_axis_' + ax + '_around');
        const apply = () => { _ddcsSettings.motors = _ddcsSettings.motors || {}; _ddcsSettings.motors[ax] = { role: role.value, around: around.value }; saveSettings(); };
        if (role) role.addEventListener('change', apply);
        if (around) around.addEventListener('change', apply);
    });

        // Two-level tab logic: main L1 (General | Hardware) → filters sidebar items.
    const mainTabs = [...ov.querySelectorAll('.settings-main-tab')];
    const sideTabs = [...ov.querySelectorAll('.settings-sidebar .settings-tab')];
    const sideGroupLabels = [...ov.querySelectorAll('.settings-sidebar .sidebar-group-label')];
        const ALL_IDS = ['set_tab_profile', 'set_tab_appearance', 'set_tab_preview', 'set_tab_compose', 'set_tab_variables', 'set_tab_program', 'set_tab_gateway', 'set_tab_cloud', 'set_tab_faq', 'set_tab_feedback', 'set_tab_about',
                     'set_tab_machine', 'set_tab_spindle', 'set_tab_input', 'set_tab_output', 'set_tab_atc'];
    function showPanel(id) {
        ALL_IDS.forEach(p => { const el = ov.querySelector('#' + p); if (el) el.style.display = (p === id) ? 'block' : 'none'; });
        sideTabs.forEach(b => b.classList.toggle('active', b.dataset.target === id));
        if (id === 'set_tab_input') renderIoTable(ov.querySelector('#io_input_table'), 'input', getInputs(), syncIO);
        if (id === 'set_tab_output') renderIoTable(ov.querySelector('#io_output_table'), 'output', getOutputs(), syncIO);
        if (id === 'set_tab_atc') renderMagazineTable(ov.querySelector('#atc_magazine'), _ddcsSettings.atc, atcOnChange);
    }
    function showGroup(g) {
        mainTabs.forEach(b => b.classList.toggle('active', b.dataset.group === g));
        sideTabs.forEach(b => { b.style.display = (b.dataset.group === g) ? '' : 'none'; });
        sideGroupLabels.forEach(l => { l.style.display = (l.dataset.groupLabel === g) ? '' : 'none'; });
        if (g === 'hardware') applyHardwareTabs();   // toggle each subsystem tab's Add button vs config
        const firstVisible = sideTabs.find(b => b.dataset.group === g && b.style.display !== 'none');
        if (firstVisible) showPanel(firstVisible.dataset.target);
    }
    mainTabs.forEach(t => t.addEventListener('click', () => showGroup(t.dataset.group)));
    sideTabs.forEach(t => t.addEventListener('click', () => showPanel(t.dataset.target)));
    showGroup('general');

    // "+ Add hardware" tool: adds a subsystem category tab + its standard I/O (mirrored + badged).
    function addSubsystem(kind) {
        if (kind === 'atc') {
            _ddcsSettings.hardwareTabs = _ddcsSettings.hardwareTabs || {};
            _ddcsSettings.hardwareTabs.atc = true;
            // Seed the ESSENTIAL ATC I/O every tool changer needs: the drawbar output + the three sensors the
            // change sequence waits on (drawbar released M301, clamped M302, spindle stopped M300). Pins are left
            // blank for the user to assign. (Disk/carousel adds rotate + index on top, via atcOnChange.)
            const outs = getOutputs(), ins = getInputs();
            if (!outs.some(o => o.type === 'drawbar')) outs.push({ id: 'drawbar_atc', type: 'drawbar', label: 'Drawbar (ATC)', pin: '', onCode: 'M154', offCode: 'M155', group: 'atc' });
            const addIn = (id, label) => { if (!ins.some(i => i.id === id)) ins.push({ id, type: 'sensor', label, pin: '', level: 0, group: 'atc' }); };
            addIn('drawbar_released_atc', 'Drawbar released (M301)');
            addIn('drawbar_clamped_atc', 'Drawbar clamped (M302)');
            addIn('spindle_stopped_atc', 'Spindle stopped (M300)');
            saveSettings();
            applyHardwareTabs();
            showPanel('set_tab_atc');
        }
        if (kind === 'spindle') {
            _ddcsSettings.hardwareTabs = _ddcsSettings.hardwareTabs || {};
            _ddcsSettings.hardwareTabs.spindle = true;
            saveSettings();
            applyHardwareTabs();
            showPanel('set_tab_spindle');
        }
    }
    // "+ Add" lives inside each subsystem's own (always-present) tab now.
    const _spinAddBtn = q('set_spin_add_btn');
    if (_spinAddBtn) _spinAddBtn.addEventListener('click', () => addSubsystem('spindle'));
    const _atcAddBtn = q('set_atc_add_btn');
    if (_atcAddBtn) _atcAddBtn.addEventListener('click', () => addSubsystem('atc'));
    // Remove a subsystem: hide its tab + strip the I/O rows it owns (group-tagged). The tool table/magazine data
    // is left intact (it lives under atc.*), so re-adding restores everything.
    function removeSubsystem(kind) {
        if (!window.confirm('Remove the ' + kind.toUpperCase() + ' subsystem and its I/O rows? (Your magazine + tool table are kept.)')) return;
        _ddcsSettings.hardwareTabs = _ddcsSettings.hardwareTabs || {};
        _ddcsSettings.hardwareTabs[kind] = false;
        const outs = getOutputs(), ins = getInputs();
        for (let i = outs.length - 1; i >= 0; i--) if (outs[i].group === kind) outs.splice(i, 1);
        for (let i = ins.length - 1; i >= 0; i--) if (ins[i].group === kind) ins.splice(i, 1);
        saveSettings(); applyHardwareTabs(); showGroup('general');
    }
    const _atcRemoveBtn = q('set_atc_remove_btn');
    if (_atcRemoveBtn) _atcRemoveBtn.addEventListener('click', () => removeSubsystem('atc'));

    // Persist ATC magazine edits; disk auto-adds (and straight removes) the carousel-rotate / index I/O.
    function atcOnChange() {
        const atc = _ddcsSettings.atc;
        const outs = getOutputs(), ins = getInputs();
        if (atc.magType === 'disk') {
            if (!outs.some(o => o.id === 'rotate_atc')) outs.push({ id: 'rotate_atc', type: 'rotate', label: 'Carousel rotate (ATC)', pin: '', onCode: '', offCode: '', group: 'atc' });
            if (!ins.some(i => i.id === 'index_atc')) ins.push({ id: 'index_atc', type: 'sensor', label: 'Pocket index (ATC)', pin: '', level: 0, group: 'atc' });
        } else {
            const ro = outs.findIndex(o => o.id === 'rotate_atc'); if (ro >= 0) outs.splice(ro, 1);
            const ix = ins.findIndex(i => i.id === 'index_atc'); if (ix >= 0) ins.splice(ix, 1);
        }
        saveSettings();
    }

}

function _settingsEsc(e) { if (e.key === 'Escape') { e.stopPropagation(); closeSettings(); } }

export function openSettings() {
    // Opening setup leaves the Studio preview context — stop any running engine/play (every preview panel +
    // Studio's drawer), any open path, so nothing keeps executing behind the panel.
    window.dispatchEvent(new CustomEvent('ddcs:stop-previews'));
    if (window.ddcsStopPreview) window.ddcsStopPreview();
    buildSettingsOverlay();
    const ov = document.getElementById('settings-overlay');
    if (ov) {
        ov.classList.add('active');
        if (!ov.dataset.wired) {                       // scrim click (outside the modal box) closes
            ov.addEventListener('click', (e) => { if (e.target === ov) closeSettings(); });
            ov.dataset.wired = '1';
        }
    }
    document.addEventListener('keydown', _settingsEsc, true);
    window.ddcsTrack?.('feature', 'settings');
}
export function closeSettings() {
    const ov = document.getElementById('settings-overlay');
    if (ov) ov.classList.remove('active');
    document.removeEventListener('keydown', _settingsEsc, true);
}

window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.ddcsGetSettings = getSettings;
window.ddcsSaveSettings = saveSettings;   // let wizards (e.g. the ATC table magazine editor) persist + broadcast edits
window.ddcsApplySettings = applySettings;
