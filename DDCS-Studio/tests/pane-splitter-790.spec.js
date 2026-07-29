import { test, expect } from '@playwright/test';

/**
 * t790 — THE PANE SPLITTER. A grabbable horizontal divider between the 3D and 2D preview panes rebalances their share
 * continuously (the collapse chevrons are all-or-nothing; this is the ratio). --pane-ratio (the 3D fraction) on :root
 * drives flex-grow (desktop) / body heights (mobile); persisted app-wide (panePrefs, ddcs_pane_ratio); inert while
 * either pane is collapsed; live canvas resize during the drag (followPanelResize reuse). Emit untouched.
 */

const openBoth = async (page, type) => {
  await page.evaluate((t) => window.openWiz(t), type);
  await page.waitForSelector(`#wiz_${type}`, { state: 'visible', timeout: 8000 }).catch(() => {});
  await page.waitForFunction((t) => {
    const s = document.querySelector(`#wiz_${t} .wiz-visual .viz-split`);
    return s && s.querySelector(':scope > .viz-pane-splitter:not(.viz-pane-sizer)') && s.getAttribute('data-split-on') === '1';
  }, type, { timeout: 8000 });
};
const splitBox = (page, type) => page.locator(`#wiz_${type} .wiz-visual .viz-split > .viz-pane-splitter:not(.viz-pane-sizer)`).boundingBox();
const ratio = (page) => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--pane-ratio').trim());
const bodyH = (page, type, kind) => page.evaluate(([t, k]) => Math.round(document.querySelector(`#wiz_${t} [data-viz-pane="${k}"] > .wiz-pane-body`).getBoundingClientRect().height), [type, kind]);

test.describe('desktop', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('the splitter shows between both panes, is a ≥44px grab, and DRAG rebalances live (no snap) + persists', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await page.evaluate(async () => { const m = await import('/ui/panePrefs.js'); m.setPaneRatio(0.5); });
    await openBoth(page, 'contour');

    const b = await splitBox(page, 'contour');
    // ≥44px effective grab (the ::before overlay extends the slim visual bar to 44px)
    const grab = await page.evaluate(() => {
      const sp = document.querySelector('#wiz_contour .wiz-visual .viz-split > .viz-pane-splitter:not(.viz-pane-sizer)');
      const cs = getComputedStyle(sp, '::before');
      const own = sp.getBoundingClientRect().height;
      return Math.round(own + Math.abs(parseFloat(cs.top)) + Math.abs(parseFloat(cs.bottom)));
    });
    expect(grab, 'the splitter effective grab is ≥44px').toBeGreaterThanOrEqual(44);

    const h3Before = await bodyH(page, 'contour', 'preview3d');
    const r0 = await ratio(page);
    // DRAG the splitter DOWN by 100px (a real pointer drag)
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 + 100, { steps: 8 });
    // WHILE dragging (before mouse up): the ratio already moved (live, no post-drag snap)
    const rDuring = await ratio(page);
    await page.mouse.up();
    const rAfter = await ratio(page);
    const h3After = await bodyH(page, 'contour', 'preview3d');

    expect(Number(rDuring), 'the ratio moves LIVE during the drag (no post-drag snap)').not.toBe(Number(r0));
    expect(Number(rAfter), 'the settled ratio == the live ratio (no snap-back on release)').toBeCloseTo(Number(rDuring), 2);
    expect(h3After, 'the 3D pane actually rebalanced (height changed)').not.toBe(h3Before);

    // persisted app-wide + survives reload
    const stored = await page.evaluate(() => localStorage.getItem('ddcs_pane_ratio'));
    expect(Number(stored), 'the ratio persisted to ddcs_pane_ratio').toBeCloseTo(Number(rAfter), 2);
    await page.reload();
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await openBoth(page, 'contour');
    expect(Number(await ratio(page)), 'the ratio survived reload').toBeCloseTo(Number(rAfter), 2);
    await page.evaluate(async () => { const m = await import('/ui/panePrefs.js'); m.setPaneRatio(0.5); });
  });

  test('the splitter goes INERT (hidden) when either pane is collapsed', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await page.evaluate(async () => { const m = await import('/ui/panePrefs.js'); m.resetPanes(); m.setPaneRatio(0.5); });
    await openBoth(page, 'contour');
    // collapse the 3D via its chevron strip
    await page.locator('#wiz_contour [data-viz-pane="preview3d"] > .wiz-pane-bar').click();
    await page.waitForFunction(() => document.querySelector('#wiz_contour [data-viz-pane="preview3d"]').getAttribute('data-collapsed') === '1');
    const r = await page.evaluate(() => {
      const s = document.querySelector('#wiz_contour .wiz-visual .viz-split');
      const sp = s.querySelector(':scope > .viz-pane-splitter:not(.viz-pane-sizer)');
      return { splitOn: s.getAttribute('data-split-on'), visible: getComputedStyle(sp).display !== 'none' };
    });
    expect(r.splitOn, 'the split is off when a pane is collapsed').toBe('0');
    expect(r.visible, 'the splitter is hidden (inert) when a pane is collapsed').toBe(false);
    await page.evaluate(async () => { const m = await import('/ui/panePrefs.js'); m.resetPanes(); });
  });
});

test.describe('mobile 390px', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the splitter rebalances the stacked panes via touch-drag; the total stays (collapse still frees the form)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await page.evaluate(async () => { const m = await import('/ui/panePrefs.js'); m.resetPanes(); m.setPaneRatio(0.5); });
    await openBoth(page, 'contour');
    const totalBefore = (await bodyH(page, 'contour', 'preview3d')) + (await bodyH(page, 'contour', 'layout2d'));
    const b = await splitBox(page, 'contour');
    // touch-drag the splitter down (pointer events are touch-native)
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 + 70, { steps: 6 });
    await page.mouse.up();
    const h3 = await bodyH(page, 'contour', 'preview3d'), h2 = await bodyH(page, 'contour', 'layout2d');
    expect(Math.abs((h3 + h2) - totalBefore), 'the two stacked bodies keep their fixed total (~400) — collapse still frees the form').toBeLessThan(20);
    // dragging DOWN grows the TOP pane + shrinks the bottom (contour = 2D on top) → the 3D body rebalanced away from 200
    expect(Math.abs(h3 - 200), 'the touch-drag rebalanced the panes (3D body moved off the even split)').toBeGreaterThan(20);
    await page.evaluate(async () => { const m = await import('/ui/panePrefs.js'); m.setPaneRatio(0.5); });
  });
});

/**
 * t1357 — RESTATED, NOT REPAIRED. This spec's locators used to say `.viz-pane-splitter` and mean "the ratio handle",
 * which was true right up until t1239 added a SECOND handle below the last pane — the visual-height sizer, which
 * shares the class because it shares the grip language. Playwright's strict mode then failed the spec, and it was
 * right to: the selector had become ambiguous, and the older assertions were reading whichever element happened to
 * come first in the DOM.
 *
 * So the locators name the ratio handle by what distinguishes it (`:not(.viz-pane-sizer)`), and this test states the
 * thing the ambiguity was hiding: there are TWO handles, they are different controls, and each is reachable on its
 * own. The failure was never a regression — it was a feature the spec had not been told about.
 */
test.describe('the two handles are distinct controls', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('the RATIO handle sits between the panes; the SIZER sits below them; both are addressable', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await openBoth(page, 'contour');

    const r = await page.evaluate(() => {
      const split = document.querySelector('#wiz_contour .wiz-visual .viz-split');
      const ratio = split.querySelector(':scope > .viz-pane-splitter:not(.viz-pane-sizer)');
      const sizer = split.querySelector(':scope > .viz-pane-sizer');
      const panes = [...split.querySelectorAll(':scope > [data-viz-pane]')].map((p) => p.getBoundingClientRect());
      const rb = ratio.getBoundingClientRect(), sb = sizer.getBoundingClientRect();
      const top = Math.min(...panes.map((p) => p.top)), bottom = Math.max(...panes.map((p) => p.bottom));
      return {
        both: !!ratio && !!sizer, distinct: ratio !== sizer,
        ratioBetween: rb.top > top && rb.bottom < bottom,     // between the two panes
        sizerBelow: sb.top >= bottom - 1,                      // below the last one
        ratioLabel: ratio.getAttribute('aria-label'), sizerLabel: sizer.getAttribute('aria-label'),
      };
    });
    expect(r.both, 'both handles are present').toBe(true);
    expect(r.distinct, 'and they are different elements').toBe(true);
    expect(r.ratioBetween, 'the ratio handle sits BETWEEN the panes (it rebalances them)').toBe(true);
    expect(r.sizerBelow, 'the sizer sits BELOW the last pane (it resizes the whole block)').toBe(true);
    // …and they say which is which, so the ambiguity cannot come back silently through the accessibility layer either
    expect(r.ratioLabel).toMatch(/rebalance/i);
    expect(r.sizerLabel).toMatch(/resize/i);
  });
});
