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
    { id: 'profiles', label: 'Profile library', ...ls('ddcs_profile_library'), count: (v) => len(v && v.profiles), unit: 'profiles' },
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
    { id: 'projects', label: 'Projects (local)', count: (v) => (Array.isArray(v) ? v.filter((e) => e && e.type === 'project').length : 0), unit: 'projects', read: () => exportAllEntries(), write: (val) => importAllEntries(val) },
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
    return { restored, skipped };
}

/** Save the whole workspace → download one .ddcs file (t1137; the JSON shape is unchanged, so it opens on any build). */
export async function exportEverything() {
    const obj = await buildBackup();
    UIUtils.downloadFile('ddcs-workspace-' + fileStamp() + '.ddcs', JSON.stringify(obj, null, 2));
    return obj;
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
}
