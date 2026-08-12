import { test, expect } from '@playwright/test';

/**
 * Blocks-tab HOVER / SELECT → projected-code highlight (learner aid). Three linked surfaces, all from the ONE emit:
 *   - BLOCK hover  → its emitted lines glow LIGHTER than selection (.warm), no scroll, clears on exit.
 *   - VALUE hover  → the exact emitted token of the value under the cursor is boxed (.thot).
 *   - SELECT leaf  → all of a leaf atom's value tokens are boxed (.thot); selecting a container does not (leaf-scoped).
 * Block→block resolution rides Blockly's data-id on each SVG root; value/token spans come from opGlow (perturb+diff).
 *
 * t1734 — RETIRED, not repointed: GAMEPLAN STEP 3 deleted the Projected G-code pane (#blk-gcode) and every surface
 * these three tests exercise — the `.gl`/`.warm`/`.thot` code-panel overlays, and the host mouseover/mouseleave
 * listeners that drove them (resolveHoverTarget survives in blocksApp.js, but only to feed recordBlockEdit; its
 * code-panel-hover caller is gone). The block-to-line link is an explicitly accepted loss (see the dispatch), and
 * there is no successor surface on the new Wizard View / 3D tabs to point a "hover warms code lines" test at.
 * Bodies kept verbatim, unexecuted, as the historical record. See ARCHITECTURE.md and WORK-LOG t1734.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

async function seedAndOpen(page, wiz = 'surfacing') {
  page.on('dialog', (d) => d.accept());
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.updateWiz && window.insertWiz && window.closeWiz && window.showApp && window.ddcsGetBlockProgram);
  await page.evaluate(async (w) => {
    window.openWiz(w, undefined, true); window.updateWiz(); await window.insertWiz(); window.closeWiz && window.closeWiz();
  }, wiz);
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks(false).length > 0, { timeout: 8000 });
  await page.waitForTimeout(400);
  // Steady state: the panel is first rendered from the model's PRE-reproject ids, then an async reproject re-emits
  // with the workspace's (Blockly) ids. Hover (and click-selection) are workspace-driven, so wait until the panel's
  // ancestry ids ARE the current workspace ids — else they can't match (a real, pre-existing transient on open).
  await page.waitForFunction(() => {
    const ws = window.__blkws, out = document.getElementById('blk-gcode');
    const b = ws && ws.getAllBlocks(false)[0];
    if (!b || !b.getSvgRoot() || !b.getSvgRoot().getAttribute('data-id') || !out) return false;
    const gls = [...out.querySelectorAll('.gl')];
    if (!gls.length) return false;
    const wsIds = new Set(ws.getAllBlocks(false).map((x) => x.id));
    const srcIds = [...new Set(gls.flatMap((sp) => (sp.dataset.src || '').split(',')).filter(Boolean))];
    return srcIds.length > 0 && srcIds.every((id) => wsIds.has(id));
  }, { timeout: 8000 });
}

/**
 * t1361 — SEEDED FROM A POCKET, because this test needs a stack that NESTS. It asserts INNERMOST resolution, which
 * requires a leaf whose emitted lines are a strict subset of its container's — and surfacing stopped being one: the
 * parametric switch collapsed `stepdown{ surfacefill }` into a single `surfaceraster`, and the placement fold hands
 * that atom its frame instead of wrapping text around it, so `placeonstock`, the op block and the raster now own the
 * IDENTICAL 47 lines (measured). Nothing to be innermost OF — the test would have passed on a vacuous premise.
 * Pocket kept the shape (stepdown 192 lines ⊃ pocketfill 189), so the property is asserted where it still exists.
 * The other tests in this file keep the surfacing seed — hover/select are not surfacing-specific, but this one needs
 * real nesting to mean anything.
 *
 * t1406 — AND NOW IT IS SEEDED FROM A CONTOUR, for the identical reason one turn later: a rect pocket's clearing
 * re-pointed through `surfaceraster` too, so `place{ stepdown{ pocketfill } }` collapsed exactly as surfacing's did and
 * the default (spiral) pocket has nothing left to be innermost OF. `contour` still emits `stepdown{ contourfill }` and
 * is the nearest op that does. The pattern is worth naming rather than just following: every op this arc re-points
 * loses its nesting, so a test whose premise IS nesting has to be re-homed each time — and it fails LOUDLY when the
 * premise goes (the `hasLeaf` assertion), which is the only reason this has not silently become a no-op twice over.
 */
test.fixme('block hover warms its lines (lighter, no scroll), resolves the INNERMOST block, clears on exit — t1734: #blk-gcode deleted', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await seedAndOpen(page, 'contour');

  const r = await page.evaluate(() => {
    const ws = window.__blkws, out = document.getElementById('blk-gcode'), host = document.querySelector('.blk-bk-host');
    const gls = [...out.querySelectorAll('.gl')];
    const warmIdx = () => gls.map((sp, i) => (sp.classList.contains('warm') ? i : -1)).filter((i) => i >= 0);
    const hotIdx = () => gls.map((sp, i) => (sp.classList.contains('hot') ? i : -1)).filter((i) => i >= 0);
    const owned = (id) => gls.map((sp, i) => ((sp.dataset.src || '').split(',').includes(id) ? i : -1)).filter((i) => i >= 0);

    const blocks = ws.getAllBlocks(false).map((b) => ({ b, lines: owned(b.id) })).filter((x) => x.lines.length);
    blocks.sort((a, b) => b.lines.length - a.lines.length);
    const container = blocks[0];
    // a nested leaf: a strict, non-empty subset of the container's lines (proves INNERMOST data-id resolution)
    const leaf = blocks.find((x) => x.b.id !== container.b.id && x.lines.length < container.lines.length && x.lines.every((i) => container.lines.includes(i)));

    const scrollBefore = out.scrollTop;
    container.b.getSvgRoot().dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    const containerWarm = warmIdx(), hotDuringHover = hotIdx(), hasSel = out.classList.contains('has-sel'), scrollAfter = out.scrollTop;

    let leafWarm = null, leafExpected = null;
    if (leaf) {
      leaf.b.getSvgRoot().dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      leafWarm = warmIdx(); leafExpected = leaf.lines;
    }
    host.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));   // exit gesture → clears (the dedicated handler)
    const afterLeave = warmIdx();
    return { containerWarm, containerExpected: container.lines, hotDuringHover, hasSel, scrollBefore, scrollAfter, hasLeaf: !!leaf, leafWarm, leafExpected, afterLeave };
  });

  expect(r.containerExpected.length, 'the container owns multiple lines').toBeGreaterThan(0);
  expect(r.containerWarm, 'hovering the container warms exactly its lines').toEqual(r.containerExpected);
  expect(r.hotDuringHover, 'hover does not engage selection (.hot)').toEqual([]);
  expect(r.hasSel, 'hover does not enter selection-dim mode').toBe(false);
  expect(r.scrollAfter, 'hover does not scroll').toBe(r.scrollBefore);
  // INNERMOST resolution: hovering the nested leaf warms ITS (smaller, contained) line set — not the container's
  expect(r.hasLeaf, 'found a nested leaf with a strict subset of lines').toBe(true);
  expect(r.leafWarm, 'hovering a nested leaf warms exactly its own lines (innermost data-id)').toEqual(r.leafExpected);
  expect(r.leafWarm.length, 'leaf set is a STRICT subset').toBeLessThan(r.containerExpected.length);
  expect(r.afterLeave, 'mouseleave clears the hover highlight').toEqual([]);
  expect(errs).toEqual([]);
});

test.fixme('hovering a value field boxes exactly that value’s emitted token (.thot) and warms its block — t1734: #blk-gcode deleted', async ({ page }) => {
  await seedAndOpen(page);
  const r = await page.evaluate(() => {
    const ws = window.__blkws;
    const nums = ws.getAllBlocks(true).filter((b) => b.type === 'math_number' && b.getParent());
    const num = nums.find((b) => Number.isInteger(Number(b.getFieldValue('NUM'))) && Number(b.getFieldValue('NUM')) !== 0) || nums[0];
    const val = Number(num.getFieldValue('NUM'));
    num.getSvgRoot().dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    const thot = [...document.querySelectorAll('#blk-gcode .thot')].map((s) => s.textContent);
    const warm = document.querySelectorAll('#blk-gcode .gl.warm').length;
    // move off the value entirely → token clears
    document.querySelector('.blk-bk-host').dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    const thotAfter = document.querySelectorAll('#blk-gcode .thot').length;
    return { val, thot, warm, thotAfter };
  });
  expect(r.thot.length, 'a value token got boxed').toBeGreaterThan(0);
  expect(r.thot.some((t) => Number(t) === r.val), `the boxed token is THIS value (${r.val})`).toBe(true);
  expect(r.warm, 'the value’s owning block is also warmed').toBeGreaterThan(0);
  expect(r.thotAfter, 'moving off the value clears the token box').toBe(0);
});

test.fixme('selecting a leaf atom boxes its value tokens; selecting a container does not (leaf-scoped) — t1734: #blk-gcode deleted', async ({ page }) => {
  await seedAndOpen(page);
  const ids = await page.evaluate(() => {
    const ws = window.__blkws;
    const leaf = ws.getAllBlocks(false).find((b) => b.type === 'surfaceraster');   // t1361 — surfacing's leaf atom since the switch
    // a TRUE statement container = a MODEL block with statement children (getChildren counts shadow values, so use the model)
    const cont = (function find(bs) { for (const b of (bs || [])) { if (b && b.children && b.children.length) return b.id; const f = find(b && b.children); if (f) return f; } return null; })(window.ddcsGetBlockProgram());
    return { leaf: leaf ? leaf.id : null, cont };
  });
  expect(ids.leaf, 'found the surfaceraster leaf').toBeTruthy();

  await page.evaluate((id) => window.__blkws.getBlockById(id).select(), ids.leaf);
  await page.waitForTimeout(120);
  const leafThot = await page.evaluate(() => document.querySelectorAll('#blk-gcode .thot').length);
  expect(leafThot, 'selecting a leaf boxes its value tokens').toBeGreaterThan(0);

  if (ids.cont) {
    await page.evaluate((id) => window.__blkws.getBlockById(id).select(), ids.cont);
    await page.waitForTimeout(120);
    const contThot = await page.evaluate(() => document.querySelectorAll('#blk-gcode .thot').length);
    expect(contThot, 'selecting a container does NOT box values (leaf-scoped, uncluttered)').toBe(0);
  }
});
