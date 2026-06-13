/**
 * wizards/ops/move.js — MOVE atom: one tool motion to (x,y,z). The granular motion primitive.
 *
 * First cut of `Move = path × mode × target` (see BLOCKS-TAB.md): path is Linear here; `mode` selects
 * Rapid (G0) / Cut (G1, feed) / Probe (G31); target is an absolute position. Arc/helix paths and
 * distance/anchor targets come next. Friendly named moves (Plunge/Retract/Travel) will be presets of this.
 */
import { num, r3 } from './util.js';

export const moveBlock = {
    type: 'move', label: 'Move', kind: 'leaf', category: 'Move',
    defaults: { mode: 'cut', x: 0, y: 0, z: 0, feed: 200 },
    fields: ['mode', 'x', 'y', 'z', 'feed'],
    emit: (p, dx = 0, dy = 0) => {
        const x = r3(num(p.x, 0) + dx), y = r3(num(p.y, 0) + dy), z = r3(num(p.z, 0));
        if (p.mode === 'rapid') return [`G0 X${x} Y${y} Z${z}   ( travel )`];
        if (p.mode === 'probe') return [`G31 X${x} Y${y} Z${z} F${r3(num(p.feed, 50))}   ( probe )`];
        return [`G1 X${x} Y${y} Z${z} F${r3(num(p.feed, 200))}   ( cut )`];
    },
};
