import { test, expect } from '@playwright/test';

/**
 * t1866→t1868 — THE V4.1/DM500 MODAL-RESTORE FIX. The user reported corner's own preview drawing the wrong
 * start position under DDCS V4.1; Expert drew it correctly for the same op, same params, same gesture.
 *
 * TRACED (t1866) by DIFFING both profiles' own step-trail — not by testing either investigator's own leading
 * candidate first — to the EXACT line: V4.1's own `setWorkOffset` (the shared G92-datum idiom every V4.1/DM500
 * probe op calls to record a touched position, `ddcs-v41.js:68` / `ddcs-v3-dm500.js:55`) emits a bare
 * `G90 G92 <axis>[...]` line. G92 itself is correctly a no-move operation (GcodeExecutionEngine.js's own
 * explicit early-return, confirmed). The `G90` riding on that SAME line is a standard, PERSISTENT modal code
 * (G90/G91 are modal on real hardware, exactly as in the sim) — and nothing restored G91 before the very next
 * relative move in the same G91 probe body. That move then executed ABSOLUTE instead of relative: an 8x-larger
 * jump where a small retract was intended (measured: world Y landed at -48 where -7 was correct, for a program
 * whose own retract distance is 5mm). THIS IS A MACHINE-SAFETY DEFECT, not merely a preview one — the emitted
 * G-code itself is missing the restore, and a real V4.1/DM500 controller would very plausibly execute the same
 * wrong absolute jump right after a probe touch.
 *
 * THE FIX (t1868) reuses the ALREADY-DECLARED modal-restore mechanism (`wrapMachineFrame`, `safeZframe.js`) —
 * the SAME one `safeRetractNode`/`safeHop`/`clearLiftNode` already use for their own G53 moves — rather than
 * hand-rolling a second way to restore a mode. `wcsWriteBlock` (`wcsIndirect.js`) and `setWorkOffsetBlock`
 * (`setworkoffset.js`) now accept an opt-in `restore` param (mirroring `safeRetractNode`'s own convention,
 * default unset = byte-identical); each WIZARD that inserts one of these blocks sets `restore:'inc'` ONLY where
 * a relative move genuinely follows within the same G91 body — VERIFIED per call site, not applied blanket:
 *   - cornerWizard.js: BOTH wall writes (X, Y) — each followed immediately by its own retract move. FIXED.
 *     The Z-surface write (probeZFirst branch) — followed by a reposition traverse. FIXED, defensively.
 *   - middleWizard.js: the Z-surface write (probeZFirst branch) — followed by a reposition traverse. FIXED,
 *     defensively (not individually step-trail-verified, added on the same shape as corner's own confirmed case).
 *     Its other two wcswrite calls — followed by an explicit `DM('abs')` in the footer, no relative move
 *     in between. Left unchanged (byte-identical) — confirmed by reading, not assumed.
 *   - edgeWizard.js: its one wcswrite — followed by an explicit `DM('abs')`. Left unchanged, confirmed.
 *   - rotaryCenterWizard.js: its two SWO calls — followed by an explicit `DM('abs')`. Left unchanged, confirmed.
 *   - rotaryClockWizard.js: its two mkSWO calls — each followed (eventually) by `safeRetractNode({restore:
 *     'inc'})`, whose own G53 wrap ALREADY forces G90 unconditionally regardless of ambient mode (t858's own
 *     "MODE-EXPLICIT — no ambient-mode inference" design) — the leaked G90 is harmless there, confirmed by
 *     reading `wrapMachineFrame`'s own logic. Left unchanged.
 *
 * NOT touched: the probe form itself (V4.1's own G31/DRO-comparison/G92 shape is CONFIRMED LIVE against the
 * user's real controller, per `ddcs-v41.js`'s own header — this fix adds the missing restore, changes nothing
 * else about the sequence). Expert's own `wcsWriteIndirect` arm never emits G90 at all (a pure register write),
 * so `restore` never triggers there — verified below, not assumed.
 */

const V41 = 'ddcs-v41', DM500 = 'ddcs-v3-dm500', EXPERT = 'ddcs-expert-m350';

async function buildEmit(page, controllerId, opType) {
    return page.evaluate(async ({ id, opType }) => {
        const { setMachine } = await import('/data/workspaceMachine.js');
        setMachine({ controllerId: id }, true);
        const U = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { activeDialectOpts } = await import('/wizards/previewEmit.js');
        const def = U.getUserDef(opType);
        if (!def) return { found: false };
        const params = U.defaultParams(def);
        const build = builderOf(opType);
        const stack = build(params);
        const gcode = emitMapped(stack, activeDialectOpts()).text;
        return { found: true, gcode };
    }, { id: controllerId, opType });
}

/** For every `G90 G92` line, is the VERY NEXT line a G91 restore? Returns the list of any that are NOT. */
function unrestoredG92Lines(gcode) {
    const lines = gcode.split('\n');
    const bad = [];
    for (let i = 0; i < lines.length; i++) {
        if (/^G90 G92\b/.test(lines[i].trim())) {
            const next = (lines[i + 1] || '').trim();
            if (!/^G91\b/.test(next)) bad.push({ line: i, text: lines[i].trim(), next });
        }
    }
    return bad;
}

test('PRIMARY EVIDENCE: the emitted G-code, not the drawing — V4.1 corner restores G91 after every G92 datum write', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await page.waitForFunction(() => window.ddcsGetBlockProgram, null, { timeout: 30000 });

    const { gcode } = await buildEmit(page, V41, 'user_corner_data');
    const g92Lines = gcode.split('\n').filter((l) => /^G90 G92\b/.test(l.trim()));
    const bad = unrestoredG92Lines(gcode);

    expect(g92Lines.length, 'sanity: corner default params genuinely emit G92 datum writes on V4.1').toBeGreaterThan(0);
    expect(bad, `every G90 G92 line must be immediately followed by a G91 restore — found unrestored: ${JSON.stringify(bad)}`).toEqual([]);
});

test('PRIMARY EVIDENCE: same check for DM500 (shares the identical setWorkOffset shape)', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await page.waitForFunction(() => window.ddcsGetBlockProgram, null, { timeout: 30000 });

    const { gcode } = await buildEmit(page, DM500, 'user_corner_data');
    const g92Lines = gcode.split('\n').filter((l) => /^G90 G92\b/.test(l.trim()));
    const bad = unrestoredG92Lines(gcode);

    expect(g92Lines.length, 'sanity: DM500 also emits G92 datum writes for corner (same setWorkOffset shape as V4.1)').toBeGreaterThan(0);
    expect(bad, `DM500 must restore G91 too — found unrestored: ${JSON.stringify(bad)}`).toEqual([]);
});

test('Expert never emits G90 G92 at all (register-write idiom) — restore is architecturally inert there', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await page.waitForFunction(() => window.ddcsGetBlockProgram, null, { timeout: 30000 });

    const { gcode } = await buildEmit(page, EXPERT, 'user_corner_data');
    const g92Lines = gcode.split('\n').filter((l) => /G92\b/.test(l));
    expect(g92Lines, 'Expert\'s own wcsWriteIndirect arm never touches G92 — confirmed, not assumed').toEqual([]);
});

test('CONTROL, stated separately (t1868 amendment): Expert\'s WCS-write atom itself makes NO distance-mode change at all', async ({ page }) => {
    // A DIFFERENT claim from "no G92 line" above — that one is about the SHAPE of the datum write; this one is
    // about the ATOM's own emit touching G90/G91 AT ALL. Asserted directly on the atom's own return value (not
    // scanned out of the full program, where an unrelated op could coincidentally carry a G90/G91) so the two
    // assertions can never silently collapse into each other.
    test.setTimeout(60_000);
    await page.goto('/');
    await page.waitForFunction(() => window.ddcsGetBlockProgram, null, { timeout: 30000 });

    const lines = await page.evaluate(async () => {
        const { getDialect } = await import('/wizards/dialects/index.js');
        const dialect = getDialect('ddcs-expert-m350');
        const a = dialect.setWorkOffset('#578', 'X', '#101');
        const b = dialect.wcsWriteIndirect({ offset: 0, value: '#101', note: 'test' });
        return [...a, ...b];
    });
    const modalLines = lines.filter((l) => /\bG9[01]\b/.test(l));
    expect(modalLines, `Expert's own datum-write atoms must never touch distance mode — found: ${JSON.stringify(modalLines)}`).toEqual([]);
});

test('the drawing, as a consequence: V4.1 corner\'s own drawn Y now matches the ground truth (the emitted reposition math)', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await page.waitForFunction(() => window.ddcsGetBlockProgram, null, { timeout: 30000 });

    const result = await page.evaluate(async () => {
        const { setMachine } = await import('/data/workspaceMachine.js');
        setMachine({ controllerId: 'ddcs-v41' }, true);
        const U = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { opSimStarts } = await import('/viz/opSimStarts.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const { activeDialectOpts } = await import('/wizards/previewEmit.js');
        const { markerWorldOf } = await import('/viz/markerWorld.js');

        const opType = 'user_corner_data';
        const def = U.getUserDef(opType);
        const params = U.defaultParams(def);
        const STOCK = { x: 100, y: 80, z: 20 };
        const declared = opSimStarts(opType, params, STOCK);
        const build = builderOf(opType);
        const stack = build(params);
        const gcode = emitMapped(stack, activeDialectOpts()).text;
        const start = { x: declared[0].x, y: declared[0].y, z: declared[0].z };
        const traced = traceToolpath(gcode, { stock: STOCK, start, passStarts: declared });
        const reconciled = markerWorldOf(declared, traced.passEnds, 1);

        // Ground truth: the SAME emitted reposition math the real machine will run — declared delta applied to
        // wall1's own real runtime end. If the modal restore is correct, the trace's own passEnds[0] should be
        // the honest -5mm retract from the touch point, matching Expert's own physically-correct shape.
        return { passEnds: traced.passEnds, reconciled, declaredWall2: declared[1] };
    });

    // The retract that was corrupted (t1866: world Y landed at -48 instead of ~-7) must now land close to the
    // physically-correct retract distance from the touch — not asserting the exact number (stock-dependent),
    // asserting it is no longer the ~8x-too-large jump the bug produced.
    const y0 = result.passEnds[0].y;
    expect(Math.abs(y0), `pass-0's own runtime-end Y must be a small, physically-plausible retract from the touch, not the ~-48 the bug produced — got ${y0}`).toBeLessThan(20);
});
