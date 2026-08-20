/**
 * ui/cloud/driveJobs.js — SUBMIT A JOB FROM THE BROWSER, straight into the user's Drive (t2080).
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────────────────────────────────────────
 * Sending a job was a GATEWAY function: Studio called `/api/jobs`, the gateway wrote the file. That is fine on the
 * exe, which carries a gateway — and impossible on a phone, which cannot run one. The human's model has phones and
 * spare PCs as CLIENTS ("whether I'm using the Asus PC or my phone as a client"), so a client must be able to post
 * a job with no gateway of its own. It writes the job into the SAME Drive folder the gateway already polls; the
 * gateway claims and delivers it exactly as if a local gateway had queued it. Nothing new on the receiving side.
 *
 * ⭐ THE THING THAT MAKES THIS POSSIBLE, MEASURED RATHER THAN ASSUMED (2026-08-19). `drive.file` grants an app
 * access only to files "the app" created — and it was assumed that meant the OAuth CLIENT, which would have made
 * this useless: the browser signs in with the WEB client and the gateway with the DESKTOP client, so a
 * browser-written job would have been invisible to the gateway, failing SILENTLY (the gateway polling forever,
 * nothing logged). PROVEN OTHERWISE by test: the gateway's Desktop client listed AND read `DDCS Studio/`, a folder
 * created by the browser's Web client. Visibility is scoped to the Cloud PROJECT; both clients live in project
 * 895572525139, so the two ends already share one visibility domain. If that ever stops being true, this feature
 * breaks silently — which is why the fact is recorded here rather than in a commit message.
 *
 * ── THE CONTRACT WITH THE GATEWAY (bridge/bridge-app/fairy/backend/drive.py) ─────────────────────────────────────
 * Layout and naming are NOT free choices — the poller reads them literally:
 *   <root>/inbox/<jobId>.nc          the G-code            (`list_inbox` keys off the `.nc` suffix)
 *   <root>/inbox/<jobId>.map.json    the sidecar           (absent = deliver-only, which is what a browser sends)
 * `<root>` is the folder named by `config.drive_folder` — "DDCS Bridge" — NOT Studio's own "DDCS Studio" project
 * folder. Two different folders for two different jobs; writing into the wrong one means the gateway never sees it.
 *
 * ⚠ jobId MUST match `ops.make_job_id()`: `<YYYYMMDDTHHMMSS>_<microseconds>-<slug>`. It is not cosmetic —
 * `list_inbox` sorts ids and the poller claims `ids[0]`, so the timestamp prefix IS the FIFO order. A different
 * shape would still deliver, but out of order, and only under load — the worst kind of bug to find later.
 *
 * ⚠ UPSERT, never blind-create: Drive permits two files with one name in a folder, so a re-send of the same id
 * would leave the poller a coin flip between them. Same discipline as drive.py's own `_upsert`.
 */
import { getAccessToken } from './googleDrive.js';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const ROOT_NAME = 'DDCS Bridge';   // == config.drive_folder; the GATEWAY's folder, not Studio's project folder
const INBOX = 'inbox';

const q = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

async function call(url, opts = {}) {
    const tok = getAccessToken();
    if (!tok) throw new Error('not signed in to Google — connect your account first');
    const r = await fetch(url, { ...opts, headers: { Authorization: 'Bearer ' + tok, ...(opts.headers || {}) } });
    if (!r.ok) throw new Error(`Drive ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return r;
}

async function findChild(parentId, name, folder = false) {
    let query = `name = '${q(name)}' and '${q(parentId)}' in parents and trashed = false`;
    if (folder) query += ` and mimeType = '${FOLDER_MIME}'`;
    const r = await (await call(`${API}/files?q=${encodeURIComponent(query)}&fields=files(id)`)).json();
    return (r.files && r.files[0] && r.files[0].id) || '';
}

async function mkdirAt(name, parentId) {
    const body = { name, mimeType: FOLDER_MIME };
    if (parentId) body.parents = [parentId];
    const r = await (await call(`${API}/files?fields=id`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })).json();
    return r.id;
}

/** The GATEWAY's folder (creates it if this client is the first to write). Cached per page load only —
 *  a stale id after the user trashes the folder should cost one failed call, not a wrong write. */
let _inboxId = '';
async function inboxFolder() {
    if (_inboxId) return _inboxId;
    const query = `name = '${q(ROOT_NAME)}' and mimeType = '${FOLDER_MIME}' and 'root' in parents and trashed = false`;
    const r = await (await call(`${API}/files?q=${encodeURIComponent(query)}&fields=files(id)`)).json();
    const root = (r.files && r.files[0] && r.files[0].id) || await mkdirAt(ROOT_NAME, null);
    _inboxId = await findChild(root, INBOX, true) || await mkdirAt(INBOX, root);
    return _inboxId;
}

/** Create the file, or REPLACE its content if one of that name is already in the folder (see the upsert note). */
async function upsert(folderId, name, content, mime) {
    const existing = await findChild(folderId, name);
    if (existing) {
        await call(`${UPLOAD}/files/${existing}?uploadType=media`, {
            method: 'PATCH', headers: { 'Content-Type': mime }, body: content,
        });
        return existing;
    }
    const boundary = 'ddcs' + Math.random().toString(16).slice(2);
    const meta = JSON.stringify({ name, parents: [folderId] });
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`
        + `--${boundary}\r\nContent-Type: ${mime}\r\n\r\n${content}\r\n--${boundary}--`;
    const r = await (await call(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
        method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body,
    })).json();
    return r.id;
}

/** `<YYYYMMDDTHHMMSS>_<micro>-<slug>` — a port of ops.make_job_id, whose SORT ORDER is the queue's FIFO order.
 *  JS has no microseconds, so the sub-second field is milliseconds padded to 6 digits: same width, same ordering,
 *  and a collision needs two sends inside one millisecond from one browser. */
export function makeJobId(name, now = new Date()) {
    const p = (n, w = 2) => String(n).padStart(w, '0');
    const stamp = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}T`
        + `${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
    const micro = p(now.getMilliseconds() * 1000, 6);
    const base = name.includes('.') ? name.slice(0, name.lastIndexOf('.')) : name;
    const slug = base.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'job';
    return `${stamp}_${micro}-${slug}`;
}

/**
 * Put a job in the gateway's Drive inbox. Returns { jobId, tracked:false }, matching the shape
 * `client.submitJob()` returns so the Send view can treat both paths alike.
 *
 * DELIVER-ONLY by design: beacons are a Modbus link between the CONTROLLER and its gateway, so a browser has
 * nothing to instrument for and no map to write. The gateway's own `_claim` already treats a map-less job as
 * deliver-only ("delivered" is terminal) — no new state, no special case on the receiving side.
 */
export async function submitJobToDrive(name, nc, contentHash) {
    const jobId = makeJobId(name);
    const folder = await inboxFolder();
    // The MAP GOES FIRST, and the order is load-bearing: `list_inbox` keys off the `.nc`, so the moment that
    // file exists the poller may claim the job — on its own 15s tick, with no coordination with this browser.
    // Writing the sidecar first means a job is never claimable before the metadata it carries is readable.
    if (contentHash) {
        await upsert(folder, `${jobId}.map.json`, JSON.stringify({ content_hash: contentHash, source: name }, null, 2),
                     'application/json');
    }
    await upsert(folder, `${jobId}.nc`, nc, 'text/plain');
    return { jobId, tracked: false, via: 'drive' };
}

/** Is the browser able to send this way at all? (signed in — the folder is created on demand). */
export function canSendViaDrive() { return !!getAccessToken(); }
