/**
 * blocks/blocksApp.js — STUDIO "Blocks" tab: mounts the verified prototype engine inside the app shell.
 *
 * initBlocks() is idempotent: it builds the UI once (lazily, the first time the tab is opened), then
 * just refreshes sizing/preview on subsequent opens. All DOM lives under #blocks-app and the element
 * IDs are blk-* to avoid any document-wide collision. Same engine as the standalone blocks/blocks.html
 * prototype (wizards/ops registry + blocks/blockModel.js); the standalone page stays for engine dev.
 */
import { PALETTE, BLOCKS, CATEGORIES } from '../wizards/ops/index.js';
import { newBlock, emitMapped } from './blockModel.js';
import { parseGcode } from '../gcodeParser.js';

let api = null;   // module singleton, set once the UI is built: { refresh }

export function initBlocks() {
  const root = document.getElementById('blocks-app');
  if (!root) return;
  if (api) { api.refresh(); return; }          // already built → just refresh sizing/preview on re-open

  const program = [];
  const stage = document.getElementById('blk-stage');
  const viewport = document.getElementById('blk-viewport');
  const out = document.getElementById('blk-gcode');
  const preview = document.getElementById('blk-preview');
  const host3d = document.getElementById('blk-host3d');
  const byId = new Map();
  const leafTypes = PALETTE.filter((d) => d.kind === 'leaf').map((d) => d.type);
  const moveTypes = PALETTE.filter((d) => d.kind === 'move').map((d) => d.type);
  const allTypes = PALETTE.map((d) => d.type);                  // a Count loop can wrap any block
  const childTypesFor = (def) => def.kind === 'path' ? moveTypes : def.kind === 'loop' ? allTypes : leafTypes;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const catSlug = (c) => (c || 'Ops').toLowerCase().replace(/\s+/g, '');   // 'Mark Up' → 'markup' (used by palette + cards)
  let mode = '2d';
  const anim = { playing: false, k: 0, raf: null };
  let curSegs = [];

  // ---- palette (grouped by category) ----
  const pal = document.getElementById('blk-pal');
  CATEGORIES.forEach((cat) => {
    const defs = PALETTE.filter((def) => (def.category || 'Ops') === cat);
    if (!defs.length) return;                                  // skip empty categories (Control/Math/… for now)
    const h = document.createElement('h4'); h.className = 'cat'; h.textContent = cat;
    pal.appendChild(h);
    defs.forEach((def) => {
      const b = document.createElement('button');
      b.className = 'op-btn cat-' + catSlug(cat); b.textContent = '+ ' + def.label;   // reuse the app button
      b.addEventListener('pointerdown', (e) => startCreate(e, def.type));   // drag from palette → spawns on the canvas
      pal.appendChild(b);
    });
  });

  // ---- fields ----
  const fieldsOf = (block) => { const d = BLOCKS[block.type]; return d.fieldsFor ? d.fieldsFor(block.params) : d.fields; };
  const SELECT_OPTS = {
    pattern: ['grid', 'line', 'circle'], mode: ['rapid', 'cut', 'probe'],
    flow: ['flood', 'mist', 'off'], wcs: ['G54', 'G55', 'G56', 'G57', 'G58', 'G59'],
    dir: ['cw', 'ccw'], arc: ['ccw', 'cw'], op: ['+', '-', '*', '/', '%'],
  };
  function fieldHTML(block, key) {
    return `<label class="f"><span>${key}</span>${valueHTML(block.id, key, block.params[key])}</label>`;
  }
  // a value socket: a Reporter pill (if a reporter is plugged in) or a scalar input/select
  function valueHTML(ownerId, key, v) {
    if (v && typeof v === 'object' && v.type) return reporterHTML(v, ownerId, key);
    if (SELECT_OPTS[key]) {
      const opts = SELECT_OPTS[key].map((o) => `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('');
      return `<select data-bid="${ownerId}" data-key="${key}">${opts}</select>`;
    }
    return `<input class="f-socket" type="text" value="${esc(v)}" data-bid="${ownerId}" data-key="${key}">`;   // value socket
  }
  // a Reporter pill (rounded value block); Math is recursive — its a/b operands are themselves value sockets
  function reporterHTML(rep, ownerId, key) {
    byId.set(rep.id, rep);
    const cat = catSlug(BLOCKS[rep.type].category);
    const x = `<span class="rep-x" data-rdel="${ownerId}~${key}">×</span>`;
    if (rep.type === 'math') {
      const op = SELECT_OPTS.op.map((o) => `<option ${o === rep.params.op ? 'selected' : ''}>${o}</option>`).join('');
      return `<span class="rep cat-${cat}">${valueHTML(rep.id, 'a', rep.params.a)}<select data-bid="${rep.id}" data-key="op">${op}</select>${valueHTML(rep.id, 'b', rep.params.b)}${x}</span>`;
    }
    return `<span class="rep cat-${cat}"><input class="rep-name" value="${esc(rep.params.name)}" data-bid="${rep.id}" data-key="name">${x}</span>`;
  }

  // ---- render ----
  function blockHTML(block) {
    const def = BLOCKS[block.type];
    byId.set(block.id, block);
    const fields = fieldsOf(block).map((k) => fieldHTML(block, k)).join('');
    let kids = '';
    if (def.kind === 'container' || def.kind === 'path' || def.kind === 'loop') {
      const childCards = (block.children || []).map(blockHTML).join('');
      const addBtns = childTypesFor(def).map((t) => `<button class="add-child" data-add="${t}" data-parent="${block.id}">+ ${BLOCKS[t].label}</button>`).join('');
      kids = `<div class="children">${childCards}${addBtns}</div>`;
    }
    return `<div class="blk ${def.kind} cat-${catSlug(def.category)}" data-bid="${block.id}">
        <div class="blk-head" data-sel="${block.id}">${def.label} <small>${block.id}</small><span class="x" data-del="${block.id}">✕</span></div>
        <div class="blk-body">${fields}</div>${kids}
      </div>`;
  }
  function removeById(list, id) {
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === id) { list.splice(i, 1); return true; }
      if (list[i].children && removeById(list[i].children, id)) return true;
    }
    return false;
  }
  function render() {
    byId.clear();
    // top-level blocks are positioned cards ("stacks") on the spatial canvas; nested children stay in flow
    stage.innerHTML = program.map((b) =>
      `<div class="stack" data-stack="${b.id}" style="transform:translate(${b.x || 0}px,${b.y || 0}px)">${blockHTML(b)}</div>`
    ).join('');
    markConnections();   // tag stacked-together blocks so a snapped stack renders as one connected unit
    stage.querySelectorAll('[data-key]').forEach((inp) => inp.addEventListener('input', () => {
      const b = byId.get(inp.dataset.bid); if (!b) return;
      const k = inp.dataset.key;
      b.params[k] = inp.value;   // store raw string (number or expression) — resolved against scope at emit
      if (k === 'pattern') { render(); return; }
      reproject();
    }));
    stage.querySelectorAll('[data-add]').forEach((btn) => btn.onclick = () => {
      const p = byId.get(btn.dataset.parent); if (p) { p.children.push(newBlock(btn.dataset.add)); render(); }
    });
    stage.querySelectorAll('[data-del]').forEach((x) => x.onclick = (e) => { e.stopPropagation(); removeById(program, x.dataset.del); render(); });
    stage.querySelectorAll('[data-rdel]').forEach((x) => x.onclick = (e) => {   // pull a Reporter out of its socket → revert to 0
      e.stopPropagation(); const [oid, key] = x.dataset.rdel.split('~');
      const owner = byId.get(oid); if (owner) owner.params[key] = 0; render();
    });
    // nested child headers select on click; top-level headers drag (or select if not moved) — see DRAG section
    stage.querySelectorAll('.children [data-sel]').forEach((h) => h.onclick = () => select(h.dataset.sel, { scrollCode: true }));
    stage.querySelectorAll('.stack > .blk > .blk-head').forEach((h) => h.addEventListener('pointerdown', onDragStart));
    reproject();
  }
  function reproject() {
    const ordered = orderedProgram();                    // execution order = top-to-bottom on the canvas
    const { text, lines, map } = emitMapped(ordered);
    renderCode(lines, map);
    curSegs = segments(text);
    if (mode === '3d') update3D(text);
    else drawPreview(curSegs, anim.playing ? Math.floor(anim.k) : curSegs.length);
    applySelection();
  }

  // ---- code view + linked selection (click a block ⇄ its emitted lines) ----
  function renderCode(lines, map) {
    const frag = document.createDocumentFragment();
    lines.forEach((ln, i) => {
      const span = document.createElement('span');
      span.className = 'gl'; span.textContent = ln;
      const src = map[i];                                  // null = program-owned; else ancestry [outer…inner]
      if (src && src.length) { span.dataset.src = src.join(','); span.dataset.owner = src[src.length - 1]; }
      frag.appendChild(span);
    });
    out.replaceChildren(frag);
  }
  let selectedId = null;
  function select(id, opts = {}) { selectedId = (selectedId === id) ? null : id; applySelection(opts); }
  function clearSel() { if (selectedId) { selectedId = null; applySelection(); } }
  function applySelection(opts = {}) {
    let firstHot = null, hot = 0;
    out.querySelectorAll('.gl').forEach((sp) => {
      const src = sp.dataset.src ? sp.dataset.src.split(',') : null;
      const on = !!(selectedId && src && src.includes(selectedId));
      sp.classList.toggle('hot', on);
      if (on) { hot++; if (!firstHot) firstHot = sp; }
    });
    if (selectedId && !hot) selectedId = null;             // selection went stale (block deleted) → drop it
    out.classList.toggle('has-sel', !!selectedId);
    stage.querySelectorAll('.blk').forEach((c) => c.classList.toggle('selected', c.dataset.bid === selectedId));
    if (selectedId && firstHot && opts.scrollCode) firstHot.scrollIntoView({ block: 'nearest' });
  }
  // click a code line → select its block (empty/program lines clear)
  out.addEventListener('click', (e) => {
    const sp = e.target.closest('.gl');
    if (sp && sp.dataset.owner) select(sp.dataset.owner); else clearSel();
  });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !root.classList.contains('hidden')) clearSel(); });

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

  // ---- 3D preview (lightweight three.js, reuses parseGcode; full GcodeViz3D plugs in later) ----
  let V = null;   // { scene, cam, renderer, group, target, radius, theta, phi, fitted }
  function initThree() {
    const THREE = window.THREE; if (!THREE) return false;
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0d1117);
    const cam = new THREE.PerspectiveCamera(50, 1, 0.05, 1e6); cam.up.set(0, 0, 1);   // Z up (CNC)
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
    let a = Infinity, b = Infinity, c = Infinity, A = -Infinity, B = -Infinity, C = -Infinity;
    segs.forEach((s) => {
      const t = s.probe ? 'probe' : (s.rapid ? 'rapid' : 'feed');
      groups[t].push(s.x1, s.y1, s.z1, s.x2, s.y2, s.z2);
      a = Math.min(a, s.x1, s.x2); A = Math.max(A, s.x1, s.x2);
      b = Math.min(b, s.y1, s.y2); B = Math.max(B, s.y1, s.y2);
      c = Math.min(c, s.z1, s.z2); C = Math.max(C, s.z1, s.z2);
    });
    const cols = { rapid: 0x5a6b7d, feed: 0x33b1c9, probe: 0xe35c5c };
    for (const t in groups) {
      if (!groups[t].length) continue;
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(groups[t], 3));
      V.group.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: cols[t] })));
    }
    if (!V.fitted && isFinite(a)) {
      V.target.set((a + A) / 2, (b + B) / 2, (c + C) / 2);
      V.radius = 1.8 * Math.max(A - a, B - b, C - c, 20); V.fitted = true;
    }
    V.resize(); V.draw();
  }

  // ---- 2D / 3D toggle ----
  const m2d = document.getElementById('blk-m2d'), m3d = document.getElementById('blk-m3d');
  function setMode(next) {
    mode = next; stopAnim();
    m2d.classList.toggle('primary', mode === '2d'); m3d.classList.toggle('primary', mode === '3d');   // app's active-button class
    preview.style.display = mode === '2d' ? '' : 'none';
    host3d.style.display = mode === '3d' ? '' : 'none';
    reproject();
  }
  m2d.onclick = () => setMode('2d');
  m3d.onclick = () => setMode('3d');

  // ---- play / pause (2D progressive reveal; feed-true 3D play = GcodeViz3D later) ----
  const play = document.getElementById('blk-play');
  function stopAnim() { if (anim.playing) { anim.playing = false; cancelAnimationFrame(anim.raf); play.textContent = '▶ Play'; } }
  function animLoop() {
    if (!anim.playing) return;
    anim.k += 1.2;
    if (anim.k >= curSegs.length) anim.k = 0;   // loop
    drawPreview(curSegs, Math.floor(anim.k));
    anim.raf = requestAnimationFrame(animLoop);
  }
  play.onclick = () => {
    if (mode !== '2d') { stopAnim(); return; }
    anim.playing = !anim.playing;
    if (anim.playing) { anim.k = 0; play.textContent = '⏸ Pause'; animLoop(); }
    else { play.textContent = '▶ Play'; drawPreview(curSegs, curSegs.length); }
  };

  // ---- drag & snap: blocks are cards on a spatial canvas; drop near a block's bottom to snap into a stack ----
  const GAP = 0, SNAP_X = 150, SNAP_GAP = 40;   // GAP 0 → snapped blocks touch and render as one connected stack
  let drag = null;                                             // { sx, sy, moved, chain:[{block,el,x0,y0}] }

  /** Execution order = blocks top-to-bottom (then left-to-right) on the canvas. */
  const orderedProgram = () => [...program].sort((a, b) => (a.y || 0) - (b.y || 0) || (a.x || 0) - (b.x || 0));
  const stackEl = (id) => stage.querySelector(`.stack[data-stack="${id}"]`);
  const stackH = (id) => { const el = stackEl(id); return el ? el.getBoundingClientRect().height / scale : 120; };

  // ---- create-by-drag: drag a block out of the palette; it materialises on the canvas and lands unattached ----
  let createDrag = null, cascadeN = 0;
  const screenToStage = (cx, cy) => { const r = viewport.getBoundingClientRect(); return { x: (cx - r.left - txp) / scale, y: (cy - r.top - typ) / scale }; };
  const cascadePos = () => { const p = { x: 24 + (cascadeN % 6) * 18, y: 24 + (cascadeN % 6) * 18 }; cascadeN++; return p; };
  function startCreate(e, type) {
    if (e.button !== 0) return;
    e.preventDefault();
    if (BLOCKS[type] && BLOCKS[type].kind === 'reporter') { startReporterDrag(e, type); return; }   // reporters drop into sockets
    createDrag = { type, sx: e.clientX, sy: e.clientY, block: null };
    window.addEventListener('pointermove', onCreateMove);
    window.addEventListener('pointerup', onCreateEnd, { once: true });
  }

  // ---- reporter-drag: drag a Variable/Math pill from the palette into a value socket (not onto the canvas) ----
  let repDrag = null;
  const valueSocketAt = (cx, cy) => {
    let best = null;
    stage.querySelectorAll('input.f-socket').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) best = { bid: el.dataset.bid, key: el.dataset.key, el };
    });
    return best;
  };
  const highlightSocket = (sock) => {
    stage.querySelectorAll('input.f-socket.socket-target').forEach((el) => el.classList.remove('socket-target'));
    if (sock) sock.el.classList.add('socket-target');
  };
  function startReporterDrag(e, type) {
    repDrag = { type, ghost: null, sx: e.clientX, sy: e.clientY, lastX: e.clientX, lastY: e.clientY };
    window.addEventListener('pointermove', onRepMove);
    window.addEventListener('pointerup', onRepEnd, { once: true });
  }
  function onRepMove(e) {
    if (!repDrag) return;
    if (!repDrag.ghost) {
      if (Math.hypot(e.clientX - repDrag.sx, e.clientY - repDrag.sy) < 4) return;   // threshold: a click does nothing
      const g = document.createElement('div'); g.className = 'rep-ghost'; g.textContent = BLOCKS[repDrag.type].label;
      document.body.appendChild(g); repDrag.ghost = g;
    }
    repDrag.lastX = e.clientX; repDrag.lastY = e.clientY;
    repDrag.ghost.style.left = (e.clientX + 10) + 'px'; repDrag.ghost.style.top = (e.clientY + 10) + 'px';
    highlightSocket(valueSocketAt(e.clientX, e.clientY));
  }
  function onRepEnd() {
    window.removeEventListener('pointermove', onRepMove);
    if (!repDrag) return;
    let did = false;
    if (repDrag.ghost) {
      const sock = valueSocketAt(repDrag.lastX, repDrag.lastY);
      if (sock && byId.get(sock.bid)) { byId.get(sock.bid).params[sock.key] = newBlock(repDrag.type); did = true; }   // plug in
      repDrag.ghost.remove();
    }
    highlightSocket(null); repDrag = null;
    if (did) render();
  }
  function onCreateMove(e) {
    if (!createDrag) return;
    if (!createDrag.block) {
      if (Math.hypot(e.clientX - createDrag.sx, e.clientY - createDrag.sy) < 5) return;   // threshold: distinguish a click
      const nb = newBlock(createDrag.type);
      const p = screenToStage(e.clientX, e.clientY); nb.x = p.x - 36; nb.y = p.y - 12;     // cursor grabs the header
      program.push(nb); createDrag.block = nb; render();
    }
    const nb = createDrag.block, p = screenToStage(e.clientX, e.clientY);
    nb.x = p.x - 36; nb.y = p.y - 12;
    const el = stackEl(nb.id); if (el) el.style.transform = `translate(${nb.x}px,${nb.y}px)`;
    createDrag.lastX = e.clientX; createDrag.lastY = e.clientY;
    highlightMouth(mouthTargetFor([{ block: nb }], e.clientX, e.clientY)?.el || null);
  }
  function onCreateEnd() {
    window.removeEventListener('pointermove', onCreateMove);
    if (!createDrag) return;
    if (!createDrag.block) {                              // a click (no drag) → still spawn, unattached, at a cascade spot
      const nb = newBlock(createDrag.type), p = cascadePos(); nb.x = p.x; nb.y = p.y; program.push(nb);
    } else {
      const mouth = mouthTargetFor([{ block: createDrag.block }], createDrag.lastX, createDrag.lastY);
      if (mouth) nestInto(mouth.wid, [createDrag.block]);   // dropped into a wrapper's mouth → nest it
    }
    highlightMouth(null); createDrag = null; render();    // else dropped unattached — no auto-snap on create
  }

  /** The grabbed block plus the contiguous chain snapped below it (same column, touching) — they drag together. */
  function chainFrom(head) {
    const sorted = orderedProgram(), start = sorted.indexOf(head), chain = [];
    let prevBottom = null;
    for (let j = start; j < sorted.length; j++) {
      const b = sorted[j];
      if (j > start && (Math.abs((b.x || 0) - (head.x || 0)) > SNAP_X || Math.abs((b.y || 0) - prevBottom) > SNAP_GAP)) break;
      chain.push({ block: b, el: stackEl(b.id), x0: b.x || 0, y0: b.y || 0 });
      prevBottom = (b.y || 0) + stackH(b.id);
    }
    return chain;
  }

  function onDragStart(e) {
    if (e.button !== 0 || e.target.closest('.x, input, select, button, .add-child')) return;
    const block = byId.get(e.currentTarget.closest('.stack').dataset.stack); if (!block) return;
    drag = { sx: e.clientX, sy: e.clientY, moved: false, chain: chainFrom(block) };
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragEnd, { once: true });
  }
  function onDragMove(e) {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return;   // threshold: keep clicks as selects
    drag.moved = true; drag.lastX = e.clientX; drag.lastY = e.clientY;
    const dx = (e.clientX - drag.sx) / scale, dy = (e.clientY - drag.sy) / scale;
    drag.chain.forEach((c) => { c.block.x = c.x0 + dx; c.block.y = c.y0 + dy; if (c.el) c.el.style.transform = `translate(${c.block.x}px,${c.block.y}px)`; });
    drag.chain[0].el?.classList.add('dragging');
    const mouth = mouthTargetFor(drag.chain, e.clientX, e.clientY);
    if (mouth) { highlightMouth(mouth.el); highlightSnap(null); }        // over a wrapper mouth → nest, not snap
    else { highlightMouth(null); highlightSnap(snapTargetFor(drag.chain)); }
  }
  function onDragEnd() {
    window.removeEventListener('pointermove', onDragMove);
    if (!drag) return;
    if (drag.moved) {
      const mouth = mouthTargetFor(drag.chain, drag.lastX, drag.lastY);
      if (mouth) {
        nestInto(mouth.wid, drag.chain.map((c) => c.block));            // body socket: nest the chain into the wrapper
      } else {
        const tgt = snapTargetFor(drag.chain);
        if (tgt) { const ddx = tgt.x - drag.chain[0].block.x, ddy = tgt.y - drag.chain[0].block.y;
          drag.chain.forEach((c) => { c.block.x += ddx; c.block.y += ddy; }); }   // snap whole chain under the target
      }
      highlightSnap(null); highlightMouth(null); drag = null; render();
    } else { const id = drag.chain[0].block.id; drag = null; select(id, { scrollCode: true }); }   // it was a click
  }

  /** Snap point: under the nearest non-chain block when the chain head is dropped onto its lower half or
   *  just below it (forgiving, Codeblocks-style). Returns the resting {x,y} for the chain head, or null. */
  function snapTargetFor(chain) {
    const head = chain[0].block, ids = new Set(chain.map((c) => c.block.id));
    let best = null, bestScore = Infinity;
    program.forEach((a) => {
      if (ids.has(a.id)) return;
      const aH = stackH(a.id), aBottom = (a.y || 0) + aH;
      const dx = Math.abs((a.x || 0) - (head.x || 0));
      const dyb = (head.y || 0) - aBottom;                 // +below the target, −overlapping it
      if (dx < SNAP_X && dyb > -aH * 0.6 && dyb < SNAP_GAP) {
        const score = Math.abs(dyb) + dx;
        if (score < bestScore) { best = { id: a.id, x: a.x || 0, y: aBottom + GAP }; bestScore = score; }
      }
    });
    return best;
  }
  function highlightSnap(tgt) {
    stage.querySelectorAll('.stack.snap-target').forEach((el) => el.classList.remove('snap-target'));
    if (tgt) stackEl(tgt.id)?.classList.add('snap-target');
  }
  // ---- body sockets: drop a block into a wrapper's mouth (its .children) to nest it ----
  function mouthTargetFor(chain, cx, cy) {
    const ids = new Set(chain.map((c) => c.block.id));
    let best = null;
    stage.querySelectorAll('.stack > .blk.container > .children, .stack > .blk.loop > .children, .stack > .blk.path > .children')
      .forEach((mouth) => {
        const wid = mouth.closest('.stack').dataset.stack;
        if (ids.has(wid)) return;                         // can't drop a block into itself
        const r = mouth.getBoundingClientRect();
        if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) best = { wid, el: mouth };
      });
    return best;
  }
  function highlightMouth(el) {
    stage.querySelectorAll('.children.mouth-target').forEach((m) => m.classList.remove('mouth-target'));
    if (el) el.classList.add('mouth-target');
  }
  /** Move blocks out of wherever they are and append them to a wrapper's children (the body socket). */
  function nestInto(wid, blocks) {
    const wrapper = byId.get(wid); if (!wrapper) return;
    blocks.forEach((b) => removeById(program, b.id));
    (wrapper.children || (wrapper.children = [])).push(...blocks);
  }
  /** Tag blocks that sit directly on top of one another so a snapped stack renders as one connected unit. */
  function markConnections() {
    const sorted = orderedProgram();
    sorted.forEach((b) => stackEl(b.id)?.classList.remove('conn-top', 'conn-bottom'));
    for (const a of sorted) {
      const aBottom = (a.y || 0) + stackH(a.id);
      for (const b of sorted) {
        if (b === a) continue;
        if (Math.abs((b.x || 0) - (a.x || 0)) < SNAP_X && Math.abs((b.y || 0) - aBottom) < 4) {
          stackEl(a.id)?.classList.add('conn-bottom');
          stackEl(b.id)?.classList.add('conn-top');
        }
      }
    }
  }

  // ---- pan / zoom of the block canvas ----
  let txp = 0, typ = 0, scale = 1, panning = false, sx = 0, sy = 0;
  const apply = () => { stage.style.transform = `translate(${txp}px,${typ}px) scale(${scale})`; };
  viewport.addEventListener('pointerdown', (e) => { if (e.target.closest('.blk')) return; clearSel(); panning = true; sx = e.clientX - txp; sy = e.clientY - typ; viewport.classList.add('panning'); viewport.setPointerCapture(e.pointerId); });
  viewport.addEventListener('pointermove', (e) => { if (panning) { txp = e.clientX - sx; typ = e.clientY - sy; apply(); } });
  viewport.addEventListener('pointerup', () => { panning = false; viewport.classList.remove('panning'); });
  viewport.addEventListener('wheel', (e) => { e.preventDefault(); const r = viewport.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top, nx = (px - txp) / scale, ny = (py - typ) / scale; scale = Math.min(2.5, Math.max(0.3, scale * (e.deltaY < 0 ? 1.1 : 1 / 1.1))); txp = px - nx * scale; typ = py - ny * scale; apply(); }, { passive: false });
  window.addEventListener('resize', () => { if (!root.classList.contains('hidden')) reproject(); });

  // ---- start empty: the user builds the stack from the palette ----
  render(); apply();

  api = { refresh: reproject };
}
