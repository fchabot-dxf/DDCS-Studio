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
import { builderOf, makeOp, _builderAtoms } from './opBuilders.js';   // codec: rebuild ops from markers (declare, never infer)
import { resolveActivePost } from '../wizards/dialects/index.js';
import { getActiveProfile } from '../shared/js/profiles/controllerProfiles.js';

let stack = [];
let proj = { text: '', lines: [], map: [] };   // cached emitMapped of the stack
let applying = false;                           // true while WE programmatically setValue the editor
const subs = new Set();

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
        if (b.type === 'op' && anc.includes(b.id)) return b;
        if (b.children) { const f = findOpInStack(b.children, anc); if (f) return f; }
    }
    return null;
}
/** The op-container owning projected line `i` (or null) — only when the editor matches the live projection. */
export function opAtLine(i) {
    const anc = proj.map && proj.map[i];
    return (anc && anc.length) ? findOpInStack(stack, anc) : null;
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

/** Serialize the program to .nc text WITH self-describing op markers (for export / persistence). The live
 *  editor projection (proj.text) stays CLEAN — markers are a file-format concern, read back on import. A
 *  ( @DDCS:1 {…} ) marker carrying the op record is inserted before each op's first projected line. */
export function serializeWithMarkers() {
    const out = [];
    let lastOpId = null;
    (proj.lines || []).forEach((line, i) => {
        const op = opAtLine(i);
        if (op && op.id !== lastOpId) { out.push(markerLine(op.opType, op.params || {})); lastOpId = op.id; }
        else if (!op) lastOpId = null;
        out.push(line);
    });
    return out.join('\n');
}

// ── import: read self-describing markers → RECONSTRUCT ops (declare, never infer) ───────────────────────────
// The inverse of serializeWithMarkers above — both halves of the ( @DDCS:1 {…} ) codec live here (was opStacks.js).
/** Reconstruct an op container from a declared marker record. Forward-only: BUILDERS rebuilds the body from
 *  the declared params (we trust the declaration; verify-vs-motion + overrides are the B4 override-diff). */
export function opFromMarker(opType, params) {
    if (!builderOf(opType)) return null;
    return makeOp(opType, params, _builderAtoms(opType, params));   // _builderAtoms unwraps a self-wrapping builder (homing)
}

/** Import a .nc → program stack, using DDCS op markers where present. A marker DECLARES an op → it's
 *  reconstructed from BUILDERS and its file body (up to the next marker) is consumed; marker-free spans are
 *  leaf-parsed (the sanctioned declaration path). A marker-free .nc → pure leaf parse, exactly as today. */
export function importMarkedNc(text, opts) {
    const lines = String(text).split('\n');
    const o = opts || dialectOpts();
    const stack = [];
    let i = 0;
    while (i < lines.length) {
        if (isMarker(lines[i])) {
            const rec = parseMarker(lines[i]);
            const op = rec && opFromMarker(rec.opType, rec.params);
            if (op) stack.push(op);
            i++;
            while (i < lines.length && !isMarker(lines[i])) i++;                 // consume the declared op's body
        } else {
            const seg = [];
            while (i < lines.length && !isMarker(lines[i])) { seg.push(lines[i]); i++; }
            let leaf; try { leaf = parseGcodeToStack(seg.join('\n'), o); } catch (_) { leaf = null; }
            if (Array.isArray(leaf)) stack.push(...leaf);
        }
    }
    return stack;
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
    stack = Array.isArray(next) ? next : [];
    proj = emitMapped(stack, dialectOpts());
    projectToEditor();
    subs.forEach((fn) => { try { fn({ stack, proj, origin }); } catch (_) { /* a view threw */ } });
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
