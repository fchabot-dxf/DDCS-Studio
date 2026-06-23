// ui/gateway/views/merge.js — STUB: multi-tool job merge. Combine several single-tool programs into ONE job,
// ordered by tool, with a tool change (T / M6) + safe retract inserted between each and a single program frame
// (one end). Pull ops from Studio or pick controller files, set the tool order, then merge + send as one run.
// Not wired yet — placeholder UI + intent only.
import { el, toast } from '../util.js';

export default {
  id: 'merge',
  label: 'Merge',

  mount(ctx) {
    const list = el('div', { class: 'block muted' }, 'No programs added yet.');
    const addStudio = el('button', { class: 'op-btn' }, '⬆ Add current Studio program');
    const drop = el('div', { class: 'drop' }, '⤓  Drop .nc files to merge  (coming soon)');
    const mergeBtn = el('button', { class: 'primary', disabled: '' }, 'Merge into one job');

    const todo = () => toast('Multi-tool merge is a stub — not wired yet');
    addStudio.onclick = todo;
    drop.onclick = todo;

    ctx.root.append(el('section', { class: 'block' },
      el('div', { class: 'section-label' }, 'Multi-tool job merge'),
      el('div', { class: 'wiz-usage' },
        'Combine several single-tool programs into one job: ordered by tool, with a tool change (T / M6) and a '
        + 'safe retract inserted between each, under one program frame (a single end). Pull ops from Studio or '
        + 'pick controller files, set the tool order, then merge + send as one multi-tool run.'),
      el('div', { class: 'row', style: 'margin-top:10px' }, addStudio),
      drop,
      list,
      el('div', { class: 'row', style: 'margin-top:12px' }, mergeBtn),
      el('div', { class: 'hint' }, 'Stub — UI placeholder; merge logic not implemented yet.')));
  },
};
