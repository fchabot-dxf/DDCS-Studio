import { test, expect } from '@playwright/test';

/**
 * t1670 — USER-REPORTED: the Corner (data) twin's preview drew BOTH a diagonal AND a dogleg for the wall1→wall2
 * AUTO traverse when Dogleg was selected (only Dogleg's real 2-leg route should show). Root-caused to
 * `withInterPassConnectors` (viz/createPreviewPanel.js): it synthesizes a "bridge" segment for every pass to close
 * a real gap that exists for SELF-anchored passes (manual jogs, non-corner ops) — but corner's AUTO reposition
 * passes declare `anchorsAtPrev` (cornerData.js's cornerSimStartsProvider), which makes `passAnchorFor` resolve
 * the pass's own local frame to `passEnds[p-1]` — the SAME point the bridge starts from. So the bridge's local
 * start always reduces to {0,0,0}, which is EXACTLY where the pass's REAL traced segments already begin (the
 * engine resets pos to {0,0,0} on every `REPOSITION:` boundary) — the bridge was never filling a gap for this
 * case, only redundantly re-drawing the start of a route that was already fully traced.
 *
 * Confirmed empirically (not just by reading the code) that BOTH travelShape strategies carried the duplicate:
 * dogleg showed it VISIBLY (an extra diagonal cutting across the real L-shaped route — the reported symptom);
 * diagonal showed it INVISIBLY (the bridge and the real single diagonal move share identical endpoints, so two
 * exactly-overlapping segments rendered as what looked like one correct line) — i.e. diagonal was ALSO wrong,
 * just not visibly so. The fix (skip the bridge when `starts[p].anchorsAtPrev`) is corner-exclusive today —
 * `anchorsAtPrev` is set nowhere else in the codebase — so every other op's connector behavior is unchanged.
 */
test('corner AUTO reposition: no synthesized connector duplicates the real traverse, in EITHER travelShape', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram);
  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js'); const CD = await import('/blocks/dataOps/cornerData.js');
    localStorage.removeItem('ddcs_user_ops'); U.createUserOp(CD.cornerDataDef());
  });
  await page.evaluate(() => window.openWiz('user_corner_data'));
  await page.waitForSelector('#wiz_user_form .seg-control[data-param="travelShape"]', { timeout: 8000 });
  await page.waitForTimeout(900);

  const readPass1 = () => page.evaluate(() => {
    const box = document.getElementById('userViz3dContainer');
    const host = box && box.parentElement && box.parentElement.querySelector('.wiz-viz3d');
    const panel = host && host.__panel;
    const segs = panel.getSegments();
    return segs.filter((s) => s.pass === 1).map((s) => ({ x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, connector: !!s.connector }));
  });

  // DOGLEG (default) — the real route is the two-leg L (X-only then Y-only); no connector segment.
  const dogleg = await readPass1();
  expect(dogleg.some((s) => s.connector), 'dogleg: zero synthesized bridge segments — the real 2-leg route already covers it').toBe(false);
  expect(dogleg.some((s) => Math.abs(s.x2 - s.x1) > 0.01 && Math.abs(s.y2 - s.y1) < 0.01), 'dogleg leg 1 (X-only) present').toBe(true);
  expect(dogleg.some((s) => Math.abs(s.y2 - s.y1) > 0.01 && Math.abs(s.x2 - s.x1) < 0.01), 'dogleg leg 2 (Y-only) present').toBe(true);
  expect(dogleg.filter((s) => Math.abs(s.x2 - s.x1) > 0.01 && Math.abs(s.y2 - s.y1) > 0.01).length, 'dogleg: no combined diagonal move at all (that would be the old duplicate)').toBe(0);

  // DIAGONAL — the real route is the single combined move; no connector segment either (was an INVISIBLE exact
  // duplicate before the fix: same start/end as the real move, so it looked fine but doubled the segment).
  await page.evaluate(() => document.querySelector('#wiz_user_form .seg-control[data-param="travelShape"] .seg-btn[data-value="diagonal"]').click());
  await page.waitForTimeout(900);
  const diagonal = await readPass1();
  expect(diagonal.some((s) => s.connector), 'diagonal: zero synthesized bridge segments').toBe(false);
  const combined = diagonal.filter((s) => Math.abs(s.x2 - s.x1) > 0.01 && Math.abs(s.y2 - s.y1) > 0.01);
  expect(combined.length, 'diagonal: EXACTLY one combined move — not two coincident copies').toBe(1);

  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});
