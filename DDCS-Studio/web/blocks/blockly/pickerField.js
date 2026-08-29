/**
 * blocks/blockly/pickerField.js — a searchable, MUST-MATCH picker field (BACKLOG #42 piece 6, the owner's own
 * general principle: "wherever we need an exact variable name don't allow typing… a search with dropdown
 * option or an actual dropdown"). Typing FILTERS the candidate list; it never commits a free value — these are
 * must-exist-now REFERENCES (BACKLOG #47's closed rung of the declare/reference ladder), not free text.
 *
 * Candidates are computed LIVE from the block's own workspace at popup-open time (never a separately-
 * maintained list, never stale) — `pickKind` (config, from `jsonDef()`, one of 'matchvar' | 'atomtype' |
 * 'whenparam') selects which enumeration `_candidates()` runs. ⭐ SUPERSEDES t1636's free-text decision for
 * `matchvar`/`atomType` (formField.js's own header comment records the owner's 2026-08-28 override) —
 * `formfieldMatchReport` (userOps.js) STAYS as the save-time backstop regardless: a picker prevents a TYPO,
 * not a var/param picked correctly here and later deleted elsewhere in the stack (dangling).
 *
 * Blockly 13.0.0. Reuses `Blockly.DropdownDiv` via `dropdownPopup.js`'s shared helper (the same field-popup
 * pattern `optionsEditorField.js` — piece 2's options editor — also rides), rather than `FieldDropdown`'s own
 * options-FUNCTION support: that gives a live per-instance list but not FILTER-AS-YOU-TYPE, which is the
 * actual ask ("a search with dropdown option") once a stack's own var/atom/param list runs past a handful.
 */
import { openFieldPopup } from './dropdownPopup.js';

const META_TYPES = new Set([
    'formfield', 'param_field', 'cam_field', 'cam_table', 'section', 'param_group',
    'panel', 'layout', 'sim', 'simstart', 'user_root', 'op', 'assign',
]);
const isRealAtomType = (t) => typeof t === 'string' && !META_TYPES.has(t) && !t.startsWith('user_') && !t.endsWith('_op');

export function installPickerField(Blockly) {
    const Size = Blockly.utils.Size;

    class FieldPicker extends Blockly.Field {
        constructor(value, validator, config) {
            super(value == null ? '' : String(value), validator, config);
            this.SERIALIZABLE = true;
            this.pickKind = (config && config.pickKind) || '';
            this.size_ = new Size(120, 24);
        }
        static fromJson(options) { return new FieldPicker(options.value, undefined, { ...options, pickKind: options.pickKind }); }

        doClassValidation_(v) { return v == null ? '' : String(v); }
        getText() { return this.getValue() || '(pick…)'; }
        isClickable() { return true; }

        /** Every candidate this picker's `pickKind` offers, read live from the SOURCE BLOCK's own workspace —
         *  "actually in this stack" (BACKLOG's own words), never a cached/stale list. */
        _candidates() {
            const blk = this.getSourceBlock();
            const ws = blk && blk.workspace;
            if (!ws) return [];
            const all = ws.getAllBlocks(false);
            if (this.pickKind === 'matchvar') {
                const vars = all.filter((b) => b.type === 'assign').map((b) => b.getFieldValue('VAR')).filter(Boolean);
                return [...new Set(vars)];
            }
            if (this.pickKind === 'atomtype') {
                const types = all.map((b) => b.type).filter(isRealAtomType);
                return [...new Set(types)];
            }
            if (this.pickKind === 'whenparam') {
                const params = all
                    .filter((b) => (b.type === 'formfield' || b.type === 'param_field') && b.id !== blk.id)
                    .map((b) => b.getFieldValue('PARAM')).filter(Boolean);
                return [...new Set(params)];
            }
            return [];
        }

        showEditor_() {
            openFieldPopup(this, (content, close) => {
                const candidates = this._candidates();
                const filterBox = document.createElement('input');
                filterBox.type = 'text'; filterBox.placeholder = 'filter…';
                filterBox.style.cssText = 'width:100%;box-sizing:border-box;margin-bottom:6px;padding:4px 6px;font:inherit;';
                const list = document.createElement('div');
                list.style.cssText = 'max-height:220px;overflow-y:auto;';
                const renderList = (q) => {
                    list.innerHTML = '';
                    const shown = candidates.filter((c) => !q || c.toLowerCase().includes(q.toLowerCase()));
                    if (!shown.length) {
                        const empty = document.createElement('div');
                        empty.textContent = candidates.length ? 'no match' : '(nothing in this stack yet)';
                        empty.style.cssText = 'opacity:.6;padding:4px 6px;'; list.appendChild(empty);
                    }
                    for (const c of shown) {
                        const row = document.createElement('div');
                        row.className = 'ddcs-picker-row';
                        row.textContent = c;
                        row.style.cssText = 'padding:5px 6px;cursor:pointer;border-radius:3px;';
                        row.addEventListener('mouseenter', () => { row.style.background = 'rgba(0,0,0,.08)'; });
                        row.addEventListener('mouseleave', () => { row.style.background = ''; });
                        row.addEventListener('mousedown', (e) => e.preventDefault());   // don't steal focus before the click lands
                        row.addEventListener('click', () => { this.setValue(c); close(); });
                        list.appendChild(row);
                    }
                };
                filterBox.addEventListener('input', () => renderList(filterBox.value));
                filterBox.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
                renderList('');
                content.appendChild(filterBox); content.appendChild(list);
                setTimeout(() => filterBox.focus(), 0);
            });
        }
        // No initView()/render_() override — the base `Blockly.Field`'s own default text rendering (the same
        // path `field_label` rides) already paints `getText()`; nothing custom to draw for a plain picker face.
    }

    try { Blockly.fieldRegistry.register('field_picker', FieldPicker); } catch (_) { /* already registered */ }
    return FieldPicker;
}
