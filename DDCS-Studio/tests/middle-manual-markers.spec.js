import { test, expect } from '@playwright/test';

// t1201 (user) — MANUAL-mode jog landings are draggable POSITION markers on the Layout canvas, SIM-ONLY. The declared
// visual language: COLOUR = who drives the travel (amber = manual jog, teal = automatic/coded), SHAPE = type of travel
// (square = a travel-end position (trans-axial ②), circle = an in-axis distance (X↔/Y↔) or a jog position). A manual
// pass (source 'manual') gets an amber marker routed through the panel's userStarts seam — dragging it moves the SIM
// and NEVER the emit (a manual jog has no coded traverse).
test.use({ viewport: { width: 1400, height: 1100 } });

test('in-axis MANUAL: amber jog markers appear (sim-only drag, emit byte-identical); AUTO shows teal ↔ distance circles', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.ddcsGetSettings);
  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js'); const MD = await import('/blocks/dataOps/middleData.js');
    localStorage.removeItem('ddcs_user_ops'); U.createUserOp(MD.middleDataDef());
  });
  await page.evaluate(() => window.openWiz('user_middle_data'));
  await page.waitForFunction(() => document.querySelector('#wiz_user_form [data-param="twoAxis"]'), null, { timeout: 8000 });
  await page.evaluate(() => { const two = document.querySelector('#wiz_user_form [data-param="twoAxis"]'); if (two && !two.checked) { two.checked = true; two.dispatchEvent(new Event('change', { bubbles: true })); } });
  await page.waitForFunction(() => document.querySelector('#userVizContainer .fc-handle[data-hid="crossAimP"]'), null, { timeout: 8000 });

  // AUTO: the in-axis travel targets are TEAL DISTANCE CIRCLES (#39c0d8), the ② trans end a square, the Start amber
  const auto = await page.evaluate(() => {
    const hs = [...document.querySelectorAll('#userVizContainer .fc-handle')].map((h) => ({ tag: h.tagName.toLowerCase(), fill: h.style.fill, hid: h.getAttribute('data-hid') }));
    return hs;
  });
  const crossP = auto.find((h) => h.hid === 'crossAimP'), diag = auto.find((h) => h.hid === 'diagAim');
  expect(crossP, 'AUTO: the primary in-axis target handle exists').toBeTruthy();
  expect(crossP.tag, 'in-axis distance = a CIRCLE (shape = travel type)').toBe('circle');
  expect(crossP.fill, 'automatic = TEAL').toBe('rgb(57, 192, 216)');
  expect(auto.find((h) => h.hid === 'crossAimS'), 'AUTO+both: the secondary in-axis target too').toBeTruthy();
  expect(diag.tag, 'the trans-axial end ② = a SQUARE (a position)').toBe('rect');

  // switch In-Axis → MANUAL (the segmented button)
  await page.evaluate(() => { const b = [...document.querySelectorAll('#wiz_user_form button')].find((x) => /manual/i.test(x.textContent || '')); b && b.click(); });
  await page.waitForFunction(() => document.querySelector('#userVizContainer .fc-handle[data-hid="__simstart1"]'), null, { timeout: 8000 });

  const st = await page.evaluate(() => {
    const host = document.querySelector('.wiz-viz3d'); const panel = host && host.__panel;
    const hs = [...document.querySelectorAll('#userVizContainer .fc-handle')].map((h) => ({ tag: h.tagName.toLowerCase(), fill: h.style.fill, hid: h.getAttribute('data-hid') }));
    return { srcs: panel.getPassSources(), hs, code: document.getElementById('wiz_user_code')?.textContent || '' };
  });
  expect(st.srcs.filter((s) => s === 'manual').length, 'manual in-axis → manual wall-2 passes').toBeGreaterThanOrEqual(2);
  const m1 = st.hs.find((h) => h.hid === '__simstart1');
  expect(m1, 'a manual jog landing marker exists').toBeTruthy();
  expect(m1.tag, 'a jog landing is a CIRCLE').toBe('circle');
  expect(m1.fill, 'manual = AMBER').toBe('rgb(255, 179, 0)');
  expect(st.hs.find((h) => h.hid === 'crossAimP'), 'the coded in-axis distance handle is GONE in manual (no coded traverse)').toBeFalsy();

  // drag a manual marker: the SIM start moves, the EMIT stays byte-identical
  const target = await page.$('#userVizContainer .fc-handle[data-hid="__simstart1"]');
  const b = await target.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 45, b.y + b.height / 2 - 20, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(800);
  const after = await page.evaluate(() => ({ ps1: document.querySelector('.wiz-viz3d').__panel.getPassStarts()[1], code: document.getElementById('wiz_user_code')?.textContent || '' }));
  expect(after.code, 'the emit is BYTE-IDENTICAL after a manual-marker drag (sim-only)').toBe(st.code);
  expect(Math.abs(after.ps1.x - 130) < 30 || Math.abs(after.ps1.y - 40) < 30, 'the pass-1 sim start moved with the drag').toBe(true);
});
