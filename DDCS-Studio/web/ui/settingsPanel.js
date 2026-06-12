/**
 * DDCS Studio — Settings panel
 *
 * A header ⚙ button opens an overlay with:
 *   - Variables: CSV import / export (the DB that feeds the keyboard VARIABLES tab)
 *   - Stock: X/Y/Z block dimensions (drawn as a translucent box in the 3D preview)
 *   - Machine: envelope travel X/Y/Z + limit/origin position (wireframe box in 3D)
 *
 * Settings persist to localStorage and broadcast `ddcs:settings-changed` so the
 * 3D preview can redraw. The viewer reads them via window.ddcsGetSettings().
 */
import { UIUtils } from './uiUtils.js';
import { CONTROLLER_PROFILES, getActiveProfile, setActiveProfile, registerProfile } from '../shared/js/profiles/controllerProfiles.js';
import { makeClient } from '../shared/js/client.js';
import { renderIoTable, renderMagazineTable } from './ioTable.js';
import { generateToolChangeNc } from '../data/atcGenerator.js';

const DDCS_SETTINGS_KEY = 'ddcs_studio_settings';
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
    stock:   { x: 100, y: 80, z: 20, shape: 'boss', show: true },
    stockTemplates: [],   // user-saved presets: { name, x, y, z, shape }
    machine: { x: 300, y: 300, z: 120, ox: 0, oy: 0, oz: 0, show: true },
    view:    { theta: -1.5708, phi: 1.0472 }, // 3D preview start orientation (front: +X right, +Y back)
    probes:  {
        probePin: 3, probeLevel: 0,        // IN03 = YunKia V6 3D probe (confirmed)
        setterPin: 2, setterLevel: 0,      // IN02 = fixed Tool Setter (confirmed); was 4 (IN04 = unwired)
        setterX: 10, setterY: 10, setterZ: -50, setterW: 20, setterH: 20,
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
    hardwareTabs: { probes: true, atc: false, limits: true },
    // ATC: tool-length probe defaults (consumed by the Tool Length wizard) + the tool-offset table.
    // baseVar = DDCS tool-offset table base (#1430 = tool 1); tools[i] = stored length for tool i+1.
    atc: {
        baseVar: 1430, toolCount: 10, tools: [],
        blockHeight: 50, safeZ: 10, maxDist: 200, retract: 3, fFast: 300, fSlow: 50, qStop: 1,
        magType: 'straight', magazine: []   // magType: straight|disk; magazine[]: {pocket,tool,name,x,y,z}
    },
    // Dynamic machine I/O — the new source of truth; seeded from probes/limits on first load.
    inputs: [],
    outputs: [],
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

function loadSettings() {
    try {
        const raw = localStorage.getItem(DDCS_SETTINGS_KEY);
        if (raw) {
            const p = JSON.parse(raw);
            return migrateIO({
                stock: { ...SETTINGS_DEFAULTS.stock, ...(p.stock || {}) },
                stockTemplates: Array.isArray(p.stockTemplates) ? p.stockTemplates : [],
                machine: { ...SETTINGS_DEFAULTS.machine, ...(p.machine || {}) },
                view: { ...SETTINGS_DEFAULTS.view, ...(p.view || {}) },
                probes: { ...SETTINGS_DEFAULTS.probes, ...(p.probes || {}),
                          sources: { ...SETTINGS_DEFAULTS.probes.sources, ...((p.probes || {}).sources || {}) } },
                limits: { ...SETTINGS_DEFAULTS.limits, ...(p.limits || {}) },
                hardwareTabs: { ...SETTINGS_DEFAULTS.hardwareTabs, ...(p.hardwareTabs || {}) },
                atc: { ...SETTINGS_DEFAULTS.atc, ...(p.atc || {}) },
                motors: { ...SETTINGS_DEFAULTS.motors, ...(p.motors || {}) },
                inputs: Array.isArray(p.inputs) ? p.inputs : [],
                outputs: Array.isArray(p.outputs) ? p.outputs : [],
            });
        }
    } catch (e) { /* ignore */ }
    return migrateIO(JSON.parse(JSON.stringify(SETTINGS_DEFAULTS)));
}

function saveSettings() {
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

let _fillSettingsInputs = null;

// Merge incoming settings (e.g. from an imported profile), persist, and refresh the panel
export function applySettings(incoming) {
    if (!incoming || typeof incoming !== 'object') return;
    if (incoming.stock) _ddcsSettings.stock = { ...SETTINGS_DEFAULTS.stock, ..._ddcsSettings.stock, ...incoming.stock };
    if (incoming.machine) _ddcsSettings.machine = { ...SETTINGS_DEFAULTS.machine, ..._ddcsSettings.machine, ...incoming.machine };
    if (incoming.probes) _ddcsSettings.probes = { ...SETTINGS_DEFAULTS.probes, ..._ddcsSettings.probes, ...incoming.probes };
    if (incoming.limits) _ddcsSettings.limits = { ...SETTINGS_DEFAULTS.limits, ..._ddcsSettings.limits, ...incoming.limits };
    if (Array.isArray(incoming.inputs)) { _ddcsSettings.inputs = incoming.inputs; syncFlatFromIO(_ddcsSettings); }
    if (Array.isArray(incoming.outputs)) _ddcsSettings.outputs = incoming.outputs;
    saveSettings();
    if (_fillSettingsInputs) _fillSettingsInputs();
}

function buildSettingsOverlay() {
    if (document.getElementById('settings-overlay')) return;
    const ov = document.createElement('div');
    ov.id = 'settings-overlay';
    ov.className = 'overlay settings-overlay';
    ov.innerHTML = `
        <div class="settings-box">
            <style>
                .settings-main-tab { background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.45); color: #fff; padding: 3px 14px; font-size: 12px; font-weight: 700; cursor: pointer; border-radius: 5px; }
                .settings-main-tab:not(.active) { background: transparent; border-color: transparent; color: rgba(255,255,255,0.7); }
                .settings-subtabs .settings-tab { background: transparent; border: 1px solid transparent; color: rgba(255,255,255,0.65); padding: 2px 10px; font-size: 11px; cursor: pointer; border-radius: 4px; }
                .settings-subtabs .settings-tab.active { background: rgba(255,255,255,0.14); border-color: rgba(255,255,255,0.45); color: #fff; }
            </style>
            <div class="settings-head" style="display: block;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 16px;">
                        <span>⚙ SETTINGS</span>
                        <div class="settings-tabs" style="display: flex; gap: 8px;">
                            <button class="settings-main-tab active" data-group="general">General</button>
                            <button class="settings-main-tab" data-group="hardware">Hardware</button>
                        </div>
                    </div>
                    <span class="settings-close" title="Close">✕</span>
                </div>
                <div class="settings-subtabs" style="display: none; gap: 6px; padding-top: 8px; flex-wrap: wrap;">
                    <button class="settings-tab active" data-group="general" data-target="set_tab_profile">Profile</button>
                    <button class="settings-tab" data-group="general" data-target="set_tab_variables">Variables</button>
                    <button class="settings-tab" data-group="general" data-target="set_tab_feedback">Feedback</button>
                    <button class="settings-tab" data-group="general" data-target="set_tab_network">Network</button>
                    <button class="settings-tab" data-group="hardware" data-target="set_tab_machine">Machine</button>
                    <button class="settings-tab" data-group="hardware" data-target="set_tab_stock">Stock</button>
                    <button class="settings-tab" data-group="hardware" data-target="set_tab_input">Input</button>
                    <button class="settings-tab" data-group="hardware" data-target="set_tab_output">Output</button>
                    <button class="settings-tab" data-group="hardware" data-target="set_tab_atc">ATC</button>
                    <select id="set_add_hw" title="Add a hardware subsystem" style="display:none; background:rgba(255,255,255,0.16); color:#fff; border:1px solid rgba(255,255,255,0.5); border-radius:4px; font-size:11px; padding:2px 6px; cursor:pointer; margin-left:4px;">
                        <option value="">+ Add ▾</option>
                        <option value="atc">ATC (tool changer)</option>
                        <option value="spindle" disabled>Spindle / VFD (soon)</option>
                    </select>
                </div>
            </div>
            <div class="settings-body">
                <!-- GENERAL: PROFILE -->
                <div id="set_tab_profile">
                    <div class="settings-section">
                        <div class="settings-section-title">CONTROLLER PROFILE</div>
                        <div class="settings-row">
                            <select id="set_profile" title="Controller profile — presets the hardware your machine has" style="background:#222; color:#ddd; border:1px solid #888; font-size:13px; padding:4px 8px;"></select>
                            <button class="toolbar-btn settings-io" id="set_profile_pull" title="Fetch this machine's profile (tabs + pins) from the bridged controller. Offline controllers like the DDCS 3.1: use Import profile.">↧ Pull from controller</button>
                        </div>
                        <div class="settings-hint">Presets which hardware your machine has (DDCS Expert, 4.1, …). You still add/remove inputs &amp; outputs in the Hardware tabs.</div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">PROFILE (settings + variables)</div>
                        <div class="settings-row">
                            <button class="toolbar-btn settings-io" id="set_profile_export">⬇ Export profile</button>
                            <button class="toolbar-btn settings-io" id="set_profile_import">⬆ Import profile</button>
                        </div>
                        <div class="settings-hint">One JSON with your machine/stock/limits + user variables. The desktop app saves it to a local file automatically.</div>
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

                <!-- GENERAL: FEEDBACK -->
                <div id="set_tab_feedback" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">FEEDBACK</div>
                        <div class="settings-row">
                            <button class="toolbar-btn settings-io" id="set_report">🐛 Report a bug</button>
                        </div>
                    </div>
                </div>

                <!-- GENERAL: NETWORK (stub) -->
                <div id="set_tab_network" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">NETWORK</div>
                        <div class="settings-hint">Coming soon — controller connection (IP / port), live DRO, and program upload over the network.</div>
                    </div>
                </div>

                <!-- MACHINE TAB -->
                <div id="set_tab_machine" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">MACHINE ENVELOPE (mm)</div>
                        <div class="settings-grid">
                            <label>Travel X<input type="number" id="set_mach_x" min="0" step="1"></label>
                            <label>Travel Y<input type="number" id="set_mach_y" min="0" step="1"></label>
                            <label>Travel Z<input type="number" id="set_mach_z" min="0" step="1"></label>
                        </div>
                        <div class="settings-section-title sub">LIMIT / ORIGIN POSITION (mm from min corner)</div>
                        <div class="settings-grid">
                            <label>Origin X<input type="number" id="set_mach_ox" step="1"></label>
                            <label>Origin Y<input type="number" id="set_mach_oy" step="1"></label>
                            <label>Origin Z<input type="number" id="set_mach_oz" step="1"></label>
                        </div>
                        <label class="settings-check"><input type="checkbox" id="set_mach_show"> Show machine envelope in 3D</label>
                        <div class="settings-hint">Origin = program zero position within the envelope.</div>
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

                <!-- STOCK TAB -->
                <div id="set_tab_stock" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">STOCK (mm)</div>
                        <label class="settings-field">TEMPLATE
                            <select id="set_stock_tpl"><option value="">— template —</option></select>
                        </label>
                        <div class="settings-grid">
                            <label>X<input type="number" id="set_stock_x" min="0" step="1"></label>
                            <label>Y<input type="number" id="set_stock_y" min="0" step="1"></label>
                            <label>Z<input type="number" id="set_stock_z" min="0" step="1"></label>
                        </div>
                        <label class="settings-field">SHAPE
                            <select id="set_stock_shape">
                                <option value="boss">Boss — probe the outside</option>
                                <option value="pocket">Pocket — probe the inside</option>
                                <option value="cylinder">Cylinder — rotary stock</option>
                            </select>
                        </label>
                        <label class="settings-check"><input type="checkbox" id="set_stock_show"> Show stock in 3D</label>
                        <div class="settings-actions">
                            <button class="toolbar-btn settings-io" id="set_stock_tpl_save">⭐ Save as template…</button>
                            <button class="toolbar-btn settings-io" id="set_stock_tpl_del" style="display:none">🗑 Delete template</button>
                        </div>
                        <div class="settings-hint">WCS zero at the top, min XY corner: X[0..X] · Y[0..Y] · Z[-Z..0]. For a cylinder, Y is the diameter and X the length along the rotary axis.</div>
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
                </div>

                <!-- HARDWARE: OUTPUT -->
                <div id="set_tab_output" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">OUTPUTS</div>
                        <div class="settings-hint">Coolant, drawbar, dust cover, etc. Pins 1–20. The ATC tab adds its drawbar / dust-cover / carousel-rotate here.</div>
                        <div id="io_output_table"></div>
                    </div>
                </div>

                <!-- ATC TAB -->
                <div id="set_tab_atc" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">TOOL MAGAZINE</div>
                        <div class="settings-hint">Straight = each pocket has a park XYZ; disk = one pickup + rotate-to-pocket (auto-adds rotate / index I/O). The drawbar lives in Output.</div>
                        <div id="atc_magazine"></div>
                        <div class="settings-row" style="margin-top:12px;">
                            <button class="toolbar-btn settings-io" id="atc_gen_tnc">⚙ Generate T.nc</button>
                            <button class="toolbar-btn settings-io" id="atc_dl_tnc" style="display:none">⬇ Download T.nc</button>
                        </div>
                        <div class="settings-hint">Builds the tool-change macro from the table above. Save it as <b>T.nc</b> on the controller — review &amp; dry-run first (generated template).</div>
                        <textarea id="atc_tnc_out" readonly spellcheck="false" style="display:none; width:100%; height:240px; margin-top:8px; font:12px/1.45 monospace; background:#1a1a1a; color:#d8d8d8; border:1px solid #888; border-radius:4px; padding:8px; box-sizing:border-box;"></textarea>
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
                        <div class="settings-hint">Tool-setter pin &amp; location live in the Probes tab. The Tool Length wizard probes against the setter and writes the result to the tool table below.</div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">TOOL TABLE&nbsp;&nbsp;(#var = base + tool − 1)</div>
                        <div class="settings-grid">
                            <label>Base variable<input type="number" id="set_atc_basevar" step="1"></label>
                            <label>Tool count<input type="number" id="set_atc_toolcount" min="1" max="99" step="1"></label>
                        </div>
                        <div id="set_atc_tooltable" class="settings-grid" style="margin-top:8px;"></div>
                        <div class="settings-row" style="margin-top:8px;">
                            <button class="toolbar-btn settings-io" id="set_atc_insert">⬇ Insert tool table</button>
                        </div>
                        <div class="settings-hint">"Insert tool table" drops the #var = length assignments (non-blank rows) into the editor to push the table to the controller. Probing a tool updates one row live.</div>
                    </div>
                </div>

            </div>
            <div class="settings-foot">
                <button class="toolbar-btn" id="set_reset">Reset defaults</button>
                <button class="toolbar-btn primary" id="set_done">Done</button>
            </div>
        </div>`;
    document.body.appendChild(ov);
    wireSettingsOverlay(ov);
}

function wireSettingsOverlay(ov) {
    const q = (id) => ov.querySelector('#' + id);
    const num = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };

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
        const ad = SETTINGS_DEFAULTS.atc, a = s.atc || (s.atc = {});
        q('set_atc_blockheight').value = a.blockHeight ?? ad.blockHeight;
        q('set_atc_safez').value = a.safeZ ?? ad.safeZ;
        q('set_atc_maxdist').value = a.maxDist ?? ad.maxDist;
        q('set_atc_retract').value = a.retract ?? ad.retract;
        q('set_atc_ffast').value = a.fFast ?? ad.fFast;
        q('set_atc_fslow').value = a.fSlow ?? ad.fSlow;
        q('set_atc_qstop').value = a.qStop ?? ad.qStop;
        q('set_atc_basevar').value = a.baseVar ?? ad.baseVar;
        q('set_atc_toolcount').value = a.toolCount ?? ad.toolCount;
        renderToolTable();
        q('set_stock_x').value = s.stock.x;
        q('set_stock_y').value = s.stock.y;
        q('set_stock_z').value = s.stock.z;
        q('set_stock_shape').value = s.stock.shape || 'boss';
        q('set_stock_show').checked = !!s.stock.show;
        rebuildStockTplDropdown();
        q('set_mach_x').value = s.machine.x;
        q('set_mach_y').value = s.machine.y;
        q('set_mach_z').value = s.machine.z;
        q('set_mach_ox').value = s.machine.ox;
        q('set_mach_oy').value = s.machine.oy;
        q('set_mach_oz').value = s.machine.oz;
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

        updateVarCount();
    }
    fill();
    _fillSettingsInputs = fill;

    // --- Controller profile + manual hardware-tab gating (decides which hardware tabs are shown) ---
    function applyHardwareTabs() {
        const ht = _ddcsSettings.hardwareTabs || {};
        const want = { probes: ht.probes !== false, atc: ht.atc === true, limits: ht.limits !== false };
        ['probes', 'atc', 'limits'].forEach((tab) => {
            const btn = ov.querySelector('.settings-tab[data-target="set_tab_' + tab + '"]');
            const panel = ov.querySelector('#set_tab_' + tab);
            if (btn) btn.style.display = want[tab] ? '' : 'none';
            if (panel && !want[tab]) panel.style.display = 'none';   // never leave a hidden tab's panel visible
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
            _ddcsSettings.hardwareTabs = {
                probes: p.hardwareTabs.includes('probes'),
                atc: p.hardwareTabs.includes('atc'),
                limits: p.hardwareTabs.includes('limits'),
            };
            saveSettings();
            fill();
            applyHardwareTabs();
        });
        // When a gateway answers (same-origin in the gateway-served/exe face, or via the ?api= dev
        // override), fetch the controller's own profile and offer it in the list (shown as
        // "… (from controller)"). Silently ignored if offline / not bridged (hosted Studio).
        makeClient().profile().then((p) => {
            if (p && p.id && Array.isArray(p.hardwareTabs)) { registerProfile(p); fillProfileOptions(); }
        }).catch(() => { /* no gateway — leave builtins */ });

        // Explicit "Pull from controller" — fetch /api/profile and apply its tabs + pin map → inputs[].
        const pullBtn = q('set_profile_pull');
        if (pullBtn) pullBtn.addEventListener('click', async () => {
            const orig = pullBtn.textContent; pullBtn.disabled = true; pullBtn.textContent = 'Pulling…';
            try {
                let p;
                try { p = await makeClient().profile(); }
                catch (e) { alert('Not bridged to a controller — run the desktop app (or the gateway) to pull a live profile. Offline controllers like the DDCS 3.1: use Import profile with the exported settings.'); return; }
                if (!p || !p.id) { alert('The gateway returned no profile.'); return; }
                if (!confirm('Pull "' + p.name + '" from the controller? This replaces the current hardware tabs and Input/Output list with the controller values.')) return;
                registerProfile(p); setActiveProfile(p.id);
                applyControllerProfile(p);
                fillProfileOptions();
                const it = ov.querySelector('#io_input_table'); if (it) renderIoTable(it, 'input', getInputs(), syncIO);
                const ot = ov.querySelector('#io_output_table'); if (ot) renderIoTable(ot, 'output', getOutputs(), syncIO);
                alert('Pulled "' + p.name + '": ' + getInputs().length + ' inputs configured.');
            } catch (e) { alert('Pull failed: ' + (e && e.message ? e.message : e)); }
            finally { pullBtn.disabled = false; pullBtn.textContent = orig; }
        });
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
        saveSettings();
        fill();
        applyHardwareTabs();
    }
    applyHardwareTabs();

    // --- ATC tool table: render rows (#var = base + tool-1), live edits, and an "Insert" generator ---
    function renderToolTable() {
        const cont = q('set_atc_tooltable');
        if (!cont) return;
        const a = _ddcsSettings.atc || {};
        const base = parseInt(a.baseVar, 10) || 1430;
        const count = Math.max(1, Math.min(99, parseInt(a.toolCount, 10) || 10));
        const tools = a.tools || (a.tools = []);
        let html = '';
        for (let i = 0; i < count; i++) {
            const v = (tools[i] != null && tools[i] !== '') ? tools[i] : '';
            html += '<label>T' + (i + 1) + ' · #' + (base + i) +
                '<input type="number" step="0.001" class="atc-tool-len" data-tool="' + i + '" value="' + v + '"></label>';
        }
        cont.innerHTML = html;
    }
    const _toolCont = q('set_atc_tooltable');
    if (_toolCont) {
        _toolCont.addEventListener('input', (e) => {   // dynamic rows aren't covered by the global binding
            if (!e.target.classList || !e.target.classList.contains('atc-tool-len')) return;
            const i = parseInt(e.target.dataset.tool, 10);
            const a = _ddcsSettings.atc; a.tools = a.tools || [];
            a.tools[i] = (e.target.value === '') ? '' : parseFloat(e.target.value);
            saveSettings();
        });
    }
    const _atcInsert = q('set_atc_insert');
    if (_atcInsert) {
        _atcInsert.addEventListener('click', () => {
            const a = _ddcsSettings.atc || {};
            const base = parseInt(a.baseVar, 10) || 1430;
            const tools = a.tools || [];
            const count = Math.max(1, Math.min(99, parseInt(a.toolCount, 10) || 0));
            const lines = [];
            for (let i = 0; i < count; i++) {
                const v = tools[i];
                if (v === '' || v == null || !Number.isFinite(Number(v))) continue;
                lines.push('#' + (base + i) + '=' + Number(v) + ' ( Tool ' + (i + 1) + ' length )');
            }
            if (!lines.length) { alert('No tool lengths set in the table.'); return; }
            const code = '( Tool table )\n' + lines.join('\n') + '\n';
            const em = (window.ddcsStudio && window.ddcsStudio.editorManager) || window.editorManager;
            if (em && typeof em.insert === 'function') em.insert(code);
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
        const a = s.atc || (s.atc = {});
        a.blockHeight = num(q('set_atc_blockheight').value, a.blockHeight);
        a.safeZ = num(q('set_atc_safez').value, a.safeZ);
        a.maxDist = num(q('set_atc_maxdist').value, a.maxDist);
        a.retract = num(q('set_atc_retract').value, a.retract);
        a.fFast = num(q('set_atc_ffast').value, a.fFast);
        a.fSlow = num(q('set_atc_fslow').value, a.fSlow);
        a.qStop = num(q('set_atc_qstop').value, a.qStop);
        const _nb = num(q('set_atc_basevar').value, a.baseVar);
        const _nc = Math.max(1, Math.min(99, num(q('set_atc_toolcount').value, a.toolCount)));
        const _rerender = (_nb !== a.baseVar || _nc !== a.toolCount);
        a.baseVar = _nb; a.toolCount = _nc;
        if (_rerender) renderToolTable();
        s.stock.x = num(q('set_stock_x').value, s.stock.x);
        s.stock.y = num(q('set_stock_y').value, s.stock.y);
        s.stock.z = num(q('set_stock_z').value, s.stock.z);
        s.stock.shape = q('set_stock_shape').value;
        s.stock.show = q('set_stock_show').checked;
        s.machine.x = num(q('set_mach_x').value, s.machine.x);
        s.machine.y = num(q('set_mach_y').value, s.machine.y);
        s.machine.z = num(q('set_mach_z').value, s.machine.z);
        s.machine.ox = num(q('set_mach_ox').value, s.machine.ox);
        s.machine.oy = num(q('set_mach_oy').value, s.machine.oy);
        s.machine.oz = num(q('set_mach_oz').value, s.machine.oz);
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

        saveSettings();
    };
    ov.querySelectorAll('input[type="number"], input[type="checkbox"], select').forEach(el => {
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

    // ── Stock templates: built-in presets + user-saved (any shape) ───────────────
    function allStockTpls() {
        const user = Array.isArray(_ddcsSettings.stockTemplates) ? _ddcsSettings.stockTemplates : [];
        return STOCK_TEMPLATES.map(t => ({ t, builtin: true })).concat(user.map(t => ({ t, builtin: false })));
    }
    function stockTplLabel(t) {
        const esc = (v) => String(v).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
        const dims = t.shape === 'cylinder' ? `Ø${t.y}×${t.x}` : `${t.x}×${t.y}×${t.z}`;
        return `${esc(t.name)} — ${dims}`;
    }
    function rebuildStockTplDropdown(selIdx) {
        const sel = q('set_stock_tpl');
        if (!sel) return;
        const list = allStockTpls();
        sel.innerHTML = '<option value="">— template —</option>' +
            list.map((e, i) => `<option value="${i}">${e.builtin ? '' : '⭐ '}${stockTplLabel(e.t)}</option>`).join('');
        sel.value = selIdx != null ? String(selIdx) : '';
        updateStockTplDel();
    }
    function updateStockTplDel() {
        const sel = q('set_stock_tpl'), del = q('set_stock_tpl_del');
        if (!sel || !del) return;
        const i = sel.value === '' ? -1 : parseInt(sel.value, 10);
        const list = allStockTpls();
        del.style.display = (i >= 0 && list[i] && !list[i].builtin) ? '' : 'none';
    }
    const _stockTplSel = q('set_stock_tpl');
    if (_stockTplSel) _stockTplSel.addEventListener('change', () => {
        const i = _stockTplSel.value === '' ? -1 : parseInt(_stockTplSel.value, 10);
        const list = allStockTpls();
        updateStockTplDel();
        if (i < 0 || !list[i]) return;
        const t = list[i].t;
        q('set_stock_x').value = t.x;
        q('set_stock_y').value = t.y;
        q('set_stock_z').value = t.z;
        q('set_stock_shape').value = t.shape || 'boss';
        onInput(); // commit to the model + persist + re-render the 3D view
    });
    const _stockTplSave = q('set_stock_tpl_save');
    if (_stockTplSave) _stockTplSave.addEventListener('click', () => {
        const name = (prompt('Save current stock as a template — name?') || '').trim();
        if (!name) return;
        if (!Array.isArray(_ddcsSettings.stockTemplates)) _ddcsSettings.stockTemplates = [];
        _ddcsSettings.stockTemplates.push({
            name,
            x: num(q('set_stock_x').value, 0),
            y: num(q('set_stock_y').value, 0),
            z: num(q('set_stock_z').value, 0),
            shape: q('set_stock_shape').value || 'boss',
        });
        saveSettings();
        rebuildStockTplDropdown(STOCK_TEMPLATES.length + _ddcsSettings.stockTemplates.length - 1);
    });
    const _stockTplDel = q('set_stock_tpl_del');
    if (_stockTplDel) _stockTplDel.addEventListener('click', () => {
        const sel = q('set_stock_tpl');
        const i = sel.value === '' ? -1 : parseInt(sel.value, 10);
        const list = allStockTpls();
        if (i < 0 || !list[i] || list[i].builtin) return;
        _ddcsSettings.stockTemplates.splice(i - STOCK_TEMPLATES.length, 1);
        saveSettings();
        rebuildStockTplDropdown();
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
        const body = 'Version: V10.16\n\nDescribe your feedback or bug below:\n\n' + (code ? '--- Editor Code ---\n' + code : '(editor empty)');
        window.location.href = 'mailto:dansemur@gmail.com?subject=' + encodeURIComponent('DDCS Studio Feedback / Bug Report') + '&body=' + encodeURIComponent(body);
    });

    // Profile import/export (JSON = settings + user variables)
    q('set_profile_export').addEventListener('click', () => { if (window.ddcsExportProfile) window.ddcsExportProfile(); });
    q('set_profile_import').addEventListener('click', () => { if (window.ddcsImportProfile) window.ddcsImportProfile(); });

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

    q('set_reset').addEventListener('click', () => {
        if (confirm('Reset machine and stock dimensions to defaults?')) {
            _ddcsSettings = JSON.parse(JSON.stringify(SETTINGS_DEFAULTS));
            fill();
            saveSettings();
        }
    });

    // Two-level tab logic: main (General | Hardware) → Hardware reveals a sub-tab row.
    const mainTabs = [...ov.querySelectorAll('.settings-main-tab')];
    const subTabs = [...ov.querySelectorAll('.settings-subtabs .settings-tab')];
    const subRow = ov.querySelector('.settings-subtabs');
    const addHwSel = q('set_add_hw');
    const ALL_IDS = ['set_tab_profile', 'set_tab_variables', 'set_tab_feedback', 'set_tab_network',
                     'set_tab_machine', 'set_tab_stock', 'set_tab_input', 'set_tab_output', 'set_tab_atc'];
    function showPanel(id) {
        ALL_IDS.forEach(p => { const el = ov.querySelector('#' + p); if (el) el.style.display = (p === id) ? 'block' : 'none'; });
        subTabs.forEach(b => b.classList.toggle('active', b.dataset.target === id));
        if (id === 'set_tab_input') renderIoTable(ov.querySelector('#io_input_table'), 'input', getInputs(), syncIO);
        if (id === 'set_tab_output') renderIoTable(ov.querySelector('#io_output_table'), 'output', getOutputs(), syncIO);
        if (id === 'set_tab_atc') renderMagazineTable(ov.querySelector('#atc_magazine'), _ddcsSettings.atc, atcOnChange);
    }
    function showGroup(g) {
        mainTabs.forEach(b => b.classList.toggle('active', b.dataset.group === g));
        subRow.style.display = 'flex';
        subTabs.forEach(b => { b.style.display = (b.dataset.group === g) ? '' : 'none'; });
        if (addHwSel) addHwSel.style.display = (g === 'hardware') ? '' : 'none';
        if (g === 'hardware') applyHardwareTabs();   // re-hide hardware sub-tabs the profile turned off
        const firstVisible = subTabs.find(b => b.dataset.group === g && b.style.display !== 'none');
        if (firstVisible) showPanel(firstVisible.dataset.target);
    }
    mainTabs.forEach(t => t.addEventListener('click', () => showGroup(t.dataset.group)));
    subTabs.forEach(t => t.addEventListener('click', () => showPanel(t.dataset.target)));
    showGroup('general');

    // "+ Add hardware" tool: adds a subsystem category tab + its standard I/O (mirrored + badged).
    function addSubsystem(kind) {
        if (kind === 'atc') {
            _ddcsSettings.hardwareTabs = _ddcsSettings.hardwareTabs || {};
            _ddcsSettings.hardwareTabs.atc = true;
            const outs = getOutputs();
            if (!outs.some(o => o.type === 'drawbar')) outs.push({ id: 'drawbar_atc', type: 'drawbar', label: 'Drawbar (ATC)', pin: '', onCode: 'M154', offCode: 'M155', group: 'atc' });
            saveSettings();
            applyHardwareTabs();
            showPanel('set_tab_atc');
        }
    }
    if (addHwSel) addHwSel.addEventListener('change', () => { if (addHwSel.value) addSubsystem(addHwSel.value); addHwSel.value = ''; });

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

    setTimeout(() => ov.classList.add('active'), 10);
    q('set_done').addEventListener('click', closeOv);
    ov.querySelector('.settings-close').addEventListener('click', closeOv);
    ov.addEventListener('click', (e) => { if (e.target === ov) closeOv(); });
}

export function openSettings() {
    buildSettingsOverlay();
    const o = document.getElementById('settings-overlay');
    if (o) o.classList.add('active');
}
export function closeSettings() {
    const o = document.getElementById('settings-overlay');
    if (o) o.classList.remove('active');
}

window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.ddcsGetSettings = getSettings;
window.ddcsApplySettings = applySettings;
