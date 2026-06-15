import { test, expect } from '@playwright/test';

// Mobile Blocks tab (≤860px): canvas fills the tab; the Preview is a bottom drawer (G-code behind its toggle)
// and the Blockly palette is a left drawer collapsed via the toolbox's setVisible() so the canvas reclaims the
// width. Guards the responsive UX added for phone editing.
test.use({ viewport: { width: 390, height: 800 } });

test('mobile: palette collapses (canvas reclaims width), preview + palette drawers toggle', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);
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

  // close handle should sit near the TOP (the user's bug: it was vertically centred → floating mid-canvas)
  await page.screenshot({ path: 'tests/_blocks-mobile-open.png' });
  const handleBox = await page.evaluate(() => {
    const r = document.getElementById('blkToolsHandle').getBoundingClientRect();
    return { left: r.left, top: r.top, vw: window.innerWidth };
  });
  expect(handleBox.top, 'handle parks near the top, not vertically centred').toBeLessThan(80);
  expect(handleBox.left, 'handle not pushed off the right edge').toBeLessThan(handleBox.vw * 0.7);

  // close palette drawer → collapses again
  await page.click('#blkToolsHandle');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__blkws.getToolbox().getWidth())).toBe(0);

  await page.screenshot({ path: 'tests/_blocks-mobile-drawers.png' });
});
