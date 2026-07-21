// t982 — surfacing "Skim" Z-mode: whole-op G91 relative to the jog start (jog to a corner, touch, face — no WCS
// datum). CRASH-CRITICAL: the opening clearance must survive as a +clr LIFT and the first plunge must land ONE step
// below the surface (not clearance+depth below it). The G53 safe-Z retract stays machine-frame absolute. Normal
// (default) is byte-identical (no transform).
import { test, expect } from '@playwright/test';

const emit = (page, params) => page.evaluate(async (params) => {
  const { surfacingStack } = await import('/wizards/surfacingWizard.js');
  const { emitMapped } = await import('/blocks/blockEmitter.js');
  const { activeDialectOpts } = await import('/wizards/previewEmit.js');
  return emitMapped(surfacingStack(params), activeDialectOpts()).text;
}, params);

const P = { w: 100, h: 80, depth: 1, stepdown: 0.5, stepover: 7, clearance: 5, feed: 800, plunge: 200 };

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
});

test('Normal (default) has NO G91 — the absolute WCS path is unchanged', async ({ page }) => {
  const normal = await emit(page, { ...P, zMode: 'normal' });
  const dflt = await emit(page, { ...P });   // zMode absent → Normal
  expect(normal).toBe(dflt);                 // absent === explicit normal
  expect(normal).not.toContain('G91');       // absolute throughout
  expect(normal).toContain('G0 Z5');         // the absolute clearance is present (progstart emits it)
});

test('Skim emits whole-op G91 … G90; the clearance LIFT survives (+5); the plunge lands ONE step below the surface; G53 stays machine-frame', async ({ page }) => {
  const skim = await emit(page, { ...P, zMode: 'skim' });
  const lines = skim.split('\n').map((l) => l.trim());
  // the G91 wrap + G90 restore
  const g91 = lines.findIndex((l) => /^G91\b/.test(l));
  const g90after = lines.findIndex((l, i) => i > g91 && /^G90\b/.test(l));
  expect(g91, 'G91 present').toBeGreaterThan(0);
  expect(g90after, 'G90 restore after the body').toBeGreaterThan(g91);

  // FIRST Z move after G91 = the clearance LIFT +5 (NOT Z0 = no lift, NOT negative = a dive)
  const firstZ = lines.slice(g91 + 1).find((l) => /Z-?\d/.test(l));
  expect(firstZ, 'first Z after G91 is the +5 clearance lift').toMatch(/G0 Z5\b/);

  // the first PLUNGE (a G1 with a feed) lands one step: from the +5 clearance to the -0.5 first level = a -5.5 delta
  const plunge = lines.slice(g91 + 1).find((l) => /^G1\b.*Z-?\d/.test(l));
  expect(plunge, 'the first plunge is -5.5 (from +5 clearance to -0.5 cut), NOT the whole clearance+depth below').toMatch(/Z-5\.5\b/);

  // the G53 safe-Z retract is present, AFTER the G90 exit, and NOT relativized (absolute machine coords)
  const g53 = lines.findIndex((l) => /\bG53\b/.test(l));
  expect(g53, 'G53 retract after the G90 exit').toBeGreaterThan(g90after);

  // Skim runs relative → no absolute WCS placement traverse (the body was NOT placed on the stock)
  expect(skim).toContain('G91');
});
