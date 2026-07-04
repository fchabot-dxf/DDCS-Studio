import { test, expect } from '@playwright/test';

/**
 * ATC SETUP DRAG CANVAS (GUI-1) — a 2D top-down of the machine frame where the operator DRAGS the magazine pockets,
 * the disk pickup, and the firmware push-station points instead of typing machine coords. SAFE / sim-side / ZERO
 * controller write: the generic/disk coords write the EXISTING config (settings.atc.magazine / .pickup, emitted as
 * literals as always); the firmware points write a NEW settings.atc.firmwareStation store that VAR-SEEDS the sim so
 * the station renders from the store instead of untaught-0 (the P-C.1a limitation). Asserts the VALUE: a drag writes
 * the config/store at the exact cursor world point, the sim station renders from the store, and NOTHING is pushed.
 */
test.use({ viewport: { width: 1280, height: 900 } });

async function openAtcTab(page) {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetSettings && window.ddcsStudio && window.ddcsStudio.wizardManager);
  await page.evaluate(() => {
    const s = window.ddcsGetSettings();
    s.machine = { x: 600, y: 400, z: -120, show: true, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: null } };
    s.hardwareTabs = s.hardwareTabs || {}; s.hardwareTabs.atc = true;
    s.atc = s.atc || {};
    s.atc.magType = 'straight';
    s.atc.magazine = [{ pocket: 1, tool: 2, x: 100, y: 100, z: -50 }, { pocket: 2, tool: 5, x: 200, y: 100, z: -50 }];
    s.atc.tools = [{ num: 2, dia: 8 }, { num: 5, dia: 6 }];
    s.atc.firmwareStation = null;
    window.ddcsSaveSettings && window.ddcsSaveSettings();
    window.openSettings({ group: 'hardware', panel: 'set_tab_atc' });
  });
  // the canvas mounts with draggable handles (one FeatureCanvas per container)
  await page.waitForFunction(() => { const c = document.querySelector('#atc_setup_canvas'); return c && c.__atcFc && c.__atcFc._tf && c.querySelector('svg .fc-handle'); }, null, { timeout: 8000 });
  await page.evaluate(() => document.querySelector('#atc_setup_canvas').scrollIntoView({ block: 'center' }));
}

/** Client (viewport) coords of a machine-world point on the canvas, via the live FeatureCanvas transform. */
async function clientOfWorld(page, wx, wy) {
  return page.evaluate(({ wx, wy }) => {
    const c = document.querySelector('#atc_setup_canvas');
    const s = c.__atcFc._S(wx, wy);                     // world → viewBox px (viewBox is 1:1 with the svg's client px)
    const r = c.querySelector('svg').getBoundingClientRect();
    return { x: r.left + s.x, y: r.top + s.y };
  }, { wx, wy });
}

async function drag(page, from, to) {
  const a = await clientOfWorld(page, from.x, from.y);
  const b = await clientOfWorld(page, to.x, to.y);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up();
}

test('dragging a generic pocket handle writes settings.atc.magazine at the cursor world point — no controller write', async ({ page }) => {
  await openAtcTab(page);
  await page.evaluate(() => {
    window.__writes = [];
    const of = window.fetch;
    window.fetch = (...a) => { const m = (a[1] && a[1].method) || 'GET'; if (/^(POST|PUT|PATCH|DELETE)$/i.test(m)) window.__writes.push(m + ' ' + a[0]); return of.apply(window, a); };
  });
  // pocket 1 starts at machine (100,100); drag it to (150,130)
  await drag(page, { x: 100, y: 100 }, { x: 150, y: 130 });
  const r = await page.evaluate(() => ({ p0: window.ddcsGetSettings().atc.magazine[0], p1: window.ddcsGetSettings().atc.magazine[1], writes: window.__writes }));
  // (a) the dragged pocket landed at the exact cursor world point (independent target)
  expect(Math.round(r.p0.x), 'pocket X = the dragged world X').toBe(150);
  expect(Math.round(r.p0.y), 'pocket Y = the dragged world Y').toBe(130);
  // (b) only the dragged pocket moved (the other is untouched — the drag is surgical)
  expect({ x: r.p1.x, y: r.p1.y }, 'the other pocket is untouched').toEqual({ x: 200, y: 100 });
  // (c) SCOPE GUARD: the drag is sim-side — NOTHING is written to the controller
  expect(r.writes, 'no controller write (POST/PUT) on a setup drag').toEqual([]);
});

test('dragging a firmware push-station point writes the settings.atc.firmwareStation store', async ({ page }) => {
  await openAtcTab(page);
  // firmwareStation starts null → the canvas shows default points; grab PUSH START at its default and drag it to (300,250)
  const start = await page.evaluate(() => { const h = [...document.querySelectorAll('#atc_setup_canvas svg [data-hid="fw:pushStart"]')][0]; return !!h; });
  expect(start, 'a draggable PUSH START handle exists').toBe(true);
  const from = await page.evaluate(() => { const st = window.ddcsGetSettings().atc.firmwareStation; return st && st.pushStart; });
  expect(from, 'the store is still untaught before the drag (null)').toBeNull();
  // read the default handle world (from the canvas spec) to grab it
  const def = await page.evaluate(() => {
    const c = document.querySelector('#atc_setup_canvas');
    const h = c.__atcFc.spec.handles.find((x) => x.id === 'fw:pushStart');
    return { x: h.x, y: h.y };
  });
  await drag(page, def, { x: 300, y: 250 });
  const st = await page.evaluate(() => window.ddcsGetSettings().atc.firmwareStation);
  expect(st, 'the firmwareStation store is now materialized').not.toBeNull();
  expect(Math.round(st.pushStart.x), 'pushStart X = the dragged world X').toBe(300);
  expect(Math.round(st.pushStart.y), 'pushStart Y = the dragged world Y').toBe(250);
  // the other two points were materialized (from the on-canvas defaults) so the store + seed are coherent
  expect(st.pushEnd && Number.isFinite(Number(st.pushEnd.x)), 'pushEnd materialized').toBe(true);
  expect(st.retreat && Number.isFinite(Number(st.retreat.y)), 'retreat materialized').toBe(true);
});

test('the firmware sim station renders from the firmwareStation store (var-seed kills untaught-0)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetSettings && window.ddcsStudio && window.ddcsStudio.wizardManager);
  await page.evaluate(() => {
    const s = window.ddcsGetSettings();
    s.machine = { x: 600, y: 400, z: -120, show: true, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: null } };
    s.atc = s.atc || {};
    // a TAUGHT (Studio-authored) firmware station — the sim must render from THESE values, not 0
    s.atc.firmwareStation = { safeZ: -15, pushStart: { x: 321, y: 222 }, pushEnd: { x: 340, y: 222 }, retreat: { x: 340, y: 205 } };
    window.ddcsSaveSettings && window.ddcsSaveSettings();
  });
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('atc_change'));
  await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 });
  await page.evaluate(() => { const sel = document.getElementById('atc_change_method'); sel.value = 'firmware'; sel.dispatchEvent(new Event('change', { bubbles: true })); window.ddcsStudio.wizardManager.update(); });
  await page.waitForFunction(() => { const v = document.getElementById('atcChangeViz').parentElement.querySelector('.wiz-viz3d').__panel.viz; return v && v._station; }, null, { timeout: 8000 });
  const st = await page.evaluate(() => document.getElementById('atcChangeViz').parentElement.querySelector('.wiz-viz3d').__panel.viz._station);
  // the highlighted station region resolves from the STORE (#1320/1321 push-start = 321/222), not the untaught 0
  expect(Math.round(st.start.x), 'station push-start X seeded from the store, not 0').toBe(321);
  expect(Math.round(st.start.y), 'station push-start Y seeded from the store, not 0').toBe(222);
  expect(Math.round(st.end.x), 'station push-end X seeded from the store').toBe(340);
  expect(Math.round(st.z), 'station safe-Z (#1306) seeded from the store').toBe(-15);
  expect(st.start.x, 'NOT the untaught-0 origin').not.toBe(0);
});

test('the setup canvas is a coherent MACHINE frame — home + axes at machine 0, envelope = travel extents (not a part datum)', async ({ page }) => {
  await openAtcTab(page);   // machine 600 × 400
  const r = await page.evaluate(() => {
    const c = document.querySelector('#atc_setup_canvas');
    const fc = c.__atcFc, svg = c.querySelector('svg');
    const texts = [...svg.querySelectorAll('text')].map((t) => t.textContent);
    const env = [...svg.querySelectorAll('rect')].find((el) => (el.getAttribute('stroke') || '') === '#4a6a8a');
    return {
      hasPartCrosshair: !!svg.querySelector('.fc-axis-x'),
      axisLabels: texts.filter((t) => ['+X', '-X', '+Y', '-Y'].includes(t)).sort(),
      hasHome: texts.some((t) => /HOME/.test(t)),
      machine: fc.spec.machine,
      scale: fc._tf.scale,
      env: env ? { x: +env.getAttribute('x'), y: +env.getAttribute('y'), w: +env.getAttribute('width'), h: +env.getAttribute('height') } : null,
      sTopLeft: fc._S(0, 400),   // screen point of the envelope's world top-left corner (0, m.y)
    };
  });
  // the frame SWITCHED from part-datum to machine: the part-zero crosshair is gone, the machine chrome is present
  expect(r.hasPartCrosshair, 'no part-datum crosshair — this is the MACHINE frame').toBe(false);
  expect(r.axisLabels, 'the +X/-X/+Y/-Y machine axis labels are drawn').toEqual(['+X', '+Y', '-X', '-Y'].sort());
  expect(r.hasHome, 'a machine HOME marker sits at coord 0').toBe(true);
  // the frame == the machine travel extents; the envelope rect corners map to machine 0..extents (independent truth via the live transform)
  expect(r.machine, 'the canvas frame = the machine travel extents').toMatchObject({ x: 600, y: 400 });
  expect(r.env, 'the envelope rect is drawn').not.toBeNull();
  expect(Math.round(r.env.x), 'envelope left edge = world x0 (home column)').toBe(Math.round(r.sTopLeft.x));
  expect(Math.round(r.env.y), 'envelope top edge = world (0, m.y)').toBe(Math.round(r.sTopLeft.y));
  expect(Math.round(r.env.w), 'envelope width = m.x (600 mm) in screen px').toBe(Math.round(600 * r.scale));
  expect(Math.round(r.env.h), 'envelope height = m.y (400 mm) in screen px').toBe(Math.round(400 * r.scale));
});
