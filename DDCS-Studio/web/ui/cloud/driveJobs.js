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

/** The GATEWAY's folder for ONE MACHINE: <root>/<machine name>/inbox (t2101 - S4).
 *  Creates on demand, because a SEND has to succeed on a Drive that has never been used.
 *
 *  ⭐ THE FOLDER NAME IS THE WORKSPACE'S MACHINE NAME, VERBATIM. The gateway resolves the same folder from
 *  `cfg.machine_name` (drive.py `_machine_root`), and Studio's one-name rule makes the workspace name, its
 *  filename and every label the SAME string - so the two sides join on a name a human can read, and the
 *  stable `machine_id` in the heartbeat is what makes a RENAME detectable rather than silent.
 *  ⛔ NEVER SLUG IT. A slug would be one transform implemented twice that must agree byte-for-byte forever;
 *  Drive takes spaces, and the jobId hazard t2080 already paid for that lesson once.
 *  ⛔ AND NEVER FALL BACK TO THE FLAT <root>/inbox. Two gateways sharing one inbox is the ENTIRE hazard S4
 *  exists to remove: `_maybe_claim` takes ids[0] with no notion of which machine a job is FOR, so a fallback
 *  would deliver an Expert program to a V4.1. The gateway refuses to start without a name; this refuses to
 *  send without one, for exactly the same reason.
 *  Cached per page load only - a stale id after the user trashes the folder should cost one failed call. */
let _inboxId = '', _inboxFor = '';
async function inboxFolder(machineName) {
    const machine = String(machineName || '').trim();
    if (!machine) {
        throw new Error('This workspace has no machine name, so Studio cannot tell which machine gateway to send to. '
                        + 'Name the workspace (Save As) and try again.');
    }
    if (_inboxId && _inboxFor === machine) return _inboxId;
    const query = `name = '${q(ROOT_NAME)}' and mimeType = '${FOLDER_MIME}' and 'root' in parents and trashed = false`;
    const r = await (await call(`${API}/files?q=${encodeURIComponent(query)}&fields=files(id)`)).json();
    const root = (r.files && r.files[0] && r.files[0].id) || await mkdirAt(ROOT_NAME, null);
    const machineRoot = await findChild(root, machine, true) || await mkdirAt(machine, root);
    _inboxId = await findChild(machineRoot, INBOX, true) || await mkdirAt(INBOX, machineRoot);
    _inboxFor = machine;
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
export async function submitJobToDrive(name, nc, contentHash, machineName) {
    const jobId = makeJobId(name);
    const folder = await inboxFolder(machineName);
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

/* ── THE GATEWAY'S PUBLISHED HEARTBEAT (t2101) ───────────────────────────────────────────────────────────────
   WHY A READER EXISTS AT ALL. The gateway has been writing `gateway/heartbeat.json` every 20s since t2076
   (bridge.py `_publish_heartbeat`) and NOTHING HAS EVER READ IT — there is no `get_heartbeat` on the Python
   Backend either. So the browser's Drive path promises "the machine's gateway picks it up within ~15s" and
   then never looks again: if no gateway is running, the job sits in the inbox and the sender is never told.

   ⭐ WHAT THIS UNLOCKS IS NOT A NEW FEATURE, IT IS AN EXISTING GUARD REACHING A SECOND PATH. `send.js` already
   HARD-BLOCKS a controller mismatch (t1229 A2, via `data/controllerMatch.js`) — but it learns the controller
   from `ctx.client.profile()`, which needs a REACHABLE GATEWAY. On the Drive fallback there is no client to
   ask, so the block cannot run at all, and an Expert program can be sent at a V4.1. The heartbeat carries the
   same facts `profile()` returns (`controller_family`, `controller_name`), so the SAME comparison works here.

   ⚠ FRESHNESS COMES FROM DRIVE'S `modifiedTime`, NOT FROM `hb.last_seen`. `last_seen` is stamped by the
   GATEWAY's clock and would be compared against THIS device's clock; a few minutes of skew makes a live
   gateway look dead or a dead one look live. `modifiedTime` is stamped by Drive — ONE clock, both sides.
   `last_seen` is kept for DISPLAY only.

   ⛔⛔ "ABSENT" AND "INVISIBLE" ARE INDISTINGUISHABLE HERE, AND THE WORDING MUST RESPECT THAT. `drive.file`
   scopes visibility, and the one measurement on record (see the header note) proved the DESKTOP client can
   read WEB-created files — NOT the reverse, which is the direction this reader needs. If it turns out a Web
   client cannot see Desktop-created files, the query returns an EMPTY RESULT — byte-identical to "no gateway
   has ever run". ⇒ never say "no gateway has ever published"; say Studio CANNOT SEE one. That sentence is
   true under both causes, and it is the difference between a fact and a confident lie.

   ⚠ READS MUST NOT CREATE. `inboxFolder()` deliberately creates the root on demand because a SEND has to
   succeed; a read has no such right, and creating a folder here would manufacture the very "gateway folder
   exists" evidence someone might later reason from. Every lookup below is find-only. */
const HEARTBEAT_STALE_S = 60;   // 3 missed beats at bridge.py's heartbeat_s = 20.0

async function findChildMeta(parentId, name) {
    const query = `name = '${q(name)}' and '${q(parentId)}' in parents and trashed = false`;
    const r = await (await call(`${API}/files?q=${encodeURIComponent(query)}&fields=files(id,modifiedTime)`)).json();
    return (r.files && r.files[0]) || null;
}

/**
 * Read `<root>/<machine>/gateway/heartbeat.json`, WITHOUT creating anything.
 *
 * Returns `{ state, hb, ageS, machineName }` where `state` is one of:
 *   'signed-out'  no Google token — we cannot know anything
 *   'no-machine'  this workspace has no machine name, so there is no folder to look in
 *   'unseen'      nothing found. ⚠ MEANS "absent OR invisible" — never report it as "never ran"
 *   'stale'       found, but last written more than HEARTBEAT_STALE_S ago (per Drive's clock)
 *   'fresh'       a gateway is alive and `hb` carries what it is attached to
 *   'unreadable'  the lookup itself failed (network, 403, malformed JSON) — distinct from 'unseen' on purpose
 */
export async function readGatewayHeartbeat(machineName) {
    const out = { state: 'unseen', hb: null, ageS: null, machineName: machineName || '' };
    if (!getAccessToken()) return { ...out, state: 'signed-out' };
    if (!machineName || !String(machineName).trim()) return { ...out, state: 'no-machine' };
    try {
        const rootQ = `name = '${q(ROOT_NAME)}' and mimeType = '${FOLDER_MIME}' and 'root' in parents and trashed = false`;
        const rr = await (await call(`${API}/files?q=${encodeURIComponent(rootQ)}&fields=files(id)`)).json();
        const root = rr.files && rr.files[0] && rr.files[0].id;
        if (!root) return out;                                             // no DDCS Bridge folder visible
        const machine = await findChild(root, String(machineName).trim(), true);
        if (!machine) return out;                                          // this machine has no folder visible
        const gw = await findChild(machine, 'gateway', true);
        if (!gw) return out;
        const meta = await findChildMeta(gw, 'heartbeat.json');
        if (!meta) return out;
        const hb = await (await call(`${API}/files/${meta.id}?alt=media`)).json();
        const ageS = (Date.now() - Date.parse(meta.modifiedTime)) / 1000;   // Drive's clock on both ends
        return { ...out, state: ageS > HEARTBEAT_STALE_S ? 'stale' : 'fresh', hb, ageS };
    } catch (e) {
        // ⚠ A FAILED LOOKUP IS NOT AN ABSENT GATEWAY. Collapsing these would let a 403 or a dropped connection
        // read as "nobody is there", which is exactly the confident-lie shape this whole reader exists to end.
        return { ...out, state: 'unreadable', reason: String((e && e.message) || e) };
    }
}
