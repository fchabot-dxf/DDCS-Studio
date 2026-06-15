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
import { createPreviewPanel } from '../viz/createPreviewPanel.js';   // THE shared preview (2D+3D+engine+trail+stock), same in all 3 hosts
import { getCaps, resolveActivePost } from '../wizards/dialects/index.js';
import { getActiveProfile } from '../shared/js/profiles/controllerProfiles.js';

// Heads-up on op-container blocks the active post can't fully run: gating is PER LINE (emit comments out the
// non-runnable lines — see the G-code panel), so we DON'T grey the whole op (that would overstate a partial
// gate); just attach a native ⚠ comment naming the missing caps. The op stays in the stack (kept record);
// re-evaluated on every render, so switching post updates it in place.
function applyOpGating(ws) {
    const post = resolveActivePost(getActiveProfile().id), caps = getCaps(post.id);
    const has = (r) => (r === 'flow' ? caps.flow !== 'none' : caps[r] !== false);
    for (const b of ws.getAllBlocks(false)) {
        if (b.type !== 'op') continue;
        let meta = {}; try { meta = JSON.parse(b.data || '{}'); } catch (_) { /* keep {} */ }
        const unmet = (meta.requires || []).filter((r) => !has(r));
        try { b.setWarningText(unmet.length ? `Some lines aren't run on ${post.name} (no ${unmet.join(' / ')}) — see the commented lines in the G-code.` : null); } catch (_) { /* older Blockly */ }
    }
}

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
    if (getStack().length) {
      // The program already has content (e.g. accumulated wizard inserts) — render the WHOLE program; don't
      // replace it with just the last previewed op (that was the "only one of two inserts shows" bug).
      if (api) api.refresh();
    } else {
      const r = ops.buildActiveOpStack();                // empty program → open the just-previewed op as blocks
      if (r) setStack(r.blocks, 'load');                 // (a fresh STUDIO op → render it: model + views)
      else if (api) api.refresh();
    }
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
  // THE shared preview panel — identical to Studio main + the wizards (same code + UI); fed the projected program.
  const panel = createPreviewPanel(document.getElementById('blk-preview-panel'), { getGcode: () => getProjection().text });

  // Grid lines follow the theme's border tone (best-effort: the grid colour is an inject option, so it's set
  // once here; the rest of the chrome re-skins live via setTheme below).
  const gridColour = (() => { try { return getComputedStyle(document.body).getPropertyValue('--border').trim() || '#1b2733'; } catch (_) { return '#1b2733'; } })();
  const ws = B.inject(host, {
    toolbox: buildToolbox(), theme: ddcsTheme(B), renderer: 'geras',
    grid: { spacing: 26, length: 2, colour: gridColour, snap: true },
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
    panel.setGcode(p.text);
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
    try { stackToWorkspace(getStack(), ws); applyOpGating(ws); } finally { muteChanges = false; }   // gate gated ops (muted: no echo)
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

  // (2D/3D toggle, Play/Step/Loop, stock, trail — all owned by the shared preview panel now.)

  window.addEventListener('resize', () => { if (!root.classList.contains('hidden')) { B.svgResize(ws); renderViews(getProjection()); } });

  // Re-skin the Blockly chrome (canvas / toolbox / flyout / glow) when the app theme switches. applyTheme()
  // just sets body[data-theme] with no event, so observe the attribute (same pattern as commandDeck).
  try {
    new MutationObserver(() => { try { ws.setTheme(ddcsTheme(B)); } catch (_) { /* */ } })
      .observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
  } catch (_) { /* */ }

  // ---- mobile drawers (CSS-gated ≤860px; harmless no-ops on desktop) ----
  // Canvas fills the tab; Preview = bottom drawer (G-code behind its toggle), palette = left drawer over canvas.
  // Preview drawer translates (keeps its size off-screen) → re-render on open. Palette uses the toolbox's own
  // setVisible() so the canvas actually reclaims the width when collapsed.
  (function wireDrawers() {
    const right = root.querySelector('.right');
    const handle = document.getElementById('blkDrawerHandle');
    const closeBtn = document.getElementById('blkDrawerClose');
    const segPv = document.getElementById('blkSegPv');
    const segCode = document.getElementById('blkSegCode');
    const toolsHandle = document.getElementById('blkToolsHandle');
    if (!right) return;

    const refit = () => { try { panel.setActive(true); panel.refresh(); } catch (_) { /* */ } };
    const openPv = (on) => { right.classList.toggle('open', on); if (handle) handle.setAttribute('aria-expanded', String(on)); if (on) setTimeout(refit, 260); };
    handle && handle.addEventListener('click', () => openPv(true));
    closeBtn && closeBtn.addEventListener('click', () => openPv(false));

    const showPane = (code) => {
      right.classList.toggle('show-code', code);
      segPv && segPv.classList.toggle('on', !code);
      segCode && segCode.classList.toggle('on', code);
      if (!code) setTimeout(refit, 60);                 // back to Preview → re-fit the now-visible canvas
    };
    segPv && segPv.addEventListener('click', () => showPane(false));
    segCode && segCode.addEventListener('click', () => showPane(true));

    // Drag the top edge to resize the preview drawer. Height lives in --blk-pv-h (only the mobile rule reads it,
    // so desktop is untouched) and persists across sessions.
    const resizeStrip = right.querySelector('.blk-drawer-resize');
    if (resizeStrip) {
      try { const h = parseInt(localStorage.getItem('ddcs_blk_pv_h'), 10); if (h > 0) right.style.setProperty('--blk-pv-h', h + 'px'); } catch (_) { /* */ }
      let dragging = false;
      const onMove = (e) => {
        if (!dragging) return;
        const y = e.touches ? e.touches[0].clientY : e.clientY;
        const h = Math.max(160, Math.min(Math.round(window.innerHeight * 0.9), window.innerHeight - y));
        right.style.setProperty('--blk-pv-h', h + 'px');
      };
      const onUp = () => {
        if (!dragging) return;
        dragging = false;
        window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp);
        try { localStorage.setItem('ddcs_blk_pv_h', parseInt(right.style.getPropertyValue('--blk-pv-h'), 10) || ''); } catch (_) { /* */ }
        refit();   // re-fit the preview to the new drawer height
      };
      resizeStrip.addEventListener('pointerdown', (e) => {
        dragging = true; e.preventDefault();
        window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
      });
    }

    // Palette (Blockly toolbox) as a left drawer. Collapse via the toolbox's OWN setVisible() so the canvas
    // truly reclaims the width (display:none → getWidth()=0); a CSS translate alone would leave a dead strip.
    const tbx = () => { try { return ws.getToolbox(); } catch (_) { return null; } };
    const setToolsOpen = (on) => {
      const tb = tbx(); if (!tb) return;
      try { tb.setVisible(on); } catch (_) { /* */ }
      if (on) {                                          // measure the now-visible toolbox so the close tab parks at its edge
        let w = 0; try { w = Math.round(tb.getWidth()); } catch (_) { /* */ }   // Blockly API (authoritative)
        if (!w) { const t = host.querySelector('.blocklyToolbox'); if (t) w = Math.round(t.getBoundingClientRect().width); }
        if (w) root.style.setProperty('--blk-tbx-w', w + 'px');
      } else { try { tb.clearSelection(); } catch (_) { /* collapse any open flyout */ } }
      root.classList.toggle('tools-open', on);
      if (toolsHandle) { toolsHandle.setAttribute('aria-expanded', String(on)); toolsHandle.textContent = on ? '✕' : 'Blocks'; }
      try { B.svgResize(ws); } catch (_) { /* recompute metrics: canvas grows/shrinks by the toolbox width */ }
    };
    toolsHandle && toolsHandle.addEventListener('click', () => setToolsOpen(!root.classList.contains('tools-open')));

    // Breakpoint behaviour: ≤860px → palette starts COLLAPSED (canvas full); desktop → toolbox always shown.
    const mq = window.matchMedia('(max-width: 860px)');
    const applyBreakpoint = (mobile) => {
      const tb = tbx(); if (!tb) return;
      root.classList.remove('tools-open');
      if (toolsHandle) { toolsHandle.setAttribute('aria-expanded', 'false'); toolsHandle.textContent = 'Blocks'; }
      try { tb.clearSelection(); } catch (_) { /* */ }
      try { tb.setVisible(!mobile); } catch (_) { /* mobile → collapsed (canvas full); desktop → shown */ }
      try { B.svgResize(ws); } catch (_) { /* */ }
    };
    applyBreakpoint(mq.matches);
    if (mq.addEventListener) mq.addEventListener('change', (e) => applyBreakpoint(e.matches));
    else if (mq.addListener) mq.addListener((e) => applyBreakpoint(e.matches));
  })();

  // Render the current program (editor-built or wizard-seeded — it already exists in the model from app start)
  // into the freshly-injected view. The editor⇄stack sync lives in programModel (wired at startup), so this tab
  // is purely a view: it never owns the program or the editor listeners.
  renderFromModel(getProjection());
  panel.setActive(true);                          // mark the preview active + initial render (tab is now visible)
  window.__blkws = ws;                            // workspace handle (tests / debugging)
  window.__blkPanel = panel;                      // preview panel handle (tests / debugging)
  api = { refresh: () => { panel.setActive(true); renderFromModel(getProjection()); }, load: (s) => setStack(s, 'load') };
}
