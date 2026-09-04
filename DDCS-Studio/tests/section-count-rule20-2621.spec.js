import { test, expect } from '@playwright/test';

/**
 * t2621 (BACKLOG #71/#72, rule 20 hardening) — `sectionizeForTree` counts declared `group_box` NODES, not
 * distinct `binding.section` VALUES, so two same-titled boxes count as 2 (owner ruling, context/
 * PRODUCT-PRINCIPLES.md #20: "section names are free text, duplicates are legal and must NOT be merged").
 *
 * The case this closes: two `group_box` nodes both titled "GEOMETRY", each field_ref'd to bindings that ALSO
 * both declare `section:'GEOMETRY'` (the natural way an author would build two same-titled boxes — nothing
 * requires the underlying bindings to use different section strings). Counting DISTINCT VALUES would see only
 * ONE section ('GEOMETRY') and refuse to fold a form the owner explicitly said should be allowed to. Counting
 * NODES sees 2, correctly.
 */

test('section-count-rule20: two same-titled group_box nodes count as 2 (rule 20), not merged to 1', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async () => {
    const { sectionizeForTree, sectionizeFor } = await import('/ui/formWidgets.js');

    // 10 bindings, all section:'GEOMETRY' (rowCount=10 > SECTION_THRESHOLD=8) — split across TWO group_box
    // nodes both titled 'GEOMETRY' (5 field_refs each), the shape a rule-20-legal wizard would declare.
    const bindings = Array.from({ length: 10 }, (_, i) => ({ param: `p${i}`, section: 'GEOMETRY' }));
    const uiTree = [{
      type: 'split_horizontal', params: {},
      children: {
        LEFT: [{
          type: 'param_group', params: {},
          children: [
            { type: 'group_box', params: { title: 'GEOMETRY' }, children: bindings.slice(0, 5).map((b) => ({ type: 'field_ref', params: { param: b.param } })) },
            { type: 'group_box', params: { title: 'GEOMETRY' }, children: bindings.slice(5).map((b) => ({ type: 'field_ref', params: { param: b.param } })) },
          ],
        }],
        RIGHT: [],
      },
    }];

    return {
      // the OLD (still-correct-for-classic) distinct-value count would say 1 section -> sectionize FALSE
      distinctValueBased: sectionizeFor(bindings),
      // the NEW tree-node count says 2 group_box nodes -> sectionize TRUE
      nodeBased: sectionizeForTree(uiTree, bindings),
    };
  });

  expect(r.distinctValueBased, 'sanity: distinct binding.section values alone would say only 1 section (the classic-path function, unchanged)').toBe(false);
  expect(r.nodeBased, 'the tree-mode function counts group_box NODES: 2 same-titled boxes -> sectionize TRUE, not merged').toBe(true);
});

test('section-count-rule20: two DIFFERENT-titled group_box nodes still count as 2 (no regression on the common case)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async () => {
    const { sectionizeForTree } = await import('/ui/formWidgets.js');
    const bindings = [
      ...Array.from({ length: 5 }, (_, i) => ({ param: `g${i}`, section: 'GEOMETRY' })),
      ...Array.from({ length: 5 }, (_, i) => ({ param: `t${i}`, section: 'TOOL & CUT' })),
    ];
    const uiTree = [{
      type: 'split_horizontal', params: {},
      children: {
        LEFT: [{
          type: 'param_group', params: {},
          children: [
            { type: 'group_box', params: { title: 'GEOMETRY' }, children: bindings.slice(0, 5).map((b) => ({ type: 'field_ref', params: { param: b.param } })) },
            { type: 'group_box', params: { title: 'TOOL & CUT' }, children: bindings.slice(5).map((b) => ({ type: 'field_ref', params: { param: b.param } })) },
          ],
        }],
        RIGHT: [],
      },
    }];
    return { nodeBased: sectionizeForTree(uiTree, bindings) };
  });

  expect(r.nodeBased, 'two differently-titled boxes over threshold still fold, unchanged').toBe(true);
});

test('section-count-rule20: a single group_box (or none) stays plain, unchanged', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async () => {
    const { sectionizeForTree } = await import('/ui/formWidgets.js');
    const bindings = Array.from({ length: 10 }, (_, i) => ({ param: `p${i}`, section: 'GEOMETRY' }));
    const oneBox = [{ type: 'split_horizontal', params: {}, children: { LEFT: [{ type: 'param_group', params: {}, children: [{ type: 'group_box', params: { title: 'GEOMETRY' }, children: bindings.map((b) => ({ type: 'field_ref', params: { param: b.param } })) }] }], RIGHT: [] } }];
    const noBox = [{ type: 'split_horizontal', params: {}, children: { LEFT: [{ type: 'param_group', params: {}, children: bindings.map((b) => ({ type: 'field_ref', params: { param: b.param } })) }], RIGHT: [] } }];
    return { oneBox: sectionizeForTree(oneBox, bindings), noBox: sectionizeForTree(noBox, bindings) };
  });

  expect(r.oneBox, 'a single group_box, however many rows, never crosses the >=2-sections half').toBe(false);
  expect(r.noBox, 'no group_box at all stays plain').toBe(false);
});
