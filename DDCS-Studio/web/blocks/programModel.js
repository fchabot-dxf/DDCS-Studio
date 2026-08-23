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
import { defVOf, defVStale, USER_OP_PREFIX } from './userOps.js';   // N1 — the declared per-def version stamp (marker stamp + import staleness lookup); t1079 — defVStale is the ONE staleness rule, shared with the CAM sub-stack boundary; t1972 — the ONE declared "is this a real user op" prefix, already enforced by validateUserOp
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
function findOpInStack(blocks, anc, insideUserRoot = false) {
    for (const b of (blocks || [])) {
        if (!b) continue;
        // t1958 — DEEPEST match wins: try the children FIRST. A line inside a multi_step-nested op carries BOTH
        // the wrapper's id and the nested op's own id in its ancestry (blockEmitter's `own = [...anc, block.id]`
        // grows on every level of recursion) — checking `b` itself first, as this used to, matched the WRAPPER
        // (the first `type:'op'` id encountered at the top level) and returned before ever looking inside it, so
        // every line of every op in a multi-op program resolved to the wrapper, not its own op. The editor hover
        // chip then showed 🔒 (multi_step has no declared form) instead of the real op's own ✎ affordance — one
        // layer upstream of `openForEdit`'s own by-id bug. A childless op (drill, corner, …) is unaffected: none
        // of its children are themselves `type:'op'`, so the recursion finds nothing and this still falls through
        // to match `b` itself, byte-identical to before.
        //
        // t1964/t1972 — A `user_*` twin's own template body lives inside a `user_root` (every twin has one —
        // corner's own `user_root` holds plain `section`s; homing's holds an EXTRA nested `{type:'op',
        // opType:'homing'}` fragment, the legacy stack-builder's own internal wrapper, t1842/t1838's own finding,
        // "LOAD-BEARING and left alone"). That fragment is deliberately never given an id BY THIS MODULE — but a
        // Blockly workspace round-trip assigns a real id to every block it renders, including this one, so
        // "deepest match, guarded by `id != null`" alone (t1958's own rule) started matching it once a program
        // had been through the Blocks tab (t1964's own regression). t1966 then proved the OPPOSITE failure mode
        // of a blanket `user_root` boundary: Blockly's own `connect()` lets a user drag an ALREADY-PLACED,
        // genuinely addressable op (e.g. Corner) into another op's own `user_root` EXECUTION mouth (no `check:`
        // restricts that input), and nothing sanitises it on read-back — a blanket boundary would silently hide
        // that real op's own Edit chip and export marker too, the SAME symptom class from the other direction.
        // The declared line between "an internal artifact never independently addressable" and "a real op that
        // happens to sit inside another op's authoring body" is `USER_OP_PREFIX` — already declared (userOps.js)
        // and already enforced by `validateUserOp` for every TOP-LEVEL op's own opType (t1972 extends that same
        // enforcement to a NESTED one, at save time — see validateUserOp). So: recursing INTO a `user_root` is
        // fine — necessary, even, to reach a legitimately nested `user_` op — but a `type:'op'` match found
        // anywhere BELOW a `user_root` only counts if its own `opType` carries that prefix; homing's own
        // `'homing'` fragment does not, and stays excluded regardless of whether Blockly gave it a real id. A
        // multi_step-nested op's own line still resolves correctly and WITHOUT this extra check: its ancestry
        // reaches the nested op's own `type:'op'` container (e.g. corner's own record) before ever reaching
        // corner's own `user_root`, so `insideUserRoot` is still `false` at the point that op itself is matched
        // — the prefix restriction only ever applies to matches found ONE level past a `user_root`, never to a
        // program's own top-level or multi_step-nested ops (which includes non-`user_`-prefixed ones like a
        // hand-built `group`).
        const enteringUserRoot = insideUserRoot || b.type === 'user_root';
        if (b.children) { const f = findOpInStack(b.children, anc, enteringUserRoot); if (f) return f; }
        if (b.type === 'op' && b.id != null && anc.includes(b.id)) {
            if (insideUserRoot && !(typeof b.opType === 'string' && b.opType.startsWith(USER_OP_PREFIX))) continue;
            return b;
        }
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

// t1928 — THE ONE DECLARED ENUMERATION. t1920 deleted program accumulation (a program is always exactly one op),
// so the only way a program holds several operations TODAY is `importMarkedNc`'s own `multi_step` wrapper (t1916)
// — a real op (`type:'op'`, `opType:'multi_step'`) whose `children` are the actual operations. `ddcsLinesForOp`
// already resolves a nested child correctly (ancestry membership at any depth, proven t1922), but every consumer
// that asks "what operations does this program hold" was still filtering the TOP-LEVEL array only, so a
// multi_step's own children were invisible to the setup sheet, the time estimate, the editor sim hints, and
// program-intent detection alike — four call sites duplicating the same broken shape (t1928's own regression
// report). Declared once here so every consumer shares it, instead of four sites each re-implementing (or each
// forgetting) the same one-level flatten.
export function flattenOps(program) {
    const out = [];
    for (const b of (program || [])) {
        if (!b || b.type !== 'op') continue;
        if (b.opType === 'multi_step') { out.push(...flattenOps(b.children)); continue; }
        out.push(b);
    }
    return out;
}

// t1958 — THE ONE DECLARED BY-ID LOOKUP (findOpById's own version of flattenOps' problem). `ddcsOpAtLine`
// (findOpInStack, above) already resolves an op at any depth via its LINE — but "find the op with THIS id" had
// no shared equivalent, so `wizardManager.js`'s `openForEdit` grew its own shallow, top-level-only `.find` (dead
// on a multi_step-nested op: the editor hover chip resolves the id via opAtLine, which recurses, so the chip
// renders enabled — then the click's own lookup fails silently) while `opGlow.js` independently grew a SECOND,
// private, correctly-recursive copy of the same question. Declared once here so a by-id lookup can't drift from
// a by-line one again, and so there's only one recursive implementation to get right.
export function findOpById(program, id) {
    for (const b of (program || [])) {
        if (!b) continue;
        if (b.type === 'op' && b.id === id) return b;
        if (b.children) { const f = findOpById(b.children, id); if (f) return f; }
    }
    return null;
}

// t1958 — the WRITE side of findOpById: swap the op at `id` for `newOp`, wherever it lives (top-level or nested
// inside a multi_step's children), preserving its exact position. `opSession.js`'s `replaceOp` (the Edit form's
// own commit) used a top-level-only splice — findOpById now lets the wizard OPEN for a nested op, but committing
// the edit needs the SAME reach or the click would still silently fail one step later. Immutable (returns a new
// tree; the input program is untouched); returns null if `id` isn't found anywhere, so a caller can tell
// "nothing to replace" apart from "replaced with an identical-looking op". For an id found at the TOP level this
// returns the exact array shape the old splice produced — behaviour-preserving for every existing (single-op)
// caller.
export function replaceOpById(program, id, newOp) {
    let found = false;
    const walk = (blocks) => (blocks || []).map((b) => {
        if (found || !b) return b;
        if (b.type === 'op' && b.id === id) { found = true; return newOp; }
        if (b.children) { const children = walk(b.children); if (found) return { ...b, children }; }
        return b;
    });
    const next = walk(program);
    return found ? next : null;
}

// t1992 — DELETE and DUPLICATE needed the SAME reach as replaceOpById (right-click Delete/Duplicate on a nested
// op silently no-op'd, `opSession.js`'s own `deleteOp`/`duplicateOp` each carrying a top-level-only `findIndex` —
// the same shape `replaceOp` had before t1958). Declared here beside `findOpById`/`replaceOpById` rather than
// re-spelled per call site: `removeOpById` DROPS the op wherever it lives; `insertOpAfterId` adds a new SIBLING
// immediately after it, wherever it lives — the two remaining shapes a by-id mutation can take beyond replace.

/** Remove the op at `id`, wherever it lives (top-level or nested inside a multi_step's children). Immutable
 *  (returns a new tree; the input program is untouched); returns null if `id` isn't found anywhere. */
export function removeOpById(program, id) {
    let found = false;
    const walk = (blocks) => {
        const out = [];
        for (const b of (blocks || [])) {
            if (!b) { out.push(b); continue; }
            if (!found && b.type === 'op' && b.id === id) { found = true; continue; }   // drop it
            if (!found && b.children) {
                const children = walk(b.children);
                if (found) { out.push({ ...b, children }); continue; }
            }
            out.push(b);
        }
        return out;
    };
    const next = walk(program);
    return found ? next : null;
}

/** Insert `newOp` as a sibling immediately AFTER the op at `id`, wherever it lives (top-level or nested inside a
 *  multi_step's children) — Duplicate's own reach. Immutable; returns null if `id` isn't found anywhere. */
export function insertOpAfterId(program, id, newOp) {
    let found = false;
    const walk = (blocks) => {
        const out = [];
        for (const b of (blocks || [])) {
            if (!b) { out.push(b); continue; }
            if (!found && b.type === 'op' && b.id === id) { out.push(b, newOp); found = true; continue; }
            if (!found && b.children) {
                const children = walk(b.children);
                if (found) { out.push({ ...b, children }); continue; }
            }
            out.push(b);
        }
        return out;
    };
    const next = walk(program);
    return found ? next : null;
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
// t1916 built this as a LOCAL twin of `opSession.js`'s own `normalizeEnds` (same problem, different data shape —
// block objects here, raw text there) because that file was step 2's own scope, not yet touched. t1920 DELETED
// `normalizeEnds`: it existed only to deconflict terminators when SPLICING a second op into an already-framed
// program, and a program can never hold more than one op anymore, so its own case never arises. This function's
// OWN case still does — `importMarkedNc`'s `multi_step` grouping (t1916, unaffected by t1920) can legitimately
// wrap several reconstructed ops, each free to carry its own terminator, under ONE program. What was a twin is
// now the sole surviving implementation of "deconflict multiple potential terminators" in the codebase — not
// reconciled by merging, but by the other side's own caller ceasing to exist.
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
export function collapseImportTerminators(items) {
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
export function groupConsecutiveOps(items) {
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

// t1948 — THE SHARED GROW/SHRINK PIPELINE, SHAPE ONLY. `groupConsecutiveOps` only ever GROUPS a flat run of
// top-level ops — it has no notion of "there's already a wrapper here," so handing it a list that still
// contains an existing `multi_step` treats that wrapper as just one more opaque `type:'op'` entry and wraps it
// AGAIN around whatever sits beside it, nesting rather than flattening (found live, t1946: adding a 3rd
// operation onto an existing 2-op wrapper produced `multi_step(multi_step(A,B), C)` instead of one flat
// `multi_step(A,B,C)` — the doc comment on `addOperation` below claimed the flat behavior; the CODE was the
// thing that was wrong, not the promise, so this fixes the code to make the comment true). `regroupOps` is the
// one place that ALWAYS unwraps any existing wrapper(s) first (via `flattenOps`, recursive — immune to a nested
// wrapper too, not just a single stale one) before re-grouping, so growing a program (`addOperation`, below)
// and shrinking one (`stackBridge.js`'s `workspaceToStack`) share this ONE rule instead of two hand-matched
// ones. A `multi_step` wrapper carries no G-code of its own (blockEmitter's `op` container recurses into it
// with zero special-casing) — flatten-then-regroup can only change WHICH ops share a wrapper, never what any
// op emits, so this is a shape fix, not an output fix.
//
// t1950 — CORRECTED: this used to also call `collapseImportTerminators`, and the doc comment claimed "never
// what emits" without qualification. That was FALSE, and the gate on 57f0f854 proved it: `collapseImportTerminators`
// strips EVERY `endprogram` found anywhere in the tree (recursing into `.children`) and re-appends only the
// LAST one at top level — correct when SPLICING a new op into an already-framed program (`addOperation`) or
// concatenating framed programs (`importMarkedNc`), where a genuine terminator conflict can arise, but WRONG on
// a plain workspace read-back, where every block the user placed — including an op's own internal terminator,
// which corner carries BY ORIGINAL DESIGN (see `stripEndprogram`'s own comment) — must survive verbatim. Wiring
// the combined function into `workspaceToStack` (every structural Blockly edit) tore corner's own M30 out and
// hoisted it on the next edit: 2 blocks eaten per round-trip, caught by `guard-roundtrip-1595`. `regroupOps` is
// now SHAPE ONLY — no terminator handling — so a workspace read-back returns the same block count, unchanged,
// always. Terminator dedup is a SEPARATE, EXPLICIT step callers compose on top of `regroupOps` only where a
// conflict can actually happen (`addOperation`, below) — this is one shape rule with an optional second step
// applied selectively, not a second wrapping rule (the thing three prior turns spent deleting).
export function regroupOps(items) {
    const flat = (items || []).flatMap((b) =>
        (b && b.type === 'op' && b.opType === 'multi_step') ? flattenOps(b.children) : [b]);
    return groupConsecutiveOps(flat);
}

/** t1940 — DATA-LEVEL ONLY: grow a program by one more operation (the mechanism under the human's own
 *  Add-to-program ruling). Promote-on-2nd (Option A, t1934's own recommendation): a program holding one bare op
 *  becomes a `multi_step` wrapper holding both; a program that already holds a wrapper appends into it — FLAT,
 *  never nested (t1948 — see `regroupOps` above for why this needed its own shared pipeline rather than calling
 *  `groupConsecutiveOps` directly). This is also the symmetric-rule promise from t1934: the SAME shape pipeline
 *  decides wrapping in both directions (a run of 1 stays unwrapped, a run of 2+ wraps, any existing wrapper is
 *  unwrapped before regrouping) — a delete path re-runs `regroupOps` over what remains rather than hand-rolling
 *  its own mirror-image collapse rule; ONLY the grow direction also needs terminator dedup (below), because
 *  ONLY grow can splice a new terminator-bearing op next to an existing one — a plain workspace read-back never
 *  introduces that conflict (t1950).
 *
 *  `program` is the CURRENT full program array (`[progstart, …, progend]`); `incomingBare` is the new operation's
 *  own BARE record — no progstart/progend of its own (matching `commitActiveOp`'s own `bare` local: `framed`
 *  with any outer progstart/progend filtered out). Inserted immediately before the program's own trailing
 *  `progend`/`endprogram` (whichever framing style it carries), so the two operations land ADJACENT —
 *  `groupConsecutiveOps` only wraps a CONSECUTIVE run, and an unstripped sibling terminator sitting between them
 *  would break that the same way an unmerged pair breaks `importMarkedNc` (t1920's own interstitial-terminator
 *  finding). `collapseImportTerminators`'s own recursive search (into every block's `children`, at any depth)
 *  then still correctly dedupes an INCOMING self-terminating operation's own internal `endprogram` leaf against
 *  nothing extra here, since the program's own outer terminator is the STRUCTURAL `progend` type, a different
 *  vocabulary `stripEndprogram` was never asked to touch — verified for the ordinary (non-self-terminating) case
 *  this turn; a self-terminating incoming operation (corner-style) is NOT proven here, named as unverified in
 *  WORK-LOG rather than asserted. */
export function addOperation(program, incomingBare) {
    const prog = program || [];
    const isEnd = (b) => b && (b.type === 'progend' || b.type === 'endprogram');
    let idx = -1;
    for (let i = prog.length - 1; i >= 0; i--) { if (isEnd(prog[i])) { idx = i; break; } }
    const items = idx >= 0 ? [...prog.slice(0, idx), incomingBare, ...prog.slice(idx)] : [...prog, incomingBare];
    return collapseImportTerminators(regroupOps(items));
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
 *  may or may not still be in the SOURCE TEXT for this op's own span — it's GONE whenever `opSession.js`'s own
 *  `normalizeEnds` stripped it at the original insert/export time (a historical fact about files exported before
 *  t1920 deleted that function — any accumulated op that wasn't the program's first got this treatment), but it is
 *  genuinely PRESENT for an op that WAS first (accumulation never touches the first op's own framing) or for any
 *  hand-built/freshly-authored stack that never went through that pipeline at all (confirmed live: a hand-built
 *  fixture where the FIRST op also carried its own internal terminator broke an earlier "always strip before
 *  measuring" version of this fix, which had implicitly assumed "not first" without checking). t1920 — VERIFIED
 *  instead of assumed: try the op's own FULL (unstripped) reconstruction first; only fall back to the
 *  terminator-stripped one if the full version's own marginal length does not land exactly on the real next
 *  boundary (the next marker, or EOF) in the source text. `collapseImportTerminators` below independently finds
 *  and keeps whichever `endprogram` is genuinely last once the whole import is assembled, regardless of which op
 *  carried it in the meantime — the two passes don't need to agree on which one "is" the real terminator, only
 *  that exactly one survives, wherever it ends up.
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
                const opRaw = rec && opFromMarker(rec.opType, rec.params);
                i++;
                if (opRaw) {
                    // t1920 — VERIFIED, not assumed: try BOTH the op's own full reconstruction and its
                    // terminator-stripped one (see doc comment), and pick whichever's MARGINAL length actually
                    // lands on the real next boundary (the next marker, or EOF) in the SOURCE TEXT — checked
                    // against the text itself, not inferred from "is this the first op." Found live: a hand-built
                    // (not live-accumulated) fixture where the FIRST op ALSO carries its own internal terminator
                    // (homing, same shape as corner's own) broke the old unconditional-strip rule, which only
                    // held for a LEGACY export where `normalizeEnds` (now deleted) had already stripped every
                    // non-first op's own terminator — an assumption a hand-built or freshly-authored file need
                    // not satisfy.
                    const before = emitMapped(items, o).lines.length;
                    let nextBoundary = lines.length;
                    for (let k = i; k < lines.length; k++) { if (isMarker(lines[k])) { nextBoundary = k; break; } }
                    const opFull = JSON.parse(JSON.stringify(opRaw));
                    const nFull = emitMapped([...items, opFull], o).lines.length - before;
                    let op, n;
                    if (i + nFull === nextBoundary) {
                        op = opFull; n = nFull;                                  // this op's own terminator IS genuinely in the source text
                    } else {
                        const opStripped = stripEndprogram(JSON.parse(JSON.stringify(opRaw))).cleaned;
                        n = emitMapped([...items, opStripped], o).lines.length - before;
                        op = opStripped;                                        // matches (or, if neither matches exactly, the safer default —
                    }                                                            // collapseImportTerminators still cleans up either way)
                    items.push(op);
                    for (let k = 0; k < n && i < lines.length; k++) i++;
                }
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
    window.ddcsLinesForOp = linesForOp;
    window.ddcsFlattenOps = flattenOps;   // t1928 — every real operation, one level through a multi_step import wrapper
    window.ddcsFindOpById = findOpById;   // t1958 — the ONE recursive by-id lookup, same convention as ddcsFlattenOps
    window.ddcsReplaceOpById = replaceOpById;   // t1958 — its write-side counterpart, for opSession.js's replaceOp
    window.ddcsAddOperation = addOperation;   // t1940 — DATA-LEVEL ONLY: grow a program by one operation; no UI calls this yet
    window.ddcsRegroupOps = regroupOps;   // t1948 — the shared flatten-then-regroup pipeline addOperation and workspaceToStack both use
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
