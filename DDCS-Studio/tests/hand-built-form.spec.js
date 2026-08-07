import { test, expect } from '@playwright/test';

/**
 * #12 — a hand-built block stack is FORM-EDITABLE too ("one stack, many views"). The FORM [LIVE] pane was gated to
 * editingWizardType() (only a SAVED custom op being re-authored), so a fresh hand-built stack showed no form. Fix:
 * (a) deriveAuthoredDef/collectAuthoring now derive a BARE top-level atom stack (no op wrapper) via authoringBody, and
 * (b) the pane shows whenever the stack exposes knobs (def.bindings.length > 0), not just while editing a saved wizard.
 * These tests drive the real Blocks tab with a hand-built (never-saved) stack.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

async function openBlocksWith(page, stack) {
  await page.evaluate((s) => window.ddcsLoadBlockStack(s), stack);
  await page.evaluate(() => { window.showApp('editor'); window.showApp('blocks'); });
  await page.waitForFunction(() => window.__blkws, { timeout: 8000 });
  await page.waitForTimeout(450);
}

test('a hand-built bare stack with an exposed knob → FORM [LIVE] shows + writes back to the block', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.showApp && window.ddcsLoadBlockStack && window.ddcsGetBlockProgram && window.__blkws !== undefined || true);
  await page.waitForFunction(() => window.showApp && window.ddcsLoadBlockStack && window.ddcsGetBlockProgram, null, { timeout: 15000 });   // t710 — boot-readiness gate (window.showApp is late); own budget, not the 5s actionTimeout cap

  // a BARE hand-built stack (no op wrapper) whose first move's X is an exposed knob (a param pill named px).
  await openBlocksWith(page, [
    { type: 'move', params: { x: { type: 'param', params: { name: 'px', value: 30, widget: 'number' } }, y: 20, z: -2, mode: 'rapid' } },
    { type: 'move', params: { x: 50, y: 60, z: -2, mode: 'feed', f: 800 } },
  ]);

  const shown = await page.evaluate(async () => {
    const dm = await import('/blocks/devMode.js');
    const def = dm.deriveAuthoredDef(window.__blkws);
    const pane = document.getElementById('blk-formpane');
    const field = document.querySelector('#blk-form [data-param="px"]');
    return {
      editingType: dm.editingWizardType(),                 // null — NOT editing a saved wizard
      defNull: def === null,
      bindings: def ? def.bindings.map((b) => b.param) : [],
      paneHidden: pane ? pane.hidden : 'no-pane',
      fieldValue: field ? field.value : 'no-field',
    };
  });
  expect(shown.editingType, 'not editing a saved wizard — the form shows purely from the hand-built stack').toBeNull();
  expect(shown.defNull, 'a bare hand-built stack now DERIVES a def (authoringBody handles no op wrapper)').toBe(false);
  expect(shown.bindings, 'the exposed knob becomes a binding').toContain('px');
  expect(shown.paneHidden, 'FORM [LIVE] is visible for a hand-built stack with a knob').toBe(false);
  expect(Number(shown.fieldValue), 'the form renders the knob at its current value').toBe(30);

  // form → block: edit the field → writeAuthoredValue writes the bound block → reproject updates the program.
  await page.evaluate(() => {
    const f = document.querySelector('#blk-form [data-param="px"]');
    f.value = '99';
    f.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(400);
  const wrote = await page.evaluate(() => {
    const prog = window.ddcsGetBlockProgram() || [];
    const mv = prog.find((b) => b && b.type === 'move');
    const x = mv && mv.params && mv.params.x;
    return (x && typeof x === 'object' && x.params) ? x.params.value : x;
  });
  expect(Number(wrote), 'editing the form wrote the knob value back into the hand-built block').toBe(99);
});

// t1587/t1589 — `#blk-formpane` is permanently MOUNTED (blocksApp binds to it at build time) and the column decides
// which face to display, so the `hidden` attribute is no longer how the no-knobs case is expressed. The
// no-false-positive claim is the point of this test and is what it still asserts: zero bindings derived → zero param
// controls rendered.
test('a hand-built stack with NO exposed knobs → FORM [LIVE] renders no controls (no false-positive)', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.showApp && window.ddcsLoadBlockStack && window.ddcsGetBlockProgram, null, { timeout: 15000 });   // t710 — boot-readiness gate (window.showApp is late); own budget, not the 5s actionTimeout cap

  await openBlocksWith(page, [
    { type: 'move', params: { x: 10, y: 20, z: -2, mode: 'rapid' } },
    { type: 'spindle', params: { rpm: 12000, on: true } },
  ]);

  const r = await page.evaluate(async () => {
    const dm = await import('/blocks/devMode.js');
    const def = dm.deriveAuthoredDef(window.__blkws);
    const pane = document.getElementById('blk-formpane');
    return {
      bindings: def ? def.bindings.length : 'null',
      hasPane: !!pane,
      controls: document.querySelectorAll('#blk-form [data-param]').length,
    };
  });
  expect(r.bindings, 'no knobs exposed on the bare stack').toBe(0);
  expect(r.hasPane, 'the pane stays mounted (blocksApp binds to it at build time)').toBe(true);
  expect(r.controls, 'no knobs + not editing → no param controls are rendered').toBe(0);
});
