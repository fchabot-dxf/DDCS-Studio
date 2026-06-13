/**
 * wizards/ops/expr.js — tiny arithmetic evaluator for parametric fields (the "Math" backbone).
 *
 * Supports  + - * / %, unary ±, parentheses, decimals, and variable names resolved against a
 * `scope` object (Set blocks + the Count loop index). Pure recursive descent — no eval/Function,
 * no dependencies. Throws on a parse error or an unknown variable; callers treat a throw as
 * "this isn't an expression" and keep the raw value (e.g. a select like 'grid').
 */
export function evalExpr(src, scope = {}) {
    if (typeof src === 'number') return src;
    const s = String(src);
    let i = 0;
    const ws = () => { while (i < s.length && /\s/.test(s[i])) i++; };

    function add() {
        let v = mul();
        for (;;) { ws(); const c = s[i];
            if (c === '+') { i++; v += mul(); }
            else if (c === '-') { i++; v -= mul(); }
            else return v;
        }
    }
    function mul() {
        let v = unary();
        for (;;) { ws(); const c = s[i];
            if (c === '*') { i++; v *= unary(); }
            else if (c === '/') { i++; v /= unary(); }
            else if (c === '%') { i++; v %= unary(); }
            else return v;
        }
    }
    function unary() {
        ws();
        if (s[i] === '-') { i++; return -unary(); }
        if (s[i] === '+') { i++; return unary(); }
        return primary();
    }
    function primary() {
        ws();
        if (s[i] === '(') { i++; const v = add(); ws(); if (s[i] !== ')') throw new Error('expected )'); i++; return v; }
        const n = /^\d*\.?\d+(?:e[-+]?\d+)?/i.exec(s.slice(i));
        if (n) { i += n[0].length; return parseFloat(n[0]); }
        const id = /^[A-Za-z_]\w*/.exec(s.slice(i));
        if (id) { i += id[0].length; if (id[0] in scope) return Number(scope[id[0]]); throw new Error('unknown var: ' + id[0]); }
        throw new Error('unexpected: ' + (s[i] ?? 'end'));
    }

    ws(); if (i >= s.length) throw new Error('empty expression');
    const v = add(); ws();
    if (i < s.length) throw new Error('trailing input: ' + s.slice(i));
    if (!Number.isFinite(v)) throw new Error('not a finite number');
    return v;
}
