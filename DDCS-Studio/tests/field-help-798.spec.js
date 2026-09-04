import { test, expect } from '@playwright/test';

/**
 * t798 P5 — FIELD HELP. (1) the help title moves to the WHOLE ROW (label + input + widget answer to hover); (2) the
 * content sweep ports the built-in forms' ~162 title texts into the twins' declared help (a one-source FIELD_HELP map
 * for shared params + per-twin help for the op-specific ones); (3) a coverage GUARD: every visible field in every twin
 * has help (explicit `help` / FIELD_HELP) or is in the declared HELP_EXEMPT. Touch note: tooltips are hover-only info —
 * the long-press touch path is a separately-queued item, not this turn.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('P5.1 whole-row hover: the help title is on the ROW host (the input, not just the label, answers to hover)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
  await page.evaluate(() => window.openWiz('user_pocket_data'));
  await page.waitForFunction(() => document.querySelector('#wiz_user_form [data-param="wcs"]'), null, { timeout: 8000 });
  const r = await page.evaluate(() => {
    const inp = document.querySelector('#wiz_user_form [data-param="wcs"]');
    const row = inp.closest('[data-help]');
    return { helped: !!row, onRowNotJustLabel: !!(row && row.title && row.contains(inp)) };
  });
  expect(r.helped, 'the wcs field row carries a help title (from the one-source FIELD_HELP)').toBe(true);
  expect(r.onRowNotJustLabel, 'the title is on the row that CONTAINS the input (hovering the input shows it)').toBe(true);
});

test('P5.3 HELP COVERAGE: every visible field in every twin has help or a declared exception', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.openWiz, null, { timeout: 15000 });
  const ops = await page.evaluate(async () => {
    const { userBuilderTypes } = await import('/blocks/opBuilders.js');
    return userBuilderTypes().filter((t) => typeof t === 'string' && t.startsWith('user_'));
  });
  expect(ops.length, 'the registered twins are enumerable').toBeGreaterThanOrEqual(20);
  // t2625 — MEASURED via summary.json (not assumed): this loop timed out at the DEFAULT 60_000ms twice in a
  // row under the real full-suite's 4-worker contention (`"status":"timedOut"`, ~61-63s each), never as a
  // content ("help gaps") failure — same class of flake `form-kernel-720.spec.js`'s own (e) test named and
  // fixed at t2621 (an open/close loop over all ~32 registered twins, no scaling budget, so a transient
  // per-op stall under load runs the whole test out of its DEFAULT time rather than reaching its own
  // assertion). Same fix: scale the outer timeout with op count instead of raising a single magic number.
  test.setTimeout(Math.max(90_000, ops.length * 6000));
  const gaps = {};
  for (const op of ops) {
    try {
      await page.evaluate((t) => window.openWiz(t), op);
      await page.waitForFunction(() => document.querySelector('#wiz_user_form [data-param]'), null, { timeout: 8000 });
      const miss = await page.evaluate(async () => {
        const { HELP_EXEMPT } = await import('/ui/formWidgets.js');
        const form = document.getElementById('wiz_user_form'); const out = [];
        for (const el of form.querySelectorAll('[data-param]')) {
          const param = el.dataset.param;
          if (!el.closest('[data-help]') && !HELP_EXEMPT.has(param)) out.push(param);
        }
        return [...new Set(out)];
      });
      if (miss.length) gaps[op] = miss;
    } catch (e) { gaps[op] = ['<open failed: ' + (e.message || e) + '>']; }
    await page.evaluate(() => window.closeWiz && window.closeWiz());
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz, null, { timeout: 15000 });
  }
  expect(gaps, `help gaps across ${ops.length} twins: ${JSON.stringify(gaps)}`).toEqual({});
});
