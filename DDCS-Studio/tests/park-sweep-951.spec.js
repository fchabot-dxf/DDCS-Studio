import { test, expect } from '@playwright/test';

/**
 * t951 — THE PARK-SWEEP. alignment + rotary_center + rotary_clock migrated their FINAL PARK off the OLD relative
 * safeZParkBlock (a `G0 Z#var` INCREMENTAL lift that compounds into the top limit = the crash class the safe-Z arc fixed
 * for corner/middle/error-handlers) to the shared safeRetractNode (MAX safe height, per-post machine margin), mirroring
 * middle's B2b-2a. The rel|mach frame toggle is RETIRED (the fields keep their safe-Z value, which still drives the
 * intermediate reposition/jog lifts — ONLY the final park moved). Replaces the retired safez-frame + safez-frame-rollout
 * specs. Asserts the RESULT vs the machine-margin truth (not golden==golden):
 *   (b) the #520 unset-guard rides the new park (IF #520<0 seed, then G53 Z#42 — NEVER a bare G53 Z0);
 *   the relative crash-park is GONE (no G53/relative Z#var final park on the G53 posts);
 *   the intermediate lifts are UNTOUCHED; per-post Expert #520 / V4.1 #190 / DM500 honest work-frame (keeps #17/#19).
 */
const WIZ = [
  { op: 'rotary_center', fn: 'rotaryCenterStack', mod: 'rotaryCenterWizard.js', v: '17', base: { method: 'known', diameter: 76.2, datum: 'top' }, expertG0: 0 },
  { op: 'rotary_clock', fn: 'rotaryClockStack', mod: 'rotaryClockWizard.js', v: '17', base: {}, expertG0: 0 },
  { op: 'alignment', fn: 'alignmentStack', mod: 'alignmentWizard.js', v: '19', base: {}, expertG0: 1 },   // the earlier jog-clearance lift is KEPT (only the final park moved) — verified byte-preserved by the git golden diff
];

test('park-sweep: the 3 wizards final-park via safeRetractNode (Max); the relative crash-park is GONE; #520 unset-guard; per-post', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);

  const r = await page.evaluate(async (WIZ) => {
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { getDialect } = await import('/wizards/dialects/index.js');
    const mods = {
      rotaryCenterStack: (await import('/wizards/rotaryCenterWizard.js')).rotaryCenterStack,
      rotaryClockStack: (await import('/wizards/rotaryClockWizard.js')).rotaryClockStack,
      alignmentStack: (await import('/wizards/alignmentWizard.js')).alignmentStack,
    };
    const out = {};
    for (const w of WIZ) {
      const fn = mods[w.fn];
      const emit = (id) => emitMapped(fn(w.base), { dialect: getDialect(id) }).text;
      const expert = emit('ddcs-expert-m350'), v41 = emit('ddcs-v41'), dm500 = emit('ddcs-v3-dm500');
      const g0 = (t) => (t.match(new RegExp('G0 Z#' + w.v + '(\\s|$)', 'g')) || []).length;
      out[w.op] = {
        // Expert — the safeRetractNode #520 margin park + the unset-guard; NO machine-park at the wizard var
        e_guard: /#42=#520/.test(expert) && /IF #42<0 GOTO\d+/.test(expert) && /G53 Z#42/.test(expert),
        e_noMachVar: !(new RegExp('G53 Z#' + w.v).test(expert)),
        e_g0v: g0(expert),
        // V4.1 — the #190 baked margin park
        v_margin: /#190=-?\d/.test(v41) && /G0 G53 Z#190/.test(v41),
        // DM500 — the honest work-frame degrade keeps the wizard's own #var (G90-wrapped → absolute, not the incremental crash)
        d_workVar: new RegExp('G0 Z#' + w.v).test(dm500),
      };
    }
    return out;
  }, WIZ);

  expect(errs, 'no pageerrors').toEqual([]);
  for (const w of WIZ) {
    const x = r[w.op];
    // (b) the unset-guard rides the new park — the WHOLE point (IF #520<0 seed → G53 Z#42, never a bare G53 Z0)
    expect(x.e_guard, `${w.op}: Expert final park is the safeRetractNode #520-margin with the unset-guard`).toBe(true);
    // the relative crash-park is GONE: no machine-park at the wizard var; the only remaining G0 Z#var is the kept earlier lift
    expect(x.e_noMachVar, `${w.op}: no G53 Z#${w.v} final park (the machine-frame toggle target is retired)`).toBe(true);
    expect(x.e_g0v, `${w.op}: the relative G0 Z#${w.v} final park is GONE (only the ${w.expertG0} kept intermediate lift remains)`).toBe(w.expertG0);
    // per-post
    expect(x.v_margin, `${w.op}: V4.1 parks at the baked #190 margin`).toBe(true);
    expect(x.d_workVar, `${w.op}: DM500 honest work-frame degrade keeps the wizard's own #${w.v}`).toBe(true);
  }
});
