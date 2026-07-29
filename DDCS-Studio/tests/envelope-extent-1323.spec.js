import { test, expect } from '@playwright/test';

/**
 * t1323 (2) — THE ENVELOPE CHECK STOPS CRYING WOLF ON JOG-START PROGRAMS.
 *
 * USER SCARE: a correct skim program — jog to the corner, then a G91 body — drew a COLUMN OF RED 'over' badges. The
 * checker had anchored the relative walk at the workspace origin and measured that invented anchor against the machine
 * box. The anchor was a PROXY; the program never claimed it.
 *
 * THE HAZARD, specified: for a walk from an unknown start, the only true question is whether the SWEEP FITS THE TRAVEL
 * AT ALL — the EXTENT (bounding box of the walk, a difference, so the unknown anchor cancels) against the envelope SPAN.
 *   · extent fits  → no red anywhere, and ONE calm note naming the clearance the operator must leave.
 *   · extent wider → red, naming the axis and both numbers — a fact about the whole program, not about a line.
 * An ABSOLUTE-anchored program is unchanged: it says where it is, so every line is judged as before.
 */
test.use({ viewport: { width: 1400, height: 950 } });

// The user's shape: no G90, no G53, no homing — the operator jogs to the corner and presses go.
const SKIM = [
    '( skim — start where you jog it )',
    'G91',
    'M3 S12000',
    'G1 Z-1.5 F200',
    'G1 X100 F900',
    'G1 Y18',
    'G1 X-100',
    'G1 Y18',
    'G1 X100',
    'G1 Y18',
    'G1 X-100',
    'G0 Z10.5',
    'M5',
    'M30',
].join('\n');

// The same walk, ANCHORED: one G90 move says where it is, so per-line truth applies again.
const ANCHORED = ['G90', 'M3 S12000', 'G1 X0 Y0 Z-1.5 F200', 'G1 X100 F900', 'G1 Y18', 'M5', 'M30'].join('\n');

const load = async (page, program) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    await page.evaluate((prog) => {
        const ed = document.getElementById('editor');
        ed.value = prog;
        ed.dispatchEvent(new Event('input', { bubbles: true }));
    }, program);
    await page.waitForTimeout(900);
};

// A machine with a DECLARED envelope + WCS table, so the check actually runs (no amber "cannot verify" escape hatch).
const setMachine = (page, travel) => page.evaluate(({ t }) => {
    const S = window.ddcsGetSettings();
    S.machine = { ...(S.machine || {}), x: t.x, y: t.y, z: t.z, wcs: { active: 1, table: [{ n: 1, x: 0, y: 0, z: 0 }] } };
    window.dispatchEvent(new Event('ddcs:settings-changed'));
}, { t: travel });

test('THE USER PROGRAM — a jog-start skim draws ZERO red badges and states its clearance ONCE', async ({ page }) => {
    await load(page, SKIM);
    await setMachine(page, { x: 300, y: 200, z: -120 });
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => {
        const res = window.ddcsPreflightCheck();
        const badge = document.getElementById('preflight-badge');
        return {
            status: res.status,
            anchor: res.anchor,
            extent: res.extent,
            violations: res.violations,
            annots: document.querySelectorAll('#editor-highlight .preflight-annot').length,
            chip: badge && !badge.hidden ? { cls: badge.className, text: badge.textContent.trim() } : null,
        };
    });
    // THE SYMPTOM, gone: not one per-line alarm on a correct program.
    expect(r.annots, `no per-line red badges on a jog-start program (was a full column): ${JSON.stringify(r.violations)}`).toBe(0);
    expect(r.violations, 'and no violations at all — the walk fits the travel from some start').toEqual([]);
    expect(r.status, 'so the verdict is green — it does not gate the send').toBe('green');
    // THE ANCHOR IS NAMED, not guessed: the program never established an absolute position.
    expect(r.anchor, 'the check knows this program has no anchor').toBe('relative');
    // THE EXTENT IS THE TRUTH: the walk is 100 wide, 54 deep (3 × 18), and 10.5 top-to-bottom.
    expect(r.extent.x, 'X extent').toBeCloseTo(100, 1);
    expect(r.extent.y, 'Y extent — three 18mm steps').toBeCloseTo(54, 1);
    // the Z RANGE, not the sum of the moves: down to −1.5, up to +9.0 → 10.5 of travel between the extremes
    expect(r.extent.z, 'Z extent — the span from the lowest point to the highest').toBeCloseTo(10.5, 1);
    // AND ONE CALM NOTE, in the operator's terms — not a warning colour, not per line.
    expect(r.chip, 'the clearance is stated once, in the editor').not.toBeNull();
    expect(r.chip.cls, 'as INFO — neither a pass badge nor an alarm').toContain('preflight-info');
    expect(r.chip.text, 'naming the room the program needs').toMatch(/100\.0 × 54\.0 × 10\.5/);
});

test('AND IT STILL GOES RED — a walk WIDER than the travel cannot fit anywhere, and the axis is named', async ({ page }) => {
    await load(page, SKIM);
    // 60mm of X travel; the walk sweeps 100. No start exists that fits — that is a real, start-independent breach.
    await setMachine(page, { x: 60, y: 200, z: -120 });
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => {
        const res = window.ddcsPreflightCheck();
        const badge = document.getElementById('preflight-badge');
        return {
            status: res.status, violations: res.violations,
            annots: document.querySelectorAll('#editor-highlight .preflight-annot').length,
            chip: badge && !badge.hidden ? { cls: badge.className, text: badge.textContent.trim() } : null,
            rows: Array.from(document.querySelectorAll('.preflight-pop-list .preflight-row')).map((li) => li.textContent),
        };
    });
    expect(r.status, 'a sweep that cannot fit the travel is red').toBe('red');
    const ext = r.violations.filter((v) => v.kind === 'travel-extent');
    expect(ext.length, `exactly one axis is at fault: ${JSON.stringify(r.violations)}`).toBe(1);
    expect(ext[0].axis, 'X — the axis whose span the walk exceeds').toBe('X');
    expect(ext[0].needed, 'needing the full sweep').toBeCloseTo(100, 1);
    expect(ext[0].span, 'against the declared travel').toBeCloseTo(60, 1);
    expect(ext[0].line, 'and it belongs to the WHOLE PROGRAM — no line is guilty when there is no anchor').toBeNull();
    // …so it must not reappear as the column of per-line badges this turn removed
    expect(r.annots, 'still no per-line alarms — the fact is stated once').toBe(0);
    expect(r.chip, 'a red verdict that drew nothing would be worse than the cry-wolf: it gets the chip').not.toBeNull();
    expect(r.chip.cls).toContain('preflight-red');
    expect(r.rows.join(' | '), 'and the popover names both numbers').toMatch(/whole program.*100\.0 mm of X.*60\.0 mm/);
});

test('AN ANCHORED PROGRAM IS UNTOUCHED — it says where it is, so every line is judged as before', async ({ page }) => {
    await load(page, ANCHORED);
    // X0..X100 in the work frame with a zero WCS offset, on a 60mm machine → the same X breach, but now per LINE,
    // because this program DOES declare its position: line 4 really is at X100 and that really is outside.
    await setMachine(page, { x: 60, y: 200, z: -120 });
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => {
        const res = window.ddcsPreflightCheck();
        return {
            status: res.status, anchor: res.anchor,
            kinds: [...new Set(res.violations.map((v) => v.kind))],
            lines: res.violations.filter((v) => v.kind === 'soft-limit').map((v) => v.line),
            annots: document.querySelectorAll('#editor-highlight .preflight-annot').length,
        };
    });
    expect(r.anchor, 'this program establishes an absolute position').toBe('absolute');
    expect(r.status, 'and it genuinely leaves the envelope').toBe('red');
    expect(r.kinds, 'judged the old way — per-line soft-limit truth, no extent verdict').toEqual(['soft-limit']);
    expect(r.lines.length, 'with real guilty lines').toBeGreaterThan(0);
    expect(r.annots, 'and the per-line annotations still draw, exactly as before this turn').toBeGreaterThan(0);
});

test('AN ANCHORED PROGRAM THAT FITS STAYS SILENT — the note is for jog-start programs only', async ({ page }) => {
    await load(page, ANCHORED);
    await setMachine(page, { x: 300, y: 200, z: -120 });
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => {
        const res = window.ddcsPreflightCheck();
        const badge = document.getElementById('preflight-badge');
        return { status: res.status, anchor: res.anchor, hidden: !badge || badge.hidden };
    });
    expect(r.status).toBe('green');
    expect(r.anchor).toBe('absolute');
    // GREEN SILENCE IS THE RULE, and this turn did not spend it: an anchored program that fits says nothing at all.
    expect(r.hidden, 'no chip on an anchored, fitting program').toBe(true);
});
