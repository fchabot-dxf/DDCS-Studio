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
import { dialect as grblhal } from './grblhal.js';
import { dialect as grbl } from './grbl.js';

export const DIALECTS = {
    'ddcs-expert-m350': expert,
    'ddcs-v41': v41,
    'ddcs-v3-dm500': v3,
    'centroid': centroid,
    'rs274ngc': rs274ngc,
    'grblhal': grblhal,
    'grbl': grbl,
};

export const DEFAULT_DIALECT = expert;

/** Resolve a dialect by profile id, falling back to the Expert M350 default. */
export function getDialect(profileId) {
    return DIALECTS[profileId] || DEFAULT_DIALECT;
}

// t2137 — TEST-ONLY dialect override, IN-MEMORY, never persisted. Distinct on purpose from the retired
// ddcs_active_post localStorage override this turn removes: that one was reachable from a real user gesture,
// survived opening a different workspace, and did not travel with the machine — the exact "one fact, two
// homes" hazard this turn closes. This one is reachable ONLY by importing this module directly (no UI wires
// to it, nothing persists it, a fresh page load always starts clear) — used solely so a spec can sweep every
// REGISTERED dialect (centroid/rs274ngc/grblhal/grbl have no controller-profile counterpart in
// shared/js/profiles/controllerProfiles.js, so there is no other way to drive resolveActivePost's real
// call sites — opSession.js/programModel.js/opGlow.js/the wizard stacks' own local getDialect() helpers —
// through them) without reviving a mechanism a real user could ever reach.
let _testDialectOverride = null;
export function __setDialectOverrideForTests(id) { _testDialectOverride = (id && DIALECTS[id]) ? id : null; }

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
//   flowStreamable   in-program flow runs while STREAMING (false on grblHAL: O-word flow is SD/littlefs-only)
//   inputRead        an in-program generic digital-input poll/read (Expert's M-code input macro) — RARE, not Expert-
//                     full-by-default like the caps above: false is the safe floor, Expert opts IN explicitly
//   atc              a mapped ATC (tool-changer) register model exists for this post — same RARE-floor reasoning
//   helicalArc       G02/G03 with a Z move (a true helix), not just planar arcs — attested per-post (t1472), not a
//                     DDCS-family default: Expert itself is FALSE here, so this cap has no single "fullest" profile
// Defaults = the DDCS Expert profile (the fullest) for the ORIGINAL seven — Expert is genuinely the richest common
// case for those. The three below do NOT follow that pattern (t1534, S3 — closing the gap the porting scout found:
// getCaps() returned `undefined` for any post that didn't mention them, indistinguishable from `false` to every
// real consumer TODAY, but an undeclared key is a declaration gap regardless of whether anything currently reads
// it that way). Their safe default is FALSE — each is rare/uncertain, and defaulting a capability to TRUE for a
// controller nobody has confirmed it on is the exact under-evidenced-claim shape this arc exists to avoid making.
const DEFAULT_CAPS = { vars: true, flow: 'goto', probeStatusCheck: true, hmi: true, toolTable: true, probePort: true, flowStreamable: true,
    // WCS zero-at-current gating (t475): wcsAuto = zero the ACTIVE WCS (needs an active-WCS var — M350-only per the ruling);
    // wcsFixed = target a SPECIFIC WCS register (M350 #805+ / rs274·grbl G10 P<n>; FALSE for G92 posts that ignore the number);
    // wcsSync = the dual-gantry slave write (M350 #883/#884 only). Defaults = the Expert-full (M350) profile; posts override.
    wcsAuto: true, wcsFixed: true, wcsSync: true,
    inputRead: false, atc: false, helicalArc: false };

/** Capability flags for a post id (the dialect's own `caps`, merged over the Expert-full defaults). */
export function getCaps(id) { return { ...DEFAULT_CAPS, ...((DIALECTS[id] && DIALECTS[id].caps) || {}) }; }
/** Capabilities of the post that's actually active (explicit override, else the machine profile). */
export function resolveActiveCaps(profileId) { return getCaps(resolveActivePost(profileId).id); }

// ── Post processor selection ────────────────────────────────────────────────
// A "post processor" IS a dialect. t2137 (human ruling, 2026-08-22) — "they are the same thing from a user
// point of view and the override is not wanted... i dont want it, id just make a second workspace": the
// emitted code ALWAYS follows this workspace's ONE machine ([[one-workspace-one-machine]]); there is no
// separate user-facing post picker any more (settingsPanel.js's old `set_post` selector + headerPost.js's
// dead post-switch handler are retired with it). Generating for a DIFFERENT controller is a different
// machine, hence a different workspace.

// Hardware-verified posts (the controllers we own/test). The rest are dump-derived =
// simulator/reference until proven on hardware (see each dialect's `notes`).
const POST_VERIFIED = new Set(['ddcs-expert-m350', 'ddcs-v41']);

/** All registered dialects: [{ id, name, verified }]. Read-only registry enumeration (tests / diagnostics) —
 *  distinct from the retired SELECTOR: this never decided what's active, only what EXISTS. */
export function listPosts() {
    return Object.values(DIALECTS).map((d) => ({ id: d.id, name: d.name, verified: POST_VERIFIED.has(d.id) }));
}
export function isPostVerified(id) { return POST_VERIFIED.has(id); }

/** The dialect to emit with: this workspace's machine profile — always, no override. (Test-only escape
 *  hatch above, __setDialectOverrideForTests, is the one exception, and it can never be reached from the app.) */
export function resolveActivePost(profileId) {
    if (_testDialectOverride) return DIALECTS[_testDialectOverride];
    return getDialect(profileId);
}

// t2137 MIGRATION — a browser that had PINNED a post override before this release is, right now, silently
// emitting for the wrong controller (the override is gone; every call site falls through to the workspace
// profile, which may not be what was pinned). Read the legacy key ONCE, tell the user by name rather than
// dropping it silently (an unannounced target-controller change is exactly the safety hazard this whole
// turn exists to close), then remove it — never read again after the first call. Returns the retired
// post's display name (for the boot-time notice), or null if there was nothing pinned to migrate.
export function migratePinnedPostOverride() {
    let pinned = null;
    try { pinned = localStorage.getItem('ddcs_active_post'); } catch (_) { return null; }
    if (!pinned || pinned === 'auto') { try { localStorage.removeItem('ddcs_active_post'); } catch (_) {} return null; }
    try { localStorage.removeItem('ddcs_active_post'); } catch (_) { /* private mode / file:// */ }
    return (DIALECTS[pinned] && DIALECTS[pinned].name) || pinned;
}
