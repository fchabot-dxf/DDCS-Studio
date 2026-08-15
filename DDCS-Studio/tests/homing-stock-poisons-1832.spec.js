import { test, expect } from '@playwright/test';

/**
 * t1832/t1834/t1836 — BUG 2 of the three t1786 trace bugs, RE-RULED TWICE. Homing's own machine-frame intent
 * unions across the WHOLE `blk-preview-panel` program (`programSimContext`'s own documented "force it if ANY op
 * needs it" design), so `simStock()` withholds the workpiece for the entire trace, including a later op (Corner)
 * that genuinely probes it.
 *
 * t1832's ORIGINAL version of this test asserted the stock stays VISIBLE — that expectation was WRONG, corrected
 * at t1834: the advisor ruled THE HIDING IS CORRECT, and t1834 gave a reason for WHY. Do NOT restore the old
 * "stock visible" expectation thinking either version of this test is a regression.
 *
 * t1834's OWN reason was ALSO WRONG, and t1836 corrects it here rather than papering over it: t1834 claimed the
 * stock's position is "unknown until a probe runs," reasoning from [[probes-never-read-wcs]] — but that rule is
 * about something else entirely (the SIM must not map a probe's OWN moves through the WCS table, because that op
 * is producing the value, not consuming it). A WCS offset, once RECORDED, already exists — a probe REPLACES a
 * stale one, it does not conjure a position from nothing. The genuinely honest, NARROWER reason: THIS WORKSPACE
 * has no WCS offsets recorded (`machine.wcs.table` empty/unpulled) — there is nothing on file to place the
 * workpiece against. When a WCS table IS populated, that reason no longer holds, and the note must not claim it —
 * `createPreviewPanel.js`'s `setFrameNote` now SUPPRESSES the note in that case, reusing
 * `engine/envelopeCheck.js`'s own `placementDeclared` predicate (the pre-flight safety check's existing "is a
 * real WCS placement on file" gate) rather than inventing a second one. This project's DEFAULT test settings
 * (`settingsPanel.js`) carry `machine.wcs.table: null` — unpulled — so `placementDeclared` is false and the note
 * fires in the first test below; the second test proves the suppression really engages when a table IS populated.
 *
 * THE ACTUAL DEFECT (t1834, still the point of this fix) was that the hiding was SILENT — a user watching the
 * workpiece vanish had no way to tell this apart from something broken. The fix makes the panel SAY what is
 * withheld and why, in the user's language, as an honest caption (the same neutral, non-alarming treatment as the
 * existing `.pp-carve-note`) — not an error, not a warning.
 */

test.use({ viewport: { width: 1400, height: 1000 } });

// t1920 — FIXTURE CHANGED, claim unchanged. A real bar-gesture Insert now REPLACES the program (t1916/t1918/
// t1920's own ruling: a Studio-canvas program is always exactly one op) — two live inserts can no longer produce
// a Homing+Corner program at all. Built directly instead, via the SAME production functions the (deleted)
// accumulation path used to call (`opBuilders.js`'s own `makeOp`/`_builderAtoms`), matching
// `prog-marker-slot-812.spec.js`'s own established hand-built-fixture pattern. This test's own claim (the
// whole-program union-hiding + frame note) operates on `programSimContext`'s own whole-program union, not on
// per-op resolution, so two top-level ops (rather than nesting) is a choice of convenience, not a requirement.
// Params captured from a real single-op live insert (homing's own shipped defaults; corner's own shipped
// defaults with `dist:741`).
const HOMING_PARAMS = { run_z: true, run_x: true, run_y: true, run_a: false, run_b: false, softLimits: true };
const CORNER_PARAMS = { corner: 'FL', probeSeq: 'YX', travelDist: 50, safeZ: 10, scanDepth: 5, clearMode: 'hop', hopDist: 15, planeZ: 10, probeZFirst: false, travelApproach: 'auto', travelShape: 'dogleg', wcs: 'active', syncA: false, dist: 741, retract: 5, f_fast: 200, f_slow: 50, port: 3, radius: 2 };

async function buildHomingThenCornerProgram(page) {
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    await page.evaluate(async ({ homingParams, cornerParams }) => {
        const OB = await import('/blocks/opBuilders.js');
        const homingOp = OB.makeOp('user_homing_data', homingParams, OB._builderAtoms('user_homing_data', homingParams));
        const cornerOp = OB.makeOp('user_corner_data', cornerParams, OB._builderAtoms('user_corner_data', cornerParams));
        window.ddcsLoadBlockStack([homingOp, cornerOp]);
    }, { homingParams: HOMING_PARAMS, cornerParams: CORNER_PARAMS });
    await page.waitForFunction(() => window.ddcsGetBlockProgram().filter((b) => b.type === 'op').length === 2, null, { timeout: 10000 });

    await page.locator('[data-app="blocks"]').click();
    await page.waitForFunction(() => window.__blkws, null, { timeout: 10000 });
    await page.waitForTimeout(1500);
}

function readFrameNote(page) {
    return page.evaluate(() => {
        const host = document.getElementById('blk-preview-panel');
        const panel = host && host.__panel;
        const simConfig = panel && panel.getSimConfig ? panel.getSimConfig() : null;
        const noteEl = host && host.querySelector('.pp-frame-note');
        return {
            hasPanel: !!panel,
            stock: simConfig && simConfig.stock,
            noteText: noteEl ? noteEl.textContent : null,
            noteVisible: noteEl ? noteEl.style.display !== 'none' : false,
        };
    });
}

test('no WCS on file: after a Homing op hides the workpiece, the panel explains why', async ({ page }) => {
    test.setTimeout(60_000);
    await buildHomingThenCornerProgram(page);
    const r = await readFrameNote(page);

    expect(r.hasPanel, 'sanity: the whole-program preview panel exists').toBe(true);
    // THE (now-confirmed-correct) HIDING: still null. Nothing on file to place the workpiece against.
    expect(r.stock, 'the workpiece stays hidden while no WCS is recorded').toBeNull();
    // THE FIX: the omission SPEAKS. Neutral caption, names the responsible op, gives the CORRECTED reason.
    expect(r.noteVisible, 'the frame note is shown when the stock is withheld and no WCS is on file').toBe(true);
    expect(r.noteText || '', 'the note names the reason (no WCS offsets recorded)').toMatch(/no wcs offsets recorded/i);
    expect(r.noteText || '', 'the note does NOT claim the position is "unknown until a probe runs" (t1834\'s wrong premise)').not.toMatch(/until a probe (runs|sets)/i);
    expect(r.noteText || '', 'the note names Homing as the responsible op').toMatch(/homing/i);
});

test('a WCS IS on file: the note is suppressed (the "nothing on file" reason no longer holds)', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    // A real, non-empty WCS table (envelopeCheck.js's own `placementDeclared` shape) — set BEFORE the first
    // insert/reproject so the panel's first applyProgramIntent call already sees it populated.
    await page.evaluate(() => {
        const s = window.ddcsGetSettings();
        s.machine = s.machine || {};
        s.machine.wcs = { active: 1, table: [{ x: 10, y: 20, z: 0 }] };
    });

    await page.evaluate(async ({ homingParams, cornerParams }) => {
        const OB = await import('/blocks/opBuilders.js');
        const homingOp = OB.makeOp('user_homing_data', homingParams, OB._builderAtoms('user_homing_data', homingParams));
        const cornerOp = OB.makeOp('user_corner_data', cornerParams, OB._builderAtoms('user_corner_data', cornerParams));
        window.ddcsLoadBlockStack([homingOp, cornerOp]);
    }, { homingParams: HOMING_PARAMS, cornerParams: CORNER_PARAMS });
    await page.waitForFunction(() => window.ddcsGetBlockProgram().filter((b) => b.type === 'op').length === 2, null, { timeout: 10000 });

    await page.locator('[data-app="blocks"]').click();
    await page.waitForFunction(() => window.__blkws, null, { timeout: 10000 });
    await page.waitForTimeout(1500);

    const r = await readFrameNote(page);
    expect(r.hasPanel, 'sanity: the whole-program preview panel exists').toBe(true);
    // The union-hiding itself is UNTOUCHED this turn (Option B, per-segment frames, is design-only) — stock still hidden.
    expect(r.stock, 'the whole-program union hiding is unchanged this turn — stock still hidden').toBeNull();
    // But the note must not claim "nothing on file" when something IS on file.
    expect(r.noteVisible, 'the note is suppressed once a WCS table is populated — the note\'s own reason would be false otherwise').toBe(false);
    expect(r.noteText || '', 'no stale text left behind').toBe('');
});
