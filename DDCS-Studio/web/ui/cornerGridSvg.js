/**
 * ui/cornerGridSvg.js — the shared 3×3 corner-grid GRAPHIC (rects + a datum crosshair per cell, picked-cell tint).
 * One source of truth so the Blockly custom field (blocks/blockly/cornerGridField.js) and the wizard FORM pickers
 * (ui/pathAnchorField.js) draw EXACTLY the same picker. Codes are [X][Y], n/c/p = min/centre/max; '' = follow.
 */
const SVGNS = 'http://www.w3.org/2000/svg';
export const CG = { COLS: ['n', 'c', 'p'], ROWS: ['p', 'c', 'n'], CELL: 11, GAP: 2, PAD: 3 };   // COLS L→R = minX..maxX; ROWS top→bottom = maxY..minY (SVG y down)
CG.SPAN = CG.CELL * 3 + CG.GAP * 2 + CG.PAD * 2;

/** Build the 9 cell rects + per-cell datum crosshair into `parent` (an SVG <g> or <svg>). Returns { cells, cross }. */
export function buildCornerCells(parent) {
    const { COLS, ROWS, CELL, GAP, PAD } = CG;
    const cells = {}, cross = {};
    const mkLine = (x1, y1, x2, y2) => {
        const l = document.createElementNS(SVGNS, 'line');
        l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2);
        l.setAttribute('stroke-linecap', 'round'); l.style.pointerEvents = 'none';
        parent.appendChild(l); return l;
    };
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        const code = COLS[c] + ROWS[r];
        const x = PAD + c * (CELL + GAP), y = PAD + r * (CELL + GAP);
        const rect = document.createElementNS(SVGNS, 'rect');
        rect.setAttribute('x', x); rect.setAttribute('y', y);
        rect.setAttribute('width', CELL); rect.setAttribute('height', CELL); rect.setAttribute('rx', 1.5);
        rect.setAttribute('data-code', code);
        rect.style.cursor = 'pointer';
        parent.appendChild(rect);
        cells[code] = rect;
        const cx = x + CELL / 2, cy = y + CELL / 2, a = CELL * 0.28;   // a little datum crosshair → each cell reads as a datum position
        cross[code] = [mkLine(cx - a, cy, cx + a, cy), mkLine(cx, cy - a, cx, cy + a)];
    }
    return { cells, cross };
}

/** Tint the picked cell with `colour` + a bold dark crosshair; the rest stay faint datum marks. */
export function paintCornerGrid(cells, cross, colour, cur) {
    for (const code in cells) {
        const on = code === cur, el = cells[code];
        el.classList.toggle('on', on);   // lets a host (e.g. the form) restyle the empty cells via CSS :not(.on)
        el.setAttribute('fill', on ? colour : 'rgba(170,190,210,0.10)');
        el.setAttribute('stroke', on ? colour : 'rgba(0,0,0,0.30)');
        el.setAttribute('stroke-width', on ? '1' : '0.6');
        (cross[code] || []).forEach((l) => {
            l.setAttribute('stroke', on ? '#10151b' : 'rgba(120,140,160,0.65)');   // dark on the picked cell so it pops
            l.setAttribute('stroke-width', on ? '1.2' : '0.7');
        });
    }
}
