import { test, expect } from '@playwright/test';

/**
 * EDGE-PORT E3 — VIEW. The edge data-op's form3d+2d Layout shows its DATUM: a highlighted WALL LINE (the probed stock edge)
 * + an APPROACH line from the sim-start toward it — edge's datum is a LINE + a direction (vs corner's POINT). ASSERT-THE-VALUE:
 * the glyphs are present AND at the geometrically-correct positions (the right stock face per axis/dir; the approach perpendicular
 * from the marker to the wall). Opt-in (an op declaring axis+dir enums, like cornerPick), PURELY VISUAL → emit byte-identical.
 */
test('edge-view E3: the Layout shows the probed WALL LINE + APPROACH at the right positions; emit byte-identical', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async () => {
    const { edgeDataDef, EDGE_DEFAULTS, EDGE_DATA_OPTYPE } = await import('/blocks/dataOps/edgeData.js');
    const { edgeStack } = await import('/wizards/edgeWizard.js');
    const { layoutSpecFromOp } = await import('/wizards/ops/panelTypes.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { opSimStarts } = await import('/viz/opSimStarts.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');

    registerUserOp(edgeDataDef());
    const S = (o) => ({ ...EDGE_DEFAULTS, ...o });
    const stock = (window.ddcsGetSettings && window.ddcsGetSettings().stock) || {};
    const def = edgeDataDef();

    const combos = [];
    for (const axis of ['X', 'Y']) for (const dir of ['pos', 'neg']) {
      const p = S({ axis, dir });
      const start = (opSimStarts(EDGE_DATA_OPTYPE, p, stock) || [])[0];
      const spec = layoutSpecFromOp(def, p, start ? { pos: start } : null, null);
      const items = spec.items || [];
      combos.push({ k: `${axis}/${dir}`, w: spec.stock.w, h: spec.stock.h, wall: items.find((it) => it.cls === 'fc-edge-wall'), approach: items.find((it) => it.cls === 'fc-edge-approach') });
    }

    // a NON-edge op (corner) does NOT get the edge glyph (opt-in gate)
    const CD = await import('/blocks/dataOps/cornerData.js');
    const cornerSpec = layoutSpecFromOp(CD.cornerDataDef(), CD.CORNER_DEFAULTS, null, null);
    const cornerHasEdgeGlyph = (cornerSpec.items || []).some((it) => it.cls === 'fc-edge-wall');

    // sim-only → emit byte-identical (the glyph is items-only, never touches the stack)
    const db = builderOf(EDGE_DATA_OPTYPE);
    const emitSame = emitMapped(db(S({}))).text === emitMapped(edgeStack(S({}))).text
      && emitMapped(db(S({ axis: 'Y', dir: 'neg' }))).text === emitMapped(edgeStack(S({ axis: 'Y', dir: 'neg' }))).text;
    return { combos, cornerHasEdgeGlyph, emitSame };
  });

  for (const c of r.combos) {
    const [axis, dir] = c.k.split('/'); const pos = dir === 'pos';
    expect(c.wall, `${c.k}: the probed WALL LINE glyph is present`).toBeTruthy();
    expect(c.approach, `${c.k}: the APPROACH glyph is present`).toBeTruthy();
    if (axis === 'X') {
      const wx = pos ? 0 : c.w;
      expect(c.wall.x1, `${c.k}: wall on the ${pos ? 'near (x=0)' : 'far (x=W)'} X face`).toBe(wx);
      expect(c.wall.x2).toBe(wx);
      expect(Math.abs(c.wall.y2 - c.wall.y1), `${c.k}: wall spans the full stock height`).toBe(c.h);
      expect(c.approach.x2, `${c.k}: the approach ends AT the wall`).toBe(wx);
      expect(c.approach.y1, `${c.k}: the approach is perpendicular (horizontal) to the X wall`).toBe(c.approach.y2);
    } else {
      const wy = pos ? 0 : c.h;
      expect(c.wall.y1, `${c.k}: wall on the ${pos ? 'near (y=0)' : 'far (y=H)'} Y face`).toBe(wy);
      expect(c.wall.y2).toBe(wy);
      expect(Math.abs(c.wall.x2 - c.wall.x1), `${c.k}: wall spans the full stock width`).toBe(c.w);
      expect(c.approach.y2, `${c.k}: the approach ends AT the wall`).toBe(wy);
      expect(c.approach.x1, `${c.k}: the approach is perpendicular (vertical) to the Y wall`).toBe(c.approach.x2);
    }
  }
  expect(r.cornerHasEdgeGlyph, 'the edge glyph is OPT-IN — corner (no axis/dir binding) does NOT get it').toBe(false);
  expect(r.emitSame, 'sim-only: the edge glyph is preview-only → emit byte-identical').toBe(true);
});
