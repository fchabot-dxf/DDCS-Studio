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
            <div class="settings-head">
                <span>⚙ SETTINGS</span>
                <span class="settings-close" title="Close">✕</span>
            </div>
            <div class="settings-body">
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
                    <div class="settings-section-title">FEEDBACK</div>
                    <div class="settings-row">
                        <button class="toolbar-btn settings-io" id="set_report">🐛 Report a bug</button>
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
        updateVarCount();
    }
    fill();
    _fillSettingsInputs = fill;

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
        const body = 'Version: V9.61\n\nDescribe your feedback or bug below:\n\n' + (code ? '--- Editor Code ---\n' + code : '(editor empty)');
        window.location.href = 'mailto:dansemur@gmail.com?subject=' + encodeURIComponent('DDCS Studio Feedback / Bug Report') + '&body=' + encodeURIComponent(body);
    });

    // Profile import/export (JSON = settings + user variables)
    q('set_profile_export').addEventListener('click', () => { if (window.ddcsExportProfile) window.ddcsExportProfile(); });
    q('set_profile_import').addEventListener('click', () => { if (window.ddcsImportProfile) window.ddcsImportProfile(); });

    q('set_reset').addEventListener('click', () => {
        _ddcsSettings = JSON.parse(JSON.stringify(SETTINGS_DEFAULTS));
        saveSettings();
        fill();
    });
    q('set_done').addEventListener('click', closeSettings);
    ov.querySelector('.settings-close').addEventListener('click', closeSettings);
    ov.addEventListener('click', (e) => { if (e.target === ov) closeSettings(); });
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
