import { test, expect } from '@playwright/test';

/**
 * STAGE 5 — the Settings "Wizard library manager" tab. Drives the real overlay: open Settings → General → Wizards,
 * then exercise every control (hide, rename, regroup, reorder, fork, reset) and assert each edit flows LIVE to the
 * wizard bar. A second test is the adversarial gate for FORK: every built-in must fork to a valid, non-empty,
 * params-complete user op via _builderAtoms({}) — no builder may crash or empty on default params.
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
  page.on('dialog', (d) => d.accept());            // confirm() → proceed; alert() → dismiss
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openSettings && window.ddcsRefreshWizardBar);
  await page.evaluate(() => { localStorage.removeItem('ddcs_user_ops'); localStorage.removeItem('ddcs_wizard_layout'); window.ddcsRefreshWizardBar(); });

  // open Settings → General → Wizards
  await page.evaluate(() => window.openSettings());
  await page.click('.settings-main-tab[data-group="general"]');
  await page.click('[data-target="set_tab_wizards"]');
  await expect(page.locator('#set_tab_wizards')).toBeVisible();

  const mgr = page.locator('#wizard_library_manager');
  // catalog rendered incl. hidden-capable entries; a built-in row carries the badge + Fork
  await expect(mgr.locator('[data-entry="pocket"]')).toContainText('BUILT-IN');
  await expect(mgr.locator('[data-entry="pocket"] button', { hasText: 'Fork' })).toBeVisible();

  // 1. HIDE pocket → drops out of the bar (the real checkbox is visually hidden by .ddcs-switch; click the slider)
  await expect(mgr.locator('[data-entry="pocket"] input[type="checkbox"]')).toBeChecked();
  await mgr.locator('[data-entry="pocket"] .ddcs-slider').click();
  let mill = (await readBar(page)).find((g) => g.label === 'Mill');
  expect(mill.items.some((i) => i.onclick.includes("openWiz('pocket')"))).toBe(false);
  expect((await libState(page)).mill).not.toContain('pocket');

  // 2. FORK edge → a CUSTOM op in the manager + the bar's Custom group
  await mgr.locator('[data-entry="edge"] button', { hasText: 'Fork' }).click();
  await expect(mgr.locator('[data-entry="user_edge_copy"]')).toContainText('CUSTOM');
  let groups = await readBar(page);
  const custom = groups.find((g) => g.label === 'Custom');
  expect(custom, 'Custom group appears in the bar').toBeTruthy();
  expect(custom.items.some((i) => i.onclick.includes("ddcsInsertUserOp('user_edge_copy')"))).toBe(true);

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
  await expect(mgr.locator('[data-entry="user_edge_copy"]')).toBeVisible();   // user op survives reset

  // cleanup
  await page.evaluate(() => { localStorage.removeItem('ddcs_user_ops'); localStorage.removeItem('ddcs_wizard_layout'); window.ddcsRefreshWizardBar(); });
});

test('fork: every built-in produces a valid, non-empty, params-complete user op', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const results = await page.evaluate(async () => {
    const OB = await import('/blocks/opBuilders.js');
    const U = await import('/blocks/userOps.js');
    const WL = await import('/blocks/wizardLibrary.js');
    localStorage.removeItem('ddcs_user_ops'); localStorage.removeItem('ddcs_wizard_layout');
    const out = [];
    for (const g of WL.getLibrary({ includeHidden: true }).groups) {
      for (const e of g.items.filter((x) => x.kind === 'builtin')) {
        try {
          const params = e.variant ? { variant: e.variant } : {};
          const stack = OB._builderAtoms(e.type, params);
          const def = U.userOpFromStack(e.id + '_fk', e.label, stack, []);   // mirrors forkBuiltin (zero bindings)
          out.push({ id: e.id, type: e.type, len: (stack || []).length, errs: U.validateUserOp(def) });
        } catch (err) { out.push({ id: e.id, type: e.type, error: String((err && err.message) || err) }); }
      }
    }
    return out;
  });

  expect(results.length).toBeGreaterThan(15);
  for (const r of results) {
    expect(r.error, `fork ${r.id} threw: ${r.error}`).toBeFalsy();
    expect(r.len, `fork ${r.id} produced an empty stack`).toBeGreaterThan(0);
    expect(r.errs, `fork ${r.id} is invalid: ${JSON.stringify(r.errs)}`).toEqual([]);
  }
});
