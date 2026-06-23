import { test, expect } from '@playwright/test';

// I/O simulation UX: Run a macro that waits on a sensor (M31), watch the floating
// I/O panel auto-show + pulse the waited pin, and the run complete via auto-answer.
// Mirrors the ATC handshake users asked for: fire output → wait for sensor → proceed.
//
// The Studio 3D-preview controls were refactored into the shared createPreviewPanel
// (viz/createPreviewPanel.js), mounted in the drawer host #viz3d-panel-host. The old
// #viz3d* ids are gone — the controls are CLASS-based (.pp-run/.pp-step/.pp-loop/
// .pp-status) and the run button is icon-only (no ▶/⏸ text); its running state lives
// in the `.on` class (updateRunBtn toggles it on running && !paused). All panel
// selectors are scoped to the Studio host so they don't match the Blocks/wizard panels.

const ATC_SNIPPET = 'M10 P4 ( fire unclamp )\nN10 M31 P12 ( wait sensor )\nG0 Z50\nM30';

// Port 3210: the default :3000 can be shadowed by an IDE preview server serving the
// repo root; run `npx http-server ./web -p 3210` (or rely on CI's webServer) instead.
const BASE = process.env.STUDIO_URL || 'http://localhost:3211';

const HOST = '#viz3d-panel-host';
const RUN = `${HOST} .pp-run`;
const STEP = `${HOST} .pp-step`;
const LOOP = `${HOST} .pp-loop`;
const STATUS = `${HOST} .pp-status`;

async function openEditorWith(page, code) {
  await page.goto(BASE);
  // Wait for the app modules to finish wiring (button listeners, ioPanel, settings)
  await page.waitForFunction(() => !!window.ioPanel && typeof window.ddcsGetSettings === 'function' && typeof window.setGcodeView === 'function');
  await page.locator('#editor').fill(code);
  // The drawer auto-plays a looping run on open by default — disable it so Run/Step/Loop
  // are driven deterministically by the test (autoLoop is read live by the panel).
  await page.evaluate(() => { window.ddcsGetSettings().preview.autoLoop = false; });
}

async function openDrawer(page) {
  await page.evaluate(() => window.setGcodeView('3d'));   // mount + activate the shared preview panel
  await page.waitForSelector(RUN, { state: 'attached', timeout: 8000 });
}

test('Run: parks on M31 wait, I/O panel auto-shows + pulses pin, auto-answer completes', async ({ page }) => {
  await openEditorWith(page, ATC_SNIPPET);
  await openDrawer(page);
  await page.locator(RUN).click();                      // ▶ Run

  // Parked on the wait → floating panel appears with the waited pin pulsing
  await expect(page.locator('#io-panel')).toBeVisible();
  await expect(page.locator('#io_panel_wait')).toContainText('IN12');
  await expect(page.locator('#io-panel .io-input[data-pin="12"]')).toHaveClass(/wait/);
  // Output OUT4 lit by M10 P4
  await expect(page.locator('#io-panel .io-output[data-pin="4"]')).toHaveClass(/active/);

  // Auto sensors (default ON) answers after ~0.8s → run completes
  await expect(page.locator(STATUS)).toContainText('Execution complete', { timeout: 5000 });
  // Icon-only run button — done means it's no longer in the running (.on) state
  await expect(page.locator(RUN)).not.toHaveClass(/\bon\b/);
});

test('Manual: auto sensors off, clicking the pulsing input unblocks the wait', async ({ page }) => {
  await openEditorWith(page, ATC_SNIPPET);
  await openDrawer(page);
  await page.evaluate(() => window.ioPanel.show());     // open the panel to reach the checkbox
  await page.locator('#io_panel_auto').uncheck();
  await page.locator(RUN).click();

  await expect(page.locator('#io-panel .io-input[data-pin="12"]')).toHaveClass(/wait/);
  // Still waiting after well past the auto-answer delay
  await page.waitForTimeout(1500);
  await expect(page.locator(STATUS)).toContainText('waiting');

  await page.locator('#io-panel .io-input[data-pin="12"]').click();   // satisfy the sensor
  await expect(page.locator(STATUS)).toContainText('Execution complete', { timeout: 5000 });
});

test('Probe: G31 contact pulses the probe input pin', async ({ page }) => {
  // Default stock 100x80x20 with top at Z0 — descend onto it from above
  await openEditorWith(page, 'G0 X50 Y40 Z10\nG31 Z-30 F600\nG0 Z10 (Retract)\nM30');
  // Record io_change events — the 400 ms pulse is too short to class-poll reliably
  await page.evaluate(() => {
    window.__io = [];
    window.addEventListener('io_change', (e) => window.__io.push(e.detail));
  });
  await openDrawer(page);
  await page.evaluate(() => window.ioPanel.show());     // open the panel to watch the pins
  await page.locator(RUN).click();

  await expect(page.locator(STATUS)).toContainText('Execution complete', { timeout: 10000 });
  await page.waitForTimeout(600);                       // let the release half of the pulse land
  const pulses = await page.evaluate(() => window.__io);
  // IN3 = default 3D-probe pin → resolved name IN_3; pulsed ON at contact, then released
  expect(pulses.some((p) => p.pin === 'IN_3' && p.state === true)).toBe(true);
  expect(pulses.some((p) => p.pin === 'IN_3' && p.state === false)).toBe(true);
});

test('Loop: program restarts automatically after completion', async ({ page }) => {
  // Long enough (≈2 s at F1500) that the running state is observable each pass
  await openEditorWith(page, 'G1 X50 F1500\nM30');
  await openDrawer(page);
  await page.locator(LOOP).click();                     // arm the loop
  await expect(page.locator(LOOP)).toHaveClass(/\bon\b/);
  await page.locator(RUN).click();

  await expect(page.locator(RUN)).toHaveClass(/\bon\b/, { timeout: 5000 });   // running
  await expect(page.locator(STATUS)).toContainText('Execution complete', { timeout: 10000 });
  // ~0.8 s later the loop restarts the program → running again
  await expect(page.locator(RUN)).toHaveClass(/\bon\b/, { timeout: 5000 });   // restarted

  await page.locator(RUN).click();                      // stop also cancels the loop rerun
  await expect(page.locator(RUN)).not.toHaveClass(/\bon\b/);
  await page.waitForTimeout(1500);
  await expect(page.locator(RUN)).not.toHaveClass(/\bon\b/);                   // stayed stopped
});

test('Step: executes one line per click and pauses in between', async ({ page }) => {
  await openEditorWith(page, ATC_SNIPPET);
  await openDrawer(page);

  await page.locator(STEP).click();                     // line 1: M10 P4
  // Stepping pauses the run, so the button is NOT in the running (.on) state
  await expect(page.locator(RUN)).not.toHaveClass(/\bon\b/);
  const s1 = await page.locator(STATUS).textContent();
  await page.waitForTimeout(400);
  const s2 = await page.locator(STATUS).textContent();
  expect(s2).toBe(s1);                                  // paused — nothing advanced on its own

  await page.locator(STEP).click();                     // line 2: parks on the M31 wait
  await expect(page.locator('#io-panel')).toBeVisible();
  await expect(page.locator('#io_panel_wait')).toContainText('IN12');

  await page.locator(RUN).click();                      // ▶ Resume → auto-answer finishes it
  await expect(page.locator(STATUS)).toContainText('Execution complete', { timeout: 5000 });
});
