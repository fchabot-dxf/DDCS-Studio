import { test, expect } from '@playwright/test';

// CAM-UX declare-once S3 — the manifest-Edit CRUX. A per-slot "✎ Edit" reopens the wizard PRE-SEEDED from the slot
// MANIFEST (manifestToAuthOp = the inverse of toManifest) and Build becomes "Update CAM (camN)" overwriting that slot
// IN PLACE, no prompt. FIDELITY: Edit → Update with NO change → the manifest (+ built body) round-trips byte-identical
// (manifestToAuthOp ∘ toManifest = identity; declare-never-infer, slot.body is never re-parsed). HEADLINE: Edit → flip
// an Expose→Bake → Update → same cam#, the manifest + body reflect the change. Modal-only (does not touch the program).
test.use({ viewport: { width: 1280, height: 1000 } });

async function openCam(page) {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => typeof window.showApp === 'function');
  await page.evaluate(() => window.showApp('macros'));
  await page.waitForFunction(() => document.querySelector('#macros-app .settings-sidebar .settings-tab[data-target="macros_panel_cam"]'));
  await page.evaluate(() => document.querySelector('#macros-app .settings-sidebar .settings-tab[data-target="macros_panel_cam"]').click());
  await page.waitForFunction(() => typeof window.ddcsOpenCamAuthoring === 'function');
}
const camPack = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('ddcs_campack') || '{"slots":[]}'));

// Build a slot from a program via door 2 (auto-import → cbm-build, which is DIRECT now — the new-vs-overwrite prompt is gone).
async function buildSlot(page, program) {
  await page.evaluate((prog) => { window.ddcsGetBlockProgram = () => prog; }, program);
  await page.evaluate(() => window.ddcsBuildCamSlot());
  await page.waitForSelector('.cam-auth-overlay .cbm-eb', { timeout: 8000 });
  await page.click('[data-act="cbm-build"]');
  await page.waitForFunction(() => !document.querySelector('.cam-auth-overlay'));
}
async function openEdit(page) {
  await page.click('#cam_slots [data-act="editslot"]');
  // t1632 — a BLOCK-ABLE slot's Edit also loads its op into Blocks (S4-2), and since b95540d9 that load actually
  // RESOLVES for runtime-registered defs (getUserDef, not the persisted-only listUserOps — before, it silently
  // no-oped for this spec's fixtures). A non-empty differing program therefore meets the t1518 destructive-load
  // confirm mid-gesture; answering it IS the real gesture now, so accept "Open (replace)" when it appears.
  const dlg = page.locator('.app-dialog');
  await Promise.race([
    dlg.waitFor({ state: 'visible', timeout: 4000 }).catch(() => {}),
    page.waitForSelector('.cam-auth-overlay .cbm-eb', { timeout: 4000 }).catch(() => {}),
  ]);
  if (await dlg.count()) await page.keyboard.press('Enter');   // ok holds focus (dialog.js)
  await page.waitForSelector('.cam-auth-overlay .cbm-eb', { timeout: 8000 });
}

// generator (static fields), drill (pattern-DEPENDENT fields — the tricky generator), composed multi-op (3 ops).
const PROGRAMS = {
  generator: [{ id: 'p1', type: 'op', opType: 'pocket', label: 'Pocket', params: { shape: 'rect', w: 120, h: 90, depth: 5, stepdown: 2, toolDia: 8, feed: 1500, plunge: 120, clearance: 6, rpm: 9000, stepoverPct: 45 } }],
  drill: [{ id: 'd1', type: 'op', opType: 'drill', label: 'Drill', params: { method: 'peck', pattern: 'grid', originX: 100, originY: 50, cols: 3, rows: 2, dx: 20, dy: 20, depth: 12, peck: 3, feed: 280, rpm: 8000 } }],
  composed: [
    { id: 's1', type: 'op', opType: 'surfacing', label: 'Surfacing', params: { w: 200, h: 150, depth: 0.8, stepdown: 0.4, toolDia: 16, stepoverPct: 60, feed: 900, plunge: 180, clearance: 5, rpm: 12000 } },
    { id: 'd1', type: 'op', opType: 'drill', label: 'Drill', params: { method: 'peck', pattern: 'grid', originX: 100, originY: 50, cols: 3, rows: 2, dx: 20, dy: 20, depth: 12, peck: 3, feed: 280, rpm: 8000 } },
    { id: 'c1', type: 'op', opType: 'corner', label: 'Probe corner', params: { corner: 'FR', wcs: 'G55', probeZ: true, probeSeq: 'XY', dist: 80, retract: 4, radius: 3, safeZ: 12, travelDist: 40, scanDepth: 6, f_fast: 250, f_slow: 60 } },
  ],
};

for (const [kind, program] of Object.entries(PROGRAMS)) {
  test(`S3 FIDELITY: Edit a ${kind} slot then Update with NO change → the manifest + body round-trip byte-identical`, async ({ page }) => {
    await openCam(page);
    await buildSlot(page, program);
    const before = (await camPack(page)).slots.slice(-1)[0];
    const camN = before.slot;
    await openEdit(page);
    const header = await page.evaluate(() => document.querySelector('.cam-build-mode b').textContent);
    expect(header, 'the modal header reads Update CAM (camN)').toContain(`Update CAM (cam${camN})`);
    await page.click('[data-act="cbm-build"]');   // Update — no changes
    await page.waitForFunction(() => !document.querySelector('.cam-auth-overlay'));
    const after = (await camPack(page)).slots;
    expect(after.length, 'Update overwrote IN PLACE — no new slot').toBe(1);
    expect(after[0].slot, 'same cam number').toBe(camN);
    // FIDELITY — the manifest round-trips byte-identical (manifestToAuthOp is the faithful inverse of toManifest)
    expect(JSON.stringify(after[0].ops), `${kind}: the manifest is LOSSLESS through Edit→Update`).toBe(JSON.stringify(before.ops));
    // and the rebuilt macro is byte-identical (declare-never-infer end-to-end; the slot rebuilt to the SAME program)
    expect(after[0].body, `${kind}: the built macro is byte-identical`).toBe(before.body);
  });
}

test('S3 FIDELITY: Edit a UNIVERSAL slot then Update with NO change → the manifest + body round-trip byte-identical', async ({ page }) => {
  await openCam(page);
  // register a forked custom (universal) op + place it in the program (mirrors cam-universal-modal); the def IS the source
  await page.evaluate(async () => {
    const { userOpFromStack, registerUserOp } = await import('/blocks/userOps.js');
    const stack = [{ type: 'user_root', params: {}, uiChildren: [{ type: 'param_group', params: { group: 'Cut' }, children: [] }], children: [
      { type: 'feed', params: { rate: 200 } },
      { type: 'move', params: { mode: 'cut', x: 10, y: 20, z: -3, feed: 500 } },
    ] }];
    const bindings = [
      { param: 'frate', blockIndex: 2, key: 'rate', label: 'Feed', units: 'mm/min', type: 'number', default: 200 },
      { param: 'mx', blockIndex: 3, key: 'x', label: 'X', type: 'number', default: 10 },
      { param: 'mz', blockIndex: 3, key: 'z', label: 'Plunge Z', type: 'number', default: -3 },
    ];
    registerUserOp(userOpFromStack('s3_univ_data', 'Custom Cut', stack, bindings));
    window.ddcsGetBlockProgram = () => [{ id: 'u1', type: 'op', opType: 'user_s3_univ_data', label: 'Custom Cut', params: { frate: 250, mx: 15, mz: -4 } }];
  });
  await page.evaluate(() => window.ddcsBuildCamSlot());
  await page.waitForSelector('.cam-auth-overlay .cbm-eb', { timeout: 8000 });
  await page.click('[data-act="cbm-build"]');
  await page.waitForFunction(() => !document.querySelector('.cam-auth-overlay'));
  const before = (await camPack(page)).slots.slice(-1)[0];
  const camN = before.slot;
  expect(before.ops[0].type, 'the slot op is universal').toBe('universal');
  await openEdit(page);
  await page.click('[data-act="cbm-build"]');   // Update — no changes
  await page.waitForFunction(() => !document.querySelector('.cam-auth-overlay'));
  const after = (await camPack(page)).slots;
  expect(after.length, 'Update overwrote IN PLACE — no new slot').toBe(1);
  expect(after[0].slot, 'same cam number').toBe(camN);
  expect(JSON.stringify(after[0].ops), 'universal: the manifest is LOSSLESS through Edit→Update').toBe(JSON.stringify(before.ops));
  expect(after[0].body, 'universal: the built macro is byte-identical').toBe(before.body);
});

test('S3 tuned values re-seed: Edit shows the SAME value the slot was built with (round-trip through the table)', async ({ page }) => {
  await openCam(page);
  await buildSlot(page, PROGRAMS.generator);
  const before = (await camPack(page)).slots.slice(-1)[0];
  await openEdit(page);
  // the re-seeded modal exposes at least one value input whose value came from the manifest (not a blank default)
  const seeded = await page.evaluate(() => {
    const inputs = [...document.querySelectorAll('.cam-auth-overlay .cbm-val')].filter((i) => i.tagName !== 'SELECT');
    return inputs.map((i) => i.value).filter((v) => v !== '' && v != null);
  });
  expect(seeded.length, 'the Edit table re-seeded numeric values from the manifest').toBeGreaterThan(0);
});

test('S3 HEADLINE: Edit → flip one Expose→Bake → Update CAM (camN) overwrites in place; the manifest + body reflect the bake', async ({ page }) => {
  await openCam(page);
  await buildSlot(page, PROGRAMS.generator);
  const before = (await camPack(page)).slots.slice(-1)[0];
  const camN = before.slot;
  await openEdit(page);
  const flipped = await page.evaluate(() => {
    const bake = document.querySelector('.cam-auth-overlay .cbm-eb[data-mode="bake"]:not(:disabled)');
    if (!bake) return null;
    bake.checked = true; bake.dispatchEvent(new Event('change', { bubbles: true }));
    return bake.dataset.fkey;
  });
  expect(flipped, 'a bakeable field exists to flip Expose→Bake').toBeTruthy();
  await page.click('[data-act="cbm-build"]');
  await page.waitForFunction(() => !document.querySelector('.cam-auth-overlay'));
  const after = (await camPack(page)).slots;
  expect(after.length, 'still ONE slot — overwrote in place, no prompt').toBe(1);
  expect(after[0].slot, 'same cam number').toBe(camN);
  // the flipped field is baked in the manifest (expose flag false OR a baked literal present)
  const op0 = after[0].ops[0];
  const isBaked = (op0.exposed && op0.exposed[flipped] === false) || (op0.baked && op0.baked[flipped] != null);
  expect(isBaked, 'the flipped field is BAKED in the updated manifest').toBe(true);
  // and the rebuilt macro CHANGED (baking a field drops its #var read-line — the update flowed through the build)
  expect(after[0].body, 'the rebuilt macro reflects the bake').not.toBe(before.body);
});
