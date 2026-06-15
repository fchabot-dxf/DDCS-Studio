/**
 * ui/headerPost.js — the global POST-PROCESSOR (dialect) selector in the app header (#hdrPost) + a
 * capability LINT (#hdrPostWarn).
 *
 * The post decides WHICH controller's G-code is generated — distinct from the machine PROFILE (hardware
 * config, in Settings → Profile). `auto` follows the active profile's native post; pick a specific post to
 * emit for another controller (e.g. generate grbl / LinuxCNC from a DDCS bench). Changing it re-emits the
 * Blocks/editor projection and re-renders open previews.
 *
 * LINT (warn-don't-break): a loaded program re-emits into the chosen post live (the stack is post-agnostic).
 * But some posts can't RUN what a program uses — e.g. grbl has no #variables/flow, so a probe/ATC macro
 * re-emitted onto grbl is non-runnable (probing on grbl is host-side). Rather than silently hand over broken
 * G-code, a ⚠ next to the selector explains the mismatch. Cutting programs (no #vars) switch cleanly.
 */
import { listPosts, getActivePostId, setActivePostId, getDialect, resolveActivePost, getCaps } from '../wizards/dialects/index.js';
import { getActiveProfile } from '../shared/js/profiles/controllerProfiles.js';

export function initHeaderPost() {
    const sel = document.getElementById('hdrPost');
    if (!sel) return;
    const warnEl = document.getElementById('hdrPostWarn');

    const fillOptions = () => {
        const machinePost = getDialect(getActiveProfile().id);
        sel.innerHTML = [`<option value="auto">Auto · ${machinePost.name}</option>`]
            .concat(listPosts().map((p) => `<option value="${p.id}">${p.name}${p.verified ? '' : ' ⚠'}</option>`))
            .join('');
        sel.value = getActivePostId();
    };

    // Warn (don't break) when the loaded program uses capabilities the active post lacks.
    const lint = () => {
        if (!warnEl) return;
        const post = resolveActivePost(getActiveProfile().id);   // the post that's actually active (override or profile)
        const caps = getCaps(post.id);
        const ed = document.getElementById('editor');
        const text = ed ? ed.value : '';
        const hasVars = /#\d/.test(text);
        const hasProbe = /\b(?:G38\.2|G31|M101)\b/.test(text);
        let msg = '';
        if (!caps.vars && hasVars) {
            msg = `${post.name} can't run this program — it uses #variables (a probe/ATC macro). Probing on this `
                + `controller is host-side (stream G38.2 → read [PRB:] → G10 L20); the emitted macro won't execute as-is.`;
        } else if (caps.flowStreamable === false && (hasProbe || hasVars)) {
            msg = `${post.name}: load this macro from SD/littlefs — its O-word flow doesn't run while streaming over serial.`;
        }
        warnEl.hidden = !msg;
        warnEl.title = msg;
    };

    fillOptions();

    sel.addEventListener('change', () => {
        setActivePostId(sel.value);                                 // persist the active post (override or 'auto')
        if (window.ddcsRefreshBlocks) window.ddcsRefreshBlocks();   // re-project Blocks/editor in the new post
        window.dispatchEvent(new CustomEvent('ddcs:settings-changed'));   // re-render open previews/wizards
        lint();
    });

    // Re-sync the 'Auto · <name>' label + re-lint when the profile/post or program changes elsewhere.
    window.addEventListener('ddcs:settings-changed', () => { fillOptions(); lint(); });
    const ed = document.getElementById('editor');
    if (ed) ed.addEventListener('input', lint);
    lint();
}
