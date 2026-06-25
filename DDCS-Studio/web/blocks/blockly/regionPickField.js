/**
 * blocks/blockly/regionPickField.js — a CUSTOM Blockly field: the REGION-PICK control drawn inline on a block.
 *
 * The block twin of the form's regionPickWidget — the SECOND dual-adapter pick control after the datum, sharing the
 * same core (ui/regionPickSvg.js). Stores the picked region's NUMBER (as the field value, so it round-trips like any
 * field). The SPEC (viewBox + backdrop + regions) is NOT the field's value — it's a JSON-string param carried on the
 * block's `data` (stackBridge round-trips non-field scalar params through b.data), read here at render time. So the
 * same spec drives the form widget AND the block field — "blocks share the form's GUI."
 *
 * Blockly 13.0.0 (vendor/blockly/API-NOTES.md): inline custom field — initView() builds the SVG, render_() (re)builds
 * when the spec arrives/changes + repaints, onMouseDown_ picks (no popup editor; stopPropagation so a click picks
 * instead of dragging the block). Verified by tests/region-pick-block.spec.js (Class-B render guard).
 */
import { buildRegions, paintRegions, regionValueFromEvent } from '../../ui/regionPickSvg.js';

const MAXW = 140;   // inline display width cap (px); height follows the spec's aspect

export function installRegionPickField(Blockly) {
    const Size = Blockly.utils.Size;

    class FieldRegionPick extends Blockly.Field {
        constructor(value, validator, config) {
            super(value == null ? '' : String(value), validator, config);
            this.SERIALIZABLE = true;
            this._specKey = null; this._regions = [];
            this.size_ = new Size(MAXW, 72);
        }
        static fromJson(options) { return new FieldRegionPick(options.value, undefined, options); }

        doClassValidation_(v) { return v == null ? '' : String(v); }   // a numeric region value, kept as a string
        getText() { return this.getValue() || ''; }
        isClickable() { return true; }

        /** The control spec from the source block's `data` JSON ({ spec: <obj|json-string> }). */
        _spec() {
            const blk = this.getSourceBlock();
            try {
                const d = blk && blk.data ? JSON.parse(blk.data) : {};
                if (d.spec) return typeof d.spec === 'string' ? JSON.parse(d.spec) : d.spec;
            } catch (_) { /* malformed → empty */ }
            return { viewBox: '0 0 200 120', regions: [] };
        }

        initView() {
            this._svg = Blockly.utils.dom.createSvgElement('svg', { width: MAXW, height: 72 }, this.fieldGroup_);
            this._buildFromSpec();
        }

        /** (Re)build the region shapes from the current spec + size the field to the spec's aspect. */
        _buildFromSpec() {
            const spec = this._spec(), key = JSON.stringify(spec);
            const vb = (spec.viewBox || '0 0 200 120').split(/[\s,]+/).map(Number);
            const w = vb[2] || 200, h = vb[3] || 120, dw = Math.min(MAXW, w), dh = Math.max(8, Math.round(dw * h / w));
            this._svg.setAttribute('width', dw); this._svg.setAttribute('height', dh);
            this._regions = buildRegions(this._svg, spec);
            this._specKey = key; this.size_ = new Size(dw, dh);
            this._paint();
        }

        onMouseDown_(e) {
            const v = regionValueFromEvent(this._regions, e);
            if (v != null) { this.setValue(String(v)); return; }
            if (super.onMouseDown_) super.onMouseDown_(e);
        }

        _paint() { paintRegions(this._regions, this.getValue()); }

        render_() {
            if (this._svg && JSON.stringify(this._spec()) !== this._specKey) this._buildFromSpec();   // spec arrived/changed
            else this._paint();
        }
        updateSize_() { /* size is set in _buildFromSpec */ }
    }

    try { Blockly.fieldRegistry.register('field_regionpick', FieldRegionPick); } catch (_) { /* already registered */ }
    return FieldRegionPick;
}
