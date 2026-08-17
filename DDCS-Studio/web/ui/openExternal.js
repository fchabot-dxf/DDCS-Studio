/**
 * ui/openExternal.js — open an external URL the RIGHT way for wherever the app is running (t2066).
 *
 * In the desktop exe the page is a web view embedded in a native window. Calling window.open on an external URL there
 * is unreliable: for a DOWNLOAD url the embedded web view can start the download AND the system browser can too — the
 * double-download users hit on the update link. The correct primitive is to let the HOST open it: the gateway calls
 * webbrowser.open server-side (POST /api/open-external), which opens the user's real browser exactly once. On the plain
 * web there is no gateway and window.open is exactly right.
 *
 * This is the ONE declared way to open an external link, so no call site has to re-derive the desktop dance. It also
 * owns the canonical isDesktopApp() check (updateCheck.js imports it from here) so "are we the exe?" has one home.
 */
const GW_PORTS = ['8765', '8766', '8767', '8768', '8769'];

/** True only in the desktop exe: pywebview, or the page served from the gateway's loopback port. */
export function isDesktopApp() {
  try {
    if (typeof window.pywebview !== 'undefined') return true;
    const loopback = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
    return loopback && GW_PORTS.includes(location.port);
  } catch (_) { return false; }
}

/**
 * Open `url` in the user's real browser, once. Desktop → the gateway opens it server-side (webbrowser.open, http(s)
 * only); web → window.open, falling back to location.href only if the popup is blocked. Returns true if a path was
 * taken. Async because the desktop path awaits the gateway; callers that must not double-fire should guard the gesture.
 */
export async function openExternal(url) {
  if (isDesktopApp()) {
    try {
      const r = await fetch('/api/open-external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-DDCS-Local': '1' },   // the gateway's CSRF guard header
        body: JSON.stringify({ url }),
      });
      if (r.ok && (await r.json()).ok) return true;   // the host opened it — do NOT also window.open (that is the double)
    } catch (_) { /* gateway unreachable (shouldn't happen in the exe) — fall through to the browser path */ }
  }
  let w = null;
  try { w = window.open(url, '_blank', 'noopener'); } catch (_) { w = null; }
  if (!w) location.href = url;   // popup blocked → same-tab navigation is the last resort
  return true;
}

// Test/seam hook, mirroring window.__ddcsUpd.
if (typeof window !== 'undefined') window.__ddcsOpenExternal = { isDesktopApp, openExternal };
