/**
 * ui/pathAnchorField.js — two anchor pickers in a wizard FORM: STOCK ANCHOR (which stock corner the path attaches to,
 * blue) + PATH ANCHOR (which corner of the path attaches there, amber). They draw the SAME 3×3 corner-grid graphic as
 * the Blockly PlaceOnStock block (shared ui/cornerGridSvg.js), so the form + the Blocks view are visually identical
 * editors of the same placement. No text labels — the colour tells them apart and a tooltip explains each (per-cell
 * tooltips name the corner). Reads/writes the hidden `<prefix>stockAttach` / `<prefix>pathDatum` fields the wizard
 * passes to placement. Codes are [X][Y], n/c/p = min/centre/max; '' = follow (stock → its datum; path → stock attach).
 *
 * Reusable: drop `<div class="pa-mount" data-prefix="d_"></div>` into a form + call mountPathAnchor('d_') on open.
 */
import { CG, buildCornerCells, paintCornerGrid } from './cornerGridSvg.js';
const SVGNS = 'http://www.w3.org/2000/svg';
const COLOUR = { stockAttach: '#4ab3ff', pathDatum: '#ffcf3a' };   // blue / amber — exactly the Blockly cornergrid tints
const NAMES = { nn: 'front-left', cn: 'front', pn: 'front-right', nc: 'left', cc: 'centre', pc: 'right', np: 'back-left', cp: 'back', pp: 'back-right' };
const TIP = {
    stockAttach: 'STOCK ANCHOR (blue) — which corner of the stock the toolpath attaches to. Click a cell; click it again to follow the stock datum.',
    pathDatum: 'PATH ANCHOR (amber) — which corner of the toolpath attaches to the stock. Click a cell; click it again to follow the stock anchor.',
};

function injectStyle() {
    if (document.getElementById('pa-style')) return;
    const s = document.createElement('style'); s.id = 'pa-style';
    s.textContent = `
    .pa-mount{display:inline-flex;gap:14px;margin:4px 0}
    .pa-mount .ap{line-height:0}
    .pa-mount rect[data-code]:not(.on){stroke:var(--text-dim,#9fb3c8);stroke-width:.8}`;   /* empty cells read per theme (no frame needed) */
    document.head.appendChild(s);
}

/**
 * t2293 (BACKLOG #21) — THE REAL ROOT CAUSE: `document.getElementById(prefix+field)` assumes that id is unique
 * document-wide, which held for 6 static shells (surfacing/text/slot/pocket/contour/drill) each with their OWN
 * single hidden `<input id="d_pathDatum">`. It stops holding the moment a declared `path_anchor` uiChildren node
 * (formWidgets.js) ALSO stamps that same id onto its own reproduced row's input, alongside — not instead of —
 * the old hidden shell, which is still present in the document. Two elements can then legally share the id, and
 * a document-wide lookup finds whichever the browser happens to hit first — not necessarily the caller's own.
 * `root.querySelector('#'+id)` would still be an ID lookup and doesn't fix the underlying ambiguity (the SAME
 * duplicate-id hazard other unrelated code doing its own getElementById could still hit); the declared row
 * already carries `[data-param="field"]` (every `renderFormWidget` row does, formWidgets.js's own convention),
 * unique WITHIN the caller's own container, so a scoped root prefers that instead of trusting the id at all.
 * The unscoped/document-default path (every existing static call site) has no `data-param` on its hand-written
 * hidden input, so it keeps the ORIGINAL id lookup — byte-for-byte, verified live (t2293-pathanchor-*.mjs).
 */
function buildPicker(prefix, field, root = document) {
    const id = prefix + field;
    const fld = () => (root !== document && root.querySelector(`[data-param="${field}"]`)) || document.getElementById(id);
    const wrap = document.createElement('div'); wrap.className = 'ap'; wrap.dataset.field = id; wrap.title = TIP[field];

    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('width', CG.SPAN); svg.setAttribute('height', CG.SPAN); svg.setAttribute('viewBox', `0 0 ${CG.SPAN} ${CG.SPAN}`);
    const { cells, cross } = buildCornerCells(svg);
    for (const code in cells) { const t = document.createElementNS(SVGNS, 'title'); t.textContent = NAMES[code]; cells[code].appendChild(t); }   // per-cell corner-name tooltip
    wrap.appendChild(svg);

    const refresh = () => paintCornerGrid(cells, cross, COLOUR[field], (fld() && fld().value) || '');
    svg.addEventListener('click', (e) => {                          // crosshair lines are pointer-transparent → e.target is the cell rect
        const code = e.target && e.target.getAttribute && e.target.getAttribute('data-code');
        if (!code) return;
        const e2 = fld(); if (!e2) return;
        e2.value = (e2.value === code) ? '' : code;                 // re-click the picked cell → follow
        e2.dispatchEvent(new Event('input', { bubbles: true }));
        refresh();
    });
    const f = fld(); if (f && !f.dataset.paWired) { f.dataset.paWired = '1'; f.addEventListener('input', refresh); }
    refresh();
    return wrap;
}

/** Build (once) the STOCK + PATH anchor pickers into a wizard form's `.pa-mount[data-prefix]`. Idempotent.
 *  `root` (t2293, BACKLOG #21) — an OPTIONAL scope, defaulting to `document` so the 6 existing static call
 *  sites are byte-for-byte unchanged. A declared `path_anchor` node (formWidgets.js) passes its OWN container —
 *  the one place two `.pa-mount[data-prefix]` nodes could otherwise coexist (the old hidden shell's + this
 *  one's), same reason `buildPicker`'s own `fld()` prefers a scoped lookup over the shared id. */
export function mountPathAnchor(prefix, root = document) {
    injectStyle();
    const mount = root.querySelector(`.pa-mount[data-prefix="${prefix}"]`);
    if (!mount || mount.dataset.built) return;
    mount.dataset.built = '1';
    mount.appendChild(buildPicker(prefix, 'stockAttach', root));
    mount.appendChild(buildPicker(prefix, 'pathDatum', root));
}
