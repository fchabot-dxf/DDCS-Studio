import { test, expect } from '@playwright/test';

/**
 * t1838 — Option B, SLICE 1 of the t1836 3-slice plan: DERIVATION ONLY. `viz/segmentFrame.js` joins two already-
 * declared sources (`programModel.js`'s own line→op ownership via `opAtLine`/`proj.map`, and `opSimContext.js`'s
 * own per-type frame intent) into "which line range belongs to which op, and what frame does it declare" — no
 * positioning, no visibility, no render change. This is the ONLY thing this slice ships; slices 2/3 (future acts)
 * will consume its output.
 *
 * t1920 — FIXTURE CHANGED, claim unchanged. This test's own claim is that `frameSegments` correctly splits a
 * program with TWO TOP-LEVEL, independently-addressable ops — which needs `opAtLine`/`findOpInStack` to resolve
 * each line to ITS OWN op, something that only works when both ops sit at the top level of the program array
 * (`findOpInStack` matches the FIRST top-level `op` it finds and does not descend further once a run-of-2 no
 * longer exists via live insert). t1916/t1918/t1920's own ruling means a STUDIO-CANVAS program is now always
 * exactly one op — a real bar-gesture Insert can no longer produce a 2-top-level-op program at all, which is
 * exactly the shape this test needs to exercise `frameSegments`' own multi-op logic. Built directly instead, via
 * the SAME production functions the (deleted) accumulation path used to call — `opBuilders.js`'s own
 * `makeOp`/`_builderAtoms` — matching the established pattern `prog-marker-slot-812.spec.js` already uses for
 * hand-built (not live-gesture) fixtures. Params captured from a real single-op live insert (homing's own
 * shipped defaults; corner's own shipped defaults with `dist:741`, matching this file's own prior `dist` fill) —
 * not invented. OPEN QUESTION, not resolved here: whether `frameSegments`'/`opAtLine`'s own multi-op logic still
 * has a real consumer now that the canvas can't produce this shape live (the only surviving multi-op shape,
 * `importMarkedNc`'s `multi_step` wrapper, is NOT top-level-addressable this way — `findOpInStack` would resolve
 * every line inside it to the SAME wrapper, not to its own steps) — flagged for the advisor, not decided here.
 */

test.use({ viewport: { width: 1400, height: 1000 } });

const HOMING_PARAMS = { run_z: true, run_x: true, run_y: true, run_a: false, run_b: false, softLimits: true };
const CORNER_PARAMS = { corner: 'FL', probeSeq: 'YX', travelDist: 50, safeZ: 10, scanDepth: 5, clearMode: 'hop', hopDist: 15, planeZ: 10, probeZFirst: false, travelApproach: 'auto', travelShape: 'dogleg', wcs: 'active', syncA: false, dist: 741, retract: 5, f_fast: 200, f_slow: 50, port: 3, radius: 2 };

async function buildHomingThenCorner(page) {
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    await page.evaluate(async ({ homingParams, cornerParams }) => {
        const OB = await import('/blocks/opBuilders.js');
        const homingOp = OB.makeOp('user_homing_data', homingParams, OB._builderAtoms('user_homing_data', homingParams));
        const cornerOp = OB.makeOp('user_corner_data', cornerParams, OB._builderAtoms('user_corner_data', cornerParams));
        window.ddcsLoadBlockStack([homingOp, cornerOp]);
    }, { homingParams: HOMING_PARAMS, cornerParams: CORNER_PARAMS });
    await page.waitForFunction(() => window.ddcsGetBlockProgram().filter((b) => b.type === 'op').length === 2, null, { timeout: 10000 });
}

test('frameSegments correctly attributes a Homing+Corner program to its two ops and their declared frames', async ({ page }) => {
    test.setTimeout(60_000);
    await buildHomingThenCorner(page);

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
