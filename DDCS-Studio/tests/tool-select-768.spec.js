import { test, expect } from '@playwright/test';

/**
 * t768 Phase 1a — DECLARE the tool + the SIM reflects it. Every mill twin gains a `toolNum` picker (a `toolsel` marker
 * bound by identity via the shared toolBindingsFor). The declared tool NUMBER resolves to the library row, so the sim
 * renders the REAL cutter (a ballnose visibly round-nosed, the true Ø); a free-typed Ø is the honest no-table fallback.
 * The marker EMITS NOTHING → a program with a tool declared is BYTE-IDENTICAL to one without (Phase 2 wires the emit).
 */
test.use({ viewport: { width: 1200, height: 860 } });

const TWINS = {
  drill: 'drillDataDef', bore: 'boreDataDef', slot: 'slotDataDef', surfacing: 'surfacingDataDef',
  contour: 'contourDataDef', text: 'textDataDef', pocket: 'pocketDataDef',
};

test('every mill twin declares a toolNum picker; a NO-TOOL op is byte-identical + toolNum round-trips', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async (TWINS) => {
    const files = {
      drill: '/blocks/dataOps/drillData.js', bore: '/blocks/dataOps/boreData.js', slot: '/blocks/dataOps/slotData.js',
      surfacing: '/blocks/dataOps/surfacingData.js', contour: '/blocks/dataOps/contourData.js',
      text: '/blocks/dataOps/textData.js', pocket: '/blocks/dataOps/pocketData.js',
    };
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { markerLine, parseMarker } = await import('/blocks/opSchema.js');
    const out = {};
    for (const [name, file] of Object.entries(files)) {
      const mod = await import(file);
      const def = mod[TWINS[name]]();
      registerUserOp(def);
      const hasPick = (def.bindings || []).some((b) => b.param === 'toolNum' && b.widget === 'toolpick');
      const build = builderOf(def.opType);
      const base = emitMapped(build({})).text;   // NO tool declared → no tool machinery at all (byte-identical; the goldens hold)
      const back = parseMarker(markerLine(def.opType, { toolNum: 5 }));   // the declared toolNum round-trips through the op marker
      out[name] = { hasPick, leak: /toolsel|@TOOL|tool change|T\d+ M6|Load T/i.test(base), rt: !!back && Number(back.params.toolNum) === 5 };
    }
    return out;
  }, TWINS);
  for (const name of Object.keys(TWINS)) {
    expect(r[name].hasPick, `${name} exposes a toolNum toolpick binding`).toBe(true);
    expect(r[name].leak, `${name}: a no-tool op emits NO tool-change machinery (byte-identical)`).toBe(false);
    expect(r[name].rt, `${name}: toolNum survives the marker round-trip`).toBe(true);
  }
});

test('a picked ballnose resolves to a ROUND cutter profile; a flat endmill stays flat (the sim tool profile)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  const r = await page.evaluate(async () => {
    const s = window.ddcsGetSettings(); s.atc = s.atc || {};
    s.atc.tools = [{ num: 3, name: '6mm ball', type: 'ballnose', dia: 6 }, { num: 1, name: '6mm flat', type: 'endmill', dia: 6 }];
    const { getTool } = await import('/wizards/toolPicker.js');
    const { toolHalfProfile } = await import('/viz/toolProfile.js');
    const ball = getTool(3), flat = getTool(1);
    const bp = toolHalfProfile(ball), fp = toolHalfProfile(flat);
    return { ballType: ball && ball.type, ballTipR: bp[0][0], ballPts: bp.length, flatTipR: fp[0][0] };
  });
  expect(r.ballType, 'the library resolves T3 as a ballnose').toBe('ballnose');
  expect(r.ballTipR, 'the ballnose tip reaches the axis (round nose)').toBeLessThan(0.01);
  expect(r.ballPts, 'the ballnose profile is a curved arc (many points)').toBeGreaterThan(10);
  expect(r.flatTipR, 'the flat endmill tip is full-radius (flat bottom, not round)').toBeGreaterThan(2);
});

test('opening the Drill twin and picking a ballnose renders THAT cutter in the sim; clearing it falls back to the typed Ø', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.openWiz && window.ddcsGetSettings);
  await page.evaluate(() => { const s = window.ddcsGetSettings(); s.atc = s.atc || {}; s.atc.tools = [{ num: 7, name: '8mm ball', type: 'ballnose', dia: 8 }]; });
  await page.evaluate(() => window.openWiz('user_drill_data'));
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz; });

  // pick the ballnose T7 in the tool picker
  const picked = await page.evaluate(() => {
    const sel = document.getElementById('wiz_user_form').querySelector('[data-param="toolNum"]');
    if (!sel) return { noSel: true };
    sel.value = '7';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    window.ddcsStudio.wizardManager.update();
    return { noSel: false };
  });
  expect(picked.noSel, 'the Drill twin form renders a toolNum picker').toBeFalsy();
  await page.waitForFunction(() => { const v = window.ddcsStudio.wizardManager._activePanel.viz; return v && v._simTool && v._simTool.type === 'ballnose'; }, { timeout: 8000 });
  const tool = await page.evaluate(() => { const v = window.ddcsStudio.wizardManager._activePanel.viz; return { type: v._simTool.type, dia: v._simTool.dia }; });
  expect(tool.type, 'the sim cutter is the picked ballnose (round)').toBe('ballnose');
  expect(tool.dia, 'the sim cutter takes the table Ø (8mm), one source').toBe(8);
});

test('with NO tool declared, a twin free-typed Ø still drives the sim cutter (the no-table fallback works)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.openWiz && window.ddcsGetSettings);
  await page.evaluate(() => { const s = window.ddcsGetSettings(); s.atc = s.atc || {}; s.atc.tools = []; });   // NO library
  await page.evaluate(() => window.openWiz('user_slot_data'));   // slot carries a toolDia field
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz; });
  await page.evaluate(() => {
    const form = document.getElementById('wiz_user_form');
    const dia = form.querySelector('[data-param="toolDia"]'); dia.value = '5'; dia.dispatchEvent(new Event('input', { bubbles: true }));
    window.ddcsStudio.wizardManager.update();
  });
  await page.waitForFunction(() => { const v = window.ddcsStudio.wizardManager._activePanel.viz; return v && v._simTool && v._simTool.type === 'endmill' && Number(v._simTool.dia) === 5; }, { timeout: 8000 });
  const fb = await page.evaluate(() => { const v = window.ddcsStudio.wizardManager._activePanel.viz; return { type: v._simTool.type, dia: v._simTool.dia }; });
  expect(fb.type, 'no tool declared → a flat endmill (the honest fallback)').toBe('endmill');
  expect(fb.dia, 'the free-typed Ø drives the fallback cutter (no table needed)').toBe(5);
});
