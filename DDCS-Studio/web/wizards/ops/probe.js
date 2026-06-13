/**
 * wizards/ops/probe.js — PROBE primitive: a single probe MOVE (one G31 toward a point).
 *
 * This is an atom, not a routine. A *helical* probe is not a primitive — it's a stack:
 * helix(probe) (a helix path-modifier sweeping this move). drill = array(bore) is the same idea.
 * `kind:'move'` blocks expose step(params, pt) so path modifiers can sweep them along a path;
 * emit() is their standalone behaviour (rapid over target → clearance → one straight probe).
 */
import { num, r3 } from './util.js';
import { G, X, Y, Z, F, P, line } from '../words.js';

const probeMove = (pt, p) => line([G(31), X(pt.x), Y(pt.y), Z(pt.z), F(num(p.feed, 50)), P(num(p.port, 1))], 'probe');

export const probeBlock = {
    type: 'probe', label: 'Probe', kind: 'move', category: 'Move',
    defaults: { x: 0, y: 0, z: -5, feed: 50, port: 1, clearance: 5 },
    fields: ['x', 'y', 'z', 'feed', 'port', 'clearance'],
    /** Standalone: rapid over target, drop to clearance, one straight probe to (x,y,z). */
    emit: (p, dx = 0, dy = 0) => {
        const x = r3(num(p.x, 0) + dx), y = r3(num(p.y, 0) + dy), z = r3(num(p.z, -5));
        return [line([G(0), X(x), Y(y)], 'to XY'), line([G(0), Z(r3(num(p.clearance, 5)))], 'clearance'), probeMove({ x, y, z }, p)];
    },
    /** Swept by a path modifier (helix, polyline…): probe toward the generated point. */
    step: (p, pt) => probeMove({ x: r3(pt.x), y: r3(pt.y), z: r3(pt.z) }, p),
};
