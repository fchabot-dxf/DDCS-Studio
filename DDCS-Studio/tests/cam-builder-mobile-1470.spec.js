import { test, expect } from '@playwright/test';

/**
 * t1470 (USER, mobile screenshot on file) — THE BUILD-CAM-SLOT PAGE AT PHONE WIDTH.
 *
 * ── WHAT WAS WRONG, MEASURED AT 400px BEFORE ANYTHING CHANGED ───────────────────────────────────────────────────
 * A desktop three-across working row (tool rail · canvas · tabbed panel) collapsing badly. Its hard minimum is
 * 40 + 220 + 250 + two 12px gaps = 534px against ~342px of usable width, so the flex line WRAPPED — and wrapping is
 * what made it look broken rather than merely tight:
 *
 *     rail    40 × 240   ALONE on the first line, a tall tower with 274px of dead space beside it
 *     stage  314 wide    line two
 *     dock   250 wide    line three — NARROWER than the canvas above it and left-misaligned with it
 *     panel  388 wide    inside 376px of space: 97vw double-counted the overlay's own 12px gutter
 *
 * ── AND WHAT IT IS NOW: the same DOM, one axis turned ───────────────────────────────────────────────────────────
 * Tools ACROSS the top (44px touch targets sharing the row) · canvas full width · panel below at the SAME width ·
 * and the four-column field table scrolling SIDEWAYS IN ITS OWN BOX so the columns stay readable and the PAGE never
 * scrolls. Nothing is hidden, nothing is scaled, no zoom hack — which is why the desktop test below asserts that the
 * wide layout is byte-for-byte where it was.
 */

async function openCam(page) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => typeof window.showApp === 'function');
    await page.evaluate(() => window.showApp('macros'));
    await page.waitForFunction(() => document.querySelector('#macros-app .settings-sidebar .settings-tab[data-target="macros_panel_cam"]'));
    await page.evaluate(() => document.querySelector('#macros-app .settings-sidebar .settings-tab[data-target="macros_panel_cam"]').click());
    await page.waitForFunction(() => typeof window.ddcsOpenCamAuthoring === 'function');
    await page.evaluate(() => { window.ddcsGetBlockProgram = () => ([{ id: 'p1', type: 'op', opType: 'pocket', label: 'Pocket', params: { shape: 'rect', w: 120, h: 90, depth: 5, stepdown: 2, toolDia: 8, feed: 1500, plunge: 120, clearance: 6, rpm: 9000, stepoverPct: 45 } }]); });
    await page.evaluate(() => window.ddcsBuildCamSlot());
    await page.waitForSelector('.cam-auth-overlay .cbm-eb', { timeout: 8000 });
    await page.waitForSelector('#cbm_iconedit #iconed-modal.ie-inline', { timeout: 8000 });
    await page.waitForTimeout(700);
}

const probe = (page) => page.evaluate(() => {
    const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom), w: Math.round(b.width), h: Math.round(b.height) }; };
    const ed = document.querySelector('#cbm_iconedit #iconed-modal.ie-inline');
    const wrap = document.querySelector('.cam-auth-overlay .cbm-tablewrap');
    const btns = [...ed.querySelectorAll('.ie-rail button')].map((b) => r(b));
    return {
        vw: window.innerWidth,
        overlay: r(document.querySelector('.cam-auth-overlay')),
        panel: r(document.querySelector('.cam-auth-overlay > div')),
        rail: r(ed.querySelector('.ie-rail')), stage: r(ed.querySelector('.ie-stage')), dock: r(ed.querySelector('.ie-dock')),
        btns,
        wrap: wrap ? { sw: wrap.scrollWidth, cw: wrap.clientWidth, ox: getComputedStyle(wrap).overflowX } : null,
        docScrollW: document.documentElement.scrollWidth, docClientW: document.documentElement.clientWidth,
    };
});

test('PHONE 400×900 — tools ROW above · canvas full width · panel below at the same width', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 900 });
    await openCam(page);
    const p = await probe(page);
    await page.screenshot({ path: 'scratchpad/t1470-cam-phone.png' });

    // ⚠ THE DEFECT: the rail was 40 wide × 240 tall, stranded on its own line. It is now a ROW.
    expect(p.rail.w, 'the tool rail runs ACROSS, not down').toBeGreaterThan(p.rail.h * 2);
    expect(p.rail.b, 'and it sits ABOVE the canvas').toBeLessThanOrEqual(p.stage.y);
    expect(p.btns.length, 'all six tools survive the reflow').toBe(6);
    expect(Math.min(...p.btns.map((b) => b.h)), 'each tool is a ≥44px touch target').toBeGreaterThanOrEqual(44);

    // FULL WIDTH AND ALIGNED — the dock was 250 against a 314 canvas, left-misaligned. All three now share an edge.
    expect(p.dock.y, 'the tabbed panel is BELOW the canvas').toBeGreaterThanOrEqual(p.stage.b);
    expect(Math.abs(p.dock.w - p.stage.w), 'the panel is exactly as wide as the canvas').toBeLessThanOrEqual(1);
    expect(Math.abs(p.rail.w - p.stage.w), 'and so is the tool row').toBeLessThanOrEqual(1);
    expect(Math.abs(p.dock.x - p.stage.x), 'their left edges line up').toBeLessThanOrEqual(1);

    // the panel stays inside the gutter the overlay reserved for it (97vw double-counted that padding)
    expect(p.panel.w, 'the panel fits inside the overlay').toBeLessThanOrEqual(p.overlay.w - 20);
});

test('PHONE 400×900 — the field table scrolls in ITS OWN container, and the page does not', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 900 });
    await openCam(page);
    const p = await probe(page);
    expect(p.wrap, 'the table has a scroll container').toBeTruthy();
    expect(p.wrap.ox, 'that container is the scroller').toBe('auto');
    expect(p.wrap.sw, 'the four columns keep a readable width and overflow it').toBeGreaterThan(p.wrap.cw);
    // ⚠ the whole point of "its own container": the page itself must not scroll sideways.
    expect(p.docScrollW, 'no horizontal page scroll').toBe(p.docClientW);
});

test('DESKTOP 1400px — the wide layout is UNMOVED: rail | canvas | dock still one row, table still unscrolled', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1000 });
    await openCam(page);
    const p = await probe(page);

    // the exact pre-change geometry, pinned — this is the half of the act that must not have happened.
    expect(p.rail.w, 'the rail is the 40px column it always was').toBe(40);
    expect(p.rail.h, 'stretched to the canvas height').toBe(260);
    expect(p.stage.w, 'the canvas keeps its 520px stage').toBe(520);
    expect(p.dock.w, 'the dock keeps its 250px').toBe(250);
    expect(p.panel.w, 'and the surface keeps its 1000px cap').toBe(1000);
    // one ROW: rail left of stage left of dock, all three vertically aligned
    expect(p.rail.r).toBeLessThanOrEqual(p.stage.x);
    expect(p.stage.r).toBeLessThanOrEqual(p.dock.x);
    expect(p.rail.y).toBe(p.stage.y);
    expect(p.dock.y).toBe(p.stage.y);
    // the scroll container is INERT here — it exists, and it never scrolls
    expect(p.wrap.sw, 'the desktop table fits, so nothing scrolls').toBe(p.wrap.cw);
});
