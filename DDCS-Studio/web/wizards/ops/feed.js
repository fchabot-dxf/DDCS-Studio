/**
 * wizards/ops/feed.js — FEED: machine state. Sets the modal feedrate the Cut moves below inherit.
 */
import { val } from './util.js';

export const feedBlock = {
    type: 'feed', label: 'Feed', kind: 'leaf', category: 'Spindle & Feed',
    defaults: { rate: 200 },
    fields: ['rate'],
    emit: (p) => [`F${val(p.rate, 200)}   ( feedrate )`],   // rate accepts a literal or #var/[expr]
};
