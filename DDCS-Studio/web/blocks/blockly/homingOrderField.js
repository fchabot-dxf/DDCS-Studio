/**
 * blocks/blockly/homingOrderField.js — a CUSTOM Blockly field: a 3-axis isometric graphic picker.
 *
 * Stores an array of axis strings, e.g., ['z', 'x', 'y'].
 * Click an axis to toggle it in the sequence. The visual badges show the order.
 */
import { HO, buildHomingSequence, paintHomingSequence, axisFromEvent } from '../../ui/homingOrderSvg.js';

export function installHomingOrderField(Blockly) {
    const Size = Blockly.utils.Size;

    class FieldHomingOrder extends Blockly.Field {
        constructor(value, validator, config) {
            super(value == null ? [] : value, validator, config);
            this.SERIALIZABLE = true;
            this.colour_ = (config && (config.colour || config.color)) || '#00e5ff';
            this.configuredAxes_ = (config && config.axes) || ['x', 'y', 'z', 'a', 'b'];
            this._ui = {};
            this.size_ = new Size(HO.SPAN_X, HO.SPAN_Y);
        }

        static fromJson(options) { return new FieldHomingOrder(options.value, undefined, options); }

        /** Ensure newValue is an array of strings. */
        doClassValidation_(newValue) {
            if (Array.isArray(newValue)) return newValue;
            if (typeof newValue === 'string') {
                try { return JSON.parse(newValue); } catch (_) { return []; }
            }
            return [];
        }

        getText() { 
            const val = this.getValue() || [];
            return val.length ? val.map(a => a.toUpperCase()).join(' → ') : '(none)';
        }
        
        isClickable() { return true; }

        initView() {
            this._ui = buildHomingSequence(this.fieldGroup_, this.configuredAxes_);
            this._paint();
        }

        onMouseDown_(e) {
            const ax = axisFromEvent(this._ui, e);
            if (ax != null) {
                const cur = [...(this.getValue() || [])];
                const idx = cur.indexOf(ax);
                if (idx >= 0) cur.splice(idx, 1);
                else cur.push(ax);
                this.setValue(cur);
                return;
            }
            if (super.onMouseDown_) super.onMouseDown_(e);
        }

        _paint() { paintHomingSequence(this._ui, this.getValue() || [], this.colour_); }

        render_() { this._paint(); this.size_ = new Size(HO.SPAN_X, HO.SPAN_Y); }
        updateSize_() { this.size_ = new Size(HO.SPAN_X, HO.SPAN_Y); }
    }

    try { Blockly.fieldRegistry.register('field_homingorder', FieldHomingOrder); } catch (_) { }
    return FieldHomingOrder;
}
