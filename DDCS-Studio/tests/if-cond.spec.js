import { test, expect } from '@playwright/test';

// Boolean blocks + If (the 4th socket type). Verifies: the If C-block spawns with a hexagon boolean
// socket; a numeric reporter (Variable) is REJECTED by that socket (type-safety); a boolean reporter
// (Compare) plugs in and renders as a hexagon pill; the filled socket exposes numeric sub-sockets.
test.use({ viewport: { width: 1400, height: 1000 } });

async function dragFromTo(page, src, tx, ty, steps = 14) {
  await src.scrollIntoViewIfNeeded();   // palette scrolls; boundingBox() won't auto-scroll a below-fold entry
  const b = await src.boundingBox();
  const sx = b.x + b.width / 2, sy = b.y + b.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) await page.mouse.move(sx + (tx - sx) * i / steps, sy + (ty - sy) * i / steps);
  await page.mouse.up();
}

test('If spawns a boolean socket; rejects a number reporter, accepts Compare', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));   // uncaught JS exceptions
  // console errors too, but ignore environmental resource 404s (favicon/optional assets — pre-existing)
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });

  await page.goto('http://localhost:3211');
  await page.waitForSelector('#editor');
  await page.waitForFunction(() => window.ddcsStudio);

  // open the Blocks tab and wait for the palette to build
  await page.click('[data-app="blocks"]');
  await page.waitForSelector('#blk-pal button');

  const viewport = page.locator('#blk-viewport');
  const vb = await viewport.boundingBox();
  const cx = vb.x + vb.width / 2, cy = vb.y + vb.height / 2;

  // 1) drag the If block onto the canvas (.pal-blk = a block entry, not a rail category chip)
  await dragFromTo(page, page.locator('#blk-pal .pal-blk', { hasText: /^If$/ }), cx, cy);   // exact: not "If Goto"
  await expect(page.locator('.blk.cond')).toHaveCount(1);
  await expect(page.locator('.blk.cond .bool-socket')).toHaveCount(1);
  await expect(page.locator('.blk.cond .rep')).toHaveCount(0);

  // 2) a Variable (returns:number) dropped on the boolean socket must be REJECTED
  const sock = page.locator('.blk.cond .bool-socket');
  let sb = await sock.boundingBox();
  await dragFromTo(page, page.locator('#blk-pal .pal-blk', { hasText: 'Variable' }), sb.x + sb.width / 2, sb.y + sb.height / 2);
  await expect(page.locator('.blk.cond .bool-socket')).toHaveCount(1);   // still empty
  await expect(page.locator('.blk.cond .rep')).toHaveCount(0);

  // 3) a Compare (returns:boolean) plugs in → hexagon pill, socket consumed, numeric sub-sockets exposed
  sb = await sock.boundingBox();
  await dragFromTo(page, page.locator('#blk-pal .pal-blk', { hasText: 'Compare' }), sb.x + sb.width / 2, sb.y + sb.height / 2);
  await expect(page.locator('.blk.cond .rep.rep-bool')).toHaveCount(1);
  await expect(page.locator('.blk.cond .bool-socket')).toHaveCount(0);
  // Compare's a/b are numeric value sockets (inputs), op is a select
  expect(await page.locator('.blk.cond .rep.rep-bool input.f-socket').count()).toBeGreaterThanOrEqual(2);

  expect(errors, errors.join('\n')).toEqual([]);
});
