/**
 * blocks/opSession.js — the active wizard SESSION + program mutations + reverse-sync.
 *
 * The wizard session: build the active op's block stack (buildActiveOpStack), preview it into the Blocks model
 * (previewActiveOp), and commit it INTO the one shared program frame so inserts ACCUMULATE (commitActiveOp).
 * Mutations on the committed stack: replaceOp / deleteOp / duplicateOp / commitDecodedCode / mergeOpBlocks.
 * RECONCILERS reverse-sync an edited block stack back to STUDIO form fields (reconcileActiveOp) — reading the
 * DECLARED params off the structured block model (declaration, NOT the banned motion-inference).
 *
 * Imports the BUILDERS leaf (opBuilders) + the region helpers; talks to the program via window hooks
 * (ddcsGetBlockProgram / ddcsLoadBlockStack). Nothing imports back into the builders, so there's no cycle.
 */
import { getLastOp, recordOp } from './opRecord.js';
import { num, r3 } from '../wizards/ops/util.js';
import { parseGcodeToStack } from './gcodeToStack.js';                       // decode a non-builder op's G-code → blocks (commitDecodedCode)
import { resolveActivePost } from '../wizards/dialects/index.js';
import { getActiveProfile } from '../shared/js/profiles/controllerProfiles.js';
const dialectOpts = () => { try { return { dialect: resolveActivePost(getActiveProfile().id) }; } catch (_) { return {}; } };
import { builderOf, makeOp, _framed, _builderAtoms } from './opBuilders.js';   // the BUILDERS leaf (federated resolver)
import { regionParamsFromDesc } from '../wizards/pocketWizard.js';
import { regionDesc } from '../wizards/ops/region.js';
import { offsetRegion } from '../wizards/ops/contour.js';
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

// ── reverse sync: edited block stack → STUDIO form fields ──────────────────────────────────────────────
// Read the (possibly edited) block objects and return { formFieldId: value }. The inverse of each builder,
// co-located with it. Numeric/geometry params reconcile cleanly here; derived (stepover) and inset (pocket)
// params are intentionally left out for now. Only ops listed here reverse-sync.
// Read a STUDIO form field as a number (for un-deriving block values like stepover ← stepover% × toolØ).
// During replayReconcile (wizard CLOSED — the chip/Blocks surfaces have no form open) the form-only values must
// come from the op's STORED params, not the live DOM (which would read defaults and over-report). `_replayParams`
// holds those stored params; the field id strips its op prefix (sf_toolDia → toolDia) to look them up.
let _replayParams = null;
const formNum = (id, d) => {
    if (_replayParams) { const v = _replayParams[id.replace(/^[a-z]+_/, '')]; return v == null ? d : num(v, d); }
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
        // The Region is inset by (tool radius − wall offset). Un-inset it with offsetRegion(+inset) (the same kernel
        // that built it, so all 4 shapes round-trip incl. the polygon cos(π/n) term) → the TRUE descriptor → typed
        // dims. tool + wallOffset are form-side params (like the tool), read from the form; not reverse-synced.
        const tool = formNum('p_toolDia', 6), r = tool / 2, inset = r - formNum('p_wallOffset', 0), wb = find(prog, 'wcs');
        const trueP = regionParamsFromDesc(offsetRegion(regionDesc(rg.params), inset));   // un-inset → typed region params
        const f = {
            p_wcs: (wb && wb.params && wb.params.wcs) || 'active',
            p_shape: trueP.shape,
            p_depth: down.params.to, p_stepdown: down.params.by,
            p_strategy: over.params.strategy === 'parallel' ? 'raster' : 'spiral',
            p_stepoverPct: tool > 0 ? r3((num(over.params.stepover, 0) / tool) * 100) : undefined,
            p_feed: over.params.feed, p_plunge: over.params.plunge, p_clearance: over.params.clearance,
        };
        f.p_originX = r3(trueP.x); f.p_originY = r3(trueP.y);
        if (trueP.shape === 'circle') { f.p_dia = r3(trueP.w); }
        else if (trueP.shape === 'polygon') { f.p_dia = r3(trueP.w); f.p_sides = trueP.sides; }
        else { f.p_w = r3(trueP.w); f.p_h = r3(trueP.h); }   // rect + ellipse
        return Object.assign(f, placeFields(prog, 'p_', 'originX', 'originY'));   // offset + anchors ride the PlaceOnStock wrapper
    },
    contour(prog) {
        const down = find(prog, 'stepdown');
        if (!down || !Array.isArray(down.children)) return null;
        const c = down.children.find((b) => b.type === 'contour'), rg = c && c.params && c.params.region;
        if (!c || !rg || !rg.params) return null;
        // The Region IS the TRUE profile boundary (the Contour atom applies the side offset), so read it straight.
        const wb = find(prog, 'wcs');
        const f = {
            ct_wcs: (wb && wb.params && wb.params.wcs) || 'active',
            ct_shape: rg.params.shape, ct_side: c.params.side || 'outside', ct_toolDia: c.params.tool,
            ct_depth: down.params.to, ct_stepdown: down.params.by,
            ct_feed: c.params.feed, ct_plunge: c.params.plunge, ct_clearance: c.params.clearance,
        };
        f.ct_originX = rg.params.x; f.ct_originY = rg.params.y;
        if (rg.params.shape === 'circle') { f.ct_dia = rg.params.w; }
        else if (rg.params.shape === 'polygon') { f.ct_dia = rg.params.w; f.ct_sides = rg.params.sides; }
        else { f.ct_w = rg.params.w; f.ct_h = rg.params.h; }   // rect + ellipse
        return Object.assign(f, placeFields(prog, 'ct_', 'originX', 'originY'));   // offset + anchors ride the PlaceOnStock wrapper
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
    middle(prog) {
        // Reverse-sync the middle (pocket/boss centre) op from its block stack. Read the identity fields that are
        // UNAMBIGUOUS in the stack: circular ← the #58=ABS[..] diameter assign (circular-only); 2-axis ← the
        // 2axis_ comment; the primary axis ← that comment (XtoY/YtoX) or, single-axis, the WCS-write offset
        // (#[#70+0]=X / +1=Y); dir2 ← the comment; WCS ← active (#71=#578) vs the #70 literal. featureType,
        // approach and dir1 aren't structurally distinguishable, so they're left to the form's current value.
        const all = [];
        (function walk(arr) { for (const b of (arr || [])) { if (!b) continue; all.push(b); if (b.children) walk(b.children); } })(prog);
        const asn = (v) => all.find((b) => b.type === 'assign' && b.params && b.params.var === v);
        const wcsWrites = all.filter((b) => b.type === 'assign' && b.params && /^#\[#70\+/.test(b.params.var));
        if (!asn('#53') || !wcsWrites.length) return null;   // not a middle op
        const cm = all.find((b) => b.type === 'comment' && b.params && /^2axis_/.test(b.params.text || ''));
        const twoAxis = !!cm || all.some((b) => b.type === 'assign' && b.params && b.params.var === '#56' && /\[#54\+#55\]/.test(b.params.value || ''));
        const m = cm && /^2axis_(XtoY|YtoX)_(pos|neg)$/.exec(cm.params.text);
        const axis = m ? (m[1] === 'XtoY' ? 'X' : 'Y')
                       : (/\+0\]/.test(wcsWrites[0].params.var) ? 'X' : 'Y');   // single-axis: the offset is the axis
        const circular = all.some((b) => b.type === 'assign' && b.params && b.params.var === '#58' && /ABS\[#51-#52\]/.test(b.params.value || ''));
        const wb = asn('#70');                               // active path has #71=#578; fixed path sets #70 to a literal
        const active = all.some((b) => b.type === 'assign' && b.params && b.params.var === '#71' && b.params.value === '#578');
        const wcsByBase = { 805: 'G54', 810: 'G55', 815: 'G56', 820: 'G57', 825: 'G58', 830: 'G59' };
        const wcs = active ? 'active' : (wb && wcsByBase[Math.round(num(wb.params.value, 0))]) || 'active';
        const f = { m_circular: circular, m_both: twoAxis, m_axis: axis, m_wcs: wcs };
        if (m) f.m_dir2 = m[2];
        return f;
    },
    // ── ATC reconcilers ──────────────────────────────────────────────────────────────────────────────────
    // Read the editable form fields back from each ATC op's (possibly block-edited) stack. The identity fields
    // are recoverable from named #vars / atom presence; structural-only params (the magazine, which comes from
    // Settings → Tool table, the probe feeds that live in Settings) are left to the form's current value.
    atc_warmup(prog) {
        const all = flat(prog);
        // rpm1/rpm2 ← the two non-zero Spindle blocks in order; time1/time2 ← the two Dwell blocks in order.
        const rpms = all.filter((b) => b.type === 'spindle' && b.params && num(b.params.rpm, 0) > 0);
        const dwells = all.filter((b) => b.type === 'dwell' && b.params);
        if (rpms.length < 2 || dwells.length < 2) return null;   // not a warmup op
        return {
            atc_warmup_rpm1: num(rpms[0].params.rpm, 6000), atc_warmup_time1: num(dwells[0].params.sec, 30),
            atc_warmup_rpm2: num(rpms[1].params.rpm, 12000), atc_warmup_time2: num(dwells[1].params.sec, 30),
        };
    },
    atc_check(prog) {
        const all = flat(prog);
        const tol = all.find((b) => b.type === 'assign' && b.params && b.params.var === '#20');
        if (!tol) return null;   // not a tool-check op
        return { atc_check_tol: num(tol.params.value, 0.5) };
    },
    atc_change(prog) {
        const all = flat(prog);
        const asn = (v) => all.find((b) => b.type === 'assign' && b.params && b.params.var === v);
        const hasMcode = (c) => all.some((b) => b.type === 'mcode' && num(b.params.code, 0) === c);
        const rawHas = (re) => all.some((b) => b.type === 'raw' && re.test((b.params && b.params.text) || ''));
        const fixedFrom = (tgt) => { const tv = String((tgt && tgt.params.value) || '').trim(); return /^#/.test(tv) ? 0 : Math.round(num(tv, 0)); };

        // FIRMWARE: raw O10102 push station (G53 Z#1306 + the #1320-1326 stations).
        if (rawHas(/O10102/) || rawHas(/Z#1306/)) {
            return { atc_change_method: 'firmware', atc_change_orient: hasMcode(19) };
        }
        // MANUAL: park XYZ in #1/#2/#3.
        if (all.some((b) => b.type === 'comment' && /Manual Tool Change/.test((b.params && b.params.text) || ''))) {
            const x = asn('#1'), y = asn('#2'), z = asn('#3');
            if (!x || !y || !z) return null;
            return { atc_change_method: 'manual', atc_change_x: num(x.params.value, 100), atc_change_y: num(y.params.value, 100), atc_change_z: num(z.params.value, 0) };
        }
        // M6: delegate to the controller (an M6 atom + change-position #103/#104; no #100 target table).
        if (hasMcode(6) && !asn('#100')) {
            const zc = asn('#102');
            // fixedT is carried on the M6 note (T<n>) when a literal tool was chosen, else 0 (from program).
            const m6 = all.find((b) => b.type === 'mcode' && num(b.params.code, 0) === 6);
            const mt = /\bT(\d+)\b/.exec((m6 && m6.params.note) || '');
            const f = { atc_change_method: 'm6', atc_change_fixedt: mt ? Math.round(num(mt[1], 0)) : 0 };
            if (zc) f.atc_change_zclear = num(zc.params.value, 0);
            return f;
        }
        // GENERIC / DISK: ASSUMED magazine pick & place (#100 target table).
        const tgt = asn('#100'), zc = asn('#102');
        if (!tgt) return null;   // not a change op (e.g. the "not available" stub)
        const disk = all.some((b) => b.type === 'comment' && /DISK \/ CAROUSEL/.test((b.params && b.params.text) || ''));
        const f = {
            atc_change_method: disk ? 'disk' : 'generic', atc_change_fixedt: fixedFrom(tgt),
            atc_change_m300: hasMcode(300),
            atc_change_cover: hasMcode(162),
            atc_change_confirm: all.some((b) => b.type === 'confirm'),
        };
        if (zc) f.atc_change_zclear = num(zc.params.value, 0);
        return f;
    },
    atc_test(prog) {
        const all = flat(prog);
        const asn = (v) => all.find((b) => b.type === 'assign' && b.params && b.params.var === v);
        const pockets = all.some((b) => b.type === 'comment' && /Pocket Dry-Run/.test((b.params && b.params.text) || ''));
        if (pockets) {
            const zc = asn('#102');
            // first ← the first "Pocket N — T#" comment index; count ← how many such stops; descend ← a Pocket-Z move present.
            const stops = all.map((b) => b.type === 'comment' && /^Pocket (\d+) /.exec((b.params && b.params.text) || '')).filter(Boolean);
            const f = {
                atc_test_mode: 'pockets',
                atc_test_descend: all.some((b) => b.type === 'assign' && b.params && b.params.var === '#112'),
            };
            if (zc) f.atc_test_zclear = num(zc.params.value, 0);
            if (stops.length) { f.atc_test_first = num(stops[0][1], 1); f.atc_test_count = stops.length; }
            return f;
        }
        const cyc = asn('#101');
        if (!cyc) return null;   // not a drawbar test
        const dw = all.find((b) => b.type === 'dwell' && b.params);
        const f = { atc_test_mode: 'drawbar', atc_test_cycles: num(cyc.params.value, 10) };
        if (dw) f.atc_test_dwell = Math.round(num(dw.params.sec, 0.5) * 1000);   // dwell atom is seconds; field is ms
        return f;
    },
    atc_table(prog) {
        const all = flat(prog);
        const isTable = all.some((b) => b.type === 'comment' && /Write Tool Table to controller/.test((b.params && b.params.text) || ''));
        if (!isTable) return null;
        // The two include-checkboxes ← the presence of each section header comment.
        return {
            atc_table_lengths: all.some((b) => b.type === 'comment' && /TOOL LENGTHS/.test((b.params && b.params.text) || '')),
            atc_table_pockets: all.some((b) => b.type === 'comment' && /POCKET POSITIONS/.test((b.params && b.params.text) || '')),
        };
    },
    // atc_length has NO editable form fields (all params come from Settings → Probes/ATC), so there is nothing to
    // reverse-sync; it round-trips via params (the builder is the single source). Registered so the audit shows it
    // is wired; returns an empty field set (a structural no-op in pullFromBlocks).
    atc_length() { return {}; },
};

// Flatten a block program (incl. op-container + flow-block children) to a single ordered list — ATC reconcilers
// read named #vars / atom presence out of it. (The middle reconciler walks inline; this is the shared form.)
function flat(prog) {
    const out = [];
    (function walk(arr) { for (const b of (arr || [])) { if (!b) continue; out.push(b); if (b.children) walk(b.children); } })(prog);
    return out;
}

let loadedSig = null, shownOp = null;
const sig = (op) => (op ? `${op.type}:${JSON.stringify(op.params)}` : null);

/** Does the active op have a block stack we can show? */
export function hasActiveOpStack() {
    const op = getLastOp();
    return !!(op && builderOf(op.type));
}

/**
 * The active op as { blocks, bare }, or null when there's nothing NEW to show — no op, an op with no
 * stack builder yet (probe family still in progress), or the same op already loaded (so re-opening the
 * Blocks tab doesn't clobber block-side edits). Loading a changed op refreshes the view.
 */
/** The active op's type if it has NO block builder yet (so the UI can say why it isn't shown), else null. */
export function unportedActiveOp() {
    const op = getLastOp();
    return (op && !builderOf(op.type)) ? op.type : null;
}

export function buildActiveOpStack() {
    const op = getLastOp(), s = sig(op);
    if (!op || !builderOf(op.type)) { shownOp = null; return null; }
    shownOp = op.type;                      // remember what the Blocks tab is showing (for reverse sync)
    if (s === loadedSig) return null;       // already loaded → don't clobber block-side edits
    loadedSig = s;
    const framed = _framed(op.type, op.params);   // unwrap a self-wrapping builder (homing) so the op isn't double-wrapped
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
    if (!op || !builderOf(op.type)) return false;
    const framed = _framed(op.type, op.params);                        // [progstart, …op…, progend] (homing unwrapped)
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
    if (!builderOf(opType)) return false;
    const framed = _framed(opType, params);
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
    if (!builderOf(src.opType)) return false;
    const framed = _framed(src.opType, src.params);
    const bare = framed.filter((b) => b && b.type !== 'progstart' && b.type !== 'progend');
    const copy = makeOp(src.opType, src.params, bare);                 // fresh id
    const next = [...cur.slice(0, idx + 1), copy, ...cur.slice(idx + 1)];
    if (window.ddcsLoadBlockStack) window.ddcsLoadBlockStack(next);
    return true;
}

const _isLooseTop = (b) => b && b.type !== 'op' && b.type !== 'progstart' && b.type !== 'progend';

/**
 * #headline — wrap a CONTIGUOUS run of LOOSE top-level atoms (a hand-built run with no op wrapper) into ONE editable
 * `group` op, so the editor's line→op map finds it (`findOpInStack` matches `type==='op'`) → the hover ✎ chip appears
 * and clicking it edits the run as a form. The group is a generic op-like container: editable IN PLACE, NOT a
 * registered/reusable wizard. Atoms already inside an op (a real drill, etc.) are left alone; program framing is
 * preserved. The group's children ARE the loose atoms, so emit walks them = byte-identical G-code (no builder needed).
 *
 * `ids` (the in-context "Group" gesture's contiguous run, from looseRunIds) restricts the wrap to exactly that run —
 * each loose run groups independently. Omitted (the legacy/auto path) → wraps EVERY loose top-level atom program-wide.
 * Returns the new op's id, or null if there were no loose atoms to wrap.
 */
export function groupLooseAtoms(label, ids) {
    const cur = (typeof window !== 'undefined' && window.ddcsGetBlockProgram) ? (window.ddcsGetBlockProgram() || []) : [];
    const idSet = Array.isArray(ids) && ids.length ? new Set(ids) : null;
    const inRun = (b) => _isLooseTop(b) && (!idSet || idSet.has(b.id));
    const loose = cur.filter(inRun);
    if (!loose.length) return null;
    const looseIds = new Set(loose.map((b) => b.id));
    const op = makeOp('group', {}, loose);                             // children = the loose atoms (emit = same G-code)
    op.label = label || 'Hand-built';
    const next = [];
    let placed = false;
    for (const b of cur) {
        if (looseIds.has(b.id)) { if (!placed) { next.push(op); placed = true; } continue; }   // first loose slot → the group
        next.push(b);
    }
    if (window.ddcsLoadBlockStack) window.ddcsLoadBlockStack(next);
    return op.id;
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

/**
 * Replay the DECLARED Replace path for ONE op, wizard-CLOSED — the single rebuild the three diff surfaces
 * (glow / chip / Merge-Replace notice, via opGlow) share. Reconciles the op's (possibly block-edited) stack back to
 * params — the reconciler reads the edited blocks, and its form-only values (toolØ, wallOffset) come from the op's
 * STORED params, not the DOM — then rebuilds with BUILDERS. The reconciled fields override their params; everything
 * untouched (toolØ, rpm, head, …) stays from stored state. Returns the rebuilt bare atoms = what a form Replace
 * would regenerate, or null if the op has no reconciler / its shape doesn't match (caller falls back, fail-safe).
 * So "edited" can mean exactly "Replace would lose something" — a surfaced edit reconciles + reproduces; an
 * injection / unrepresentable residue does not. Declaration via the reconcilers, never motion-inference.
 */
// Memo by the op OBJECT (its identity is the stack signature: ddcsLoadBlockStack replaces the program with fresh
// objects on every edit, so a changed stack ⇒ a new key ⇒ a miss; an unchanged op ⇒ a hit). Dedupes the three
// surface calls (isOpBlockEdited + editedLines + editedRanges) for the same op in one render pass. Caches null too.
const _replayCache = new WeakMap();
export function replayReconcile(opId) {
    const prog = (typeof window !== 'undefined' && window.ddcsGetBlockProgram) ? (window.ddcsGetBlockProgram() || []) : [];
    const op = prog.find((b) => b && b.type === 'op' && b.id === opId);
    if (!op || !op.opType || !RECONCILERS[op.opType] || !builderOf(op.opType)) return null;
    if (_replayCache.has(op)) return _replayCache.get(op);
    let fields;
    _replayParams = op.params || {};                                  // stored-state sourcing (wizard closed)
    try { fields = RECONCILERS[op.opType]([op]); } finally { _replayParams = null; }   // scope find() to THIS op's subtree
    let rebuilt = null;
    if (fields) {
        const overrides = {};
        for (const k in fields) { if (fields[k] !== undefined) overrides[k.replace(/^[a-z]+_/, '')] = fields[k]; }   // sf_depth → depth
        rebuilt = _builderAtoms(op.opType, { ...op.params, ...overrides });
    }
    _replayCache.set(op, rebuilt);
    return rebuilt;
}

/**
 * Perform a True AST Merge for block-edited ops.
 * It takes the old form-generated blocks (base), the user's hand-edited blocks (edited),
 * and the newly generated form blocks (target). It finds the custom injections in `edited`
 * and splices them perfectly into `target`.
 */
function mergeArrays(base, edited, target) {
    const getStructKey = (b) => {
        let k = b.type;
        if (b.type === 'assign') k += ':' + (b.params?.var || '');
        if (b.type === 'op') k += ':' + (b.opType || '');
        return k;
    };
    
    const mergeParams = (bParams, eParams, tParams) => {
        if (!bParams) bParams = {};
        if (!eParams) eParams = {};
        if (!tParams) tParams = {};
        
        const merged = { ...tParams };
        for (const k in eParams) {
            if (JSON.stringify(eParams[k]) !== JSON.stringify(bParams[k])) {
                if (JSON.stringify(tParams[k]) === JSON.stringify(bParams[k])) {
                    // Form didn't change it, so user's Blocks edit wins
                    merged[k] = eParams[k];
                }
            }
        }
        return merged;
    };

    const bKeys = base.map(getStructKey);
    const eKeys = edited.map(getStructKey);
    
    // 1. Structure match base and edited
    const L1 = Array.from({length: base.length + 1}, () => new Array(edited.length + 1).fill(0));
    for (let i = 1; i <= base.length; i++) {
        for (let j = 1; j <= edited.length; j++) {
            if (bKeys[i-1] === eKeys[j-1]) L1[i][j] = L1[i-1][j-1] + 1;
            else L1[i][j] = Math.max(L1[i-1][j], L1[i][j-1]);
        }
    }
    
    let i = base.length, j = edited.length;
    const alignedBE = [];
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && bKeys[i-1] === eKeys[j-1]) {
            alignedBE.unshift({ bIdx: i-1, eIdx: j-1 });
            i--; j--;
        } else if (j > 0 && (i === 0 || L1[i][j-1] >= L1[i-1][j])) {
            alignedBE.unshift({ bIdx: null, eIdx: j-1 });
            j--;
        } else if (i > 0 && (j === 0 || L1[i][j-1] < L1[i-1][j])) {
            alignedBE.unshift({ bIdx: i-1, eIdx: null });
            i--;
        }
    }
    
    // 2. Structure match base and target
    const tKeys = target.map(getStructKey);
    const L2 = Array.from({length: base.length + 1}, () => new Array(target.length + 1).fill(0));
    for (let x = 1; x <= base.length; x++) {
        for (let y = 1; y <= target.length; y++) {
            if (bKeys[x-1] === tKeys[y-1]) {
                L2[x][y] = L2[x-1][y-1] + 1;
            } else {
                L2[x][y] = Math.max(L2[x-1][y], L2[x][y-1]);
            }
        }
    }
    let x = base.length, y = target.length;
    const bToT = [];
    const mappedT = new Set();
    while (x > 0 || y > 0) {
        if (x > 0 && y > 0 && bKeys[x-1] === tKeys[y-1]) {
            bToT[x-1] = y-1;
            mappedT.add(y-1);
            x--; y--;
        } else if (y > 0 && (x === 0 || L2[x][y-1] >= L2[x-1][y])) {
            y--;
        } else if (x > 0 && (y === 0 || L2[x][y-1] < L2[x-1][y])) {
            x--;
        }
    }
    
    // 3. Reconstruct target
    const result = [];
    let nextTargetIdx = 0;
    
    for (const a of alignedBE) {
        if (a.bIdx !== null && a.eIdx !== null) {
            const tIdx = bToT[a.bIdx];
            if (tIdx !== undefined) {
                while (nextTargetIdx < tIdx) {
                    if (!mappedT.has(nextTargetIdx)) result.push({ ...target[nextTargetIdx] });
                    nextTargetIdx++;
                }
                const tBlock = { ...target[tIdx] };
                if (tBlock.params || base[a.bIdx].params || edited[a.eIdx].params) {
                    tBlock.params = mergeParams(base[a.bIdx].params, edited[a.eIdx].params, target[tIdx].params);
                }
                if (edited[a.eIdx].children || target[tIdx].children) {
                    tBlock.children = mergeArrays(base[a.bIdx].children || [], edited[a.eIdx].children || [], target[tIdx].children || []);
                }
                if (edited[a.eIdx].id) tBlock.id = edited[a.eIdx].id;
                result.push(tBlock);
                nextTargetIdx = tIdx + 1;
            }
        } else if (a.bIdx !== null && a.eIdx === null) {
            const tIdx = bToT[a.bIdx];
            if (tIdx !== undefined) {
                mappedT.add(tIdx);
                nextTargetIdx = tIdx + 1;
            }
        } else if (a.bIdx === null && a.eIdx !== null) {
            result.push(edited[a.eIdx]);
        }
    }
    while (nextTargetIdx < target.length) {
        if (!mappedT.has(nextTargetIdx)) result.push({ ...target[nextTargetIdx] });
        nextTargetIdx++;
    }
    
    return result;
}

export function mergeOpBlocks(opId, newParams) {
    const cur = (typeof window !== 'undefined' && window.ddcsGetBlockProgram) ? (window.ddcsGetBlockProgram() || []) : [];
    const idx = cur.findIndex((b) => b && b.type === 'op' && b.id === opId);
    if (idx < 0) return false;
    const op = cur[idx];
    if (!op || !op.opType || !builderOf(op.opType)) return false;

    // The user's manually edited blocks
    const editedBlocks = op.children;

    // The "base" pristine blocks from the old params + the "target" fresh blocks from the new params.
    // _builderAtoms unwraps a self-wrapping builder (homing) so base/target align with op.children (else the merge
    // mis-aligns every homing atom as an injection).
    const oldPristine = _builderAtoms(op.opType, op.params);
    const targetBlocks = _builderAtoms(op.opType, newParams);
    
    // Perform the 3-way merge
    const mergedBlocks = mergeArrays(oldPristine, editedBlocks, targetBlocks);
    
    // Apply the merged AST back to the program model
    const opC = makeOp(op.opType, newParams, mergedBlocks);
    opC.id = opId;
    const next = [...cur.slice(0, idx), opC, ...cur.slice(idx + 1)];
    recordOp(op.opType, newParams);
    if (window.ddcsLoadBlockStack) window.ddcsLoadBlockStack(next);
    return true;
}

