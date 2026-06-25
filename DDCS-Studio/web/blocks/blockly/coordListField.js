/**
 * blocks/blockly/coordListField.js — a custom Blockly field: the coordinate-list PREVIEW drawn inline on a block.
 *
 * The block twin of the form's coordListWidget. A Blockly field can't host the rich FeatureCanvas (HTML/RAF/pan-zoom,
 * and in-field drag fights Blockly's gesture), so the block shows a compact static preview of the points — same
 * split region-pick uses (rich form widget vs lighter field). The points + shared Z are the field's VALUE, stored as
 * a JSON string (serializable → round-trips like any field). Rich editing (drag/add/remove) is the form / the ✎
 * editor, not inline here. Blockly 13.0.0 (vendor/blockly/API-NOTES.md).
 */
import { buildCoordMarkers } from '../../ui/coordListSvg.js';

const MAXW = 120, MAXH = 70;

export function installCoordListField(Blockly) {
    const Size = Blockly.utils.Size;

    class FieldCoordList extends Blockly.Field {
        constructor(value, validator, config) {
            super(value == null ? '{"points":[],"z":0}' : String(value), validator, config);
            this.SERIALIZABLE = true;
            this.size_ = new Size(MAXW, MAXH);
        }
        static fromJson(options) { return new FieldCoordList(options.value, undefined, options); }

        /** value is the JSON of { points:[{x,y}], z } — keep it a string; default to an empty list if unparseable. */
        doClassValidation_(v) {
            try { const o = JSON.parse(v); if (o && Array.isArray(o.points)) return JSON.stringify(o); } catch (_) { /* */ }
            return '{"points":[],"z":0}';
        }
        _state() { try { return JSON.parse(this.getValue()); } catch (_) { return { points: [], z: 0 }; } }
        getText() { const s = this._state(); return `${(s.points || []).length} pts`; }

        initView() {
            this._svg = Blockly.utils.dom.createSvgElement('svg', { width: MAXW, height: MAXH }, this.fieldGroup_);
            this._draw();
        }
        _draw() { buildCoordMarkers(this._svg, this._state().points || []); this.size_ = new Size(MAXW, MAXH); }
        render_() { if (this._svg) this._draw(); }
        updateSize_() { this.size_ = new Size(MAXW, MAXH); }
    }

    try { Blockly.fieldRegistry.register('field_coordlist', FieldCoordList); } catch (_) { /* already registered */ }
    return FieldCoordList;
}
