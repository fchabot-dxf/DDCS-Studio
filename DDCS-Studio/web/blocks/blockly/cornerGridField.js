/**
 * blocks/blockly/cornerGridField.js — a CUSTOM Blockly field: a 3×3 corner picker drawn inline on the block.
 *
 * Stores a 2-char [X][Y] datum code (n/c/p = min/centre/max) or '' (= follow the stock). Click a cell to pick it;
 * click the picked cell again to clear back to follow. The `colour` config tints the picked cell, so the two datums
 * (stock attach vs path datum) read apart at a glance — the same idea as the 2D canvas pickers.
 *
 * Blockly 12.5.1 (vendor/blockly/API-NOTES.md). Custom-field lifecycle: initView() builds the SVG into fieldGroup_,
 * render_() repaints + sets size_, getSize() drives block layout. We bind our own pointer events on the cells (no
 * popup editor — it's inline), and stopPropagation so a click picks instead of dragging the block. Verified to
 * render + round-trip by tests/place-on-stock-block.spec.js.
 */
import { CG, buildCornerCells, paintCornerGrid } from '../../ui/cornerGridSvg.js';
const SPAN = CG.SPAN;

/** Register `field_cornergrid` on a Blockly instance (idempotent). */
export function installCornerGridField(Blockly) {
    const Size = Blockly.utils.Size;

    class FieldCornerGrid extends Blockly.Field {
        constructor(value, validator, config) {
            super(value == null ? '' : value, validator, config);
            this.SERIALIZABLE = true;
            this.colour_ = (config && (config.colour || config.color)) || '#ffcf3a';
            this._cells = {};      // code → cell rect (hit target + fill)
            this._cross = {};      // code → [hLine, vLine] datum crosshair
            this.size_ = new Size(SPAN, SPAN);
        }

        static fromJson(options) { return new FieldCornerGrid(options.value, undefined, options); }

        /** Accept '' (follow) or a 2-char n/c/p code; reject anything else. */
        doClassValidation_(newValue) {
            const s = String(newValue == null ? '' : newValue).replace(/[^ncp]/g, '');
            return (s === '' || /^[ncp]{2}$/.test(s)) ? s : null;
        }

        getText() { return this.getValue() || '(stock datum)'; }
        isClickable() { return true; }   // route clicks through Blockly's gesture → onMouseDown_ (below)

        /** Build the 9 cells once. (Clicks are handled in onMouseDown_, NOT native listeners — Blockly's gesture
         *  system swallows native field listeners, so a real click would never reach them.) */
        initView() {
            const built = buildCornerCells(this.fieldGroup_);   // shared graphic (ui/cornerGridSvg.js)
            this._cells = built.cells; this._cross = built.cross;
            this._paint();
        }

        /** Blockly calls this on a field click (bound via bindEvents_). Pick the cell under the pointer; re-clicking
         *  the picked cell clears back to follow. We DON'T call super (no editor + don't let it start a block drag). */
        onMouseDown_(e) {
            const code = this._codeFromEvent(e);
            if (code != null) { this.setValue(this.getValue() === code ? '' : code); return; }
            if (super.onMouseDown_) super.onMouseDown_(e);
        }

        /** Which cell is under the pointer — by each cell's on-screen rect (robust to workspace zoom). */
        _codeFromEvent(e) {
            for (const code in this._cells) {
                const r = this._cells[code].getBoundingClientRect();
                if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) return code;
            }
            return null;
        }

        /** Tint the picked cell with the datum colour + a bold dark crosshair; the rest are faint datum marks. */
        _paint() { paintCornerGrid(this._cells, this._cross, this.colour_, this.getValue()); }

        render_() { this._paint(); this.size_ = new Size(SPAN, SPAN); }
        updateSize_() { this.size_ = new Size(SPAN, SPAN); }
    }

    try { Blockly.fieldRegistry.register('field_cornergrid', FieldCornerGrid); } catch (_) { /* already registered */ }
    return FieldCornerGrid;
}
