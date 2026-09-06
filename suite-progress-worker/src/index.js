// DDCS suite progress — event-driven edition. One Durable Object holds the latest progress text
// and every open phone as a hibernatable WebSocket; a push broadcasts to all of them instantly.
// No KV, no cache windows, no polling anywhere in the chain (the page keeps a slow /raw poll only
// as a fallback while its socket is down). See ../wrangler.toml.

const PAGE = `<!doctype html>
<html><head>
<meta charset="utf-8">
<title>Suite Progress</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#101214">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='22' fill='%23101214'/%3E%3Ctext x='50' y='58' font-size='58' text-anchor='middle' dominant-baseline='middle'%3E🧪%3C/text%3E%3C/svg%3E">
<link rel="apple-touch-icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23101214'/%3E%3Ctext x='50' y='58' font-size='58' text-anchor='middle' dominant-baseline='middle'%3E🧪%3C/text%3E%3C/svg%3E">
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
  .hero{display:flex;flex-direction:column;gap:12px}
  /* Wide screens (tablet / desktop / landscape phone): two columns — the hero breathes on
     the left, the stat rows sit beside it, the running spec spans. Portrait keeps the ruled
     rows-only layout untouched. */
  @media (min-width: 700px){
    .wrap{max-width:980px;display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);
          grid-template-areas:"banner banner" "head head" "hero rows" "spec spec" "foot foot";
          gap:16px;align-content:start}
    .banner{grid-area:banner} h1{grid-area:head} .hero{grid-area:hero;justify-content:center}
    .rows{grid-area:rows} .spec{grid-area:spec} .foot{grid-area:foot}
    .pct{font-size:clamp(90px, 11vw, 150px)}
    .r{padding:14px 0} .r b{font-size:30px} .r.time b{font-size:22px}
  }
  /* Landscape phone: EVERYTHING on one screen, no scrolling. The whole layout compacts —
     small hero, tight rows, one-line spec, footer dropped. */
  @media (orientation: landscape) and (max-height: 620px){
    .wrap{max-width:100%;gap:8px;padding:8px 14px;min-height:100dvh;
          display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);
          grid-template-areas:"banner banner" "head head" "hero rows" "spec spec";
          align-content:start}
    .banner{grid-area:banner;padding:6px 12px;font-size:13px}
    h1{grid-area:head} .hero{grid-area:hero;justify-content:center;gap:8px}
    .rows{grid-area:rows;padding:0 14px} .spec{grid-area:spec;padding:8px 14px}
    .pct{font-size:clamp(44px, 9vh, 72px)}
    .state{font-size:13px}
    .bar{height:12px}
    .count{font-size:18px} .count small{font-size:13px}
    .r{padding:5px 0} .r b{font-size:18px} .r.time b{font-size:15px}
    .r span{font-size:11px}
    .spec div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px}
    .spec span{font-size:10px}
    .foot{display:none}
  }
  h1{font-size:13px;margin:0;letter-spacing:.1em;text-transform:uppercase;
     color:var(--muted);font-weight:600;display:flex;justify-content:space-between;align-items:center}
  .live{display:inline-flex;align-items:center;gap:10px}
  .dot{width:9px;height:9px;border-radius:50%;background:var(--skip)}
  .dot.on{background:var(--ok);box-shadow:0 0 6px var(--ok)}
  .bell{background:none;border:1px solid var(--edge);border-radius:8px;color:var(--muted);
        font-size:15px;padding:3px 9px;cursor:pointer;line-height:1}
  .bell.on{color:var(--warn);border-color:var(--warn)}
  .mode{background:none;border:1px solid var(--edge);border-radius:8px;color:var(--muted);
        font-size:12px;font-weight:700;padding:4px 9px;cursor:pointer;line-height:1;
        letter-spacing:.05em}
  #rawcard{display:none;background:var(--card);border:1px solid var(--edge);border-radius:14px;
           padding:14px 16px}
  #rawcard pre{margin:0;font:12.5px/1.6 ui-monospace,Consolas,monospace;white-space:pre-wrap;
               overflow-wrap:anywhere;color:var(--ink)}
  body.md .hero, body.md .rows, body.md .spec, body.md .banner, body.md .foot{display:none}
  body.md #rawcard{display:block}
  body.md .wrap{display:flex;flex-direction:column;max-width:760px}
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
  <h1><span id="tier">Suite · RenderRanchy</span>
      <span class="live"><button class="mode" id="mode" title="styled view / the raw progress.md">MD</button><button class="bell on" id="bell" title="bell / silent — rings at 90% and at the finish">🔔</button><span class="dot" id="dot"></span><span id="age">…</span></span></h1>
  <div id="rawcard"><pre id="raw">waiting for data…</pre></div>
  <div class="hero">
    <div>
      <div class="pct" id="pct">—</div>
      <div class="state" id="state">waiting for data…</div>
    </div>
    <div class="bar"><div class="fill" id="fill" style="width:0%"></div></div>
    <div class="count"><span id="done">0</span> <small>/ <span id="total">0</span> tests</small></div>
  </div>
  <div class="rows">
    <div class="r ok"><span>passed</span><b id="pass">–</b></div>
    <div class="r bad"><span>failed</span><b id="fail">–</b></div>
    <div class="r warn"><span>flaky</span><b id="flaky">–</b></div>
    <div class="r skip"><span>skipped</span><b id="skip">–</b></div>
    <div class="r time"><span>elapsed</span><b id="elapsed">–</b></div>
    <div class="r time"><span>eta</span><b id="eta">–</b></div>
  </div>
  <div class="spec"><span>now running</span><div id="spec">–</div></div>
  <details class="spec" style="cursor:pointer">
    <summary style="font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.07em">what this page shows, and how to know it's telling the truth</summary>
    <div style="font-size:13px;color:var(--muted);line-height:1.6;margin-top:8px">
      Every number comes from <b>the suite's own reporter</b> writing <code>test-results/progress.md</code> —
      this page parses that file verbatim and never computes results of its own. The MD button shows the raw
      file, so the styled view can always be checked against its source.<br><br>
      <b>States:</b> <i>running</i> = the reporter says so and its heartbeat is fresh ·
      <i>finished</i> = the reporter's final ratio line (green = zero failed) ·
      <i>💀 dead</i> = still says running but the heartbeat passed the reporter's own 120s rule ·
      <i>N min old</i> = the age of the last delivery, from the heartbeat inside the data, never this device's guess.<br><br>
      <b>Clocks:</b> elapsed/ETA tick locally, anchored to the heartbeat — and freeze the moment the run
      stops being provably alive, so a dead run's clock cannot lie.<br><br>
      <b>Tier:</b> stamped by the reporter from the invoking npm script — declared, never inferred from
      test counts.<br><br>
      Delivery: file event → push → Durable Object → WebSocket (green dot = live; grey = polling fallback).
      No model, no tokens, anywhere. Trust but verify:
      <a href="/raw" style="color:var(--muted)">the raw data</a> ·
      <a href="https://github.com/fchabot-dxf/DDCS-Studio/commits/main/suite-progress-worker" style="color:var(--muted)">every change to this page, with its reason</a>
    </div>
  </details>
  <div class="foot">live over WebSocket · falls back to polling if the socket drops · no model involved</div>
</div>
<script>
  var hb = 0, wsOpen = false, status = '', pctNow = '', failsNow = 0;
  var elFromData = 0, etaFromData = 0;
  function g(id){ return document.getElementById(id); }
  function parseDur(s){
    var m = s.match(/(?:(\\d+)h)?\\s*(?:(\\d+)m)?\\s*(?:(\\d+)s)?/);
    return m ? ((+m[1]||0)*3600 + (+m[2]||0)*60 + (+m[3]||0)) : 0;
  }
  function fmtDur(sec){
    sec = Math.max(0, Math.round(sec));
    var h = Math.floor(sec/3600), mn = Math.floor((sec%3600)/60), s = sec%60;
    return (h ? h + 'h ' : '') + mn + 'm ' + s + 's';
  }
  // The clocks: heartbeat minus reported-elapsed anchors the run's start; tick locally
  // every second while the run is genuinely alive (running + heartbeat fresher than the
  // reporter's own 120s dead rule). Frozen otherwise — a dead run's clock must not lie.
  setInterval(function(){
    if (status !== 'running' || !hb || elFromData <= 0) return;
    if (Date.now() - hb > 120000) return;                    // dead rule: freeze
    var runStart = hb - elFromData * 1000;
    g('elapsed').textContent = fmtDur((Date.now() - runStart) / 1000);
    if (etaFromData > 0) {
      var etaEnd = hb + etaFromData * 1000;
      g('eta').textContent = '~' + fmtDur((etaEnd - Date.now()) / 1000);
    }
  }, 1000);
  function render(t){
    var m;
    g('raw').textContent = t;   // the raw view mirrors every delivery, live
    // The reporter NEVER writes a bare status word — t2409's own owner ruling made the
    // verdict a RATIO ("4/4 passed") so reds can't read as a crash at a glance. So:
    // "running" mid-run; a ratio + "passed" = finished (fail count colors it); else unknown.
    status = /·\\s*running\\b/.test(t) ? 'running'
           : (/\\d+\\s*\\/\\s*\\d+ passed/.test(t) ? 'finished' : '');
    if ((m = t.match(/\\*\\*([\\d.]+)%\\*\\*/))) { pctNow = m[1]; g('pct').textContent = m[1] + '%'; g('fill').style.width = m[1] + '%'; }
    if ((m = t.match(/\\*\\*(\\d+)\\s*\\/\\s*(\\d+)\\*\\*/))) { g('done').textContent = m[1]; g('total').textContent = m[2]; }
    if ((m = t.match(/✅\\s*(\\d+)/))) g('pass').textContent = m[1];
    if ((m = t.match(/❌\\s*(\\d+)/))) { failsNow = +m[1]; g('fail').textContent = m[1]; }
    if ((m = t.match(/⚠\\s*(\\d+)/)))  g('flaky').textContent = m[1];
    if ((m = t.match(/⊘\\s*(\\d+)/)))  g('skip').textContent = m[1];
    if ((m = t.match(/⏱\\s*([\\dhms ]+?)\\s*·/))) { g('elapsed').textContent = m[1].trim(); elFromData = parseDur(m[1]); }
    if ((m = t.match(/ETA\\s*([\\dhms ~]+)/))) { var e = m[1].trim().replace(/^~/,''); g('eta').textContent = '~' + e; etaFromData = parseDur(e); }
    var lines = t.split('\\n');
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i].trim();
      if (l.charAt(0) === '\`' && l.indexOf('.spec.js') > 0) g('spec').textContent = l.replace(/\`/g, '');
    }
    if ((m = t.match(/heartbeat (\\S+?)[\\s—]/))) hb = Date.parse(m[1]) || 0;
    // The tier, DECLARED by the reporter (tier: <npm script>) once it learns to say it —
    // displayed verbatim, never inferred from test counts.
    if ((m = t.match(/tier:\\s*([\\w:.-]+)/))) g('tier').textContent = m[1] + ' · RenderRanchy';
    checkBells();
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
    } else if (status === 'finished') {
      var ok = failsNow === 0;
      b.className = ok ? 'banner finished-ok' : 'banner finished-bad';
      b.textContent = ok ? '✔ FINISHED — all green'
                         : '⚑ FINISHED — ' + failsNow + ' failed';
      g('state').textContent = 'finished ' + (ageMin < 1 ? 'just now' : mm + ' min ago');
      g('eta').textContent = '—';
    } else {
      b.className = 'banner';
      b.textContent = '';
      g('state').textContent = status === 'running' ? 'running' : 'waiting for data…';
    }
  }
  // ---- the bell: ring at 90% and at the finish. The first real gesture arms the audio
  // (a scroll's own touch counts — phone reality, invisible). The 🔔/🔕 toggle is NOT the
  // arming mechanism: it is a plain silent/bell preference, bell by default, remembered.
  var rang90 = false, rangDone = false, lastDone = 0, actx = null, pendingSeq = null;
  var soundOn = true;
  try { soundOn = localStorage.getItem('bell') !== '0'; } catch(_){}
  function bellUi(){ var b = g('bell'); if (!b) return;
    b.textContent = soundOn ? '🔔' : '🔕'; b.className = soundOn ? 'bell on' : 'bell'; }
  document.addEventListener('DOMContentLoaded', function(){
    bellUi();
    g('bell').onclick = function(){
      soundOn = !soundOn;
      try { localStorage.setItem('bell', soundOn ? '1' : '0'); } catch(_){}
      bellUi();
      if (soundOn) beep([[880, 0, 90]]); else pendingSeq = null;   // going silent drops anything queued
    };
    // styled dashboard vs the raw progress.md — a view preference, remembered
    var md = false;
    try { md = localStorage.getItem('view') === 'md'; } catch(_){}
    function modeUi(){ document.body.className = md ? 'md' : '';
      g('mode').textContent = md ? 'UI' : 'MD'; }
    modeUi();
    g('mode').onclick = function(){
      md = !md;
      try { localStorage.setItem('view', md ? 'md' : 'ui'); } catch(_){}
      modeUi();
    };
  });
  function unlockAudio(){
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      if (pendingSeq) { var s = pendingSeq; pendingSeq = null; beep(s); }
    } catch(_){}
  }
  ['pointerdown','touchend','keydown'].forEach(function(ev){
    document.addEventListener(ev, unlockAudio, { once: true, passive: true });
  });
  function beep(seq){       // seq: [ [freq, startMs, lenMs], ... ]
    if (!soundOn) return;   // the preference — arming is separate and automatic
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') { actx.resume(); pendingSeq = seq; return; }
      var t0 = actx.currentTime;
      seq.forEach(function(n){
        var o = actx.createOscillator(), gn = actx.createGain();
        o.frequency.value = n[0]; o.type = 'sine';
        gn.gain.setValueAtTime(0.0001, t0 + n[1]/1000);
        gn.gain.exponentialRampToValueAtTime(0.28, t0 + n[1]/1000 + 0.02);
        gn.gain.exponentialRampToValueAtTime(0.0001, t0 + (n[1]+n[2])/1000);
        o.connect(gn); gn.connect(actx.destination);
        o.start(t0 + n[1]/1000); o.stop(t0 + (n[1]+n[2])/1000 + 0.05);
      });
    } catch(_){}
    if (navigator.vibrate) { try { navigator.vibrate([120, 60, 120]); } catch(_){} }
  }
  function checkBells(){
    var doneN = +g('done').textContent || 0;
    // a NEW run: progress went backwards — re-arm both bells
    if (doneN < lastDone - 50) { rang90 = false; rangDone = false; }
    lastDone = doneN;
    var p = parseFloat(pctNow) || 0;
    if (status === 'running' && p >= 90 && !rang90) {
      rang90 = true; beep([[660, 0, 140], [880, 180, 220]]);                    // two-tone: almost there
    }
    if (status === 'finished' && !rangDone) {
      rangDone = true; rang90 = true;
      if (failsNow === 0)
        beep([[523, 0, 130], [659, 150, 130], [784, 300, 130], [1047, 450, 320]]); // major arpeggio: all green
      else
        beep([[440, 0, 250], [330, 300, 400]]);                                    // falling: finished with reds
    }
  }
  var sock = null;
  function connect(){
    try {
      var ws = sock = new WebSocket('wss://' + location.host + '/live');
      ws.onopen = function(){ wsOpen = true; g('dot').className = 'dot on';
        try { ws.send('hi'); } catch(_){} };   // the DO answers with current state
      ws.onmessage = function(e){ if (e.data && e.data.length > 10) render(e.data); };
      ws.onclose = function(){ wsOpen = false; g('dot').className = 'dot';
        setTimeout(connect, 2000 + Math.random() * 3000); };
      ws.onerror = function(){ try { ws.close(); } catch(_){} };
    } catch(_) { setTimeout(connect, 6000); }
  }
  // Phones kill idle sockets (NAT timeouts, background suspension). A 25s ping keeps the
  // path warm — and since the DO answers any message with current state, each ping doubles
  // as a refresh, so even a silent gap self-corrects.
  setInterval(function(){
    if (wsOpen && sock && sock.readyState === 1) { try { sock.send('hi'); } catch(_){} }
  }, 25000);
  // Coming back from the lock screen / another app: reconnect and catch up immediately.
  document.addEventListener('visibilitychange', function(){
    if (document.visibilityState === 'visible') {
      if (!wsOpen || !sock || sock.readyState !== 1) { try { sock && sock.close(); } catch(_){} connect(); }
      else { try { sock.send('hi'); } catch(_){} }
      pull();
    }
  });
  function pull(){
    if (wsOpen && hb) return;   // socket healthy AND we have data: no polling at all
    fetch('/raw', { cache: 'no-store' })
      .then(function(r){ return r.text(); })
      .then(function(t){ if (t && t.length > 10) render(t); })
      .catch(function(){});
  }
  connect(); pull();
  setInterval(pull, 12000); setInterval(tick, 30000);
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
      // THE RUN LOG: when a run transitions running → finished, snapshot one compact line.
      // (Same format detection the page uses: the t2409 ratio, never a bare status word.)
      const prev = (await this.state.storage.get('p')) || '';
      const fin = /\d+\s*\/\s*\d+ passed/.test(t) && !/·\s*running\b/.test(t);
      const wasRunning = /·\s*running\b/.test(prev);
      if (fin && wasRunning) {
        const g = (re) => { const m = t.match(re); return m ? m[1] : ''; };
        const entry = {
          at: Date.now(),
          tier: g(/tier:\s*([\w:.-]+)/),
          total: g(/\*\*\d+\s*\/\s*(\d+)\*\*/),
          passed: g(/✅\s*(\d+)/), failed: g(/❌\s*(\d+)/),
          flaky: g(/⚠\s*(\d+)/), skipped: g(/⊘\s*(\d+)/),
          took: g(/⏱\s*([\dhms ]+?)\s*·/).trim(),
        };
        const runs = (await this.state.storage.get('runs')) || [];
        runs.unshift(entry);
        if (runs.length > 60) runs.length = 60;
        await this.state.storage.put('runs', runs);
      }
      await this.state.storage.put('p', t);
      for (const ws of this.state.getWebSockets()) { try { ws.send(t); } catch (_) {} }
      return new Response('ok');
    }

    if (url.pathname === '/runs') {
      const runs = (await this.state.storage.get('runs')) || [];
      return new Response(JSON.stringify(runs), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
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
