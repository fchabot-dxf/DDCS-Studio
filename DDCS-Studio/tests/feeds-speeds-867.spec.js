import { test, expect } from '@playwright/test';

/**
 * t867 — THE FEEDS & SPEEDS HELPER (backlog item 8). Suggest RPM + feed from the tool, the material, and the declared
 * spindle. A declared MATERIALS table (materials.js, the threads.js precedent) + the classic math (RPM = SS·1000/(π·dia)
 * clamped to the spindle range; feed = RPM·flutes·chipLoad). The wizard forms get a material dropdown + an advisory
 * "Suggest feed" button that fills feed (never auto-overwrites; the user owns the numbers). Material is bindingless →
 * a picked material round-trips, an unset one is byte-identical (it drives no G-code socket).
 */
test.use({ viewport: { width: 1300, height: 950 } });

test('feeds & speeds MATH: hand-computed RPM + feed for 3 material×tool combos incl. a spindle clamp (+ null guards)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio, null, { timeout: 15000 });
    const r = await page.evaluate(async () => {
        const M = await import('/wizards/materials.js');
        const sp = { minRpm: 0, maxRpm: 24000 };
        // INDEPENDENT hand-computation from the declared table + the classic formula (not echoing the module's output).
        const calc = (name, dia, flutes) => {
            const row = M.material(name);
            const ss = (row.surfaceSpeed[0] + row.surfaceSpeed[1]) / 2;
            const cr = row.chipLoad[Math.min(M.chipBand(dia), row.chipLoad.length - 1)];
            const chip = (cr[0] + cr[1]) / 2;
            const wanted = Math.round(ss * 1000 / (Math.PI * dia));
            const rpm = Math.min(wanted, sp.maxRpm);
            return { wanted, rpm, feed: Math.round(rpm * flutes * chip), clamped: wanted > sp.maxRpm ? 'max' : null };
        };
        const got = (name, dia, flutes) => M.suggestFeedsSpeeds({ materialName: name, dia, flutes, spindle: sp });
        return {
            al: { c: calc('Aluminum', 6, 2), g: got('Aluminum', 6, 2) },
            st: { c: calc('Steel', 6, 2), g: got('Steel', 6, 2) },
            clamp: { c: calc('Aluminum', 1, 2), g: got('Aluminum', 1, 2) },
            noMat: got('', 6, 2), noDia: got('Aluminum', 0, 2),
            blankFlutes: got('Aluminum', 6, ''),   // blank flutes → the tool-table default 2
        };
    });
    for (const k of ['al', 'st', 'clamp']) {
        expect(r[k].g.rpm, `${k} RPM == hand-computed SS·1000/(π·dia), clamped`).toBe(r[k].c.rpm);
        expect(r[k].g.feed, `${k} feed == hand-computed RPM·flutes·chipLoad`).toBe(r[k].c.feed);
    }
    // the CLAMP is reported honestly: clamped='max', the wanted (pre-clamp) rpm, rpm==spindle max
    expect(r.clamp.g.clamped, 'clamp case reports clamped=max').toBe('max');
    expect(r.clamp.g.wantedRpm, 'clamp case reports the wanted pre-clamp rpm').toBe(r.clamp.c.wanted);
    expect(r.clamp.g.rpm, 'clamp case rpm == spindle max (24000)').toBe(24000);
    expect(r.al.g.clamped, 'the in-range case is not clamped').toBeNull();
    // guards + the blank-flutes default
    expect(r.noMat, 'no material → null (no suggestion)').toBeNull();
    expect(r.noDia, 'no diameter → null').toBeNull();
    expect(r.blankFlutes.feed, 'blank flutes → default 2 → same as flutes:2').toBe(r.al.g.feed);
});

test('BYTE-IDENTITY: a material param (set OR empty) never changes the emit — it drives no G-code socket (pocket + drill)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio, null, { timeout: 15000 });
    const r = await page.evaluate(async () => {
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const check = (op, base) => {
            const em = (p) => emitMapped(builderOf(op)(p)).text;
            const none = em(base);
            return { setSame: none === em({ ...base, material: 'Aluminum' }), emptySame: none === em({ ...base, material: '' }) };
        };
        return {
            pocket: check('user_pocket_data', { shape: 'rect', w: 80, h: 60, toolDia: 6, feed: 600 }),
            drill: check('user_drill_data', { pattern: 'grid', cols: 2, rows: 2, dx: 20, dy: 20, feed: 100 }),
        };
    });
    expect(r.pocket.setSame, 'pocket: a picked material → byte-identical emit').toBe(true);
    expect(r.pocket.emptySame, 'pocket: an empty material → byte-identical emit (goldens untouched)').toBe(true);
    expect(r.drill.setSame, 'drill: a picked material → byte-identical emit').toBe(true);
    expect(r.drill.emptySame, 'drill: an empty material → byte-identical emit').toBe(true);
});

test('the helper RENDERS in the pocket twin + APPLY fills feed and shows the working (advisory, on click only)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz, null, { timeout: 15000 });
    await page.evaluate(() => window.openWiz('user_pocket_data', null, true));
    await page.waitForSelector('#wiz_user_form [data-param="material"]', { timeout: 8000 });
    await expect(page.locator('#wiz_user_form .feedsuggest-btn')).toHaveCount(1);

    const r = await page.evaluate(() => {
        const form = document.getElementById('wiz_user_form');
        const set = (p, v, ev) => { const el = form.querySelector(`[data-param="${p}"]`); if (el) { el.value = v; el.dispatchEvent(new Event(ev || 'input', { bubbles: true })); } };
        const tn = form.querySelector('[data-param="toolNum"]'); if (tn) tn.value = '';   // no tool → flutes defaults to 2
        set('toolDia', '6'); set('material', 'Aluminum', 'change');
        const feedBefore = form.querySelector('[data-param="feed"]').value;
        form.querySelector('.feedsuggest-btn').click();   // the EXPLICIT apply
        return { feedBefore, feedAfter: form.querySelector('[data-param="feed"]').value, title: form.querySelector('.feedsuggest-btn').title, note: form.querySelector('.feedsuggest-note').textContent };
    });
    // Aluminum · Ø6 · 2 flutes → feed 947 (see the math test); the button never touched feed until the click
    expect(r.feedAfter, 'apply filled Feed from the material suggestion (Aluminum Ø6 2fl → 947)').toBe('947');
    expect(r.feedBefore, 'feed was untouched before the click (advisory)').not.toBe('947');
    // the working is shown transparently (the formula + the computed numbers), not a magic value
    expect(r.title, 'the tooltip shows the RPM working').toContain('RPM = 210');
    expect(r.title, 'the tooltip shows the feed working').toContain('= 947 mm/min');
    expect(r.note, 'the inline note shows the applied feed + RPM').toContain('feed 947');
});

test('the helper RENDERS in the drill twin + APPLY fills feed from the selected tool (Ø + flutes)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz, null, { timeout: 15000 });
    await page.evaluate(() => window.openWiz('user_drill_data', null, true));
    await page.waitForSelector('#wiz_user_form [data-param="material"]', { timeout: 8000 });
    await expect(page.locator('#wiz_user_form .feedsuggest-btn')).toHaveCount(1);

    const r = await page.evaluate(() => {
        const form = document.getElementById('wiz_user_form');
        // drill has no tool-Ø field → the suggestion reads Ø + flutes from the SELECTED tool (default lib tool 1 = 6mm 2fl)
        const tn = form.querySelector('[data-param="toolNum"]'); tn.value = '1'; tn.dispatchEvent(new Event('change', { bubbles: true }));
        const mat = form.querySelector('[data-param="material"]'); mat.value = 'Aluminum'; mat.dispatchEvent(new Event('change', { bubbles: true }));
        form.querySelector('.feedsuggest-btn').click();
        return { feedAfter: form.querySelector('[data-param="feed"]').value, title: form.querySelector('.feedsuggest-btn').title };
    });
    expect(r.feedAfter, 'drill apply filled Feed from tool 1 (Ø6 2fl) + Aluminum → 947').toBe('947');
    expect(r.title, 'the tooltip shows the working').toContain('feed = 11141');
});

test('screenshots: the feeds helper in the pocket + drill twins, both themes', async ({ page }, testInfo) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz, null, { timeout: 15000 });
    for (const op of ['user_pocket_data', 'user_drill_data']) {
        await page.evaluate((o) => window.openWiz(o, null, true), op);
        await page.waitForSelector('#wiz_user_form [data-param="material"]', { timeout: 8000 });
        // pick a material + scroll the helper row into view so the screenshot SHOWS it (it sits below Feed)
        await page.evaluate(() => {
            const m = document.querySelector('#wiz_user_form [data-param="material"]');
            m.value = 'Aluminum'; m.dispatchEvent(new Event('change', { bubbles: true }));
            m.closest('[data-param], div').scrollIntoView({ block: 'center' });
        });
        await page.locator('#wiz_user_form .feedsuggest-btn').click();   // show the worked-out note
        for (const theme of ['studio', 'futuristic']) {
            await page.evaluate((t) => document.body.setAttribute('data-theme', t), theme);
            await page.waitForTimeout(90);
            const short = op.replace('user_', '').replace('_data', '');
            await page.locator('#wiz_user').screenshot({ path: testInfo.outputPath(`t867-${short}-${theme}.png`) });
        }
    }
});
