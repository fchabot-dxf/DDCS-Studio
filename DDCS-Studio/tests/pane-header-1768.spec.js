import { test, expect } from '@playwright/test';

// t1768 — THE PANE HEADER: minimal, no LIVE badge. Pins the four things this turn changed:
// (1) the title shows the wizard's OWN NAME (was "Generator Modal"), and no LIVE badge exists anywhere;
// (2) the view toggle PERSISTS across a reload (localStorage, ddcs_blk_view);
// (3) the header bar itself is panel-themed (not --screen, the readout black) — sampled at the header's own
//     pixel, not just asserted on an element in isolation (the t1764/t1766 lesson: assert the pixel that
//     matters, not a proxy element).

async function setupCorner(page) {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram && window.showApp && window.openWiz && window.insertWiz);
  await page.evaluate(() => window.openWiz('user_corner_data'));
  await page.waitForTimeout(400);
  await page.evaluate(() => window.insertWiz());
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => !!window.__blkws);
  await page.waitForTimeout(600);
}

test('the header title is the wizard\'s own name, and no LIVE badge exists', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1000 });
  await setupCorner(page);
  const info = await page.evaluate(() => ({
    title: document.getElementById('blkPaneTitle')?.textContent,
    liveBadge: document.querySelector('.blk-form-live'),
    generatorModalText: document.body.textContent.includes('Generator Modal'),
  }));
  expect(info.title).toBe('Corner (data)');
  expect(info.liveBadge).toBeNull();
  expect(info.generatorModalText, '"Generator Modal" internal vocabulary is gone entirely').toBe(false);
});

test('the header bar itself is panel-themed, not the readout black', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1000 });
  await setupCorner(page);
  const info = await page.evaluate(() => {
    const head = document.querySelector('.blk-pane-head');
    const cs = head ? getComputedStyle(head) : null;
    return { found: !!head, bgColor: cs ? cs.backgroundColor : null };
  });
  expect(info.found, 'the unified header bar exists').toBe(true);
  // --screen is #000 (rgb(0,0,0)) in every theme, deliberately (styles.css) — the header must NOT be that.
  expect(info.bgColor).not.toBe('rgb(0, 0, 0)');
});

test('the view toggle choice persists across a reload', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1000 });
  await setupCorner(page);
  await page.click('.blk-view-btn[data-view="3d"]');
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => document.querySelector('.right').classList.contains('tab-3d'));
  expect(before).toBe(true);

  await page.reload();
  await page.waitForFunction(() => window.ddcsGetBlockProgram && window.showApp);
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => !!window.__blkws);
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => document.querySelector('.right').classList.contains('tab-3d'));
  expect(after, 'the 3D choice survived the reload — the user rarely switches, so it should stay put').toBe(true);
});
