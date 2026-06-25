/**
 * ui/userOpForm.js — the generic PARAM FORM for a user-defined op (the wizard-maker, authoring-flow step 5:
 * "clicking it opens a form showing only the declared params").
 *
 * User ops have no hand-written wizard view, so this is data-driven from the op's BINDINGS: one number input per
 * param (honoring label / units / range / default). On Insert it records the op + commits it into the program —
 * the same accumulate path a built-in wizard uses. v1 = number params.
 */
import { recordOp } from '../blocks/opRecord.js';
import { listUserOps } from '../blocks/userOps.js';

let _overlay = null;   // one form at a time

function close() {
    if (!_overlay) return;
    _overlay.remove();
    _overlay = null;
    document.removeEventListener('keydown', onKey);
}
function onKey(e) { if (e.key === 'Escape') close(); }

const toNum = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };

/** Open the generic insert form for a user-op def. */
export function openUserOpForm(def) {
    if (!def || !Array.isArray(def.bindings)) return;
    close();

    const overlay = document.createElement('div');
    overlay.className = 'uop-form-overlay';
    overlay.style.cssText = 'position:fixed; inset:0; z-index:9000; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,.45);';

    const box = document.createElement('div');
    box.className = 'uop-form';
    box.style.cssText = 'background:var(--panel,#11161d); color:var(--text,#e6edf3); border:1px solid var(--border,#2a3340); border-radius:10px; min-width:300px; max-width:92vw; padding:16px 18px; box-shadow:0 12px 40px rgba(0,0,0,.5);';

    const rows = def.bindings.map((b) => {
        const min = (b.min != null) ? ` min="${b.min}"` : '';
        const max = (b.max != null) ? ` max="${b.max}"` : '';
        const units = b.units ? ` <span style="opacity:.6">(${b.units})</span>` : '';
        return `<label style="display:flex; align-items:center; justify-content:space-between; gap:14px; margin:8px 0;">
            <span>${b.label || b.param}${units}</span>
            <input type="number" id="uop_field_${b.param}" data-param="${b.param}" value="${b.default ?? 0}" step="any"${min}${max}
                   style="width:120px; padding:5px 8px; background:var(--bg,#0b0f14); color:inherit; border:1px solid var(--border,#2a3340); border-radius:6px;"/>
        </label>`;
    }).join('');

    box.innerHTML = `<div style="font-weight:600; font-size:15px;">${def.label || def.opType}</div>
        <div style="opacity:.6; font-size:12px; margin-bottom:10px;">Custom op · set parameters</div>
        ${rows || '<div style="opacity:.6; margin:8px 0;">No parameters — inserts as-is.</div>'}
        <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:14px;">
            <button class="uop-cancel" style="padding:6px 14px; background:transparent; color:inherit; border:1px solid var(--border,#2a3340); border-radius:6px; cursor:pointer;">Cancel</button>
            <button class="uop-insert" style="padding:6px 14px; background:var(--accent,#3b82f6); color:#fff; border:none; border-radius:6px; cursor:pointer;">Insert</button>
        </div>`;

    overlay.appendChild(box);
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
    box.querySelector('.uop-cancel').addEventListener('click', close);
    box.querySelector('.uop-insert').addEventListener('click', async () => {
        const params = {};
        box.querySelectorAll('input[data-param]').forEach((inp) => {
            const b = def.bindings.find((x) => x.param === inp.dataset.param);
            params[inp.dataset.param] = toNum(inp.value, b ? b.default : 0);
        });
        recordOp(def.opType, params);                                      // make it the active op
        try { const { commitActiveOp } = await import('../blocks/opSession.js'); commitActiveOp(); }   // accumulate into the program
        catch (e) { console.warn('insert user op failed', e); }
        close();
    });

    document.body.appendChild(overlay);
    document.addEventListener('keydown', onKey);
    _overlay = overlay;
    const first = box.querySelector('input[data-param]');
    if (first) first.focus();
}

/** Surface hook: open the insert form for a user op by type (the wizard bar / dev panel calls this). */
export function insertUserOp(opType) {
    const def = listUserOps().find((d) => d.opType === opType);
    if (def) openUserOpForm(def);
}
