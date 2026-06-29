import { test, expect } from '@playwright/test';

// B-FLASH-2ND-AXIS (turn 102) — on an AUTO boss-both, during the 2nd-axis (perpendicular) probe the RENDERED tool/3D
// spindle must NOT flash to an offset position at the probe-retract moves. ROOT: a short sub-frame move (the retract
// after each G31 touch) emitted onPositionChange WITHOUT `pass`, so gcodeViz3d.setToolPosition defaulted to starts[0]=①
// instead of the current pass's start ②, jumping by ②−① at each of the 4 retracts (2 walls × slow/fast) then snapping
// back. The human watches the LIVE render, so this asserts the RENDERED _animTool.position (NOT e.pos): every frame
// AFTER the diagonal reposition (the 2nd axis) must anchor to ②, never ①.
//
// The 2nd axis's FIRST move (the diagonal traverse to ②) is normal; the bug is the moves AFTER the diagonal — so the
// boundary is detected STRUCTURALLY via the "REPOSITION" line (onLineChange), NOT via the `pass` field this fix corrects.
test.use({ viewport: { width: 1300, height: 950 } });

test('the RENDERED tool stays on ② through the 2nd-axis probe — no flash to ①', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));   // need a real GcodeViz3D panel
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz; });

  const r = await page.evaluate(async () => {
    const { GcodeExecutionEngine } = await import('/engine/index.js');
    const { MiddleWizard } = await import('/wizards/middleWizard.js');
    const { opSimStarts } = await import('/viz/opSimStarts.js');

    const w = new MiddleWizard();
    const stock = { x: 60, y: 60, z: 60, shape: 'boss', show: true };
    const p = { featureType: 'boss', approach: 'auto', inAxis: 'auto', transAxis: 'auto', twoAxis: true, findBoth: true,
                axis: 'X', dir1: 'pos', dir2: 'neg', dist: 80, retract: 2, safeZ: 10, clearOver: 40 };
    const code = w.generate(p);
    const starts = opSimStarts('middle', p, stock);   // [① X-wall, ② Y-wall]

    const viz = window.ddcsStudio.wizardManager._activePanel.viz;
    viz._anchorToStart = true;
    viz.starts = starts.map((s) => ({ x: s.x, y: s.y, z: s.z }));

    let afterReposition = false;          // STRUCTURAL boundary — set when the engine reaches the trans-axis reposition
    let repoFrame = -1;
    const frames = [];
    const e = new GcodeExecutionEngine({
      autoAnswer: true, simSpeed: 1, stock,
      stockOffset: w.inferStart(p, stock),
      onLineChange: ({ raw }) => { if (raw && /reposition:/i.test(raw)) { afterReposition = true; repoFrame = frames.length; } },
      onPositionChange: (pos) => {
        viz.setToolPosition(pos);   // REAL render anchoring — read the actual rendered tool
        frames.push({
          afterRepo: afterReposition,
          rendered: { x: viz._animTool.position.x, y: viz._animTool.position.y },
        });
      },
    });
    e._passStarts = starts;
    e.step(code);
    let guard = 0;
    while (e.running && guard++ < 5000) e.step();

    return { starts, frames, repoFrame, nFrames: frames.length };
  });

  const [one, two] = r.starts;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  expect(r.nFrames, 'the run produced frames').toBeGreaterThan(8);
  expect(r.repoFrame, 'the trans-axis reposition fired (the diagonal boundary)').toBeGreaterThan(0);

  const afterDiag = r.frames.filter((f) => f.afterRepo);
  expect(afterDiag.length, 'there are 2nd-axis (after-diagonal) frames').toBeGreaterThan(0);

  // THE GATE: every after-the-diagonal rendered frame sits on the ② anchor, never on ① (the flash). ② is the 2nd-axis
  // start; a frame "flashes" when it renders near the ① anchor instead. Tolerance is generous (the offset ②−① ≈ 63 mm).
  const offset = dist(one, two);
  for (let i = 0; i < afterDiag.length; i++) {
    const f = afterDiag[i];
    const dOne = dist(f.rendered, one);
    expect(dOne, `2nd-axis frame ${i} must NOT render at the ① anchor (flash); rendered=${JSON.stringify(f.rendered)}`)
      .toBeGreaterThan(offset * 0.5);
  }
});
