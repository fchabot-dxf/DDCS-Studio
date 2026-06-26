/**
 * wizards/ops/slot.js — SLOT primitive (kind:'leaf', category:'Ops').
 *
 * The one wizard op with no block equivalent until now: a widened channel from (x0,y0)→(x1,y1) at ANY angle,
 * `width` wide (≥ tool Ø), zig-zag offset passes stepping down to `depth`. The tool CENTRE travels the axis;
 * width>tool adds parallel passes offset perpendicular by the stepover. NOT a region fill (its passes run
 * along the slot axis, not axis-aligned scanlines), so it's its own atom. `slotPath` is the shared kernel —
 * SlotWizard and this block both emit through it, so they're one implementation (like drill = array(bore)).
 */
import { num, r3 } from './util.js';
import { depthLevels } from '../clearing.js';

/** Slot toolpath: clearance preamble + zig-zag offset passes stepping down (+ zero-length single-plunge guard). */
export function slotPath(p) {
    const x0 = num(p.x0, 0), y0 = num(p.y0, 0), x1 = num(p.x1, 60), y1 = num(p.y1, 0);
    const tool = Math.max(0.1, num(p.tool, 6));
    const width = Math.max(tool, num(p.width, tool));
    const so = Math.max(0.2, tool * num(p.stepoverPct, 40) / 100);
    const depth = num(p.depth, 4);
    const clr = num(p.clearance, 5), feed = num(p.feed, 600), plunge = num(p.plunge, 150);
    const levels = depthLevels(depth, num(p.stepdown, 1.5));
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
    const L = [];   // program-level clearance is provided by the enclosing program (emitMapped header)

    if (len < 1e-6) {     // A == B → just a plunged hole
        L.push('( zero-length slot — single plunge )');
        for (const d of levels) L.push(`G0 X${r3(x0)} Y${r3(y0)}`, `G1 Z${r3(-d)} F${plunge}`, `G0 Z${clr}`);
        return L;
    }

    const nx = -dy / len, ny = dx / len;        // perpendicular (left of A→B)
    const band = Math.max(0, width - tool);     // width the tool centre must sweep
    const offs = [];
    if (band < 1e-6) offs.push(0);
    else { const half = band / 2; for (let o = -half; o < half - 1e-6; o += so) offs.push(o); offs.push(half); }

    for (const d of levels) {
        const z = -d;
        L.push(`( level Z${r3(z)} )`);
        let dir = 1, first = true;
        for (const o of offs) {
            let sx = x0 + nx * o, sy = y0 + ny * o, ex = x1 + nx * o, ey = y1 + ny * o;
            if (dir < 0) { [sx, ex] = [ex, sx];[sy, ey] = [ey, sy]; }
            if (first) { L.push(`G0 X${r3(sx)} Y${r3(sy)}`, `G1 Z${r3(z)} F${plunge}`); first = false; }
            else L.push(`G1 X${r3(sx)} Y${r3(sy)} F${feed}`);   // step across to the next pass
            L.push(`G1 X${r3(ex)} Y${r3(ey)} F${feed}`);
            dir = -dir;
        }
        L.push(`G0 Z${clr}`);
    }
    return L;
}

export const slotBlock = {
    type: 'slot', label: 'Slot', kind: 'leaf', category: 'Toolpaths',
    defaults: { x0: 0, y0: 0, x1: 60, y1: 0, width: 6, tool: 6, stepoverPct: 40, depth: 4, stepdown: 1.5, feed: 600, plunge: 150, clearance: 5 },
    fields: ['x0', 'y0', 'x1', 'y1', 'width', 'tool', 'stepoverPct', 'depth', 'stepdown', 'feed', 'plunge', 'clearance'],
    emit: (p, dx = 0, dy = 0) => slotPath({
        ...p,
        x0: num(p.x0, 0) + dx, y0: num(p.y0, 0) + dy,
        x1: num(p.x1, 60) + dx, y1: num(p.y1, 0) + dy,
    }),
};
