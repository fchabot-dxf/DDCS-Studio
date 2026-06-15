/**
 * ui/postGating.js — grey (don't hide) the wizard fields the ACTIVE POST can't use, so layout stays put.
 *
 * A field tied to a capability the active post lacks is disabled + dimmed; the only explanation is its
 * tooltip (hover). Driven by the same caps as the emit/lint (wizards/dialects). All wizard panels live in the
 * DOM at load, so this runs once at startup and again whenever the post/profile changes (ddcs:settings-changed).
 */
import { resolveActiveCaps, resolveActivePost } from '../wizards/dialects/index.js';
import { getActiveProfile } from '../shared/js/profiles/controllerProfiles.js';

// Field id → the capability it needs. The field is greyed when the active post lacks that cap.
const CAP_FIELDS = {
    // The G31 P / L / Q words exist only on a G31-with-port post (DDCS Expert). G38.2 (grbl / LinuxCNC) and
    // move-until-input (DM500) probe without them, and V4.1 fixes them in firmware — so they're moot there.
    probePort: ['c_port', 'c_level', 'c_q', 'm_port', 'm_level', 'm_q', 'p_port', 'p_level', 'p_q',
                'al_port', 'al_level', 'al_q', 'circ_q', 'rc_q', 'rcl_q'],
};
const CAP_WHY = {
    probePort: 'probes without a G31 P/L/Q word (G38.2 / move-until-input / fixed in firmware)',
};

export function applyPostGating() {
    const profileId = (getActiveProfile() || {}).id;
    const caps = resolveActiveCaps(profileId);
    const post = resolveActivePost(profileId);
    for (const cap in CAP_FIELDS) {
        const ok = !!caps[cap];
        for (const id of CAP_FIELDS[cap]) {
            const f = document.getElementById(id);
            if (!f) continue;
            f.disabled = !ok;
            const wrap = f.closest('div') || f.parentElement;
            if (wrap) {
                wrap.classList.toggle('cap-off', !ok);
                wrap.title = ok ? '' : `${post.name}: not used — ${CAP_WHY[cap]}`;   // explanation is tooltip-only
            }
        }
    }
}

export function initPostGating() {
    applyPostGating();
    window.addEventListener('ddcs:settings-changed', applyPostGating);
}
