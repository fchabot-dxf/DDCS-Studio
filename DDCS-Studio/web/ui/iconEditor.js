/**
 * ui/iconEditor.js — a small SVG-composer canvas for CAM icons (360×180). Not a vector/bezier editor:
 * you place LAYERS — tiles from Studio's viz SVGs, text labels, basic shapes — then move / scale / rotate /
 * reorder them on a true-size stage, and export the exact factory 24-bit BMP (data/bmp.js). The stage uses
 * data-URI tile hrefs so it rasterizes self-contained.
 */
import { bmpDataUrl } from '../data/bmp.js';

const W = 360, H = 180, ZOOM = 2;
// Current tileset = the structured viz SVGs; a future custom tileset just adds files here (or a user import).
const TILESET_FILES = ['cornerViz', 'edgeViz', 'middleViz', 'alignViz'];
let _tileCache = null;

// Family key for de-dup: strip the direction / axis / position / index tokens *anywhere* in the id (each must
// be a whole _token, so plain words aren't truncated) so repeated variants collapse to one. e.g. all of
// middle_probe_pocket_{X_pos,Y_pos,X_neg,…}_miniprobe → middle_probe_pocket_miniprobe; corner_BL → corner.
function baseId(id) {
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
// stay correct); unrelated id-groups are hidden and the viewBox is cropped to the group's rendered bbox,
// measured in a hidden 465px mount (1px = 1 user unit, so the client rect maps straight to viewBox coords).
async function extractTiles(file) {
    const resp = await fetch('assets/svg/' + file + '.svg');
    const text = (await resp.text()).replace(/width="100%"/, 'width="465"').replace(/height="100%"/, 'height="465"');
    const mount = document.createElement('div');
    mount.style.cssText = 'position:absolute;left:-99999px;top:0;width:465px;height:465px;overflow:hidden;';
    mount.innerHTML = text; document.body.appendChild(mount);
    const svg = mount.querySelector('svg'); const tiles = [];
    const isShape = (el) => /^(path|rect|circle|ellipse|polygon|polyline|line)$/i.test(el.tagName || '');
    try {
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
    // De-dup across the whole tileset: leaf primitives by TYPE (one mini-probe, one wcs… regardless of which
    // probe/corner they came from); outline shapes by family (one corner, one pocket, one boss…).
    const out = [], seenPrim = new Set(), seenFam = new Set();
    for (const t of all) {
        const key = t.kind === 'leaf' ? 'p:' + t.prim : 'f:' + t.fam;
        const seen = t.kind === 'leaf' ? seenPrim : seenFam;
        if (seen.has(key)) continue; seen.add(key); out.push(t);
    }
    _tileCache = out; return out;
}

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

function rotateVec(v, deg) { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return { x: v.x * c - v.y * s, y: v.x * s + v.y * c }; }
// Stage coords of a box's normalized point (nx,ny ∈ [0,1]), honouring its rotation about the centre.
function boxPoint(nx, ny, b) {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = rotateVec({ x: (nx - 0.5) * b.w, y: (ny - 0.5) * b.h }, b.rot || 0);
    return { x: cx + r.x, y: cy + r.y };
}

/** Render the stage SVG markup from the layer list (selected layer gets a Figma-style handle frame). */
function stageSvg(layers, sel) {
    const body = layers.map((L, i) => {
        const t = `translate(${L.x} ${L.y}) rotate(${L.rot || 0} ${L.w / 2} ${L.h / 2})`;
        let el = '';
        if (L.type === 'tile') el = `<image href="${L.uri}" x="0" y="0" width="${L.w}" height="${L.h}" preserveAspectRatio="none"/>`;
        else if (L.type === 'text') el = `<text x="0" y="${L.h * 0.75}" font-family="Consolas, monospace" font-size="${L.size || 20}" fill="${L.color || '#ffd23f'}" style="white-space:pre;">${esc(L.text)}</text>`;
        else if (L.type === 'rect') el = `<rect x="0" y="0" width="${L.w}" height="${L.h}" fill="${L.fill || 'none'}" stroke="${L.color || '#3cf'}" stroke-width="${L.sw != null ? L.sw : 3}"/>`;
        else if (L.type === 'line') el = `<line x1="0" y1="${L.h / 2}" x2="${L.w}" y2="${L.h / 2}" stroke="${L.color || '#3cf'}" stroke-width="${L.sw != null ? L.sw : 3}"/>`;
        else if (L.type === 'circle') el = `<ellipse cx="${L.w / 2}" cy="${L.h / 2}" rx="${L.w / 2}" ry="${L.h / 2}" fill="${L.fill || 'none'}" stroke="${L.color || '#3cf'}" stroke-width="${L.sw != null ? L.sw : 3}"/>`;
        else if (L.type === 'arrow') el = `<g stroke="${L.color || '#3cf'}" stroke-width="${L.sw != null ? L.sw : 3}" fill="none"><line x1="0" y1="${L.h / 2}" x2="${L.w}" y2="${L.h / 2}"/><polyline points="${L.w - 12},${L.h / 2 - 8} ${L.w},${L.h / 2} ${L.w - 12},${L.h / 2 + 8}"/></g>`;
        let deco = '';
        if (i === sel) {
            const hs = 6, hh = hs / 2;
            const pts = [['nw', 0, 0], ['n', L.w / 2, 0], ['ne', L.w, 0], ['e', L.w, L.h / 2], ['se', L.w, L.h], ['s', L.w / 2, L.h], ['sw', 0, L.h], ['w', 0, L.h / 2]];
            const cur = { nw: 'nwse', n: 'ns', ne: 'nesw', e: 'ew', se: 'nwse', s: 'ns', sw: 'nesw', w: 'ew' };
            deco = `<rect x="0" y="0" width="${L.w}" height="${L.h}" fill="none" stroke="#0ea5e9" stroke-width="1" vector-effect="non-scaling-stroke"/>`
                + `<line x1="${L.w / 2}" y1="0" x2="${L.w / 2}" y2="-20" stroke="#0ea5e9" stroke-width="1"/>`
                + `<circle data-h="rot" cx="${L.w / 2}" cy="-24" r="5" fill="#fff" stroke="#0ea5e9" stroke-width="1.5" style="cursor:grab;"/>`
                + pts.map(([k, px, py]) => `<rect data-h="${k}" x="${px - hh}" y="${py - hh}" width="${hs}" height="${hs}" fill="#fff" stroke="#0ea5e9" stroke-width="1.5" style="cursor:${cur[k]}-resize;"/>`).join('');
        }
        return `<g data-li="${i}" transform="${t}" style="cursor:move;">${el}${deco}</g>`;
    }).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#000"/>${body}</svg>`;
}

/** Open the editor. `initial` = { layers } or null. onSave(bmpDataUrl, { layers }). */
export function openIconEditor(initial, onSave) {
    const layers = (initial && Array.isArray(initial.layers)) ? JSON.parse(JSON.stringify(initial.layers)) : [];
    // New icon → a real, editable background rectangle covering the 360×180 frame (recolour/resize like any layer).
    if (!layers.length) layers.push({ type: 'rect', x: 0, y: 0, w: W, h: H, rot: 0, scale: 1, bw: W, bh: H, fill: '#000000', color: '#000000', sw: 0, bg: true });
    let sel = -1;

    const m = document.createElement('div'); m.id = 'iconed-modal';
    m.innerHTML = `<style>
        #iconed-modal{position:fixed;inset:0;z-index:1200;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);}
        #iconed-modal .ie-panel{background:var(--panel);color:var(--text-main);border:1px solid var(--border);border-radius:8px;width:min(1000px,96vw);max-width:96vw;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 14px 48px rgba(0,0,0,.5);}
        #iconed-modal .ie-head{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid var(--border);font-weight:700;}
        #iconed-modal .ie-head button{background:transparent;border:none;color:var(--text-dim);font-size:18px;cursor:pointer;}
        #iconed-modal .ie-toolbar{display:flex;gap:6px;align-items:center;padding:8px 14px;border-bottom:1px solid var(--border);overflow-x:auto;overflow-y:hidden;min-height:58px;}
        #iconed-modal .ie-tile{flex:0 0 auto;width:48px;height:48px;padding:3px;border:1px solid var(--border);border-radius:5px;background:#000;cursor:pointer;display:flex;align-items:center;justify-content:center;}
        #iconed-modal .ie-tile:hover{border-color:#0ea5e9;}
        #iconed-modal .ie-tile img{max-width:100%;max-height:100%;object-fit:contain;pointer-events:none;}
        #iconed-modal .ie-addrow{display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:8px 14px;border-bottom:1px solid var(--border);}
        #iconed-modal .ie-body{display:flex;flex-wrap:wrap;gap:12px;padding:12px 14px;overflow:auto;}
        #iconed-modal .ie-stage{flex:1 1 360px;min-width:0;max-width:${W * ZOOM}px;aspect-ratio:${W} / ${H};border:1px solid var(--border);background:#000;touch-action:none;}
        #iconed-modal .ie-stage svg{width:100%;height:100%;display:block;}
        #iconed-modal .ie-side{flex:1 1 240px;min-width:180px;display:flex;flex-direction:column;gap:10px;}
        #iconed-modal .ie-grp{border:1px solid var(--border);border-radius:6px;padding:8px;}
        #iconed-modal .ie-grp h4{margin:0 0 6px;font-size:10.5px;letter-spacing:.5px;text-transform:uppercase;color:var(--text-dim);}
        #iconed-modal .ie-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;}
        #iconed-modal .ie-layers{max-height:140px;overflow:auto;font-size:12px;}
        #iconed-modal .ie-lyr{display:flex;align-items:center;gap:6px;padding:3px 4px;border-bottom:1px solid var(--border);cursor:pointer;}
        #iconed-modal .ie-lyr.sel{background:rgba(14,165,233,.15);}
        #iconed-modal .ie-lyr span{flex:1;}
        #iconed-modal label{font-size:11px;color:var(--text-dim);display:flex;flex-direction:column;gap:2px;}
        #iconed-modal .ie-foot{padding:10px 14px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px;}
        #iconed-modal input[type=range]{width:120px;}
    </style>
    <div class="ie-panel">
        <div class="ie-head"><span>🖼 Icon editor — 360×180</span><button data-ie="x">✕</button></div>
        <div class="ie-addrow">
            <button class="toolbar-btn settings-io" data-add="text">＋ Text</button>
            <button class="toolbar-btn settings-io" data-add="rect">▭ Rect</button>
            <button class="toolbar-btn settings-io" data-add="line">／ Line</button>
            <button class="toolbar-btn settings-io" data-add="circle">◯ Circle</button>
            <button class="toolbar-btn settings-io" data-add="arrow">→ Arrow</button>
            <span style="flex:1"></span><span style="font-size:10px;color:var(--text-dim);">click a tile below to drop it on the canvas ↓</span>
        </div>
        <div class="ie-toolbar" id="ie_tiles" title="Tileset — click a tile to drop it on the canvas"><span style="font-size:11px;color:var(--text-dim);">Loading tiles…</span></div>
        <div class="ie-body">
            <div class="ie-stage" id="ie_stage"></div>
            <div class="ie-side">
                <div class="ie-grp"><h4>Selected</h4><div id="ie_props"></div></div>
                <div class="ie-grp"><h4>Layers (top = front)</h4><div class="ie-layers" id="ie_layers"></div></div>
            </div>
        </div>
        <div class="ie-foot"><button class="toolbar-btn settings-io" data-ie="cancel">Cancel</button><button class="toolbar-btn settings-io" data-ie="save">Save icon</button></div>
    </div>`;
    document.body.appendChild(m);
    const $ = (id) => m.querySelector('#' + id);
    const stage = $('ie_stage');

    // Tile toolbar: extract the tileset's id-groups and preview each as a clickable thumbnail.
    loadAllTiles().then((tiles) => {
        const bar = $('ie_tiles'); if (!bar) return;
        if (!tiles.length) { bar.innerHTML = '<span style="font-size:11px;color:var(--text-dim);">No tiles found in the current tileset.</span>'; return; }
        bar.innerHTML = tiles.map((t, i) => `<div class="ie-tile" data-ti="${i}" title="${esc(t.id)}  ·  ${esc(t.source)}"><img src="${t.uri}" alt=""></div>`).join('');
        bar.querySelectorAll('[data-ti]').forEach((b) => b.addEventListener('click', () => addTile(tiles[+b.dataset.ti])));
    }).catch(() => { const bar = $('ie_tiles'); if (bar) bar.innerHTML = '<span style="font-size:11px;color:var(--text-dim);">Tileset failed to load.</span>'; });

    function addTile(t) {
        const aspect = (t.w && t.h) ? t.w / t.h : 1; const h0 = 100, w0 = Math.max(8, Math.round(h0 * aspect));
        const L = { type: 'tile', tile: t.id, uri: t.uri, x: (W - w0) / 2, y: (H - h0) / 2, w: w0, h: h0, scale: 1, rot: 0, bw: w0, bh: h0 };
        layers.push(L); sel = layers.length - 1; refresh();
    }

    function renderStage() { stage.innerHTML = stageSvg(layers, sel); }
    function renderLayers() {
        $('ie_layers').innerHTML = layers.map((L, i) => `<div class="ie-lyr ${i === sel ? 'sel' : ''}" data-li="${i}"><span>${L.type === 'text' ? '“' + esc(L.text).slice(0, 16) + '”' : L.type === 'tile' ? L.tile : L.type}</span><button class="op-btn" data-mv="up" title="Forward">▲</button><button class="op-btn" data-mv="dn" title="Back">▼</button><button class="op-btn" data-mv="del" title="Delete">✕</button></div>`).reverse().join('');
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
        if (L.type === 'text') html += `<div class="ie-row"><label style="flex:1;">Text<input type="text" value="${esc(L.text)}" data-p="text" style="width:100%;"></label><label>Size<input type="number" min="6" max="80" value="${L.size || 20}" data-p="size" style="width:54px;"></label></div>`;
        if (L.type !== 'tile') html += `<div class="ie-row"><label>Colour<input type="color" value="${L.color || (L.type === 'text' ? '#ffd23f' : '#33ccff')}" data-p="color"></label>${L.type !== 'text' && L.type !== 'line' ? `<label>Fill<input type="color" value="${L.fill && L.fill !== 'none' ? L.fill : '#000000'}" data-p="fill"></label><label style="flex-direction:row;align-items:center;gap:4px;"><input type="checkbox" ${L.fill && L.fill !== 'none' ? 'checked' : ''} data-p="fillon">filled</label>` : ''}</div>`;
        host.innerHTML = html;
    }
    function refresh() { renderStage(); renderLayers(); renderProps(); }

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
        layers.push(L); sel = layers.length - 1; refresh();
    }

    // --- interactions ---
    m.addEventListener('click', (e) => {
        const ie = e.target.dataset.ie;
        if (ie === 'x' || ie === 'cancel') { m.remove(); return; }
        if (ie === 'save') { saveIcon(); return; }
        const addT = e.target.dataset.add; if (addT) { add(addT); return; }
        if (e.target.dataset.act === 'lock' && sel >= 0) { layers[sel].lock = !layers[sel].lock; renderProps(); return; }
        const li = e.target.closest('.ie-lyr'); if (li) { const i = +li.dataset.li; const mv = e.target.dataset.mv;
            if (mv === 'del') { layers.splice(i, 1); sel = Math.min(sel, layers.length - 1); refresh(); }
            else if (mv === 'up') { if (i < layers.length - 1) { [layers[i], layers[i + 1]] = [layers[i + 1], layers[i]]; sel = i + 1; refresh(); } }
            else if (mv === 'dn') { if (i > 0) { [layers[i], layers[i - 1]] = [layers[i - 1], layers[i]]; sel = i - 1; refresh(); } }
            else { sel = i; refresh(); }
            return;
        }
        if (e.target === m) m.remove();
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
    const HXY = { nw: [0, 0], n: [0.5, 0], ne: [1, 0], e: [1, 0.5], se: [1, 1], s: [0.5, 1], sw: [0, 1], w: [0, 0.5] };
    let gesture = null;
    const ptStage = (e) => { const r = stage.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; };
    stage.addEventListener('pointerdown', (e) => {
        const hEl = e.target.closest('[data-h]');
        if (hEl && sel >= 0) {
            const L = layers[sel]; const b0 = { x: L.x, y: L.y, w: L.w, h: L.h, rot: L.rot || 0 }; const h = hEl.dataset.h;
            if (h === 'rot') gesture = { type: 'rotate', cx: b0.x + b0.w / 2, cy: b0.y + b0.h / 2 };
            else { const [hx, hy] = HXY[h]; gesture = { type: 'resize', hx, hy, rot: b0.rot, w0: b0.w, h0: b0.h, anchor: boxPoint(1 - hx, 1 - hy, b0) }; }
            stage.setPointerCapture(e.pointerId); return;
        }
        const g = e.target.closest('g[data-li]'); if (!g) return;
        sel = +g.dataset.li; const L = layers[sel]; const P = ptStage(e);
        gesture = { type: 'move', ox: P.x - L.x, oy: P.y - L.y };
        stage.setPointerCapture(e.pointerId); refresh();
    });
    stage.addEventListener('pointermove', (e) => {
        if (!gesture || sel < 0) return; const L = layers[sel]; const P = ptStage(e);
        if (gesture.type === 'move') { L.x = Math.round(P.x - gesture.ox); L.y = Math.round(P.y - gesture.oy); }
        else if (gesture.type === 'rotate') { let a = Math.atan2(P.y - gesture.cy, P.x - gesture.cx) * 180 / Math.PI + 90; if (e.shiftKey) a = Math.round(a / 15) * 15; L.rot = Math.round(a); }
        else if (gesture.type === 'resize') {
            const d = { x: P.x - gesture.anchor.x, y: P.y - gesture.anchor.y }, ld = rotateVec(d, -gesture.rot);
            let nW = gesture.hx === 0.5 ? gesture.w0 : Math.max(6, Math.abs(ld.x));
            let nH = gesture.hy === 0.5 ? gesture.h0 : Math.max(6, Math.abs(ld.y));
            if (L.lock) {   // aspect-locked → uniform: the dragged axis drives the other
                const ar = gesture.w0 / gesture.h0 || 1;
                if (gesture.hx === 0.5) nW = nH * ar; else if (gesture.hy === 0.5) nH = nW / ar;
                else if (nW / gesture.w0 >= nH / gesture.h0) nH = nW / ar; else nW = nH * ar;
            }
            const off = rotateVec({ x: (gesture.hx - 0.5) * nW, y: (gesture.hy - 0.5) * nH }, gesture.rot);
            const cx = gesture.anchor.x + off.x, cy = gesture.anchor.y + off.y;
            L.w = nW; L.h = nH; L.x = cx - nW / 2; L.y = cy - nH / 2; L.bw = nW; L.bh = nH; L.scale = 1;
        }
        renderStage();
    });
    stage.addEventListener('pointerup', () => { if (gesture && gesture.type !== 'move') renderProps(); gesture = null; renderLayers(); });

    function saveIcon() {
        const svg = stageSvg(layers, -1);   // no selection ring in the export
        const img = new Image();
        img.onload = () => {
            const c = document.createElement('canvas'); c.width = W; c.height = H;
            const ctx = c.getContext('2d'); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.drawImage(img, 0, 0, W, H);
            try { const url = bmpDataUrl(W, H, ctx.getImageData(0, 0, W, H).data); m.remove(); onSave(url, { layers }); }
            catch (err) { alert('Export failed: ' + (err && err.message ? err.message : err)); }
        };
        img.onerror = () => alert('Could not rasterize the icon (an SVG tile failed to load).');
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }

    refresh();
}
