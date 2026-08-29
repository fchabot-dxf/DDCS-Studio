import { test, expect } from '@playwright/test';

/**
 * t2411 (BACKLOG #52) — "Block ▸" becomes a real Explorer-style CASCADE: the flyout hangs off the "Block
 * options…" row Blockly's own native context menu renders, opening on hover (small delay) or click, with the
 * parent menu staying open beside it — a positioning + trigger upgrade of the SAME popup t2387 already built
 * (ui/opContextMenu.js), not a rebuild. Covers the shared trigger mechanism directly (opContextMenu.js exports
 * it standalone, so this doesn't need Blockly's own menu machinery to exercise the timing/positioning logic),
 * then one real end-to-end pass through an actual Blockly-rendered row, then a regression check that an
 * ORDINARY row (Duplicate) is completely untouched by the new wiring.
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

test('wireFlyoutTrigger: hover-open delay, close-delay tolerance survives re-entry, click is intercepted (native handler never fires, parent stays open)', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.evaluate(async () => {
    const { wireFlyoutTrigger } = await import('/ui/opContextMenu.js');
    const row = document.createElement('div');
    row.id = 't2411-row';
    row.textContent = 'Block options…';
    row.style.cssText = 'position:fixed; left:100px; top:100px; width:150px; height:30px; z-index:99999;';
    row.addEventListener('click', () => { window.__t2411NativeFired = true; });   // stands in for Blockly's own row handler
    document.body.appendChild(row);
    window.__t2411NativeFired = false;
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

  // click intercept: the row's own native handler never fires, and the flyout opens instead
  await page.evaluate(() => { document.querySelector('.op-ctx-menu').hidden = true; window.__t2411NativeFired = false; });
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(80);
  const clickState = await page.evaluate(() => ({ native: window.__t2411NativeFired, open: !document.querySelector('.op-ctx-menu').hidden }));
  expect(clickState.native, 'the row\'s own native click handler is suppressed — the parent menu never closes itself').toBe(false);
  expect(clickState.open, 'clicking the row opens the flyout the same as hovering').toBe(true);
});

test('wireFlyoutTrigger: a touch tap toggles the flyout open then closed', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.evaluate(async () => {
    const { wireFlyoutTrigger } = await import('/ui/opContextMenu.js');
    const row = document.createElement('div');
    row.id = 't2411-row';
    row.style.cssText = 'position:fixed; left:100px; top:100px; width:150px; height:30px; z-index:99999;';
    document.body.appendChild(row);
    wireFlyoutTrigger(row, () => [{ label: 'X', fn: () => {} }]);
  });
  const box = await page.locator('#t2411-row').boundingBox();
  const tap = (x, y) => page.evaluate(({ x, y }) => {
    const row = document.getElementById('t2411-row');
    row.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, touches: [], changedTouches: [new Touch({ identifier: 1, target: row, clientX: x, clientY: y })] }));
  }, { x, y });

  await tap(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(80);
  const afterFirstTap = await page.evaluate(() => !document.querySelector('.op-ctx-menu').hidden);
  expect(afterFirstTap, 'a first tap opens the flyout').toBe(true);

  await tap(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(80);
  const afterSecondTap = await page.evaluate(() => document.querySelector('.op-ctx-menu').hidden);
  expect(afterSecondTap, 'a second tap on the same row toggles it closed').toBe(true);
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
