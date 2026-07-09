/**
 * ui/updateCheck.js — DESKTOP-ONLY "update available" notice.
 *
 * The web app auto-deploys on Cloudflare (a reload always gets the latest), so this runs ONLY in the exe —
 * detected by the gateway loopback port (8765-8769) or pywebview. It reads the baked version from the header
 * .ver chip, asks GitHub for the latest release, and if that's newer shows a dismissible bottom banner with a
 * Download link + the recent commit messages ("what's new"). Public GitHub API, no token, one check per launch.
 */
import { toast } from './gateway/util.js';   // the shared transient toast (web version-nudge reuses it)

const REPO = 'fchabot-dxf/DDCS-Studio';
const GW_PORTS = ['8765', '8766', '8767', '8768', '8769'];

/** True only in the desktop exe: pywebview, or the page served from the gateway's loopback port. */
function isDesktopApp() {
  try {
    if (typeof window.pywebview !== 'undefined') return true;
    const loopback = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
    return loopback && GW_PORTS.includes(location.port);
  } catch (_) { return false; }
}

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

function showBanner(tag, dl, body, commits) {
  if (document.querySelector('.ddcs-update-bar')) return;
  const bar = document.createElement('div');
  bar.className = 'ddcs-update-bar';
  bar.innerHTML = `<span class="upd-msg">⬆ Update available — <b>${escapeHtml(tag)}</b></span>`
    + `<a class="upd-btn" href="${encodeURI(dl)}" target="_blank" rel="noopener">Download</a>`
    + `<button class="upd-btn upd-what" type="button">What's new ▾</button>`
    + `<button class="upd-x" type="button" aria-label="Dismiss">✕</button>`
    + `<div class="upd-notes" hidden></div>`;
  const notes = bar.querySelector('.upd-notes');
  const list = (commits && commits.length) ? commits : (body || '').split('\n').filter(Boolean);
  notes.innerHTML = list.slice(0, 10).map((l) => `<div>• ${escapeHtml(l)}</div>`).join('') || '<div>See the release notes.</div>';
  // pywebview may not honour target=_blank → also try window.open (routes to the system browser on most setups)
  bar.querySelector('.upd-btn[href]').addEventListener('click', (e) => { try { window.open(dl, '_blank'); } catch (_) { /* anchor href is the fallback */ } });
  bar.querySelector('.upd-what').addEventListener('click', () => { notes.hidden = !notes.hidden; });
  bar.querySelector('.upd-x').addEventListener('click', () => { try { localStorage.setItem('ddcs_update_dismissed', tag); } catch (_) { /* */ } bar.remove(); });
  document.body.appendChild(bar);
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
  const exe = (rel.assets || []).find((a) => /\.exe$/i.test(a.name));
  if (exe) dl = exe.browser_download_url;

  let commits = [];                                     // "what's new" = recent commit subjects ("last commit comments")
  try {
    const c = await fetchJSON(`https://api.github.com/repos/${REPO}/commits?per_page=8`);
    commits = (c || []).map((x) => ((x.commit && x.commit.message) || '').split('\n')[0]).filter(Boolean);
  } catch (_) { /* fall back to the release body */ }

  showBanner(tag, dl, rel.body, commits);
}

// Expose helpers for tests (and so the web-exclusion can be asserted).
if (typeof window !== 'undefined') window.__ddcsUpd = { isNewer, isDesktopApp, isDevServer, bakedVersion, initUpdateCheck, checkWebVersion, initWebVersionNudge, checkStalePage, _resetNudgeThrottle: () => { _lastWebCheck = 0; } };
