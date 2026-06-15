/**
 * ui/headerProfile.js — the global controller-profile selector in the app header (#hdrProfile).
 *
 * Replaces the per-generator profile chip: one place to switch which machine you're generating for. Changing
 * it sets the active profile (so getDialect/codegen follow it), swaps the variable list to that controller's
 * family, and broadcasts ddcs:settings-changed so any open preview/wizard re-renders in the new dialect. The
 * fuller Settings → Profile picker (which also presets the hardware tabs / pulls from a bridged controller)
 * still exists; this header control mirrors its value.
 */
import { CONTROLLER_PROFILES, getActiveProfile, setActiveProfile } from '../shared/js/profiles/controllerProfiles.js';

export function initHeaderProfile() {
    const sel = document.getElementById('hdrProfile');
    if (!sel) return;

    const fillOptions = () => {
        sel.innerHTML = Object.values(CONTROLLER_PROFILES)
            .map((p) => `<option value="${p.id}">${p.name}${p.source === 'controller' ? ' (ctrl)' : ''}</option>`)
            .join('');
        sel.value = getActiveProfile().id;
    };
    fillOptions();

    sel.addEventListener('change', () => {
        const p = setActiveProfile(sel.value);                       // switch the GLOBAL profile (dialect)
        const vdb = window.ddcsStudio && window.ddcsStudio.variableDB;
        if (p && p.varFamily && vdb) vdb.setControllerVars(p.varFamily);
        window.dispatchEvent(new CustomEvent('ddcs:settings-changed'));   // re-render open previews/wizards
    });

    // Stay in sync when the profile is switched elsewhere (Settings → Profile, or a pulled controller profile).
    window.addEventListener('ddcs:settings-changed', () => {
        if (sel.options.length !== Object.keys(CONTROLLER_PROFILES).length) fillOptions();   // a new profile registered
        else sel.value = getActiveProfile().id;
    });
}
