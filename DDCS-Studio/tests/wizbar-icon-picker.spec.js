import { test, expect } from '@playwright/test';

/**
 * Track A — the wizbar icon PICKER (Settings → Wizards). ANY wizard (built-in or custom) can be re-iconed with an
 * emoji OR a built-in line-art glyph referenced as `ic:<id>`; the pick writes `iconOverride` (`setEntryOverride
 * id,{icon}`) and the bar resolves it via wizIcons.entryIconHtml — an override WINS over a built-in's default SVG.
 * "⌀ Default" clears it (back to ✦). Tests: (1) the emoji path for a custom op + Default clears; (2) re-icon a
 * BUILT-IN — the override beats its line-art SVG, built-in rows expose the icon button, the picker offers line-art.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('wizbar icon picker: pick an emoji for a custom wizard → iconOverride; Default clears it', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  await page.evaluate(async () => {
    localStorage.removeItem('ddcs_user_ops'); localStorage.removeItem('ddcs_wizard_layout');
    const L = await import('/blocks/wizardLibrary.js');
    const U = await import('/blocks/userOps.js');
    const { renderWizardLibrary } = await import('/ui/wizardManagerPanel.js');
    L.createWizard(U.userOpFromStack('icon_test', 'Icon Test', [{ type: 'move', params: { x: 0, y: 0, z: -5 } }], []));
    const div = document.createElement('div'); div.id = 'testpanel'; document.body.appendChild(div);
    renderWizardLibrary(div);
  });

  // the custom row's icon button shows the default ✦
  const iconBtn = page.locator('#testpanel [data-entry="user_icon_test"] .wizicon-btn');
  await expect(iconBtn).toHaveText('✦');

  // open the picker → pick 🔧
  await iconBtn.click();
  await expect(page.locator('.wizicon-pop')).toBeVisible();
  await page.locator('.wizicon-pop button', { hasText: '🔧' }).first().click();
  await expect(page.locator('.wizicon-pop')).toHaveCount(0);

  // override written + getLibrary reflects it + the row re-rendered with the new icon
  const after = await page.evaluate(async () => {
    const L = await import('/blocks/wizardLibrary.js');
    const e = L.getLibrary({ includeHidden: true }).groups.flatMap((g) => g.items).find((i) => i.id === 'user_icon_test');
    return { iconOverride: e.iconOverride, icon: e.icon };
  });
  expect(after.iconOverride).toBe('🔧');
  expect(after.icon).toBe('🔧');
  await expect(page.locator('#testpanel [data-entry="user_icon_test"] .wizicon-btn')).toHaveText('🔧');

  // "⌀ Default" clears the override → back to ✦
  await page.locator('#testpanel [data-entry="user_icon_test"] .wizicon-btn').click();
  await page.locator('.wizicon-pop button', { hasText: 'Default' }).click();
  const cleared = await page.evaluate(async () => {
    const L = await import('/blocks/wizardLibrary.js');
    const e = L.getLibrary({ includeHidden: true }).groups.flatMap((g) => g.items).find((i) => i.id === 'user_icon_test');
    return { iconOverride: e.iconOverride, icon: e.icon };
  });
  expect(cleared.iconOverride).toBe(null);
  expect(cleared.icon).toBe('✦');
  await expect(page.locator('#testpanel [data-entry="user_icon_test"] .wizicon-btn')).toHaveText('✦');

  await page.evaluate(() => { localStorage.removeItem('ddcs_user_ops'); localStorage.removeItem('ddcs_wizard_layout'); });
});

test('re-icon a BUILT-IN: override beats its line-art SVG; built-in rows get the button; the picker offers line-art', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  // entryIconHtml is exactly what the bar renders — assert the precedence flip directly (the real symptom).
  const prec = await page.evaluate(async () => {
    const I = await import('/ui/wizIcons.js');
    return {
      defaultIsSvg:        I.entryIconHtml({ id: 'drill', iconOverride: null, icon: '' }).includes('<svg'),
      emojiOverrideWins:   I.entryIconHtml({ id: 'drill', iconOverride: '🔧', icon: '' }).trim(),
      linearOverrideIsSvg: I.entryIconHtml({ id: 'drill', iconOverride: 'ic:bore', icon: '' }).includes('<svg'),
    };
  });
  expect(prec.defaultIsSvg).toBe(true);            // un-re-iconed drill shows its built-in line-art
  expect(prec.emojiOverrideWins).toBe('🔧');       // an emoji override WINS over the default SVG
  expect(prec.linearOverrideIsSvg).toBe(true);     // an ic:<id> override renders a (different) line-art SVG

  await page.evaluate(async () => {
    localStorage.removeItem('ddcs_wizard_layout');
    const { renderWizardLibrary } = await import('/ui/wizardManagerPanel.js');
    const div = document.createElement('div'); div.id = 'bipanel'; document.body.appendChild(div);
    renderWizardLibrary(div);
  });

  // the gate is dropped — a BUILT-IN row (drill) now has the icon button, showing its line-art SVG by default
  const drillBtn = page.locator('#bipanel [data-entry="drill"] .wizicon-btn');
  await expect(drillBtn).toHaveCount(1);
  await expect(drillBtn.locator('svg')).toHaveCount(1);

  // open the picker → it now offers SVG line-art cells; pick one (ic:slot)
  await drillBtn.click();
  await expect(page.locator('.wizicon-pop')).toBeVisible();
  expect(await page.locator('.wizicon-pop button svg').count()).toBeGreaterThan(0);
  await page.locator('.wizicon-pop button[title="slot (line-art)"]').click();
  await expect(page.locator('.wizicon-pop')).toHaveCount(0);

  // the ic:<id> override is written to the BUILT-IN entry
  const after = await page.evaluate(async () => {
    const L = await import('/blocks/wizardLibrary.js');
    const e = L.getLibrary({ includeHidden: true }).groups.flatMap((g) => g.items).find((i) => i.id === 'drill');
    return e.iconOverride;
  });
  expect(after).toBe('ic:slot');

  await page.evaluate(() => { localStorage.removeItem('ddcs_wizard_layout'); });
});
