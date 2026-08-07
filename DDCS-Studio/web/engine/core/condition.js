/**
 * engine/core/condition.js — canonical IF-condition handling.
 *
 * Normalizes FANUC-style operators (EQ/NE/GT/LT/GE/LE, <>, single =) to the
 * C-style operators DDCS uses, then splits LHS/RHS around the comparator and
 * delegates to the expression evaluator.
 */
import { evalExpr, validateExpression } from './expression.js';

const COMPARATOR_RE = /^(.*?)(==|!=|<=|>=|<|>)(.*)$/;

// FANUC/DM500 word operators → C-style. DM500 GLUES the operator to its operands (probe.nc `#571EQ0`, the miss-check
// `#864GE[…]`) — there is NO word boundary between a digit and `GE`/`EQ`, so the old `\bOP\b` never matched the glued form and
// DM500 IF/WHILE conditions silently evaluated false in the sim. DDCS conditions contain no alpha identifiers other than these
// operators (operands are #vars / numbers / brackets / arithmetic), so matching them boundary-free is unambiguous. Longest-first
// (GE before GT so `GE` isn't shadowed). (Expert/V4.1/Centroid emit symbolic ops → these replacements are a no-op for them.)
const WORD_OP = { EQ: '==', NE: '!=', GE: '>=', LE: '<=', GT: '>', LT: '<' };
export function normalizeCondition(expr) {
    if (expr == null) return '';
    return String(expr)
        .trim()
        .replace(/EQ|NE|GE|LE|GT|LT/gi, (m) => WORD_OP[m.toUpperCase()])
        .replace(/<>/g, '!=')
        .replace(/(?<![<>!=])=(?![<>!=])/g, '==');
}

/**
 * t1573 — strip ONE outer bracket pair, but ONLY when it genuinely WRAPS the whole condition.
 *
 * The callers used to do `.replace(/^\[|\]$/g, '')`, an ALTERNATION: it strips a leading `[` and a trailing `]`
 * INDEPENDENTLY, so a condition whose comparison sits OUTSIDE the bracket lost its opening `[` and kept the
 * matching `]`:
 *     IF [#14 / 2 - FIX[#14 / 2]] > 0.001 GOTO61     (the wall-finish "every Nth level" pause gate)
 *   →   #14 / 2 - FIX[#14 / 2]] > 0.001              ← unbalanced
 * That parsed only because the expression evaluator used to ignore trailing tokens; the stray `]` was silently
 * dropped and the condition happened to come out right. The moment the evaluator started rejecting trailing
 * input (matching the V4.1, which refuses such lines outright) the LHS became unresolvable and the branch
 * silently stopped firing — the wall's last-level pause-skip inverted. A latent defect, not a new one.
 *
 * Bracket-matching, not anchors: the pair is removed only when the FIRST `[` closes at the LAST character.
 *   "[#100 > 5]"                → "#100 > 5"    (wrapped — strip)
 *   "[#14/2 - FIX[#14/2]] > 0"  → unchanged     (comparison outside — the LHS is a valid bracketed expression)
 *   "[a] > [b]"                 → unchanged     (first bracket closes early)
 */
export function stripWrappingBrackets(expr) {
    const t = String(expr == null ? '' : expr).trim();
    if (!t.startsWith('[') || !t.endsWith(']')) return t;
    let depth = 0;
    for (let i = 0; i < t.length; i += 1) {
        if (t[i] === '[') depth += 1;
        else if (t[i] === ']') {
            depth -= 1;
            if (depth === 0) return i === t.length - 1 ? t.slice(1, -1).trim() : t;
        }
    }
    return t;   // unbalanced — leave it alone and let the evaluator refuse it
}

/**
 * Evaluate a condition like "#1922!=2" or "[#100+#200]>50".
 * @param {string} expr - raw condition text (brackets around the whole
 *   condition should already be removed by the caller)
 * @param {Map<number, number>} vars
 * @param {{unsetValue?: number|null}} [opts] - forwarded to evalExpr
 * @returns {boolean}
 */
export function evaluateCondition(expr, vars, opts = {}) {
    const normalized = normalizeCondition(expr);
    const match = normalized.match(COMPARATOR_RE);
    if (!match) return false;

    const left = evalExpr(match[1].trim(), vars, opts);
    const op = match[2];
    const right = evalExpr(match[3].trim(), vars, opts);
    if (left == null || right == null) return false;

    switch (op) {
        case '==': return left === right;
        case '!=': return left !== right;
        case '<=': return left <= right;
        case '>=': return left >= right;
        case '<': return left < right;
        case '>': return left > right;
        default: return false;
    }
}

/** Validate condition syntax without variable values. @returns {boolean} */
export function validateCondition(expr) {
    if (expr == null) return false;
    const normalized = normalizeCondition(expr);
    const match = normalized.match(COMPARATOR_RE);
    if (!match) return false;
    return validateExpression(match[1].trim()) && validateExpression(match[3].trim());
}
