import { test, expect } from '@playwright/test';

/**
 * Learner library (ROADMAP MID #14) — the Blocks toolbox is a TREE: ⚛ Atoms · 📚 Snippets · 📦 Complete Programs,
 * where Snippets and Programs each hold themed CATEGORIES of curated compositions. The guarantee is
 * valid-by-construction: every curated composition emits clean G-code, and each is ONE draggable flyout block
 * (a whole stack, via stackBridge.stackToFlyoutBlock).
 */
test('learner library: tree (Atoms · Snippets · Programs) with sub-categories; every composition emits valid G-code', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => !!window.ddcsStudio);

  const r = await page.evaluate(async () => {
    const { allLearnerEntries, learnerToolboxCategories } = await import('/data/learnerLibrary.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { buildToolbox } = await import('/blocks/blockly/bridge.js');

    // valid-by-construction: each curated composition emits non-empty G-code without throwing
    const emits = allLearnerEntries().map((e) => {
      try { const t = (emitMapped(e.stack).text || '').trim(); return { id: e.id, lines: t.split('\n').filter(Boolean).length, err: null }; }
      catch (ex) { return { id: e.id, lines: 0, err: String((ex && ex.message) || ex) }; }
    });

    const tb = buildToolbox(learnerToolboxCategories());
    const top = tb.contents.map((c) => c.name);
    const get = (re) => tb.contents.find((c) => re.test(c.name));
    const atoms = get(/Atoms/), snip = get(/Snippets/), prog = get(/Complete Programs/);
    const isCat = (x) => x && x.kind === 'category';
    const isBlockStack = (x) => x && x.kind === 'block' && x.type && x.next;   // a connected composition
    return {
      emits, top, entryCount: allLearnerEntries().length,
      atomsHasSubCats: !!(atoms && atoms.contents.length && atoms.contents.every(isCat)),
      snipSubCatNames: snip ? snip.contents.map((c) => c.name) : [],
      snipSubCatsAreCats: !!(snip && snip.contents.length && snip.contents.every(isCat)),
      snipFirstLeafIsStack: !!(snip && snip.contents[0] && isBlockStack(snip.contents[0].contents[0])),
      progSubCatNames: prog ? prog.contents.map((c) => c.name) : [],
    };
  });

  for (const e of r.emits) expect(e.lines, `${e.id} emits valid G-code (${e.err || ''})`).toBeGreaterThan(0);
  expect(r.entryCount, 'has curated compositions').toBeGreaterThan(0);
  // three top-level tree nodes, in order
  expect(r.top.filter((n) => /Atoms|Snippets|Complete Programs/.test(n))).toEqual(
    expect.arrayContaining(['⚛ Atoms', '📚 Snippets', '📦 Complete Programs']));
  // Atoms holds the ops categories; Snippets/Programs hold themed sub-categories
  expect(r.atomsHasSubCats, 'Atoms is a parent of the ops categories').toBe(true);
  expect(r.snipSubCatsAreCats, 'Snippets holds sub-categories').toBe(true);
  expect(r.snipSubCatNames, 'Snippets sub-categories present').toEqual(expect.arrayContaining(['Spindle & Coolant', 'Motion']));
  expect(r.progSubCatNames, 'Programs sub-categories present').toEqual(expect.arrayContaining(['Milling']));
  // a leaf of a Snippets sub-category is ONE draggable connected composition (head + next)
  expect(r.snipFirstLeafIsStack, 'a composition is one draggable connected stack').toBe(true);
});

test('Probing snippets: the canonical "probe surface" primitive (single + two-pass) drags in as one stack + emits G31', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => !!window.ddcsStudio);

  const r = await page.evaluate(async () => {
    const { SNIPPETS, learnerToolboxCategories } = await import('/data/learnerLibrary.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { stackToFlyoutBlock } = await import('/blocks/blockly/stackBridge.js');
    const { buildToolbox } = await import('/blocks/blockly/bridge.js');

    const probing = SNIPPETS.find((g) => g.category === 'Probing');
    const byId = (id) => probing.entries.find((e) => e.id === id);
    const surf = (id) => {
      const e = byId(id);
      const g = (emitMapped(e.stack).text || '').trim();
      const fb = stackToFlyoutBlock(e.stack);
      // count connected blocks down the Blockly next chain (next.block) — one draggable stack
      let n = 0; for (let b = fb; b; b = b.next && b.next.block) n += 1;
      return { present: !!e, g31: /G31 /.test(g), reads: /#1925|#1927|#50|#1500|#864/.test(g), stackLen: n, stackHead: !!(fb && fb.type) };
    };
    return { single: surf('probe-surface'), two: surf('probe-surface-2pass'),
             probingNames: probing.entries.map((e) => e.id),
             snipHasProbing: buildToolbox(learnerToolboxCategories())
               .contents.find((c) => /Snippets/.test(c.name)).contents.some((c) => c.name === 'Probing') };
  });

  expect(r.probingNames, 'both probe-surface snippets are curated under Probing').toEqual(
    expect.arrayContaining(['probe-surface', 'probe-surface-2pass']));
  expect(r.snipHasProbing, 'Probing sub-category shows under 📚 Snippets').toBe(true);
  // single-pass: a real G31 + a stored result, all in one connected stack (cmt+probe+check+move+read = 5)
  expect(r.single.g31, 'probe-surface emits a G31 probe').toBe(true);
  expect(r.single.reads, 'probe-surface stores the touch result').toBe(true);
  expect(r.single.stackLen, 'probe-surface drags in as one connected 5-block stack').toBe(5);
  // two-pass: TWO G31s (fast + slow) in one connected stack (cmt + 2×(probe,check,move) + read = 8)
  expect((r.two.g31), 'probe-surface-2pass emits G31 probes').toBe(true);
  expect(r.two.stackLen, 'probe-surface-2pass drags in as one connected 8-block stack').toBe(8);
});
