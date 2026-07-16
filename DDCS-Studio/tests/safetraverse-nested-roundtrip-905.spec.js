import { test, expect } from '@playwright/test';

/**
 * t905 (P2.5 grounding) — the NESTED safetraverse round-trip. A `safetraverse` transparent bundle sits INSIDE the corner
 * op's body (t901). It has NO marker of its own (serializeWithMarkers only marks type==='op'); instead it round-trips as a
 * BYPRODUCT of the OWNING op's marker: the corner marker declares the corner params, and on reimport builderOf('corner')
 * (cornerStack) REGENERATES the whole body — including the nested safetraverse child — from those params. This test locks
 * that in: a corner-with-safetraverse survives .nc export → reimport BYTE-IDENTICALLY, and the safetraverse child returns.
 *
 * (The STANDALONE palette-dropped safetraverse is a separate, unbuilt structural hole — see WORK-LOG t905: it's a
 * t812-class non-op leaf-compound with no marker + no builder + no leaf-instantiate hook. GATED, atom stays hidden.)
 */
test('a corner op with a nested safetraverse survives .nc export → reimport (byte-identical; the safetraverse child returns)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsLoadBlockStack && window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const PM = await import('/blocks/programModel.js');
    const OB = await import('/blocks/opBuilders.js');
    const EM = await import('/blocks/blockEmitter.js');
    const CD = await import('/blocks/dataOps/cornerData.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    registerUserOp(CD.cornerDataDef());
    const P = { ...CD.CORNER_DEFAULTS };
    const corner = OB.makeOp(CD.CORNER_DATA_OPTYPE, P, OB._builderAtoms(CD.CORNER_DATA_OPTYPE, P));

    const hasST = (blocks) => { let f = false; const walk = (bs) => { for (const b of (bs || [])) { if (!b) continue; if (b.type === 'safetraverse') f = true; if (b.children) walk(b.children); } }; walk(blocks); return f; };

    window.ddcsLoadBlockStack([corner]);
    const nc = PM.serializeWithMarkers();                 // .nc export (with the corner op marker)
    const back = PM.importMarkedNc(nc);                   // reimport → the corner builder regenerates the body
    return {
      origHasST: hasST([corner]),
      backHasST: hasST(back),
      hasCornerMarker: new RegExp('@DDCS:\\d+ \\{"op":"' + CD.CORNER_DATA_OPTYPE).test(nc),   // the owning op's marker (user_corner_data)
      emitByteIdentical: EM.emitMapped([corner]).text === EM.emitMapped(back).text,
      backLen: back.length,
    };
  });
  expect(r.origHasST, 'the built corner op contains a nested safetraverse child').toBe(true);
  expect(r.hasCornerMarker, 'the .nc export carries the corner op marker (the safetraverse rides it — no marker of its own)').toBe(true);
  expect(r.backHasST, 'after reimport, the corner builder regenerated the nested safetraverse child').toBe(true);
  expect(r.emitByteIdentical, 'the reimported corner re-emits BYTE-IDENTICAL G-code (the safetraverse round-trips via the owning op)').toBe(true);
});
