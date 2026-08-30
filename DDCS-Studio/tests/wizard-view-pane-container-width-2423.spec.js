import { test, expect } from '@playwright/test';

/**
 * t2423 (BACKLOG #58) — the Blocks tab's Wizard View pane sized its two-pane-vs-stacked layout off the
 * WINDOW, not off its own width. Owner, with a 2535px-wide screenshot: "on very wide screen the wizard
 * preview should render as for desktop... but from the panel." Two wrong theories died before the real one
 * (recorded in the BACKLOG entry, not repeated here): the actual rule (styles.css, `#blk_wiz_user .wiz-2pane`
 * et al.) was UNCONDITIONAL, not gated on anything — the pane's own width was never consulted at all.
 *
 * Fix: `#blk-formpane` (the pane's own resizable sidebar column, `flex:1` — its width is externally set by
 * the splitter, never by its own content, which is what makes `container-type: inline-size` safe here) is
 * now a size-containment root, and the stacked-layout ruleset moved inside `@container (max-width: 860px)` —
 * the SAME 860px figure the rest of the app already uses for this exact decision (owner ruling: no new
 * breakpoints), now asked of the pane instead of the viewport.
 */

async function setupCornerInPane(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram && window.showApp);
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => !!window.__blkws);
  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const def = U.getUserDef('user_corner_data');
    window.ddcsLoadBlockStack([{ id: 'x1', type: 'op', opType: 'user_corner_data', label: def.label, params: {}, children: [] }]);
  });
  let last = -1;
  for (let i = 0; i < 120; i++) {
    const n = await page.evaluate(() => window.__blkws.getAllBlocks().length);
    if (n === last) break;
    last = n;
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(600);
}

const dragColResize = (page, dx) => page.evaluate((dx) => {
  const root = document.getElementById('blocks-app');
  const handle = root.querySelector('.blk-col-resize');
  const hr = handle.getBoundingClientRect();
  const startX = hr.left + hr.width / 2, y = hr.top + hr.height / 2;
  handle.dispatchEvent(new PointerEvent('pointerdown', { clientX: startX, clientY: y, bubbles: true, pointerId: 1 }));
  window.dispatchEvent(new PointerEvent('pointermove', { clientX: startX + dx, clientY: y, bubbles: true, pointerId: 1 }));
  window.dispatchEvent(new PointerEvent('pointerup', { clientX: startX + dx, clientY: y, bubbles: true, pointerId: 1 }));
}, dx);

const readLayout = (page) => page.evaluate(() => {
  const pane = document.getElementById('blk-formpane');
  const twoPane = document.querySelector('#blk_wiz_user .wiz-2pane');
  return { paneWidth: pane.getBoundingClientRect().width, flexDirection: twoPane ? getComputedStyle(twoPane).flexDirection : null };
});

test.use({ viewport: { width: 1800, height: 900 } });

test('a very wide window with the pane at its DEFAULT (narrow) width still stacks — the ~380px case these rules were written for, unchanged', async ({ page }) => {
  await setupCornerInPane(page, { width: 1800, height: 900 });
  const r = await readLayout(page);
  expect(r.paneWidth, 'default pane width is the known ~380px case').toBeLessThan(420);
  expect(r.flexDirection, 'narrow pane still stacks, exactly as before this turn').toBe('column');
});

test('the SAME very wide window, pane widened past 860px, renders the DESKTOP two-pane layout (the owner\'s own reported case)', async ({ page }) => {
  await setupCornerInPane(page, { width: 1800, height: 900 });
  await dragColResize(page, -600);
  await page.waitForTimeout(200);
  const r = await readLayout(page);
  expect(r.paneWidth, 'the splitter actually widened the pane past the 860px threshold').toBeGreaterThan(860);
  expect(r.flexDirection, 'a wide pane now renders side-by-side, not stacked, regardless of the window being even wider').toBe('row');
});

test('dragging the splitter back narrow degrades the SAME pane back to stacked, LIVE — no reload', async ({ page }) => {
  await setupCornerInPane(page, { width: 1800, height: 900 });
  await dragColResize(page, -600);
  await page.waitForTimeout(200);
  const wide = await readLayout(page);
  expect(wide.flexDirection).toBe('row');
  await dragColResize(page, 700);
  await page.waitForTimeout(200);
  const narrow = await readLayout(page);
  expect(narrow.paneWidth, 'the splitter actually narrowed the pane back down').toBeLessThan(420);
  expect(narrow.flexDirection, 'and the SAME live pane re-stacks without any reload').toBe('column');
});

test('the wizard MODAL (#wiz_user) stays purely viewport-driven — unaffected by the pane\'s own container query even when the pane is widened', async ({ page }) => {
  await setupCornerInPane(page, { width: 1800, height: 900 });
  await dragColResize(page, -600);   // widen the pane splitter — the condition that would expose leakage, if any
  await page.waitForTimeout(200);
  await page.click('#blkOpenModal');
  await page.waitForTimeout(400);
  const wideViewport = await page.evaluate(() => {
    const twoPane = document.querySelector('#wiz_user .wiz-2pane');
    return { flexDirection: twoPane ? getComputedStyle(twoPane).flexDirection : null };
  });
  expect(wideViewport.flexDirection, 'a wide VIEWPORT still renders the modal side-by-side, same as always').toBe('row');
  await page.setViewportSize({ width: 700, height: 900 });
  await page.waitForTimeout(200);
  const narrowViewport = await page.evaluate(() => {
    const twoPane = document.querySelector('#wiz_user .wiz-2pane');
    return { flexDirection: twoPane ? getComputedStyle(twoPane).flexDirection : null };
  });
  expect(narrowViewport.flexDirection, 'and a narrow VIEWPORT still stacks the modal — its own pre-existing media query, untouched by this turn').toBe('column');
});
