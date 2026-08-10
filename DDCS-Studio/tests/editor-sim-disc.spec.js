import { test, expect } from '@playwright/test';

// DISC-ON-SURFACE in the EDITOR sim (t149) — the probe disc lands on the TRUE comped surface, read SIM-SIDE from the LIVE
// PROGRAM MODEL (ddcsGetBlockProgram → per-op builderOf radiuscomp atoms), Option B (no editor-text marker). The wizard
// preview already did this from its single active op (getLastOp); the editor's createPreviewPanel now injects the whole
// program via opts.getOps, so editor Simulate nudges the disc onto the wall for ANY probe op. Verified through the REAL insert
// path + the REAL editor viz (window.__gpPanel.viz), exercising the same program-model source + nudge createPreviewPanel uses.
test.use({ viewport: { width: 1280, height: 900 } });

const setup = `
  async function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
  function set(id,v){ const e=document.getElementById(id); if(!e) return; if(e.type==='checkbox') e.checked=!!v; else e.value=v; e.dispatchEvent(new Event('change',{bubbles:true})); }
  async function insertBoss(){ const wm=window.ddcsStudio.wizardManager; wm.open('middle'); await sleep(150); set('m_type','boss'); set('m_both',true); wm.update(); await sleep(140); await wm.insert(); await sleep(230); }
`;

test('editor Simulate lands the probe disc on the TRUE surface via the program-model comps', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetBlockProgram && window.setGcodeView && window.ddcsGetSettings);

  const r = await page.evaluate(async (setupSrc) => {
    eval(setupSrc);
    const { GcodeExecutionEngine } = await import('/engine/index.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { opSimStarts } = await import('/viz/opSimStarts.js');
    await insertBoss();                                   // a middle boss-both probe op → X/Y wall touches with radiuscomp
    const stock = window.ddcsGetSettings().stock;

    // THE EDITOR'S SOURCE: the live program model → ops → the compMap (mirrors createPreviewPanel's opts.getOps → readEnabledComps)
    const prog = (window.ddcsGetBlockProgram() || []).filter((b) => b && b.type === 'op' && b.opType).map((b) => ({ type: b.opType, params: b.params || {} }));
    const TRIG = { '#1925': 'x', '#1926': 'y', '#1927': 'z' };
    const compMap = {};
    for (const op of prog) { let st; try { st = builderOf(op.type)(op.params); } catch (_) { st = null; } for (const a of (st || [])) if (a && a.type === 'radiuscomp' && a.params && a.params.enable !== false) compMap[String(a.params.result)] = { axis: TRIG[a.params.raw], sign: a.params.dir === '-' ? -1 : 1 }; }
    const starts = []; for (const op of prog) { const h = opSimStarts(op.type, op.params, stock); if (Array.isArray(h)) starts.push(...h); }
    const code = document.getElementById('editor').value;

    // the REAL editor viz (the host the editor Simulate draws into)
    window.setGcodeView('3d');
    const viz = window.__gpPanel.viz;
    viz.setStock && viz.setStock(stock);
    viz.starts = starts.map((s) => ({ ...s })); viz._anchorToStart = true; viz._passCount = Math.max(1, starts.length); viz.resetProbe && viz.resetProbe();

    const probeAxis = (raw) => { const m = /G31\s+([XYZ])/i.exec(raw || ''); return m ? m[1].toLowerCase() : null; };
    let pp = null;
    const e = new GcodeExecutionEngine({
      autoAnswer: true, stock, stockOffset: starts[0] || { x: 0, y: 0, z: 0 },
      onLineChange: ({ raw }) => {
        if (pp && viz.probeAxisTouched) viz.probeAxisTouched(pp, e.feedVal); pp = null;
        if (raw) { const a = probeAxis(raw); if (a) pp = a; }
        if (raw && viz.nudgeSurface) { const l = /^\s*(#\d+|#\[[^\]]+\])\s*=/.exec(raw); const c = l && compMap[l[1]]; if (c) { const rad = e.vars.get(6); if (Number.isFinite(rad)) viz.nudgeSurface(c.axis, rad * c.sign); } }
      },
      onPositionChange: (pos) => viz.setToolPosition(pos),
    });
    e._passStarts = starts.length ? starts : null;
    e.step(code); let g = 0; while (e.running && g++ < 40000) e.step();
    viz.render && viz.render();

    const discs = (viz.partFrame.group.children || []).filter((c) => c.geometry && c.geometry.type === 'CircleGeometry').map((d) => ({ x: +d.position.x.toFixed(2), y: +d.position.y.toFixed(2) }));
    const contacts = (viz._probeContacts || []).map((c) => ({ x: +c.x.toFixed(2), y: +c.y.toFixed(2) }));
    const offs = discs.map((d) => Math.min(...contacts.map((c) => Math.hypot(d.x - c.x, d.y - c.y))));
    return { opType: prog[0] && prog[0].type, compKeys: Object.keys(compMap), nDiscs: discs.length, nContacts: contacts.length, maxOff: offs.length ? +Math.max(...offs).toFixed(2) : 0 };
  }, setup);
  console.log('EDITORDISC ' + JSON.stringify(r));
  expect(r.opType, 'a probe op is in the editor program model').toBe('middle');
  expect(r.compKeys.length, 'the program model yields enabled radiuscomp surfaces').toBeGreaterThan(0);
  expect(r.nDiscs, 'the editor sim dropped probe discs').toBeGreaterThan(0);
  // the disc nudged ~a stylus radius onto the wall (the program-model comp) — was left at the tool centre (≈0) before this
  expect(r.maxOff, 'a disc landed on the TRUE surface, ~a stylus radius off its raw tool-centre contact').toBeGreaterThan(1.5);
  await page.screenshot({ path: 'scratchpad/_editor-disc.png' });
});
