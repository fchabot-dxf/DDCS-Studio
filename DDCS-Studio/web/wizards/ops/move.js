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
    defaults: { mode: 'cut', x: 0, y: 0, z: 0, feed: 2000 },
    fields: ['mode', 'x', 'y', 'z', 'feed'],
    // Only the axes that are set are emitted (a blank/absent axis is omitted → single-axis moves like `G0 X#9`).
    // Each coordinate/feed accepts a literal OR a #var/[expr] (val), so `Move(rapid, X=#9)` → `G0 X#9`.
    emit: (p, dx = 0, dy = 0) => {
        const words = [];
        if (p.x != null && p.x !== '') words.push(`X${val(p.x, 0, dx)}`);
        // t1315 — A LATHE HAS NO Y, so a ZERO one is dropped. Nothing in the lathe family authors a Y; the round trip
        // through the Blocks canvas is what puts it there, because a Blockly move block materialises all three axis
        // fields and a blank one comes back as 0. Emitting `G0 X#126 Y0 Z#130` to a machine with two axes is a wrong
        // operator message at best. A NON-ZERO Y is left alone deliberately: on a lathe that is a real authoring
        // mistake, and hiding it would be the worse failure.
        const dropY = (Number(p.y) === 0 || p.y === '0') && (() => { try { return !!(window.ddcsIsLathe && window.ddcsIsLathe()); } catch (_) { return false; } })();
        if (p.y != null && p.y !== '' && !dropY) words.push(`Y${val(p.y, 0, dy)}`);
        if (p.z != null && p.z !== '') words.push(`Z${val(p.z, 0)}`);
        if (p.a != null && p.a !== '') words.push(`A${val(p.a, 0)}`);   // rotary 4th axis (e.g. rotary index)
        if (p.b != null && p.b !== '') words.push(`B${val(p.b, 0)}`);   // rotary 5th axis
        const xyz = words.join(' ');
        // No ( travel )/( cut )/( probe ) tag: G0 is a travel, G1+F is a cut, G31 is a probe — the word says it.
        // Block structure reads from the marker comments (( Array N @ … ), ( Step Down z=… )), not per-line tags.
        if (p.mode === 'rapid') return [`G0 ${xyz}`];
        if (p.mode === 'probe') return [`G31 ${xyz} F${val(p.feed, 50)}`];
        return [`G1 ${xyz} F${val(p.feed, 2000)}`];
    },
};
