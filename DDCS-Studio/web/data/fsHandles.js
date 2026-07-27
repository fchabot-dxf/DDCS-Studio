/**
 * data/fsHandles.js — the remembered File System Access handles (t1225).
 *
 * TWO handles describe where a workspace lives: the FILE it was saved to / opened from, and the FOLDER the user keeps
 * workspaces in. Both are structured-cloneable, so IndexedDB remembers them across reloads and the app can re-save in
 * place (a real "Save", not "Save As every time") and list the folder without an OS dialog.
 *
 * They live HERE, in one place, because both the save path (ui/workspaceSave.js) and the manager (ui/workspaceManager.js)
 * read and WRITE both of them — opening a workspace has to retarget the save handle, or the next Ctrl+S silently
 * overwrites the file you opened FROM the one you opened. A shared seam beats two private copies that can disagree.
 *
 * Every operation is best-effort: a failure just means "re-pick next time", never a broken save.
 */
const DB = 'ddcs_fs', STORE = 'kv';
export const FILE_KEY = 'workspace';         // the .ddcs this workspace is saved to
export const FOLDER_KEY = 'workspaceFolder'; // the folder the user keeps workspaces in

function idb() {
    return new Promise((res, rej) => {
        const r = indexedDB.open(DB, 1);
        r.onupgradeneeded = () => { try { r.result.createObjectStore(STORE); } catch (_) {} };
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
}

export async function getHandle(key) {
    try {
        const db = await idb();
        return await new Promise((res) => {
            const g = db.transaction(STORE).objectStore(STORE).get(key);
            g.onsuccess = () => res(g.result || null); g.onerror = () => res(null);
        });
    } catch (_) { return null; }
}

/** Remember a handle under `key`; a null/undefined handle FORGETS it (used when an opened file has no handle). */
export async function putHandle(key, h) {
    try {
        const db = await idb();
        const os = db.transaction(STORE, 'readwrite').objectStore(STORE);
        if (h) os.put(h, key); else os.delete(key);
    } catch (_) {}
}

/** Is this handle usable right now? (permission is re-checked per handle; requesting MUST be inside a user gesture) */
export async function handleGranted(h, mode = 'readwrite') {
    if (!h) return false;
    if (!h.queryPermission) return true;   // a shape without the permission API (test stub / older engine) — assume usable
    try { return (await h.queryPermission({ mode })) === 'granted'; } catch (_) { return false; }
}

export async function requestHandle(h, mode = 'readwrite') {
    if (await handleGranted(h, mode)) return true;
    if (!h || !h.requestPermission) return false;
    try { return (await h.requestPermission({ mode })) === 'granted'; } catch (_) { return false; }
}
