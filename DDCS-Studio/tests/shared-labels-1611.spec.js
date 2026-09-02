import { test, expect } from '@playwright/test';
import { waitReady } from './_boot.js';

/**
 * t1611 — SHARED_LABELS: the placement family gets friendly names, declared ONCE.
 *
 * The twin forms rendered raw param names — `stockAttach`, `pathDatum`, `offZ`, `w` — because no twin
 * declares labels for the placement family and no shared label source existed. The declaration is the
 * missing sibling of the shared FIELD_HELP table (formWidgets.js): one entry per CONCEPT, resolved
 * `binding.label → SHARED_LABELS[param] → raw name` by the ONE resolver (`labelFor`, called by labelSpan,
 * which every widget on BOTH binding-driven faces renders through). A per-binding label still wins for
 * wizard-specific phrasing.
 *
 * Every expected string here is READ FROM THE IMPORTED DECLARATION in-page — a drifted copy cannot pass.
 */

const PARAMS = ['stockAttach', 'pathDatum', 'offZ', 'w'];

/** The label text of the row holding [data-param=<p>] inside <root> — the label span's FIRST text node,
 *  so a units suffix ("(mm)") does not ride along. */
const labelsIn = (page, rootSel) => page.evaluate(({ rootSel, params }) => {
    const out = {};
    for (const p of params) {
        const inp = document.querySelector(`${rootSel} [data-param="${p}"]`);
        const span = inp && inp.parentElement && inp.parentElement.querySelector('span');
        out[p] = span && span.firstChild ? span.firstChild.textContent : null;
    }
    return out;
}, { rootSel, params: PARAMS });

const declared = (page) => page.evaluate(async () => {
    const F = await import('/ui/formWidgets.js');
    return { map: F.SHARED_LABELS, resolves: [
        F.labelFor({ param: 'stockAttach' }),                          // shared
        F.labelFor({ param: 'stockAttach', label: 'My phrasing' }),    // explicit wins
        F.labelFor({ param: 'no_such_param_xyz' }),                    // t2541 -- Title-Cased derived fallback, not raw
    ] };
});

test('the resolver chain: explicit label → SHARED_LABELS → derived → raw name', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/', { timeout: 60000 });
    await waitReady(page, () => window.ddcsStudio);
    const d = await declared(page);
    expect(d.map, 'the shared map exists and covers the placement family').toBeTruthy();
    for (const p of PARAMS) expect(d.map[p], `SHARED_LABELS declares ${p}`).toBeTruthy();
    expect(d.resolves[0], 'no explicit label → the shared one').toBe(d.map.stockAttach);
    expect(d.resolves[1], 'an explicit label WINS').toBe('My phrasing');
    // t2541 (BACKLOG #71) -- an unknown param, below SHARED_LABELS, now Title-Cases via the DERIVED tier
    // instead of showing the bare identifier -- see label-auto-derive-2541.spec.js for the mechanism itself.
    expect(d.resolves[2], 'unknown param → Title-Cased, never the raw identifier').toBe('No Such Param Xyz');
});

test('the twin Generator Modal renders the friendly names — and an explicit label keeps winning', async ({ page }) => {
    test.setTimeout(120_000);
    page.on('dialog', (d) => d.accept());
    await page.goto('/', { timeout: 60000 });
    await waitReady(page, () => window.ddcsStudio && window.ddcsStudio.wizardManager);
    await page.evaluate(() => window.ddcsStudio.wizardManager.open('user_surfacing_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 30000 });
    const d = await declared(page);
    const got = await labelsIn(page, '#wiz_user_form');
    for (const p of PARAMS) expect(got[p], `${p} renders its SHARED label, not the raw name`).toBe(d.map[p]);
    // A binding that DOES declare a label is untouched — surfacing's confirmEvery declares its own phrasing.
    const explicit = await page.evaluate(() => {
        const inp = document.querySelector('#wiz_user_form [data-param="confirmEvery"]');
        const span = inp && inp.parentElement && inp.parentElement.querySelector('span');
        return span && span.firstChild ? span.firstChild.textContent : null;
    });
    expect(explicit, 'a declared per-binding label still wins').toBe('Confirm every N passes');
});

test('the Blocks Wizard View face resolves through the SAME chain', async ({ page }) => {
    test.setTimeout(180_000);
    page.on('dialog', (d) => d.accept());
    await page.goto('/', { timeout: 60000 });
    // t2351 — the app's own declared "everything is wired" signal (t1279), not a hand-picked global subset —
    // see wizard-face-1599's own boot() for the full trace of why this class of wait was silently racy.
    await waitReady(page, () => document.documentElement.dataset.ddcsReady === '1');
    await page.evaluate(() => window.showApp && window.showApp('blocks'));
    await waitReady(page, () => !!window.__blkws);
    await page.evaluate(() => window.ddcsLoadBlockStack([]));
    await page.evaluate(() => window.ddcsEditWizardDef('user_surfacing_data'));
    let last = -1;
    for (let i = 0; i < 120; i++) {
        const n = await page.evaluate(() => window.__blkws.getAllBlocks().length);
        if (n === last) break;
        last = n;
        await page.waitForTimeout(250);
    }
    const d = await declared(page);
    // t1752 — Surfacing via Customize is deterministically the createUserOpView('blk') host now (sectioned
    // template, customizing=true — never the placed-op read-only case), not the old #blk-form.
    const got = await labelsIn(page, '#blk_wiz_user_form');
    for (const p of PARAMS) expect(got[p], `${p} renders its SHARED label on the blocks face too`).toBe(d.map[p]);
});
