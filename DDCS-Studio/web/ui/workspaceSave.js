/**
 * ui/workspaceSave.js — INTENTIONAL SAVE (t1199).
 *
 * Ctrl+S / a Save button writes the WHOLE workspace (.ddcs) to a USER-OWNED file via the File System Access API — the
 * deliberate "saved" act. localStorage stays the TEMPORARY buffer (persistence-A principle); only this writes a portable
 * file the user owns. Works on web AND the exe (pywebview → WebView2 exposes Chromium FSA). Where FSA is unavailable
 * (Firefox / older Safari) it falls back to a plain timestamped download — still a user file, just no location-pick or
 * re-save-in-place. The chosen file HANDLE is remembered (in-session + persisted to IDB) so a later Ctrl+S re-saves the
 * SAME file with no re-pick — a real "Save", not "Save As every time".
 */
import { buildBackup, markWorkspaceSavedToFile, exportEverything } from '../data/backup.js';
import { setMachineName } from '../data/workspaceMachine.js';   // t1223 — saving names the workspace

const hasFSA = () => typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';   // checked at call time (robust + testable)
const PICKER_OPTS = { suggestedName: 'workspace.ddcs', types: [{ description: 'DDCS workspace', accept: { 'application/json': ['.ddcs'] } }] };
const DB = 'ddcs_fs', STORE = 'kv', KEY = 'workspace';

let handle = null;   // the current FSA file handle (this session; also persisted to IDB for cross-reload reuse)

// ── tiny IDB kv (handles are structured-cloneable) — best-effort; any failure just means "re-pick next time" ────────
function idb() {
    return new Promise((res, rej) => {
        const r = indexedDB.open(DB, 1);
        r.onupgradeneeded = () => { try { r.result.createObjectStore(STORE); } catch (_) {} };
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
}
async function persistHandle(h) { try { const db = await idb(); db.transaction(STORE, 'readwrite').objectStore(STORE).put(h, KEY); } catch (_) {} }
async function loadHandle() { try { const db = await idb(); return await new Promise((res) => { const g = db.transaction(STORE).objectStore(STORE).get(KEY); g.onsuccess = () => res(g.result || null); g.onerror = () => res(null); }); } catch (_) { return null; } }

async function ensurePermission(h) {
    if (!h || !h.queryPermission) return true;
    const opts = { mode: 'readwrite' };
    try {
        if ((await h.queryPermission(opts)) === 'granted') return true;
        return (await h.requestPermission(opts)) === 'granted';   // MUST be inside a user gesture
    } catch (_) { return false; }
}

async function writeToHandle(h, text) { const w = await h.createWritable(); await w.write(text); await w.close(); }

/**
 * The deliberate save. `pickNew` forces the picker (Save As / Duplicate). `suggestedName` seeds the picker's filename —
 * that is all Duplicate needs, because a duplicate IS a Save As under a different name over the same buildBackup bytes.
 * Returns {ok, name, viaFsa, aborted?}.
 */
export async function saveWorkspace({ pickNew = false, suggestedName = '' } = {}) {
    if (hasFSA()) {
        try {
            if (pickNew || !handle || !(await ensurePermission(handle))) {
                const opts = suggestedName ? { ...PICKER_OPTS, suggestedName } : PICKER_OPTS;
                handle = await window.showSaveFilePicker(opts);   // throws AbortError if the user cancels
                persistHandle(handle);
            }
            const text = JSON.stringify(await buildBackup(), null, 2);
            await writeToHandle(handle, text);
            const name = handle.name || 'workspace.ddcs';
            markWorkspaceSavedToFile(name);
            try { setMachineName(name); } catch (_) {}   // t1223 ONE-NAME RULE: the file's stem IS the workspace name
            return { ok: true, name, viaFsa: true };
        } catch (e) {
            if (e && e.name === 'AbortError') return { ok: false, aborted: true };   // user cancelled — do NOT fall back
            /* any other FSA failure → fall through to the download */
        }
    }
    await exportEverything();   // fallback: builds + downloads a timestamped .ddcs + marks saved (no persistent handle)
    return { ok: true, name: null, viaFsa: false };
}

function onKeydown(e) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    if ((e.key || '').toLowerCase() !== 's') return;
    e.preventDefault();   // stop the browser's Save-Page dialog
    saveWorkspace({ pickNew: e.shiftKey }).catch(() => {});   // Ctrl+Shift+S = Save As
}

function install() {
    window.addEventListener('keydown', onKeydown);
    loadHandle().then((h) => { if (h) handle = h; }).catch(() => {});   // restore the remembered file (permission re-checked on save)
    window.ddcsSaveWorkspace = saveWorkspace;
}

if (typeof window !== 'undefined') install();
