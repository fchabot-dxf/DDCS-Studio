import { test, expect } from './support/harness.mjs';

/**
 * t1361 STEP 4 — THE REGISTER REMAINDER, each item named and MEASURED rather than assumed. These are the consequences
 * of a surfacing op becoming a program the machine derives instead of a transcript Studio writes out: everything that
 * reads an op's emitted TEXT, counts its LINES, or maps a line back to something now meets a loop where it used to
 * meet a list.
 *
 * Pendant mirror stability sits here too, because it is the same question asked of the CAM slot: the switch must not
 * renumber a pendant param that an operator already has written on a setup sheet.
 */

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
};

// ── (1) PENDANT MIRROR STABILITY ────────────────────────────────────────────────────────────────────────────────
test('(1) a surfacing slot keeps its param → mirror map; a new mirror APPENDS rather than renumbering', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { surfacingSlot } = await import('/data/millToSlot.js');
        const slot = surfacingSlot(new Set(), 0);
        const map = {}; (slot.fields || []).forEach((f, i) => { map[f.key] = { var: f.var, idx: i }; });
        return { map, keys: (slot.fields || []).map((f) => f.key), vars: (slot.fields || []).map((f) => f.var) };
    });
    // THE MAP AS IT SHIPS. A pendant number is written on a setup sheet and typed at the machine, so a param that
    // silently moved to a different mirror would make an operator dial the wrong value into the right-looking row.
    const EXPECTED = ['w', 'h', 'depth', 'stepdown', 'stepoverPct', 'toolDia', 'feed', 'plunge', 'clearance', 'rpm'];
    expect(r.keys, 'the slot carries exactly the params it always did, in order').toEqual(EXPECTED);
    // the mirrors are consecutive from the slot base — so "appends" is a checkable claim, not a hope.
    const nums = r.vars.map((v) => parseInt(String(v).replace('#', ''), 10));
    expect(nums.every((n, i) => i === 0 || n === nums[i - 1] + 1), `mirrors are consecutive: ${r.vars.join(' ')}`).toBe(true);
    // and the switch did NOT insert into the middle: stepoverPct sits where the millimetre sat (t1325's ruling), and
    // every param after it keeps the mirror it had.
    expect(r.map.stepoverPct.idx, 'the percentage took the millimetre’s slot rather than being added after it').toBe(4);
    expect(r.map.rpm.idx, 'and the tail is untouched').toBe(EXPECTED.length - 1);
});

// ── (2) OLD FILES STILL IMPORT AND REBUILD THROUGH THE NEW BUILDER ──────────────────────────────────────────────
test('(2) a marked .nc and a shared .wiz def rebuild through the NEW builder — no blocks lost', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const SD = await import('/blocks/dataOps/surfacingData.js');
        const { registerUserOp, flattenBlocks, defToFileText, defFromFileText } = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { markerLine, parseMarker } = await import('/blocks/opSchema.js');
        const { surfacingStack } = await import('/wizards/surfacingWizard.js');
        registerUserOp(SD.surfacingDataDef());
        const build = builderOf(SD.SURFACING_DATA_OPTYPE);
        const types = (s) => flattenBlocks(s).map((b) => b && b.type).filter(Boolean);

        // (a) A MARKER WRITTEN BEFORE THE SWITCH — the old key set: a flat stepover millimetre, no toolDia/pct.
        const preSwitch = { w: 120, h: 90, stepover: 9.6, strategy: 'parallel', depth: 0.8, stepdown: 0.4,
            feed: 900, plunge: 180, clearance: 5, wcs: 'active' };
        const parsed = parseMarker(markerLine(SD.SURFACING_DATA_OPTYPE, preSwitch));
        const rebuilt = build(parsed.params);
        const rebuiltTxt = emitMapped(rebuilt).text;

        // (b) A MARKER WRITTEN AFTER the switch round-trips byte-for-byte (the iron rule's own case).
        const now = { ...SD.SURFACING_DEFAULTS, w: 120, h: 90, toolDia: 16, stepoverPct: 45, depth: 0.8, stepdown: 0.4,
            spindle: (window.ddcsGetSettings && window.ddcsGetSettings().spindle) || {} };
        const e1 = emitMapped(build(now)).text;
        const e2 = emitMapped(build(parseMarker(markerLine(SD.SURFACING_DATA_OPTYPE, now)).params)).text;

        // (c) A SHARED .wiz FILE — the def serialized out and read back, then built.
        const fileText = defToFileText ? defToFileText(SD.surfacingDataDef()) : null;
        const backDef = (fileText && defFromFileText) ? defFromFileText(fileText) : null;

        return {
            rebuiltTypes: types(rebuilt),
            rebuiltIsParametric: /---- SURFACING, parametric/.test(rebuiltTxt),
            // what the pre-switch millimetre resolves to once rebuilt (see the NAMED GAP below)
            rebuiltStepLine: rebuiltTxt.split('\n').find((l) => l.indexOf('#44=') === 0) || '',
            markerRoundTrips: e1 === e2,
            // t1363 — the SAME pre-switch stored op down BOTH paths: the built-in stack and the twin.
            preSwitchBothPaths: emitMapped(surfacingStack({ ...preSwitch,
                spindle: (window.ddcsGetSettings && window.ddcsGetSettings().spindle) || {} })).text
                === emitMapped(build({ ...parsed.params,
                spindle: (window.ddcsGetSettings && window.ddcsGetSettings().spindle) || {} })).text,
            wizRoundTrips: !!(backDef && backDef.opType === SD.SURFACING_DATA_OPTYPE
                && (backDef.template || []).length === (SD.surfacingDataDef().template || []).length),
            wizSupported: !!(fileText && backDef),
        };
    });

    expect(r.rebuiltIsParametric, 'an old marked .nc rebuilds through the NEW builder').toBe(true);
    expect(r.rebuiltTypes, 'and comes back carrying the parametric atom').toContain('surfaceraster');
    expect(r.rebuiltTypes, 'with the framing intact — nothing dropped on the way through').toEqual(
        expect.arrayContaining(['progstart', 'placeonstock', 'surfaceraster', 'progend']));
    expect(r.markerRoundTrips, 'a marker written today re-emits byte-for-byte').toBe(true);
    if (r.wizSupported) expect(r.wizRoundTrips, 'a shared .wiz def survives a write/read round trip').toBe(true);

    /**
     * NAMED GAP, pinned rather than hidden (t1361 — measured, reported to the advisor, NOT silently patched).
     *
     * A surfacing op saved BEFORE the switch stored a flat `stepover` millimetre and no percentage. The CAM path
     * recovers it correctly (stepover-pct-1325 proves 9.6mm → 80% of the Ø12 the slot carries), because seedFromOp
     * does the recovery explicitly. The TWIN'S OWN BUILD PATH does not: the bindings write `stepoverPct` from its
     * default (60) and the stored millimetre reaches no socket, so the rebuilt program cuts 7.2mm where the saved
     * one cut 9.6mm. Closing it means a declared param migration on the def, which is a contract change and a gate.
     *
     * It is asserted AS IT BEHAVES so the number cannot drift unnoticed while the ruling is pending. Under the
     * project's no-legacy-burden ruling this may be intentionally out of scope — there is no install base, and a
     * pre-switch saved twin does not exist in the wild. That is the advisor's call, not this spec's.
     */
    // t1363 RULING APPLIED — ONE SOURCE, not a migration. The twin build path now routes the stored millimetre
    // through the SAME declared `stepoverPctOf` the wizard stack and opCamMap call (a single declared
    // `normalizeParams` on the def, at the one point params enter a build). A 9.6mm stepover stored against the
    // Ø12 this op runs is 80%, and 80% of Ø12 is the same 9.6mm — so the rebuilt program cuts what the saved one cut.
    expect(r.rebuiltStepLine, 'a pre-switch stored millimetre is recovered on the twin build path too')
        .toContain('#44=[12 * 80 / 100]');
    // AND THE TWO PATHS AGREE BYTE-FOR-BYTE on that same stored op — the assert the ruling asked for. This is the
    // property that makes it one source rather than two recoveries that happen to match today.
    expect(r.preSwitchBothPaths, 'the wizard stack and the twin emit the SAME program for a pre-switch stored op').toBe(true);
});

// ── (3) PER-LINE ANNOTATIONS UNDER LOOPS ────────────────────────────────────────────────────────────────────────
test('(3) every executed move still names the source line that wrote it — many executions, one line', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { surfaceRasterLines } = await import('/wizards/ops/surfaceraster.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const NL = String.fromCharCode(10);
        const lines = ['G90', ...surfaceRasterLines({ w: 200, h: 150, depth: 0.8, stepdown: 0.4, toolDia: 12,
            stepoverPct: 60, feed: 900, plunge: 180, clearance: 5 }), 'M30'];
        const t = traceToolpath(lines.join(NL));
        const segs = (t.segments || []);
        const withLine = segs.filter((s) => s.line != null);
        const inRange = withLine.filter((s) => s.line >= 0 && s.line < lines.length);
        const distinct = new Set(withLine.map((s) => s.line));
        // the most-executed single line, and what it actually says
        const counts = {}; withLine.forEach((s) => { counts[s.line] = (counts[s.line] || 0) + 1; });
        const hottest = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        return { segs: segs.length, annotated: withLine.length, inRange: inRange.length, distinct: distinct.size,
            programLines: lines.length, hottestCount: hottest ? +hottest[1] : 0, hottestText: hottest ? lines[+hottest[0]] : '' };
    });
    expect(r.segs, 'the loop executed').toBeGreaterThan(50);
    expect(r.annotated, 'EVERY executed move carries the source line that produced it').toBe(r.segs);
    expect(r.inRange, 'and every one of those line numbers is a real line of this program').toBe(r.segs);
    // THE POINT: far more executions than lines, so a line→move map is one-to-MANY now. A consumer that assumed
    // one move per line (a highlight, a step, a progress fraction) is the class of thing this pins.
    expect(r.distinct, 'the moves come from a handful of lines').toBeLessThan(r.programLines);
    expect(r.segs, 'but there are many more moves than lines — the loop ran').toBeGreaterThan(r.distinct * 3);
    expect(r.hottestCount, 'one single line accounts for many executions').toBeGreaterThan(10);
    expect(r.hottestText, 'and it is a line from inside the row walk').toMatch(/G[01] /);
});

// ── (4) THE STEP CAP: a runaway loop is BOUNDED and says so ─────────────────────────────────────────────────────
test('(4) a hand-broken infinite loop hits the trace cap and RETURNS with its warning — it never hangs', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { traceToolpath } = await import('/engine/trace.js');
        const NL = String.fromCharCode(10);
        // DELIBERATELY BROKEN: the counter is reset inside its own loop, so the condition can never go false. This is
        // the shape a mis-edited parametric body would take at the machine — and the sim must survive meeting it.
        const runaway = ['G90', '#40=0', 'WHILE [#40 < 10] DO1', '  #40=0', '  G1 X1 F100', '  G1 X0', 'END1', 'M30'].join(NL);
        const t = traceToolpath(runaway);
        // …and a healthy parametric surfacing op does NOT trip it, which is what makes the cap a warning and not a wall.
        const { surfaceRasterLines } = await import('/wizards/ops/surfaceraster.js');
        const ok = traceToolpath(['G90', ...surfaceRasterLines({ w: 200, h: 150, depth: 0.8, stepdown: 0.4,
            toolDia: 12, stepoverPct: 60, feed: 900, plunge: 180, clearance: 5 }), 'M30'].join(NL));
        return { capped: !!(t.stats && t.stats.capped), returned: Array.isArray(t.segments),
            segs: (t.segments || []).length, okCapped: !!(ok.stats && ok.stats.capped), okSegs: (ok.segments || []).length };
    });
    expect(r.returned, 'the tracer RETURNED — a runaway loop does not freeze the tab').toBe(true);
    expect(r.capped, 'and it declares that it stopped early rather than finishing').toBe(true);
    expect(r.segs, 'having drawn the bounded prefix it did execute (not an empty result)').toBeGreaterThan(0);
    // THE CAP IS NOT A CEILING ON REAL WORK: a full 200x150 raster at 0.4 runs to completion under it.
    expect(r.okCapped, 'a real parametric surfacing op finishes on its own').toBe(false);
    expect(r.okSegs, 'having drawn its whole raster').toBeGreaterThan(80);
});

// ── (5) PROGRESS UNDER A LOOP: the criterion, and the gap that is still open ────────────────────────────────────
/**
 * t1361 — MEASURED, PINNED, NOT PATCHED. The preview's progress bar is `(lineIndex + 1) / totalLines`
 * (createPreviewPanel.js, setProgress) — one source with the "Running line N/total" counter, which was exactly right
 * while a program ran top to bottom once. A parametric body does not: the row loop returns to the top of its own
 * WHILE on every row, so the line index walks BACKWARD and the bar with it.
 *
 * The second half of this test asserts the criterion the fix has to meet, and it is already true of the formula —
 * a fraction of moves EXECUTED cannot decrease, whatever the control flow does. Building it means giving the panel
 * the total from the pre-run trace and a per-move counter through the play loop (and the looped-replay reset), which
 * is a real change to a live UI and was deliberately not started at the end of this turn.
 *
 * WHEN THAT LANDS, the first half of this test is DELETED, not restated — it exists to keep an open defect visible
 * and countable, in the shape t1329's "THE GAP IS REAL, MEASURED" uses.
 */
test('(5) PENDING — the line-index bar walks backward under a loop; an executed-move fraction cannot', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { surfaceRasterLines } = await import('/wizards/ops/surfaceraster.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const NL = String.fromCharCode(10);
        const lines = ['G90', ...surfaceRasterLines({ w: 200, h: 150, depth: 0.8, stepdown: 0.4, toolDia: 12,
            stepoverPct: 60, feed: 900, plunge: 180, clearance: 5 }), 'M30'];
        const segs = (traceToolpath(lines.join(NL)).segments || []).filter((s) => s.line != null);
        // the SHIPPING formula, replayed in execution order
        const lineFrac = segs.map((s) => (s.line + 1) / lines.length);
        let back = 0, worst = 0;
        for (let i = 1; i < lineFrac.length; i++) if (lineFrac[i] < lineFrac[i - 1]) { back++; worst = Math.max(worst, lineFrac[i - 1] - lineFrac[i]); }
        // the CRITERION: fraction of moves executed
        const moveFrac = segs.map((_, i) => (i + 1) / segs.length);
        let moveBack = 0;
        for (let i = 1; i < moveFrac.length; i++) if (moveFrac[i] < moveFrac[i - 1]) moveBack++;
        return { moves: segs.length, back, worst: +worst.toFixed(3), moveBack, last: moveFrac[moveFrac.length - 1] };
    });
    // THE OPEN DEFECT, counted so it cannot quietly grow (measured at t1361: 41 reversals over 89 moves, worst 0.388).
    expect(r.back, `the shipping line-index bar reverses ${r.back} times over ${r.moves} moves (worst jump ${r.worst})`).toBeGreaterThan(0);
    // THE CRITERION the replacement must meet.
    expect(r.moveBack, 'an executed-move fraction never decreases — monotonic by construction').toBe(0);
    expect(r.last, 'and it ends at exactly 100%, once, at the last move').toBe(1);
});
