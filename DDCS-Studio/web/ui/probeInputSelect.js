/**
 * ui/probeInputSelect.js — wizard "Probe input" picker (stage 3b).
 *
 * Each probe wizard (corner / middle / edge / alignment) used to ask the user to re-type the probe
 * INPUT PORT (P) and LEVEL (L). Now those come from the single source of truth — Settings → Hardware →
 * Input. This module, at runtime: hides each wizard's raw P/L fields (kept in the DOM so the generators
 * still read `#X_port` / `#X_level` unchanged) and injects a "Probe input" dropdown listing the configured
 * probe-type inputs; picking one writes its pin → `X_port` and level → `X_level`. STOP (Q) is untouched.
 *
 * Re-runs on `ddcs:settings-changed` so adding/editing a probe input in Settings updates the dropdowns.
 */
import { getInputs } from './settingsPanel.js';

const WIZARDS = [['c_port', 'c_level'], ['m_port', 'm_level'], ['p_port', 'p_level'], ['al_port', 'al_level']];
const PROBE_TYPES = ['probe', 'touch', 'setter'];

function ensureDropdown(portId, levelId) {
    const port = document.getElementById(portId), lvl = document.getElementById(levelId);
    if (!port || !lvl) return null;
    const portDiv = port.closest('div'), lvlDiv = lvl.closest('div');
    if (portDiv) portDiv.style.display = 'none';   // raw P/L kept in DOM (generators read them), just hidden
    if (lvlDiv) lvlDiv.style.display = 'none';
    const selId = portId.replace('_port', '_probe_input');
    let sel = document.getElementById(selId);
    if (!sel) {
        const div = document.createElement('div');
        div.style.gridColumn = 'span 2';   // take the room freed by hiding INPUT PORT + LEVEL, so the wide dropdown
                                           // doesn't overflow its single column and overlap STOP (Q)
        div.innerHTML = '<span class="label">PROBE INPUT</span>';
        sel = document.createElement('select');
        sel.id = selId;
        sel.title = 'Which configured probe input to use — pin + level come from Settings → Hardware → Input.';
        sel.style.minWidth = '0';
        sel.style.width = '100%';
        div.appendChild(sel);
        if (portDiv && portDiv.parentNode) portDiv.parentNode.insertBefore(div, portDiv);
    }
    return sel;
}

function applyToFields(sel, portId, levelId) {
    const opt = sel.selectedOptions[0];
    if (!opt || opt.value === '') return;
    const port = document.getElementById(portId), lvl = document.getElementById(levelId);
    if (port) port.value = opt.value;
    if (lvl) lvl.value = opt.dataset.level || '0';
}

function fill(sel, portId, levelId) {
    const probes = getInputs().filter(i => PROBE_TYPES.includes(i.type) && i.pin !== '' && i.pin != null);
    const prev = sel.value;
    sel.innerHTML = probes.length
        ? probes.map(i => `<option value="${i.pin}" data-level="${i.level || 0}">${i.label || i.type} (pin ${i.pin})</option>`).join('')
        : '<option value="">— add a probe input in Settings —</option>';
    if (prev && [...sel.options].some(o => o.value === prev)) sel.value = prev;
    applyToFields(sel, portId, levelId);
    sel.onchange = () => applyToFields(sel, portId, levelId);
}

export function initProbeInputSelects() {
    const run = () => WIZARDS.forEach(([p, l]) => { const sel = ensureDropdown(p, l); if (sel) fill(sel, p, l); });
    run();
    window.addEventListener('ddcs:settings-changed', run);
}
