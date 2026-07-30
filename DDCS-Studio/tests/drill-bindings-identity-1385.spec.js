import { test, expect } from '@playwright/test';

/**
 * t1385 STEP 1 — THE DRILL/BORE TWINS BIND BY IDENTITY, AND NOTHING MOVED.
 *
 * ── WHY THIS CONVERSION HAD TO COME FIRST ─────────────────────────────────────────────────────────────────────────
 * The drill switch re-points `drillStack` through `holecycle`, which MERGES the `array` container and its `drill`/`bore`
 * leaf into ONE block. Until t1385 both twins bound every param to a hand-counted `blockIndex` in the flattened
 * template — 7 for the 15-row pattern/geometry cluster, 8 for the cut params, plus a `WRAP_PREFIX_COUNT = 4` offset for
 * the presentation blocks. A positional map cannot survive a 2-into-1 collapse: the two indices become one and every
 * index after them shifts. So the map converts to `match: {type}` identity specs FIRST, as its own act with its own proof.
 *
 * ── THE PROOF IS THAT NOTHING MOVED ───────────────────────────────────────────────────────────────────────────────
 * The tables below are the EXACT bindings the positional map produced, captured BEFORE the conversion and frozen here as
 * data. A conversion that silently re-pointed one socket would still look like a working app while emitting subtly wrong
 * G-code, so the check is per-row (param → key → blockIndex → default), in order, not a count.
 *
 * ⚠ ONE ROW DIFFERS, DELIBERATELY, AND IT IS A CONVERGENCE RATHER THAN A CHANGE. `rpm` declares `socketHeld: true` with
 * NO default, so the positional map left `default: undefined`. `deriveBindings` reads an omitted default FROM THE SOCKET
 * (its own declare-never-infer rule: the template IS the default), giving `default: 0`. That is not a new behaviour being
 * introduced here — it is EXACTLY what `surfacingData`'s identical rpm row has shipped since t1349, and the second test
 * asserts that against surfacing itself rather than arguing it. The field still means blank-is-the-Head-default, because
 * that comes from `socketHeld` plus `spindleHeadPatch`, neither of which this touches.
 */
test.use({ viewport: { width: 1400, height: 950 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

/** The pre-conversion bindings, frozen. Only `rpm` carries its post-conversion default — see the header. */
const DRILL_FROZEN = [
    { param: 'wcs', key: 'wcs', blockIndex: 5, default: 'active' },
    { param: 'stockAttach', key: 'stockAttach', blockIndex: 6, default: '' },
    { param: 'pathDatum', key: 'pathDatum', blockIndex: 6, default: '' },
    { param: 'stockDatum', key: 'stockDatum', blockIndex: 6, default: 'nnp' },
    { param: 'stockW', key: 'stockW', blockIndex: 6, default: 0 },
    { param: 'stockH', key: 'stockH', blockIndex: 6, default: 0 },
    { param: 'stockZ', key: 'stockZ', blockIndex: 6, default: 0 },
    { param: 'originX', key: 'offX', blockIndex: 6, default: 0 },
    { param: 'originY', key: 'offY', blockIndex: 6, default: 0 },
    { param: 'offZ', key: 'offZ', blockIndex: 6, default: 0 },
    { param: 'pattern', key: 'pattern', blockIndex: 7, default: 'single' },
    { param: 'x0', key: 'x0', blockIndex: 7, default: 0 },
    { param: 'y0', key: 'y0', blockIndex: 7, default: 0 },
    { param: 'cols', key: 'cols', blockIndex: 7, default: 3 },
    { param: 'rows', key: 'rows', blockIndex: 7, default: 2 },
    { param: 'dx', key: 'dx', blockIndex: 7, default: 20 },
    { param: 'dy', key: 'dy', blockIndex: 7, default: 20 },
    { param: 'count', key: 'count', blockIndex: 7, default: 4 },
    { param: 'spacing', key: 'spacing', blockIndex: 7, default: 20 },
    { param: 'angle', key: 'angle', blockIndex: 7, default: 0 },
    { param: 'dia', key: 'dia', blockIndex: 7, default: 50 },
    { param: 'startAngle', key: 'startAngle', blockIndex: 7, default: 0 },
    { param: 'w', key: 'w', blockIndex: 7, default: 100 },
    { param: 'h', key: 'h', blockIndex: 7, default: 80 },
    { param: 'nx', key: 'nx', blockIndex: 7, default: 2 },
    { param: 'ny', key: 'ny', blockIndex: 7, default: 2 },
    { param: 'skip', key: 'skip', blockIndex: 7, default: '' },
    { param: 'depth', key: 'depth', blockIndex: 8, default: 5 },
    { param: 'peck', key: 'peck', blockIndex: 8, default: 5 },
    { param: 'feed', key: 'feed', blockIndex: 8, default: 100 },
    { param: 'rpm', key: 'rpm', blockIndex: 4, default: 0 },
];
const BORE_FROZEN = [
    { param: 'wcs', key: 'wcs', blockIndex: 5, default: 'active' },
    { param: 'stockAttach', key: 'stockAttach', blockIndex: 6, default: '' },
    { param: 'pathDatum', key: 'pathDatum', blockIndex: 6, default: '' },
    { param: 'stockDatum', key: 'stockDatum', blockIndex: 6, default: 'nnp' },
    { param: 'stockW', key: 'stockW', blockIndex: 6, default: 0 },
    { param: 'stockH', key: 'stockH', blockIndex: 6, default: 0 },
    { param: 'stockZ', key: 'stockZ', blockIndex: 6, default: 0 },
    { param: 'originX', key: 'offX', blockIndex: 6, default: 0 },
    { param: 'originY', key: 'offY', blockIndex: 6, default: 0 },
    { param: 'offZ', key: 'offZ', blockIndex: 6, default: 0 },
    { param: 'pattern', key: 'pattern', blockIndex: 7, default: 'single' },
    { param: 'x0', key: 'x0', blockIndex: 7, default: 0 },
    { param: 'y0', key: 'y0', blockIndex: 7, default: 0 },
    { param: 'cols', key: 'cols', blockIndex: 7, default: 3 },
    { param: 'rows', key: 'rows', blockIndex: 7, default: 2 },
    { param: 'dx', key: 'dx', blockIndex: 7, default: 20 },
    { param: 'dy', key: 'dy', blockIndex: 7, default: 20 },
    { param: 'count', key: 'count', blockIndex: 7, default: 4 },
    { param: 'spacing', key: 'spacing', blockIndex: 7, default: 20 },
    { param: 'angle', key: 'angle', blockIndex: 7, default: 0 },
    { param: 'dia', key: 'dia', blockIndex: 7, default: 50 },
    { param: 'startAngle', key: 'startAngle', blockIndex: 7, default: 0 },
    { param: 'w', key: 'w', blockIndex: 7, default: 100 },
    { param: 'h', key: 'h', blockIndex: 7, default: 80 },
    { param: 'nx', key: 'nx', blockIndex: 7, default: 2 },
    { param: 'ny', key: 'ny', blockIndex: 7, default: 2 },
    { param: 'skip', key: 'skip', blockIndex: 7, default: '' },
    { param: 'depth', key: 'depth', blockIndex: 8, default: 5 },
    { param: 'holeDia', key: 'holeDia', blockIndex: 8, default: 12 },
    { param: 'toolDia', key: 'toolDia', blockIndex: 8, default: 6 },
    { param: 'pitch', key: 'pitch', blockIndex: 8, default: 0.5 },
    { param: 'ramp', key: 'ramp', blockIndex: 8, default: 'step' },
    { param: 'feed', key: 'feed', blockIndex: 8, default: 100 },
    { param: 'rpm', key: 'rpm', blockIndex: 4, default: 0 },
];

/**
 * ⚠ RESTATED FOR THE SWITCH, WITH HISTORY (t1385). The tables above are the PRE-SWITCH positional map, and they are kept
 * because they are the baseline the conversion was proven against — but the switch then DELIBERATELY moves two of those
 * indices, and asserting the old numbers verbatim would now be asserting that the switch had not happened.
 *
 * So the check becomes the RELATIONSHIP the collapse creates, which is a stronger statement than either table alone:
 *   • EVERY param survives, with the same key, in the same order  — nothing was lost or re-pointed in the move.
 *   • Every default is unchanged                                  — the merge moved sockets, not values.
 *   • The pattern cluster and the cut params, which sat on blocks 7 (`array`) and 8 (`drill`/`bore`), now resolve to ONE
 *     AND THE SAME index — that IS the 2-into-1 collapse, measured rather than described.
 *   • Nothing else moves: the framing sockets (progstart / wcs / placeonstock) keep their exact indices.
 * The last two are what a positional map could not have expressed at all, which is the whole reason step 1 came first.
 */
test('THE SWITCH — every binding survives the 2-into-1 collapse: same params, same keys, sockets merged', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { DRILL_BINDINGS } = await import('/blocks/dataOps/drillData.js');
        const { BORE_BINDINGS } = await import('/blocks/dataOps/boreData.js');
        const { flattenBlocks } = await import('/blocks/userOps.js');
        const { drillDataDef } = await import('/blocks/dataOps/drillData.js');
        const { boreDataDef } = await import('/blocks/dataOps/boreData.js');
        const slim = (bs) => bs.map((b) => ({ param: b.param, key: b.key, blockIndex: b.blockIndex, default: b.default }));
        return {
            drill: slim(DRILL_BINDINGS), bore: slim(BORE_BINDINGS),
            drillFlat: flattenBlocks(drillDataDef().template).map((b) => b.type),
            boreFlat: flattenBlocks(boreDataDef().template).map((b) => b.type),
        };
    });
    // The flatten really did lose a block — the premise of everything below.
    for (const [name, flat] of [['drill', r.drillFlat], ['bore', r.boreFlat]]) {
        expect(flat, `${name}: the merged template carries holecycle`).toContain('holecycle');
        expect(flat, `${name}: and no longer an array container`).not.toContain('array');
        expect(flat.length, `${name}: one block shorter than the 12-block literal flatten`).toBe(11);
    }
    for (const [name, got, want] of [['drill', r.drill, DRILL_FROZEN], ['bore', r.bore, BORE_FROZEN]]) {
        expect(got.length, `${name}: the same number of bindings — none dropped by a match that found nothing`).toBe(want.length);
        // ORDER matters too: the form renders in binding order, so a re-ordered map is a re-ordered form.
        expect(got.map((b) => b.param), `${name}: same params, same order`).toEqual(want.map((b) => b.param));
        // `ramp` is the ONE key that legitimately changed: the bore leaf's `ramp` folded into the family's `cycle` knob.
        const keyOf = (b) => (b.param === 'ramp' ? 'cycle' : b.key);
        expect(got.map((b) => b.key), `${name}: same socket keys (ramp → cycle, the folded knob)`).toEqual(want.map(keyOf));
        // Defaults unchanged — except `ramp`, whose VALUE moved into the cycle vocabulary with its label untouched.
        for (let i = 0; i < want.length; i++) {
            if (want[i].param === 'ramp') { expect(got[i].default, 'ramp now defaults to the cycle spelling').toBe('bore-step'); continue; }
            expect(got[i].default, `${name}: "${want[i].param}" keeps its default across the switch`).toEqual(want[i].default);
        }
        // THE COLLAPSE, MEASURED: the two old body indices are now one.
        const at = (p) => got.find((b) => b.param === p).blockIndex;
        const oldAt = (p) => want.find((b) => b.param === p).blockIndex;
        expect(at('pattern'), `${name}: the pattern cluster still sits where the array did`).toBe(oldAt('pattern'));
        expect(at('depth'), `${name}: and the CUT params merged onto that same block (was ${oldAt('depth')})`).toBe(at('pattern'));
        expect(oldAt('depth') - oldAt('pattern'), `${name}: which were two DIFFERENT blocks before`).toBe(1);
        // …and the framing sockets did not budge.
        for (const p of ['rpm', 'wcs', 'originX']) {
            expect(at(p), `${name}: "${p}" (framing) keeps its exact index — the merge was local to the body`).toBe(oldAt(p));
        }
    }
});

test('STEP 1 — the rpm default is surfacing’s, measured against surfacing (a convergence, not a novelty)', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { SURFACING_BINDINGS } = await import('/blocks/dataOps/surfacingData.js');
        const { DRILL_BINDINGS } = await import('/blocks/dataOps/drillData.js');
        const { BORE_BINDINGS } = await import('/blocks/dataOps/boreData.js');
        const pick = (bs) => { const b = bs.find((x) => x.param === 'rpm') || {}; return { default: b.default, socketHeld: !!b.socketHeld, key: b.key }; };
        return { surfacing: pick(SURFACING_BINDINGS), drill: pick(DRILL_BINDINGS), bore: pick(BORE_BINDINGS) };
    });
    expect(r.drill, 'drill rpm now matches surfacing exactly — the op that already made this same switch').toEqual(r.surfacing);
    expect(r.bore, 'and so does bore').toEqual(r.surfacing);
    expect(r.drill.socketHeld, 'still socket-held, which is what keeps an untouched field out of the instantiate').toBe(true);
});

/**
 * THE EMIT IS BYTE-STABLE — the whole point of the act. A binding conversion must be invisible in the G-code, and it is
 * swept across the axes the bindings actually drive so this is not a one-config coincidence.
 */
test('STEP 1 — both twins emit byte-identically to drillStack across the binding sweep', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { drillDataDef, DRILL_DEFAULTS } = await import('/blocks/dataOps/drillData.js');
        const { boreDataDef, BORE_DEFAULTS } = await import('/blocks/dataOps/boreData.js');
        const { instantiate } = await import('/blocks/userOps.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { drillStack } = await import('/wizards/drillWizard.js');
        const SWEEP = [
            {}, { pattern: 'grid', cols: 4, rows: 3, dx: 15, dy: 25 },
            { pattern: 'circle', dia: 80, count: 6, startAngle: 15 },
            { pattern: 'line', count: 5, spacing: 12, angle: 30 },
            { pattern: 'rect', w: 60, h: 40, nx: 3, ny: 3 },
            { pattern: 'grid', cols: 3, rows: 2, skip: '2, 4' },
            { depth: 12, feed: 250 }, { x0: 7.5, y0: -3.25 },
            { originX: 20, originY: 10, offZ: 2 }, { wcs: 'G55' },
            { stockAttach: 'nnp', pathDatum: 'nnp', stockW: 200, stockH: 150, stockZ: 20 },
        ];
        const out = { drill: [], bore: [] };
        for (const s of SWEEP) {
            const a = emitMapped(instantiate(drillDataDef(), s)).text;
            const b = emitMapped(drillStack({ ...DRILL_DEFAULTS, ...s })).text;
            out.drill.push({ s, same: a === b, a: a === b ? '' : a.slice(0, 700), b: a === b ? '' : b.slice(0, 700) });
            const c = emitMapped(instantiate(boreDataDef(), s)).text;
            const d = emitMapped(drillStack({ ...BORE_DEFAULTS, ...s })).text;
            out.bore.push({ s, same: c === d, a: c === d ? '' : c.slice(0, 700), b: c === d ? '' : d.slice(0, 700) });
        }
        return out;
    });
    for (const kind of ['drill', 'bore']) {
        const bad = r[kind].filter((x) => !x.same);
        if (bad.length) console.log(kind + ' FIRST DIFF ' + JSON.stringify(bad[0].s) + '\n--- TWIN ---\n' + bad[0].a + '\n--- BUILDER ---\n' + bad[0].b);
        expect(bad.map((x) => x.s), `${kind}: every swept config still emits byte-identically`).toEqual([]);
        expect(r[kind].length, `${kind}: the sweep really ran`).toBeGreaterThan(10);
    }
});

/**
 * AND THE FORWARD-LOOKING PROPERTY — the one the switch actually needs.
 *
 * Identity bindings are only worth converting to if they SURVIVE a shape change. So this shifts the body by prepending a
 * block and asserts every binding still finds its socket, at an index that MOVED. Under the old positional map every row
 * would silently point one block too early — which is precisely the failure the switch would otherwise have walked into,
 * and it would have emitted a working-looking program with the wrong numbers in it.
 */
test('STEP 1 — the map survives a shape change: shift the body, every binding re-derives', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { deriveBindingsFor } = await import('/blocks/dataOps/deriveBindings.js');
        const { drillDataDef, DRILL_BINDING_SPECS } = await import('/blocks/dataOps/drillData.js');
        const def = drillDataDef();
        const shifted = JSON.parse(JSON.stringify(def.template));
        shifted[0].children = [{ type: 'comment', params: { text: 'shim' } }, ...shifted[0].children];
        const before = deriveBindingsFor(def.template, DRILL_BINDING_SPECS);
        const after = deriveBindingsFor(shifted, DRILL_BINDING_SPECS);
        return {
            count: before.length,
            sameParams: JSON.stringify(before.map((b) => b.param)) === JSON.stringify(after.map((b) => b.param)),
            sameKeys: JSON.stringify(before.map((b) => b.key)) === JSON.stringify(after.map((b) => b.key)),
            // Every BODY index moved by exactly one. rpm/progstart and the rest all sit after the inserted shim, so the
            // whole map shifts uniformly — proof the scan RE-FOUND each socket instead of reusing a frozen number.
            shifts: before.map((b, i) => after[i].blockIndex - b.blockIndex),
        };
    });
    expect(r.count, 'the whole map derived').toBeGreaterThan(25);
    expect(r.sameParams, 'the same params, in the same order, after the shape change').toBe(true);
    expect(r.sameKeys, 'each still driving the same socket key').toBe(true);
    expect([...new Set(r.shifts)], 'every flat index RE-DERIVED by exactly +1 — a frozen positional map could not').toEqual([1]);
});
