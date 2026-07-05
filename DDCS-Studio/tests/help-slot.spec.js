import { test, expect } from '@playwright/test';

// DECLARED HELP SLOT (1a): an optional `help` string on a def.bindings entry → renderOpForm renders it as a native
// title= on the field label. ONE declaration; the SAME renderer powers the ported wizard form AND the Blocks-tab form
// pane, so both surfaces show it for free. Assert the declared string IS the tooltip; fields without help are unchanged.

test('help slot: the declared binding help survives derivation and renders as the field-label title (Blocks-tab form pane path)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const { CORNER_BINDINGS } = await import('/blocks/dataOps/cornerData.js');   // value bindings — DERIVED from CORNER_BINDING_SPECS
    const { renderOpForm } = await import('/ui/formWidgets.js');
    const dist = CORNER_BINDINGS.find((b) => b.param === 'dist');
    const travelDist = CORNER_BINDINGS.find((b) => b.param === 'travelDist');   // seeded with NO help
    const host = document.createElement('div'); document.body.appendChild(host);
    renderOpForm(host, CORNER_BINDINGS);   // the EXACT call the Blocks-tab form pane makes (blocksApp.js:371)
    const spanFor = (label) => [...host.querySelectorAll('span')].find((s) => (s.textContent || '').includes(label));
    return {
      declaredHelp: dist && dist.help,
      distTitle: (spanFor('Max Probe Dist') || {}).title,
      travelDistHasHelp: !!(travelDist && travelDist.help),
      travelDistTitle: (spanFor('Reposition Travel') || {}).title,
    };
  });
  expect(r.declaredHelp, 'the derived binding carries the declared help (deriveBindings preserves it)').toContain('travels toward each wall');
  expect(r.distTitle, 'renderOpForm renders the declared help as the label title').toBe(r.declaredHelp);
  expect(r.travelDistHasHelp, 'a field seeded WITHOUT help has none').toBe(false);
  expect(r.travelDistTitle, 'and gets NO title (unchanged)').toBe('');
});

test('help slot: the SAME help shows on the real ported wizard form (Corner (data))', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('user_corner_data'));
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    const spanFor = (label) => [...document.querySelectorAll('span')].find((s) => (s.textContent || '').includes(label));
    return {
      distTitle: (spanFor('Max Probe Dist') || {}).title,
      safeZTitle: (spanFor('Safe Z') || {}).title,
      probeZTitle: (spanFor('Probe Z First') || {}).title,     // a STRUCTURAL binding (CORNER_STRUCT_BINDINGS, direct)
    };
  });
  expect(r.distTitle, 'the wizard form shows the declared field help too (same declaration, same renderer)').toContain('travels toward each wall');
  expect(r.safeZTitle, 'a value binding').toContain('clear of the stock');
  expect(r.probeZTitle, 'a structural binding carries help too').toContain('anchors the sideways probes');
});
