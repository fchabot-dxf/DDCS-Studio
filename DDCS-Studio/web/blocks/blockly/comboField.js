/**
 * blocks/blockly/comboField.js — a combo-BOX field: dropdown-of-suggestions, but typed free text stays FIRST
 * CLASS (BACKLOG #42 piece 7, ruling A). Unlike `pickerField.js` (piece 6 — a must-MATCH reference, typing
 * filters and can never commit a value outside the candidate list), this is a SPELLING AID, not a gate: `section`
 * offers IDENTITY/GEOMETRY/TOOL & CUT plus this def's own already-used section names; `units` offers the fixed
 * mm/mm-min/in/deg/rpm/% set, with the MAGIC PAIR `mm`/`mm/min` (formWidgets.js:83-88 — they key the inch/IPM
 * display conversion) among them. The t2381 registry invariant polices `section`'s actual NAMES; this widget
 * never gates anything, so it never needs to agree with that invariant's own exception list.
 *
 * A native `<datalist>` IS this — the browser already renders "type-ahead suggestions, free text still valid"
 * for free, so this stays a thin `Blockly.FieldTextInput` subclass (NOT `dropdownPopup.js`'s custom-popup
 * pattern pieces 2/6 share — a suggestion list needs no custom positioning/dismiss logic, the input element
 * already owns that) that overrides `widgetCreate_` to attach `list=` + inject the `<datalist>` options.
 */
const SECTION_CANON = ['IDENTITY', 'GEOMETRY', 'TOOL & CUT'];
const UNITS_FIXED = ['mm', 'mm/min', 'in', 'deg', 'rpm', '%'];
let uid = 0;

export function installComboField(Blockly) {
    class FieldCombo extends Blockly.FieldTextInput {
        constructor(value, validator, config) {
            super(value == null ? '' : String(value), validator, config);
            this.comboKind = (config && config.comboKind) || '';
        }
        static fromJson(options) { return new FieldCombo(options.text, undefined, options); }   // FieldTextInput's own JSON convention is `text`, not `value` (matches jsonDef()'s `field_input` entries)

        /** Every def's own section names ACTUALLY on this stack (dedup, current value excluded — nothing to
         *  suggest itself), or the fixed units list — plain suggestions, never a gate. */
        _candidates() {
            if (this.comboKind === 'units') return UNITS_FIXED;
            if (this.comboKind === 'section') {
                const blk = this.getSourceBlock();
                const ws = blk && blk.workspace;
                const own = ws ? ws.getAllBlocks(false)
                    .filter((b) => b.type === 'formfield' || b.type === 'param_field')
                    .map((b) => b.getFieldValue('SECTION')).filter(Boolean) : [];
                return [...new Set([...SECTION_CANON, ...own])];
            }
            return [];
        }

        widgetCreate_() {
            const input = super.widgetCreate_();
            const candidates = this._candidates();
            if (candidates.length && input) {
                const id = `ddcs-combo-${++uid}`;
                const dl = document.createElement('datalist');
                dl.id = id;
                for (const c of candidates) { const opt = document.createElement('option'); opt.value = c; dl.appendChild(opt); }
                input.setAttribute('list', id);
                (input.parentNode || document.body).appendChild(dl);
                this._dl = dl;   // torn down alongside the widget div's own teardown — see widgetDispose_ below
            }
            return input;
        }
        widgetDispose_() {
            if (this._dl && this._dl.parentNode) this._dl.parentNode.removeChild(this._dl);
            this._dl = null;
            super.widgetDispose_ && super.widgetDispose_();
        }
    }

    try { Blockly.fieldRegistry.register('field_combo', FieldCombo); } catch (_) { /* already registered */ }
    return FieldCombo;
}
