/**
 * blocks/blockly/dropdownPopup.js — a shared popup-positioning helper for custom Blockly fields whose
 * `showEditor_` opens RICH content (add/remove rows, a filter box + list) instead of Blockly's own native
 * dropdown-menu/text-input chrome.
 *
 * t2389 (BACKLOG #42 pieces 2+6, "design ONE field pattern and let [its] consumers wear it") — the options
 * editor (`optionsEditorField.js`, piece 2) and the exact-name pickers (`pickerField.js`, piece 6) both need
 * "click the field, a positioned popup opens, build arbitrary DOM inside it, close on an outside click or
 * Escape". ⚠ Live-caught before shipping: `Blockly.DropdownDiv`/`Blockly.WidgetDiv` — the natural first choice,
 * the SAME positioned-floating-div singleton `FieldDropdown`'s own native menu rides — are NOT exposed on the
 * vendored UMD `Blockly` namespace (confirmed live: `Object.keys(window.Blockly)` has no `dropdown`/`widget`
 * match at all) even though a field's own internal `showEditor()` still manages a `.blocklyWidgetDiv` element
 * PRIVATELY. So this is a SELF-CONTAINED popup instead — the same shape as `ui/opContextMenu.js`'s own shared
 * floating menu (one element, viewport-clamped, dismissed on an outside mousedown or Escape) — positioned off
 * the FIELD's own `getScaledBBox()` (a public, documented `Field` method) rather than the block's.
 */
let popup = null;
let ownerField = null;
let scrollUnsub = null;   // t2575 — the workspace-scroll listener guarding the CURRENTLY open popup, if any

function ensure() {
    if (popup) return popup;
    popup = document.createElement('div');
    popup.className = 'ddcs-field-popup';
    popup.style.cssText = 'position:fixed;z-index:10000;background:#fff;color:#222;border:1px solid rgba(0,0,0,.25);border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.25);font:13px system-ui,sans-serif;';
    popup.hidden = true;
    document.body.appendChild(popup);
    document.addEventListener('mousedown', (e) => { if (popup && !popup.hidden && !popup.contains(e.target)) closeFieldPopup(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeFieldPopup(); });
    return popup;
}

// t2575 (BACKLOG #61 follow-up, t2573's own diag_aim_handle build) — a REAL, reproducible product bug, not a
// test-harness artifact (confirmed live with a genuine mouse-wheel scroll, no synthetic API calls): this popup
// is `position:fixed`, anchored to the field's own on-screen box ONLY at the instant it opens — it does not
// track the workspace's own scroll/pan/zoom at all. Leave one open, then scroll (wheel, drag-pan, or any
// programmatic `centerOnBlock`/reproject that moves the canvas), and the popup sits at its OLD screen
// coordinates while every block moves underneath it — on a big enough scroll it can end up covering a
// DIFFERENT field entirely, silently swallowing that field's next click with no error and no visual cue
// (the click hits the stale popup's own rows, which do nothing for a click landing between them). Reproduced
// exactly this way past a 4th formfield in `diag_aim_handle`'s own pilot: the ATOMTYPE popup for an earlier
// formfield stayed open across `centerOn`'s own scroll and ended up sitting over the new field's own picker.
// FIX: close on ANY workspace change that isn't this popup's own field being edited — `ws.addChangeListener`
// fires generically for block moves, viewport scroll, AND model rebuilds (the exact same shape
// `blocksApp.js`'s own `refreshFloat` already relies on for its own floating suggestion box) — a blunter
// signal than "scroll specifically," but correct: ANY of those invalidates this popup's own fixed position
// relative to the field it was opened for.
export function closeFieldPopup() {
    if (popup) popup.hidden = true;
    ownerField = null;
    if (scrollUnsub) { scrollUnsub(); scrollUnsub = null; }
}

/**
 * Open `field`'s popup with fresh content, positioned below (or above, if it wouldn't fit) the field's own
 * on-screen box. `build(content, close)` fills `content` (an empty, already-padded DOM node) with whatever the
 * field needs, and gets `close` to call when it's done — the field decides what "done" means (a click on a
 * candidate, a Done button, Escape — handled globally here).
 */
export function openFieldPopup(field, build) {
    const p = ensure();
    if (scrollUnsub) { scrollUnsub(); scrollUnsub = null; }   // closing any PRIOR popup's own guard before arming a new one
    ownerField = field;
    p.innerHTML = '';
    p.style.padding = '10px';
    p.style.minWidth = '220px';
    p.hidden = false;
    build(p, closeFieldPopup);

    // The field's own SVG root gives its real on-screen box directly — robust to zoom/scroll/pan, no need to
    // re-derive it from workspace metrics (mirrors how blocksApp.js's own context-menu code reads screen
    // position elsewhere in the app).
    const root = field.getSvgRoot();
    const r = root ? root.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
    const x = r.left, y = r.top + r.height + 4;
    const pr = p.getBoundingClientRect();
    p.style.left = Math.round(Math.max(6, Math.min(x, window.innerWidth - pr.width - 6))) + 'px';
    p.style.top = Math.round(Math.max(6, Math.min(y, window.innerHeight - pr.height - 6))) + 'px';

    // t2575 — arm a SCROLL/ZOOM-SPECIFIC guard: `ws.addChangeListener` fires for every model change (a field
    // value commit, an unrelated block's own live-preview re-render, ...), not just scroll — filtering by
    // `Blockly.Events.VIEWPORT_CHANGE` caught live: an unfiltered "close on ANY change" self-closed the popup
    // before it ever became visible (this app's own background live-preview churn fires change events
    // continuously). `viewport_change` is Blockly's own dedicated scroll/pan/zoom event type — exactly the
    // ONE thing that actually invalidates this popup's fixed-to-a-past-screen-position anchor.
    // Deferred one tick: the SAME click that opens this popup can itself fire a `viewport_change` (Blockly
    // auto-scrolls the clicked field's own block into view as part of selecting it) — arming synchronously
    // self-closed the popup it had just opened, caught live (never became visible at all, twice: once
    // unfiltered, once filtered — the opening click's own scroll is a real `viewport_change`, not noise).
    const blk = field.getSourceBlock && field.getSourceBlock();
    const ws = blk && blk.workspace;
    const VIEWPORT_CHANGE = window.Blockly && window.Blockly.Events && window.Blockly.Events.VIEWPORT_CHANGE;
    if (ws && VIEWPORT_CHANGE && typeof ws.addChangeListener === 'function') {
        const onWsChange = (e) => { if (e && e.type === VIEWPORT_CHANGE) closeFieldPopup(); };
        const armTimer = setTimeout(() => { if (!popup.hidden) ws.addChangeListener(onWsChange); }, 400);
        scrollUnsub = () => { clearTimeout(armTimer); try { ws.removeChangeListener(onWsChange); } catch (_) { /* workspace already torn down, or never armed */ } };
    }
}
