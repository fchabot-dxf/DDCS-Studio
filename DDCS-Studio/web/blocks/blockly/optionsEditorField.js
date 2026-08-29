/**
 * blocks/blockly/optionsEditorField.js — a custom Blockly field: the OPTIONS EDITOR (BACKLOG #42 piece 2).
 *
 * Today `formfield.options`/`param_field.options` render as a bare DSL string ("Front Left=nn, Front Center=
 * cnp, …") — the owner's own complaint, from a real screenshot: "options just looks like coding". The face
 * here shows a compact summary ("N choices: Label, Label, …"); a click opens Label|Value rows with add/remove.
 *
 * ⭐⭐ STORAGE STAYS THE EXISTING STRING — this field's VALUE is still the same comma/newline-separated DSL
 * `parseParamOptions` (blocks/userOps.js) already reads, byte-for-byte; the editor reads it with that SAME
 * parser (never a second implementation to drift from it) and writes back through the SAME serialization shape
 * it already accepts (`Label=Value, …`). Zero migration, zero round-trip risk — only the EDITOR changed.
 *
 * Shares `dropdownPopup.js`'s field-popup pattern with `pickerField.js` (piece 6) — see that file's own header
 * for why (native positioning/dismiss via `Blockly.DropdownDiv`, without a second popup implementation).
 */
import { openFieldPopup } from './dropdownPopup.js';
import { parseParamOptions } from '../userOps.js';

/** `[[label,value], …]` -> the DSL string `parseParamOptions` reads back byte-identically. */
function serialize(rows) {
    return rows.filter((r) => r.label !== '' || r.value !== '').map((r) => `${r.label}=${r.value}`).join(', ');
}

export function installOptionsEditorField(Blockly) {
    const Size = Blockly.utils.Size;

    class FieldOptionsEditor extends Blockly.Field {
        constructor(value, validator, config) {
            super(value == null ? '' : String(value), validator, config);
            this.SERIALIZABLE = true;
            this.size_ = new Size(160, 24);
        }
        static fromJson(options) { return new FieldOptionsEditor(options.value, undefined, options); }

        doClassValidation_(v) { return v == null ? '' : String(v); }
        // t2389 — live-caught before shipping: `parseParamOptions(str, type)` defaults to NUMERIC parsing when
        // `type` is omitted (`numeric = type == null || …`), which SILENTLY DROPPED every non-numeric option
        // (a dropdown of string codes like `Front Left=nn` parsed to ZERO rows) — the sibling `TYPE` field
        // (read live, matching `paramFieldsFromStack`'s own resolution) must be threaded through everywhere
        // this field reads its own value, not just at editor-open time.
        _declType() { const blk = this.getSourceBlock(); return (blk && blk.getFieldValue && blk.getFieldValue('TYPE')) || 'number'; }
        getText() {
            const rows = parseParamOptions(this.getValue(), this._declType());
            if (!rows.length) return '(no choices)';
            const preview = rows.slice(0, 2).map((r) => r[0]).join(', ');
            return `${rows.length} choice${rows.length === 1 ? '' : 's'}: ${preview}${rows.length > 2 ? ', …' : ''}`;
        }
        isClickable() { return true; }

        showEditor_() {
            let rows = parseParamOptions(this.getValue(), this._declType()).map(([label, value]) => ({ label, value: String(value) }));
            if (!rows.length) rows = [{ label: '', value: '' }];

            openFieldPopup(this, (content, close) => {
                const list = document.createElement('div');
                const commit = () => { this.setValue(serialize(rows)); };
                const renderRows = () => {
                    list.innerHTML = '';
                    rows.forEach((r, i) => {
                        const row = document.createElement('div');
                        row.style.cssText = 'display:flex;gap:4px;margin-bottom:4px;align-items:center;';
                        const lbl = document.createElement('input'); lbl.type = 'text'; lbl.placeholder = 'Label'; lbl.value = r.label;
                        const val = document.createElement('input'); val.type = 'text'; val.placeholder = 'Value'; val.value = r.value;
                        for (const inp of [lbl, val]) inp.style.cssText = 'width:90px;padding:3px 5px;font:inherit;box-sizing:border-box;';
                        lbl.addEventListener('input', () => { r.label = lbl.value; commit(); });
                        val.addEventListener('input', () => { r.value = val.value; commit(); });
                        const rm = document.createElement('button'); rm.type = 'button'; rm.textContent = '✕';
                        rm.title = 'Remove this choice';
                        rm.style.cssText = 'cursor:pointer;border:none;background:transparent;font:inherit;';
                        rm.addEventListener('mousedown', (e) => e.preventDefault());
                        rm.addEventListener('click', () => { rows.splice(i, 1); if (!rows.length) rows.push({ label: '', value: '' }); commit(); renderRows(); });
                        row.appendChild(lbl); row.appendChild(val); row.appendChild(rm);
                        list.appendChild(row);
                    });
                };
                renderRows();
                const add = document.createElement('button'); add.type = 'button'; add.textContent = '+ add choice';
                add.style.cssText = 'cursor:pointer;border:none;background:transparent;font:inherit;padding:4px 0;text-align:left;';
                add.addEventListener('mousedown', (e) => e.preventDefault());
                add.addEventListener('click', () => { rows.push({ label: '', value: '' }); commit(); renderRows(); });
                const done = document.createElement('button'); done.type = 'button'; done.textContent = 'Done';
                done.style.cssText = 'cursor:pointer;margin-top:6px;padding:4px 10px;font:inherit;';
                done.addEventListener('click', () => close());
                content.appendChild(list); content.appendChild(add); content.appendChild(document.createElement('br')); content.appendChild(done);
            });
        }
        // No initView()/render_() override — the base `Blockly.Field`'s own default text rendering paints
        // `getText()`'s summary; nothing custom to draw for the collapsed face.
    }

    try { Blockly.fieldRegistry.register('field_optionseditor', FieldOptionsEditor); } catch (_) { /* already registered */ }
    return FieldOptionsEditor;
}
