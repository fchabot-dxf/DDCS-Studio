import { test, expect } from '@playwright/test';

// The `rotate` atom is a Modify C-block carrying {angle, pivotX, pivotY} whose emit fold rewrites every absolute XY move
// + arc via rotateProgram — the per-op rotate + LEGACY ⟳ Align wrapper (kept for old programs, coexistence). t736: ⟳ Align
// now writes a FLAT program-level DECLARATION instead (a childless `xform` sibling, applied once at emit) — see the third
// test + transform-declared-736.spec.js. The rotate atom's fold + registration (tests 1-2) still stand for the legacy path.
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
    const mouths = br.mouthsOf(def);
    return { kind: def && def.kind, cat: def && def.category, inPalette: ops.PALETTE.includes(def), mouth: mouths[0] && mouths[0].name, mouthCount: mouths.length };
  });
  expect(r.kind).toBe('rotate');
  expect(r.cat).toBe('Transforms');
  expect(r.inPalette).toBe(true);
  // t1638 — isWrap collapsed into the def's own declared `mouth`; rotate still renders as a C-block with a DO input.
  // t2333 — mouthOf (singular-only) was replaced by mouthsOf (bridge.js), which normalizes a single `def.mouth`
  // into a one-item list; a single-mouth kind like rotate still reads back exactly one mouth named 'DO'.
  expect(r.mouthCount, 'rotate declares exactly one mouth').toBe(1);
  expect(r.mouth, 'rotate renders as a C-block with a DO statement input').toBe('DO');
});

test('t736 — ⟳ Align writes a DECLARED program xform (flat sibling), editor shows rotated, round-trips through Blocks', async ({ page }) => {
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

  // DECLARED path (t736): the program gains a FLAT xform sibling at the TOP (not a wrapper); the ops stay untouched; the
  // editor shows the rotated result; modal closed.
  const after = await page.evaluate(() => ({
    stack: window.ddcsGetBlockProgram(),
    editor: document.getElementById('editor').value,
    modalOpen: !!document.querySelector('[data-rgo]'),
  }));
  expect(after.modalOpen, 'modal closes on a successful declared apply').toBe(false);
  expect(after.stack.length, 'the flat xform sibling + the move (2), NOT a single wrapping container').toBe(2);
  expect(after.stack[0].type, 'a DECLARED xform sibling at the top of the stack').toBe('xform');
  expect(after.stack[1].type, 'the op stays a flat sibling (not nested inside a rotate wrapper)').toBe('move');
  expect(after.stack[0].params.angle).toBe(90);
  expect(after.editor, 'the editor shows the rotated geometry (applied at emit)').toContain('Y20');

  // Round-trip: open the Blocks view, convert the live workspace back to a stack — the xform declaration must survive.
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.__blkws.getTopBlocks(false).length > 0, { timeout: 8000 });
  const rt = await page.evaluate(async () => {
    const sb = await import('/blocks/blockly/stackBridge.js');
    const st = sb.workspaceToStack(window.__blkws);
    const x = st.find((b) => b && b.type === 'xform');
    return { hasXform: !!x, angle: x && x.params && x.params.angle };
  });
  expect(rt.hasXform, 'the xform declaration survives stack → Blockly → stack').toBe(true);
  expect(rt.angle, 'angle preserved through the round-trip').toBe(90);
  expect(errs, 'no page errors').toEqual([]);
});
