/**
 * ui/cloud/googleDrive.js — Google Drive BYO adapter (browser-direct, no server). Scope `drive.file` = the app
 * only ever sees files IT created (non-sensitive → no Google app-verification needed). Auth via Google Identity
 * Services (GIS) token model — Google's token endpoint isn't browser-CORS-friendly for the PKCE code exchange, so
 * GIS hands an access token straight to the browser. Storage = an app folder ("DDCS Studio") tracked by its Drive
 * file ID (stable across move/rename → never duplicates; name-search re-adopt if the stored id is lost).
 * Exposes the cloud-volume shape used by the Project Manager: ensureRoot / list / read / write / mkdir / del / rename.
 */
import { clientId } from './providers.js';

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const TOK = 'ddcs_cloud_token', FOLDER_KEY = 'ddcs_gdrive_folder';

const token = () => { try { return localStorage.getItem(TOK) || ''; } catch (e) { return ''; } };

/** Current Google access token (for the Picker, which takes the OAuth token directly). */
export const getAccessToken = () => token();

/** Adopt a user-chosen folder as the projects root (move-safe, tracked by id). Picked via the Google Picker —
 *  drive.file then has access to it, so the app lists/saves its own .mjson projects there. '' clears → back to
 *  the auto "DDCS Studio" folder on next ensureRoot(). */
export function setRoot(id) {
    try { id ? localStorage.setItem(FOLDER_KEY, id) : localStorage.removeItem(FOLDER_KEY); } catch (e) { /* */ }
}

function loadGis() {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) return Promise.resolve();
    return new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.defer = true;
        s.onload = res; s.onerror = () => rej(new Error('Google Identity Services failed to load'));
        document.head.appendChild(s);
    });
}

/** GIS token-model sign-in → resolves an access token (no secret, no server). */
export async function connectGoogle(clientId) {
    await loadGis();
    return new Promise((resolve, reject) => {
        const client = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId, scope: SCOPE,
            callback: (r) => (r && r.access_token) ? resolve(r.access_token) : reject(new Error((r && r.error) || 'no token')),
            error_callback: (e) => reject(new Error((e && e.type) || 'sign-in cancelled')),
        });
        client.requestAccessToken();
    });
}

async function api(url, opts = {}, retried = false) {
    const r = await fetch(url, { ...opts, headers: { Authorization: 'Bearer ' + token(), ...(opts.headers || {}) } });
    if (r.status === 401 && !retried) {
        try { await silentRefresh(); } catch (e) { throw new Error('cloud-auth'); }
        return api(url, opts, true);   // retry once with the freshly-minted token
    }
    if (r.status === 401) throw new Error('cloud-auth');
    if (!r.ok) throw new Error('Drive ' + r.status);
    return r;
}

/** Silently re-mint the access token via GIS (no popup if already consented) — keeps the user signed in across the
 *  ~1h token expiry and page reloads, so there's no hourly re-login. Throws if there's no client id or the silent
 *  grant fails (e.g. no Google session) — then the UI shows a reconnect. */
async function silentRefresh() {
    // Desktop (exe): GIS can't run in the embedded webview — the gateway holds the refresh token and mints a
    // fresh access token (bridge/bridge-app/fairy/oauth.py). Pull it and cache it for api().
    if (window.pywebview && window.pywebview.api) {
        let t = {};
        try { t = await (await fetch('/api/oauth/google/token', { headers: { 'X-DDCS-Local': '1' } })).json(); } catch (e) { /* */ }   // X-DDCS-Local: the token GET is CSRF-guarded (a Drive credential); same-origin Studio sends it
        if (t.access_token) { try { localStorage.setItem(TOK, t.access_token); } catch (e) { /* */ } return; }
        throw new Error('silent-fail');
    }
    await loadGis();
    const cid = clientId('google');
    if (!cid) throw new Error('no client id');
    return new Promise((resolve, reject) => {
        const c = window.google.accounts.oauth2.initTokenClient({
            client_id: cid, scope: SCOPE,
            callback: (resp) => { if (resp && resp.access_token) { try { localStorage.setItem(TOK, resp.access_token); } catch (e) { /* */ } resolve(); } else reject(new Error('no token')); },
            error_callback: () => reject(new Error('silent-fail')),
        });
        c.requestAccessToken({ prompt: '' });   // '' = silent grant when the user already consented
    });
}

/** Find or create the app folder; return its id (tracked, move-safe). */
export async function ensureRoot() {
    let id = '';
    try { id = localStorage.getItem(FOLDER_KEY) || ''; } catch (e) { /* */ }
    if (id) {
        try { const r = await (await api(`${API}/files/${id}?fields=id,trashed`)).json(); if (r.id && !r.trashed) return id; } catch (e) { /* re-find below */ }
    }
    const q = encodeURIComponent(`mimeType='${FOLDER_MIME}' and name='DDCS Studio' and trashed=false`);
    const found = await (await api(`${API}/files?q=${q}&fields=files(id)`)).json();
    id = (found.files && found.files[0] && found.files[0].id) || '';
    if (!id) {
        const made = await (await api(`${API}/files?fields=id`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'DDCS Studio', mimeType: FOLDER_MIME }) })).json();
        id = made.id;
    }
    try { localStorage.setItem(FOLDER_KEY, id); } catch (e) { /* */ }
    return id;
}

/** Immediate children of a folder id → [{ id, name, type:'folder'|'project', savedAt }] (folders first, then name). */
export async function list(folderId) {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
    const r = await (await api(`${API}/files?q=${q}&fields=files(id,name,mimeType,modifiedTime)&orderBy=folder,name`)).json();
    return (r.files || []).map((f) => ({
        id: f.id, name: f.name,
        type: f.mimeType === FOLDER_MIME ? 'folder' : 'project',
        savedAt: f.modifiedTime,
    }));
}

export async function read(fileId) { return (await api(`${API}/files/${fileId}?alt=media`)).json(); }

export async function mkdir(name, parentId) {
    const r = await (await api(`${API}/files?fields=id`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }) })).json();
    return r.id;
}

/** Create or overwrite <name>.mjson in parentId with `obj` (JSON). Returns the file id. */
export async function write(name, obj, parentId) {
    const safe = name.replace(/'/g, "\\'");
    const q = encodeURIComponent(`'${parentId}' in parents and name='${safe}' and trashed=false`);
    const ex = await (await api(`${API}/files?q=${q}&fields=files(id)`)).json();
    const content = JSON.stringify(obj, null, 2);
    if (ex.files && ex.files[0]) {
        await api(`${UPLOAD}/files/${ex.files[0].id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: content });
        return ex.files[0].id;
    }
    const boundary = 'ddcs' + Math.random().toString(16).slice(2);
    const meta = JSON.stringify({ name, parents: [parentId], mimeType: 'application/json' });
    const multipart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`
        + `--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;
    const r = await (await api(`${UPLOAD}/files?uploadType=multipart&fields=id`, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body: multipart })).json();
    return r.id;
}

export async function del(id) { await api(`${API}/files/${id}`, { method: 'DELETE' }); }
/**
 * t1233 — TRASH, not delete. `del` above is files.delete: permanent and unrecoverable. Drive's own trash keeps a file
 * for ~30 days and the user can restore it themselves, which is the honest thing to do with a whole workspace — and it
 * is what lets the cloud delete confirm promise something DIFFERENT from the local one (removeEntry has no trash).
 */
export async function trash(id) {
    await api(`${API}/files/${id}?fields=id`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) });
}
export async function rename(id, name) { await api(`${API}/files/${id}?fields=id`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }); }

/** The signed-in account → { name, email }. about.get works with the drive.file scope (no extra consent). Best-effort. */
export async function getUserInfo() {
    try {
        const u = (await (await api(`${API}/about?fields=user`)).json()).user || {};
        return { name: u.displayName || '', email: u.emailAddress || '' };
    } catch (e) { return { name: '', email: '' }; }
}
