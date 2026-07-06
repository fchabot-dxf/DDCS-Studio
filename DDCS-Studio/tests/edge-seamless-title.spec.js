import { test, expect } from '@playwright/test';

/**
 * EDGE-PORT E5 — SEAMLESS TITLE. An IN-PLACE port (opensAs) opens with the built-in's PLAIN label ('Edge'/'Corner', no '(data)',
 * no "custom wizard" suffix) — the user sees the wizard exactly where + as it always was (human t342). ONE source: the built-in
 * entry's label (wizardLibrary.builtinLabelForTwin) drives BOTH the menu slot AND the opened title. The def.label KEEPS '(data)'
 * as the BLOCKS-TAB identity. A normal user op / additive twin keeps its "<label> — your custom wizard" heading. Display-only →
 * emit BYTE-IDENTICAL.
 */
test('edge/corner open with the plain built-in title; def.label keeps (data) for the Blocks tab; emit byte-identical', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram);

  // (1) UNIT — builtinLabelForTwin maps the twin → the built-in's plain label; null for a normal user op
  const unit = await page.evaluate(async () => {
    const L = await import('/blocks/wizardLibrary.js');
    return { edge: L.builtinLabelForTwin('user_edge_data'), corner: L.builtinLabelForTwin('user_corner_data'), drill: L.builtinLabelForTwin('user_drill_data'), bogus: L.builtinLabelForTwin('user_nope') };
  });
  expect(unit.edge, 'the edge twin titles as the built-in "Edge"').toBe('Edge');
  expect(unit.corner, 'the corner twin titles as the built-in "Corner"').toBe('Corner');
  expect(unit.drill, 'a normal/additive twin has no in-place title (keeps its custom heading)').toBe(null);
  expect(unit.bogus, 'an unknown op → null').toBe(null);

  // (2) REAL-SYMPTOM — open each in-place twin; the wizard usage/title reads the PLAIN built-in label
  const openTitle = async (optype, defFactoryPath, factory) => {
    await page.evaluate(async ([op, path, fn]) => {
      const U = await import('/blocks/userOps.js'); const M = await import(path);
      localStorage.removeItem('ddcs_user_ops'); U.createUserOp(M[fn]());
    }, [optype, defFactoryPath, factory]);
    await page.evaluate((op) => window.openWiz(op), optype);
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    return page.evaluate(() => (document.getElementById('wiz_user_usage') || {}).textContent || '');
  };
  const edgeTitle = await openTitle('user_edge_data', '/blocks/dataOps/edgeData.js', 'edgeDataDef');
  const cornerTitle = await openTitle('user_corner_data', '/blocks/dataOps/cornerData.js', 'cornerDataDef');

  // (3) the def.label KEEPS '(data)' (the Blocks-tab identity), while the TITLE is plain; emit byte-identical (display-only)
  const rest = await page.evaluate(async () => {
    const ED = await import('/blocks/dataOps/edgeData.js'); const CD = await import('/blocks/dataOps/cornerData.js');
    const { edgeStack } = await import('/wizards/edgeWizard.js'); const { cornerStack } = await import('/wizards/cornerWizard.js');
    const { registerUserOp } = await import('/blocks/userOps.js'); const { builderOf } = await import('/blocks/opBuilders.js'); const { emitMapped } = await import('/blocks/blockEmitter.js');
    registerUserOp(ED.edgeDataDef()); registerUserOp(CD.cornerDataDef());
    const eb = builderOf(ED.EDGE_DATA_OPTYPE), cb = builderOf(CD.CORNER_DATA_OPTYPE);
    const eS = (o) => ({ ...ED.EDGE_DEFAULTS, ...o }), cS = (o) => ({ ...CD.CORNER_DEFAULTS, ...o });
    return {
      edgeDefLabel: ED.edgeDataDef().label, cornerDefLabel: CD.cornerDataDef().label,
      emitSame: emitMapped(eb(eS({}))).text === emitMapped(edgeStack(eS({}))).text
        && emitMapped(eb(eS({ axis: 'Y', dir: 'neg', wcs: 'G56' }))).text === emitMapped(edgeStack(eS({ axis: 'Y', dir: 'neg', wcs: 'G56' }))).text
        && emitMapped(cb(cS({}))).text === emitMapped(cornerStack(cS({}))).text,
    };
  });
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));

  expect(edgeTitle, 'the OPENED Edge wizard title is the plain "Edge" (no "(data)", no "custom wizard")').toBe('Edge');
  expect(cornerTitle, 'the OPENED Corner wizard title is the plain "Corner"').toBe('Corner');
  expect(rest.edgeDefLabel, 'the edge def.label KEEPS "(data)" — the Blocks-tab identity').toBe('Edge (data)');
  expect(rest.cornerDefLabel, 'the corner def.label keeps "(data)"').toBe('Corner (data)');
  expect(rest.emitSame, 'the title is display-only → emit stays byte-identical to the built-ins').toBe(true);
});
