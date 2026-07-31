/**
 * wizards/previewEmit.js — the ACTIVE-controller dialect opts for the wizard PREVIEW emit (t634).
 *
 * The wizard preview (the code panel + the 3D/2D sim) must show what the user's controller will actually RUN — the same
 * per-post forms INSERT emits (programModel/opGlow/opSession all pass dialectOpts()). Each wizard's generate() emitted
 * `emitMapped(stack).text` with NO dialect → DEFAULT_DIALECT (Expert) on every post, so the preview LIED on V4.1/DM500
 * (it showed Expert #1925/#805 instead of the real #1500/#864, #682/G92, …). Passing activeDialectOpts() folds the preview
 * per post → preview text == insert text. (emitMapped stays STATELESS — the dialect is threaded at the call site, the same
 * way every other emit path does it; this just gives the wizard previews the seam they were missing.)
 */
import { resolveActivePost } from './dialects/index.js';
import { getActiveProfile } from '../shared/js/profiles/controllerProfiles.js';

/**
 * t1450 — THE INDENT STYLE RIDES HERE TOO, for the reason this file exists in the first place: it is the ONE place
 * that answers "what does the ACTIVE workspace want the emit to look like", and the preview must show what INSERT
 * will write. A second reader would put the preview and the inserted program on different settings — the exact lie
 * this seam was built to close, one axis along. A caller that passes no settings still gets `indented`, which is the
 * bytes every emitter already wrote, so every existing path is byte-identical by construction.
 */
export function activeDialectOpts() {
    let indentStyle;
    try { indentStyle = (window.ddcsGetSettings && window.ddcsGetSettings().indentStyle) || undefined; } catch (_) { /* headless */ }
    try { return { dialect: resolveActivePost(getActiveProfile().id), indentStyle }; } catch (_) { return { indentStyle }; }
}
