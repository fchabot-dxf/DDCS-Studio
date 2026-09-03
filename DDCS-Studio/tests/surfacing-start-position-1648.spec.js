import { test, expect } from '@playwright/test';

/**
 * t1648 — THE START-POSITION MARKER, one coherent dispatch (6 user rulings folded in). Reused GUI, not invented:
 * the marker IS the existing pos handle (`surfacingView.js:59-62` / the twin's `sf_pos` handle, `t716`) — ONE
 * widget, same appearance and drag in both Z-modes; the mode declares its TARGET, never forks the widget.
 *
 *   mode = normal (WCS)  ->  writes originX/originY (a REAL bound param)   ->  the EMIT MOVES
 *   mode = skim          ->  writes jogX/jogY (a PREVIEW-ONLY phantom)     ->  emit BYTE-IDENTICAL, preview moves
 *
 * THE SEAM (answering the dispatch's #1 required question): `startMarkerTarget(zMode)`, declared ONCE in
 * `blocks/dataOps/surfacingData.js` (the wizards-as-data layer, per ruling 3) as pure data — a mode → {x,y} field-
 * name map, no DOM access. Both faces resolve the SAME declaration through their own already-existing preview-
 * geometry mechanism: the built-in's `buildSurfacingSpec` (surfacingView.js) and the twin's `surfacingPreviewGeometry`
 * (surfacingData.js) each import `startMarkerTarget` and point their ALREADY-EXISTING pos handle's `fx`/`fy` at it.
 * `def.previewVarSeed(params)` (a new, small, generic hook mirroring `def.previewGeometry`'s shape) seeds the live-
 * frame registers for Skim's preview only — read once, generically, in `userOpView.js`, and once directly in
 * `surfacingView.js`'s own `update()`.
 *
 * NOT `def.simStartParams` (the alignment/rotaryClock precedent amendment 5 pointed at): that mechanism exists for
 * markers with NO bound field at all (rendered via `opSimStarts`/`simMarkers`, a 3D-panel-only surface); surfacing's
 * WCS arm targets a REAL, ALREADY-BOUND field (originX/Y), which the simpler `previewGeometry` pos handle already
 * reaches. Extending `previewGeometry` a small amount (a preview-only fallback store for a target with NO bound
 * field — the Skim arm's jogX/jogY) was less machinery than routing BOTH arms through `simStartParams`, and keeps
 * the ALREADY-PROVEN pos handle exactly as it was for the arm that needs no new behaviour (WCS).
 */
test.use({ viewport: { width: 1280, height: 900 } });

const setStock = (page) => page.evaluate(() => { const s = window.ddcsGetSettings(); s.stock = Object.assign(s.stock || {}, { x: 200, y: 150, z: 20, show: true, datum: 'nnp' }); });
const openWizard = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager);
    await setStock(page);
    await page.evaluate(() => window.ddcsStudio.wizardManager.open('surfacing'));
    await page.waitForSelector('#wiz_surfacing', { state: 'visible' });
    await page.waitForTimeout(300);
};
const wizSetup = (page) => page.evaluate(() => {
    const set = (id, v) => { const e = document.getElementById(id); if (e) { e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); } };
    set('sf_w', 80); set('sf_h', 60); set('sf_originX', 20); set('sf_originY', 20); set('sf_zMode', 'normal');
});
const wizMarkerCenter = (page) => page.evaluate(() => {
    const el = document.querySelector('#surfacingLayoutCanvas svg [data-hid="origin"]');
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
const wizCode = (page) => page.evaluate(() => document.getElementById('wiz_surfacing_code').textContent);
const wizMaxXY = (page) => page.evaluate(async () => {
    const { traceToolpath } = await import('/engine/trace.js');
    const b = traceToolpath(document.getElementById('wiz_surfacing_code').textContent).bounds;
    return { maxX: b.maxX, maxY: b.maxY };
});
const drag = async (page, from, dx, dy) => {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + dx, from.y + dy, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(250);
};

const openTwin = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await setStock(page);
    await page.evaluate(() => window.openWiz('user_surfacing_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible' });
    await page.waitForTimeout(300);
};
const twinSetP = (page, param, v) => page.evaluate(([p, val]) => {
    const e = document.querySelector(`#wiz_user_form [data-param="${p}"]`); if (!e) return false;
    e.value = String(val); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); return true;
}, [param, v]);
const twinMarkerCenter = (page) => page.evaluate(() => {
    const el = document.querySelector('svg [data-hid="sf_pos"]');
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
const twinCode = (page) => page.evaluate(() => (document.getElementById('wiz_user_code') || {}).textContent || '');
const twinMaxXY = (page) => page.evaluate(async () => {
    const { traceToolpath } = await import('/engine/trace.js');
    const b = traceToolpath((document.getElementById('wiz_user_code') || {}).textContent || '').bounds;
    return { maxX: b.maxX, maxY: b.maxY };
});

test('WCS arm, WIZARD: a real drag moves originX/Y and the emit shifts by EXACTLY that amount', async ({ page }) => {
    await openWizard(page);
    await wizSetup(page);
    const before = await page.evaluate(() => Number(document.getElementById('sf_originX').value));
    const mBefore = await wizMaxXY(page);
    const c = await wizMarkerCenter(page);
    await drag(page, c, 25, 0);
    const after = await page.evaluate(() => Number(document.getElementById('sf_originX').value));
    const dOx = after - before;
    expect(Math.abs(dOx), 'the drag genuinely moved originX').toBeGreaterThan(1);
    const mAfter = await wizMaxXY(page);
    expect(mAfter.maxX - mBefore.maxX, 'the emitted toolpath moved by EXACTLY the field delta').toBeCloseTo(dOx, 2);
});

test('Skim arm, WIZARD: a real drag moves the PREVIEW seed and leaves the emitted text BYTE-IDENTICAL', async ({ page }) => {
    await openWizard(page);
    await wizSetup(page);
    await page.selectOption('#sf_zMode', 'skim');
    await page.waitForTimeout(250);
    const codeBefore = await wizCode(page);
    const c = await wizMarkerCenter(page);
    await drag(page, c, 30, -15);
    const codeAfter = await wizCode(page);
    expect(codeAfter, 'the emitted program is BYTE-IDENTICAL before/after the Skim drag').toBe(codeBefore);

    // THE PREVIEW GENUINELY MOVES: read the real host.__varSeed previewVarSeed wrote (the same state the live 3D
    // panel's trace engine consumes via createVarStore), then run the SAME seeding through traceToolpath directly
    // (the identical mechanism previewVarSeed feeds) and confirm the traced raster shifts by that seed's delta.
    const seed = await page.evaluate(() => {
        const c2 = document.getElementById('surfacingVizContainer');
        const host = c2 && c2.parentElement && c2.parentElement.querySelector('.wiz-viz3d');
        return host ? host.__varSeed : null;
    });
    expect(seed, 'previewVarSeed wrote a real [[790,x],[791,y],[792,z]] seed').toBeTruthy();
    const jogX = seed.find((p) => p[0] === 790)[1], jogY = seed.find((p) => p[0] === 791)[1];
    expect(Math.abs(jogX) + Math.abs(jogY), 'the seed reflects a real drag, not the 0,0 default').toBeGreaterThan(1);

    const shifted = await page.evaluate(async ([text, sx, sy]) => {
        const { traceToolpath } = await import('/engine/trace.js');
        const zero = traceToolpath(text, { createVarStore: () => new Map([[790, 0], [791, 0], [792, 0]]) }).bounds;
        const seeded = traceToolpath(text, { createVarStore: () => new Map([[790, sx], [791, sy], [792, 0]]) }).bounds;
        return { dMaxX: seeded.maxX - zero.maxX, dMaxY: seeded.maxY - zero.maxY };
    }, [codeAfter, jogX, jogY]);
    expect(shifted.dMaxX, 'seeding the live frame at the dragged jogX shifts the traced preview by exactly that').toBeCloseTo(jogX, 2);
    expect(shifted.dMaxY, 'same for jogY').toBeCloseTo(jogY, 2);
});

test('the marker is ONE WIDGET — identical shape/kind whether Normal or Skim, and dragging one mode never touches the other arm\'s field', async ({ page }) => {
    await openWizard(page);
    await wizSetup(page);
    const shapeOf = () => page.evaluate(() => {
        const el = document.querySelector('#surfacingLayoutCanvas svg [data-hid="origin"]');
        return { tag: el.tagName, cls: el.getAttribute('class') };
    });
    const normalShape = await shapeOf(page);
    await page.selectOption('#sf_zMode', 'skim');
    await page.waitForTimeout(200);
    const skimShape = await shapeOf(page);
    expect(skimShape, 'the SAME widget shape/class renders in both modes — not a second, different marker').toEqual(normalShape);

    // Drag in Skim, then flip back to Normal: originX must be untouched by the Skim-mode drag.
    const c = await wizMarkerCenter(page);
    await drag(page, c, 40, 0);
    const oxAfterSkimDrag = await page.evaluate(() => document.getElementById('sf_originX').value);
    await page.selectOption('#sf_zMode', 'normal');
    await page.waitForTimeout(200);
    const oxAfterFlipBack = await page.evaluate(() => document.getElementById('sf_originX').value);
    expect(oxAfterFlipBack, 'flipping back to Normal: originX is exactly what it was before the Skim drag (20, from wizSetup) — the Skim arm never touched it').toBe('20');
    expect(oxAfterSkimDrag, 'sanity: originX really was untouched DURING the Skim drag too').toBe('20');
});

test('MODE-FLIP BEHAVIOUR (measured, not invented): jogX/Y and originX/Y persist INDEPENDENTLY across a mode flip — a value set in one arm survives, unused, while the other mode is active', async ({ page }) => {
    await openWizard(page);
    await wizSetup(page);
    // Drag in Normal (sets originX), flip to Skim, drag there too (sets jogX), flip back to Normal.
    const c1 = await wizMarkerCenter(page);
    await drag(page, c1, 15, 0);
    const oxAfterNormalDrag = await page.evaluate(() => document.getElementById('sf_originX').value);

    await page.selectOption('#sf_zMode', 'skim');
    await page.waitForTimeout(200);
    const c2 = await wizMarkerCenter(page);
    await drag(page, c2, 35, 0);
    const jxAfterSkimDrag = await page.evaluate(() => document.getElementById('sf_jogX').value);

    await page.selectOption('#sf_zMode', 'normal');
    await page.waitForTimeout(200);
    const oxAfterFlipBack = await page.evaluate(() => document.getElementById('sf_originX').value);
    const jxStillSet = await page.evaluate(() => document.getElementById('sf_jogX').value);

    // MEASURED (report, not a rule invented ahead of time): both fields simply keep whatever they were last dragged
    // to — a mode flip neither clears nor copies one arm's value into the other. originX survives the Skim
    // detour untouched; jogX survives the flip back to Normal (inert there — Normal never reads it).
    expect(oxAfterFlipBack, 'originX after flipping back to Normal == its value right after the Normal drag (the Skim detour did not touch it)').toBe(oxAfterNormalDrag);
    expect(jxStillSet, 'jogX keeps its dragged value even once Normal is active again (inert there, but not cleared)').toBe(jxAfterSkimDrag);
});

test('WCS arm, TWIN: a real drag moves originX/Y and the emit shifts by EXACTLY that amount', async ({ page }) => {
    await openTwin(page);
    await twinSetP(page, 'w', 80); await twinSetP(page, 'h', 60); await twinSetP(page, 'originX', 20); await twinSetP(page, 'originY', 20); await twinSetP(page, 'zMode', 'normal');
    await page.waitForTimeout(200);
    const before = await page.evaluate(() => Number(document.querySelector('#wiz_user_form [data-param="originX"]').value));
    const mBefore = await twinMaxXY(page);
    const c = await twinMarkerCenter(page);
    await drag(page, c, 25, 0);
    const after = await page.evaluate(() => Number(document.querySelector('#wiz_user_form [data-param="originX"]').value));
    const dOx = after - before;
    expect(Math.abs(dOx), 'the drag genuinely moved the twin\'s originX').toBeGreaterThan(1);
    const mAfter = await twinMaxXY(page);
    expect(mAfter.maxX - mBefore.maxX, 'the twin\'s emitted toolpath moved by EXACTLY the field delta').toBeCloseTo(dOx, 2);
});

test('Skim arm, TWIN: a real drag persists the jog seed and leaves the emitted text BYTE-IDENTICAL', async ({ page }) => {
    await openTwin(page);
    await twinSetP(page, 'w', 80); await twinSetP(page, 'h', 60); await twinSetP(page, 'originX', 20); await twinSetP(page, 'originY', 20); await twinSetP(page, 'zMode', 'skim');
    await page.waitForTimeout(250);
    const codeBefore = await twinCode(page);
    const c = await twinMarkerCenter(page);
    await drag(page, c, 30, -15);
    const codeAfter = await twinCode(page);
    expect(codeAfter, 'the twin\'s emitted program is BYTE-IDENTICAL before/after the Skim drag').toBe(codeBefore);

    const seed = await page.evaluate(() => {
        // t2545 (BACKLOG #71/#72, the section migration) — surfacing is now genuinely tree-rendered (mirroring
        // drill), so its 3D container carries the TREE-mode id (`nsId('userViz3dContainer_tree')`,
        // formWidgets.js) rather than the flat-mode one this test originally pinned — try both, tree-mode first.
        const c2 = document.getElementById('userViz3dContainer_tree') || document.getElementById('userViz3dContainer');
        const host = c2 && c2.parentElement && c2.parentElement.querySelector('.wiz-viz3d');
        return host ? host.__varSeed : null;
    });
    expect(seed, 'the twin\'s previewVarSeed wrote a real seed too (def.previewVarSeed, read generically by userOpView.js)').toBeTruthy();
    const jogX = seed.find((p) => p[0] === 790)[1];
    expect(Math.abs(jogX), 'the seed reflects the real drag').toBeGreaterThan(1);
});

test('t1650 review fix: the seed shape is ONE-SOURCED — the WIZARD calls the SAME startMarkerVarSeed function the TWIN\'s def.previewVarSeed is set to, not a hand-copied duplicate', async ({ page }) => {
    // Reference-level proof: the twin's def.previewVarSeed IS startMarkerVarSeed (not a lookalike copy).
    await page.goto('http://localhost:3211');
    const refCheck = await page.evaluate(async () => {
        const SD = await import('/blocks/dataOps/surfacingData.js');
        const def = SD.surfacingDataDef();
        return def.previewVarSeed === SD.startMarkerVarSeed;
    });
    expect(refCheck, 'surfacingDataDef().previewVarSeed is the exported startMarkerVarSeed itself, by reference').toBe(true);

    // Behavioral proof, both faces, identical params: dragging the SAME pixel delta on the SAME stock/size setup
    // produces the SAME seed on both faces — the cross-face equality the advisor asked to assert.
    await openWizard(page);
    await wizSetup(page);
    await page.selectOption('#sf_zMode', 'skim');
    await page.waitForTimeout(250);
    const wc = await wizMarkerCenter(page);
    await drag(page, wc, 30, -15);
    const wizSeed = await page.evaluate(() => {
        const c2 = document.getElementById('surfacingVizContainer');
        const host = c2 && c2.parentElement && c2.parentElement.querySelector('.wiz-viz3d');
        return host ? host.__varSeed : null;
    });

    await openTwin(page);
    await twinSetP(page, 'w', 80); await twinSetP(page, 'h', 60); await twinSetP(page, 'originX', 20); await twinSetP(page, 'originY', 20); await twinSetP(page, 'zMode', 'skim');
    await page.waitForTimeout(250);
    const tc = await twinMarkerCenter(page);
    await drag(page, tc, 30, -15);
    const twinSeed = await page.evaluate(() => {
        // t2545 (BACKLOG #71/#72, the section migration) — surfacing is now genuinely tree-rendered (mirroring
        // drill), so its 3D container carries the TREE-mode id (`nsId('userViz3dContainer_tree')`,
        // formWidgets.js) rather than the flat-mode one this test originally pinned — try both, tree-mode first.
        const c2 = document.getElementById('userViz3dContainer_tree') || document.getElementById('userViz3dContainer');
        const host = c2 && c2.parentElement && c2.parentElement.querySelector('.wiz-viz3d');
        return host ? host.__varSeed : null;
    });

    expect(wizSeed, 'wizard seed present').toBeTruthy();
    expect(twinSeed, 'twin seed present').toBeTruthy();
    const wJogX = wizSeed.find((p) => p[0] === 790)[1], wJogY = wizSeed.find((p) => p[0] === 791)[1];
    const tJogX = twinSeed.find((p) => p[0] === 790)[1], tJogY = twinSeed.find((p) => p[0] === 791)[1];
    expect(Math.abs(wJogX) + Math.abs(wJogY), 'sanity: the wizard drag genuinely moved the seed').toBeGreaterThan(1);
    expect(tJogX, 'IDENTICAL params + IDENTICAL drag => IDENTICAL seed on both faces (jogX)').toBeCloseTo(wJogX, 2);
    expect(tJogY, 'same for jogY').toBeCloseTo(wJogY, 2);
});
