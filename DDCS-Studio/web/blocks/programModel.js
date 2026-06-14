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
import { emitMapped } from './blockModel.js';
import { reconcileGcodeToStack } from './gcodeToStack.js';
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
    const ns = reconcileGcodeToStack(text, stack);
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
