/**
 * wizards/ops/fill.js — the heavy area-clearing primitives: FILL ZIGZAG + FILL CONCENTRIC (kind:'fill').
 *
 * Dedicated, richer successors to the single Step Over (strategy-dropdown) block — one block per pattern so
 * each shows only its own knobs. Both lay lateral clearing passes across a `region` socket at the depth the
 * enclosing Step Down exposes as scope `z` (Step Down ▸ Fill ▸ Region). Rect/circle now; the Region socket
 * is the stable seam, so an offset/clip kernel can later add arbitrary profiles without touching these.
 *
 *   Fill Zigzag      scanline passes at an arbitrary `angle`; `direction` both-ways | one-way (climb) | other-way (conventional)
 *   Fill Concentric  inward/outward rings; `order` outside-in | inside-out; optional `finishPass` on the outer wall
 */
import { num } from './util.js';
import { zigzagFill, concentricFill } from '../clearing.js';
import { coerceRegion } from './region.js';

const ctxOf = (p, z) => ({ z, clr: num(p.clearance, 5), feed: num(p.feed, 600), plunge: num(p.plunge, 200) });

/** Zigzag clearing toolpath for the region at depth z. */
export function zigzagLines(p, z) {
    const rg = coerceRegion(p.region), step = Math.max(0.1, num(p.stepover, 4));
    return zigzagFill(rg.contour, step, ctxOf(p, z), {
        angleDeg: num(p.angle, 0),
        oneway: p.direction === 'oneway' || p.direction === 'otherway',
        reverse: p.direction === 'otherway',
    });
}

/** Concentric clearing toolpath for the region at depth z. */
export function concentricLines(p, z) {
    const rg = coerceRegion(p.region), step = Math.max(0.1, num(p.stepover, 4));
    return concentricFill(rg, step, ctxOf(p, z), { order: p.order, finishPass: p.finishPass });
}

export const fillZigzagBlock = {
    type: 'fillzigzag', label: 'Fill Zigzag', kind: 'fill', mouth: 'DO', category: 'Transforms',
    defaults: { region: null, stepover: 4, angle: 0, direction: 'bothways', z: 'z', feed: 600, plunge: 200, clearance: 5 },
    fields: ['region', 'stepover', 'angle', 'direction', 'z', 'feed', 'plunge', 'clearance'],   // region = a Region socket; z follows the Step Down
    sockets: { region: 'region' },
    lines: (p, z) => zigzagLines(p, z),
};

export const fillConcentricBlock = {
    type: 'fillconcentric', label: 'Fill Concentric', kind: 'fill', mouth: 'DO', category: 'Transforms',
    defaults: { region: null, stepover: 4, order: 'outside-in', finishPass: false, z: 'z', feed: 600, plunge: 200, clearance: 5 },
    fields: ['region', 'stepover', 'order', 'finishPass', 'z', 'feed', 'plunge', 'clearance'],
    sockets: { region: 'region' },
    lines: (p, z) => concentricLines(p, z),
};
