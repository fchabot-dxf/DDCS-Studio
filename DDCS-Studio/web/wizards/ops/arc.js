/**
 * wizards/ops/arc.js — ARC move (Move): G2/G3 to (x,y) about centre offset (i,j). The Arc *path* of the
 * Move primitive (the bore/pocket/surface wizards emit these for circles/finish passes).
 */
import { val } from './util.js';

export const arcBlock = {
    type: 'arc', label: 'Arc', kind: 'leaf', category: 'Move',
    defaults: { arc: 'ccw', x: 0, y: 0, i: 0, j: 0, feed: 200 },
    fields: ['arc', 'x', 'y', 'i', 'j', 'feed'],   // arc = direction select (ccw=G3 / cw=G2); i,j = centre offset
    emit: (p, dx = 0, dy = 0) => {
        const g = p.arc === 'cw' ? 2 : 3;   // x/y/i/j/feed accept literals or #var/[expr]
        return [`G${g} X${val(p.x, 0, dx)} Y${val(p.y, 0, dy)} I${val(p.i, 0)} J${val(p.j, 0)} F${val(p.feed, 200)}   ( arc )`];
    },
};
