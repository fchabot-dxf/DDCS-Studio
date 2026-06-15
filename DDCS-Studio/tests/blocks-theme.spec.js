import { test, expect } from '@playwright/test';

// The Blockly CHROME (canvas/toolbox/flyout) follows the active app theme — its workspace background tracks
// --bg and re-skins live when body[data-theme] changes (block category colours stay semantic). Guards
// blocks/blockly/theme.js + the data-theme MutationObserver in blocksApp.js.
test.use({ viewport: { width: 1400, height: 1000 } });

test('blockly chrome follows the app theme (live re-skin on data-theme switch)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws);
  await page.waitForTimeout(300);

  const read = () => page.evaluate(() => {
    const bg = getComputedStyle(document.body).getPropertyValue('--bg').trim();
    const wsBg = window.__blkws.getTheme().componentStyles.workspaceBackgroundColour;
    return { bg, wsBg };
  });

  // normal theme → light bg
  await page.evaluate(() => document.body.setAttribute('data-theme', 'normal'));
  await page.waitForTimeout(200);
  const normal = await read();
  expect(normal.wsBg.toLowerCase()).toBe(normal.bg.toLowerCase());

  // studio theme → silver bg, canvas follows
  await page.evaluate(() => document.body.setAttribute('data-theme', 'studio'));
  await page.waitForTimeout(200);
  const studio = await read();
  expect(studio.wsBg.toLowerCase()).toBe(studio.bg.toLowerCase());
  expect(studio.wsBg.toLowerCase()).not.toBe(normal.wsBg.toLowerCase());   // actually changed

  await page.screenshot({ path: 'tests/_blocks-theme-studio.png' });
});
