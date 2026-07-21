// t990 — dual mm/inch + mm/min-IPM DISPLAY layer. mm is the AUTHORITATIVE, exact storage; inch/IPM is a derived view.
// mm-mode: a length field shows "= X in", a feed shows "= X IPM". inch-mode: a shadow input displays + edits inch/IPM
// and syncs the EXACT mm back (typed 0.5 in → 12.7 mm, no drift). The stored mm never re-derives from the rounded
// display → emit byte-identical.
import { test, expect } from '@playwright/test';

test('mm-mode hints (in / IPM); inch-mode shadow → exact mm (no drift)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.openWiz && window.ddcsGetSettings);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    const hintOf = (p) => { const inp = document.querySelector(`[data-param="${p}"]`); const host = inp && inp.parentElement; const h = host && host.querySelector('.num-unit-hint'); return h ? h.textContent : null; };

    // ── mm MODE (default) — the field holds mm, the hint shows in / IPM ──
    window.ddcsGetSettings().units = 'mm';
    window.openWiz('user_surfacing_data'); await sleep(400);
    const out = { depthHint: hintOf('depth'), feedHint: hintOf('feed') };
    const depthInp = document.querySelector('[data-param="depth"]');
    depthInp.value = '25.4'; depthInp.dispatchEvent(new Event('input', { bubbles: true })); await sleep(50);
    out.depthHint254 = hintOf('depth');   // 25.4 mm → = 1 in

    // ── inch MODE — a shadow inch input, the mm `inp` hidden + authoritative ──
    window.ddcsGetSettings().units = 'inch';
    window.openWiz('user_surfacing_data'); await sleep(400);
    const mmInp = document.querySelector('[data-param="depth"]');
    out.mmHidden = mmInp.style.display === 'none';
    const shadow = mmInp.nextElementSibling;
    out.shadowIsInput = !!shadow && shadow.tagName === 'INPUT' && shadow.style.display !== 'none';
    shadow.value = '0.5'; shadow.dispatchEvent(new Event('input', { bubbles: true })); await sleep(50);
    out.mmAfterInch = parseFloat(mmInp.value);   // 0.5 in → 12.7 mm EXACT
    out.inchHint = hintOf('depth');              // inch-mode hint shows "= X mm"
    return out;
  });
  expect(r.depthHint, 'a length field shows an inch hint').toMatch(/in\b/);
  expect(r.feedHint, 'a feed field shows an IPM hint').toMatch(/IPM/);
  expect(r.depthHint254, '25.4 mm → = 1 in').toMatch(/=\s*1\s*in/);
  expect(r.mmHidden, 'inch-mode hides the mm input (kept as the source)').toBe(true);
  expect(r.shadowIsInput, 'inch-mode shows a shadow inch input').toBe(true);
  expect(r.mmAfterInch, '0.5 in typed → 12.7 mm stored EXACT (no drift)').toBeCloseTo(12.7, 6);
  expect(r.inchHint, 'inch-mode hint shows the mm equivalent').toMatch(/mm/);
});

test('the follow-on ops (pocket derived-bindings, drill, slot) inherit the hints via the shared widget', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.openWiz && window.ddcsGetSettings);
  const hintFor = async (optype, param) => page.evaluate(async ({ optype, param }) => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    window.ddcsGetSettings().units = 'mm';
    window.openWiz(optype); await sleep(400);
    const inp = document.querySelector(`[data-param="${param}"]`);
    const host = inp && inp.parentElement;
    const h = host && host.querySelector('.num-unit-hint');
    return h ? h.textContent : null;
  }, { optype, param });
  expect(await hintFor('user_pocket_data', 'depth'), 'pocket (derived bindings) length field shows the inch hint').toMatch(/in\b/);
  expect(await hintFor('user_pocket_data', 'plunge'), 'pocket feed field shows the IPM hint').toMatch(/IPM/);
  expect(await hintFor('user_drill_data', 'depth'), 'drill length field shows the inch hint').toMatch(/in\b/);
  expect(await hintFor('user_slot_data', 'width'), 'slot width field shows the inch hint').toMatch(/in\b/);
});
