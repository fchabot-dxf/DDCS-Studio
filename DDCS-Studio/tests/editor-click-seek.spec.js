import { test, expect } from '@playwright/test';

// #5b: clicking / moving the caret in the Studio main editor (when the 3D preview is open and not playing)
// places the tool in the preview at that line — the editor counterpart of the wizard click-to-position.
test.use({ viewport: { width: 1280, height: 900 } });

test('clicking the editor places the tool at the caret line (Studio main)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.setGcodeView && document.getElementById('editor'));

  await page.evaluate(() => {
    const ed = document.getElementById('editor');
    ed.value = 'G0 X0 Y0 Z5\nG1 X10 Y0 Z-2 F100\nG1 X10 Y10 Z-2\nG1 X0 Y10 Z-2\nG0 Z5';
    ed.dispatchEvent(new Event('input', { bubbles: true }));
    window.setGcodeView('3d');
  });
  await page.waitForFunction(() => window.__gpPanel && window.__gpPanel.viz && window.__gpPanel.viz._animSegs && window.__gpPanel.viz._animSegs.length);

  const r = await page.evaluate(() => {
    const panel = window.__gpPanel;
    panel.stop();
    const ed = document.getElementById('editor');
    const lines = ed.value.split('\n');
    const clickLine = (n) => {
      const pos = lines.slice(0, n).join('\n').length + (n > 0 ? 1 : 0);   // char offset of the start of line n
      ed.selectionStart = ed.selectionEnd = pos;
      ed.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    };
    const tool = () => { const t = panel.viz._animTool.position; return { x: t.x, y: t.y, z: t.z }; };
    clickLine(1); const a = tool(); const vis = panel.viz._animTool.visible;
    clickLine(3); const b = tool();
    return { a, b, vis };
  });

  expect(r.vis, 'tool is shown when clicking in the editor').toBeTruthy();
  const moved = Math.abs(r.a.x - r.b.x) + Math.abs(r.a.y - r.b.y);
  expect(moved, 'different caret lines place the tool at different positions').toBeGreaterThan(0.5);
});
