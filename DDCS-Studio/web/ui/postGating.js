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
    toolTable: 'no in-program tool table / ATC on this controller (e.g. grbl)',
    hmi: 'no in-program operator prompts on this controller',
    vars: 'no #variables on this controller',
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
            if (wrap) wrap.classList.toggle('cap-off', !ok);
            if (!ok) {
                // Tooltip-only explanation — on the field itself (it has its own title) and its wrapper. Stash
                // the original title so it comes back when a capable post is selected again.
                if (f.dataset.origTitle === undefined) f.dataset.origTitle = f.title || '';
                f.title = `${post.name}: not used — ${CAP_WHY[cap]}`;
                if (wrap) wrap.title = f.title;
            } else {
                if (f.dataset.origTitle !== undefined) { f.title = f.dataset.origTitle; delete f.dataset.origTitle; }
                if (wrap) wrap.title = '';
            }
        }
    }

    // Element-level gating: any [data-cap] element (a whole panel / button, e.g. the ATC wizard panels) — grey
    // it + disable its controls when the active post lacks that cap. Boolean caps only (toolTable/hmi/vars/…).
    document.querySelectorAll('[data-cap]').forEach((elm) => {
        const cap = elm.getAttribute('data-cap');
        const ok = !!caps[cap];
        elm.classList.toggle('cap-off', !ok);
        elm.querySelectorAll('input, select, textarea, button').forEach((c) => {
            // An op VIEW may gate a field by its own method/mode (e.g. atc_change fixedT inline). When the cap IS
            // available, don't blanket-re-enable such a field — its view owns the disabled state (declared contract).
            if (ok && c.dataset && c.dataset.opGated === 'true') return;
            c.disabled = !ok;
        });
        if (!ok) {
            if (elm.dataset.capTitle === undefined) elm.dataset.capTitle = elm.title || '';
            elm.title = `${post.name}: not supported — ${CAP_WHY[cap] || 'unavailable on this post'}`;
        } else if (elm.dataset.capTitle !== undefined) {
            elm.title = elm.dataset.capTitle; delete elm.dataset.capTitle;
        }
    });
}

export function initPostGating() {
    applyPostGating();
    window.addEventListener('ddcs:settings-changed', applyPostGating);
}
