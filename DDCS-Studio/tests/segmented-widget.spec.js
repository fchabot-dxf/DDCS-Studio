import { test, expect } from '@playwright/test';

/**
 * SEGMENTED-TOGGLE widget (t323) — a small enum (widget:'segmented') renders as a compact [ Auto | Manual ] control,
 * both segments visible + the selected one highlighted; one click writes the enum value via the SAME enum change path
 * (no emit change). Opt-in on travelApproach first (do NOT auto-convert every 2-value enum). Clicking Manual reprunes
 * the structural-toggle path (the emit gains the #1505 jog-and-wait manual arm); the other enums stay dropdowns.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('travelApproach renders [Auto|Manual]; click Manual reprunes; other enums stay dropdowns', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram);
  await page.evaluate(async () => { const U = await import('/blocks/userOps.js'); const CD = await import('/blocks/dataOps/cornerData.js'); localStorage.removeItem('ddcs_user_ops'); U.createUserOp(CD.cornerDataDef()); });
  await page.evaluate(() => window.openWiz('user_corner_data'));
  await page.waitForSelector('#wiz_user_form [data-param="travelApproach"]', { timeout: 8000 });

  // travelApproach is a SEGMENTED control: 2 segments, Auto selected by default
  const seg = page.locator('#wiz_user_form .seg-control[data-param="travelApproach"]');
  await expect(seg).toBeVisible();
  await expect(seg.locator('.seg-btn')).toHaveCount(2);
  const auto = seg.locator('.seg-btn[data-value="auto"]'), manual = seg.locator('.seg-btn[data-value="manual"]');
  await expect(auto).toHaveText('Auto'); await expect(manual).toHaveText('Manual');
  await expect(auto).toHaveClass(/seg-on/);
  await expect(manual).not.toHaveClass(/seg-on/);

  // OPT-IN: only travelApproach is segmented; the other enums stay DROPDOWNS (unchanged)
  await expect(page.locator('#wiz_user_form .seg-control')).toHaveCount(1);
  await expect(page.locator('#wiz_user_form select[data-param="wcs"]')).toBeVisible();
  await expect(page.locator('#wiz_user_form select[data-param="corner"]')).toBeVisible();
  await expect(page.locator('#wiz_user_form select[data-param="probeSeq"]')).toBeVisible();

  // click Manual → highlights + REPRUNES the emit (the structural-toggle path) → the manual #1505 jog arm appears
  const codeOf = () => page.locator('#wiz_user_code').textContent();
  const before = await codeOf();
  await manual.click();
  await page.waitForTimeout(300);
  await expect(manual).toHaveClass(/seg-on/);
  await expect(auto).not.toHaveClass(/seg-on/);
  const after = await codeOf();
  expect(after, 'clicking Manual repruned the emit (travelApproach=manual)').not.toBe(before);
  expect(/1505/.test(after || ''), 'the manual arm (a #1505 jog-and-wait prompt) now emits').toBe(true);

  // click back to Auto → reprunes away the manual arm (round-trips within the form)
  await auto.click();
  await page.waitForTimeout(300);
  await expect(auto).toHaveClass(/seg-on/);
  const back = await codeOf();
  expect(back, 'clicking Auto returns to the auto emit').toBe(before);

  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});
