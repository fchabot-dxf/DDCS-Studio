import { test, expect } from '@playwright/test';

/**
 * WIZARDS-AS-DATA — t2605 (BACKLOG #71/#72 small item) resolved comm_data's own panel:'commscreen' shape — the
 * LAST unverified panel kind on the board — then migrated onto the declared `split_horizontal`/`group_box`/
 * `field_ref` tree. The container-ID mechanism BACKLOG #77 found broken was NEVER in play here: a standalone
 * `feature_canvas` node already builds the id `commscreen` mode's own code looks up
 * (`formWidgets.js`'s pre-existing single-pane branch, :1648-1663).
 *
 * A DIFFERENT, genuine gap WAS found live: `registerUserOp`'s own self-heal (`userOps.js:1432`,
 * `def.panel = resolvePanelMeta(def)`) re-derives `.panel` from the template's `feature_canvas` node's OWN
 * `params.panel` (`panelFromStack`, userOps.js:350-354) — overriding the `userOpFromStack` constructor
 * argument entirely, not falling back to it. A `feature_canvas` node with empty params silently lost the
 * `'commscreen'` panel the instant the def was registered, dispatching `userOpView.js` into the wrong mode
 * branch (a 3D toolpath mount, for a Communication op). Fixed by giving the node its own `params.panel` —
 * every other migrated op's own `feature_canvas` node already carries this (confirmed by grep, all correct),
 * so this was an isolated authoring slip on THIS op specifically, not a second instance of #77.
 *
 * NOT built on `tests/support/formReproduction.js`'s shared `registerFormReproductionSuite` — `#wiz_comm`
 * (index.html:1103) is a real, still-live classic shell this twin stays unlinked from. Test 2 is a simplified
 * edit-reaches-model check (comm's own emit recomposes from live settings, similar complexity class to
 * homing/atc_table — already covered by `comm-twin.spec.js`). Test 3 is the REAL-SYMPTOM canvas/mock-mount
 * proof (t2603's own standing rule) — the actual defect above would NOT have been caught by a row-diff alone.
 *
 * EXPECTED_ORDER is [...COMM_STRUCT_BINDINGS, ...COMM_VALUESWAP_BINDINGS]' own array order, grouped by section
 * (FEATURE CONTEXT, GEOMETRY, ADVANCED — all three contiguous per this file's own t2401 resection).
 */

const ROW_SELECTOR = '.form-row, .grid-2, .grid-3';
const DATA_MODULE = '/blocks/dataOps/commData.js';
const DEF_FACTORY = 'commDataDef';

const EXPECTED_ORDER = [
  // FEATURE CONTEXT
  'type', 'popupMode', 'statusMode',
  // GEOMETRY
  'val', 'cycle', 'msg',
  // ADVANCED
  'id', 'dest', 'statusColor', 'statusDwell', 'slot1', 'slot2', 'slot3', 'slot4',
];

test('comm-form-reproduction: declared tree places fields in the same structure as the flat form', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async ({ dataModule, defFactory, rowSelector }) => {
    const dd = await import(dataModule);
    const { renderUiTree, formBindings, renderOpForm } = await import('/ui/formWidgets.js');
    const def = dd[defFactory]();
    const binds = formBindings(def);

    const userRoot = def.template.find((b) => b && b.type === 'user_root');
    const tempHost = document.createElement('div');
    const readersFlat = renderOpForm(tempHost, binds) || [];
    const byParam = {};
    tempHost.querySelectorAll('[data-param]').forEach((inp, idx) => {
      if (!inp || !inp.dataset || !inp.dataset.param) return;
      const row = inp.closest(rowSelector) || inp.parentElement;
      byParam[inp.dataset.param] = { row, read: readersFlat[idx] || (() => ({ [inp.dataset.param]: inp.value })) };
    });

    const host = document.createElement('div');
    document.body.appendChild(host);
    const readers = renderUiTree(host, userRoot.uiChildren, def.bindings || [], byParam);

    const fields = [...host.querySelectorAll('[data-param]')].map((el) => el.dataset.param);
    const orphanCount = readers.orphanCount;
    const explicit = fields.slice(0, fields.length - orphanCount);
    const orphans = fields.slice(fields.length - orphanCount).sort();

    return { fields, explicit, orphans, orphanCount, boundParamCount: Object.keys(byParam).length };
  }, { dataModule: DATA_MODULE, defFactory: DEF_FACTORY, rowSelector: ROW_SELECTOR });

  expect(r.orphanCount).toBe(0);
  expect(r.orphans).toEqual([]);
  expect(r.explicit).toEqual(EXPECTED_ORDER);
  expect(r.fields.length).toBe(r.boundParamCount);
});

test('comm-form-reproduction: an edit in the declared tree reaches the op model and comes back', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async (a) => {
    const dd = await import(a.dataModule);
    const { renderUiTree, formBindings, renderOpForm } = await import('/ui/formWidgets.js');

    const def = dd[a.defFactory]();
    const binds = formBindings(def);
    const userRoot = def.template.find((b) => b && b.type === 'user_root');
    const tempHost = document.createElement('div');
    const readersFlat = renderOpForm(tempHost, binds) || [];
    const byParam = {};
    tempHost.querySelectorAll('[data-param]').forEach((inp, idx) => {
      if (!inp || !inp.dataset || !inp.dataset.param) return;
      const row = inp.closest(a.rowSelector) || inp.parentElement;
      byParam[inp.dataset.param] = { row, read: readersFlat[idx] || (() => ({ [inp.dataset.param]: inp.value })) };
    });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const readers = renderUiTree(host, userRoot.uiChildren, def.bindings || [], byParam);

    const before = {};
    for (const read of readers) Object.assign(before, read());

    const editInput = host.querySelector(`[data-param="${a.editParam}"]`);
    editInput.value = a.editValue;
    editInput.dispatchEvent(new Event('input', { bubbles: true }));
    editInput.dispatchEvent(new Event('change', { bubbles: true }));

    const after = {};
    for (const read of readers) Object.assign(after, read());

    return { beforeVal: before[a.editParam], afterVal: after[a.editParam] };
  }, {
    dataModule: DATA_MODULE, defFactory: DEF_FACTORY, rowSelector: ROW_SELECTOR,
    editParam: 'msg', editValue: 'Load the fixture',
  });

  expect(r.afterVal).toBe('Load the fixture');
  expect(r.afterVal).not.toBe(r.beforeVal);
});

test('comm-form-reproduction: REAL SYMPTOM — the live controller-screen mock actually renders (the defect a row diff missed)', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
  await page.evaluate(async () => { const U = await import('/blocks/userOps.js'); const M = await import('/blocks/dataOps/commData.js'); try { U.registerUserOp(M.commDataDef()); } catch (_) {} });
  await page.evaluate(() => window.openWiz('user_comm_data'));
  await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
  await page.waitForTimeout(600);

  const r = await page.evaluate(() => {
    const wizUser = document.getElementById('wiz_user');
    const host = wizUser ? wizUser.querySelector('.comm-screen-host') : null;
    return {
      hasHost: !!host,
      hostVisible: host ? host.offsetParent !== null : false,
      hostHTML: host ? host.innerHTML.slice(0, 200) : null,
      // a WRONG dispatch (into '3d' mode instead) would mount a WebGL canvas here instead of the mock
      canvasCount: wizUser ? wizUser.querySelectorAll('canvas').length : -1,
    };
  });
  expect(r.hasHost, 'the live controller-screen mock host mounts').toBe(true);
  expect(r.hostVisible, 'the mock is actually visible, not hidden').toBe(true);
  expect(r.hostHTML, 'the mock renders real dialog markup').toContain('comm-dialog');
  expect(r.canvasCount, 'NO 3D canvas mounts (would mean the wrong panel-mode branch fired)').toBe(0);
  expect(errs, 'no console errors').toEqual([]);
});
