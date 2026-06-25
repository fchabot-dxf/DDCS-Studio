import { test, expect } from '@playwright/test';

// The `rotate` atom is the ONE atom behind both ⟳ Align (wraps the whole program) and a per-op rotate (wraps one
// op) — a Modify C-block carrying {angle, pivotX, pivotY} whose emit fold rewrites every absolute XY move + arc via
// rotateProgram. Unlike the old ⟳ Align text rewrite it is non-lossy and round-trips through the Blocks view.
test.use({ viewport: { width: 1400, height: 950 } });

test('rotate atom: emit fold rotates the wrapped op about the pivot', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);

  const r = await page.evaluate(async () => {
    const bm = await import('/blocks/blockEmitter.js');
    const pf = await import('/blocks/programFraming.js');
    const mv = bm.newBlock('move');
    mv.params = { ...mv.params, mode: 'cut', x: 20, y: 0, feed: 200 };
    const rot = pf.makeRotate({ angle: 90, pivotX: 0, pivotY: 0 }, [mv]);    // 90° CCW about origin: (20,0) → (0,20)
    return {
      rotated: bm.emitProgram([rot]),
      identity: bm.emitProgram([pf.makeRotate({ angle: 0 }, [mv])]),         // 0° passes through untouched
    };
  });

  expect(r.rotated, 'X20 became X0').toContain('X0');
  expect(r.rotated, 'Y0 became Y20').toContain('Y20');
  expect(r.rotated, 'original X20 is gone').not.toContain('X20');
  expect(r.identity, '0° leaves the move as-is').toContain('X20 Y0');
});

test('rotate atom is registered as a Modify wrap block', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const ops = await import('/wizards/ops/index.js');
    const br = await import('/blocks/blockly/bridge.js');
    const def = ops.BLOCKS.rotate;
    return { kind: def && def.kind, cat: def && def.category, inPalette: ops.PALETTE.includes(def), isWrap: br.isWrap(def) };
  });
  expect(r.kind).toBe('rotate');
  expect(r.cat).toBe('Modify');
  expect(r.inPalette).toBe(true);
  expect(r.isWrap, 'rotate renders as a C-block with a DO statement input').toBe(true);
});

test('⟳ Align wraps the block program in a rotate atom (non-lossy) and round-trips through Blocks', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsLoadBlockStack && window.showApp);

  // A frameless one-move program; the editor mirrors the live projection.
  await page.evaluate(() => window.ddcsLoadBlockStack([{ type: 'move', params: { mode: 'cut', x: 20, y: 0, feed: 200 } }]));
  await page.waitForFunction(() => (document.getElementById('editor').value || '').includes('X20'));

  await page.evaluate(() => window.ddcsAlignRotate());
  await page.fill('input[data-ang]', '90');
  await page.dispatchEvent('input[data-ang]', 'input');
  await page.click('[data-rgo]');

  // Atom path: the program is now a single rotate wrapper; the editor shows the rotated result; modal closed.
  const after = await page.evaluate(() => ({
    stack: window.ddcsGetBlockProgram(),
    editor: document.getElementById('editor').value,
    modalOpen: !!document.querySelector('[data-rgo]'),
  }));
  expect(after.modalOpen, 'modal closes on a successful atom apply').toBe(false);
  expect(after.stack.length).toBe(1);
  expect(after.stack[0].type, 'program wrapped in a rotate atom').toBe('rotate');
  expect(after.stack[0].params.angle).toBe(90);
  expect(after.editor, 'editor shows the rotated geometry').toContain('Y20');

  // Round-trip: open the Blocks view, convert the live workspace back to a stack — the rotate atom must survive.
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.__blkws.getTopBlocks(false).length > 0, { timeout: 8000 });
  const rt = await page.evaluate(async () => {
    const sb = await import('/blocks/blockly/stackBridge.js');
    const st = sb.workspaceToStack(window.__blkws);
    const find = (bs) => bs.some((b) => b.type === 'rotate' || (b.children && find(b.children)));
    return { hasRotate: find(st), top: st[0] && st[0].type, angle: st[0] && st[0].params && st[0].params.angle };
  });
  expect(rt.hasRotate, 'rotate atom survives stack → Blockly → stack').toBe(true);
  expect(rt.angle, 'angle preserved through the round-trip').toBe(90);
  expect(errs, 'no page errors').toEqual([]);
});
