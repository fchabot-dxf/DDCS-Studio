/**
 * debug/featProbe.js — an EXTERNAL drag probe for the FEATURE canvas (?debug=feat).
 *
 * t2405 (BACKLOG #46, the reopened probe turn) — advisor-directed, dragProbe.js's own pattern verbatim: the
 * owner's real drag on a Wizard View feature handle (surfacing's `pos` square, its W×H corner handle) shows a
 * frozen canvas while the harness (t2391) could not reproduce it. t2391's own method measured whether
 * `FeatureCanvas.render()` FIRED and whether a handle's `cx`/`cy` ATTRIBUTE advanced — both are "did a change
 * happen" signals, not "where is the handle actually painted on screen" ([[assert-the-value-not-the-change]]).
 * This probe measures the one number nobody has: the handle's own `getBoundingClientRect()`, live, alongside
 * the pointer position, so a real human drag (any speed, any device) can be checked against reality instead
 * of a synthetic 20ms-paced repro.
 *
 * Passive, capture-phase listeners only — NO hooks inside featureCanvas.js/devMode.js/userOpView.js, so this
 * is a fix-independent instrument: the same numbers before and after any fix, zero collision with concurrent
 * work in those files. "writes" counts `input`/`change` events observed anywhere (the form↔block writeback
 * path dispatches these — dragProbe.js's own header cites the exact chain: onDrag → set field → dispatch
 * 'input' → update() → render()); "redraws" counts DOM-mutation batches observed on the SVG itself (render()
 * REBUILDS the whole handle layer on every call — fresh elements, not mutated ones — so a mutation batch is a
 * real, passive proxy for "render() ran," no internal hook required). The handle is RE-QUERIED every frame by
 * its own stable `data-hid` (featureCanvas.js's own t122 handle-identity attribute) rather than cached — a
 * cached reference would go stale the instant `render()` replaces the DOM node it points at.
 *
 * ZERO WEIGHT without the flag: app.js only imports this module when location.search has debug=feat.
 * The owner tests by LOOKING (an on-screen readout) or SCREENSHOTTING it — no console, no pasting. A Copy
 * button exists for anyone who ever wants the raw rows; nothing depends on it.
 */

const rows = [];
let overlay = null, body = null, live = null;
let dragging = false, raf = null, frame = 0, lastLine = '';
let svg = null, hid = null, lastX = null, lastY = null;
let writeCount = 0, redrawCount = 0, mo = null;

function el(tag, css, text) {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
}

function mountOverlay() {
    if (overlay) return;
    overlay = el('div',
        'position:fixed; right:8px; top:8px; z-index:99999; background:rgba(0,0,0,.82); color:#7fdc7f;' +
        'font:11px/1.5 monospace; padding:6px 8px; border:1px solid #444; border-radius:6px; max-width:92vw;' +
        'pointer-events:auto; white-space:pre;');
    live = el('div', '', 'feature probe armed — drag a canvas handle');
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

function findHandle() {
    if (!svg) return null;
    if (hid != null) { try { return svg.querySelector(`.fc-handle[data-hid="${CSS.escape(hid)}"]`); } catch (_) { return null; } }
    return svg.querySelector('.fc-handle');   // no data-hid on this handle — best-effort fallback (first one)
}

function measure() {
    const h = findHandle();
    const hb = h ? h.getBoundingClientRect() : null;
    const handlePos = hb ? `${Math.round(hb.left + hb.width / 2)},${Math.round(hb.top + hb.height / 2)}` : 'MISSING';
    const vb = svg ? (svg.getAttribute('viewBox') || '—') : '—';
    const ptr = lastX == null ? '—' : `${Math.round(lastX)},${Math.round(lastY)}`;
    return `f${frame} ptr:${ptr} handle:${handlePos} viewBox:${vb} writes:${writeCount} redraws:${redrawCount}`;
}

function loop() {
    if (!dragging) { raf = null; return; }
    frame++;
    const line = measure();
    if (line !== lastLine) {
        lastLine = line;
        rows.push(line);
        console.log('[featProbe]', line);   // desktop: watch it live in DevTools — same rows as the overlay
        live.textContent = line;
        const r = el('div', '', line);
        body.appendChild(r);
        body.scrollTop = body.scrollHeight;
    }
    raf = requestAnimationFrame(loop);
}

// Passive, capture-phase: observe the same gesture the real handler gets, interfere with nothing.
document.addEventListener('pointerdown', (e) => {
    const h = e.target && e.target.closest && e.target.closest('.fc-handle');
    if (!h) return;
    svg = h.closest('svg.feature-canvas');
    if (!svg) return;
    hid = h.getAttribute('data-hid');
    mountOverlay();
    rows.length = 0; frame = 0; lastLine = ''; body.textContent = ''; writeCount = 0; redrawCount = 0;
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    // SVG elements' own `.className` is an SVGAnimatedString, not a plain string — getAttribute avoids printing "[object SVGAnimatedString]"
    const head = `▼ DRAG | hid:${hid || '(none — first .fc-handle assumed)'} | svg:${svg.id || svg.getAttribute('class') || 'feature-canvas'}`;
    rows.push(head);
    console.log('[featProbe]', head);
    body.appendChild(el('div', 'color:#fc6;', head));
    if (mo) mo.disconnect();
    mo = new MutationObserver(() => { redrawCount++; });   // render() REBUILDS the handle layer — a batch = a real redraw, observed from outside
    mo.observe(svg, { childList: true, subtree: true });
    rows.push(measure());
    if (!raf) raf = requestAnimationFrame(loop);
}, { capture: true, passive: true });

document.addEventListener('pointermove', (e) => { if (dragging) { lastX = e.clientX; lastY = e.clientY; } }, { capture: true, passive: true });

// The writeback chain dispatches these on the bound form field (dragProbe.js's own header cites it: onDrag →
// set field → dispatch 'input' → update() → render()) — counting them anywhere is a coarse but real, passive
// signal for "did a write happen," with no hook into devMode.js/userOpView.js needed.
document.addEventListener('input', () => { if (dragging) writeCount++; }, { capture: true, passive: true });
document.addEventListener('change', () => { if (dragging) writeCount++; }, { capture: true, passive: true });

['pointerup', 'pointercancel'].forEach((t) => document.addEventListener(t, () => {
    if (!dragging) return;
    dragging = false;
    if (mo) { mo.disconnect(); mo = null; }
    // one settle frame AFTER the authoritative onUp write, so the final state is in the record
    requestAnimationFrame(() => {
        frame++;
        const line = '▲ up ' + measure();
        rows.push(line); console.log('[featProbe]', line); live.textContent = line;
        body.appendChild(el('div', 'color:#fc6;', line));
        body.scrollTop = body.scrollHeight;
    });
}, { capture: true, passive: true }));

console.log('[featProbe] armed — drag a feature-canvas handle (?debug=feat)');
