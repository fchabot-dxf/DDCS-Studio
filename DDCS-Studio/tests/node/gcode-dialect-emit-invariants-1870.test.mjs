import { test, expect } from './support/harness.mjs';

/**
 * t1866→t1868→t1870 — THE STANDING CROSS-DIALECT EMIT SUITE. Generalizes gcode-v41-modal-restore-1868 (deleted,
 * folded in here) from ONE traced defect (corner/V4.1) into a standing gate over every probe op that shares the
 * dialect-level `setWorkOffset`/`wcsWriteIndirect` atoms — because the reason t1866's bug shipped at all is that
 * every existing spec in this suite runs the DEFAULT profile; three DDCS dialects ship and only one was ever
 * exercised (the advisor's own t1868 amendment, echoing the earlier wizard-bar coverage gap — same shape, a real
 * axis of usage with zero coverage).
 *
 * WHY THIS SUITE, NOT A WIDENED EXISTING SPEC SET (design call the advisor asked for, answered in WORK-LOG
 * t1868): existing probe specs assert UI/gesture/drawing behavior under one representative profile; tripling
 * each to cover 3 dialects would triple a 20-minute gate forever to cover a difference that exists at ONE
 * boundary (which dialect's G-code text gets emitted). This is a dedicated, emit-only suite instead —
 * `page.evaluate` → build the stack → `emitMapped` → assert G-code text, no DOM/canvas — cheap, and the natural
 * home for "does the right dialect variant get emitted." Dialect-sensitive WIZARD-LEVEL behavior (field gating,
 * conditional branches) sits ABOVE this boundary and this suite cannot see it — see "NOT COVERED" below.
 *
 * SCOPE — which ops are dialect-sensitive here, checked by reading the actual wizard code, not assumed:
 *   `grep -rl "mkWcsWrite|mkSWO|wcsWriteBlock|setWorkOffsetBlock" web/wizards/stacks/` finds exactly 5:
 *   cornerWizard, edgeWizard, middleWizard, rotaryCenterWizard, rotaryClockWizard. Two op-types the advisor
 *   named ("bore", "alignment") do NOT belong here, checked directly rather than assumed:
 *     - "bore" (`user_bore_data` / `boreData.js`) — its own `BORE_DATA_OPTYPE` constant is referenced NOWHERE
 *       outside its own file (no builder wired in `opBuilders.js`'s `BUILDER_REG`, no entry in `userOps.js`'s
 *       registry) — an ORPHANED data-op definition, not reachable via `getUserDef`/`builderOf` in the live app.
 *       "middle" is the live bore-CENTRE probe (already covered) — likely what the advisor meant informally.
 *     - "alignment" (`alignmentWizard.js`) IS live and wired (`opBuilders.js`'s `alignment: alignmentStack`),
 *       but contains zero references to `setWorkOffset`/`wcsWrite`/`G92`/`G90` — it doesn't write the WCS table
 *       this way at all (its own correction path is the measured-rotation one, deferred — see
 *       alignment-real-correction memory), so this defect class doesn't apply to it. Not a suite gap.
 *
 * INVARIANTS (properties, not transcripts — a golden-text-per-op-per-dialect suite would be 3x the maintenance
 * and go red on every legitimate emit change):
 *   A. Distance mode is DECIDED, never silently left over, before the next move. Walks forward from every
 *      `G90 G92 <axis>[...]` datum write to the first thing that actually matters — an explicit G90/G91
 *      re-declaration (a conscious choice, pass regardless of which mode) or a real non-G53 motion line (a
 *      leak: nothing decided the mode before this moved) — skipping comments/var-assignments/other datum
 *      writes in between. NOT the naive "is the very next line G91" check t1868's own throwaway sweep used —
 *      that produced false positives on edge/middle's other calls/rotaryCenter/rotaryClock, all of which
 *      legitimately re-declare a mode (often another G90) before anything moves. G53 lines are exempt: they are
 *      machine-frame moves, absolute BY DESIGN regardless of G90/G91 (t858's own "MODE-EXPLICIT" convention).
 *   B. Structural form — every non-Expert datum write matches the declared shape `G90 G92 <AXIS>[...]`, nothing
 *      divergent sneaks in. Folded into invariant A's own test (same page load) rather than a separate one.
 *   C. CONTROL, kept as ITS OWN separate claim per the t1868 amendment so it can never collapse with A/B:
 *      Expert never touches distance mode AT ALL — checked two ways: (1) no `G92` anywhere in any of the 5
 *      probe ops' own full emitted programs, and (2) calling `dialect.setWorkOffset`/`wcsWriteIndirect` DIRECTLY
 *      (not scanned out of a program, where an unrelated line could coincidentally carry a G90/G91) confirms
 *      neither atom's own return value contains G90/G91 at all — a genuinely different statement from "no G92
 *      line" (that one is about datum-write SHAPE; this one is about the atom touching distance mode at all).
 *
 * "NO MODAL STATE IS LEFT SET THAT A FOLLOWING LINE DEPENDS ON" (the advisor's 2nd bullet) — checked by reading
 * all 3 dialects' own `setWorkOffset`/`wcsWriteIndirect` source (`ddcs-expert-m350.js:89,106`, `ddcs-v41.js:68`,
 * `ddcs-v3-dm500.js:55`): none of the three touches any OTHER modal register (plane G17-19, units G20/G21, WCS
 * selection G54-59) — only G90/G91 is ever at risk from this atom family. Stated explicitly here rather than
 * building a generic modal-register scanner with nothing real to catch — that would be speculative machinery
 * over a documented non-finding, not a declaration of real intent.
 *
 * NON-VACUITY (proven by reverting t1868's fix and re-running — see WORK-LOG t1870 for the exact before/after
 * counts): honest finding, not glossed over — reverting turns RED for corner's all 3 call sites (both non-
 * Expert dialects, both directly-followed-by-a-real-move shapes at `probeZFirst:true`), but middle's own
 * Z-surface-write restore (added "defensively" in t1868, never step-trail-verified) turns out to be a TRUE
 * NO-OP for this invariant: `safeZframe.wrapMachineFrame`'s own G53 wrap ALREADY force-declares G90
 * unconditionally before its own G53 retract regardless of ambient mode, and nothing relative executes between
 * the datum write and that forced re-declaration (the "reposition" between them is an operator manual jog, no
 * G-code motion at all) — so the leaked G90 is swallowed before any move could misread it, with or without the
 * t1868 restore. Left in place (harmless, out of scope to remove this turn), reported honestly rather than
 * silently kept as if it were load-bearing.
 *
 * NOT COVERED BY THIS SUITE (the advisor's own explicit ask — the input to a separate wizard-level act):
 *   dialect-sensitive WIZARD-LEVEL behavior above the emit boundary — field gating, dialect-conditional UI
 *   branches. None found in the 5 wizards this turn beyond the emit-atom calls already covered (their own
 *   branch structure — probeZ/probeZFirst/twoAxis/etc — is dialect-AGNOSTIC, the same branches fire regardless
 *   of controller profile; only the LEAF atom's own output differs per dialect, which IS covered here).
 *
 * t2695 TIER MIGRATION — seeding: the browser tier reached these 5 data-op twins via `U.getUserDef`/`builderOf`
 * on the assumption that `app.js`'s `seedDefaultPortedUserOps()` had already registered them at boot. The node
 * harness never runs that boot sequence, so each test explicitly `registerUserOp`s the 5 twins first (mirrors
 * the seeding pattern used elsewhere in this tier — see tests/node/support/register.mjs's own contract note).
 */

const V41 = 'ddcs-v41', DM500 = 'ddcs-v3-dm500', EXPERT = 'ddcs-expert-m350';
const NON_EXPERT_DIALECTS = [V41, DM500];

// One entry per dialect-sensitive probe op. `overrides` route to the branch containing every fixed WCS-write
// call site for that wizard (not just whatever the bare defaults happen to reach) — verified per-op by reading
// the actual gated branch (probeZFirst/probeZ flags) rather than assumed from the defaults alone.
const PROBE_OPS = [
    { opType: 'user_corner_data', label: 'corner', overrides: { probeZFirst: true } },
    { opType: 'user_edge_data', label: 'edge', overrides: {} },
    { opType: 'user_middle_data', label: 'middle', overrides: { probeZ: true } },
    { opType: 'user_rotary_center_data', label: 'rotaryCenter', overrides: {} },
    { opType: 'user_rotary_clock_data', label: 'rotaryClock', overrides: {} },
];

async function boot(page) {
    await page.goto('/');
    await page.waitForFunction(() => window.ddcsGetBlockProgram, null, { timeout: 30000 });
}

/** t2695 — seed the 5 dialect-sensitive probe-op twins the real app boot registers via seedDefaultPortedUserOps(),
 *  which this tier's page.goto() stub does not run. Guarded by an existence check since node persists module
 *  state (USER_DEFS) across every test in one process — re-registering an already-registered opType throws. */
async function seedProbeOpTwins(page) {
    await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const defs = await Promise.all([
            import('/blocks/dataOps/cornerData.js').then((m) => m.cornerDataDef()),
            import('/blocks/dataOps/edgeData.js').then((m) => m.edgeDataDef()),
            import('/blocks/dataOps/middleData.js').then((m) => m.middleDataDef()),
            import('/blocks/dataOps/rotaryCenterData.js').then((m) => m.rotaryCenterDataDef()),
            import('/blocks/dataOps/rotaryClockData.js').then((m) => m.rotaryClockDataDef()),
        ]);
        for (const def of defs) if (!U.getUserDef(def.opType)) U.registerUserOp(def);
    });
}

/** Runs the whole (dialect × op) matrix in ONE page — one navigation, not ten — for speed; each combo's own
 *  G-code + derived checks come back as a plain array so failures stay individually legible. */
async function buildMatrix(page, dialects, ops) {
    return page.evaluate(async ({ dialects, ops }) => {
        const { setMachine } = await import('/data/workspaceMachine.js');
        const U = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { activeDialectOpts } = await import('/wizards/previewEmit.js');
        const rows = [];
        for (const dialect of dialects) {
            setMachine({ controllerId: dialect }, true);
            for (const { opType, label, overrides } of ops) {
                const def = U.getUserDef(opType);
                if (!def) { rows.push({ dialect, label, opType, found: false, gcode: '' }); continue; }
                const params = { ...U.defaultParams(def), ...overrides };
                const stack = builderOf(opType)(params);
                const gcode = emitMapped(stack, activeDialectOpts()).text;
                rows.push({ dialect, label, opType, found: true, gcode });
            }
        }
        return rows;
    }, { dialects, ops });
}

/** INVARIANT A+B — see header. Returns leaks (A) and malformed (B) as two lists. */
function checkDistanceMode(gcode) {
    const lines = gcode.split('\n').map((l) => l.trim());
    const isModeDecl = (l) => /^G9[01]\b/.test(l);
    const isG53Move = (l) => /\bG53\b/.test(l);
    const isMotion = (l) => /^(G0|G1|G2|G3|G31)\b/.test(l) && /[XYZA]/.test(l);
    const leaks = [];
    const malformed = [];
    for (let i = 0; i < lines.length; i++) {
        if (!/^G90 G92\b/.test(lines[i])) continue;
        if (!/^G90 G92 [A-Z]\[.+\]$/.test(lines[i])) malformed.push({ line: i, text: lines[i] });
        let j = i + 1;
        while (j < lines.length) {
            const l = lines[j];
            if (isModeDecl(l)) break;   // a conscious decision was made -- fine, whatever it is
            if (isMotion(l) && !isG53Move(l)) { leaks.push({ line: i, text: lines[i], leakedAt: j, leakedText: lines[j] }); break; }
            j++;
        }
    }
    return { leaks, malformed };
}

test('INVARIANT A+B — distance mode is decided (never silently leaked) before the next move, across every probe op × every non-Expert DDCS dialect', async ({ page }) => {
    await boot(page);
    await seedProbeOpTwins(page);

    const rows = await buildMatrix(page, NON_EXPERT_DIALECTS, PROBE_OPS);
    const failures = [];
    for (const row of rows) {
        expect(row.found, `${row.opType} must resolve to a real builder`).toBe(true);
        const g92Lines = row.gcode.split('\n').filter((l) => /^G90 G92\b/.test(l.trim()));
        if (g92Lines.length === 0) { failures.push({ ...row, gcode: undefined, why: 'sanity failed — no G92 datum write emitted at all, check is vacuous for this combo' }); continue; }
        const { leaks, malformed } = checkDistanceMode(row.gcode);
        if (leaks.length) failures.push({ dialect: row.dialect, label: row.label, why: 'LEAK', leaks });
        if (malformed.length) failures.push({ dialect: row.dialect, label: row.label, why: 'MALFORMED', malformed });
    }
    expect(failures, `distance-mode invariant violations: ${JSON.stringify(failures, null, 2)}`).toEqual([]);
});

test('CONTROL — Expert never emits G92 in any of the 5 probe ops (structural form; generalizes the corner-only check)', async ({ page }) => {
    await boot(page);
    await seedProbeOpTwins(page);

    const rows = await buildMatrix(page, [EXPERT], PROBE_OPS);
    const withG92 = rows.filter((r) => /G92\b/.test(r.gcode)).map((r) => r.label);
    expect(withG92, `Expert's own wcsWriteIndirect/setWorkOffset arms never touch G92 — found G92 in: ${JSON.stringify(withG92)}`).toEqual([]);
});

test('CONTROL, stated separately: Expert\'s datum-write atoms themselves make no distance-mode change at all', async ({ page }) => {
    // A DIFFERENT claim from "no G92 line" above — that one is about the SHAPE of the datum write; this one is
    // about the ATOM's own emit touching G90/G91 AT ALL. Asserted directly on the atom's own return value (not
    // scanned out of a full program, where an unrelated op could coincidentally carry a G90/G91) so the two
    // assertions can never silently collapse into each other (t1868 amendment).
    await boot(page);

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

test('the drawing, as a consequence: V4.1 corner\'s own drawn Y matches the ground truth (the emitted reposition math)', async ({ page }) => {
    await boot(page);
    await seedProbeOpTwins(page);

    const result = await page.evaluate(async () => {
        const { setMachine } = await import('/data/workspaceMachine.js');
        setMachine({ controllerId: 'ddcs-v41' }, true);
        const U = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { opSimStarts } = await import('/viz/opSimStarts.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const { activeDialectOpts } = await import('/wizards/previewEmit.js');

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

        // Ground truth: the SAME emitted reposition math the real machine will run. If the modal restore is
        // correct, the trace's own passEnds[0] should be the honest -5mm retract from the touch point.
        return { passEnds: traced.passEnds };
    });

    // The retract that was corrupted (t1866: world Y landed at -48 instead of ~-7) must now land close to the
    // physically-correct retract distance from the touch — not asserting the exact number (stock-dependent),
    // asserting it is no longer the ~8x-too-large jump the bug produced.
    const y0 = result.passEnds[0].y;
    expect(Math.abs(y0), `pass-0's own runtime-end Y must be a small, physically-plausible retract from the touch, not the ~-48 the bug produced — got ${y0}`).toBeLessThan(20);
});
