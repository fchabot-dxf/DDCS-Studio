/**
 * wizards/ops/assign.js — SET # : a runtime variable assignment (kind:'leaf', category:'Variables').
 *
 * Emits a real macro-var write `#N = expr` (DDCS/Fanuc-style), distinct from the compile-time `Set` block
 * (which only binds a scope value for expression evaluation). The probe/WCS/setup macros are full of these:
 *   #1=500            literal
 *   #7=[0-#1]         expression
 *   #[#73]=#1927      indirect (write the var whose number is in #73)
 * `var` and `value` pass through verbatim, so indirect targets and bracketed expressions work as-is.
 */
export const assignBlock = {
    type: 'assign', label: 'Set #', kind: 'leaf', category: 'Variables',
    defaults: { var: '#100', value: '0', note: '' },
    fields: ['var', 'value', 'note'],
    scratch: [[100, 100]],   // t1085 — the default target this block WRITES
    emit: (p) => {
        const v = (p.var || '#100');
        const expr = (p.value === '' || p.value == null) ? '0' : p.value;
        const n = String(p.note ?? '').replace(/[()]/g, '').trim();
        return [n ? `${v}=${expr} ( ${n} )` : `${v}=${expr}`];
    },
};
