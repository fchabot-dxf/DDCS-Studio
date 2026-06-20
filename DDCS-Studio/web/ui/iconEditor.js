/**
 * ui/iconEditor.js — a small SVG-composer canvas for CAM icons (360×180). Not a vector/bezier editor:
 * you place LAYERS — tiles from Studio's viz SVGs, text labels, basic shapes — then move / scale / rotate /
 * reorder them on a true-size stage, and export the exact factory 24-bit BMP (data/bmp.js). The stage uses
 * data-URI tile hrefs so it rasterizes self-contained.
 */
import { bmpDataUrl } from '../data/bmp.js';

const W = 360, H = 180, ZOOM = 2;
const TILES = [['corner', 'Corner'], ['edge', 'Edge'], ['middle', 'Middle'], ['align', 'Align']];
const tileCache = {};

async function tileDataUri(name) {
    if (tileCache[name]) return tileCache[name];
    const resp = await fetch('assets/svg/' + name + 'Viz.svg');
    let svg = (await resp.text()).replace(/width="100%"/, 'width="465"').replace(/height="100%"/, 'height="465"');
    const uri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    tileCache[name] = uri; return uri;
}

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/** Render the stage SVG markup from the layer list (selected layer gets an outline). */
function stageSvg(layers, sel) {
    const body = layers.map((L, i) => {
        const t = `translate(${L.x} ${L.y}) rotate(${L.rot || 0} ${L.w / 2} ${L.h / 2})`;
        let el = '';
        if (L.type === 'tile') el = `<image href="${L.uri}" x="0" y="0" width="${L.w}" height="${L.h}" preserveAspectRatio="xMidYMid meet"/>`;
        else if (L.type === 'text') el = `<text x="0" y="${L.h * 0.75}" font-family="Consolas, monospace" font-size="${L.size || 20}" fill="${L.color || '#ffd23f'}" style="white-space:pre;">${esc(L.text)}</text>`;
        else if (L.type === 'rect') el = `<rect x="0" y="0" width="${L.w}" height="${L.h}" fill="${L.fill || 'none'}" stroke="${L.color || '#3cf'}" stroke-width="${L.sw || 3}"/>`;
        else if (L.type === 'line') el = `<line x1="0" y1="${L.h / 2}" x2="${L.w}" y2="${L.h / 2}" stroke="${L.color || '#3cf'}" stroke-width="${L.sw || 3}"/>`;
        else if (L.type === 'circle') el = `<ellipse cx="${L.w / 2}" cy="${L.h / 2}" rx="${L.w / 2}" ry="${L.h / 2}" fill="${L.fill || 'none'}" stroke="${L.color || '#3cf'}" stroke-width="${L.sw || 3}"/>`;
        else if (L.type === 'arrow') el = `<g stroke="${L.color || '#3cf'}" stroke-width="${L.sw || 3}" fill="none"><line x1="0" y1="${L.h / 2}" x2="${L.w}" y2="${L.h / 2}"/><polyline points="${L.w - 12},${L.h / 2 - 8} ${L.w},${L.h / 2} ${L.w - 12},${L.h / 2 + 8}"/></g>`;
        const ring = i === sel ? `<rect x="-1" y="-1" width="${L.w + 2}" height="${L.h + 2}" fill="none" stroke="#0ea5e9" stroke-width="1.5" stroke-dasharray="4 3"/>` : '';
        return `<g data-li="${i}" transform="${t}" style="cursor:move;">${el}${ring}</g>`;
    }).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#000"/>${body}</svg>`;
}

/** Open the editor. `initial` = { layers } or null. onSave(bmpDataUrl, { layers }). */
export function openIconEditor(initial, onSave) {
    const layers = (initial && Array.isArray(initial.layers)) ? JSON.parse(JSON.stringify(initial.layers)) : [];
    let sel = layers.length ? 0 : -1;

    const m = document.createElement('div'); m.id = 'iconed-modal';
    m.innerHTML = `<style>
        #iconed-modal{position:fixed;inset:0;z-index:1200;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);}
        #iconed-modal .ie-panel{background:var(--panel);color:var(--text-main);border:1px solid var(--border);border-radius:8px;width:min(880px,96vw);max-height:92vh;display:flex;flex-direction:column;box-shadow:0 14px 48px rgba(0,0,0,.5);}
        #iconed-modal .ie-head{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid var(--border);font-weight:700;}
        #iconed-modal .ie-head button{background:transparent;border:none;color:var(--text-dim);font-size:18px;cursor:pointer;}
        #iconed-modal .ie-body{display:flex;gap:12px;padding:12px 14px;overflow:auto;}
        #iconed-modal .ie-stage{flex:0 0 auto;width:${W * ZOOM}px;height:${H * ZOOM}px;border:1px solid var(--border);background:#000;touch-action:none;}
        #iconed-modal .ie-stage svg{width:100%;height:100%;display:block;}
        #iconed-modal .ie-side{flex:1;min-width:200px;display:flex;flex-direction:column;gap:10px;}
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
        <div class="ie-body">
            <div class="ie-stage" id="ie_stage"></div>
            <div class="ie-side">
                <div class="ie-grp"><h4>Add</h4><div class="ie-row">
                    ${TILES.map(([k, lbl]) => `<button class="toolbar-btn settings-io" data-add="tile" data-tile="${k}">${lbl}</button>`).join('')}
                    <button class="toolbar-btn settings-io" data-add="text">＋ Text</button>
                    <button class="toolbar-btn settings-io" data-add="rect">▭</button>
                    <button class="toolbar-btn settings-io" data-add="line">／</button>
                    <button class="toolbar-btn settings-io" data-add="circle">◯</button>
                    <button class="toolbar-btn settings-io" data-add="arrow">→</button>
                </div></div>
                <div class="ie-grp"><h4>Selected</h4><div id="ie_props"></div></div>
                <div class="ie-grp"><h4>Layers (top = front)</h4><div class="ie-layers" id="ie_layers"></div></div>
            </div>
        </div>
        <div class="ie-foot"><button class="toolbar-btn settings-io" data-ie="cancel">Cancel</button><button class="toolbar-btn settings-io" data-ie="save">Save icon</button></div>
    </div>`;
    document.body.appendChild(m);
    const $ = (id) => m.querySelector('#' + id);
    const stage = $('ie_stage');

    function renderStage() { stage.innerHTML = stageSvg(layers, sel); }
    function renderLayers() {
        $('ie_layers').innerHTML = layers.map((L, i) => `<div class="ie-lyr ${i === sel ? 'sel' : ''}" data-li="${i}"><span>${L.type === 'text' ? '“' + esc(L.text).slice(0, 16) + '”' : L.type === 'tile' ? L.tile : L.type}</span><button class="op-btn" data-mv="up" title="Forward">▲</button><button class="op-btn" data-mv="dn" title="Back">▼</button><button class="op-btn" data-mv="del" title="Delete">✕</button></div>`).reverse().join('');
    }
    function renderProps() {
        const host = $('ie_props');
        if (sel < 0 || !layers[sel]) { host.innerHTML = '<span style="font-size:11px;color:var(--text-dim);">Nothing selected.</span>'; return; }
        const L = layers[sel];
        let html = `<div class="ie-row">
            <label>Scale<input type="range" min="0.1" max="3" step="0.05" value="${(L.scale || 1)}" data-p="scale"></label>
            <label>Rotate<input type="range" min="-180" max="180" step="1" value="${L.rot || 0}" data-p="rot"></label>
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
    function applyScale(L) {   // scale stored separately; w/h are the on-stage box (scale baked into w/h on change)
        // keep simple: w/h are live; scale slider multiplies a stored base. Store base on add.
    }
    async function add(type, tile) {
        const s = baseSize(type); const L = { type, x: (W - s.w) / 2, y: (H - s.h) / 2, w: s.w, h: s.h, scale: 1, rot: 0, bw: s.w, bh: s.h };
        if (type === 'tile') { L.tile = tile; L.uri = await tileDataUri(tile); }
        if (type === 'text') { L.text = 'TEXT'; L.size = 20; L.color = '#ffd23f'; }
        if (type !== 'tile' && type !== 'text') { L.color = '#33ccff'; L.sw = 3; L.fill = 'none'; }
        layers.push(L); sel = layers.length - 1; refresh();
    }

    // --- interactions ---
    m.addEventListener('click', (e) => {
        const ie = e.target.dataset.ie;
        if (ie === 'x' || ie === 'cancel') { m.remove(); return; }
        if (ie === 'save') { saveIcon(); return; }
        const addT = e.target.dataset.add; if (addT) { add(addT, e.target.dataset.tile); return; }
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
        if (p === 'scale') { const sc = parseFloat(e.target.value) || 1; const cx = L.x + L.w / 2, cy = L.y + L.h / 2; L.w = (L.bw || L.w) * sc; L.h = (L.bh || L.h) * sc; L.x = cx - L.w / 2; L.y = cy - L.h / 2; L.scale = sc; }
        else if (p === 'rot') L.rot = parseFloat(e.target.value) || 0;
        else if (p === 'text') L.text = e.target.value;
        else if (p === 'size') L.size = parseInt(e.target.value, 10) || 20;
        else if (p === 'color') L.color = e.target.value;
        else if (p === 'fill') { L.fill = e.target.value; }
        else if (p === 'fillon') { L.fill = e.target.checked ? (L.fill && L.fill !== 'none' ? L.fill : '#000000') : 'none'; renderProps(); }
        renderStage();
    });
    // drag to move (pointer on the stage; hit the nearest <g data-li>)
    let drag = null;
    stage.addEventListener('pointerdown', (e) => {
        const g = e.target.closest('g[data-li]'); if (!g) return;
        sel = +g.dataset.li; const L = layers[sel]; const r = stage.getBoundingClientRect();
        drag = { ox: (e.clientX - r.left) / ZOOM - L.x, oy: (e.clientY - r.top) / ZOOM - L.y };
        stage.setPointerCapture(e.pointerId); refresh();
    });
    stage.addEventListener('pointermove', (e) => {
        if (!drag || sel < 0) return; const L = layers[sel]; const r = stage.getBoundingClientRect();
        L.x = Math.round((e.clientX - r.left) / ZOOM - drag.ox); L.y = Math.round((e.clientY - r.top) / ZOOM - drag.oy);
        renderStage();
    });
    stage.addEventListener('pointerup', () => { drag = null; renderLayers(); });

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
