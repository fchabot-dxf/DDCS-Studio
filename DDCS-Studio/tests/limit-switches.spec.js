import { test, expect } from '@playwright/test';

// engine/limitSwitches.js — pure home/limit-switch trip model for the machine envelope, mirroring
// probeGeometry.stockProbeStop. HOME == the LIMIT position (one switch per axis-end; the machine-0
// end is also the home switch). Signed travel encodes which end home is at (Z<0 → homes at the top).
// These are PURE-function + virtualIO-integration tests (no engine hookup yet — that's deferred).
test.use({ viewport: { width: 1000, height: 800 } });

const BASE = process.env.DDCS_BASE_URL || 'http://localhost:3211';

// A standard XY-positive, Z-negative envelope (Z homes at the TOP = machine 0, travels down to -120),
// with every edge fitted to a pin so each switch can trip.
const MACHINE = { x: 300, y: 300, z: -120 };
const IO = {
  xMinPin: 7, xMinLevel: 0, xMaxPin: 8, xMaxLevel: 0,
  yMinPin: 9, yMinLevel: 0, yMaxPin: 10, yMaxLevel: 0,
  zMinPin: 11, zMinLevel: 0, zMaxPin: 12, zMaxLevel: 0,
};

async function trips(page, pos, machine = MACHINE, io = IO) {
  return page.evaluate(async ({ pos, machine, io }) => {
    const { limitSwitchTrips } = await import('/engine/limitSwitches.js');
    return limitSwitchTrips(pos, machine, io);
  }, { pos, machine, io });
}

test.beforeEach(async ({ page }) => {
  await page.goto(BASE);
  await page.waitForFunction(() => window.ddcsStudio);
});

test('inside the envelope → no switch trips', async ({ page }) => {
  const r = await trips(page, { x: 150, y: 150, z: -60 });
  expect(r).toEqual([]);
});

test('at/beyond the +X (max) edge → only the X-max limit trips (not home)', async ({ page }) => {
  const r = await trips(page, { x: 300, y: 150, z: -60 });
  expect(r.map((t) => t.edge)).toEqual(['x_max']);
  expect(r[0]).toMatchObject({ axis: 'x', side: 'max', pin: 8, isHome: false });

  // Beyond the edge (overtravel) still trips the same switch.
  const beyond = await trips(page, { x: 350, y: 150, z: -60 });
  expect(beyond.map((t) => t.edge)).toEqual(['x_max']);
});

test('at the 0 (min, X−) edge → X-min trips AND is the HOME switch (home == limit)', async ({ page }) => {
  const r = await trips(page, { x: 0, y: 150, z: -60 });
  expect(r.map((t) => t.edge)).toEqual(['x_min']);
  expect(r[0]).toMatchObject({ axis: 'x', side: 'min', isHome: true });   // home is the machine-0 end
});

test('Z signed-travel respected: home is at the TOP (z=0), limit at the bottom (z=-120)', async ({ page }) => {
  // z = 0 → the TOP. With Z travel = -120, machine-0 is the MAX end, so z_max trips and IS home.
  const top = await trips(page, { x: 150, y: 150, z: 0 });
  expect(top.map((t) => t.edge)).toEqual(['z_max']);
  expect(top[0]).toMatchObject({ axis: 'z', side: 'max', isHome: true });

  // z = -120 → the far/limit end (bottom). z_min trips and is NOT home.
  const bottom = await trips(page, { x: 150, y: 150, z: -120 });
  expect(bottom.map((t) => t.edge)).toEqual(['z_min']);
  expect(bottom[0]).toMatchObject({ axis: 'z', side: 'min', isHome: false });

  // Mid-travel → no Z trip.
  const mid = await trips(page, { x: 150, y: 150, z: -60 });
  expect(mid.filter((t) => t.axis === 'z')).toEqual([]);
});

test('a corner can trip multiple axes at once (X-min/home + Y-max)', async ({ page }) => {
  const r = await trips(page, { x: 0, y: 300, z: -60 });
  const byEdge = Object.fromEntries(r.map((t) => [t.edge, t]));
  expect(Object.keys(byEdge).sort()).toEqual(['x_min', 'y_max']);
  expect(byEdge.x_min.isHome).toBe(true);    // X home at 0
  expect(byEdge.y_max.isHome).toBe(false);   // Y max is the far end (Y travel +300 → home at min)
});

test('an un-fitted edge (no pin) never trips', async ({ page }) => {
  const io = { ...IO, xMaxPin: '' };   // remove the X+ switch
  const r = await trips(page, { x: 300, y: 150, z: -60 }, MACHINE, io);
  expect(r).toEqual([]);   // tool is at the +X edge but no switch is fitted there
});

test('virtualIO integration: setLimitSwitches flips the semantic + home + numbered pin inputs', async ({ page }) => {
  const r = await page.evaluate(async ({ pos, machine, io }) => {
    const lim = await import('/engine/limitSwitches.js');
    const vio = await import('/engine/virtualIO.js');
    vio.resetVirtualIO();
    const t = lim.limitSwitchTrips(pos, machine, io);   // at X−/home edge → pin 7
    vio.setLimitSwitches(t);
    return {
      semantic: vio.getVirtualInput('IN_LIMIT_X_MIN'),
      home: vio.getVirtualInput('IN_HOME_X'),
      numbered: vio.getVirtualInput('IN_7'),
      otherAxisClear: vio.getVirtualInput('IN_LIMIT_Y_MAX'),
    };
  }, { pos: { x: 0, y: 150, z: -60 }, machine: MACHINE, io: IO });
  expect(r.semantic).toBe(true);        // IN_LIMIT_X_MIN asserted
  expect(r.home).toBe(true);            // home alias asserted (machine-0 end)
  expect(r.numbered).toBe(true);        // numbered pin IN_7 asserted (shows in the I/O panel)
  expect(r.otherAxisClear).toBe(false); // an un-tripped edge stays clear
});

test('virtualIO integration: moving back inside clears a previously-tripped switch', async ({ page }) => {
  const cleared = await page.evaluate(async ({ machine, io }) => {
    const lim = await import('/engine/limitSwitches.js');
    const vio = await import('/engine/virtualIO.js');
    vio.resetVirtualIO();
    vio.setLimitSwitches(lim.limitSwitchTrips({ x: 0, y: 150, z: -60 }, machine, io));   // trip X−
    const before = vio.getVirtualInput('IN_LIMIT_X_MIN');
    vio.setLimitSwitches(lim.limitSwitchTrips({ x: 150, y: 150, z: -60 }, machine, io)); // back inside
    return { before, after: vio.getVirtualInput('IN_LIMIT_X_MIN') };
  }, { machine: MACHINE, io: IO });
  expect(cleared.before).toBe(true);
  expect(cleared.after).toBe(false);   // leaving the edge releases the switch
});
