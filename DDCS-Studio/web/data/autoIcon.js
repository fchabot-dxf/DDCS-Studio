/**
 * data/autoIcon.js — render a simple labelled CAM-slot icon (360×180 24-bit BMP) from the op name + kind.
 *
 * The DDCS CAM page shows one static bitmap per slot; at that size the icon is identification only
 * (CAM-MENU-RESEARCH §2.2), so a clean title + a category glyph beats the blank icon a fresh slot ships with.
 * Browser-only (uses a <canvas>); the 24-bit BMP encoder is data/bmp.js. The user can still replace it via the
 * full icon editor. Community style: dark background, one accent colour, short title.
 */
import { bmpDataUrl } from './bmp.js';

// Op method → glyph category. Anything not listed (corner/edge/inside/boss/align) is a probe (crosshair).
const CAT = { drill: 'hole', bore: 'hole', slot: 'slot', pocket: 'area', surface: 'area' };

function glyph(x, cat) {
    x.save();
    x.translate(180, 58);
    x.strokeStyle = '#3cf'; x.fillStyle = '#3cf'; x.lineWidth = 3; x.lineCap = 'round';
    if (cat === 'hole') {                                   // ring of holes
        for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; x.beginPath(); x.arc(Math.cos(a) * 36, Math.sin(a) * 22, 5, 0, 7); x.fill(); }
    } else if (cat === 'area') {                            // pocket / face rectangle
        x.strokeRect(-50, -27, 100, 54);
    } else if (cat === 'slot') {                            // capsule
        x.lineWidth = 16; x.beginPath(); x.moveTo(-42, 0); x.lineTo(42, 0); x.stroke();
    } else {                                                // probe crosshair + ruby
        x.beginPath(); x.moveTo(-46, 0); x.lineTo(46, 0); x.moveTo(0, -28); x.lineTo(0, 28); x.stroke();
        x.beginPath(); x.arc(0, 0, 9, 0, 7); x.stroke();
    }
    x.restore();
}

/** Wrap `name` to at most 2 lines fitting `maxW` at the current font. */
function wrap(x, name, maxW) {
    const words = String(name).split(/\s+/);
    const lines = []; let cur = '';
    for (const w of words) {
        const t = cur ? cur + ' ' + w : w;
        if (cur && x.measureText(t).width > maxW) { lines.push(cur); cur = w; } else cur = t;
    }
    if (cur) lines.push(cur);
    return lines.slice(0, 2);
}

/** Render a slot icon. @returns {string} a `data:image/bmp;base64,…` URL (360×180). */
export function autoIconBmp(name, method) {
    const W = 360, H = 180;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#0a0e14'; x.fillRect(0, 0, W, H);
    x.strokeStyle = '#1b6b4f'; x.lineWidth = 4; x.strokeRect(6, 6, W - 12, H - 12);
    glyph(x, CAT[method] || 'probe');
    x.fillStyle = '#ffd000'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'bold 30px sans-serif';
    const lines = wrap(x, name || 'CAM', W - 36);
    const y0 = 128 - (lines.length - 1) * 18;
    lines.forEach((l, i) => x.fillText(l, W / 2, y0 + i * 36));
    return bmpDataUrl(W, H, x.getImageData(0, 0, W, H).data);
}
