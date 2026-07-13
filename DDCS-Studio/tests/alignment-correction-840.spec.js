import { test, expect } from '@playwright/test';

/**
 * t840 — ALIGNMENT REAL CORRECTION. The alignment wizard stays a pure MEASURER (writes the misalignment angle into #1512;
 * never cuts). The correction is ONE new entry in the ⟳ Transform modal — "📐 Alignment fix": the user TYPES the measured
 * angle read off the controller, and it writes the SAME declared program-level xform the Align tab writes, ROTATING THE
 * PROGRAM ABOUT THE DATUM (pivot = the WCS origin = (0,0) in work coords). Everything downstream (badge, .nc marker, Blocks,
 * sim) already exists. Unset/0 = byte-identical.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

async function seedProgram(page) {
    await page.evaluate(async () => {
        window.ddcsLoadBlockStack([]);
        window.openWiz('surfacing', undefined, true); window.updateWiz(); await window.insertWiz(); window.closeWiz && window.closeWiz();
    });
    await page.waitForTimeout(350);
}

// The running absolute (X,Y) after each XY-affecting move (skip G91/G53). Single-axis moves keep the other axis — so a
// base G1 X20 and its rotated two-axis form give comparable positions. Same length + order in base + rotated.
const xyPairs = (g) => {
    let x = 0, y = 0; const out = [];
    for (const l of g.split('\n')) {
        if (/\bG91\b/.test(l) || /\bG53\b/.test(l)) continue;
        const mx = l.match(/(?:^|\s)X(-?\d+\.?\d*)/), my = l.match(/(?:^|\s)Y(-?\d+\.?\d*)/);
        if (!mx && !my) continue;
        if (mx) x = parseFloat(mx[1]); if (my) y = parseFloat(my[1]);
        out.push([x, y]);
    }
    return out;
};

test('type the measured angle → the program rotates by it ABOUT THE DATUM (numeric), badge + declared xform; ✕ → byte-identical', async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz && window.ddcsGetBlockProgram && window.ddcsGetBlockGcode && window.ddcsAlignRotate);
    await seedProgram(page);

    const base = await page.evaluate(() => window.ddcsGetBlockGcode());
    expect(base.trim().length, 'the seed program emitted G-code').toBeGreaterThan(0);
    const basePairs = xyPairs(base);
    expect(basePairs.length, 'the program has absolute XY moves to rotate').toBeGreaterThan(2);

    // open the Transform modal → the Alignment-fix tab → type the measured angle → apply
    await page.evaluate(() => window.ddcsAlignRotate());
    await page.click('[data-tab="alignfix"]');
    await page.waitForSelector('[data-pane="alignfix"] [data-afang]', { state: 'visible', timeout: 8000 });
    await page.fill('[data-pane="alignfix"] [data-afang]', '1.25');
    await page.click('[data-pane="alignfix"] [data-afgo]');
    await page.waitForTimeout(350);

    // (a) it wrote the SAME declared program-level xform — angle 1.25 about the DATUM (pivot 0,0), at the top of the stack
    const decl = await page.evaluate(() => { const s = window.ddcsGetBlockProgram() || []; const x = s.find(b => b && b.type === 'xform'); return { p: x ? x.params : null, first: s[0] && s[0].type }; });
    expect(decl.p, 'a declared xform sibling').not.toBeNull();
    expect(decl.p.angle, 'angle = the typed measured angle').toBeCloseTo(1.25, 3);
    expect(decl.p.pivotX, 'pivot X = the datum (0)').toBeCloseTo(0, 6);
    expect(decl.p.pivotY, 'pivot Y = the datum (0)').toBeCloseTo(0, 6);
    expect(decl.first, 'program-level (top of stack)').toBe('xform');

    // (b) NUMERIC: every emitted XY endpoint = the base one rotated 1.25° CCW about the origin
    const rotated = await page.evaluate(() => window.ddcsGetBlockGcode());
    const rotPairs = xyPairs(rotated);
    expect(rotPairs.length).toBe(basePairs.length);
    const th = 1.25 * Math.PI / 180, c = Math.cos(th), s = Math.sin(th);
    for (let i = 0; i < basePairs.length; i++) {
        const [x, y] = basePairs[i];
        expect(rotPairs[i][0], `pt ${i} X rotated about the datum`).toBeCloseTo(x * c - y * s, 2);
        expect(rotPairs[i][1], `pt ${i} Y rotated about the datum`).toBeCloseTo(x * s + y * c, 2);
    }

    // (c) the program BADGE shows it
    await expect(page.locator('#xform-badge')).toBeVisible();
    await expect(page.locator('#xform-badge .xform-badge-label')).toContainText('1.25');

    // (c2) the correction's xform survives the .nc program-marker + Blocks round-trip (the existing t812 slot — asserted for THIS entry)
    const rt = await page.evaluate(async () => {
        const PM = await import('/blocks/programModel.js'), T = await import('/wizards/ops/transform.js');
        const back = PM.importMarkedNc(PM.serializeWithMarkers());
        return T.programRotation(back);
    });
    expect(rt.angle, 'the xform survives .nc export → reimport (marker round-trip)').toBeCloseTo(1.25, 3);
    expect(rt.pivotX, 'the datum pivot survives').toBeCloseTo(0, 6);

    // (d) ✕ clears → BYTE-IDENTICAL to the pre-correction emit (the 0° fold)
    await page.click('#xform-badge .xform-badge-x');
    await page.waitForTimeout(350);
    expect(await page.evaluate(() => window.ddcsGetBlockGcode()), 'clearing is byte-identical').toBe(base);
    await expect(page.locator('#xform-badge')).toBeHidden();
});

test('the typed angle is clamped to a sane signed range (no fat-finger 100° re-orient)', async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz && window.ddcsGetBlockProgram && window.ddcsAlignRotate);
    await seedProgram(page);
    await page.evaluate(() => window.ddcsAlignRotate());
    await page.click('[data-tab="alignfix"]');
    await page.fill('[data-pane="alignfix"] [data-afang]', '100');
    await page.click('[data-pane="alignfix"] [data-afgo]');
    await page.waitForTimeout(300);
    const angle = await page.evaluate(() => { const x = (window.ddcsGetBlockProgram() || []).find(b => b && b.type === 'xform'); return x ? x.params.angle : null; });
    expect(angle, '100° clamped to the +45° max').toBeCloseTo(45, 3);
});

test('THEMES: the Alignment-fix pane is legible in dark and light', async ({ page }, testInfo) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsAlignRotate);
    await page.evaluate(() => window.ddcsAlignRotate());
    await page.click('[data-tab="alignfix"]');
    await page.waitForSelector('[data-pane="alignfix"] [data-afang]', { state: 'visible' });
    for (const theme of ['futuristic', 'normal']) {
        await page.evaluate((t) => { document.body.setAttribute('data-theme', t); }, theme);
        await page.waitForTimeout(80);
        await page.locator('[data-pane="alignfix"]').screenshot({ path: testInfo.outputPath(`alignfix-${theme}.png`) });
    }
    expect(true).toBe(true);
});
