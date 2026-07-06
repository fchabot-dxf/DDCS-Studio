import { test, expect } from '@playwright/test';

// TIE the trans-axial DIAGONAL to the dragged ② (the GUI-drives-the-macro culmination). The auto trans-axial is
// `X[#53-#52-rv] Y#21` — re-centre the primary, go OUT by #21 on the secondary toward ②. So #21 IS the centre→② out-distance.
// Dragging ② derives #21 (= |②_secondary − centre_secondary|) and writes the diagTravel field → the diagonal ENDS on ②, and
// #21 can no longer drift from ② (② is the master, the field follows). ONE handle drives BOTH userStarts[1] AND #21.
test.use({ viewport: { width: 1280, height: 900 } });

test('drag ② → #21/diagTravel follows + the trans-axial diagonal ends ON ②', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('middle'));
  await page.waitForSelector('#wiz_middle', { state: 'visible' });

  await page.evaluate(() => {
    const set = (id, v) => { const e = document.getElementById(id); if (!e) return; if (e.type === 'checkbox') e.checked = !!v; else e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); };
    set('m_type', 'boss'); set('m_both', true);
    set('m_inaxis', 'auto'); set('m_transaxis', 'auto'); set('m_dir', 'pos'); set('m_dir2', 'neg'); set('m_dist', '100');
    const stk = window.ddcsGetSettings().stock; stk.x = 100; stk.y = 80; stk.z = 20; stk.shape = 'boss'; stk.show = true;
    window.ddcsStudio.wizardManager.update();
  });
  await page.waitForFunction(() => document.querySelectorAll('#middleLayoutCanvas .fc-handle-move').length === 2);

  const before = await page.evaluate(() => {
    const svg = document.querySelector('#middleLayoutCanvas svg').getBoundingClientRect();
    const h = [...document.querySelectorAll('#middleLayoutCanvas .fc-handle-move')][1];   // ②
    return { cx: svg.left + (+h.getAttribute('x') + 6), cy: svg.top + (+h.getAttribute('y') + 6), diag: +document.getElementById('m_diag_travel').value };
  });

  // DRAG ② further OUT (screen UP = world +Y, since dir2=neg ② sits above the stock) → its out-distance grows → #21 grows
  await page.mouse.move(before.cx, before.cy);
  await page.mouse.down();
  await page.mouse.move(before.cx, before.cy - 60, { steps: 6 });
  await page.mouse.up();
  await page.waitForFunction((d0) => +document.getElementById('m_diag_travel').value !== d0, before.diag);

  const r = await page.evaluate(async () => {
    const { MiddleWizard } = await import('/wizards/middleWizard.js');
    const { traceToolpath } = await import('/engine/trace.js');
    const w = new MiddleWizard();
    const panel = window.ddcsStudio.wizardManager._activePanel;
    const starts = panel.getPassStarts();                        // ② = starts[1] (the dragged position)
    const stock = window.ddcsGetSettings().stock;
    const diag21 = +document.getElementById('m_diag_travel').value;
    const derived = Math.round(Math.abs(starts[1].y - stock.y / 2));   // the value the tie should have written
    // re-trace with the CURRENT macro (#21 already updated) + the dragged ② → where does the DIAGONAL END? (t383 made DOGLEG
    // the default trans route — two axis moves, no diagonal segment to measure — so pin the 'diagonal' route here; the ② tie
    // (#21 = |②.y − centre.y|) the form drag drives is route-agnostic, and BOTH routes end on ②, so this checks the invariant.)
    const params = { featureType: 'boss', twoAxis: true, axis: 'X', dir1: 'pos', dir2: 'neg', dist: 100, inAxis: 'auto', transAxis: 'auto', travelShape: 'diagonal', diagTravel: String(diag21) };
    const code = w.generate(params);
    const segs = traceToolpath(code, { stock, start: starts[0], passStarts: starts }).segments || [];
    const dseg = segs.filter((s) => (s.type === 'rapid' || s.rapid) && Math.abs(s.x2 - s.x1) > 1 && Math.abs(s.y2 - s.y1) > 1)[0];
    const diagEndWorldY = dseg ? dseg.y2 + starts[0].y : null;   // local + ① = world
    return { diag21, derived, twoY: Math.round(starts[1].y), diagEndWorldY: Math.round(diagEndWorldY) };
  });

  expect(r.diag21, 'diagTravel field followed ② (grew as ② moved out)').toBeGreaterThan(before.diag);
  expect(r.diag21, 'diagTravel = |②.y − centre.y| (② is the master, the number follows)').toBe(r.derived);
  expect(Math.abs(r.diagEndWorldY - r.twoY), 'the trans-axial diagonal ENDS on ②.y (not near it)').toBeLessThan(2);
});
