/**
 * ui/visibilityModal.js — the PREVIEW VISIBILITY modal (t738). A floating in-app popover (the stock-editor pattern:
 * fixed, live-applied edits, a primary [Done]) opened from any preview's toolbar 👁 button. It lists the ONE declared
 * element registry (displayPrefs) — each row a visible toggle + an alpha slider — and writes back through
 * setDisplayElement, which notifies every mounted panel to re-apply LIVE. Prefs persist app-wide (localStorage, like the
 * theme). ONE source: no per-panel duplicate switches.
 */
import { DISPLAY_ELEMENTS, getDisplay, setDisplayElement, resetDisplay } from '../viz/displayPrefs.js';

let _pop = null;
const _onKey = (e) => { if (e.key === 'Escape') closeVisibilityModal(); };

export function closeVisibilityModal() {
    if (_pop) { _pop.remove(); _pop = null; document.removeEventListener('keydown', _onKey); }
}

export function toggleVisibilityModal(anchor) {
    if (_pop) { closeVisibilityModal(); return; }
    openVisibilityModal(anchor);
}

function rowsHtml() {
    const st = getDisplay();
    return DISPLAY_ELEMENTS.map((e) => `
        <div class="vis-row" data-id="${e.id}">
            <label class="vis-tog"><input type="checkbox" data-vis ${st[e.id].visible ? 'checked' : ''}><span>${e.label}</span></label>
            <input type="range" class="vis-alpha" data-alpha min="0" max="1" step="0.05" value="${st[e.id].alpha}" title="opacity" aria-label="${e.label} opacity">
        </div>`).join('');
}

export function openVisibilityModal(anchor) {
    closeVisibilityModal();
    const pop = document.createElement('div');
    pop.className = 'vis-modal-pop';
    pop.setAttribute('role', 'dialog');
    pop.style.cssText = 'position:fixed; left:50%; top:10%; transform:translateX(-50%); z-index:10050;'
        + 'background:rgba(20,22,28,0.98); border:1px solid rgba(255,255,255,0.14); border-radius:8px;'
        + 'padding:12px 14px; min-width:260px; max-height:82vh; overflow-y:auto; box-shadow:0 10px 34px rgba(0,0,0,0.55);'
        + 'font-size:13px; color:var(--text,#e6edf5);';
    pop.innerHTML = `<div class="vis-head" style="font-weight:700; margin-bottom:8px; opacity:.9">Show in preview</div>`
        + `<div class="vis-rows">${rowsHtml()}</div>`
        + `<div class="vis-foot" style="display:flex; justify-content:space-between; gap:8px; margin-top:10px; padding-top:9px; border-top:1px solid rgba(255,255,255,0.1)">`
        + `<button type="button" data-reset class="toolbar-btn settings-io" style="font-size:12px">Reset</button>`
        + `<button type="button" data-done class="primary" style="padding:5px 18px; font-size:13px">Done</button></div>`;
    document.body.appendChild(pop);

    pop.querySelectorAll('.vis-row').forEach((row) => {
        const id = row.dataset.id;
        row.querySelector('[data-vis]').addEventListener('change', (e) => setDisplayElement(id, { visible: e.target.checked }));
        row.querySelector('[data-alpha]').addEventListener('input', (e) => setDisplayElement(id, { alpha: parseFloat(e.target.value) }));
    });
    pop.querySelector('[data-reset]').addEventListener('click', () => { resetDisplay(); pop.querySelector('.vis-rows').innerHTML = rowsHtml(); wireRows(pop); });
    pop.querySelector('[data-done]').addEventListener('click', closeVisibilityModal);
    document.addEventListener('keydown', _onKey);
    _pop = pop;
}

// Re-bind row handlers after a Reset re-renders them.
function wireRows(pop) {
    pop.querySelectorAll('.vis-row').forEach((row) => {
        const id = row.dataset.id;
        row.querySelector('[data-vis]').addEventListener('change', (e) => setDisplayElement(id, { visible: e.target.checked }));
        row.querySelector('[data-alpha]').addEventListener('input', (e) => setDisplayElement(id, { alpha: parseFloat(e.target.value) }));
    });
}
