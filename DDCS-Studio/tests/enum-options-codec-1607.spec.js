import { test, expect } from '@playwright/test';

/**
 * t1607 — the ENUM OPTIONS CODEC carries STRING values.
 *
 * The declared truth is the binding's TYPE: an enum/string-typed row keeps its declared string values through
 * the options round-trip (the `label=value` serializer in paramGroupFromBindings ↔ parseParamOptions); numeric
 * COERCION — with its drop-what-isn't-a-number contract — applies only where the type is numeric (the GUI param
 * pill lands in a numeric socket, valid by construction; that contract is unchanged).
 *
 * What the old numeric-only parse did to a shipped twin (found at t1605, promoted here): stockAttach's declared
 * options are [['Follow stock datum',''], ['Front Left','nn'], …] — the serializer writes "Follow stock datum=,
 * Front Left=nn, …", and the parse then kept exactly ONE corrupted entry (Number('') is 0 → ['Follow stock
 * datum', 0]) and dropped the nine real ones (Number('nn') is NaN). Because ONE entry survived, the row's
 * widgetConfig REPLACED the binding's full list, and both faces rendered a one-option select whose value matched
 * nothing. (stockDatum only looked healthy because ALL its options dropped — an empty parse leaves the binding's
 * own widgetConfig standing. Working by total failure, not by design.)
 */

const XY = [
    ['Follow stock datum', ''], ['Front Left', 'nn'], ['Front Center', 'cn'], ['Front Right', 'pn'],
    ['Center Left', 'nc'], ['Center', 'cc'], ['Center Right', 'pc'], ['Back Left', 'np'], ['Back Center', 'cp'], ['Back Right', 'pp'],
];

test('the codec round-trips string enum values EXACTLY — and the numeric pill contract is untouched', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/', { timeout: 60000 });
    await page.waitForFunction(() => window.ddcsStudio && window.showApp, null, { timeout: 60000 });
    const r = await page.evaluate(async (xy) => {
        const U = await import('/blocks/userOps.js');
        // Drive the REAL pair: binding → paramGroupFromBindings (the serializer) → param_field block record →
        // paramFieldsFromStack (the parser) → the row the form consumes.
        const def = {
            bindings: [{ param: 'att', blockIndex: 0, type: 'enum', widget: 'dropdown', default: '', widgetConfig: { options: xy } }],
        };
        const pg = U.paramGroupFromBindings(def);
        const template = [{ type: 'user_root', params: {}, uiChildren: [pg], children: [] }];
        const row = U.paramFieldsFromStack(template).find((x) => x.param === 'att');
        return {
            serialized: pg.children[0].params.options,
            roundTripped: row && row.widgetConfig ? row.widgetConfig.options : null,
            pill: U.parseParamOptions('Rough=500, Finish=1500\nbad=xx\n750'),
        };
    }, XY);
    expect(r.roundTripped, 'an enum row round-trips its declared options byte-for-byte — empty-string value included').toEqual(XY);
    expect(r.pill, 'the numeric pill contract is UNCHANGED: coerce, drop non-numeric, bare number self-labels').toEqual([['Rough', 500], ['Finish', 1500], ['750', 750]]);
});

test('the BLOCKS wizard-view face renders a matched stockAttach/pathDatum select', async ({ page }) => {
    test.setTimeout(180_000);
    page.on('dialog', (d) => d.accept());
    await page.goto('/', { timeout: 60000 });
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsEditWizardDef, null, { timeout: 60000 });
    await page.evaluate(() => window.showApp && window.showApp('blocks'));
    await page.waitForFunction(() => !!window.__blkws, null, { timeout: 60000 });
    await page.evaluate(() => window.ddcsLoadBlockStack([]));
    await page.evaluate(() => window.ddcsEditWizardDef('user_surfacing_data'));
    let last = -1;
    for (let i = 0; i < 120; i++) {
        const n = await page.evaluate(() => window.__blkws.getAllBlocks().length);
        if (n === last) break;
        last = n;
        await page.waitForTimeout(250);
    }
    // t1752 — Surfacing via Customize is deterministically the createUserOpView('blk') host now (sectioned
    // template, customizing=true — never the placed-op read-only case), not the old #blk-form.
    for (const param of ['stockAttach', 'pathDatum']) {
        const s = await page.evaluate((p) => {
            const el = document.querySelector(`#blk_wiz_user_form [data-param="${p}"]`);
            return el && el.tagName === 'SELECT' ? { n: el.options.length, value: el.value, selLabel: el.selectedOptions[0] && el.selectedOptions[0].textContent } : null;
        }, param);
        expect(s, `${param} is a select`).not.toBeNull();
        expect(s.n, `${param} carries the full declared option set`).toBe(10);
        // The MATCH is the value, not the first-option accident: a select whose options match nothing silently
        // shows its first option — asserting the label alone would pass on the broken tree.
        expect(s.value, `${param}'s selected VALUE is the declared default ('' = follow the stock datum)`).toBe('');
        expect(s.selLabel, `${param} shows the follow option`).toBe('Follow stock datum');
    }
});

test('the FLAT Generator-Modal face renders the same matched select', async ({ page }) => {
    test.setTimeout(180_000);
    page.on('dialog', (d) => d.accept());
    await page.goto('/', { timeout: 60000 });
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager, null, { timeout: 60000 });
    await page.evaluate(() => window.ddcsStudio.wizardManager.open('user_surfacing_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 30000 });
    for (const param of ['stockAttach', 'pathDatum']) {
        const s = await page.evaluate((p) => {
            const el = document.querySelector(`#wiz_user_form [data-param="${p}"]`);
            return el && el.tagName === 'SELECT' ? { n: el.options.length, value: el.value, selLabel: el.selectedOptions[0] && el.selectedOptions[0].textContent } : null;
        }, param);
        expect(s, `${param} is a select`).not.toBeNull();
        expect(s.n, `${param} carries the full declared option set`).toBe(10);
        expect(s.value, `${param}'s selected VALUE is the declared default`).toBe('');
        expect(s.selLabel, `${param} shows the follow option`).toBe('Follow stock datum');
    }
});
