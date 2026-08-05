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
import { PALETTE, BLOCKS } from '../wizards/ops/index.js';   // for the palette search filter + suggestion inserts
import { newBlock } from './blockEmitter.js';
import { suggestNext, recordProgram } from './suggest.js';   // next-block suggestions
import { workspaceToStack, stackToWorkspace } from './blockly/stackBridge.js';
import { ddcsTheme } from './blockly/theme.js';
import { setStack, getStack, getProjection, onChange } from './programModel.js';   // blocks = a VIEW of the shared program model
import { mountDevMode, deriveAuthoredDef, editingWizardType, writeAuthoredValue } from './devMode.js';   // authoring: derive the live def + write form values back
import { isStructCtlType, SC_PARAM } from '../wizards/ops/structCtl.js';   // t154 — structural-control blocks drive the op's guards → live reprune
import { renderOpForm, formBindings, renderUiTree } from '../ui/formWidgets.js';   // render the wizard's form from bindings (the live block→form view); S5.2 — param_field rows when present; renderUiTree for block layouts
import { learnerToolboxCategories } from '../data/learnerLibrary.js';   // curated Snippets / Complete Programs toolbox groups
import { opToolboxCategories } from './opToolbox.js';   // t1315 — the REGISTERED wizard families, derived from the op registry
import { getUserDef } from './userOps.js';
import { isOpBlockEdited, valueTokenRanges, valueRangesForSubtree } from './opGlow.js';   // op-edit guard + word-level value-token spans (hover/select highlight)
import { recordEdit } from './opEdits.js';   // DECLARE a block edit when its change event fires (vs inferring it by re-derivation)
import { createPreviewPanel } from '../viz/createPreviewPanel.js';   // THE shared preview (2D+3D+engine+trail+stock), same in all 3 hosts
import { applyProgramIntent } from '../viz/opSimContext.js';          // t756 — the WHOLE-PROGRAM declared render-intent seam (seat / machine-frame / rig), shared with the editor preview
import { opSimStarts } from '../viz/opSimStarts.js';                  // t756 — the DECLARED per-op start source (retires the legacy inferStart)
import { getCaps, resolveActivePost } from '../wizards/dialects/index.js';
import { getActiveProfile } from '../shared/js/profiles/controllerProfiles.js';
// t756 (R-C) — the legacy WIZARDS[type].inferStart start-source is retired: the Blocks preview now reads the DECLARED
// opSimStarts (blkStartHints below), the same source as the editor + wizard previews. The CornerWizard/… imports that
// only fed inferStart are gone with it.

// Find a model record by block id in the shared stack (records: { id, params, children }) — used to map a hovered
// Blockly leaf back to its param keys for value-token highlighting.
function findModelById(stack, id) {
    for (const b of (stack || [])) { if (!b) continue; if (b.id === id) return b; const f = findModelById(b.children, id); if (f) return f; }
    return null;
}

// Heads-up on op-container blocks the active post can't fully run: gating is PER LINE (emit comments out the
// non-runnable lines — see the G-code panel), so we DON'T grey the whole op (that would overstate a partial
// gate); just attach a native ⚠ comment naming the missing caps. The op stays in the stack (kept record);
// re-evaluated on every render, so switching post updates it in place.
// t788 rider — the op block's SIM mouth is redundant for MOST ops (the sim declarations live in the user-op
// Presentation section now); show it ONLY when it actually holds a declared sim override, else hide the socket AND its
// "SIM" label row. setVisible (NOT removeInput) keeps the connection, so workspaceToStack still reads any child →
// round-trip + emit/sim byte-identical. Adaptive: re-run on every load + structural change (a sim block plugged/pulled).
function syncSimSocket(b) {
    const sim = b.getInput && b.getInput('SIM'); if (!sim) return;
    // t788/t819 — the op block's SIM mouth is redundant for MOST ops (the sim declarations live in the user-op Presentation
    // section now); show it ONLY when it actually holds SIM content (an authored child plugged in). Every no-override op
    // (pocket, …) with an empty SIM mouth hides the socket AND its "SIM" label. setVisible (NOT removeInput) keeps the
    // connection → round-trip + emit/sim byte-identical. The ATC change's sim-OVERRIDE is a declared function (def.simGcode,
    // applied at PREVIEW via getUserSimGcode), not a SIM block, so it needs no socket — the override still shows + round-trips.
    const has = !!(sim.connection && sim.connection.targetBlock());
    if (sim.isVisible && sim.isVisible() === has) return;   // already in the right state
    try { sim.setVisible(has); const lbl = b.getInput('SIM_LBL'); if (lbl) lbl.setVisible(has); if (b.rendered && b.render) b.render(); } catch (_) { /* older Blockly */ }
}

function applyOpGating(ws) {
    const post = resolveActivePost(getActiveProfile().id), caps = getCaps(post.id);
    const dl = { id: post.id, name: post.name, caps };   // dialect-shaped for an atom's gate() predicate
    const has = (r) => (r === 'flow' ? caps.flow !== 'none' : caps[r] !== false);
    for (const b of ws.getAllBlocks(false)) {
        if (b.type === 'op' || (typeof b.type === 'string' && b.type.endsWith('_op'))) syncSimSocket(b);   // hide the empty SIM mouth
        if (b.type === 'op') {                              // op CONTAINER: per-line caps gate → ⚠ (don't grey the whole op)
            let meta = {}; try { meta = JSON.parse(b.data || '{}'); } catch (_) { /* keep {} */ }
            const unmet = (meta.requires || []).filter((r) => !has(r));
            try { b.setWarningText(unmet.length ? `Some lines aren't run on ${post.name} (no ${unmet.join(' / ')}) — see the commented lines in the G-code.` : null); } catch (_) { /* older Blockly */ }
            continue;
        }
        const def = BLOCKS[b.type];                         // controller-specific leaf atom → grey it + why (field-gating style)
        if (def && typeof def.gate === 'function') {
            let reason = null; try { reason = def.gate(dl); } catch (_) { /* */ }
            try { b.setWarningText(reason ? `Not on ${post.name} — ${reason}.` : null); } catch (_) { /* */ }
            try { b.setEnabled(!reason); } catch (_) { /* older Blockly */ }
        }
    }
}

let api = null;            // module singleton, set once the workspace is built: { refresh, load }
let _ops = null;           // captured opSession module reference for interceptors
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
    const ops = await import('./opSession.js');
    if (_ops === null) _ops = ops;
    
    if (getStack().length) {
      // The program already has content (e.g. accumulated wizard inserts) — render the WHOLE program; don't
      // replace it with just the last previewed op (that was the "only one of two inserts shows" bug).
      // Route through api.refresh() (= renderFromModel(getProjection()) + panel.setActive): renderFromModel is a
      // buildWorkspace closure-local — not visible here at module scope — AND needs the projection arg this path
      // lacked. `await initBlocks()` above guarantees `api` is set on the non-empty branch.
      if (api) api.refresh();
    } else {
      // The model is empty (fresh tab click), seed it with whatever active op the UI is focused on.
      ops.previewActiveOp();
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
  // which aborted the async render queue and left the canvas blank. The app no longer CSS-zooms <body>, so the
  // popups are fine on <body> where Blockly puts them by default — same as our working reference Blockly app,
  // which never calls setParentContainer.

  const wsHost = document.getElementById('blk-ws');
  // A top bar (search + suggestion strip) ABOVE the Blockly workspace, so neither overlaps the toolbox/canvas
  // (Blockly's toolbox resists CSS padding + creates its own stacking context). Blockly injects into the host below.
  const topbar = document.createElement('div'); topbar.className = 'blk-topbar';
  const host = document.createElement('div'); host.className = 'blk-bk-host';
  wsHost.append(topbar, host);
  const out = document.getElementById('blk-gcode') || document.createElement('div');
  // t756 (R-C) — per-pass sim-start HINTS from the DECLARED source (opSimStarts), read off the whole block program —
  // the SAME registry the editor + wizard previews use, so the Blocks preview seats each pass identically. Retires the
  // legacy WIZARDS[type].inferStart start-source (the imperative per-wizard guess).
  const blkStartHints = () => {
    const stock = (window.ddcsGetSettings && window.ddcsGetSettings().stock) || null;
    const hints = [];
    for (const b of (getStack() || [])) {
      if (!b || b.type !== 'op' || !b.opType) continue;
      const h = opSimStarts(b.opType, b.params || {}, stock);
      if (Array.isArray(h) && h.length) hints.push(...h);
    }
    return hints.length ? hints : null;
  };
  // THE shared preview panel — identical to Studio main + the wizards (same code + UI); fed the projected program.
  const blkPanelHost = document.getElementById('blk-preview-panel');
  const panel = blkPanelHost ? createPreviewPanel(blkPanelHost, {
    getGcode: () => getProjection().text,
    // The DECLARED start source (opSimStarts) — pass 0 begins at the inferred start, matching the editor + wizard.
    getStart: () => (blkStartHints() || [])[0] || null,
    getStartHints: blkStartHints,
    // Route the sim's EXECUTING line to the projected G-code view: glow the emitting line (+ a fading comet-tail),
    // mirroring the read-only editor panel — so watching a run in the Blocks tab lights the very code the blocks emit.
    onLine: (i) => setExecLine(i),
  }) : { setGcode: () => {}, setActive: () => {}, refresh: () => {}, setHighlights: () => {}, draw: () => {} };
  if (blkPanelHost) blkPanelHost.__panel = panel;   // expose for inspection/tests (mirrors wizardManager's host.__panel)

  // Grid lines follow the theme's border tone (best-effort: the grid colour is an inject option, so it's set
  // once here; the rest of the chrome re-skins live via setTheme below).
  const gridColour = (() => { try { return getComputedStyle(document.body).getPropertyValue('--border').trim() || '#1b2733'; } catch (_) { return '#1b2733'; } })();
  const ws = B.inject(host, {
    // t1315 — the rail reads Atoms · Wizards · Snippets · Programs. The Wizards group is DERIVED from the federated
    // op registry, so a newly registered twin appears without an edit here or anywhere else.
    toolbox: buildToolbox([...opToolboxCategories(), ...learnerToolboxCategories()]), theme: ddcsTheme(B), renderer: 'geras', collapse: true,
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

  // t134 — MIDDLE mouse button ALWAYS pans (Blocks-tab item f). Blockly v13 decides drag-vs-pan by WHAT is under the pointer
  // (a movable block → drag), not by which button — so a middle-drag STARTING over a block would try to grab it instead of
  // panning. Intercept button 1 in the CAPTURE phase on the injection host (fires before Blockly's per-block gesture claims
  // the pointerdown → stopPropagation keeps the block still) and drive ws.scroll directly. LMB (button 0 = block drag) and
  // RMB (button 2 = context menu) are untouched — the guard returns immediately for any non-middle button.
  (function middlePan() {
    let sx = 0, sy = 0, ox = 0, oy = 0, active = false;
    const onMove = (ev) => { if (!active) return; try { ws.scroll(ox + (ev.clientX - sx), oy + (ev.clientY - sy)); } catch (_) { /* pre-render */ } };
    const onUp = () => { active = false; window.removeEventListener('pointermove', onMove, true); window.removeEventListener('pointerup', onUp, true); };
    host.addEventListener('pointerdown', (e) => {
      if (e.button !== 1) return;                          // ONLY the middle button; LMB/RMB fall through to Blockly
      e.preventDefault(); e.stopPropagation();             // preempt Blockly's gesture + the browser's autoscroll puck
      sx = e.clientX; sy = e.clientY; active = true;
      try { ox = ws.scrollX; oy = ws.scrollY; } catch (_) { ox = 0; oy = 0; }
      window.addEventListener('pointermove', onMove, true);
      window.addEventListener('pointerup', onUp, true);
    }, true);                                              // CAPTURE — beat Blockly's block-level pointerdown
  })();

  // Authoring is always on (no normal/dev toggle): mountDevMode grows each atom's "expose as knob" affordances + the
  // persistent "Save wizard…" button, and re-augments after every model-driven rebuild (renderFromModel) via onModelRender.
  const _dev = mountDevMode(ws, B, host);

  // ---- Palette search: a filter input above the toolbox. Typing shows the matching blocks (across ALL
  //      categories) in the flyout; clearing restores the normal category flyout. ----
  const search = document.createElement('input');
  search.type = 'search'; search.className = 'blk-search'; search.placeholder = 'Search blocks…';
  search.setAttribute('aria-label', 'Search blocks');
  topbar.appendChild(search);
  const flyout = () => { try { return ws.getToolbox().getFlyout(); } catch (_) { return null; } };
  const runSearch = () => {
    const q = search.value.trim().toLowerCase();
    const tb = (() => { try { return ws.getToolbox(); } catch (_) { return null; } })();
    const fl = flyout(); if (!tb || !fl) return;
    if (!q) { try { tb.clearSelection(); fl.hide(); } catch (_) { /* */ } return; }
    const hits = PALETTE
      .filter((d) => !d.hidden && `${d.label || ''} ${d.type} ${d.category || ''}`.toLowerCase().includes(q))   // t903 — hidden atoms (safetraverse until P2.5) are not droppable from search either
      .map((d) => ({ kind: 'block', type: d.type }));
    try { tb.clearSelection(); fl.show(hits.length ? hits : [{ kind: 'label', text: 'No matching blocks' }]); } catch (_) { /* */ }
  };
  search.addEventListener('input', runSearch);
  search.addEventListener('search', runSearch);   // the ✕ clear button fires 'search'
  window.__blkWs = ws;   // debug/test accessor

  // ---- Suggested-next strip (A): chips for the most-likely next blocks (learned from your programs + a curated
  //      seed); click to append. Updates as the program changes. ----
  const STMT = new Set(PALETTE.filter((d) => d.kind !== 'reporter' && !d.hidden).map((d) => d.type));   // insertable (no reporters; t903 — no hidden atoms like safetraverse until P2.5)
  const labelOf = (t) => (BLOCKS[t] && BLOCKS[t].label) || t;
  const catSlugOf = (t) => ((BLOCKS[t] && BLOCKS[t].category) || 'ops').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const strip = document.createElement('div');
  strip.className = 'blk-suggest';
  topbar.appendChild(strip);
  const lastType = (stack) => {
    const flat = (stack || []).filter((b) => b && b.type !== 'progstart' && b.type !== 'progend');
    const b = flat[flat.length - 1];
    return b ? (b.type === 'op' ? (b.opType || 'op') : b.type) : 'progstart';
  };
  const insertSuggestion = (type) => {
    const def = BLOCKS[type]; if (!def) return;
    const blk = newBlock(type); blk.params = { ...(def.defaults || {}) };
    const cur = (window.ddcsGetBlockProgram && window.ddcsGetBlockProgram()) || [];
    const endIdx = cur.findIndex((b) => b && b.type === 'progend');
    const next = endIdx >= 0 ? [...cur.slice(0, endIdx), blk, ...cur.slice(endIdx)] : [...cur, blk];
    if (window.ddcsLoadBlockStack) window.ddcsLoadBlockStack(next);
  };
  const suggestionsOn = () => { try { return window.ddcsGetSettings().compose.suggestions !== false; } catch (_) { return true; } };
  const updateStrip = (stack) => {
    const hits = suggestionsOn() ? suggestNext(lastType(stack), 5, STMT) : [];   // Settings → Composing toggle
    strip.innerHTML = hits.map((t) => `<button class="blk-sug-chip cat-${catSlugOf(t)}" data-type="${t}" type="button" title="Add ${labelOf(t)}">${labelOf(t)}</button>`).join('');
    strip.style.display = hits.length ? '' : 'none';
    strip.querySelectorAll('.blk-sug-chip').forEach((c) => c.addEventListener('click', () => insertSuggestion(c.dataset.type)));
  };
  onChange(({ stack }) => { recordProgram(stack); updateStrip(stack); });
  window.addEventListener('ddcs:settings-changed', () => updateStrip(getStack()));   // toggle on/off live
  updateStrip(getStack());

  // ---- Inline suggestion float (B): a small floating box of the most-likely next blocks, anchored under the last
  //      block on the canvas — same look as the Studio editor autocomplete. Click an option to insert; Tab takes
  //      the first. Gated by Settings → Editor (compose.ghost); fed by the SAME bigram model as the chip strip. ----
  const sugFloat = document.createElement('div');
  sugFloat.className = 'blk-sug-float'; sugFloat.hidden = true;
  host.appendChild(sugFloat);
  let floatTypes = [];                                   // current options in order (floatTypes[0] = Tab target)
  const floatOn = () => { try { return window.ddcsGetSettings().compose.ghost !== false; } catch (_) { return true; } };
  const hideFloat = () => { sugFloat.hidden = true; floatTypes = []; };
  const anchorBlock = () => {                            // bottom-most block of the main stack (above a trailing progend)
    try {
      const tops = ws.getTopBlocks(true);
      let b = tops.find((t) => t.type === 'progstart') || tops[0]; if (!b) return null;
      let n; while ((n = b.getNextBlock())) b = n;
      if (b.type === 'progend') b = b.getPreviousBlock() || b;
      return b;
    } catch (_) { return null; }
  };
  const updateFloat = () => {
    if (!floatOn()) return hideFloat();
    const hits = suggestNext(lastType(getStack()), 4, STMT);
    if (!hits.length) return hideFloat();
    floatTypes = hits;
    sugFloat.innerHTML = hits.map((t, i) =>
      `<button class="blk-sug-opt cat-${catSlugOf(t)}" data-type="${t}" type="button" title="Add ${labelOf(t)}">`
      + `${labelOf(t)}${i === 0 ? '<kbd>Tab</kbd>' : ''}</button>`).join('');
    try {
      const hr = host.getBoundingClientRect();
      const anchor = anchorBlock();
      if (anchor) {                                                    // under the last block on the canvas
        const r = anchor.getSvgRoot().getBoundingClientRect();
        if (r.bottom < hr.top || r.top > hr.bottom) return hideFloat();   // anchor scrolled out of view
        sugFloat.style.left = Math.max(4, r.left - hr.left) + 'px';
        sugFloat.style.top = (r.bottom - hr.top + 6) + 'px';
      } else {                                                         // empty program → right of the toolbox, where the first block lands
        let tbW = 0; try { tbW = ws.getToolbox() ? ws.getToolbox().getWidth() : 0; } catch (_) { /* */ }
        sugFloat.style.left = (tbW + 18) + 'px'; sugFloat.style.top = '22px';
      }
      sugFloat.hidden = false;
      const maxL = host.clientWidth - sugFloat.offsetWidth - 6;        // keep the box inside the canvas
      if (parseFloat(sugFloat.style.left) > maxL) sugFloat.style.left = Math.max(4, maxL) + 'px';
    } catch (_) { return hideFloat(); }
    sugFloat.querySelectorAll('.blk-sug-opt').forEach((b) => b.addEventListener('click', () => insertSuggestion(b.dataset.type)));
  };
  let floatRaf = 0;
  const refreshFloat = () => { if (floatRaf) return; floatRaf = requestAnimationFrame(() => { floatRaf = 0; updateFloat(); }); };
  ws.addChangeListener(refreshFloat);                    // block moves / viewport scroll / model rebuild → reposition
  window.addEventListener('ddcs:settings-changed', refreshFloat);
  host.addEventListener('keydown', (e) => {              // Tab takes the first option — but not while editing a Blockly field
    if (e.key !== 'Tab' || sugFloat.hidden || !floatTypes.length) return;
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
    e.preventDefault(); e.stopPropagation();
    insertSuggestion(floatTypes[0]);
  }, true);

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
  // t788 — split into the PROMPT half (code panel · selection · overlays · live form — cheap/moderate, and read
  // synchronously by glow / the form writeback) and the HEAVY half (the 2D/3D preview: toolpath re-trace + 3D route
  // rebuild + stock carve). On a block edit the prompt half runs inline (the edit reflects at once) and the heavy half
  // DEFERS to quiescence (see reproject). A full render (load / resize) runs both, in the original order.
  function renderViewsPrompt(p) {
    renderCode(p.lines, p.map);
    applySelection();
    repaintOverlays();   // re-apply transient hover (.warm) + value-token (.thot) overlays onto the rebuilt spans
    renderLiveForm();    // the wizard's form as a LIVE view of the blocks (only while editing a custom op)
  }
  function renderViewsPreview(p) {
    panel.setGcode(p.text);
    // t756 (R-C) — the Blocks tab renders the WHOLE program, so apply the full UNION render-intent via the ONE seam
    // (rotary rig · machine frame · machine-frame tool · seat-at-start) — IDENTICAL to the editor preview by
    // construction (both call applyProgramIntent with their program's op types; the wizard derives the same per op).
    applyProgramIntent(panel, getStack().filter((b) => b && b.type === 'op').map((b) => b.opType));
  }
  function renderViews(p) { renderCode(p.lines, p.map); renderViewsPreview(p); applySelection(); repaintOverlays(); renderLiveForm(); }

  // Live FORM view — the wizard's form as a TWO-WAY view of the blocks (only while editing a custom op).
  //  · block→form: derive the bindings (deriveAuthoredDef) on every render. Same structure → sync values into the
  //    NON-focused fields (you "see the form change" without clobbering the field you're typing in); structure
  //    changed (a knob added / removed / re-widgeted) → full rebuild.
  //  · form→block: a delegated input listener (wired below) writes a field's value back to its bound block
  //    (writeAuthoredValue), surgically — which reprojects, updating the G-code + preview too. The smart sync here
  //    absorbs that echo (the edited field is focused, so it's skipped), so there's no loop and no focus loss.
  const formSig = (bs) => (bs || []).map((b) => `${b.param}:${b.widget || b.type || 'number'}:${b.group || ''}:${b.role || ''}`).join('|');
  function renderLiveForm() {
    const pane = document.getElementById('blk-formpane'), formHost = document.getElementById('blk-form');
    if (!pane || !formHost) return;
    let def = null;
    try { def = deriveAuthoredDef(ws); } catch (_) { /* a mid-edit derive can throw; keep the last good form */ }
    
    const stack = getStack() || [];
    const opBlock = stack.find((b) => b && (getUserDef(b.type) || (b.params && getUserDef(b.params.opType))));
    if ((!def || !def.bindings || !def.bindings.length) && opBlock) {
      const regDef = getUserDef(opBlock.type) || (opBlock.params && getUserDef(opBlock.params.opType));
      if (regDef) def = regDef;
    }

    const userRoot = stack.find((b) => b && b.type === 'user_root') || (def && def.template && Array.isArray(def.template) ? def.template.find((b) => b && b.type === 'user_root') : null);
    
    function checkLayoutNodes(nodes) {
      if (!nodes) return false;
      const list = Array.isArray(nodes) ? nodes : (typeof nodes === 'object' ? Object.values(nodes).flat() : []);
      for (const n of list) {
        if (!n) continue;
        if (['split_horizontal', 'split_vertical', 'grid_container', 'tab_group', 'group_box', 'section', 'sim', 'panel'].includes(n.type)) return true;
        if (n.children && checkLayoutNodes(n.children)) return true;
        if (n.uiChildren && checkLayoutNodes(n.uiChildren)) return true;
      }
      return false;
    }
    const hasTree = userRoot && checkLayoutNodes(userRoot.uiChildren);

    const show = hasTree || (def && (editingWizardType() || (def.bindings && def.bindings.length)));
    pane.hidden = false;
    if (!show) {
      formHost.innerHTML = '<div class="blk-form-empty" style="opacity:0.6;padding:12px;font-style:italic;">Add a "Define Custom Wizard" block or tick a knob to view live Generator Modal layout.</div>';
      formHost.__sig = null;
      return;
    }

    if (hasTree) {
      formHost.__sig = null;
      formHost.innerHTML = '';
      const byParam = {};
      const tempHost = document.createElement('div');
      const readers = renderOpForm(tempHost, formBindings(def || {})) || [];
      tempHost.querySelectorAll('[data-param]').forEach((inp, idx) => {
        if (!inp || !inp.dataset || !inp.dataset.param) return;
        const row = inp.closest('.form-row') || inp.closest('.grid-2') || inp.parentElement;
        byParam[inp.dataset.param] = { row, read: readers[idx] || (() => ({ [inp.dataset.param]: inp.value })) };
      });
      renderUiTree(formHost, userRoot.uiChildren, (def && def.bindings) || [], byParam);
      return;
    }

    const sig = formSig(def.bindings);
    if (formHost.__sig === sig && formHost.querySelector('[data-param]')) {        // structure unchanged → value-sync only
      for (const b of def.bindings) {
        const f = formHost.querySelector(`[data-param="${window.CSS ? CSS.escape(b.param) : b.param}"]`);
        if (f && f !== document.activeElement && String(f.value) !== String(b.default)) {
          f.value = b.default;
          const echo = f.type === 'range' && f.parentElement && f.parentElement.querySelector('span');   // keep a slider's readout in step
          if (echo) echo.textContent = f.value;
        }
      }
      return;
    }
    formHost.__sig = sig;                                                          // structure changed → rebuild
    formHost.innerHTML = '';
    if (def.bindings && def.bindings.length) renderOpForm(formHost, formBindings(def));   // S5.2 — consume param_field rows when present; else byte-identical
    else formHost.innerHTML = '<div class="blk-form-empty">No knobs yet — tick a value’s “knob” on the blocks to expose one.</div>';
  }
  // form→block writeback (wired once): an edited form field writes its value back to the bound block, surgically.
  (() => {
    const formHost = document.getElementById('blk-form');
    if (!formHost || formHost.dataset.wbWired) return;
    formHost.dataset.wbWired = '1';
    formHost.addEventListener('input', (e) => {
      const f = e.target && e.target.closest && e.target.closest('[data-param]');
      if (!f) return;
      const n = Number(f.value);
      if (Number.isFinite(n)) { try { writeAuthoredValue(ws, f.dataset.param, n); } catch (_) { /* transient mid-edit miss is fine */ } }
    });
  })();

  // User edited the WORKSPACE → push to the shared model (which re-projects the editor) → refresh the pane.
  // t788 — the RULED TRIGGER SPLIT (pipeline-level; every heavy op, not a pocket special-case). One field edit used to
  // run a FULL synchronous re-emit (a pocket ≈ 199 lines + 7 post-passes) → toolpath re-trace → 3D route rebuild →
  // stock carve, PER change event, freezing the Blocks tab on heavy ops (user t783). Now the edit's PROMPT half runs
  // inline — the model re-emit + code panel + selection + live form — so the edit REFLECTS at once (glow / form
  // writeback read the fresh model synchronously), and only the HEAVY consumer (the 2D/3D preview: trace · carve ·
  // route) DEFERS to quiescence via a leading-edge-free throttle: at most one preview render per RECOMPUTE_MS window,
  // so a typed commit's preview follows within ~300ms and a continuous gesture (spinner drag / rapid commits) tracks
  // live at the window cadence instead of freezing per event. Emit is byte-identical after settle — only WHEN the
  // heavy preview runs changed, never WHAT is emitted. (Instrumented for the acceptance spec.)
  const RECOMPUTE_MS = 300;
  let _previewTimer = null, _previewCount = 0, _previewMs = 0, _modelMs = 0, _lastEditAt = 0, _lastPreviewAt = 0, _editsSincePreview = 0;
  function previewNow() {
    const t0 = performance.now();
    renderViewsPreview(getProjection());                   // the heavy half: trace + 3D route + (rAF-deferred) carve
    _previewMs = performance.now() - t0; _lastPreviewAt = performance.now(); _previewCount++; _editsSincePreview = 0;
  }
  function schedulePreview() {                              // coalesce a burst; defer the heavy render off the edit
    _editsSincePreview++;
    if (_previewTimer) return;                              // within the current window → coalesce (one render serves the burst)
    _previewTimer = setTimeout(() => { _previewTimer = null; previewNow(); }, RECOMPUTE_MS);
  }
  function reproject() {
    const t0 = performance.now();
    setStack(workspaceToStack(ws), 'blockly');             // model + emit + editor text — SYNC (glow / form writeback read it); a REAL edit (t1161 — the render's own echo is disabled)
    renderViewsPrompt(getProjection());                    // code panel + selection + live form — SYNC (the edit reflects now)
    _modelMs = performance.now() - t0; _lastEditAt = performance.now();
    schedulePreview();                                     // the heavy 2D/3D preview — DEFERRED to ~RECOMPUTE_MS of quiescence
  }
  // Instrumented timestamps for the acceptance spec + a manual flush (tests assert the settled preview without waiting).
  window.__ddcsEditPerf = () => ({ previewCount: _previewCount, previewMs: Math.round(_previewMs), modelMs: Math.round(_modelMs), lastEditAt: Math.round(_lastEditAt), lastPreviewAt: Math.round(_lastPreviewAt), pending: !!_previewTimer, editsSincePreview: _editsSincePreview, windowMs: RECOMPUTE_MS });
  window.__ddcsPreviewFlush = () => { if (_previewTimer) { clearTimeout(_previewTimer); _previewTimer = null; } previewNow(); };

  // The model changed ELSEWHERE (Studio editor edit / wizard seed / post-processor change) → render it into the
  // workspace (muted so the rebuild doesn't echo back through the change listener), reframe, refresh the pane.
  function renderFromModel(p) {
    muteChanges = true;
    // t1161 — DISABLE Blockly event generation during the rebuild so the batched (FIRE_QUEUE / setTimeout 0) block events
    // never dispatch a reproject ECHO (which re-ids + re-defaults + would add a stray Undo state). The echo did ONE needed
    // thing — re-sync the model's block ids to the freshly-rendered workspace ids (the code↔block linking reads them) — so
    // we do THAT explicitly below, deterministically, via the 'reproject' origin (saveStates skips it → no Undo state; the
    // onChange re-render guard skips it → no loop). Deferred to a microtask so it runs AFTER this onChange settles (no
    // re-entrant setStack). A REAL user edit fires later (events enabled) → reproject() with 'blockly' → it still snapshots.
    B.Events.disable();
    try { stackToWorkspace(getStack(), ws); applyOpGating(ws); } finally { B.Events.enable(); muteChanges = false; }   // gate gated ops
    queueMicrotask(() => { try { setStack(workspaceToStack(ws), 'reproject'); } catch (_) { /* ws torn down */ } });   // sync ids, no Undo state, no re-render
    if (_dev) _dev.onModelRender();   // re-grow the always-on "expose as knob" affordances after a clean rebuild
    requestAnimationFrame(place); setTimeout(place, 120); setTimeout(place, 400);
    renderViews(p);
  }
  onChange(({ proj, origin }) => { if (origin !== 'blockly' && origin !== 'reproject') renderFromModel(proj); });   // 'reproject' = our own post-render echo (t1161) — already rendered; do NOT re-render (would loop)

  // ---- code view + linked selection (click a code line ⇄ its Blockly block) ----
  // EXECUTION GLOW: the sim's active line lights on the projected G-code with a fading comet-tail — the SAME read-out
  // as the read-only editor panel (`#blk-gcode .gl.active-line` + `[data-exec-age]` in styles.css). `onLine(i)` from the
  // shared preview panel drives setExecLine; i indexes getProjection().text lines == the `.gl` spans (one per line).
  let execTrail = [];   // recent .gl elements, newest first (index 0 = the current line)
  function clearExec() { execTrail.forEach((sp) => { sp.classList.remove('active-line'); sp.removeAttribute('data-exec-age'); }); execTrail = []; }
  function setExecLine(i) {
    const el = (i >= 0 && i < out.children.length) ? out.children[i] : null;
    if (!el || execTrail[0] === el) return;
    execTrail.unshift(el);
    execTrail.splice(6).forEach((sp) => { sp.classList.remove('active-line'); sp.removeAttribute('data-exec-age'); });   // age off the tail
    execTrail.forEach((sp, age) => { sp.classList.toggle('active-line', age === 0); if (age === 0) sp.removeAttribute('data-exec-age'); else sp.dataset.execAge = String(Math.min(age, 5)); });
    el.scrollIntoView({ block: 'nearest' });
  }
  function renderCode(lines, map) {
    clearExec();   // the .gl spans are about to be replaced — drop the stale exec trail so it can't point at dead nodes
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
  // HOVER (learner aid): mouse over a block → light its emitted lines in the code panel — a LIGHTER glow than
  // selection, and NO scroll. Reuses the SAME per-line block ancestry (dataset.src) as applySelection, so block→code
  // mapping comes from the one emit map, not a second one. Independent class (.warm) so it composes with selection.
  let hoveredId = null;
  function applyHover(id) {
    if (id === hoveredId) return;
    hoveredId = id;
    out.querySelectorAll('.gl').forEach((sp) => {
      const src = sp.dataset.src ? sp.dataset.src.split(',') : null;
      sp.classList.toggle('warm', !!(id && src && src.includes(id)));
    });
  }

  // WORD-LEVEL value highlight (.thot): box the exact emitted token(s) a value occupies — driven by hovering a value
  // field (the precise value under the cursor) OR selecting a leaf atom (all its values). Spans come from the emit via
  // opGlow.valueTokenRanges / valueRangesForSubtree (perturb+diff provenance, no regex). Wrapping replaces a line
  // span's text with [text][<span.thot>token</span>][text]; clearing resets textContent (collapses the wraps).
  let valueHover = null;          // { ownerId, paramKey } of the value under the cursor, or null
  let selTokens = [];             // cached value-token spans for the current LEAF selection (recomputed on change)
  const tokenLines = new Set();   // line indices currently carrying .thot wraps (for cleanup)
  function wrapLine(sp, ranges) {
    const text = sp.textContent;
    ranges.sort((a, b) => a[0] - b[0]);
    const frag = document.createDocumentFragment();
    let pos = 0;
    for (const [s, e] of ranges) {
      if (s < pos || s >= e || e > text.length) continue;        // skip overlaps / out-of-bounds
      if (s > pos) frag.appendChild(document.createTextNode(text.slice(pos, s)));
      const tok = document.createElement('span'); tok.className = 'thot'; tok.textContent = text.slice(s, e);
      frag.appendChild(tok); pos = e;
    }
    if (pos < text.length) frag.appendChild(document.createTextNode(text.slice(pos)));
    sp.replaceChildren(frag);
  }
  function paintTokens(ranges) {
    const gls = out.querySelectorAll('.gl');
    tokenLines.forEach((i) => { const sp = gls[i]; if (sp) sp.textContent = sp.textContent; });   // restore plain text
    tokenLines.clear();
    const byLine = new Map();
    for (const { line, range } of ranges) { if (!byLine.has(line)) byLine.set(line, []); byLine.get(line).push(range); }
    byLine.forEach((rs, line) => { const sp = gls[line]; if (sp) { wrapLine(sp, rs); tokenLines.add(line); } });
  }
  // hovered value wins (the precise token under the cursor); else the selected leaf's tokens; else nothing.
  function refreshTokens() { paintTokens(valueHover ? valueTokenRanges(valueHover.ownerId, valueHover.paramKey) : selTokens); }
  function recomputeSelTokens() {
    const rec = selectedId ? findModelById(getStack(), selectedId) : null;
    selTokens = (rec && (!rec.children || !rec.children.length)) ? valueRangesForSubtree(selectedId) : [];   // leaf only (cheap + uncluttered)
  }
  function setSelected(id, opts) { selectedId = id; recomputeSelTokens(); applySelection(opts); refreshTokens(); }
  // re-apply the transient hover + value-token overlays onto the freshly-rebuilt .gl spans (renderCode replaces them
  // on every projection render, dropping .warm/.thot; the reset-then-apply defeats applyHover's same-id early-return).
  function repaintOverlays() { const h = hoveredId; hoveredId = null; applyHover(h); recomputeSelTokens(); refreshTokens(); }

  out.addEventListener('click', (e) => {
    const sp = e.target.closest('.gl');
    if (sp && sp.dataset.owner) { try { ws.getBlockById(sp.dataset.owner)?.select(); } catch (_) { /* gone */ } setSelected(sp.dataset.owner, { scrollCode: false }); }
    else setSelected(null);
  });
  // Resolve the innermost hovered block to (a) the statement/leaf whose LINES to warm, and (b) the value socket under
  // the cursor (if any) whose TOKEN to box. A value/reporter block has an outputConnection; walk up past it to the
  // owning leaf, then map the socket input → the model param key (FN = uppercase, so match case-insensitively).
  function resolveHoverTarget(blk) {
    let v = blk, top = null;
    while (v && v.outputConnection) { top = v; v = v.getParent(); }
    const leaf = v;
    if (!leaf) return { warmId: blk.id, value: null };
    if (!top) return { warmId: leaf.id, value: null };          // blk is itself a statement/leaf/container, not a value
    let inputName = null;
    for (const inp of (leaf.inputList || [])) { if (inp.connection && inp.connection.targetBlock() === top) { inputName = inp.name; break; } }
    const rec = findModelById(getStack(), leaf.id);
    const paramKey = (inputName && rec && rec.params) ? Object.keys(rec.params).find((k) => k.toUpperCase() === inputName) : null;
    return { warmId: leaf.id, value: paramKey ? { ownerId: leaf.id, paramKey } : null };
  }
  function setHover(warmId, value) {
    const changed = JSON.stringify(value || null) !== JSON.stringify(valueHover);
    applyHover(warmId);                                          // early-returns if the warmed block is unchanged
    if (changed) { valueHover = value; refreshTokens(); }
  }
  // Block→code hover: Blockly tags every block's SVG root with data-id, so closest('[data-id]') from the event target
  // is the innermost hovered block; the grid/empty canvas has none → clear. mouseleave clears on exit.
  host.addEventListener('mouseover', (e) => {
    const g = e.target && e.target.closest && e.target.closest('[data-id]');
    const blk = g && ws.getBlockById(g.getAttribute('data-id'));
    if (blk) { const t = resolveHoverTarget(blk); setHover(t.warmId, t.value); }
    else setHover(null, null);
  });
  host.addEventListener('mouseleave', () => setHover(null, null));

  /**
   * ── t1454 — THE CANVAS'S CONTEXT MENU: our entries JOIN Blockly's, they do not replace it ────────────────────────
   *
   * ⚠ THIS SURFACE IS THE ONE THAT DOES **NOT** GO THROUGH `openMenu`, and that is a measured decision rather than an
   * oversight. The Blocks canvas ALREADY HAS a right-click menu — Blockly's own, deliberately left alive (the
   * middle-pan guard above says so in as many words: *"RMB (button 2 = context menu) are untouched"*) — and its
   * registry already ships **Duplicate, Delete, Comment, Collapse/Expand and Inline**. Opening our menu on
   * `contextmenu` would have suppressed all five. Two of them are literally the entries this pass was asked to add,
   * so "reuse the one mechanism" would have DELETED the very actions it was meant to provide.
   *
   * So the canvas keeps ONE menu — the rule's real intent — and we register into it. Duplicate and Delete are
   * therefore already satisfied here and are NOT re-added: a second Delete beside Blockly's would be two entries that
   * must agree forever, which is the same defect as two menus one level down.
   *
   * RULE 1 holds for both entries: ✎ Edit is the hover chip's action, visible in the editor and in the op menu; and
   * ▤ Show G-code is what a plain CLICK on a block already does (it selects the op and scrolls the code panel to it) —
   * the entry names a behaviour the surface has, for a user who has not discovered that clicking does it.
   */
  (function registerCanvasMenu() {
    const CMR = B.ContextMenuRegistry;
    if (!CMR || !CMR.registry || !CMR.ScopeType) return;                    // a Blockly build without the registry: skip, never crash
    /** The op block that owns `blk` (the canvas shows an op's INNER stack), or null outside an op. */
    const opOf = (blk) => { let b = blk; while (b && !(b.type === 'op' || (typeof b.type === 'string' && b.type.endsWith('_op')))) b = b.getParent && b.getParent(); return b || null; };
    const labelOf = (opBlk) => { try { return (JSON.parse(opBlk.data || '{}').label) || opBlk.opType || 'op'; } catch (_) { return opBlk.opType || 'op'; } };
    const reg = (id, text, cb, weight) => {
      try { CMR.registry.unregister(id); } catch (_) { /* first run */ }     // idempotent: the tab can re-inject
      CMR.registry.register({
        id, weight, scopeType: CMR.ScopeType.BLOCK,
        preconditionFn: (scope) => (opOf(scope.block) ? 'enabled' : 'hidden'),   // hidden off an op — never a dead entry
        displayText: (scope) => text(opOf(scope.block)),
        callback: (scope) => { const o = opOf(scope.block); if (o) cb(o); },
      });
    };
    reg('ddcsEditOp', (o) => `✎ Edit ${labelOf(o)}`, (o) => { if (window.ddcsEditOp) window.ddcsEditOp(o.id); }, 0.5);
    reg('ddcsShowGcode', () => '▤ Show G-code', (o) => { try { o.select(); } catch (_) { /* */ } setSelected(o.id, { scrollCode: true }); }, 0.6);
  })();

  // DECLARE the edit, don't infer it: when a REAL user change fires (not a UI event, not our own muted model→workspace
  // rebuild), record which op's atom it touched. The round-trip's representation drift (empty move sockets → 0, #var →
  // record) happens during MUTED reloads, so it never fires here → it can never be mistaken for an edit.
  function recordBlockEdit(e) {
    if (!e.blockId) return;
    // The always-on authoring affordances (EXPOSE_/PNAME_/WIDGET_/XMARK_ dev fields) aren't part of the op model —
    // toRecord ignores them, so ticking/naming a knob must not register as an op block-edit (else it would light a
    // spurious edit-chip + force merge-not-replace). Mirror that exclusion here.
    if (e.element === 'field' && typeof e.name === 'string' && /^(EXPOSE_|PNAME_|WIDGET_|XMARK_)/.test(e.name)) return;
    const blk = ws.getBlockById(e.blockId);
    if (!blk || typeof blk.getParent !== 'function') return;
    const t = resolveHoverTarget(blk);                          // changed block → its owning model atom (+ value param)
    const atom = ws.getBlockById(t.warmId);
    let opBlk = atom; while (opBlk && !(opBlk.type === 'op' || opBlk.type.endsWith('_op'))) opBlk = opBlk.getParent();
    if (!opBlk || opBlk === atom) return;                       // not inside an op, OR the op HEADER itself (form path handles that)
    let detail = {};
    if (e.element === 'field') {
      let paramKey = t.value ? t.value.paramKey : null;
      if (!paramKey && e.name) { const rec = findModelById(getStack(), t.warmId); if (rec && rec.params) paramKey = Object.keys(rec.params).find((k) => k.toUpperCase() === e.name); }
      detail = { paramKey, from: e.oldValue, to: e.newValue };
    }
    recordEdit(opBlk.id, t.warmId, detail);
  }

  // ---- workspace events: structural change → re-emit; selection → highlight code ----
  ws.addChangeListener((e) => {
    if (!e.isUiEvent && !muteChanges) { try { recordBlockEdit(e); } catch (_) { /* a recording miss must never break reproject/selection */ } }
    if (e.type === B.Events.SELECTED) { setSelected(e.newElementId || null, { scrollCode: true }); }
    else if (e.element === 'field' && _ops) {
      try {
        const blk = ws.getBlockById(e.blockId);
        // t154 — a STRUCTURAL-CONTROL edit drives the guards: find the enclosing user op, gather ALL its sc_* values into
        // op.params, and replaceOp (re-instantiate → pruneGuards reprunes → reload → the preview updates live). Additive +
        // SCOPED to sc_* blocks (isStructCtlType) — no other block's change handling is touched. (postInstantiate re-syncs
        // the controls to op.params so they keep their set value after the rebuild.)
        if (blk && isStructCtlType(blk.type)) {
          let opBlk = blk.getSurroundParent && blk.getSurroundParent();
          while (opBlk && opBlk.type !== 'op') opBlk = opBlk.getSurroundParent && opBlk.getSurroundParent();
          if (opBlk && opBlk.type === 'op') {
            let meta = {}; try { meta = JSON.parse(opBlk.data || '{}'); } catch (_) { /* keep {} */ }
            const params = { ...(meta.params || {}) };
            for (const d of opBlk.getDescendants(false)) {
              if (!isStructCtlType(d.type)) continue;
              const v = d.getFieldValue('VALUE');
              params[SC_PARAM[d.type]] = (v === 'TRUE' || v === 'FALSE') ? (v === 'TRUE') : v;   // checkbox → bool; dropdown → its value
            }
            // t156 — mirror the op-header branch's guard: if the op has hand-edited children (a live value-socket edit
            // marks it edited but doesn't refresh opBlk.data), MERGE (reconciles the structural reprune WITH those edits)
            // instead of replaceOp (which rebuilds from the STALE data + would clobber the value edit — a data-loss defect).
            if (isOpBlockEdited(opBlk.id) && _ops.mergeOpBlocks) _ops.mergeOpBlocks(opBlk.id, params);
            else _ops.replaceOp(opBlk.id, params);
            return;
          }
        }
        if (blk && (blk.type === 'op' || blk.type.endsWith('_op'))) {
          let meta = {}; try { meta = JSON.parse(blk.data || '{}'); } catch (_) {}
          const params = { ...(meta.params || {}) };
          
          if (blk.type === 'corner_op') {
            params.corner = blk.getFieldValue('CORNER') || 'FL';
            params.probeSeq = blk.getFieldValue('PROBESEQ') || 'YX';
          } else if (blk.type === 'edge_op') {
            params.axis = blk.getFieldValue('AXIS') || 'X';
            params.dir = blk.getFieldValue('AXISDIR') || 'pos';
          } else if (blk.type === 'middle_op') {
            params.featureType = blk.getFieldValue('FEATURETYPE') || 'pocket';
            params.axis = blk.getFieldValue('AXIS') || 'X';
            params.dir1 = blk.getFieldValue('DIR1') || 'pos';
            params.twoAxis = blk.getFieldValue('TWOAXIS') === 'TRUE';
            params.dir2 = blk.getFieldValue('DIR2') || 'pos';
          } else if (blk.type === 'circular_op') {
            params.featureType = blk.getFieldValue('FEATURETYPE') || 'bore';
          }
          
          if (blk.type !== 'op') {
              // Guard: if the op has hand-edited children (injected atoms / overridden values),
              // merge (preserves those edits) instead of replaceOp (rebuilds wholesale, clobbers).
              if (isOpBlockEdited(blk.id) && _ops.mergeOpBlocks) {
                _ops.mergeOpBlocks(blk.id, params);
              } else {
                _ops.replaceOp(blk.id, params);
              }
              return;
          }
        }
      } catch (_) { }
      if (!e.isUiEvent && !muteChanges) reproject();
    }
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

    // Desktop: drag the LEFT edge of the preview column to resize it. Width lives in --blk-pv-w on #blocks-app
    // (only the desktop grid reads it), mirrors the mobile drawer resize, and persists across sessions.
    const colResize = right.querySelector('.blk-col-resize');
    if (colResize) {
      try { const w = parseInt(localStorage.getItem('ddcs_blk_pv_w'), 10); if (w > 0) root.style.setProperty('--blk-pv-w', w + 'px'); } catch (_) { /* */ }
      let dragging = false;
      const onMove = (e) => {
        if (!dragging) return;
        const x = e.touches ? e.touches[0].clientX : e.clientX;
        const r = root.getBoundingClientRect();
        const w = Math.max(240, Math.min(Math.round(r.width * 0.72), Math.round(r.right - x)));   // drag left → wider preview
        root.style.setProperty('--blk-pv-w', w + 'px');
        try { B.svgResize(ws); } catch (_) { /* canvas (1fr) shrank/grew */ }
      };
      const onUp = () => {
        if (!dragging) return;
        dragging = false;
        window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp);
        try { localStorage.setItem('ddcs_blk_pv_w', parseInt(root.style.getPropertyValue('--blk-pv-w'), 10) || ''); } catch (_) { /* */ }
        refit();   // re-fit the preview to the new column width
      };
      colResize.addEventListener('pointerdown', (e) => {
        dragging = true; e.preventDefault();
        window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
      });
    }

    // Desktop: drag the horizontal divider to resize the Preview pane vs the Projected G-code pane below it.
    // Split height lives in --blk-pv-split on .right and persists across sessions.
    const rowResize = right.querySelector('.blk-row-resize');
    const pvPane = right.querySelector('.pv');
    if (rowResize && pvPane) {
      try { const h = parseInt(localStorage.getItem('ddcs_blk_pv_split'), 10); if (h > 0) right.style.setProperty('--blk-pv-split', h + 'px'); } catch (_) { /* */ }
      let dragging = false;
      const onMove = (e) => {
        if (!dragging) return;
        const y = e.touches ? e.touches[0].clientY : e.clientY;
        const pvTop = pvPane.getBoundingClientRect().top;
        const rr = right.getBoundingClientRect();
        const h = Math.max(120, Math.min(Math.round(rr.bottom - pvTop - 90), Math.round(y - pvTop)));
        right.style.setProperty('--blk-pv-split', h + 'px');
        try { panel.refresh(); } catch (_) { /* re-fit the 3D preview to the new height */ }
      };
      const onUp = () => {
        if (!dragging) return;
        dragging = false;
        window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp);
        try { localStorage.setItem('ddcs_blk_pv_split', parseInt(right.style.getPropertyValue('--blk-pv-split'), 10) || ''); } catch (_) { /* */ }
        try { panel.refresh(); } catch (_) { /* */ }
      };
      rowResize.addEventListener('pointerdown', (e) => {
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

    // Breakpoint behaviour: ≤860px (mobile) → palette starts COLLAPSED (canvas full); desktop → palette starts OPEN.
    // Delegate to setToolsOpen so the tools-open class + handle state ('✕'/'Blocks') + the measured --blk-tbx-w stay
    // CONSISTENT at both breakpoints — t126: this is what makes the DESKTOP collapse handle toggle from the FIRST click
    // (before, desktop showed the toolbox but left tools-open unset, so the handle's first click was a silent no-op).
    const mq = window.matchMedia('(max-width: 860px)');
    const applyBreakpoint = (mobile) => { setToolsOpen(!mobile); };
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
