/**
 * ui/signOutFlow.js — SIGN-OUT UNLOADS THE WORKSPACE (BACKLOG #82, t2657, owner-ruled 2026-09-05).
 *
 * Found live on the owner's own phone: signing out of the Google account left the loaded workspace (machine
 * config, envelope, offsets, custom wizards, G-code) fully open and editable. On a shared/borrowed device the
 * next person to pick it up holds the previous user's entire machine — a privacy hole, not a convenience.
 *
 * THE RULING: sign-out unloads the workspace back to the SAME pristine state a fresh visitor gets — reusing
 * data/backup.js's own declared per-store `clear()` (the exact mechanism a whole-file open already resets with,
 * see restoreBackup/resetWorkspaceToPristine there), so this cannot drift from what "fresh" already means
 * elsewhere in the app. Per-viewer chrome (pane layout/fold state, `perViewer` rows) survives — it is the
 * viewer's, not the workspace's.
 *
 * ONE act, TWO call sites (the header account chip's menu, and the Workspace Manager's Cloud-tab "Sign out"
 * link) — both routed through `signOutAndUnload()` here rather than each calling `disconnect()` bare, so the
 * two doors to "sign out of the one account" cannot silently diverge in what signing out means.
 *
 * ⛔ SCOPE GUARD: this is sign-OUT only. A dropped/expired token or a failed silent refresh must NEVER call this
 * — that is ignorance of the account's state, not a departure (cloudAccount.js's own `expired` distinction).
 * Nothing in this module runs on a timer or a token check; it runs only from an explicit "Sign out" click.
 */
import { disconnect } from './cloudAccount.js';
import { confirmDiscardWithMessage } from './workspaceManager.js';
import { resetWorkspaceToPristine, forgetWorkspaceFile } from '../data/backup.js';
import { adoptSaveHandle } from './workspaceSave.js';
import { toast } from './gateway/util.js';

// t2196-style read-once marker (data/backup.js's own markPendingOpen/takePendingOpen pattern): the toast has to
// survive the reload it is announcing, so it is set BEFORE reload and consumed by the FIRST boot after — never
// a second time, and never on a plain refresh that isn't following a sign-out.
const NOTICE_KEY = 'ddcs_signed_out_notice';

/**
 * THE UNLOAD ITSELF — everything sign-out touches, enumerated:
 *   CLEARS: the cloud account (token/identity), every BACKUP_STORES row except `perViewer` ones (settings incl.
 *     envelope/offsets, machine identity, custom wizards, CAM pack, wizard bar layout, presets, last-used
 *     values, user variables, display prefs, saved programs), the "this workspace IS file X" association, and
 *     the remembered save-file handle (so the NEXT person's first Ctrl+S asks where to save, rather than
 *     silently overwriting the departing user's .ddcs).
 *   SURVIVES: pane layout / fold state (`perViewer`), theme (never a backed-up store to begin with) — the
 *     viewer's own chrome, not the workspace's data.
 * Reloads on completion, same as a real workspace open, so every module re-reads the reset state from scratch
 * instead of this function trying to hand-patch each one's in-memory copy.
 */
export async function signOutAndUnload() {
    const proceed = await confirmDiscardWithMessage(
        'Signing out clears the loaded workspace on this device, and you have changes that are not in a file yet.',
    );
    if (!proceed) return false;
    disconnect();
    await resetWorkspaceToPristine();
    forgetWorkspaceFile();
    await adoptSaveHandle(null);
    try { localStorage.setItem(NOTICE_KEY, '1'); } catch (_) { /* best-effort — the unload itself still happens */ }
    location.reload();
    return true;
}

/** Consume the notice marker, if this boot is the one right after a sign-out — read-once, never repeats. */
export function announceSignedOutIfPending() {
    try {
        if (localStorage.getItem(NOTICE_KEY) !== '1') return;
        localStorage.removeItem(NOTICE_KEY);
        toast('Signed out — this device is back to its default, empty workspace.');
    } catch (_) { /* no notice is better than a throw on boot */ }
}
