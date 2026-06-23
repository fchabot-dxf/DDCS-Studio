import { test, expect } from '@playwright/test';

// I/O simulation for the DDCS EXPERT "I/O-automation" dialect: the factory sensor-wait idiom
// `WHILE [#[1520+N] != L] DO1 / G04 P10 / END1` (slib O10300) and the generic output M-codes
// M(50+2k)/M(51+2k). Before this, only the M31/M10 PIN style worked; the #1520/#1551 WHILE dialect
// spun to the runaway cap because nothing wrote #[1520+N] into the engine's vars. This proves an
// Expert I/O macro now PARKS on the #1520 wait, surfaces it on the panel, and COMPLETES when the
// awaited input goes high (manual click / auto-sensor) — same UX as the M31 path.
//
// Pin convention: #[1520+N] uses a 0-based pin index N, so #[1520+4] ↔ panel INPUT 5 (1-based).
// Output M52 = M(50+2k), k=1 ⇒ output 2 (panel OUTPUT 2).

// Real DDCS Expert emit: outPin (pin 1 → M52) + waitInput(4, 1) → WHILE [#[1520+4]!=1] DO1 / G04 P10 / END1.
const EXPERT_SNIPPET = [
  'M52   ( output P1 on )',
  'WHILE [#[1520+4] != 1] DO1   ( wait input 4 = 1 )',
  'G04 P10',
  'END1',
  'G0 Z50',
  'M30',
].join('\n');

const BASE = process.env.STUDIO_URL || 'http://localhost:3211';

const HOST = '#viz3d-panel-host';
const RUN = `${HOST} .pp-run`;
const STATUS = `${HOST} .pp-status`;

async function openEditorWith(page, code) {
  await page.goto(BASE);
  await page.waitForFunction(() => !!window.ioPanel && typeof window.ddcsGetSettings === 'function' && typeof window.setGcodeView === 'function');
  await page.locator('#editor').fill(code);
  await page.evaluate(() => { window.ddcsGetSettings().preview.autoLoop = false; });
}

async function openDrawer(page) {
  await page.evaluate(() => window.setGcodeView('3d'));
  await page.waitForSelector(RUN, { state: 'attached', timeout: 8000 });
}

test('Expert WHILE wait: parks on #[1520+4] (panel IN5), output M52 lit, auto-sensor completes', async ({ page }) => {
  await openEditorWith(page, EXPERT_SNIPPET);
  await openDrawer(page);
  await page.locator(RUN).click();

  // Parked on the #1520 WHILE poll → floating panel appears, awaited INPUT 5 pulses
  await expect(page.locator('#io-panel')).toBeVisible();
  await expect(page.locator('#io_panel_wait')).toContainText('IN5');
  await expect(page.locator('#io-panel .io-input[data-pin="5"]')).toHaveClass(/wait/);
  // Output OUT2 lit by M52 (output index 1 → panel pin 2)
  await expect(page.locator('#io-panel .io-output[data-pin="2"]')).toHaveClass(/active/);

  // Auto sensors (default ON) drives input 5 high after ~0.8 s → the loop exits and the run completes
  await expect(page.locator(STATUS)).toContainText('Execution complete', { timeout: 5000 });
  await expect(page.locator(RUN)).not.toHaveClass(/\bon\b/);
});

test('Expert WHILE wait: auto sensors off, clicking panel INPUT 5 releases the loop', async ({ page }) => {
  await openEditorWith(page, EXPERT_SNIPPET);
  await openDrawer(page);
  await page.evaluate(() => window.ioPanel.show());
  await page.locator('#io_panel_auto').uncheck();
  await page.locator(RUN).click();

  await expect(page.locator('#io-panel .io-input[data-pin="5"]')).toHaveClass(/wait/);
  // Still spinning on the wait well past the auto-answer delay (not capped, not completed)
  await page.waitForTimeout(1500);
  await expect(page.locator(STATUS)).toContainText('waiting');

  await page.locator('#io-panel .io-input[data-pin="5"]').click();   // drive input 5 high by hand
  await expect(page.locator(STATUS)).toContainText('Execution complete', { timeout: 5000 });
  // The M52 output is still active on the panel after completion
  await expect(page.locator('#io-panel .io-output[data-pin="2"]')).toHaveClass(/active/);
});
