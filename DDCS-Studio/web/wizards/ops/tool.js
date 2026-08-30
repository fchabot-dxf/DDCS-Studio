/** wizards/ops/tool.js — TOOL CHANGE (Machine): select tool + change (T<n> M6). */
import { num } from './util.js';

export const toolBlock = {
    type: 'tool', label: 'Tool', kind: 'leaf', category: 'Spindle & Feed',
    help: "Changes to the given tool number and runs the change cycle (T# M6) — stop, swap, resume.",
    labels: { n: 'tool number' },
    defaults: { n: 1 },
    fields: ['n'],
    emit: (p) => [`T${Math.max(0, Math.round(num(p.n, 1)))} M6   ( tool change )`],
};
