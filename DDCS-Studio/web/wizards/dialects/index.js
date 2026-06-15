/**
 * wizards/dialects/index.js — the dialect REGISTRY (profile id → dialect binding).
 *
 * The block atoms emit intent; the active profile's dialect renders it into that controller's real G-code
 * ("register the words per profile"). Keyed by the same ids as shared/js/profiles/controllerProfiles.js.
 * The 3 DDCS profiles are live; port targets (centroid/rs274ngc) drop in as their modules land; Mach3/Mach4
 * are a separate script-emitter strategy. See SCHEMA.md + AGENTS.md.
 */
import { dialect as expert } from './ddcs-expert-m350.js';
import { dialect as v41 } from './ddcs-v41.js';
import { dialect as v3 } from './ddcs-v3-dm500.js';
import { dialect as centroid } from './centroid.js';
import { dialect as rs274ngc } from './rs274ngc.js';
import { dialect as grbl } from './grbl.js';

export const DIALECTS = {
    'ddcs-expert-m350': expert,
    'ddcs-v41': v41,
    'ddcs-v3-dm500': v3,
    'centroid': centroid,
    'rs274ngc': rs274ngc,
    'grbl': grbl,
};

export const DEFAULT_DIALECT = expert;

/** Resolve a dialect by profile id, falling back to the Expert M350 default. */
export function getDialect(profileId) {
    return DIALECTS[profileId] || DEFAULT_DIALECT;
}

// ── Controller CAPABILITIES (not just G-code forms) ───────────────────────────────────────────────────────
// "Dialect" is more than per-line text: controllers differ in what they can DO, which drives how wizards
// COMPOSE a program and which form fields/wizards make sense. Each dialect module declares its own `caps`
// (alongside its emit forms); the flags are queried at build/UI time. Fields:
//   vars             in-program #variables + expressions
//   flow             in-program control flow: 'goto' (IF/GOTO+N labels) | 'oword' (o<n> if/while) | 'none' (host)
//   probeStatusCheck the macro must test a probe-status var after each probe (else the probe ALARMS on no-contact)
//   hmi              in-program blocking operator prompts (dialogs)
//   toolTable        in-program tool-table offset writes
//   probePort        the probe move takes a port/level word (G31 P/L) — false for G38.2 / move-until-input
// Defaults = the DDCS Expert profile (the fullest); a dialect's own `caps` overrides what it lacks.
const DEFAULT_CAPS = { vars: true, flow: 'goto', probeStatusCheck: true, hmi: true, toolTable: true, probePort: true };

/** Capability flags for a post id (the dialect's own `caps`, merged over the Expert-full defaults). */
export function getCaps(id) { return { ...DEFAULT_CAPS, ...((DIALECTS[id] && DIALECTS[id].caps) || {}) }; }
/** Capabilities of the post that's actually active (explicit override, else the machine profile). */
export function resolveActiveCaps(profileId) { return getCaps(resolveActivePost(profileId).id); }

// ── Post processor selection ────────────────────────────────────────────────
// A "post processor" IS a dialect, surfaced as a user-facing, live codegen target.
// The active machine PROFILE picks a default post; the user can override it here so the
// emitted code (esp. the Blocks/codeblocks view) renders for another controller — e.g.
// generate grbl/LinuxCNC G-code from a DDCS bench. Selection persists in localStorage.

// Hardware-verified posts (the controllers we own/test). The rest are dump-derived =
// simulator/reference until proven on hardware (see each dialect's `notes`).
const POST_VERIFIED = new Set(['ddcs-expert-m350', 'ddcs-v41']);
const ACTIVE_POST_KEY = 'ddcs_active_post';

/** All posts for a picker: [{ id, name, verified }]. */
export function listPosts() {
    return Object.values(DIALECTS).map((d) => ({ id: d.id, name: d.name, verified: POST_VERIFIED.has(d.id) }));
}
export function isPostVerified(id) { return POST_VERIFIED.has(id); }

/** Active post id, or 'auto' = follow the machine profile. Persisted; Node/file:// safe. */
export function getActivePostId() {
    try { return localStorage.getItem(ACTIVE_POST_KEY) || 'auto'; } catch (e) { return 'auto'; }
}
export function setActivePostId(id) {
    const v = (id && DIALECTS[id]) ? id : 'auto';
    try { localStorage.setItem(ACTIVE_POST_KEY, v); } catch (e) { /* private mode / file:// */ }
    return v;
}

/** The dialect to emit with: explicit post override if set, else the machine profile's post. */
export function resolveActivePost(profileId) {
    const id = getActivePostId();
    return (id !== 'auto' && DIALECTS[id]) ? DIALECTS[id] : getDialect(profileId);
}
