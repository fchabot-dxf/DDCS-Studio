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
// t1880 — probePort REMOVED from here: these 15 ids (c_port/m_port/p_port/al_port/circ_q/rc_q/rcl_q + their
// level/q siblings) were the OLD built-in wizard's own static field ids — pre-wizards-as-data, zero DOM
// presence anywhere today (confirmed by grep + by opening all 6 probe wizards live). The corner/middle/edge/
// alignment/rotaryCenter/rotaryClock twins now gate their own live `port` field with a declared `gate:`
// property (`_probePortOk`, computed in userOpView.js, mirroring tapData.js's own `_rigidOk`) instead — a
// mechanism that actually runs on every twin-form render, not just load + settings-change. Leaving the dead
// entry here would have this file keep CLAIMING to gate probe ports while doing nothing — see WORK-LOG t1878/
// t1880 for the full trace.
// t1890 — toolTable REMOVED the same way: its only DOM targets were wiz_atc_length/check/warmup/table's own
// `data-cap="toolTable"` — all 4 permanently display:none (t1884's census, re-confirmed t1890). The live twin
// forms (atcLengthData/atcCheckData/atcTableData's own `includeLengths`) now gate with a declared `_toolTableOk`
// (userOpView.js), same pattern as probePort. `atc` is INTENTIONALLY left here — t1890 found its own caps.atc:false
// on V4.1/DM500 encodes an EVIDENCE GAP (unmapped registers), not a confirmed capability absence, so it is NOT
// wired to the twin forms this turn; the CAP_WHY text below is now known to overclaim ("no ... model" states a
// confirmed absence the project's own portingArc.js V41_NAMED_ABSENCES.atcTables does not support) — left as-is,
// unresolved, pending the advisor's own design ruling (see WORK-LOG t1890).
// t1906 — wcsSync REMOVED the same way: its only DOM targets (`w_sync`/`w_slave`, plus the whole separate
// `w_sys` OPTION-level gating loop this file used to carry) lived inside `wiz_wcs`, permanently display:none
// since `wcs` opens the twin (`user_wcs_data`) in-place. Unlike `atc`, this one IS a confirmed absence (the same
// architectural fact readActiveWcs's own named-absence documents — V4.1/DM500 have no per-WCS-index register at
// all), so it's wired to the live twin form instead: `wcsData.js`'s own `sync`/`slave`/`sys` bindings now carry a
// declared `gate:` (`_wcsSyncOk`/`_wcsPickerOk`, userOpView.js), same pattern as probePort/toolTable.
const CAP_WHY = {
    atc: 'no pneumatic tool-changer model on this controller — the drawbar/pusher/pocket dance is DDCS-Expert only',
    hmi: 'no in-program operator prompts on this controller',
    vars: 'no #variables on this controller',
};

export function applyPostGating() {
    const profileId = (getActiveProfile() || {}).id;
    const caps = resolveActiveCaps(profileId);
    const post = resolveActivePost(profileId);

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
            elm.title = `${post.name}: not supported — ${CAP_WHY[cap] || 'unavailable on this controller'}`;
        } else if (elm.dataset.capTitle !== undefined) {
            elm.title = elm.dataset.capTitle; delete elm.dataset.capTitle;
        }
    });
}

export function initPostGating() {
    applyPostGating();
    window.addEventListener('ddcs:settings-changed', applyPostGating);
}
