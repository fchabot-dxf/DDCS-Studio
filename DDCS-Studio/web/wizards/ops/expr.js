/**
 * wizards/ops/expr.js — tiny arithmetic evaluator for parametric fields (the "Math" backbone).
 *
 * Supports  + - * / %, unary ±, parentheses, decimals, a ternary, the functions below, and variable
 * names resolved against a `scope` object. Pure recursive descent — no eval/Function, no dependencies.
 * Throws on a parse error or an unknown variable; callers treat a throw as "this isn't an expression"
 * and keep the raw value (e.g. a select like 'grid'). Since t1566, `blocks/lint.js` turns that throw
 * into a NAMED, block-tagged warning for fields that are actually meant to compute, so a typo is no
 * longer indistinguishable from a deliberate value.
 *
 * ONE SCOPE, CONTENTS FROM THE CALLER (t1566 ruling). The `scope` object is populated by whoever calls:
 * Set blocks and the Count loop index today, wizard params when that face lands. Deliberately NOT two
 * lookup rules — a second resolution path is the duplicated-inference trap that caused t1562. If a
 * wizard param ever collides with a Set-block name that is a REAL collision and belongs in the lint,
 * not partitioned away behind separate namespaces.
 *
 * ⚠ NO CONTROL FLOW, by ruling — guard blocks own that and keep owning it. The ternary is a VALUE
 * selector, not a branch.
 *
 * COMPARISONS (t1630 — the deliberate widening t1566 deferred, now ruled in): `<  >  <=  >=  ==  !=`,
 * SYMBOLS ONLY (no word forms), yielding 1/0 as VALUES — a comparison is an expression result, never a
 * branch; guard blocks keep owning control flow. Conventional precedence: relational binds tighter than
 * equality, both sit between the ternary and `+ -` (so `a + 1 < b ? x : y` reads ((a+1) < b) ? x : y).
 * The ternary's condition keeps the ≠0-truthy convention (`resolveBool`'s rule) — `a < b ? x : y` now
 * composes naturally on top of it. A bare `=` or `!` is a NAMED error pointing at `==` / `!=`.
 */

/**
 * The DECLARED function table — name → arity + implementation. Adding a function is a data edit here,
 * not new parser code. Lowercase on purpose: the DDCS macro language has its OWN uppercase ABS/ROUND/
 * SQRT set (engine/core/expression.js) which is a different language for a different consumer, and
 * accepting both spellings here would blur two things that must stay separate. A wrong case therefore
 * lands as "unknown function: ABS", which the error names explicitly.
 */
/**
 * t1577 — THE FAILURE SENTINEL. A scope binding whose own expression did not resolve.
 *
 * A Set block used to bind `0` when its value failed to parse, which reproduced the very bug t1575 fixed one
 * hop upstream: `w = widht / 2` bound 0, and every `G0 Xw` downstream emitted `G0 X0` — a legal line, wrong
 * place, silent, with the typo laundered out a second time. A coordinate has a machine-side line that can
 * carry the error; a Set value does not, because Studio consumes it before any G-code exists.
 *
 * So the failure PROPAGATES instead of being substituted: the name is still bound (it WAS declared — this is
 * not an unknown variable), but bound to this sentinel, and any expression that reads it fails with a message
 * naming the identifier. Downstream that failure reaches the consuming line, which emits verbatim — landing
 * the error back in front of the machine, on a line there IS something to refuse.
 *
 * A frozen object rather than NaN: NaN would be indistinguishable from arithmetic that merely overflowed, and
 * the whole point is that this state is DECLARED and recognisable at the one place identifiers are resolved.
 */
export const UNRESOLVED = Object.freeze({ __unresolved: true });

const FUNCS = {
    abs:   { min: 1, max: 1, fn: (a) => Math.abs(a) },
    round: { min: 1, max: 1, fn: (a) => Math.round(a) },
    ceil:  { min: 1, max: 1, fn: (a) => Math.ceil(a) },   // t1613 — the derived `passes` field counts whole Z passes: ceil(depth / stepdown); lowercase per this table's doctrine
    min:   { min: 2, max: Infinity, fn: (...a) => Math.min(...a) },
    max:   { min: 2, max: Infinity, fn: (...a) => Math.max(...a) },
};
export const EXPR_FUNCTIONS = Object.keys(FUNCS);   // one source for docs/authoring surfaces

export function evalExpr(src, scope = {}) {
    if (typeof src === 'number') return src;
    const s = String(src);
    let i = 0;
    const ws = () => { while (i < s.length && /\s/.test(s[i])) i++; };

    // ternary sits BELOW everything in precedence (loosest) and is right-associative, so `a ? b : c ? d : e`
    // reads as `a ? b : (c ? d : e)` — the conventional shape. Condition truthiness is ≠ 0 (see header).
    function ternary() {
        const cond = equality();
        ws();
        if (s[i] !== '?') return cond;
        i++;
        const thenV = ternary();
        ws();
        if (s[i] !== ':') throw new Error('expected : in ternary');
        i++;
        const elseV = ternary();
        return cond !== 0 ? thenV : elseV;
    }
    // t1630 — COMPARISONS, two conventional levels: equality (== !=) looser than relational (< > <= >=),
    // both yielding 1/0 as plain VALUES (never a branch — guards own control flow). Left-associative like
    // add/mul. A bare `=` or `!` names its fix rather than surfacing as "trailing input".
    function equality() {
        let v = relational();
        for (;;) { ws(); const two = s.slice(i, i + 2);
            if (two === '==') { i += 2; v = (v === relational()) ? 1 : 0; }
            else if (two === '!=') { i += 2; v = (v !== relational()) ? 1 : 0; }
            else if (s[i] === '=') throw new Error("single '=' is not an operator (use == to compare)");
            else if (s[i] === '!') throw new Error("'!' is not an operator (use != for not-equal; for boolean not, compare == 0)");
            else return v;
        }
    }
    function relational() {
        let v = add();
        for (;;) { ws(); const two = s.slice(i, i + 2);
            if (two === '<=') { i += 2; v = (v <= add()) ? 1 : 0; }
            else if (two === '>=') { i += 2; v = (v >= add()) ? 1 : 0; }
            else if (s[i] === '<') { i++; v = (v < add()) ? 1 : 0; }
            else if (s[i] === '>') { i++; v = (v > add()) ? 1 : 0; }
            else return v;
        }
    }
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
        if (s[i] === '(') { i++; const v = ternary(); ws(); if (s[i] !== ')') throw new Error('expected )'); i++; return v; }
        const n = /^\d*\.?\d+(?:e[-+]?\d+)?/i.exec(s.slice(i));
        if (n) { i += n[0].length; return parseFloat(n[0]); }
        const id = /^[A-Za-z_]\w*/.exec(s.slice(i));
        if (id) {
            i += id[0].length;
            ws();
            if (s[i] === '(') {   // a CALL — an identifier is only a function when it is applied
                i++;
                const args = [];
                ws();
                if (s[i] === ')') i++;
                else {
                    for (;;) {
                        args.push(ternary());
                        ws();
                        if (s[i] === ',') { i++; continue; }
                        if (s[i] === ')') { i++; break; }
                        throw new Error('expected , or ) in ' + id[0] + '()');
                    }
                }
                const f = Object.prototype.hasOwnProperty.call(FUNCS, id[0]) ? FUNCS[id[0]] : null;
                if (!f) throw new Error('unknown function: ' + id[0] + ' (known: ' + EXPR_FUNCTIONS.join(', ') + ')');
                if (args.length < f.min || args.length > f.max) {
                    const want = f.max === Infinity ? `at least ${f.min}` : `${f.min}`;
                    throw new Error(`${id[0]}() takes ${want} argument${f.min === 1 && f.max === 1 ? '' : 's'}, got ${args.length}`);
                }
                return f.fn(...args);
            }
            if (id[0] in scope) {
                // t1577 — the name IS bound, but to a failure. Distinct from "unknown var": the author declared
                // it, so saying it does not exist would send them looking in the wrong place. Name the binding
                // and let the failure propagate to whatever line consumes it.
                if (scope[id[0]] === UNRESOLVED) throw new Error(id[0] + ' did not resolve');
                return Number(scope[id[0]]);
            }
            throw new Error('unknown var: ' + id[0]);
        }
        throw new Error('unexpected: ' + (s[i] ?? 'end'));
    }

    ws(); if (i >= s.length) throw new Error('empty expression');
    const v = ternary(); ws();
    if (i < s.length) throw new Error('trailing input: ' + s.slice(i));
    if (!Number.isFinite(v)) throw new Error('not a finite number');
    return v;
}
