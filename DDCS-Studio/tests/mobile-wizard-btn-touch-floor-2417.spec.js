import { test, expect } from '@playwright/test';

/**
 * t2417 (mobile wizard buttons, deferred from t2415, ruled to the touch floor 2026-08-29) — MEASURED before
 * touching CSS: the real rendered `.wizard-btn` was 32px tall at a 390px viewport, under the 44-48px floor.
 *
 * ⛔ t2419 — SCOPE CORRECTED. t2417 grew `.wizard-btn` — the TRIGGER PILL that OPENS a wizard group's dropdown
 * tray (e.g. "Setup ▼", "Probe ▼") — but the owner's actual ask was for the ROWS INSIDE the tray
 * (Drill/Bore/Pocket/Contour/…), the advisor's own dispatch having scoped the wrong element ("so you changed
 * the size of the trigger wizard in the bar but i didnt ask" / "i asked for the button in dropdown"). The
 * trigger-pill growth is REVERTED here (back to its pre-t2417 32px); the SAME floor treatment now applies to
 * `.toolbar-dropdown-content button` (the tray's own item rows) instead — also measured 31.6px pre-fix, so the
 * floor genuinely was needed there too, matching the trigger pill's own number almost exactly.
 *
 * VERTICAL AXIS ONLY, holding horizontal padding — for the tray rows this is less of a live constraint than it
 * was for the header's own priority-collapse trigger row (the tray has no such collapse ladder; it's a plain
 * vertical list capped by `max-height`/`overflow-y:auto`, styles.css:1645-1646), but the discipline carries
 * over anyway: no padding-left/right in the mobile rule.
 */

async function measureTriggers(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('.wizard-btn')).map((b) => {
    const r = b.getBoundingClientRect();
    const cs = getComputedStyle(b);
    return { width: r.width, height: r.height, paddingLeft: cs.paddingLeft, paddingRight: cs.paddingRight };
  }));
}

async function openTrayAndMeasureRows(page, triggerIndex = 0) {
  return page.evaluate((idx) => {
    const trigger = document.querySelectorAll('.toolbar-dropdown > .wizard-btn')[idx];
    trigger.click();
    const content = trigger.closest('.toolbar-dropdown').querySelector('.toolbar-dropdown-content');
    const rows = Array.from(content.querySelectorAll('button')).map((b) => {
      const r = b.getBoundingClientRect();
      const cs = getComputedStyle(b);
      return { text: b.textContent.trim(), height: r.height, paddingLeft: cs.paddingLeft, paddingRight: cs.paddingRight };
    });
    const container = { scrollHeight: content.scrollHeight, clientHeight: content.clientHeight };
    trigger.click();   // close it again
    return { rows, container };
  }, triggerIndex);
}

test('t2419 CORRECTION: the trigger pill is back to its pre-t2417 (smaller) size — the owner did not ask for it to grow', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  const btns = await measureTriggers(page);
  expect(btns.length, 'the header renders wizard group trigger buttons').toBeGreaterThan(0);
  // Pinned to the REVERTED value, not asserting a range — a future accidental re-growth of the wrong element
  // should fail this loudly rather than silently pass a "small enough" range check.
  for (const b of btns) expect(b.height, `${JSON.stringify(b)} matches the pre-t2417 baseline`).toBe(32);
});

test('at 390px, every TRAY ROW (not the trigger) reaches the 44px touch floor — the element actually asked for', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  const { rows } = await openTrayAndMeasureRows(page, 0);
  expect(rows.length, 'the tray opened and rendered its item rows').toBeGreaterThan(0);
  for (const r of rows) expect(r.height, `${JSON.stringify(r)} reaches the 44px floor`).toBeGreaterThanOrEqual(44);
});

test('desktop (>600px): both the trigger and the tray rows keep their original (smaller) sizes', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.waitForTimeout(300);
  const triggers = await measureTriggers(page);
  for (const b of triggers) expect(b.height, 'desktop trigger height unaffected').toBeLessThan(40);
  const { rows } = await openTrayAndMeasureRows(page, 0);
  for (const r of rows) expect(r.height, 'desktop tray row height unaffected').toBeLessThan(40);
});

test('tray rows: horizontal padding untouched by the mobile bump', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.waitForTimeout(300);
  const desktop = await openTrayAndMeasureRows(page, 0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const mobile = await openTrayAndMeasureRows(page, 0);
  expect(mobile.rows.length).toBe(desktop.rows.length);
  for (let i = 0; i < mobile.rows.length; i++) {
    expect(mobile.rows[i].paddingLeft, 'inline padding-left is byte-identical mobile vs desktop').toBe(desktop.rows[i].paddingLeft);
    expect(mobile.rows[i].paddingRight, 'inline padding-right is byte-identical mobile vs desktop').toBe(desktop.rows[i].paddingRight);
  }
});

test('taller tray rows do not introduce unwanted scrolling at normal group sizes (container still fits every group)', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  const groupCount = await page.evaluate(() => document.querySelectorAll('.toolbar-dropdown > .wizard-btn').length);
  for (let i = 0; i < groupCount; i++) {
    const { container } = await openTrayAndMeasureRows(page, i);
    expect(container.scrollHeight, `group ${i}: taller rows still fit without the container's own overflow kicking in`).toBeLessThanOrEqual(container.clientHeight);
  }
});
