/**
 * wizards/slotWizard.js — slot milling generator (Mill group).
 *
 * Mills a straight slot from point A to point B at a given width (≥ tool Ø), stepping down in Z.
 * The tool CENTRE travels A→B, so the cut is `width` wide with semicircular ends a tool-radius beyond
 * A and B. width = tool → a single centreline pass; width > tool → parallel passes along the slot
 * axis, offset perpendicular by the stepover, zig-zagged. Flat G0/G1 in the active WCS — no #vars.
 */
import { headerBlock, footerBlock } from './cuttingBlocks.js';
import { depthLevels } from './clearing.js';

function num(v, d) { return (v === '' || v == null || isNaN(Number(v))) ? d : Number(v); }
const r3 = (n) => Math.round(n * 1000) / 1000;

export class SlotWizard {
    generate(params) {
        const ax = num(params.ax, 0), ay = num(params.ay, 0), bx = num(params.bx, 60), by = num(params.by, 0);
        const tool = Math.max(0.1, num(params.toolDia, 6));
        const width = Math.max(tool, num(params.width, tool));
        const so = Math.max(0.2, tool * num(params.stepoverPct, 40) / 100);
        const depth = num(params.depth, 4);
        const clr = num(params.clearance, 5), feed = num(params.feed, 600), plunge = num(params.plunge, 150);
        const levels = depthLevels(depth, num(params.stepdown, 1.5));

        const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
        const L = [
            `( Slot - ${r3(len)} mm long, ${width} mm wide - DDCS Studio )`,
            `( tool Ø${tool} | depth ${depth} in ${levels.length} pass${levels.length > 1 ? 'es' : ''} )`,
            ...headerBlock(params),
            `G0 Z${clr}   ( clearance )`,
        ];

        if (len < 1e-6) {     // A == B → just a plunged hole
            L.push('( zero-length slot — single plunge )');
            for (const d of levels) L.push(`G0 X${r3(ax)} Y${r3(ay)}`, `G1 Z${r3(-d)} F${plunge}`, `G0 Z${clr}`);
            L.push(...footerBlock(params));
            return L.join('\n');
        }

        const ux = dx / len, uy = dy / len;   // along the slot
        const nx = -uy, ny = ux;              // perpendicular (left of A→B)
        const band = Math.max(0, width - tool);   // width the tool centre must sweep
        const offs = [];
        if (band < 1e-6) offs.push(0);
        else { const half = band / 2; for (let o = -half; o < half - 1e-6; o += so) offs.push(o); offs.push(half); }

        for (const d of levels) {
            const z = -d;
            L.push(`( level Z${r3(z)} )`);
            let dir = 1, first = true;
            for (const o of offs) {
                let sx = ax + nx * o, sy = ay + ny * o, ex = bx + nx * o, ey = by + ny * o;
                if (dir < 0) { [sx, ex] = [ex, sx];[sy, ey] = [ey, sy]; }
                if (first) { L.push(`G0 X${r3(sx)} Y${r3(sy)}`, `G1 Z${r3(z)} F${plunge}`); first = false; }
                else L.push(`G1 X${r3(sx)} Y${r3(sy)} F${feed}`);   // step across to the next pass
                L.push(`G1 X${r3(ex)} Y${r3(ey)} F${feed}`);
                dir = -dir;
            }
            L.push(`G0 Z${clr}`);
        }

        L.push(...footerBlock(params));
        return L.join('\n');
    }
}
