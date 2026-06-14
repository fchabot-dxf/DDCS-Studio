import { test, expect } from '@playwright/test';

// The preview execution engine must stop when you leave its context — switching tabs or opening a wizard.
// Otherwise it keeps running off-screen and its running snapshot clobbers code inserted while it ran.
// window.ddcsStopPreview is the single stop, called from showApp (tab change), wizardManager.open, and the
// drawer-close in setGcodeView.

async function startRun(page) {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.setGcodeView && window.showApp);
  await page.evaluate(() => {
    const ed = document.getElementById('editor');
    ed.value = 'G90\nG0 X0 Y0 Z5\nG1 X100 Y100 F100\nM30';   // a long feed so the run stays active for seconds
    ed.dispatchEvent(new Event('input', { bubbles: true }));
    window.setGcodeView('3d');                                 // open the preview drawer (creates engine)
  });
  await page.evaluate(() => document.getElementById('viz3dAnimate').click());   // ▶ Run
  await page.waitForFunction(() => document.getElementById('viz3dAnimate').classList.contains('on'), { timeout: 4000 });
}

test('leaving the Studio tab stops the running preview engine', async ({ page }) => {
  await startRun(page);
  await page.evaluate(() => window.showApp('blocks'));
  const onAfter = await page.evaluate(() => document.getElementById('viz3dAnimate').classList.contains('on'));
  expect(onAfter, 'engine run stopped on tab change').toBe(false);
});

test('ddcsStopPreview stops a run in place', async ({ page }) => {
  await startRun(page);
  await page.evaluate(() => window.ddcsStopPreview());
  const onAfter = await page.evaluate(() => document.getElementById('viz3dAnimate').classList.contains('on'));
  expect(onAfter).toBe(false);
});
