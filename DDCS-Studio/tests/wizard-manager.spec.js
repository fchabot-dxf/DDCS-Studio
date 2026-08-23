import { test, expect } from '@playwright/test';
import { autoAppDialog } from './_appDialog.js';   // t684 d — the in-app dialog replaced native confirm/prompt/alert

/**
 * The wizard bar arrangement manager (ui/wizardManagerPanel.js) — a section tree that designs the bar. Drives
 * the real overlay: t2196 — reached from Settings → Look and feel → Appearance → "Wizard bar…", opening in its
 * own small panel (#wizbarOverlay) rather than a sixth sidebar sub-tab. Exercises every control (hide, rename,
 * regroup, reorder, reset) and asserts each edit flows LIVE to the wizard bar. A custom op (authored in Dev
 * mode) shows in its Custom dropdown.
 */
test.use({ viewport: { width: 1280, height: 900 } });

// the bar's center groups (Probe/ATC/Mill/Custom…), each item's label text + onclick
const readBar = (page) => page.evaluate(() => {
  const read = (sel) => Array.from(document.querySelectorAll(sel)).map((dd) => ({
    label: (dd.querySelector('.btn-tx')?.textContent || '').trim(),
    items: Array.from(dd.querySelectorAll('.toolbar-dropdown-content > button')).map((b) => ({
      text: b.textContent.trim(), onclick: b.getAttribute('onclick') || '',
    })),
  }));
  return read('.dock-header .header-center .toolbar-dropdown');
});
const libState = (page) => page.evaluate(async () => {
  const WL = await import('/blocks/wizardLibrary.js');
  const lib = WL.getLibrary();                       // visible-only, as the bar sees it
  const ids = (g) => ((lib.groups.find((x) => x.id === g) || {}).items || []).map((i) => i.id);
  const label = (g, id) => (((lib.groups.find((x) => x.id === g) || {}).items || []).find((i) => i.id === id) || {}).label;
  return { groups: lib.groups.map((g) => g.id), mill: ids('mill'), setup: ids('setup'), wcsLabel: label('probe', 'wcs') };
});

test('Wizard library manager: every control flows live to the bar', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.openSettings && window.ddcsRefreshWizardBar);   // t1307 — the declared boot signal FIRST (t1279): the globals below exist before the deferred wiring reaches the controls this spec clicks
  await autoAppDialog(page, { accept: true });   // confirm → proceed; notice → dismiss
  await page.evaluate(() => { localStorage.removeItem('ddcs_user_ops'); localStorage.removeItem('ddcs_wizard_layout'); window.ddcsRefreshWizardBar(); });

  // t2196 — the wizard-bar panel opens directly (own small panel, not a Settings sub-tab any more)
  await page.evaluate(() => window.openWizardBarManager());
  await expect(page.locator('#wizbarOverlay')).toBeVisible();

  const mgr = page.locator('#wizbarTree');
  // catalog rendered incl. hidden-capable entries; a built-in row carries the badge (no per-row action — arrange only)
  await expect(mgr.locator('[data-entry="pocket"]')).toContainText('BUILT-IN');

  // 1. HIDE pocket → drops out of the bar (the real checkbox is visually hidden by .ddcs-switch; click the slider)
  await expect(mgr.locator('[data-entry="pocket"] input[type="checkbox"]')).toBeChecked();
  await mgr.locator('[data-entry="pocket"] .ddcs-slider').click();
  let mill = (await readBar(page)).find((g) => g.label === 'Mill');
  expect(mill.items.some((i) => i.onclick.includes("openWiz('pocket')"))).toBe(false);
  expect((await libState(page)).mill).not.toContain('pocket');

  // 2. a CUSTOM op (authored in Dev mode → saved) shows in its Custom dropdown — in the manager + the bar
  await page.evaluate(async () => {
    const L = await import('/blocks/wizardLibrary.js');
    const U = await import('/blocks/userOps.js');
    L.createWizard(U.userOpFromStack('my_op', 'My Op', [{ type: 'move', params: { x: 0, y: 0, z: -5 } }], [{ param: 'depth', blockIndex: 0, key: 'z', type: 'number', default: -5 }]));
    window.ddcsRefreshWizardBar();
  });
  await page.evaluate(() => window.openWizardBarManager());   // reopen to re-render the manager, pick up the new op
  await expect(mgr.locator('[data-entry="user_my_op"]')).toContainText('CUSTOM');
  let groups = await readBar(page);
  const custom = groups.find((g) => g.label === 'Custom');
  expect(custom, 'Custom group appears in the bar').toBeTruthy();
  expect(custom.items.some((i) => i.onclick.includes("ddcsInsertUserOp('user_my_op')"))).toBe(true);

  // 3. RENAME wcs → the bar label updates
  const wcsName = mgr.locator('[data-entry="wcs"] input[type="text"]');
  await wcsName.fill('Set Work Zero');
  await wcsName.blur();
  expect((await libState(page)).wcsLabel).toBe('Set Work Zero');
  const probe = (await readBar(page)).find((g) => g.label === 'Probe');
  expect(probe.items.some((i) => /Set Work Zero/.test(i.text))).toBe(true);

  // 4. REORDER: move the first Mill item (drill) down → drill/bore swap in the bar
  await mgr.locator('[data-entry="drill"] button', { hasText: '▼' }).click();
  mill = (await libState(page)).mill;
  expect(mill.indexOf('bore')).toBeLessThan(mill.indexOf('drill'));

  // 5. REGROUP: move 'text' from Mill into Setup
  await mgr.locator('[data-entry="text"] select').selectOption('setup');
  let st = await libState(page);
  expect(st.setup).toContain('text');
  expect(st.mill).not.toContain('text');

  // 6. RESET → factory: layout reverts (pocket back, wcs renamed back, text back in mill) but the forked op is KEPT
  await mgr.locator('button', { hasText: 'Reset to factory' }).click();
  st = await libState(page);
  expect(st.mill).toContain('pocket');
  expect(st.mill).toContain('text');
  expect(st.wcsLabel).toBe('WCS / work offsets');
  await expect(mgr.locator('[data-entry="user_my_op"]')).toBeVisible();   // user op survives reset

  // cleanup
  await page.evaluate(() => { localStorage.removeItem('ddcs_user_ops'); localStorage.removeItem('ddcs_wizard_layout'); window.ddcsRefreshWizardBar(); });
});

test('Wizard library manager: the section tree — create dropdown, move a wizard in, delete', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.openSettings && window.ddcsRefreshWizardBar);
  await autoAppDialog(page, { accept: true });
  await page.evaluate(() => { localStorage.removeItem('ddcs_user_ops'); localStorage.removeItem('ddcs_wizard_layout'); window.ddcsRefreshWizardBar(); });
  await page.evaluate(() => window.openWizardBarManager());
  const mgr = page.locator('#wizbarTree');

  // the three section blocks render
  await expect(mgr).toContainText('LEFT SECTION');
  await expect(mgr).toContainText('CENTRE SECTION');
  await expect(mgr).toContainText('RIGHT SECTION');

  // create a dropdown in the RIGHT section via the UI
  const ndRow = mgr.locator('.settings-row').first();
  await ndRow.locator('input').fill('My Probes');
  await ndRow.locator('select').selectOption('right');
  await ndRow.locator('button', { hasText: 'Add dropdown' }).click();
  await expect(mgr.locator('[data-group="my_probes"]')).toBeVisible();

  // move 'edge' into it via its dropdown selector → lands in the new dropdown + the bar's RIGHT section
  await mgr.locator('[data-entry="edge"] select').selectOption('my_probes');
  const moved = await page.evaluate(async () => {
    const WL = await import('/blocks/wizardLibrary.js');
    const g = WL.getLibrary().groups.find((x) => x.id === 'my_probes');
    const inBarRight = Array.from(document.querySelectorAll('.dock-header .header-right .toolbar-dropdown'))
      .some((dd) => (dd.querySelector('.btn-tx')?.textContent || '').trim() === 'My Probes');
    return { section: g && g.section, hasEdge: !!(g && g.items.find((i) => i.id === 'edge')), inBarRight };
  });
  expect(moved.section).toBe('right');
  expect(moved.hasEdge).toBe(true);
  expect(moved.inBarRight, 'the new dropdown renders in the bar right section').toBe(true);

  // delete the dropdown via its 🗑 button → edge reverts to its default dropdown (Probe)
  await mgr.locator('[data-group="my_probes"] button', { hasText: 'Delete' }).click();
  const afterDelete = await page.evaluate(async () => {
    const WL = await import('/blocks/wizardLibrary.js');
    const lib = WL.getLibrary();
    return { gone: !lib.groups.some((g) => g.id === 'my_probes'), edgeInProbe: (lib.groups.find((g) => g.id === 'probe') || {}).items.some((i) => i.id === 'edge') };
  });
  expect(afterDelete.gone).toBe(true);
  expect(afterDelete.edgeInProbe, 'its wizard reverts to its default dropdown').toBe(true);

  await page.evaluate(() => { localStorage.removeItem('ddcs_user_ops'); localStorage.removeItem('ddcs_wizard_layout'); window.ddcsRefreshWizardBar(); });
});
