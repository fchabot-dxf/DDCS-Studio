import { test, expect } from '@playwright/test';

/**
 * t808 — STEPPER RUNAWAY guard. The number-field steppers have no hold-repeat of their own; the runaway was the
 * recompute LOOP around them. GROUNDING (see WORK-LOG): while a form field is FOCUSED (a held spinner = a continuous
 * gesture), each 'input' fired a FULL synchronous re-render (emit + 2D featureCanvas + 3D) that replaced the interactive
 * element and choked the main thread. FIX: (a) a focused-field edit throttles the heavy recompute (leading-edge, one per
 * window + trailing) so a held stepper can never choke the loop or orphan the element; (b) the canvas-handle write-back
 * (_writeParam) only dispatches when the value actually changes — an unchanged write can't re-trigger the chain.
 *
 * These guards assert the ruled acceptance without a native spinner (headless can't drive its auto-repeat): a simulated
 * held-stepper burst on a FOCUSED field must stop exactly where released, fire ZERO input events after release, and
 * never detach the focused element; the heavy recompute must coalesce; a non-focused synthetic input still updates inline.
 */

async function openPocket(page) {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
  await page.evaluate(() => window.openWiz('user_pocket_data'));
  await page.waitForFunction(() => document.querySelector('#wiz_user_form [data-param="w"]'));
  await page.waitForTimeout(300);   // let the first preview settle
}

test('a HELD-STEPPER burst on a focused field stops exactly, fires ZERO input events after release, keeps the element', async ({ page }) => {
  await openPocket(page);
  const r = await page.evaluate(async (RECOMPUTE_MS) => {
    const form = document.getElementById('wiz_user_form');
    const w = form.querySelector('[data-param="w"]');
    const ref = w;                          // identity, to detect an orphaning rebuild
    let inputs = 0, released = false, afterRelease = 0;
    form.addEventListener('input', (e) => {
      if (!e.target || e.target.dataset.param !== 'w') return;
      inputs++; if (released) afterRelease++;
    }, true);
    w.focus();                              // a held native spinner focuses its input → the continuous-gesture path
    const start = parseFloat(w.value) || 0;
    // simulate the hold: 20 increments (as a ~2s native auto-repeat would), each a real +1 'input' on the focused field
    for (let i = 0; i < 20; i++) { w.value = String((parseFloat(w.value) || 0) + 1); w.dispatchEvent(new Event('input', { bubbles: true })); }
    const atRelease = parseFloat(w.value);
    released = true;                        // <-- "release": nothing more is dispatched
    await new Promise((res) => setTimeout(res, RECOMPUTE_MS * 3 + 300));   // wait out the trailing throttle window
    const settled = parseFloat(document.querySelector('#wiz_user_form [data-param="w"]').value);
    return { start, atRelease, settled, expected: start + 20, inputEventsAfterRelease: afterRelease, elementKept: (document.querySelector('#wiz_user_form [data-param="w"]') === ref) && ref.isConnected };
  }, 200);
  expect(r.atRelease, 'the value climbed exactly by the increments — no walk from a re-derive loop').toBe(r.expected);
  expect(r.settled, 'after release the value STOPS exactly where it was released (no runaway)').toBe(r.atRelease);
  expect(r.inputEventsAfterRelease, 'ZERO input events fire after release — no self-sustaining loop').toBe(0);
  expect(r.elementKept, 'the focused stepper element is never rebuilt/replaced by a recompute (anti-orphan)').toBe(true);
});

test('the heavy recompute COALESCES for a focused-field burst (throttled, not one full render per increment)', async ({ page }) => {
  await openPocket(page);
  const renders = await page.evaluate(async (RECOMPUTE_MS) => {
    const form = document.getElementById('wiz_user_form');
    const code = document.getElementById('wiz_user_code');
    const w = form.querySelector('[data-param="w"]');
    // each update() rewrites the code panel → count its mutations as a proxy for heavy recomputes
    let recomputes = 0;
    const mo = new MutationObserver(() => { recomputes++; });
    mo.observe(code, { childList: true, subtree: true, characterData: true });
    w.focus();
    for (let i = 0; i < 12; i++) { w.value = String((parseFloat(w.value) || 0) + 1); w.dispatchEvent(new Event('input', { bubbles: true })); }
    await new Promise((res) => setTimeout(res, RECOMPUTE_MS * 3 + 300));
    mo.disconnect();
    return recomputes;
  }, 200);
  // leading-edge + trailing throttle: a synchronous burst of 12 collapses to a small handful of recomputes, not 12
  expect(renders, `12 focused-field inputs coalesced to ${renders} recomputes (throttled, << 12)`).toBeLessThanOrEqual(4);
  expect(renders, 'the burst still recomputes (leading + trailing) — the value/preview is not frozen').toBeGreaterThanOrEqual(1);
});

test('a NON-focused synthetic input (canvas picker / handle write-back) still updates INLINE — no throttle regression', async ({ page }) => {
  await openPocket(page);
  const r = await page.evaluate(async () => {
    const form = document.getElementById('wiz_user_form');
    const code = document.getElementById('wiz_user_code');
    const w = form.querySelector('[data-param="w"]');
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();   // ensure NOT focused
    let recomputes = 0;
    const mo = new MutationObserver(() => { recomputes++; });
    mo.observe(code, { childList: true, subtree: true, characterData: true });
    const before = code.textContent;
    w.value = String((parseFloat(w.value) || 0) + 7);
    w.dispatchEvent(new Event('input', { bubbles: true }));   // programmatic / picker-style — field NOT focused
    await new Promise((res) => setTimeout(res, 60));           // no throttle window needed if inline
    mo.disconnect();
    return { recomputes, changed: code.textContent !== before, focused: document.activeElement === w };
  });
  expect(r.focused, 'the field is not focused (the picker/write-back path)').toBe(false);
  expect(r.recomputes, 'a non-focused synthetic input recomputes INLINE (no throttle delay)').toBeGreaterThanOrEqual(1);
});
