/**
 * blocks/opStacks.js — maps the last STUDIO op to its block stack for the Blocks tab's "open as blocks".
 *
 * Each rewritten wizard exports a <name>Stack(params) builder (its single source of truth). This registry
 * picks the builder for the active op and returns the stack the Blocks tab should render. `bare` flags the
 * snippet ops (no program header/footer). Imports the wizards (which import opRecord); nothing imports this
 * back, so there's no cycle.
 */
import { getLastOp, recordOp } from './opRecord.js';
import { num, r3 } from '../wizards/ops/util.js';
import { parseGcodeToStack } from './gcodeToStack.js';                       // decode a non-builder op's G-code → blocks
import { resolveActivePost } from '../wizards/dialects/index.js';
import { getActiveProfile } from '../shared/js/profiles/controllerProfiles.js';
const dialectOpts = () => { try { return { dialect: resolveActivePost(getActiveProfile().id) }; } catch (_) { return {}; } };
import { surfacingStack } from '../wizards/surfacingWizard.js';
import { pocketStack } from '../wizards/pocketWizard.js';
import { slotStack } from '../wizards/slotWizard.js';
import { drillStack } from '../wizards/drillWizard.js';
import { wcsStack } from '../wizards/wcsWizard.js';
import { edgeStack } from '../wizards/edgeWizard.js';
import { commStack } from '../wizards/communicationWizard.js';
import { middleStack } from '../wizards/middleWizard.js';
import { cornerStack } from '../wizards/cornerWizard.js';
import { alignmentStack } from '../wizards/alignmentWizard.js';
import { atcLengthStack } from '../wizards/atcLengthWizard.js';
import { atcToolCheckStack } from '../wizards/atcToolCheckWizard.js';
import { atcWarmupStack } from '../wizards/atcWarmupWizard.js';
import { atcChangeStack } from '../wizards/atcChangeWizard.js';
import { atcTestStack } from '../wizards/atcTestWizard.js';
import { atcTableStack } from '../wizards/atcTableWizard.js';
import { circularStack } from '../wizards/circularWizard.js';
import { rotaryClockStack } from '../wizards/rotaryClockWizard.js';
import { rotaryCenterStack } from '../wizards/rotaryCenterWizard.js';
import { textStack } from '../wizards/textWizard.js';

const BUILDERS = {
    surfacing: surfacingStack, pocket: pocketStack, slot: slotStack, drill: drillStack,
    wcs: wcsStack, edge: edgeStack, comm: commStack, middle: middleStack, corner: cornerStack, alignment: alignmentStack,
    atc_length: atcLengthStack, atc_check: atcToolCheckStack, atc_warmup: atcWarmupStack, atc_change: atcChangeStack, atc_test: atcTestStack, atc_table: atcTableStack,
    circular: circularStack, rotary_clock: rotaryClockStack, rotary_center: rotaryCenterStack, text: textStack,
};
// (No bare flag — framing is now Program Start/End BLOCKS in the stack; a snippet just omits them.)
// find() recurses into block children (incl. op-containers), so reconcilers locate their inner blocks
// (e.g. a 'stepdown') whether or not the op is wrapped in an op-container.
const find = (prog, type) => {
    for (const b of (prog || [])) {
        if (!b) continue;
        if (b.type === type) return b;
        if (b.children) { const f = find(b.children, type); if (f) return f; }
    }
    return null;
};

// ── op CONTAINERS ───────────────────────────────────────────────────────────────────────────────────────
// Each accumulated op is wrapped in a { type:'op', opType, label, requires, params, children } container so a
// loaded program keeps the op RECORD and emit can gate it per post (capable → children; incapable → marker;
// blocks/blockModel.js). `requires` is derived from the atoms the op uses: #var atoms → 'vars', flow atoms →
// 'flow' (both absent on grbl). params ride along for op-form editing. See REMINDERS "Op-containers".
const OP_LABELS = {
    surfacing: 'Surfacing', pocket: 'Pocket', slot: 'Slot', drill: 'Drill', text: 'Text',
    wcs: 'WCS', edge: 'Edge Probe', middle: 'Middle Probe', corner: 'Corner Probe', alignment: 'Alignment',
    circular: 'Circular Probe', rotary_clock: 'Rotary Clock', rotary_center: 'Rotary Centre', comm: 'Communication',
    atc_length: 'Tool Length', atc_check: 'Tool Check', atc_warmup: 'Spindle Warmup', atc_change: 'Tool Change', atc_test: 'ATC Test',
};
const VAR_ATOMS = new Set(['assign', 'probe', 'proberead', 'readmachine', 'setworkoffset', 'tooloffset', 'machinemove']);
const FLOW_ATOMS = new Set(['ifgoto', 'goto', 'label']);
function scanAtoms(blocks, set) {
    for (const b of (blocks || [])) {
        if (!b) continue;
        if (set.has(b.type)) return true;
        if (b.children && scanAtoms(b.children, set)) return true;
    }
    return false;
}
function opRequires(children) {
    const r = [];
    if (scanAtoms(children, VAR_ATOMS)) r.push('vars');
    if (scanAtoms(children, FLOW_ATOMS)) r.push('flow');
    return r;
}
let _opSeq = 0;
function makeOp(opType, params, children) {
    return {
        id: `op${++_opSeq}`, type: 'op', opType, label: OP_LABELS[opType] || opType,
        requires: opRequires(children), params: params ? JSON.parse(JSON.stringify(params)) : {}, children,
    };
}

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

// The PlaceOnStock wrapper carries the placement intent; its params are the exact inverse of makePlace
// (offX ← originX, etc.), so reading them back is correct whatever coordinates the wrapped geometry is built in.
// `offX`/`offY` name THIS op's offset fields — follow-datum ops use originX/Y; opt-in slot/text use offX/Y.
function placeFields(prog, prefix, offX, offY) {
    const pb = find(prog, 'placeonstock');
    if (!pb || !pb.params) return {};
    const p = pb.params;
    return {
        [prefix + 'stockAttach']: p.stockAttach || '',
        [prefix + 'pathDatum']: p.pathDatum || '',
        [prefix + offX]: num(p.offX, 0),
        [prefix + offY]: num(p.offY, 0),
        [prefix + 'offZ']: num(p.offZ, 0),
    };
}

const RECONCILERS = {
    surfacing(prog) {
        const down = find(prog, 'stepdown'), over = down && down.children && down.children[0], rg = over && over.params && over.params.region;
        if (!down || !over || !rg || !rg.params) return null;
        const tool = formNum('sf_toolDia', 12), wb = find(prog, 'wcs');   // un-derive stepover% from the absolute StepOver value
        return Object.assign({
            sf_wcs: (wb && wb.params && wb.params.wcs) || 'active',
            sf_originX: rg.params.x, sf_originY: rg.params.y, sf_w: rg.params.w, sf_h: rg.params.h,
            sf_depth: down.params.to, sf_stepdown: down.params.by,
            sf_strategy: over.params.strategy === 'parallel' ? 'raster' : 'spiral',
            sf_stepoverPct: tool > 0 ? r3((num(over.params.stepover, 0) / tool) * 100) : undefined,
            sf_feed: over.params.feed, sf_plunge: over.params.plunge, sf_clearance: over.params.clearance,
        }, placeFields(prog, 'sf_', 'originX', 'originY'));   // offset + anchors ride the PlaceOnStock wrapper, not the region
    },
    slot(prog) {
        const s = find(prog, 'slot');
        if (!s || !s.params) return null;
        const p = s.params, wb = find(prog, 'wcs');
        const f = {
            sl_wcs: (wb && wb.params && wb.params.wcs) || 'active',
            sl_ax: p.x0, sl_ay: p.y0, sl_bx: p.x1, sl_by: p.y1, sl_width: p.width,
            sl_toolDia: p.tool, sl_stepoverPct: p.stepoverPct, sl_depth: p.depth, sl_stepdown: p.stepdown,
            sl_feed: p.feed, sl_plunge: p.plunge, sl_clearance: p.clearance,
        };
        // REPEAT (array): if the slot is wrapped in an Array, reverse-sync the pattern fields too (else it's single).
        const arr = find(prog, 'array');
        if (arr && arr.params) {
            const a = arr.params;
            f.sl_pattern = a.pattern; f.sl_skip = a.skip || '';
            if (a.pattern === 'circle') { f.sl_dia = a.dia; f.sl_count = a.count; f.sl_startAngle = a.startAngle; }
            else if (a.pattern === 'line') { f.sl_lcount = a.count; f.sl_spacing = a.spacing; f.sl_angle = a.angle; }
            else if (a.pattern === 'rect') { f.sl_w = a.w; f.sl_h = a.h; f.sl_nx = a.nx; f.sl_ny = a.ny; }
            else { f.sl_cols = a.cols; f.sl_rows = a.rows; f.sl_dx = a.dx; f.sl_dy = a.dy; }
        } else { f.sl_pattern = 'single'; }
        return Object.assign(f, placeFields(prog, 'sl_', 'offX', 'offY'));   // opt-in placement: A↔B stays absolute, offset/anchors ride the wrapper
    },
    pocket(prog) {
        const down = find(prog, 'stepdown');
        if (!down || !Array.isArray(down.children)) return null;   // too-small fallback (drill) → no reverse
        const over = down.children.find((c) => c.type === 'stepover'), rg = over && over.params && over.params.region;
        if (!over || !rg || !rg.params) return null;
        const tool = formNum('p_toolDia', 6), r = tool / 2, wb = find(prog, 'wcs');   // the Region is inset by the tool radius — un-inset it
        const f = {
            p_wcs: (wb && wb.params && wb.params.wcs) || 'active',
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
        return Object.assign(f, placeFields(prog, 'p_', 'originX', 'originY'));   // offset + anchors ride the PlaceOnStock wrapper
    },
    drill(prog) {
        const arr = find(prog, 'array');
        if (!arr || !arr.params) return null;
        const p = arr.params, hole = arr.children && arr.children[0], wb = find(prog, 'wcs');
        const f = { d_pattern: p.pattern, d_originX: p.x0, d_originY: p.y0, d_skip: p.skip || '', d_wcs: (wb && wb.params && wb.params.wcs) || 'active' };
        if (p.pattern === 'circle') { f.d_dia = p.dia; f.d_count = p.count; f.d_startAngle = p.startAngle; }
        else if (p.pattern === 'line') { f.d_lcount = p.count; f.d_spacing = p.spacing; f.d_angle = p.angle; }
        else if (p.pattern === 'rect') { f.d_w = p.w; f.d_h = p.h; f.d_nx = p.nx; f.d_ny = p.ny; }
        else { f.d_cols = p.cols; f.d_rows = p.rows; f.d_dx = p.dx; f.d_dy = p.dy; }
        if (hole && hole.params) {
            const h = hole.params;
            f.d_method = hole.type === 'bore' ? 'helical' : 'peck';
            f.d_depth = h.depth; f.d_feed = h.feed; f.d_clearance = h.clearance;
            if (hole.type === 'bore') { f.d_holeDia = h.holeDia; f.d_toolDia = h.toolDia; f.d_pitch = h.pitch; f.d_ramp = h.ramp; }
            else f.d_peck = h.peck;
        }
        return Object.assign(f, placeFields(prog, 'd_', 'originX', 'originY'));   // offset + anchors ride the PlaceOnStock wrapper, not the array
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
/** The active op's type if it has NO block builder yet (so the UI can say why it isn't shown), else null. */
export function unportedActiveOp() {
    const op = getLastOp();
    return (op && !BUILDERS[op.type]) ? op.type : null;
}

export function buildActiveOpStack() {
    const op = getLastOp(), s = sig(op);
    if (!op || !BUILDERS[op.type]) { shownOp = null; return null; }
    shownOp = op.type;                      // remember what the Blocks tab is showing (for reverse sync)
    if (s === loadedSig) return null;       // already loaded → don't clobber block-side edits
    loadedSig = s;
    const framed = BUILDERS[op.type](op.params);
    const start = framed.find((b) => b && b.type === 'progstart');
    const end = framed.find((b) => b && b.type === 'progend');
    const bare = framed.filter((b) => b && b.type !== 'progstart' && b.type !== 'progend');
    const opC = makeOp(op.type, op.params, bare);   // wrap so the Blocks view shows the op as one group (round-trips)
    return { blocks: (start && end) ? [start, opC, end] : [opC] };
}

/** Seed the Blocks model from the active wizard op — a PREVIEW (not committed into the program), used when the tab
 *  opens onto an empty model. Builds the op's stack and loads it so it renders; a no-op when there's nothing portable
 *  to show or the same op is already loaded. (blocksApp calls this; it lived only as a call site before — restored.) */
export function previewActiveOp() {
    const r = buildActiveOpStack();
    if (r && r.blocks && typeof window !== 'undefined' && window.ddcsLoadBlockStack) window.ddcsLoadBlockStack(r.blocks);
    return r;
}

/**
 * Commit the active (just-generated) op INTO the shared program — so wizard inserts ACCUMULATE instead of
 * concatenating whole framed programs (which would put an M30 mid-file and lose all but the last in Blocks).
 * A program is ONE frame (Program Start … Program End); the FIRST op brings the frame, later ops slot their
 * BARE blocks in just before Program End. Returns false for an op with no block builder (probe/ATC families
 * still text-only) so the caller can fall back to a plain text insert. Goes through the window program hooks
 * (no import cycle): ddcsGetBlockProgram (current stack) + ddcsLoadBlockStack (set it; editor re-projects).
 */
// ── Accumulation hygiene: keep ONE program terminator + non-colliding jump labels when ops concatenate ──
// Snippet/probe ops each carry their own error-handler labels (1/2) and a trailing M30. Concatenated naively
// that gives DUPLICATE labels (a GOTO resolves to the wrong target) and a mid-program M30 (halts after op 1).
const _walk = (arr, fn) => { for (const b of (arr || [])) { if (!b) continue; fn(b); if (b.children) _walk(b.children, fn); } };

/** Highest label number anywhere in a stack (0 if none) — used to offset an appended snippet's labels. */
function maxLabelNum(blocks) {
    let m = 0;
    _walk(blocks, (b) => { if (b.type === 'label' && b.params) m = Math.max(m, Math.round(num(b.params.n, 0))); });
    return m;
}

/** Shift every label / goto / ifgoto target in a stack by `off` (in place) so an appended snippet can't collide. */
function offsetLabels(blocks, off) {
    if (!off) return blocks;
    _walk(blocks, (b) => {
        if (!b.params) return;
        if (b.type === 'label' || b.type === 'goto') b.params.n = Math.round(num(b.params.n, 1)) + off;
        else if (b.type === 'ifgoto') b.params.goto = Math.round(num(b.params.goto, 1)) + off;
    });
    return blocks;
}

/** Collapse to a SINGLE program terminator: a framed program (has progend, which emits its own M30) drops every
 *  endprogram atom; a frameless one keeps just one, moved to the very end. Recurses into op-container children. */
function normalizeEnds(blocks) {
    const hasProgend = blocks.some((b) => b && b.type === 'progend');
    let end = null;
    const strip = (arr) => {
        const out = [];
        for (const b of (arr || [])) {
            if (b && b.type === 'endprogram') { end = b; continue; }   // pull it out (keep the last seen)
            if (b && b.children) b.children = strip(b.children);
            out.push(b);
        }
        return out;
    };
    const cleaned = strip(blocks);
    if (!hasProgend && end) cleaned.push(end);   // re-add a single terminator at the top-level end
    return cleaned;
}

// Append blocks INTO the one program frame. `framed` (the op's full builder output incl progstart/progend) is the
// framing source: empty program → use it as-is (a cutting op brings the frame) or the bare snippet (probe/ATC has
// none); a framed program → slot the bare blocks before progend; a frameless program + a framed op → wrap the lot.
function appendIntoProgram(bare, framed) {
    if (!bare || !bare.length) return false;
    const cur = (typeof window !== 'undefined' && window.ddcsGetBlockProgram) ? (window.ddcsGetBlockProgram() || []) : [];
    let next;
    if (!cur.length) {
        next = framed || bare;                                        // first op: keep as-is (its own single frame/end)
    } else {
        offsetLabels(bare, maxLabelNum(cur));                         // renumber the appended op so labels don't collide
        const endIdx = cur.findIndex((b) => b && b.type === 'progend');
        if (endIdx >= 0) next = [...cur.slice(0, endIdx), ...bare, ...cur.slice(endIdx)];   // slot before Program End
        else if (framed) {                                            // frameless program + a framed op → wrap everything
            const start = framed.find((b) => b && b.type === 'progstart'), end = framed.find((b) => b && b.type === 'progend');
            next = (start && end) ? [start, ...cur, ...bare, end] : [...cur, ...bare];
        } else next = [...cur, ...bare];                              // both frameless → append
        next = normalizeEnds(next);                                   // one terminator, no interior M30 (halts the run)
    }
    if (window.ddcsLoadBlockStack) window.ddcsLoadBlockStack(next);
    loadedSig = null;   // the program changed → next Blocks open re-renders it
    return true;
}

export function commitActiveOp() {
    const op = getLastOp();
    if (!op || !BUILDERS[op.type]) return false;
    const framed = BUILDERS[op.type](op.params);                       // [progstart, …op…, progend]
    const start = framed.find((b) => b && b.type === 'progstart');
    const end = framed.find((b) => b && b.type === 'progend');
    const bare = framed.filter((b) => b && b.type !== 'progstart' && b.type !== 'progend');
    const opC = makeOp(op.type, op.params, bare);                      // wrap: keep the op record; emit gates per post
    return appendIntoProgram([opC], (start && end) ? [start, opC, end] : [opC]);
}

/**
 * EDIT path — re-derive a top-level op from new params and replace it IN PLACE (same op id, stable identity).
 * params are the single source of truth; the op's blocks are just rebuilt from them (no snapshot/inference).
 * Returns false if `opId` isn't a top-level op in the current program.
 */
export function replaceOp(opId, params) {
    const cur = (typeof window !== 'undefined' && window.ddcsGetBlockProgram) ? (window.ddcsGetBlockProgram() || []) : [];
    const idx = cur.findIndex((b) => b && b.type === 'op' && b.id === opId);
    if (idx < 0) return false;
    const opType = cur[idx].opType;
    if (!BUILDERS[opType]) return false;
    const framed = BUILDERS[opType](params);
    const bare = framed.filter((b) => b && b.type !== 'progstart' && b.type !== 'progend');
    const opC = makeOp(opType, params, bare);
    opC.id = opId;                                                     // keep the same id so views/selection stay stable
    const next = [...cur.slice(0, idx), opC, ...cur.slice(idx + 1)];
    recordOp(opType, params);                                          // update the lastOp snapshot so preview syncs
    if (window.ddcsLoadBlockStack) window.ddcsLoadBlockStack(next);
    return true;
}

/** Remove a top-level op from the program (right-click → Delete). */
export function deleteOp(opId) {
    const cur = (typeof window !== 'undefined' && window.ddcsGetBlockProgram) ? (window.ddcsGetBlockProgram() || []) : [];
    const idx = cur.findIndex((b) => b && b.type === 'op' && b.id === opId);
    if (idx < 0) return false;
    const next = [...cur.slice(0, idx), ...cur.slice(idx + 1)];
    if (window.ddcsLoadBlockStack) window.ddcsLoadBlockStack(next);
    return true;
}

/** Duplicate a top-level op (right-click → Duplicate) — fresh blocks/id from the same params, inserted after it. */
export function duplicateOp(opId) {
    const cur = (typeof window !== 'undefined' && window.ddcsGetBlockProgram) ? (window.ddcsGetBlockProgram() || []) : [];
    const idx = cur.findIndex((b) => b && b.type === 'op' && b.id === opId);
    if (idx < 0) return false;
    const src = cur[idx];
    if (!BUILDERS[src.opType]) return false;
    const framed = BUILDERS[src.opType](src.params);
    const bare = framed.filter((b) => b && b.type !== 'progstart' && b.type !== 'progend');
    const copy = makeOp(src.opType, src.params, bare);                 // fresh id
    const next = [...cur.slice(0, idx + 1), copy, ...cur.slice(idx + 1)];
    if (window.ddcsLoadBlockStack) window.ddcsLoadBlockStack(next);
    return true;
}

/**
 * For ops with no block builder yet (corner / alignment / ATC / comms): DECODE their generated G-code into blocks
 * (the active dialect's recognizers turn probe / IF-GOTO / WCS into proper blocks; the rest become leaf/raw) and
 * accumulate them as a frameless snippet — so they coexist in the program and show in Blocks instead of being
 * lost. Not parametric like a real builder, but they round-trip and accumulate.
 */
export function commitDecodedCode(code) {
    if (!code || !code.trim()) return false;
    let bare; try { bare = parseGcodeToStack(code, dialectOpts()); } catch (_) { return false; }
    return appendIntoProgram(bare, null);
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
