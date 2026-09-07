import { test, expect } from './support/harness.mjs';

// t1075 Part C — the placed-op → SAVE fork route must produce the SAME opunit sub-stack the Customize (editWizardDef)
// route does, so fork behaviour is ONE-SOURCE regardless of route. Gated on ALL of: recognized + not-already-opunit +
// the body's atom TYPE SEQUENCE still equal to the source exec run. The exposure blockIndex is re-derived BY IDENTITY
// over the wrapped flatten — never a blanket +1, because the shift is NON-UNIFORM (exec children shift, uiChildren
// panel/sim/param_group do NOT).
//
// TIER MIGRATION WORK PACKAGE 4 — moved browser→node: both tests below are plain page.evaluate calls that import app
// modules, call wrapForkAtSave/wrapRecognizedForFork, and assert on plain returned data — no DOM read, no click, no
// screenshot. Both read the REAL surfacing twin via getUserDef('user_surfacing_data'); the node tier's page.goto stub
// never runs app.js's seedDefaultPortedUserOps(), so surfacing is registered explicitly first via createUserOp
// (guarded by an existence check, since node persists module state across tests in one process). The file's remaining
// three tests (the end-to-end placed-op→Blocks→Save flows and the Customize-route gate) drive
// window.ddcsLoadBlockStack/window.ddcsSaveAsWizard/window.ddcsEditWizardDef through the real Blockly workspace with
// page.fill/page.click/page.screenshot — genuine app+DOM dependencies, not candidates for this tier. Split into
// tests/cam-substack-save-fork-drive.spec.js.

test('C unit — THE TRAP: the shift is NON-UNIFORM and every exposure is re-derived BY IDENTITY (a blanket +1 would corrupt a uiChild)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { wrapForkAtSave } = await import('/blocks/devMode.js');
    const { getUserDef, defaultParams, instantiate, flattenBlocks, createUserOp, listUserOps } = await import('/blocks/userOps.js');
    const { surfacingDataDef } = await import('/blocks/dataOps/surfacingData.js');
    // node tier: page.goto doesn't run app.js's seedDefaultPortedUserOps()
    if (!listUserOps().some((d) => d.opType === 'user_surfacing_data')) createUserOp(surfacingDataDef());
    const def = getUserDef('user_surfacing_data');
    const params = defaultParams(def);
    const children = instantiate(def, params);
    const flatBefore = flattenBlocks(children);
    const execIdx = flatBefore.findIndex((b) => b && b.type === 'placeonstock');   // an EXEC atom → shifts
    const uiIdx = flatBefore.findIndex((b) => b && b.type === 'param_group');      // a uiChild → does NOT shift
    const execRef = flatBefore[execIdx], uiRef = flatBefore[uiIdx];
    const a = {
      opRec: { type: 'op', opType: 'user_surfacing_data', params, children },
      exposures: [
        { param: 'ex', blockIndex: execIdx, key: 'offX', default: 0 },
        { param: 'ui', blockIndex: uiIdx, key: 'group', default: '' },
      ],
    };
    const wrapped = wrapForkAtSave(a);
    const flatAfter = flattenBlocks(a.opRec.children);
    const root = a.opRec.children.find((b) => b && b.type === 'user_root');
    return {
      wrapped, execIdxBefore: execIdx, uiIdxBefore: uiIdx,
      execIdxAfter: a.exposures[0].blockIndex, uiIdxAfter: a.exposures[1].blockIndex,
      execResolves: flatAfter[a.exposures[0].blockIndex] === execRef,
      uiResolves: flatAfter[a.exposures[1].blockIndex] === uiRef,
      rootFirstType: ((root.children || [])[0] || {}).type, rootChildCount: (root.children || []).length,
    };
  });
  expect(r.wrapped, 'the wrap fires for an untouched recognized twin body').toBe(true);
  expect(r.rootFirstType, 'the exec run is wrapped in ONE opunit').toBe('opunit');
  expect(r.rootChildCount, 'user_root has exactly one child (the opunit)').toBe(1);
  // THE TRAP, demonstrated: the shift is NON-UNIFORM — a blanket +1 would silently corrupt the uiChild binding
  expect(r.execIdxAfter, 'an EXEC atom shifts by exactly one (the opunit precedes it)').toBe(r.execIdxBefore + 1);
  expect(r.uiIdxAfter, 'a uiChild (param_group) does NOT shift — a blanket +1 would corrupt it').toBe(r.uiIdxBefore);
  // …and both still resolve to the very same block RECORDS (identity, not arithmetic)
  expect(r.execResolves, 'the exec exposure resolves to the SAME block record').toBe(true);
  expect(r.uiResolves, 'the uiChild exposure resolves to the SAME block record').toBe(true);
});

test('C unit — the gates: not-recognized / already-opunit / atom added → NO wrap (save universal exactly as today)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { wrapForkAtSave, wrapRecognizedForFork } = await import('/blocks/devMode.js');
    const { getUserDef, defaultParams, instantiate, flattenBlocks, userOpFromStack, registerUserOp, createUserOp, listUserOps } = await import('/blocks/userOps.js');
    const { surfacingDataDef } = await import('/blocks/dataOps/surfacingData.js');
    // node tier: page.goto doesn't run app.js's seedDefaultPortedUserOps()
    if (!listUserOps().some((d) => d.opType === 'user_surfacing_data')) createUserOp(surfacingDataDef());
    const def = getUserDef('user_surfacing_data');
    const params = defaultParams(def);
    const mk = (children, opType = 'user_surfacing_data', p = params) => ({ opRec: { type: 'op', opType, params: p, children }, exposures: [] });
    // (1) NOT recognized — a genuine universal custom op
    registerUserOp(userOpFromStack('c_gate_uni', 'Uni', [{ type: 'user_root', params: {}, children: [{ type: 'feed', params: { rate: 210 } }] }], []));
    const uniDef = getUserDef('user_c_gate_uni');
    const uni = mk(instantiate(uniDef, defaultParams(uniDef)), 'user_c_gate_uni', defaultParams(uniDef));
    const uniWrapped = wrapForkAtSave(uni);
    // (2) ALREADY opunit (the editWizardDef route) — must NOT double-wrap
    const already = mk(wrapRecognizedForFork(def).template);
    const alreadyWrapped = wrapForkAtSave(already);
    const alreadyNested = flattenBlocks(already.opRec.children).filter((b) => b && b.type === 'opunit').length;
    // (3) an ATOM ADDED to the exec run — un-identifiable → no wrap
    const edited = mk(instantiate(def, params));
    edited.opRec.children.find((b) => b.type === 'user_root').children.push({ type: 'feed', params: { rate: 300 } });
    const editedWrapped = wrapForkAtSave(edited);
    // (4) a hand-built bare stack (no opType) → never a fork
    const bare = mk([{ type: 'feed', params: { rate: 100 } }], null, {});
    const bareWrapped = wrapForkAtSave(bare);
    return { uniWrapped, alreadyWrapped, alreadyNested, editedWrapped, bareWrapped };
  });
  expect(r.uniWrapped, 'a genuine universal custom op is NOT wrapped').toBe(false);
  expect(r.alreadyWrapped, 'an already-opunit body (the Customize route) is NOT re-wrapped').toBe(false);
  expect(r.alreadyNested, 'exactly ONE opunit remains — never double-wrapped').toBe(1);
  expect(r.editedWrapped, 'an added atom makes the standard run un-identifiable → NOT wrapped (no shape-inference)').toBe(false);
  expect(r.bareWrapped, 'a hand-built bare stack (no opType) is NOT wrapped').toBe(false);
});
