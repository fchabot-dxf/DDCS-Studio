/**
 * ui/savePrefs.js — THE ONE declared "where does a NEW save land first" preference (t754). A single setting:
 *   Default save location = 'cloud-when-connected' (default) | 'always-local'.
 * It is a DISPLAY / app preference persisted in localStorage like the theme / display / pane prefs — NEVER the machine
 * profile (a stored program or a pulled config must not carry your save-location taste). It only decides where a NEW
 * save is PRE-TARGETED; existing saves stay where they are, and the save dialog always offers the other target one
 * click away. Connected + 'cloud-when-connected' ⇒ cloud; otherwise (offline, not signed in, or 'always-local') ⇒ local.
 */
import { getAccount } from './cloudAccount.js';

/**
 * t1265 (user ruling) — THE DEFAULT-SAVE-LOCATION PREFERENCE IS GONE, along with SAVE_LOCATIONS, its storage key and
 * preferredSaveTarget(). The CONTEXT already decided everything it claimed to: a plain Save returns a file to the
 * shelf it lives on, Save As follows the tab you are looking at, a new workspace runs the name+folder dialog, and a
 * project save targets the cloud when you are signed in. A setting sitting on top of that could only ever disagree
 * with what the screen was showing — and when a setting and the visible context disagree, people trust the screen.
 *
 * What remains here was never a preference: whether an account is connected, and the wording for the quiet
 * "saved locally" note.
 */
export function cloudConnected() {
    try { return !!getAccount().connected; } catch (_) { return false; }
}

/** Where a NEW save should PRE-TARGET: 'cloud' only when the setting is cloud-when-connected AND an account is
 *  connected; else 'local'. This never blocks a save — it's just the dialog's default; the user can pick the other. */
export function localFallbackNote(reason) {
    if (reason === 'failed') return 'Cloud save failed — saved locally instead. Your work is safe.';
    if (reason === 'offline') return 'Saved locally — connect cloud to sync across devices.';
    return null;
}
