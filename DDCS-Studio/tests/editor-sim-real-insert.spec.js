import { test, expect } from '@playwright/test';

/**
 * B0 (Option B) — the editor sim applies the per-pass start hints from the LIVE PROGRAM MODEL, so an INSERTED probe sims
 * the SAME as the wizard (the 2nd-axis begins at ②, not glued to the WCS edge) WITHOUT putting markers in the editor text
 * (the editor stays clean — programModel "export only"). gpStartHints reads ddcsGetBlockProgram() → per-op opSimStarts; a
 * loaded .nc with export @DDCS markers is the fallback. Verified through the REAL insert path (wizardManager.insert()),
 * NOT a synthetic hand-added marker (the turn-88 false-positive lesson).
 */
test.use({ viewport: { width: 1280, height: 900 } });

const setup = `
  async function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
  function set(id,v){ const e=document.getElementById(id); if(!e) return; if(e.type==='checkbox') e.checked=!!v; else e.value=v; e.dispatchEvent(new Event('change',{bubbles:true})); }
  async function insertBoss(){ const wm=window.ddcsStudio.wizardManager; wm.open('middle'); await sleep(150); set('m_type','boss'); set('m_both',true); wm.update(); await sleep(140); await wm.insert(); await sleep(230); }
`;

test('REAL insert: editor sim 2nd-axis lands on ② (matches the wizard) via the live program model — editor stays clean', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetBlockProgram && window.setGcodeView && window.ddcsGetSettings);

  const r = await page.evaluate(async (setupSrc) => {
    eval(setupSrc);
    const { opSimStarts } = await import('/viz/opSimStarts.js');
    await insertBoss();

    // the op (+params) is in the program model after the REAL insert; opSimStarts on it = what the wizard uses
    const prog = window.ddcsGetBlockProgram() || [];
    const mid = prog.find((b) => b && b.type === 'op' && b.opType === 'middle');
    const stock = window.ddcsGetSettings().stock;
    const wizHints = opSimStarts('middle', mid.params, stock);

    // the editor preview's per-pass starts (computePassStarts reads gpStartHints → the live program)
    window.setGcodeView('3d');
    window.__gpPanel.refresh();
    const editorPass = window.__gpPanel.getPassStarts();
    const editorTxt = document.getElementById('editor').value;
    return { wizHints, editorPass, hasMarker: editorTxt.indexOf('@DDCS') >= 0, head: editorTxt.split('\n')[0] };
  }, setup);

  expect(r.hasMarker, 'editor stays CLEAN — no @DDCS added to the text (Option B, not A)').toBe(false);
  expect(r.wizHints.length, 'the op resolves to 2 per-pass starts (boss-both)').toBe(2);
  expect(r.editorPass.length, 'the editor sim has 2 per-pass starts').toBe(2);
  // THE FIX: the 2nd-axis ② lands on the per-pass start (matching the wizard), NOT the WCS edge
  expect(Math.round(r.editorPass[1].x), '② x matches the wizard hint').toBe(Math.round(r.wizHints[1].x));
  expect(Math.round(r.editorPass[1].y), '② y matches the wizard hint (not the WCS edge)').toBe(Math.round(r.wizHints[1].y));
  expect(Math.round(r.editorPass[1].z), '② z matches the wizard hint').toBe(Math.round(r.wizHints[1].z));
});

test('a second op gets its OWN hints independently; a loaded .nc with markers resolves via the fallback', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetBlockProgram && window.setGcodeView);

  const r = await page.evaluate(async (setupSrc) => {
    eval(setupSrc);
    const { opSimStarts } = await import('/viz/opSimStarts.js');
    const stock = window.ddcsGetSettings().stock;

    // TWO real inserts → two ops in the program; each contributes its own hints (the program-model read iterates all ops)
    await insertBoss();
    await insertBoss();
    const prog = window.ddcsGetBlockProgram() || [];
    const mids = prog.filter((b) => b && b.type === 'op' && b.opType === 'middle');
    const perOp = mids.map((m) => opSimStarts('middle', m.params, stock).length);

    // FALLBACK: empty the program, hand-load a .nc that already carries an export @DDCS marker → resolves via the parse
    const { markerLine } = await import('/blocks/opSchema.js');
    const { MiddleWizard } = await import('/wizards/middleWizard.js');
    window.ddcsLoadBlockStack([]);
    await sleep(160);
    const params = { featureType: 'boss', twoAxis: true, findBoth: true, axis: 'X', dir1: 'pos', dir2: 'neg', dist: 100, inAxis: 'auto', transAxis: 'auto' };
    document.getElementById('editor').value = markerLine('middle', params) + '\n' + new MiddleWizard().generate(params);
    window.setGcodeView('3d');
    window.__gpPanel.refresh();
    const fallbackLen = window.__gpPanel.getPassStarts().length;
    const progEmpty = (window.ddcsGetBlockProgram() || []).filter((b) => b && b.type === 'op').length === 0;
    return { nOps: mids.length, perOp, fallbackLen, progEmpty };
  }, setup);

  expect(r.nOps, 'two middle ops inserted').toBe(2);
  expect(r.perOp, 'each op independently resolves its own 2 per-pass starts').toEqual([2, 2]);
  expect(r.progEmpty, 'program emptied (the loaded .nc has no live program)').toBe(true);
  expect(r.fallbackLen, 'the @DDCS marker fallback resolves the loaded .nc (2 passes)').toBe(2);
});
