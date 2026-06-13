/**
 * wizards/pocketWizard.js — pocket clearing generator (Mill group).
 *
 * Clears a rectangular or circular pocket with an end mill: roughs the interior (raster zig-zag OR
 * inward concentric rings) then a wall-finish pass, stepping down in Z by `stepdown` to full depth.
 * All geometry is solved in Studio and emitted as flat G0/G1/G2/G3 in the active WCS — no canned
 * cycles, no #vars. Walls are offset inward by the tool radius so the FINISHED pocket matches the
 * width/height/Ø you type.
 *
 * Origin convention (matches drillWizard): rect origin = min-XY corner; circle origin = centre.
 */
import { headerBlock, footerBlock } from './cuttingBlocks.js';
import {
    scanlineFill, fillLevelMoves, contourLevel, concentricRect, concentricCircle,
    rectContour, circleContour, depthLevels,
} from './clearing.js';

function num(v, d) { return (v === '' || v == null || isNaN(Number(v))) ? d : Number(v); }
const r3 = (n) => Math.round(n * 1000) / 1000;

export class PocketWizard {
    generate(params) {
        const shape = params.shape || 'rect';
        const strat = params.strategy || 'spiral';
        const tool = Math.max(0.1, num(params.toolDia, 6)), r = tool / 2;
        const so = Math.max(0.2, tool * num(params.stepoverPct, 40) / 100);
        const depth = num(params.depth, 4);
        const clr = num(params.clearance, 5), feed = num(params.feed, 600), plunge = num(params.plunge, 150);
        const ox = num(params.originX, 0), oy = num(params.originY, 0);
        const levels = depthLevels(depth, num(params.stepdown, 1.5));

        const head = shape === 'rect'
            ? `${num(params.w, 80)} × ${num(params.h, 60)} mm`
            : `Ø${num(params.dia, 50)} mm`;
        const L = [
            `( Pocket - ${shape} ${head} - DDCS Studio )`,
            `( ${strat === 'raster' ? 'raster' : 'concentric'} | tool Ø${tool} | stepover ${r3(so)} | depth ${depth} in ${levels.length} pass${levels.length > 1 ? 'es' : ''} )`,
            ...headerBlock(params),
            `G0 Z${clr}   ( clearance )`,
        ];

        // Tool-centre boundary (region inset by the tool radius).
        let rect = null, circ = null, tooSmall = false;
        if (shape === 'rect') {
            const w = num(params.w, 80), h = num(params.h, 60);
            rect = { x0: ox + r, y0: oy + r, x1: ox + w - r, y1: oy + h - r };
            tooSmall = (rect.x1 - rect.x0 <= 0) || (rect.y1 - rect.y0 <= 0);
        } else {
            circ = { cx: ox, cy: oy, Rc: num(params.dia, 50) / 2 - r };
            tooSmall = circ.Rc <= 0;
        }

        if (tooSmall) {
            const cx = shape === 'rect' ? ox + num(params.w, 80) / 2 : ox;
            const cy = shape === 'rect' ? oy + num(params.h, 60) / 2 : oy;
            L.push('( pocket is smaller than the tool — single plunge only )');
            for (const d of levels) L.push(`G0 X${r3(cx)} Y${r3(cy)}`, `G1 Z${r3(-d)} F${plunge}`, `G0 Z${clr}`);
            L.push(...footerBlock(params));
            return L.join('\n');
        }

        const contours = shape === 'rect'
            ? rectContour(rect.x0, rect.y0, rect.x1, rect.y1)
            : circleContour(circ.cx, circ.cy, circ.Rc);
        const rows = strat === 'raster' ? scanlineFill(contours, so) : null;

        for (const d of levels) {
            const ctx = { z: -d, clr, feed, plunge };
            L.push(`( level Z${r3(-d)} )`);
            if (strat === 'raster') {
                L.push(...fillLevelMoves(rows, ctx));
                if (shape === 'circle') {            // crisp arc wall finish (vs the faceted polygon)
                    L.push(`G0 Z${r3(clr)}`, `G0 X${r3(circ.cx + circ.Rc)} Y${r3(circ.cy)}`, `G1 Z${r3(-d)} F${plunge}`,
                           `G3 X${r3(circ.cx + circ.Rc)} Y${r3(circ.cy)} I${r3(-circ.Rc)} J0 F${feed}`);
                } else {
                    L.push(...contourLevel(contours, ctx));
                }
            } else if (shape === 'rect') {
                L.push(...concentricRect(rect.x0, rect.y0, rect.x1, rect.y1, so, ctx));
            } else {
                L.push(...concentricCircle(circ.cx, circ.cy, circ.Rc, so, ctx));
            }
            L.push(`G0 Z${clr}`);
        }

        L.push(...footerBlock(params));
        return L.join('\n');
    }
}
