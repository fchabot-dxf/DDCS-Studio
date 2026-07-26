/**
 * data/backup.js — ONE-FILE BACKUP (t852). Export / restore ALL user state as a single json file.
 *
 * NORTH STAR (declare-never-infer / one source): every store already persists itself as JSON under its own
 * localStorage key (or as verbatim IDB entries). A backup therefore MOVES each store's OWN persisted bytes — it
 * NEVER re-serializes with a second, divergeable codec. The set of stores is a DECLARED registry (BACKUP_STORES);
 * adding a store = one declared row, not new machinery.
 *
 * File shape: { kind:'ddcs.backup', v, app, date, stores:{ <id>: <the store's persisted value> } }.
 *
 * HONESTY: a store absent from an (older) backup is reported "not in this backup" and left untouched on restore;
 * a backup whose v is newer than we understand is flagged. Before any restore, a SAFETY auto-export of the current
 * state is written (the undo path). Sensitive keys (tokens / cloud creds / device identity) are NOT backed up.
 */
import { UIUtils } from '../ui/uiUtils.js';
import { exportAllEntries, importAllEntries } from '../ui/projects/projectStore.js';
import { loadUserOps } from '../blocks/userOps.js';
import { getMachine, setMachine, migrateProfileLibrary } from './workspaceMachine.js';   // t1217 — the workspace's ONE machine record (replaces the profile library)

export const BACKUP_VERSION = 1;
const MACRO_KIND = 'ddcs.backup';

const appVersion = () => { try { return document.querySelector('.ver')?.textContent.trim() || 'unknown'; } catch (_) { return 'unknown'; } };
const nowISO = () => { try { return new Date().toISOString(); } catch (_) { return ''; } };
const fileStamp = () => nowISO().slice(0, 19).replace(/[:T]/g, '-') || 'backup';
const safeParse = (s) => { try { return JSON.parse(s); } catch (_) { return undefined; } };
const len = (a) => Array.isArray(a) ? a.length : 0;

// ── store-kind factories — each returns { read(), write(value) } over the store's OWN persisted form ────────────
// A localStorage JSON store: read = parse the key, write = stringify back (the SAME codec the store uses).
const ls = (key) => ({
    read: () => { const v = localStorage.getItem(key); return v == null ? undefined : safeParse(v); },
    write: (val) => { if (val !== undefined) localStorage.setItem(key, JSON.stringify(val)); },
});
// Several coupled localStorage keys (e.g. the pane prefs) captured as { key: value } and restored key-by-key.
const lsMulti = (keys) => ({
    read: () => { const o = {}; let any = false; for (const k of keys) { const v = localStorage.getItem(k); if (v != null) { o[k] = safeParse(v); any = true; } } return any ? o : undefined; },
    write: (val) => { if (!val) return; for (const k of keys) if (Object.prototype.hasOwnProperty.call(val, k)) localStorage.setItem(k, JSON.stringify(val[k])); },
});
// All localStorage keys sharing a prefix (e.g. the per-op-type presets ddcs_tpl_*), captured as { key: value }.
const lsPrefix = (prefix) => ({
    read: () => { const o = {}; let any = false; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(prefix)) { o[k] = safeParse(localStorage.getItem(k)); any = true; } } return any ? o : undefined; },
    write: (val) => { if (!val) return; for (const k in val) if (k.startsWith(prefix)) localStorage.setItem(k, JSON.stringify(val[k])); },
});

// ── THE DECLARED REGISTRY — the single source of truth for what a backup contains ───────────────────────────────
export const BACKUP_STORES = [
    { id: 'settings', label: 'Settings + tool table', ...ls('ddcs_studio_settings'), count: (v) => len(v && v.atc && v.atc.tools), unit: 'tools' },
    // t1217 — THE WORKSPACE'S ONE MACHINE ([[one-workspace-one-machine]]): the .ddcs IS the machine, so it carries the
    // machine's IDENTITY (name + controllerId). Its CONFIG is not duplicated here — the envelope/WCS/motors/homing ride
    // the `settings` row and the user vars ride `variables`, exactly as before. USER RULING: opening/restoring a
    // workspace ADOPTS the file's controller, so this row's write RETARGETS the live controller/dialect (the old
    // keep-the-local-controller behaviour contradicted "the file is the machine").
    { id: 'machine', label: 'Machine (this workspace)', unit: 'machine',
      read: () => { try { return getMachine(); } catch (_) { return undefined; } },
      write: (val) => { try { if (val) setMachine(val, true); } catch (_) {} },
      count: (v) => (v && (v.name || v.controllerId) ? 1 : 0) },
    // LEGACY: pre-t1217 files carry a profile LIBRARY. Kept readable so an old .ddcs still restores — migrateProfileLibrary
    // adopts its active profile as the machine record and surfaces the rest as one-time machine-config exports.
    { id: 'profiles', label: 'Profile library (legacy)', ...ls('ddcs_profile_library'), count: (v) => len(v && v.profiles), unit: 'profiles' },
    {
        id: 'userOps', label: 'Custom wizards', count: (v) => len(v), unit: 'wizards',
        read: ls('ddcs_user_ops').read,
        // re-register into the live federated layer after writing the key (so restored wizards appear without a reload).
        write: (val) => { ls('ddcs_user_ops').write(val); try { loadUserOps(); } catch (_) {} },
    },
    // t1137 — the CAM pack (ddcs_campack = macrosApp CAMPACK_KEY) rides inside the workspace. No live-reload hook: the
    // restore flow reloads the page (backupModal.js), so macrosApp re-reads _camPack = loadCamPack() on boot and re-renders.
    { id: 'campack', label: 'CAM pack', ...ls('ddcs_campack'), count: (v) => len(v && v.slots), unit: 'slots' },
    { id: 'wizardLayout', label: 'Wizard bar layout', ...ls('ddcs_wizard_layout'), count: (v) => (v ? (len(v.customGroups) + Object.keys(v.entries || {}).length) : 0), unit: 'overrides' },
    { id: 'presets', label: 'Wizard presets', ...lsPrefix('ddcs_tpl_'), count: (v) => (v ? Object.values(v).reduce((n, list) => n + len(list), 0) : 0), unit: 'presets' },
    { id: 'variables', label: 'Variables', ...ls('ddcs_vars_persistent'), count: (v) => (Array.isArray(v) ? v.filter((x) => x && !x.isSys).length : 0), unit: 'user vars' },
    { id: 'displayPrefs', label: 'Preview display prefs', ...ls('ddcs_display'), count: (v) => (v ? Object.keys(v).length : 0), unit: 'elements' },
    { id: 'panePrefs', label: 'Panel layout', ...lsMulti(['ddcs_panes', 'ddcs_pane_ratio', 'ddcs_follow_exec', 'ddcs_form_sections']), count: (v) => (v ? Object.keys(v).length : 0), unit: 'keys' },
    { id: 'projects', label: 'Projects (local)', async: true, count: (v) => (Array.isArray(v) ? v.filter((e) => e && e.type === 'project').length : 0), unit: 'projects', read: () => exportAllEntries(), write: (val) => importAllEntries(val) },
];

/** Build the full backup object (reads every store's own persisted value; async for the IDB project volume). */
export async function buildBackup() {
    const stores = {};
    for (const s of BACKUP_STORES) {
        let v; try { v = await s.read(); } catch (_) { v = undefined; }
        if (v !== undefined) stores[s.id] = v;
    }
    return { kind: MACRO_KIND, v: BACKUP_VERSION, app: appVersion(), date: nowISO(), stores };
}

/** Summarize a loaded backup for the preview modal: what it contains, counts per store, the version it came from. */
export function previewBackup(obj) {
    const stores = (obj && obj.stores) || {};
    const rows = BACKUP_STORES.map((s) => {
        const present = Object.prototype.hasOwnProperty.call(stores, s.id);
        return { id: s.id, label: s.label, unit: s.unit, present, count: (present && s.count) ? s.count(stores[s.id]) : null };
    });
    const v = Number(obj && obj.v) || 1;
    return { valid: !!(obj && obj.kind === MACRO_KIND && obj.stores), app: (obj && obj.app) || 'unknown', date: (obj && obj.date) || '', version: v, newer: v > BACKUP_VERSION, rows };
}

/** Restore the selected stores (default: all present). Writes each store's OWN persisted form verbatim. Async (IDB). */
export async function restoreBackup(obj, selectedIds) {
    const stores = (obj && obj.stores) || {};
    const sel = selectedIds ? new Set(selectedIds) : new Set(BACKUP_STORES.map((s) => s.id));
    const restored = [], skipped = [];
    for (const s of BACKUP_STORES) {
        if (!sel.has(s.id)) continue;
        if (!Object.prototype.hasOwnProperty.call(stores, s.id)) { skipped.push(s.id); continue; }   // not in this backup → leave untouched
        try { await s.write(stores[s.id]); restored.push(s.id); } catch (_) { skipped.push(s.id); }
    }
    // t1217 — a LEGACY file (profile library, no machine row) collapses to the single machine record on open, so the
    // pivot's invariant holds for old workspaces too. Idempotent: a file that already carries `machine` no-ops here.
    try { migrateProfileLibrary(); } catch (_) {}
    markWorkspaceSavedToFile();   // the workspace now MATCHES the just-opened .ddcs → clean (persists across the restore reload)
    return { restored, skipped };
}

/** Save the whole workspace → download one .ddcs file (t1137; the JSON shape is unchanged, so it opens on any build). */
export async function exportEverything() {
    const obj = await buildBackup();
    UIUtils.downloadFile('ddcs-workspace-' + fileStamp() + '.ddcs', JSON.stringify(obj, null, 2));
    markWorkspaceSavedToFile();   // this state is now IN a portable file → clear the "unsaved to file" signal
    return obj;
}

// ── "unsaved to file" watermark (PERSISTENCE-A) ─────────────────────────────────────────────────────────────────
// The workspace auto-persists to localStorage; a .ddcs is the only PORTABLE copy. We surface an "unsaved to file"
// signal so the user knows their work lives only in this browser until they Save workspace. ONE SOURCE: the signal is
// a content SIGNATURE over the SAME BACKUP_STORES registry a .ddcs writes — it changes iff a fresh .ddcs would differ,
// so a new store is covered automatically and there is no second, divergeable definition of "the workspace state".
const WATERMARK_KEY = 'ddcs_file_watermark';
const SAVED_AT_KEY = 'ddcs_file_saved_at';   // epoch-ms of the last REAL .ddcs save/open — set ONLY by a file save, never the boot baseline
const SAVED_NAME_KEY = 'ddcs_file_saved_name';   // the last .ddcs file NAME (for the indicator's "Saved to <name>"); optional
const hash32 = (str) => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; };

/** A cheap SYNCHRONOUS content signature of the localStorage-backed workspace stores. Skips the async IDB projects
 *  store (it has its own .mjson save grain); never written into a backup. Synchronous so beforeunload can use it. */
export function workspaceSignature() {
    let acc = '';
    for (const s of BACKUP_STORES) {
        if (s.async) continue;   // async (projects/IDB) — has its own .mjson grain; never call its read on the poll
        let v; try { v = s.read(); } catch (_) { continue; }
        if (v && typeof v.then === 'function') continue;   // defensive: any other async store
        if (v === undefined) continue;
        try { acc += s.id + '=' + JSON.stringify(v) + ';'; } catch (_) { /* unserializable — skip */ }
    }
    return hash32(acc);
}

/** Record the current workspace as "saved to file" — called after a .ddcs is written OR opened. Stamps the time so the
 *  indicator can honestly read "Saved to file · Nm ago" (the ONLY thing that counts as saved; localStorage is temporary).
 *  An optional file NAME (from the intentional FSA save) lets the indicator read "Saved to <name>". */
export function markWorkspaceSavedToFile(name) {
    try { localStorage.setItem(WATERMARK_KEY, String(workspaceSignature())); } catch (_) {}
    try { localStorage.setItem(SAVED_AT_KEY, String(Date.now())); } catch (_) {}
    try { if (name) localStorage.setItem(SAVED_NAME_KEY, String(name)); else localStorage.removeItem(SAVED_NAME_KEY); } catch (_) {}
    try { window.dispatchEvent(new Event('ddcs:file-state')); } catch (_) {}
}

/** Epoch-ms of the last real .ddcs save/open, or null if this workspace has NEVER been saved to a portable file. */
export function fileSavedAt() {
    try { const v = localStorage.getItem(SAVED_AT_KEY); return v == null ? null : (Number(v) || null); } catch (_) { return null; }
}

/** The last saved .ddcs file NAME, or null (a download / restore that carried no name). */
export function fileSavedName() {
    try { return localStorage.getItem(SAVED_NAME_KEY) || null; } catch (_) { return null; }
}

/** First-run baseline: adopt the current (seeded / restored) state as clean so the indicator only lights up on a real
 *  user CHANGE, not on boot's idempotent re-seed writes. No-op once a watermark exists. */
export function ensureWorkspaceWatermark() {
    try { if (localStorage.getItem(WATERMARK_KEY) == null) localStorage.setItem(WATERMARK_KEY, String(workspaceSignature())); } catch (_) {}
}

/** Whether a file-save baseline exists yet (false on a brand-new browser until the boot state settles). */
export function hasWorkspaceWatermark() {
    try { return localStorage.getItem(WATERMARK_KEY) != null; } catch (_) { return false; }
}

/** True when the workspace differs from the last .ddcs saved/opened — i.e. there is work not in a portable file. */
export function isWorkspaceDirtyToFile() {
    let mark; try { mark = localStorage.getItem(WATERMARK_KEY); } catch (_) { mark = null; }
    if (mark == null) return false;   // no baseline yet (ensureWorkspaceWatermark sets it once boot settles)
    return mark !== String(workspaceSignature());
}

/** The pre-open safety auto-export (the undo path): download the current workspace + stash it for verification. */
export async function safetyExport() {
    const obj = await buildBackup();
    const name = 'ddcs-workspace-before-open-' + fileStamp() + '.ddcs';
    UIUtils.downloadFile(name, JSON.stringify(obj, null, 2));
    if (typeof window !== 'undefined') window.__ddcsSafetyExport = { name, at: nowISO() };
    return { name, obj };
}

if (typeof window !== 'undefined') {
    window.ddcsBuildBackup = buildBackup;
    window.ddcsPreviewBackup = previewBackup;
    window.ddcsRestoreBackup = restoreBackup;
    window.ddcsExportBackup = exportEverything;
    window.ddcsSafetyExport = safetyExport;
    window.ddcsWorkspaceDirtyToFile = isWorkspaceDirtyToFile;
    window.ddcsMarkWorkspaceSaved = markWorkspaceSavedToFile;
    window.ddcsFileSavedAt = fileSavedAt;
    window.ddcsFileSavedName = fileSavedName;
}
