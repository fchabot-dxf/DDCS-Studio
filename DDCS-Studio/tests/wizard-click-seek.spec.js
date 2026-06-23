import { test, expect } from '@playwright/test';

// Clicking a line in a wizard CODE PREVIEW (when not playing) places the tool in the preview at that line.
// Trace segments now carry their source line; the panel's seekLine(i) positions the tool to the move that line
// produced, and the wizard wires the code-line click to it.
test.use({ viewport: { width: 1280, height: 900 } });

test('clicking a code line positions the tool at that line (when not playing)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForFunction(() => {
    const p = window.ddcsStudio.wizardManager._activePanel;
    return p && p.viz && p.viz._animSegs && p.viz._animSegs.length;
  });

  const r = await page.evaluate(() => {
    const panel = window.ddcsStudio.wizardManager._activePanel;
    panel.stop();                                   // stop the auto-play so the click-seek isn't fought
    const codeEl = document.querySelector('#wiz_drill_code');
    const lines = [...codeEl.querySelectorAll('.g-line[data-line-index]')];
    const click = (ln) => ln.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const readTool = () => { const t = panel.viz._animTool.position; return { x: t.x, y: t.y, z: t.z }; };

    click(lines[2]);                                // an early line → start of the path
    const a = readTool();
    const visA = panel.viz._animTool.visible;
    const litA = !!codeEl.querySelector('.g-line.active-line');

    click(lines[lines.length - 1]);                 // the last line → end of the path
    const b = readTool();
    return { a, b, visA, litA };
  });

  expect(r.visA, 'tool is shown when a line is clicked').toBeTruthy();
  expect(r.litA, 'the clicked line is highlighted').toBeTruthy();
  const moved = Math.abs(r.a.x - r.b.x) + Math.abs(r.a.y - r.b.y) + Math.abs(r.a.z - r.b.z);
  expect(moved, 'different code lines place the tool at different positions').toBeGreaterThan(0.5);
});
