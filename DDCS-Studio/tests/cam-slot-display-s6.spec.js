import { test, expect } from '@playwright/test';

// CAM-UX declare-once S6 — settings becomes a PURE display. Fork B: the settings "🧩 Customize op" AUTHORING button is
// RETIRED (the op-menu "Customize as blocks" stays — it calls ddcsEditWizardDef directly). Fork F: a legacy (no slot.ops)
// slot shows NO ✎ Edit + a "why" hint, keeping Simulate / View output / Delete; a manifest slot shows ✎ Edit.
test.use({ viewport: { width: 1280, height: 900 } });

async function openCam(page) {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => typeof window.showApp === 'function');
  await page.evaluate(() => window.showApp('macros'));
  await page.waitForFunction(() => document.querySelector('#macros-app .settings-sidebar .settings-tab[data-target="macros_panel_cam"]'));
  await page.evaluate(() => document.querySelector('#macros-app .settings-sidebar .settings-tab[data-target="macros_panel_cam"]').click());
  await page.waitForFunction(() => typeof window.ddcsOpenCamAuthoring === 'function');
}

test('S6 Fork B: the settings Customize-op button is RETIRED; New / Export / Merge eng remain', async ({ page }) => {
  await openCam(page);
  expect(await page.evaluate(() => !document.getElementById('cam_customize_op')), 'the settings 🧩 Customize op button is removed').toBe(true);
  expect(await page.evaluate(() => ['cam_build_slot', 'cam_export_pack', 'cam_merge_eng'].every((id) => !!document.getElementById(id))), 'New CAM slot / Export / Merge eng remain').toBe(true);
});

test('S6 Fork F: a legacy no-ops slot shows NO Edit (+ a why hint) and keeps Simulate/View output/Delete; a manifest slot shows Edit', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.evaluate(() => {
    localStorage.setItem('ddcs_campack', JSON.stringify({ meta: { name: 't', baseSlot: 22 }, slots: [
      { slot: 22, name: 'Legacy', fields: [{ idx: 1100, var: '#1', label: 'D', def: 5 }], body: '#1=#2600   ;D =5\nG1 Z[0-#1]\nM30' },
      { slot: 23, name: 'Pocket', ops: [{ type: 'pocket', variant: 'x', values: {}, exposed: {}, baked: {}, opType: 'pocket' }] },
    ] }));
  });
  await page.evaluate(async () => { (await import('/ui/macrosApp.js')).initMacrosApp(); });
  await page.waitForSelector('#cam_slots .cam-slot', { state: 'attached' });   // rendered on init (the cam sub-tab need not be visible)
  const r = await page.evaluate(() => [...document.querySelectorAll('#cam_slots .cam-slot')].map((c) => ({
    hasEdit: !!c.querySelector('[data-act="editslot"]'),
    hasSim: !!c.querySelector('[data-act="sim"]'),
    hasExp: !!c.querySelector('[data-act="exp"]'),
    hasDel: !!c.querySelector('[data-act="dels"]'),
    hasHint: /hand-built/.test(c.textContent),
  })));
  expect(r.length, 'both slots rendered').toBe(2);
  // card 0 = legacy (no ops): NO Edit, but a why-hint + Simulate / View output / Delete
  expect(r[0].hasEdit, 'a legacy no-ops slot has NO wizard Edit').toBe(false);
  expect(r[0].hasHint, 'the legacy slot explains why (hand-built)').toBe(true);
  expect(r[0].hasSim && r[0].hasExp && r[0].hasDel, 'the legacy slot keeps Simulate / View output / Delete').toBe(true);
  // card 1 = manifest: has ✎ Edit
  expect(r[1].hasEdit, 'a manifest slot shows ✎ Edit').toBe(true);
});
