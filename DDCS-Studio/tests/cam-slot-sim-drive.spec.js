import { test, expect } from '@playwright/test';

// Split from cam-slot-sim.spec.js at the TIER MIGRATION WORK PACKAGE 3 pass; the 11 pure tests moved to
// tests/node/cam-slot-sim.test.mjs. These 6 stayed.
//
// Three needed something the node stub obviously cannot provide: "auto-icon" calls data/autoIcon.js's
// autoIconBmp(), which does `document.createElement('canvas')` + `getContext('2d')` and draws with
// fillRect/strokeRect/measureText/fillText/getImageData — a real canvas 2D context, not the node harness's
// structural-only fake element; "preview panel mounts" builds a real host div and asserts
// `host.querySelector('.viz3d-controls')` against createPreviewPanel's injected DOM (querySelector always returns
// null off the node stub); "duplicate a legacy slot" drives the real macrosApp UI via
// document.getElementById('macros-app') + a live .click().
//
// The other three ("corner probe slot", "edge probe slot", "boss-centre slot") looked pure — plain
// import()+evaluate, plain returned data, no DOM/canvas touch — and were tried in the node tier first, but FAILED
// there: the first probe segment toward the machine's home-side edge (Y-/X- from the origin) came back as a
// zero-length "0" direction instead of a real probe move. Root-caused to GcodeExecutionEngine's "no stock →
// homing-seek envelope clamp" fallback (these tests never pass a `stock` option, so G31 clamps to the machine
// envelope edge unless `isTouchProbe` is true) behaving differently under the node stub than under a real
// Chromium boot — confirmed by running this exact unmodified spec in the real browser tier
// (`npx playwright test tests/cam-slot-sim.spec.js -g "corner probe slot|edge probe slot|boss-centre slot"`),
// where all three pass cleanly. Moved here rather than patched (register.mjs is off-limits, and the gap is in
// application code, out of scope for a test-tier migration).

test('corner probe slot: each corner probes the correct X/Y walls and every branch resolves', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { cornerSlot } = await import('/data/probeToSlot.js');
    const { slotMacro, mirrorVar } = await import('/data/slotPack.js');
    const { GcodeExecutionEngine } = await import('/engine/GcodeExecutionEngine.js');
    const s = cornerSlot();
    const macro = slotMacro({ slot: 22, name: s.name, fields: s.fields, body: s.body });
    const dirs = (ov) => {
      const seed = new Map(); s.fields.forEach((f) => seed.set(mirrorVar(f.idx), Number(f.def)));
      for (const [k, val] of Object.entries(ov)) { const f = s.fields.find((x) => x.key === k); if (f) seed.set(mirrorVar(f.idx), val); }
      const eng = new GcodeExecutionEngine({ createVarStore: () => new Map(seed) });
      const t = eng.trace(macro);
      const probes = t.segments.filter((g) => g.probe).map((g) => {
        const dx = g.x2 - g.x1, dy = g.y2 - g.y1, dz = g.z2 - g.z1;
        if (Math.abs(dz) > 1e-6) return 'Z' + (dz < 0 ? '-' : '+');
        if (Math.abs(dx) > 1e-6) return 'X' + (dx < 0 ? '-' : '+');
        if (Math.abs(dy) > 1e-6) return 'Y' + (dy < 0 ? '-' : '+');
        return '0';
      });
      return { capped: t.stats.capped, dirs: probes };
    };
    const lefts = (macro.match(/\[/g) || []).length, rights = (macro.match(/\]/g) || []).length;
    return {
      balanced: lefts === rights, hasNamedM: /M_\w+/.test(macro),
      fl: dirs({ corner: 1 }), fr: dirs({ corner: 2 }), bl: dirs({ corner: 3 }), br: dirs({ corner: 4 }),
      flXY: dirs({ corner: 1, seq: 1 }), brZ: dirs({ corner: 4, probeZ: 1 }),
    };
  });
  expect(r.balanced, 'brackets balance').toBe(true);
  expect(r.hasNamedM, 'no named M-codes').toBe(false);
  // two-pass probe (fast+slow) per axis; corner sets the wall directions.
  expect(r.fl.capped).toBe(false); expect(r.fl.dirs).toEqual(['Y+', 'Y+', 'X+', 'X+']);
  expect(r.fr.dirs).toEqual(['Y+', 'Y+', 'X-', 'X-']);
  expect(r.bl.dirs).toEqual(['Y-', 'Y-', 'X+', 'X+']);
  expect(r.br.dirs).toEqual(['Y-', 'Y-', 'X-', 'X-']);
  expect(r.flXY.dirs, 'XY sequence probes X wall first').toEqual(['X+', 'X+', 'Y+', 'Y+']);
  expect(r.brZ.dirs, 'Z-first prepends the Z surface probe').toEqual(['Z-', 'Z-', 'Y-', 'Y-', 'X-', 'X-']);
});

test('edge probe slot: axis/direction select the wall and the WCS axis written', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { edgeSlot } = await import('/data/probeToSlot.js');
    const { slotMacro, mirrorVar } = await import('/data/slotPack.js');
    const { GcodeExecutionEngine } = await import('/engine/GcodeExecutionEngine.js');
    const s = edgeSlot();
    const macro = slotMacro({ slot: 22, name: s.name, fields: s.fields, body: s.body });
    const dirs = (ov) => {
      const seed = new Map(); s.fields.forEach((f) => seed.set(mirrorVar(f.idx), Number(f.def)));
      for (const [k, val] of Object.entries(ov)) { const f = s.fields.find((x) => x.key === k); if (f) seed.set(mirrorVar(f.idx), val); }
      const t = new GcodeExecutionEngine({ createVarStore: () => new Map(seed) }).trace(macro);
      return t.segments.filter((g) => g.probe).map((g) => {
        const dx = g.x2 - g.x1, dy = g.y2 - g.y1;
        if (Math.abs(dx) > 1e-6) return 'X' + (dx < 0 ? '-' : '+');
        if (Math.abs(dy) > 1e-6) return 'Y' + (dy < 0 ? '-' : '+');
        return '0';
      });
    };
    const lefts = (macro.match(/\[/g) || []).length, rights = (macro.match(/\]/g) || []).length;
    // radius comp must be present (the bug we fixed): edge = trigger + sign*radius
    const hasComp = /#50=\[#1925\+#90\*#6\]/.test(macro.replace(/\s/g, ''));
    return { balanced: lefts === rights, hasComp, xp: dirs({ axis: 0, dir: 0 }), xn: dirs({ axis: 0, dir: 1 }), yp: dirs({ axis: 1, dir: 0 }) };
  });
  expect(r.balanced).toBe(true);
  expect(r.hasComp, 'edge applies radius comp').toBe(true);
  expect(r.xp).toEqual(['X+', 'X+']);
  expect(r.xn).toEqual(['X-', 'X-']);
  expect(r.yp).toEqual(['Y+', 'Y+']);
});

test('boss-centre slot: probes 4 faces from outside, 3 reposition prompts, writes centre', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { bossCentreSlot } = await import('/data/probeToSlot.js');
    const { slotMacro, mirrorVar } = await import('/data/slotPack.js');
    const { GcodeExecutionEngine } = await import('/engine/GcodeExecutionEngine.js');
    const s = bossCentreSlot();
    const macro = slotMacro({ slot: 22, name: s.name, fields: s.fields, body: s.body });
    const seed = new Map(); s.fields.forEach((f) => seed.set(mirrorVar(f.idx), Number(f.def)));
    const t = new GcodeExecutionEngine({ createVarStore: () => new Map(seed) }).trace(macro);
    const probes = t.segments.filter((g) => g.probe).map((g) => {
      const dx = g.x2 - g.x1, dy = g.y2 - g.y1;
      return Math.abs(dx) > 1e-6 ? 'X' + (dx < 0 ? '-' : '+') : Math.abs(dy) > 1e-6 ? 'Y' + (dy < 0 ? '-' : '+') : '0';
    });
    const lefts = (macro.match(/\[/g) || []).length, rights = (macro.match(/\]/g) || []).length;
    return { balanced: lefts === rights, capped: t.stats.capped, probes, prompts: (macro.match(/REPOSITION/g) || []).length, writesWcs: /#\[#70\]=#53/.test(macro) && /#\[#73\]=#56/.test(macro) };
  });
  expect(r.balanced).toBe(true); expect(r.capped).toBe(false);
  expect(r.probes, 'each face probed from outside').toEqual(['X-', 'X-', 'X+', 'X+', 'Y-', 'Y-', 'Y+', 'Y+']);
  expect(r.prompts, '3 operator repositions around the boss').toBe(3);
  expect(r.writesWcs, 'writes the centre to WCS X/Y').toBe(true);
});

test('auto-icon renders a valid 360x180 BMP from the op name/kind', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { autoIconBmp } = await import('/data/autoIcon.js');
    const url = autoIconBmp('Probe corner', 'corner');
    const bin = atob(url.split(',')[1]);
    const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const rd = (o) => u[o] | (u[o + 1] << 8) | (u[o + 2] << 16) | (u[o + 3] << 24);   // LE int32
    return { isBmp: url.startsWith('data:image/bmp;base64,'), magic: bin.slice(0, 2), w: rd(18), h: rd(22), pocketOk: autoIconBmp('Pocket (rect)', 'pocket').startsWith('data:image/bmp') };
  });
  expect(r.isBmp).toBe(true);
  expect(r.magic, 'BMP signature').toBe('BM');
  expect(r.w, 'width 360').toBe(360);
  expect(r.h, 'height 180').toBe(180);
  expect(r.pocketOk).toBe(true);
});

test('preview panel mounts on a seeded slot macro without throwing', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const ok = await page.evaluate(async () => {
    const { slotFromOp } = await import('/data/opToSlot.js');
    const { slotMacro, mirrorVar } = await import('/data/slotPack.js');
    const { createPreviewPanel } = await import('/viz/createPreviewPanel.js');
    const s = slotFromOp('drill', 'grid');
    const macro = slotMacro({ slot: 22, name: s.name, fields: s.fields, body: s.body });
    const seed = new Map();
    s.fields.forEach((f) => seed.set(mirrorVar(f.idx), Number(f.def)));
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute;width:400px;height:300px;left:-9999px';
    document.body.appendChild(host);
    const panel = createPreviewPanel(host, { getGcode: () => macro, createVarStore: () => new Map(seed) });
    panel.setActive(true);
    // createPreviewPanel tags the CONTAINER itself and injects its controls/status DOM into it.
    const mounted = host.classList.contains('preview-panel') && !!host.querySelector('.viz3d-controls') && typeof panel.stop === 'function';
    panel.stop(); panel.setActive(false); host.remove();
    return mounted;
  });
  expect(ok, 'createPreviewPanel built its DOM + exposed stop()').toBe(true);
});

test('duplicate a legacy (hand-built) slot remaps its #params off the original — no collision', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    localStorage.setItem('ddcs_campack', JSON.stringify({ meta: { name: 't', baseSlot: 22 }, slots: [{
      slot: 22, name: 'Manual', fields: [
        { idx: 1100, var: '#1', label: 'Depth', units: 'mm', def: 5, min: 0, max: 99, type: 1, key: 'depth' },
        { idx: 1101, var: '#2', label: 'Feed', units: 'mm/min', def: 300, min: 1, max: 9999, type: 0, key: 'feed' },
      ], body: '#1=#2600   ;Depth [mm] =5 [0~99]\n#2=#2601   ;Feed [mm/min] =300 [1~9999]\nG1 Z[0-#1] F#2\nM30' }] }));
    const mod = await import('/ui/macrosApp.js'); mod.initMacrosApp();
    const root = document.getElementById('macros-app');
    root.querySelector('.cam-slot [data-act="dupslot"]').click();   // dupslot is KEPT in the read-mostly display
    // S1 — the settings field-table + macro textarea DOM is gone; assert on the persisted slot DATA instead
    // (the duplicated slot's fields idx + its body) rather than re-reading the removed second-editor UI.
    const pack = JSON.parse(localStorage.getItem('ddcs_campack'));
    const orig = pack.slots[0], clone = pack.slots[1];
    return {
      camNums: pack.slots.map((s) => s.slot),
      origIdx: orig.fields.map((f) => f.idx),
      cloneShares: clone.fields.some((f) => orig.fields.some((g) => g.idx === f.idx)),
      origKeeps2600: /=#2600/.test(orig.body),
      cloneRemapped: /#1=#2602/.test(clone.body),
      calcUntouched: /G1 Z\[0-#1\] F#2/.test(clone.body),
      noCollision: !/⛔/.test(root.querySelector('#cam_validate').textContent),
    };
  });
  expect(r.camNums, 'clone minted the next cam number').toEqual([22, 23]);
  expect(r.origIdx, 'the original params are unchanged').toEqual([1100, 1101]);
  expect(r.cloneShares, 'clone remapped to params disjoint from the original — no collision').toBe(false);
  expect(r.origKeeps2600).toBe(true);
  expect(r.cloneRemapped, 'clone read-line mirror remapped').toBe(true);
  expect(r.calcUntouched, 'working-var calc lines untouched by the remap').toBe(true);
  expect(r.noCollision).toBe(true);
});
