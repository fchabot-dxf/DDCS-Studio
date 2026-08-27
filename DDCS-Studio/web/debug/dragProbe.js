/**
 * debug/dragProbe.js — an EXTERNAL drag probe for the preview splitters (?debug=drag).
 *
 * t2353-adjacent, advisor-authored (owner-directed one-off): the splitter drag misbehaves on the owner's
 * real devices (3D pane shrinks in either direction; a jump at first touch) while the harness cannot
 * reproduce it. This probe measures what the LAYOUT actually does during a real drag, from OUTSIDE the
 * code under suspicion — passive listeners only, read-only, no hooks inside paneAccordion.js — so it is a
 * fix-independent instrument: the same numbers before and after any fix, and no collision with concurrent
 * work in the handler file.
 *
 * ZERO WEIGHT without the flag: app.js only imports this module when location.search has debug=drag.
 * The owner tests by LOOKING (an on-screen readout) or SCREENSHOTTING it — no console, no pasting.
 * A Copy button exists for anyone who ever wants the raw rows; nothing depends on it.
 */

const rows = [];            // the current drag's recorded frames (change-only)
let overlay = null, body = null, live = null;
let dragging = false, lastY = null, raf = null, frame = 0, lastLine = '';
let visual = null, host = null;

function el(tag, css, text) {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
}

function mountOverlay() {
    if (overlay) return;
    overlay = el('div',
        'position:fixed; left:8px; top:8px; z-index:99999; background:rgba(0,0,0,.82); color:#7fdc7f;' +
        'font:11px/1.5 monospace; padding:6px 8px; border:1px solid #444; border-radius:6px; max-width:92vw;' +
        'pointer-events:auto; white-space:pre;');
    live = el('div', '', 'drag probe armed — drag a preview handle');
    body = el('div', 'max-height:30vh; overflow:auto; margin-top:4px; color:#9ab;');
    const btn = el('button',
        'margin-top:4px; font:11px monospace; background:#222; color:#ddd; border:1px solid #555;' +
        'border-radius:4px; padding:2px 8px;', 'copy rows');
    btn.addEventListener('click', () => {
        try { navigator.clipboard.writeText(rows.join('\n')); btn.textContent = 'copied ✓'; setTimeout(() => { btn.textContent = 'copy rows'; }, 1500); } catch (_) { /* */ }
    });
    overlay.append(live, body, btn);
    document.body.appendChild(overlay);
}

function measure() {
    const vb = visual.getBoundingClientRect(), hb = host.getBoundingClientRect();
    const cs = getComputedStyle(document.documentElement);
    const ratio = (cs.getPropertyValue('--pane-ratio') || '').trim();
    const exp = (visual.style.getPropertyValue('--viz-explicit-h') || '').trim();
    return `f${frame} y:${lastY == null ? '—' : Math.round(lastY)} vis:${Math.round(vb.height)} host:${Math.round(hb.height)} ` +
        `ceil:${Math.floor(hb.bottom - vb.top)} ratio:${ratio || '—'} expH:${exp || '—'}`;
}

function loop() {
    if (!dragging) { raf = null; return; }
    frame++;
    const line = measure();
    if (line !== lastLine) {
        lastLine = line;
        rows.push(line);
        console.log('[dragProbe]', line);   // desktop: watch it live in DevTools — same rows as the overlay
        live.textContent = line;
        const r = el('div', '', line);
        body.appendChild(r);
        body.scrollTop = body.scrollHeight;
    }
    raf = requestAnimationFrame(loop);
}

// Passive, capture-phase listeners: observe the same gestures the real handlers get, interfere with nothing.
document.addEventListener('pointerdown', (e) => {
    const sp = e.target && e.target.closest && e.target.closest('.viz-pane-splitter');
    if (!sp) return;
    visual = sp.closest('.wiz-visual');
    host = visual && visual.parentElement;
    if (!visual || !host) return;
    mountOverlay();
    rows.length = 0; frame = 0; lastLine = ''; body.textContent = '';
    dragging = true; lastY = e.clientY;
    const which = sp.classList.contains('viz-pane-sizer') ? 'SIZER(bottom)' : 'RATIO(middle)';
    const head = `▼ ${which} | visual:${visual.id || visual.className} | parent:${(host.className || host.id || host.tagName)}`;
    rows.push(head);
    console.log('[dragProbe]', head);
    body.appendChild(el('div', 'color:#fc6;', head));
    rows.push(measure());
    if (!raf) raf = requestAnimationFrame(loop);
}, { capture: true, passive: true });

document.addEventListener('pointermove', (e) => { if (dragging) lastY = e.clientY; }, { capture: true, passive: true });

['pointerup', 'pointercancel'].forEach((t) => document.addEventListener(t, () => {
    if (!dragging) return;
    dragging = false;
    // one settle frame AFTER the authoritative onUp write, so the final state is in the record
    requestAnimationFrame(() => {
        frame++;
        const line = '▲ up ' + measure();
        rows.push(line); console.log('[dragProbe]', line); live.textContent = line;
        body.appendChild(el('div', 'color:#fc6;', line));
        body.scrollTop = body.scrollHeight;
    });
}, { capture: true, passive: true }));

console.log('[dragProbe] armed — drag a preview splitter (?debug=drag)');
