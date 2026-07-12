/**
 * ui/savePrefs.js — THE ONE declared "where does a NEW save land first" preference (t754). A single setting:
 *   Default save location = 'cloud-when-connected' (default) | 'always-local'.
 * It is a DISPLAY / app preference persisted in localStorage like the theme / display / pane prefs — NEVER the machine
 * profile (a stored program or a pulled config must not carry your save-location taste). It only decides where a NEW
 * save is PRE-TARGETED; existing saves stay where they are, and the save dialog always offers the other target one
 * click away. Connected + 'cloud-when-connected' ⇒ cloud; otherwise (offline, not signed in, or 'always-local') ⇒ local.
 */
import { getAccount } from './cloudAccount.js';

export const SAVE_LOCATIONS = [
    { id: 'cloud-when-connected', label: 'Cloud when connected' },
    { id: 'always-local',        label: 'Always local' },
];
const IDS = new Set(SAVE_LOCATIONS.map((o) => o.id));
const KEY = 'ddcs_save_location';
const DEFAULT = 'cloud-when-connected';

/** The stored setting id ('cloud-when-connected' default, or 'always-local'). */
export function getDefaultSaveLocation() {
    try { const v = localStorage.getItem(KEY); return IDS.has(v) ? v : DEFAULT; } catch (_) { return DEFAULT; }
}

/** Set the setting; returns the value stored. */
export function setDefaultSaveLocation(id) {
    const v = IDS.has(id) ? id : DEFAULT;
    try { localStorage.setItem(KEY, v); } catch (_) { /* private mode */ }
    return v;
}

/** True when the cloud account is currently connected (the resolver's gate). */
export function cloudConnected() {
    try { return !!getAccount().connected; } catch (_) { return false; }
}

/** Where a NEW save should PRE-TARGET: 'cloud' only when the setting is cloud-when-connected AND an account is
 *  connected; else 'local'. This never blocks a save — it's just the dialog's default; the user can pick the other. */
export function preferredSaveTarget() {
    return (getDefaultSaveLocation() === 'cloud-when-connected' && cloudConnected()) ? 'cloud' : 'local';
}

/** The quiet note shown when a save LANDS LOCAL although cloud was preferred — reason: 'offline' (not connected) or
 *  'failed' (a cloud write errored → we fell back). Null when local was the genuine choice (no note needed). */
export function localFallbackNote(reason) {
    if (reason === 'failed') return 'Cloud save failed — saved locally instead. Your work is safe.';
    if (reason === 'offline') return 'Saved locally — connect cloud to sync across devices.';
    return null;
}
