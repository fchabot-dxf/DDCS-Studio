import { test, expect } from '@playwright/test';

/**
 * H3 — per-axis HOME DIRECTION: one-source default (the signed envelope) + an explicit override that
 * round-trips. Verifies the REAL symptom on all three legs:
 *   1. DEFAULT = the signed machine travel (settings.machine.<axis> sign) — Auto derives it; no second source.
 *   2. OVERRIDE flips BOTH the SEEK (G31) emitted seek-distance sign AND the sim-proxy motion direction.
 *   3. NATIVE (M98 P501) is byte-UNCHANGED by the override (the controller uses its own config; sim-only there).
 *   4. The dir override round-trips through the op marker codec (it rides the already-declared `config` Struct).
 * The default (Auto / dir unset) stays byte-identical to a config with no `dir` key — the override only changes
 * output when explicitly set.
 */
test('homing dir override: signed-envelope default + per-axis override flips seek emit & sim, native unchanged, round-trips', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async () => {
    const { homingStack, homingSimProxy } = await import('/wizards/homingWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { markerLine, parseMarker } = await import('/blocks/opSchema.js');

    const emit = (params) => emitMapped(homingStack(params)).text;
    // X has a POSITIVE machine travel (300) → its signed-envelope home direction is +.
    const machine = { x: 300, y: 300, z: -120 };

    // ── SEEK method on X. The seek-distance line is `#102=<signed seek dist>` (homingWizard.js). ──
    const seekCfg = (dir) => ({ x: { enable: true, method: 'seek', backoff: 5, seekPasses: 1, dir } });
    const seekParams = (dir, extra) => ({ axes: ['x'], config: seekCfg(dir), machine, ...extra });

    const seekAuto = emit(seekParams(''));      // Auto → derive from the +300 envelope → +10000
    const seekPlus = emit(seekParams('+'));     // forced + → +10000
    const seekMinus = emit(seekParams('-'));    // forced − → -10000

    // BYTE-IDENTICAL default: a config that NEVER mentions dir must equal Auto (dir:'').
    const cfgNoDir = { x: { enable: true, method: 'seek', backoff: 5, seekPasses: 1 } };
    const seekNoDirKey = emit({ axes: ['x'], config: cfgNoDir, machine });

    // Auto with UNKNOWN travel (machine.x absent) → defers to the controller's #612 register (not a literal).
    const seekAutoNoTravel = emit({ axes: ['x'], config: seekCfg(''), machine: {} });

    // ── SIM PROXY on X (positive travel 300). The seek line is `G53 G0 X<end>`; the sign of <end> is the dir. ──
    const simEnd = (dir) => {
      const text = homingSimProxy({ axes: ['x'], config: { x: { method: 'seek', backoff: 5, dir } }, machine });
      const m = text.match(/G53 G0 X(-?[\d.]+)/);
      return m ? parseFloat(m[1]) : null;
    };
    // H1 (t481): the sim seeks the HOME end = machine-0 (0) by default; the dir override picks the max/min end.
    const simAuto = simEnd('');     // Auto → machine-0 (x=0)
    const simPlus = simEnd('+');    // + → the +X (max) end = 300
    const simMinus = simEnd('-');   // − → the −X (min = machine-0) end = 0

    // ── NATIVE method: the override must NOT change the emit (M98 P501 reads the controller's own config). ──
    const nativeCfg = (dir) => ({ x: { enable: true, method: 'native', dir } });
    const nativeAuto = emit({ axes: ['x'], config: nativeCfg(''), machine });
    const nativeMinus = emit({ axes: ['x'], config: nativeCfg('-'), machine });

    // ── ROUND-TRIP: dir rides the homing op's `config` Struct through the marker codec. ──
    const cfgForRoundtrip = {
      x: { enable: true, method: 'seek', backoff: 5, dir: '-' },
      y: { enable: true, method: 'native', dir: '' },
      z: { enable: true, method: 'seek', backoff: 5, dir: '+' },
    };
    const opParams = { axes: ['z', 'x'], config: cfgForRoundtrip, machine, softLimits: true };
    const line = markerLine('homing', opParams);
    const parsed = parseMarker(line);

    return {
      seekAuto, seekPlus, seekMinus, seekNoDirKey, seekAutoNoTravel,
      simAuto, simPlus, simMinus,
      nativeAuto, nativeMinus,
      roundtripDir: parsed && parsed.params && parsed.params.config
        ? { x: parsed.params.config.x.dir, y: parsed.params.config.y.dir, z: parsed.params.config.z.dir }
        : null,
      roundtripOp: parsed && parsed.opType,
    };
  });

  // 1+2 SEEK emit: the seek-distance literal is signed by the resolved direction.
  expect(r.seekMinus, 'override − flips the seek distance negative').toContain('#102=-10000');
  expect(r.seekPlus, 'override + → positive seek distance').toContain('#102=10000');
  // Auto derives + from the +300 envelope (NOT the controller #612 path — travel is known).
  expect(r.seekAuto, 'Auto with a known +envelope → +10000 (one source)').toContain('#102=10000');
  expect(r.seekAuto, 'Auto with a known envelope does NOT fall back to #612').not.toContain('#[612');
  // Default is byte-identical whether dir is '' or absent entirely.
  expect(r.seekNoDirKey, 'a config with NO dir key emits identically to Auto').toBe(r.seekAuto);
  // Auto with unknown travel defers to the controller register (the documented fallback).
  expect(r.seekAutoNoTravel, 'Auto + unknown envelope → defer to controller #612').toContain('20000*#[612+#100]-10000');

  // 2 H1 (t481): the sim SEEKS THE HOME END. Auto → machine-0 (x=0). The override picks a specific end: + → the +X (max)
  // far end (300); − → the −X (min) end, which for a +300 envelope IS machine-0 (0). (Was: the buggy signed-travel far end,
  // and − even drove to −300, OUTSIDE the [0,300] envelope.)
  expect(r.simAuto, 'sim Auto homes to the machine-0 end (x=0)').toBe(0);
  expect(r.simPlus, 'override + drives to the +X (max) end = 300').toBe(300);
  expect(r.simMinus, 'override − drives to the −X (min = machine-0) end = 0').toBe(0);

  // 3 NATIVE is byte-unchanged by the override.
  expect(r.nativeMinus, 'native homing emit is identical regardless of dir').toBe(r.nativeAuto);
  expect(r.nativeAuto, 'native emits the M98 P501 home call').toContain('M98P501X0');

  // 4 ROUND-TRIP through the op marker codec.
  expect(r.roundtripOp).toBe('homing');
  expect(r.roundtripDir, 'per-axis dir survives the marker round-trip').toEqual({ x: '-', y: '', z: '+' });
});
