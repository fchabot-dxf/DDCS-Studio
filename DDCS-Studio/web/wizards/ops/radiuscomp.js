/**
 * wizards/ops/radiuscomp.js — RADIUS COMP : read a probe trigger and offset it by the stylus radius toward the
 * wall, in ONE line (kind:'leaf', category:'Probing'). The single declared home for stylus-radius compensation —
 * the probe-surface block bundles it, replacing the per-wizard hand-rolled `#50=[#1925±#6]` copies.
 *
 * It is a DECLARED, TOGGLEABLE property: `enable` ON (default) → `#result=[#raw <dir> #radius]` (the TRUE surface);
 * `enable` OFF → `#result=#raw` (raw passthrough, the un-compensated tool-centre). Correct-by-default, reversible by a
 * config flip — never a big deal to change later. Emits exactly the legacy `assign` line, so a migration is byte-identical.
 *   raw    — the probe trigger var (#1925/#1926/#1927)
 *   result — where to store the compensated surface (#50/#101/…)
 *   radius — the stylus radius var or literal (#6)
 *   dir    — '+' (surface is +axis of the trigger) or '-'
 */
export const radiuscompBlock = {
    type: 'radiuscomp', label: 'Radius comp', kind: 'leaf', category: 'Probing',
    defaults: { raw: '#1925', result: '#50', radius: '#6', dir: '+', enable: true, note: '' },
    fields: ['raw', 'result', 'radius', 'dir', 'enable', 'note'],
    emit: (p) => {
        const result = p.result || '#50', raw = p.raw || '#1925';
        const on = p.enable !== false && p.enable !== 'false' && p.enable !== 0;   // default ON (correct-by-default)
        const expr = on ? `[${raw}${p.dir === '-' ? '-' : '+'}${p.radius || '#6'}]` : raw;
        const n = String(p.note ?? '').replace(/[()]/g, '').trim();
        return [n ? `${result}=${expr} ( ${n} )` : `${result}=${expr}`];
    },
};
