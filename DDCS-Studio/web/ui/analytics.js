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
    if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return true;
    if (localStorage.getItem('ddcs_no_analytics') === '1') return true;
  } catch (_) { /* storage blocked — fall through */ }
  return false;
}

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

// Visiting any page with "?dev=1" marks THIS browser as the developer's own (persisted across visits);
// "?dev=0" clears it. Your events are still recorded, but tagged dev=1 so you can filter your own
// testing out of the numbers (do this once per browser you test from — it's per-browser, not per-network).
try {
  const q = new URLSearchParams(location.search);
  if (q.get('dev') === '1') localStorage.setItem('ddcs_dev', '1');
  if (q.get('dev') === '0') localStorage.removeItem('ddcs_dev');
} catch (_) { /* storage blocked — ignore */ }

function isDev() {
  try { return localStorage.getItem('ddcs_dev') === '1'; } catch (_) { return false; }
}

export function track(event, name = '') {
  const url = endpoint();
  if (!url || off()) return;
  const body = JSON.stringify({
    event, name, id: anonId(), app: isExe() ? 'exe' : 'web',
    version: version(), os: (navigator.platform || navigator.userAgent || '').slice(0, 32),
    dev: isDev() ? 1 : 0,
  });
  try {
    // text/plain → a CORS "simple request" (no preflight); fire-and-forget, survives page unload.
    const blob = new Blob([body], { type: 'text/plain' });
    if (navigator.sendBeacon && navigator.sendBeacon(url, blob)) return;
    fetch(url, { method: 'POST', body, keepalive: true, headers: { 'content-type': 'text/plain' } }).catch(() => {});
  } catch (_) { /* never let analytics break the app */ }
}

if (typeof window !== 'undefined') window.ddcsTrack = track;

// One visit per page load.
track('visit', (typeof location !== 'undefined' && location.pathname) || '/');
