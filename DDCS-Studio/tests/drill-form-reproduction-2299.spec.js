import { test, expect } from '@playwright/test';

/**
 * WIZARDS-AS-DATA — the arc's payoff (t2299). drill's `uiChildren` tree (blocks/dataOps/drillData.js,
 * `drillDataStack`) is declared to reproduce `#wiz_drill`'s hardcoded shell (index.html:326-433)
 * structurally — same section order, same field order, same PATTERN-group grouping (grid/circle/rect/
 * line), same "no section wrapper" treatment for HOLE Ø/PECK. This pins that structure as a regression
 * tripwire, independent of whether/when `hasTreeLayout()` ever flips drill's live render path (it does
 * not today — the tree has no `split_*` node, confirmed in the header comment above `drillDataStack`).
 *
 * Three things get asserted on an axis independent of "it rendered without throwing" (the green-test-
 * over-a-dead-path failure this project has hit twice, [[green-tests-over-a-dead-ui-path]]):
 *   1. STRUCTURE — the tree's own explicitly-placed field order matches the shell's, exactly.
 *   2. THE ORPHAN NET — formWidgets.js's own "fallback safety" (t1561) auto-appends any bound param the
 *      tree never placed. drill's bindings include 9 params with NO shell-visible equivalent (x0/y0/
 *      entryX/entryY/material: twin-only, no shell field ever existed; stockDatum/stockW/stockH/stockZ:
 *      formHidden, invisible either way). Left unasserted, a NEW binding added later that the tree
 *      forgets to place would silently join this same fallback and never be noticed. Pinning the exact
 *      set turns that into a red test instead.
 *   3. WORDING — usage blurb, section titles and the code-preview tag are compared against the LIVE
 *      shell's own rendered text (opened for real via `window.openWiz('drill')`), not a hand-copied
 *      string, so this test can't drift out of sync with the shell the way a copied fact would.
 *
 * Per-field LABEL text is deliberately NOT compared byte-for-byte against the shell's bespoke old
 * wording ("HOLE COUNT" vs the binding's own `label: 'Count'`) — DRILL_BINDING_SPECS' labels are the
 * one already-established convention shared by every other consumer of these bindings (macro/token
 * docs, the flat-mode form), and rewriting 20+ of them to match one shell's historical wording is a
 * separate, broader change than this turn's own scope. Filed, not fixed — same pattern as the d_tool /
 * `count` decisions already logged in drillDataStack's own header comment.
 */

const EXPECTED_ORDER = [
  // PATTERN section — geometryGroup
  'pattern', 'skip', 'originX', 'originY', 'offZ',
  'stockAttach', 'pathDatum',   // path_anchor: re-parented, hidden rows (order fixed by formWidgets.js's own loop)
  'wcs',
  // gridGroup
  'cols', 'rows', 'dx', 'dy',
  // circleGroup ('count' declared once here — shared with line, see drillDataStack's header comment)
  'dia', 'count', 'startAngle',
  // rectGroup
  'w', 'h', 'nx', 'ny',
  // lineGroup
  'spacing', 'angle',
  // TOOL section
  'toolNum', 'rpm',
  // HOLE Ø / PECK — no section wrapper (the shell's own METHOD label is unconditionally hidden, t2297)
  'holeDia',
  'peck',
  // DEPTH & FEED section
  'depth', 'clearance', 'feed',
];

// Twin-only bindings with no shell-visible equivalent — caught by formWidgets.js's own orphan fallback
// rather than placed by the tree. See the file header above for why each one is legitimately here.
const EXPECTED_ORPHANS = ['x0', 'y0', 'entryX', 'entryY', 'material', 'stockDatum', 'stockW', 'stockH', 'stockZ'].sort();

test('drill-form-reproduction: declared tree places fields in the same structure as the shell', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async () => {
    const dd = await import('/blocks/dataOps/drillData.js');
    const { renderUiTree, formBindings, renderOpForm } = await import('/ui/formWidgets.js');
    const def = dd.drillDataDef();
    const userRoot = def.template.find(b => b && b.type === 'user_root');

    // Mirror userOpView.js's own tree-mode render() exactly (lines ~377-384): flat bindings render into
    // a scratch host first (the byParam source), then the tree walks it.
    const binds = formBindings(def);
    const tempHost = document.createElement('div');
    const readersFlat = renderOpForm(tempHost, binds) || [];
    const byParam = {};
    tempHost.querySelectorAll('[data-param]').forEach((inp, idx) => {
      if (!inp || !inp.dataset || !inp.dataset.param) return;
      const row = inp.closest('.form-row') || inp.closest('.grid-2') || inp.parentElement;
      byParam[inp.dataset.param] = { row, read: readersFlat[idx] || (() => ({ [inp.dataset.param]: inp.value })) };
    });

    const host = document.createElement('div');
    document.body.appendChild(host);
    const readers = renderUiTree(host, userRoot.uiChildren, def.bindings || [], byParam);

    const fields = [...host.querySelectorAll('[data-param]')].map(el => el.dataset.param);
    const orphanCount = readers.orphanCount;
    const explicit = fields.slice(0, fields.length - orphanCount);
    const orphans = fields.slice(fields.length - orphanCount).sort();

    return { fields, explicit, orphans, orphanCount, boundParamCount: Object.keys(byParam).length };
  });

  expect(r.orphanCount).toBe(EXPECTED_ORPHANS.length);
  expect(r.orphans).toEqual(EXPECTED_ORPHANS);
  expect(r.explicit).toEqual(EXPECTED_ORDER);
  expect(r.fields.length).toBe(r.boundParamCount);   // every bound param placed exactly once — nothing dropped
});

test('drill-form-reproduction: usage text, section titles and code-preview tag match the live shell', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  // Open the real wizard (the command-deck's own gesture) so the shell's post-JS state — METHOD's
  // section-label unconditionally hidden by drillView.js's applyVariant() — is what gets compared.
  await page.evaluate(() => window.openWiz('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });

  const shell = await page.evaluate(() => {
    // Scope to .wiz-controls: .wiz-visual carries its own "VISUALIZATION" .section-label for the 2D/3D
    // pane, a different concern from the form's own PATTERN/TOOL/DEPTH & FEED sections this tree reproduces.
    const root = document.querySelector('#wiz_drill .wiz-controls');
    const usage = root.querySelector('.wiz-usage')?.textContent || '';
    const codeLabel = root.querySelector('.preview-block .label')?.textContent.replace(/\s+/g, ' ').trim() || '';
    const sectionTitles = [...root.querySelectorAll('.section-label')]
      .filter(el => el.offsetParent !== null)   // visible only — excludes METHOD, hidden by applyVariant()
      .map(el => el.textContent);
    return { usage, codeLabel, sectionTitles };
  });

  const tree = await page.evaluate(async () => {
    const dd = await import('/blocks/dataOps/drillData.js');
    const { renderUiTree, formBindings, renderOpForm } = await import('/ui/formWidgets.js');
    const def = dd.drillDataDef();
    const userRoot = def.template.find(b => b && b.type === 'user_root');
    const binds = formBindings(def);
    const tempHost = document.createElement('div');
    const readersFlat = renderOpForm(tempHost, binds) || [];
    const byParam = {};
    tempHost.querySelectorAll('[data-param]').forEach((inp, idx) => {
      if (!inp || !inp.dataset || !inp.dataset.param) return;
      const row = inp.closest('.form-row') || inp.closest('.grid-2') || inp.parentElement;
      byParam[inp.dataset.param] = { row, read: readersFlat[idx] || (() => ({ [inp.dataset.param]: inp.value })) };
    });
    const host = document.createElement('div');
    document.body.appendChild(host);
    renderUiTree(host, userRoot.uiChildren, def.bindings || [], byParam);
    const usage = host.querySelector('.wiz-usage')?.textContent || '';
    const codeLabel = host.querySelector('.preview-block .label')?.textContent.replace(/\s+/g, ' ').trim() || '';
    const sectionTitles = [...host.querySelectorAll('.form-sec-title')].map(el => el.textContent);
    return { usage, codeLabel, sectionTitles };
  });

  expect(tree.usage).toBe(shell.usage);
  expect(tree.codeLabel).toBe(shell.codeLabel);
  expect(tree.sectionTitles).toEqual(shell.sectionTitles);
});

test('drill-form-reproduction: an edit in the declared tree reaches the op model and comes back', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async () => {
    const dd = await import('/blocks/dataOps/drillData.js');
    const { renderUiTree, formBindings, renderOpForm } = await import('/ui/formWidgets.js');
    const { drillStack } = await import('/wizards/drillWizard.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitEquivalence } = await import('/blocks/dataOps/equivalence.js');

    const def = dd.drillDataDef();
    registerUserOp(def);
    const dataBuilder = builderOf(dd.DRILL_DATA_OPTYPE);   // === instantiate(def, params) — the SAME path a real save uses

    const userRoot = def.template.find(b => b && b.type === 'user_root');
    const binds = formBindings(def);
    const tempHost = document.createElement('div');
    const readersFlat = renderOpForm(tempHost, binds) || [];
    const byParam = {};
    tempHost.querySelectorAll('[data-param]').forEach((inp, idx) => {
      if (!inp || !inp.dataset || !inp.dataset.param) return;
      const row = inp.closest('.form-row') || inp.closest('.grid-2') || inp.parentElement;
      byParam[inp.dataset.param] = { row, read: readersFlat[idx] || (() => ({ [inp.dataset.param]: inp.value })) };
    });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const readers = renderUiTree(host, userRoot.uiChildren, def.bindings || [], byParam);

    // WRITE: default render, edit the DEPTH field's real DOM input the way a user would, read it back
    // through the SAME aggregation userOpView.js itself uses (_readers.map(read) → Object.assign, lines
    // ~452/799) to gather the params it writes onto the op before building.
    const before = {};
    for (const read of readers) Object.assign(before, read());

    const depthInput = host.querySelector('[data-param="depth"]');
    depthInput.value = '17.5';
    depthInput.dispatchEvent(new Event('input', { bubbles: true }));
    depthInput.dispatchEvent(new Event('change', { bubbles: true }));

    const after = {};
    for (const read of readers) Object.assign(after, read());

    // COMES BACK: feed the edited param set through the ACTUAL build path (dataBuilder === instantiate(def,…))
    // and confirm the emitted G-code is byte-identical to the hand-coded reference builder fed the SAME edited
    // params — the edit didn't just change a JS object, it changed what the twin actually cuts, proven against
    // the same equivalence harness drill-as-data.spec.js uses.
    const base = { ...dd.DRILL_DEFAULTS, spindle: (window.ddcsGetSettings && window.ddcsGetSettings().spindle) || {} };
    const emitParams = { ...base, ...after };
    const eq = emitEquivalence(drillStack, dataBuilder, [emitParams]);

    return {
      beforeDepth: Number(before.depth),
      afterDepth: Number(after.depth),
      eqPass: eq.pass,
      firstDiff: eq.firstDiff,
    };
  });

  expect(r.beforeDepth).toBe(5);          // DRILL_DEFAULTS.depth
  expect(r.afterDepth).toBe(17.5);        // the edit reached the model via the tree's own readers
  expect(r.eqPass).toBe(true);            // …and the edited value drives the SAME emitted G-code as the reference builder
});
