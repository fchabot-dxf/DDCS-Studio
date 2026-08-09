import { test, expect } from '@playwright/test';

/**
 * t1642 — THE PLACEMENT ANCHOR DOESN'T APPLY IN SURFACING (dispatched as a defect). User, with a screenshot:
 * "surfacing start position needs developed" → "I can see it in the wiz but it won't apply." The dispatch's leading
 * hypothesis (advisor, t1633): `liveExtent` reports nothing for `surfaceraster`, the shift computes to 0,0,0, and
 * `blockEmitter.js`'s place fold's `if (!s.x && !s.y && !s.z) return inner;` silently no-ops the picker.
 *
 * MEASURED, NOT ASSUMED — the hypothesis did NOT survive contact with the real app. Driven end to end (real DOM
 * field writes, real `dispatchEvent` gestures — not just calling `wizardManager.update()` directly, which is what
 * `placement-rollout.spec.js` does and would mask a broken input-listener — AND a REAL mouse click on the actual
 * on-canvas stock-attach marker): `stockAttach`, `pathDatum`, and `originX` all correctly move the surfacing emit,
 * on BOTH the built-in wizard form and the `user_surfacing_data` twin's generic form, whenever the faced area is
 * SMALLER than the stock. `surfaceraster.extent` (t1361/t1425/t1498) already does exactly what the trace's
 * hypothesis worried it might not.
 *
 * THE REAL EXPLANATION: `surfacingView.onOpen` defaults the faced area to the FULL STOCK TOP the moment the wizard
 * opens (`setFields({ sf_originX: 0, sf_originY: 0, sf_w: st.x, sf_h: st.y })`). At that size the anchor is a
 * MATHEMATICAL IDENTITY, not a bug: moving a rectangle's corner to the identical corner of a container the exact
 * same size can never change what the container covers — `placementShift`'s own arithmetic makes this provable
 * (`attachX = (FRAC[stockAttach] - FRAC[stockDatum]) * w`, `cornerX = FRAC[pathDatum] * w`; when `pathDatum`
 * follows `stockAttach` — the default — these cancel to a CONSTANT `-FRAC[stockDatum] * w` regardless of which
 * corner is picked). A user who opens Surfacing and tries the anchor before shrinking the area will correctly see
 * NOTHING move — this is very likely what was reported. This spec pins that fact explicitly (case 1 below) so a
 * future session never re-diagnoses it as a broken extent/fold link, and closes the coverage gap the dispatch's own
 * verify step named (pathDatum was untested; the twin's pathDatum was untested; no spec drove a REAL canvas click).
 *
 * No code change accompanies this spec — there is no broken link to fix. Reported to the advisor for a ruling on
 * whether the default-area UX is worth a discoverability affordance (a separate, non-code-defect question).
 */
test.use({ viewport: { width: 1280, height: 900 } });

const setStock = (page) => page.evaluate(() => { const s = window.ddcsGetSettings(); s.stock = Object.assign(s.stock || {}, { x: 100, y: 80, z: 20, show: true, datum: 'nnp' }); });

test('surfacing: the default-on-open area (== full stock) makes the anchor a MATHEMATICAL no-op — not a bug', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.showApp);
    await setStock(page);
    await page.evaluate(() => window.ddcsStudio.wizardManager.open('surfacing'));
    await page.waitForSelector('#wiz_surfacing', { state: 'visible' });

    const r = await page.evaluate(async () => {
        const set = (id, v) => { const e = document.getElementById(id); if (e) { e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); } };
        const { traceToolpath } = await import('/engine/trace.js');
        const farX = (g) => { const xs = (traceToolpath(g).segments || []).flatMap((s) => [s.x1, s.x2]).filter((v) => Number.isFinite(v)); return xs.length ? Math.max(...xs) : NaN; };
        const code = () => document.getElementById('wiz_surfacing_code').textContent;

        set('sf_w', 100); set('sf_h', 80); set('sf_originX', 0); set('sf_originY', 0); set('sf_stockAttach', ''); set('sf_pathDatum', '');
        const near = farX(code());
        set('sf_stockAttach', 'pp');
        const far = farX(code());
        return { near, far };
    });
    // t1644 (advisor review) — `.toBe` is `Object.is`, under which `Object.is(NaN, NaN)` is TRUE: if the trace ever
    // came back empty (this week's exact defect family), near/far would both be NaN and this would pass VACUOUSLY,
    // proving nothing. A real, finite toolpath extent must exist before "the two are equal" means anything.
    expect(Number.isFinite(r.near), 'the traced toolpath has a real, finite extent to compare (not an empty/NaN trace)').toBe(true);
    expect(r.near, 'at full-stock size (the on-open default) the near/far corners trace to the SAME extent — geometrically inevitable').toBe(r.far);
});

test('surfacing: stockAttach + pathDatum both move the emit once the area is smaller than the stock (a REAL canvas click, not just a field write)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.showApp);
    await setStock(page);
    await page.evaluate(() => window.ddcsStudio.wizardManager.open('surfacing'));
    await page.waitForSelector('#wiz_surfacing', { state: 'visible' });

    const setup = () => page.evaluate(() => {
        const set = (id, v) => { const e = document.getElementById(id); if (e) { e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); } };
        set('sf_w', 50); set('sf_h', 40); set('sf_originX', 0); set('sf_originY', 0); set('sf_stockAttach', ''); set('sf_pathDatum', '');
    });
    const farX = () => page.evaluate(async () => {
        const { traceToolpath } = await import('/engine/trace.js');
        const g = document.getElementById('wiz_surfacing_code').textContent;
        const xs = (traceToolpath(g).segments || []).flatMap((s) => [s.x1, s.x2]).filter((v) => Number.isFinite(v));
        return xs.length ? Math.max(...xs) : NaN;
    });

    // stockAttach, via a REAL mouse click on the on-canvas marker — the exact gesture a user performs, not a
    // synthetic field write (placement-rollout.spec.js only ever writes the field directly).
    await setup();
    const attachNear = await farX();
    const attachRect = await page.evaluate(() => {
        const svg = document.querySelector('#surfacingLayoutCanvas svg');
        const pp = svg && Array.from(svg.querySelectorAll('rect[data-attach]')).find((r) => r.getAttribute('data-attach') === 'pp');
        if (!pp) return null;
        const b = pp.getBoundingClientRect();
        return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    });
    expect(attachRect, 'the on-canvas stock-attach marker for the far corner is drawn and hit-testable').toBeTruthy();
    await page.mouse.click(attachRect.x, attachRect.y);
    await page.waitForTimeout(200);
    const attachVal = await page.evaluate(() => document.getElementById('sf_stockAttach').value);
    const attachFar = await farX();
    expect(attachVal, 'the real click landed on the far corner').toBe('pp');
    expect(attachFar, 'clicking the far stock-attach corner pushes the faced area toward it').toBeGreaterThan(attachNear + 30);

    // pathDatum, alone (stockAttach left following the stock datum) — untested by placement-rollout.spec.js.
    await setup();
    const pathNear = await farX();
    await page.evaluate(() => { const e = document.getElementById('sf_pathDatum'); e.value = 'pp'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    const pathFar = await farX();
    expect(pathFar, 'picking the path\'s own far corner as its attach point moves the emit too').not.toBe(pathNear);
});

test('the TWIN (user_surfacing_data): stockAttach + pathDatum both move the emit, same as the wizard', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.showApp);
    await setStock(page);
    await page.evaluate(() => window.openWiz('user_surfacing_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible' });

    const r = await page.evaluate(async () => {
        const { traceToolpath } = await import('/engine/trace.js');
        const farX = (g) => { const xs = (traceToolpath(g).segments || []).flatMap((s) => [s.x1, s.x2]).filter((v) => Number.isFinite(v)); return xs.length ? Math.max(...xs) : NaN; };
        const code = () => (document.getElementById('wiz_user_code') || {}).textContent || '';
        const setP = (param, v) => { const e = document.querySelector(`#wiz_user_form [data-param="${param}"]`); if (!e) return false; e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); return true; };

        setP('w', 50); setP('h', 40); setP('originX', 0); setP('originY', 0); setP('stockAttach', 'nn'); setP('pathDatum', '');
        const attachNear = farX(code());
        setP('stockAttach', 'pp');
        const attachFar = farX(code());

        setP('stockAttach', 'nn'); setP('pathDatum', '');
        const pathNear = farX(code());
        setP('pathDatum', 'pp');
        const pathFar = farX(code());

        return { attachNear, attachFar, pathNear, pathFar };
    });
    expect(r.attachFar, 'the twin\'s stockAttach moves the emit exactly like the wizard').toBeGreaterThan(r.attachNear + 30);
    expect(r.pathFar, 'the twin\'s pathDatum moves the emit too').not.toBe(r.pathNear);
});
