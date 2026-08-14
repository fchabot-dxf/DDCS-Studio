import { expect } from '@playwright/test';

/**
 * tests/support/drawingCheck.js — t1782 (Addition 4), extracted at t1790 (Addition 7) so the modal spec can
 * reuse it instead of a second copy. "A visual host must contain a DRAWING, not a canvas" — the *-in-place
 * family (16 files) asserts `canvas ? 1 : 0`, which is why an empty visual host shipped green; this samples
 * real pixels instead.
 *
 * 3D READBACK works despite no `preserveDrawingBuffer` (checked live before assuming it would fail —
 * createPreviewPanel.js's own comment: "the WebGL 3D clean-capture is a follow-on"): `drawImage(canvas,...)`
 * into a fresh 2D canvas immediately after the scene has settled still captures the last-rendered frame — the
 * browser does not clear a WebGL drawing buffer until the NEXT render call.
 *
 * "NON-UNIFORM" TOLERATES: antialiasing/gradient shading (checked pixel-by-pixel, not by a colour-count
 * threshold), a grid/background texture drawn before the toolpath is (a background alone can already be
 * non-uniform). WHAT IT DOES NOT CATCH: a canvas that draws only a grid/background and nothing else would
 * still read non-uniform — this proves "something visual was painted," not "the toolpath specifically was."
 */

/** Sample a container's real drawing surface (works for a WebGL <canvas> with no preserveDrawingBuffer, or a
 *  plain 2D <canvas>): drawImage into a throwaway 2D canvas, then getImageData and check every pixel against
 *  the first one. Picks the LARGEST canvas under the container (a host can carry more than one — verified
 *  live: the 3D host also carries a legend/overlay canvas that stays 0×0 until later, so picking by area is
 *  what actually finds the real render surface, not the first DOM match). Runs INSIDE the page (passed to
 *  page.evaluate as a function reference) — must stay self-contained, no outer closure references. */
export const sampleCanvas = (sel) => {
    const cont = document.querySelector(sel);
    const host = cont && (cont.parentElement ? cont.parentElement.querySelector('.wiz-viz3d') : null);
    const scope = host || cont;
    if (!scope) return { error: 'container not found' };
    const canvases = Array.from(scope.querySelectorAll('canvas'));
    const direct = cont.tagName === 'CANVAS' ? [cont] : [];
    const all = [...canvases, ...direct];
    if (!all.length) return { error: 'no canvas under container', canvasCount: 0 };
    let best = null, bestArea = -1;
    for (const cv of all) { const a = cv.width * cv.height; if (a > bestArea) { bestArea = a; best = cv; } }
    if (!best || bestArea <= 0) return { error: 'largest canvas is 0×0', canvasCount: all.length };
    const tmp = document.createElement('canvas'); tmp.width = best.width; tmp.height = best.height;
    const tctx = tmp.getContext('2d');
    try { tctx.drawImage(best, 0, 0); } catch (e) { return { error: 'drawImage threw: ' + e.message, canvasCount: all.length }; }
    let data;
    try { data = tctx.getImageData(0, 0, best.width, best.height).data; } catch (e) { return { error: 'getImageData threw: ' + e.message, canvasCount: all.length }; }
    const first = [data[0], data[1], data[2]];
    let nonUniform = false;
    for (let j = 4; j < data.length; j += 4) {
        if (data[j] !== first[0] || data[j + 1] !== first[1] || data[j + 2] !== first[2]) { nonUniform = true; break; }
    }
    return { nonUniform, w: best.width, h: best.height, canvasCount: all.length };
};

/** The render loop (3D) settles asynchronously, so a single-shot sample can catch it mid-first-frame — poll
 *  up to 5s (a real timing property of the renderer, not a fixed guess dressed as a wait) rather than a single
 *  fixed sleep before sampling once.
 *  NON-VACUITY, proven per the t1782 dispatch ("blank the canvas, watch it fail"): manually blanked the real
 *  3D canvas (gl.clear) and the real 2D canvas (ctx.fillRect) in place, then read `sampleCanvas` back
 *  IMMEDIATELY (single-shot, no poll) — read `nonUniform:false`, confirming the detection logic genuinely
 *  fails on a blank surface. The FULL polling check then re-passed within its own retry window: the app
 *  re-renders the scene on its own shortly after (an event-driven redraw, not a fixed animation loop), which
 *  is exactly the timing property the poll exists to tolerate — a transient blank self-heals, a
 *  permanently-empty host would not, since nothing would ever trigger a real redraw for it. */
export async function assertContainerHasDrawing(page, containerSelector, label) {
    let result = null;
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
        result = await page.evaluate(sampleCanvas, containerSelector);
        if (result && result.nonUniform) break;
        await page.waitForTimeout(200);
    }
    expect(result.error, `${label}: readback failed (${JSON.stringify(result)})`).toBeUndefined();
    expect(result.nonUniform, `${label}: the drawing surface (${result.w}x${result.h}, ${result.canvasCount} canvas(es)) must be non-uniform — a blank/uniform canvas means nothing was drawn`).toBe(true);
}
