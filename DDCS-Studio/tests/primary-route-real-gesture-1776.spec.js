import { test, expect } from '@playwright/test';

/**
 * t1776 — THE PRIMARY ROUTE, END TO END, ALL REAL CLICKS.
 *
 * The audit found: 0 specs click a bar entry, 1 clicks INSERT, 0 click the Blocks tab, and the file NAMED
 * pane-visual-host-real-gesture-1762 (despite its name) drives none of them — it calls the JS functions
 * (openWiz/insertWiz) directly, never the DOM the user actually clicks. This is the first real one: click a
 * command-bar entry (through its group dropdown, which is click-to-toggle — see commandDeck.js:741 — NOT
 * hover-only), fill a distinctive value into the real form field, click the real INSERT button
 * (index.html:1156's `.wiz-foot button.primary`), click the real BLOCKS tab (`[data-app="blocks"]`,
 * index.html:136), and assert the Wizard View shows that exact value. No window.openWiz, no insertWiz, no
 * showApp anywhere in this file.
 *
 * ── t1782 ADDITION 4 — A VISUAL HOST MUST CONTAIN A DRAWING, NOT A CANVAS ──────────────────────────────────────
 * The audit: 83 specs reference a canvas, only 10 read pixels; the *-in-place family (16 files, NOT touched this
 * act — named for a later slice) asserts `canvas ? 1 : 0`, which is why an EMPTY visual host (bug 3) shipped
 * green — a `<canvas>` element existing proves nothing was drawn on it. Extended the same real chain above: once
 * on the Blocks tab, sample BOTH the 3D and 2D visual containers for genuinely non-uniform pixels.
 *
 * 3D READBACK — checked live before assuming it would fail (createPreviewPanel.js's own comment: "the WebGL 3D
 * clean-capture is a follow-on — no preserveDrawingBuffer"), and it actually works: the renderer never sets
 * `preserveDrawingBuffer`, but `drawImage(canvas,...)` into a fresh 2D canvas immediately after the scene has
 * settled still captures the last-rendered frame (the browser does not clear a WebGL drawing buffer until the
 * NEXT actual render call, so a synchronous read shortly after settling sees real content) — verified with a
 * throwaway probe against the live app: `drawImage` + `getImageData` on the WebGL canvas returned genuinely
 * non-uniform pixels, not a blank/uniform buffer. No scene-graph fallback was needed.
 *
 * "NON-UNIFORM" TOLERATES: antialiasing / gradient shading (checked pixel-by-pixel, not by a colour-count
 * threshold, so AA edges only help), the grid/background texture some views draw even before the toolpath does
 * (a background alone can ALREADY be non-uniform — see the explicit caveat below), and JPEG-free lossless PNG
 * sampling artifacts (none expected; canvas readback here is raw RGBA, not a re-encoded image).
 * WHAT IT DOES NOT CATCH: a canvas that draws ONLY a grid/background and nothing else would still read as
 * non-uniform — this check proves "something visual was painted," not "the toolpath specifically was painted."
 * That stronger claim needs a content-aware check (e.g. comparing against a known-empty baseline), which is
 * out of scope for this act — the *-in-place family's element-existence bug is what's being fixed here, and a
 * non-uniform-pixels check is already a large step up from that baseline, stated honestly rather than oversold.
 */

test.use({ viewport: { width: 1500, height: 950 } });

/** Sample a container's real drawing surface (works for a WebGL <canvas> with no preserveDrawingBuffer, or a
 *  plain 2D <canvas>): drawImage into a throwaway 2D canvas, then getImageData and check every pixel against
 *  the first one. Picks the LARGEST canvas under the container (a host can carry more than one — verified live:
 *  the 3D host also carries a legend/overlay canvas that stays 0×0 until later, so picking by area is what
 *  actually finds the real render surface, not the first DOM match). */
const sampleCanvas = (sel) => {
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
 *  NON-VACUITY, proven per the dispatch ("blank the canvas, watch it fail"): manually blanked the real 3D
 *  canvas (gl.clear) and the real 2D canvas (ctx.fillRect) in place, then read `sampleCanvas` back IMMEDIATELY
 *  (single-shot, no poll) — read `nonUniform:false`, confirming the detection logic genuinely fails on a blank
 *  surface. The FULL polling check below then re-passed within its own retry window: the app re-renders the
 *  scene on its own shortly after (an event-driven redraw, not a fixed animation loop), which is exactly the
 *  timing property the poll exists to tolerate — a transient blank self-heals, a permanently-empty host (bug
 *  3's actual shape) would not, since nothing would ever trigger a real redraw for it. */
async function assertContainerHasDrawing(page, containerSelector, label) {
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

test('the primary route: bar entry -> fill -> Insert -> Blocks tab -> the Wizard View shows the value', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });

    // 1) CLICK a command-bar entry. The group dropdown is click-to-toggle (commandDeck.js:741 — a real click
    // listener on the group button, not a CSS :hover rule), so a real click genuinely opens it.
    await page.locator('.dock-header .toolbar-dropdown > button.wizard-btn', { hasText: 'Probe' }).click();
    // wizItemHtml stamps data-optype from `e.type || e.opensAs || e.id` — corner's library entry declares
    // `type: 'corner'`, which wins over its `opensAs: 'user_corner_data'`, so the DOM attribute is "corner".
    const cornerEntry = page.locator('.dock-header .toolbar-dropdown-content button[data-optype="corner"]');
    await expect(cornerEntry).toBeVisible({ timeout: 5000 });
    await cornerEntry.click();

    // 2) FILL a distinctive value into a real form field (the wizard opened as the shared modal — corner's
    // panel is form3d+2d, which wizItemOnclick routes through openWiz, landing on the SAME #wiz_user_form /
    // .wiz-foot as every other bar-opened wizard).
    const distField = page.locator('#wiz_user_form [data-param="dist"]');
    await expect(distField).toBeVisible({ timeout: 5000 });
    const DISTINCTIVE = '777';
    await distField.fill(DISTINCTIVE);
    await distField.dispatchEvent('change');   // formWidgets listens on change/input to persist into the live op

    // 3) CLICK the real INSERT button (index.html:1156).
    await page.locator('.wiz-foot button.primary', { hasText: 'INSERT' }).click();

    // 4) CLICK the real BLOCKS tab (index.html:136).
    await page.locator('[data-app="blocks"]').click();
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsGetBlockProgram().length > 0, null, { timeout: 10000 });

    // 5) ASSERT the Wizard View shows THAT value — either as the live re-derived form field, or in the
    // rendered G-code preview (both are legitimate "the Wizard View shows it" surfaces; check both, report
    // which actually carries it rather than assuming).
    await page.waitForTimeout(600);   // let the pane's own render settle (async import + form build)
    const found = await page.evaluate((val) => {
        const fieldEls = Array.from(document.querySelectorAll('[data-param="dist"]'));
        const fieldMatch = fieldEls.some((el) => String(el.value) === val);
        const codeEls = Array.from(document.querySelectorAll('pre[id^="wiz_"][id$="_code"], #blk_wiz_user pre'));
        const codeText = codeEls.map((el) => el.textContent || '').join('\n');
        const codeMatch = codeText.includes(`#1=${val}`);
        return { fieldMatch, codeMatch, fieldCount: fieldEls.length, codeSnippetAround: codeText.split('\n').find((l) => /#1=/.test(l)) || null };
    }, DISTINCTIVE);

    expect(found.fieldMatch || found.codeMatch, `the Wizard View must show ${DISTINCTIVE} somewhere (field=${found.fieldMatch}, code=${found.codeMatch}, fields seen=${found.fieldCount}, code line=${found.codeSnippetAround})`).toBe(true);

    // 6) t1782 ADDITION 4 — the visual host must contain a DRAWING, not just a <canvas> element.
    await assertContainerHasDrawing(page, '#blk_userViz3dContainer', '3D visual host');
    await assertContainerHasDrawing(page, '#blk_userVizContainer', '2D visual host');
});
