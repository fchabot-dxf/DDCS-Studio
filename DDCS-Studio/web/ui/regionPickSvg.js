/**
 * ui/regionPickSvg.js — the shared core for the REGION-PICK control ("make your own datum").
 *
 * Generalizes the datum's `cornerGridSvg.js` idea: instead of a fixed 3×3 grid, a control is a SPEC — an optional
 * backdrop graphic + a list of clickable REGIONS (rect / polygon / freeform), each carrying a value. Click a region
 * to pick it; the picked region's value is the control's value. ONE core, two adapters (form widget + Blockly field),
 * exactly like the datum — so a region-pick draws identically in the form and in the block.
 *
 * v1 values are NUMERIC (regions → numbers) so the control binds to a numeric socket → valid by construction (an
 * enum/string region-pick is the same UI once the deferred field-targeting param lands). Pure rendering — no state,
 * no binding; the adapters own selection + read-back. See docs/archive/RICH-WIDGETS-AND-ICONS.md.
 */
const SVGNS = 'http://www.w3.org/2000/svg';

export const RP = {
    SEL: '#4ab3ff',                          // picked-region accent (matches the canvas pickers)
    IDLE_FILL: 'rgba(140,160,180,0.10)', IDLE_STROKE: 'rgba(200,212,224,0.40)',
    DEFAULT_VIEWBOX: '0 0 200 120',
};

/** Build the backdrop + region hit-shapes into `svgEl` from a spec. Returns [{ el, value, label }] in spec order.
 *  spec = { viewBox?, backdrop?, regions: [{ shape:'rect'|'poly', x,y,w,h,rx | points, value:<number>, label? }] }. */
export function buildRegions(svgEl, spec = {}) {
    const vb = spec.viewBox || RP.DEFAULT_VIEWBOX;
    svgEl.setAttribute('viewBox', vb);
    while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);

    if (spec.backdrop) {                      // optional graphic the regions sit on (composed in the iconEditor)
        const [, , w, h] = vb.split(/[\s,]+/).map(Number);
        if (/^data:|^https?:/.test(spec.backdrop)) {
            const img = document.createElementNS(SVGNS, 'image');
            img.setAttribute('href', spec.backdrop); img.setAttribute('x', 0); img.setAttribute('y', 0);
            img.setAttribute('width', w || 200); img.setAttribute('height', h || 120); img.setAttribute('preserveAspectRatio', 'none');
            svgEl.appendChild(img);
        } else {                              // raw SVG markup (a composed graphic) — mounted as-is
            const g = document.createElementNS(SVGNS, 'g'); g.innerHTML = spec.backdrop; svgEl.appendChild(g);
        }
    }

    const out = [];
    (spec.regions || []).forEach((r, i) => {
        let el;
        if (r.shape === 'poly') { el = document.createElementNS(SVGNS, 'polygon'); el.setAttribute('points', r.points || ''); }
        else { el = document.createElementNS(SVGNS, 'rect'); el.setAttribute('x', r.x || 0); el.setAttribute('y', r.y || 0); el.setAttribute('width', r.w || 0); el.setAttribute('height', r.h || 0); if (r.rx != null) el.setAttribute('rx', r.rx); }
        el.setAttribute('data-ri', i);
        el.style.cursor = 'pointer';
        if (r.label != null) { const t = document.createElementNS(SVGNS, 'title'); t.textContent = String(r.label); el.appendChild(t); }
        svgEl.appendChild(el);
        out.push({ el, value: r.value, label: r.label });
    });
    return out;
}

/** Paint each region: the one whose value === `selected` gets the accent, the rest dim (default look = accent fill +
 *  dim the rest, which survives irregular poly/freeform where a thin outline would be lost). The `rp-region`/`rp-on`
 *  classes are a CSS hook so a theme can restyle the selection from the SAME design tokens as the datum picker (so
 *  theming restyles both pickers as one family — the shared-core argument applied to the visual layer). */
export function paintRegions(regions, selected) {
    for (const r of regions) {
        const on = String(r.value) === String(selected);
        r.el.classList.add('rp-region'); r.el.classList.toggle('rp-on', on);
        r.el.setAttribute('fill', on ? RP.SEL : RP.IDLE_FILL);
        r.el.setAttribute('fill-opacity', on ? '0.40' : '1');
        r.el.setAttribute('stroke', on ? RP.SEL : RP.IDLE_STROKE);
        r.el.setAttribute('stroke-width', on ? '2' : '1');
    }
}

/** The region value under a click event (or null). TOPMOST-WINS by construction: SVG paints in document order, so
 *  the last-drawn (highest z) overlapping region is on top and IS `e.target` — matching what the user sees, not a
 *  surprising smallest-area rule. Single-select/radio is the caller's job (it tracks one `cur`). */
export function regionValueFromEvent(regions, e) {
    const el = e.target && e.target.closest ? e.target.closest('[data-ri]') : null;
    if (!el) return null;
    const r = regions[+el.getAttribute('data-ri')];
    return r ? r.value : null;
}

/** The label of the region with this value (for echoing WHAT was committed, not just the lit shape). */
export function regionLabel(spec, value) {
    const r = ((spec && spec.regions) || []).find((rr) => String(rr.value) === String(value));
    return r ? (r.label || '') : '';
}
