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
 * OPENING IS THE WHOLE FILE (t1225). The .ddcs IS the workspace, so a restore leaves you with exactly what the file
 * says — every declared store is CLEARED to its default first, then the file's stores are written. A store the file
 * does not carry is therefore RESET, not left holding the previous workspace's values: the old keep-it behaviour
 * produced a blend that was neither the file nor what you had, and then marked that blend "saved".
 * A backup whose v is newer than we understand is flagged. Sensitive keys (tokens / cloud creds / device identity) are
 * NOT backed up. There is no silent safety auto-export: an unsaved buffer is offered ONE save-first prompt instead
 * (ui/workspaceManager.js), because a file appearing in Downloads that nobody asked for is not consent.
 */
import { UIUtils } from '../ui/uiUtils.js';
import { exportAllEntries, importAllEntries, clearAllEntries } from '../ui/projects/projectStore.js';
import { loadUserOps } from '../blocks/userOps.js';
import { getMachine, setMachine, MACHINE_KEY } from './workspaceMachine.js';   // t1217 — the workspace's ONE machine record

export const BACKUP_VERSION = 1;
const MACRO_KIND = 'ddcs.backup';

const appVersion = () => { try { return document.querySelector('.ver')?.textContent.trim() || 'unknown'; } catch (_) { return 'unknown'; } };
const nowISO = () => { try { return new Date().toISOString(); } catch (_) { return ''; } };
const fileStamp = () => nowISO().slice(0, 19).replace(/[:T]/g, '-') || 'backup';
const safeParse = (s) => { try { return JSON.parse(s); } catch (_) { return undefined; } };
const len = (a) => Array.isArray(a) ? a.length : 0;

// ── store-kind factories — each returns { read(), write(value), clear() } over the store's OWN persisted form ───
// `clear` is what "reset to default" means for that KIND, declared once beside its read/write so a whole-file open
// never needs a second, per-store list of how to undo a store (t1225).
// A localStorage JSON store: read = parse the key, write = stringify back (the SAME codec the store uses).
const ls = (key) => ({
    read: () => { const v = localStorage.getItem(key); return v == null ? undefined : safeParse(v); },
    write: (val) => { if (val !== undefined) localStorage.setItem(key, JSON.stringify(val)); },
    clear: () => localStorage.removeItem(key),
});
// Several coupled localStorage keys (e.g. the pane prefs) captured as { key: value } and restored key-by-key.
const lsMulti = (keys) => ({
    read: () => { const o = {}; let any = false; for (const k of keys) { const v = localStorage.getItem(k); if (v != null) { o[k] = safeParse(v); any = true; } } return any ? o : undefined; },
    write: (val) => { if (!val) return; for (const k of keys) if (Object.prototype.hasOwnProperty.call(val, k)) localStorage.setItem(k, JSON.stringify(val[k])); },
    clear: () => { for (const k of keys) localStorage.removeItem(k); },
});
// All localStorage keys sharing a prefix (e.g. the per-op-type presets ddcs_tpl_*), captured as { key: value }.
const lsPrefix = (prefix) => ({
    read: () => { const o = {}; let any = false; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(prefix)) { o[k] = safeParse(localStorage.getItem(k)); any = true; } } return any ? o : undefined; },
    write: (val) => { if (!val) return; for (const k in val) if (k.startsWith(prefix)) localStorage.setItem(k, JSON.stringify(val[k])); },
    clear: () => { const doomed = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(prefix)) doomed.push(k); } for (const k of doomed) localStorage.removeItem(k); },
});

// ── THE DECLARED REGISTRY — the single source of truth for what a backup contains ───────────────────────────────
export const BACKUP_STORES = [
    { id: 'settings', label: 'Settings + tool table', ...ls('ddcs_studio_settings'), count: (v) => len(v && v.atc && v.atc.tools), unit: 'tools' },
    // t1217 — THE WORKSPACE'S ONE MACHINE ([[one-workspace-one-machine]]): the .ddcs IS the machine, so it carries the
    // machine's IDENTITY (name + controllerId). Its CONFIG is not duplicated here — the envelope/WCS/motors/homing ride
    // the `settings` row and the user vars ride `variables`, exactly as before. USER RULING: opening/restoring a
    // workspace ADOPTS the file's controller, so this row's write RETARGETS the live controller/dialect (the old
    // keep-the-local-controller behaviour contradicted "the file is the machine").
    // t1255 (user) — the LABEL says its CONTENT, not its scope. "Machine (this workspace)" told a reader WHERE the row
    // applies and nothing about what is in it, which is the question a delta chip or a file-contents list is answering.
    // Every surface reads this one string, so the wording improves everywhere at once.
    { id: 'machine', label: 'Machine identity (name + controller)', unit: 'machine',
      read: () => { try { return getMachine(); } catch (_) { return undefined; } },
      write: (val) => { try { if (val) setMachine(val, true); } catch (_) {} },
      clear: () => localStorage.removeItem(MACHINE_KEY),   // no record → getMachine() derives the default one
      count: (v) => (v && (v.name || v.controllerId) ? 1 : 0) },
    // t1223 — the legacy `profiles` row is GONE ([[no-legacy-burden]]). It kept a pre-t1217 profile library readable so
    // an old .ddcs could still be migrated on open. There is no install base to migrate, and while that row existed it
    // rode along inside every NEW .ddcs too — the compat surface reproducing itself into files that never needed it.
    {
        id: 'userOps', label: 'Custom wizards', count: (v) => len(v), unit: 'wizards',
        read: ls('ddcs_user_ops').read,
        // re-register into the live federated layer after writing the key (so restored wizards appear without a reload).
        write: (val) => { ls('ddcs_user_ops').write(val); try { loadUserOps(); } catch (_) {} },
        clear: () => { ls('ddcs_user_ops').clear(); try { loadUserOps(); } catch (_) {} },
    },
    // t1137 — the CAM pack (ddcs_campack = macrosApp CAMPACK_KEY) rides inside the workspace. No live-reload hook: the
    // open flow reloads the page (ui/workspaceManager.js), so macrosApp re-reads _camPack = loadCamPack() on boot and re-renders.
    { id: 'campack', label: 'CAM pack', ...ls('ddcs_campack'), count: (v) => len(v && v.slots), unit: 'slots' },
    { id: 'wizardLayout', label: 'Wizard bar layout', ...ls('ddcs_wizard_layout'), count: (v) => (v ? (len(v.customGroups) + Object.keys(v.entries || {}).length) : 0), unit: 'overrides' },
    { id: 'presets', label: 'Wizard presets', ...lsPrefix('ddcs_tpl_'), count: (v) => (v ? Object.values(v).reduce((n, list) => n + len(list), 0) : 0), unit: 'presets' },
    { id: 'variables', label: 'Variables', ...ls('ddcs_vars_persistent'), count: (v) => (Array.isArray(v) ? v.filter((x) => x && !x.isSys).length : 0), unit: 'user vars' },
    { id: 'displayPrefs', label: 'Preview display prefs', ...ls('ddcs_display'), count: (v) => (v ? Object.keys(v).length : 0), unit: 'elements' },
    { id: 'panePrefs', label: 'Panel layout', ...lsMulti(['ddcs_panes', 'ddcs_pane_ratio', 'ddcs_follow_exec', 'ddcs_form_sections']), count: (v) => (v ? Object.keys(v).length : 0), unit: 'keys' },
    // The project VOLUME is written by CLEAR-then-import (its importAllEntries puts entry by entry, so a bare import
    // would MERGE the file's projects into whatever this browser held — the blend a whole-file open must not produce).
    { id: 'projects', label: 'Projects (local)', async: true, count: (v) => (Array.isArray(v) ? v.filter((e) => e && e.type === 'project').length : 0), unit: 'projects',
      read: () => exportAllEntries(), write: (val) => importAllEntries(val), clear: () => clearAllEntries() },
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

/**
 * Open a workspace — the WHOLE file, always (t1225; there is no store-picker any more, so there is no subset to ask
 * about). Each declared store is CLEARED to its default and then written from the file, so what you are left with is
 * exactly the file: a store the file does not carry is RESET (`reset`), never left holding the previous workspace's
 * values. Returns { restored, reset, failed }. Async (the project volume is IDB).
 */
export async function restoreBackup(obj) {
    const stores = (obj && obj.stores) || {};
    const restored = [], reset = [], failed = [];
    for (const s of BACKUP_STORES) {
        try { await s.clear(); } catch (_) { /* best-effort: a store that cannot be cleared is still overwritten below */ }
        if (!Object.prototype.hasOwnProperty.call(stores, s.id)) { reset.push(s.id); continue; }
        try { await s.write(stores[s.id]); restored.push(s.id); } catch (_) { failed.push(s.id); }
    }
    // t1223 — the legacy-library migration that used to run here is GONE ([[no-legacy-burden]]). The file's identity
    // now arrives the one way it should: the declared `machine` row's own write, which adopts the file's controller.
    // The caller stamps the FILENAME (one-name rule) before marking saved — see ui/workspaceManager.js.
    return { restored, reset, failed };
}

/** Save the whole workspace → download one .ddcs file. The no-FSA fallback path; `fileName` is the name the user typed
 *  (t1225 — a workspace never gets an autogenerated backup-style name; only a nameless caller falls back to a stamp). */
export async function exportEverything(fileName) {
    const obj = await buildBackup();
    const name = fileName || ('ddcs-workspace-' + fileStamp() + '.ddcs');
    UIUtils.downloadFile(name, JSON.stringify(obj, null, 2));
    // t1231 — mark it under the name it was ACTUALLY written as, never nameless. A nameless mark produced the state the
    // user screenshotted: "Untitled workspace · Saved · nothing has changed" — saved to a file nobody could name.
    markWorkspaceSavedToFile(name);
    return obj;
}

// ── "unsaved to file" watermark (PERSISTENCE-A) ─────────────────────────────────────────────────────────────────
// The workspace auto-persists to localStorage; a .ddcs is the only PORTABLE copy. We surface an "unsaved to file"
// signal so the user knows their work lives only in this browser until they Save workspace. ONE SOURCE: the signal is
// a content SIGNATURE over the SAME BACKUP_STORES registry a .ddcs writes — it changes iff a fresh .ddcs would differ,
// so a new store is covered automatically and there is no second, divergeable definition of "the workspace state".
const WATERMARK_KEY = 'ddcs_file_watermark';
const SAVED_AT_KEY = 'ddcs_file_saved_at';   // epoch-ms of the last REAL .ddcs save/open — set ONLY by a file save, never the boot baseline
const STORE_MARKS_KEY = 'ddcs_file_store_marks';   // t1223 — per-store signatures at the last save (the delta baseline)
const SAVED_NAME_KEY = 'ddcs_file_saved_name';   // the last .ddcs file NAME (for the indicator's "Saved to <name>"); optional
const SAVED_PLACE_KEY = 'ddcs_file_saved_place';   // t1233 — WHERE that file lives: 'local' (a granted folder) | 'cloud' (Drive)
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

/**
 * t1223 — PER-STORE SIGNATURES, the baseline the workspace manager's DELTA is derived from.
 *
 * Same principle as `workspaceSignature`, one level finer: a hash PER declared store rather than one over all of them.
 * That is what lets the manager say WHICH parts changed since the last save instead of only "something did" — and it
 * is derived from the SAME declared registry, so a new store row shows up in the delta for free, with no second list
 * to keep in step. The async (IDB projects) store is skipped for the same reason it is skipped there: it has its own
 * .mjson save grain and its read cannot be done synchronously on a poll.
 */
export function storeSignatures() {
    const out = {};
    for (const s of BACKUP_STORES) {
        if (s.async) continue;
        let v; try { v = s.read(); } catch (_) { continue; }
        if (v === undefined || (v && typeof v.then === 'function')) continue;
        try { out[s.id] = hash32(JSON.stringify(v)); } catch (_) { /* unserializable — omit */ }
    }
    return out;
}

/**
 * Which declared stores DIFFER from the last saved/opened .ddcs → [{ id, label, unit, count, changed }].
 * `changed` is null when there is no baseline yet (never saved), which the UI must show as "not saved yet" rather than
 * inventing a "everything changed" that would be equally true and equally useless.
 */
export function workspaceDelta() {
    let base = null;
    try { base = JSON.parse(localStorage.getItem(STORE_MARKS_KEY) || 'null'); } catch (_) { base = null; }
    const now = storeSignatures();
    return BACKUP_STORES.filter((s) => !s.async).map((s) => {
        let v; try { v = s.read(); } catch (_) { v = undefined; }
        return {
            id: s.id, label: s.label, unit: s.unit || '',
            count: (s.count && v !== undefined) ? s.count(v) : null,
            changed: base ? (base[s.id] !== now[s.id]) : null,
        };
    });
}

/**
 * Record the current workspace as "saved to file" — called after a .ddcs is written OR opened.
 *
 * THE NAME IS REQUIRED (t1231). Under the one-name rule a save IS a file with a name, so "saved, but we cannot say to
 * what" is not a state this app can be in — and a nameless call used to create exactly that: it stamped the time and
 * DELETED the name, leaving the manager to report "Untitled workspace · Saved · nothing has changed" (the state the
 * user screenshotted). A nameless call now records nothing at all rather than half a fact.
 */
export function markWorkspaceSavedToFile(name, place = 'local') {
    const file = String(name == null ? '' : name).trim();
    if (!file) return;   // not a file save — recording it as one is how the impossible state got made
    try { localStorage.setItem(WATERMARK_KEY, String(workspaceSignature())); } catch (_) {}
    try { localStorage.setItem(STORE_MARKS_KEY, JSON.stringify(storeSignatures())); } catch (_) {}   // t1223 — the per-store delta baseline
    try { localStorage.setItem(SAVED_AT_KEY, String(Date.now())); } catch (_) {}
    try { localStorage.setItem(SAVED_NAME_KEY, file); } catch (_) {}
    try { localStorage.setItem(SAVED_PLACE_KEY, place === 'cloud' ? 'cloud' : 'local'); } catch (_) {}   // t1233
    try { window.dispatchEvent(new Event('ddcs:file-state')); } catch (_) {}
}

/** WHERE this workspace's file lives — 'local' (a granted folder) or 'cloud' (Drive). A plain Save goes back there. */
export function fileSavedPlace() {
    try { return localStorage.getItem(SAVED_PLACE_KEY) === 'cloud' ? 'cloud' : 'local'; } catch (_) { return 'local'; }
}

/**
 * THE FILE IS GONE (t1231) — the workspace was saved to a .ddcs and that file has just been DELETED. The buffer keeps
 * working; what changed is that its work now exists in no file at all. So: forget the name, the time and the delta
 * baseline, and mark the workspace UNSAVED — not "clean", which is what simply clearing the watermark would say (an
 * absent watermark reads as nothing-to-report). The sentinel can never equal a 32-bit hash, so the disk button and the
 * manager both read the truth: there is work here and no file holding it.
 */
export function forgetWorkspaceFile() {
    try { localStorage.setItem(WATERMARK_KEY, 'no-file'); } catch (_) {}
    try { localStorage.removeItem(STORE_MARKS_KEY); } catch (_) {}
    try { localStorage.removeItem(SAVED_AT_KEY); } catch (_) {}
    try { localStorage.removeItem(SAVED_NAME_KEY); } catch (_) {}
    try { localStorage.removeItem(SAVED_PLACE_KEY); } catch (_) {}
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

// t1225 — `safetyExport` is DELETED, not just unwired. It downloaded a .ddcs nobody asked for before every destructive
// landing; the t1223 sweep took its last caller, and a dead function that writes files is an invitation to call it
// again. The protection is now the save-first PROMPT (ui/workspaceManager.js confirmDiscardBuffer).

if (typeof window !== 'undefined') {
    window.ddcsBuildBackup = buildBackup;
    window.ddcsPreviewBackup = previewBackup;
    window.ddcsRestoreBackup = restoreBackup;
    window.ddcsExportBackup = exportEverything;
    window.ddcsWorkspaceDirtyToFile = isWorkspaceDirtyToFile;
    window.ddcsMarkWorkspaceSaved = markWorkspaceSavedToFile;
    window.ddcsFileSavedAt = fileSavedAt;
    window.ddcsFileSavedName = fileSavedName;
    window.ddcsFileSavedPlace = fileSavedPlace;   // t1233 — local folder or Drive
    window.ddcsWorkspaceDelta = workspaceDelta;   // t1223 — the manager's per-store delta
}
