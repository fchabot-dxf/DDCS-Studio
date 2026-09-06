// DDCS suite progress — event-driven edition. One Durable Object holds the latest progress text
// and every open phone as a hibernatable WebSocket; a push broadcasts to all of them instantly.
// No KV, no cache windows, no polling anywhere in the chain (the page keeps a slow /raw poll only
// as a fallback while its socket is down). See ../wrangler.toml.

const PAGE = `<!doctype html>
<html><head>
<meta charset="utf-8">
<title>Suite Progress</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root{
    --bg:#f4f4f2; --card:#ffffff; --ink:#1c1e21; --muted:#6b7280;
    --bar-bg:#e5e7eb; --bar-fill:#2563eb; --ok:#16a34a; --bad:#dc2626;
    --warn:#d97706; --skip:#9ca3af; --edge:#e2e2df;
  }
  @media (prefers-color-scheme: dark){ :root{
    --bg:#101214; --card:#1a1d21; --ink:#e8eaed; --muted:#8b929c;
    --bar-bg:#2a2e34; --bar-fill:#4c8dff; --ok:#4ade80; --bad:#f87171;
    --warn:#fbbf24; --skip:#6b7280; --edge:#26292e;
  }}
  *{box-sizing:border-box}
  body{background:var(--bg);color:var(--ink);font:16px/1.4 system-ui,Segoe UI,Roboto,sans-serif;
       margin:0;display:flex;justify-content:center}
  .wrap{width:100%;max-width:560px;display:flex;flex-direction:column;
        gap:12px;padding:16px 16px calc(14px + env(safe-area-inset-bottom))}
  h1{font-size:13px;margin:0;letter-spacing:.1em;text-transform:uppercase;
     color:var(--muted);font-weight:600;display:flex;justify-content:space-between;align-items:center}
  .live{display:inline-flex;align-items:center;gap:6px}
  .dot{width:9px;height:9px;border-radius:50%;background:var(--skip)}
  .dot.on{background:var(--ok);box-shadow:0 0 6px var(--ok)}
  .pct{font-size:clamp(64px, 22vw, 110px);font-weight:800;line-height:.95;
       font-variant-numeric:tabular-nums;letter-spacing:-.02em}
  .state{font-size:15px;color:var(--muted)}
  .bar{height:22px;background:var(--bar-bg);border-radius:11px;overflow:hidden}
  .fill{height:100%;background:var(--bar-fill);border-radius:11px;transition:width .5s}
  .count{font-size:24px;font-weight:700;font-variant-numeric:tabular-nums}
  .count small{font-size:15px;color:var(--muted);font-weight:500}
  .rows{background:var(--card);border:1px solid var(--edge);border-radius:14px;padding:4px 16px}
  .r{display:flex;justify-content:space-between;align-items:center;
     padding:11px 0;border-bottom:1px solid var(--edge)}
  .r:last-child{border-bottom:none}
  .r span{font-size:13px;color:var(--muted);text-transform:uppercase;letter-spacing:.07em}
  .r b{font-size:26px;font-weight:800;font-variant-numeric:tabular-nums;line-height:1}
  .r.ok b{color:var(--ok)} .r.bad b{color:var(--bad)}
  .r.warn b{color:var(--warn)} .r.skip b{color:var(--skip)}
  .r.time b{font-size:20px}
  .spec{background:var(--card);border:1px solid var(--edge);border-radius:14px;padding:12px 16px}
  .spec span{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.07em}
  .spec div{font-family:ui-monospace,Consolas,monospace;font-size:13px;
            overflow-wrap:anywhere;margin-top:4px}
  .banner{display:none;border-radius:12px;padding:12px 16px;font-size:16px;font-weight:700;
          color:#fff;text-align:center}
  .banner.finished-ok{display:block;background:var(--ok)}
  .banner.finished-bad{display:block;background:var(--warn)}
  .banner.dead{display:block;background:var(--bad)}
  .foot{font-size:12px;color:var(--muted);text-align:center}
</style></head><body>
<div class="wrap">
  <div class="banner" id="banner"></div>
  <h1><span>Full suite · RenderRanchy</span>
      <span class="live"><span class="dot" id="dot"></span><span id="age">…</span></span></h1>
  <div>
    <div class="pct" id="pct">—</div>
    <div class="state" id="state">waiting for data…</div>
  </div>
  <div class="bar"><div class="fill" id="fill" style="width:0%"></div></div>
  <div class="count"><span id="done">0</span> <small>/ <span id="total">0</span> tests</small></div>
  <div class="rows">
    <div class="r ok"><span>passed</span><b id="pass">–</b></div>
    <div class="r bad"><span>failed</span><b id="fail">–</b></div>
    <div class="r warn"><span>flaky</span><b id="flaky">–</b></div>
    <div class="r skip"><span>skipped</span><b id="skip">–</b></div>
    <div class="r time"><span>elapsed</span><b id="elapsed">–</b></div>
    <div class="r time"><span>eta</span><b id="eta">–</b></div>
  </div>
  <div class="spec"><span>now running</span><div id="spec">–</div></div>
  <div class="foot">live over WebSocket · falls back to polling if the socket drops · no model involved</div>
</div>
<script>
  var hb = 0, wsOpen = false, status = '', pctNow = '', failsNow = 0;
  function g(id){ return document.getElementById(id); }
  function render(t){
    var m;
    // the reporter's own status word: running mid-run, passed/failed at onEnd
    status = (m = t.match(/·\\s*(running|passed|failed)\\b/)) ? m[1] : '';
    if ((m = t.match(/\\*\\*([\\d.]+)%\\*\\*/))) { pctNow = m[1]; g('pct').textContent = m[1] + '%'; g('fill').style.width = m[1] + '%'; }
    if ((m = t.match(/\\*\\*(\\d+)\\s*\\/\\s*(\\d+)\\*\\*/))) { g('done').textContent = m[1]; g('total').textContent = m[2]; }
    if ((m = t.match(/✅\\s*(\\d+)/))) g('pass').textContent = m[1];
    if ((m = t.match(/❌\\s*(\\d+)/))) { failsNow = +m[1]; g('fail').textContent = m[1]; }
    if ((m = t.match(/⚠\\s*(\\d+)/)))  g('flaky').textContent = m[1];
    if ((m = t.match(/⊘\\s*(\\d+)/)))  g('skip').textContent = m[1];
    if ((m = t.match(/⏱\\s*([\\dhms ]+?)\\s*·/))) g('elapsed').textContent = m[1].trim();
    if ((m = t.match(/ETA\\s*([\\dhms ~]+)/))) g('eta').textContent = '~' + m[1].trim().replace(/^~/,'');
    var lines = t.split('\\n');
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i].trim();
      if (l.charAt(0) === '\`' && l.indexOf('.spec.js') > 0) g('spec').textContent = l.replace(/\`/g, '');
    }
    if ((m = t.match(/heartbeat (\\S+?)[\\s—]/))) hb = Date.parse(m[1]) || 0;
    tick();
  }
  function tick(){
    if (!hb) return;
    var ageMin = (Date.now() - hb) / 60000;
    var mm = Math.round(ageMin);
    g('age').textContent = ageMin < 1 ? (wsOpen ? 'live' : 'recent') : mm + ' min old';
    var b = g('banner');
    // Three distinct states, using the reporter's OWN semantics (a running heartbeat
    // older than 120s means the run died — documented in the reporter itself):
    if (status === 'running' && ageMin * 60 > 120) {
      b.className = 'banner dead';
      b.textContent = '💀 Run DIED mid-flight at ' + (pctNow || '?') + '% — heartbeat ' + mm + ' min old';
      g('state').textContent = 'dead';
    } else if (status === 'passed' || status === 'failed') {
      var ok = status === 'passed' && failsNow === 0;
      b.className = ok ? 'banner finished-ok' : 'banner finished-bad';
      b.textContent = ok ? '✔ FINISHED — all green'
                         : '⚑ FINISHED — ' + failsNow + ' failed';
      g('state').textContent = 'finished ' + (ageMin < 1 ? 'just now' : mm + ' min ago');
    } else {
      b.className = 'banner';
      b.textContent = '';
      g('state').textContent = status === 'running' ? 'running' : 'waiting for data…';
    }
  }
  function connect(){
    try {
      var ws = new WebSocket('wss://' + location.host + '/live');
      ws.onopen = function(){ wsOpen = true; g('dot').className = 'dot on';
        try { ws.send('hi'); } catch(_){} };   // the DO answers with current state
      ws.onmessage = function(e){ if (e.data && e.data.length > 10) render(e.data); };
      ws.onclose = function(){ wsOpen = false; g('dot').className = 'dot';
        setTimeout(connect, 3000 + Math.random() * 4000); };
      ws.onerror = function(){ try { ws.close(); } catch(_){} };
    } catch(_) { setTimeout(connect, 8000); }
  }
  function pull(){
    if (wsOpen && hb) return;   // socket healthy AND we have data: no polling at all
    fetch('/raw', { cache: 'no-store' })
      .then(function(r){ return r.text(); })
      .then(function(t){ if (t && t.length > 10) render(t); })
      .catch(function(){});
  }
  connect(); pull(); setInterval(pull, 20000); setInterval(tick, 30000);
</script>
</body></html>`;

export class ProgressRoom {
  constructor(state) { this.state = state; }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/live') {
      if (request.headers.get('Upgrade') !== 'websocket')
        return new Response('expected websocket', { status: 426 });
      const pair = new WebSocketPair();
      this.state.acceptWebSocket(pair[1]);            // hibernatable — an idle phone costs nothing
      const cur = await this.state.storage.get('p');
      if (cur) pair[1].send(cur);                     // current state immediately on connect
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    if (request.method === 'POST' && url.pathname === '/u') {
      const t = await request.text();
      if (t.length > 20000) return new Response('too big', { status: 413 });
      await this.state.storage.put('p', t);
      for (const ws of this.state.getWebSockets()) { try { ws.send(t); } catch (_) {} }
      return new Response('ok');
    }

    if (url.pathname === '/raw') {
      const t = (await this.state.storage.get('p')) || '';
      return new Response(t, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
    }

    return new Response('not found', { status: 404 });
  }

  // Hibernation-API handlers — sockets survive the object sleeping between events.
  // A send issued before the 101 handshake returns can be dropped, so the page says "hi"
  // once connected and the current state is answered HERE — the reliable first delivery.
  async webSocketMessage(ws) {
    const cur = await this.state.storage.get('p');
    if (cur) { try { ws.send(cur); } catch (_) {} }
  }
  async webSocketClose(ws) { try { ws.close(); } catch (_) {} }
  async webSocketError(ws) { try { ws.close(); } catch (_) {} }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/') {
      return new Response(PAGE, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
    }
    if (url.pathname === '/u') {
      if (url.searchParams.get('k') !== env.PUSH_KEY) return new Response('no', { status: 403 });
    }
    // /u (key-checked above), /live, /raw — all served by the one room.
    const room = env.ROOM.get(env.ROOM.idFromName('main'));
    return room.fetch(request);
  },
};
