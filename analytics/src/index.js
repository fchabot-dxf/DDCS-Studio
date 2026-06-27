/**
 * DDCS Studio analytics sink — a tiny Worker. Receives anonymous usage events (POST) from the web
 * app and the exe, derives the visitor's COUNTRY from request.cf at the edge (the IP is never stored
 * or logged), and writes one row to Workers Analytics Engine (env.EVENTS). Fire-and-forget: always
 * returns 204 fast, never blocks the client. No auth, no cookies, no PII.
 *
 * Also serves a private dashboard at /dash?key=<DASH_KEY> — GET renders the charts; POST runs a
 * dev-IP management action (tag this network / add an IP / remove one). See handleDash() below.
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
const DEV_TTL = 60 * 60 * 24 * 120;   // dev-IP tag lifetime (~120 days)

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Private dashboard (secret-link gated). Handles GET (render) AND POST (dev-IP management),
    // so the ingest path below only ever sees real event POSTs.
    if (url.pathname === '/dash') return handleDash(request, env);

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
      await env.DEV_IPS.put('ip:' + ip, '1', { expirationTtl: DEV_TTL });
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
          try { await env.DEV_IPS.put('ip:' + ip, '1', { expirationTtl: DEV_TTL }); } catch { /* ignore */ }
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

// ── Private dashboard ─────────────────────────────────────────────────────────────────────────────
// GET  /dash?key=<DASH_KEY>[&days=30][&dev=1]  → charts.
// POST /dash?key=<DASH_KEY>  (form: action=dev_tag_me|dev_add|dev_del [&ip=…])  → manage dev IPs, redirect back.
//   • key   — must equal the DASH_KEY secret (else 404 — the route stays invisible without the link).
//   • days  — lookback window, 1..365 (default 30).
//   • dev=1 — INCLUDE your own/dev traffic (default: real users only, blob9 != '1').
// Queries run server-side via the Analytics Engine SQL API using the AE_TOKEN secret (never exposed).
// Each query is independent: one failing query degrades to an error note, the rest of the page renders.

const clampInt = (v, def, lo, hi) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def; };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function aeQuery(env, sql) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/analytics_engine/sql`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.AE_TOKEN}` },
    body: sql,
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${t.slice(0, 240)}`);
  let j; try { j = JSON.parse(t); } catch { throw new Error('non-JSON response: ' + t.slice(0, 160)); }
  return Array.isArray(j.data) ? j.data : [];
}

async function handleDash(request, env) {
  const url = new URL(request.url);
  const key = url.searchParams.get('key') || '';
  // Constant-ish compare; 404 (not 401/403) so the route's existence isn't leaked without the key.
  if (!env.DASH_KEY || key.length !== env.DASH_KEY.length || key !== env.DASH_KEY) {
    return new Response('Not found', { status: 404 });
  }

  // POST = a dev-IP management action → mutate KV, then Post/Redirect/Get back to the same view.
  if (request.method === 'POST') return handleDashAction(request, env, url, key);

  if (!env.AE_TOKEN || !env.ACCOUNT_ID) {
    return new Response('Dashboard not configured — set the AE_TOKEN secret (Account Analytics → Read) and the ACCOUNT_ID var, then redeploy.', { status: 500 });
  }

  const days = clampInt(url.searchParams.get('days'), 30, 1, 365);
  const showDev = url.searchParams.get('dev') === '1';
  const devF = showDev ? '' : "AND (blob9 != '1' OR blob9 IS NULL)";
  // Date floor — excludes the 2026-06-20 build-day self-test burst (162 hits that predate dev-tagging).
  // It can't be DELETED (Analytics Engine is append-only), so we floor it out of every view. Override with ?from=YYYY-MM-DD.
  const fromReq = url.searchParams.get('from') || '2026-06-21';
  const from = /^\d{4}-\d{2}-\d{2}$/.test(fromReq) ? fromReq : '2026-06-21';
  const since = `timestamp > NOW() - INTERVAL '${days}' DAY AND timestamp >= toDateTime('${from} 00:00:00')`;
  const per = url.searchParams.get('per') === 'week' ? 'week' : 'day';        // bucket size for "by country, per period"
  const perInterval = per === 'week' ? "INTERVAL '7' DAY" : "INTERVAL '1' DAY";

  const Q = {
    total:   `SELECT SUM(_sample_interval) AS visits FROM ddcs_events WHERE blob1 = 'visit' ${devF} AND ${since}`,
    byDay:   `SELECT toStartOfInterval(timestamp, INTERVAL '1' DAY) AS day, SUM(_sample_interval) AS visits FROM ddcs_events WHERE blob1 = 'visit' ${devF} AND ${since} GROUP BY day ORDER BY day`,
    country: `SELECT blob3 AS country, SUM(_sample_interval) AS visits FROM ddcs_events WHERE blob1 = 'visit' ${devF} AND ${since} GROUP BY country ORDER BY visits DESC LIMIT 20`,
    feature: `SELECT blob2 AS feature, SUM(_sample_interval) AS uses FROM ddcs_events WHERE blob1 = 'feature' ${devF} AND ${since} GROUP BY feature ORDER BY uses DESC LIMIT 20`,
    app:     `SELECT blob4 AS app, SUM(_sample_interval) AS n FROM ddcs_events WHERE blob1 IN ('visit','app_launch') ${devF} AND ${since} GROUP BY app ORDER BY n DESC`,
    version: `SELECT blob5 AS version, blob4 AS app, SUM(_sample_interval) AS n FROM ddcs_events WHERE blob1 IN ('visit','app_launch') ${devF} AND ${since} GROUP BY version, app ORDER BY n DESC LIMIT 25`,
    byCountryPeriod: `SELECT toStartOfInterval(timestamp, ${perInterval}) AS period, blob3 AS country, SUM(_sample_interval) AS visits FROM ddcs_events WHERE blob1 = 'visit' ${devF} AND ${since} GROUP BY period, country ORDER BY period`,
  };

  const keys = Object.keys(Q);
  const settled = await Promise.allSettled(keys.map((k) => aeQuery(env, Q[k])));
  const data = {}, errors = {};
  settled.forEach((s, i) => {
    const k = keys[i];
    if (s.status === 'fulfilled') data[k] = s.value;
    else errors[k] = String((s.reason && s.reason.message) || s.reason);
  });

  // Dev-IP management state: the registered IPs (KV list) + this visitor's IP / tag status.
  let devIps = [];
  const myIp = request.headers.get('CF-Connecting-IP') || '';
  if (env.DEV_IPS) {
    try { const l = await env.DEV_IPS.list({ prefix: 'ip:' }); devIps = l.keys.map((k) => k.name.slice(3)); } catch { /* list may lag; ignore */ }
  }
  const tagged = !!myIp && devIps.includes(myIp);

  return new Response(renderDash({ data, errors, sql: Q, days, showDev, key, search: url.search, devIps, myIp, tagged, from, per }), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

async function handleDashAction(request, env, url, key) {
  const okIp = (s) => /^[0-9a-fA-F:.]{3,45}$/.test(s);   // loose IPv4/IPv6 sanity
  let form;
  try { form = new URLSearchParams(await request.text()); } catch { form = new URLSearchParams(); }
  const action = form.get('action') || '';
  const ip = (form.get('ip') || '').trim();
  const myIp = request.headers.get('CF-Connecting-IP') || '';
  if (env.DEV_IPS) {
    try {
      if (action === 'dev_tag_me' && myIp) await env.DEV_IPS.put('ip:' + myIp, '1', { expirationTtl: DEV_TTL });
      else if (action === 'dev_add' && okIp(ip)) await env.DEV_IPS.put('ip:' + ip, '1', { expirationTtl: DEV_TTL });
      else if (action === 'dev_del' && ip) await env.DEV_IPS.delete('ip:' + ip);
    } catch { /* KV error → just redirect back, no-op */ }
  }
  // Post/Redirect/Get — preserve the current view (key + days + dev) so the page doesn't reset/re-submit.
  return Response.redirect(`${url.origin}${url.pathname}${url.search}`, 303);
}

function renderDash({ data, errors, sql, days, showDev, key, search, devIps, myIp, tagged, from, per }) {
  const total = Number((data.total && data.total[0] && data.total[0].visits) || 0);
  const k = encodeURIComponent(key);
  const link = (d, dev) => `/dash?key=${k}&days=${d}&dev=${dev ? 1 : 0}&from=${esc(from)}&per=${per}`;
  const perLink = (p) => `/dash?key=${k}&days=${days}&dev=${showDev ? 1 : 0}&from=${esc(from)}&per=${p}`;
  const rangeBtn = (d) => `<a class="${d === days ? 'on' : ''}" href="${link(d, showDev)}">${d}d</a>`;
  const errCount = Object.keys(errors).length;
  const payload = JSON.stringify({ data, errors }).replace(/</g, '\\u003c');
  const post = `/dash${esc(search || ('?key=' + k))}`;   // form action: preserves the current view across the redirect

  const devRows = (devIps && devIps.length)
    ? `<table><tr><th>dev IP (hidden from default view)</th><th></th></tr>${devIps.map((ip) =>
        `<tr><td>${esc(ip)}${ip === myIp ? ' <span class="sub">(this device)</span>' : ''}</td>
         <td><form method="post" action="${post}" style="margin:0"><input type="hidden" name="action" value="dev_del"><input type="hidden" name="ip" value="${esc(ip)}"><button class="btn del">✕</button></form></td></tr>`).join('')}</table>`
    : '<span class="sub">no dev IPs tagged yet</span>';

  const devCard = `<div class="card full"><h2>Dev traffic — excluded by default</h2>
    <p class="sub">This device's IP: <b>${esc(myIp || '?')}</b> ${tagged ? '· <span style="color:#2ea043">tagged ✓</span>' : '· not tagged'}</p>
    <div class="devbar">
      <form method="post" action="${post}" style="margin:0"><input type="hidden" name="action" value="dev_tag_me"><button class="btn">Tag this network</button></form>
      <form method="post" action="${post}" style="margin:0;display:flex;gap:6px">
        <input type="hidden" name="action" value="dev_add">
        <input name="ip" class="ipin" placeholder="add an IP, e.g. 96.22.121.45" pattern="[0-9a-fA-F:.]{3,45}" required>
        <button class="btn">Add IP</button>
      </form>
    </div>
    ${devRows}
    <p class="sub" style="margin-top:8px">A tagged IP (and every device on that network) counts as your own and is hidden from the default view. TTL ~120 days; re-tag to refresh. Use <b>show dev</b> in the header to view it.</p>
  </div>`;

  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>DDCS analytics</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 14px/1.4 system-ui, sans-serif; background: #0e1116; color: #e6edf3; }
  header { padding: 16px 18px; border-bottom: 1px solid #222a35; display: flex; flex-wrap: wrap; gap: 12px; align-items: baseline; }
  h1 { font-size: 16px; margin: 0; font-weight: 600; }
  .controls { margin-left: auto; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .controls a { color: #9db4d0; text-decoration: none; padding: 4px 9px; border: 1px solid #2a3340; border-radius: 6px; font-size: 12px; }
  .controls a.on { background: #1f6feb; border-color: #1f6feb; color: #fff; }
  .sub { color: #8b98a8; font-size: 12px; }
  main { padding: 18px; display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); max-width: 1100px; margin: 0 auto; }
  .card { background: #161b22; border: 1px solid #222a35; border-radius: 10px; padding: 14px 16px; }
  .card h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: #8b98a8; margin: 0 0 10px; font-weight: 600; }
  .big { font-size: 40px; font-weight: 700; }
  .full { grid-column: 1 / -1; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  td, th { text-align: left; padding: 4px 6px; border-bottom: 1px solid #1d242e; }
  th { color: #8b98a8; font-weight: 500; }
  td:last-child, th:last-child { text-align: right; }
  .devbar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin: 6px 0 12px; }
  .btn { background: #1f6feb; border: 1px solid #1f6feb; color: #fff; border-radius: 6px; padding: 5px 11px; font-size: 12px; cursor: pointer; }
  .btn.del { background: transparent; border-color: #5c2027; color: #ffb4ba; padding: 3px 8px; }
  .ipin { background: #0b0e13; border: 1px solid #2a3340; color: #e6edf3; border-radius: 6px; padding: 5px 8px; font-size: 12px; min-width: 200px; }
  .err { background: #2d1418; border: 1px solid #5c2027; color: #ffb4ba; border-radius: 8px; padding: 10px 12px; font-size: 12px; }
  details { font-size: 12px; color: #8b98a8; }
  pre { white-space: pre-wrap; word-break: break-word; background: #0b0e13; padding: 8px; border-radius: 6px; overflow: auto; }
  canvas { max-height: 260px; }
</style></head><body>
<header>
  <h1>DDCS Studio · usage</h1>
  <span class="sub">last ${days} days · since ${esc(from)} · ${showDev ? '<b style="color:#e3a008">incl. your dev traffic</b>' : 'real users only'}</span>
  <div class="controls">
    ${rangeBtn(7)}${rangeBtn(30)}${rangeBtn(90)}
    <a href="${link(days, !showDev)}">${showDev ? 'hide dev' : 'show dev'}</a>
  </div>
</header>
<main>
  <div class="card"><h2>Visits (${days}d)</h2><div class="big">${total.toLocaleString()}</div><div class="sub">event = visit · ${showDev ? 'all traffic' : 'excludes dev'}</div></div>
  <div class="card full"><h2>Visits per day</h2><canvas id="c_day"></canvas></div>
  <div class="card full"><h2>Visits by country · per ${per}</h2>
    <div class="controls" style="margin:0 0 10px">
      <a class="${per === 'day' ? 'on' : ''}" href="${perLink('day')}">day</a><a class="${per === 'week' ? 'on' : ''}" href="${perLink('week')}">week</a>
    </div>
    <canvas id="c_cp"></canvas></div>
  <div class="card"><h2>Top countries</h2><canvas id="c_country"></canvas></div>
  <div class="card"><h2>Web vs exe</h2><canvas id="c_app"></canvas></div>
  <div class="card full"><h2>Top features used</h2><canvas id="c_feature"></canvas></div>
  <div class="card full"><h2>Versions</h2><div id="t_version"></div></div>
  ${devCard}
  ${errCount ? `<div class="card full err"><b>${errCount} quer${errCount === 1 ? 'y' : 'ies'} failed</b> — the rest of the page is real. Likely an Analytics Engine SQL-dialect difference; open below for the exact error + the SQL to tweak.
    <details style="margin-top:8px"><summary>show errors</summary>
    ${Object.keys(errors).map((kk) => `<p><b>${esc(kk)}</b>: ${esc(errors[kk])}<pre>${esc(sql[kk])}</pre></p>`).join('')}
    </details></div>` : ''}
</main>
<script>
const P = ${payload};
const D = P.data || {};
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const GRID = '#222a35', TXT = '#8b98a8';
const baseOpts = { responsive: true, plugins: { legend: { display: false } }, scales: { x: { grid: { color: GRID }, ticks: { color: TXT } }, y: { grid: { color: GRID }, ticks: { color: TXT }, beginAtZero: true } } };

function bar(id, rows, labelKey, valKey, color) {
  const el = document.getElementById(id); if (!el || !rows) return;
  new Chart(el, { type: 'bar', data: { labels: rows.map(r => String(r[labelKey] || '—')), datasets: [{ data: rows.map(r => num(r[valKey])), backgroundColor: color }] }, options: baseOpts });
}

(function () {
  const el = document.getElementById('c_day'); const rows = D.byDay; if (!el || !rows) return;
  const fmt = (d) => { try { return new Date(d).toISOString().slice(5, 10); } catch { return String(d); } };
  new Chart(el, { type: 'line', data: { labels: rows.map(r => fmt(r.day)), datasets: [{ data: rows.map(r => num(r.visits)), borderColor: '#1f6feb', backgroundColor: 'rgba(31,111,235,.2)', fill: true, tension: .25, pointRadius: 2 }] }, options: baseOpts });
})();

bar('c_country', D.country, 'country', 'visits', '#2ea043');
bar('c_feature', D.feature, 'feature', 'uses', '#a371f7');

(function () {
  const el = document.getElementById('c_app'); const rows = D.app; if (!el || !rows) return;
  new Chart(el, { type: 'doughnut', data: { labels: rows.map(r => String(r.app || '—')), datasets: [{ data: rows.map(r => num(r.n)), backgroundColor: ['#1f6feb', '#e3a008', '#2ea043', '#a371f7'] }] }, options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#e6edf3' } } } } });
})();

// visits by country, per period — stacked bar (one stack per country)
(function () {
  const el = document.getElementById('c_cp'); const rows = D.byCountryPeriod; if (!el || !rows || !rows.length) return;
  const periods = [...new Set(rows.map(r => r.period))].sort();
  const countries = [...new Set(rows.map(r => String(r.country || '—')))];
  const pos = {}; periods.forEach((p, i) => { pos[p] = i; });
  const PAL = ['#1f6feb', '#2ea043', '#a371f7', '#e3a008', '#db61a2', '#3fb950', '#f0883e', '#58a6ff', '#bc8cff', '#56d364', '#e3b341', '#ff7b72', '#79c0ff', '#d2a8ff'];
  const fmtP = (p) => { try { return new Date(p).toISOString().slice(5, 10); } catch { return String(p); } };
  const datasets = countries.map((c, ci) => {
    const arr = new Array(periods.length).fill(0);
    rows.forEach(r => { if (String(r.country || '—') === c) arr[pos[r.period]] = num(r.visits); });
    return { label: c, data: arr, backgroundColor: PAL[ci % PAL.length] };
  });
  new Chart(el, { type: 'bar', data: { labels: periods.map(fmtP), datasets }, options: {
    responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#e6edf3', boxWidth: 10, font: { size: 10 } } } },
    scales: { x: { stacked: true, grid: { color: GRID }, ticks: { color: TXT } }, y: { stacked: true, grid: { color: GRID }, ticks: { color: TXT }, beginAtZero: true } } } });
})();

(function () {
  const rows = D.version; const host = document.getElementById('t_version'); if (!host) return;
  if (!rows || !rows.length) { host.innerHTML = '<span class="sub">no data</span>'; return; }
  host.innerHTML = '<table><tr><th>version</th><th>app</th><th>count</th></tr>' +
    rows.map(r => '<tr><td>' + (r.version || '—') + '</td><td>' + (r.app || '—') + '</td><td>' + num(r.n).toLocaleString() + '</td></tr>').join('') + '</table>';
})();
</script>
</body></html>`;
}
