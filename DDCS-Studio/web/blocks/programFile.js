/**
 * blocks/programFile.js — the .mjson saved-program file format (durable save/load of a Studio program).
 *
 * A saved program is the high-level op-STACK (ops + params), NOT the emitted G-code — params are the single
 * source of truth, so it re-posts to any dialect and round-trips blocks↔editor. JSON inside, `.mjson` extension
 * (the on-disk kind id stays `ddcs.macro` for back-compat). `.nc` is exported separately, on demand, for the
 * controller (terminal/lossy — not re-imported). (Was `macroFile.js` — a saved Studio program is not a controller macro.)
 */
import { getActivePostId } from '../wizards/dialects/index.js';
import { getActiveProfile } from '../shared/js/profiles/controllerProfiles.js';
import { serializeOpEdits, restoreOpEdits } from './opEdits.js';   // declared block-edits ride with the program so they survive reload

const MACRO_KIND = 'ddcs.macro';
const MACRO_VERSION = 1;

/** Build the project object: the live program stack + the metadata needed to reopen it faithfully. */
export function serializeProject(name) {
    const stack = (typeof window !== 'undefined' && window.ddcsGetBlockProgram) ? (window.ddcsGetBlockProgram() || []) : [];
    const settings = (typeof window !== 'undefined' && window.ddcsGetSettings) ? (window.ddcsGetSettings() || {}) : {};
    let profileId = '';
    try { profileId = (getActiveProfile() || {}).id || ''; } catch (e) { /* profile not ready */ }
    return {
        kind: MACRO_KIND, v: MACRO_VERSION,
        name: name || 'macro',
        post: getActivePostId(),          // active post override or 'auto'
        profile: profileId,               // machine profile at save time (informational)
        stock: settings.stock || null,
        stack,
        edits: serializeOpEdits(),        // which atoms the user hand-edited in Blocks (keyed by atom id, which `stack` preserves)
    };
}

/** Load a parsed macro object into the program model (→ editor/Blocks re-project from the stack). */
export function loadProject(obj) {
    if (!obj || (obj.kind !== MACRO_KIND && obj.kind !== 'ddcs.project') || !Array.isArray(obj.stack)) {
        throw new Error('not a .mjson macro');
    }
    if (typeof window !== 'undefined' && window.ddcsLoadBlockStack) window.ddcsLoadBlockStack(obj.stack);
    restoreOpEdits(obj.edits);   // re-attach the declared edits (atom ids match the loaded stack); clears for a clean program
    return obj;
}

/** Save the current program as <name>.mjson (browser download). */
export function downloadMacro(name) {
    const obj = serializeProject(name);
    const safe = (obj.name || 'macro').replace(/[^A-Za-z0-9_.-]+/g, '_').replace(/^_+|_+$/g, '') || 'macro';
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = safe + '.mjson';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return obj;
}

/** Parse + load .mjson text (from an opened file). Throws if it isn't a macro. */
export function openMacroText(text) {
    return loadProject(JSON.parse(text));
}
