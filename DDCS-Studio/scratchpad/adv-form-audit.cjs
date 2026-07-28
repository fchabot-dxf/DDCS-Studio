/* PHASE 0 — WIZARD COMPLETENESS AUDIT (advisor, read-only). Opens EVERY twin, dumps form defects:
 * empty dropdowns, value-not-in-options, unlabeled fields, panel presence. Output = one JSON table. */
const { chromium } = require('playwright');

const OPS = [
    'user_drill_data', 'user_bore_data', 'user_slot_data', 'user_pocket_data', 'user_contour_data',
    'user_surfacing_data', 'user_text_data', 'user_wcs_data', 'user_corner_data', 'user_edge_data',
    'user_middle_data', 'user_alignment_data', 'user_rotary_center_data', 'user_rotary_clock_data',
    'user_comm_data', 'user_io_step', 'user_homing_data', 'user_atc_change_data', 'user_atc_test_data',
    'user_atc_table_data', 'user_atc_length_data', 'user_atc_check_data', 'user_atc_warmup_data',
];

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1300, height: 980 } });
    const report = [];
    await page.goto('http://localhost:5599');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz, null, { timeout: 20000 });
    for (const op of OPS) {
        try {
            await page.evaluate((t) => window.openWiz(t), op);
            await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
            await page.waitForTimeout(350);
            const audit = await page.evaluate(() => {
                const form = document.querySelector('#wiz_user_form');
                const fields = [...form.querySelectorAll('[data-param]')];
                const emptySelects = [], valueMismatch = [], unlabeled = [];
                for (const f of fields) {
                    const p = f.getAttribute('data-param');
                    if (f.tagName === 'SELECT') {
                        const opts = [...f.options].map((o) => o.value);
                        if (opts.length === 0) emptySelects.push(p);
                        else if (!opts.includes(f.value)) valueMismatch.push(p + '=' + JSON.stringify(f.value));
                    }
                    const row = f.closest('label,.uop-row,.wiz-row,div');
                    const txt = row ? (row.textContent || '').trim() : '';
                    if (!txt) unlabeled.push(p);
                }
                const host = document.querySelector('#wiz_user');
                return {
                    fields: fields.length,
                    selects: fields.filter((f) => f.tagName === 'SELECT').length,
                    emptySelects, valueMismatch, unlabeled,
                    has3d: !!host.querySelector('canvas'),
                    has2d: !!host.querySelector('svg .fc-stock, svg .fc-path, svg .fc-guide, svg .fc-handle'),
                };
            });
            report.push({ op, ...audit });
            await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^cancel$/i.test(x.textContent.trim())); if (b && b.offsetParent) b.click(); });
            await page.waitForTimeout(150);
        } catch (e) {
            report.push({ op, ERROR: String(e).slice(0, 120) });
            await page.goto('http://localhost:5599');
            await page.waitForFunction(() => window.ddcsStudio && window.openWiz, null, { timeout: 20000 });
        }
    }
    for (const r of report) {
        const bad = (r.emptySelects && r.emptySelects.length) || (r.valueMismatch && r.valueMismatch.length) || r.ERROR;
        console.log((bad ? 'BAD  ' : 'ok   ') + JSON.stringify(r));
    }
    await browser.close();
})();
