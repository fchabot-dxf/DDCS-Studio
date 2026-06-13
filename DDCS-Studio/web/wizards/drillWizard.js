/**
 * wizards/drillWizard.js — hole-pattern generator (the first Mill-group op).
 *
 * This is a PRESET: a composition of primitive op-blocks — an ARRAY (patternPoints) wrapping a leaf
 * hole op, either DRILL (peckDrill) or BORE (helicalBore). The kernels now live as separate modules
 * under ops/ so the Blocks tab and this wizard share ONE implementation (see ops/index.js and
 * MULTI-OP-STACKING.md). Output is byte-identical to before the extraction.
 */
import { headerBlock, footerBlock } from './cuttingBlocks.js';
import { patternPoints, peckDrill, helicalBore } from './ops/index.js';
import { num } from './ops/util.js';

// Re-export so views (drillView) keep importing the pattern geometry from here.
export { patternPoints };

export class DrillWizard {
    generate(params) {
        const pts = patternPoints(params);
        // Suppress holes by their 1-based number (the numbers shown in the preview / comments).
        const skip = new Set(String(params.skip || '').split(/[ ,]+/).map(s => parseInt(s, 10)).filter(n => n > 0));
        const kept = pts.filter((_, i) => !skip.has(i + 1)).length;
        const helical = params.method === 'helical';
        const L = [
            `( Hole pattern - ${params.pattern || 'grid'} - DDCS Studio )`,
            `( ${kept} of ${pts.length} holes | ${helical ? 'helical bore' : 'peck drill'} | depth ${num(params.depth, 5)} mm )`,
            ...headerBlock(params),
            `G0 Z${num(params.clearance, 5)}   ( clearance )`,
        ];
        pts.forEach((pt, i) => {
            const n = i + 1;
            if (skip.has(n)) { L.push(`( hole ${n}/${pts.length} - skipped )`); return; }
            L.push(`( hole ${n}/${pts.length} )`);
            L.push(...(helical ? helicalBore(pt, params) : peckDrill(pt, params)));
        });
        L.push(...footerBlock(params));
        return L.join('\n');
    }

    /** Preview/sim start hint (work frame): origin; the pattern is drawn from there. */
    inferStart() { return { x: 0, y: 0, z: num(arguments[0] && arguments[0].clearance, 5) }; }
}
