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

export function closeFieldPopup() {
    if (popup) popup.hidden = true;
    ownerField = null;
}

/**
 * Open `field`'s popup with fresh content, positioned below (or above, if it wouldn't fit) the field's own
 * on-screen box. `build(content, close)` fills `content` (an empty, already-padded DOM node) with whatever the
 * field needs, and gets `close` to call when it's done — the field decides what "done" means (a click on a
 * candidate, a Done button, Escape — handled globally here).
 */
export function openFieldPopup(field, build) {
    const p = ensure();
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
}
