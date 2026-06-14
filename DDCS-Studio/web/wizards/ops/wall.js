/**
 * wizards/ops/wall.js — WALL: a clean finishing pass around a region's boundary (kind:'leaf', category:'Ops').
 *
 * The contour/finish sibling of the StepOver fill: one tidy pass along the Region's contour at the current
 * cut Z (scope `z`, set by an enclosing StepDown). Pocket = StepDown{ StepOver(region); Wall(region) } — rough
 * then finish the wall. A CIRCLE region finishes with a true G3 arc (crisp, not the faceted circleContour);
 * rect/other trace the polygon contour (clearing.js contourLevel).
 */
import { num, r3 } from './util.js';
import { contourLevel } from '../clearing.js';
import { coerceRegion } from './region.js';

/** Crisp circular wall finish: rapid to the rim, plunge, one full G3 circle, retract. */
function circleWall(rg, z, clr, feed, plunge) {
    const x = r3(rg.cx + rg.r), y = r3(rg.cy);
    return [`G0 Z${r3(clr)}`, `G0 X${x} Y${y}`, `G1 Z${r3(z)} F${plunge}`, `G3 X${x} Y${y} I${r3(-rg.r)} J0 F${feed}   ( wall )`];
}

export const wallBlock = {
    type: 'wall', label: 'Wall', kind: 'leaf', category: 'Ops',
    defaults: { region: null, z: 'z', feed: 400, plunge: 200, clearance: 5 },
    fields: ['region', 'z', 'feed', 'plunge', 'clearance'],
    sockets: { region: 'region' },
    emit: (p) => {
        const rg = coerceRegion(p.region);
        const z = num(p.z, 0), clr = num(p.clearance, 5), feed = num(p.feed, 400), plunge = num(p.plunge, 200);
        return rg.kind === 'circle'
            ? circleWall(rg, z, clr, feed, plunge)
            : contourLevel(rg.contour, { z, clr, feed, plunge });
    },
};
