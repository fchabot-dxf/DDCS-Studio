/**
 * wizards/surfacingWizard.js — face / surfacing generator (Mill group).
 *
 * Skims the top of the stock flat over a rectangular area (defaults to the whole stock top), raster
 * or concentric, stepping down by `stepdown` to the total skim `depth`. Unlike a pocket, the area is
 * the tool-CENTRE sweep (no radius inset) so the tool overhangs the edge by its radius and faces the
 * whole top — keep the area within fixture clearance. Flat G0/G1/G2/G3 in the active WCS — no #vars.
 */
import { headerBlock, footerBlock } from './cuttingBlocks.js';
import { scanlineFill, fillLevelMoves, concentricRect, rectContour, depthLevels } from './clearing.js';

function num(v, d) { return (v === '' || v == null || isNaN(Number(v))) ? d : Number(v); }
const r3 = (n) => Math.round(n * 1000) / 1000;

export class SurfacingWizard {
    generate(params) {
        const strat = params.strategy || 'raster';
        const tool = Math.max(0.1, num(params.toolDia, 12));
        const so = Math.max(0.2, tool * num(params.stepoverPct, 60) / 100);
        const depth = num(params.depth, 0.5);
        const clr = num(params.clearance, 5), feed = num(params.feed, 800), plunge = num(params.plunge, 200);
        const ox = num(params.originX, 0), oy = num(params.originY, 0);
        const w = num(params.w, 100), h = num(params.h, 80);
        const levels = depthLevels(depth, num(params.stepdown, 0.5));

        const L = [
            `( Surfacing - ${w} × ${h} mm - DDCS Studio )`,
            `( ${strat === 'raster' ? 'raster' : 'concentric'} | tool Ø${tool} | stepover ${r3(so)} | skim ${depth} in ${levels.length} pass${levels.length > 1 ? 'es' : ''} )`,
            ...headerBlock(params),
            `G0 Z${clr}   ( clearance )`,
        ];

        if (w <= 0 || h <= 0) { L.push('( zero area — nothing to surface )', ...footerBlock(params)); return L.join('\n'); }

        // The area IS the tool-centre sweep (overhang = radius) so the whole top is faced.
        const x0 = ox, y0 = oy, x1 = ox + w, y1 = oy + h;
        const contours = rectContour(x0, y0, x1, y1);
        const rows = strat === 'raster' ? scanlineFill(contours, so) : null;

        for (const d of levels) {
            const ctx = { z: -d, clr, feed, plunge };
            L.push(`( level Z${r3(-d)} )`);
            if (strat === 'raster') L.push(...fillLevelMoves(rows, ctx));
            else L.push(...concentricRect(x0, y0, x1, y1, so, ctx));
            L.push(`G0 Z${clr}`);
        }

        L.push(...footerBlock(params));
        return L.join('\n');
    }
}
