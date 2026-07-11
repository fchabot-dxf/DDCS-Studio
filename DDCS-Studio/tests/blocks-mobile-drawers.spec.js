import { test, expect } from '@playwright/test';

// Mobile Blocks tab (≤860px): canvas fills the tab; the Preview is a bottom drawer (G-code behind its toggle)
// and the Blockly palette is a left drawer collapsed via the toolbox's setVisible() so the canvas reclaims the
// width. Guards the responsive UX added for phone editing.
test.use({ viewport: { width: 390, height: 800 } });

test('mobile: palette collapses (canvas reclaims width), preview + palette drawers toggle', async ({ page }) => {
  await page.goto('http://localhost:3211');
  // t710 — window.showApp is set LATE in boot (gatewayStatus, IIFE step 5). A boot-readiness gate is a distinct concern
  // from an action; give it its own 15s budget so 4-worker cold-boot contention can't trip the 5s actionTimeout cap.
  await page.waitForFunction(() => window.ddcsStudio && window.showApp, null, { timeout: 15000 });
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks().length > 0);
  await page.waitForTimeout(500);

  const initial = await page.evaluate(() => {
    const tb = window.__blkws.getToolbox();
    const div = document.querySelector('#blk-ws .blocklyToolboxDiv');
    return {
      toolboxWidth: tb.getWidth(),
      toolboxDisplay: div ? getComputedStyle(div).display : 'none',
      toolsHandleShown: getComputedStyle(document.getElementById('blkToolsHandle')).display !== 'none',
      drawerHandleShown: getComputedStyle(document.getElementById('blkDrawerHandle')).display !== 'none',
      rightOpen: document.querySelector('#blocks-app .right').classList.contains('open'),
    };
  });
  expect(initial.toolboxWidth, 'palette collapsed → canvas reclaims width').toBe(0);
  expect(initial.toolboxDisplay).toBe('none');
  expect(initial.toolsHandleShown, 'left palette handle visible').toBeTruthy();
  expect(initial.drawerHandleShown, 'bottom preview handle visible').toBeTruthy();
  expect(initial.rightOpen, 'preview drawer starts closed').toBeFalsy();

  // open preview drawer
  await page.click('#blkDrawerHandle');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => document.querySelector('#blocks-app .right').classList.contains('open'))).toBeTruthy();

  // toggle to G-code, back to Preview
  await page.click('#blkSegCode');
  expect(await page.evaluate(() => document.querySelector('#blocks-app .right').classList.contains('show-code'))).toBeTruthy();
  await page.click('#blkSegPv');
  expect(await page.evaluate(() => document.querySelector('#blocks-app .right').classList.contains('show-code'))).toBeFalsy();

  // close preview drawer
  await page.click('#blkDrawerClose');
  expect(await page.evaluate(() => document.querySelector('#blocks-app .right').classList.contains('open'))).toBeFalsy();

  // open palette drawer → toolbox shows + width > 0
  await page.click('#blkToolsHandle');
  await page.waitForTimeout(300);
  const opened = await page.evaluate(() => ({
    toolsOpen: document.getElementById('blocks-app').classList.contains('tools-open'),
    toolboxWidth: window.__blkws.getToolbox().getWidth(),
  }));
  expect(opened.toolsOpen).toBeTruthy();
  expect(opened.toolboxWidth, 'palette visible → width > 0').toBeGreaterThan(0);

  // close handle is vertically CENTRED on the palette's right edge — matches the closed "Blocks" tab (user request;
  // supersedes the earlier "park at top" choice). It sits ON the palette edge, so it isn't loose mid-canvas.
  await page.screenshot({ path: 'tests/_blocks-mobile-open.png' });
  const handleBox = await page.evaluate(() => {
    const r = document.getElementById('blkToolsHandle').getBoundingClientRect();
    return { left: r.left, top: r.top, vw: window.innerWidth, vh: window.innerHeight };
  });
  expect(handleBox.top, 'handle is vertically centred, not parked at the top').toBeGreaterThan(handleBox.vh * 0.3);
  expect(handleBox.top, 'handle is vertically centred, not at the bottom').toBeLessThan(handleBox.vh * 0.7);
  expect(handleBox.left, 'handle sits on the palette edge, not pushed off the right').toBeLessThan(handleBox.vw * 0.7);

  // with BOTH palette + preview open, the preview must COVER the palette at their overlap (bottom-left)
  await page.click('#blkDrawerHandle');
  // t710 FLAKE FIX (real transition race): `.right` slides up over a 250ms CSS transform transition. The old
  // waitForTimeout(300) sampled mid-slide under contention. Await the drawer FULLY SETTLED — two consecutive equal
  // `top` reads = the transition finished (a partial "reached the hit-test point" wait was NOT enough: the strip sits
  // at the drawer top, so the resize-drag below grabbed a still-MOVING strip and missed → run-2 flake). Settling makes
  // BOTH the overlap hit-test AND the resize-strip drag valid.
  await page.evaluate(() => { window.__drawerTop = -1; });
  await page.waitForFunction(() => {
    const el = document.querySelector('#blocks-app .right');
    if (!el || !el.classList.contains('open')) return false;
    const top = Math.round(el.getBoundingClientRect().top);
    if (top > window.innerHeight - 80) return false;   // still early in the slide — not yet covering the hit-test point
    // …AND stopped moving: two consecutive equal reads. The covering gate above rules out a START false-positive (the
    // closed top is > innerHeight−80), so the settle check only fires on the final approach — valid for BOTH the overlap
    // hit-test AND the resize-strip drag (the strip rides the drawer top, which must stop before we grab it).
    const settled = window.__drawerTop === top;
    window.__drawerTop = top;
    return settled;
  }, null, { timeout: 15000 });
  const overlap = await page.evaluate(() => {
    const el = document.elementFromPoint(60, window.innerHeight - 80);
    return { inPreview: !!(el && el.closest('.right')), inToolbox: !!(el && el.closest('.blocklyToolbox')) };
  });
  expect(overlap.inPreview, 'preview covers the palette where they overlap').toBeTruthy();
  expect(overlap.inToolbox).toBeFalsy();

  // drag the resize strip up → drawer gets taller
  const before = await page.evaluate(() => document.querySelector('#blocks-app .right').getBoundingClientRect().height);
  const strip = await page.locator('#blocks-app .blk-drawer-resize').boundingBox();
  await page.mouse.move(strip.x + strip.width / 2, strip.y + 8);
  await page.mouse.down();
  await page.mouse.move(strip.x + strip.width / 2, 150, { steps: 8 });   // drag toward the top → taller
  await page.mouse.up();
  // t710 — await the REAL resize result (the drawer grew) rather than a fixed 150ms sleep; the assertion below is the authority.
  await page.waitForFunction((b) => document.querySelector('#blocks-app .right').getBoundingClientRect().height > b + 30, before, { timeout: 5000 }).catch(() => {});
  const after = await page.evaluate(() => document.querySelector('#blocks-app .right').getBoundingClientRect().height);
  expect(after, `drawer resized taller (${before} → ${after})`).toBeGreaterThan(before + 30);

  // close palette drawer → collapses again
  await page.click('#blkToolsHandle');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__blkws.getToolbox().getWidth())).toBe(0);

  await page.screenshot({ path: 'tests/_blocks-mobile-drawers.png' });
});
