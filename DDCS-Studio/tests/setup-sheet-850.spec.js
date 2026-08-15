import { test, expect } from '@playwright/test';

/**
 * t850 — THE SETUP SHEET. A print-ready single job page; every section is READ from its already-declared source
 * (declare-never-infer). We assert each value against its INDEPENDENT truth — the seeded tool dia, the stock dims,
 * and the per-op time recomputed from the SAME secondsForLines the sheet uses — plus the honest not-declared rows,
 * the header-menu open, the print CSS (media emulation), and theme legibility.
 */
test.use({ viewport: { width: 1300, height: 980 } });

const DECLARED_STOCK = { show: true, x: 120, y: 80, z: 20, shape: 'boss', datum: 'nnp', pin: 'origin' };

// Build a real 3-op / 2-tool program: seed the tool table + stock, insert pocket/drill/contour via the wizards,
// then DECLARE each op's tool number (T1 reused on pocket+contour → dedup to 2 rows). The sheet reads params.toolNum.
//
// t1928 — a real bar-gesture Insert now REPLACES the program (t1916/t1918/t1920's own ruling: a Studio canvas
// program is always exactly one op), so three sequential inserts can no longer land three sibling ops — this
// fixture used to rely on the accumulation t1920 deliberately deleted. Built via the real import path instead,
// matching flow-labels-unique-1408.spec.js's own t1928 fix: insert each op alone, export its own marked text,
// concatenate, reimport — importMarkedNc's own groupConsecutiveOps wraps the three into ONE multi_step op's own
// steps, which is the ONE way a program holds several operations today (before step 3's own authoring UI exists).
async function seedProgram(page, stock) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.ddcsStudio && window.ddcsGetSettings && window.openWiz && window.ddcsLoadBlockStack && window.openSetupSheet, null, { timeout: 15000 });   // t1307 — the declared boot signal FIRST (t1279): the globals below exist before the deferred wiring reaches the controls this spec clicks
    await page.evaluate(async (stock) => {
        const s = window.ddcsGetSettings();
        s.stock = stock;
        s.atc = s.atc || {};
        s.atc.tools = [
            { num: 1, name: '6mm Flat Endmill', type: 'endmill', dia: 6, flutes: 2, rpm: 18000, feed: 1200, plunge: 400 },
            { num: 2, name: '3mm Ballnose', type: 'ballnose', dia: 3, flutes: 2, rpm: 20000, feed: 900, plunge: 300 },
        ];
        s.preview = s.preview || {}; s.preview.autoLoop = false;
        const parts = [];
        for (const t of ['pocket', 'drill', 'contour']) {
            window.ddcsLoadBlockStack([]);
            window.openWiz(t, undefined, true); window.updateWiz(); await window.insertWiz(); window.closeWiz && window.closeWiz();
            parts.push(window.ddcsSerializeWithMarkers());
        }
        const progMod = await import('/blocks/programModel.js');
        const imported = progMod.importMarkedNc(parts.join('\n'));
        const ops = progMod.flattenOps(imported);
        ops[0].params.toolNum = 1;   // pocket  → T1
        ops[1].params.toolNum = 2;   // drill   → T2
        ops[2].params.toolNum = 1;   // contour → T1 (reused → dedup to 2 tool rows)
        window.ddcsLoadBlockStack(imported);
    }, stock);
    await page.waitForTimeout(600);
}

// Read the rendered sheet's structured content.
const readSheet = (page) => page.evaluate(() => {
    const pg = document.querySelector('#setupSheetPage');
    const secText = (kw) => { const el = [...pg.querySelectorAll('h3')].find((x) => x.textContent.trim().toLowerCase().startsWith(kw)); return el ? el.parentElement.textContent : ''; };
    const tables = [...pg.querySelectorAll('.ss-table')];
    const rowsOf = (headMatch) => { const t = tables.find((tb) => headMatch.test(tb.querySelector('thead').textContent)); return t ? [...t.querySelectorAll('tbody tr')].map((r) => [...r.children].map((c) => c.textContent.trim())) : []; };
    return {
        title: (pg.querySelector('.ss-title') || {}).textContent || '',
        stock: secText('stock'),
        wcs: secText('work'),
        foot: (pg.querySelector('.ss-foot') || {}).textContent || '',
        toolRows: rowsOf(/Tip/),
        opRows: rowsOf(/Operation/),
    };
});

test('the header menu opens a sheet whose every section reads its DECLARED source (3 ops, 2 tools)', async ({ page }, testInfo) => {
    await seedProgram(page, DECLARED_STOCK);

    // OPENS FROM THE HEADER MENU (asserted) — the real chevron → the Setup sheet row.
    await page.locator('#hdrPostBtn').click();
    const item = page.locator('#hdrPostMenu [data-act="setupSheet"]');
    await expect(item).toBeVisible();
    await item.click();
    const ov = page.locator('#setupSheetOverlay');
    await expect(ov).toBeVisible();

    const data = await readSheet(page);

    // STOCK — the declared dims + humanized datum + sits-at (numeric spot-check: the stock dims).
    expect(data.stock, 'stock W×H×Z from settings.stock').toMatch(/120\s*.\s*80\s*.\s*20\s*mm/);
    expect(data.stock, 'datum nnp humanized (front / left)').toMatch(/front/i);
    expect(data.stock).toMatch(/left/i);
    expect(data.stock, 'pin origin → Program zero').toContain('Program zero');

    // WCS — active G54 (default active=1).
    expect(data.wcs).toContain('G54');

    // TOOLS — deduped to 2 (T1 reused); the tool dia read from the table (numeric spot-check: the tool dia).
    expect(data.toolRows.length, 'T1 reused on pocket+contour → 2 tool rows').toBe(2);
    const t1 = data.toolRows.find((r) => r[0] === 'T1');
    const t2 = data.toolRows.find((r) => r[0] === 'T2');
    expect(t1, 'T1 row present').toBeTruthy();
    expect(t1[1]).toContain('6mm Flat Endmill');
    expect(t1[2], 'T1 dia = the declared 6').toBe('6');
    expect(t1[3]).toBe('endmill');
    expect(t2[1]).toContain('3mm Ballnose');
    expect(t2[2], 'T2 dia = the declared 3').toBe('3');

    // OPERATIONS — 3 rows, the right names, each with a time.
    expect(data.opRows.length, 'a 3-op program').toBe(3);
    const names = data.opRows.map((r) => r[1].toLowerCase());
    expect(names.some((n) => /pocket/.test(n))).toBeTruthy();
    expect(names.some((n) => /drill/.test(n))).toBeTruthy();
    expect(names.some((n) => /contour/.test(n))).toBeTruthy();
    for (const r of data.opRows) expect(r[3], `op ${r[1]} shows a time`).not.toBe('—');

    // NUMERIC SPOT-CHECK: the op time — the sheet cells === an INDEPENDENT recompute over the same secondsForLines.
    const expected = await page.evaluate(async () => {
        const { secondsForLines, fmtDuration } = await import('/engine/timeEstimate.js');
        const est = window.ddcsTimeEstimate();
        const ops = (window.ddcsGetBlockProgram() || []).filter((b) => b && b.type === 'op');
        return ops.map((op) => { const s = secondsForLines(est.perLine, window.ddcsLinesForOp(op.id) || []); return s > 0 ? fmtDuration(s) : '—'; });
    });
    expect(data.opRows.map((r) => r[3]), 'the sheet op-times match the one-source per-op estimate').toEqual(expected);

    // FOOTER — total time, the pre-flight verdict, the safe-Z margin.
    expect(data.foot).toMatch(/Total run time:/);
    expect(data.foot).toMatch(/Pre-flight:/);
    expect(data.foot, 'safe-Z margin from settings.machine.safeZMargin').toContain('5 mm below home');

    await ov.screenshot({ path: testInfo.outputPath('setup-sheet-full.png') });
});

test('an undeclared stock renders the honest not-declared row (never a silent omission)', async ({ page }, testInfo) => {
    await seedProgram(page, { show: false, x: 120, y: 80, z: 20 });   // show:false → not declared
    await page.evaluate(() => window.openSetupSheet());
    await expect(page.locator('#setupSheetOverlay')).toBeVisible();
    const data = await readSheet(page);
    expect(data.stock, 'the stock section says not declared').toMatch(/not declared/i);
    expect(data.stock, 'no fabricated dims').not.toMatch(/120\s*.\s*80\s*.\s*20\s*mm/);
    await page.locator('#setupSheetOverlay').screenshot({ path: testInfo.outputPath('setup-sheet-undeclared.png') });
});

test('print media strips the app + the sheet chrome; the paper stays white (emulateMedia + screenshot)', async ({ page }, testInfo) => {
    await seedProgram(page, DECLARED_STOCK);
    await page.evaluate(() => window.openSetupSheet());
    await expect(page.locator('#setupSheetOverlay')).toBeVisible();
    await page.emulateMedia({ media: 'print' });
    const st = await page.evaluate(() => {
        const chrome = document.querySelector('.setup-sheet-chrome');
        const modal = document.querySelector('.setup-sheet-modal');
        return { chromeDisplay: getComputedStyle(chrome).display, modalBg: getComputedStyle(modal).backgroundColor };
    });
    expect(st.chromeDisplay, 'the Print/close chrome is hidden in print').toBe('none');
    expect(st.modalBg, 'the sheet is white-on-black paper in print').toBe('rgb(255, 255, 255)');
    await page.screenshot({ path: testInfo.outputPath('setup-sheet-print.png'), fullPage: true });
    await page.emulateMedia({ media: 'screen' });
});

test('the modal chrome is legible in both themes (screenshots)', async ({ page }, testInfo) => {
    await seedProgram(page, DECLARED_STOCK);
    await page.evaluate(() => window.openSetupSheet());
    await expect(page.locator('#setupSheetOverlay')).toBeVisible();
    for (const theme of ['futuristic', 'normal']) {
        await page.evaluate((t) => document.body.setAttribute('data-theme', t), theme);
        await page.waitForTimeout(90);
        await page.locator('#setupSheetOverlay').screenshot({ path: testInfo.outputPath(`setup-sheet-${theme}.png`) });
    }
});
