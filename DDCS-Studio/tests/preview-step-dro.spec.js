import { test, expect } from '@playwright/test';

/**
 * t1203 (a) — STEPPING UPDATES THE DRO. When the sim is paused and the user steps with the next-line button, the DRO
 * (Work AND Mach) must read the COMPUTED tool position at the line just executed.
 *
 * The defect this pins: engine.step() declared "one step = one whole line" but an in-flight move RETURNED early, so a
 * click alternated — click 1 executed the line but left its move in flight (no position commit, no onPositionChange),
 * click 2 only landed it. The readout was therefore always ONE CLICK BEHIND the highlighted line. A fresh stepped run
 * also skipped play()'s setup, so the DRO showed the PREVIOUS run's numbers until the first commit.
 *
 * Asserts VALUES against an independent truth (the program's own coordinates + the declared WCS row), not "it changed".
 */
const BASE = 'http://localhost:3211';
const STEP = '#viz3d-panel-host .pp-step';
const WCS = { x: 10, y: 20, z: 0 };   // G54 — distinct from the program coords so Mach ≠ Work

async function mount(page, program) {
  await page.goto(BASE);
  await page.waitForFunction(() => !!window.ddcsGetSettings && typeof window.setGcodeView === 'function');
  await page.evaluate((wcs) => {
    const s = window.ddcsGetSettings();
    s.machine = { x: 600, y: 400, z: -120, show: true, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: [wcs] } };
    s.preview = s.preview || {}; s.preview.autoLoop = false;
  }, WCS);
  await page.locator('#editor').fill(program);
  await page.evaluate(() => window.setGcodeView('3d'));
  await page.waitForSelector(STEP, { state: 'attached', timeout: 8000 });
}

const readDro = (page) => page.evaluate(() => {
  const g = (ax, c) => { const r = document.querySelector(`#viz3d-panel-host .pp-dro-tbl tr[data-ax="${ax}"]`); return r ? parseFloat(r.querySelector(c).textContent) : NaN; };
  return { wx: g('x', '.pp-dro-w'), wy: g('y', '.pp-dro-w'), wz: g('z', '.pp-dro-w'), mx: g('x', '.pp-dro-m'), my: g('y', '.pp-dro-m') };
});

test('one step = one whole line: the DRO Work follows each stepped line, and Mach = Work + the declared WCS', async ({ page }) => {
  // one move per line, each landing on a DISTINCT coordinate so "one behind" is detectable
  await mount(page, 'G90\nG0 X30 Y40\nG0 X60\nG1 Z-10 F200\nM30');

  await page.locator(STEP).click();          // line 1: G90 (no motion) — the seeded baseline
  await page.waitForTimeout(150);
  const s1 = await readDro(page);
  expect(s1.wx, 'a non-motion line leaves Work X at the start (0), not stale garbage').toBe(0);
  expect(s1.mx, 'Mach = Work + G54.x even before any motion (the seed is honest)').toBe(WCS.x);

  await page.locator(STEP).click();          // line 2: G0 X30 Y40 — ONE click must land the whole move
  await page.waitForTimeout(150);
  const s2 = await readDro(page);
  expect(s2.wx, 'after ONE click the DRO shows the line just executed (X30) — not the previous line').toBe(30);
  expect(s2.wy, 'Y follows in the same click').toBe(40);
  expect(s2.mx, 'Mach X = Work + G54.x').toBe(30 + WCS.x);
  expect(s2.my, 'Mach Y = Work + G54.y').toBe(40 + WCS.y);

  await page.locator(STEP).click();          // line 3: G0 X60
  await page.waitForTimeout(150);
  const s3 = await readDro(page);
  expect(s3.wx, 'the next step advances exactly one line (X60)').toBe(60);
  expect(s3.wy, 'Y is unchanged by an X-only move').toBe(40);

  await page.locator(STEP).click();          // line 4: G1 Z-10
  await page.waitForTimeout(150);
  const s4 = await readDro(page);
  expect(s4.wz, 'a Z feed lands in one click too').toBe(-10);
});

test('the static scrub (click a code line) also moves the DRO, not just the tool', async ({ page }) => {
  await mount(page, 'G90\nG0 X30 Y40\nG0 X60\nM30');
  // seekLine is the "click a code line → see where the tool lands" seam; the DRO must follow the same computed position
  const after = await page.evaluate(async () => {
    const panel = window.__gpPanel || ((document.querySelector('.wiz-viz3d') || {}).__panel);   // the Studio editor's shared preview panel
    if (!panel || !panel.seekLine) return null;
    panel.seekLine(2);   // through the end of `G0 X60`
    await new Promise((r) => setTimeout(r, 200));
    const g = (ax, c) => { const r = document.querySelector(`#viz3d-panel-host .pp-dro-tbl tr[data-ax="${ax}"]`); return r ? parseFloat(r.querySelector(c).textContent) : NaN; };
    return { wx: g('x', '.pp-dro-w'), wy: g('y', '.pp-dro-w'), mx: g('x', '.pp-dro-m') };
  });
  test.skip(after === null, 'no panel/seekLine on this host');
  expect(after.wx, 'scrubbing to the end of line 2 puts Work X at 60').toBe(60);
  expect(after.wy, 'and Work Y at 40').toBe(40);
  expect(after.mx, 'Mach tracks the scrub too (one DRO writer derives both columns)').toBe(60 + WCS.x);
});

/**
 * t1207 — PLAY-then-STEP: one press = one LINE, and the readout holds across NON-MOTION lines.
 *
 * Reported as "the DRO updates on the first next-line press only, then freezes". It does not. Measured on the corner
 * macro: after the wall-1 slow probe the program runs a stretch of probe-result math (`IF #1921!=2 GOTO1`,
 * `#101=[#1926+#6]`, `#73=[#70+1]`, `#[#73]=#101`) — four lines that move nothing — so the position legitimately holds
 * while the executing-line chip keeps advancing; motion resumes on the next `G0`. This pins BOTH halves of the contract
 * so the correct behaviour can't be re-reported as a freeze, and a REAL freeze (the line stops advancing) still fails.
 */
test('play → step: every press advances exactly one line; the DRO holds only where the program has no motion', async ({ page }) => {
  test.setTimeout(120000);
  await mount(page, 'G90\nG0 X10 Y10\nG0 X20\nM30');   // mount just to reach the panel; the corner macro is loaded below
  const program = await page.evaluate(async () => {
    const CD = await import('/blocks/dataOps/cornerData.js');
    const { cornerStack } = await import('/wizards/cornerWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    return emitMapped(cornerStack({ ...CD.CORNER_DEFAULTS })).text;
  });
  await page.locator('#editor').fill(program);
  await page.evaluate(() => window.setGcodeView('3d'));
  await page.waitForSelector(STEP, { state: 'attached', timeout: 8000 });
  await page.click('#viz3d-panel-host .pp-run');     // PLAY first — the reported sequence (a fresh stepped run differs)
  await page.waitForTimeout(1500);

  const sample = async () => page.evaluate(() => {
    const g = (ax) => { const r = document.querySelector(`#viz3d-panel-host .pp-dro-tbl tr[data-ax="${ax}"]`); return r ? parseFloat(r.querySelector('.pp-dro-w').textContent) : NaN; };
    const chip = document.querySelector('#viz3d-panel-host .pp-status');
    const m = (chip ? chip.textContent : '').trim().match(/^(\d+)/);
    return { y: g('y'), line: m ? Number(m[1]) : null };
  });

  const seen = [];
  for (let i = 0; i < 16; i++) { await page.locator(STEP).click(); await page.waitForTimeout(120); seen.push(await sample()); }

  // (a) THE LINE ALWAYS ADVANCES — this is what a real freeze would break.
  const lines = seen.map((s) => s.line).filter((n) => Number.isFinite(n));
  expect(lines.length, 'the executing-line chip reports a line number').toBeGreaterThan(10);
  for (let i = 1; i < lines.length; i++) {
    expect(lines[i], `press ${i + 1} advanced past line ${lines[i - 1]} (a freeze would repeat it)`).toBeGreaterThan(lines[i - 1]);
  }
  // (b) the position is NOT stuck forever: over this window the tool moves more than once, so the holds are the
  //     program's own non-motion runs, not a stalled readout.
  const moves = seen.filter((s, i) => i > 0 && Math.abs(s.y - seen[i - 1].y) > 0.001).length;
  expect(moves, 'the DRO changes on the motion lines in this window (it is not frozen)').toBeGreaterThan(1);
});
