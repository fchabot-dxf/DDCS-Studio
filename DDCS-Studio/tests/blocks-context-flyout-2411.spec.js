import { test, expect } from '@playwright/test';

/**
 * t2411 (BACKLOG #52) — "Block ▸" becomes a real Explorer-style CASCADE: the flyout hangs off the "Block
 * options…" row Blockly's own native context menu renders, opening on hover (small delay), with the parent
 * menu staying open beside it — a positioning upgrade of the SAME popup t2387 already built (ui/opContextMenu.js),
 * not a rebuild. Covers the shared trigger mechanism directly (opContextMenu.js exports it standalone, so this
 * doesn't need Blockly's own menu machinery to exercise the timing/positioning logic), then one real end-to-end
 * pass through an actual Blockly-rendered row, then a regression check that an ORDINARY row (Duplicate) is
 * completely untouched by the new wiring.
 *
 * ⛔ t2417 (BACKLOG #52 REOPENED) — NARROWED. `wireFlyoutTrigger` used to also intercept click/touchend on the
 * row itself, trying to make those trigger the SAME cascade while suppressing Blockly's own native activation
 * of the row. Proved live that this did not work against the REAL Blockly-rendered row (only against a
 * synthetic stand-in, which is why it read as passing here): `stopPropagation()` cannot stop a sibling listener
 * already bound to the same DOM node, and Blockly binds its own click/tap handling on the row before this file
 * ever gets to wire it. A real click fired BOTH paths — Blockly's own native activation (closing its own menu,
 * the old t2387 cursor popup) AND this file's own click handler (the row-anchored cascade) — landing wherever
 * rendered last. That was the reopened defect: "both open at once."
 *
 * `wireFlyoutTrigger` is HOVER-ONLY now — the two tests that asserted the retired click/touch interception are
 * replaced below with the real fix: the `ContextMenuRegistry` item's own `callback` (blocksApp.js,
 * `registerBlockOptionsMenu`) is the ONE path click, touch tap, and keyboard arrow+Enter all guaranteed funnel
 * through, and it now opens the identical row-anchored cascade instead of the old cursor popup.
 */

test.use({ viewport: { width: 1400, height: 1000 } });

test('openFlyoutAdjacent: opens to the right by default, flips left when it would overflow the viewport', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const { openFlyoutAdjacent, hideOpMenu } = await import('/ui/opContextMenu.js');
    const items = [{ label: 'Freeze value', fn: () => {} }, { label: 'Disable', fn: () => {} }];
    const anchorLeft = { left: 50, right: 150, top: 100, bottom: 130, width: 100, height: 30 };
    openFlyoutAdjacent(items, anchorLeft);
    const m = document.querySelector('.op-ctx-menu');
    const rA = m.getBoundingClientRect();
    hideOpMenu();
    const anchorRight = { left: 800, right: window.innerWidth - 10, top: 100, bottom: 130, width: 90, height: 30 };
    openFlyoutAdjacent(items, anchorRight);
    const rB = m.getBoundingClientRect();
    hideOpMenu();
    return { rightOfLeftAnchor: rA.left > anchorLeft.right, leftOfRightAnchor: rB.right <= anchorRight.left + 1, topAligned: rA.top === anchorLeft.top && rB.top === anchorRight.top };
  });
  expect(r.rightOfLeftAnchor, 'an anchor with room to its right opens the flyout to the right').toBe(true);
  expect(r.leftOfRightAnchor, 'an anchor near the viewport edge flips the flyout to its left').toBe(true);
  expect(r.topAligned, 'both cases stay top-aligned with the anchor').toBe(true);
});

/**
 * t2423 (BACKLOG #52 REOPENED again — real device, owner: flyout at the viewport's bottom-left, "nowhere near
 * the row"). Established live that this is DETERMINISTIC on any ~390px-wide screen for THIS row's own
 * dimensions (~156px row, ~168px flyout — neither fits to either side), not a timing race: before the fix,
 * the old code still ran the left-side formula, went deeply negative, and the outer clamp pinned the flyout
 * to the screen's own far-left edge — correct in NEITHER direction, landing wherever the clamp bottomed out
 * rather than anywhere related to the row.
 */
test('openFlyoutAdjacent: when NEITHER side fits (narrow screen), stacks BELOW the row instead of clamping to a distant edge', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const { openFlyoutAdjacent, hideOpMenu } = await import('/ui/opContextMenu.js');
    const items = [{ label: 'Freeze value', fn: () => {} }, { label: 'Disable', fn: () => {} }];
    // matches the real measured numbers: a ~156px-wide row roughly centered on a 390px-wide screen, with a
    // ~168px flyout — neither `right + flyout` nor `left - flyout` fits inside the viewport.
    const anchor = { left: 74, right: 230, top: 292, bottom: 319, width: 156, height: 27 };
    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true });
    openFlyoutAdjacent(items, anchor);
    const m = document.querySelector('.op-ctx-menu');
    const rect = m.getBoundingClientRect();
    hideOpMenu();
    return { left: rect.left, top: rect.top, anchorLeft: anchor.left, anchorBottom: anchor.bottom };
  });
  expect(r.left, 'left-aligned WITH the row, not pinned to the screen edge').toBe(r.anchorLeft);
  expect(r.top, 'stacked directly below the row (touching it), not at some unrelated vertical position').toBeCloseTo(r.anchorBottom + 2, 0);
});

test('wireFlyoutTrigger: hover-open delay, close-delay tolerance survives re-entry', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.evaluate(async () => {
    const { wireFlyoutTrigger } = await import('/ui/opContextMenu.js');
    const row = document.createElement('div');
    row.id = 't2411-row';
    row.textContent = 'Block options…';
    row.style.cssText = 'position:fixed; left:100px; top:100px; width:150px; height:30px; z-index:99999;';
    document.body.appendChild(row);
    wireFlyoutTrigger(row, () => [{ label: 'X', fn: () => {} }]);
  });
  const box = await page.locator('#t2411-row').boundingBox();

  // hover-open: not yet at 50ms, open by 300ms
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(50);
  const at50 = await page.evaluate(() => { const m = document.querySelector('.op-ctx-menu'); return !m || m.hidden; });
  await page.waitForTimeout(250);
  const at300 = await page.evaluate(() => { const m = document.querySelector('.op-ctx-menu'); return m && !m.hidden; });
  expect(at50, 'the flyout has not opened yet at 50ms (before the open-delay)').toBe(true);
  expect(at300, 'the flyout is open by 300ms (past the open-delay)').toBe(true);

  // close-delay tolerance: leaving to nowhere keeps it open briefly, then closes
  await page.mouse.move(700, 700);
  await page.waitForTimeout(200);
  const stillOpenAt200 = await page.evaluate(() => !document.querySelector('.op-ctx-menu').hidden);
  await page.waitForTimeout(400);
  const closedAt600 = await page.evaluate(() => document.querySelector('.op-ctx-menu').hidden);
  expect(stillOpenAt200, 'leaving the row does not close the flyout instantly (diagonal tolerance)').toBe(true);
  expect(closedAt600, 'it does close once the tolerance window passes with no re-entry').toBe(true);

  // re-entry into the flyout itself cancels the close, keeping it open indefinitely
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(250);
  const flyRect = await page.evaluate(() => { const r = document.querySelector('.op-ctx-menu').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await page.mouse.move(flyRect.x + flyRect.w / 2, flyRect.y + flyRect.h / 2);
  await page.waitForTimeout(600);
  const staysOpen = await page.evaluate(() => !document.querySelector('.op-ctx-menu').hidden);
  expect(staysOpen, 'moving into the flyout before the close-delay fires keeps it open').toBe(true);
});

/**
 * t2417 — wireFlyoutTrigger no longer touches click or touch at all (see the file header). A stand-in row with
 * no Blockly involved cannot exercise "does this suppress Blockly's native activation" — that question can
 * only be answered against the REAL row, which the end-to-end tests below do.
 */
test('wireFlyoutTrigger: a plain click on the row does nothing — click is not this function\'s concern any more', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.evaluate(async () => {
    const { wireFlyoutTrigger } = await import('/ui/opContextMenu.js');
    const row = document.createElement('div');
    row.id = 't2417-row';
    row.style.cssText = 'position:fixed; left:100px; top:100px; width:150px; height:30px; z-index:99999;';
    document.body.appendChild(row);
    wireFlyoutTrigger(row, () => [{ label: 'X', fn: () => {} }]);
  });
  const box = await page.locator('#t2417-row').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(80);
  const open = await page.evaluate(() => { const m = document.querySelector('.op-ctx-menu'); return !!m && !m.hidden; });
  expect(open, 'a click alone (no prior hover) never opens the flyout — only mouseenter does').toBe(false);
});

async function bootFormfield(page) {
  await page.goto('/');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsLoadBlockStack && window.showApp);
  await page.evaluate(() => window.showApp('blocks'));
  await page.evaluate(() => { window.ddcsLoadBlockStack([{ type: 'formfield', params: {} }]); });
  await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks(false).length > 0);
  await page.waitForTimeout(400);
  return page.evaluate(() => {
    const blk = window.__blkws.getAllBlocks(false).find((b) => b.type === 'formfield');
    const r = blk.getSvgRoot().getBoundingClientRect();
    return { x: r.x, y: r.y };
  });
}

test('end-to-end: right-click a real block, hover "Block options…" — the native menu stays open and the flyout shows the pending enablers', async ({ page }) => {
  const box = await bootFormfield(page);
  await page.mouse.click(box.x + 20, box.y + 8, { button: 'right' });
  await page.waitForTimeout(250);
  const rowBox = await page.evaluate(() => {
    const row = Array.from(document.querySelectorAll('.blocklyMenuItem')).find((r) => r.textContent.trim() === 'Block options…');
    if (!row) return null;
    const r = row.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  expect(rowBox, 'a fresh formfield block (every enabler still unrevealed) offers "Block options…"').not.toBeNull();
  await page.mouse.move(rowBox.x + rowBox.width / 2, rowBox.y + rowBox.height / 2);
  await page.waitForTimeout(300);
  const state = await page.evaluate(() => {
    const nativeMenu = document.querySelector('.blocklyContextMenu');
    const flyout = document.querySelector('.op-ctx-menu');
    return {
      nativeMenuOpen: !!nativeMenu && nativeMenu.offsetParent !== null,
      flyoutOpen: !!flyout && !flyout.hidden,
      flyoutItems: flyout ? Array.from(flyout.children).map((c) => c.textContent) : [],
    };
  });
  expect(state.nativeMenuOpen, 'Blockly\'s own native menu stays open beside the flyout').toBe(true);
  expect(state.flyoutOpen, 'the flyout opened on hover').toBe(true);
  expect(state.flyoutItems).toEqual(['+ help text', '+ limits (min/max/step)', '+ units', '+ show-when condition']);

  // selecting a flyout item closes BOTH menus together (the whole cascade dismisses, matching the Explorer reference)
  await page.evaluate(() => document.querySelector('.op-ctx-menu').children[0].click());
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => {
    const nativeMenu = document.querySelector('.blocklyContextMenu');
    const flyout = document.querySelector('.op-ctx-menu');
    return { nativeGone: !nativeMenu || nativeMenu.offsetParent === null, flyoutHidden: !flyout || flyout.hidden };
  });
  expect(after.nativeGone && after.flyoutHidden, 'picking a flyout item closes the whole cascade').toBe(true);
});

test('regression: an ordinary row (Duplicate) is untouched — still duplicates the block on click', async ({ page }) => {
  const box = await bootFormfield(page);
  await page.mouse.click(box.x + 20, box.y + 8, { button: 'right' });
  await page.waitForTimeout(250);
  const before = await page.evaluate(() => window.__blkws.getAllBlocks(false).length);
  const dupBox = await page.evaluate(() => {
    const row = Array.from(document.querySelectorAll('.blocklyMenuItem')).find((r) => r.textContent.trim().startsWith('Duplicate'));
    const r = row.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.click(dupBox.x, dupBox.y);
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => window.__blkws.getAllBlocks(false).length);
  expect(after, 'Duplicate still duplicates the block, unaffected by the new cascade wiring').toBeGreaterThan(before);
});

async function rowRectFor(page, label) {
  return page.evaluate((label) => {
    const row = Array.from(document.querySelectorAll('.blocklyMenuItem')).find((r) => r.textContent.trim() === label);
    if (!row) return null;
    const r = row.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }, label);
}

/**
 * t2417 (BACKLOG #52 REOPENED) — THE FIX ITSELF: a real CLICK on "Block options…" (no prior hover) opens the
 * SAME row-anchored cascade the hover trigger opens — never the old cursor-positioned popup. Blockly's own
 * native menu closes on activation, same as every other item (Duplicate, Delete, …) — that half is unchanged,
 * standard Blockly behavior, not a regression.
 */
test('end-to-end (t2417): a real click on "Block options…" opens the cascade, not the old cursor popup', async ({ page }) => {
  const box = await bootFormfield(page);
  await page.mouse.click(box.x + 20, box.y + 8, { button: 'right' });
  await page.waitForTimeout(250);
  const rowBox = await rowRectFor(page, 'Block options…');
  expect(rowBox).not.toBeNull();
  await page.mouse.click(rowBox.x + rowBox.width / 2, rowBox.y + rowBox.height / 2);
  await page.waitForTimeout(150);
  const state = await page.evaluate(() => {
    const flyout = document.querySelector('.op-ctx-menu');
    const r = flyout ? flyout.getBoundingClientRect() : null;
    return { flyoutOpen: !!flyout && !flyout.hidden, rect: r, items: flyout ? Array.from(flyout.children).map((c) => c.textContent) : [] };
  });
  expect(state.flyoutOpen, 'the click opened the cascade').toBe(true);
  expect(state.items).toEqual(['+ help text', '+ limits (min/max/step)', '+ units', '+ show-when condition']);
  // row-ANCHORED, not cursor-positioned: its left edge sits at the row's right edge (+ the flyout's own gap),
  // never at the click's own (x, y) — that distinction IS the bug this turn fixes.
  expect(state.rect.left, 'positioned beside the row (the cascade), not at the click point (the old popup)').toBeGreaterThan(rowBox.x + rowBox.width - 1);
});

/**
 * t2417 — THE OWNER'S OWN "PROVE IT": open by hover, then click, and only one panel exists throughout — not
 * two, not a flicker between two different positions, the SAME element the whole time.
 */
test('end-to-end (t2417): hover then click — impossible for two panels to coexist, only one .op-ctx-menu ever exists', async ({ page }) => {
  const box = await bootFormfield(page);
  await page.mouse.click(box.x + 20, box.y + 8, { button: 'right' });
  await page.waitForTimeout(250);
  const rowBox = await rowRectFor(page, 'Block options…');
  const cx = rowBox.x + rowBox.width / 2, cy = rowBox.y + rowBox.height / 2;
  await page.mouse.move(cx, cy);
  await page.waitForTimeout(250);
  const afterHover = await page.evaluate(() => ({
    menuCount: document.querySelectorAll('.op-ctx-menu').length,
    nativeOpen: !!document.querySelector('.blocklyContextMenu'),
    flyoutOpen: !document.querySelector('.op-ctx-menu').hidden,
    rect: document.querySelector('.op-ctx-menu').getBoundingClientRect(),
  }));
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(150);
  const afterClick = await page.evaluate(() => ({
    menuCount: document.querySelectorAll('.op-ctx-menu').length,
    flyoutOpen: !document.querySelector('.op-ctx-menu').hidden,
    rect: document.querySelector('.op-ctx-menu').getBoundingClientRect(),
  }));
  expect(afterHover.nativeOpen, 'hover: parent menu stays open').toBe(true);
  expect(afterHover.flyoutOpen, 'hover: the cascade is open').toBe(true);
  expect(afterHover.menuCount, 'there is only ever ONE floating menu element, hover or click').toBe(1);
  expect(afterClick.menuCount, 'still exactly one element after the click').toBe(1);
  expect(afterClick.flyoutOpen, 'the cascade is still open after the click').toBe(true);
  expect(afterClick.rect.left, 'the click did not reposition it to a second (cursor) location').toBe(afterHover.rect.left);
  expect(afterClick.rect.top, 'same top too — the SAME open panel, not a second one').toBe(afterHover.rect.top);
});

test.describe('touch-emulated context (t2417)', () => {
  test.use({ hasTouch: true, viewport: { width: 1400, height: 1000 } });
  test('end-to-end: a real touch tap on "Block options…" opens the cascade, correctly ANCHORED (no hover exists on touch, so tap is the only trigger)', async ({ page }) => {
    const box = await bootFormfield(page);
    await page.mouse.click(box.x + 20, box.y + 8, { button: 'right' });
    await page.waitForTimeout(250);
    const rowBox = await rowRectFor(page, 'Block options…');
    expect(rowBox).not.toBeNull();
    // t2419 — the amendment's own suspicion (owner-reported: flyout renders bottom-left on a real phone, the
    // parent menu already gone). Established live BEFORE writing anything: Blockly's own vendored
    // `onAction` (blockly_compressed.js) calls `hide()` (synchronous — the row is gone from the DOM
    // immediately) THEN schedules the registered callback via `requestAnimationFrame(() =>
    // setTimeout(callback, 0))` — a real, multi-frame deferral, not "basically immediate." This test now
    // explicitly waits past at least one animation frame before tapping, closer to how a slower/real device's
    // paint-then-tap timing would actually land, and checks the RESULTING POSITION (t2417's own touch test
    // never did — it only checked that the cascade opened, not where).
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 20))));
    await page.touchscreen.tap(rowBox.x + rowBox.width / 2, rowBox.y + rowBox.height / 2);
    await page.waitForTimeout(400);
    const state = await page.evaluate(() => {
      const flyout = document.querySelector('.op-ctx-menu');
      const r = flyout ? flyout.getBoundingClientRect() : null;
      return {
        flyoutOpen: !!flyout && !flyout.hidden, rect: r,
        items: flyout ? Array.from(flyout.children).map((c) => c.textContent) : [],
      };
    });
    expect(state.flyoutOpen, 'a real tap opens the cascade').toBe(true);
    expect(state.items).toEqual(['+ help text', '+ limits (min/max/step)', '+ units', '+ show-when condition']);
    // row-ANCHORED, not dumped near the viewport origin (the reported symptom) — its left edge sits at or past
    // the row's own right edge, and its top is close to the row's own top (clamped into the viewport, so
    // "close to" rather than exact — the same tolerance the desktop click test's own position check allows).
    expect(state.rect.left, 'anchored beside the row, not collapsed toward (0,0)/viewport origin').toBeGreaterThan(rowBox.x + rowBox.width - 1);
    expect(state.rect.top, 'top stays near the row it hangs off, not dumped at the viewport bottom').toBeLessThan(rowBox.y + 100);
  });
});

test.describe('narrow phone-width viewport (t2423)', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('end-to-end: on a real ~390px screen, tapping "Block options…" lands the flyout TOUCHING the row, not at a distant screen edge', async ({ page }) => {
    const box = await bootFormfield(page);
    // the categories flyout opens automatically after boot and can cover the block on this narrow a canvas —
    // dismiss it first, same as any real user would by tapping elsewhere.
    await page.mouse.click(300, 400);
    await page.waitForTimeout(150);
    await page.mouse.click(box.x + 20, box.y + 8, { button: 'right' });
    await page.waitForTimeout(250);
    const rowBox = await rowRectFor(page, 'Block options…');
    expect(rowBox, 'the row is reachable at this width').not.toBeNull();
    // established live: this row (~156px) and the flyout (~168px) do not fit on EITHER side of a ~390px
    // screen — confirming the fixture actually exercises the neither-fits path this test means to cover.
    expect(rowBox.x + rowBox.width + 2 + 168, 'sanity: does not fit to the right').toBeGreaterThan(390 - 6);
    expect(rowBox.x - 2 - 168, 'sanity: does not fit to the left either').toBeLessThan(6);
    await page.touchscreen.tap(rowBox.x + rowBox.width / 2, rowBox.y + rowBox.height / 2);
    await page.waitForTimeout(400);
    const state = await page.evaluate(() => {
      const flyout = document.querySelector('.op-ctx-menu');
      const r = flyout ? flyout.getBoundingClientRect() : null;
      return { flyoutOpen: !!flyout && !flyout.hidden, rect: r };
    });
    expect(state.flyoutOpen, 'a real tap opens the cascade').toBe(true);
    // TOUCHING the row (left-aligned, stacked just below it) — not the pre-fix behaviour of pinning to the
    // screen's own far-left edge regardless of where the row actually is.
    expect(state.rect.left, 'left-aligned with the row').toBeCloseTo(rowBox.x, 0);
    expect(state.rect.top, 'stacked directly below the row, touching it').toBeCloseTo(rowBox.y + rowBox.height + 2, 0);
  });
});
