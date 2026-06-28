import { test, expect } from '@playwright/test';

// GLYPH/COLOUR coherence (turn 45): RED = the moving probe tip (the ruby that touches); the START = a distinct STATIC
// non-red glyph (a cyan diamond). This locks the INTENT + the fix mechanism (perceptibility = the human's eyes):
//   • 3D start marker = a camera-locked SPRITE (a hollow cyan lozenge ◇), the 3D twin of the 2D start handle — NOT a red sphere.
//   • 3D probe = a RED ruby BALL at the tip; it is TRANSPARENT + renderOrder ABOVE the orange tool so it draws on TOP
//     (an opaque ruby rendered in the opaque pass BEFORE the transparent orange tool → the orange covered it = not red).
//   • the tool body stays orange (only the ball is red).
test.use({ viewport: { width: 1280, height: 900 } });

test('3D: start = camera-locked cyan lozenge, probe ruby = red ball drawn on top of the orange tool', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz; });

  const r = await page.evaluate(() => {
    const viz = window.ddcsStudio.wizardManager._activePanel.viz;
    viz._passCount = 1; viz._ensureMarkers && viz._ensureMarkers(); viz._highlightSelectedStart && viz._highlightSelectedStart();
    const m = viz.spindleMarkers[0].children[0];
    viz.setSimTool({ type: 'probe', dia: 6 });
    const ruby = viz._animParts.ruby, tool = viz._animParts.tool;
    return {
      startType: m.type, startHasMap: !!(m.material && m.material.map),
      rubyColor: ruby && ruby.material.color.getHex(), rubyTransparent: ruby && ruby.material.transparent,
      rubyOrder: ruby && ruby.renderOrder, toolOrder: tool.renderOrder, toolColor: tool.material.color.getHex(),
    };
  });

  expect(r.startType, 'start glyph is a camera-locked sprite (billboard lozenge), like the 2D ◇').toBe('Sprite');
  expect(r.startHasMap, 'start lozenge has its hollow-diamond texture').toBe(true);
  expect(r.rubyColor, 'probe ruby tip is RED').toBe(0xff2a44);
  expect(r.rubyTransparent, 'ruby is transparent so it sorts into the orange tool\'s pass').toBe(true);
  expect(r.rubyOrder, 'ruby draws AFTER (on top of) the orange tool').toBeGreaterThan(r.toolOrder);
  expect(r.toolColor, 'the tool body stays orange (only the ball is red)').toBe(0xffab40);
});
