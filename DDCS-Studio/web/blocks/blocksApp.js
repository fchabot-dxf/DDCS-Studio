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
import { renderOpForm } from '../ui/formWidgets.js';   // render the wizard's form from bindings (the live block→form view)
import { isOpBlockEdited, valueTokenRanges, valueRangesForSubtree } from './opGlow.js';   // op-edit guard + word-level value-token spans (hover/select highlight)
import { recordEdit } from './opEdits.js';   // DECLARE a block edit when its change event fires (vs inferring it by re-derivation)
import { createPreviewPanel } from '../viz/createPreviewPanel.js';   // THE shared preview (2D+3D+engine+trail+stock), same in all 3 hosts
import { programSimContext } from '../viz/opSimContext.js';          // declared op-type → preview render-intent (rotary rig, …)
import { getCaps, resolveActivePost } from '../wizards/dialects/index.js';
import { getActiveProfile } from '../shared/js/profiles/controllerProfiles.js';
import { getLastOp } from './opRecord.js';
import { CornerWizard } from '../wizards/cornerWizard.js';
import { EdgeWizard } from '../wizards/edgeWizard.js';
import { MiddleWizard } from '../wizards/middleWizard.js';
import { CircularWizard } from '../wizards/circularWizard.js';

const WIZARDS = {
    corner: new CornerWizard(), edge: new EdgeWizard(),
    middle: new MiddleWizard(), circular: new CircularWizard()
};

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
function applyOpGating(ws) {
    const post = resolveActivePost(getActiveProfile().id), caps = getCaps(post.id);
    const dl = { id: post.id, name: post.name, caps };   // dialect-shaped for an atom's gate() predicate
    const has = (r) => (r === 'flow' ? caps.flow !== 'none' : caps[r] !== false);
    for (const b of ws.getAllBlocks(false)) {
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
  const out = document.getElementById('blk-gcode');
  // THE shared preview panel — identical to Studio main + the wizards (same code + UI); fed the projected program.
  const blkPanelHost = document.getElementById('blk-preview-panel');
  const panel = createPreviewPanel(blkPanelHost, {
    getGcode: () => getProjection().text,
    getStart: () => {
      const op = getLastOp();
      if (op && WIZARDS[op.type] && WIZARDS[op.type].inferStart) {
        const stock = (window.ddcsGetSettings && window.ddcsGetSettings().stock) || null;
        return WIZARDS[op.type].inferStart(op.params, stock);
      }
      return null;
    }
  });
  if (blkPanelHost) blkPanelHost.__panel = panel;   // expose for inspection/tests (mirrors wizardManager's host.__panel)

  // Grid lines follow the theme's border tone (best-effort: the grid colour is an inject option, so it's set
  // once here; the rest of the chrome re-skins live via setTheme below).
  const gridColour = (() => { try { return getComputedStyle(document.body).getPropertyValue('--border').trim() || '#1b2733'; } catch (_) { return '#1b2733'; } })();
  const ws = B.inject(host, {
    toolbox: buildToolbox(), theme: ddcsTheme(B), renderer: 'geras', collapse: true,
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
      .filter((d) => `${d.label || ''} ${d.type} ${d.category || ''}`.toLowerCase().includes(q))
      .map((d) => ({ kind: 'block', type: d.type }));
    try { tb.clearSelection(); fl.show(hits.length ? hits : [{ kind: 'label', text: 'No matching blocks' }]); } catch (_) { /* */ }
  };
  search.addEventListener('input', runSearch);
  search.addEventListener('search', runSearch);   // the ✕ clear button fires 'search'
  window.__blkWs = ws;   // debug/test accessor

  // ---- Suggested-next strip (A): chips for the most-likely next blocks (learned from your programs + a curated
  //      seed); click to append. Updates as the program changes. ----
  const STMT = new Set(PALETTE.filter((d) => d.kind !== 'reporter').map((d) => d.type));   // insertable (no reporters)
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
  function renderViews(p) {
    renderCode(p.lines, p.map);
    panel.setGcode(p.text);
    // Sim intent: the Blocks tab renders the WHOLE program, so apply the UNION render-intent — e.g. the 4th-axis
    // rotary rig appears when ANY op is rotary (the per-op wizard previews derive the same flag from opSimContext).
    const sim = programSimContext(getStack().filter((b) => b && b.type === 'op').map((b) => b.opType));
    panel.setRotaryFixture(sim.showRotaryRig);
    applySelection();
    repaintOverlays();   // re-apply transient hover (.warm) + value-token (.thot) overlays onto the rebuilt spans
    renderLiveForm();    // the wizard's form as a LIVE view of the blocks (only while editing a custom op)
  }

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
    if (!editingWizardType()) { pane.hidden = true; formHost.innerHTML = ''; formHost.__sig = null; return; }
    let def = null;
    try { def = deriveAuthoredDef(ws); } catch (_) { /* a mid-edit derive can throw; keep the last good form */ return; }
    if (!def) { pane.hidden = true; return; }
    pane.hidden = false;
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
    if (def.bindings && def.bindings.length) renderOpForm(formHost, def.bindings);
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
  function reproject() {
    setStack(workspaceToStack(ws), 'blockly');
    renderViews(getProjection());
  }

  // The model changed ELSEWHERE (Studio editor edit / wizard seed / post-processor change) → render it into the
  // workspace (muted so the rebuild doesn't echo back through the change listener), reframe, refresh the pane.
  function renderFromModel(p) {
    muteChanges = true;
    try { stackToWorkspace(getStack(), ws); applyOpGating(ws); } finally { muteChanges = false; }   // gate gated ops (muted: no echo)
    if (_dev) _dev.onModelRender();   // re-grow the always-on "expose as knob" affordances after a clean rebuild
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
