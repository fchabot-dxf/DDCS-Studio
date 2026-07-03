import { test, expect } from '@playwright/test';

/**
 * DESKTOP Blocks-tab palette collapse (t126) — the #blkToolsHandle vertical tab is now shown on DESKTOP too (was mobile-
 * only), so the Blockly palette/toolbox can collapse+expand there. Collapse is via the toolbox's OWN setVisible() (the
 * canvas genuinely reclaims the width → getWidth() 0). Desktop starts OPEN (tools-open present, handle '✕'); the handle
 * toggles from the FIRST click (applyBreakpoint now routes through setToolsOpen so the class + handle state stay consistent).
 */
test.use({ viewport: { width: 1400, height: 900 } });

test('desktop: the palette collapses and re-expands via the handle; round-trip intact; starts open', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks().length > 0);
  await page.waitForTimeout(400);

  const snap = () => page.evaluate(() => ({
    handleShown: getComputedStyle(document.getElementById('blkToolsHandle')).display !== 'none',
    handleText: document.getElementById('blkToolsHandle').textContent,
    toolsOpen: document.getElementById('blocks-app').classList.contains('tools-open'),
    toolboxWidth: window.__blkws.getToolbox().getWidth(),
    blocks: window.__blkws.getAllBlocks().length,
  }));

  // desktop starts OPEN: the handle is visible, the toolbox has width, tools-open is set, and the handle shows the close glyph
  const start = await snap();
  expect(start.handleShown, 'the tools handle is visible on desktop').toBeTruthy();
  expect(start.toolboxWidth, 'desktop starts with the palette OPEN (width > 0)').toBeGreaterThan(0);
  expect(start.toolsOpen, 'desktop starts with tools-open set (consistent state)').toBeTruthy();
  expect(start.handleText, 'open → the handle shows the close glyph').toBe('✕');

  // first click COLLAPSES (no stale no-op): toolbox width → 0, class cleared, handle back to "Blocks"
  await page.click('#blkToolsHandle');
  await page.waitForTimeout(300);
  const collapsed = await snap();
  expect(collapsed.toolboxWidth, 'first click collapses the palette (canvas reclaims the width)').toBe(0);
  expect(collapsed.toolsOpen, 'collapsed → tools-open cleared').toBeFalsy();
  expect(collapsed.handleText, 'collapsed → the handle shows "Blocks"').toBe('Blocks');
  expect(collapsed.blocks, 'the block model is intact while collapsed').toBe(start.blocks);

  // the handle sits at the left edge, vertically centred (a real, visible tab — not off-screen)
  const box = await page.evaluate(() => { const r = document.getElementById('blkToolsHandle').getBoundingClientRect(); return { left: r.left, top: r.top, w: r.width, vh: window.innerHeight }; });
  expect(box.left, 'handle at the left edge').toBeLessThan(40);
  expect(box.w, 'handle has real width').toBeGreaterThan(0);
  expect(box.top, 'handle vertically centred').toBeGreaterThan(box.vh * 0.3);

  // second click RE-EXPANDS
  await page.click('#blkToolsHandle');
  await page.waitForTimeout(300);
  const reopened = await snap();
  expect(reopened.toolboxWidth, 're-expands (palette visible again)').toBeGreaterThan(0);
  expect(reopened.toolsOpen, 're-opened → tools-open set').toBeTruthy();
  expect(reopened.handleText, 're-opened → the handle shows the close glyph').toBe('✕');

  // round-trip still works: the projected G-code is non-empty after collapse/expand
  const gcode = await page.evaluate(() => (window.ddcsGetBlockGcode ? window.ddcsGetBlockGcode() : (document.getElementById('wiz_user_code') || {}).textContent) || '');
  expect(gcode.length, 'the block → G-code round-trip still produces output').toBeGreaterThan(20);
});
