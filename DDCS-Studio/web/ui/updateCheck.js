/**
 * ui/updateCheck.js — DESKTOP-ONLY "update available" notice.
 *
 * The web app auto-deploys on Cloudflare (a reload always gets the latest), so this runs ONLY in the exe —
 * detected by the gateway loopback port (8765-8769) or pywebview. It reads the baked version from the header
 * .ver chip, asks GitHub for the latest release, and if that's newer shows a dismissible bottom banner with a
 * Download link + the recent commit messages ("what's new"). Public GitHub API, no token, one check per launch.
 */
import { toast } from './gateway/util.js';   // the shared transient toast (web version-nudge reuses it)
import { isDesktopApp, openExternal } from './openExternal.js';   // canonical "are we the exe?" + the one external-open primitive
import { RELEASE_NOTES } from '../data/releaseNotes.js';   // t2075 — ONE declared source, two views (see that file's own header)

const REPO = 'fchabot-dxf/DDCS-Studio';
const SEEN_VERSION_KEY = 'ddcs_seen_version';   // t2075 — the welcome sequence's own stored-vs-current-at-boot watermark

/** Baked app version from the header chip ("V10.20" → "10.20"); null if absent. */
function bakedVersion() {
  const el = document.querySelector('.ver');
  const m = el && el.textContent.match(/(\d+(?:\.\d+)+)/);
  return m ? m[1] : null;
}

const parseV = (s) => String(s || '').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
/** True if `remote` ("v10.21") is a newer version than `local` ("10.20"). */
function isNewer(remote, local) {
  const a = parseV(remote), b = parseV(local);
  for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] || 0) - (b[i] || 0); if (d) return d > 0; }
  return false;
}
/** "v10.21" → "10.21" — RELEASE_NOTES is keyed without the leading "v" (matches bakedVersion()'s own output). */
function stripV(tag) { return String(tag || '').replace(/^v/i, ''); }

async function fetchJSON(url) {
  const r = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
  if (!r.ok) throw new Error('gh ' + r.status);
  return r.json();
}

const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// t2068 — the "What's new" is for USERS, not developers. Raw commit subjects ("fix(gateway): var-read used the wrong
// slot … (t2067)") are noise to an operator. Turn them into plain lines: keep only the user-facing types (feat/fix/
// perf), strip the conventional-commit type(scope) prefix, drop the "— developer detail" tail and any task-id / issue
// refs, and sentence-case the gist. Internal commits (docs/test/chore/refactor/build/release) never reach the user.
const NOTES_MAX = 3;   // succinct — a few highlights, not a changelog
export function userFacingNotes(subjects) {
  const out = [], seen = new Set();
  for (const s of (subjects || [])) {
    const m = /^\s*(\w+)(\([^)]*\))?(!)?:\s*(.+)$/.exec(s);
    if (m && !['feat', 'fix', 'perf'].includes(m[1].toLowerCase())) continue;   // internal type → not shown to users
    let text = (m ? m[4] : s)
      .split(/\s+(?:--|—|->|→)\s+/)[0]           // keep only the lead; drop any "— detail" / "-> x" tail
      .replace(/\s*\([^)]*\)/g, '')               // drop parenthetical clauses (task ids, asides)
      .replace(/\s*\[[^\]]*\]/g, '')              // and bracketed ones
      .replace(/\s*\bt\d+\b/gi, '').replace(/\s*#\d+/g, '')   // bare task / issue refs
      .split(/;\s+/)[0]                            // one clause, not a semicolon-joined pair
      .replace(/\s+/g, ' ').replace(/[.\s]+$/, '').trim();
    if (!text) continue;
    text = text.charAt(0).toUpperCase() + text.slice(1);   // sentence-case
    const key = text.toLowerCase();
    if (seen.has(key)) continue;                  // no near-duplicates
    seen.add(key); out.push(text);
    if (out.length >= NOTES_MAX) break;           // don't mention everything
  }
  return out;
}

/**
 * t1261 — ONE-CLICK UPDATE (user-ruled). The exe can replace itself: the gateway downloads the new build, verifies it
 * against the release's published checksum, swaps it in and relaunches. This function only ASKS — it deliberately
 * sends no URL, because the page must not get to say what the updater installs; the Python side resolves the release
 * from the repo it was built from.
 *
 * It is added only when the gateway says the running app can actually do it (it is the exe, and its folder is
 * writable). Everywhere else the Download link is still the whole story, so the web app never grows a button that
 * cannot work.
 */
async function addSelfUpdate(bar, tag) {
  let st = null;
  try { st = await (await fetch('/api/update/status')).json(); } catch (_) { return; }
  if (!st || !st.supported || !st.writable || !st.has_asset || !st.has_checksum) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'upd-btn upd-self';
  btn.textContent = `Update to ${tag} and restart`;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const was = btn.textContent;
    btn.textContent = 'Downloading and verifying…';
    let r = null;
    try { r = await (await fetch('/api/update/apply', { method: 'POST', headers: { 'X-DDCS-Local': '1' } })).json(); } catch (e) { r = { ok: false, error: String(e) }; }   // X-DDCS-Local: gateway CSRF guard (same-origin, direct fetch bypasses client.postJSON)
    // t2075 — ok:true used to be treated as the whole story; the standing bug was exactly that: Popen() never
    // raises even when the child dies instantly, so ok:true/relaunched:true was being reported with nothing
    // actually alive, and this button sat on "Updated — restarting…" forever. The server now only sets
    // relaunched:true once it has OBSERVED the new process survive its own proven crash window — require BOTH.
    if (r && r.ok && r.relaunched) { btn.textContent = 'Updated — restarting…'; watchRestart(btn); return; }
    // Either the install itself failed, OR it installed but could not confirm a live restart — a NAMED reason
    // either way, never a silent/forever "restarting".
    btn.disabled = false; btn.textContent = was;
    const { dlgNotice } = await import('./dialog.js');
    const prefix = (r && r.ok) ? 'Updated, but the app did not restart automatically' : 'The update did not install';
    dlgNotice(`${prefix}: ${(r && r.error) || 'unknown error'}

You can download it yourself from the release page.`);
  });
  bar.insertBefore(btn, bar.querySelector('.upd-dl'));

  // t2066 — PREFER THE IN-PLACE PATH, DEMOTE THE DATED DOWNLOAD. The in-place update downloads once and keeps THIS
  // exe's own name and location (selfupdate.swap_in moves the new build onto the running file's exact path). The
  // plain Download instead hands you a version-named `DDCS-Studio-vX.Y.exe` in your Downloads folder — a dated name
  // that can't replace the running app without a manual rename+move, which is exactly the footgun the user hit. So
  // once we KNOW the in-place button is live, relabel Download as an explicit manual fallback rather than an equal peer.
  const dl = bar.querySelector('.upd-dl');
  if (dl) {
    dl.textContent = 'Download manually';
    dl.classList.add('upd-dl-fallback');
    dl.title = 'Saves a version-named copy to your Downloads folder. Use “Update … and restart” above to replace this app in place, keeping its name.';
  }
}

// t2075 — the terminal "restarting…" state's own timeout + failure branch. The server-side confirmation above
// is the real fix (an unconfirmed relaunch is never reported as success in the first place); this is a client
// safety net for the case that DOES still leave this exact window open and waiting — a LAN/regular-browser tab
// pointed at the gateway, which (unlike the pywebview window) does not close itself when the old process steps
// aside. Polls the same /api/descriptor the zero-config gateway probe already uses.
const RESTART_TIMEOUT_MS = 20000, RESTART_POLL_MS = 900;
function watchRestart(btn) {
  const start = Date.now();
  const tick = async () => {
    if (!document.body.contains(btn)) return;   // the banner/window is gone — nothing left to update
    if (Date.now() - start > RESTART_TIMEOUT_MS) {
      btn.textContent = 'Restart did not complete — please reopen the app';
      return;
    }
    try {
      const r = await fetch('/api/descriptor', { headers: { 'X-DDCS-Local': '1' } });
      if (r.ok) { btn.textContent = 'Updated — restarted'; return; }
    } catch (_) { /* still down between the old process stepping aside and the new one binding — keep polling */ }
    setTimeout(tick, RESTART_POLL_MS);
  };
  setTimeout(tick, RESTART_POLL_MS);   // give the old process its own brief step-aside window first (server.py's own grace delay)
}

function showBanner(tag, dl, body, commits) {
  if (document.querySelector('.ddcs-update-bar')) return;
  const bar = document.createElement('div');
  bar.className = 'ddcs-update-bar';
  bar.innerHTML = `<span class="upd-msg">⬆ Update available — <b>${escapeHtml(tag)}</b></span>`
    + `<button class="upd-btn upd-dl" type="button">Download</button>`
    + `<button class="upd-btn upd-what" type="button">What's new ▾</button>`
    + `<button class="upd-x" type="button" aria-label="Dismiss">✕</button>`
    + `<div class="upd-notes" hidden></div>`;
  const notes = bar.querySelector('.upd-notes');
  const list = (commits && commits.length) ? commits : (body || '').split('\n').filter(Boolean);
  notes.innerHTML = list.slice(0, 10).map((l) => `<div>• ${escapeHtml(l)}</div>`).join('') || '<div>See the release notes.</div>';
  // t2066 — THE download opens through openExternal(): in the exe the gateway opens the user's real browser server-side
  // (webbrowser.open), which fires exactly once. The old window.open path double-fired inside the embedded webview (the
  // webview downloaded the .exe AND the system browser did). A re-entrancy latch still guards a double-CLICK, since two
  // gestures are two opens. (t1185 was the earlier, partial fix — the anchor+window.open double; this removes the root.)
  let _dlBusy = false;
  bar.querySelector('.upd-dl').addEventListener('click', (e) => {
    e.preventDefault();
    if (_dlBusy) return;
    _dlBusy = true; setTimeout(() => { _dlBusy = false; }, 1500);
    openExternal(dl);
  });
  bar.querySelector('.upd-what').addEventListener('click', () => { notes.hidden = !notes.hidden; });
  bar.querySelector('.upd-x').addEventListener('click', () => { try { localStorage.setItem('ddcs_update_dismissed', tag); } catch (_) { /* */ } bar.remove(); });
  document.body.appendChild(bar);
  if (isDesktopApp()) addSelfUpdate(bar, tag);   // exe only, and only if the gateway says the swap can succeed
}

// ── WEB version-nudge ────────────────────────────────────────────────────────────────────────────────────
// The hosted web build can be a stale CACHED bundle (a Zürich user sat on a 3-day-old one — analytics 07-04): the
// exe has the GitHub update banner above, the web had NOTHING. Poll the DECLARED version.json (written at bump time)
// and toast a reload-nudge when a newer version is live. Throttled ~1/hour; runs on load + when the tab re-focuses.
// On the exe the relative fetch hits the bundled copy (== baked, or 404 on an old bundle) → never toasts (harmless).
const WEB_NUDGE_THROTTLE_MS = 60 * 60 * 1000;   // ~1 check/hour max
let _lastWebCheck = 0;

async function checkWebVersion() {
  const now = Date.now();
  if (now - _lastWebCheck < WEB_NUDGE_THROTTLE_MS) return;   // throttle
  _lastWebCheck = now;
  const local = bakedVersion();
  if (!local) return;
  let live = null;
  try { const r = await fetch('version.json', { cache: 'no-store' }); if (!r.ok) return; live = (await r.json()).v; } catch (_) { return; }   // 404 / offline → quiet
  if (live && isNewer(live, local)) toast(`V${live} is live — reload to update.`);
}

/** Wire the web version-nudge: check on load + when the tab becomes visible again (throttled). */
export function initWebVersionNudge() {
  checkWebVersion();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkWebVersion(); });
}

// ── DEV stale-page banner (t578) ─────────────────────────────────────────────────────────────────────────
// A dev pitfall: the browser serves a CACHED page/modules while the bumped build moved on — you debug a ghost (more than
// one homing "bug" this session was a stale page). On boot (localhost dev only) re-fetch the build stamp (version.json,
// cache no-store) and compare to the LOADED page's baked stamp (the .ver chip). Served stamp NEWER → the loaded page is
// stale → a persistent RED 'stale page — reload' banner. Dev-only: the hosted web auto-deploys (a reload always fixes it →
// the toast above suffices) and the exe's relative version.json == baked (never stale).
function isDevServer() {
  try {
    const loopback = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    return loopback && !isDesktopApp();   // dev = the local static web server (http-server), NOT the exe's gateway loopback ports
  } catch (_) { return false; }
}

function showStaleBanner(live, loaded) {
  if (document.querySelector('.ddcs-stale-bar')) return;
  const bar = document.createElement('div');
  bar.className = 'ddcs-stale-bar';
  bar.innerHTML = `<span class="stale-msg">⚠ stale page — loaded <b>V${escapeHtml(loaded)}</b>, server has <b>V${escapeHtml(live)}</b></span>`
    + `<button class="stale-reload" type="button">Reload</button>`;
  bar.querySelector('.stale-reload').addEventListener('click', () => { try { location.reload(); } catch (_) { /* */ } });
  document.body.appendChild(bar);
}

/** Dev-only: re-fetch the build stamp (no-store) and, if it's newer than the loaded page's baked chip, show the red stale
 *  banner. Returns true iff the banner was shown (testable by forcing a stamp mismatch). No-op off the dev server. */
export async function checkStalePage() {
  if (!isDevServer()) return false;
  const loaded = bakedVersion();
  if (!loaded) return false;
  let live = null;
  try { const r = await fetch('version.json', { cache: 'no-store' }); if (!r.ok) return false; live = (await r.json()).v; } catch (_) { return false; }   // 404 / offline → quiet
  if (live && isNewer(live, loaded)) { showStaleBanner(live, loaded); return true; }
  return false;
}

export async function initUpdateCheck() {
  initWebVersionNudge();                                 // web build: the version.json reload-nudge (harmless on the exe)
  checkStalePage();                                      // t578 — dev-only: a persistent red banner when the loaded page is stale (no-op off localhost)
  if (!isDesktopApp()) return;                          // the GitHub-release banner below is exe only
  checkWelcomeNotice();                                  // independent trigger (already updated, not update-pending) — see its own header
  const local = bakedVersion();
  if (!local) return;
  let rel;
  try { rel = await fetchJSON(`https://api.github.com/repos/${REPO}/releases/latest`); } catch (_) { return; }   // offline / rate-limited → quiet
  const tag = rel && rel.tag_name;
  if (!tag || !isNewer(tag, local)) return;
  try { if (localStorage.getItem('ddcs_update_dismissed') === tag) return; } catch (_) { /* */ }   // already dismissed this version

  let dl = rel.html_url;                                // prefer the .exe asset, else the release page
  // t1263 — assets are VERSION-NAMED (DDCS-Studio-v2026.07.27.1.exe), so match the family rather than a fixed name —
  // and rather than "any .exe", which would happily hand someone a different tool that happened to ride along.
  const exe = (rel.assets || []).find((a) => /^ddcs-studio.*\.exe$/i.test(a.name || ''));
  if (exe) dl = exe.browser_download_url;

  // t2075 — the banner's "what's new" PREFERS the composed short notes for this release when the human wrote
  // them (RELEASE_NOTES, keyed without the tag's leading "v"); a release that forgot to compose them falls
  // back to the derived commit titles exactly as before. One declared source, this is the SHORT view of it.
  let commits = [];
  const composed = RELEASE_NOTES[stripV(tag)];
  if (composed && composed.length) {
    commits = composed.map((n) => n.short).filter(Boolean).slice(0, NOTES_MAX);
  } else {
    try {
      const c = await fetchJSON(`https://api.github.com/repos/${REPO}/commits?per_page=20`);   // 20 raw → enough after filtering out internal commits
      commits = userFacingNotes((c || []).map((x) => ((x.commit && x.commit.message) || '').split('\n')[0]));
    } catch (_) { /* fall back to the release body */ }
  }

  showBanner(tag, dl, rel.body, commits);
}

// ── WELCOME MODAL (t2075, human-ruled — three rounds of amendment, this is the FINAL shape) ─────────────────
// Fires the OPPOSITE moment from the banner above: not "an update is available" but "you're already running
// a version newer than the one you last saw" — keyed on STORED-VS-CURRENT AT BOOT rather than a flag from the
// updater, deliberately, because a flag would only ever fire on the in-place path (the one that used to fail)
// while stored-vs-current also fires after a manual download or a hand relaunch — the fallback a user takes
// when in-place breaks.
//
// THE MODAL ALWAYS APPEARS ON A REAL VERSION CHANGE, composed notes or not (human's own correction, reasoning
// kept because it governs the code): its core job is answering "did my update actually work" — the exact
// question the update hang left unanswered — so the version confirmation is the PRIMARY payload and composed
// notes are the bonus. A version with no composed RELEASE_NOTES entry still shows the bare headline, ONE
// panel, nothing else — never the banner's derived-commit-title fallback (that fallback stays banner-only:
// the banner is pre-update and re-openable, so filler there is cheap; this modal is shown exactly once and
// can never be recalled, so it stays silent rather than spend that one shot on filler titles with no "how").
// FIRST RUN (no stored version at all — fresh install / cleared profile) stays SILENT: this is a post-update
// notice, not onboarding, and firing it on every fresh install would be an affordance nobody asked for.
async function checkWelcomeNotice() {
  const current = bakedVersion();
  if (!current) return;
  let seen = null;
  try { seen = localStorage.getItem(SEEN_VERSION_KEY); } catch (_) { /* */ }
  try { localStorage.setItem(SEEN_VERSION_KEY, current); } catch (_) { /* */ }
  if (!seen || !isNewer(current, seen)) return;   // first run ever (silent by design), or no real change
  const composed = RELEASE_NOTES[current];
  const panels = (composed && composed.length) ? composed.map((n) => n.full).filter(Boolean) : [];
  showWelcomeSequence(current, panels);
}

// Headline wording is EXACT, human-specified: "Updated to v<version>" — past tense, lowercase v, the version
// spelled out. ("Welcome to vX" was considered and rejected: welcome belongs to a first run, and this user was
// already here — greeting them reads as the app having forgotten them.)
function showWelcomeSequence(version, panels) {
  if (document.querySelector('.ddcs-welcome-modal')) return;
  let i = 0;
  const modal = document.createElement('div');
  modal.className = 'ddcs-welcome-modal';
  const close = () => modal.remove();
  const render = () => {
    const last = i >= panels.length - 1;   // >= (not ===) so an EMPTY panels array (no composed notes) is "last" too
    const multi = panels.length > 1;
    modal.innerHTML =
      `<div class="wcm-card" role="dialog" aria-label="Updated to v${escapeHtml(version)}">`
      + `<div class="wcm-head"><span>Updated to v${escapeHtml(version)}</span>`
      + (multi ? `<button type="button" class="wcm-skip">Skip all</button>` : '')
      + `</div>`
      + (panels.length ? `<div class="wcm-body">${escapeHtml(panels[i])}</div>` : '')
      + `<div class="wcm-foot">`
      + (multi ? `<span class="wcm-dots" aria-hidden="true">${panels.map((_, k) => (k === i ? '●' : '○')).join('')}</span>` : `<span></span>`)
      + `<span class="wcm-nav">`
      + (i > 0 ? `<button type="button" class="wcm-back">Back</button>` : '')
      + `<button type="button" class="wcm-next">${last ? 'Done' : 'Next'}</button>`
      + `</span></div></div>`;
    const skip = modal.querySelector('.wcm-skip');
    if (skip) skip.addEventListener('click', close);   // ONE click skips the WHOLE sequence
    const back = modal.querySelector('.wcm-back');
    if (back) back.addEventListener('click', () => { i--; render(); });
    modal.querySelector('.wcm-next').addEventListener('click', () => { if (last) close(); else { i++; render(); } });
  };
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });   // backdrop click also skips
  render();
  document.body.appendChild(modal);
}

// Expose helpers for tests (and so the web-exclusion can be asserted).
if (typeof window !== 'undefined') window.__ddcsUpd = { isNewer, isDesktopApp, isDevServer, bakedVersion, userFacingNotes, initUpdateCheck, checkWebVersion, initWebVersionNudge, checkStalePage, checkWelcomeNotice, RELEASE_NOTES, _resetNudgeThrottle: () => { _lastWebCheck = 0; }, _resetSeenVersion: () => { try { localStorage.removeItem(SEEN_VERSION_KEY); } catch (_) { /* */ } } };
