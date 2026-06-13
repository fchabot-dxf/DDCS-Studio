/** wizards/ops/tool.js — TOOL CHANGE (Machine): select tool + change (T<n> M6). */
import { num } from './util.js';

export const toolBlock = {
    type: 'tool', label: 'Tool', kind: 'leaf', category: 'Machine',
    defaults: { n: 1 },
    fields: ['n'],
    emit: (p) => [`T${Math.max(0, Math.round(num(p.n, 1)))} M6   ( tool change )`],
};
