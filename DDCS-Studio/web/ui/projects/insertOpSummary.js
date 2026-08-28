/**
 * ui/projects/insertOpSummary.js — a cheap, one-line params summary for a saved op record (BACKLOG #37's
 * picker: "a one-line params summary derived from the same params the marker carries -- pattern, size, depth --
 * whatever that op's own binding labels give cheaply"). Pure, no DOM.
 *
 * Two sources, by op family: a user_* op's own DECLARED bindings (userOps.js — {param, label}, the SAME labels
 * its form renders) give the truest labels; a built-in op has no single label registry (each wizard hand-builds
 * its own form), so a small DECLARED priority list of common param keys stands in — cheap and legible, not a
 * per-op label lookup this turn would have to invent 30+ of.
 */
import { getUserDef, USER_OP_PREFIX } from '../../blocks/userOps.js';

// Priority order — the first few of these actually PRESENT in a built-in op's params win the summary. Picked
// from the vocabulary opSchema.js's own SCHEMA already uses across the op catalogue (pattern/dia/depth/w/h/…).
const BUILTIN_KEYS = [
    'pattern', 'dia', 'holeDia', 'toolDia', 'patternDia', 'depth', 'width', 'w', 'h', 'count',
    'angle', 'stepoverPct', 'feed', 'text', 'msg', 'x0', 'y0',
];

const MAX_ITEMS = 3;

function fmtVal(v) {
    if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Math.round(v * 1000) / 1000);
    return String(v);
}

/** { opType, params } -> a one-line "label: value · label: value" summary, or '' if nothing cheap to show. */
export function summarizeOpParams(opType, params) {
    const p = params || {};
    const items = [];
    if (String(opType).startsWith(USER_OP_PREFIX)) {
        const def = getUserDef(opType);
        for (const b of (def && def.bindings) || []) {
            if (items.length >= MAX_ITEMS) break;
            if (!b || b.param == null) continue;
            const v = p[b.param];
            if (v === undefined || v === null || v === '') continue;
            items.push(`${b.label || b.param}: ${fmtVal(v)}`);
        }
    } else {
        for (const key of BUILTIN_KEYS) {
            if (items.length >= MAX_ITEMS) break;
            const v = p[key];
            if (v === undefined || v === null || v === '') continue;
            if (typeof v !== 'number' && typeof v !== 'string') continue;
            items.push(`${key}: ${fmtVal(v)}`);
        }
    }
    return items.join(' · ');
}
