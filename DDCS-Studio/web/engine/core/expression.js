/**
 * engine/core/expression.js — canonical DDCS macro expression evaluator.
 *
 * Grammar: numbers, [ ] grouping, + - * /, unary +/-, direct #N and
 * indirect #[expr] variable references.
 *
 * evalExpr(str, vars, { unsetValue }) — single evaluator with one knob:
 *   unsetValue: what an UNSET #variable reads as.
 *     - null (default): the whole expression resolves to null ("unresolvable"),
 *       matching the preview parser/simulator behavior of skipping moves it
 *       cannot resolve.
 *     - 0: DDCS-emulator behavior — uninitialized variables read as 0
 *       (the execution engine uses this).
 */

/**
 * DDCS macro math functions (Fanuc-style, trig in DEGREES).
 * Usage in macros: ABS[#72], ATAN[#52/#53], SQRT[#100], ROUND[#5], FIX/FUP, ...
 */
const MACRO_FUNCTIONS = {
    ABS: Math.abs,
    SQRT: Math.sqrt,
    ROUND: Math.round,
    FIX: Math.floor,
    FUP: Math.ceil,
    LN: Math.log,
    EXP: Math.exp,
    SIN: (d) => Math.sin(d * Math.PI / 180),
    COS: (d) => Math.cos(d * Math.PI / 180),
    TAN: (d) => Math.tan(d * Math.PI / 180),
    ASIN: (v) => Math.asin(v) * 180 / Math.PI,
    ACOS: (v) => Math.acos(v) * 180 / Math.PI,
    ATAN: (v) => Math.atan(v) * 180 / Math.PI,
};

/** Tokenize an expression string. Returns null on an unexpected character. */
function lex(s) {
    const toks = [];
    let i = 0;
    while (i < s.length) {
        const c = s[i];
        if (c === ' ' || c === '\t') { i += 1; continue; }
        if ((c >= '0' && c <= '9') || c === '.') {
            let num = '';
            while (i < s.length && ((s[i] >= '0' && s[i] <= '9') || s[i] === '.')) {
                num += s[i];
                i += 1;
            }
            if (num === '.' || num.length === 0) return null;
            toks.push(Number.parseFloat(num));
            continue;
        }
        if (c === '#' || c === '[' || c === ']' || c === '+' || c === '-' || c === '*' || c === '/') {
            toks.push(c);
            i += 1;
            continue;
        }
        if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z')) {
            let name = '';
            while (i < s.length && /[A-Za-z]/.test(s[i])) { name += s[i]; i += 1; }
            toks.push({ fn: name.toUpperCase() });
            continue;
        }
        return null;
    }
    return toks;
}

/**
 * Evaluate a macro expression.
 * @param {string} str
 * @param {Map<number, number>} vars
 * @param {{unsetValue?: number|null}} [opts]
 * @returns {number|null} value, or null if unresolvable
 */
export function evalExpr(str, vars, opts = {}) {
    const unsetValue = opts.unsetValue === undefined ? null : opts.unsetValue;
    if (str == null) return null;
    const s = String(str).trim();
    if (s === '') return null;

    const toks = lex(s);
    if (toks === null) return null;

    let p = 0;
    const peek = () => toks[p];

    function parseExpr() {
        let v = parseTerm();
        while (v !== null && (peek() === '+' || peek() === '-')) {
            const op = toks[p++];
            const r = parseTerm();
            if (r === null) return null;
            v = op === '+' ? v + r : v - r;
        }
        return v;
    }
    function parseTerm() {
        let v = parseFactor();
        while (v !== null && (peek() === '*' || peek() === '/')) {
            const op = toks[p++];
            const r = parseFactor();
            if (r === null) return null;
            v = op === '*' ? v * r : (r !== 0 ? v / r : null);
        }
        return v;
    }
    function parseFactor() {
        const t = peek();
        if (t === '+') { p += 1; return parseFactor(); }
        if (t === '-') { p += 1; const f = parseFactor(); return f === null ? null : -f; }
        if (t === '[') {
            p += 1;
            const v = parseExpr();
            if (peek() === ']') p += 1;
            return v;
        }
        if (t && typeof t === 'object' && t.fn) {
            const fn = MACRO_FUNCTIONS[t.fn];
            if (!fn) return null;
            p += 1;
            if (peek() !== '[') return null;
            p += 1;
            const arg = parseExpr();
            if (peek() === ']') p += 1;
            if (arg === null) return null;
            // Fanuc/DDCS two-operand arctangent: ATAN[a]/[b] = atan2(a, b) in DEGREES (quadrant-correct).
            // Only the bracketed `/[…]` form is atan2; `ATAN[a]/2` stays a plain division of the single-arg result.
            if (t.fn === 'ATAN' && peek() === '/' && toks[p + 1] === '[') {
                p += 2;                       // consume '/' and '['
                const arg2 = parseExpr();
                if (peek() === ']') p += 1;
                if (arg2 === null) return null;
                return Math.atan2(arg, arg2) * 180 / Math.PI;
            }
            return fn(arg);
        }
        if (t === '#') {
            p += 1;
            let idx;
            if (peek() === '[') {
                p += 1;
                idx = parseExpr();
                if (peek() === ']') p += 1;
            } else if (typeof peek() === 'number') {
                idx = toks[p++];
            } else {
                return null;
            }
            if (idx == null || !Number.isFinite(idx)) return null;
            const v = vars.get(Math.round(idx));
            return (v === undefined || v === null) ? unsetValue : v;
        }
        if (typeof t === 'number') { p += 1; return t; }
        return null;
    }

    return parseExpr();
}

/**
 * Validate expression syntax without needing variable values.
 * Same grammar as evalExpr; every #ref is treated as resolvable.
 * @returns {boolean}
 */
export function validateExpression(str) {
    if (str == null) return false;
    const s = String(str).trim();
    if (s === '') return false;
    // Dummy vars read as 1 (not 0) so syntactically-valid divisions like
    // ATAN[#52/#53] don't false-fail on division-by-zero during validation.
    const dummy = { get: () => 1 };
    return evalExpr(s, dummy, { unsetValue: 1 }) !== null;
}
