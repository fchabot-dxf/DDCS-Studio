/**
 * blocks/programModel.js — the shared PROGRAM model (the single source of truth), decoupled from any view.
 *
 * The program is a stack of block records. This module owns it and keeps the STUDIO editor in sync FROM APP
 * START — no need to open the Blocks tab first. The editor and the Blockly workspace are both just views:
 *   - editor  → stack : edit the projected G-code, reconcile back into blocks (leaf-level; see gcodeToStack).
 *   - stack   → editor: project the emit live (never while the editor is focused — no caret fight).
 *   - blocks  ⇄ stack : blocksApp renders the stack when the tab is open and pushes workspace edits back here.
 *
 * Views subscribe via onChange; setStack carries an `origin` so a view ignores its own echo (no feedback loop).
 */
import { emitMapped } from './blockEmitter.js';
import { reconcileGcodeToStack, parseGcodeToStack } from './gcodeToStack.js';
import { markerLine, isMarker, parseMarker } from './opSchema.js';
import { builderOf, makeOp, _builderAtoms, opLabelOf } from './opBuilders.js';   // codec: rebuild ops from markers (declare, never infer)
import { makeXform, makeEntry, makeFlip } from './programFraming.js';   // t812 — reconstruct the program-level declarations from the prog marker; t879 — the two-sided flip
import { defVOf, defVStale } from './userOps.js';   // N1 — the declared per-def version stamp (marker stamp + import staleness lookup); t1079 — defVStale is the ONE staleness rule, shared with the CAM sub-stack boundary
import { resolveActivePost } from '../wizards/dialects/index.js';
import { getActiveProfile } from '../shared/js/profiles/controllerProfiles.js';

let stack = [];
let proj = { text: '', lines: [], map: [] };   // cached emitMapped of the stack
let applying = false;                           // true while WE programmatically setValue the editor
const subs = new Set();
// t1766 — bumped on every setStack call. blocksApp's renderFromModel queues a microtask that reads the
// workspace BACK into the model (to sync ids after a rebuild) — under rapid back-to-back setStack calls
// (e.g. a scripted `ddcsLoadBlockStack([])` immediately followed by `ddcsEditWizardDef(...)`, which itself
// calls `ddcsLoadBlockStack([opC])`), a queued echo from an EARLIER call can still be pending when a LATER
// call has already moved the model on — the echo then overwrites the newer stack with stale workspace data,
// and nothing ever corrects it (found via wizard-face-1599.spec.js hanging on the 3rd customize in a row: the
// program never became empty, so a stale confirmDestructiveLoad dialog appeared and nothing dismissed it).
// The queuer captures this generation at queue time and no-ops if it's stale by the time the microtask runs.
let gen = 0;
export const getGen = () => gen;

function dialectOpts() { try { return { dialect: resolveActivePost(getActiveProfile().id) }; } catch (_) { return {}; } }
function editor() { const s = window.ddcsStudio; return s && s.editorManager; }

export const getStack = () => stack;
export const getGcode = () => proj.text;
export const getProjection = () => proj;

// ── line ⇄ op (for the editor's hover-to-edit) ────────────────────────────────────────────────────────────
// Each projected line carries its block ancestry (proj.map[i]); an op-container id in that ancestry means the
// line belongs to that op. params are the op's single source of truth (no snapshot) — the editor reads them to
// re-open the wizard, and replaceOp rebuilds the op from the edited params.
function findOpInStack(blocks, anc) {
    for (const b of (blocks || [])) {
        if (!b) continue;
        // t1842 — a type:'op' block with NO id is a builder defect (an internal wrapper that should have been
        // stripped, or given a real id, before landing in a stored program's own tree — homing's own
        // `homingDataStack` does exactly this, LOAD-BEARING and left alone, see its own comment). Never match
        // it: `anc.includes(b.id)` would otherwise match it BY ACCIDENT for any OTHER line whose own ancestry
        // pads out with genuine `undefined` at this depth, silently resolving to the wrong op (confirmed
        // reachable, WORK-LOG t1838/t1840). `b.id != null` guards that; see `opAtLine` for the loud signal —
        // logging HERE, on every encounter, was tried and reverted (t1844): it fired on every homing line
        // whether or not the search actually failed, an over-broad proxy for the real hazard.
        if (b.type === 'op' && b.id != null && anc.includes(b.id)) return b;
        if (b.children) { const f = findOpInStack(b.children, anc); if (f) return f; }
    }
    return null;
}
// t1846 — the DECLARED program-framing types: flat, childless, top-level siblings of a real op that own no op
// of their own on purpose (programFraming.js's own makeStart/makeEnd/makeXform/makeEntry/makeFlip; endprogram is
// the SAME role's own name on the raw-decode path, gcodeToStack.js:166). None of these carry an `id` — they are
// singleton PROGRAM declarations, not independently addressable ops (mirrors `_isLooseTop`'s own existing
// exclusion list a few lines above, widened here to the full declared set). A line belonging to one of these is
// CORRECTLY unowned by any op — that is the right answer, not a symptom of anything.
const PROGRAM_FRAMING_TYPES = new Set(['progstart', 'progend', 'endprogram', 'xform', 'entry', 'flip']);

/** The op-container owning projected line `i` (or null) — only when the editor matches the live projection. */
export function opAtLine(i) {
    const anc = proj.map && proj.map[i];
    if (!anc || !anc.length) return null;
    const result = findOpInStack(stack, anc);
    // t1844/t1846 — loud, but on the thing that actually costs something: the search FAILED for this line AND
    // its own ancestry carries the specific shape (`undefined`, not `null`) that an id-less type:'op' block
    // elsewhere in the stack could otherwise have matched by accident. A line that resolves correctly despite an
    // id-less node existing SOMEWHERE in the tree is not a hazard — logging on every encounter (t1842's own
    // first cut) fired on every homing line regardless of outcome, an over-broad proxy this project has hit
    // before. t1846 — checked, not assumed, whether a program's own trailing M30 line trips this too: it does,
    // because program framing (progend/endprogram) is ALSO a real, declared, id-less top-level sibling — and a
    // framing line resolving to no op is the CORRECT answer, not an anomaly, so it must not log. Excluded by
    // checking the stack for a DECLARED framing type (not an inferred proxy) before logging.
    if (!result && anc.includes(undefined) && typeof console !== 'undefined' && console.error) {
        const isFraming = stack.some((b) => b && PROGRAM_FRAMING_TYPES.has(b.type));
        if (!isFraming) {
            console.error(`programModel: line ${i} could not be resolved to an op — its own ancestry carries an unset (undefined) slot, the shape an id-less type:'op' block elsewhere in the stack could otherwise match by accident. This indicates a builder left an internal wrapper unstripped.`);
        }
    }
    return result;
}
/** All projected line indices that belong to op `opId` (its highlight range in the editor). */
export function linesForOp(opId) {
    const out = [];
    (proj.map || []).forEach((anc, i) => { if (anc && anc.includes(opId)) out.push(i); });
    return out;
}

// ── loose-run resolution (the in-context "Group" gesture) ───────────────────────────────────────────────────
// A hand-built atom has no op wrapper, so opAtLine returns null. For the right-click "Group" gesture we instead
// resolve the CONTIGUOUS run of loose top-level atoms the clicked line belongs to (bounded by a real op / framing),
// each run grouping independently. proj.map[i] = ancestry [outer…inner]; map[i][0] = the top-level block id.
const _isLooseTop = (b) => b && b.type !== 'op' && b.type !== 'progstart' && b.type !== 'progend';
/** The loose run (array of top-level block ids) owning projected line `i`, or null when the line is over a real op,
 *  program framing, or nothing. Only valid while the editor matches the live projection (the caller gates that). */
export function looseRunAtLine(i) {
    const anc = proj.map && proj.map[i];
    const topId = anc && anc.length ? anc[0] : null;
    if (!topId) return null;
    const idx = stack.findIndex((b) => b && b.id === topId);
    if (idx < 0 || !_isLooseTop(stack[idx])) return null;            // over a real op / framing → not a loose run
    let s = idx, e = idx;
    while (s > 0 && _isLooseTop(stack[s - 1])) s--;
    while (e < stack.length - 1 && _isLooseTop(stack[e + 1])) e++;
    return stack.slice(s, e + 1).map((b) => b.id);
}

// AUTO (advisor-gated): a PURE hand-built stack (the WHOLE program is one loose run, no real ops) auto-shows the
// editable ✎ chip with NO right-click gesture. The "no real ops" guard scopes auto-show to the UNAMBIGUOUS case —
// a MIXED program (loose runs among real ops) returns null here, so the right-click "Group" gesture owns those
// (the single-vs-multi boundary split). No model mutation: the chip just appears; clicking it wraps (groupLooseAtoms).
/** The loose run for line `i`, but ONLY when the whole program is a single loose run (pure stack); else null. */
export function autoGroupRunAtLine(i) {
    if (stack.some((b) => b && b.type === 'op')) return null;       // any real op → mixed → the gesture owns it
    return looseRunAtLine(i);
}
/** All projected line indices belonging to any top-level block id in `ids` (a loose run's highlight range). */
export function linesForRun(ids) {
    const set = new Set(ids || []);
    const out = [];
    (proj.map || []).forEach((anc, i) => { if (anc && anc.length && set.has(anc[0])) out.push(i); });
    return out;
}

/** Serialize the program to .nc text WITH self-describing op markers (for export / persistence). The live
 *  editor projection (proj.text) stays CLEAN — markers are a file-format concern, read back on import. A
 *  ( @DDCS:1 {…} ) marker carrying the op record is inserted before each op's first projected line. */
export function serializeWithMarkers() {
    const out = [];
    const head = progMarkerLine();   // t812 — the program-level marker slot (xform + a program-level entry)
    if (head) out.push(head);
    let lastOpId = null;
    (proj.lines || []).forEach((line, i) => {
        const op = opAtLine(i);
        if (op && op.id !== lastOpId) out.push(markerLine(op.opType, op.params || {}, defVOf(op.opType)));
        // t812 — keep the op context across a PROGRAM-LEVEL inserted line (the entry waypoint `G0 X Y ( entry )` is owned by
        // the entry sibling, not the op). Resetting to null on it split the op into TWO markers → a duplicate op on reimport.
        // A null line no longer ends the op; the NEXT genuinely-different op still starts its own marker.
        if (op) lastOpId = op.id;
        out.push(line);
    });
    return out.join('\n');
}

// t812 — THE PROGRAM-LEVEL MARKER SLOT. serializeWithMarkers is per-op-line, so the two CHILDLESS program-level
// declarations — the transform (xform sibling) + a program-level entry waypoint (entry sibling) — project no line and
// so got no marker: a .nc export/reimport silently DROPPED them (they round-tripped only via .mjson, which rides the
// whole stack). ONE `( @DDCS:1 {"op":"prog", …} )` header (the SAME self-describing grammar, program scope) carries
// them; unset → NOTHING is emitted (byte-identical export). Only TOP-LEVEL siblings ride this slot — a per-op nested
// entry stays on its own op marker (no double-apply on reimport). NO third bespoke path: both live on this one slot.
const PROG_KEY = 'prog';
function progMarkerLine() {
    const rec = {};
    const xf = (stack || []).find((b) => b && b.type === 'xform');
    if (xf && xf.params && Number(xf.params.angle)) { rec.angle = Number(xf.params.angle); rec.pivotX = Number(xf.params.pivotX) || 0; rec.pivotY = Number(xf.params.pivotY) || 0; }
    const en = (stack || []).find((b) => b && b.type === 'entry');
    if (en && en.params) { const ex = parseFloat(en.params.entryX), ey = parseFloat(en.params.entryY); if (Number.isFinite(ex) && Number.isFinite(ey)) { rec.entryX = ex; rec.entryY = ey; } }
    const fl = (stack || []).find((b) => b && b.type === 'flip' && (b.params || {}).axis && Number((b.params || {}).setup));   // t879 — the two-sided flip declaration
    if (fl && fl.params) { rec.flipAxis = String(fl.params.axis).toUpperCase() === 'Y' ? 'Y' : 'X'; rec.flipSetup = Number(fl.params.setup); }
    return Object.keys(rec).length ? markerLine(PROG_KEY, rec) : null;
}
/** Reconstruct the program-level sibling blocks from a parsed `prog` marker's params (the inverse of progMarkerLine). */
function progBlocksFromMarker(p) {
    const blocks = [];
    if (Number(p.angle)) blocks.push(makeXform({ angle: Number(p.angle), pivotX: Number(p.pivotX) || 0, pivotY: Number(p.pivotY) || 0 }));
    const ex = parseFloat(p.entryX), ey = parseFloat(p.entryY);
    if (Number.isFinite(ex) && Number.isFinite(ey)) blocks.push(makeEntry({ entryX: ex, entryY: ey }));
    if (p.flipAxis && Number(p.flipSetup)) blocks.push(makeFlip({ axis: String(p.flipAxis), setup: Number(p.flipSetup) }));   // t879
    return blocks;
}

// ── import: read self-describing markers → RECONSTRUCT ops (declare, never infer) ───────────────────────────
// The inverse of serializeWithMarkers above — both halves of the ( @DDCS:1 {…} ) codec live here (was opStacks.js).
/** Reconstruct an op container from a declared marker record. Forward-only: BUILDERS rebuilds the body from
 *  the declared params (we trust the declaration; verify-vs-motion + overrides are the B4 override-diff). */
export function opFromMarker(opType, params) {
    if (!builderOf(opType)) return null;
    return makeOp(opType, params, _builderAtoms(opType, params));   // _builderAtoms unwraps a self-wrapping builder (homing)
}

// t1916 — strip every `endprogram` found anywhere under `node` (recursing into `.children`), returning the LAST
// one found (or null). A probe/snippet-style op (corner, found live: it carries its own `endprogram` M30 as part
// of its own success/error convergence, by original design — WORK-LOG: "NO end-of-program park... GOTO2, N2,
// M30, no final move") is free to declare its own terminator when it is the WHOLE program. Shared by two call
// sites below: PER-OP (so a reconstructed op's measured line count matches its TRUE in-file footprint — see the
// import loop's own comment) and over the WHOLE imported result (so only one terminator survives program-wide).
// This is the same problem opSession.js's own `normalizeEnds` solves for the accumulation path — a local twin,
// not a shared call, because that file is step 2's own scope and stays untouched this act.
function stripEndprogram(node) {
    let end = null;
    const strip = (arr) => {
        const out = [];
        for (const b of (arr || [])) {
            if (b && b.type === 'endprogram') { end = b; continue; }
            if (b && b.children) b.children = strip(b.children);
            out.push(b);
        }
        return out;
    };
    if (Array.isArray(node)) return { cleaned: strip(node), end };
    if (node && node.children) node.children = strip(node.children);
    return { cleaned: node, end };
}

/** Collapse to a SINGLE program terminator across the imported items — keeping only the LAST `endprogram` seen
 *  (progend's own, since it is physically last in a well-formed export) and re-appending it at the very end. */
function collapseImportTerminators(items) {
    const { cleaned, end } = stripEndprogram(items);
    if (end) cleaned.push(end);
    return cleaned;
}

// t1916 — GROUP consecutive top-level marked ops into ONE `multi_step` op whose children are those steps.
// The user's own ruling: a program is always exactly one op; a multi-op .nc (today's own accumulation export)
// imports as ONE op carrying N steps — nothing discarded, no refusal, no keep-first-drop-rest. Each step keeps
// its OWN id/opType/params/children verbatim (only its POSITION changes, one level deeper) — blockEmitter's `op`
// container is already transparent and already recurses into an `op`-typed child with zero special-casing
// (blockEmitter.js:224-228), so nesting costs nothing at emit time: byte-identical G-code, proven in
// multi-op-import-1916.spec.js. A run of length 1 is returned unwrapped — byte-identical to today for the
// (overwhelmingly common) single-op import, no new wrapper introduced where none is needed.
function groupConsecutiveOps(items) {
    const out = [];
    let run = [];
    const flush = () => {
        if (run.length > 1) out.push(makeOp('multi_step', { steps: run.length }, run));
        else if (run.length === 1) out.push(run[0]);
        run = [];
    };
    for (const b of items) {
        if (b && b.type === 'op') run.push(b); else { flush(); out.push(b); }
    }
    flush();
    return out;
}

/** Import a .nc → program stack, using DDCS op markers where present. A marker DECLARES an op → it's
 *  reconstructed from BUILDERS; marker-free spans are leaf-parsed (the sanctioned declaration path). A
 *  marker-free .nc → pure leaf parse, exactly as today. Consecutive marked ops group into one `multi_step` op
 *  (t1916 — see groupConsecutiveOps).
 *
 *  t1916 — FIXED: skipping "until the next marker" silently discarded whatever text followed the LAST marker in
 *  the file (progend's own M5/M9/retract/M30 — progstart/progend never carry a marker of their own) because there
 *  IS no next marker to stop at; the skip ran to EOF and ate it. Confirmed live: even a SINGLE marked-op import
 *  lost its own trailing M30. An op's own body is deterministic from its declared params (forward-only, the same
 *  premise `opFromMarker`'s own doc comment states), so the skip now consumes exactly that many lines instead of
 *  guessing at "the next marker" — but the count must be MARGINAL (emitMapped(items+op) − emitMapped(items)), not
 *  ISOLATED (emitMapped([op]) alone): whole-program passes (`applyEntryWaypoint` routing the opening rapid through
 *  a declared entry waypoint, `uniquifyFlowLabels` renumbering around labels already used, `applyToolChanges`
 *  reading prior op ranges…) can inject or renumber lines based on what already sits alongside an op, and an
 *  isolated re-emit sees none of that context. Found live: an isolated count for a wall-finish op that carries an
 *  `entry` sibling was one line SHORT of its true in-file span (missing the injected rapid) — the under-count left
 *  the op's own final label line unconsumed, which then got leaf-parsed a SECOND time as a stray top-level `label`
 *  atom (a real duplicate, not a harmless recovery — `emitByteIdentical` caught it). `items` accumulated so far is
 *  the SAME context, built in the SAME order, the original export saw — measuring the op's MARGINAL contribution
 *  against it reproduces those whole-program effects instead of guessing around them.
 *  Separately: a probe/snippet op's own internal `endprogram` (corner's own M30, see `stripEndprogram`'s comment)
 *  is ALREADY gone from the SOURCE TEXT whenever `normalizeEnds` stripped it at the original insert/export time
 *  (any op that wasn't the program's first) — but `opFromMarker`'s fresh rebuild-from-params doesn't know that, so
 *  its own line count would be one LONGER than the op's true in-file span without stripping it first too (measured:
 *  corner's own count ate progend's own leading M5 before this was added). Stripped BEFORE measuring so the count
 *  matches the source text either way; `collapseImportTerminators` below independently finds and keeps whichever
 *  `endprogram` is genuinely last once the whole import is assembled — the two don't need to agree on which one
 *  "is" the real terminator, only that exactly one survives, wherever it ends up.
 *  The PROG_KEY (xform/entry/flip) header owns no body at all (progMarkerLine emits it BEFORE the per-line loop,
 *  nothing of its own follows) — its own "skip until next marker" was the identical bug: it doesn't skip its OWN
 *  content (it has none), it was accidentally eating whatever unmarked content follows it (progstart's own leaf
 *  lines). Removed; a bare `i++` is correct. */
export function importMarkedNc(text, opts) {
    const lines = String(text).split('\n');
    const o = opts || dialectOpts();
    const items = [];
    let i = 0;
    while (i < lines.length) {
        if (isMarker(lines[i])) {
            const rec = parseMarker(lines[i]);
            if (rec && rec.opType === PROG_KEY) {                                // t812 — the program-level slot: restore the xform / entry siblings (opFromMarker would drop a non-builder type)
                items.push(...progBlocksFromMarker(rec.params || {}));
                i++;                                                             // the header owns no body — nothing to skip past
            } else {
                let op = rec && opFromMarker(rec.opType, rec.params);
                i++;
                if (op) {
                    op = stripEndprogram(op).cleaned;                            // match the SOURCE TEXT's own footprint (see doc comment)
                    const before = emitMapped(items, o).lines.length;            // MARGINAL, not isolated (see doc comment) — a whole-
                    items.push(op);                                             // program pass (applyEntryWaypoint, uniquifyFlowLabels,
                    const n = emitMapped(items, o).lines.length - before;        // applyToolChanges…) can inject/renumber based on what
                    for (let k = 0; k < n && i < lines.length; k++) i++;         // already sits alongside this op — `items` so far IS that
                }                                                                // same context, in the same order the export saw it.
            }
        } else {
            const seg = [];
            while (i < lines.length && !isMarker(lines[i])) { seg.push(lines[i]); i++; }
            let leaf; try { leaf = parseGcodeToStack(seg.join('\n'), o); } catch (_) { leaf = null; }
            if (Array.isArray(leaf)) items.push(...leaf);
        }
    }
    return collapseImportTerminators(groupConsecutiveOps(items));
}
// ── N2: def-change → rebuild TRANSPARENCY (import-time detect, a LOOKUP not a diff) ──────────────────────────
/** Scan a marked .nc for ops whose stamped def-version is BEHIND the current registered def → they were built with
 *  an older wizard version and importMarkedNc regenerated them from the CURRENT builder (forward-only). A LOOKUP
 *  (marker.defV vs defVOf), not a body diff. Returns [{ opType, label, fromV, toV }] (fromV 0 = a legacy pre-stamp
 *  file). Built-in / unversioned ops (defVOf 0) never flag. Pure — the caller shows the transparency notice. */
export function staleMarkedOps(text) {
    const out = [];
    for (const line of String(text).split('\n')) {
        if (!isMarker(line)) continue;
        const rec = parseMarker(line);
        if (!rec) continue;
        const cur = defVOf(rec.opType);
        const was = rec.defV || 0;
        if (defVStale(was, cur)) out.push({ opType: rec.opType, label: opLabelOf(rec.opType), fromV: was, toV: cur });   // t1079 — the ONE declared rule (userOps.defVStale)
    }
    return out;
}

/** One-line transparency message for a staleMarkedOps result — names each op + its version jump. */
export function defChangeSummary(stale) {
    if (!stale || !stale.length) return '';
    const parts = stale.map((s) => `${s.label} v${s.fromV}→v${s.toV}`);
    return `Regenerated ${stale.length} op${stale.length === 1 ? '' : 's'} to the current wizard version: ${parts.join(', ')}.`;
}

/** True when the editor text still matches the live projection (so the line→op map is valid for hover). */
export function editorMatchesProjection() {
    const e = editor();
    return !!(e && e.editor && e.getValue() === proj.text);
}
/** Subscribe to model changes. cb({ stack, proj, origin }). Returns an unsubscribe fn. */
export function onChange(cb) { subs.add(cb); return () => subs.delete(cb); }

/** Replace the program. `origin` lets a view skip its own echo ('blockly' = from the workspace, 'editor', …). */
export function setStack(next, origin = 'api') {
    gen++;   // t1766 — every real replacement supersedes any reproject echo still queued from a prior call
    stack = Array.isArray(next) ? next : [];
    proj = emitMapped(stack, dialectOpts());
    projectToEditor();
    // t1656 — a subscriber THROWING is isolated (one broken view must not take down every other view on a stack
    // change — that isolation is legitimate and stays), but it must not be SILENT. This exact swallow was
    // nullifying t1638's mouth-children guard and t1654's durable-field guard on this path: `blocksApp.js`'s
    // `renderFromModel` (an onChange subscriber) is the ONLY caller of `stackToWorkspace`, so a thrown guard
    // landed here and vanished — the guard fired, and no one ever saw it. console.error keeps the guard's own
    // message + stack trace visible (which already names the exact block/field, e.g. "recToJson: block X
    // carries an undeclared top-level field Y") without adding a labelled-subscriber registry — a bigger,
    // unmeasured change beyond what a swallowed-silence fix needs.
    subs.forEach((fn) => { try { fn({ stack, proj, origin }); } catch (e) { console.error('[programModel] a subscriber threw:', e); } });
}

/** Push the live projection into the editor — but never overwrite it while the user is typing there. */
function projectToEditor() {
    const e = editor(); if (!e || !e.editor) return;
    if (proj.text.trim() && e.getValue() !== proj.text && document.activeElement !== e.editor) {
        applying = true; try { e.setValue(proj.text); } finally { applying = false; }
    }
}

/** Editor text changed → reconcile back into the stack (leaf-level; high-level edits can't be text-reconciled). */
function reconcileFromEditor() {
    const e = editor(); if (!e || !e.editor) return;
    const text = e.getValue();
    if (text === proj.text) return;                 // our own projection → ignore (no loop)
    const ns = reconcileGcodeToStack(text, stack, dialectOpts());   // active dialect → decode its specific ops
    if (!ns) return;                                // high-level program → leave blocks; blur will revert
    setStack(ns, 'editor');
}

/** Wire the editor ⇄ stack sync + the program hooks. Safe to call once the editorManager exists (idempotent).
 *  These hooks live HERE (app start), not in blocksApp, so the program exists before Blockly is ever injected. */
export function initProgramModel() {
    // Program hooks available from app start (the Blocks tab is just a view that renders this).
    window.ddcsGetBlockGcode = getGcode;                       // shared projection text (Studio editor mirror)
    window.ddcsGetBlockProgram = getStack;                     // the program stack
    window.ddcsLoadBlockStack = (s) => setStack(s, 'load');    // STUDIO op / wizard → program (blocksApp reframes)
    window.ddcsRefreshBlocks = () => setStack(stack, 'refresh');   // recompute projection (e.g. post-processor change)
    window.ddcsEmitMapped = (s, opts) => emitMapped(s, opts || dialectOpts());
    // Editor hover-to-edit: which op owns a line, an op's line range, and whether the map is currently valid.
    window.ddcsOpAtLine = (i) => (editorMatchesProjection() ? opAtLine(i) : null);
    window.ddcsLooseRunAtLine = (i) => (editorMatchesProjection() ? looseRunAtLine(i) : null);   // the in-context "Group" gesture
    window.ddcsAutoGroupRunAtLine = (i) => (editorMatchesProjection() ? autoGroupRunAtLine(i) : null);   // AUTO: pure stack auto-shows the chip
    window.ddcsLinesForOp = linesForOp;
    window.ddcsLinesForRun = linesForRun;   // AUTO chip highlight (a loose run's lines)
    window.ddcsGetProjection = getProjection;   // { text, lines, map } — map[i] = block ancestry of line i (for the block-edit glow)
    window.ddcsSerializeWithMarkers = serializeWithMarkers;   // .nc text + self-describing op markers (export only; editor stays clean)

    const e = editor(); if (!e || !e.editor || e.editor.__pmWired) return;
    e.editor.__pmWired = true;
    let deb = null;
    e.editor.addEventListener('input', () => { if (applying) return; clearTimeout(deb); deb = setTimeout(reconcileFromEditor, 500); });
    e.editor.addEventListener('blur', () => {
        clearTimeout(deb); reconcileFromEditor();
        // canonicalize / revert a non-reconcilable (high-level) edit back to the live projection
        const cur = editor();
        if (cur && proj.text.trim() && cur.getValue() !== proj.text) { applying = true; try { cur.setValue(proj.text); } finally { applying = false; } }
    });
}
