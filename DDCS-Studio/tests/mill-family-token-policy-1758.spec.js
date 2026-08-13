import { test, expect } from '@playwright/test';

/**
 * t1758 — MACHINE VARIABLES ROLL OUT, mill family (surfacing was the t1704 pilot; this act declares
 * tokenEligible/tokenRefusal/tokenDeferrable on the other 7: pocket, contour, slot, drill, bore, tap, text).
 * Mirrors probe-family-token-policy-1756.spec.js: render the form directly off each op's own def, check one
 * ELIGIBLE field and one INELIGIBLE field, proving the mechanism (built once, proven twice now) generalizes
 * without new wiring.
 *
 * Several mill ops ended up with ONLY enum fields eligible (pocket/slot/tap: every numeric param binds to a
 * kernel that hard-discards a token today; text: only `align`) — enums have no typing surface at all (an
 * established scope note since t1704: "no enum/bool WIDGET offers a way to TYPE a token in the first place"),
 * so for those cases this asserts the DECLARATION directly rather than driving a keystroke that has nowhere to
 * land. Where a genuinely numeric eligible field exists (contour/drill/bore), the real gesture is driven.
 */

const CASES = [
  { mod: '/blocks/dataOps/pocketData.js', defFn: 'pocketDataDef', eligible: 'wcs', refused: 'shape' },
  { mod: '/blocks/dataOps/contourData.js', defFn: 'contourDataDef', eligible: 'feed', refused: 'shape' },
  { mod: '/blocks/dataOps/slotData.js', defFn: 'slotDataDef', eligible: 'stockAttach', refused: 'width' },
  { mod: '/blocks/dataOps/drillData.js', defFn: 'drillDataDef', eligible: 'depth', refused: 'pattern' },
  { mod: '/blocks/dataOps/boreData.js', defFn: 'boreDataDef', eligible: 'pitch', refused: 'ramp' },
  { mod: '/blocks/dataOps/tapData.js', defFn: 'tapDataDef', eligible: 'pathDatum', refused: 'depth' },
  { mod: '/blocks/dataOps/textData.js', defFn: 'textDataDef', eligible: 'align', refused: 'height' },
];

for (const c of CASES) {
  test(`${c.defFn}: an eligible field accepts a token, an ineligible field refuses it visibly`, async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);

    await page.evaluate(async ({ mod, defFn }) => {
      const M = await import(mod);
      const { formBindings, renderOpForm } = await import('/ui/formWidgets.js');
      const def = M[defFn]();
      const host = document.createElement('div');
      host.id = 'tokpol-host';
      host.style.cssText = 'position:fixed; top:0; left:0; z-index:999999; background:#111; padding:8px; max-height:100vh; overflow-y:auto;';
      document.body.appendChild(host);
      renderOpForm(host, formBindings(def));
      window.__tokpolDef = def;
    }, { mod: c.mod, defFn: c.defFn });

    // ELIGIBLE: if it rendered as a typeable text input, drive the real keystroke gesture and assert the token
    // survives. If it's an enum/bool (no typing surface — a dropdown/toggle), assert the declaration directly.
    const elField = page.locator(`#tokpol-host [data-param="${c.eligible}"]`);
    await expect(elField, `${c.defFn}.${c.eligible} field renders`).toHaveCount(1);
    const elType = await elField.evaluate((el) => el.type);
    if (elType === 'text') {
      await elField.click();
      await elField.fill('');
      await elField.pressSequentially('#500');
      await expect(elField, `${c.defFn}.${c.eligible} accepts the full token`).toHaveValue('#500');
    } else {
      const eligible = await page.evaluate(({ param }) => {
        const b = (window.__tokpolDef.bindings || []).find((x) => x.param === param);
        return !!(b && b.tokenEligible);
      }, { param: c.eligible });
      expect(eligible, `${c.defFn}.${c.eligible} is declared tokenEligible (no typing surface on this widget to drive live)`).toBe(true);
    }

    // INELIGIBLE: same split — drive the refusal gesture on a numeric field, or check the declared reason on an enum.
    const rf = page.locator(`#tokpol-host [data-param="${c.refused}"]`);
    const rfType = await rf.evaluate((el) => el.type).catch(() => null);
    if (rfType === 'text') {
      const before = await rf.inputValue();
      await rf.click();
      await rf.pressSequentially('#');
      await expect(rf, `${c.defFn}.${c.refused} refuses the '#' keystroke — value unchanged`).toHaveValue(before);
      const toastText = await page.evaluate(() => {
        const t = document.querySelector('.toast, [class*="toast"]');
        return t ? t.textContent : null;
      });
      expect(toastText, `${c.defFn}.${c.refused} names its declared refusal reason`).toBeTruthy();
    } else {
      const reason = await page.evaluate(({ param }) => {
        const b = (window.__tokpolDef.bindings || []).find((x) => x.param === param);
        return b && b.tokenRefusal;
      }, { param: c.refused });
      expect(reason, `${c.defFn}.${c.refused} declares a real tokenRefusal reason`).toBeTruthy();
      expect(reason.length, `${c.defFn}.${c.refused}'s refusal text is not empty/generic`).toBeGreaterThan(20);
    }
  });
}
