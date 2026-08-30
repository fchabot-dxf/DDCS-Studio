import { test, expect } from '@playwright/test';

/**
 * t2417 — Blockly's OWN native right-click menu (Duplicate / Add Comment / Collapse / Disable / Delete /
 * "Block options…") was showing a phantom vertical scrollbar with a near-FULL-LENGTH thumb even though every
 * entry was fully visible — owner-observed with a screenshot. Established live, not assumed: Blockly sizes the
 * menu's WIDGET WRAPPER via an inline pixel `height` it computes itself (exactly items × its own row height +
 * padding, no border), then this element (`box-sizing: border-box`) reads `max-height: 100%` of that wrapper —
 * so any `border` (ours from styles.css:1317-1327's own theme rider, OR Blockly's own vendored default, which
 * was ALSO present independently) eats border-width's worth of pixels straight out of the content area Blockly
 * already sized to the exact px, tipping a menu that just barely fits into `overflow:auto`'s own phantom
 * scrollbar (measured: scrollHeight 170, clientHeight 168 — exactly a 1px top+bottom border). Fixed by swapping
 * to `outline` (does not participate in box sizing) with an explicit `border: none` to kill Blockly's own
 * default border too, not just ours.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

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

test('a menu whose items fully fit shows NO scrollbar (scrollHeight === clientHeight)', async ({ page }) => {
  const box = await bootFormfield(page);
  await page.mouse.click(box.x + 20, box.y + 8, { button: 'right' });
  await page.waitForTimeout(250);
  const info = await page.evaluate(() => {
    const menu = document.querySelector('.blocklyMenu');
    const cs = getComputedStyle(menu);
    return {
      scrollHeight: menu.scrollHeight, clientHeight: menu.clientHeight,
      borderTop: cs.borderTopWidth, borderBottom: cs.borderBottomWidth, outlineWidth: cs.outlineWidth,
      itemCount: menu.querySelectorAll('.blocklyMenuItem').length,
    };
  });
  expect(info.itemCount, 'a fresh formfield block offers all 6 native entries').toBe(6);
  expect(info.scrollHeight, 'no overflow — content height equals the visible client area').toBe(info.clientHeight);
  expect(info.borderTop, 'the border that used to eat 2px of height is gone').toBe('0px');
  expect(info.borderBottom).toBe('0px');
  expect(info.outlineWidth, 'the themed ring still renders, just as an outline instead').toBe('1px');
});

test('a menu Blockly genuinely caps below its natural content height still scrolls (overflow is not disabled)', async ({ page }) => {
  const box = await bootFormfield(page);
  await page.mouse.click(box.x + 20, box.y + 8, { button: 'right' });
  await page.waitForTimeout(250);
  // Simulate what Blockly does when there truly isn't room (near a viewport edge): an inline pixel `height` on
  // the widget wrapper smaller than the menu's natural content height.
  const before = await page.evaluate(() => {
    const menu = document.querySelector('.blocklyMenu');
    menu.closest('.blocklyWidgetDiv').style.height = '100px';
    const cs = getComputedStyle(menu);
    return { scrollHeight: menu.scrollHeight, clientHeight: menu.clientHeight, overflowY: cs.overflowY };
  });
  await page.mouse.move(box.x + 40, box.y + 15);
  await page.mouse.wheel(0, 100);
  await page.waitForTimeout(100);
  const scrollTopAfter = await page.evaluate(() => document.querySelector('.blocklyMenu').scrollTop);
  expect(before.overflowY, 'overflow stays auto — this fix must not disable real scrolling').toBe('auto');
  expect(before.scrollHeight, 'a real overflow scenario: content taller than the forced cap').toBeGreaterThan(before.clientHeight);
  expect(scrollTopAfter, 'and it actually scrolls when there is real content to scroll to').toBeGreaterThan(0);
});
