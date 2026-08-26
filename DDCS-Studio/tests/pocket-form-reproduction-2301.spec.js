import { test, expect } from '@playwright/test';

/**
 * WIZARDS-AS-DATA — the arc's SECOND `uiChildren` reproduction (t2301), after drill (t2299). Pocket's tree
 * (blocks/dataOps/pocketData.js, `pocketDataStack`) reproduces `#wiz_pocket`'s hardcoded shell (index.html:
 * 463-541) structurally — same section order, same field order, same per-shape grouping (rect w/h vs circle/
 * polygon dia+sides). Pinned here on the same three independent axes drill's own reproduction test uses
 * (structure+orphan set / live-shell wording / an edit reaching the real emit path), so this test compares
 * tree vs shell rather than tree vs a hardcoded list and cannot pass vacuously.
 *
 * Pocket was deliberately chosen over a second drill-shaped twin BECAUSE it has a real shape-type switch
 * (rect/circle/polygon/ellipse show different dimension fields) — but the gate found the dispatched mechanism
 * (guard/whenGuard) does not apply: POCKET_BINDING_SPECS already carries a per-FIELD `when` clause for every
 * shape-conditional param (the exact mechanism drill's own pattern-switch groups already used, t2299), so the
 * tree places rectDimGroup/circleDimGroup as plain always-present grid_containers and lets each field's own
 * binding-level `when` decide visibility — no guard/pruneGuards involvement, mirroring pocketData.js's own
 * header comment for the full account.
 */

const EXPECTED_ORDER = [
  // SHAPE section — shapeGroup
  'shape', 'strategy', 'originX', 'originY', 'offZ',
  'stockAttach', 'pathDatum',   // path_anchor: re-parented, hidden rows (order fixed by formWidgets.js's own loop)
  // rectDimGroup
  'w', 'h',
  // circleDimGroup
  'dia', 'sides',
  // TOOL section
  'toolNum', 'rpm',
  // TOOL & STEPOVER section
  'toolDia', 'stepoverPct', 'wallOffset',
  // DEPTH & FEED section
  'depth', 'stepdown', 'clearance', 'wcs', 'feed', 'plunge',
];

// Bindings with no shell-visible equivalent at all — caught by formWidgets.js's own orphan fallback rather
// than placed by the tree. Confirmed by grepping index.html AND pocketView.js for every one of these ids —
// zero hits either place, not assumed. See pocketData.js's own header comment for the full account.
const EXPECTED_ORPHANS = [
  'stockDatum', 'stockW', 'stockH', 'stockZ',                        // formHidden, invisible either way
  'direction', 'entry', 'rampAngle', 'helixDia', 'helixPitch',       // DEPTH ENTRY cluster — no shell UI ever
  'restTool', 'restDia', 'restStepover',                              // REST MACHINING cluster — no shell UI ever
  'material',                                                         // feedsuggest — same orphan class as drill's
  'passes', 'confirmEvery', 'entryX', 'entryY',
].sort();

test('pocket-form-reproduction: declared tree places fields in the same structure as the shell', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async () => {
    const pd = await import('/blocks/dataOps/pocketData.js');
    const { renderUiTree, formBindings, renderOpForm } = await import('/ui/formWidgets.js');
    const def = pd.pocketDataDef();
    const userRoot = def.template.find(b => b && b.type === 'user_root');

    const binds = formBindings(def);
    const tempHost = document.createElement('div');
    const readersFlat = renderOpForm(tempHost, binds) || [];
    const byParam = {};
    tempHost.querySelectorAll('[data-param]').forEach((inp, idx) => {
      if (!inp || !inp.dataset || !inp.dataset.param) return;
      const row = inp.closest('.form-row') || inp.closest('.grid-2') || inp.closest('.grid-3') || inp.parentElement;
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

test('pocket-form-reproduction: usage text, section titles and code-preview tag match the live shell', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  await page.evaluate(() => window.openWiz('pocket'));
  await page.waitForSelector('#wiz_pocket', { state: 'visible' });

  const shell = await page.evaluate(() => {
    // Scope to .wiz-controls: .wiz-visual carries its own "VISUALIZATION" .section-label for the 2D/3D pane,
    // a different concern from the form's own SHAPE/TOOL/TOOL & STEPOVER/DEPTH & FEED sections.
    const root = document.querySelector('#wiz_pocket .wiz-controls');
    const usage = root.querySelector('.wiz-usage')?.textContent || '';
    const codeLabel = root.querySelector('.preview-block .label')?.textContent.replace(/\s+/g, ' ').trim() || '';
    const sectionTitles = [...root.querySelectorAll('.section-label')]
      .filter(el => el.offsetParent !== null)
      .map(el => el.textContent);
    return { usage, codeLabel, sectionTitles };
  });

  const tree = await page.evaluate(async () => {
    const pd = await import('/blocks/dataOps/pocketData.js');
    const { renderUiTree, formBindings, renderOpForm } = await import('/ui/formWidgets.js');
    const def = pd.pocketDataDef();
    const userRoot = def.template.find(b => b && b.type === 'user_root');
    const binds = formBindings(def);
    const tempHost = document.createElement('div');
    const readersFlat = renderOpForm(tempHost, binds) || [];
    const byParam = {};
    tempHost.querySelectorAll('[data-param]').forEach((inp, idx) => {
      if (!inp || !inp.dataset || !inp.dataset.param) return;
      const row = inp.closest('.form-row') || inp.closest('.grid-2') || inp.closest('.grid-3') || inp.parentElement;
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

test('pocket-form-reproduction: an edit in the declared tree reaches the op model and comes back', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async () => {
    const pd = await import('/blocks/dataOps/pocketData.js');
    const { renderUiTree, formBindings, renderOpForm } = await import('/ui/formWidgets.js');
    const { pocketStack } = await import('/wizards/pocketWizard.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitEquivalence } = await import('/blocks/dataOps/equivalence.js');

    const def = pd.pocketDataDef();
    const dataBuilder = builderOf(pd.POCKET_DATA_OPTYPE);   // pocket_data is registered at app boot — no explicit registerUserOp needed (matches tests/pocket-data-emit.spec.js's own convention)

    const userRoot = def.template.find(b => b && b.type === 'user_root');
    const binds = formBindings(def);
    const tempHost = document.createElement('div');
    const readersFlat = renderOpForm(tempHost, binds) || [];
    const byParam = {};
    tempHost.querySelectorAll('[data-param]').forEach((inp, idx) => {
      if (!inp || !inp.dataset || !inp.dataset.param) return;
      const row = inp.closest('.form-row') || inp.closest('.grid-2') || inp.closest('.grid-3') || inp.parentElement;
      byParam[inp.dataset.param] = { row, read: readersFlat[idx] || (() => ({ [inp.dataset.param]: inp.value })) };
    });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const readers = renderUiTree(host, userRoot.uiChildren, def.bindings || [], byParam);

    // WRITE: default render, edit the DEPTH field's real DOM input the way a user would, read it back through
    // the SAME aggregation userOpView.js itself uses (_readers.map(read) → Object.assign).
    const before = {};
    for (const read of readers) Object.assign(before, read());

    const depthInput = host.querySelector('[data-param="depth"]');
    depthInput.value = '17.5';
    depthInput.dispatchEvent(new Event('input', { bubbles: true }));
    depthInput.dispatchEvent(new Event('change', { bubbles: true }));

    const after = {};
    for (const read of readers) Object.assign(after, read());

    // COMES BACK: feed the edited param set through the ACTUAL build path and confirm the emitted G-code is
    // byte-identical to the hand-coded reference builder fed the SAME edited params.
    const base = { shape: 'rect', w: 80, h: 60, spindle: (window.ddcsGetSettings && window.ddcsGetSettings().spindle) || {} };
    const emitParams = { ...base, ...after };
    const eq = emitEquivalence(pocketStack, dataBuilder, [emitParams]);

    return {
      beforeDepth: Number(before.depth),
      afterDepth: Number(after.depth),
      eqPass: eq.pass,
      firstDiff: eq.firstDiff,
    };
  });

  expect(r.beforeDepth).toBe(4);          // POCKET_DEFAULTS.depth
  expect(r.afterDepth).toBe(17.5);        // the edit reached the model via the tree's own readers
  expect(r.eqPass).toBe(true);            // …and the edited value drives the SAME emitted G-code as the reference builder
});
