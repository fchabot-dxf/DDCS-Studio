import { test, expect } from '@playwright/test';

// The I/O button toggles a FLOATING virtual-I/O panel (mounts in <body>, draggable) that OVERLAYS the preview —
// it must NOT dock into the pane or replace the 2D/3D view. (Docking blanked full-screen / portrait layouts
// where the embedded panel landed off-screen.)
test.use({ viewport: { width: 1280, height: 900 } });

test('I/O button floats the panel over the view (never docks/blanks it)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  await page.evaluate(() => { if (window.ioPanel && window.ioPanel.isVisible()) window.ioPanel.hide(); });
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForTimeout(300);

  const r = await page.evaluate(() => {
    const panel = window.ddcsStudio.wizardManager._activePanel;
    const vizCanvas = () => (panel.viz && panel.viz.renderer ? panel.viz.renderer.domElement : null);
    const vizShown = () => { const c = vizCanvas(); return c ? c.style.display !== 'none' : null; };
    const before = vizShown();
    panel.setView('io');   // toggle the float ON
    const io = document.querySelector('.io-panel');
    const onState = {
      ioVisible: io ? io.classList.contains('visible') : false,
      ioEmbedded: io ? io.classList.contains('embedded') : false,   // must be FLOATING, not docked
      ioInBody: io ? io.parentElement === document.body : false,
      vizStillShown: vizShown(),
    };
    panel.setView('io');   // toggle the float OFF
    onState.ioHiddenAfter = io ? !io.classList.contains('visible') : true;
    onState.before = before;
    return onState;
  });

  expect(r.before, '3D view shown to start').toBeTruthy();
  expect(r.ioVisible, 'I/O panel shows on toggle').toBeTruthy();
  expect(r.ioEmbedded, 'I/O panel is FLOATING, not docked').toBeFalsy();
  expect(r.ioInBody, 'I/O panel mounts in <body> (floats)').toBeTruthy();
  expect(r.vizStillShown, '3D view stays put under the float').toBeTruthy();
  expect(r.ioHiddenAfter, 'toggling again hides the float').toBeTruthy();
});
