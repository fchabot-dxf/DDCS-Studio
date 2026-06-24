/**
 * ui/wizardPrereq.js — Just-in-time hardware prompt for wizards.
 *
 * Some wizards only make sense once the matching hardware exists: the touch-probe wizards need a configured
 * probe input; the ATC wizards need a tool changer added. Rather than nag with an upfront checklist, we gate
 * at the moment of need — when a wizard that REQUIRES hardware is opened and that hardware isn't configured,
 * show a small NON-BLOCKING prompt that offers to add the part (deep-link to Settings → Hardware where +Add
 * lives) with an "Open anyway" escape. The gate is a thin pass-through when the hardware is present.
 *
 * Wired from WizardManager.open(): it asks needsPrereqPrompt(type); if there's an unmet prereq it shows the
 * prompt and returns true so open() bails. "Open anyway" re-opens via window.openWiz(type, variant, true) — the
 * bypass flag skips the gate.
 */
import { getSettings } from './settingsPanel.js';

// Which wizards require which hardware. Anything not listed (warm-up / comm / wcs / homing / mill cutting) is
// ungated — it opens straight through.
const PROBE_WIZARDS = ['corner', 'edge', 'middle', 'alignment', 'rotary_center', 'rotary_clock'];
const ATC_WIZARDS = ['atc_length', 'atc_check', 'atc_change', 'atc_table', 'atc_test'];

// "Is it configured" — reuse the same logic the setup checklist uses.
//   probe: probes.probePin > 0 (mirrors setupChecklist.probeSet()).
//   ATC:   hardwareTabs.atc === true — the flag the "+ Add tool changer (ATC)" button sets (settingsPanel
//          addSubsystem('atc')). NOT a starter tool library, which exists by default.
function probeConfigured() {
    const pin = (getSettings().probes || {}).probePin;
    return pin !== '' && pin != null && Number(pin) > 0;
}
function atcConfigured() {
    return (getSettings().hardwareTabs || {}).atc === true;
}

// Per-kind prompt copy + deep-link target. `addBtnId` (when present) is clicked after the deep-link so the
// user lands with +Add already triggered (ATC). Probe has no single +Add button (the Input table's add control
// is dynamic) — we just land on the Input tab where it's the obvious next action.
const KINDS = {
    probe: {
        configured: probeConfigured,
        line: "This wizard needs a touch probe, which isn't set up yet.",
        panel: 'set_tab_input',
    },
    atc: {
        configured: atcConfigured,
        line: "This wizard needs an ATC (tool changer), which isn't set up yet.",
        panel: 'set_tab_atc',
        addBtnId: 'set_atc_add_btn',
    },
};

function kindFor(type) {
    if (PROBE_WIZARDS.includes(type)) return 'probe';
    if (ATC_WIZARDS.includes(type)) return 'atc';
    return null;
}

// Same deep-link pattern as setupChecklist.goSettings: switch to the Settings view, then openSettings({group,panel}).
function goHardware(panel, addBtnId) {
    try { window.showApp && window.showApp('settings'); } catch (_) { /* noop */ }
    window.openSettings && window.openSettings({ group: 'hardware', panel });
    if (addBtnId) {
        // Let the panel render, then trigger its +Add so the user lands on the add flow.
        setTimeout(() => { const b = document.getElementById(addBtnId); if (b && b.style.display !== 'none') b.click(); }, 80);
    }
}

let _ov = null;
function close() { if (_ov) { _ov.remove(); _ov = null; } }

/**
 * If `type` needs hardware that isn't configured, show the prompt and return true (caller should NOT open).
 * Otherwise return false (open normally). `bypass` (the "Open anyway" re-entry) always returns false.
 */
export function needsPrereqPrompt(type, variant, bypass) {
    if (bypass) return false;
    // Skip under automation (Playwright sets navigator.webdriver) so the just-in-time prompt doesn't intercept
    // the many UI tests that drive probe/ATC wizards directly — same precedent as the setup-checklist auto-nag.
    // A test can force the gate on (to verify it) by setting window.__ddcsForceWizPrereq = true.
    try { if (navigator.webdriver && !window.__ddcsForceWizPrereq) return false; } catch (_) { /* noop */ }
    const kind = kindFor(type);
    if (!kind) return false;
    const k = KINDS[kind];
    if (k.configured()) return false;   // hardware present → thin pass-through
    showPrompt(type, variant, k);
    return true;
}

function showPrompt(type, variant, k) {
    close();
    _ov = document.createElement('div');
    _ov.className = 'wiz-prereq-overlay';
    _ov.style.cssText = 'position:fixed; inset:0; z-index:10070; background:rgba(0,0,0,.55); display:flex; align-items:center; justify-content:center;';
    _ov.innerHTML = `<div class="wp-box" style="width:min(380px,92vw); background:var(--panel,#161b22); color:var(--text-main,#e6ecf2); border:1px solid var(--border,#2a313b); border-radius:10px; padding:16px 18px; box-shadow:0 14px 40px rgba(0,0,0,.6);">
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
            <h2 style="margin:0; font-size:15px;">Hardware needed</h2>
            <button type="button" class="wp-close" title="Cancel" style="margin-left:auto; width:24px; height:24px; border:none; background:transparent; color:#cfd6df; font-size:16px; cursor:pointer;">✕</button>
        </div>
        <p style="margin:0 0 14px; font-size:12.5px; color:#c2c9d2;">${k.line}</p>
        <div style="display:flex; gap:8px; justify-content:flex-end;">
            <button type="button" class="wp-anyway" style="padding:6px 14px; font-size:12px; background:transparent; color:#cfd6df; border:1px solid rgba(255,255,255,.18); border-radius:5px; cursor:pointer;">Open anyway</button>
            <button type="button" class="wp-add" style="padding:6px 18px; font-size:12px; background:var(--accent,#2d7ff9); color:#fff; border:none; border-radius:5px; cursor:pointer;">Add it</button>
        </div></div>`;
    document.body.appendChild(_ov);
    _ov.addEventListener('click', (e) => { if (e.target === _ov) close(); });
    const box = _ov.querySelector('.wp-box');
    box.querySelector('.wp-close').onclick = close;
    box.querySelector('.wp-add').onclick = () => { close(); goHardware(k.panel, k.addBtnId); };
    box.querySelector('.wp-anyway').onclick = () => { close(); if (window.openWiz) window.openWiz(type, variant, true); };
}
