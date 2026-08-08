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
        // t1583 — the COMMA is a token ONLY so a function call can separate its arguments. It is deliberately
        // NOT given any meaning in the grammar outside that position: `[1, 2]` parses `1`, then finds `,` where
        // it needs `]`, and the trailing-token check added at t1573 makes the whole expression unresolvable.
        // Adding the token does not add leniency back — the one place it is consumed is parseFactor's call arm.
        if (c === '#' || c === '[' || c === ']' || c === '+' || c === '-' || c === '*' || c === '/' || c === ',') {
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
        // t1601 — AN UNCLOSED BRACKET IS UNRESOLVABLE, and the hardware said so. Bench probe S6f ran
        //   `#190 = [1 + 2`  ->  Unrecognized file format: L20[M30]
        // (photo: bridge/controllers/v4.1/verify/S6f-result-L20-M30.jpg). The controller consumed everything
        // after the unclosed `[` hunting for its close, hit EOF, and blamed the LAST line. This parser used to
        // CLOSE the bracket silently — `[1 + 2` read as 3, a clean preview for a file the machine refuses, and
        // (probe S6e) refuses only AFTER running every line ahead of the fault. Third member of the t1573
        // family (trailing tokens, the stray comma, now this), and the last KNOWN place the sim was more
        // lenient than the machine. Every bracket-closing site below now requires its `]`.
        //
        // BLAME DIVERGES FROM THE HARDWARE ON PURPOSE: expressions are validated per LINE, so the refusal
        // lands on the line holding the OPENING bracket — stricter reporting than the machine's EOF-blame,
        // same verdict, and the line the operator actually needs.
        // ⚠ SYNTAX, NOT VALUE (same separation as t1573): an unset #var still reads as `unsetValue`.
        if (t === '[') {
            p += 1;
            const v = parseExpr();
            if (v === null) return null;
            if (peek() !== ']') return null;   // unclosed group — S6f
            p += 1;
            return v;
        }
        if (t && typeof t === 'object' && t.fn) {
            const fn = MACRO_FUNCTIONS[t.fn];
            if (!fn) return null;
            p += 1;
            if (peek() !== '[') return null;
            p += 1;
            const arg = parseExpr();
            if (arg === null) return null;
            // t1583 — TWO-ARGUMENT ATAN, COMMA FORM: `ATAN[a, b]`. Hardware-attested, not inferred — bench probe
            // S5o ran `#190 = ATAN[1, 1] * 100` on the V4.1 and read back 4500, i.e. 45 DEGREES (not radians, not
            // a 0-1 fraction). The sim used to reject this outright because its lexer had no comma, which made it
            // STRICTER THAN THE MACHINE — the opposite failure to everything else in this arc, and the one that
            // matters most next: the send gate refuses what the parser refuses, so shipping the gate first would
            // have blocked a legitimate job on day one. A false warning is a nuisance; a false refusal stops work.
            //
            // Only ATAN takes two arguments; a comma in any other call is an arity error, not a tolerated extra.
            if (peek() === ',') {
                if (t.fn !== 'ATAN') return null;
                p += 1;
                const argB = parseExpr();
                if (argB === null) return null;
                if (peek() !== ']') return null;   // the closing bracket is REQUIRED here — no leniency reintroduced
                p += 1;
                return Math.atan2(arg, argB) * 180 / Math.PI;
            }
            if (peek() !== ']') return null;   // t1601 — an unclosed call bracket is as fatal as an unclosed group
            p += 1;
            // Fanuc/DDCS two-operand arctangent: ATAN[a]/[b] = atan2(a, b) in DEGREES (quadrant-correct).
            // Only the bracketed `/[…]` form is atan2; `ATAN[a]/2` stays a plain division of the single-arg result.
            if (t.fn === 'ATAN' && peek() === '/' && toks[p + 1] === '[') {
                p += 2;                       // consume '/' and '['
                const arg2 = parseExpr();
                if (arg2 === null) return null;
                if (peek() !== ']') return null;   // t1601
                p += 1;
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
                if (peek() !== ']') return null;   // t1601 — indirect #[expr] requires its close too
                p += 1;
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

    // t1573 — TRAILING INPUT IS A MALFORMED LINE, and the controller says so. Bench-run on the V4.1:
    //   S6a  `#190 = #191k8`      -> Unrecognized file format: L11[#190 = #191k8]
    //   S6b  `#190 = [1 + 2 k 8]` -> Unrecognized file format: L9[#190 = [1 + 2 k 8]]
    // The parser used to return whatever it had managed to consume and drop the rest, so `#191k8` read as
    // `#191` and `[1 + 2 k 8]` read as `3` — a clean-looking preview for a file the machine REFUSES to run.
    // That is the sim lying in the most dangerous direction, "everything is fine", and it is not academic:
    // probe S6e proved execution is PARTIAL — every line before the fault runs, then the machine halts with
    // the tool in the material. Leftover tokens now make the whole expression unresolvable, which is exactly
    // how the controller treats them. It also settles a disagreement that already existed: the WIZARD
    // evaluator (wizards/ops/expr.js) has always thrown on `trailing input`; the sim never did. One
    // behaviour, three agreeing parties — machine, sim, wizard.
    //
    // ⚠ THIS IS SYNTAX, NOT VALUE. An UNSET variable is a different and CORRECT concern that this must not
    // touch: `#500` with no value still reads as `unsetValue` (0 for the execution engine, null for the
    // preview). That path lives inside parseFactor's `#` branch and is untouched — the check below is purely
    // "did the grammar consume every token", asked once, at the top.
    const v = parseExpr();
    if (v === null) return null;
    if (p < toks.length) return null;   // tokens the grammar could not account for → malformed, like the machine
    return v;
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
