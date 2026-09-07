import { test, expect } from '@playwright/test';

/**
 * ATC DIALECT (P-C.0, t167) — split from atc-dialect.spec.js at the tier migration. Two tests moved to
 * tests/node/atc-dialect.test.mjs (pure — build the engine, trace a single M-code, read back ioState). This one
 * stayed: it registers a real `window.addEventListener('io_change', ...)` and expects `dispatchEvent` to actually
 * invoke it (checking each OUT_ output fires the event) — register.mjs's own event-bus stub is deliberately inert
 * (`dispatchEvent = () => true`, never calling listeners), so this genuinely needs a real browser.
 */
test.use({ viewport: { width: 1000, height: 800 } });

test('the engine HONORS the M350 pneumatics — M156-161 drive the OUTPUT pins + fire io_change (were no-op)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { GcodeExecutionEngine } = await import('/engine/GcodeExecutionEngine.js');
    const { ioState } = await import('/engine/virtualIO.js');
    const events = [];
    const onIo = (e) => events.push(e.detail);
    window.addEventListener('io_change', onIo);
    const eng = new GcodeExecutionEngine({ autoAnswer: true });
    // each single-M-code trace resets the IO; OUTPUTS are set synchronously + now fire io_change (open-loop, no sensor).
    const run = (code) => { events.length = 0; eng.trace(code + '\nM30'); return { out: Object.fromEntries(ioState.outputs), fired: events.some((x) => x && x.pin && x.pin.indexOf('OUT_') === 0) }; };
    const m160 = run('M160'), m161 = run('M161'), m156 = run('M156'), m157 = run('M157'), m159 = run('M159'), m19 = run('M19');
    window.removeEventListener('io_change', onIo);
    return { m160, m161, m156, m157, m159, m19 };
  });
  // M160/M161 drive the pusher output open/close
  expect(r.m160.out['OUT_PUSHER'], 'M160 → pusher OPEN').toBe(true);
  expect(r.m161.out['OUT_PUSHER'], 'M161 → pusher CLOSE').toBe(false);
  // M156/M157 drive the locating pin open/close
  expect(r.m156.out['OUT_LOCATING_PIN'], 'M156 → locating pin OPEN').toBe(true);
  expect(r.m157.out['OUT_LOCATING_PIN'], 'M157 → locating pin CLOSE').toBe(false);
  // M159 turns the vacuum OFF
  expect(r.m159.out['OUT_VACUUM'], 'M159 → vacuum OFF').toBe(false);
  // M19 is recognized (spindle-orient output) — was a no-op
  expect(r.m19.out['OUT_SPINDLE_ORIENT'], 'M19 → spindle-orient output (recognized, was no-op)').toBe(true);
  // and each open-loop output FIRES io_change (so P-C.2b can animate the device) — was a no-op
  expect(r.m160.fired, 'M160 fired an OUT_ io_change (observable, was no-op)').toBe(true);
  expect(r.m19.fired, 'M19 fired an OUT_ io_change').toBe(true);
});
