/**
 * wizards/ops/set.js — SET: bind a variable (input or derived). kind:'var', category:'Variables'.
 *
 * Tinkercad-Codeblocks "Set [name] to [value]". The behaviour lives in the emit fold (it owns the
 * variable scope): Set evaluates `value` against the current scope and binds `name`, so later
 * fields can reference it (`grandeur/4 - 2`). Input vs derived is just whether `value` is a number
 * or a formula — both serialize the same way.
 */
export const setBlock = {
    type: 'set', label: 'Set', kind: 'var', category: 'Variables',
    defaults: { name: 'a', value: 0 },
    fields: ['name', 'value'],
};
