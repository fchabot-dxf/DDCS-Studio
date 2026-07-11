import { test, expect } from '@playwright/test';

/**
 * Informed Merge/Replace modal (FORM path). The block-edit notice was a BLIND 3-way choice; now it SHOWS the
 * block-only residue — what a form Replace would DISCARD and what "Keep both" preserves — built on the SAME MID #1
 * diff (live op.children vs opSession.replayReconcile). Two surfaces, the real rendered output (north star #7):
 *   1. opGlow.opEditSummary(opId) returns the residue as readable G-code: { injected:[line…], overrides:[{from,to}] }.
 *   2. showBlockEditNotice(label, summary) renders that residue in the modal above the Keep both / Replace / Cancel.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('opEditSummary returns the block-only residue an injection adds (real diff, wizard closed)', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager && window.openWiz && window.updateWiz && window.insertWiz && window.closeWiz
    && window.ddcsGetBlockProgram && window.ddcsLoadBlockStack);   // t746 — REAL readiness (the app + wizardManager booted), not just the function globals: under -workers contention openWiz/insertWiz ran before the wizard system was ready → no op inserted → opId null

  const opId = await page.evaluate(async () => {
    window.ddcsLoadBlockStack([]);
    window.openWiz('surfacing', undefined, true);
    window.updateWiz();
    await window.insertWiz();
    window.closeWiz && window.closeWiz();
    const prog = window.ddcsGetBlockProgram() || [];
    const op = [...prog].reverse().find((b) => b && b.type === 'op' && b.opType === 'surfacing');
    return op ? op.id : null;
  });
  expect(opId).toBeTruthy();

  // fresh op → no residue
  const none = await page.evaluate(async ({ opId }) => {
    const glow = await import('/blocks/opGlow.js');
    return glow.opEditSummary(opId);
  }, { opId });
  expect(none, 'a clean op has no block-only residue').toBeNull();

  // inject a distinctive raw atom (block-only) → residue lists its emitted G-code
  const summary = await page.evaluate(async ({ opId }) => {
    const glow = await import('/blocks/opGlow.js');
    const prog = (window.ddcsGetBlockProgram() || []).map((b) => ({ ...b }));
    const op = prog.find((b) => b && b.id === opId);
    op.children = [...(op.children || []), { type: 'raw', id: 'raw_dwell_marker', params: { text: 'G4 P500 (DWELL_MARKER)' } }];   // atoms carry ids in the real model
    window.ddcsLoadBlockStack(prog);
    (await import('/blocks/opEdits.js')).recordEdit(opId, 'raw_dwell_marker', {});   // declare the injection (a live drag fires this; the model-poke can't)
    return glow.opEditSummary(opId);
  }, { opId });

  expect(summary, 'block-edited op yields a summary').toBeTruthy();
  expect(summary.injected.join('\n'), 'the injected raw line is in the discard list').toContain('DWELL_MARKER');
});

test('showBlockEditNotice renders the residue and still resolves the 3-way choice', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);

  // render the notice with a summary, click "Replace with form", assert it showed the discard + resolved 'replace'
  const r = await page.evaluate(async () => {
    const { showBlockEditNotice } = await import('/ui/blockEditNotice.js');
    const p = showBlockEditNotice('Surfacing', { injected: ['G4 P500 (DWELL_MARKER)'], overrides: [{ from: 'F800', to: 'F1200' }] });
    // t728 r2 — REAL readiness (not a fixed 50ms sleep): wait for the notice element to actually render, else a slow
    // (contended) render misses the 50ms window and the query returns null → the flake. Condition-gated, capped so it can't hang.
    await new Promise((res) => { let n = 0; const t = setInterval(() => { if (document.querySelector('.block-edit-notice') || ++n > 400) { clearInterval(t); res(); } }, 10); });
    const ov = document.querySelector('.block-edit-notice');
    const shownInjected = ov.textContent.includes('DWELL_MARKER');
    const shownOverride = ov.textContent.includes('F800') && ov.textContent.includes('F1200');
    ov.querySelector('[data-c="replace"]').click();
    const choice = await p;
    return { shownInjected, shownOverride, choice, gone: !document.querySelector('.block-edit-notice') };
  });
  expect(r.shownInjected, 'the discarded injected line is shown').toBe(true);
  expect(r.shownOverride, 'the override from→to is shown').toBe(true);
  expect(r.choice, 'clicking Replace resolves "replace"').toBe('replace');
  expect(r.gone, 'the modal closes after choosing').toBe(true);
});
