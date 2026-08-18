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

const REPO = 'fchabot-dxf/DDCS-Studio';

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
    if (r && r.ok) { btn.textContent = 'Updated — restarting…'; return; }
    // a NAMED refusal, and the release page as the way forward — never a silent failure, never an unverified install
    btn.disabled = false; btn.textContent = was;
    const { dlgNotice } = await import('./dialog.js');
    dlgNotice(`The update did not install: ${(r && r.error) || 'unknown error'}

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

  let commits = [];                                     // "what's new" = recent USER-FACING changes (feat/fix, cleaned)
  try {
    const c = await fetchJSON(`https://api.github.com/repos/${REPO}/commits?per_page=20`);   // 20 raw → enough after filtering out internal commits
    commits = userFacingNotes((c || []).map((x) => ((x.commit && x.commit.message) || '').split('\n')[0]));
  } catch (_) { /* fall back to the release body */ }

  showBanner(tag, dl, rel.body, commits);
}

// Expose helpers for tests (and so the web-exclusion can be asserted).
if (typeof window !== 'undefined') window.__ddcsUpd = { isNewer, isDesktopApp, isDevServer, bakedVersion, userFacingNotes, initUpdateCheck, checkWebVersion, initWebVersionNudge, checkStalePage, _resetNudgeThrottle: () => { _lastWebCheck = 0; } };
