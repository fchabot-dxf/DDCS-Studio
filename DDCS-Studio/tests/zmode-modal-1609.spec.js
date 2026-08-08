import { test, expect } from '@playwright/test';

/**
 * t1609 — Z-MODE reaches the hand-coded Surfacing MODAL, consuming the twin's declaration.
 *
 * The capability shipped end-to-end except the knob: the emit has handled `zMode === 'skim'` since 8ce70873
 * (relative lift, G91-wrapped body, G53 retract machine-absolute), and the twin declares the dropdown + the
 * skim-greys-WCS gate (surfacingData.js SURFACING_STRUCT / the wcs binding's `gate`). The hand-coded modal
 * never grew the field. The rule under test: the modal CONSUMES the declaration — every assertion here reads
 * the expected options/label/help/default/tip from the IMPORTED declaration, never from a copied list, so a
 * drifted second source cannot pass.
 */

const openModal = async (page) => {
    await page.goto('/', { timeout: 60000 });
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager, null, { timeout: 60000 });
    await page.evaluate(() => window.ddcsStudio.wizardManager.open('surfacing'));
    await page.waitForSelector('#wiz_surfacing', { state: 'visible', timeout: 30000 });
};
const decl = (page) => page.evaluate(async () => {
    const D = await import('/blocks/dataOps/surfacingData.js');
    const z = D.SURFACING_STRUCT.find((b) => b.param === 'zMode');
    const gate = D.SURFACING_BINDINGS.find((b) => b.param === 'wcs').gate;
    return { z, gate };
});

test('the Z-mode dropdown IS the twin declaration — options, default, label, help all consumed', async ({ page }) => {
    test.setTimeout(120_000);
    await openModal(page);
    const d = await decl(page);
    const s = await page.evaluate(() => {
        const sel = document.getElementById('sf_zMode');
        const lbl = document.getElementById('sf_zModeLabel');
        return sel ? {
            options: [...sel.options].map((o) => [o.textContent, o.value]),
            value: sel.value, title: sel.title, label: lbl && lbl.textContent,
        } : null;
    });
    expect(s, 'the field exists in the modal').not.toBeNull();
    expect(s.options, 'the options are the DECLARED ones').toEqual(d.z.widgetConfig.options);
    expect(s.value, "the select VALUE is the declared default ('normal' — user-ruled Normal — WCS Z0)").toBe(String(d.z.default));
    expect(s.title, 'the help is the declared help').toBe(d.z.help);
    expect(s.label, 'the label is the declared label (presentation case only)').toBe(String(d.z.label).toUpperCase());
});

test('Skim greys the WCS with the DECLARED tip; Normal restores it', async ({ page }) => {
    test.setTimeout(120_000);
    await openModal(page);
    const d = await decl(page);
    const wcsState = () => page.evaluate(() => {
        const w = document.getElementById('sf_wcs');
        return { disabled: w.disabled, gated: w.getAttribute('data-op-gated'), title: w.title };
    });
    const before = await wcsState();
    expect(before.disabled, 'Normal: the WCS select is usable').toBe(false);
    await page.selectOption('#sf_zMode', 'skim');
    let after = await wcsState();
    expect(after.disabled, 'Skim: the WCS select greys').toBe(true);
    expect(after.gated, 'data-op-gated survives postGating').toBe('true');
    expect(after.title, 'the tip is the DECLARED gate tip, not a copy').toBe(d.gate.tip);
    await page.selectOption('#sf_zMode', 'normal');
    after = await wcsState();
    expect(after.disabled, 'back to Normal: usable again').toBe(false);
    expect(after.title, 'the original help title returns').toBe(before.title);
});

test('emit: byte-identical at default; Skim flips to the relative shape and flips back clean', async ({ page }) => {
    test.setTimeout(120_000);
    await openModal(page);
    // Engine-level pin: zMode 'normal' (the declared default the field now always sends) === no zMode at all.
    const engine = await page.evaluate(async () => {
        const { SurfacingWizard } = await import('/wizards/surfacingWizard.js');
        const w = new SurfacingWizard();
        const P = { w: 100, h: 80, depth: 0.5, stepdown: 0.5, toolDia: 12, stepoverPct: 60, feed: 2000, plunge: 200, wcs: 'active' };
        return { bare: w.generate(P), normal: w.generate({ ...P, zMode: 'normal' }) };
    });
    expect(engine.normal, "engine: zMode 'normal' emits byte-identically to NO zMode — existing programs unchanged").toBe(engine.bare);
    // Modal-level: the real preview flips shape with the real gesture, and returns byte-identically. The
    // parametric skim shape is not a G91 wrap: it READS the live jogged frame (#62=#790 work X …) behind a
    // sentinel-refuse, and cuts against that frame — assert those markers, which only the skim fold emits.
    const code = () => page.evaluate(() => document.getElementById('wiz_surfacing_code').textContent);
    const atDefault = await code();
    expect(atDefault, 'default preview is the Normal shape — no skim frame-read').not.toContain('SKIM');
    await page.selectOption('#sf_zMode', 'skim');
    await page.waitForFunction((prev) => document.getElementById('wiz_surfacing_code').textContent !== prev, atDefault, { timeout: 10000 });
    const atSkim = await code();
    expect(atSkim, 'Skim: the live-frame read appears').toContain('SKIM');
    expect(atSkim, 'the frame comes from the machine (live work X), never assumed').toContain('#62=#790');
    await page.selectOption('#sf_zMode', 'normal');
    await page.waitForFunction((prev) => document.getElementById('wiz_surfacing_code').textContent !== prev, atSkim, { timeout: 10000 });
    expect(await code(), 'back to Normal: byte-identical to the first render').toBe(atDefault);
});

test('EDIT round-trip: an inserted Skim op re-opens as Skim (schema + field-bind carry zMode)', async ({ page }) => {
    test.setTimeout(120_000);
    page.on('dialog', (d) => d.accept());
    await openModal(page);
    // The REAL gesture: pick Skim, INSERT, re-open the placed op for edit. Without the opSchema zMode entry,
    // _seedForm silently reseeded the field to Normal — and a re-save would have flipped the stored op's emit.
    await page.selectOption('#sf_zMode', 'skim');
    await page.click('button:has-text("INSERT")');
    const opId = await page.waitForFunction(() => {
        const op = ((window.ddcsGetBlockProgram && window.ddcsGetBlockProgram()) || []).find((b) => b && b.type === 'op' && b.opType === 'surfacing');
        return op && op.params && op.params.zMode === 'skim' ? op.id : null;
    }, null, { timeout: 10000 }).then((h) => h.jsonValue());
    // DISTURB the field first: the select would otherwise simply KEEP its DOM value across the same-page
    // close/reopen and the assertion would pass with no seeding at all (proven — the first version of this
    // test stayed green with the schema entry reverted). Silent value write, no events: only the edit
    // path's _seedForm can put 'skim' back.
    await page.evaluate(() => { document.getElementById('sf_zMode').value = 'normal'; });
    await page.evaluate((id) => window.ddcsStudio.wizardManager.openForEdit(id), opId);
    await page.waitForSelector('#wiz_surfacing', { state: 'visible', timeout: 30000 });
    await expect(page.locator('#sf_zMode'), 'the stored Skim survives the edit re-open').toHaveValue('skim');
    const wcs = await page.evaluate(() => document.getElementById('sf_wcs').disabled);
    expect(wcs, 'and the gate re-applies on the seeded state').toBe(true);
});
