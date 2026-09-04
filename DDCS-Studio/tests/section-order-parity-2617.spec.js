import { test, expect } from '@playwright/test';

/**
 * t2617 (BACKLOG #71/#72) — CLOSES THE HOLE t2613 found: `group_box`'s own authored order has NO mechanical
 * enforcement against `renderOpForm`'s own `SECTION_RANK` canonical order (`ui/formWidgets.js`'s own
 * `SECTION_RANK`/`sectionRankOf`, IDENTITY → FEATURE CONTEXT → GEOMETRY → TOOL & CUT) — the classic path
 * enforced it mechanically via a sort every render; the tree path only ever promised whatever the migration
 * author typed. t2613 measured 3 migrated ops (`atc_length_data`, `atc_check_data`, `edge_data`) shipped out of
 * band, confirmed against the REAL `renderOpForm` output (not source declaration order — that was the actual
 * mistake, per t2599's own edge comment: it inferred the classic render order from the array's own declared
 * sequence and never called the function to check).
 *
 * This is a CROSS-OP invariant, not a per-op one — a per-op row-diff test only proves an op's own fields land
 * in the op's own declared tree; it says nothing about whether that declared order matches the canonical rule.
 * `listUserOps()`-driven (not a hand-listed array) so an op added later is covered automatically.
 */

test('section-order-parity: every tree-mode op\'s declared group_box order matches SECTION_RANK, measured against the REAL renderOpForm', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async () => {
    const { listUserOps, childrenOf } = await import('/blocks/userOps.js');
    const { renderOpForm, SECTION_RANK, sectionRankOf } = await import('/ui/formWidgets.js');

    const isTree = (def) => {
      const root = (def.template || []).find((b) => b && b.type === 'user_root');
      if (!root || !Array.isArray(root.uiChildren)) return false;
      return (root.uiChildren || []).some((n) => n && (n.type === 'split_horizontal' || n.type === 'split_vertical'));
    };

    const results = [];
    for (const def of listUserOps()) {
      if (!isTree(def)) continue;
      const root = (def.template || []).find((b) => b && b.type === 'user_root');

      // the AUTHORED order — every group_box's own declared `title`, in tree-declaration order
      const authoredTitles = [];
      const walk = (nodes) => {
        for (const n of childrenOf(nodes)) {
          if (!n) continue;
          if (n.type === 'group_box' && n.params && n.params.title) authoredTitles.push(n.params.title);
          if (n.children) walk(n.children);
          if (n.uiChildren) walk(n.uiChildren);
        }
      };
      walk(root.uiChildren);
      if (authoredTitles.length < 2) continue;   // ordering is meaningless with 0-1 sections

      // the REAL classic order — call the REAL renderOpForm with this op's REAL, CURRENT bindings (never
      // reimplement the sort, never trust the source array's own declaration order — that is the exact
      // mistake t2613 found)
      const host = document.createElement('div');
      renderOpForm(host, def.bindings || []);
      const classicOrder = [];
      host.querySelectorAll('.form-sec').forEach((s) => { const t = s.dataset.section; if (t && !classicOrder.includes(t)) classicOrder.push(t); });
      if (!classicOrder.length) {
        // short form, no chrome — derive the implied row order directly (SECTION_RANK still applies to row
        // sequence even when sectionize is false, since the sort runs unconditionally before that branch)
        [...host.querySelectorAll('[data-param]')].forEach((el) => {
          const b = (def.bindings || []).find((x) => x.param === el.dataset.param);
          if (b && b.section && !classicOrder.includes(b.section)) classicOrder.push(b.section);
        });
      }

      const match = JSON.stringify(authoredTitles.map((t) => t.toUpperCase())) === JSON.stringify(classicOrder.map((t) => t.toUpperCase()));
      results.push({ opType: def.opType, authoredTitles, classicOrder, match });
    }
    return { results, sectionRank: SECTION_RANK, sanityRankOf: sectionRankOf('GEOMETRY') };
  });

  // sanity: the shared table is really imported and callable, not undefined-and-silently-passing
  expect(r.sectionRank).toEqual(['IDENTITY', 'FEATURE CONTEXT', 'GEOMETRY', 'TOOL & CUT']);
  expect(r.sanityRankOf).toBe(2);

  const mismatches = r.results.filter((x) => !x.match);
  if (mismatches.length) {
    console.log('SECTION-ORDER MISMATCHES:\n' + JSON.stringify(mismatches, null, 2));
  }
  expect(mismatches, mismatches.length ? JSON.stringify(mismatches.map((m) => m.opType)) : '').toEqual([]);
});
