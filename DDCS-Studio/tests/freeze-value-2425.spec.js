import { test, expect } from '@playwright/test';

/**
 * t2425 (BACKLOG #41 — FREEZE) — the owner-designed third state between KNOB (in form, emits) and DISABLED (not
 * in form, does not emit): FROZEN (not in form, still emits — "a shop's fixed value"). Blocked on BACKLOG #23
 * (persisted disable) since August; buildable for the first time now that #23 shipped (t2415).
 *
 * ⛔ DISABLE ≠ FREEZE, the owner's own correction: disable means "it does not happen"; freeze means "it still
 * happens, you just stop being asked." `frozen` is a declared property of the OP's own `params` (never Blockly
 * block state — that is #23's whole lesson: `opFromMarker` regenerates children from params, so anything living
 * only on the block is forgotten on reload). `collapsed` (a native Blockly property) is a DERIVED visual this
 * turn applies FROM `params.frozenParams`, never the other way — a human collapsing some unrelated block via
 * Blockly's own native "Collapse Block" stays exactly that, an ordinary canvas tidy, not a frozen param.
 *
 * THE GESTURE lives in the SAME "Block options…" submenu t2387 built and t2423 fixed — "❄ Freeze value" /
 * "❄ Unfreeze value", gated on the block's own declared `param` field (formfield/param_field/field_ref), not
 * on whether a row currently exists (freezing removes the row by design — gating on row-existence would make
 * the menu item vanish the instant it's used, with no way back to unfreeze).
 *
 * ⚠ ESTABLISHED LIVE, not assumed: a normally PLACED op's own canvas shows NO formfield/param_field blocks at
 * all (they only materialize in the "Customize as blocks" authoring canvas, `window.ddcsEditWizardDef`) — so
 * that is the reachable path for this gesture today, matching the dispatch's own hazard example ("freezing
 * depth at 6mm and forking that wizard"). The Customize flow never calls `view.setForm(params)` (it renders
 * straight off the live canvas template), so a SEPARATE `view.setFrozen(list)` carries the frozen set into the
 * form there, deliberately NOT reusing `_seed` (which would also start overriding binding defaults from the
 * op's current params — a real behavior change outside freeze's own scope).
 */

async function bootCustomize(page, opType = 'user_corner_data') {
  await page.goto('/');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => !!window.__blkws);
  await page.waitForFunction(() => !!window.ddcsEditWizardDef);
  await page.evaluate((t) => { window.ddcsEditWizardDef(t); }, opType);
  let last = -1;
  for (let i = 0; i < 160; i++) {
    const n = await page.evaluate(() => window.__blkws.getAllBlocks(false).length);
    if (n === last && n > 0) break;
    last = n;
    await page.waitForTimeout(200);
  }
  // t2425 (de-sleep) — REAL conditions in place of the flat 2000ms "settle": `[data-param]` is the live form's
  // own DOM-observable seeding signal (blocksApp.js itself queries this same selector to resolve a param row —
  // see its t2397/t1748 comments), and `__ddcsEditPerf().pending` is the app's own declared signal for "no
  // deferred preview recompute is in flight" (reproject()'s schedulePreview/RECOMPUTE_MS quiescence timer) —
  // the SAME signal blocks-edit-lag-788.spec.js already polls this way. Both must be true before a right-click
  // is safe: a context menu opened while the recompute is still pending can have its own DOM wiped out by the
  // resulting re-render (see this file's header).
  await page.waitForSelector('[data-param]', { timeout: 5000 });
  await page.waitForFunction(() => window.__ddcsEditPerf && !window.__ddcsEditPerf().pending, null, { timeout: 5000 });
}

// t2631 — corner now declares `field_ref` rows (group_box), not `param_field` — the same FROZEN_MARKER_TYPES
// set blocksApp.js's own boundParamOf uses (userOps.js:1154), not just this test's original 'param_field'.
async function paramFieldBlockId(page, param) {
  return page.evaluate((p) => window.__blkws.getAllBlocks(false).find((b) => (b.type === 'param_field' || b.type === 'field_ref') && b.getFieldValue('PARAM') === p).id, param);
}

test.use({ viewport: { width: 1600, height: 1000 } });

test('unit: freezing a param leaves emit byte-identical, and instantiate() marks the right leaf collapsed', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const { getUserDef, instantiate, defaultParams } = await import('/blocks/userOps.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { childrenOf } = await import('/blocks/userOps.js');
    const def = getUserDef('user_corner_data');
    const base = defaultParams(def);
    const unfrozenTree = instantiate(def, base);
    const frozenTree = instantiate(def, { ...base, frozenParams: ['radius'] });
    // t2631 — childrenOf (not a bare `for...of`), same ARCHITECTURE.md INVARIANT #18 fix corner-wall-collapse-
    // 1664's own strip() needed: children/uiChildren can be a mouth-keyed {LEFT,RIGHT} object, not always an
    // array — corner's own split_horizontal (new this migration) is what first exercises this helper against one.
    const findNode = (nodes, param) => {
      for (const b of childrenOf(nodes)) {
        if (!b) continue;
        if ((b.type === 'param_field' || b.type === 'field_ref') && b.params && b.params.param === param) return b;
        const found = findNode(b.children, param) || findNode(b.uiChildren, param);
        if (found) return found;
      }
      return null;
    };
    return {
      gcodeIdentical: emitMapped(unfrozenTree).text === emitMapped(frozenTree).text,
      unfrozenCollapsed: !!(findNode(unfrozenTree, 'radius') || {}).collapsed,
      frozenCollapsed: !!(findNode(frozenTree, 'radius') || {}).collapsed,
      // an UNRELATED param's own leaf must stay untouched by freezing radius
      otherParamCollapsed: !!(findNode(frozenTree, 'travelDist') || {}).collapsed,
    };
  });
  expect(r.gcodeIdentical, 'freeze never touches emit — "still happens, you just stop being asked"').toBe(true);
  expect(r.unfrozenCollapsed, 'not frozen by default').toBe(false);
  expect(r.frozenCollapsed, 'the frozen param\'s own placing leaf is marked collapsed').toBe(true);
  expect(r.otherParamCollapsed, 'an unrelated param is untouched').toBe(false);
});

test('unit: the FULL round-trip through opFromMarker — a reload reconstructs the identical frozen visual', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const { opFromMarker } = await import('/blocks/programModel.js');
    const { defaultParams, getUserDef, childrenOf } = await import('/blocks/userOps.js');
    const def = getUserDef('user_corner_data');
    const params = { ...defaultParams(def), frozenParams: ['radius'] };
    const op = opFromMarker('user_corner_data', params);
    // t2631 — childrenOf, same INVARIANT #18 fix as the test above.
    const findNode = (nodes, param) => {
      for (const b of childrenOf(nodes)) {
        if (!b) continue;
        if ((b.type === 'param_field' || b.type === 'field_ref') && b.params && b.params.param === param) return b;
        const found = findNode(b.children, param) || findNode(b.uiChildren, param);
        if (found) return found;
      }
      return null;
    };
    const node = findNode(op.children, 'radius');
    return { framedFrozenParams: op.params.frozenParams, nodeCollapsed: node ? !!node.collapsed : null };
  });
  expect(r.framedFrozenParams, 'frozenParams itself survives the marker round-trip, same as any other param').toEqual(['radius']);
  expect(r.nodeCollapsed, 'a FRESH reimport (not a live toggle) independently reconstructs the same collapsed visual').toBe(true);
});

/**
 * t2425 — the live "renderLiveForm → setFrozen → render()" wiring, exercised WITHOUT the canvas right-click
 * gesture. ⚠ ESTABLISHED LIVE (not assumed): driving the actual right-click → hover "Block options…" → click
 * "Freeze value" sequence against this specific canvas proved GENUINELY UNRELIABLE in this harness — it fails
 * inconsistently even alone, with generous waits and Playwright's own retries, in a way the SAME multi-step
 * gesture is proven reliable for elsewhere in this codebase (`blocks-context-flyout-2411.spec.js`, t2411/
 * t2417/t2419/t2423 — the ONLY structural difference here is Corner's own template being large: 16 param_field
 * rows chained in one long "next" stack, each block's OWN `getSvgRoot()` reporting the WHOLE remaining chain's
 * bounding box, not a tight per-row one). Rather than ship a flaky permanent test asserting the wrong thing
 * green, this drives the IDENTICAL code path `toggleFreeze` (blocksApp.js) itself uses — patch the op's own
 * `.data.params.frozenParams`, read the live workspace back via `workspaceToStack` (NOT
 * `window.ddcsGetBlockProgram()`, which is programModel.js's own CACHED stack and would just reload the
 * stale pre-patch value — only reproject()'s own `setStack` call refreshes that cache, and this test
 * deliberately bypasses the gesture that calls it), then `window.ddcsLoadBlockStack` to route through the SAME
 * render pipeline — and verifies the row correctly drops/restores. The MENU ITEM's own existence and label are
 * still checked directly against the DOM (no click) in the test below, so this doesn't paper over the gesture's
 * own wiring either.
 */
test('live: freezing (via the same .data.params.frozenParams the gesture writes) drops the row; unfreezing restores it', async ({ page }) => {
  await bootCustomize(page);
  const before = await page.evaluate(() => !!document.querySelector('[data-param="radius"]'));
  expect(before, 'the row exists before freezing').toBe(true);
  const radiusId = await paramFieldBlockId(page, 'radius');

  const frozen = await page.evaluate(async (id) => {
    // t2425 — NOT window.ddcsGetBlockProgram(): that reads programModel.js's own CACHED stack, which a raw
    // `.data` mutation on the live workspace block never updates (only reproject()'s explicit
    // `setStack(workspaceToStack(ws), ...)` does, and this test deliberately bypasses the canvas gesture that
    // calls it). Reading the cache back here would reload the STALE pre-patch stack and silently erase the
    // patch. `workspaceToStack(ws)` reads the live workspace directly instead — the same call reproject() itself
    // makes.
    const { workspaceToStack } = await import('/blocks/blockly/stackBridge.js');
    const ws = window.__blkws;
    const opBlk = ws.getTopBlocks(false)[0];
    const meta = JSON.parse(opBlk.data || '{}');
    meta.params = { ...(meta.params || {}), frozenParams: ['radius'] };
    opBlk.data = JSON.stringify(meta);
    ws.getBlockById(id).setCollapsed(true);
    window.ddcsLoadBlockStack(workspaceToStack(ws));
    return true;
  }, radiusId);
  expect(frozen).toBe(true);
  await page.waitForFunction(() => !document.querySelector('[data-param="radius"]'), null, { timeout: 5000 });
  const collapsedAfterReload = await page.evaluate((id) => {
    const blk = window.__blkws.getAllBlocks(false).find((b) => (b.type === 'param_field' || b.type === 'field_ref') && b.getFieldValue('PARAM') === 'radius');
    return blk ? blk.isCollapsed() : null;
  }, radiusId);
  expect(collapsedAfterReload, 'a full reload through ddcsLoadBlockStack independently reconstructs the collapsed visual too').toBe(true);

  const unfrozen = await page.evaluate(async () => {
    const { workspaceToStack } = await import('/blocks/blockly/stackBridge.js');
    const ws = window.__blkws;
    const opBlk = ws.getTopBlocks(false)[0];
    const meta = JSON.parse(opBlk.data || '{}');
    meta.params = { ...(meta.params || {}), frozenParams: [] };
    opBlk.data = JSON.stringify(meta);
    window.ddcsLoadBlockStack(workspaceToStack(ws));
    return true;
  });
  expect(unfrozen).toBe(true);
  await page.waitForFunction(() => !!document.querySelector('[data-param="radius"]'), null, { timeout: 5000 });
});

/**
 * t2425 — the registry-level equivalent of the full right-click → hover → click chain above. The DOM chain
 * itself proved genuinely unreliable against Corner's 16-row chained canvas even alone with retries (established
 * live, see the comment on the "live:" test above) — traced to the native Blockly context menu tearing its own
 * DOM down BEFORE `ddcsBlockOptions`'s registered `callback` runs (blocksApp.js's own comment on that callback),
 * so the callback reads a rect CACHED by a MutationObserver at paint time (`window.__ddcsBlockOptionsRowRect`)
 * rather than anything live in the DOM at click time. That means the callback itself — the REAL, production
 * `itemsFor(scope.block)` call that decides what the submenu offers — can be exercised directly by calling it
 * off Blockly's own `ContextMenuRegistry` with a synthetic cached rect, with NO right-click, no hover-timing
 * race, and no dependence on this canvas's own chained-block layout quirks. This is the SAME registry entry a
 * real click, tap, or keyboard Enter activates (blocksApp.js: "the ONE activation path" — id 'ddcsBlockOptions').
 */
test('the gesture itself: "❄ Freeze value" is offered on a param_field block, alongside (not replacing) "Disable Block"', async ({ page }) => {
  await bootCustomize(page);
  const radiusId = await paramFieldBlockId(page, 'radius');
  const r = await page.evaluate(async (id) => {
    const blk = window.__blkws.getBlockById(id);
    const box = blk.getField('PARAM').getSvgRoot().getBoundingClientRect();
    window.__ddcsBlockOptionsRowRect = { left: box.x, right: box.x + box.width, top: box.y, bottom: box.y + box.height, width: box.width, height: box.height };
    const item = window.Blockly.ContextMenuRegistry.registry.getItem('ddcsBlockOptions');
    item.callback({ block: blk });
    await new Promise((res) => setTimeout(res, 50));
    const m = document.querySelector('.op-ctx-menu');
    return m ? Array.from(m.children).map((c) => c.textContent) : null;
  }, radiusId);
  expect(r, 'the submenu opens off the registry callback directly').not.toBeNull();
  expect(r, 'the submenu offers Freeze value for a param-bound block').toContain('❄ Freeze value');
  expect(r, 'the native "Disable Block" row lives on Blockly\'s own top-level menu, not this submenu — freeze only ADDS an entry here').not.toContain('Disable Block');
});
