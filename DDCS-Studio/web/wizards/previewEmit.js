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

export function activeDialectOpts() {
    try { return { dialect: resolveActivePost(getActiveProfile().id) }; } catch (_) { return {}; }
}
