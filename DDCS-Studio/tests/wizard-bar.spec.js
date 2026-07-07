import { test, expect } from '@playwright/test';

/**
 * STAGE 4 — the data-driven wizard bar. commandDeck.renderHeader no longer hard-codes the dropdowns; it renders
 * from blocks/wizardLibrary.getLibrary(). This locks the behaviour-preserving contract at the DOM level: the
 * Setup group (+ the bar-special I/O quick-actions) on the left; Probe/ATC/Mill on the center; the "Rotary"
 * sub-label; the dedicated 3D-animated openers (openCornerWiz &c.); inline-SVG icons winning over emoji; and a
 * user op surfacing a live "Custom" dropdown through window.ddcsRefreshWizardBar.
 */
test('wizard bar renders from the library (groups, I/O, openers, icons, live custom group)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsRefreshWizardBar && window.ddcsGetBlockProgram);

  // Read the live bar DOM: each dropdown's group label, its content buttons (+ onclick/svg), and any dividers.
  const readBar = () => page.evaluate(() => {
    const read = (sel) => Array.from(document.querySelectorAll(sel)).map((dd) => ({
      label: (dd.querySelector('.btn-tx')?.textContent || '').trim(),
      items: Array.from(dd.querySelectorAll('.toolbar-dropdown-content > button')).map((b) => ({
        text: b.textContent.trim(),
        onclick: b.getAttribute('onclick') || '',
        hasSvg: !!b.querySelector('svg'),
      })),
      dividers: Array.from(dd.querySelectorAll('.toolbar-dropdown-content > div')).map((d) => d.textContent.trim()),
    }));
    return { left: read('.dock-header .header-left .toolbar-dropdown'), center: read('.dock-header .header-center .toolbar-dropdown') };
  });

  // baseline catalog (no user ops / overrides yet)
  await page.evaluate(() => { localStorage.removeItem('ddcs_user_ops'); localStorage.removeItem('ddcs_wizard_layout'); window.ddcsRefreshWizardBar(); });
  const bar = await readBar();

  // ── left: the Setup dropdown, with the I/O quick-actions appended as a special section ──
  expect(bar.left).toHaveLength(1);
  expect(bar.left[0].label).toBe('Setup');
  const leftOnclicks = bar.left[0].items.map((i) => i.onclick);
  expect(leftOnclicks).toEqual([
    "openWiz && openWiz('comm')",
    "openWiz && openWiz('atc_warmup')",
    "ddcsInsertIo && ddcsInsertIo('outpin')",
    "ddcsInsertIo && ddcsInsertIo('waitinput')",
    "ddcsInsertIo && ddcsInsertIo('dwell')",
  ]);
  expect(bar.left[0].dividers).toEqual(['I/O']);

  // ── center: Probe / ATC / Mill, in order ──
  expect(bar.center.map((g) => g.label)).toEqual(['Probe', 'ATC', 'Mill']);
  const probe = bar.center[0], atc = bar.center[1], mill = bar.center[2];

  // Probe: WCS uses the generic openWiz; Corner/Edge/Middle open the data-op TWIN in-place (opensAs); only Align keeps its
  // dedicated 3D-animated opener; the "Rotary" sub-label divider survives.
  const probeBy = Object.fromEntries(probe.items.map((i) => [i.text.replace(/\s+/g, ' '), i.onclick]));
  expect(probe.items[0].onclick).toBe("openWiz && openWiz('wcs')");
  // t339 E4 — IN-PLACE SWAP: the built-in Corner + Edge + Middle KEEP their Probe slots but `opensAs` opens the data-op TWIN
  // (openWiz('user_*_data') → userOpView); the built-in menu openers retire (no openCornerWiz/openEdgeWiz/openMiddleWiz); NO separate Data Wiz entry.
  const cornerItem = probe.items.find((i) => /Corner/.test(i.text));
  expect(cornerItem, 'Corner is IN its Probe slot (in-place)').toBeTruthy();
  expect(cornerItem.onclick, 'Corner opens the data-op twin in-place').toBe("openWiz && openWiz('user_corner_data')");
  expect(probe.items.some((i) => /openCornerWiz/.test(i.onclick || '')), 'no openCornerWiz opener (retired)').toBe(false);
  const edgeItem = probe.items.find((i) => /Edge/.test(i.text));
  expect(edgeItem, 'Edge is IN its Probe slot (in-place)').toBeTruthy();
  expect(edgeItem.onclick, 'Edge opens the data-op twin in-place').toBe("openWiz && openWiz('user_edge_data')");
  expect(probe.items.some((i) => /openEdgeWiz/.test(i.onclick || '')), 'no openEdgeWiz opener (retired)').toBe(false);
  const middleItem = probe.items.find((i) => /Middle/.test(i.text));
  expect(middleItem, 'Middle is IN its Probe slot (in-place)').toBeTruthy();
  expect(middleItem.onclick, 'Middle opens the data-op twin in-place').toBe("openWiz && openWiz('user_middle_data')");
  expect(probe.items.some((i) => /openMiddleWiz/.test(i.onclick || '')), 'no openMiddleWiz opener in the menu (retired; the fn survives as the legacy shim)').toBe(false);
  expect(probe.items.find((i) => /Align/.test(i.text)).onclick).toContain('openAlignmentWiz');
  expect(probe.dividers).toEqual(['Rotary']);

  // ATC: all five tools via openWiz
  expect(atc.items.map((i) => i.onclick)).toEqual([
    "openWiz && openWiz('atc_length')", "openWiz && openWiz('atc_check')", "openWiz && openWiz('atc_change')",
    "openWiz && openWiz('atc_table')", "openWiz && openWiz('atc_test')",
  ]);

  // Mill: DRILL now opens its data-op twin IN-PLACE (opensAs → openWiz('user_drill_data'), t405); BORE keeps its variant
  // (peck-only twin → Bore needs its own helical twin). Inline-SVG icons still render (drill) — the bar's SVG map WINS.
  expect(mill.items[0].onclick).toBe("openWiz && openWiz('user_drill_data')");
  expect(mill.items[1].onclick).toBe("openWiz && openWiz('drill','bore')");
  expect(mill.items.find((i) => i.onclick === "openWiz && openWiz('user_drill_data')").hasSvg).toBe(true);
  expect(mill.items.find((i) => i.onclick === "openWiz && openWiz('text')").hasSvg).toBe(true);

  // ── live custom group: register a user op + refresh → a "Custom" dropdown appears on the center ──
  await page.evaluate(async () => {
    const L = await import('/blocks/wizardLibrary.js');
    const U = await import('/blocks/userOps.js');
    L.createWizard(U.userOpFromStack('bar_test', 'Bar Test',
      [{ type: 'move', params: { x: 0, y: 0, z: -5 } }],
      [{ param: 'depth', blockIndex: 0, key: 'z', type: 'number', default: -5 }]));
    window.ddcsRefreshWizardBar();
  });
  const bar2 = await readBar();
  const custom = bar2.center.find((g) => g.label === 'Custom');
  expect(custom).toBeTruthy();
  expect(custom.items).toHaveLength(1);
  expect(custom.items[0].text).toContain('Bar Test');
  expect(custom.items[0].onclick).toBe("ddcsInsertUserOp && ddcsInsertUserOp('user_bar_test')");

  // ── a hidden built-in drops out of the bar (override + refresh) ──
  await page.evaluate(async () => {
    const L = await import('/blocks/wizardLibrary.js');
    L.setEntryOverride('pocket', { visible: false });
    window.ddcsRefreshWizardBar();
  });
  const bar3 = await readBar();
  const mill3 = bar3.center.find((g) => g.label === 'Mill');
  expect(mill3.items.some((i) => i.onclick === "openWiz && openWiz('pocket')")).toBe(false);

  // cleanup: restore the shipped bar so we don't leak state into other specs
  await page.evaluate(() => { localStorage.removeItem('ddcs_user_ops'); localStorage.removeItem('ddcs_wizard_layout'); window.ddcsRefreshWizardBar(); });
});
