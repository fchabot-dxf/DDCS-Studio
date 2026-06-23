/**
 * DDCS Studio analytics sink — a tiny Worker. Receives anonymous usage events (POST) from the web
 * app and the exe, derives the visitor's COUNTRY from request.cf at the edge (the IP is never stored
 * or logged), and writes one row to Workers Analytics Engine (env.EVENTS). Fire-and-forget: always
 * returns 204 fast, never blocks the client. No auth, no cookies, no PII.
 *
 * Event shape (JSON body): { event, name, id, app, version, os }
 *   event   "visit" | "feature" | "app_launch"
 *   name    feature/page label, e.g. "wizard:drill", "insert", "/"
 *   id      anonymous random id (web: localStorage uuid; exe: install-id file) — NOT a person
 *   app     "web" | "exe"
 *   version Studio version (e.g. "10.23")
 *   os      coarse platform string
 */
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST,OPTIONS',
  'access-control-allow-headers': 'content-type',
};
const clip = (v, n) => String(v == null ? '' : v).slice(0, n);

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'POST') return new Response('ddcs-analytics', { status: 200, headers: CORS });

    let ev = {};
    try { ev = JSON.parse(await request.text()); } catch { /* tolerate empty/garbled body */ }

    const cf = request.cf || {};
    const ip = request.headers.get('CF-Connecting-IP') || '';
    const event = clip(ev.event, 32);

    // Control signals (NOT recorded as usage): mark/unmark THIS network's IP as the developer's own,
    // so every device on it is auto-tagged dev. Stores only YOUR own IP, in a private KV, TTL ~120 days.
    if (event === 'dev_register' && env.DEV_IPS && ip) {
      await env.DEV_IPS.put('ip:' + ip, '1', { expirationTtl: 60 * 60 * 24 * 120 });
      return new Response(null, { status: 204, headers: CORS });
    }
    if (event === 'dev_unregister' && env.DEV_IPS && ip) {
      await env.DEV_IPS.delete('ip:' + ip);
      return new Response(null, { status: 204, headers: CORS });
    }

    // dev = the client's own browser flag, OR this request comes from a registered dev network.
    let dev = ev.dev ? '1' : '0';
    if (env.DEV_IPS && ip) {
      if (dev === '1') {
        // A tagged device keeps THIS network registered & fresh — so its other devices inherit dev, and it
        // self-heals when your ISP rotates your IP (next visit re-registers the new one). Once-per-session
        // events only, to keep KV writes low.
        if (event === 'visit' || event === 'app_launch') {
          try { await env.DEV_IPS.put('ip:' + ip, '1', { expirationTtl: 60 * 60 * 24 * 120 }); } catch { /* ignore */ }
        }
      } else {
        try { if (await env.DEV_IPS.get('ip:' + ip)) dev = '1'; } catch { /* KV miss/err → treat as not-dev */ }
      }
    }

    const anon = clip(ev.id, 32);
    if (env.EVENTS) {
      env.EVENTS.writeDataPoint({
        // blobs = string dimensions (≤20). Country/city/region come from the edge, not the body.
        blobs: [
          event,                     // blob1: event type
          clip(ev.name, 96),         // blob2: feature/page name
          clip(cf.country, 4),       // blob3: country (edge-derived)
          clip(ev.app, 8),           // blob4: web | exe
          clip(ev.version, 24),      // blob5: app version
          clip(ev.os, 32),           // blob6: platform
          clip(cf.city, 64),         // blob7: city (edge-derived)
          clip(cf.region, 64),       // blob8: region (edge-derived)
          dev,                       // blob9: "1" = developer's own (browser flag OR registered network)
        ],
        doubles: [1],                // one event
        indexes: [anon || clip(cf.country, 4)],   // sampling key — spreads by visitor
      });
    }
    return new Response(null, { status: 204, headers: CORS });
  },
};
