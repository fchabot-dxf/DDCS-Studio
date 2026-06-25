/**
 * ui/regionEditor.js — the REGION EDITOR ("make your own datum"): author a region-pick spec by drawing clickable
 * regions over an optional backdrop. Built on the shared drawing core (shapeStage) — SAME stage / drag / select as
 * the icon composer — with REGION SEMANTICS (a number value + a label per region) as the thin layer on top, and the
 * backdrop composed by reusing the icon editor. Output: a spec
 *   { viewBox, backdrop?, regions:[{ shape:'rect'|'poly', …geometry, value:<number>, label }] }
 * consumed by the region-pick form widget + the field_regionpick block field (both shipped).
 *
 * v1: RECT regions (a rotated rect bakes to a polygon on save, so authoring matches the runtime); poly/freeform
 * point-editing is a follow-up (the runtime + bake already handle polygons). See docs/RICH-WIDGETS-AND-ICONS.md.
 */
import { stageSvg, startGesture, applyGesture, boxPoint } from './shapeStage.js';
import { openIconEditor } from './iconEditor.js';

const W = 360, H = 180;
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const r1 = (n) => Math.round(n);

/** spec region → editor layer (a poly's absolute points become a box + local points). */
function regionToLayer(r) {
    if (r.shape === 'poly' && r.points) {
        const pts = String(r.points).trim().split(/\s+/).map((p) => p.split(',').map(Number));
        const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
        const x = Math.min(...xs), y = Math.min(...ys), w = (Math.max(...xs) - x) || 1, h = (Math.max(...ys) - y) || 1;
        return { type: 'poly', x, y, w, h, rot: 0, points: pts.map((p) => `${p[0] - x},${p[1] - y}`).join(' '), value: r.value, label: r.label || '' };
    }
    return { type: 'rect', x: r.x || 0, y: r.y || 0, w: r.w || 40, h: r.h || 30, rot: 0, value: r.value, label: r.label || '' };
}
/** editor layer → spec region. A rect at rot 0 stays a rect; anything rotated/poly bakes to an absolute polygon
 *  (via the shared boxPoint transform) so the spec the runtime renders matches exactly what was drawn. */
function layerToRegion(L) {
    const base = { value: Number(L.value) || 0, label: L.label || '' };
    if (L.type === 'rect' && !L.rot) return { shape: 'rect', x: r1(L.x), y: r1(L.y), w: r1(L.w), h: r1(L.h), ...base };
    const local = (L.type === 'poly' && L.points)
        ? L.points.trim().split(/\s+/).map((p) => p.split(',').map(Number))
        : [[0, 0], [L.w, 0], [L.w, L.h], [0, L.h]];   // rect corners
    const pts = local.map(([lx, ly]) => boxPoint(lx / (L.w || 1), ly / (L.h || 1), L)).map((p) => `${r1(p.x)},${r1(p.y)}`);
    return { shape: 'poly', points: pts.join(' '), ...base };
}

/** Open the region editor. `initial` = { spec } or null. onSave(spec). */
export function openRegionEditor(initial, onSave) {
    const regions = ((initial && initial.spec && initial.spec.regions) || []).map(regionToLayer);
    let backdropLayers = (initial && initial.spec && initial.spec._backdropLayers) || null;
    let sel = regions.length ? 0 : -1;

    const m = document.createElement('div'); m.id = 're-modal';
    m.innerHTML = `<style>
        #re-modal{position:fixed;inset:0;z-index:1200;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);}
        #re-modal .re-panel{background:var(--panel);color:var(--text-main);border:1px solid var(--border);border-radius:8px;width:min(900px,96vw);max-height:94vh;display:flex;flex-direction:column;box-shadow:0 14px 48px rgba(0,0,0,.5);}
        #re-modal .re-head{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid var(--border);font-weight:700;}
        #re-modal .re-head button{background:transparent;border:none;color:var(--text-dim);font-size:18px;cursor:pointer;}
        #re-modal .re-addrow{display:flex;gap:6px;align-items:center;padding:8px 14px;border-bottom:1px solid var(--border);}
        #re-modal .re-body{display:flex;flex-wrap:wrap;gap:12px;padding:12px 14px;overflow:auto;}
        #re-modal .re-stage{flex:1 1 460px;min-width:0;}
        #re-modal .re-stack{position:relative;width:100%;aspect-ratio:${W} / ${H};border:1px solid var(--border);border-radius:6px;overflow:hidden;touch-action:none;}
        #re-modal .re-back,#re-modal .re-over{position:absolute;inset:0;}
        #re-modal .re-back{pointer-events:none;}
        #re-modal .re-back svg,#re-modal .re-over svg{width:100%;height:100%;display:block;}
        #re-modal .re-side{flex:1 1 220px;min-width:180px;display:flex;flex-direction:column;gap:10px;}
        #re-modal .re-grp{border:1px solid var(--border);border-radius:6px;padding:8px;}
        #re-modal .re-grp h4{margin:0 0 6px;font-size:10.5px;letter-spacing:.5px;text-transform:uppercase;color:var(--text-dim);}
        #re-modal .re-row{display:flex;gap:8px;flex-wrap:wrap;}
        #re-modal label{font-size:11px;color:var(--text-dim);display:flex;flex-direction:column;gap:2px;}
        #re-modal input{padding:5px 7px;background:var(--bg,#0b0f14);color:inherit;border:1px solid var(--border);border-radius:5px;width:90px;}
        #re-modal .re-list{max-height:150px;overflow:auto;font-size:12px;}
        #re-modal .re-li{display:flex;align-items:center;gap:6px;padding:3px 4px;border-bottom:1px solid var(--border);cursor:pointer;}
        #re-modal .re-li.sel{background:rgba(14,165,233,.15);}
        #re-modal .re-li span{flex:1;}
        #re-modal .re-dim{font-size:11px;color:var(--text-dim);}
        #re-modal .re-foot{padding:10px 14px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px;}
    </style>
    <div class="re-panel">
        <div class="re-head"><span>⬚ Region editor — make your own datum</span><button data-re="x">✕</button></div>
        <div class="re-addrow">
            <button class="toolbar-btn settings-io" data-add="rect">＋ Region</button>
            <button class="toolbar-btn settings-io" data-re="backdrop">🖼 Backdrop…</button>
            <span style="flex:1"></span><span class="re-dim">click a region to select · drag to move · handles resize</span>
        </div>
        <div class="re-body">
            <div class="re-stage" id="re_stage"></div>
            <div class="re-side">
                <div class="re-grp"><h4>Selected region</h4><div id="re_props"></div></div>
                <div class="re-grp"><h4>Regions</h4><div class="re-list" id="re_list"></div></div>
            </div>
        </div>
        <div class="re-foot"><button class="toolbar-btn settings-io" data-re="cancel">Cancel</button><button class="toolbar-btn settings-io" data-re="save">Save region pick</button></div>
    </div>`;
    document.body.appendChild(m);
    const $ = (id) => m.querySelector('#' + id);
    const stage = $('re_stage');

    function renderStage() {
        const back = backdropLayers ? stageSvg(backdropLayers, -1, W, H) : `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#0b0f14"/></svg>`;
        stage.innerHTML = `<div class="re-stack"><div class="re-back">${back}</div><div class="re-over">${stageSvg(regions, sel, W, H, 'transparent')}</div></div>`;
    }
    function renderProps() {
        const host = $('re_props');
        if (sel < 0 || !regions[sel]) { host.innerHTML = '<span class="re-dim">No region selected.</span>'; return; }
        const L = regions[sel];
        host.innerHTML = `<div class="re-row"><label>Value<input type="number" id="re_val" value="${Number(L.value) || 0}"></label><label>Label<input type="text" id="re_lbl" value="${esc(L.label)}"></label></div>`;
        $('re_val').addEventListener('input', (e) => { L.value = e.target.value; });
        $('re_lbl').addEventListener('input', (e) => { L.label = e.target.value; renderList(); });
    }
    function renderList() {
        $('re_list').innerHTML = regions.map((L, i) => `<div class="re-li ${i === sel ? 'sel' : ''}" data-li="${i}"><span>${esc(L.label || ('region ' + (i + 1)))} = ${Number(L.value) || 0}</span><button class="op-btn" data-del="${i}" title="Delete">✕</button></div>`).join('') || '<span class="re-dim">No regions yet — ＋ Region.</span>';
    }
    function refresh() { renderStage(); renderProps(); renderList(); }

    function addRegion() {
        regions.push({ type: 'rect', x: W / 2 - 40, y: H / 2 - 25, w: 80, h: 50, rot: 0, value: (regions.length + 1) * 100, label: 'region ' + (regions.length + 1) });
        sel = regions.length - 1; refresh();
    }

    // pointer gestures on the region overlay — reuse the shared core (move / resize / rotate)
    let gesture = null;
    const ptStage = (e) => { const ov = stage.querySelector('.re-over svg'); const r = ov.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; };
    stage.addEventListener('pointerdown', (e) => {
        const hEl = e.target.closest('[data-h]');
        if (hEl && sel >= 0) { gesture = startGesture(hEl.dataset.h, regions[sel], ptStage(e)); stage.setPointerCapture(e.pointerId); return; }
        const g = e.target.closest('g[data-li]'); if (!g) return;
        sel = +g.dataset.li; gesture = startGesture(null, regions[sel], ptStage(e)); stage.setPointerCapture(e.pointerId); refresh();
    });
    stage.addEventListener('pointermove', (e) => { if (!gesture || sel < 0) return; applyGesture(gesture, regions[sel], ptStage(e), e.shiftKey); renderStage(); });
    stage.addEventListener('pointerup', () => { if (gesture) { gesture = null; renderProps(); renderList(); } });

    m.addEventListener('click', (e) => {
        const re = e.target.dataset.re;
        if (re === 'x' || re === 'cancel') { m.remove(); return; }
        if (re === 'save') { save(); return; }
        if (re === 'backdrop') { openIconEditor(backdropLayers ? { layers: backdropLayers } : null, (_bmp, model) => { backdropLayers = model.layers; renderStage(); }); return; }
        if (e.target.dataset.add === 'rect') { addRegion(); return; }
        const del = e.target.dataset.del; if (del != null) { regions.splice(+del, 1); if (sel >= regions.length) sel = regions.length - 1; refresh(); return; }
        const li = e.target.closest('.re-li'); if (li) { sel = +li.dataset.li; refresh(); return; }
        if (e.target === m) m.remove();
    });

    function save() {
        const spec = { viewBox: `0 0 ${W} ${H}`, regions: regions.map(layerToRegion) };
        if (backdropLayers) { spec.backdrop = stageSvg(backdropLayers, -1, W, H); spec._backdropLayers = backdropLayers; }
        m.remove(); onSave(spec);
    }

    refresh();
}
