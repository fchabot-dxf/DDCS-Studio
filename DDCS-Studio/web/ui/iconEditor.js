/**
 * ui/iconEditor.js — a small SVG-composer canvas for CAM icons (360×180). Not a vector/bezier editor:
 * you place LAYERS — tiles from Studio's viz SVGs, text labels, basic shapes — then move / scale / rotate /
 * reorder them on a true-size stage, and export the exact factory 24-bit BMP (data/bmp.js). The stage uses
 * data-URI tile hrefs so it rasterizes self-contained.
 */
import { bmpDataUrl } from '../data/bmp.js';
import { stageSvg, startGesture, applyGesture } from './shapeStage.js';   // shared drawing core (also used by the region editor)
import { dlgConfirm, dlgPrompt, dlgNotice } from './dialog.js';   // in-app dialogs (t684 d — no bare confirm/prompt/alert)

const W = 360, H = 180, ZOOM = 2;
// Tile source SVG(s) under web/assets/svg/. tileset.svg is the purpose-built CAM-icon library; add more
// files here to extend it. (The old probe-sequence viz files — cornerViz/edgeViz/middleViz/alignViz — are
// retired from the palette; re-add their names here if you want them back.)
const TILESET_FILES = ['tileset'];
let _tileCache = null;

// t1177 SHAPE-LIBRARY REVAMP (Pass 1) — the NICHE op-type glyphs are AUTO-ONLY: hidden from the manual tile palette (a user
// composing an icon by hand would not place a "tool table" or a "rotary clock"), but STILL returned by loadAllTiles so
// auto-glyph can drop them by id. probe_center is already produced by auto-glyph (the middle/inside camType); the rest picture
// ops (alignment/homing/rotary/ATC) that camTypeOf does not yet map to a camType — see the t1177 WORK-LOG flag — so they are
// RESERVED here (present for auto use, absent from the manual grid) until their ops are wired.
const AUTO_ONLY_GLYPHS = new Set(['probe_center', 'align_two', 'home', 'rotary_axis', 'clock_dial', 'tool_change', 'tool_table']);

// Family key for de-dup: strip the direction / axis / position / index tokens *anywhere* in the id (each must
// be a whole _token, so plain words aren't truncated) so repeated variants collapse to one. e.g. all of
// middle_probe_pocket_{X_pos,Y_pos,X_neg,…}_miniprobe → middle_probe_pocket_miniprobe; corner_BL → corner.
function baseId(id) {
    if (/^(badge|num|digit)/i.test(id)) return String(id).toLowerCase();   // numbered tiles stay distinct (badge_0..9)
    return String(id).toLowerCase()
        .replace(/[_-](x|y|z)(?=[_-]|$)/g, '_')
        .replace(/[_-](pos|neg|plus|minus|top|bottom|left|right|front|back|up|down|cw|ccw|xy|yx|zfirst|zlast|bl|br|fl|fr|tl|tr|tc|bc|lc|rc|ne|nw|se|sw|[nsew])(?=[_-]|$)/g, '_')
        .replace(/\d+/g, '')
        .replace(/[_-]+/g, '_').replace(/^_+|_+$/g, '') || String(id);
}
// Show ONLY the target's lineage: walk up to the root hiding each on-path node's siblings, so neighbouring
// geometry (axis lines, other probes) can't bleed into the crop. Ancestor transforms still apply (position).
function isolate(clone, tgt) {
    let node = tgt;
    while (node && node.parentNode && node !== clone) {
        [...(node.parentNode.children || [])].forEach((sib) => {
            const tag = (sib.tagName || '').toLowerCase();
            if (sib !== node && tag !== 'defs' && tag !== 'style' && tag !== 'title' && tag !== 'metadata') sib.style.display = 'none';
        });
        node = node.parentNode;
    }
}

// Extract each id'd group from a source SVG as a cropped tile. The full SVG is kept (so transforms / defs
// stay correct); unrelated id-groups are hidden and the viewBox is cropped to the group's rendered bbox.
// The SVG is mounted at its native viewBox size (1px = 1 user unit), so any canvas size works.
async function extractTiles(file) {
    const resp = await fetch('assets/svg/' + file + '.svg');
    const mount = document.createElement('div');
    mount.style.cssText = 'position:absolute;left:-99999px;top:0;overflow:hidden;';
    mount.innerHTML = await resp.text(); document.body.appendChild(mount);
    const svg = mount.querySelector('svg'); const tiles = [];
    const isShape = (el) => /^(path|rect|circle|ellipse|polygon|polyline|line)$/i.test(el.tagName || '');
    try {
        const vb = (svg.getAttribute('viewBox') || '0 0 465 465').split(/[\s,]+/).map(Number);
        const vw = vb[2] || 465, vh = vb[3] || 465;          // render at the SVG's native viewBox size → 1 unit = 1px
        svg.setAttribute('width', vw); svg.setAttribute('height', vh);
        mount.style.width = vw + 'px'; mount.style.height = vh + 'px';
        const sr = svg.getBoundingClientRect();
        // These viz files are probe-sequence diagrams: the leaf groups are all mini-probes / wcs glyphs, while
        // the actual SHAPES (corner, edge, pocket, boss, quad) are CONTAINER groups. So surface both —
        //   • leaf groups + loose id'd shapes  → primitives (probe tip, datum, loose objects),
        //   • container groups rendered with their child groups hidden  → the bare outline shape,
        // skipping containers that have no own geometry (their outline lives in children, would be blank).
        const groups = [...svg.querySelectorAll('g[id]')];
        const looseShapes = [...svg.querySelectorAll('path[id],polygon[id],polyline[id],rect[id],circle[id],ellipse[id]')].filter((s) => !s.closest('g[id]'));
        const cands = groups.map((g) => ({ g, kind: g.querySelector('g[id]') ? 'outline' : 'leaf' }))
            .filter((c) => c.kind === 'leaf' || [...c.g.children].some(isShape))   // drop outline-less containers
            .concat(looseShapes.map((s) => ({ g: s, kind: 'leaf' })));
        cands.forEach(({ g, kind }) => {
            let gr; try { gr = g.getBoundingClientRect(); } catch (e) { return; }
            if (Math.max(gr.width, gr.height) < 10) return;          // too atomic to be a useful tile
            if (gr.width > 440 && gr.height > 440) return;            // ≈ the full 465 frame (whole diagram)
            const pad = 4, x = gr.left - sr.left - pad, y = gr.top - sr.top - pad;
            const clone = svg.cloneNode(true);
            let tgt = null; try { tgt = clone.querySelector('#' + (window.CSS && CSS.escape ? CSS.escape(g.id) : g.id)); } catch (e) { /* */ }
            if (tgt) {
                isolate(clone, tgt);
                if (kind === 'outline') tgt.querySelectorAll('g[id]').forEach((c) => { c.style.display = 'none'; });   // outline only
            }
            clone.setAttribute('viewBox', `${x.toFixed(1)} ${y.toFixed(1)} ${(gr.width + 2 * pad).toFixed(1)} ${(gr.height + 2 * pad).toFixed(1)}`);
            clone.removeAttribute('width'); clone.removeAttribute('height');
            const toks = String(g.id).split(/[_-]/); const prim = (toks[toks.length - 1] || g.id).toLowerCase();
            tiles.push({ id: g.id, source: file, kind, fam: baseId(g.id), prim, uri: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(clone.outerHTML), w: gr.width, h: gr.height });
        });
    } finally { document.body.removeChild(mount); }
    return tiles;
}
async function loadAllTiles() {
    if (_tileCache) return _tileCache;
    const all = []; for (const f of TILESET_FILES) { try { all.push(...await extractTiles(f)); } catch (e) { /* skip */ } }
    // De-dup by family id: unique names stay (a curated tileset keeps every object); auto-variant probe SVGs
    // still collapse (corner_BL/BR… → corner). Badges are exempt in baseId so badge_0..9 all survive.
    const out = [], seen = new Set();
    for (const t of all) { if (seen.has(t.fam)) continue; seen.add(t.fam); out.push(t); }
    _tileCache = out; return out;
}

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

// rotateVec / boxPoint / stageSvg + the gesture math now live in the shared drawing core (ui/shapeStage.js).

/** Open the editor. `initial` = { layers } or null. onSave(bmpDataUrl, { layers }).
 *  opts.mount (S5b) → render INLINE into that container (no overlay/head/foot) + call opts.onChange({layers}) on every edit;
 *  returns { destroy, getLayers, rasterize } so the host can tear down + rasterize the live layers at build time. */
export function openIconEditor(initial, onSave, opts = {}) {
    const layers = (initial && Array.isArray(initial.layers)) ? JSON.parse(JSON.stringify(initial.layers)) : [];
    // Ensure a real, editable background rectangle at the back (covers the 360×180 frame; recolour/resize like
    // any layer). Added to existing icons too — just behind their content, so nothing changes until recoloured.
    if (!layers.some((l) => l.bg)) layers.unshift({ type: 'rect', x: 0, y: 0, w: W, h: H, rot: 0, scale: 1, bw: W, bh: H, fill: '#000000', color: '#000000', sw: 0, bg: true });
    let sel = -1;
    const mountEl = opts.mount || null;
    const onChange = typeof opts.onChange === 'function' ? opts.onChange : null;
    const inline = !!mountEl;

    const m = document.createElement('div'); m.id = 'iconed-modal'; if (inline) m.classList.add('ie-inline');
    m.innerHTML = `<style>
        #iconed-modal{position:fixed;inset:0;z-index:1200;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);}
        #iconed-modal.ie-inline{position:static;inset:auto;z-index:auto;background:none;display:block;}
        #iconed-modal.ie-inline .ie-panel{width:100%;max-width:none;max-height:none;box-shadow:none;border:none;}
        #iconed-modal.ie-inline .ie-head,#iconed-modal.ie-inline .ie-foot{display:none;}
        #iconed-modal.ie-inline .ie-stage{flex:1 1 300px;max-width:min(520px, calc((90vh - 150px) * ${W} / ${H}));}
        #iconed-modal .ie-panel{background:var(--panel);color:var(--text-main);border:1px solid var(--border);border-radius:8px;width:min(1100px,96vw);max-width:96vw;max-height:94vh;display:flex;flex-direction:column;box-shadow:0 14px 48px rgba(0,0,0,.5);}
        #iconed-modal .ie-head{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border);font-weight:700;}
        #iconed-modal .ie-head .ie-title{flex:1;}
        #iconed-modal .ie-head button[data-ie="x"]{background:transparent;border:none;color:var(--text-dim);font-size:18px;cursor:pointer;}
        /* WORKING AREA: left TOOL RAIL · center CANVAS · right TABBED DOCK */
        #iconed-modal .ie-work{display:flex;flex-wrap:wrap;gap:12px;padding:12px 14px;overflow:auto;align-items:flex-start;}
        /* rail + stage + dock share an inner row so the RAIL and the DOCK both match the STAGE height. align-self:stretch sizes
           each to the flex-line height; the line is driven by the STAGE because the rail (6 small buttons) and the dock (its
           panels are out of flow) both have a SHORTER intrinsic height than the canvas. */
        #iconed-modal .ie-canvasrow{flex:1 1 auto;min-width:0;display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start;}
        /* the rail matches the canvas height: stretch to the stage + space the 6 buttons top-to-bottom (top flush with the
           canvas top, bottom flush with the canvas bottom). 40px buttons → 6×40=240 < the ~260px inline canvas, so the rail
           never spills below it; on the taller standalone canvas space-between just spreads them further apart. */
        #iconed-modal .ie-rail{flex:0 0 auto;align-self:stretch;display:flex;flex-direction:column;justify-content:space-between;gap:0;}
        #iconed-modal .ie-rail button{box-sizing:border-box;flex:0 0 auto;width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text-main);cursor:pointer;}
        #iconed-modal .ie-rail button:hover{border-color:#0ea5e9;}
        #iconed-modal .ie-rail button.active{border-color:#0ea5e9;background:rgba(14,165,233,.15);}
        #iconed-modal .ie-stage{flex:1 1 460px;min-width:220px;max-width:min(760px, calc((94vh - 170px) * ${W} / ${H}));aspect-ratio:${W} / ${H};border:1px solid var(--border);background:#000;touch-action:none;}
        #iconed-modal .ie-stage svg{width:100%;height:100%;display:block;}
        /* the dock matches the CANVAS height (align-self:stretch → the stage sets the flex-line height, since the dock's own
           intrinsic height is collapsed: the tab panels live in .ie-dockbody OUT of flow, so only the tabs count). */
        #iconed-modal .ie-dock{flex:0 0 250px;width:250px;align-self:stretch;display:flex;flex-direction:column;border:1px solid var(--border);border-radius:6px;overflow:hidden;}
        #iconed-modal .ie-dockbody{flex:1 1 0;min-height:150px;position:relative;overflow:hidden;}
        #iconed-modal .ie-tabs{display:flex;border-bottom:1px solid var(--border);}
        #iconed-modal .ie-tabs button{flex:1;padding:7px 4px;font-size:11px;font-weight:600;background:transparent;border:none;border-bottom:2px solid transparent;color:var(--text-dim);cursor:pointer;}
        #iconed-modal .ie-tabs button.active{color:var(--text-main);border-bottom-color:#0ea5e9;}
        #iconed-modal .ie-tabpanel{display:none;padding:10px;position:absolute;inset:0;overflow-y:auto;}   /* out of flow → fills the dockbody + SCROLLS (the Shapes grid no longer drives the dock height) */
        #iconed-modal .ie-tabpanel.active{display:block;}
        #iconed-modal .ie-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(42px,1fr));gap:6px;}
        #iconed-modal .ie-tile{width:100%;aspect-ratio:1;padding:3px;border:1px solid var(--border);border-radius:5px;background:#000;cursor:pointer;display:flex;align-items:center;justify-content:center;}
        #iconed-modal .ie-tile:hover{border-color:#0ea5e9;}
        #iconed-modal .ie-tile img{max-width:100%;max-height:100%;object-fit:contain;pointer-events:none;}
        #iconed-modal .ie-layers{font-size:12px;}
        #iconed-modal .ie-lyr{display:flex;align-items:center;gap:6px;padding:3px 4px;border-bottom:1px solid var(--border);cursor:pointer;}
        #iconed-modal .ie-lyr.sel{background:rgba(14,165,233,.15);}
        #iconed-modal .ie-lyr span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        #iconed-modal .ie-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:6px;}
        #iconed-modal label{font-size:11px;color:var(--text-dim);display:flex;flex-direction:column;gap:2px;}
        #iconed-modal .ie-foot{padding:10px 14px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px;}
        #iconed-modal input[type=range]{width:120px;}
        /* t1470 (user, mobile) — THE THREE-ACROSS ROW CANNOT FIT A PHONE, so below 600px it becomes a COLUMN.
           The row's hard minimum is rail 40 + stage 220 + dock 250 + two 12px gaps = 534px, against ~342px of usable
           width at 400vw. flex-wrap then did what wrapping does and it looked like a bug: the RAIL was left ALONE on
           the first line as a tall 40×240 tower with 274px of dead space beside it, the canvas took line two, and the
           250px dock sat on line three NARROWER THAN — and left-misaligned with — the canvas above it. Stacking is not
           a fallback here, it is the right reading order on a phone: tools ACROSS the top, canvas full width, panel
           below. Same DOM, same tools, one axis changed — nothing is hidden and nothing is scaled.
           The .ie-inline .ie-stage selector is re-stated because its own (1,2,0) max-width would outrank this block. */
        @media (max-width: 600px) {
            #iconed-modal .ie-canvasrow{flex-direction:column;flex-wrap:nowrap;align-items:stretch;}
            #iconed-modal .ie-rail{flex-direction:row;flex-wrap:wrap;justify-content:flex-start;align-self:auto;gap:6px;}
            #iconed-modal .ie-rail button{flex:1 1 44px;width:auto;height:44px;}   /* share the row, and ≥44px to touch */
            #iconed-modal .ie-stage,#iconed-modal.ie-inline .ie-stage{flex:0 0 auto;width:100%;max-width:none;min-width:0;}
            #iconed-modal .ie-dock{flex:0 0 auto;width:100%;align-self:auto;}
            #iconed-modal .ie-dockbody{min-height:200px;}   /* the tile grid needs room once it is no longer canvas-tall */
        }
    </style>
    <div class="ie-panel">
        <div class="ie-head"><span class="ie-title">🖼 Icon editor — 360×180</span><button class="toolbar-btn settings-io" data-ie="import" title="Import a BMP / image as a layer">🖼 Import BMP</button><button data-ie="x" title="Close">✕</button></div>
        <div class="ie-work">
            <div class="ie-canvasrow">
            <div class="ie-rail" title="Tools — Select, or add a shape">
                <button data-tool="select" class="active" title="Select / move (click a shape on the canvas)">▧</button>
                <button data-add="text" title="Add text">T</button>
                <button data-add="rect" title="Add rectangle">▭</button>
                <button data-add="line" title="Add line">／</button>
                <button data-add="circle" title="Add circle">◯</button>
                <button data-add="arrow" title="Add arrow">→</button>
            </div>
            <div class="ie-stage" id="ie_stage"></div>
            <div class="ie-dock">
                <div class="ie-tabs">
                    <button data-tab="shapes" class="active">Shapes</button>
                    <button data-tab="layers">Layers</button>
                    <button data-tab="props">Properties</button>
                </div>
                <div class="ie-dockbody">
                    <div class="ie-tabpanel active" data-panel="shapes"><div class="ie-tiles" id="ie_tiles" title="Tileset — click a tile to drop it on the canvas"><span style="font-size:11px;color:var(--text-dim);">Loading tiles…</span></div></div>
                    <div class="ie-tabpanel" data-panel="layers"><div class="ie-layers" id="ie_layers"></div></div>
                    <div class="ie-tabpanel" data-panel="props"><div id="ie_props"></div></div>
                </div>
            </div>
            </div>
        </div>
        <div class="ie-foot"><button class="toolbar-btn settings-io" data-ie="cancel">Cancel</button><button class="toolbar-btn settings-io primary" data-ie="save">Save icon</button></div>
    </div>`;
    (mountEl || document.body).appendChild(m);
    const $ = (id) => m.querySelector('#' + id);
    const stage = $('ie_stage');

    // Tile toolbar: extract the tileset's id-groups and preview each as a clickable thumbnail. The AUTO-ONLY glyphs
    // (t1177) are filtered OUT of the manual grid here — loadAllTiles still returns them so auto-glyph resolves any id.
    loadAllTiles().then((all) => {
        const bar = $('ie_tiles'); if (!bar) return;
        const tiles = all.filter((t) => !AUTO_ONLY_GLYPHS.has(t.id));
        if (!tiles.length) { bar.innerHTML = '<span style="font-size:11px;color:var(--text-dim);">No tiles found in the current tileset.</span>'; return; }
        bar.innerHTML = tiles.map((t, i) => `<div class="ie-tile" data-ti="${i}" title="${esc(t.id)}  ·  ${esc(t.source)}"><img src="${t.uri}" alt=""></div>`).join('');
        bar.querySelectorAll('[data-ti]').forEach((b) => b.addEventListener('click', () => addTile(tiles[+b.dataset.ti])));
    }).catch(() => { const bar = $('ie_tiles'); if (bar) bar.innerHTML = '<span style="font-size:11px;color:var(--text-dim);">Tileset failed to load.</span>'; });

    function addTile(t) {
        const aspect = (t.w && t.h) ? t.w / t.h : 1; const h0 = 100, w0 = Math.max(8, Math.round(h0 * aspect));
        const L = { type: 'tile', tile: t.id, uri: t.uri, x: (W - w0) / 2, y: (H - h0) / 2, w: w0, h: h0, scale: 1, rot: 0, bw: w0, bh: h0 };
        layers.push(L); sel = layers.length - 1; refresh();
    }

    function renderStage() { stage.innerHTML = stageSvg(layers, sel, W, H, '#000', snapGuide); }
    function renderLayers() {
        $('ie_layers').innerHTML = layers.map((L, i) => `<div class="ie-lyr ${i === sel ? 'sel' : ''}" data-li="${i}"><span>${L.bg ? '▪ background' : L.type === 'text' ? '“' + esc(L.text).slice(0, 16) + '”' : L.type === 'tile' ? L.tile : L.type}</span><button class="op-btn" data-mv="up" title="Forward">▲</button><button class="op-btn" data-mv="dn" title="Back">▼</button><button class="op-btn" data-mv="del" title="Delete">✕</button></div>`).reverse().join('');
    }
    function renderProps() {
        const host = $('ie_props');
        if (sel < 0 || !layers[sel]) { host.innerHTML = '<span style="font-size:11px;color:var(--text-dim);">Nothing selected.</span>'; return; }
        const L = layers[sel];
        let html = `<div class="ie-row">
            <label>W<input type="number" min="6" value="${Math.round(L.w)}" data-p="w" style="width:56px;"></label>
            <button class="op-btn" data-act="lock" title="${L.lock ? 'Aspect locked — uniform scale' : 'Aspect unlocked — free scale'}" style="align-self:flex-end;height:26px;">${L.lock ? '🔒' : '🔓'}</button>
            <label>H<input type="number" min="6" value="${Math.round(L.h)}" data-p="h" style="width:56px;"></label>
            <label>Rotate<input type="number" value="${Math.round(L.rot || 0)}" data-p="rot" style="width:56px;"></label>
        </div>`;
        html += `<div class="ie-row"><button class="op-btn" data-act="cenH" title="Centre this layer on the canvas horizontally">↔ Center H</button><button class="op-btn" data-act="cenV" title="Centre this layer on the canvas vertically">↕ Center V</button></div>`;
        if (L.type === 'text') html += `<div class="ie-row"><label style="flex:1;">Text<input type="text" value="${esc(L.text)}" data-p="text" style="width:100%;"></label><label>Size<input type="number" min="6" max="80" value="${L.size || 20}" data-p="size" style="width:54px;"></label></div>`;
        if (L.type !== 'tile') html += `<div class="ie-row"><label>Colour<input type="color" value="${L.color || (L.type === 'text' ? '#ffd23f' : '#33ccff')}" data-p="color"></label>${L.type !== 'text' && L.type !== 'line' ? `<label>Fill<input type="color" value="${L.fill && L.fill !== 'none' ? L.fill : '#000000'}" data-p="fill"></label><label style="flex-direction:row;align-items:center;gap:4px;"><input type="checkbox" ${L.fill && L.fill !== 'none' ? 'checked' : ''} data-p="fillon">filled</label>` : ''}</div>`;
        host.innerHTML = html;
    }
    function refresh() { renderStage(); renderLayers(); renderProps(); if (onChange) onChange({ layers }); }

    function baseSize(type) {
        if (type === 'tile') return { w: 120, h: 120 };
        if (type === 'text') return { w: 160, h: 28 };
        if (type === 'line' || type === 'arrow') return { w: 120, h: 20 };
        return { w: 90, h: 60 };
    }
    function add(type) {
        const s = baseSize(type); const L = { type, x: (W - s.w) / 2, y: (H - s.h) / 2, w: s.w, h: s.h, scale: 1, rot: 0, bw: s.w, bh: s.h };
        if (type === 'text') { L.text = 'TEXT'; L.size = 20; L.color = '#ffd23f'; }
        else { L.color = '#33ccff'; L.sw = 3; L.fill = 'none'; }
        layers.push(L); sel = layers.length - 1; refresh(); showTab('props');
    }
    // The right dock is TABBED (Shapes / Layers / Properties) — the tool/tile/layer/selection logic is UNCHANGED; the tabs
    // just choose which reused panel (#ie_tiles / #ie_layers / #ie_props) is visible. Selecting or adding jumps to Properties.
    function showTab(name) {
        m.querySelectorAll('.ie-tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
        m.querySelectorAll('.ie-tabpanel').forEach((p) => p.classList.toggle('active', p.dataset.panel === name));
    }
    // Import BMP (top bar) → pick a file → add it as a movable tile layer (reuses addImage — the SAME path the wizard's Import uses).
    function pickImage() {
        const input = document.createElement('input'); input.type = 'file'; input.accept = '.bmp,image/bmp,image/*';
        input.addEventListener('change', () => { const f = input.files && input.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => addImage(r.result); r.readAsDataURL(f); });
        input.click();
    }

    // --- interactions ---
    m.addEventListener('click', (e) => {
        const ie = e.target.dataset.ie;
        if (ie === 'x' || ie === 'cancel') { m.remove(); return; }
        if (ie === 'save') { saveIcon(); return; }
        if (ie === 'import') { pickImage(); return; }
        const tab = e.target.dataset.tab; if (tab) { showTab(tab); return; }              // right-dock tabs
        if (e.target.dataset.tool === 'select') { sel = -1; refresh(); return; }            // left-rail Select = pointer mode (deselect)
        const addT = e.target.dataset.add; if (addT) { add(addT); return; }
        if (e.target.dataset.act === 'lock' && sel >= 0) { layers[sel].lock = !layers[sel].lock; renderProps(); return; }
        if (e.target.dataset.act === 'cenH' && sel >= 0) { layers[sel].x = Math.round((W - layers[sel].w) / 2); refresh(); return; }   // t1183 — centre on the canvas
        if (e.target.dataset.act === 'cenV' && sel >= 0) { layers[sel].y = Math.round((H - layers[sel].h) / 2); refresh(); return; }
        const li = e.target.closest('.ie-lyr'); if (li) { const i = +li.dataset.li; const mv = e.target.dataset.mv;
            if (mv === 'del') { layers.splice(i, 1); sel = Math.min(sel, layers.length - 1); refresh(); }
            else if (mv === 'up') { if (i < layers.length - 1) { [layers[i], layers[i + 1]] = [layers[i + 1], layers[i]]; sel = i + 1; refresh(); } }
            else if (mv === 'dn') { if (i > 0) { [layers[i], layers[i - 1]] = [layers[i - 1], layers[i]]; sel = i - 1; refresh(); } }
            else { sel = i; refresh(); showTab('props'); }
            return;
        }
        if (!inline && e.target === m) m.remove();
    });
    $('ie_props').addEventListener('input', (e) => {
        const L = layers[sel]; if (!L) return; const p = e.target.dataset.p; if (!p) return;
        if (p === 'w' || p === 'h') {
            const cx = L.x + L.w / 2, cy = L.y + L.h / 2, ar = L.w / L.h || 1;
            let nw = L.w, nh = L.h;
            if (p === 'w') { nw = Math.max(6, parseFloat(e.target.value) || L.w); if (L.lock) nh = nw / ar; }
            else { nh = Math.max(6, parseFloat(e.target.value) || L.h); if (L.lock) nw = nh * ar; }
            L.w = nw; L.h = nh; L.x = cx - nw / 2; L.y = cy - nh / 2; L.bw = nw; L.bh = nh; L.scale = 1;
            if (L.lock) { const sib = e.target.closest('.ie-row').querySelector(p === 'w' ? '[data-p="h"]' : '[data-p="w"]'); if (sib) sib.value = Math.round(p === 'w' ? nh : nw); }
        }
        else if (p === 'rot') L.rot = parseFloat(e.target.value) || 0;
        else if (p === 'text') L.text = e.target.value;
        else if (p === 'size') L.size = parseInt(e.target.value, 10) || 20;
        else if (p === 'color') L.color = e.target.value;
        else if (p === 'fill') { L.fill = e.target.value; }
        else if (p === 'fillon') { L.fill = e.target.checked ? (L.fill && L.fill !== 'none' ? L.fill : '#000000') : 'none'; renderProps(); }
        renderStage();
    });
    // Figma-style direct manipulation: drag the body to move, a corner/edge handle to resize (keeping the
    // opposite point anchored, in the layer's own rotated frame), or the top handle to rotate about centre.
    let gesture = null;   // gesture math lives in the shared core (shapeStage.startGesture / applyGesture)
    let snapGuide = null;   // t1183 — the active move-snap {x,y} → the centre guide line; cleared on pointerup
    const ptStage = (e) => { const r = stage.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; };
    stage.addEventListener('pointerdown', (e) => {
        const hEl = e.target.closest('[data-h]');
        if (hEl && sel >= 0) { gesture = startGesture(hEl.dataset.h, layers[sel], ptStage(e)); stage.setPointerCapture(e.pointerId); return; }
        const g = e.target.closest('g[data-li]'); if (!g) return;
        sel = +g.dataset.li; gesture = startGesture(null, layers[sel], ptStage(e)); stage.setPointerCapture(e.pointerId); refresh(); showTab('props');
    });
    stage.addEventListener('pointermove', (e) => {
        if (!gesture || sel < 0) return;
        const res = applyGesture(gesture, layers[sel], ptStage(e), e.shiftKey, e.ctrlKey, W, H);   // t1183 — ctrl=from-centre, shift=uniform; W/H enable the move centre-snap
        snapGuide = (res && res.snap && (res.snap.x || res.snap.y)) ? res.snap : null;
        renderStage();
    });
    stage.addEventListener('pointerup', () => { if (gesture && gesture.type !== 'move') renderProps(); gesture = null; if (snapGuide) { snapGuide = null; renderStage(); } renderLayers(); });

    function saveIcon() {
        rasterizeIconLayers(layers).then((url) => { m.remove(); if (onSave) onSave(url, { layers }); })
            .catch((err) => dlgNotice(err === 'tile' ? 'Could not rasterize the icon (an SVG tile failed to load).' : ('Export failed: ' + (err && err.message ? err.message : err))));
    }

    // S5b — the inline host adds an image (Import BMP) as a tile layer + tears down / rasterizes the LIVE layers at build.
    function addImage(uri) { layers.push(imageTileLayer(uri)); sel = layers.length - 1; refresh(); }

    refresh();
    return { destroy: () => m.remove(), getLayers: () => layers, rasterize: () => rasterizeIconLayers(layers), addImage };
}

/** Rasterize a layer set to a 360×180 BMP data URL (the shared export path — used by the modal Save AND the S5b inline
 *  editor's build-time rasterize). Async (an SVG tile may need to load). Rejects with 'tile' on an image-load failure. */
export function rasterizeIconLayers(layers) {
    return new Promise((resolve, reject) => {
        const svg = stageSvg(layers, -1, W, H);   // no selection ring in the export
        const img = new Image();
        img.onload = () => {
            const c = document.createElement('canvas'); c.width = W; c.height = H;
            const ctx = c.getContext('2d'); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.drawImage(img, 0, 0, W, H);
            try { resolve(bmpDataUrl(W, H, ctx.getImageData(0, 0, W, H).data)); } catch (err) { reject(err); }
        };
        img.onerror = () => reject('tile');
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
}

/** Build the default (auto) layer set for a fresh CAM slot icon: a black background + the slot NAME as editable text.
 *  S5b — the inline editor edits LAYERS, so the "auto icon" is layers (not a baked BMP) → it shows editably + WYSIWYG. */
export function autoIconLayers(name) {
    const label = String(name || 'CAM').trim().slice(0, 14) || 'CAM';
    return [
        { type: 'rect', x: 0, y: 0, w: W, h: H, rot: 0, scale: 1, bw: W, bh: H, fill: '#000000', color: '#000000', sw: 0, bg: true },
        { type: 'text', text: label, x: W * 0.08, y: H * 0.34, w: W * 0.84, h: H * 0.32, size: 38, color: '#ffd23f', rot: 0, scale: 1, bw: W * 0.84, bh: H * 0.32 },
    ];
}

/** Wrap an imported BMP/image (data URL) as a full-canvas TILE layer so the inline editor can show + move/resize it. */
export function imageTileLayer(uri) {
    return { type: 'tile', tile: 'imported', uri, x: 0, y: 0, w: W, h: H, scale: 1, rot: 0, bw: W, bh: H };
}

/** t1175 AUTO-GLYPH — the default fresh-slot icon: a black bg + the op's GLYPH tile centred, LARGE, with NO name text (the
 *  glyph replaces the name). Async (loads the tile URI from the tileset). If `glyphId` is absent or the tile can't be found,
 *  falls back to autoIconLayers(name) (the name text) so a fresh slot never ends up blank. */
export async function autoGlyphLayers(glyphId, fallbackName) {
    if (glyphId) {
        try {
            const t = (await loadAllTiles()).find((x) => x.id === glyphId);
            if (t) {
                const aspect = (t.w && t.h) ? t.w / t.h : 1;
                const gh = 120, gw = Math.max(8, Math.round(gh * aspect));   // centred + large on the 360×180 canvas
                return [
                    { type: 'rect', x: 0, y: 0, w: W, h: H, rot: 0, scale: 1, bw: W, bh: H, fill: '#000000', color: '#000000', sw: 0, bg: true },
                    { type: 'tile', tile: t.id, uri: t.uri, x: (W - gw) / 2, y: (H - gh) / 2, w: gw, h: gh, scale: 1, rot: 0, bw: gw, bh: gh },
                ];
            }
        } catch (_) { /* fall through to the name text */ }
    }
    return autoIconLayers(fallbackName);
}
