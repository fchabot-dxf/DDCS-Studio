/**
 * blocks/opStacks.js — maps the last STUDIO op to its block stack for the Blocks tab's "open as blocks".
 *
 * Each rewritten wizard exports a <name>Stack(params) builder (its single source of truth). This registry
 * picks the builder for the active op and returns the stack the Blocks tab should render. `bare` flags the
 * snippet ops (no program header/footer). Imports the wizards (which import opRecord); nothing imports this
 * back, so there's no cycle.
 */
import { getLastOp } from './opRecord.js';
import { num, r3 } from '../wizards/ops/util.js';
import { surfacingStack } from '../wizards/surfacingWizard.js';
import { pocketStack } from '../wizards/pocketWizard.js';
import { slotStack } from '../wizards/slotWizard.js';
import { drillStack } from '../wizards/drillWizard.js';
import { wcsStack } from '../wizards/wcsWizard.js';
import { edgeStack } from '../wizards/edgeWizard.js';

const BUILDERS = { surfacing: surfacingStack, pocket: pocketStack, slot: slotStack, drill: drillStack, wcs: wcsStack, edge: edgeStack };
// (No bare flag — framing is now Program Start/End BLOCKS in the stack; a snippet just omits them.)
const find = (prog, type) => (prog || []).find((b) => b && b.type === type);

// ── reverse sync: edited block stack → STUDIO form fields ──────────────────────────────────────────────
// Read the (possibly edited) block objects and return { formFieldId: value }. The inverse of each builder,
// co-located with it. Numeric/geometry params reconcile cleanly here; derived (stepover) and inset (pocket)
// params are intentionally left out for now. Only ops listed here reverse-sync.
// Read a STUDIO form field as a number (for un-deriving block values like stepover ← stepover% × toolØ).
const formNum = (id, d) => {
    if (typeof document === 'undefined') return d;
    const e = document.getElementById(id);
    return e ? num(e.value, d) : d;
};

const RECONCILERS = {
    surfacing(prog) {
        const down = find(prog, 'stepdown'), over = down && down.children && down.children[0], rg = over && over.params && over.params.region;
        if (!down || !over || !rg || !rg.params) return null;
        const tool = formNum('sf_toolDia', 12);   // un-derive stepover% from the absolute StepOver value
        return {
            sf_originX: rg.params.x, sf_originY: rg.params.y, sf_w: rg.params.w, sf_h: rg.params.h,
            sf_depth: down.params.to, sf_stepdown: down.params.by,
            sf_strategy: over.params.strategy === 'parallel' ? 'raster' : 'spiral',
            sf_stepoverPct: tool > 0 ? r3((num(over.params.stepover, 0) / tool) * 100) : undefined,
            sf_feed: over.params.feed, sf_plunge: over.params.plunge, sf_clearance: over.params.clearance,
        };
    },
    slot(prog) {
        const s = find(prog, 'slot');
        if (!s || !s.params) return null;
        const p = s.params;
        return {
            sl_ax: p.x0, sl_ay: p.y0, sl_bx: p.x1, sl_by: p.y1, sl_width: p.width,
            sl_toolDia: p.tool, sl_stepoverPct: p.stepoverPct, sl_depth: p.depth, sl_stepdown: p.stepdown,
            sl_feed: p.feed, sl_plunge: p.plunge, sl_clearance: p.clearance,
        };
    },
    pocket(prog) {
        const down = find(prog, 'stepdown');
        if (!down || !Array.isArray(down.children)) return null;   // too-small fallback (drill) → no reverse
        const over = down.children.find((c) => c.type === 'stepover'), rg = over && over.params && over.params.region;
        if (!over || !rg || !rg.params) return null;
        const tool = formNum('p_toolDia', 6), r = tool / 2;   // the Region is inset by the tool radius — un-inset it
        const f = {
            p_shape: rg.params.shape,
            p_depth: down.params.to, p_stepdown: down.params.by,
            p_strategy: over.params.strategy === 'parallel' ? 'raster' : 'spiral',
            p_stepoverPct: tool > 0 ? r3((num(over.params.stepover, 0) / tool) * 100) : undefined,
            p_feed: over.params.feed, p_plunge: over.params.plunge, p_clearance: over.params.clearance,
        };
        if (rg.params.shape === 'circle') {
            f.p_dia = r3(num(rg.params.w, 0) + tool); f.p_originX = rg.params.x; f.p_originY = rg.params.y;
        } else {
            f.p_w = r3(num(rg.params.w, 0) + tool); f.p_h = r3(num(rg.params.h, 0) + tool);
            f.p_originX = r3(num(rg.params.x, 0) - r); f.p_originY = r3(num(rg.params.y, 0) - r);
        }
        return f;
    },
    drill(prog) {
        const arr = find(prog, 'array');
        if (!arr || !arr.params) return null;
        const p = arr.params, hole = arr.children && arr.children[0];
        const f = { d_pattern: p.pattern, d_originX: p.x0, d_originY: p.y0, d_skip: p.skip || '' };
        if (p.pattern === 'circle') { f.d_dia = p.dia; f.d_count = p.count; f.d_startAngle = p.startAngle; }
        else if (p.pattern === 'line') { f.d_lcount = p.count; f.d_spacing = p.spacing; f.d_angle = p.angle; }
        else if (p.pattern === 'rect') { f.d_w = p.w; f.d_h = p.h; f.d_nx = p.nx; f.d_ny = p.ny; }
        else { f.d_cols = p.cols; f.d_rows = p.rows; f.d_dx = p.dx; f.d_dy = p.dy; }
        if (hole && hole.params) {
            const h = hole.params;
            f.d_method = hole.type === 'bore' ? 'helical' : 'peck';
            f.d_depth = h.depth; f.d_feed = h.feed; f.d_clearance = h.clearance;
            if (hole.type === 'bore') { f.d_holeDia = h.holeDia; f.d_toolDia = h.toolDia; f.d_pitch = h.pitch; }
            else f.d_peck = h.peck;
        }
        return f;
    },
};

let loadedSig = null, shownOp = null;
const sig = (op) => (op ? `${op.type}:${JSON.stringify(op.params)}` : null);

/** Does the active op have a block stack we can show? */
export function hasActiveOpStack() {
    const op = getLastOp();
    return !!(op && BUILDERS[op.type]);
}

/**
 * The active op as { blocks, bare }, or null when there's nothing NEW to show — no op, an op with no
 * stack builder yet (probe family still in progress), or the same op already loaded (so re-opening the
 * Blocks tab doesn't clobber block-side edits). Loading a changed op refreshes the view.
 */
export function buildActiveOpStack() {
    const op = getLastOp(), s = sig(op);
    if (!op || !BUILDERS[op.type]) { shownOp = null; return null; }
    shownOp = op.type;                      // remember what the Blocks tab is showing (for reverse sync)
    if (s === loadedSig) return null;       // already loaded → don't clobber block-side edits
    loadedSig = s;
    return { blocks: BUILDERS[op.type](op.params) };
}

/**
 * Reverse sync — the form fields that reflect the current (edited) block stack, or null if the shown op
 * has no reconciler or the stack doesn't match its shape. The caller sets the fields + re-runs the wizard.
 */
export function reconcileActiveOp() {
    if (!shownOp || !RECONCILERS[shownOp]) return null;
    const prog = (typeof window !== 'undefined' && window.ddcsGetBlockProgram) ? window.ddcsGetBlockProgram() : null;
    if (!prog || !prog.length) return null;
    const fields = RECONCILERS[shownOp](prog);
    return fields ? { type: shownOp, fields } : null;
}
