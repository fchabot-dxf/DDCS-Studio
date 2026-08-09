import { test, expect } from '@playwright/test';

/**
 * t1635 — SURFACING SKIM, THE BROWSER HALF. af391806 fixed "skim renders nothing — one plunge, no carve, just the
 * stock box" (t1620): `skimErrLabel`/`skimOkLabel` (93/94) collided with the raster's own row-walk labels because
 * `uniquifyFlowLabels` ran before `zMode:'skim'` was stamped onto the absorbing child, so the row-walk's own GOTOs
 * landed on the skim-OK label and the sweep never ran. The fix was verified NODE-TIER ONLY (label-uniqueness on the
 * emitted TEXT, `tests/node/surfacing-skim-982.test.mjs`) — never against the REAL browser wizard, and never by
 * actually EXECUTING the macro (following its IF/GOTO/WHILE control flow) to confirm the sim genuinely traces a
 * full raster rather than a single plunge that merely happens to have the right label text.
 *
 * This drives the real Surfacing wizard, flips Z-mode to Skim via the real `<select>`, and runs the emitted
 * program through `traceToolpath` — the SAME macro-executing engine (`GcodeExecutionEngine`, follows GOTO/WHILE,
 * resolves #vars) that drives every toolpath preview in the app, not a text scanner blind to control flow.
 */
test.use({ viewport: { width: 1280, height: 900 } });

const P = { w: 100, h: 80, toolDia: 12, stepoverPct: 60, depth: 0.5, stepdown: 0.5 };

const open = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager);
    await page.evaluate(() => window.ddcsStudio.wizardManager.open('surfacing'));
    await page.waitForSelector('#wiz_surfacing', { state: 'visible' });
};
const setParams = (page, params) => page.evaluate((p) => {
    const set = (id, v) => { const e = document.getElementById(id); if (e) { e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); } };
    for (const k in p) set('sf_' + k, p[k]);
}, params);
const code = (page) => page.evaluate(() => document.getElementById('wiz_surfacing_code').textContent);
const trace = (page, text) => page.evaluate(async (t) => {
    const { traceToolpath } = await import('/engine/trace.js');
    return traceToolpath(t);
}, text);

test('Skim mode: the REAL macro-executing sim traces the FULL raster, not one plunge over a stock box', async ({ page }) => {
    await open(page);
    await setParams(page, P);
    const normalCode = await code(page);

    await page.selectOption('#sf_zMode', 'skim');
    await page.waitForFunction((prev) => document.getElementById('wiz_surfacing_code').textContent !== prev, normalCode, { timeout: 10000 });
    const skimCode = await code(page);

    const normalTrace = await trace(page, normalCode);
    const skimTrace = await trace(page, skimCode);

    // ASSERT-THE-VALUE, not a proxy: the pre-fix bug (one plunge, no carve) would trace a near-degenerate path —
    // a handful of segments confined to the plunge point, nowhere near the declared 100×80 area. The fixed sim
    // must trace the SAME extent Normal does (skim is relative-to-jog, but the SHAPE it cuts is identical).
    expect(skimTrace.bounds, 'Skim traces the SAME footprint as Normal — the full declared area, not a point').toEqual(normalTrace.bounds);
    expect(skimTrace.bounds.maxX - skimTrace.bounds.minX, 'the traced width matches the declared area (100mm)').toBeGreaterThan(90);
    expect(skimTrace.bounds.maxY - skimTrace.bounds.minY, 'the traced height matches the declared area (comparable to 80mm, tool/stepover-derived)').toBeGreaterThan(60);

    // A "one plunge" trace would have on the order of 3-5 segments (clearance, plunge, retract). The real raster
    // sweep has dozens — comparable to Normal's own segment count, not a fraction of it.
    expect(skimTrace.segments.length, 'the skim trace has real raster segments, not a lone plunge').toBeGreaterThan(15);
    expect(skimTrace.segments.length, 'comparable segment count to Normal (same body, same walk)').toBeGreaterThan(normalTrace.segments.length - 5);
});

test('Normal mode is byte-identical (no G91, no skim frame-read markers) — the fix touched Skim only', async ({ page }) => {
    await open(page);
    await setParams(page, P);
    const normalCode = await code(page);
    expect(normalCode, 'Normal never wraps in G91').not.toContain('G91');
    expect(normalCode, 'Normal never reads the live skim frame').not.toContain('#790');
    expect(normalCode, 'Normal carries no SKIM marker').not.toContain('SKIM');
});

test('the labels: 93/94 belong to the skim guard pair, every row-walk label is pushed to 95+', async ({ page }) => {
    await open(page);
    await setParams(page, P);
    const before = await code(page);
    await page.selectOption('#sf_zMode', 'skim');
    await page.waitForFunction((prev) => document.getElementById('wiz_surfacing_code').textContent !== prev, before, { timeout: 10000 });
    const skimCode = await code(page);
    const lines = skimCode.split('\n');

    // The skim frame-read refusal: every "no frame" GOTO targets 93, and the fall-through-ok path targets 94.
    const skimGuards = lines.map((l) => l.trim()).filter((l) => /^IF #6[234] == -99999 GOTO\d+/.test(l));
    expect(skimGuards.length, 'three frame-read guards (X/Y/Z), all refusing to the same label').toBe(3);
    for (const g of skimGuards) expect(g, 'the skim refusal targets N93').toMatch(/GOTO93\b/);
    expect(lines.some((l) => l.trim() === 'N93'), 'N93 exists — the skim-err landing pad').toBe(true);
    expect(lines.some((l) => l.trim() === 'N94'), 'N94 exists — the skim-ok landing pad').toBe(true);
    expect(lines.some((l) => /^GOTO94\b/.test(l.trim())), 'the guard chain falls through past the refusal to N94').toBe(true);

    // t1620's exact bug: a row-walk label colliding with 93 or 94. The row-walk body is BETWEEN the frame-read
    // guard (the 3 `IF ... GOTO93` lines) and `END1` (the depth loop's close) — the skim error/ok landing pads
    // (N93/N94) sit AFTER `END1`, as a tail block normal completion jumps past via GOTO92→N92→GOTO94→N94, so
    // they must be excluded from "what the row-walk itself declares" or this assertion would trivially include them.
    const trimmed = lines.map((l) => l.trim());
    const guardStart = trimmed.findIndex((l) => /^IF #6[234] == -99999 GOTO93/.test(l));
    const bodyEnd = trimmed.findIndex((l) => l === 'END1');
    expect(guardStart, 'the frame-read guard is found').toBeGreaterThan(-1);
    expect(bodyEnd, 'the depth loop close is found').toBeGreaterThan(guardStart);
    const rowLabels = trimmed.slice(guardStart, bodyEnd)
        .map((l) => (l.match(/^N(\d+)$/) || [])[1])
        .filter(Boolean)
        .map(Number);
    expect(rowLabels.length, 'the row-walk declares real labels (sanity — the sweep body is present at all)').toBeGreaterThan(0);
    expect(rowLabels.every((n) => n >= 95), `every row-walk label is >= 95, none collides with skim's 93/94 (found: ${rowLabels.join(',')})`).toBe(true);
});

test('the TWIN (user_surfacing_data): Skim also traces the full raster — af391806 fixed BOTH build paths', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await page.evaluate(() => window.openWiz('user_surfacing_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible' });

    const r = await page.evaluate(async () => {
        const setP = (param, v) => { const e = document.querySelector(`#wiz_user_form [data-param="${param}"]`); if (!e) return false; e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); return true; };
        const getCode = () => (document.getElementById('wiz_user_code') || {}).textContent || '';
        setP('w', 100); setP('h', 80); setP('toolDia', 12); setP('stepoverPct', 60); setP('depth', 0.5); setP('stepdown', 0.5); setP('zMode', 'normal');
        const normalCode = getCode();
        setP('zMode', 'skim');
        const skimCode = getCode();
        const { traceToolpath } = await import('/engine/trace.js');
        return { normalBounds: traceToolpath(normalCode).bounds, skimBounds: traceToolpath(skimCode).bounds };
    });
    expect(r.skimBounds, 'the twin\'s Skim traces the SAME footprint as its own Normal — the full declared area').toEqual(r.normalBounds);
    expect(r.skimBounds.maxX - r.skimBounds.minX, 'the traced width matches the declared area').toBeGreaterThan(90);
});
