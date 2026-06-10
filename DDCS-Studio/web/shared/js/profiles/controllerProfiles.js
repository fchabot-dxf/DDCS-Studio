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
 *     atc:          { toolTableBaseVar: number, defaultToolCount: number }
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
    },
    'generic': {
        id: 'generic',
        name: 'Generic / unknown',
        source: 'builtin',
        hardwareTabs: [],          // unknown controller — show only the basic tabs until identified
        atc: { toolTableBaseVar: 1430, defaultToolCount: 10 },
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
