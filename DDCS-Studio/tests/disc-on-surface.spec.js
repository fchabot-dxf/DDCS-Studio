import { test, expect } from '@playwright/test';

// DISC-ON-SURFACE (probe-surface inc2) — the contact disc sits on the COMPED surface (the wall), read SIM-SIDE from the
// declared radiuscomp atoms (NOT a #6-scan). Drives the corner sim with the wizard's inferStart through the SAME hook
// createPreviewPanel uses: readEnabledComps → {result→{axis,sign}}; on each comp line (keyed by the declared result var),
// slide the discs dropped since the last comp by ±the tip radius toward the probe dir. RELATIVE (the comp's result is in the
// engine frame, the disc rides the part frame). ENABLED comps only (the rotary fit's comp-OFF discs stay raw).
test.use({ viewport: { width: 1300, height: 950 } });

test('comped probe discs nudge onto the wall (corner X/Y) by ±the tip radius; enabled-comp only', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));   // any panel with a real viz
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz; });

  const r = await page.evaluate(async () => {
    const { GcodeExecutionEngine } = await import('/engine/index.js');
    const { CornerWizard } = await import('/wizards/cornerWizard.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const w = new CornerWizard();
    const p = { corner: 'FL', probeZ: false, probeSeq: 'XY', wcs: 'active', dist: 80, radius: 2 };
    const stock = { x: 100, y: 80, z: 20, shape: 'boss', show: true };
    const code = w.generate(p);

    // readEnabledComps: the DECLARED radiuscomp atoms → { resultVar → { axis, sign } } for enabled comps
    const TRIG = { '#1925': 'x', '#1926': 'y', '#1927': 'z' };
    const compMap = {};
    for (const a of builderOf('corner')(p)) if (a && a.type === 'radiuscomp' && a.params && a.params.enable !== false) compMap[String(a.params.result)] = { axis: TRIG[a.params.raw], sign: a.params.dir === '-' ? -1 : 1 };

    const viz = window.ddcsStudio.wizardManager._activePanel.viz;
    viz._anchorToStart = true; viz.resetProbe && viz.resetProbe();
    const probeAxis = (raw) => { const m = /G31\s+([XYZ])/i.exec(raw || ''); return m ? m[1].toLowerCase() : null; };
    let pendingProbe = null;
    // Z-TRUST (t102) + inferStart-z fix (t107): probeZ-off no longer pre-plunges, so the wall probe fires AT the operator's
    // start Z. inferStart NOW returns that within-stock jogged probe height directly (z = -scanDepth = -5, was the old
    // hover-above safeZ that a plunge used to reach) — so the horizontal wall probe crosses the wall with NO test-side z
    // override. If inferStart regressed to z=safeZ (above the top), the probe would fire over the stock and miss → discs stay raw.
    const e = new GcodeExecutionEngine({
      autoAnswer: true, stock, stockOffset: w.inferStart(p, stock),
      onLineChange: ({ raw }) => {
        if (pendingProbe && viz.probeAxisTouched) viz.probeAxisTouched(pendingProbe, e.feedVal); pendingProbe = null;
        if (raw) { const pa = probeAxis(raw); if (pa) pendingProbe = pa; }
        if (raw && viz.nudgeSurface) { const lhs = /^\s*(#\d+|#\[[^\]]+\])\s*=/.exec(raw); const c = lhs && compMap[lhs[1]]; if (c) { const rad = e.vars.get(6); if (Number.isFinite(rad)) viz.nudgeSurface(c.axis, rad * c.sign); } }
      },
      onPositionChange: (pos) => viz.setToolPosition(pos),
    });
    e.step(code); let g = 0; while (e.running && g++ < 5000) e.step();

    const discs = (viz.partFrame.group.children || []).filter((c) => c.geometry && c.geometry.type === 'CircleGeometry').map((d) => ({ x: +d.position.x.toFixed(2), y: +d.position.y.toFixed(2) }));
    const contacts = (viz._probeContacts || []).map((c) => ({ x: +c.x.toFixed(2), y: +c.y.toFixed(2) }));
    // each disc was nudged exactly ±radius along ONE axis off its raw contact → its nearest-contact distance is ~the radius (2)
    const offs = discs.map((d) => Math.min(...contacts.map((c) => Math.hypot(d.x - c.x, d.y - c.y))));
    return { compMap, nDiscs: discs.length, nContacts: contacts.length, minOff: +Math.min(...offs).toFixed(2), maxOff: +Math.max(...offs).toFixed(2) };
  });
  console.log('DOS ' + JSON.stringify(r));
  expect(r.compMap, 'X/Y comps read from the declared radiuscomp atoms (axis + sign)').toMatchObject({ '#102': { axis: 'x', sign: 1 }, '#101': { axis: 'y', sign: 1 } });
  expect(r.nDiscs, 'discs were dropped').toBeGreaterThan(0);
  // every disc nudged ~a stylus radius (2) off its raw contact onto the wall — NOT 0 (left raw) and NOT a frame-wrong jump
  expect(r.minOff, 'discs moved off the raw contact (not left at the tool centre)').toBeGreaterThan(1.5);
  expect(r.maxOff, 'discs moved ~the tip radius, not a frame-mismatched jump').toBeLessThan(3.5);
  await page.screenshot({ path: 'C:/Users/danse/AppData/Local/Temp/claude/c--Users-danse-APPS-ddcs-studio-project/42e983e9-e380-4cb5-920a-df74f358dd7a/scratchpad/_disc-on-surface.png' });
});
