/**
 * wizards/drillWizard.js — hole-pattern generator (the first Mill-group op).
 *
 * REWRITTEN AS A BLOCK STACK: the wizard's only implementation is `drillStack(params)` → [ Array{ Drill | Bore } ]
 * — an Array container (patternPoints) stamping a hole leaf (peck Drill, or helical Bore) at each point, with
 * `skip` omitting holes by 1-based number. The wizard form and the Blocks view are two editors of this one
 * stack; the kernels (patternPoints / peckDrill / helicalBore) live in ops/ and are shared.
 */
import { newBlock, emitMapped } from '../blocks/blockModel.js';
import { recordOp } from '../blocks/opRecord.js';
import { makeStart, makeEnd } from '../blocks/programFraming.js';
import { patternPoints } from './ops/index.js';
import { num } from './ops/util.js';

// Re-export so views (drillView) keep importing the pattern geometry from here.
export { patternPoints };

/** Drill params → [ Array{ Drill|Bore } ]. The one source of truth for both displays. */
export function drillStack(params = {}) {
    const arr = newBlock('array');
    arr.params = {
        pattern: params.pattern || 'grid',
        x0: num(params.x0, 0), y0: num(params.y0, 0),
        cols: num(params.cols, 3), rows: num(params.rows, 2), dx: num(params.dx, 20), dy: num(params.dy, 20),
        count: num(params.count, 4), spacing: num(params.spacing, 20), angle: num(params.angle, 0),
        dia: num(params.dia, 50), startAngle: num(params.startAngle, 0),
        w: num(params.w, 100), h: num(params.h, 80), nx: num(params.nx, 2), ny: num(params.ny, 2),   // rect-perimeter pattern
        skip: params.skip || '',
    };
    const helical = params.method === 'helical';
    const hole = newBlock(helical ? 'bore' : 'drill');
    hole.params = helical
        ? { x: 0, y: 0, holeDia: num(params.holeDia, 12), toolDia: num(params.toolDia, 6), depth: num(params.depth, 5), pitch: num(params.pitch, 0.5), ramp: params.ramp || 'step', feed: num(params.feed, 100), clearance: num(params.clearance, 5) }
        : { x: 0, y: 0, depth: num(params.depth, 5), peck: num(params.peck, 5), feed: num(params.feed, 100), clearance: num(params.clearance, 5) };
    arr.children = [hole];
    return [makeStart(params), arr, makeEnd(params)];
}

export class DrillWizard {
    generate(params) {
        recordOp('drill', params);   // let the Blocks tab open this op as its stack
        return emitMapped(drillStack(params)).text;
    }

    /** Preview/sim start hint (work frame): origin; the pattern is drawn from there. */
    inferStart() { return { x: 0, y: 0, z: num(arguments[0] && arguments[0].clearance, 5) }; }
}
