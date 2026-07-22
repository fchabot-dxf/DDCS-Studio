/**
 * viz/zRulerStrip.js — a narrow VERTICAL depth ruler that lives DOWN THE LEFT EDGE of the 2D layout (plan) canvas
 * (t1021). A SIBLING strip BESIDE featureCanvas — NOT a second projection inside it, so featureCanvas stays single-fit
 * and untouched. The vertical Z axis (0 at the stock top → total depth at the bottom) carries one TICK per depthLevels()
 * pass (the SAME slices the emitter cuts → one source), a draggable green FLOOR = total depth, and an orange STEP grip =
 * per-pass stepdown. A grip drag hands back a param+value which the host writes to the matching form field (the SAME
 * two-editor-of-one-source loop the plan handles use — drag → field → mgr.update → redraw). Display/input only → the
 * emit is byte-identical. Dependency-free hand-rolled SVG (matches featureCanvas / cornerGridSvg).
 */
const SVGNS = 'http://www.w3.org/2000/svg';
const r2 = (n) => Math.round(n * 100) / 100;

const TOP = 44, BOT = 16, AX = 16;   // px: top/bottom padding + the axis x. TOP clears the 2D panel TITLE ('Pocket (data) . N lines',
                                     // an absolute top-left overlay) so the 0-tick + the top of the Z axis are never hidden under it (t1023).

/** Render (or re-render) the ruler into container. onEdit(param, value) writes the matching form field. */
export function renderZRuler(container, spec, onEdit) {
    if (!container || !spec) return;
    let st = container.__zruler;
    if (!st) {
        const svg = document.createElementNS(SVGNS, 'svg');
        svg.setAttribute('class', 'zruler-svg');
        svg.style.cssText = 'width:100%; height:100%; display:block; touch-action:none; overflow:visible;';
        container.innerHTML = ''; container.appendChild(svg);
        st = container.__zruler = { svg };
        _bind(st);
        try { const ro = new ResizeObserver(() => { if (st._p) return; st._p = true; requestAnimationFrame(() => { st._p = false; if (st.spec) _draw(st); }); }); ro.observe(container); st._ro = ro; } catch (_) { /* */ }
    }
    st.onEdit = onEdit;
    st.spec = spec;
    _draw(st);
}

function _draw(st) {
    const svg = st.svg, spec = st.spec;
    const rect = svg.getBoundingClientRect();
    const W = Math.max(28, Math.round(rect.width)) || 46, H = Math.max(60, Math.round(rect.height)) || 240;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const mk = (tag, at) => { const e = document.createElementNS(SVGNS, tag); for (const k in at) e.setAttribute(k, at[k]); return e; };

    const depth = Math.max(0.05, spec.depth || 0);
    const passes = Array.isArray(spec.passes) ? spec.passes : [];
    // t1023 — during a drag the axis SCALE is FROZEN (cached at drag-start), so the grip TRAVELS a fixed ruler instead of
    // pinning (the axis re-fits to the new depth only on pointer-UP). Static/between-drags it fits to the depth.
    const zMax = st._frozenZMax || (depth * 1.12 || 1);
    const zToY = (z) => TOP + (z / zMax) * (H - TOP - BOT);
    st._yToZ = (y) => ((y - TOP) / (H - TOP - BOT)) * zMax; st._zMax = zMax;

    // the depth axis (0 → depth) + the '0' surface tick
    svg.appendChild(mk('line', { x1: AX, y1: zToY(0), x2: AX, y2: zToY(depth), class: 'zruler-axis' }));
    const t0 = mk('text', { x: AX + 4, y: zToY(0) + 8, class: 'zruler-z' }); t0.textContent = '0'; svg.appendChild(t0);
    // a tick per depthLevels() slice, the deepest drawn as the FLOOR
    passes.forEach((z, i) => {
        const y = zToY(z), last = i === passes.length - 1;
        svg.appendChild(mk('line', { x1: AX, y1: y, x2: W - 3, y2: y, class: last ? 'zruler-floor' : 'zruler-pass' }));
        const lab = mk('text', { x: AX + 4, y: y - 2, class: 'zruler-z' }); lab.textContent = '−' + r2(z); svg.appendChild(lab);
    });
    // draggable grips: the FLOOR (=depth) and, when there is more than one pass, the first gap (=stepdown)
    st._grips = {};
    const grip = (cx, cy, rr, cls) => { svg.appendChild(mk('circle', { cx, cy, r: rr, class: cls })); return { cx, cy }; };
    st._grips.depth = grip(AX, zToY(depth), 6, 'zruler-grip zruler-grip-depth');
    if (passes.length > 1) st._grips.step = grip(AX, zToY(Math.min(spec.stepdown, depth)), 5, 'zruler-grip zruler-grip-step');
}

// A grip drag: pick the nearest grip on pointerdown, then track on WINDOW (survives the re-render the field write triggers).
function _bind(st) {
    const svg = st.svg;
    const pick = (ev) => {
        const r = svg.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
        let best = null, bb = 22 * 22;
        for (const k in (st._grips || {})) { const g = st._grips[k], d = (g.cx - x) ** 2 + (g.cy - y) ** 2; if (d < bb) { bb = d; best = k; } }
        return best;
    };
    const move = (ev) => {
        if (!st.drag) return;
        const r = svg.getBoundingClientRect(), z = Math.max(0.05, Math.min(st._zMax, st._yToZ(ev.clientY - r.top)));
        if (st.drag === 'depth') st.onEdit && st.onEdit(st.spec.depthParam, r2(z));
        else if (st.drag === 'step') st.onEdit && st.onEdit(st.spec.stepParam, r2(Math.min(z, st.spec.depth || z)));
    };
    const up = () => { st.drag = null; st._frozenZMax = null; _draw(st); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };   // RE-FIT the axis on drop
    svg.addEventListener('pointerdown', (ev) => { const g = pick(ev); if (!g) return; ev.preventDefault(); st.drag = g; st._frozenZMax = st._zMax; window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); });   // FREEZE the current scale for the drag
}
