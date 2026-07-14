import { test, expect } from '@playwright/test';

/**
 * t856 — THE G53 MODE-EXPLICIT SAFETY FIX. A machine-frame G53 is absolute ONLY under G90 (the factory pattern: every
 * dump sets G90 before G53; ZERO factory G53-in-G91). A safe-Z retract emitted inside a G91 probe body could therefore
 * move INCREMENTALLY on the controller — the opposite of a safe absolute retract (found by the user reading their own
 * emitted corner program, t853). The fix wraps every safe-height G53 in a G91 body as `G90 / G53 / restore G91`.
 *
 * (3) CORPUS GUARD — sweep the emitted safe-Z/probe corpus across EVERY post and assert every G53 line executes under
 *     G90 (no future emit can regress this).
 * (4) SIM IDENTITY — the wrap is trace-NEUTRAL: the G53 is machine-absolute regardless of mode (positions unchanged),
 *     and the transient G90 must NOT flip a G91 macro `stats.absolute` (the t826 re-anchor collapse), while the restored
 *     G91 keeps the body's later moves incremental.
 */
test.use({ viewport: { width: 1000, height: 800 } });

const POSTS = ['ddcs-expert-m350', 'ddcs-v41', 'ddcs-v3-dm500', 'grbl', 'rs274ngc', 'centroid'];

// Track the modal G90/G91 state line-by-line (controllers boot G90) and return every G53 line NOT under G90.
// Strip ( ... ) comments first so a comment MENTIONING G53/G90 (e.g. the DM500 degrade note) is never mistaken for code.
function g53ViolationsUnderG91(text) {
  let absolute = true;
  const bad = [];
  text.split('\n').forEach((raw, i) => {
    const ln = raw.replace(/\([^)]*\)/g, '');   // drop inline/full-line comments
    if (/(^|\s)G90(\s|$|\D)/.test(ln)) absolute = true;
    if (/(^|\s)G91(\s|$|\D)/.test(ln)) absolute = false;   // G91.1 etc. don't occur in this corpus
    if (/(^|\s)G53(\s|$)/.test(ln) && !absolute) bad.push(`line ${i}: ${raw}`);
  });
  return bad;
}

test('(3) CORPUS GUARD: every emitted G53 in the safe-Z/probe corpus executes under G90, on every post', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetSettings, null, { timeout: 15000 });
  const corpus = await page.evaluate(async (posts) => {
    const { cornerStack } = await import('/wizards/cornerWizard.js');
    const { middleStack } = await import('/wizards/middleWizard.js');
    const { rotaryClockStack } = await import('/wizards/rotaryClockWizard.js');
    const { rotaryCenterStack } = await import('/wizards/rotaryCenterWizard.js');
    const { edgeStack } = await import('/wizards/edgeWizard.js');
    const { alignmentStack } = await import('/wizards/alignmentWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { getDialect } = await import('/wizards/dialects/index.js');
    // Include the machine-frame FINAL PARK (safeZParkBlock → G53) variants — that is where the G91-body park G53s live.
    const cases = [
      ['corner', cornerStack, {}],
      ['middle', middleStack, {}], ['middle.machine', middleStack, { safeZFrame: 'machine' }],
      ['rotaryClock', rotaryClockStack, {}], ['rotaryClock.machine', rotaryClockStack, { safeZFrame: 'machine' }],
      ['rotaryCenter', rotaryCenterStack, {}], ['rotaryCenter.machine', rotaryCenterStack, { safeZFrame: 'machine' }],
      ['edge', edgeStack, {}],
      ['alignment', alignmentStack, {}], ['alignment.machine', alignmentStack, { safeZFrame: 'machine' }],
    ];
    const out = [];
    for (const [name, b, params] of cases) {
      for (const id of posts) {
        let text = ''; try { text = emitMapped(b({ ...params }), { dialect: getDialect(id) }).text; } catch (e) { text = 'ERROR: ' + e.message; }
        out.push({ label: `${name} @ ${id}`, text });
      }
    }
    return out;
  }, POSTS);

  // sanity: the corpus actually CONTAINS G53 machine-frame retracts (else the guard is vacuous)
  const withG53 = corpus.filter((c) => /(^|\n)[^\n]*G53/.test(c.text));
  expect(withG53.length, 'the corpus exercises machine-frame G53 retracts (non-vacuous guard)').toBeGreaterThan(5);

  const violations = [];
  for (const c of corpus) {
    if (c.text.startsWith('ERROR')) { violations.push(`${c.label}: ${c.text}`); continue; }
    const bad = g53ViolationsUnderG91(c.text);
    if (bad.length) violations.push(`${c.label} — G53 under G91:\n    ${bad.join('\n    ')}`);
  }
  expect(violations, `every emitted G53 must run under G90:\n${violations.join('\n')}`).toEqual([]);
});

test('(4) SIM IDENTITY: the G90-wrapped G53 is machine-absolute, does NOT flip a G91 macro, and G91 is restored', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio, null, { timeout: 15000 });
  const r = await page.evaluate(async () => {
    const { traceToolpath } = await import('/engine/trace.js');
    // A PURELY G91 (incremental) body with the t856 mode-explicit wrap around a machine-frame retract to Z-5. No real
    // G90 move anywhere — so if the transient wrap G90 wrongly flipped stats.absolute, this test catches it.
    const prog = ['G91', 'G0 X10', 'G90', 'G53 Z-5', 'G91', 'G0 X10'].join('\n');
    const t = traceToolpath(prog, {});
    const segs = (t.segments || []).map((s) => ({ x1: s.x1, x2: s.x2, z1: s.z1, z2: s.z2 }));
    // the incremental G0 X10 moves each advance +10 in X (G91 restored after the wrap → not re-anchored to absolute 10)
    const xMoves = segs.filter((s) => Math.abs(s.x2 - s.x1) > 0.5).map((s) => s.x2);
    const g53 = segs.find((s) => Math.abs(s.z2 - (-5)) < 0.01);
    return { absolute: t.stats.absolute, xMoves, g53Reached: !!g53 };
  });
  // the machine-frame G53 reaches the ABSOLUTE Z -5 regardless of the surrounding mode (positions unchanged by the wrap)
  expect(r.g53Reached, 'the wrapped G53 reaches the absolute machine Z -5').toBe(true);
  // t826/t856: the transient G90 around the G53 must NOT flip a G91 body absolute (else the next probe pass re-anchors)
  expect(r.absolute, 'the G90-wrapped G53 does not flip a G91 macro absolute (anchoring preserved)').toBe(false);
  // the G91 restore holds: the two incremental X moves land at 10 then 20 (each +10), not re-anchored to an absolute 10
  expect(r.xMoves, 'G91 is restored after the retract — later moves stay incremental').toEqual([10, 20]);
});
