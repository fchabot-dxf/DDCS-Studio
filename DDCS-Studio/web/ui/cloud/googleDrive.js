/**
 * ui/cloud/googleDrive.js — Google Drive BYO adapter (browser-direct, no server). Scope `drive.file` = the app
 * only ever sees files IT created (non-sensitive → no Google app-verification needed). Auth via Google Identity
 * Services (GIS) token model — Google's token endpoint isn't browser-CORS-friendly for the PKCE code exchange, so
 * GIS hands an access token straight to the browser. Storage = an app folder ("DDCS Studio") tracked by its Drive
 * file ID (stable across move/rename → never duplicates; name-search re-adopt if the stored id is lost).
 * Exposes the cloud-volume shape used by the Project Manager: ensureRoot / list / read / write / mkdir / del / rename.
 */
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const TOK = 'ddcs_cloud_token', FOLDER_KEY = 'ddcs_gdrive_folder';

const token = () => { try { return localStorage.getItem(TOK) || ''; } catch (e) { return ''; } };

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

async function api(url, opts = {}) {
    const r = await fetch(url, { ...opts, headers: { Authorization: 'Bearer ' + token(), ...(opts.headers || {}) } });
    if (r.status === 401) throw new Error('google-auth');   // token expired → caller re-connects
    if (!r.ok) throw new Error('Drive ' + r.status);
    return r;
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
export async function rename(id, name) { await api(`${API}/files/${id}?fields=id`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }); }
