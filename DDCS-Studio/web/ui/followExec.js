/**
 * ui/followExec.js — the editor FOLLOW-EXECUTION toggle (t865, replaced the minimap).
 *
 * A small floating ⤓ button on the editor's top-right. When ON, the editor auto-scrolls to keep the RUNNING line
 * (the in-text execution highlight) centred during playback. OFF by DEFAULT — the strict no-jump-while-playing rule
 * (editorManager.setActiveLine deliberately never scrolls) holds for everyone who does not opt in; this is the opt-in.
 *
 * ONE SOURCE: it consumes `editorManager.onActiveLine` — the SAME executing-line seam the in-text highlight fires from
 * (the seam that outlived the minimap) — and only scrolls when the pref is ON. Idle (idx == null) → no move. The pref
 * persists via panePrefs (ddcs_follow_exec), the display-pref family (localStorage, never the machine profile).
 */
import { getFollowExecOn, setFollowExecOn, onFollowExecChange } from './panePrefs.js';

const FOLLOW_ICON = '⤓';

export function initFollowExec(mgr) {
    if (!mgr) return;
    const host = document.querySelector('.editor-container');
    if (!host) return;

    const btn = document.createElement('button');
    btn.className = 'follow-toggle';
    btn.type = 'button';
    btn.title = 'Follow execution — auto-scroll the editor to keep the running line in view while playing';
    btn.setAttribute('aria-label', 'Follow execution');
    btn.textContent = FOLLOW_ICON;
    const sync = () => btn.classList.toggle('on', getFollowExecOn());
    btn.addEventListener('click', () => setFollowExecOn(!getFollowExecOn()));
    host.appendChild(btn);
    sync();

    onFollowExecChange((on) => {
        sync();
        // Turning it ON mid-playback → jump to the current line immediately (don't wait for the next line to fire).
        if (on && mgr.activeLineIndex != null && typeof mgr._scrollToLine === 'function') mgr._scrollToLine(mgr.activeLineIndex);
    });

    // The seam (kept from the minimap era): scroll ONLY when the toggle is ON and a line is executing. `idx` is 0-based,
    // exactly what _scrollToLine wants; a null idx (idle/stopped) is a no-op, so the editor never jumps when off or idle.
    if (typeof mgr.onActiveLine === 'function') {
        mgr.onActiveLine((idx) => { if (getFollowExecOn() && idx != null && typeof mgr._scrollToLine === 'function') mgr._scrollToLine(idx); });
    }
}
