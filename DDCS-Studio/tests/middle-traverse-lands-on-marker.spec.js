import { test, expect } from '@playwright/test';

/**
 * t1209 (C) — THE TRAVERSE LANDS ON ITS MARKER. Reported as a visible gap between the dogleg/diagonal traverse dashes
 * and the teal ② in the middle 2D canvas.
 *
 * MEASURED: there is no geometric gap. The tool arrives EXACTLY on ② and the probe stroke then moves INWARD from there:
 *     marker ②          = (50, 90)
 *     middleReposLanding = (50, 90)
 *     first probe START  = (50, 90)      ← the traverse really ends here
 *     passEnds[1]        = (50, 80)      ← the end of the whole PASS, i.e. AFTER the probe travelled to the wall
 * A t1207 measurement compared the marker against passEnds[1] and reported "10mm short"; that was comparing the pass
 * END (post-probe) with the pass START (the marker), not the traverse endpoint. This spec pins the real invariant —
 * marker == declared landing == where probing actually begins — so the correct geometry can't be re-reported as a gap
 * and, more importantly, so nobody "closes" a visual gap by MOVING the marker off the point the tool goes to.
 *
 * Non-circular: the probe start comes from the TRACED program (engine output, world-stitched through the pass anchor),
 * the marker from the sim-start provider, and the landing from the declared helper — three independent paths.
 */
const STOCK = { x: 100, y: 80, z: 20 };

for (const travelShape of ['dogleg', 'diagonal']) {
  test(`${travelShape}: the trans-axis traverse ends ON ② — marker == declared landing == where the probe starts`, async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async ({ STOCK, travelShape }) => {
      const { middleStack } = await import('/wizards/middleWizard.js');
      const { emitMapped } = await import('/blocks/blockEmitter.js');
      const { traceToolpath } = await import('/engine/trace.js');
      const { opSimStarts, middleReposLanding } = await import('/viz/opSimStarts.js');
      const { passAnchorFor } = await import('/engine/passAnchor.js');
      const p = { featureType: 'boss', twoAxis: true, inAxis: 'auto', transAxis: 'auto', axis: 'X', dir1: 'pos', dir2: 'neg', travelShape };
      const gcode = emitMapped(middleStack(p)).text;
      const starts = opSimStarts('middle', p, STOCK) || [];
      const parsed = traceToolpath(gcode, { stock: STOCK, start: starts[0], passStarts: starts, g53ApproxZ: 5 });
      const pe = parsed.passEnds || [];
      const world = (s) => { const o = passAnchorFor(starts, pe, s.pass) || { x: 0, y: 0 }; return { x: +(s.x1 + (o.x || 0)).toFixed(2), y: +(s.y1 + (o.y || 0)).toFixed(2) }; };
      const lastPass = starts.length - 1;
      const firstProbe = (parsed.segments || []).find((s) => s.type === 'probe' && s.pass === lastPass);
      const L = middleReposLanding(p, STOCK);
      return {
        marker: { x: +(+starts[lastPass].x).toFixed(2), y: +(+starts[lastPass].y).toFixed(2) },
        landing: { x: +L.x.toFixed(2), y: +L.y.toFixed(2) },
        probeStart: firstProbe ? world(firstProbe) : null,
        passEnd: pe[lastPass] ? { x: +(+pe[lastPass].x).toFixed(2), y: +(+pe[lastPass].y).toFixed(2) } : null,
      };
    }, { STOCK, travelShape });

    expect(r.probeStart, 'the traced program really probes on the final pass').not.toBeNull();
    // THE INVARIANT: the drawn marker sits where the tool actually arrives.
    expect(r.probeStart, '② marks where probing BEGINS — the traverse ends exactly there (no gap to close)').toEqual(r.marker);
    expect(r.landing, 'the declared landing agrees with the marker (one source)').toEqual(r.marker);
    // ...and the pass END is legitimately elsewhere: the probe strokes INWARD from the marker toward the wall.
    expect(r.passEnd, 'the pass END is the post-probe position, NOT the marker (comparing them is the t1207 trap)').not.toEqual(r.marker);
  });
}
