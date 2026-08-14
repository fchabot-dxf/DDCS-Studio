import { test, expect } from '@playwright/test';
import { openWizardViaBar, clickInsert } from './support/barGesture.js';

/**
 * t1838 — Option B, SLICE 1 of the t1836 3-slice plan: DERIVATION ONLY. `viz/segmentFrame.js` joins two already-
 * declared sources (`programModel.js`'s own line→op ownership via `opAtLine`/`proj.map`, and `opSimContext.js`'s
 * own per-type frame intent) into "which line range belongs to which op, and what frame does it declare" — no
 * positioning, no visibility, no render change. This is the ONLY thing this slice ships; slices 2/3 (future acts)
 * will consume its output.
 *
 * Built and asserted against a REAL Homing-then-Corner program, built by real bar gesture (not a hand-built stack),
 * matching t1832/t1834/t1836's own established scenario for this bug family.
 */

test.use({ viewport: { width: 1400, height: 1000 } });

test('frameSegments correctly attributes a real Homing+Corner program to its two ops and their declared frames', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });

    await openWizardViaBar(page, { group: 'Probe', optype: 'homing' });
    await clickInsert(page);
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsGetBlockProgram().length > 0, null, { timeout: 10000 });

    await openWizardViaBar(page, { group: 'Probe', optype: 'corner' });
    await page.locator('#wiz_user_form [data-param="dist"]').waitFor({ state: 'visible', timeout: 5000 });
    await clickInsert(page);
    await page.waitForFunction(() => window.ddcsGetBlockProgram().filter((b) => b.type === 'op').length >= 2, null, { timeout: 10000 });

    const r = await page.evaluate(async () => {
        const { frameSegments, frameOwnerAtLine } = await import('/viz/segmentFrame.js');
        const stack = window.ddcsGetBlockProgram().filter((b) => b && b.type === 'op');
        const proj = window.ddcsGetProjection();
        const segs = frameSegments(proj.lines.length);
        // Sanity cross-check: frameOwnerAtLine and frameSegments must agree at every segment's own start line
        // (the compaction must not silently misgroup) — checked directly, not assumed from frameSegments alone.
        const crossCheck = segs.map((s) => {
            const o = frameOwnerAtLine(s.fromLine);
            return o && o.opId === s.opId && o.toolMachineFrame === s.toolMachineFrame;
        });
        return {
            opTypesInOrder: stack.map((b) => b.opType),
            lineCount: proj.lines.length,
            segs,
            crossCheck,
            // total lines the segments claim vs total lines that have SOME owner (opAtLine non-null) — must match;
            // if a middle line got dropped by the compaction loop, this diverges.
            claimedLines: segs.reduce((n, s) => n + (s.toLine - s.fromLine + 1), 0),
            ownedLineCount: Array.from({ length: proj.lines.length }, (_, i) => i).filter((i) => frameOwnerAtLine(i)).length,
        };
    });

    // A real bar-gesture Insert produces the wizards-as-data TWIN opType (e.g. 'user_homing_data'), not the bare
    // built-in name ('homing') — checked directly rather than hardcoded, since frameSegments must key off
    // whatever opType the REAL program actually carries (opSimContext resolves the twin via its OWN registered
    // USER_INTENT entry, not the built-in static set — see opSimContext.js's own "built-in and twin get the SAME
    // intent BY CONSTRUCTION" doctrine).
    expect(r.opTypesInOrder[0], 'sanity: op 1 is a homing twin').toMatch(/homing/i);
    expect(r.opTypesInOrder[1], 'sanity: op 2 is a corner twin').toMatch(/corner/i);
    expect(r.segs.length, 'exactly two contiguous op-owned segments, one per op').toBe(2);

    const [homingSeg, cornerSeg] = r.segs;
    expect(homingSeg.opType, 'segment 1 is owned by the SAME opType as program op 1').toBe(r.opTypesInOrder[0]);
    expect(homingSeg.toolMachineFrame, 'homing declares toolMachineFrame — the machine-frame op this whole bug family is about').toBe(true);
    expect(cornerSeg.opType, 'segment 2 is owned by the SAME opType as program op 2').toBe(r.opTypesInOrder[1]);
    expect(cornerSeg.toolMachineFrame, 'corner is a part-frame probe — opSimContext.js\'s own MACHINE_FRAME_TOOL set does not include it').toBe(false);

    // The segments must be in LINE ORDER and non-overlapping (homing's own lines all precede corner's own).
    expect(homingSeg.fromLine, 'homing starts at or before line 0 (program order)').toBeLessThanOrEqual(cornerSeg.fromLine);
    expect(homingSeg.toLine, 'homing ends strictly before corner begins — no overlap').toBeLessThan(cornerSeg.fromLine);

    expect(r.crossCheck, 'frameOwnerAtLine agrees with frameSegments at every segment start — no compaction drift').toEqual([true, true]);
    expect(r.claimedLines, 'the segments account for every op-owned line, no drops, no double-counts').toBe(r.ownedLineCount);
});
