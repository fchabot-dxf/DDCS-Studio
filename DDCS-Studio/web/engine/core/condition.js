/**
 * engine/core/condition.js — canonical IF-condition handling.
 *
 * Normalizes FANUC-style operators (EQ/NE/GT/LT/GE/LE, <>, single =) to the
 * C-style operators DDCS uses, then splits LHS/RHS around the comparator and
 * delegates to the expression evaluator.
 */
import { evalExpr, validateExpression } from './expression.js';

const COMPARATOR_RE = /^(.*?)(==|!=|<=|>=|<|>)(.*)$/;

export function normalizeCondition(expr) {
    if (expr == null) return '';
    return String(expr)
        .trim()
        .replace(/\bEQ\b/gi, '==')
        .replace(/\bNE\b/gi, '!=')
        .replace(/\bGT\b/gi, '>')
        .replace(/\bLT\b/gi, '<')
        .replace(/\bGE\b/gi, '>=')
        .replace(/\bLE\b/gi, '<=')
        .replace(/\b<>\b/g, '!=')
        .replace(/(?<![<>!=])=(?![<>!=])/g, '==');
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
