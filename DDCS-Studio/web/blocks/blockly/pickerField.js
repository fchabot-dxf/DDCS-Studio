/**
 * blocks/blockly/pickerField.js — a searchable picker field (BACKLOG #42 piece 6, the owner's own general
 * principle: "wherever we need an exact variable name don't allow typing… a search with dropdown option or an
 * actual dropdown"). Typing FILTERS the candidate list.
 *
 * TWO MODES, per BACKLOG #47's own declare/reference ladder — the SAME field expresses both, config-selected:
 *   MUST-MATCH (`allowNew` unset/false) — typing never commits a free value; these are must-exist-now
 *     REFERENCES (`matchvar`/`atomtype`/`whenparam` — a reference to a thing that does not exist is ALWAYS a
 *     mistake, #42's own closed rung, unchanged).
 *   FORWARD-AUTHORABLE (`allowNew: true`) — typing ALSO commits directly (Enter, or a "+ use …" row) even
 *     with no candidate match: a goto/ifgoto/confirm/hmiconfirm/probecheck TARGET may legitimately name a
 *     label placed LATER in the stack — "people place the jump before the label" (BACKLOG's own words) — so
 *     forbidding an unmatched value would forbid ordinary authoring order, not just typos. `gotoTargetReport`
 *     (userOps.js) is the save-time backstop for THIS mode — nets a target that's still unmatched once the
 *     whole stack is built, the same shape `formfieldMatchReport` already established for var/param refs.
 *
 * Candidates are computed LIVE from the block's own workspace at popup-open time (never a separately-
 * maintained list, never stale) — `pickKind` (config, from `jsonDef()`, one of 'matchvar' | 'atomtype' |
 * 'whenparam' | 'label') selects which enumeration `_candidates()` runs. ⭐ SUPERSEDES t1636's free-text
 * decision for `matchvar`/`atomType` (formField.js's own header comment records the owner's 2026-08-28
 * override) — `formfieldMatchReport` (userOps.js) STAYS as the save-time backstop regardless: a picker
 * prevents a TYPO, not a var/param picked correctly here and later deleted elsewhere in the stack (dangling).
 *
 * Blockly 13.0.0. Reuses `Blockly.DropdownDiv` via `dropdownPopup.js`'s shared helper (the same field-popup
 * pattern `optionsEditorField.js` — piece 2's options editor — also rides), rather than `FieldDropdown`'s own
 * options-FUNCTION support: that gives a live per-instance list but not FILTER-AS-YOU-TYPE, which is the
 * actual ask ("a search with dropdown option") once a stack's own var/atom/param list runs past a handful.
 */
import { openFieldPopup } from './dropdownPopup.js';
import { getToolLibrary } from '../../wizards/toolPicker.js';   // t2453 (BACKLOG #47 tier 2) — settings.atc.tools[], the SAME source formWidgets.js's own tool-library picker reads
import { getOutputs, getInputs } from '../../ui/settingsPanel.js';   // t2453 (BACKLOG #47 tier 2) — settings.outputs/inputs[], the SAME source formWidgets.js's own declared-I/O picker reads

const META_TYPES = new Set([
    'formfield', 'param_field', 'cam_field', 'cam_table', 'section', 'param_group',
    'feature_canvas', 'layout', 'sim', 'preview3d', 'simstart', 'user_root', 'op', 'assign',
]);   // t2511 — preview3d: the 3D-only half of the sim/panel split; t2515 — 'panel' renamed 'feature_canvas'
// t2665 (gap 10) — WHY 'assign' sits in this list even though it (unlike every other entry) emits real G-code:
// it already has its OWN purpose-built reference path ('matchvar' above, a few lines up), which disambiguates by
// the block's own VAR VALUE. Op Param's atomtype match is coarser -- deriveBindings.matches({type}) alone
// requires the picked type be the SOLE block of that type in the stack, throwing on ambiguity else. That holds
// fine for progstart/progend/most real op atoms (typically singletons per stack) but breaks immediately for
// assign, which routinely appears 2+ times in any wizard writing more than one variable -- offering it through
// atomtype too would be a second, WORSE path to the same target (ambiguity-prone) rather than a missing one.
// DELIBERATE, confirmed against this list's own origin (t2389, the commit that introduced pickerField.js/
// META_TYPES) -- 'assign' was present from the very first version, never added or removed since.
const isRealAtomType = (t) => typeof t === 'string' && !META_TYPES.has(t) && !t.startsWith('user_') && !t.endsWith('_op');

export function installPickerField(Blockly) {
    const Size = Blockly.utils.Size;

    class FieldPicker extends Blockly.Field {
        constructor(value, validator, config) {
            super(value == null ? '' : String(value), validator, config);
            this.SERIALIZABLE = true;
            this.pickKind = (config && config.pickKind) || '';
            this.allowNew = !!(config && config.allowNew);
            this.pinKind = (config && config.pinKind) || 'output';   // t2453 — which of settings.inputs/outputs a 'pin' picker reads
            this.size_ = new Size(120, 24);
        }
        static fromJson(options) { return new FieldPicker(options.value, undefined, { ...options, pickKind: options.pickKind, allowNew: options.allowNew, pinKind: options.pinKind }); }

        doClassValidation_(v) { return v == null ? '' : String(v); }
        // t2453 (BACKLOG #47 tier 2) — TOOL/PIN get the same visible TRAFFIC-LIGHT suffix comboField.js's own
        // 'var' kind already established (never a gate — the value commits regardless, this only decorates the
        // face): a value not found among the LIVE candidates (settings.atc.tools[] / settings.inputs|outputs[])
        // reads as legitimately uncatalogued machine config, not a typo, so the wording says "not in your
        // table"/"not a declared pin", never "invalid".
        getText() {
            const v = this.getValue();
            if (!v) return this.allowNew ? '(pick or type…)' : '(pick…)';
            if (this.pickKind === 'tool' || this.pickKind === 'pin') {
                const known = this._candidates().some((c) => String((c && typeof c === 'object') ? c.value : c) === String(v));
                if (!known) return `${v}  ⚠ ${this.pickKind === 'tool' ? 'not in your tool table' : 'not a declared I/O pin'}`;
            }
            return v;
        }
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
            // t2585 (BACKLOG #61 follow-up) — `relTo`: every `simstart` block's own declared `id` in this stack
            // (the row a `relToRow` field may name) — same live-stack-derived, string-candidate shape as
            // `whenparam` just above (a formfield/param_field's own PARAM), just a different source block type.
            if (this.pickKind === 'relTo') {
                const ids = all.filter((b) => b.type === 'simstart').map((b) => b.getFieldValue('ID')).filter(Boolean);
                return [...new Set(ids)];
            }
            if (this.pickKind === 'label') {
                // t2395 — `label.n` is a VALUE SOCKET (a numeric input, `fieldKind()` classifies a numeric
                // default as 'value'), not a Field on the label block itself — `getFieldValue('N')` on the
                // label block returns nothing. The number lives on the connected `math_number` shadow's own
                // NUM field (the same shape `devMode.js`'s `writeAuthoredValue` already reads/writes for a
                // value-socket target).
                const labels = all.filter((b) => b.type === 'label').map((b) => {
                    const inp = b.getInput('N');
                    const tgt = inp && inp.connection && inp.connection.targetBlock();
                    return tgt ? tgt.getFieldValue('NUM') : null;
                }).filter((v) => v != null && v !== '');
                return [...new Set(labels)];
            }
            // t2453 (BACKLOG #47 tier 2) — MACHINE-DECLARED sources (not stack-derived, unlike every kind
            // above): candidates are {value,label} objects here — showEditor_() below normalizes both shapes,
            // so the existing plain-string kinds above are untouched.
            if (this.pickKind === 'tool') {
                let lib = [];
                try { lib = getToolLibrary(); } catch (_) { /* no settings yet */ }
                return (lib || []).map((t) => ({ value: String(t.num), label: t.label }));
            }
            if (this.pickKind === 'pin') {
                let rows = [];
                try { rows = this.pinKind === 'input' ? getInputs() : getOutputs(); } catch (_) { /* no settings yet */ }
                return (rows || []).filter((r) => r && r.pin !== '' && r.pin != null)
                    .map((r) => ({ value: String(r.pin), label: `${r.label || r.type} (pin ${r.pin})` }));
            }
            // t2453 (BACKLOG #47 tier 3) — flip.setup: CLOSED (this.allowNew stays false — no config passes it
            // true), same live-stack-derived shape as 'label' above: every `setup` block's own `index`, read off
            // its value-socket shadow (setup.index defaults to a NUMBER, so fieldKind() classifies it 'value' —
            // the same value-socket shape label.n has, not a plain Field).
            if (this.pickKind === 'setup') {
                const setups = all.filter((b) => b.type === 'setup').map((b) => {
                    const inp = b.getInput('INDEX');
                    const tgt = inp && inp.connection && inp.connection.targetBlock();
                    return tgt ? tgt.getFieldValue('NUM') : null;
                }).filter((v) => v != null && v !== '');
                return [...new Set(setups)];
            }
            return [];
        }

        showEditor_() {
            openFieldPopup(this, (content, close) => {
                // t2453 (BACKLOG #47 tier 2) — MACHINE-DECLARED kinds (tool/pin) return {value,label} objects
                // (the label reads "T3 · 6mm endmill" / "Coolant (pin 8)"; the committed value is the bare
                // number the emit expects) — normalized here so every kind below stays byte-identical for the
                // plain-string ones (matchvar/atomtype/whenparam/label/setup), which never had this shape.
                const candidates = this._candidates().map((c) => (c && typeof c === 'object') ? c : { value: c, label: c });
                const filterBox = document.createElement('input');
                filterBox.type = 'text'; filterBox.placeholder = this.allowNew ? 'filter, or type a new number…' : 'filter…';
                filterBox.style.cssText = 'width:100%;box-sizing:border-box;margin-bottom:6px;padding:4px 6px;font:inherit;';
                const list = document.createElement('div');
                list.style.cssText = 'max-height:220px;overflow-y:auto;';
                const commit = (v) => { this.setValue(v); close(); };
                const renderList = (q) => {
                    list.innerHTML = '';
                    const shown = candidates.filter((c) => !q || String(c.label).toLowerCase().includes(String(q).toLowerCase()));
                    if (!shown.length) {
                        const empty = document.createElement('div');
                        const emptyStackMsg = (this.pickKind === 'tool') ? '(no tools in your library yet)'
                            : (this.pickKind === 'pin') ? '(no pins declared yet — see Settings)'
                            // t2539 (BACKLOG #71) — measured cost: this picker's own target atom not existing
                            // YET is the single largest reducible chunk of the from-scratch build's own action
                            // count (t2537). Free fix — no mechanism change, just naming the ordering an author
                            // hits live, right where they hit it, instead of only in a WORK-LOG nobody authoring
                            // a wizard will ever open.
                            : (this.pickKind === 'atomtype') ? '(place the atom block this field should bind to FIRST, then come back)'
                            : (this.pickKind === 'relTo') ? '(place a sim start block and give it an id first)'
                            : '(nothing in this stack yet)';
                        // atomtype's own "no match" is the SAME actionable advice as "nothing at all" — a
                        // typed filter matching none of the atom types already on canvas overwhelmingly means
                        // the specific one wanted isn't placed yet either, not a typo worth a bare "no match".
                        empty.textContent = (candidates.length && this.pickKind !== 'atomtype') ? 'no match' : emptyStackMsg;
                        empty.style.cssText = 'opacity:.6;padding:4px 6px;'; list.appendChild(empty);
                    }
                    for (const c of shown) {
                        const row = document.createElement('div');
                        row.className = 'ddcs-picker-row';
                        row.textContent = c.label;
                        row.style.cssText = 'padding:5px 6px;cursor:pointer;border-radius:3px;';
                        row.addEventListener('mouseenter', () => { row.style.background = 'rgba(0,0,0,.08)'; });
                        row.addEventListener('mouseleave', () => { row.style.background = ''; });
                        row.addEventListener('mousedown', (e) => e.preventDefault());   // don't steal focus before the click lands
                        row.addEventListener('click', () => commit(c.value));
                        list.appendChild(row);
                    }
                    // t2395 (BACKLOG #47) — FORWARD-AUTHORABLE: a typed value with no exact candidate match still
                    // commits, via its own explicit row (never silently, and never by falling through the "no
                    // match" empty state above — that stays a plain status line for the closed/must-match mode).
                    if (this.allowNew && q && !candidates.some((c) => String(c.value) === String(q))) {
                        const newRow = document.createElement('div');
                        newRow.className = 'ddcs-picker-row ddcs-picker-newrow';
                        newRow.textContent = `+ use "${q}"`;
                        newRow.style.cssText = 'padding:5px 6px;cursor:pointer;border-radius:3px;font-style:italic;';
                        newRow.addEventListener('mouseenter', () => { newRow.style.background = 'rgba(0,0,0,.08)'; });
                        newRow.addEventListener('mouseleave', () => { newRow.style.background = ''; });
                        newRow.addEventListener('mousedown', (e) => e.preventDefault());
                        newRow.addEventListener('click', () => commit(q));
                        list.appendChild(newRow);
                    }
                };
                filterBox.addEventListener('input', () => renderList(filterBox.value));
                filterBox.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape') close();
                    else if (e.key === 'Enter' && this.allowNew && filterBox.value) commit(filterBox.value);   // forward-authorable: Enter commits the typed value directly
                });
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
