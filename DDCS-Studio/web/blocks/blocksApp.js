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
import { installTokenGuard } from './blockly/tokenGuard.js';   // t1712 (cycle ACT 5) — REFUSE an ineligible live-value connection on the canvas
import { ddcsTheme } from './blockly/theme.js';
import { setStack, getStack, getProjection, onChange, getGen, flattenOps } from './programModel.js';   // blocks = a VIEW of the shared program model; t1928 — flattenOps sees inside a multi_step import wrapper
import { mountDevMode, deriveAuthoredDef, editingWizardType, authoringWizardType, writeAuthoredValue } from './devMode.js';   // authoring: derive the live def + write form values back; t1599 — authoringWizardType: the DECLARED 'this canvas is customizing a wizard' fact the right pane's face reads
import { isStructCtlType, SC_PARAM } from '../wizards/ops/structCtl.js';   // t154 — structural-control blocks drive the op's guards → live reprune
import { learnerToolboxCategories } from '../data/learnerLibrary.js';   // curated Snippets / Complete Programs toolbox groups
import { sfx } from '../ui/sound.js';   // t2229 (BACKLOG F3a) — block.snap, the human's own named exception to the visible-state-sound removal
import { opToolboxCategories } from './opToolbox.js';   // t1315 — the REGISTERED wizard families, derived from the op registry
import { getUserDef, flattenBlocks } from './userOps.js';
import { createUserOpView } from '../wizards/views/userOpView.js';   // t1744 ACT 1b-ii — the pane's OWN namespaced instance (ns='blk'), the SAME renderer the modal uses via openLiveAsModal's default (ns=null) instance
import { isOpBlockEdited } from './opGlow.js';   // op-edit guard (drives the merge-vs-replace decision on a re-instantiate)
import { recordEdit } from './opEdits.js';   // DECLARE a block edit when its change event fires (vs inferring it by re-derivation)
import { createPreviewPanel } from '../viz/createPreviewPanel.js';   // THE shared preview (2D+3D+engine+trail+stock), same in all 3 hosts
import { makePanesCollapsible } from '../ui/paneAccordion.js';   // t1760 — the Wizard View pane's own visual host needs the SAME accordion setup (wraps each viz pane's content in .wiz-pane-body + writes --viz-stack-h) the modal's own open() already gets; without it the pane's #blk_wiz_user visual content-sizes to its bare control-bar height instead of a real preview height
import { applyProgramIntent, opSimContext } from '../viz/opSimContext.js';          // t756 — the WHOLE-PROGRAM declared render-intent seam (seat / machine-frame / rig), shared with the editor preview; opSimContext (t1872) — this op's OWN frame intent, tagged per contributed hint below
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
  // t756 (R-C) — per-pass sim-start HINTS from the DECLARED source (opSimStarts), read off the whole block program —
  // the SAME registry the editor + wizard previews use, so the Blocks preview seats each pass identically. Retires the
  // legacy WIZARDS[type].inferStart start-source (the imperative per-wizard guess).
  const blkStartHints = () => {
    const stock = (window.ddcsGetSettings && window.ddcsGetSettings().stock) || null;
    const hints = [];
    // t1954 — the SIXTH t1928 site: this used to walk the raw top-level stack, so a multi_step import wrapper
    // (opSimStarts has no 'multi_step' entry) contributed zero hints and its wrapped children's hints never
    // appeared at all. flattenOps is the one declared enumeration the other five sites already use.
    for (const b of flattenOps(getStack())) {
      if (!b || b.type !== 'op' || !b.opType) continue;
      const h = opSimStarts(b.opType, b.params || {}, stock);
      // t1872 (Option B Slice 2) — tag each hint with ITS OWN contributing op's declared toolMachineFrame, the
      // SAME source applyProgramIntent's whole-program UNION already reads (opSimContext.js). The union stays
      // exactly as-is for forceMachine/seatAtStart/stock-hiding (t1832/t1834's own ruling: do not touch that
      // frame model) — this is a SEPARATE, per-pass tag that ONLY gcodeViz3d.js's positioning sites consult,
      // falling back to the whole-trace flag when absent (every other caller of getStartHints, single-op, never
      // sets this field — byte-identical there). A multi-op program (Homing then Corner) now lets EACH pass
      // carry its OWN op's frame, instead of one flag applied uniformly to every pass in the trace.
      if (Array.isArray(h) && h.length) hints.push(...h.map((row) => ({ ...row, toolMachineFrame: !!opSimContext(b.opType).toolMachineFrame })));
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
    // t2125 (SOUND-PLAN.md section 5b) — Blockly ships its OWN click/delete/disconnect/error-beep audio system,
    // with its own defaults (sounds:true, pathToMedia a Google CDN) unless told otherwise. sounds:false is
    // NOT enough on its own — it only gates Options.hasSounds, whose one consumer in the vendored bundle is
    // the sample PRELOAD; playErrorBeep() synthesizes its own oscillator and is gated solely by
    // AudioManager.muted, which sounds:false never touches (t2128 review — a genuine claim-vs-code gap: the
    // comment here and the commit that added it both said this was already handled). The equivalent
    // feedback that matters (a refused connection) is routed through sfx() instead — see
    // blocks/blockly/tokenGuard.js's own refusal path — so Blockly's own engine is retired outright, not
    // toggled: it must never sound regardless of our own master switch, or a connection refusal would beep
    // twice (once from us, once from Blockly).
    sounds: false,
  });
  ws.getAudioManager().setMuted(true);   // t2129 — the actual mute; sounds:false above only stops preload
  installTokenGuard(ws);   // t1712 (cycle ACT 5) — REFUSE an ineligible token connection, the third authoring surface

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

  // Render the right pane (3D preview + live form) from a projection { text, lines, map }.
  // t788 — split into the PROMPT half (live form — cheap, and read synchronously by the form writeback) and the
  // HEAVY half (the 2D/3D preview: toolpath re-trace + 3D route rebuild + stock carve). On a block edit the prompt
  // half runs inline (the edit reflects at once) and the heavy half DEFERS to quiescence (see reproject). A full
  // render (load / resize) runs both, in the original order.
  // t1734 — the code panel (renderCode/applySelection/repaintOverlays, all `#blk-gcode`-only) is gone with the
  // Projected G-code pane; `p.lines`/`p.map` are unused here now (still read by the model/editor projection elsewhere).
  function renderViewsPrompt(p) {
    renderLiveForm();    // the wizard's form as a LIVE view of the blocks (only while editing a custom op)
  }
  function renderViewsPreview(p) {
    panel.setGcode(p.text);
    // t756 (R-C) — the Blocks tab renders the WHOLE program, so apply the full UNION render-intent via the ONE seam
    // (rotary rig · machine frame · machine-frame tool · seat-at-start) — IDENTICAL to the editor preview by
    // construction (both call applyProgramIntent with their program's op types; the wizard derives the same per op).
    applyProgramIntent(panel, flattenOps(getStack()).map((b) => b.opType).filter(Boolean));
  }
  function renderViews(p) { renderViewsPreview(p); renderLiveForm(); }

  // Live FORM view — the wizard's form as a TWO-WAY view of the blocks (only while editing a custom op).
  //  · block→form: derive the bindings (deriveAuthoredDef) on every render. Same structure → sync values into the
  //    NON-focused fields (you "see the form change" without clobbering the field you're typing in); structure
  //    changed (a knob added / removed / re-widgeted) → full rebuild.
  //  · form→block: a delegated input listener (wired below) writes a field's value back to its bound block
  //    (writeAuthoredValue), surgically — which reprojects, updating the G-code + preview too. The smart sync here
  //    absorbs that echo (the edited field is focused, so it's skipped), so there's no loop and no focus loss.
  // formSig/syncFormValues: t1740 — moved to ui/formWidgets.js so userOpView.js's render() can share the SAME
  // structure-unchanged check rather than a second copy that could quietly diverge (t1748 — this file no longer
  // imports either itself; both branches that used to render into #blk-form now route through createUserOpView).
  // t1734 — THE TAB BAR. Two tabs, ALWAYS present (Wizard View / 3D) — user-clicked, never auto-picked. Replaces
  // the old ONE-predicate face switch (setRightFace, driven by renderLiveForm's `show`): that predicate decided
  // whether the Wizard View existed AT ALL, and its own history is two rounds of guessing wrong (see the retired
  // wizard-face-1599 spec). An always-present tab asks no question, so switching it can never be "wrong" — `show`
  // still decides the Wizard View tab's CONTENT (the form, or empty), just never whether the tab itself is there.
  // t1768 — PERSISTS (localStorage, same convention as ddcs_blk_pv_h below): the user rarely switches, so the
  // choice should stay where they left it rather than resetting to Wizard View every open. Still never
  // recomputed from wizard-authoring state — only a direct click (or this one-time restore) ever changes it.
  let activeTab = 'wizard';
  try { const saved = localStorage.getItem('ddcs_blk_view'); if (saved === 'wizard' || saved === '3d') activeTab = saved; } catch (_) { /* */ }
  // t1744 ACT 1b-ii — THE SWITCH: the pane's OWN namespaced instance of the SAME renderer the modal uses
  // (openLiveAsModal's default ns=null instance). One instance, created once, reused across every render —
  // its closure-scoped state (_def/_seed/_layoutSpots/…) persists across renders the way a live pane needs.
  // onFieldWrite: PROVEN necessary, not assumed — blocks-live-form.spec.js's own "form→block writeback" test
  // (editing the live form must reach the block + G-code) failed without this wired, and blocks-edit-fail-
  // loud-1518.spec.js's PROOF 3 needs the SAME host's bound field. Mirrors the OLD #blk-form listener exactly
  // (same Number.isFinite guard, same writeAuthoredValue call) — the mechanism doesn't change, only which
  // renderer's delegated listener calls it.
  const blkView = createUserOpView('blk', {
    onFieldWrite(param, rawValue) {
      const n = Number(rawValue);
      if (Number.isFinite(n)) { try { writeAuthoredValue(ws, param, n); } catch (_) { /* transient mid-edit miss is fine */ } }
    },
  });
  // t1746 ACT 1b-ii-FIX — which op blkView last showed, so renderLiveForm can tell a genuine fresh open (a
  // different op, or arriving from a different branch) from a same-op re-render (an unrelated canvas change, or
  // this render's OWN writeback echo) and route to onShow vs the lighter refresh() accordingly. null whenever
  // blkView isn't the active host, so returning to it always counts as fresh.
  let blkLastOpType = null;
  // t1760 — THE PANE'S VISUAL HOST NEVER DREW: `onShow`/`refresh` passed `{ update() {} }` at every call site below —
  // a stub with NO `preview3D`/`previewVarSeed`. userOpView.render()'s form3d+2d branch calls `mgr.preview3D(...)`
  // UNCONDITIONALLY (userOpView.js:557,673) — on the stub this throws mid-render, so everything after the form
  // (the 3D/2D mount) never ran. The DOM scaffold (t1742) was never the gap; the capability was. `preview3D`/
  // `previewVarSeed` are pure functions of (gcode, containerId, …) — createPreviewPanel's own host state lives on
  // the target DOM element (wizardManager.js:542-579), not on the manager instance, so borrowing the SAME
  // singleton `openLiveAsModal` already reuses (this file, `window.ddcsStudio.wizardManager`) is safe: it never
  // renders into the pane's `blk_`-prefixed containers and the modal's un-prefixed ones at once (one gesture at a
  // time). `update` stays a no-op — blocksApp already re-renders the pane reactively on canvas change; routing it
  // through the real manager's own `update()` would re-render whichever wizard THAT considers active, which is a
  // different (and, for the pane, wrong) concept.
  function blkMgr() {
    const wm = window.ddcsStudio && window.ddcsStudio.wizardManager;
    return {
      update() {},
      preview3D: (...a) => { if (wm) wm.preview3D(...a); },
      previewVarSeed: (...a) => { if (wm) wm.previewVarSeed(...a); },
    };
  }
  // t1760 — THE KNOWN TRAP, applied here: a canvas sized while its container is display:none (or, per the CSS fix
  // above, content-sized to ~0 before its stack height is known) comes out 0×0 or wrong-sized and never re-fits on
  // its own. The standalone "3D" tab's own panel already has a re-fit-on-visible/resize pattern (`refit`, `panel.
  // setActive(true); panel.refresh()`, wired to the drawer-open/resize/tab-switch events below) — this reuses the
  // SAME mechanism for the Wizard View pane's own `.wiz-viz3d` panel (a DIFFERENT panel instance, created lazily
  // inside `#blk_userViz3dBox` the first time `mgr.preview3D` runs — so this is a no-op, not an error, before that).
  function refitBlkWizardVisual() {
    try {
      const c = document.getElementById('blk_userViz3dContainer');
      const host = c && c.parentElement && c.parentElement.querySelector('.wiz-viz3d');
      if (host && host.__panel) { host.__panel.setActive(true); host.__panel.refresh(); }
    } catch (_) { /* no panel mounted yet — nothing to refit */ }
  }
  function setActiveTab(tab) {
    if (tab !== 'wizard' && tab !== '3d') return;
    activeTab = tab;
    try { localStorage.setItem('ddcs_blk_view', tab); } catch (_) { /* */ }
    const right = root.querySelector('.right');
    if (right) right.classList.toggle('tab-3d', tab === '3d');
    // t1768 — the toggle shows the CURRENT view (aria-pressed = active), same reading as the app's own existing
    // .seg/.op-btn "2D/3D + Play" pattern (.primary = active) elsewhere in this same right column.
    root.querySelectorAll('.blk-view-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === tab)));
    const handle = document.getElementById('blkDrawerHandle');
    if (handle) handle.textContent = `▲ ${tab === 'wizard' ? 'Wizard View' : '3D'}`;
    // Re-fit the preview when its tab becomes visible (a canvas sized while display:none is 0×0).
    if (tab === '3d') setTimeout(() => { try { panel.setActive(true); panel.refresh(); } catch (_) { /* */ } }, 60);
    // t1760 — the Wizard View tab's own visual host needs the SAME re-fit-on-visible the 3D tab already gets.
    if (tab === 'wizard') setTimeout(refitBlkWizardVisual, 60);
  }
  /**
   * t1625 — ONE derivation of "the wizard this canvas is showing": the drawer's live form AND "Open as modal"
   * both read this, so the modal can never render a different wizard than the panel (the same second-source
   * disease every recent turn has been curing). Pure read — no registry write, no canvas mutation.
   */
  function deriveLiveWizard() {
    let def = null;
    try { def = deriveAuthoredDef(ws); } catch (_) { /* a mid-edit derive can throw; keep the last good form */ }

    const stack = getStack() || [];
    // t1740 FOLLOW-UP — a NORMALLY PLACED op (bar → Insert → Blocks tab, not authoring/Customize) carries its type
    // on the TOP-LEVEL `opType` field (opBuilders.js's own shape: {id,type:'op',opType,label,params,children}) —
    // NOT nested under `params.opType` (params holds the op's VALUE fields, e.g. depth/feed; it has no opType key).
    // The params-nested check below predates this and never matched a real placed op — reported by the user
    // ("i use the built in, press insert, then press blocks tab") as an empty pane; reproduced: program=[op],
    // canvas top=1, pane=0 fields. Added getUserDef(b.opType) alongside the pre-existing checks (kept, in case
    // some other shape genuinely nests it) rather than replacing them.
    const opBlock = stack.find((b) => b && (getUserDef(b.type) || getUserDef(b.opType) || (b.params && getUserDef(b.params.opType))));
    // t1599 — hoisted above the opBlock-fallback below (was computed later, alongside authoredHere/userRoot): the
    // fallback needs this fact to exclude the Customize route (t1754 fix, see placedOpFallback comment).
    const customizing = !!(authoringWizardType() && stack.some((b) => b && b.type === 'op' && b.opType === authoringWizardType()));
    // t1752 — set ONLY inside this fallback, which is the ONE case that is genuinely "a placed op's own registry
    // def, not something authored here": a hand-built/bare stack with EXPOSED KNOBS (hand-built-form.spec.js's own
    // case) ALSO has authoredHere=false and customizing=false — it is NOT "placed," `def` there comes straight
    // from `deriveAuthoredDef`, this branch never runs for it (the `!def.bindings.length` guard is false). Read
    // by renderLiveForm() below to decide read-only (t1750) — `!authoredHere && !customizing` alone is NOT enough,
    // it can't tell a placed op from a hand-built one with knobs; this flag can.
    // t1754 — ALSO excluded: the Customize route itself. Opening a twin to customize loads it as the exact same
    // {type:'op', opType, children} shape a genuinely placed op has, and deriveAuthoredDef legitimately returns
    // no bindings for it either (no exposed knobs) — so `opBlock` matches and the OLD guard fired here too,
    // marking the live Customize pane read-only (found chasing param-group-rows-1605's "values are LIVE both
    // ways" timeout: the field's write never reached the canvas because `host.inert` was true). Customize is the
    // one route that must NEVER be read-only — it IS the editor — so it is excluded by the same `customizing`
    // fact the branch below already uses to decide the def itself.
    let placedOpFallback = false;
    if (!customizing && (!def || !def.bindings || !def.bindings.length) && opBlock) {
      const regDef = getUserDef(opBlock.type) || getUserDef(opBlock.opType) || (opBlock.params && getUserDef(opBlock.params.opType));
      if (regDef) {
        placedOpFallback = true;
        // t1740 FOLLOW-UP — the registry def carries only DECLARED DEFAULTS; opBlock.params is the placed op's OWN
        // current values, read straight off `stack` — no side-channel, no snapshot, the same object the canvas
        // itself holds (the t1738 ruling: "the stack IS the wizard"). Same two-part overlay t1736 proved (then
        // reverted only because ITS SOURCE — getLastOp()/.active — was a rejected side-channel; the PATCHING SHAPE
        // was never the problem): formBindings() resolves a numeric field's value from the TEMPLATE ROW's own
        // embedded `dflt` when one exists (userOps.js's paramFieldsFromStack; that row wins over the binding's own
        // default — formWidgets.js's `default: (row.default != null) ? row.default : b.default`), so a `hasTree`-
        // shaped twin like Corner needs the template patched too, not just bindings — a binding-only overlay is
        // silently discarded for exactly this twin shape. Both patches run on a DEEP CLONE (JSON.parse(JSON.
        // stringify(...)) — this codebase's established idiom, also used by openLiveAsModal) so the shared registry
        // def already in USER_DEFS is never mutated (the t1736 rule).
        const params = opBlock.params || {};
        const template = JSON.parse(JSON.stringify(regDef.template || []));
        const root = template.find((b) => b && b.type === 'user_root');
        if (root) {
          for (const b of flattenBlocks(root.uiChildren || [])) {
            if (b && b.type === 'param_field' && b.params && b.params.param in params) b.params.dflt = params[b.params.param];
          }
        }
        def = { ...regDef, template, bindings: (regDef.bindings || []).map((b) => (b && b.param != null && b.param in params) ? { ...b, default: params[b.param] } : b) };
      }
    }

    // ── t1599 — IS A WIZARD BEING AUTHORED HERE? Two ways, and both are facts, not shape-guesses ─────────────────
    // (1) a Define Custom Wizard block the user put at the TOP LEVEL — a hand-built wizard;
    // (2) the Customize route is open, which devMode DECLARES (`authoringWizardType`) and which is still true of
    //     this stack, checked so a stale session cannot claim a program it no longer describes.
    // ⚠ NOT "a user_root anywhere in the flattened stack" — I wrote that first and it was worse than the bug: a
    // PLACED data-op twin's body carries a user_root too, so merely inserting Corner into a program turned the whole
    // right pane into the wizard face and took the sim's Preview + G-code away from it.
    const authoredHere = stack.find((b) => b && b.type === 'user_root');
    // (customizing is computed above, before the opBlock fallback, which needs it too)
    // t1605 — the Customize route renders from the REGISTERED def: a twin's bindings live in the registry, not on
    // its canvas (no knobs, no pills), so the derived def is binding-less and the wizard view got an EMPTY byParam —
    // a param_group placeholder and zero rows where Surfacing's fields belong. Gated on the DECLARED authoring fact
    // (authoringWizardType — the t1599 doctrine), NEVER on the stack merely holding a twin: the first cut of this
    // adopted the registered def whenever a top-level op's `opType` was registered, and a PLACED twin in an ordinary
    // program then inherited the registered template's user_root → hasTree → the wizard face stole the sim's
    // Preview — the exact trap the wizard-face spec pins.
    if (customizing && (!def || !def.bindings || !def.bindings.length)) {
      const regDef = getUserDef(authoringWizardType());
      if (regDef) def = regDef;
    }
    // t1738 — the t1734/t1736 side-channel mirror (first `.active`-keyed, then `getLastOp()`-keyed) is DELETED
    // outright, not patched further. User ruling: the STACK IS THE WIZARD — any tracked side-channel (a DOM flag,
    // a recorded-op snapshot) is a second copy of a fact the canvas already carries, which is exactly the
    // duplication this gameplan exists to remove. The Wizard View's content question is settled differently now
    // (render the whole stack as the form it becomes when saved, through the SAME renderer openLiveAsModal uses —
    // see below); nothing here reaches for a wizard that isn't genuinely represented on the canvas.
    const userRoot = authoredHere
      || (customizing ? flattenBlocks(stack).find((b) => b && b.type === 'user_root') : null)
      || (def && def.template && Array.isArray(def.template) ? def.template.find((b) => b && b.type === 'user_root') : null);
    return { def, stack, authoredHere, customizing, userRoot, placedOpFallback };
  }

  /**
   * t1625 — "OPEN AS MODAL" (user-ruled; the panel STAYS): the CURRENT canvas wizard at full size, in the REAL
   * modal chrome, unsaved. The mechanism is the _openGroupForEdit precedent verbatim — setUserOpDef(a derived
   * def) then open('group') — which renders #wiz_user from a def that is in NO registry: close persists nothing
   * by construction. The def's template prefers the CANVAS's own user_root (the drawer's t1605 rule), so what
   * the modal shows is what the author is building, not a stored snapshot. INSERT is hidden while previewing
   * (.previewing — cleared by every real open()): the preview's one exit is close.
   */
  async function openLiveAsModal() {
    const { def, userRoot } = deriveLiveWizard();
    const wm = window.ddcsStudio && window.ddcsStudio.wizardManager;
    if (!def || !wm) return;
    // DEEP-COPY the template: userRoot is the live CANVAS block record, and the preview's own emit path annotates
    // template blocks in place (`_group` et al.) — through the shared reference that rewrote the canvas stack.
    // Measured, not guessed: the round-trip spec's byte-compare caught +16KB of annotations on close.
    const modalDef = { ...def, template: JSON.parse(JSON.stringify(userRoot ? [userRoot] : (def.template || []))) };
    // t1627 — a HAND-BUILT stack's derived def has an opType with no registered builder, and userOpView.update()
    // deliberately refuses those (`!isGroup && !builderOf(opType)` — the guard that keeps a stale def from running
    // a wrong builder). The group route is the sanctioned no-registry path (deriveGroupDef defs run instantiate on
    // the def directly), so a builder-less preview def travels AS a group — same as _openGroupForEdit's own defs.
    const { builderOf } = await import('./opBuilders.js');
    if (!modalDef.opType || !builderOf(modalDef.opType)) modalDef.opType = 'group';
    // …and a hand-built def carries no `panel` either (only the save dialog / registry set it) — read the stack's
    // own panel block, the SAME read the save path commits (blocks always win). Absent → the form3d default stands.
    if (!modalDef.panel) {
        const pb = flattenBlocks(modalDef.template || []).find((x) => x && x.type === 'panel');
        if (pb && pb.params && pb.params.panel) modalDef.panel = pb.params.panel;
    }
    // The #wizard overlay is position:fixed but was born INSIDE #studio-app, so from the Blocks tab it opened
    // invisibly behind a display:none ancestor. Every other modal in this app (wsm, app-dialog, library) lives on
    // document.body for exactly this reason — adopt it there once, lazily; fixed positioning renders identically
    // for the Studio flows (verified: no parent-scoped selector or query depends on the old seat).
    const overlay = document.getElementById('wizard');
    if (overlay && overlay.parentElement !== document.body) document.body.appendChild(overlay);
    const { setUserOpDef } = await import('../wizards/views/userOpView.js');
    setUserOpDef(modalDef);
    wm.open('group');
    wm._previewing = true;   // t1740 — open() above just reset this to false; set it AFTER, same ordering reason as the CSS class below
    const box = document.querySelector('.wiz-box');
    if (box) box.classList.add('previewing');
    const t = document.getElementById('wizTitle');
    if (t) t.textContent = `${modalDef.label || 'Custom wizard'} — PREVIEW (live from the blocks · nothing is saved)`;
  }

  // t1750 ACT 1b-iv — a PLACED op's pane fields render VISIBLY read-only, not silently ignoring input (t1748's
  // own finding: writeAuthoredValue has no case for a placed op's {type:'op',params} shape, so an edit there was
  // already a no-op — the bug was that nothing SHOWED that). `inert` blocks every widget kind uniformly (input,
  // select, segmented, xy-pad, …) without enumerating each one; the class carries the visual + cursor; the title
  // carries WHY. Called after every onShow/refresh in both branches below, not just once, since a render can flip
  // placed↔authoring (switching which op the canvas holds) without a full page reload in between.
  const BLK_READONLY_REASON = 'Read-only here — a placed operation edits through its wizard (STUDIO tab) or its blocks on this canvas, not this pane.';
  function applyBlkReadOnly(readOnly) {
    const host = document.getElementById('blk_wiz_user_form');
    if (!host) return;
    host.classList.toggle('blk-form-readonly', !!readOnly);
    host.inert = !!readOnly;
    if (readOnly) host.title = BLK_READONLY_REASON; else host.removeAttribute('title');
  }
  function renderLiveForm() {
    const pane = document.getElementById('blk-formpane'), formHost = document.getElementById('blk-form');
    if (!pane || !formHost) return;
    const blkHost = document.getElementById('blk_wiz_user');
    // t1744 ACT 1b-ii — default every render to the OLD host visible / the new scaffold hidden; only the flat-
    // bindings branch at the bottom (the ONE case createUserOpView('blk') now owns) flips this before it returns.
    // Every other branch below (empty / hasTree / mid-edit) is untouched and still targets `formHost`.
    if (blkHost) blkHost.style.display = 'none';
    formHost.style.display = '';
    const { def, stack, authoredHere, customizing, userRoot, placedOpFallback } = deriveLiveWizard();

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

    // ── t1599 — A DEFINE CUSTOM WIZARD BLOCK ON THE CANVAS MEANS THE WIZARD FACE. FULL STOP. ────────────────────
    // The predicate used to be a disjunction of three PROXIES for that — a layout tree under the root, an editing
    // context, a non-empty binding list — and each could be false while a wizard was plainly being authored:
    //   · the layout tree was looked for at the TOP LEVEL only, so the Customize route (root inside an `op`) never
    //     matched it;
    //   · `editingWizardType()` is deliberately null for the fork-only twins (surfacing / slot / drill / bore);
    //   · a stack mid-authoring has no bindings yet, which is the ordinary state of a wizard you are still building.
    // Corner survived on the second term alone. Surfacing had none of the three and showed Preview with the block
    // right there on the canvas — the reported gap. The two authoring facts above are what actually answer it.
    //
    // ⚠ ADDED TO the old terms, NOT substituted for them. "A Define Custom Wizard block means the wizard face" is
    // SUFFICIENT, never NECESSARY: a plain saved custom op whose template is a bare atom stack with a param pill has
    // no user_root at all, and swapping the predicate wholesale sent it to the Preview face — five blocks-live-form
    // tests said so within the minute.
    const show = !!authoredHere || customizing || hasTree || (def && (editingWizardType() || (def.bindings && def.bindings.length)));
    pane.hidden = false;
    // t1768 — the header's title is the WIZARD'S OWN NAME (was the internal "Generator Modal" label): every
    // render, not just the hasTree/flat branches below, so it clears back to a neutral label the instant `show`
    // goes false (no stale name left over from whatever was last loaded).
    {
      const titleEl = document.getElementById('blkPaneTitle');
      if (titleEl) titleEl.textContent = (show && def && def.label) ? def.label : 'Wizard View';
    }
    // t1734 — `show` now decides ONLY this tab's CONTENT (the form below, or empty): the Wizard View tab itself is
    // always present regardless (see setActiveTab). No more face to write to CSS.
    // t1625 — the "Open as modal" door follows the wizard face: no wizard on the canvas, no door. Wired here
    // (renderLiveForm runs on every render) so the button needs no separate init path.
    {
      const b = document.getElementById('blkOpenModal');
      if (b) { b.hidden = !show; if (!b.__wired) { b.__wired = true; b.addEventListener('click', openLiveAsModal); } }
    }
    if (!show) {
      // No wizard block at all → this column IS the Preview face, and the message that used to sit here told the
      // reader to add a block while the other face was already showing them the program. Nothing to say.
      formHost.innerHTML = '';
      formHost.__sig = null;
      blkLastOpType = null;   // t1746 — a later return to the flat branch counts as fresh, not a same-op re-render
      return;
    }

    if (hasTree) {
      // t1605 — the rows must be LIVE: prefer the CANVAS's own user_root as the template, so the param_field
      // declarations the form consumes (formBindings reads rows off def.template) are the ones actually on the
      // canvas — a canvas dflt edit reaches the form, and the form face shows what the author is building, not
      // the registry's stored snapshot. When userRoot already came from def.template this is the same object.
      const liveDef = def ? { ...def, template: [userRoot] } : {};
      // t1748 ACT 1b-iii — THE hasTree BRANCH renders through the SAME createUserOpView('blk') instance the flat
      // branch already uses (t1744), not a second renderer — this is the branch EVERY sampled built-in twin
      // actually takes (t1744's own Finding 1: every one carries a sectioned/panel-based template). Same shape as
      // the flat branch: onShow on a genuine fresh op, refresh on a same-op re-render, ONE shared tracker
      // (blkLastOpType) — reset alongside it in the other branches' own returns, never a second one here.
      //
      // Checked before wiring, not assumed: userOpView.render() has its OWN tree/flat split internally
      // (hasTreeLayout — narrower than this file's checkLayoutNodes: only split_horizontal/split_vertical count,
      // not section/panel/tab_group/param_group/sim), so a sectioned twin like Corner takes ITS OWN flat path
      // internally, not renderUiTree. Verified empirically that this is NOT a missing capability: formBindings()
      // + renderOpForm()'s own section-grouping (`.form-sec`, grouped off each binding's `.section`) already
      // produces the complete, correctly field for every sampled twin — Corner 23/23 fields (3 named sections),
      // WCS 6/6, ATC Length 7/7, Surfacing 30/30, zero exceptions. A different internal branch inside the SAME
      // renderer, not a gap — so this act does not need to touch userOpView.js at all.
      if (blkHost) {
        formHost.style.display = 'none';
        blkHost.style.display = '';
        blkView.setUserOpDef(liveDef);
        if (blkLastOpType === def.opType) {
          blkView.view.refresh(blkMgr());
        } else {
          blkLastOpType = def.opType;
          blkView.view.onShow(blkMgr());
        }
        // t1760 — onShow/refresh only build the FORM (userOpView.js's render()); the 3D/2D VISUALIZATION lives
        // in view.update() (computes gcode from the current field values, then calls mgr.preview3D/previewVarSeed)
        // — the modal's own open() calls it right after onShow (wizardManager.js:292,309) and this pane never did,
        // which is why the visual host's containers existed but stayed empty. Same call, every render.
        blkView.view.update(blkMgr());
        // t1760 — the modal's open() also calls makePanesCollapsible(wizElem) (wizardManager.js:287) right after
        // onShow: it wraps each [data-viz-pane]'s content in a fresh .wiz-pane-body and calls applyVisualHeight(),
        // which is what actually WRITES --viz-stack-h — without it the pane's viz panes never get a real height,
        // content-sizing to their bare control-bar instead. Idempotent (mirrors the mobile drawer's own reuse).
        makePanesCollapsible(blkHost);
        applyBlkReadOnly(placedOpFallback);   // t1752 — a hand-built/bare stack with exposed knobs is NOT placed either, so authoredHere/customizing alone can't tell; placedOpFallback is the fact that actually distinguishes it
      } else {
        formHost.innerHTML = '<div class="blk-form-empty">Wizard View scaffold missing.</div>';
      }
      return;
    }

    // t1599 — MID-EDIT: the face is the wizard's, so it must SAY WHAT IS MISSING rather than fall through to a form
    // with nothing in it. Two distinct absences, named separately because the next move differs: a wizard with no
    // Presentation content at all has no layout to render, and one with content but no bound fields has nothing to
    // put in it. (`def` can also be null when a mid-edit derive throws — same face, same kind of message.)
    // SCOPED to a stack that actually carries a Define Custom Wizard block: an op that reached this face by one of
    // the other terms has no Presentation mouth to be told about, and its own "No knobs yet" line below still fits.
    if (userRoot && !hasTree && !(def && def.bindings && def.bindings.length)) {
      const root = userRoot || {};
      const hasPresentation = Array.isArray(root.uiChildren) && root.uiChildren.length > 0;
      formHost.__sig = null;
      blkLastOpType = null;   // t1746 — a later return to the flat branch counts as fresh, not a same-op re-render
      formHost.innerHTML = hasPresentation
        ? '<div class="blk-form-empty">This wizard has no fields yet — add a <b>Form field</b> block, or a <b>Parameter Group</b>, to the Presentation mouth.</div>'
        : '<div class="blk-form-empty">This wizard is empty — drop a <b>Panel</b> and a <b>Form field</b> block into its <b>Presentation (UI &amp; Sim)</b> mouth to give it a form.</div>';
      return;
    }

    // t1744 ACT 1b-ii — THE SWITCH: this flat-bindings case (a `hasTree` layout tree is a SEPARATE face above,
    // untouched) now renders through the SAME renderer the "Open as modal" overlay uses, not a lookalike.
    if (blkHost) {
      formHost.style.display = 'none';
      blkHost.style.display = '';
      blkView.setUserOpDef(def);
      // t1746 ACT 1b-ii-FIX — onShow ONLY on a genuine fresh open (blkLastOpType reset to null above whenever
      // some OTHER branch just ran, or this is the first time). A same-op re-render — this render's OWN
      // writeback echo, or an unrelated canvas change while this op is already showing — uses the lighter
      // refresh() instead: it does not reset host.__sig, so render()'s sync-in-place check can actually fire and
      // a field the user is mid-keystroke in gets synced, not destructively rebuilt out from under them.
      if (blkLastOpType === def.opType) {
        blkView.view.refresh(blkMgr());
      } else {
        blkLastOpType = def.opType;
        blkView.view.onShow(blkMgr());
      }
      // t1760 — see the hasTree branch's own note: onShow/refresh only build the form, view.update() builds the
      // 3D/2D visualization (mgr.preview3D/previewVarSeed) — the modal's open() always calls both, this pane didn't.
      blkView.view.update(blkMgr());
      // t1760 — same makePanesCollapsible fix as the hasTree branch above (see that note for why).
      makePanesCollapsible(blkHost);
      applyBlkReadOnly(placedOpFallback);   // t1752 — a hand-built/bare stack with exposed knobs is NOT placed either, so authoredHere/customizing alone can't tell; placedOpFallback is the fact that actually distinguishes it
    } else {
      formHost.innerHTML = '<div class="blk-form-empty">Wizard View scaffold missing.</div>';
    }
  }
  // t1748 — the OLD #blk-form writeback listener that used to live here is gone: since t1744 (flat branch) and
  // this act (hasTree branch), nothing renders a `[data-param]` field into #blk-form anymore — both cases route
  // through createUserOpView('blk')'s own delegated listener (its onFieldWrite hook, wired in this file, calls
  // the SAME writeAuthoredValue). #blk-form now only ever holds the empty/mid-edit/no-scaffold messages, none of
  // which carry a data-param field, so the old listener was dead code, not a second copy of live behavior.

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
    const myGen = getGen();   // t1766 — captured BEFORE the rebuild so a setStack fired mid-rebuild is also seen as newer
    try { stackToWorkspace(getStack(), ws); applyOpGating(ws); } finally { B.Events.enable(); muteChanges = false; }   // gate gated ops
    // t1766 — a rapid second setStack (e.g. a scripted clear immediately followed by another load) can land
    // before this microtask runs; re-reading the NOW-STALE `ws` at that point would overwrite the newer model
    // with old data. Bail if the generation has moved on — the newer call's own renderFromModel already queued
    // (or will queue) its own correct echo.
    queueMicrotask(() => { try { if (getGen() === myGen) setStack(workspaceToStack(ws), 'reproject'); } catch (_) { /* ws torn down */ } });   // sync ids, no Undo state, no re-render
    if (_dev) _dev.onModelRender();   // re-grow the always-on "expose as knob" affordances after a clean rebuild
    requestAnimationFrame(place); setTimeout(place, 120); setTimeout(place, 400);
    renderViews(p);
  }
  onChange(({ proj, origin }) => { if (origin !== 'blockly' && origin !== 'reproject') renderFromModel(proj); });   // 'reproject' = our own post-render echo (t1161) — already rendered; do NOT re-render (would loop)

  // Resolve the innermost edited block to (a) the statement/leaf whose model atom owns it, and (b) the value socket
  // under it (if any) → the model param key (FN = uppercase, so match case-insensitively). Feeds recordBlockEdit
  // below. t1734 — no longer also feeds a code-panel hover highlight; that surface (and the Projected G-code pane
  // it lit) is deleted, not replaced.
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

  /**
   * ── t1454 — THE CANVAS'S CONTEXT MENU: our entries JOIN Blockly's, they do not replace it ────────────────────────
   *
   * ⚠ THIS SURFACE IS THE ONE THAT DOES **NOT** GO THROUGH `openMenu`, and that is a measured decision rather than an
   * oversight. The Blocks canvas ALREADY HAS a right-click menu — Blockly's own, deliberately left alive (the
   * middle-pan guard above says so in as many words: *"RMB (button 2 = context menu) are untouched"*) — and its
   * registry already ships **Duplicate, Delete, Comment, Collapse/Expand and Inline**. Opening our menu on
   * `contextmenu` would have suppressed all five. One of them is literally the entry this pass was asked to add,
   * so "reuse the one mechanism" would have DELETED the very action it was meant to provide.
   *
   * So the canvas keeps ONE menu — the rule's real intent — and we register into it. Duplicate and Delete are
   * therefore already satisfied here and are NOT re-added: a second Delete beside Blockly's would be two entries that
   * must agree forever, which is the same defect as two menus one level down.
   *
   * RULE 1 holds: ✎ Edit is the hover chip's action, visible in the editor and in the op menu. t1734 — ▤ Show G-code
   * (what a plain click on a block already did — select the op and scroll the code panel to it) is deleted along
   * with the Projected G-code pane it targeted; not replaced.
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

  // ---- workspace events: structural change → re-emit + record edits ----
  ws.addChangeListener((e) => {
    // t2229 (BACKLOG F3a) — block.snap: the human's own named exception ("ambiguous enough to be kept
    // audible") to the visible-state-sound removal. Verified live (not assumed from Blockly's own vendored
    // .d.ts, which doesn't cover event shapes): a genuine drag-to-connect fires e.type === 'move' with
    // e.reason including 'connect' — a disconnect/bump carries ['disconnect','bump'], never 'connect' alone.
    if (e.type === 'move' && e.reason && e.reason.includes('connect')) sfx('block.snap');
    if (!e.isUiEvent && !muteChanges) { try { recordBlockEdit(e); } catch (_) { /* a recording miss must never break reproject */ } }
    if (e.element === 'field' && _ops) {
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
  // Canvas fills the tab; the right column = bottom drawer, palette = left drawer over canvas. The drawer translates
  // (keeps its size off-screen) → re-render on open. Palette uses the toolbox's own setVisible() so the canvas
  // actually reclaims the width when collapsed.
  // t1734 — the `blkSegPv` / `blkSegCode` segmented toggle and its `showPane` wiring are GONE, not merely unbound
  // (0bd8b38c deleted the buttons; this code called `document.getElementById` on nothing ever since). What replaced
  // it, later the same arc, is the `.blk-view-toggle` (t1768; was a `.blk-tabs` tab row) wired just below: a REAL
  // user-facing toggle between Wizard View and 3D — the thing that comment used to say was deliberately absent.
  // setRightFace/`show` no longer pick the face; `show` only decides the Wizard View content now (see renderLiveForm).
  (function wireDrawers() {
    const right = root.querySelector('.right');
    const handle = document.getElementById('blkDrawerHandle');
    const closeBtn = document.getElementById('blkDrawerClose');
    const toolsHandle = document.getElementById('blkToolsHandle');
    if (!right) return;

    const refit = () => { try { panel.setActive(true); panel.refresh(); } catch (_) { /* */ } refitBlkWizardVisual(); };   // t1760 — the drawer-open/resize handles below also own the Wizard View pane's own visual now
    const openPv = (on) => { right.classList.toggle('open', on); if (handle) handle.setAttribute('aria-expanded', String(on)); if (on) setTimeout(refit, 260); };
    handle && handle.addEventListener('click', () => openPv(true));
    closeBtn && closeBtn.addEventListener('click', () => openPv(false));

    // The Wizard View / 3D toggle — restored from localStorage (or the Wizard View default) once at build; every
    // further change is a direct user click, never recomputed from wizard-authoring state.
    root.querySelectorAll('.blk-view-btn').forEach((b) => b.addEventListener('click', () => setActiveTab(b.dataset.view)));
    setActiveTab(activeTab);

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
