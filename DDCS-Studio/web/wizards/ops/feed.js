/**
 * wizards/ops/feed.js — FEED: machine state. Sets the modal feedrate the Cut moves below inherit.
 */
import { num, r3 } from './util.js';

export const feedBlock = {
    type: 'feed', label: 'Feed', kind: 'leaf', category: 'Machine',
    defaults: { rate: 200 },
    fields: ['rate'],
    emit: (p) => [`F${r3(num(p.rate, 200))}   ( feedrate )`],
};
