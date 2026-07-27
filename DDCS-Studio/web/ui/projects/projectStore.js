/**
 * ui/projects/projectStore.js — the LOCAL project volume of the project VFS: folders + `.mjson` projects in
 * IndexedDB, browseable like a disk. One flat object store keyed by full PATH ("folder/sub/name"); folders are
 * entries with type 'folder' (so empty ones persist) and are also implied by any deeper project path. PROJECTS
 * ONLY — the controller CNCDISK (.nc) is NOT here (it stays in the Gateway Files tab). Cloud is a future volume.
 */
const DB_NAME = 'ddcs_projects';
const STORE = 'entries';
const DB_VERSION = 1;

let _db = null;
function db() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const d = req.result;
            if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'path' });
        };
        req.onsuccess = () => { _db = req.result; resolve(_db); };
        req.onerror = () => reject(req.error);
    });
}
const pReq = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
// Each op gets its own short transaction (avoids the "transaction inactive" trap when awaiting between requests).
async function getAll() { return pReq((await db()).transaction(STORE, 'readonly').objectStore(STORE).getAll()); }
async function getOne(path) { return pReq((await db()).transaction(STORE, 'readonly').objectStore(STORE).get(path)); }
async function put(entry) { return pReq((await db()).transaction(STORE, 'readwrite').objectStore(STORE).put(entry)); }
async function del(path) { return pReq((await db()).transaction(STORE, 'readwrite').objectStore(STORE).delete(path)); }

// ── path helpers ────────────────────────────────────────────────────────────
export const norm = (p) => String(p || '').replace(/^\/+|\/+$/g, '');
export const joinPath = (folder, name) => norm(folder ? norm(folder) + '/' + name : name);
export const parentOf = (p) => { const n = norm(p); const i = n.lastIndexOf('/'); return i < 0 ? '' : n.slice(0, i); };
export const baseName = (p) => { const n = norm(p); const i = n.lastIndexOf('/'); return i < 0 ? n : n.slice(i + 1); };

/** PURE: the immediate children (folders + projects) of `folder` from a flat entry list. Folders first, then alpha. */
export function childrenOf(all, folder = '') {
    const f = norm(folder);
    const prefix = f ? f + '/' : '';
    const byName = new Map();
    for (const e of all) {
        if (!e.path.startsWith(prefix)) continue;
        const rest = e.path.slice(prefix.length);
        if (!rest) continue;
        const slash = rest.indexOf('/');
        if (slash < 0) {
            byName.set(rest, { path: e.path, name: rest, type: e.type, savedAt: e.savedAt });
        } else {
            const fname = rest.slice(0, slash);
            if (!byName.has(fname)) byName.set(fname, { path: prefix + fname, name: fname, type: 'folder' });
        }
    }
    return [...byName.values()].sort((a, b) =>
        a.type === b.type ? a.name.localeCompare(b.name) : (a.type === 'folder' ? -1 : 1));
}

/** PURE: every folder path that exists (explicit folders + every ancestor of any entry), sorted. */
export function foldersFrom(all) {
    const set = new Set();
    for (const e of all) {
        if (e.type === 'folder') set.add(norm(e.path));
        let p = parentOf(e.path);
        while (p) { set.add(p); p = parentOf(p); }
    }
    return [...set].sort();
}

// ── volume ops ────────────────────────────────────────────────────────────
export async function list(folder = '') { return childrenOf(await getAll(), folder); }
export async function allFolders() { return foldersFrom(await getAll()); }
export async function mkdir(path) { const p = norm(path); if (p) await put({ path: p, type: 'folder' }); }
export async function saveProject(path, obj) {
    await put({ path: norm(path), type: 'project', data: obj, savedAt: new Date().toISOString() });
}
export async function readProject(path) { const e = await getOne(norm(path)); return e && e.type === 'project' ? e.data : null; }
export async function remove(path) {
    const p = norm(path);
    const all = await getAll();
    for (const e of all) if (e.path === p || e.path.startsWith(p + '/')) await del(e.path);
}
export async function rename(oldPath, newPath) {
    const o = norm(oldPath), n = norm(newPath);
    if (!o || !n || o === n) return;
    const all = await getAll();
    for (const e of all) {
        if (e.path !== o && !e.path.startsWith(o + '/')) continue;
        await del(e.path);
        await put({ ...e, path: n + e.path.slice(o.length) });
    }
}

// ── backup (t852) — the whole volume as verbatim entries, so the one-file backup moves the store's OWN persisted
//    shape (path/type/data/savedAt), never a second project serializer. importAllEntries puts each entry back as-is.
export async function exportAllEntries() { return getAll(); }
export async function importAllEntries(entries) { for (const e of (entries || [])) if (e && e.path) await put(e); }
/** Empty the volume — what "reset to default" means for this store when a workspace is opened (t1225 whole-file open). */
export async function clearAllEntries() { for (const e of await getAll()) await del(e.path); }
