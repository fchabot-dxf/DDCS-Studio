import { test, expect } from '@playwright/test';

// The preview execution engine must stop when you leave its context — switching tabs or opening a wizard.
// Otherwise it keeps running off-screen and its running snapshot clobbers code inserted while it ran.
// window.ddcsStopPreview is the single stop, called from showApp (tab change), wizardManager.open, and the
// drawer-close in setGcodeView.
//
// The Studio 3D preview is now the shared createPreviewPanel mounted in #viz3d-panel-host; its controls are
// class-based and the run button's "running" state lives in the `.pp-run.on` class (the old #viz3dAnimate id
// + `on` class on it are gone). We assert on `#viz3d-panel-host .pp-run.on`.

const RUN = '#viz3d-panel-host .pp-run';

async function startRun(page) {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.setGcodeView && window.showApp && typeof window.ddcsGetSettings === 'function');
  await page.evaluate(() => {
    const ed = document.getElementById('editor');
    ed.value = 'G90\nG0 X0 Y0 Z5\nG1 X100 Y100 F100\nM30';   // a long feed so the run stays active for seconds
    ed.dispatchEvent(new Event('input', { bubbles: true }));
    window.ddcsGetSettings().preview.autoLoop = false;         // drive Run explicitly (no auto-loop on open)
    window.setGcodeView('3d');                                 // open the preview drawer (mounts the shared panel)
  });
  await page.waitForSelector(RUN, { state: 'attached', timeout: 8000 });
  await page.locator(RUN).click();                             // ▶ Run
  await expect(page.locator(RUN)).toHaveClass(/\bon\b/, { timeout: 4000 });   // running
}

const isRunning = (page) => page.evaluate((sel) => {
  const b = document.querySelector(sel);
  return !!(b && b.classList.contains('on'));
}, RUN);

test('leaving the Studio tab stops the running preview engine', async ({ page }) => {
  await startRun(page);
  await page.evaluate(() => window.showApp('blocks'));
  expect(await isRunning(page), 'engine run stopped on tab change').toBe(false);
});

test('ddcsStopPreview stops a run in place', async ({ page }) => {
  await startRun(page);
  await page.evaluate(() => window.ddcsStopPreview());
  expect(await isRunning(page)).toBe(false);
});
