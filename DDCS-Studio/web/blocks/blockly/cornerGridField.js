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
const SVGNS = 'http://www.w3.org/2000/svg';
const COLS = ['n', 'c', 'p'];          // left → right  = minX..maxX
const ROWS = ['p', 'c', 'n'];          // top  → bottom = maxY..minY (SVG y points down)
const CELL = 11, GAP = 2, PAD = 3;     // px — big enough for a datum crosshair per cell
const SPAN = CELL * 3 + GAP * 2 + PAD * 2;

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
            const g = this.fieldGroup_;
            const mkLine = (x1, y1, x2, y2) => {
                const l = document.createElementNS(SVGNS, 'line');
                l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2);
                l.setAttribute('stroke-linecap', 'round'); l.style.pointerEvents = 'none';
                g.appendChild(l); return l;
            };
            for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
                const code = COLS[c] + ROWS[r];
                const x = PAD + c * (CELL + GAP), y = PAD + r * (CELL + GAP);
                const rect = document.createElementNS(SVGNS, 'rect');
                rect.setAttribute('x', x); rect.setAttribute('y', y);
                rect.setAttribute('width', CELL); rect.setAttribute('height', CELL); rect.setAttribute('rx', 1.5);
                rect.setAttribute('data-code', code);
                rect.style.cursor = 'pointer';
                g.appendChild(rect);
                this._cells[code] = rect;
                // a little datum crosshair in the cell centre, so each cell reads as a datum position
                const cx = x + CELL / 2, cy = y + CELL / 2, a = CELL * 0.28;
                this._cross[code] = [mkLine(cx - a, cy, cx + a, cy), mkLine(cx, cy - a, cx, cy + a)];
            }
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
        _paint() {
            const cur = this.getValue();
            for (const code in this._cells) {
                const on = code === cur, el = this._cells[code];
                el.setAttribute('fill', on ? this.colour_ : 'rgba(170,190,210,0.10)');
                el.setAttribute('stroke', on ? this.colour_ : 'rgba(0,0,0,0.30)');
                el.setAttribute('stroke-width', on ? '1' : '0.6');
                (this._cross[code] || []).forEach((l) => {
                    l.setAttribute('stroke', on ? '#10151b' : 'rgba(120,140,160,0.65)');   // dark on the picked cell so it pops
                    l.setAttribute('stroke-width', on ? '1.2' : '0.7');
                });
            }
        }

        render_() { this._paint(); this.size_ = new Size(SPAN, SPAN); }
        updateSize_() { this.size_ = new Size(SPAN, SPAN); }
    }

    try { Blockly.fieldRegistry.register('field_cornergrid', FieldCornerGrid); } catch (_) { /* already registered */ }
    return FieldCornerGrid;
}
