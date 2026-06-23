/**
 * ui/setupChecklist.js — Setup health-check / first-run checklist.
 *
 * A small, DISMISSIBLE modal listing the minimum things needed for a good simulation. Each row is a ✓ (set) /
 * ⚠ (missing or still default) status with a "Set" button that deep-links to where you configure it (Settings
 * tab, Stock modal, Tool table). It appears automatically on first run (when key items are unset and the user
 * hasn't dismissed it), shows "N/total ready", and is reopenable any time from the header quick-menu — so it
 * doubles as a health check. Non-blocking: Skip/dismiss sets a persisted flag (settings.setup.dismissed); the
 * quick-menu entry always re-opens it (ignoring the flag).
 *
 * The save-destination row captures a DELIBERATE choice (Local / Cloud / Both) — it stays ⚠ until the user
 * actively picks (we never auto-default to Local). Cloud/Both self-verify against the existing cloud account
 * status (ui/cloudAccount.getAccount().connected). This pass only CAPTURES + persists the preference — wiring
 * save/load to honour it is a follow-up.
 */
import { getSettings, saveSettings, SETTINGS_DEFAULTS, libraryTools } from './settingsPanel.js';
import { getAccount } from './cloudAccount.js';

const PROFILE_KEY = 'ddcs_controller_profile';   // mirrors controllerProfiles.js — set ONLY when the user picks a profile

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ── Detectors ────────────────────────────────────────────────────────────────
// Each returns true when the item is considered SET (✓). HEURISTIC items (envelope, stock) compare against the
// shipped defaults — "still the factory value" reads as not-yet-configured. Flagged in the report.
function machineEnvelopeSet() {
    const m = getSettings().machine || {}, d = SETTINGS_DEFAULTS.machine;
    return !(Number(m.x) === d.x && Number(m.y) === d.y && Number(m.z) === d.z);
}
function wcsSet() {
    const m = getSettings().machine || {};
    const wo = m.workOrigin || {};
    if (Number(wo.x) || Number(wo.y) || Number(wo.z)) return true;          // active offset is non-zero
    const w = m.wcs || {}, row = Array.isArray(w.table) ? w.table[(w.active || 1) - 1] : null;
    return !!(row && (Number(row.x) || Number(row.y) || Number(row.z)));    // a populated active WCS row
}
function profileSet() {
    try { return !!localStorage.getItem(PROFILE_KEY); } catch (_) { return false; }   // explicitly chosen (not the silent default)
}
function stockSet() {
    const s = getSettings().stock || {}, d = SETTINGS_DEFAULTS.stock;
    return !(Number(s.x) === d.x && Number(s.y) === d.y && Number(s.z) === d.z && (s.shape || 'boss') === d.shape);
}
function toolSet() {
    return libraryTools(getSettings().atc).length > 0;
}
function probeSet() {
    const pin = (getSettings().probes || {}).probePin;
    return pin !== '' && pin != null && Number(pin) > 0;
}
// Save destination: a DELIBERATE choice. '' = not chosen → ⚠. local = done. cloud/both → also need a connection.
function saveDestState() {
    const dest = (getSettings().setup || {}).saveDest || '';
    if (!dest) return { ok: false, dest: '', needsCloud: false };
    if (dest === 'cloud' || dest === 'both') return { ok: getAccount().connected, dest, needsCloud: !getAccount().connected };
    return { ok: true, dest, needsCloud: false };   // local — durable (the app already writes .mjson files)
}

// ── Deep-links (reuse the existing patterns) ──────────────────────────────────
const goSettings = (group, panel) => { try { window.showApp && window.showApp('settings'); } catch (_) {} window.openSettings && window.openSettings({ group, panel }); };

const ITEMS = [
    { key: 'machine', label: 'Machine envelope', hint: 'Travel limits (X / Y / Z) for the sim.', detect: machineEnvelopeSet, set: () => goSettings('hardware', 'set_tab_machine') },
    { key: 'wcs',     label: 'WCS / work origin', hint: 'Where part-zero sits in the machine.', detect: wcsSet, set: () => goSettings('controller', 'set_tab_wcs') },
    { key: 'profile', label: 'Controller profile', hint: 'Which controller this machine is.', detect: profileSet, set: () => goSettings('controller', 'set_tab_profile') },
    { key: 'stock',   label: 'Stock', hint: 'The workpiece dimensions / shape.', detect: stockSet, set: () => { try { window.showApp && window.showApp('studio'); } catch (_) {} window.ddcsOpenStock && window.ddcsOpenStock(); } },
    { key: 'tool',    label: 'Tool', hint: 'At least one tool in the tool table.', detect: toolSet, set: () => goSettings('hardware', 'set_tab_atc') },
    { key: 'probe',   label: 'Probe input', hint: 'Touch-probe pin (optional, needed to simulate probing).', detect: probeSet, set: () => goSettings('hardware', 'set_tab_input'), optional: true },
];

// ── Modal ─────────────────────────────────────────────────────────────────────
let _ov = null;

function close() { if (_ov) { _ov.remove(); _ov = null; } window.removeEventListener('ddcs:cloud-account', render); window.removeEventListener('ddcs:settings-changed', render); }

function render() {
    if (!_ov) return;
    const sd = saveDestState();
    // total / ready count — required items + save destination (probe is optional, counted only as a bonus row).
    const required = ITEMS.filter((i) => !i.optional);
    const reqOk = required.filter((i) => i.detect()).length + (sd.ok ? 1 : 0);
    const total = required.length + 1;   // +1 for save destination

    const icon = (ok) => ok
        ? '<span style="color:#3ddc84; font-size:15px; width:18px; text-align:center;">✓</span>'
        : '<span style="color:#ffb454; font-size:15px; width:18px; text-align:center;">⚠</span>';
    const setBtn = (key) => `<button type="button" class="sc-set" data-set="${key}" style="margin-left:auto; padding:3px 12px; font-size:11px; background:var(--accent,#2d7ff9); color:#fff; border:none; border-radius:4px; cursor:pointer;">Set</button>`;

    const row = (it) => {
        const ok = it.detect();
        return `<div class="sc-row" style="display:flex; align-items:center; gap:9px; padding:7px 2px; border-bottom:1px solid rgba(255,255,255,.06);">
            ${icon(ok)}
            <span style="display:flex; flex-direction:column;"><b style="font-size:12.5px;">${esc(it.label)}${it.optional ? ' <span style="font-weight:400; color:#8a93a0; font-size:10px;">(optional)</span>' : ''}</b>
            <span style="font-size:10.5px; color:#8a93a0;">${esc(it.hint)}</span></span>
            ${ok ? '' : setBtn(it.key)}</div>`;
    };

    // Save-destination row: a 3-way picker (Local / Cloud / Both) that captures + persists the choice.
    const destChip = (v, label) => {
        const on = sd.dest === v;
        return `<button type="button" class="sc-dest" data-dest="${v}" style="padding:3px 11px; font-size:11px; border-radius:4px; cursor:pointer; border:1px solid ${on ? 'var(--accent,#2d7ff9)' : 'rgba(255,255,255,.18)'}; background:${on ? 'var(--accent,#2d7ff9)' : 'transparent'}; color:${on ? '#fff' : '#cfd6df'};">${label}</button>`;
    };
    const destRow = `<div class="sc-row" style="display:flex; align-items:flex-start; gap:9px; padding:8px 2px; border-bottom:1px solid rgba(255,255,255,.06);">
        ${icon(sd.ok)}
        <span style="display:flex; flex-direction:column; gap:6px; flex:1;">
            <b style="font-size:12.5px;">Save destination</b>
            <span style="font-size:10.5px; color:#8a93a0;">Where projects are kept. Pick one — this is your choice to make.</span>
            <div style="display:flex; gap:6px; margin-top:2px;">${destChip('local', 'Local')}${destChip('cloud', 'Cloud')}${destChip('both', 'Both')}</div>
            ${sd.needsCloud ? '<span class="sc-needcloud" style="font-size:10.5px; color:#ffb454;">⚠ Connect a cloud account to use Cloud / Both. <a href="#" data-set="connectcloud" style="color:var(--accent,#2d7ff9);">Connect…</a></span>' : ''}
        </span></div>`;

    const box = _ov.querySelector('.sc-box');
    box.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:4px;">
            <h2 style="margin:0; font-size:15px;">Setup checklist</h2>
            <span style="margin-left:auto; font-size:12px; color:#8a93a0;">${reqOk}/${total} ready</span>
            <button type="button" class="sc-close" title="Close" style="width:24px; height:24px; border:none; background:transparent; color:#cfd6df; font-size:16px; cursor:pointer;">✕</button>
        </div>
        <p style="margin:0 0 8px; font-size:11px; color:#8a93a0;">The minimum for a good simulation. Each ⚠ has a <b>Set</b> link.</p>
        <div class="sc-list">${ITEMS.map(row).join('')}${destRow}</div>
        <div style="display:flex; gap:8px; margin-top:12px; justify-content:flex-end;">
            <button type="button" class="sc-skip" style="padding:6px 14px; font-size:12px; background:transparent; color:#cfd6df; border:1px solid rgba(255,255,255,.18); border-radius:5px; cursor:pointer;">Don't show again</button>
            <button type="button" class="sc-done" style="padding:6px 18px; font-size:12px; background:var(--accent,#2d7ff9); color:#fff; border:none; border-radius:5px; cursor:pointer;">Done</button>
        </div>`;

    box.querySelector('.sc-close').onclick = close;
    box.querySelector('.sc-done').onclick = close;
    box.querySelector('.sc-skip').onclick = () => {
        const s = getSettings(); s.setup = s.setup || {}; s.setup.dismissed = true; saveSettings();
        close();
    };
    box.querySelectorAll('.sc-set').forEach((b) => b.onclick = () => {
        const key = b.dataset.set;
        if (key === 'connectcloud') { close(); window.openSettings && (window.showApp && window.showApp('settings'), window.openSettings({ group: 'general', panel: 'set_tab_cloud' })); return; }
        const it = ITEMS.find((i) => i.key === key);
        close();
        if (it) it.set();
    });
    box.querySelectorAll('.sc-dest').forEach((b) => b.onclick = () => {
        const s = getSettings(); s.setup = s.setup || {}; s.setup.saveDest = b.dataset.dest; saveSettings();
        render();   // re-render: update the ✓/⚠ + the cloud-connect hint
    });
}

export function openSetupChecklist() {
    if (_ov) { render(); return; }
    _ov = document.createElement('div');
    _ov.className = 'setup-checklist-overlay';
    _ov.style.cssText = 'position:fixed; inset:0; z-index:10060; background:rgba(0,0,0,.55); display:flex; align-items:center; justify-content:center;';
    _ov.innerHTML = `<div class="sc-box" style="width:min(440px,94vw); background:var(--panel,#161b22); color:var(--text-main,#e6ecf2); border:1px solid var(--border,#2a313b); border-radius:10px; padding:16px 18px; box-shadow:0 14px 40px rgba(0,0,0,.6);"></div>`;
    document.body.appendChild(_ov);
    _ov.addEventListener('click', (e) => { if (e.target === _ov) close(); });
    window.addEventListener('ddcs:cloud-account', render);    // live-update the cloud-gated save-destination row
    window.addEventListener('ddcs:settings-changed', render); // live-update ✓/⚠ if something gets set elsewhere
    render();
    window.ddcsTrack && window.ddcsTrack('feature', 'setup-checklist');
}

// First run / health check: auto-open once when the user hasn't dismissed it AND a required item is still unset.
export function maybeAutoOpenSetupChecklist() {
    // Skip the auto-nag under automation (Playwright sets navigator.webdriver) so the first-run overlay doesn't
    // intercept clicks in the existing UI tests; it's still openable via window.openSetupChecklist() / the menu.
    try { if (navigator.webdriver) return; } catch (_) {}
    const s = getSettings();
    if (s.setup && s.setup.dismissed) return;
    const required = ITEMS.filter((i) => !i.optional);
    const allReqOk = required.every((i) => i.detect()) && saveDestState().ok;
    if (allReqOk) return;   // nothing to nag about
    openSetupChecklist();
}

window.openSetupChecklist = openSetupChecklist;
