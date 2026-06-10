import { test, expect } from '@playwright/test';

test('Middle visualiser shows correct SVG group for feature/axis/direction', async ({ page }) => {
  await page.goto('http://localhost:3000');

  // Open Middle wizard via toolbar button
  await page.click('button:has-text("Middle")');
  await expect(page.locator('#wiz_middle')).toBeVisible();

  // Wait for SVG to be injected
  await page.waitForSelector('#middleVizContainer svg');

  const axisDirIds = [
    'middle_probe_pocket_X_pos','middle_probe_pocket_X_neg','middle_probe_pocket_Y_pos','middle_probe_pocket_Y_neg',
    'middle_probe_boss_X_pos','middle_probe_boss_X_neg','middle_probe_boss_Y_pos','middle_probe_boss_Y_neg'
  ];

  const combos = [
    { type: 'pocket', axis: 'X', dir: 'pos' },
    { type: 'pocket', axis: 'X', dir: 'neg' },
    { type: 'pocket', axis: 'Y', dir: 'pos' },
    { type: 'pocket', axis: 'Y', dir: 'neg' },
    { type: 'boss',   axis: 'X', dir: 'pos' },
    { type: 'boss',   axis: 'X', dir: 'neg' },
    { type: 'boss',   axis: 'Y', dir: 'pos' },
    { type: 'boss',   axis: 'Y', dir: 'neg' }
  ];

  for (const c of combos) {
    // Set controls — listeners call drawMiddleViz when wizard is visible
    await page.selectOption('#m_type', c.type);
    await page.selectOption('#m_axis', c.axis);
    await page.selectOption('#m_dir', c.dir);

    const selectedId = `#middleVizContainer #middle_probe_${c.type}_${c.axis}_${c.dir}`;

    // Selected group should be visible
    await expect(page.locator(selectedId)).toBeVisible();

    // Top-level feature group (pocket|boss) must be visible and the other hidden
    const parentId = `#middleVizContainer #middle_probe_${c.type}`;
    const otherParentId = `#middleVizContainer #middle_probe_${c.type === 'pocket' ? 'boss' : 'pocket'}`;
    await expect(page.locator(parentId)).toBeVisible();
    await expect(page.locator(otherParentId)).not.toBeVisible();

    // All other axis-direction groups must NOT be visible
    for (const id of axisDirIds) {
      const locator = page.locator(`#middleVizContainer #${id}`);
      if (id === `middle_probe_${c.type}_${c.axis}_${c.dir}`) {
        await expect(locator).toBeVisible();
      } else {
        await expect(locator).not.toBeVisible();
      }
    }
  }
});


test('Middle wizard uses secondary direction in generated G-code when Find Both is enabled', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.click('button:has-text("Middle")');
  await expect(page.locator('#wiz_middle')).toBeVisible();

  // Configure: X axis, first dir = pos, enable Find Both and set secondary dir = pos
  await page.selectOption('#m_type', 'pocket');
  await page.selectOption('#m_axis', 'X');
  await page.selectOption('#m_dir', 'pos');
  await page.check('#m_both');

  // secondary direction control should be visible and selectable
  await expect(page.locator('#m_dir2_block')).toBeVisible();
  await page.selectOption('#m_dir2', 'pos');

  // generated preview must reflect the explicit secondary direction (X pos)
  await expect(page.locator('#wiz_middle_code')).toContainText('then X pos');

  // when Find Both (2-axis) is enabled the code should include the 2axis comment,
  // a reposition pause and WCS writes for both axes
  await expect(page.locator('#wiz_middle_code')).toContainText('2axis_XtoY_pos');
  await expect(page.locator('#wiz_middle_code')).toContainText('#1505=1');
  await expect(page.locator('#wiz_middle_code')).toContainText('#[#70+1]=#56');
});


test('Find Both shows the correct 2-axis child subgroup and hides all others', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.click('button:has-text("Middle")');
  await expect(page.locator('#wiz_middle')).toBeVisible();

  // Set to pocket, X axis, direction pos, enable Find Both and set dir2 = pos
  await page.selectOption('#m_type', 'pocket');
  await page.selectOption('#m_axis', 'X');
  await page.selectOption('#m_dir', 'pos');
  await page.check('#m_both');
  await page.selectOption('#m_dir2', 'pos');

  // The 2axis child for the opposite axis (Y_pos -> X_pos) should be visible
  await expect(page.locator('#middleVizContainer #middle_probe_pocket_Y_pos_2axis_YtoX_pos')).toBeVisible();

  // The opposite-axis parent (Y_pos) must be visible so its 2axis child is actually shown
  await expect(page.locator('#middleVizContainer #middle_probe_pocket_Y_pos')).toBeVisible();

  // Primary axis: only the selected side must be visible (do NOT show the opposite side of same axis)
  await expect(page.locator('#middleVizContainer #middle_probe_pocket_X_pos')).toBeVisible();
  await expect(page.locator('#middleVizContainer #middle_probe_pocket_X_neg')).not.toBeVisible();

  // Ensure unrelated 2axis siblings and unrelated axis-direction groups remain hidden
  await expect(page.locator('#middleVizContainer #middle_probe_pocket_X_pos_2axis_XtoY_neg')).not.toBeVisible();
  await expect(page.locator('#middleVizContainer #middle_probe_pocket_X_pos_2axis_XtoY_pos')).not.toBeVisible();
  await expect(page.locator('#middleVizContainer #middle_probe_pocket_Y_neg')).not.toBeVisible();
});