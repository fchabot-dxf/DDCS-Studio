/**
 * blocks/blocksApp.js — STUDIO "Blocks" tab, on BLOCKLY.
 *
 * The left side is a Blockly workspace (blocks defined from the ops registry via bridge.js); the right side
 * is the SAME preview + projected-G-code panel as before. Emit reuses the proven engine: workspace →
 * workspaceToStack → emitMapped (one source of truth, shared with the STUDIO wizards). Open-as-blocks writes
 * a STUDIO op's stack into the workspace (stackToWorkspace); reverse-sync reads it back (workspaceToStack).
 * Blockly (vendored UMD) is lazy-loaded on first open.
 */
import { installBlockly, buildToolbox } from './blockly/bridge.js';
import { workspaceToStack, stackToWorkspace } from './blockly/stackBridge.js';
import { ddcsTheme } from './blockly/theme.js';
import { emitMapped } from './blockModel.js';
import { resolveActivePost } from '../wizards/dialects/index.js';
import { getActiveProfile } from '../shared/js/profiles/controllerProfiles.js';
import { parseGcode } from '../gcodeParser.js';

let api = null;            // module singleton, set once the workspace is built: { refresh, load }
let initPromise = null;    // in-flight build. The header tabs are double-wired (inline onclick in index.html +
// addEventListener in gatewayStatus.js), so ONE Blocks click fires showApp('blocks') twice → two initBlocks().
// `api` isn't set until the end of the build, so a plain `if (api)` guard can't stop the second call. We cache
// the build PROMISE and hand it to every concurrent caller, so they all await the SAME single inject (never a
// 2nd workspace) and only resume once ddcsLoadBlockStack is ready — so the first buildActiveOpStack() actually
// loads and the second correctly no-ops (its loadedSig dedup). An early-return latch instead let the 2nd caller
// run buildActiveOpStack() before load was ready, consuming the dedup and dropping the stack ("nothing renders").

/** Lazy-load the vendored Blockly UMD (sets window.Blockly). */
function loadBlockly() {
  if (window.Blockly) return Promise.resolve(window.Blockly);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'vendor/blockly/blockly.min.js';
    s.onload = () => resolve(window.Blockly);
    s.onerror = () => reject(new Error('Blockly failed to load'));
    document.head.appendChild(s);
  });
}

export function initBlocks() {
  if (api) { api.refresh(); return Promise.resolve(); }   // already built → refresh sizing/preview (callers can still await)
  if (initPromise) return initPromise;                    // a build is already in flight → await the SAME one (no 2nd workspace)
  initPromise = buildWorkspace().catch((e) => { initPromise = null; throw e; });   // reset on failure so a retry can rebuild
  return initPromise;
}

async function buildWorkspace() {
  const root = document.getElementById('blocks-app');
  if (!root) return;

  const B = await loadBlockly();
  installBlockly(B);                            // define every op as a Blockly block

  // NOTE: we deliberately do NOT call B.setParentContainer(root). It relocated the popup singletons into
  // #blocks-app but left DropDownDiv's module-level `div` uncreated, so Blockly's GLOBAL window-resize handler
  // crashed in DropDownDiv.hide() (`Cannot read properties of undefined (reading 'style')`) on every resize —
  // which aborted the async render queue and left the canvas blank. The Blocks tab already runs at body-zoom 1
  // (scaleManager), so the popups are fine on <body> where Blockly puts them by default — same as our working
  // reference Blockly app, which never calls setParentContainer.

  const host = document.getElementById('blk-ws');
  const out = document.getElementById('blk-gcode');
  const preview = document.getElementById('blk-preview');
  const host3d = document.getElementById('blk-host3d');
  let mode = '2d';
  const anim = { playing: false, k: 0, raf: null };
  let curSegs = [];
  let lastGcode = '';   // most-recent projected G-code (round-trip into the STUDIO editor)

  const ws = B.inject(host, {
    toolbox: buildToolbox(), theme: ddcsTheme(B), renderer: 'geras',
    grid: { spacing: 26, length: 2, colour: '#1b2733', snap: true },
    zoom: { controls: true, wheel: true, startScale: 0.9 }, trashcan: true, move: { smoothScroll: true },
  });

  // GUARANTEE the popup singletons' DOM exists, so Blockly's global window-resize handler can never crash in
  // DropDownDiv.hide() (it blind-touches a `div` that createDom sets ONLY when no .blocklyDropDownDiv exists).
  try { B.DropDownDiv && B.DropDownDiv.createDom && B.DropDownDiv.createDom(); } catch (_) { /* */ }
  try { B.WidgetDiv && B.WidgetDiv.createDom && B.WidgetDiv.createDom(); } catch (_) { /* */ }
  try { B.Tooltip && B.Tooltip.createDom && B.Tooltip.createDom(); } catch (_) { /* */ }

  // Blockly injected into a tab that may still have 0 size — resize the workspace SVG whenever the host gets
  // real dimensions, so the blocks are visible once the tab has real geometry.
  const fit = () => { try { B.svgResize(ws); } catch (_) { /* pre-render */ } };
  new ResizeObserver(fit).observe(host);

  // ---- emit: workspace → our stack → the proven emitMapped fold → right panel ----
  function reproject() {
    const dialect = resolveActivePost(getActiveProfile().id);   // active post processor (override or follow machine)
    const { text, lines, map } = emitMapped(workspaceToStack(ws), { dialect });
    lastGcode = text;
    renderCode(lines, map);
    curSegs = segments(text);
    if (mode === '3d') update3D(text);
    else drawPreview(curSegs, anim.playing ? Math.floor(anim.k) : curSegs.length);
    applySelection();
    // Layer 2 — the STUDIO editor IS the live projection of the block program: push the emit on every change.
    // Guard against wiping a hand-written program: only project when the workspace actually has output.
    try {
      const em = window.ddcsStudio && window.ddcsStudio.editorManager;
      if (em && text.trim() && em.getValue() !== text) em.setValue(text);
    } catch (_) { /* editor not ready */ }
  }

  // ---- code view + linked selection (click a code line ⇄ its Blockly block) ----
  function renderCode(lines, map) {
    const frag = document.createDocumentFragment();
    lines.forEach((ln, i) => {
      const span = document.createElement('span');
      span.className = 'gl'; span.textContent = ln;
      const src = map[i];                                  // null = program-owned; else ancestry [outer…inner] of Blockly block ids
      if (src && src.length) { span.dataset.src = src.join(','); span.dataset.owner = src[src.length - 1]; }
      frag.appendChild(span);
    });
    out.replaceChildren(frag);
  }
  let selectedId = null;
  function applySelection(opts = {}) {
    let firstHot = null, hot = 0;
    out.querySelectorAll('.gl').forEach((sp) => {
      const src = sp.dataset.src ? sp.dataset.src.split(',') : null;
      const on = !!(selectedId && src && src.includes(selectedId));
      sp.classList.toggle('hot', on);
      if (on) { hot++; if (!firstHot) firstHot = sp; }
    });
    out.classList.toggle('has-sel', !!selectedId);
    if (selectedId && firstHot && opts.scrollCode) firstHot.scrollIntoView({ block: 'nearest' });
  }
  out.addEventListener('click', (e) => {
    const sp = e.target.closest('.gl');
    if (sp && sp.dataset.owner) { selectedId = sp.dataset.owner; try { ws.getBlockById(selectedId)?.select(); } catch (_) { /* gone */ } applySelection({ scrollCode: false }); }
    else { selectedId = null; applySelection(); }
  });

  // ---- workspace events: structural change → re-emit; selection → highlight code ----
  ws.addChangeListener((e) => {
    if (e.type === B.Events.SELECTED) { selectedId = e.newElementId || null; applySelection({ scrollCode: true }); }
    else if (!e.isUiEvent) reproject();
  });

  // ---- 2D preview ----
  function segments(text) {
    const segs = []; let x = 0, y = 0;
    text.split('\n').forEach((raw) => {
      const s = raw.replace(/\(.*?\)/g, '').trim(); if (!s) return;
      const mx = s.match(/X(-?[\d.]+)/), my = s.match(/Y(-?[\d.]+)/);
      let type = null;
      if (/^G31\b/.test(s)) type = 'probe';
      else if (/^G0\b/.test(s)) type = 'rapid';
      else if (/^G1\b/.test(s)) type = 'feed';
      else if (/^G[23]\b/.test(s)) type = 'feed';
      if (type && (mx || my)) { const nx = mx ? parseFloat(mx[1]) : x, ny = my ? parseFloat(my[1]) : y; segs.push({ type, x1: x, y1: y, x2: nx, y2: ny }); x = nx; y = ny; }
      else if (mx || my) { if (mx) x = parseFloat(mx[1]); if (my) y = parseFloat(my[1]); }
    });
    return segs;
  }
  function drawPreview(segs, k) {
    const dpr = window.devicePixelRatio || 1, W = preview.clientWidth, H = preview.clientHeight;
    preview.width = W * dpr; preview.height = H * dpr;
    const ctx = preview.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    if (!segs.length) return;
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    segs.forEach((s) => { a = Math.min(a, s.x1, s.x2); c = Math.max(c, s.x1, s.x2); b = Math.min(b, s.y1, s.y2); d = Math.max(d, s.y1, s.y2); });
    const pad = 22, sc = Math.min((W - 2 * pad) / Math.max(1, c - a), (H - 2 * pad) / Math.max(1, d - b));
    const tx = (v) => pad + (v - a) * sc, ty = (v) => H - pad - (v - b) * sc;
    const col = { rapid: '#5a6b7d', feed: '#33b1c9', probe: '#e35c5c' };
    const n = (k == null) ? segs.length : Math.max(0, Math.min(k, segs.length));
    segs.slice(0, n).forEach((s) => {
      ctx.strokeStyle = col[s.type] || '#888'; ctx.lineWidth = s.type === 'rapid' ? 1 : 2;
      ctx.setLineDash(s.type === 'rapid' ? [4, 3] : []);
      ctx.beginPath(); ctx.moveTo(tx(s.x1), ty(s.y1)); ctx.lineTo(tx(s.x2), ty(s.y2)); ctx.stroke();
    });
    ctx.setLineDash([]);
  }

  // ---- 3D preview (lightweight three.js, reuses parseGcode) ----
  let V = null;
  function initThree() {
    const THREE = window.THREE; if (!THREE) return false;
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0d1117);
    const cam = new THREE.PerspectiveCamera(50, 1, 0.05, 1e6); cam.up.set(0, 0, 1);
    const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%'; host3d.appendChild(renderer.domElement);
    const grid = new THREE.GridHelper(200, 20, 0x2a4866, 0x16242f); grid.rotation.x = Math.PI / 2; scene.add(grid);
    scene.add(new THREE.AxesHelper(20));
    const group = new THREE.Group(); scene.add(group);
    V = { THREE, scene, cam, renderer, group, target: new THREE.Vector3(), radius: 160, theta: -Math.PI / 2, phi: Math.PI / 3, fitted: false };
    const applyCam = () => {
      const s = Math.sin(V.phi);
      cam.position.set(V.target.x + V.radius * s * Math.cos(V.theta), V.target.y + V.radius * s * Math.sin(V.theta), V.target.z + V.radius * Math.cos(V.phi));
      cam.lookAt(V.target);
    };
    const resize = () => { const w = host3d.clientWidth, h = host3d.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); applyCam(); renderer.render(scene, cam); };
    V.applyCam = applyCam; V.resize = resize; V.draw = () => { applyCam(); renderer.render(scene, cam); };
    let drag = false, lx = 0, ly = 0;
    host3d.addEventListener('pointerdown', (e) => { drag = true; lx = e.clientX; ly = e.clientY; host3d.setPointerCapture(e.pointerId); });
    host3d.addEventListener('pointermove', (e) => { if (!drag) return; V.theta -= (e.clientX - lx) * 0.01; V.phi = Math.max(0.05, Math.min(Math.PI - 0.05, V.phi - (e.clientY - ly) * 0.01)); lx = e.clientX; ly = e.clientY; V.draw(); });
    host3d.addEventListener('pointerup', () => { drag = false; });
    host3d.addEventListener('wheel', (e) => { e.preventDefault(); V.radius = Math.max(10, Math.min(2000, V.radius * (e.deltaY < 0 ? 0.9 : 1.1))); V.draw(); }, { passive: false });
    new ResizeObserver(resize).observe(host3d);
    return true;
  }
  function update3D(gcode) {
    if (!V && !initThree()) { console.warn('3D needs three.js — using 2D'); setMode('2d'); return; }
    const THREE = V.THREE;
    while (V.group.children.length) { const m = V.group.children.pop(); m.geometry.dispose(); m.material.dispose(); }
    const parsed = parseGcode(gcode); const segs = parsed.segments || parsed;
    const groups = { rapid: [], feed: [], probe: [] };
    let a = Infinity, b = Infinity, c = Infinity, A = -Infinity, B2 = -Infinity, C = -Infinity;
    segs.forEach((s) => {
      const t = s.probe ? 'probe' : (s.rapid ? 'rapid' : 'feed');
      groups[t].push(s.x1, s.y1, s.z1, s.x2, s.y2, s.z2);
      a = Math.min(a, s.x1, s.x2); A = Math.max(A, s.x1, s.x2);
      b = Math.min(b, s.y1, s.y2); B2 = Math.max(B2, s.y1, s.y2);
      c = Math.min(c, s.z1, s.z2); C = Math.max(C, s.z1, s.z2);
    });
    const cols = { rapid: 0x5a6b7d, feed: 0x33b1c9, probe: 0xe35c5c };
    for (const t in groups) {
      if (!groups[t].length) continue;
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(groups[t], 3));
      V.group.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: cols[t] })));
    }
    if (!V.fitted && isFinite(a)) {
      V.target.set((a + A) / 2, (b + B2) / 2, (c + C) / 2);
      V.radius = 1.8 * Math.max(A - a, B2 - b, C - c, 20); V.fitted = true;
    }
    V.resize(); V.draw();
  }

  // ---- 2D / 3D toggle ----
  const m2d = document.getElementById('blk-m2d'), m3d = document.getElementById('blk-m3d');
  function setMode(next) {
    mode = next; stopAnim();
    m2d.classList.toggle('primary', mode === '2d'); m3d.classList.toggle('primary', mode === '3d');
    preview.style.display = mode === '2d' ? '' : 'none';
    host3d.style.display = mode === '3d' ? '' : 'none';
    reproject();
  }
  m2d.onclick = () => setMode('2d');
  m3d.onclick = () => setMode('3d');

  // ---- play / pause (2D progressive reveal) ----
  const play = document.getElementById('blk-play');
  function stopAnim() { if (anim.playing) { anim.playing = false; cancelAnimationFrame(anim.raf); play.textContent = '▶ Play'; } }
  function animLoop() {
    if (!anim.playing) return;
    anim.k += 1.2;
    if (anim.k >= curSegs.length) anim.k = 0;
    drawPreview(curSegs, Math.floor(anim.k));
    anim.raf = requestAnimationFrame(animLoop);
  }
  play.onclick = () => {
    if (mode !== '2d') { stopAnim(); return; }
    anim.playing = !anim.playing;
    if (anim.playing) { anim.k = 0; play.textContent = '⏸ Pause'; animLoop(); }
    else { play.textContent = '▶ Play'; drawPreview(curSegs, curSegs.length); }
  };


  // ---- open-as-blocks: write a STUDIO op's stack into the workspace ----
  function loadProgram(stack) {
    stackToWorkspace(stack, ws);   // loads the stack at a fixed canvas pos (24,24) — see stackBridge
    reproject();
    // Place the loaded stack DETERMINISTICALLY — never zoomToFit/scrollCenter here. Right after the tab becomes
    // visible (body zoom flips back to 1), Blockly's viewport metric is transiently wrong, so a metric-based
    // reframe over-scales (~1.9×) and parks the blocks off-screen — the "models loaded, canvas blank" bug. (A
    // hand-dropped block renders fine precisely because nothing reframes it; our reference Blockly app never
    // reframes on load either.) So: flush the v12 render queue, size the SVG to the host, then pin a fixed
    // scale + top-left scroll — independent of any transient metric.
    const place = () => {
      try { if (B.renderManagement && B.renderManagement.triggerQueuedRenders) B.renderManagement.triggerQueuedRenders(); } catch (_) { /* */ }
      try { B.svgResize(ws); } catch (_) { /* */ }
      try { ws.setScale(0.9); } catch (_) { /* */ }
      try { ws.scroll(30, 30); } catch (_) { /* pre-render */ }
    };
    requestAnimationFrame(place);
    setTimeout(place, 120);
    setTimeout(place, 400);
  }

  window.addEventListener('resize', () => { if (!root.classList.contains('hidden')) { B.svgResize(ws); reproject(); } });

  reproject();
  window.__blkws = ws;                            // workspace handle (tests / debugging)
  api = { refresh: () => { B.svgResize(ws); reproject(); }, load: loadProgram };
  window.ddcsRefreshBlocks = reproject;          // Settings (post-processor change) → re-emit live
  window.ddcsLoadBlockStack = loadProgram;       // STUDIO op → blocks (gatewayStatus calls this on tab open)
  window.ddcsGetBlockProgram = () => workspaceToStack(ws);   // blocks → STUDIO reverse reconcile
  window.ddcsGetBlockGcode = () => lastGcode;    // blocks → STUDIO editor round-trip (on Studio-tab click)
}
