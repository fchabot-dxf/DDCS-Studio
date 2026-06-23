import { test, expect } from '@playwright/test';

// ⟳ Align + ✥ Position are merged into ONE tabbed Transform modal. Both editor buttons open the same modal (each
// defaulting to its own tab); the Position tab is a 2D-canvas drag GUI (mirrors Align) whose drag ⇄ dX/dY fields
// stay in sync. Both Apply paths are ATOMS (rotate / placeOnStock) that round-trip through Blocks.
test.use({ viewport: { width: 1280, height: 900 } });

const SQUARE = 'G90\nG0 X0 Y0\nG1 X20 Y0 F100\nG1 X20 Y10\nG1 X0 Y10\nG1 X0 Y0';

test('both buttons open ONE tabbed modal; each defaults to its own tab; both panes render', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsAlignRotate && window.ddcsPositionTranslate);
  await page.evaluate((t) => window.ddcsStudio.editorManager.setValue(t), SQUARE);

  // Align button → Align tab active; both tab buttons present (one modal).
  await page.evaluate(() => window.ddcsAlignRotate());
  await expect(page.locator('[data-tab="align"]')).toBeVisible();
  await expect(page.locator('[data-tab="position"]')).toBeVisible();
  await expect(page.locator('[data-pane="align"]')).toBeVisible();
  await expect(page.locator('[data-pane="position"]')).toBeHidden();
  await expect(page.locator('input[data-ang]')).toBeVisible();   // Align controls

  // Switch to the Position tab → its canvas + dX/dY/dZ fields render.
  await page.click('[data-tab="position"]');
  await expect(page.locator('[data-pane="position"]')).toBeVisible();
  await expect(page.locator('[data-pane="align"]')).toBeHidden();
  await expect(page.locator('[data-pane="position"] [data-canvas] svg.feature-canvas')).toBeVisible();
  await expect(page.locator('input[data-dx]')).toBeVisible();
  await expect(page.locator('input[data-dz]')).toBeVisible();
  // Tear down this modal so the next open is unambiguous (the overlay is the tab button's grandparent).
  await page.evaluate(() => document.querySelector('[data-tab="align"]').parentElement.parentElement.remove());

  // Position button → same modal, but defaulting to the Position tab.
  await page.evaluate(() => window.ddcsPositionTranslate());
  await expect(page.locator('[data-tab="align"]')).toBeVisible();
  await expect(page.locator('[data-pane="position"]')).toBeVisible();
  await expect(page.locator('[data-pane="align"]')).toBeHidden();
});

test('Position tab: typing a shift moves the blue outline; dragging the handle updates the dX/dY fields', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsPositionTranslate);
  await page.evaluate((t) => window.ddcsStudio.editorManager.setValue(t), SQUARE);

  await page.evaluate(() => window.ddcsPositionTranslate());
  await expect(page.locator('[data-pane="position"] [data-canvas] svg.feature-canvas')).toBeVisible();

  // field → canvas: typing a shift redraws the shifted (blue) outline + moves the handle label.
  await page.fill('input[data-dx]', '15');
  await page.dispatchEvent('input[data-dx]', 'input');
  await expect.poll(() => page.locator('[data-pane="position"] .fc-path').count()).toBeGreaterThan(0);
  await expect(page.locator('[data-pane="position"] .fc-handle-label')).toContainText('15');

  // canvas → field: drag the move handle and confirm the dX/dY fields changed off zero (the drag wrote them back).
  const box = await page.locator('[data-pane="position"] .fc-handle-move').first().boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 60, box.y + 20, { steps: 6 });
  await page.mouse.up();
  const fields = await page.evaluate(() => ({
    dx: parseFloat(document.querySelector('input[data-dx]').value),
    dy: parseFloat(document.querySelector('input[data-dy]').value),
  }));
  expect(Math.abs(fields.dx) + Math.abs(fields.dy), 'drag wrote a non-zero shift back into the fields').toBeGreaterThan(0);
  expect(errs, 'no page errors').toEqual([]);
});

test('Position Apply wraps the block program in a PlaceOnStock atom that round-trips through Blocks', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsLoadBlockStack && window.showApp && window.ddcsPositionTranslate);

  // A frameless one-move program; the editor mirrors the live projection so the ATOM path is taken.
  await page.evaluate(() => window.ddcsLoadBlockStack([{ type: 'move', params: { mode: 'cut', x: 20, y: 0, feed: 200 } }]));
  await page.waitForFunction(() => (document.getElementById('editor').value || '').includes('X20'));

  await page.evaluate(() => window.ddcsPositionTranslate());
  await page.fill('input[data-dx]', '5');
  await page.dispatchEvent('input[data-dx]', 'input');
  await page.fill('input[data-dz]', '-3');
  await page.dispatchEvent('input[data-dz]', 'input');
  await page.click('[data-tgo]');

  // Atom path: the program is now a single placeonstock wrapper; editor shows the shifted result; modal closed.
  const after = await page.evaluate(() => ({
    stack: window.ddcsGetBlockProgram(),
    editor: document.getElementById('editor').value,
    modalOpen: !!document.querySelector('[data-tgo]'),
  }));
  expect(after.modalOpen, 'modal closes on a successful atom apply').toBe(false);
  expect(after.stack.length).toBe(1);
  expect(after.stack[0].type, 'program wrapped in a placeonstock atom').toBe('placeonstock');
  expect(after.editor, 'editor shows the shifted geometry (X20 + 5 = X25)').toContain('X25');
  expect(after.stack[0].params.offX, 'dX carried into the atom').toBe(5);
  expect(after.stack[0].params.offZ, 'dZ carried into the atom').toBe(-3);

  // Round-trip: open Blocks, convert the live workspace back to a stack — the placeonstock atom must survive.
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.__blkws.getTopBlocks(false).length > 0, { timeout: 8000 });
  const rt = await page.evaluate(async () => {
    const sb = await import('/blocks/blockly/stackBridge.js');
    const st = sb.workspaceToStack(window.__blkws);
    const find = (bs) => bs.some((b) => b.type === 'placeonstock' || (b.children && find(b.children)));
    return { hasPlace: find(st), top: st[0] && st[0].type };
  });
  expect(rt.hasPlace, 'placeonstock atom survives stack → Blockly → stack').toBe(true);
  expect(rt.top, 'top block is the placeonstock wrapper').toBe('placeonstock');
  expect(errs, 'no page errors').toEqual([]);
});
