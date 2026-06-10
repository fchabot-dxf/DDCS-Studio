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

const DDCS_SETTINGS_KEY = 'ddcs_studio_settings';
const SETTINGS_DEFAULTS = {
    stock:   { x: 100, y: 80, z: 20, shape: 'boss', show: true },
    machine: { x: 300, y: 300, z: 120, ox: 0, oy: 0, oz: 0, show: true },
    view:    { theta: -1.5708, phi: 1.0472 }, // 3D preview start orientation (front: +X right, +Y back)
    probes:  { 
        probePin: 3, probeLevel: 0,        // IN03 = YunKia V6 3D probe (confirmed)
        setterPin: 2, setterLevel: 0,      // IN02 = fixed Tool Setter (confirmed); was 4 (IN04 = unwired)
        setterX: 10, setterY: 10, setterZ: -50, setterW: 20, setterH: 20 
    },
    limits: {
        xMinPin: '', xMinLevel: 0, xMaxPin: '', xMaxLevel: 0,
        yMinPin: '', yMinLevel: 0, yMaxPin: '', yMaxLevel: 0,
        zMinPin: '', zMinLevel: 0, zMaxPin: '', zMaxLevel: 0
    },
    // ATC: tool-length probe defaults (consumed by the Tool Length wizard) + the tool-offset table.
    // baseVar = DDCS tool-offset table base (#1430 = tool 1); tools[i] = stored length for tool i+1.
    atc: {
        baseVar: 1430, toolCount: 10, tools: [],
        blockHeight: 50, safeZ: 10, maxDist: 200, retract: 3, fFast: 300, fSlow: 50, qStop: 1
    }
};

let _ddcsSettings = loadSettings();

function loadSettings() {
    try {
        const raw = localStorage.getItem(DDCS_SETTINGS_KEY);
        if (raw) {
            const p = JSON.parse(raw);
            return {
                stock: { ...SETTINGS_DEFAULTS.stock, ...(p.stock || {}) },
                machine: { ...SETTINGS_DEFAULTS.machine, ...(p.machine || {}) },
                view: { ...SETTINGS_DEFAULTS.view, ...(p.view || {}) },
                probes: { ...SETTINGS_DEFAULTS.probes, ...(p.probes || {}) },
                limits: { ...SETTINGS_DEFAULTS.limits, ...(p.limits || {}) },
            };
        }
    } catch (e) { /* ignore */ }
    return JSON.parse(JSON.stringify(SETTINGS_DEFAULTS));
}

function saveSettings() {
    try { localStorage.setItem(DDCS_SETTINGS_KEY, JSON.stringify(_ddcsSettings)); } catch (e) { /* ignore */ }
    window.dispatchEvent(new CustomEvent('ddcs:settings-changed', { detail: _ddcsSettings }));
}

export function getSettings() { return _ddcsSettings; }

let _fillSettingsInputs = null;

// Merge incoming settings (e.g. from an imported profile), persist, and refresh the panel
export function applySettings(incoming) {
    if (!incoming || typeof incoming !== 'object') return;
    if (incoming.stock) _ddcsSettings.stock = { ...SETTINGS_DEFAULTS.stock, ..._ddcsSettings.stock, ...incoming.stock };
    if (incoming.machine) _ddcsSettings.machine = { ...SETTINGS_DEFAULTS.machine, ..._ddcsSettings.machine, ...incoming.machine };
    if (incoming.probes) _ddcsSettings.probes = { ...SETTINGS_DEFAULTS.probes, ..._ddcsSettings.probes, ...incoming.probes };
    if (incoming.limits) _ddcsSettings.limits = { ...SETTINGS_DEFAULTS.limits, ..._ddcsSettings.limits, ...incoming.limits };
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
            <div class="settings-head" style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 16px;">
                    <span>⚙ SETTINGS</span>
                    <div class="settings-tabs" style="display: flex; gap: 8px;">
                        <button class="settings-tab active" data-target="set_tab_general" style="background: rgba(255,255,255,0.1); border: 1px solid #555; color: #fff; padding: 2px 8px; font-size: 10px; cursor: pointer;">GENERAL</button>
                        <button class="settings-tab" data-target="set_tab_machine" style="background: transparent; border: 1px solid transparent; color: #aaa; padding: 2px 8px; font-size: 10px; cursor: pointer;">MACHINE</button>
                        <button class="settings-tab" data-target="set_tab_stock" style="background: transparent; border: 1px solid transparent; color: #aaa; padding: 2px 8px; font-size: 10px; cursor: pointer;">STOCK</button>
                        <button class="settings-tab" data-target="set_tab_limits" style="background: transparent; border: 1px solid transparent; color: #aaa; padding: 2px 8px; font-size: 10px; cursor: pointer;">LIMITS</button>
                        <button class="settings-tab" data-target="set_tab_probes" style="background: transparent; border: 1px solid transparent; color: #aaa; padding: 2px 8px; font-size: 10px; cursor: pointer;">PROBES</button>
                        <button class="settings-tab" data-target="set_tab_io" style="background: transparent; border: 1px solid transparent; color: #aaa; padding: 2px 8px; font-size: 10px; cursor: pointer;">I/O</button>
                    </div>
                </div>
                <span class="settings-close" title="Close">✕</span>
            </div>
            <div class="settings-body">
                <!-- GENERAL TAB -->
                <div id="set_tab_general">
                    <div class="settings-section">
                        <div class="settings-section-title">PROFILE (settings + variables)</div>
                        <div class="settings-row">
                            <button class="toolbar-btn settings-io" id="set_profile_export">⬇ Export profile</button>
                            <button class="toolbar-btn settings-io" id="set_profile_import">⬆ Import profile</button>
                        </div>
                        <div class="settings-hint">One JSON with your machine/stock/limits + user variables. The desktop app saves it to a local file automatically.</div>
                    </div>

                    <div class="settings-section">
                        <div class="settings-section-title">VARIABLES (CSV)</div>
                        <div class="settings-row">
                            <label class="toolbar-btn settings-io">📂 Import CSV<input type="file" id="set_csv_input" accept=".csv,text/csv" style="display:none"></label>
                            <button class="toolbar-btn settings-io" id="set_export">⬇ Export CSV</button>
                            <span class="settings-hint" id="set_var_count"></span>
                        </div>
                    </div>

                    <div class="settings-section">
                        <div class="settings-section-title">FEEDBACK</div>
                        <div class="settings-row">
                            <button class="toolbar-btn settings-io" id="set_report">🐛 Report a bug</button>
                        </div>
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
                </div>

                <!-- STOCK TAB -->
                <div id="set_tab_stock" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">STOCK (mm)</div>
                        <div class="settings-grid">
                            <label>X<input type="number" id="set_stock_x" min="0" step="1"></label>
                            <label>Y<input type="number" id="set_stock_y" min="0" step="1"></label>
                            <label>Z<input type="number" id="set_stock_z" min="0" step="1"></label>
                        </div>
                        <label class="settings-field">SHAPE
                            <select id="set_stock_shape">
                                <option value="boss">Boss — probe the outside</option>
                                <option value="pocket">Pocket — probe the inside</option>
                            </select>
                        </label>
                        <label class="settings-check"><input type="checkbox" id="set_stock_show"> Show stock in 3D</label>
                        <div class="settings-hint">WCS zero at the top, min XY corner: X[0..X] · Y[0..Y] · Z[-Z..0].</div>
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

                <!-- IO TAB -->
                <div id="set_tab_io" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">LIVE I/O DIAGNOSTICS</div>
                        <div class="io-grid-wrapper" style="display:flex; gap: 16px;">
                            <div class="io-half" style="flex: 1;">
                                <div class="settings-section-title sub">INPUTS (CLICK TO TRIGGER)</div>
                                <div class="io-led-grid" id="set_inputs_grid" style="display:grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin-top: 8px;">
                                    <!-- JS populated -->
                                </div>
                            </div>
                            <div class="io-half" style="flex: 1;">
                                <div class="settings-section-title sub">OUTPUTS</div>
                                <div class="io-led-grid" id="set_outputs_grid" style="display:grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin-top: 8px;">
                                    <!-- JS populated -->
                                </div>
                            </div>
                        </div>
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
        q('set_stock_x').value = s.stock.x;
        q('set_stock_y').value = s.stock.y;
        q('set_stock_z').value = s.stock.z;
        q('set_stock_shape').value = s.stock.shape || 'boss';
        q('set_stock_show').checked = !!s.stock.show;
        q('set_mach_x').value = s.machine.x;
        q('set_mach_y').value = s.machine.y;
        q('set_mach_z').value = s.machine.z;
        q('set_mach_ox').value = s.machine.ox;
        q('set_mach_oy').value = s.machine.oy;
        q('set_mach_oz').value = s.machine.oz;
        q('set_mach_show').checked = !!s.machine.show;

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

    const closeOv = () => {
        saveSettings();
        if (window.ioTabManager) window.ioTabManager.stopRefreshLoop();
        ov.classList.remove('active');
        setTimeout(() => { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 300);
    };

    const onInput = () => {
        const s = _ddcsSettings;
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
        const body = 'Version: V9.63\n\nDescribe your feedback or bug below:\n\n' + (code ? '--- Editor Code ---\n' + code : '(editor empty)');
        window.location.href = 'mailto:dansemur@gmail.com?subject=' + encodeURIComponent('DDCS Studio Feedback / Bug Report') + '&body=' + encodeURIComponent(body);
    });

    // Profile import/export (JSON = settings + user variables)
    q('set_profile_export').addEventListener('click', () => { if (window.ddcsExportProfile) window.ddcsExportProfile(); });
    q('set_profile_import').addEventListener('click', () => { if (window.ddcsImportProfile) window.ddcsImportProfile(); });

    q('set_reset').addEventListener('click', () => {
        if (confirm('Reset machine and stock dimensions to defaults?')) {
            _ddcsSettings = JSON.parse(JSON.stringify(SETTINGS_DEFAULTS));
            fill();
            saveSettings();
        }
    });

    // Tab logic
    const tabs = ov.querySelectorAll('.settings-tab');
    tabs.forEach(t => {
        t.addEventListener('click', (e) => {
            tabs.forEach(btn => {
                btn.classList.remove('active');
                btn.style.background = 'transparent';
                btn.style.borderColor = 'transparent';
                btn.style.color = '#aaa';
            });
            e.target.classList.add('active');
            e.target.style.background = 'rgba(255,255,255,0.1)';
            e.target.style.borderColor = '#555';
            e.target.style.color = '#fff';
            
            ov.querySelector('#set_tab_general').style.display = 'none';
            ov.querySelector('#set_tab_machine').style.display = 'none';
            ov.querySelector('#set_tab_stock').style.display = 'none';
            ov.querySelector('#set_tab_limits').style.display = 'none';
            ov.querySelector('#set_tab_probes').style.display = 'none';
            ov.querySelector('#set_tab_io').style.display = 'none';
            
            const target = e.target.getAttribute('data-target');
            ov.querySelector('#' + target).style.display = 'block';
            
            if (target === 'set_tab_io' && window.ioTabManager) {
                window.ioTabManager.initSettingsDOM(ov);
                window.ioTabManager.startRefreshLoop();
            } else if (window.ioTabManager) {
                window.ioTabManager.stopRefreshLoop();
            }
        });
    });

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
