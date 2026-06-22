import { test, expect } from '@playwright/test';

// Pocket WALL OFFSET (signed): the tool-centre region insets by (toolR − offset). +offset → bigger pocket (walls
// out / cut oversize), −offset → smaller pocket (leave stock). 0 = exact typed size. region.w = typed − 2·(r−off).
test.use({ viewport: { width: 1280, height: 900 } });

test('pocket wall offset resizes the tool-centre region (+ bigger, − leaves stock)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const pw = await import('/wizards/pocketWizard.js');
    const findType = (bs, t) => { for (const b of bs) { if (b.type === t) return b; if (b.children) { const f = findType(b.children, t); if (f) return f; } } return null; };
    const regionW = (wallOffset) => {
      const stack = pw.pocketStack({ shape: 'rect', originX: 0, originY: 0, w: 80, h: 60, toolDia: 6, depth: 4, stepdown: 2, strategy: 'raster', wallOffset });
      const over = findType(stack, 'stepover');                 // the region is the stepover's socket value (params.region)
      const rg = over && over.params && over.params.region;
      return rg && rg.params ? { w: rg.params.w, x: rg.params.x } : null;
    };
    return { zero: regionW(0), big: regionW(2), small: regionW(-2) };
  });
  // tool Ø6 → r3. exact: inset 3 → region 80−6 = 74, x = 3.
  expect(r.zero.w).toBeCloseTo(74, 1);
  expect(r.zero.x).toBeCloseTo(3, 1);
  // +2 (bigger): inset 1 → region 80−2 = 78, x = 1 (tool centre further out → finished pocket +4).
  expect(r.big.w).toBeCloseTo(78, 1);
  expect(r.big.x).toBeCloseTo(1, 1);
  // −2 (leave stock): inset 5 → region 80−10 = 70, x = 5 (tool centre further in → finished pocket −4).
  expect(r.small.w).toBeCloseTo(70, 1);
  expect(r.small.x).toBeCloseTo(5, 1);
});
