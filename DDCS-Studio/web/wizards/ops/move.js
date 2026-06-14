/**
 * wizards/ops/move.js — MOVE atom: one tool motion to (x,y,z). The granular motion primitive.
 *
 * First cut of `Move = path × mode × target` (see BLOCKS-TAB.md): path is Linear here; `mode` selects
 * Rapid (G0) / Cut (G1, feed) / Probe (G31); target is an absolute position. Arc/helix paths and
 * distance/anchor targets come next. Friendly named moves (Plunge/Retract/Travel) will be presets of this.
 */
import { val } from './util.js';

export const moveBlock = {
    type: 'move', label: 'Move', kind: 'leaf', category: 'Move',
    defaults: { mode: 'cut', x: 0, y: 0, z: 0, feed: 200 },
    fields: ['mode', 'x', 'y', 'z', 'feed'],
    // Only the axes that are set are emitted (a blank/absent axis is omitted → single-axis moves like `G0 X#9`).
    // Each coordinate/feed accepts a literal OR a #var/[expr] (val), so `Move(rapid, X=#9)` → `G0 X#9`.
    emit: (p, dx = 0, dy = 0) => {
        const words = [];
        if (p.x != null && p.x !== '') words.push(`X${val(p.x, 0, dx)}`);
        if (p.y != null && p.y !== '') words.push(`Y${val(p.y, 0, dy)}`);
        if (p.z != null && p.z !== '') words.push(`Z${val(p.z, 0)}`);
        const xyz = words.join(' ');
        // No ( travel )/( cut )/( probe ) tag: G0 is a travel, G1+F is a cut, G31 is a probe — the word says it.
        // Block structure reads from the marker comments (( Array N @ … ), ( Step Down z=… )), not per-line tags.
        if (p.mode === 'rapid') return [`G0 ${xyz}`];
        if (p.mode === 'probe') return [`G31 ${xyz} F${val(p.feed, 50)}`];
        return [`G1 ${xyz} F${val(p.feed, 200)}`];
    },
};
