import { test, expect } from '@playwright/test';

/**
 * Per-axis HOME DIRECTION: the DECLARED ENVELOPE SIGN is the single source of the home end. Verifies:
 *   1. DEFAULT = the signed machine travel (settings.machine.<axis> sign) — Auto derives it; no second source.
 *   2. The SIM home end is ALWAYS the declared machine-0 (envelope sign) — a per-axis dir override can NO LONGER
 *      diverge it (t491, the human's principle: the direction can't be hand-rolled). This is the fix for the Z=-120
 *      plunge (a stale dir='-' used to seek the far/bottom end). t499: the SEEK G31 emit's AUTO direction is now
 *      RECONCILED to this same machine-0 home end (-tSign, toward home) — an EXPLICIT dir override still forces it.
 *   3. NATIVE (M98 P501) is byte-UNCHANGED by the override (the controller uses its own config; sim-only there).
 *   4. The dir override round-trips through the op marker codec (it rides the already-declared `config` Struct).
 * The default (Auto / dir unset) stays byte-identical to a config with no `dir` key.
 */
test('homing dir override: signed-envelope default; a stale dir can NO LONGER flip the seek emit (dropped); native → G31; round-trips', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async () => {
    const { homingStack } = await import('/wizards/homingWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { markerLine, parseMarker } = await import('/blocks/opSchema.js');

    const emit = (params) => emitMapped(homingStack(params)).text;
    // X has a POSITIVE machine travel (300) → its signed-envelope home direction is +.
    const machine = { x: 300, y: 300, z: -120 };

    // ── SEEK method on X. The seek-distance line is `#102=<signed seek dist>` (homingWizard.js). ──
    const seekCfg = (dir) => ({ x: { enable: true, method: 'seek', backoff: 5, seekPasses: 1, dir } });
    const seekParams = (dir, extra) => ({ axes: ['x'], config: seekCfg(dir), machine, ...extra });

    const seekAuto = emit(seekParams(''));      // Auto → seek TOWARD machine-0 (home) = -tSign; +300 envelope → -10000
    const seekPlus = emit(seekParams('+'));     // forced + → +10000
    const seekMinus = emit(seekParams('-'));    // forced − → -10000

    // BYTE-IDENTICAL default: a config that NEVER mentions dir must equal Auto (dir:'').
    const cfgNoDir = { x: { enable: true, method: 'seek', backoff: 5, seekPasses: 1 } };
    const seekNoDirKey = emit({ axes: ['x'], config: cfgNoDir, machine });

    // Auto with UNKNOWN travel (machine.x absent) → defers to the controller's #612 register (not a literal).
    const seekAutoNoTravel = emit({ axes: ['x'], config: seekCfg(''), machine: {} });

    // t542 — the hand-made simProxy is DELETED (the preview plays the real emit); the home-end truth is the emit's G31
    // direction (asserted above) + axisHomeMotion — no separate proxy to assert. (Was: a G53 G0 X<end> sim-end check.)

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
      nativeAuto, nativeMinus,
      roundtripDir: parsed && parsed.params && parsed.params.config
        ? { x: parsed.params.config.x.dir, y: parsed.params.config.y.dir, z: parsed.params.config.z.dir }
        : null,
      roundtripOp: parsed && parsed.opType,
    };
  });

  // t536 (change 3) — the c.dir override is DROPPED: a stale saved dir can NO LONGER steer the SEEK EMIT (the t491 bug
  // class). All three (auto / + / −) are IDENTICAL; for X=+300 (no declared home) the seek runs toward machine-0/home =
  // NEGATIVE (the -tSign fallback). The DECLARED home end is the only steering source.
  expect(r.seekPlus, 'a stale dir=+ can NO LONGER flip the seek — identical to Auto').toBe(r.seekAuto);
  expect(r.seekMinus, 'a stale dir=− can NO LONGER flip the seek — identical to Auto').toBe(r.seekAuto);
  expect(r.seekAuto, 'X=+300 (no declared home) seeks toward machine-0/home = a NEGATIVE G31 X').toMatch(/G31 X-\d/);
  expect(r.seekNoDirKey, 'a config with NO dir key emits identically to Auto (dir irrelevant)').toBe(r.seekAuto);
  expect(r.seekAuto, 'no #612 controller-register fallback — the simple readable shape').not.toContain('#612');
  expect(r.seekAutoNoTravel, 'unknown envelope no longer defers to #612 (dropped)').not.toContain('#612');

  // t536 (change 1) — a LINEAR axis with a saved method:'native' is IGNORED by the wizard → G31, NOT M98 P501; dir-independent.
  expect(r.nativeMinus, 'the wizard emit is identical regardless of the ignored dir').toBe(r.nativeAuto);
  expect(r.nativeAuto, 'method:native on a LINEAR axis → the wizard emits G31 (ignores it)').toContain('G31');
  expect(r.nativeAuto, 'the wizard does NOT emit M98 P501 for a linear axis').not.toContain('M98P501');

  // the config (incl. the now-IGNORED dir) still round-trips through the op marker codec (stored, just not emitted)
  expect(r.roundtripOp).toBe('homing');
  expect(r.roundtripDir, 'the per-axis dir still rides the config Struct through the marker (stored, ignored by emit)').toEqual({ x: '-', y: '', z: '+' });
});
