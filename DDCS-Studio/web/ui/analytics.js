/**
 * ui/analytics.js — privacy-light, anonymous, cookieless usage analytics.
 *
 * Fires `visit` once on load and `feature` on a handful of key actions (wired from globalFunctions.js
 * + the tab router). Sends a fire-and-forget beacon to the analytics Worker (see /analytics), which
 * derives COUNTRY from the edge — we never send or store an IP. No personal data, no cookies.
 *
 * Opt out:  localStorage.setItem('ddcs_no_analytics', '1')   (Do-Not-Track is also honoured.)
 *
 * SETUP: after `wrangler deploy` in /analytics, put the printed Worker URL + "/e" here (or set
 *        window.DDCS_ANALYTICS_URL before this loads). Until then, tracking is a no-op.
 */
const ENDPOINT = 'https://ddcs-analytics.dansemur.workers.dev/e';   // deployed Worker (see /analytics)

function endpoint() {
  const u = (typeof window !== 'undefined' && window.DDCS_ANALYTICS_URL) || ENDPOINT;
  return u && !u.includes('REPLACE-ME') ? u : null;
}

function off() {
  try {
    // Automated browsers (Playwright/WebDriver) + any harness that sets window.__ddcsNoTrack fire NOTHING — the test
    // suites boot the app hundreds of times, and each live beacon is a Worker request (dev boots = a KV write). Zero.
    if (typeof navigator !== 'undefined' && navigator.webdriver && !(typeof window !== 'undefined' && window.__ddcsForceTrack)) return true;   // __ddcsForceTrack: the one beacon-payload test opts back in (its endpoint is a fake, captured locally)
    if (typeof window !== 'undefined' && window.__ddcsNoTrack) return true;
    if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return true;
    if (localStorage.getItem('ddcs_no_analytics') === '1') return true;
  } catch (_) { /* storage blocked — fall through */ }
  return false;
}

// The `dev` flag to SEND. A dev-tagged browser refreshes its network IP in KV on each visit/app_launch (a server-side WRITE,
// Worker index.js:62-64). Throttle that to ONCE PER DAY via a localStorage day-stamp: the day's first visit/app_launch sends
// dev=1 (refresh); later same-day ones send dev=0 → the Worker READS KV instead (cheap, 100k/day) and still resolves dev. So a
// heavy dev day writes ~1 KV op, not hundreds. Non-visit events keep dev=1 (they never trigger a KV write). Free-tier safe.
function devFlag(event) {
  if (!isDev()) return 0;
  if (event !== 'visit' && event !== 'app_launch') return 1;   // feature/etc — dev-attributed, no server-side KV write
  try {
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem('ddcs_dev_day') === today) return 0;   // already refreshed today → dev=0 (Worker reads KV)
    localStorage.setItem('ddcs_dev_day', today);
  } catch (_) { /* storage blocked → just refresh */ }
  return 1;
}
if (typeof window !== 'undefined') window.__ddcsDevFlag = devFlag;   // test hook (the throttle is off()-gated in track)

function anonId() {
  try {
    let id = localStorage.getItem('ddcs_anon');
    if (!id) {
      id = (crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2));
      localStorage.setItem('ddcs_anon', id);
    }
    return id;
  } catch (_) { return 'na'; }
}

function version() {
  const v = document.querySelector('.ver');
  return v ? v.textContent.trim().replace(/^v/i, '') : '';
}

// exe = the pywebview window (window.pywebview) OR the page served by the local gateway (127.0.0.1:8765-8769).
// A browser hitting the public site is "web". The port check works immediately (pywebview may inject late).
function isExe() {
  try {
    if (window.pywebview) return true;
    const p = +location.port;
    return /^(127\.0\.0\.1|localhost)$/.test(location.hostname) && p >= 8765 && p <= 8769;
  } catch (_) { return false; }
}

// dev = this browser was marked as the developer's own (via ?dev=1, persisted). See the bottom of the file.
function isDev() {
  try { return localStorage.getItem('ddcs_dev') === '1'; } catch (_) { return false; }
}

export function track(event, name = '') {
  const url = endpoint();
  if (!url || off()) return;
  const body = JSON.stringify({
    event, name, id: anonId(), app: isExe() ? 'exe' : 'web',
    version: version(), os: (navigator.platform || navigator.userAgent || '').slice(0, 32),
    dev: devFlag(event),   // dev=1 throttled to once/day per browser (KV-write guard); other same-day dev boots send 0 (Worker reads KV)
  });
  try {
    // text/plain → a CORS "simple request" (no preflight); fire-and-forget, survives page unload.
    const blob = new Blob([body], { type: 'text/plain' });
    if (navigator.sendBeacon && navigator.sendBeacon(url, blob)) return;
    fetch(url, { method: 'POST', body, keepalive: true, headers: { 'content-type': 'text/plain' } }).catch(() => {});
  } catch (_) { /* never let analytics break the app */ }
}

if (typeof window !== 'undefined') window.ddcsTrack = track;

/** t698 — the /rate endpoint = the analytics base + '/rate' (the Worker persists stars+comment to D1 + mirrors to AE). */
function rateEndpoint() {
  const u = (typeof window !== 'undefined' && window.DDCS_ANALYTICS_URL) || ENDPOINT;
  if (!u || u.includes('REPLACE-ME')) return null;
  return u.replace(/\/e\/?$/, '') + '/rate';
}
/** Submit a rating (stars 1–5 + optional ≤500-char comment) to the Worker. Same off()/no-track guards as track (a webdriver
 *  test opts in via __ddcsForceTrack + a mocked endpoint). Fire-and-forget with a resolved status so the toast can react. */
export function submitRating({ stars, comment } = {}) {
  const s = Math.max(1, Math.min(5, parseInt(stars, 10) || 0));
  const c = String(comment == null ? '' : comment).slice(0, 500);
  const url = rateEndpoint();
  if (!url || off()) return Promise.resolve({ ok: false, skipped: true });
  const payload = JSON.stringify({ stars: s, comment: c, id: anonId(), app: isExe() ? 'exe' : 'web', version: version(), os: (navigator.platform || navigator.userAgent || '').slice(0, 32) });
  try {
    return fetch(url, { method: 'POST', body: payload, headers: { 'content-type': 'text/plain' }, keepalive: true })
      .then((r) => ({ ok: !!(r && r.ok) })).catch(() => ({ ok: false }));
  } catch (_) { return Promise.resolve({ ok: false }); }
}
if (typeof window !== 'undefined') window.ddcsSubmitRating = submitRating;

// "?dev=1" marks THIS browser as the developer's own (persisted) AND registers your current network, so
// other devices on the same wifi count as you too; "?dev=0" undoes both. You only need it once per network.
// (A tagged browser also re-registers the network on every visit below, so it self-heals if your IP changes.)
try {
  const q = new URLSearchParams(location.search);
  if (q.get('dev') === '1') { localStorage.setItem('ddcs_dev', '1'); track('dev_register'); }
  else if (q.get('dev') === '0') { localStorage.removeItem('ddcs_dev'); track('dev_unregister'); }
} catch (_) { /* storage blocked — ignore */ }

// One visit per page load (carries dev=1 if this browser is tagged → that also refreshes the network IP).
track('visit', (typeof location !== 'undefined' && location.pathname) || '/');
