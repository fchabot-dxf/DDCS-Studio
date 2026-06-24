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
import { pushReturn } from './navReturn.js';   // register "return to this checklist" before deep-linking away

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
function gatewaySet() {
    // The header LED reflects live gateway reachability (gatewayStatus.js): .led-ok = a gateway is answering.
    try { return !!document.getElementById('gateway-led')?.classList.contains('led-ok'); } catch (_) { return false; }
}
// Save destination: a DELIBERATE choice. '' = not chosen → ⚠. local = done. cloud/both → also need a connection.
function saveDestState() {
    const dest = (getSettings().setup || {}).saveDest || '';
    if (!dest) return { ok: false, dest: '', needsCloud: false };
    if (dest === 'cloud' || dest === 'both') return { ok: getAccount().connected, dest, needsCloud: !getAccount().connected };
    return { ok: true, dest, needsCloud: false };   // local — durable (the app already writes .mjson files)
}

// ── Deep-links (reuse the existing patterns) ──────────────────────────────────
// Register "return to this checklist" then deep-link into Settings — closing Settings walks back here (see
// ui/navReturn.js). Call openSettings directly (Settings is a modal over the current view); going via
// showApp('settings') would fire a second, nav-less openSettings a microtask later and clobber the token.
const goSettings = (group, panel) => {
    const returnToken = pushReturn('Setup checklist', openSetupChecklist);
    window.openSettings && window.openSettings({ group, panel, returnToken });
};

const ITEMS = [
    { key: 'machine', label: 'Machine envelope', hint: 'Travel limits (X / Y / Z) for the sim.', detect: machineEnvelopeSet, set: () => goSettings('hardware', 'set_tab_machine') },
    { key: 'wcs',     label: 'WCS / work origin', hint: 'Where part-zero sits in the machine.', detect: wcsSet, set: () => goSettings('controller', 'set_tab_wcs') },
    { key: 'profile', label: 'Controller profile', hint: 'Which controller this machine is.', detect: profileSet, set: () => goSettings('controller', 'set_tab_profile') },
    { key: 'stock',   label: 'Stock', hint: 'The workpiece dimensions / shape.', detect: stockSet, set: async () => {
        // Stock is a visual setting — the popover is meant to float over the live 3D. From the checklist the preview
        // drawer may be closed, so open it (in the editor region) first, then float the Stock popover over it. Await
        // showApp so Studio is mounted before we open the drawer.
        try { await (window.showApp && window.showApp('studio')); } catch (_) { /* noop */ }
        try { window.setGcodeView && window.setGcodeView('3d'); } catch (_) { /* noop */ }
        window.ddcsOpenStock && window.ddcsOpenStock({ returnToken: pushReturn('Setup checklist', openSetupChecklist) });   // the ✕ returns to the checklist
    } },
    { key: 'tool',    label: 'Tool', hint: 'At least one tool in the tool table.', detect: toolSet, set: () => goSettings('hardware', 'set_tab_atc') },
    { key: 'probe',   label: 'Probe input', hint: 'Touch-probe pin (needed to simulate probing).', detect: probeSet, set: () => goSettings('hardware', 'set_tab_input'), optional: true },
    { key: 'gateway', label: 'Gateway', hint: 'Connect to a controller / bridge (live status, send, pull).', detect: gatewaySet, set: () => goSettings('controller', 'set_tab_gateway'), optional: true },
];

// ── Modal ─────────────────────────────────────────────────────────────────────
let _ov = null;

function close() { if (_ov) { _ov.remove(); _ov = null; } window.removeEventListener('ddcs:cloud-account', render); window.removeEventListener('ddcs:settings-changed', render); document.removeEventListener('ddcs:gateway-status', render); }

function render() {
    if (!_ov) return;
    const sd = saveDestState();
    // total / ready count — required items + save destination (probe is optional, counted only as a bonus row).
    const required = ITEMS.filter((i) => !i.optional);
    const optionalItems = ITEMS.filter((i) => i.optional);
    const reqOk = required.filter((i) => i.detect()).length;
    const total = required.length;   // only required items count toward "ready"; save destination + gateway + probe are optional

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
        <div class="sc-list">${required.map(row).join('')}</div>
        <div style="margin:11px 0 1px; font-size:10px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; color:#8a93a0;">Optional</div>
        <div class="sc-list">${optionalItems.map(row).join('')}${destRow}</div>
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
        if (key === 'connectcloud') { close(); window.openSettings && window.openSettings({ group: 'general', panel: 'set_tab_cloud', returnToken: pushReturn('Setup checklist', openSetupChecklist) }); return; }
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
    document.addEventListener('ddcs:gateway-status', render); // live-update the Gateway row when a connection lands
    render();
    window.ddcsTrack && window.ddcsTrack('feature', 'setup-checklist');
}

// ── First-run nudge: a MOMENTARY BUBBLE (not an upfront modal) ─────────────────────────────────────────────────
// An upfront health-check modal is premature friction. Instead, a small 10-second dismissible bubble that OPENS the
// full health check when clicked — a gentle, ignorable entry point. Hardware is still prompted just-in-time
// (wizardPrereq); this is just the "where am I" nudge.
let _bubble = null;
function dismissBubble() { if (_bubble) { clearTimeout(_bubble.timer); _bubble.el.remove(); _bubble = null; } }

export function showSetupBubble() {
    dismissBubble();
    const required = ITEMS.filter((i) => !i.optional);
    const reqOk = required.filter((i) => i.detect()).length;
    if (reqOk >= required.length) return;   // nothing to nudge about — everything required is set
    const b = document.createElement('div');
    b.className = 'setup-bubble';
    b.style.cssText = 'position:fixed; right:16px; bottom:16px; z-index:9000; display:flex; align-items:center; gap:10px;'
        + ' max-width:300px; padding:10px 12px; background:var(--panel,#161b22); color:var(--text-main,#e6ecf2);'
        + ' border:1px solid var(--border,#2a313b); border-left:3px solid var(--accent,#2d7ff9); border-radius:8px;'
        + ' box-shadow:0 8px 28px rgba(0,0,0,.45); font-size:12.5px; cursor:pointer; animation:setupBubbleIn .7s cubic-bezier(.22,1,.36,1);';
    b.innerHTML = `<span style="font-size:16px; color:#ffb454; line-height:1;">⚠</span>
        <span style="display:flex; flex-direction:column; gap:1px;">
            <b style="font-size:12.5px;">Setup health check</b>
            <span style="font-size:11px; color:#8a93a0;">${reqOk}/${required.length} ready — click to review</span>
        </span>
        <button class="sb-x" title="Dismiss" style="margin-left:6px; width:20px; height:20px; border:none; background:transparent; color:#8a93a0; font-size:13px; cursor:pointer; line-height:1;">✕</button>`;
    document.body.appendChild(b);
    _bubble = { el: b, timer: setTimeout(dismissBubble, 10000) };   // momentary: gone after 10s
    b.querySelector('.sb-x').addEventListener('click', (e) => { e.stopPropagation(); dismissBubble(); });
    b.addEventListener('click', () => { dismissBubble(); openSetupChecklist(); });   // click → full health check
    window.ddcsTrack && window.ddcsTrack('feature', 'setup-bubble');
}

// Called on load (index.html). Shows the bubble unless the user dismissed the checklist (Don't show again) — and
// never under automation, so it doesn't intercept the UI tests.
export function maybeAutoOpenSetupChecklist() {
    try { if (navigator.webdriver) return; } catch (_) { /* noop */ }
    try { if ((getSettings().setup || {}).dismissed) return; } catch (_) { /* noop */ }
    setTimeout(showSetupBubble, 1500);   // let the app settle (detectors/LED) before the nudge
}
window.ddcsShowSetupBubble = showSetupBubble;

window.openSetupChecklist = openSetupChecklist;
