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

export const DIALECTS = {
    'ddcs-expert-m350': expert,
    'ddcs-v41': v41,
    'ddcs-v3-dm500': v3,
};

export const DEFAULT_DIALECT = expert;

/** Resolve a dialect by profile id, falling back to the Expert M350 default. */
export function getDialect(profileId) {
    return DIALECTS[profileId] || DEFAULT_DIALECT;
}
