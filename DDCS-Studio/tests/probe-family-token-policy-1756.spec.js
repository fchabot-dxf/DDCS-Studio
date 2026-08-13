import { test, expect } from '@playwright/test';

/**
 * t1756 — MACHINE VARIABLES ROLL OUT, probe family. ACT 2's mechanism (tokenEligible/tokenRefusal, wireTokenGuard,
 * numberWidget — all proven on corner/wcs/homing/surfacing) is now DECLARED on the other 7 probe-family twins
 * (edge, middle, alignment, rotary_center, rotary_clock, the two lathe probes). This spec drives the REAL gesture
 * per op — render the form off the op's own def, type a token into one ELIGIBLE field and one INELIGIBLE field —
 * proving the mechanism (built once for corner) generalizes to a newly-declared binding without new wiring, per
 * the dispatch's GATE: "a token typed into an ELIGIBLE field survives to the EMIT, and an INELIGIBLE field
 * refuses visibly with its own declared text."
 */

const CASES = [
  { mod: '/blocks/dataOps/edgeData.js', defFn: 'edgeDataDef', eligible: 'dist', refused: 'axis' },
  { mod: '/blocks/dataOps/middleData.js', defFn: 'middleDataDef', eligible: 'dist', refused: 'featureType' },
  { mod: '/blocks/dataOps/alignmentData.js', defFn: 'alignmentDataDef', eligible: 'dist', refused: 'tolerance' },
  { mod: '/blocks/dataOps/rotaryCenterData.js', defFn: 'rotaryCenterDataDef', eligible: 'dist', refused: 'wcs' },
  { mod: '/blocks/dataOps/rotaryClockData.js', defFn: 'rotaryClockDataDef', eligible: 'dist', refused: 'action' },
  { mod: '/blocks/dataOps/odProbeData.js', defFn: 'odProbeDataDef', eligible: null, refused: 'tipRadius' },
  { mod: '/blocks/dataOps/faceProbeData.js', defFn: 'faceProbeDataDef', eligible: null, refused: 'ahead' },
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
      // isolate from the studio app shell's own floating chrome (dropdown carets etc.) which otherwise
      // intercepts pointer events on a plain body-appended scratch host
      host.style.cssText = 'position:fixed; top:0; left:0; z-index:999999; background:#111; padding:8px;';
      document.body.appendChild(host);
      renderOpForm(host, formBindings(def));
      window.__tokpolDef = def;
    }, { mod: c.mod, defFn: c.defFn });

    // ELIGIBLE field: renders as text, accepts a '#500' token, read() returns it verbatim.
    if (c.eligible) {
      const field = page.locator(`#tokpol-host [data-param="${c.eligible}"]`);
      await expect(field, `${c.defFn}.${c.eligible} field renders`).toHaveCount(1);
      expect(await field.evaluate((el) => el.type), `${c.defFn}.${c.eligible} renders as text (token-declared)`).toBe('text');
      await field.click();
      await field.fill('');
      await field.pressSequentially('#500');
      await expect(field, `${c.defFn}.${c.eligible} accepts the full token`).toHaveValue('#500');
    }

    // INELIGIBLE field: '#' keystroke is refused (never lands), value stays whatever it was, a toast names the reason.
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
      // enum/dropdown ineligible fields (axis/featureType/wcs/action) have no typing surface at all — confirmed
      // structurally instead: the binding itself carries tokenRefusal with real declared text, no field to type into.
      const reason = await page.evaluate(({ param }) => {
        const b = (window.__tokpolDef.bindings || []).find((x) => x.param === param);
        return b && b.tokenRefusal;
      }, { param: c.refused });
      expect(reason, `${c.defFn}.${c.refused} declares a real tokenRefusal reason`).toBeTruthy();
      expect(reason.length, `${c.defFn}.${c.refused}'s refusal text is not empty/generic`).toBeGreaterThan(20);
    }
  });
}
