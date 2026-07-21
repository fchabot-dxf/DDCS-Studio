/**
 * viz/sectionCanvas.js — a small ELEVATION (side-section) SVG leaf (t1014).
 *
 * A companion to the top-down featureCanvas plan: it draws a TRUE cross-section (looking along Y) of a cavity —
 * the stock top, two walls, a floor, and one horizontal PASS LINE per stepdown slice. The floor and the pass
 * spacing are draggable; a drag hands back a param+value which the host writes to the matching form field (the
 * SAME two-editor-of-one-source loop the plan handles use — drag → field → mgr.update → redraw plan+section).
 *
 * It is a GENERAL elevation primitive (depth is the FIRST consumer): the spec is
 *   { width, depth, stepdown, passes:[z…], depthParam, stepParam, label? }
 * so a future consumer (tool-Z, stock profile, probe-Z) can drive the same leaf. Storage is untouched — the leaf
 * only reads params and writes existing fields, so the emit is byte-identical.
 *
 * Dependency-free hand-rolled SVG (matches featureCanvas / cornerGridSvg). Horizontal = the feature X-extent
 * (X-linked to the plan); vertical = Z (0 at the stock top, +depth downward), one linear Z scale.
 */
const SVGNS = 'http://www.w3.org/2000/svg';
const el = (n, a) => { const e = document.createElementNS(SVGNS, n); for (const k in (a || {})) e.setAttribute(k, a[k]); return e; };
const r2 = (n) => Math.round(n * 100) / 100;

const PAD_X = 26;     // left/right gutter (px) so the walls sit inside the frame
const TOP = 30;       // px reserved for the readout row + the Z=0 line
const BOT = 18;       // px below the floor so it can be grabbed/dragged down

/** Render (or re-render) the elevation into container. onEdit(param, value) writes the matching form field. */
export function renderSection(container, spec, onEdit) {
    if (!container || !spec) return;
    let st = container.__section;
    if (!st) {
        const svg = el('svg', { class: 'section-canvas', width: '100%', height: '100%' });
        svg.style.touchAction = 'none'; svg.style.display = 'block';
        container.innerHTML = ''; container.appendChild(svg);
        st = container.__section = { svg, onEdit, drag: null };
        _bind(st);
    }
    st.onEdit = onEdit;
    st.spec = spec;
    _draw(st);
}

function _draw(st) {
    const svg = st.svg, spec = st.spec;
    const rect = svg.getBoundingClientRect();
    const W = Math.max(80, Math.round(rect.width)) || 320;
    const H = Math.max(60, Math.round(rect.height)) || 140;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const depth = Math.max(0.05, spec.depth || 0);
    const zMax = depth * 1.18 || 1;                 // a little room below the floor for the grab
    const zToY = (z) => TOP + (z / zMax) * (H - TOP - BOT);
    const x0 = PAD_X, x1 = W - PAD_X;               // the cavity walls in px (feature X-extent mapped to the frame width)
    st._zToY = zToY; st._yToZ = (y) => ((y - TOP) / (H - TOP - BOT)) * zMax; st._zMax = zMax;

    // --- readout row -------------------------------------------------------
    const passes = Array.isArray(spec.passes) ? spec.passes : [];
    const head = el('text', { x: PAD_X, y: 18, class: 'sc-head' });
    head.textContent = `${spec.label || 'Section'}   depth ${r2(spec.depth)} · step ${r2(spec.stepdown)} · ${passes.length} pass${passes.length === 1 ? '' : 'es'}`;
    svg.appendChild(head);

    // --- stock top (Z=0) across the full width -----------------------------
    const y0 = zToY(0);
    svg.appendChild(el('line', { x1: 4, y1: y0, x2: W - 4, y2: y0, class: 'sc-top' }));

    // --- the cavity: two walls + a floor -----------------------------------
    const yF = zToY(depth);
    svg.appendChild(el('line', { x1: x0, y1: y0, x2: x0, y2: yF, class: 'sc-wall' }));
    svg.appendChild(el('line', { x1: x1, y1: y0, x2: x1, y2: yF, class: 'sc-wall' }));

    // --- a pass line per depthLevels() slice (one-source with the emit) ----
    passes.forEach((z, i) => {
        const y = zToY(z);
        const last = i === passes.length - 1;
        svg.appendChild(el('line', { x1: x0, y1: y, x2: x1, y2: y, class: last ? 'sc-floor' : 'sc-pass' }));
        const lab = el('text', { x: x1 + 4, y: y + 3, class: 'sc-z' }); lab.textContent = `−${r2(z)}`; svg.appendChild(lab);
    });

    // --- draggable grips: the FLOOR (=depth) and the first pass gap (=stepdown) ---
    st._grips = {};
    const floorGrip = el('circle', { cx: (x0 + x1) / 2, cy: yF, r: 6, class: 'sc-grip sc-grip-depth', 'data-grip': 'depth' });
    svg.appendChild(floorGrip); st._grips.depth = { cx: (x0 + x1) / 2, cy: yF };
    if (passes.length > 1) {
        const zStep = Math.min(spec.stepdown, depth);
        const yS = zToY(zStep);
        const stepGrip = el('circle', { cx: x0 + 16, cy: yS, r: 5, class: 'sc-grip sc-grip-step', 'data-grip': 'stepdown' });
        svg.appendChild(stepGrip); st._grips.stepdown = { cx: x0 + 16, cy: yS };
    }
}

// A grip drag: identify by nearest grip on pointerdown, then track on WINDOW (survives the re-render the field write triggers).
function _bind(st) {
    const svg = st.svg;
    const localY = (ev) => { const r = svg.getBoundingClientRect(); return (ev.clientY - r.top) * (st._vhScale || 1); };
    const pick = (ev) => {
        const r = svg.getBoundingClientRect();
        const y = ev.clientY - r.top, x = ev.clientX - r.left;
        let best = null, bd = 22 * 22;
        for (const k in (st._grips || {})) { const g = st._grips[k]; const d = (g.cx - x) ** 2 + (g.cy - y) ** 2; if (d < bd) { bd = d; best = k; } }
        return best;
    };
    const move = (ev) => {
        if (!st.drag) return;
        const r = svg.getBoundingClientRect();
        const z = Math.max(0.05, Math.min(st._zMax, st._yToZ(ev.clientY - r.top)));
        if (st.drag === 'depth') { if (st.onEdit) st.onEdit(st.spec.depthParam, r2(z)); }
        else if (st.drag === 'stepdown') { if (st.onEdit) st.onEdit(st.spec.stepParam, r2(Math.min(z, st.spec.depth || z))); }
    };
    const up = () => { st.drag = null; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    svg.addEventListener('pointerdown', (ev) => {
        const g = pick(ev); if (!g) return;
        ev.preventDefault(); st.drag = g;
        window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    });
}
