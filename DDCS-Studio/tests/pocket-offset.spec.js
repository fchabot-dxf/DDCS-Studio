import { test, expect } from '@playwright/test';

// Pocket WALL OFFSET (signed): the tool-centre region insets by (toolR − offset). +offset → bigger pocket (walls
// out / cut oversize), −offset → smaller pocket (leave stock). 0 = exact typed size. region.w = typed − 2·(r−off).
//
// t1406 — THE SAME PROPERTY, NOW ON TWO ARMS. A rect pocket's clearing rides `surfaceraster`, which declares the GIVEN
// rect as its footprint and carries the inset as its own number (so a placed pocket does not slide by the tool radius
// — t1402's finding 3). The walked rectangle is therefore `x + inset` for `w − 2·inset` rather than a pre-inset region
// descriptor. This reads whichever block the arm actually built and asserts the SAME three numbers off it, and then
// checks the LITERAL arm answers identically — which is what makes this one property rather than two.
test.use({ viewport: { width: 1280, height: 900 } });

test('pocket wall offset resizes the tool-centre region (+ bigger, − leaves stock)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const pw = await import('/wizards/pocketWizard.js');
    const { pocketInsetRegion } = await import('/wizards/ops/pocketfill.js');
    const findType = (bs, t) => { for (const b of bs) { if (b.type === t) return b; if (b.children) { const f = findType(b.children, t); if (f) return f; } } return null; };
    const regionW = (wallOffset, over = {}) => {
      const stack = pw.pocketStack({ shape: 'rect', originX: 0, originY: 0, w: 80, h: 60, toolDia: 6, depth: 4, stepdown: 2, strategy: 'raster', wallOffset, ...over });
      const sr = findType(stack, 'surfaceraster');
      if (sr) { const p = sr.params; return { w: p.w - 2 * p.inset, x: p.x + p.inset, via: 'surfaceraster' }; }
      const pf = findType(stack, 'pocketfill');                 // E0 flatten: the FLAT pocketfill leaf carries wallOffset + computes the tool-centre inset internally
      const rg = pf && pf.params ? pocketInsetRegion(pf.params) : null;   // the inset region descriptor (same value the stepover socket held)
      return rg ? { w: rg.w, x: rg.x, via: 'pocketfill' } : null;
    };
    return {
      zero: regionW(0), big: regionW(2), small: regionW(-2),
      // t1418 — the LITERAL arm used to be picked with `direction: 'oneway'`, which stopped being a literal arm the
      // moment the atom learned the walk. A rest tool is the replacement: still RECT (so the three numbers below are
      // the same three), still refused, and a real operator config rather than a synthetic one.
      litZero: regionW(0, { restDia: 3 }), litBig: regionW(2, { restDia: 3 }), litSmall: regionW(-2, { restDia: 3 }),
    };
  });
  expect(r.zero.via, 'a both-ways raster pocket rides the atom').toBe('surfaceraster');
  expect(r.litZero.via, 'a rest-tool one keeps the literal leaf — the named boundary').toBe('pocketfill');
  for (const [tag, got] of [['parametric', [r.zero, r.big, r.small]], ['literal', [r.litZero, r.litBig, r.litSmall]]]) {
    const [zero, big, small] = got;
    // tool Ø6 → r3. exact: inset 3 → region 80−6 = 74, x = 3.
    expect(zero.w, `${tag}: exact size`).toBeCloseTo(74, 1);
    expect(zero.x, `${tag}: exact origin`).toBeCloseTo(3, 1);
    // +2 (bigger): inset 1 → region 80−2 = 78, x = 1 (tool centre further out → finished pocket +4).
    expect(big.w, `${tag}: +2 oversize`).toBeCloseTo(78, 1);
    expect(big.x, `${tag}: +2 origin`).toBeCloseTo(1, 1);
    // −2 (leave stock): inset 5 → region 80−10 = 70, x = 5 (tool centre further in → finished pocket −4).
    expect(small.w, `${tag}: −2 leaves stock`).toBeCloseTo(70, 1);
    expect(small.x, `${tag}: −2 origin`).toBeCloseTo(5, 1);
  }
});
