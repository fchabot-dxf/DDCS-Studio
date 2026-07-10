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
    // t475 — the WCS dual-gantry slave sync is an M350 register write (#883/#884); no equivalent on other posts.
    wcsSync: ['w_sync', 'w_slave'],
};
const CAP_WHY = {
    probePort: 'probes without a G31 P/L/Q word (G38.2 / move-until-input / fixed in firmware)',
    toolTable: 'no in-program tool table / ATC on this controller (e.g. grbl)',
    atc: 'no pneumatic tool-changer model on this controller — the drawbar/pusher/pocket dance is DDCS-Expert only',
    hmi: 'no in-program operator prompts on this controller',
    vars: 'no #variables on this controller',
    wcsSync: 'dual-gantry slave sync is an M350 register write (#883/#884); no equivalent on this post',
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

    // t475 — WCS w_sys OPTION-level gating (finer than a whole field): the AUTO option needs an active-WCS var (wcsAuto,
    // M350-only per the ruling); the FIXED G54-59 need a TARGETABLE WCS register (wcsFixed — FALSE for G92 posts that zero
    // the active frame regardless of number). If the current selection gets gated, fall back to the first enabled option.
    const wsys = document.getElementById('w_sys');
    if (wsys && wsys.options) {
        for (const o of wsys.options) {
            const ok = o.value === '0' ? !!caps.wcsAuto : !!caps.wcsFixed;
            o.disabled = !ok;
            o.title = ok ? '' : (o.value === '0'
                ? `${post.name}: auto-WCS needs the controller active-WCS variable; pick a fixed WCS`
                : `${post.name}: G92 zeroes the active WCS; this post can't target a specific register`);
        }
        const noneOk = ![...wsys.options].some((o) => !o.disabled);   // G92 posts: no option applies → the whole picker is inert
        wsys.disabled = noneOk;
        const wrap = wsys.closest('div') || wsys.parentElement;
        if (wrap) wrap.classList.toggle('cap-off', noneOk || !!(wsys.selectedOptions[0] && wsys.selectedOptions[0].disabled));
        if (wsys.selectedOptions[0] && wsys.selectedOptions[0].disabled) {
            const firstOk = [...wsys.options].find((o) => !o.disabled);
            if (firstOk) { wsys.value = firstOk.value; wsys.dispatchEvent(new Event('change', { bubbles: true })); }
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
