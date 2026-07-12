import { test, expect } from '@playwright/test';
import { autoAppDialog, appDialogLog } from './_appDialog.js';   // t684 d — in-app dialog

// #4: per-op wizard templates. Local store round-trips, and the header 📑 popover lists templates and loads one
// into the form. (Save UI uses prompt()/confirm() — local vs cloud when connected — so we seed via the store API.)
test.use({ viewport: { width: 1280, height: 900 } });

test('wizard templates: store round-trips and the popover loads a template into the form', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);

  // store round-trip (local)
  const store = await page.evaluate(async () => {
    const T = await import('/ui/wizardTemplates.js');
    await T.deleteTemplate('edge', 'T1', 'local');
    await T.saveTemplate('edge', 'T1', { axis: 'Y', dir: 'neg', dist: 33 }, 'local');
    const list = await T.listTemplates('edge');
    return { has: list.some((t) => t.name === 'T1' && t.params.dist === 33 && t.where === 'local') };
  });
  expect(store.has, 'saved template is listed locally').toBeTruthy();

  // open the Edge wizard, open the Templates popover via the form-top ★ Save (t794 — the header 📑 button retired), load T1
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('edge'));
  await page.waitForSelector('#wiz_edge', { state: 'visible' });
  await page.waitForSelector('#wiz_edge .wiz-preset-row .wpr-save', { timeout: 8000 });
  await page.click('#wiz_edge .wiz-preset-row .wpr-save');
  await page.waitForSelector('.wiz-tpl-pop .wt-row');
  expect(await page.textContent('.wiz-tpl-pop .wt-name')).toContain('T1');

  await page.click('.wiz-tpl-pop .wt-name');
  const r = await page.evaluate(() => ({
    dist: document.getElementById('p_dist').value,
    dir: document.getElementById('p_dir').value,
    axis: document.getElementById('p_axis').value,
    popClosed: !document.querySelector('.wiz-tpl-pop'),
  }));
  expect(r.dist, 'loaded template seeded the distance').toBe('33');
  expect(r.dir, 'loaded template seeded the direction').toBe('neg');
  expect(r.axis, 'loaded template seeded the axis').toBe('Y');
  expect(r.popClosed, 'popover closes after loading').toBeTruthy();

  await page.evaluate(async () => { const T = await import('/ui/wizardTemplates.js'); await T.deleteTemplate('edge', 'T1', 'local'); });
});

test('the popover "Save current as template" actually saves the open wizard (regression: nothing-to-save)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.evaluate(async () => { const T = await import('/ui/wizardTemplates.js'); await T.deleteTemplate('drill', 'FromPopover', 'local'); });

  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });

  // in-app dialogs: name via prompt ('FromPopover'), confirm → Cancel = local. Any "Nothing to save…" notice is recorded.
  await autoAppDialog(page, { accept: false, prompt: 'FromPopover' });

  await page.waitForSelector('#wiz_drill .wiz-preset-row .wpr-save', { timeout: 8000 });
  await page.click('#wiz_drill .wiz-preset-row .wpr-save');
  await page.waitForSelector('.wiz-tpl-pop .wt-save');
  await page.click('.wiz-tpl-pop .wt-save');
  await page.waitForTimeout(300);

  const r = await page.evaluate(async () => {
    const T = await import('/ui/wizardTemplates.js');
    const list = await T.listTemplates('drill');
    return { saved: list.some((t) => t.name === 'FromPopover') };
  });
  const notices = (await appDialogLog(page)).join(' ');
  expect(notices, 'no "nothing to save" notice').not.toContain('Nothing to save');
  expect(r.saved, 'the open wizard was saved as a template from the popover').toBeTruthy();

  await page.evaluate(async () => { const T = await import('/ui/wizardTemplates.js'); await T.deleteTemplate('drill', 'FromPopover', 'local'); });
});
