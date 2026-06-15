/**
 * ui/headerPost.js — the global POST-PROCESSOR (dialect) selector in the app header (#hdrPost).
 *
 * The post decides WHICH controller's G-code is generated — distinct from the machine PROFILE (hardware
 * config), which lives in Settings → Profile. `auto` follows the active profile's native post; pick a specific
 * post to emit for another controller (e.g. generate grbl / LinuxCNC from a DDCS bench). Changing it re-emits
 * the Blocks/editor projection and re-renders open previews. Mirrors Settings → Profile → POST PROCESSOR.
 */
import { listPosts, getActivePostId, setActivePostId, getDialect } from '../wizards/dialects/index.js';
import { getActiveProfile } from '../shared/js/profiles/controllerProfiles.js';

export function initHeaderPost() {
    const sel = document.getElementById('hdrPost');
    if (!sel) return;

    const fillOptions = () => {
        const machinePost = getDialect(getActiveProfile().id);
        sel.innerHTML = [`<option value="auto">Auto · ${machinePost.name}</option>`]
            .concat(listPosts().map((p) => `<option value="${p.id}">${p.name}${p.verified ? '' : ' ⚠'}</option>`))
            .join('');
        sel.value = getActivePostId();
    };
    fillOptions();

    sel.addEventListener('change', () => {
        setActivePostId(sel.value);                                  // persist the active post (override or 'auto')
        if (window.ddcsRefreshBlocks) window.ddcsRefreshBlocks();    // re-project Blocks/editor in the new post
        window.dispatchEvent(new CustomEvent('ddcs:settings-changed'));   // re-render open previews/wizards
    });

    // Re-sync when the profile/post changes elsewhere (Settings) — the 'Auto · <name>' label tracks the profile.
    window.addEventListener('ddcs:settings-changed', () => { fillOptions(); });
}
