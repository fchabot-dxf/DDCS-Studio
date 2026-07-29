/**
 * ui/formWidgets.js — the FORM-side widget registry for custom-op forms (P1 of the widget library).
 *
 * A custom op's UI is composed from WIDGETS. Each widget renders an input into a form row and exposes
 * read() → { param: value }; multi-param widgets (P2 canvas pickers) return several params. A binding declares
 * `widget` (a registry key) + `widgetConfig`; the form picks that widget, or a sensible default per binding.type.
 * This is the FORM half of a widget; the BLOCK half (a Blockly field, e.g. field_cornergrid) is a separate adapter
 * that wraps the same core — see vendor/blockly + cornerGridSvg.js for the proven dual-render pattern.
 *
 * The registry is EXTENSIBLE (like the ops/BUILDERS registry): add a widget = add one entry here (+ its block
 * adapter when it needs one). Number params stay the easy default; richer widgets are opt-in.
 */
import { CG, buildCornerCells, paintCornerGrid } from './cornerGridSvg.js';
import { buildRegions, paintRegions, regionValueFromEvent, regionLabel } from './regionPickSvg.js';
import { FeatureCanvas } from '../viz/featureCanvas.js';
import { workpieceFeatureItems, stockTopWorkZ, suggestedPlaneZ } from '../engine/workpiece.js';   // t933 — the shared stock-top + suggested-plane-Z (Plane assists, one source with the middle wizard)
import { decorateInputEl } from './probeSrcGlyph.js';   // t289 — the SAME inline source dot the built-in forms use, on sourceField bindings
import { getOutputs, getInputs, openToolLibrary } from './settingsPanel.js';
import { factsOf, factMm, factLabel, unitOf } from '../data/latheTools.js';   // t1325 — the tool's quick facts, and the ONE conversion for its unit   // t522 declared-I/O picker; t768 P1b the tool-library modal opener (pickable from a wizard)
import { ioInputSupported, ioEdgeOptions } from '../wizards/ioStepWizard.js';   // t522/t524 — the mode-picker greys INPUT on a post without wait-on-input; the Edge options are dialect-aware
import { getToolLibrary, getTool, toolsOfKinds } from '../wizards/toolPicker.js';   // t1325 — toolsOfKinds: an op offers only the kinds it declares it can hold   // t768 P1a — the tool picker lists settings.atc.tools (live) + auto-fills Ø/feeds on pick (one source = the table)
import { paramFieldsFromStack } from '../blocks/userOps.js';   // block-native-params S5.2 — the FORM-field declaration (param_field rows), when present
import { THREAD_PRESETS, threadPreset } from '../wizards/threads.js';   // t778 — the thread preset table for the tapping wizard's pitch picker
import { MATERIALS, suggestFeedsSpeeds } from '../wizards/materials.js';   // t867 — feeds & speeds: the material table + the classic RPM/feed math
import { isSectionCollapsed, setSectionCollapsed } from './panePrefs.js';   // t820 — collapsible form sections (app-wide per section kind)
import { applyState as applyFold } from './paneAccordion.js';   // t820 — REUSE the accordion motion engine (theme drawer tokens), not a duplicate
import { toDisp, fromDisp } from './units.js';   // t1008 — the ONE mm<->inch conversion leaf (shared with the tool-library editor + catalog picker)

// t522 — SEGMENT-GATE predicates (a declarative key → a live check). A segmented binding gates one segment via
// widgetConfig.gateSeg = { value, pred, fallback, tip }; the segment greys (+ data-op-gated) when pred() is false.
const SEG_GATE_PREDS = { ioInput: () => ioInputSupported() };

// t526 — DIALECT-AWARE segmented OPTIONS (a declarative key → a live { options, alias }). A binding declares
// widgetConfig.optionsBy = '<key>'; the segment renders THAT option set (narrowed per the active post) with the
// static widgetConfig.options as the fallback. `alias` maps a stored value to a shown one for the HIGHLIGHT only.
const SEG_OPTS_PREDS = { ioEdge: () => ioEdgeOptions() };

const SVGNS = 'http://www.w3.org/2000/svg';
// t820 — collapsible form sections: only forms with MORE than this many rows AND ≥2 declared sections render the fold
// chrome ("where sensible" — short forms stay plain). The chevron rotates off the section's [data-collapsed] (CSS).
const SECTION_THRESHOLD = 8;
const SEC_CHEVRON = '<svg class="form-sec-chev" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';
const escHtml = (s) => String(s == null ? '' : s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
const ROW_CSS = 'display:flex; align-items:center; justify-content:space-between; gap:14px; margin:9px 0;';
const CTRL_CSS = 'padding:5px 8px; background:var(--bg,#0b0f14); color:inherit; border:1px solid var(--border,#2a3340); border-radius:6px;';
const numOr = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
const r3 = (n) => Math.round(n * 1000) / 1000;
const clamp = (v, a, z) => Math.max(a, Math.min(z, v));

// ── t990 — dual mm/inch DISPLAY layer. mm is ALWAYS the authoritative, exact storage; inch/IPM is a DERIVED VIEW
// (1 in = 25.4 mm, and IPM = mm·min⁻¹ / 25.4). The stored mm NEVER re-derives from the rounded display, so emit is
// byte-identical. A field opts in by its declared `units`: 'mm' → length, 'mm/min' → feed; anything else → unchanged.
// t1008 — toDisp/fromDisp (the ÷/×25.4 core) now live in the shared units.js leaf; the display helpers below stay form-local.
const unitsOf = (b) => b.units || (b.widgetConfig && b.widgetConfig.units) || '';
const unitKindOf = (b) => { const u = unitsOf(b); return u === 'mm' ? 'length' : u === 'mm/min' ? 'feed' : null; };
/** The global display-unit preference ('mm' default | 'inch'). mm-native storage regardless. */
const displayUnit = () => { try { return (window.ddcsGetSettings && window.ddcsGetSettings().units === 'inch') ? 'inch' : 'mm'; } catch (_) { return 'mm'; } };
const dispLabel = (kind) => (kind === 'feed' ? 'IPM' : 'in');
/** The live "= X in / = X IPM" (mm-mode) or "= X mm" (inch-mode) hint text for a mm value. */
const hintText = (mm, kind) => {
    if (!Number.isFinite(mm)) return '';
    return displayUnit() === 'inch' ? `= ${r3(mm)} mm` : `= ${toDisp(mm)} ${dispLabel(kind)}`;
};

function labelSpan(b) {
    const span = document.createElement('span');
    span.textContent = b.label || b.param;
    // DECLARED HELP SLOT (1a): an optional `help` string on the binding renders as a native tooltip on the field
    // label — ONE declaration, every renderOpForm surface (the ported wizard form + the Blocks-tab form pane) shows
    // it for free. Dumb by design (native title=, no positioning framework); fields without `help` are unchanged.
    if (b.help) span.title = b.help;
    if (b.units || (b.widgetConfig && b.widgetConfig.units)) {
        const kind = unitKindOf(b);   // t990 — flip the suffix to (in)/(IPM) in inch display mode
        const u = document.createElement('span');
        u.style.opacity = '.6';
        u.textContent = ` (${kind && displayUnit() === 'inch' ? dispLabel(kind) : unitsOf(b)})`;
        span.appendChild(u);
    }
    return span;
}

// ── widgets: render(host, binding) → { read() } ───────────────────────────────────────────────────────────────
function numberWidget(host, b) {
    const cfg = b.widgetConfig || {};
    host.style.cssText = ROW_CSS;
    const inp = document.createElement('input');
    inp.type = 'number'; inp.step = cfg.step || 'any';
    const min = cfg.min ?? b.min, max = cfg.max ?? b.max;
    if (min != null) inp.min = min;
    if (max != null) inp.max = max;
    // t114 — a SOCKET-HELD field (no spec default → its `default` is the CANONICAL socket value, which varies per
    // structural combo) renders EMPTY with an "auto" placeholder: untouched = the template's per-combo socket expression
    // holds (see the read below). Others show their real default.
    if (b.socketHeld) { inp.value = ''; inp.placeholder = 'auto'; } else { inp.value = b.default ?? 0; }
    inp.style.cssText = CTRL_CSS + ' width:120px;';
    inp.dataset.param = b.param;   // so a 2D-preview handle can write this field back (drag-to-edit derives from roles)
    // t389 — a DRAG-DRIVEN binding (e.g. middle's diagTravel #21 / diagPrimary #22, set by the ② canvas handle) renders
    // READONLY: it DISPLAYS the drag-derived value but is not a competing editable input. A programmatic write (the 2D handle's
    // _writeParam sets .value + dispatches 'input') still lands + reads back — readOnly only blocks USER typing, not the drag.
    if (b.readonly) { inp.readOnly = true; inp.title = b.readonlyHint || 'Set by dragging the ② handle on the canvas'; inp.style.opacity = '0.6'; inp.style.cursor = 'default'; }
    // t311 — DECLARE the stepper (spinner) side. Default (unset / 'right') keeps the NATIVE right spinner UNCHANGED
    // (byte-identical). 'left' hides the native spinner and mounts a custom ▲▼ stepper ELEMENT, placed on the LEFT via
    // CSS flex `order` (a declared class, not a per-field hack). The read() closure below binds `inp` either way.
    if (cfg.stepperSide === 'left') {
        inp.classList.add('num-input-bare');   // CSS: hide the native inner spin-button (appearance:none)
        const stepper = document.createElement('span');
        stepper.className = 'num-stepper';
        const mkBtn = (dir, glyph) => {
            const bt = document.createElement('button');
            bt.type = 'button'; bt.tabIndex = -1; bt.className = 'num-step-btn'; bt.textContent = glyph;
            bt.addEventListener('click', () => {
                try { if (dir > 0) inp.stepUp(); else inp.stepDown(); }   // native stepUp respects step + min/max…
                catch (_) { inp.value = String((parseFloat(inp.value) || 0) + dir); }   // …but throws on step='any' → fall back to ±1
                inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true }));
            });
            return bt;
        };
        stepper.append(mkBtn(1, '▲'), mkBtn(-1, '▼'));
        const wrap = document.createElement('span');
        wrap.className = 'num-field num-stepper-left';   // flex [input][stepper]; `order:-1` on the stepper puts it LEFT
        wrap.append(inp, stepper);
        host.append(labelSpan(b), wrap);
    } else {
        host.append(labelSpan(b), inp);   // DEFAULT — native input + native right spinner (source-chips decorate the input in the renderOpForm post-pass)
    }
    // t990 — dual mm/inch DISPLAY: `inp` stays the AUTHORITATIVE mm (read()/drag/preview unchanged, byte-identical). A
    // unit-kind field (length 'mm' / feed 'mm/min') gets a live "= X in / IPM / mm" hint; in inch display mode a `shadow`
    // input shows + edits inch/IPM and syncs the EXACT mm back to `inp` (typed inch → ×25.4 → mm; storage never drifts).
    const kind = unitKindOf(b);
    if (kind && !b.readonly) {
        const hint = document.createElement('span');
        hint.className = 'num-unit-hint';
        // t1002 — the hint sits LEFT of the input (muted, right-aligned): margin-left:auto absorbs the free space so the
        // hint hugs the input, and the input column stays the clean right edge. Was appended far-right (stranded).
        hint.style.cssText = 'opacity:.55;font-size:.85em;margin-left:auto;margin-right:8px;white-space:nowrap;text-align:right;';
        const refreshHint = () => { hint.textContent = hintText(parseFloat(inp.value), kind); };
        refreshHint();
        inp.addEventListener('input', refreshHint);
        (inp.parentElement === host ? inp : inp.parentElement).before(hint);   // insert just before the input's host-level element
        if (displayUnit() === 'inch') {
            const shadow = document.createElement('input');
            shadow.type = 'number'; shadow.step = 'any'; shadow.style.cssText = inp.style.cssText;
            if (inp.placeholder) shadow.placeholder = inp.placeholder;
            const mm2disp = () => { shadow.value = (inp.value === '' ? '' : String(toDisp(parseFloat(inp.value) || 0))); };
            mm2disp();
            inp.style.display = 'none';   // keep `inp` in the DOM as the mm source of truth; show the inch shadow instead
            inp.after(shadow);
            shadow.addEventListener('input', () => {
                const d = parseFloat(shadow.value);
                inp.value = Number.isFinite(d) ? String(fromDisp(d)) : '';   // typed inch → EXACT mm (shared fromDisp = r3(d·25.4))
                inp.dispatchEvent(new Event('input', { bubbles: true }));
                inp.dispatchEvent(new Event('change', { bubbles: true }));
            });
            inp.addEventListener('input', () => { if (document.activeElement !== shadow) mm2disp(); });   // drag / programmatic mm write → refresh the inch view
        }
    }
    // An UNTOUCHED field must not inject a value that overwrites the template's own (per-structural-combo) socket:
    //   • t114 SOCKET-HELD (no spec default → the socket holds a per-combo expression, e.g. corner #21-#24 which change with
    //     corner×probeSeq): OMIT unless the user TYPED a finite number → instantiate keeps the pruned per-combo socket. This
    //     covers even a FINITE canonical default (#21='0' on YX, which is WRONG for XY) that the t109 numeric check missed.
    //   • t109 EXPRESSION default (a #var STRING, non-numeric): also omit when empty.
    // A typed number / drag literal is a real override and passes through; plain numeric-default fields are unchanged.
    return { read: () => {
        const n = parseFloat(inp.value);
        if (Number.isFinite(n)) return { [b.param]: n };   // the user typed a value → override
        if (b.socketHeld) return {};                        // untouched socket-held → the per-combo socket holds
        const v = numOr(inp.value, b.default ?? 0);         // else fall to the default; omit a non-numeric (expression) default
        return Number.isFinite(v) ? { [b.param]: v } : {};
    } };
}

function sliderWidget(host, b) {
    const cfg = b.widgetConfig || {};
    host.style.cssText = ROW_CSS;
    const wrap = document.createElement('span');
    wrap.style.cssText = 'display:flex; align-items:center; gap:8px;';
    const rng = document.createElement('input');
    rng.type = 'range';
    rng.min = cfg.min ?? b.min ?? 0; rng.max = cfg.max ?? b.max ?? 100; rng.step = cfg.step || 1;
    rng.value = b.default ?? rng.min;
    rng.dataset.param = b.param;   // 2D-preview handle can write this field back (drag-to-edit derives from roles)
    const out = document.createElement('span');
    out.style.cssText = 'min-width:42px; text-align:right; opacity:.85;';
    out.textContent = rng.value;
    rng.addEventListener('input', () => { out.textContent = rng.value; });
    wrap.append(rng, out);
    host.append(labelSpan(b), wrap);
    return { read: () => ({ [b.param]: numOr(rng.value, b.default ?? 0) }) };
}

function dropdownWidget(host, b) {
    host.style.cssText = ROW_CSS;
    const options = (b.widgetConfig && b.widgetConfig.options) || [];
    // t720 P1 (b) — a dropdown with ZERO options is a DECLARATION BUG (a missing widgetConfig.options), NOT a valid empty
    // state. Render a LOUD read-only fallback (flagged red, shows the value) + a dev-mode console error — never a silent
    // empty select that looks like a working control. The form-integrity spec (P3) + the fixed sources keep this dormant.
    if (options.length === 0) {
        if (typeof console !== 'undefined' && console.error) console.error(`formWidgets: enum "${b.param}" has no options (widgetConfig.options missing) — read-only fallback`);
        const ro = document.createElement('input');
        ro.type = 'text'; ro.readOnly = true; ro.value = String(b.default ?? '');
        ro.dataset.param = b.param; ro.title = `⚠ ${b.param}: no options declared`;
        ro.style.cssText = CTRL_CSS + ' min-width:120px; opacity:0.65; border-color:#c0392b;';
        host.append(labelSpan(b), ro);
        return { read: () => ({ [b.param]: b.default }) };
    }
    const sel = document.createElement('select');
    sel.style.cssText = CTRL_CSS + ' min-width:120px;';
    sel.dataset.param = b.param;   // t112 — targetable by [data-param] (parity with numeric fields) so a canvas picker (corner-selector) can set it + dispatch change
    if (b.optionGate) sel.dataset.optionGate = JSON.stringify(b.optionGate);   // t961 — a DECLARED per-option enable predicate the userOpView update loop reads (grey the option unless requireAll holds; auto-revert)
    for (const o of options) {
        const val = Array.isArray(o) ? o[1] : o, lab = Array.isArray(o) ? o[0] : o;
        const op = document.createElement('option');
        op.value = String(val); op.textContent = String(lab);
        if (String(val) === String(b.default)) op.selected = true;
        sel.appendChild(op);
    }
    host.append(labelSpan(b), sel);
    // numeric bindings (a param-block dropdown of presets) commit a number; enum/string keep the raw option value.
    const numeric = b.type === 'number' || b.type === 'int';
    return { read: () => ({ [b.param]: numeric ? numOr(sel.value, b.default ?? 0) : sel.value }) };
}

// t522 — the DECLARED-I/O picker: a dropdown that lists settings.outputs / settings.inputs BY NAME (live) plus a
// "Raw pin…" fallback. Value = the row id (or 'raw'). widgetConfig.kind = 'output' | 'input'. The I/O-step wizard
// resolves the id → the row's on/off M-code (output) / poll pin (input) at emit; relabel-proof (id join, not the label).
function declaredIoWidget(host, b) {
    host.style.cssText = ROW_CSS;
    const kind = (b.widgetConfig && b.widgetConfig.kind) || 'output';
    const rows = (kind === 'output' ? getOutputs() : getInputs()) || [];
    const sel = document.createElement('select');
    sel.style.cssText = CTRL_CSS + ' min-width:120px;';
    sel.dataset.param = b.param;
    const opts = [['Raw pin…', 'raw'], ...rows.filter((r) => r && r.label).map((r) => [r.label, String(r.id)])];
    for (const [lab, val] of opts) {
        const op = document.createElement('option');
        op.value = String(val); op.textContent = String(lab);
        if (String(val) === String(b.default)) op.selected = true;
        sel.appendChild(op);
    }
    host.append(labelSpan(b), sel);
    return { read: () => ({ [b.param]: sel.value }) };
}

// t768 P1a — the TOOL PICKER: a LIVE dropdown of the tool library (settings.atc.tools — T# · name · Ø) bound to the op's
// declared tool NUMBER (identity). Value = the T# ('' = no tool → the op's typed Ø owns the cut, the honest no-table
// fallback). On pick it AUTO-FILLS the sibling Ø / feed / plunge / rpm form fields from the table row (one source: the
// table you fill FROM), so the emit's cut-math and the sim agree; the user can still edit them after. The tip SHAPE is
// NEVER copied onto the op — the sim/carve resolve it from the table via toolNum (no drift). Reflows on settings-changed.
// (Phase 1b enriches each row with a tip glyph + a trailing ⚙ opening the tool-table modal.)
function toolPickWidget(host, b) {
    host.style.cssText = ROW_CSS;
    const sel = document.createElement('select');
    sel.style.cssText = CTRL_CSS + ' min-width:170px;';
    sel.dataset.param = b.param;
    const fill = () => {
        const keep = sel.value || String(b.default ?? '');
        sel.innerHTML = '';
        const mk = (val, lab) => { const o = document.createElement('option'); o.value = String(val); o.textContent = lab; sel.appendChild(o); };
        mk('', 'No tool (use typed Ø)');
        let lib = [];
        // t1325 — FILTERED BY THE KINDS THIS OP DECLARES IT CAN HOLD. A parting op offers blades; an op that declares
        // no kinds (every mill op) gets the whole library, so this is inert until a def opts in.
        const kinds = (b.widgetConfig && b.widgetConfig.toolKinds) || null;
        try { lib = kinds ? toolsOfKinds(kinds) : getToolLibrary(); } catch (_) { /* no settings yet */ }
        lib.forEach((t) => mk(t.num, t.label));
        sel.value = keep;
        if (String(sel.value) !== String(keep)) sel.value = '';   // the kept T# was deleted from the library → fall back to no-tool
    };
    fill();
    // AUTO-FILL on pick: write the table row's Ø / feeds into the sibling form fields (only ones that exist), then dispatch
    // input so update() re-reads (parity with the built-in views' toolPicker → setFields). Never runs headless (emit/instantiate).
    sel.addEventListener('change', () => {
        const tool = sel.value === '' ? null : getTool(sel.value);
        if (!tool) return;
        const form = host.parentElement;   // renderOpForm mounts every row under one container → siblings are queryable here
        if (!form) return;
        const put = (key, param) => { const el = form.querySelector(`[data-param="${param}"]`); if (el && tool[key] !== '' && tool[key] != null) { el.value = tool[key]; el.dispatchEvent(new Event('input', { bubbles: true })); } };
        // t871 — the target fields default to the MAIN tool cluster; a picker can override (e.g. the rest tool fills restDia).
        const fill = (b.widgetConfig && b.widgetConfig.fill) || { dia: 'toolDia', feed: 'feed', plunge: 'plunge', rpm: 'rpm' };
        for (const key in fill) put(key, fill[key]);
        // t1325 — A LATHE QUICK FACT PREFILLS ITS FIELD, converted HERE and nowhere else. The form field is the mm
        // number the program will carry, and a person has to be able to read it (odTurn's rule: the G-code moves only
        // through a number a person can read) — so an inch blade lands as 3.175 and the note says where it came from
        // and in what unit it was bought. The macro-header conversion (latheTools.factHeaderLine) is the same single
        // conversion for the other path, where a tool fact reaches a macro without passing through a form.
        for (const f of factsOf(tool.kind || '')) {
            const target = fill[f.key];
            if (!target) continue;
            const mm = factMm(tool, tool.kind, f.key);
            if (mm == null) continue;
            const el = form.querySelector(`[data-param="${target}"]`);
            if (!el) continue;
            el.value = mm;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            const row = el.closest('[data-row], label, div');
            const note = row && row.querySelector('.tool-fact-note');
            const txt = 'from T' + tool.num + ' — ' + factLabel(tool, tool.kind, f.key) + ' ' + tool[f.key] + (unitOf(tool) === 'inch' ? ' = ' + mm + ' mm' : '');
            if (note) note.textContent = txt;
            else if (row) { const n = document.createElement('span'); n.className = 'tool-fact-note'; n.style.cssText = 'margin-left:8px; font-size:11px; color:var(--text-dim,#8b93a1);'; n.textContent = txt; row.appendChild(n); }
        }
    });
    // LIVE: re-fill when the tool library changes (a tool added/edited in Settings). Detach when the row leaves the DOM.
    const onSettings = () => { if (!sel.isConnected) { if (typeof window !== 'undefined') window.removeEventListener('ddcs:settings-changed', onSettings); return; } fill(); };
    if (typeof window !== 'undefined') window.addEventListener('ddcs:settings-changed', onSettings);
    // t768 P1b — the ⚙ at the row's end opens the tool-table modal PICKABLE from a wizard (add-then-use has no dead end):
    // Use/double-click there selects the tool INTO this binding + closes. ONE composite widget, one binding — a custom
    // wizard carrying the tool atom inherits the picker + the gear. (From Settings the SAME modal opens edit-only.)
    const gear = document.createElement('button');
    gear.type = 'button'; gear.textContent = '⚙'; gear.title = 'Open the tool library — add or edit tools, then Use one';
    gear.style.cssText = 'margin-left:6px; padding:4px 9px; background:var(--panel,#232833); color:inherit; border:1px solid var(--border,#2a3340); border-radius:6px; cursor:pointer; flex:0 0 auto;';
    gear.addEventListener('click', () => {
        openToolLibrary({ onPick: (num) => { fill(); sel.value = String(num); sel.dispatchEvent(new Event('change', { bubbles: true })); } });
    });
    const right = document.createElement('span');
    right.style.cssText = 'display:inline-flex; align-items:center;';
    right.append(sel, gear);
    host.append(labelSpan(b), right);
    return { read: () => ({ [b.param]: sel.value === '' ? '' : numOr(sel.value, '') }) };
}

// t778 — the THREAD PICKER (tapping): a preset dropdown (metric coarse/fine · imperial UNC/UNF · Custom) + a pitch number,
// both driving the ONE `pitch` socket (the mm lead that locks the feed). Picking a preset fills the pitch; typing a pitch
// flips the dropdown to Custom (or the matching preset). Round-trip is on `pitch` (exact); the preset name is cosmetic.
function threadPickWidget(host, b) {
    host.style.cssText = ROW_CSS;
    const sel = document.createElement('select');
    sel.style.cssText = CTRL_CSS + ' min-width:150px;';
    const num = document.createElement('input');
    num.type = 'number'; num.step = '0.01'; num.min = '0';
    num.style.cssText = CTRL_CSS + ' width:78px; margin-left:6px;';
    num.dataset.param = b.param;   // the pitch value lives here (targetable + read from here)
    const mk = (val, lab) => { const o = document.createElement('option'); o.value = String(val); o.textContent = lab; sel.appendChild(o); };
    THREAD_PRESETS.forEach((t) => mk(t.name, t.name));
    mk('__custom__', 'Custom…');
    const r3p = (v) => Math.round(Number(v) * 1000) / 1000;
    // reflect a pitch value → the matching preset name (first match), else Custom
    const syncSel = () => { const p = r3p(num.value); const hit = THREAD_PRESETS.find((t) => r3p(t.pitch) === p); sel.value = hit ? hit.name : '__custom__'; };
    num.value = (b.default != null && b.default !== '') ? b.default : '1';
    syncSel();
    sel.addEventListener('change', () => {
        const preset = threadPreset(sel.value);
        if (preset) { num.value = r3p(preset.pitch); num.dispatchEvent(new Event('input', { bubbles: true })); }
        // Custom → leave the number for the user to type
    });
    num.addEventListener('input', syncSel);
    const right = document.createElement('span');
    right.style.cssText = 'display:inline-flex; align-items:center;';
    right.append(sel, num);
    host.append(labelSpan(b), right);
    return { read: () => ({ [b.param]: numOr(num.value, b.default ?? 1) }) };
}

// t323 — SEGMENTED control: a small enum (2-3 values) as a compact [ Auto | Manual ] toggle, both states VISIBLE (the
// selected one highlighted), one click writes the enum value. REUSES the enum read()/change path (no emit change) so a
// structural toggle (travelApproach) reprunes exactly as the dropdown did. Opt-in via widget:'segmented'.
function segmentedWidget(host, b) {
    host.style.cssText = ROW_CSS;
    // t526 — DIALECT-AWARE options: a `optionsBy` key selects a live { options, alias } (e.g. the Wait-Input Edge narrows to
    // High/Low on a level-only DDCS post); else the static widgetConfig.options. `alias` highlights a stored rise→high for
    // display only (read() still returns the raw value → emit unchanged).
    const optCfg = (b.widgetConfig && b.widgetConfig.optionsBy && SEG_OPTS_PREDS[b.widgetConfig.optionsBy]) ? SEG_OPTS_PREDS[b.widgetConfig.optionsBy]() : { options: (b.widgetConfig && b.widgetConfig.options) || [] };
    const opts = (optCfg.options || []).map((o) => (Array.isArray(o) ? o : [o, o]));
    const alias = optCfg.alias || {};
    let cur = b.default;
    const seg = document.createElement('div');
    seg.className = 'seg-control'; seg.setAttribute('role', 'group'); seg.dataset.param = b.param;   // [data-param] parity with the select
    const sync = () => { const shown = (alias[cur] != null) ? alias[cur] : cur; for (const bt of seg.children) { const on = bt.dataset.value === String(shown); bt.classList.toggle('seg-on', on); bt.setAttribute('aria-pressed', String(on)); } };
    for (const [label, value] of opts) {
        const bt = document.createElement('button');
        bt.type = 'button'; bt.className = 'seg-btn'; bt.textContent = String(label); bt.dataset.value = String(value);
        bt.addEventListener('click', () => { if (String(value) === String(cur)) return; cur = value; sync(); seg.dispatchEvent(new Event('change', { bubbles: true })); });   // bubbles → the form's delegated change listener → update() re-emits + reprunes
        seg.appendChild(bt);
    }
    sync();
    // t510 — gateAuto: AUTO needs a stock reference. GREY the 'auto' segment (tooltip) when no usable stock, and fall the
    // value to 'manual'; re-enable when a stock is placed (the settings-changed event, dynamic while the form is open).
    // `data-op-gated` survives postGating's blanket cap-ON re-enable (op-view gating owns the disabled state).
    if (b.widgetConfig && b.widgetConfig.gateAuto) {
        const autoBtn = [...seg.children].find((bt) => bt.dataset.value === 'auto');
        const stockOk = () => { const s = (typeof window !== 'undefined' && window.ddcsGetSettings && window.ddcsGetSettings().stock) || null; return !!(s && Number(s.x) > 0 && Number(s.y) > 0 && s.show !== false); };
        const applyGate = () => {
            const ok = stockOk();
            if (autoBtn) {
                autoBtn.disabled = !ok;
                autoBtn.setAttribute('data-op-gated', ok ? 'off' : 'on');
                autoBtn.title = ok ? '' : 'Place a stock/datum to use AUTO';
                autoBtn.style.opacity = ok ? '' : '0.4'; autoBtn.style.cursor = ok ? '' : 'not-allowed';
            }
            if (!ok && String(cur) === 'auto') { cur = 'manual'; sync(); seg.dispatchEvent(new Event('change', { bubbles: true })); }
        };
        applyGate();
        const onSettings = () => { if (!seg.isConnected) { window.removeEventListener('ddcs:settings-changed', onSettings); return; } applyGate(); };
        if (typeof window !== 'undefined') window.addEventListener('ddcs:settings-changed', onSettings);
    }
    // t522 — generic segment gate: grey ONE segment (e.g. Input on a post without wait-on-input) + fall to a fallback.
    if (b.widgetConfig && b.widgetConfig.gateSeg && SEG_GATE_PREDS[b.widgetConfig.gateSeg.pred]) {
        const g = b.widgetConfig.gateSeg, pred = SEG_GATE_PREDS[g.pred];
        const gBtn = [...seg.children].find((bt) => bt.dataset.value === String(g.value));
        const applyGate = () => {
            const ok = pred();
            if (gBtn) {
                gBtn.disabled = !ok;
                gBtn.setAttribute('data-op-gated', ok ? 'off' : 'on');   // survives postGating's blanket cap-ON re-enable
                gBtn.title = ok ? '' : (g.tip || '');
                gBtn.style.opacity = ok ? '' : '0.4'; gBtn.style.cursor = ok ? '' : 'not-allowed';
            }
            if (!ok && String(cur) === String(g.value)) { cur = g.fallback; sync(); seg.dispatchEvent(new Event('change', { bubbles: true })); }
        };
        applyGate();
        const onSettings = () => { if (!seg.isConnected) { window.removeEventListener('ddcs:settings-changed', onSettings); return; } applyGate(); };
        if (typeof window !== 'undefined') window.addEventListener('ddcs:settings-changed', onSettings);
    }
    host.append(labelSpan(b), seg);
    const numeric = b.type === 'number' || b.type === 'int';
    return { read: () => ({ [b.param]: numeric ? numOr(cur, b.default ?? 0) : cur }) };
}

function toggleWidget(host, b) {
    host.style.cssText = ROW_CSS;
    const lab = document.createElement('label');
    lab.className = 'ddcs-switch';
    lab.innerHTML = '<input type="checkbox"><span class="ddcs-slider"></span>';
    const cb = lab.querySelector('input');
    cb.checked = !!b.default;
    cb.dataset.param = b.param;   // [data-param] parity with the other widgets — targetable for post-gating + form-read
    host.append(labelSpan(b), lab);
    // a bool binding commits true/false; a numeric param-block toggle commits 1/0 (it lands in a numeric socket).
    const numeric = b.type === 'number' || b.type === 'int';
    return { read: () => ({ [b.param]: numeric ? (cb.checked ? 1 : 0) : cb.checked }) };
}

function textWidget(host, b) {
    host.style.cssText = ROW_CSS;
    const inp = document.createElement('input');
    inp.type = 'text'; inp.value = b.default ?? '';
    inp.style.cssText = CTRL_CSS + ' width:150px;';
    inp.dataset.param = b.param;   // [data-param] parity with the other widgets — targetable for post-gating / source-chips / form-read (the Comm text fields surfaced the gap)
    host.append(labelSpan(b), inp);
    return { read: () => ({ [b.param]: inp.value }) };
}

// the 3×3 datum picker — the SAME core (cornerGridSvg.js) the Blockly field_cornergrid + wizard pathAnchorField use.
// Value is a 2-char [X][Y] code (n/c/p = min/centre/max); '' = follow (only reachable when widgetConfig.allowFollow).
const CORNER_NAMES = { nn: 'front-left', cn: 'front', pn: 'front-right', nc: 'left', cc: 'centre', pc: 'right', np: 'back-left', cp: 'back', pp: 'back-right' };
function cornerGridWidget(host, b) {
    const cfg = b.widgetConfig || {};
    const colour = cfg.colour || '#4ab3ff';
    host.style.cssText = ROW_CSS;
    let cur = (b.default != null) ? String(b.default) : '';
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('width', CG.SPAN); svg.setAttribute('height', CG.SPAN); svg.setAttribute('viewBox', `0 0 ${CG.SPAN} ${CG.SPAN}`);
    svg.style.cursor = 'pointer';
    const { cells, cross } = buildCornerCells(svg);
    for (const code in cells) { const t = document.createElementNS(SVGNS, 'title'); t.textContent = CORNER_NAMES[code]; cells[code].appendChild(t); }
    const repaint = () => paintCornerGrid(cells, cross, colour, cur);
    svg.addEventListener('click', (e) => {                          // crosshair lines are pointer-transparent → e.target is the cell rect
        const code = e.target && e.target.getAttribute && e.target.getAttribute('data-code');
        if (!code) return;
        cur = (cur === code && cfg.allowFollow) ? '' : code;        // re-click → follow, only if the binding allows it
        repaint();
    });
    repaint();
    host.append(labelSpan(b), svg);
    return { read: () => ({ [b.param]: cur }) };
}

// the REGION-PICK control — a "make your own datum": click a region (rect/poly/freeform) on an optional backdrop;
// the picked region's NUMBER is committed (binds to a numeric socket → valid by construction). Shares its core
// (regionPickSvg.js) with the Blockly field, exactly like the datum. spec lives in widgetConfig {viewBox, backdrop,
// regions:[{shape,…,value,label}]}.
function regionPickWidget(host, b) {
    const cfg = b.widgetConfig || {};
    host.style.cssText = 'display:flex; flex-direction:column; gap:6px; margin:10px 0;';
    host.appendChild(labelSpan(b));
    const first = (cfg.regions && cfg.regions[0] && cfg.regions[0].value);
    let cur = (b.default != null) ? b.default : (first != null ? first : 0);
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('width', '100%');
    svg.style.cssText = 'width:100%; max-width:320px; border:1px solid var(--border,#2a3340); border-radius:8px; background:var(--bg,#0b0f14);';
    const regions = buildRegions(svg, cfg);
    const echo = document.createElement('div');   // echo the picked region's LABEL — what was committed, not just the lit shape
    echo.style.cssText = 'font-size:11px; opacity:.8; min-height:14px;';
    const updateEcho = () => { const l = regionLabel(cfg, cur); echo.textContent = l ? `▸ ${l}` : ''; };
    const repaint = () => { paintRegions(regions, cur); updateEcho(); };
    svg.addEventListener('click', (e) => {
        const v = regionValueFromEvent(regions, e);   // topmost-wins (SVG paint order); single-select → one `cur`
        if (v == null) return;
        cur = v; repaint(); host.dispatchEvent(new Event('input', { bubbles: true }));
    });
    repaint();
    host.append(svg, echo);
    return { read: () => ({ [b.param]: numOr(cur, b.default ?? 0) }) };
}

// ── canvas pickers (multi-param) ─────────────────────────────────────────────────────────────────────────────
// FORM-ONLY widgets built on FeatureCanvas (the same engine the built-in wizards' 2D layout uses): a draggable
// handle drives several params at once. A canvas inside a Blockly block is deliberately NOT attempted — the block
// renders those params as plain fields (the seam for a future mini-canvas block field stays open, unused). Each
// takes the binding GROUP (bindings sharing `group`, each tagged with a `role`: x/y/w/h) and reads every param.
function resolveBounds(cfg) {
    if (cfg.bounds && cfg.bounds.w > 0 && cfg.bounds.h > 0) return cfg.bounds;          // explicit {w,h,ox,oy}
    const s = (typeof window !== 'undefined' && window.ddcsGetSettings && (window.ddcsGetSettings().stock)) || null;
    if (s && s.x > 0 && s.y > 0) return { w: s.x, h: s.y, ox: 0, oy: 0 };               // the real stock, when there is one
    return { w: cfg.w || 200, h: cfg.h || 150, ox: 0, oy: 0 };                          // a neutral default canvas
}
function canvasHost(host, b) {
    host.style.cssText = 'display:flex; flex-direction:column; gap:6px; margin:10px 0;';
    host.appendChild(labelSpan(b));
    const c = document.createElement('div');
    c.style.cssText = `width:100%; height:${(b.widgetConfig && b.widgetConfig.height) || 175}px; border:1px solid var(--border,#2a3340); border-radius:8px; overflow:hidden;`;
    host.appendChild(c);
    return c;
}
const rolesOf = (group, primary) => { const m = {}; for (const g of (group && group.length ? group : [primary])) m[g.role || 'x'] = g; return m; };

function xyPadWidget(host, primary, group) {
    const role = rolesOf(group, primary), bx = role.x, by = role.y;
    const bd = resolveBounds(primary.widgetConfig || {});
    let x = numOr(bx && bx.default, bd.ox + bd.w / 2), y = numOr(by && by.default, bd.oy + bd.h / 2);
    const c = canvasHost(host, primary), layout = new FeatureCanvas();
    const draw = () => layout.render(c, {
        stock: { w: bd.w, h: bd.h, ox: bd.ox, oy: bd.oy },
        items: [...workpieceFeatureItems(bd.ox, bd.oy), { kind: 'hole', x, y, n: 1, r: Math.max(1, bd.w * 0.012) }],
        handles: [{ id: 'pt', x, y, kind: 'move', label: 'pos' }],
        onDrag: (id, w) => { x = clamp(w.x, bd.ox, bd.ox + bd.w); y = clamp(w.y, bd.oy, bd.oy + bd.h); draw(); host.dispatchEvent(new Event('input', { bubbles: true })); },
    });
    requestAnimationFrame(draw);                                                        // wait for the host to have a size
    return { read: () => ({ [bx.param]: r3(x), [by.param]: r3(y) }) };
}

// COORDINATE-LIST positioner — a GROUP of XY points (each a draggable marker on the shared FeatureCanvas) + a
// shared Z, with add/delete. The first LIST-valued instance of the parametric-canvas atom ("(state → picture) +
// (interaction → Δstate)"), state = { points:[{x,y}], z }. The editing CORE is buildCoordEditor — shared by the
// FORM widget (coordListWidget, live, embedded in the row) AND the in-block ✎ editor (openCoordEditor, a modal,
// opened from blocks/devMode). One editing core, no divergence. (Per-point Z is a later option.)

/** Build the coordinate-list editor (FeatureCanvas points + ＋Point/✕ + shared Z) into `host`. Calls onChange()
 *  after every edit. initial = { points:[{x,y}], z }; cfg = widgetConfig (height/bounds). Returns { read }. */
export function buildCoordEditor(host, initial, onChange, cfg = {}) {
    const bd = resolveBounds(cfg);
    const d = (initial && typeof initial === 'object') ? initial : {};
    let points = Array.isArray(d.points) ? d.points.map((p) => ({ x: numOr(p.x, 0), y: numOr(p.y, 0) })) : [];
    let z = numOr(d.z, 0);
    const fire = () => { if (onChange) onChange(); };

    const cv = document.createElement('div'); cv.className = 'cl-canvas';
    cv.style.cssText = `width:100%; height:${cfg.height || 175}px; border:1px solid var(--border,#2a3340); border-radius:8px; overflow:hidden;`;
    host.appendChild(cv);
    const layout = new FeatureCanvas();
    const draw = () => layout.render(cv, {
        stock: { w: bd.w, h: bd.h, ox: bd.ox, oy: bd.oy },
        items: [...workpieceFeatureItems(bd.ox, bd.oy), ...points.map((p, i) => ({ kind: 'hole', x: p.x, y: p.y, n: i + 1, r: Math.max(1.5, bd.w * 0.012) }))],
        handles: points.map((p, i) => ({ id: 'p' + i, x: p.x, y: p.y, kind: 'move' })),
        onDrag: (id, w) => { const i = +id.slice(1); if (points[i]) { points[i] = { x: clamp(w.x, bd.ox, bd.ox + bd.w), y: clamp(w.y, bd.oy, bd.oy + bd.h) }; renderList(); draw(); fire(); } },
    });
    requestAnimationFrame(draw);

    const row = document.createElement('div'); row.style.cssText = 'display:flex; gap:8px; align-items:center; flex-wrap:wrap;';
    const addBtn = document.createElement('button'); addBtn.type = 'button'; addBtn.className = 'cl-add'; addBtn.textContent = '＋ Point';
    addBtn.style.cssText = CTRL_CSS + ' cursor:pointer;';
    addBtn.addEventListener('click', () => { points.push({ x: r3(bd.ox + bd.w / 2), y: r3(bd.oy + bd.h / 2) }); renderList(); draw(); fire(); });
    const zWrap = document.createElement('label'); zWrap.style.cssText = 'display:flex; align-items:center; gap:4px; font-size:11px;';
    const zInp = document.createElement('input'); zInp.type = 'number'; zInp.step = 'any'; zInp.className = 'cl-z'; zInp.value = z; zInp.style.cssText = CTRL_CSS + ' width:80px;';
    zInp.addEventListener('input', () => { z = numOr(zInp.value, 0); fire(); });
    zWrap.append(document.createTextNode('Z (shared)'), zInp);
    row.append(addBtn, zWrap);
    host.appendChild(row);

    const list = document.createElement('div'); list.className = 'cl-list'; list.style.cssText = 'font-size:11px; max-height:90px; overflow:auto;';
    function renderList() {
        list.innerHTML = '';
        points.forEach((p, i) => {
            const r = document.createElement('div'); r.style.cssText = 'display:flex; gap:6px; align-items:center; padding:2px 0;';
            r.append(document.createTextNode(`${i + 1}: ${r3(p.x)}, ${r3(p.y)}`));
            const del = document.createElement('button'); del.type = 'button'; del.className = 'cl-del'; del.textContent = '✕';
            del.style.cssText = 'cursor:pointer; background:transparent; border:none; color:inherit; opacity:.6;';
            del.addEventListener('click', () => { points.splice(i, 1); renderList(); draw(); fire(); });
            r.appendChild(del); list.appendChild(r);
        });
    }
    renderList();
    host.appendChild(list);

    return { read: () => ({ points: points.map((p) => ({ x: r3(p.x), y: r3(p.y) })), z: r3(z) }) };
}

function coordListWidget(host, b) {
    host.style.cssText = 'display:flex; flex-direction:column; gap:6px; margin:10px 0;';
    host.appendChild(labelSpan(b));
    const core = buildCoordEditor(host, b.default, () => host.dispatchEvent(new Event('input', { bubbles: true })), b.widgetConfig || {});
    return { read: () => ({ [b.param]: core.read() }) };
}

/** The in-block ✎ editor: the coordinate-list editor in a modal. initial = { points, z }; onSave(next) on Done.
 *  Shares buildCoordEditor with the form widget — one editing core, no divergence (blocks/devMode opens this). */
export function openCoordEditor(initial, onSave) {
    document.getElementById('cl-modal')?.remove();
    const m = document.createElement('div'); m.id = 'cl-modal';
    m.innerHTML = `<style>
        #cl-modal{position:fixed;inset:0;z-index:1200;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);}
        #cl-modal .cl-panel{background:var(--panel);color:var(--text-main);border:1px solid var(--border);border-radius:8px;width:min(560px,96vw);max-height:94vh;display:flex;flex-direction:column;box-shadow:0 14px 48px rgba(0,0,0,.5);}
        #cl-modal .cl-head{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid var(--border);font-weight:700;}
        #cl-modal .cl-head button{background:transparent;border:none;color:var(--text-dim);font-size:18px;cursor:pointer;}
        #cl-modal .cl-mbody{display:flex;flex-direction:column;gap:8px;padding:12px 14px;overflow:auto;}
        #cl-modal .cl-foot{padding:10px 14px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px;}
        #cl-modal .cl-foot button{padding:6px 14px;border-radius:6px;border:1px solid var(--border);background:var(--accent,#0ea5e9);color:#fff;cursor:pointer;}
    </style>`;
    const panel = document.createElement('div'); panel.className = 'cl-panel';
    const head = document.createElement('div'); head.className = 'cl-head';
    const title = document.createElement('span'); title.textContent = 'Edit positions';
    const x = document.createElement('button'); x.type = 'button'; x.textContent = '✕';
    head.append(title, x);
    const body = document.createElement('div'); body.className = 'cl-mbody';
    const foot = document.createElement('div'); foot.className = 'cl-foot';
    const done = document.createElement('button'); done.type = 'button'; done.textContent = 'Done'; done.setAttribute('data-cl', 'done');
    foot.appendChild(done);
    panel.append(head, body, foot); m.appendChild(panel); document.body.appendChild(m);

    const core = buildCoordEditor(body, initial, null, {});
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const close = () => { m.remove(); document.removeEventListener('keydown', onKey, true); };
    document.addEventListener('keydown', onKey, true);
    x.addEventListener('click', close);
    m.addEventListener('mousedown', (e) => { if (e.target === m) close(); });   // scrim-close
    done.addEventListener('click', () => { try { if (onSave) onSave(core.read()); } finally { close(); } });
}

function rectPadWidget(host, primary, group) {
    const role = rolesOf(group, primary), bx = role.x, by = role.y, bw = role.w, bh = role.h;
    const bd = resolveBounds(primary.widgetConfig || {});
    let x = numOr(bx && bx.default, bd.ox + bd.w * 0.25), y = numOr(by && by.default, bd.oy + bd.h * 0.25);
    let w = numOr(bw && bw.default, bd.w * 0.5), h = numOr(bh && bh.default, bd.h * 0.5);
    const c = canvasHost(host, primary), layout = new FeatureCanvas();
    const draw = () => layout.render(c, {
        stock: { w: bd.w, h: bd.h, ox: bd.ox, oy: bd.oy },
        items: [...workpieceFeatureItems(bd.ox, bd.oy), { kind: 'rect', x, y, w, h }],
        handles: [
            { id: 'origin', x, y, kind: 'move', label: 'xy' },
            { id: 'size', x: x + w, y: y + h, kind: 'size', label: 'W', value: w },
        ],
        onDrag: (id, p) => {
            if (id === 'origin') { x = clamp(p.x, bd.ox, bd.ox + bd.w); y = clamp(p.y, bd.oy, bd.oy + bd.h); }
            else { w = Math.max(1, p.x - x); h = Math.max(1, p.y - y); }
            draw();
            host.dispatchEvent(new Event('input', { bubbles: true }));
        },
    });
    requestAnimationFrame(draw);
    return { read: () => ({ [bx.param]: r3(x), [by.param]: r3(y), [bw.param]: r3(w), [bh.param]: r3(h) }) };
}

// t554 — an ACTION button (contributes NO param): opens a modal declared by `b.action` (e.g. homing's 'Homing Setup…').
// A lazy dynamic import avoids a formWidgets↔settingsPanel cycle. read() returns {} so renderOpForm's reader loop is happy.
function actionWidget(host, b) {
    host.style.cssText = ROW_CSS;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.textContent = b.label || 'Open…';
    btn.dataset.param = b.param;
    btn.style.cssText = 'padding:6px 14px; border-radius:6px; border:1px solid var(--border,#3a4150); background:var(--panel,#232833); color:var(--text-main,#dfe6ef); cursor:pointer; font-size:13px;';
    btn.addEventListener('click', () => {
        if (b.action === 'homingSetup') import('./settingsPanel.js').then((m) => m.openHomingSetup && m.openHomingSetup()).catch(() => {});
        else if (b.action === 'atcSettings') import('./settingsPanel.js').then((m) => m.openAtcSetup && m.openAtcSetup()).catch(() => {});   // t566 — the Tool Change twin's "ATC Settings…" (magazine, drawbar I/O, changer)
        else if (b.action === 'atcTableEdit') import('./settingsPanel.js').then((m) => m.openAtcSetup && m.openAtcSetup()).catch(() => {});   // t568 — the Tool Table twin's "Edit table…" (the ONE tool library + magazine editor)
    });
    host.appendChild(btn);
    return { read: () => ({}) };
}

// t867 — the FEEDS & SPEEDS working string (the tooltip): the material · tool · the formula worked through · the honest
// ranges · any spindle clamp. Shown on the button + the inline note so the suggestion is transparent, never a magic number.
function feedsWorking(s, matName, dia) {
    const range = s.clamped === 'max' ? `clamped to spindle max ${s.spindle.maxRpm} (wanted ${s.wantedRpm})`
        : s.clamped === 'min' ? `clamped to spindle min ${s.spindle.minRpm} (wanted ${s.wantedRpm})`
        : `spindle ${s.spindle.minRpm}–${s.spindle.maxRpm || '∞'}, in range`;
    return `${matName} · Ø${dia} · ${s.flutes} flute${s.flutes === 1 ? '' : 's'}\n`
        + `RPM = ${s.surfaceSpeed}×1000 / (π×${dia}) = ${s.wantedRpm} → ${s.rpm}  (${range})\n`
        + `feed = ${s.rpm} × ${s.flutes} × ${s.chipLoad} = ${s.feed} mm/min\n`
        + `SS ${s.ssRange[0]}–${s.ssRange[1]} m/min · chip ${s.chipRange[0]}–${s.chipRange[1]} mm/flute — advisory, tune to taste`;
}

// t867 — FEEDS & SPEEDS helper widget (the toolPickWidget composite pattern): a material dropdown + an advisory
// "Suggest feed" button. On click it reads the picked material + the resolved tool (Ø from the toolDia field or the
// selected tool; flutes from the selected tool, else 2) + the declared spindle range, computes the classic RPM/feed,
// and FILLS the sibling feed field (+ rpm where such a field exists) — dispatching input so the op re-emits. It NEVER
// auto-fills; the user clicks apply and owns the numbers ([[dont-declare-away-user-responsibility]]). The button/note
// show the full working. The material param round-trips like a dropdown; an EMPTY pick is omitted from params, so the
// emit stays byte-identical (material drives no G-code socket).
function feedSuggestWidget(host, b) {
    host.style.cssText = ROW_CSS;
    const sel = document.createElement('select');
    sel.style.cssText = CTRL_CSS + ' min-width:130px;';
    sel.dataset.param = b.param;
    const mk = (val, lab) => { const o = document.createElement('option'); o.value = String(val); o.textContent = lab; if (String(val) === String(b.default ?? '')) o.selected = true; sel.appendChild(o); };
    mk('', 'Material…');   // '' = none → no suggestion, byte-identical emit
    MATERIALS.forEach((m) => mk(m.name, m.name));

    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'feedsuggest-btn'; btn.textContent = '✨ Suggest feed';
    btn.title = 'Suggest a feed from the material, the tool Ø / flutes, and the declared spindle range';
    btn.style.cssText = 'margin-left:6px; padding:4px 9px; background:var(--panel,#232833); color:inherit; border:1px solid var(--border,#2a3340); border-radius:6px; cursor:pointer; flex:0 0 auto;';
    const note = document.createElement('span');
    note.className = 'feedsuggest-note';
    note.style.cssText = 'margin-left:8px; font-size:11px; opacity:.75; flex:0 0 auto;';

    btn.addEventListener('click', () => {
        const form = host.closest('#wiz_user_form') || host.parentElement; if (!form) return;
        const matName = sel.value;
        if (!matName) { note.textContent = 'Pick a material first.'; note.title = ''; return; }
        const toolNumEl = form.querySelector('[data-param="toolNum"]');
        const tool = (toolNumEl && toolNumEl.value !== '') ? getTool(toolNumEl.value) : null;
        const toolDiaEl = form.querySelector('[data-param="toolDia"]');
        const dia = (toolDiaEl && toolDiaEl.value !== '') ? numOr(toolDiaEl.value, 0) : (tool ? numOr(tool.dia, 0) : 0);
        const flutes = tool ? numOr(tool.flutes, 0) : 0;   // 0 → the helper defaults to 2
        const spindle = (typeof window !== 'undefined' && window.ddcsGetSettings) ? (window.ddcsGetSettings().spindle || {}) : {};
        const s = suggestFeedsSpeeds({ materialName: matName, dia, flutes, spindle });
        if (!s) { note.textContent = 'Set a tool Ø first (pick a tool or type Tool Ø).'; note.title = ''; return; }
        const feedEl = form.querySelector('[data-param="feed"]');
        if (feedEl) { feedEl.value = s.feed; feedEl.dispatchEvent(new Event('input', { bubbles: true })); }
        const rpmEl = form.querySelector('[data-param="rpm"]');   // no rpm field on pocket/drill today → no-op; future-proof
        if (rpmEl) { rpmEl.value = s.rpm; rpmEl.dispatchEvent(new Event('input', { bubbles: true })); }
        const working = feedsWorking(s, matName, dia);
        btn.title = working; note.title = working;
        note.textContent = s.clamped ? `feed ${s.feed} · RPM ${s.rpm} (clamped)` : `feed ${s.feed} · RPM ${s.rpm}`;
    });

    const right = document.createElement('span');
    right.style.cssText = 'display:inline-flex; align-items:center; flex-wrap:wrap; gap:2px;';
    right.append(sel, btn, note);
    host.append(labelSpan(b), right);
    return { read: () => (sel.value ? { [b.param]: sel.value } : {}) };   // omit when empty → byte-identical (material drives no socket)
}

// t933 B2b-2c-2 — the PLANE-SUGGEST widget (the feedSuggest composite pattern) for a clearance-plane work-Z field: a
// number input + an advisory "✨ Suggest" button + an inline FLOOR warn. Suggest fills the declared stock top + the
// safe-Z margin (suggestedPlaneZ, shared with the middle wizard) on click only — never auto; the user owns the value
// ([[dont-declare-away-user-responsibility]]; clamps/fixtures are theirs, the B2b-3 pre-flight is the runtime catch).
// The warn shows when the entered work-Z sits BELOW the declared stock top (it WARNS, never clamps). Reusable across
// data-ops via widget:'plane-suggest'; reads app state through the shared workpiece helpers (no new architecture).
function planeSuggestWidget(host, b) {
    const cfg = b.widgetConfig || {};
    // t939 B2b-3 — the FLOOR warn ("may cross into the part") is OPT-IN (widgetConfig.floorWarn). Only an op whose clearance
    // traverse actually CROSSES the material (a middle / inside feature) sets it; an OUTSIDE-corner traverse stays OUTSIDE the
    // stock (traced), so the corner omits it — the warn there was a false alarm. The Suggest button + the field are unchanged.
    const withWarn = !!cfg.floorWarn;
    host.style.cssText = ROW_CSS;
    const inp = document.createElement('input');
    inp.type = 'number'; inp.step = cfg.step || 'any';
    inp.value = b.default ?? 0;
    inp.dataset.param = b.param;   // so [data-param="planeZ"] resolves (round-trip + the form drive) exactly like a plain number field
    inp.style.cssText = CTRL_CSS + ' width:110px;';
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'plane-suggest-btn'; btn.textContent = '✨ Suggest';
    btn.title = 'Fill with the declared stock top + the safe-Z margin. Advisory — the system knows only the DECLARED stock; clamps and fixtures are yours to add, so raise it if needed.';
    btn.style.cssText = 'margin-left:6px; padding:4px 9px; background:var(--panel,#232833); color:inherit; border:1px solid var(--border,#2a3340); border-radius:6px; cursor:pointer; flex:0 0 auto;';
    let warn = null;
    if (withWarn) {
        warn = document.createElement('span');
        warn.className = 'plane-floor-warn hidden';
        warn.style.cssText = 'flex:1 0 100%; margin-top:4px; font-size:11px; color:#e0a030;';
        warn.textContent = '⚠ below the declared stock top — this traverse may cross into the part (check clamps / fixtures)';
    }
    const refreshWarn = () => {
        if (!warn) return;
        const top = stockTopWorkZ();
        const v = parseFloat(inp.value);
        warn.classList.toggle('hidden', !(top != null && Number.isFinite(v) && v < top));
    };
    btn.addEventListener('click', () => {
        const s = suggestedPlaneZ(); if (s == null) return;   // no declared stock → the assist stays quiet
        inp.value = String(s); inp.dispatchEvent(new Event('input', { bubbles: true })); refreshWarn();
    });
    inp.addEventListener('input', refreshWarn);
    const right = document.createElement('span');
    right.style.cssText = 'display:inline-flex; align-items:center; flex-wrap:wrap; justify-content:flex-end; gap:2px;';
    right.append(inp, btn);
    if (warn) right.append(warn);
    host.append(labelSpan(b), right);
    refreshWarn();
    return { read: () => {
        const n = parseFloat(inp.value);
        if (Number.isFinite(n)) return { [b.param]: n };
        const v = numOr(inp.value, b.default ?? 0);
        return Number.isFinite(v) ? { [b.param]: v } : {};
    } };
}

export const FORM_WIDGETS = {
    number: numberWidget,
    feedsuggest: feedSuggestWidget,
    'plane-suggest': planeSuggestWidget,
    slider: sliderWidget,
    dropdown: dropdownWidget,
    segmented: segmentedWidget,
    toggle: toggleWidget,
    text: textWidget,
    action: actionWidget,
    'declared-io': declaredIoWidget,
    toolpick: toolPickWidget,
    threadpick: threadPickWidget,
    'corner-grid': cornerGridWidget,
    'region-pick': regionPickWidget,
    'coord-list': coordListWidget,
    'xy-pad': xyPadWidget,
    rect: rectPadWidget,
};

// widgets that bind a GROUP of params (the form renders ONE widget for the whole group, not one per binding).
export const MULTI_WIDGETS = new Set(['xy-pad', 'rect']);

const DEFAULT_BY_TYPE = { number: 'number', int: 'number', enum: 'dropdown', bool: 'toggle', string: 'text' };

/** Pick the form widget for a binding: its declared `widget`, else a sensible default for its `type`. */
export function resolveFormWidget(b) {
    if (b && b.widget && FORM_WIDGETS[b.widget]) return FORM_WIDGETS[b.widget];
    return FORM_WIDGETS[DEFAULT_BY_TYPE[(b && b.type) || 'number'] || 'number'];
}

/** Render a UNIT (a single binding, or a group of bindings sharing a multi-param widget) into host.
 *  Returns { read() → { param: value, … } }. The widget gets (host, primaryBinding, group). */
export function renderFormWidget(host, unit) {
    const group = Array.isArray(unit) ? unit : [unit];
    return resolveFormWidget(group[0])(host, group[0], group);
}

/** Render a whole op's BINDINGS into host as one row per unit (single binding, or a group sharing a multi-param
 *  widget). Returns the readers [() → {param: value}]. Shared by the modal (userOpForm) and the panel view. */
// t796 P4 — DECLARED FIELD DEEP-LINKS. A binding declares where its truth LIVES (or inherits a per-PARAM default below);
// renderOpForm shows a row-end gear that opens it OVER the wizard with the return-glow (the Homing-⚙ precedent). The slot
// is pure DATA — no per-wizard link code. `link: { kind:'settings', group, panel, scrollTo?, label? }  |  { kind:'modal', open() }`
export const WCS_LINK = { kind: 'settings', group: 'controller', panel: 'set_tab_wcs', label: 'the WCS table' };
// ONE source: the wcs PARAM links to the WCS table wherever it renders — every twin inherits, no per-twin declaration.
export const FIELD_LINKS = { wcs: WCS_LINK };
export function fieldLinkFor(b) { return (b && b.link) || (b && FIELD_LINKS[b.param]) || null; }

/** Open a declared field-link OVER the current surface, with a return to it (the glow). Reused by the stock modal + tests. */
export function openFieldLink(link) {
    if (!link) return;
    if (link.kind === 'settings') {
        Promise.all([import('./settingsPanel.js'), import('./navReturn.js')]).then(([SP, NR]) => {
            if (SP.openSettings) SP.openSettings({ group: link.group, panel: link.panel, scrollTo: link.scrollTo, returnToken: NR.pushReturn(link.returnLabel || 'Wizard', () => {}) });
        }).catch(() => {});
    } else if (link.kind === 'modal' && typeof link.open === 'function') { try { link.open(); } catch (_) { /* */ } }
}

/** A row-end gear that deep-links to where a field's truth lives. Returns null if the binding declares no link. */
export function linkGear(link) {
    if (!link) return null;
    const g = document.createElement('button');
    g.type = 'button'; g.className = 'field-link-gear'; g.textContent = '⚙';
    g.title = `Open ${link.label || 'settings'} — over the wizard, returns here`;
    g.setAttribute('aria-label', g.title);
    g.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openFieldLink(link); });
    return g;
}

// t798 P5 — DECLARED FIELD HELP. A binding's `help` is the field tooltip; params that recur across twins with the SAME
// meaning declare it ONCE here (a binding's explicit `help` always wins). The help title now goes on the WHOLE ROW
// (label + input + widget answer to hover), not just the label. Filled by the content sweep (ported from the built-in
// forms' ~162 title texts BY MEANING). EXCEPT: pure-structural params in HELP_EXEMPT need no help (the coverage guard allows them).
export const FIELD_HELP = {
    wcs: 'Run in the Active WCS (whatever G54–G59 is selected on the controller) or force a specific one. Positions are in the chosen frame.',
    originX: 'Signed X offset of the path from the stock-attach corner (drag the square handle in the 2D layout).',
    originY: 'Signed Y offset of the path from the stock-attach corner (drag the square handle in the 2D layout).',
    offZ: 'Signed Z offset of the whole path (shifts every Z move; 0 = the part-zero plane).',
    feed: 'Cutting feed rate (mm/min) for the lateral moves.',
    plunge: 'Z plunge feed rate (mm/min) — usually slower than the cutting feed.',
    clearance: 'Safe Z the tool rapids to above the part between moves (mm above the part-zero plane).',
    toolDia: 'Cutting-tool diameter (mm). Auto-filled when you pick a tool from the library; type it when running off-table.',
    depth: 'Total depth of material cut below the top of the stock (mm).',
    stepdown: 'Z step-down per pass (mm).',
    stepoverPct: 'Spacing between parallel passes as a % of tool Ø (40% = a 2.4 mm step on a Ø6 tool).',
    shape: 'Outline: rectangle, circle, regular polygon, or ellipse.',
    sides: 'Number of sides for a regular polygon (≥ 3).',
    pattern: 'Hole layout: grid, bolt circle, rectangle border, or line.',
    pathDatum: 'Which corner/point of the path anchors to the stock (the PATH ANCHOR picker). Empty = follow the stock-attach corner.',
    stockAttach: 'Stock corner the path attaches to (the markers on the stock). Empty = the stock datum.',
    entryX: "X of the tool's lead-in / entry point. Blank = start at the path's natural start.",
    entryY: "Y of the tool's lead-in / entry point. Blank = start at the path's natural start.",
    // ATC spindle warm-up stages (two-stage ramp before the first cut).
    rpm1: 'Spindle RPM for warm-up stage 1 (the gentle ramp — usually ~half the working speed).',
    time1: 'Dwell time (s) the spindle holds at the stage-1 RPM before ramping up.',
    rpm2: 'Spindle RPM for warm-up stage 2 (near/at the working speed).',
    time2: 'Dwell time (s) the spindle holds at the stage-2 RPM.',
    // Stock geometry (shown on twins that still carry the stock block on the form).
    stockDatum: 'Which corner/point of the stock block the op measures from (the stock datum).',
    stockW: 'Stock block width (mm) along X.',
    stockH: 'Stock block height (mm) along Y.',
    stockZ: 'Stock block thickness (mm) along Z (top of stock to the table).',
    // Tapping.
    rigid: 'Rigid tapping (G84 — spindle synchronised to Z). Off = floating/tension-compression tap holder.',
    // Set-WCS toggles + dual-gantry.
    axisX: 'Zero the X axis of the active WCS at the current machine position.',
    axisY: 'Zero the Y axis of the active WCS at the current machine position.',
    axisZ: 'Zero the Z axis of the active WCS at the current machine position (usually after a Z probe).',
    sync: 'Dual gantry only — writes A machine position to WCS slave offset. Disable if A is a rotary axis.',
    slave: 'WCS offset index for slave axis. A=offset 3 (#[#70+3]), B=offset 4 (#[#70+4]).',
    // Corner probe.
    travelDist: 'How far the tool repositions between the two walls of the corner before the second touch (mm).',
};
// Pure-structural / self-evident params (the built-in forms gave them no title either) — the coverage guard allows these
// to render without help. A twin that DOES declare help for one still shows it (explicit help always wins in helpFor).
// Positional coordinate fields (role x/y, canvas-dragged handles) are self-documenting via the 2D layout + their label — exempt like x/y/ax/ay.
export const HELP_EXEMPT = new Set(['cols', 'rows', 'dx', 'dy', 'nx', 'ny', 'count', 'spacing', 'angle', 'startAngle', 'x0', 'y0', 'x', 'y', 'ax', 'ay', 'bx', 'by', 'w', 'h', 'dia', 'align', 'cross1_x', 'cross1_y', 'startX', 'startY']);
// A readonly canvas-set field (e.g. a drag-handle target) uses its readonlyHint as the help — the hint IS the declared explanation.
export function helpFor(b) { return (b && b.help) || (b && FIELD_HELP[b.param]) || (b && b.readonlyHint) || null; }

/**
 * block-native-params S5.2 — the FORM binding list a renderer should use for a def. ADDITIVE-BY-FALLBACK: when the def's
 * template carries a param_group, its param_field ROWS drive the form (order = row order; label/widget/type/default/
 * widgetConfig from the row; the BINDING supplies the wiring — param/blockIndex/key — and any inherited presentation). When
 * there is NO param_group (every op today until the S5.3 hook) the def's bindings are returned UNCHANGED → byte-identical form.
 * The wizard FORM is a pure FILL surface (renders the declaration, the operator enters values; the param_field block is the
 * SOLE edit surface for the declaration), so this is a clean ONE-WAY consume — no write-back.
 */
export function formBindings(def) {
    const rows = paramFieldsFromStack(def && def.template);   // [] when no param_group
    const valueBindings = (def && def.bindings) || [];
    if (!rows.length) return valueBindings;                   // FALLBACK — unchanged, byte-identical to today
    const byParam = {}; valueBindings.forEach((b) => { if (b && b.param != null) byParam[b.param] = b; });
    return rows.map((row) => {
        const b = byParam[row.param];
        if (!b) return null;   // a row naming a param with no binding → dangling, skip
        // CANVAS GROUPING is WIRING, not presentation: a binding in a canvas group (group/role, e.g. an xy-pad's x/y) keeps
        // its group/role (via ...b) AND its canvas `widget` (the first member's widget drives the group's render — the row's
        // 'number' must NOT override it, or the group would flatten). So for a canvas member the binding's widget wins; only
        // a plain binding takes the row's widget. This is why a materialized param_group is byte-neutral even for canvas ops.
        const isCanvas = (b.group != null) || (b.role != null);
        return {
            ...b,
            label: (row.label != null) ? row.label : b.label,
            widget: isCanvas ? b.widget : (row.widget || b.widget),
            type: row.type || b.type,
            default: (row.default != null) ? row.default : b.default,
            ...(row.widgetConfig ? { widgetConfig: row.widgetConfig } : (b.widgetConfig ? { widgetConfig: b.widgetConfig } : {})),
            ...(row.help != null ? { help: row.help } : {}),
            ...(row.section != null ? { section: row.section } : {}),
        };
    }).filter(Boolean);
}

export function renderOpForm(host, bindings) {
    const readers = [], units = [], byGroup = {};
    for (const b of (bindings || [])) {
        // t792 — a binding may DECLARE itself out of the form (`formHidden`): the stock spill uses it, since stockW/H/Z
        // resolve from the GLOBAL stock and the per-op field was a data-model artifact, not a real placement choice.
        //
        // t1303 — IT HIDES THE ROW, IT DOES NOT REMOVE THE PARAM. This used to `continue`, and the field never reached
        // the DOM at all — which silently killed the CORNER PILOT'S DRAG HANDLES. The 2D canvas decides whether a param
        // is settable by looking for its rendered `[data-param]` field (a DOM presence used as a proxy for "settable"),
        // and it WRITES through that same field. So hiding the row took the canvas handle with it: the op whose whole
        // point is that you drag the marker instead of typing the number lost the marker, and typing was gone too.
        // Rendered-but-hidden keeps every seam intact — the reader, the writer, the handle — and shows the user nothing,
        // which is all the flag ever claimed to do.
        if (b.group) { if (!byGroup[b.group]) { byGroup[b.group] = []; units.push(byGroup[b.group]); } byGroup[b.group].push(b); }
        else units.push([b]);
    }
    const addRow = (spec, label, target) => {
        const row = document.createElement('div');
        // ③ — a `when`-gated binding tags its row so the view can show/hide it from the live params (e.g. corner's start
        // #21/#22, visible only under probeZFirst). Purely a marker; the widget still renders + reads (dead when hidden).
        const w = Array.isArray(spec) ? spec[0] : spec;
        // ③ — a `when`-gated binding tags its row (the FULL condition as JSON, so `in`/`not` carry — t566) so the view
        // SHOWS/HIDES it from the live params (corner's start #21/#22 under probeZFirst; callMacro under the auto methods).
        if (w && w.when && w.when.param) row.dataset.when = JSON.stringify(w.when);
        // t522 — COMPOUND gate: `whenAll` is an array of conditions ANDed together (e.g. the I/O-step raw-pin field, shown
        // only when mode=output AND outputRef=raw). The single `when` can't express two conditions; the view evals all.
        if (w && Array.isArray(w.whenAll)) row.dataset.whenAll = JSON.stringify(w.whenAll.map((c) => ({ param: c.param, is: c.is, in: c.in, not: c.not })));
        // t566 — a `gate`-conditioned binding GREYS (not hides) its field when the condition holds, with a `tip` (the ATC
        // change gating: zClear greyed for auto, fixedT greyed for auto+inline). `{param,in|is|not,tip}` or `{all:[…],tip}`.
        if (w && w.gate) row.dataset.gate = JSON.stringify(w.gate);
        const help = helpFor(w);   // t798 P5 — the help title on the WHOLE ROW (hovering the input/widget, not just the label, shows it)
        if (help) { row.title = help; row.dataset.help = '1'; }   // data-help marks a helped row for the coverage guard
        try { readers.push(renderFormWidget(row, spec).read); }
        catch (e) { console.warn('widget render failed for', label, e); }
        // t1303 — the DECLARED-out-of-the-form row: present (so the canvas can drag it and the value round-trips) and
        // invisible. AFTER the widget renders, because every widget assigns the row's whole cssText — setting it before
        // was silently overwritten, which is how the first version of this fix looked right and changed nothing.
        // Marked too, so a test can assert the honest property — not VISIBLE — rather than not present.
        if (w && w.formHidden) { row.style.display = 'none'; row.dataset.formHidden = '1'; }
        const gear = linkGear(fieldLinkFor(w));   // t796 P4 — the row-end deep-link gear (declared `link` / FIELD_LINKS)
        if (gear) { row.classList.add('has-field-link'); row.appendChild(gear); }
        (target || host).appendChild(row);
    };
    const renderUnit = (unit, target) => {
        // A canvas multi-widget (xy-pad / rect) renders the whole group as ONE widget that owns its value. A
        // number-role group (2D point / rect declared as plain numbers) instead renders each member as its OWN
        // number field — each carries data-param so the Form+2D preview's role-derived handle can drag-write it,
        // while the value stays a plain number on the form. The shared group/role still drives the preview handle
        // (layoutSpecFromOp); only the FORM rendering differs.
        if (unit.length > 1 && !MULTI_WIDGETS.has(unit[0] && unit[0].widget)) {
            for (const b of unit) addRow(b, b && b.param, target);
        } else addRow(unit, unit[0] && unit[0].param, target);
    };
    // t820 — COLLAPSIBLE SECTIONS on a LONG form. Bucket units by their declared `section` (GEOMETRY / TOOL & CUT / …);
    // ONLY a form with > SECTION_THRESHOLD rows AND ≥ 2 sections renders the fold chrome ("where sensible" — a short form
    // stays plain). Rows go INTO a per-section body (folded ≠ removed → still in the DOM for the form-integrity/help
    // guards). The header reuses the accordion motion engine (theme drawer tokens) + a panePrefs per-kind fold state.
    const sectionOf = (unit) => (unit[0] && unit[0].section) || null;
    // t1239 IDENTITY FIRST ([[op-defining-fields-at-top]], user) — a DECLARED section ORDER, applied in the ONE form
    // layer so every wizard (built-in twin or user-authored) inherits it. Bindings are assembled value-sockets-first,
    // which put the tool/cut scalars (feeds, radius, port) ABOVE the fields that decide what the op IS — corner opened
    // on "Max Probe Dist" and you scrolled to find WHICH CORNER. Ranked, the form reads the way the op is decided:
    // what it is → where it is → how it cuts. An unlisted section keeps its declaration order after the ranked ones.
    const SECTION_RANK = ['IDENTITY', 'GEOMETRY', 'TOOL & CUT'];
    const rankOf = (sec) => { const i = SECTION_RANK.indexOf(String(sec || '').toUpperCase()); return i < 0 ? SECTION_RANK.length : i; };
    units.sort((a, b) => rankOf(sectionOf(a)) - rankOf(sectionOf(b)));   // Array#sort is stable → order WITHIN a section is untouched
    const secList = []; for (const u of units) { const s = sectionOf(u); if (s && !secList.includes(s)) secList.push(s); }
    const rowCount = units.reduce((n, u) => n + ((u.length > 1 && !MULTI_WIDGETS.has(u[0] && u[0].widget)) ? u.length : 1), 0);
    const sectionize = rowCount > SECTION_THRESHOLD && secList.length >= 2;
    if (sectionize) {
        const secEls = {};
        const ensureSec = (s) => {
            if (secEls[s]) return secEls[s];
            const sec = document.createElement('div'); sec.className = 'form-sec'; sec.dataset.section = s;
            const hdr = document.createElement('button'); hdr.type = 'button'; hdr.className = 'form-sec-hdr';
            hdr.innerHTML = `${SEC_CHEVRON}<span class="form-sec-title">${escHtml(s)}</span>`;
            const body = document.createElement('div'); body.className = 'wiz-pane-body';
            sec.append(hdr, body); host.appendChild(sec);
            applyFold(sec, isSectionCollapsed(s), false);   // apply the persisted fold (snapped)
            hdr.addEventListener('click', () => { const now = !(sec.getAttribute('data-collapsed') === '1'); applyFold(sec, now, true); setSectionCollapsed(s, now); });
            secEls[s] = { body };
            return secEls[s];
        };
        for (const unit of units) { const s = sectionOf(unit); renderUnit(unit, s ? ensureSec(s).body : host); }
    } else {
        for (const unit of units) renderUnit(unit, host);
    }
    // t289 — SOURCE CHIPS (parity-gap #2): a binding whose `sourceField` maps to a controller register gets the SAME
    // inline source dot the built-in forms use. Click toggles studio↔controller (the global per-field setting both
    // surfaces share → the wizard re-generates on ddcs:settings-changed → the emit follows); ctrl-mode locks via
    // readOnly + data-op-gated (NOT disabled — postGating re-enables disabled). No-op on a profile without the register.
    for (const b of (bindings || [])) {
        if (!b || !b.sourceField) continue;
        const inp = host.querySelector(`[data-param="${b.param}"]`);
        if (inp) decorateInputEl(inp, b.sourceField, { gate: true });
    }
    return readers;
}
