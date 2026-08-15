/**
 * ui/userOpForm.js — the generic PARAM FORM for a user-defined op (the wizard-maker insert form).
 *
 * A custom op has no hand-written wizard view, so this form is data-driven from the op's BINDINGS — one WIDGET per
 * binding, from the form-widget registry (ui/formWidgets.js): number by default, or a richer widget (slider /
 * dropdown / toggle / … and, later, canvas pickers) when the binding declares one. On Insert it reads every
 * widget's value, records the op + commits it into the program — the same accumulate path a built-in wizard uses.
 */
import { recordOp } from '../blocks/opRecord.js';
import { listUserOps } from '../blocks/userOps.js';
import { renderOpForm, formBindings } from './formWidgets.js';   // S5.2 — formBindings consumes the def's param_field rows when present (else the bindings, unchanged)

let _overlay = null;   // one form at a time

function close() {
    if (!_overlay) return;
    _overlay.remove();
    _overlay = null;
    document.removeEventListener('keydown', onKey);
}
function onKey(e) { if (e.key === 'Escape') close(); }

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

    const head = document.createElement('div');
    head.innerHTML = `<div style="font-weight:600; font-size:15px;">${def.label || def.opType}</div>
        <div style="opacity:.6; font-size:12px; margin-bottom:10px;">Custom operation · set parameters</div>`;
    box.appendChild(head);

    // one WIDGET per UNIT (the form half of the widget library) — shared with the panel view via renderOpForm.
    let readers = [];
    if (def.bindings.length) {
        readers = renderOpForm(box, formBindings(def));   // S5.2 — param_field rows drive the form when present; else byte-identical
    } else {
        const none = document.createElement('div');
        none.style.cssText = 'opacity:.6; margin:8px 0;';
        none.textContent = 'No parameters — inserts as-is.';
        box.appendChild(none);
    }

    const foot = document.createElement('div');
    foot.style.cssText = 'display:flex; gap:8px; justify-content:flex-end; margin-top:14px;';
    const cancel = document.createElement('button');
    cancel.className = 'uop-cancel'; cancel.textContent = 'Cancel';
    cancel.style.cssText = 'padding:6px 14px; background:transparent; color:inherit; border:1px solid var(--border,#2a3340); border-radius:6px; cursor:pointer;';
    cancel.addEventListener('click', close);
    const insert = document.createElement('button');
    insert.className = 'uop-insert'; insert.textContent = 'Insert';
    insert.style.cssText = 'padding:6px 14px; background:var(--accent,#3b82f6); color:#fff; border:none; border-radius:6px; cursor:pointer;';
    insert.addEventListener('click', async () => {
        const params = {};
        for (const read of readers) { try { Object.assign(params, read()); } catch (_) { /* skip a broken widget */ } }
        recordOp(def.opType, params);                                      // make it the active op
        try { const { commitActiveOp } = await import('../blocks/opSession.js'); commitActiveOp(); }   // accumulate into the program
        catch (e) { console.warn('insert user op failed', e); }
        close();
    });
    foot.append(cancel, insert);
    box.appendChild(foot);

    overlay.appendChild(box);
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
    document.addEventListener('keydown', onKey);
    _overlay = overlay;
    const first = box.querySelector('input, select');
    if (first) first.focus();
}

/** Surface hook: open the insert form for a user op by type (the wizard bar / dev panel calls this). */
export function insertUserOp(opType) {
    const def = listUserOps().find((d) => d.opType === opType);
    if (def) openUserOpForm(def);
}
