/**
 * wizards/ops/wall.js — WALL: a clean finishing pass around a region's boundary (kind:'leaf', category:'Ops').
 *
 * The contour/finish sibling of the StepOver fill: one tidy pass along the Region's contour at the current
 * cut Z (scope `z`, set by an enclosing StepDown). Pocket = StepDown{ StepOver(region); Wall(region) } — rough
 * then finish the wall. Reuses clearing.js contourLevel.
 */
import { num } from './util.js';
import { contourLevel } from '../clearing.js';
import { coerceRegion } from './region.js';

export const wallBlock = {
    type: 'wall', label: 'Wall', kind: 'leaf', category: 'Ops',
    defaults: { region: null, z: 'z', feed: 400, plunge: 200, clearance: 5 },
    fields: ['region', 'z', 'feed', 'plunge', 'clearance'],
    emit: (p) => contourLevel(coerceRegion(p.region).contour,
        { z: num(p.z, 0), clr: num(p.clearance, 5), feed: num(p.feed, 400), plunge: num(p.plunge, 200) }),
};
