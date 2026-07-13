import { test, expect } from '@playwright/test';

/**
 * t812 — THE .nc PROGRAM-LEVEL MARKER SLOT. serializeWithMarkers is per-op-line, so the two CHILDLESS program-level
 * declarations (the transform `xform{angle,pivotX,pivotY}` + a program-level `entry{entryX,entryY}` waypoint) projected
 * no line → got no marker → a .nc export/reimport silently DROPPED them (they round-tripped only via .mjson). ONE
 * `( @DDCS:1 {"op":"prog", …} )` header (the SAME self-describing grammar, program scope) now carries BOTH; unset →
 * NOTHING emitted (byte-identical export); the parser restores them; no third bespoke path.
 */

async function mods(page) {
  return page.evaluate(async () => { window.__M = {
    PM: await import('/blocks/programModel.js'),
    OB: await import('/blocks/opBuilders.js'),
    PF: await import('/blocks/programFraming.js'),
    EM: await import('/blocks/blockEmitter.js'),
    OS: await import('/blocks/opSchema.js'),
    T: await import('/wizards/ops/transform.js'),
  }; return true; });
}
const POCKET = { shape: 'rect', w: 50, h: 40, depth: 4, stepdown: 2, toolDia: 6, strategy: 'raster' };

test('XFORM survives a .nc export → reimport; the badge + angle come back', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsLoadBlockStack && window.ddcsGetBlockProgram && window.ddcsAlignRotate);
  await page.waitForSelector('#xform-badge', { state: 'attached', timeout: 8000 });   // editorOpHover created the badge at boot
  await mods(page);
  const r = await page.evaluate((P) => {
    const { PM, OB, PF, EM, T } = window.__M;
    const pocket = OB.makeOp('user_pocket_data', P, OB._builderAtoms('user_pocket_data', P));
    const orig = [PF.makeXform({ angle: 6.98, pivotX: 3, pivotY: -4 }), pocket];
    window.ddcsLoadBlockStack(orig);
    const nc = PM.serializeWithMarkers();                        // export
    const back = PM.importMarkedNc(nc);                          // reimport
    const emitOrig = EM.emitMapped(orig).text, emitBack = EM.emitMapped(back).text;
    return {
      progLine: nc.split('\n').find((l) => /@DDCS:\d+ \{"op":"prog"/.test(l)) || null,
      rot: T.programRotation(back),
      emitByteIdentical: emitOrig === emitBack,
      backStack: back,
    };
  }, POCKET);
  expect(r.progLine, 'a single program-level marker header carries the xform').toContain('"angle":6.98');
  expect(r.rot, 'the rotation declaration is restored on reimport').toMatchObject({ angle: 6.98, pivotX: 3, pivotY: -4 });
  expect(r.emitByteIdentical, 'the reimported program re-emits the SAME rotated G-code').toBe(true);
  // the badge: loading the reimported stack refreshes #xform-badge (onChange) with the angle
  const badge = await page.evaluate((back) => { window.ddcsLoadBlockStack(back); const b = document.getElementById('xform-badge'); return { hidden: b.hidden, text: b.textContent }; }, r.backStack);
  expect(badge.hidden, 'the rotation badge shows after reimport').toBe(false);
  expect(badge.text, 'the badge shows the restored angle').toContain('6.98');
});

test('a program-level ENTRY waypoint survives a .nc export → reimport (same slot)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsLoadBlockStack);
  await mods(page);
  const r = await page.evaluate((P) => {
    const { PM, OB, PF, EM } = window.__M;
    const pocket = OB.makeOp('user_pocket_data', P, OB._builderAtoms('user_pocket_data', P));
    const orig = [PF.makeEntry({ entryX: 12, entryY: -7 }), pocket];   // a program-level entry sibling, moved off the cut
    window.ddcsLoadBlockStack(orig);
    const nc = PM.serializeWithMarkers();
    const back = PM.importMarkedNc(nc);
    const en = back.find((b) => b.type === 'entry');
    return {
      progLine: nc.split('\n').find((l) => /@DDCS:\d+ \{"op":"prog"/.test(l)) || null,
      entry: en ? en.params : null,
      emitByteIdentical: EM.emitMapped(orig).text === EM.emitMapped(back).text,
      hasEntryMove: /G0 X12 Y-7\s+\( entry \)/.test(EM.emitMapped(back).text),
    };
  }, POCKET);
  expect(r.progLine, 'the entry rides the same program-level marker').toContain('"entryX":12');
  expect(r.entry, 'the entry declaration is restored').toMatchObject({ entryX: 12, entryY: -7 });
  expect(r.emitByteIdentical, 'the reimported program re-emits the SAME entry move').toBe(true);
  expect(r.hasEntryMove, 'the restored entry inserts its opening rapid').toBe(true);
});

test('UNSET → byte-identical export (NO prog marker; goldens untouched) + the marker parses on the registry path', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsLoadBlockStack);
  await mods(page);
  const r = await page.evaluate((P) => {
    const { PM, OB, OS, PF } = window.__M;
    const pocket = OB.makeOp('user_pocket_data', P, OB._builderAtoms('user_pocket_data', P));
    window.ddcsLoadBlockStack([pocket]);   // NO xform / entry
    const nc = PM.serializeWithMarkers();
    // parseMarker on the opSchema registry path round-trips the prog header
    const line = OS.markerLine('prog', { angle: 6.98, pivotX: 3, pivotY: -4, entryX: 12, entryY: -7 });
    const parsed = OS.parseMarker(line);
    return {
      noProg: !/@DDCS:\d+ \{"op":"prog"/.test(nc),
      isMarker: OS.isMarker(line),
      parsedOp: parsed.opType,
      parsedParams: parsed.params,
    };
  }, POCKET);
  expect(r.noProg, 'a program with no program-level declaration emits NO prog marker (byte-identical)').toBe(true);
  expect(r.isMarker, 'the prog header IS a valid @DDCS marker (numeric version)').toBe(true);
  expect(r.parsedOp, 'parseMarker returns the prog key').toBe('prog');
  expect(r.parsedParams, 'parseMarker round-trips the program-level params').toMatchObject({ angle: 6.98, pivotX: 3, pivotY: -4, entryX: 12, entryY: -7 });
});

test('BLOCKS round-trip: the reimported xform + entry survive a stack → Blockly → stack pass', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsLoadBlockStack && window.showApp);
  await mods(page);
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws);
  const out = await page.evaluate(async (P) => {
    const { PM, OB, PF } = window.__M;
    const { workspaceToStack } = await import('/blocks/blockly/stackBridge.js');
    const pocket = OB.makeOp('user_pocket_data', P, OB._builderAtoms('user_pocket_data', P));
    const orig = [PF.makeXform({ angle: 6.98, pivotX: 3, pivotY: -4 }), PF.makeEntry({ entryX: 12, entryY: -7 }), pocket];
    window.ddcsLoadBlockStack(orig);
    const back = PM.importMarkedNc(PM.serializeWithMarkers());   // .nc export → reimport
    window.ddcsLoadBlockStack(back);
    await new Promise((r) => setTimeout(r, 300));
    const rt = workspaceToStack(window.__blkws);
    const xf = rt.find((b) => b.type === 'xform'), en = rt.find((b) => b.type === 'entry');
    return { xform: xf ? xf.params : null, entry: en ? en.params : null };
  }, POCKET);
  expect(out.xform && Number(out.xform.angle), 'the xform survives the .nc reimport → Blockly round-trip').toBe(6.98);
  // Blockly fields are strings — the VALUE is what must survive
  expect(out.entry && Number(out.entry.entryX), 'the entry X survives the .nc reimport → Blockly round-trip').toBe(12);
  expect(out.entry && Number(out.entry.entryY), 'the entry Y survives the .nc reimport → Blockly round-trip').toBe(-7);
});
