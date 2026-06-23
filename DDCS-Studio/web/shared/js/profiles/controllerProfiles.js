/**
 * Controller profiles — SHARED CORE (used by both faces of the app):
 *   - DDCS Studio reads these to decide which Settings tabs to show, and lets the user MANUALLY
 *     build / edit a profile (essential for people with no bridge — Studio is also a simulator).
 *   - The fairy gateway can AUTO-BUILD a profile by reading a connected controller (its params / I-O),
 *     emitting JSON in the SAME shape as the objects below, so Studio renders it identically.
 *
 * Because both faces must agree on the format, this module lives in /shared (served to the gateway's
 * web UI at /shared/js/profiles/… and imported by Studio). The fairy Python backend produces matching
 * JSON — see the PROFILE SHAPE contract below. Roadmap: Phase 5 (controller profiles).
 *
 * PROFILE SHAPE (the contract the gateway builds to, and Studio's manual editor writes):
 *   {
 *     id:           string,                       // stable key, e.g. "ddcs-expert-m350"
 *     name:         string,                       // human label shown in the selector
 *     source:       "builtin" | "manual" | "controller",   // where it came from
 *     hardwareTabs: Array<"probes"|"atc"|"limits">,        // hardware tabs shown by default
 *     atc:          { toolTableBaseVar: number, defaultToolCount: number },
 *     probeVars:    { [field]: { ctrl, pr, label } }       // controller-resident probe config the
 *                                                          // generators may read at runtime (see
 *                                                          // PROBE-CONFIG-SOURCE.md). Absent field =
 *                                                          // no native var on this controller.
 *   }
 * The user's actual VALUES (pins, tool lengths, probe params) persist in settings, not the profile.
 */

export const CONTROLLER_PROFILES = {
    'ddcs-expert-m350': {
        id: 'ddcs-expert-m350',
        name: 'DDCS Expert M350',
        source: 'builtin',
        // Hardware tabs shown by DEFAULT for this controller (in addition to the always-on basic tabs).
        // ATC is left OFF by default (most setups are manual tool change) — the user can toggle it on.
        hardwareTabs: ['probes', 'limits'],
        atc: { toolTableBaseVar: 1430, defaultToolCount: 10 },
        // Probe config with a native controller variable (Pr+500 macro mirror, Expert-confirmed).
        // #1078/#1080/#632 are production-proven (community macro_cam13); the rest are from the
        // official Variables-ENG list. Fields with no native var (slow feed, scan stroke, safe Z)
        // are deliberately absent — they stay Studio-side.
        probeVars: {
            port:        { ctrl: '#1078', pr: 'Pr578', label: 'Floating probe port' },
            level:       { ctrl: '#1080', pr: 'Pr580', label: 'Floating probe level' },
            fastFeed:    { ctrl: '#632',  pr: 'Pr132', label: 'Probing speed' },
            retract:     { ctrl: '#640',  pr: 'Pr140', label: 'Retraction after probe' },
            setterPort:  { ctrl: '#1075', pr: 'Pr575', label: 'Fixed probe port' },
            setterLevel: { ctrl: '#1077', pr: 'Pr577', label: 'Fixed probe level' },
            blockHeight: { ctrl: '#633',  pr: 'Pr133', label: 'Probe block thickness' },
        },
    },
    'ddcs-v41': {
        id: 'ddcs-v41',
        name: 'DDCS V4.1',
        source: 'builtin',
        varFamily: 'v4.1',                       // which default_vars list to load (variableDB)
        hardwareTabs: ['probes', 'limits'],
        atc: { toolTableBaseVar: 1430, defaultToolCount: 10 },
        // The V4.1 macro-address offset for its config params isn't confirmed (see default_vars_v41.js),
        // so probe config stays Studio-side until verified on hardware. Reference: bridge/controllers/v4.1/.
        probeVars: {},
    },
    'ddcs-v3-dm500': {
        id: 'ddcs-v3-dm500',
        name: 'DDCS V3 / DM500',
        source: 'builtin',
        varFamily: 'v3',
        hardwareTabs: ['probes', 'limits'],
        atc: { toolTableBaseVar: 1430, defaultToolCount: 10 },   // TODO: verify ATC base var on a real DM500
        // Probe config sourced from the DM500's own parameter table (bridge/controllers/dm500/install/eng).
        // The DM500 has a single probe input — no configurable port. Verify these #NNNN are macro-readable
        // at runtime before trusting them on real hardware (the user has no DM500 — this is reference/sim).
        probeVars: {
            level:       { ctrl: '#70',   label: 'Probe signal electric level' },
            fastFeed:    { ctrl: '#2011', label: 'Probe feedrate' },
            retract:     { ctrl: '#75',   label: 'Back distance after probe' },
            blockHeight: { ctrl: '#69',   label: 'Thickness of tool sensor' },
        },
    },
    'generic': {
        id: 'generic',
        name: 'Generic / unknown',
        source: 'builtin',
        hardwareTabs: [],          // unknown controller — show only the basic tabs until identified
        atc: { toolTableBaseVar: 1430, defaultToolCount: 10 },
        probeVars: {},             // unknown controller — nothing is safely controller-resident
    },
};

export const DEFAULT_PROFILE_ID = 'ddcs-expert-m350';

const PROFILE_KEY = 'ddcs_controller_profile';

/** The active controller profile (persisted). Falls back to the default if unset/unknown. */
export function getActiveProfile() {
    let id = DEFAULT_PROFILE_ID;
    try { id = localStorage.getItem(PROFILE_KEY) || DEFAULT_PROFILE_ID; } catch (e) { /* private mode / file:// */ }
    return CONTROLLER_PROFILES[id] || CONTROLLER_PROFILES[DEFAULT_PROFILE_ID];
}

/** Set the active controller profile by id (persisted). Returns the resolved profile. */
export function setActiveProfile(id) {
    const profile = CONTROLLER_PROFILES[id] || CONTROLLER_PROFILES[DEFAULT_PROFILE_ID];
    try { localStorage.setItem(PROFILE_KEY, profile.id); } catch (e) { /* ignore */ }
    return profile;
}

/** Whether a profile exposes a given hardware tab (e.g. 'probes' | 'atc' | 'limits'). */
export function profileHasTab(tab, profile = getActiveProfile()) {
    return !!profile && Array.isArray(profile.hardwareTabs) && profile.hardwareTabs.includes(tab);
}

/**
 * Register/replace a profile at runtime — e.g. one the gateway built from a live controller
 * (GET /api/profile). Validated lightly so a bad fetch can't break the selector. Returns it.
 */
export function registerProfile(profile) {
    if (profile && profile.id) {
        if (!Array.isArray(profile.hardwareTabs)) profile.hardwareTabs = [];
        CONTROLLER_PROFILES[profile.id] = profile;
    }
    return profile;
}
