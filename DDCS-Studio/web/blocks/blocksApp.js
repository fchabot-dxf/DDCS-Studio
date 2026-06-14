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
import { setStack, getStack, getProjection, onChange } from './programModel.js';   // blocks = a VIEW of the shared program model
import { traceToolpath } from '../engine/trace.js';
import { createToolpath2d } from '../viz/toolpath2d.js';   // shared 2D toolpath preview (also used by Studio main + wizards)

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

/** Show the Blocks tab: build the view if needed, then seed from a fresh STUDIO op (else the model already holds
 *  the program). All Blocks logic lives here — the tab router (gatewayStatus.showApp) just calls this. */
export async function showBlocks() {
  await initBlocks();
  try {
    const ops = await import('./opStacks.js');
    const r = ops.buildActiveOpStack();
    if (r) setStack(r.blocks, 'load');                    // a fresh STUDIO op → render it (model + views)
    else if (api) api.refresh();                          // no new op → re-render the existing program + reframe
    if (!getStack().length) {                             // nothing to show — name an unported op instead of a blank
      const un = ops.unportedActiveOp(), g = document.getElementById('blk-gcode');
      if (un && g) g.textContent = `( "${un}" isn't available as blocks yet — port in progress )`;
    }
  } catch (err) { console.error('show blocks failed', err); }
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
  const t2 = createToolpath2d(preview);   // shared 2D toolpath view + Play

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

  // ---- this tab is a VIEW of the shared program model (blocks = the data): workspace ⇄ model + right pane ----
  let muteChanges = false;   // true while WE rebuild the workspace from the model (suppress the change echo)

  // Pin a (re)loaded program to a fixed scale + top-left scroll — metric-independent (see the double-inject /
  // off-screen history). Guarded ticks so a transient bad viewport metric can't fling the blocks off-screen.
  const place = () => {
    try { if (B.renderManagement && B.renderManagement.triggerQueuedRenders) B.renderManagement.triggerQueuedRenders(); } catch (_) { /* */ }
    try { B.svgResize(ws); } catch (_) { /* */ }
    try { ws.setScale(0.9); } catch (_) { /* */ }
    try { ws.scroll(30, 30); } catch (_) { /* pre-render */ }
  };

  // Render the right pane (code panel + preview + selection) from a projection { text, lines, map }.
  function renderViews(p) {
    renderCode(p.lines, p.map);
    if (mode === '3d') update3D(p.text);
    else t2.setGcode(p.text);
    applySelection();
  }

  // User edited the WORKSPACE → push to the shared model (which re-projects the editor) → refresh the pane.
  function reproject() {
    setStack(workspaceToStack(ws), 'blockly');
    renderViews(getProjection());
  }

  // The model changed ELSEWHERE (Studio editor edit / wizard seed / post-processor change) → render it into the
  // workspace (muted so the rebuild doesn't echo back through the change listener), reframe, refresh the pane.
  function renderFromModel(p) {
    muteChanges = true;
    try { stackToWorkspace(getStack(), ws); } finally { muteChanges = false; }
    requestAnimationFrame(place); setTimeout(place, 120); setTimeout(place, 400);
    renderViews(p);
  }
  onChange(({ proj, origin }) => { if (origin !== 'blockly') renderFromModel(proj); });

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
    else if (!e.isUiEvent && !muteChanges) reproject();   // muteChanges: ignore our own model→workspace rebuild
  });

  // ---- 3D preview (lightweight three.js, route from the engine trace) ----
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
    const parsed = traceToolpath(gcode); const segs = parsed.segments || parsed;
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
  const play = document.getElementById('blk-play');
  function setMode(next) {
    mode = next; t2.stop(); if (play) play.textContent = '▶ Play';
    m2d.classList.toggle('primary', mode === '2d'); m3d.classList.toggle('primary', mode === '3d');
    preview.style.display = mode === '2d' ? '' : 'none';
    host3d.style.display = mode === '3d' ? '' : 'none';
    renderViews(getProjection());
  }
  m2d.onclick = () => setMode('2d');
  m3d.onclick = () => setMode('3d');

  // ---- play / pause (2D progressive reveal, via the shared controller) ----
  play.onclick = () => {
    if (mode !== '2d') { t2.stop(); return; }
    play.textContent = t2.toggle() ? '⏸ Pause' : '▶ Play';
  };


  window.addEventListener('resize', () => { if (!root.classList.contains('hidden')) { B.svgResize(ws); renderViews(getProjection()); } });

  // Render the current program (editor-built or wizard-seeded — it already exists in the model from app start)
  // into the freshly-injected view. The editor⇄stack sync lives in programModel (wired at startup), so this tab
  // is purely a view: it never owns the program or the editor listeners.
  renderFromModel(getProjection());
  window.__blkws = ws;                            // workspace handle (tests / debugging)
  api = { refresh: () => renderFromModel(getProjection()), load: (s) => setStack(s, 'load') };
}
