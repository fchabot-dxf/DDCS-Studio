/**
 * wizards/ops/math.js — MATH reporter (kind:'reporter'). A *value* block: a binary op on two value sockets
 * (`a`, `b`). Each socket holds a scalar OR another reporter, so value sockets nest (Math in Math, a
 * Variable in Math). `reduce` resolves its operands through the supplied `rc` (resolve-child) recursively.
 */
export const mathBlock = {
    type: 'math', label: 'Math', kind: 'reporter', category: 'Math',
    defaults: { a: 0, op: '/', b: 0 },
    fields: ['a', 'op', 'b'],          // a, b are value sockets; op is a select (+ − × ÷ %)
    reduce: (p, scope, rc) => {
        const a = rc(p.a), b = rc(p.b);
        switch (p.op) {
            case '+': return a + b;
            case '-': return a - b;
            case '*': return a * b;
            case '/': return a / b;
            case '%': return a % b;
            default: return a;
        }
    },
};
