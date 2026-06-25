import { test, expect } from '@playwright/test';

/**
 * Track A — the wizbar icon PICKER (docs/archive/RICH-WIDGETS-AND-ICONS.md). A custom wizard's bar icon is chosen from a
 * curated emoji set in Settings → Wizards; the pick writes `iconOverride` (`setEntryOverride id,{icon}`) and a custom
 * op renders it via the existing emoji path (no commandDeck change). "⌀ Default" clears it (back to ✦). Locks: the
 * picker opens, a pick sets the override (+ updates the row + getLibrary), and Default clears it.
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
