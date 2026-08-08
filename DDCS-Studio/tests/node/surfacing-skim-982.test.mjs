// t982 — surfacing "Skim" Z-mode: the op runs relative to the JOG START (jog to a corner, touch, face — no WCS
// datum). CRASH-CRITICAL: the opening clearance must survive as a real LIFT and the first plunge must land ONE step
// below the touched surface (not clearance+depth below it). The G53 safe-Z retract stays machine-frame absolute.
// Normal (default) is byte-identical (no transform).
//
// ── t1359 — HOW SKIM WORKS CHANGED; WHAT SKIM PROMISES DID NOT ──────────────────────────────────────────────────
// t982 delivered it by emitting the literal body and RELATIVIZING the text: a G91 wrap, deltas from the jog, a G90
// restore. That mechanism is retired — not because it was wrong, but because relativizing a LOOP is not a harder
// version of relativizing a list. A parametric raster's deltas are runtime values, so there is nothing in the text
// to rewrite; t1349 measured the consequence exactly, the inter-level retract collapsing to `G0 Z0` with the tool
// never lifting between depth levels.
//
// The op now READS the live work position into its own registers and emits ORDINARY ABSOLUTE moves in that frame.
// Every assertion below is this file's original assertion, carried across to the seam that replaced the one it named.
import { test, expect } from './support/harness.mjs';

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
  const normal = await emit(page, P);
  expect(normal).not.toContain('G91');       // absolute throughout
  expect(normal, 'and no frame read either — a placed op knows where it is at build time').not.toContain('#790');
});

test('Skim is ABSOLUTE in a frame the machine supplies — no G91, a REAL lift, and the read before any motion', async ({ page }) => {
  const skim = await emit(page, { ...P, zMode: 'skim' });
  const lines = skim.split('\n').map((l) => l.trim());

  // NO G91. The program is already relative to wherever the operator jogged to, by construction rather than by
  // rewrite — so there is nothing to wrap and nothing to restore.
  expect(skim, 'no G91 wrap — the frame is read, not the coordinates rewritten').not.toContain('G91');

  // THE FRAME IS READ, and read BEFORE anything moves.
  const readAt = lines.findIndex((l) => /^#62=#790/.test(l));
  expect(readAt, 'the live work X is read into the frame register').toBeGreaterThan(-1);
  const guardAt = lines.findIndex((l) => /^IF #62 == -99999 GOTO93/.test(l));
  expect(guardAt, 'and the program refuses if it did not arrive').toBeGreaterThan(readAt);

  // THE CRASH-GUARD, CARRIED OVER (t984 — the advisor's dump caught the original). Its point was never "G91": it was
  // NEVER MOVE Z ON AN UNKNOWN WORK FRAME. The frame is established by the READ now, so the same rule reads "no Z
  // move before the frame is read and checked" — the identical hazard, measured against the seam that replaced it.
  const preFrame = lines.slice(0, guardAt);
  const strayZ = preFrame.filter((l) => /^G[0-3]\b/.test(l) && /Z-?\d/.test(l));
  expect(strayZ, `no Z move before the frame is read + checked (found: ${strayZ.join(' | ')})`).toEqual([]);

  // FIRST Z MOVE = a REAL LIFT above the touched surface. t1349 pinned the relativized version collapsing this to
  // `G0 Z0` (no lift at all); it is a height again, expressed against the frame register.
  const firstZ = lines.slice(guardAt).find((l) => /^G0\b/.test(l) && /Z\[/.test(l));
  expect(firstZ, 'the first Z move is the clearance lift above the jog surface').toMatch(/G0 Z\[#64 \+ 5\]/);

  // THE PLUNGE lands one step below the touched surface — the same fact the old -5.5 delta stated, now stated as the
  // arithmetic the machine performs: the frame's Z minus the level counter.
  const plunge = lines.find((l) => /^G1\b/.test(l) && /Z\[#64 - #46\]/.test(l));
  expect(plunge, 'the plunge is frame-Z minus the level, not a baked delta').toBeTruthy();

  // the G53 safe-Z retract is still there, still machine-frame, still after the body
  const g53 = lines.findIndex((l) => /\bG53\b/.test(l));
  expect(g53, 'the G53 retract is still the machine-frame footer').toBeGreaterThan(guardAt);

  // t1620 — NO DUPLICATE FLOW LABELS. The render-nothing bug was skimErr/skimOk (93/94) COLLIDING with the row-walk
  // labels: uniquifyFlowLabels could not see zMode:'skim' on the surfaceraster block yet, so the raster's post-plunge
  // GOTO jumped to the skim-OK label and the sweep never ran (one plunge, no carve — the sim showed only the stock
  // box). Every N-label must be emitted exactly once, or that ambiguity is back on both the sim and the controller.
  const nLabels = lines.map((l) => (l.match(/^N(\d+)\b/) || [])[1]).filter(Boolean);
  const dupes = [...new Set(nLabels.filter((n, i) => nLabels.indexOf(n) !== i))];
  expect(dupes, 'no duplicate flow labels — the skim refusal must not reuse the row-walk numbers').toEqual([]);
});
