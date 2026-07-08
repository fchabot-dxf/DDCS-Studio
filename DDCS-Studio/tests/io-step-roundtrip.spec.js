import { test, expect } from '@playwright/test';

/**
 * SETUP/IO increment 2, E3 — the grouped I/O-step wizard round-trip + SETUP-menu rewiring. (1) the mode + per-mode params
 * survive the op marker codec (markerLine → parseMarker) via the auto-registered USER_SCHEMA (no FIELD_BIND orphan);
 * (2) the SETUP-menu I/O buttons open user_io_step PRE-SELECTING the matching mode (the variant → applyVariant seeds mode).
 */
test('E3 marker round-trip: user_io_step params survive markerLine → parseMarker across the 3 modes', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    const r = await page.evaluate(async () => {
        const { markerLine, parseMarker, specOf } = await import('/blocks/opSchema.js');
        const combos = [
            { mode: 'output', outputRef: 'coolant', state: 'off', pin: 0, sync: true },
            { mode: 'input', inputRef: 'xmin', mode2: 'fall', timeout: 500, var: '#5399', waitPin: 0 },
            { mode: 'dwell', sec: 2 },
        ];
        const spec = specOf('user_io_step') || {};
        const out = { specPresent: !!specOf('user_io_step'), specParams: Object.keys(spec), results: [] };
        for (const c of combos) {
            const line = markerLine('user_io_step', c, 0);
            const parsed = parseMarker(line);
            const same = parsed && parsed.opType === 'user_io_step' && Object.keys(c).every((k) => parsed.params[k] === c[k]) && Object.keys(parsed.params).length === Object.keys(c).length;
            out.results.push({ mode: c.mode, ok: !!same, line, parsed: parsed && parsed.params });
        }
        return out;
    });
    console.log('IO-STEP marker round-trip: spec params = ' + r.specParams.join(', '));
    for (const res of r.results) console.log(res.mode + ': ' + res.line + (res.ok ? ' ✓' : ' ✗ → ' + JSON.stringify(res.parsed)));
    expect(r.specPresent, 'user_io_step has an auto-registered USER_SCHEMA spec (round-trip source)').toBe(true);
    // every form param is in the spec (so the marker carries them) — the mode + per-mode fields
    for (const p of ['mode', 'outputRef', 'state', 'inputRef', 'mode2', 'timeout', 'var', 'pin', 'waitPin', 'sec']) expect(r.specParams.includes(p), 'spec carries "' + p + '"').toBe(true);
    for (const res of r.results) expect(res.ok, res.mode + ' round-trips exactly: ' + res.line).toBe(true);
});

test.use({ viewport: { width: 1400, height: 1000 } });
test('E3 SETUP-menu: the I/O buttons open user_io_step pre-selecting the mode', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await page.evaluate(async () => { const { setActiveProfile } = await import('/shared/js/profiles/controllerProfiles.js'); setActiveProfile('ddcs-expert-m350'); });
    const modeOf = async () => page.evaluate(() => { const seg = document.querySelector('#wiz_user_form [data-param="mode"] .seg-btn.seg-on'); return seg ? seg.dataset.value : null; });
    const results = {};
    for (const variant of ['output', 'input', 'dwell']) {
        await page.evaluate((v) => window.openWiz('user_io_step', v), variant);
        await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
        await page.waitForTimeout(250);
        results[variant] = await modeOf();
    }
    // the bar-special I/O section onclicks re-point to openWiz('user_io_step', <mode>)
    const onclicks = await page.evaluate(() => Array.from(document.querySelectorAll('button')).map((b) => b.getAttribute('onclick') || '').filter((o) => o.includes("openWiz('user_io_step'")));
    console.log('IO-STEP menu seeding: ' + JSON.stringify(results) + ' | onclicks: ' + JSON.stringify([...new Set(onclicks)]));
    expect(results.output, 'Set Output → mode output').toBe('output');
    expect(results.input, 'Wait Input → mode input').toBe('input');
    expect(results.dwell, 'Dwell → mode dwell').toBe('dwell');
});
