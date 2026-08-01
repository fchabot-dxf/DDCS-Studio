import { test, expect } from '@playwright/test';

/**
 * t1500 — THE SLOT RE-POINT LANDS: the twin becomes a SUPERSET twin, and the swap ships behind it.
 *
 * t1498 measured the domain and then PARKED the swap, for a reason that is the whole shape of this act: the twin's
 * template was FROZEN and seeded from `slotStack(SLOT_DEFAULTS)`, whose width 6 == tool 6 is the ZERO BAND — so the
 * seed stayed LITERAL, and a twin at width 14 would have emitted the LITERAL slot while the form emitted the ATOM.
 * Two paths cutting differently for one set of parameters is worse than not re-pointing at all.
 *
 * So the claim this spec has to carry is not "the swap works". It is that the twin and the builder agree ACROSS THE
 * WHOLE DOMAIN — both arms, both sides of every gate — with the width-14 case that parked the swap asserted by name
 * as the proof it cannot recur.
 */

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram, null, { timeout: 20000 });
};

/**
 * THE DOMAIN, declared once and swept by every test below. Deliberately straddling: each of the four gate clauses
 * appears on BOTH sides, so a twin that agreed only inside one arm could not pass.
 */
const DOMAIN = `
    const rad = (d) => d * Math.PI / 180;
    const at = (d, len) => ({ ax: 0, ay: 0, bx: len * Math.cos(rad(d)), by: len * Math.sin(rad(d)) });
    const DOMAIN = [];
    for (const wid of [6, 6.5, 10, 14, 18, 24])                    // 6 == the ZERO BAND · 14 == the case that parked the swap
        for (const ang of [0, 30, 90, -30, 137.5])
            for (const entry of ['plunge', 'ramp', 'helix'])       // helix is REFUSED, ramp is refused only on a partial bite
                for (const [depth, stepdown] of [[3, 1.5], [4, 1.5], [3.2, 0.8]])   // full bite · PARTIAL (the shipped defaults) · partial
                    for (const tool of [6, 8])
                        DOMAIN.push({ ...at(ang, 60), width: wid, toolDia: tool, entry, depth, stepdown });
`;

/**
 * ── THE CLAIM — twin == builder, byte for byte, over the whole domain ─────────────────────────────────────────────
 *
 * `builderOf` is `instantiate(def, …)`: an INDEPENDENT path from `slotStack`. It re-prunes the guarded superset,
 * re-derives the bindings by identity over the pruned stack and re-runs `postInstantiate` on every build, so the
 * derived sockets are live rather than baked. If any of that were wrong, the arms would diverge here.
 */
test('THE TWIN == THE BUILDER across the WHOLE domain — both arms, both sides of every gate', async ({ page }) => {
    test.setTimeout(180000);
    await boot(page);
    const r = await page.evaluate(async (D) => {
        const { slotStack, slotStackRidesRaster } = await import('/wizards/slotWizard.js');
        const { slotDataDef, SLOT_DEFAULTS, SLOT_DATA_OPTYPE } = await import('/blocks/dataOps/slotData.js');
        const { emitEquivalence } = await import('/blocks/dataOps/equivalence.js');
        const { registerUserOp } = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const DOMAIN = eval(`(() => { ${D} return DOMAIN; })()`);

        registerUserOp(slotDataDef());
        const dataBuilder = builderOf(SLOT_DATA_OPTYPE);
        // t945 — the twin inherits the machine Head at BUILD; seed the SAME live Head into the reference so the M3
        // header is not a spurious diff (the form path does this at insert).
        const base = { ...SLOT_DEFAULTS, spindle: (window.ddcsGetSettings && window.ddcsGetSettings().spindle) || {} };
        const sweep = DOMAIN.map((o) => ({ ...base, ...o }));

        const res = emitEquivalence(slotStack, dataBuilder, sweep);
        // …and count which ARM each config took, so a green result cannot be green because everything went literal.
        let para = 0, lit = 0;
        for (const p of sweep) (slotStackRidesRaster(p) ? para++ : lit++);
        return {
            count: res.count, pass: res.pass, para, lit,
            firstDiff: res.firstDiff && { params: res.firstDiff.params, a: res.firstDiff.a.slice(0, 700), b: res.firstDiff.b.slice(0, 700) },
        };
    }, DOMAIN);

    expect(r.count, 'the domain is a real cross-product, not a sample').toBeGreaterThan(500);
    // ⚠ BOTH ARMS ARE REALLY EXERCISED. Without this a byte-identity pass would be consistent with the swap never firing.
    expect(r.para, 'a substantial slice really does ride the parametric atom').toBeGreaterThan(100);
    expect(r.lit, 'and a substantial slice really does keep the literal kernel').toBeGreaterThan(100);
    if (!r.pass) console.log('FIRST DIFF @ ' + JSON.stringify(r.firstDiff && r.firstDiff.params) + '\n--- slotStack ---\n' + (r.firstDiff && r.firstDiff.a) + '\n--- twin ---\n' + (r.firstDiff && r.firstDiff.b));
    expect(r.pass, 'twin == builder byte-for-byte across the whole domain').toBe(true);
});

/**
 * ── THE CASE THAT PARKED THE SWAP, ASSERTED BY NAME ───────────────────────────────────────────────────────────────
 *
 * A width-14 slot: the FORM emits the atom, and t1498 measured that a FROZEN twin emitted the literal kernel for the
 * same parameters. The general sweep above would catch it, but it would catch it as one row in five hundred — and
 * the thing worth locking is not "no diffs", it is that THIS pair of paths agrees on THIS config, both really are
 * parametric, and the default (zero-band) config really is still literal on both. A regression that re-froze the
 * template would read as a vague sweep failure; here it reads as the sentence that named it.
 */
test('THE WIDTH-14 CASE — the config that parked the swap is now parametric on BOTH paths', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { slotStack, slotStackRidesRaster } = await import('/wizards/slotWizard.js');
        const { slotDataDef, SLOT_DEFAULTS, SLOT_DATA_OPTYPE } = await import('/blocks/dataOps/slotData.js');
        const { registerUserOp, flattenBlocks } = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');

        registerUserOp(slotDataDef());
        const build = builderOf(SLOT_DATA_OPTYPE);
        const base = { ...SLOT_DEFAULTS, spindle: (window.ddcsGetSettings && window.ddcsGetSettings().spindle) || {} };
        const types = (stack) => flattenBlocks(stack).map((b) => b.type);
        const wide = { ...base, width: 14, stepoverPct: 30 };
        const dflt = { ...base };   // width 6 == tool 6 → the ZERO BAND
        return {
            wideRides: slotStackRidesRaster(wide), dfltRides: slotStackRidesRaster(dflt),
            wideForm: types(slotStack(wide)), wideTwin: types(build(wide)),
            dfltForm: types(slotStack(dflt)), dfltTwin: types(build(dflt)),
            wideSame: emitMapped(slotStack(wide)).text === emitMapped(build(wide)).text,
            dfltSame: emitMapped(slotStack(dflt)).text === emitMapped(build(dflt)).text,
        };
    });
    expect(r.wideRides, 'a width-14 slot rides the atom').toBe(true);
    expect(r.wideForm, 'the FORM path builds the atom').toContain('surfaceraster');
    expect(r.wideTwin, '…and so does the TWIN — the split t1498 measured cannot recur').toContain('surfaceraster');
    expect(r.wideForm).not.toContain('slot');
    expect(r.wideTwin).not.toContain('slot');
    expect(r.wideSame, 'and the two emit the same program').toBe(true);
    // the other side of the same line: the shipped defaults are the ZERO BAND, and BOTH paths keep the literal kernel
    expect(r.dfltRides, 'the shipped defaults are the zero band').toBe(false);
    expect(r.dfltForm, 'the FORM path keeps the literal leaf there').toContain('slot');
    expect(r.dfltTwin, '…and so does the TWIN').toContain('slot');
    expect(r.dfltForm).not.toContain('surfaceraster');
    expect(r.dfltTwin).not.toContain('surfaceraster');
    expect(r.dfltSame, 'and the two emit the same program').toBe(true);
});

/**
 * ── THE SWAP ITSELF — an eligible slot emits a PARAMETRIC body, a refused one emits the literal coordinate list ───
 *
 * The point of the re-point is not that the two paths agree; it is that the eligible slot's program is now a MACRO
 * with live registers instead of an unrolled list of moves. Asserted as a PROPERTY of the text on both sides of the
 * gate, so "it still emits something" cannot pass for "it re-pointed".
 */
test('THE SWAP — an eligible slot emits registers and a loop; a refused one emits the literal list it always did', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { slotStack, slotStackRidesRaster, slotStackArmGap } = await import('/wizards/slotWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { SLOT_DEFAULTS } = await import('/blocks/dataOps/slotData.js');
        const { readDeclaredWork } = await import('/engine/declaredWork.js');
        const base = { ...SLOT_DEFAULTS, spindle: (window.ddcsGetSettings && window.ddcsGetSettings().spindle) || {} };
        const shot = (o) => {
            const p = { ...base, ...o };
            const text = emitMapped(slotStack(p)).text;
            return {
                rides: slotStackRidesRaster(p), gap: slotStackArmGap(p),
                hasRegs: /#4[0-9]\s*=/.test(text), hasGoto: /GOTO/.test(text),
                work: readDeclaredWork(text),
                cutMoves: (text.match(/^G1 /gm) || []).length,
            };
        };
        return {
            wide: shot({ width: 14, stepoverPct: 30 }),
            angled: shot({ width: 16, ax: 5, ay: 5, bx: 65, by: 40 }),
            zeroBand: shot({}),                                  // width == tool
            helix: shot({ width: 14, entry: 'helix' }),
            partialRamp: shot({ width: 14, entry: 'ramp', depth: 4, stepdown: 1.5 }),   // t1506 — the shipped defaults; ACCEPTED now
            fullRamp: shot({ width: 14, entry: 'ramp', depth: 3, stepdown: 1.5 }),
            patterned: shot({ width: 14, pattern: 'grid', cols: 2, rows: 2 }),
        };
    });
    for (const k of ['wide', 'angled', 'fullRamp', 'partialRamp']) {
        expect(r[k].rides, `${k}: rides the atom`).toBe(true);
        expect(r[k].gap, `${k}: …with no refusal to give`).toBe('');
        expect(r[k].hasRegs, `${k}: the program carries live registers, not an unrolled list`).toBe(true);
        expect(r[k].hasGoto, `${k}: …and a real loop`).toBe(true);
        // t1383 — the atom DECLARES its work so the sim's trace cap is not guessed. A re-pointed slot inherits it.
        expect(r[k].work, `${k}: the parametric body declares its @work (else the sim truncates a looping program)`).toBeGreaterThan(0);
    }
    // …and every refusal keeps the literal kernel, each for its own declared reason
    expect(r.zeroBand.rides).toBe(false);
    expect(r.zeroBand.gap).toMatch(/ZERO band/);
    expect(r.helix.gap).toMatch(/ENTRY END/);
    expect(r.patterned.gap).toMatch(/PATTERNED slot/);
    // ⚠ t1506 — partialRamp MOVED from this list to the accepted one above. It was the third gate, and the slot
    // wizard's OWN DEFAULTS sat in it; converging the kernel on the family's nominal descent dissolved the boundary.
    for (const k of ['zeroBand', 'helix', 'patterned']) {
        expect(r[k].hasGoto, `${k}: no loop — the literal kernel is an unrolled coordinate list`).toBe(false);
        expect(r[k].cutMoves, `${k}: …and it still cuts`).toBeGreaterThan(0);
    }
});

/**
 * ── THE PATTERN CLAUSE, EARNED RATHER THAN ASSERTED ───────────────────────────────────────────────────────────────
 *
 * The gate refuses a patterned slot because `array` does not declare `absorbsPlacement`, so a PLACED pattern falls
 * through to `translateProgram`. ⚠ THE MECHANISM IS NOT THE SHEAR, and writing the clause from t1349's memory got it
 * wrong until this test was driven: t1353 already closed the shear by REFUSING a parametric body, so the real
 * outcome is a program handed back UNSHIFTED — the stock-attach and offset silently dropped. Quieter, and no better.
 * A refusal whose reason is only stated in a comment is a refusal nobody can check, so it is demonstrated here.
 */
test('THE PATTERN CLAUSE — a placed parametric body is REFUSED (not sheared), which is why a pattern stays literal', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { absorbingChild, newBlock } = await import('/blocks/blockEmitter.js');
        const { translateProgram } = await import('/data/rotateProgram.js');
        const arr = newBlock('array'); arr.params = { pattern: 'grid', cols: 2, rows: 2, dx: 40, dy: 30 };
        const atom = newBlock('surfaceraster');
        arr.children = [atom];
        return {
            atomAbsorbs: !!absorbingChild([atom]),      // the atom ALONE under a place is handed its frame as params
            arrayAbsorbs: !!absorbingChild([arr]),      // …an array of them is NOT, so the shift is painted onto text
            para: translateProgram('G0 X0 Y#47', 50, 0, 0),      // a PARAMETRIC body — the case a re-pointed pattern would hit
            literal: translateProgram('G0 X0 Y10', 50, 0, 0),    // …and the literal kernel's coordinate list, which still shifts
        };
    });
    expect(r.atomAbsorbs, 'the atom alone under a place absorbs its placement').toBe(true);
    expect(r.arrayAbsorbs, '⚠ an ARRAY does not — so a placed pattern falls through to the text rewrite').toBe(false);
    // ⚠ the parametric body is REFUSED and comes back UNSHIFTED — the placement silently dropped
    expect(r.para.refused, 'a parametric body is refused rather than half-shifted (t1353)').toBeTruthy();
    expect(r.para.text, '…and comes back exactly as it went in — the operator\'s placement lost').toBe('G0 X0 Y#47');
    // …while the literal arm's coordinate list takes the shift exactly, as it always has
    expect(r.literal.text, 'the literal kernel still places correctly, which is why it keeps this path').toBe('G0 X50 Y10');
});

/**
 * ── ⚠ THE CANVAS ROUND TRIP — the fork t1490 left open, and this is the act that had to answer it ─────────────────
 *
 * t1490 declared `insetAlong`/`insetAcross` on `surfaceRasterBlock`, the full suite refused it (the iron rule went
 * 11 → 12: a NULLABLE field does not survive the Blockly round trip, and null coming back as 0 would silently drop
 * a caller's single `inset`), and the pair was left EMITTER-ONLY with the reason written down: *"no block instance
 * carries these keys… THE DAY A BLOCK MUST CARRY THEM, the nullable round trip is the thing to fix first."*
 *
 * THIS IS THAT DAY. A re-pointed slot's `surfaceraster` block carries four keys the walk cannot be right without —
 * `bearing` (which way the passes run), `rowAnchor` ('wall', or the channel is not the width that was typed),
 * `insetAlong`/`insetAcross` (a tool radius across, nothing along). If they do not survive Blocks → back, an
 * operator who merely LOOKS at a wide angled slot in the canvas gets it back as an axis-aligned, fit-anchored,
 * isotropically-inset walk. That is not a cosmetic diff; it is a different cut, silently.
 *
 * The iron-rule spec cannot see this — it round-trips each twin at its DEFAULT params, and the slot's defaults are
 * the zero band, so it exercises the LITERAL arm. So the parametric arm is round-tripped here, explicitly.
 */
test('THE ROUND TRIP — a re-pointed slot survives the canvas with its bearing, wall anchor and inset pair intact', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    await page.evaluate(() => window.showApp && window.showApp('blocks'));
    await page.waitForTimeout(2200);
    const r = await page.evaluate(async () => {
        const { slotStack } = await import('/wizards/slotWizard.js');
        const { SLOT_DEFAULTS } = await import('/blocks/dataOps/slotData.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const SB = await import('/blocks/blockly/stackBridge.js');
        const ws = Blockly.getMainWorkspace();
        // a WIDE, ANGLED slot — the arm where all four keys carry meaning
        const p = { ...SLOT_DEFAULTS, width: 16, toolDia: 8, ax: 5, ay: 5, bx: 5 + 60 * Math.cos(Math.PI / 6), by: 5 + 60 * Math.sin(Math.PI / 6), stepoverPct: 35 };
        const stack = slotStack(p);
        const before = String(emitProgram(stack));
        ws.clear();
        SB.stackToWorkspace(stack, ws);
        const back = SB.workspaceToStack(ws);
        const after = String(emitProgram(back));
        const find = (s) => { let hit = null; const walk = (bs) => (bs || []).forEach((b) => { if (b.type === 'surfaceraster') hit = b; walk(b.children); }); walk(s); return hit; };
        const a = find(stack), b = find(back);
        const { rasterInsetOf, rasterRowAnchorOf, rasterBearingOf } = await import('/wizards/ops/surfaceraster.js');
        return {
            nBlocks: ws.getAllBlocks(false).length, sameRef: a === b,
            sameText: before === after,
            sent: a && { ...a.params }, got: b && { ...b.params },
            // what the WALK actually reads back out of the returned block — the resolvers, not the raw keys
            resolved: b && { inset: rasterInsetOf(b.params), anchor: rasterRowAnchorOf(b.params), bearing: rasterBearingOf(b.params) },
        };
    });
    // ⚠ NOT A VACUOUS ROUND TRIP: real blocks were built on the canvas and a DIFFERENT object came back.
    expect(r.nBlocks, 'the stack really was rendered as Blockly blocks').toBeGreaterThan(10);
    expect(r.sameRef, 'and the block that came back is a NEW object, not the one that went in').toBe(false);
    expect(r.sent, 'the slot really did build a parametric body to round-trip').toBeTruthy();
    expect(r.got, 'and it came back as one').toBeTruthy();
    // ⚠ THE FOUR KEYS, NAMED. A text compare alone would pass the day one of them defaulted to something that happens
    // to emit the same header, so each is asserted as the value that was sent — and then as what the WALK resolves.
    expect(r.got.bearing, 'the BEARING survives — else the passes come back running due east').toBeCloseTo(r.sent.bearing, 9);
    expect(r.got.rowAnchor, 'the WALL anchor survives — else the channel is not the width that was typed').toBe('wall');
    expect(r.got.insetAlong, 'the ALONG inset survives as a real 0 — the tool centre runs the full centreline').toBe(0);
    expect(r.got.insetAcross, 'the ACROSS inset survives — a tool radius held off each wall').toBeCloseTo(r.sent.insetAcross, 9);
    /**
     * ⚠ AND THE PAIR MUST WIN OVER THE SINGLE `inset`. The bridge materialises the block's DECLARED fields, so the
     * returned block carries `inset: 0` — a key the slot never set. `rasterInsetOf` only falls back to it when a
     * component is null, so a present pair makes it inert. If that precedence ever flipped, an angled slot would come
     * back walking with NO tool-radius offset across its width: cutting the full typed width with the tool centre on
     * the wall, i.e. a channel one whole tool Ø oversize. Asserted through the resolver rather than by reading keys.
     */
    expect(r.got.inset, 'the bridge really does materialise the single inset the slot never set').toBe(0);
    expect(r.resolved.inset, '…and the PAIR still wins — the walk reads tool/2 across, 0 along').toEqual({ along: 0, across: r.sent.insetAcross });
    expect(r.resolved.anchor, 'the walk still anchors on the wall').toBe('wall');
    expect(r.resolved.bearing, 'and still runs on the slot\'s bearing').toBeCloseTo(30, 6);
    // every key that went in comes back with the same value (the bridge may ADD declared ones; it may not CHANGE any)
    const changed = Object.keys(r.sent).filter((k) => JSON.stringify(r.got[k]) !== JSON.stringify(r.sent[k]));
    expect(changed, `no param the slot declared came back different: ${JSON.stringify(changed.map((k) => [k, r.sent[k], r.got[k]]))}`).toEqual([]);
    expect(r.sameText, 'so the program comes back cutting exactly what it went in cutting').toBe(true);
});

/**
 * ── THE RECONCILER, SWEPT IN THE SAME ACT THAT MOVES THE BLOCK IT READS ───────────────────────────────────────────
 *
 * `RECONCILERS.slot` opened with `find(prog,'slot')`. On the re-pointed arm there is no `slot` block anywhere, so it
 * would have DECLINED and an edited parametric slot would have silently failed to flow back to the form — t1387's
 * named failure mode (a reader that identifies an arm by a block that moved), and the exact defect pocket swept at
 * t1406. Asserted here as the ROUND TRIP an operator actually performs: build → read back → the same slot.
 *
 * The inverse is asserted first, on its own, because "the reader returns something" and "the reader returns the slot
 * that was built" are different claims and only the second one is worth anything.
 */
test('THE INVERSE IS EXACT — forward → back is the identity, at every bearing', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { slotRasterParams, slotFromRasterParams } = await import('/wizards/ops/slot.js');
        const { slotLeafParams } = await import('/wizards/slotWizard.js');
        const out = [];
        for (const ang of [0, 30, 45, 90, -30, 137.5, 180])
            for (const [wid, tool] of [[12, 6], [16, 8], [25, 10]]) {
                const rad = ang * Math.PI / 180;
                const leaf = slotLeafParams({ ax: 5, ay: 7, bx: 5 + 60 * Math.cos(rad), by: 7 + 60 * Math.sin(rad), width: wid, toolDia: tool, depth: 6, stepdown: 2, stepoverPct: 35 });
                const back = slotFromRasterParams(slotRasterParams(leaf));
                const worst = Math.max(...['x0', 'y0', 'x1', 'y1', 'width', 'tool', 'depth', 'stepdown', 'stepoverPct', 'feed', 'plunge', 'clearance'].map((k) => Math.abs(back[k] - leaf[k])));
                out.push({ ang, wid, tool, worst });
            }
        return out;
    });
    expect(r.length, 'swept over bearings × sizes, not one case').toBe(21);
    for (const c of r) {
        expect(c.worst, `bearing ${c.ang}, ${c.wid}×Ø${c.tool}: forward→inverse is the identity`).toBeLessThan(1e-9);
    }
});

test('THE RECONCILER — a re-pointed slot in the real app reads back and REBUILDS as the same slot', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager && window.ddcsGetBlockProgram, null, { timeout: 20000 });
    // drive the REAL wizard: a wide, angled slot — the arm with no `slot` block in its program at all
    await page.evaluate(() => window.ddcsStudio.wizardManager.open('slot'));
    await page.waitForSelector('#wiz_slot', { state: 'visible' });
    const WANT = { sl_ax: 5, sl_ay: 7, sl_bx: 56.96152422706632, sl_by: 37, sl_width: 16, sl_toolDia: 8, sl_depth: 6, sl_stepdown: 2, sl_stepoverPct: 35 };
    await page.evaluate((W) => {
        for (const [id, v] of Object.entries(W)) { const e = document.getElementById(id); if (e) { e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); } }
        window.ddcsStudio.wizardManager.update();
    }, WANT);
    await page.waitForTimeout(400);
    await page.evaluate(() => window.ddcsStudio.wizardManager.insert && window.ddcsStudio.wizardManager.insert());
    await page.waitForTimeout(400);

    const r = await page.evaluate(async () => {
        const { replayReconcile } = await import('/blocks/opSession.js');
        const prog = window.ddcsGetBlockProgram() || [];
        const op = prog.find((b) => b && b.type === 'op' && b.opType === 'slot');
        const has = (arr, t) => (arr || []).some((b) => b && (b.type === t || has(b.children, t)));
        const rebuilt = op ? replayReconcile(op.id) : null;
        return {
            foundOp: !!op,
            isParametric: op ? has([op], 'surfaceraster') : null,
            hasLiteralLeaf: op ? has([op], 'slot') : null,
            rebuiltParametric: rebuilt ? has(rebuilt, 'surfaceraster') : null,
            // what the rebuild came out as — compared against the atom the form built, socket for socket
            sent: (() => { let hit = null; const walk = (bs) => (bs || []).forEach((b) => { if (b.type === 'surfaceraster') hit = b; walk(b.children); }); walk([op]); return hit && { ...hit.params }; })(),
            got: (() => { let hit = null; const walk = (bs) => (bs || []).forEach((b) => { if (b.type === 'surfaceraster') hit = b; walk(b.children); }); walk(rebuilt || []); return hit && { ...hit.params }; })(),
        };
    });

    expect(r.foundOp, 'the wizard really inserted a slot op').toBe(true);
    // ⚠ the premise of the whole test: this program has NO `slot` block for the old reader to find
    expect(r.isParametric, 'and it is on the re-pointed arm').toBe(true);
    expect(r.hasLiteralLeaf, '…with no literal slot leaf anywhere in it — which is what the old reader looked for').toBe(false);
    expect(r.rebuiltParametric, 'the reconciler READ it and the rebuild came back parametric (it used to decline)').toBe(true);
    // and the rebuild is the SAME slot, socket for socket — a reader that returns "a slot" is not the claim
    const drift = Object.keys(r.sent).filter((k) => Math.abs(Number(r.sent[k]) - Number(r.got[k])) > 1e-6 && String(r.sent[k]) !== String(r.got[k]));
    expect(drift, `the rebuilt atom matches the built one: ${JSON.stringify(drift.map((k) => [k, r.sent[k], r.got[k]]))}`).toEqual([]);
    expect(r.got.bearing, 'the bearing survived the read-back — the endpoint pair reconstructed it').toBeCloseTo(30, 6);
});

/**
 * ── THE ARC'S DECLARED ROWS, KEPT HONEST ──────────────────────────────────────────────────────────────────────────
 *
 * `slotCapabilityArc.js` is the design the build acts read, and its own rule (the `landed` shape C4 introduced) is
 * that a row whose premise has been overtaken must SAY so. Two things were overtaken here: the CAM-inheritance rows
 * were written as if one event lifted both the wizard and the CAM gate, and the arc's gate inventory was two short.
 * Asserted against the REAL code — the gate really does still refuse, and the four boundaries really are declared —
 * so the record cannot rot into a claim nobody re-checked.
 */
test('THE ARC RECORDS THE RE-POINT — the wizard delegates, the CAM gate does NOT, and three gates are named', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const arc = await import('/data/slotCapabilityArc.js');
        const slot = await import('/wizards/ops/slot.js');
        const wiz = await import('/wizards/slotWizard.js');
        const camSrc = await (await fetch('/data/opCamMap.js')).text();
        const base = { x0: 0, y0: 0, x1: 60, y1: 0, width: 14, tool: 6, stepoverPct: 40, depth: 3, stepdown: 1.5, entry: 'plunge', rampAngle: 3, feed: 2000, plunge: 150, clearance: 5 };
        return {
            landed: arc.SLOT_REPOINT_LANDED,
            // the four gates, each asked of the code rather than read off the prose
            gapZero: slot.slotRasterArmGap({ ...base, width: 6 }),
            gapHelix: slot.slotRasterArmGap({ ...base, entry: 'helix' }),
            gapRamp: slot.slotRasterArmGap({ ...base, entry: 'ramp', depth: 4, stepdown: 1.5 }),   // t1506 — retired: '' now
            rampDeclGone: slot.SLOT_RAMP_PARTIAL_GAP === undefined,
            gapPattern: wiz.slotStackArmGap({ ax: 0, ay: 0, bx: 60, by: 0, width: 14, toolDia: 6, pattern: 'grid', cols: 2, rows: 2 }),
            camStillRefusesWide: /width[^\n]*>[^\n]*toolDia/.test(camSrc),
        };
    });
    expect(r.landed.wizard, 'the arc records the wizard-side delegation as SHIPPED').toMatch(/SHIPPED at t1500/);
    expect(r.landed.wizard, '…including WHY the twin had to convert with it').toMatch(/SUPERSET twin/);
    expect(r.landed.camGate, 'and records the CAM gate as deliberately NOT lifted').toMatch(/NOT LIFTED/);
    expect(r.camStillRefusesWide, '…which is true of the real gate, not just of the note').toBe(true);
    // THREE gates, each answering in its own words — the arc inventoried two, t1498 found a fourth, t1506 retired it
    expect(r.landed.gates, 'the arc names THREE gates now').toMatch(/THREE as of t1506/);
    expect(r.landed.gates, '…and records that the fourth RETIRED rather than quietly dropping it').toMatch(/RETIRED|retired/);
    expect(r.gapZero).toMatch(/ZERO band/);
    expect(r.gapHelix).toMatch(/ENTRY END/);
    expect(r.gapPattern).toMatch(/PATTERNED slot/);
    // ⚠ the retired one, asserted as retired: the declaration is GONE and the config it refused now rides
    expect(r.rampDeclGone, 'SLOT_RAMP_PARTIAL_GAP is gone, not merely unreferenced').toBe(true);
    expect(r.gapRamp, 'and a ramp over a partial last bite — the shipped defaults — rides the atom').toBe('');
});

/**
 * ── ⚠ THE LABEL COLLISION — the defect the re-point made reachable, and the reason it was found at all ────────────
 *
 * The atom DECLARES the flow labels it will write (`flowLabels`) and `uniquifyFlowLabels` assigns them per PROGRAM,
 * so no two bodies collide — the mechanism t1408 built after measuring a drill op beside a surfacing op both writing
 * `N91`/`N92`, the second silently not executing.
 *
 * That declaration asked `p.inset`. The BODY asks the RESOLVED PAIR (`rasterInsetAxes`). Identical for every caller
 * that passes ONE scalar inset — which was every caller in existence — and DIFFERENT for a caller that passes
 * `insetAlong`/`insetAcross` with no scalar, which is exactly what a slot passes (0 along, tool/2 across). So the
 * body emitted the collapsed-inset refusal pair while the declaration withheld it, no numbers were reserved, and the
 * pair fell back to the legacy 95/96 that the ROW walk had already been given.
 *
 * MEASURED before the fix on a 30° 16mm slot: `N95` and `N96` each appeared TWICE, `IF #40 <= 0 GOTO95` ("refuse")
 * landed inside the row walk, and the traced program cut ONE depth level of six. Ambiguous on the controller exactly
 * as in the sim. It is asserted here as a PROPERTY over the domain — no program may contain a duplicate label —
 * rather than as the one config that exposed it.
 */
test('THE LABELS ARE UNIQUE — no re-pointed slot writes the same flow label twice', async ({ page }) => {
    test.setTimeout(120000);
    await boot(page);
    const r = await page.evaluate(async () => {
        const { slotStack, slotStackRidesRaster } = await import('/wizards/slotWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const NL = String.fromCharCode(10);
        const bad = []; let checked = 0, para = 0;
        for (const ang of [0, 30, 45, 90, -30, 137.5])
            for (const wid of [10, 14, 16, 24])
                for (const tool of [6, 8])
                    for (const entry of ['plunge', 'ramp'])
                        for (const [depth, stepdown] of [[3, 1.5], [6, 2]]) {
                            const rad = ang * Math.PI / 180;
                            const p = { ax: 5, ay: 7, bx: 5 + 60 * Math.cos(rad), by: 7 + 60 * Math.sin(rad), width: wid, toolDia: tool, depth, stepdown, stepoverPct: 35, entry, rampAngle: 3, feed: 2000, plunge: 150, clearance: 5, optIn: true };
                            checked++;
                            if (slotStackRidesRaster(p)) para++;
                            const text = emitMapped(slotStack(p)).text;
                            const labels = text.split(NL).filter((l) => /^\s*N\d+\s*$/.test(l)).map((l) => l.trim());
                            const dupes = labels.filter((l, i) => labels.indexOf(l) !== i);
                            // every GOTO must have exactly one landing site
                            const gotos = [...new Set((text.match(/GOTO\s*(\d+)/g) || []).map((g) => 'N' + g.replace(/\D/g, '')))];
                            const orphan = gotos.filter((g) => labels.indexOf(g) < 0);
                            if (dupes.length || orphan.length) bad.push({ ang, wid, tool, entry, depth, dupes, orphan });
                        }
        // …and the one that exposed it, traced end to end: the whole depth walk, not one level
        const p = { ax: 5, ay: 7, bx: 5 + 60 * Math.cos(Math.PI / 6), by: 7 + 60 * Math.sin(Math.PI / 6), width: 16, toolDia: 8, depth: 6, stepdown: 2, stepoverPct: 35, feed: 2000, plunge: 150, clearance: 5, optIn: true };
        const t = traceToolpath(emitMapped(slotStack(p)).text);
        const cut = (t.segments || []).filter((s) => !s.rapid);
        return { checked, para, bad, cut: cut.length, minZ: cut.length ? Math.min(...cut.map((s) => Math.min(s.z1, s.z2))) : null };
    });
    expect(r.checked, 'swept the domain, not one config').toBeGreaterThan(150);
    expect(r.para, 'and a real slice of it is on the parametric arm — the only arm that writes flow labels').toBeGreaterThan(50);
    expect(r.bad, `every emitted program has unique labels and no orphan GOTO: ${JSON.stringify(r.bad.slice(0, 3))}`).toEqual([]);
    // ⚠ the REAL SYMPTOM, not just the label text: before the fix this cut 2 segments to −2mm of a 6mm slot
    expect(r.cut, 'the 30° 16mm slot traces its whole walk (it stopped at 2 moves before the fix)').toBeGreaterThan(20);
    expect(r.minZ, '…all the way to the asked depth (it reached only −2 of −6 before the fix)').toBeCloseTo(-6, 6);
});

/**
 * ── THE PAYOFF SHOT — the ANGLED WIDE SLOT, mid-play, cut by the parametric atom ──────────────────────────────────
 *
 * This is what the whole capability arc was for: C2 gave the walk a two-axis inset, C1 anchored its rows on the wall,
 * C3 turned it onto the slot's own bearing, C4 gave the descent a declared run vector — and t1500 pointed the slot at
 * it. A 30° 16mm channel that used to be an unrolled coordinate list is now a macro with live registers, and the
 * passes run ALONG the slot rather than along X.
 *
 * The whole wizard surface is captured, not just the viewport: a re-point that emits correctly while the form or the
 * preview reads wrong is not a landed feature.
 */
test.describe('the payoff shot', () => {
// the arc's headline capture is a DESKTOP surface — the two-pane wizard (form left, 3D right) is what a reviewer
// eyeballs, and the default suite viewport is a phone.
test.use({ viewport: { width: 1400, height: 950 } });
test('THE PAYOFF — the angled wide slot, captured mid-play on the parametric arm', async ({ page }) => {
    test.setTimeout(90000);
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager, null, { timeout: 20000 });
    await page.evaluate(() => window.ddcsStudio.wizardManager.open('slot'));
    await page.waitForSelector('#wiz_slot', { state: 'visible' });
    await page.evaluate(() => {
        const set = (id, v) => { const e = document.getElementById(id); if (e) { e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); } };
        set('sl_ax', 5); set('sl_ay', 7);
        set('sl_bx', (5 + 60 * Math.cos(Math.PI / 6)).toFixed(3)); set('sl_by', (7 + 60 * Math.sin(Math.PI / 6)).toFixed(3));
        set('sl_width', 16); set('sl_toolDia', 8); set('sl_depth', 6); set('sl_stepdown', 2); set('sl_stepoverPct', 35);
        window.ddcsStudio.wizardManager.update();
    });
    await page.waitForTimeout(800);

    // ⚠ the shot must be OF the re-pointed arm — assert it before spending a screenshot on it
    // ⚠ NOT read off `#editor` — that is empty until the operator INSERTS, so a first cut of this asserted against a
    // blank string and failed for a reason that had nothing to do with the slot. `slotStack` is the wizard's own one
    // source for the preview, so asking it is asking what is on screen.
    const state = await page.evaluate(async () => {
        const { slotStack, slotStackRidesRaster } = await import('/wizards/slotWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const p = { ax: 5, ay: 7, bx: 5 + 60 * Math.cos(Math.PI / 6), by: 7 + 60 * Math.sin(Math.PI / 6), width: 16, toolDia: 8, depth: 6, stepdown: 2, stepoverPct: 35, feed: 2000, plunge: 150, clearance: 5, optIn: true };
        const text = emitMapped(slotStack(p)).text;
        return { rides: slotStackRidesRaster(p), hasRegs: /#4[0-9]\s*=/.test(text), hasGoto: /GOTO/.test(text) };
    });
    expect(state.rides, 'the captured config really is on the parametric arm').toBe(true);

    const box = await page.locator('#wiz_slot').boundingBox();
    if (box) await page.screenshot({ path: 'scratchpad/slot_repoint_1500_form.png', clip: box });

    /**
     * ⚠ THE MID-PLAY FRAME IS STAGED, NOT RACED, and the two failed attempts are worth recording because both looked
     * like a broken sim and neither was. The wizard AUTO-RUNS on update: the first cut clicked Run — which was
     * already `on` — so the click STOPPED the animation and the test then asserted nothing had moved (true, and
     * entirely self-inflicted). The second only clicked when idle, by which time the run had already FINISHED, so the
     * listener attached to a completed animation. Racing a live animation for a screenshot is the wrong instrument.
     *
     * `seekLine` is the right one: it puts the head at a CHOSEN line deterministically, which is both a better shot
     * and a stronger check — the head must land somewhere genuinely mid-path, and the traced path must have the many
     * passes a 16mm channel at 35% stepover implies rather than the handful a broken walk would leave.
     */
    const sim = await page.evaluate(async () => {
        const el = document.querySelector('.wiz-viz3d');
        const p = el && el.__panel;
        if (!p || !p.getSegments) return null;
        if (p.stop) p.stop();
        const segs = p.getSegments() || [];
        const cut = segs.filter((s) => !s.rapid);
        const start = p.getStartPos ? p.getStartPos() : null;
        // park the head mid-programme so the capture shows a cut in progress
        const lines = (document.getElementById('editor') || {}).value || '';
        const mid = Math.floor(lines.split('\n').length / 2);
        if (p.seekLine) p.seekLine(mid);
        await new Promise((r) => setTimeout(r, 400));
        return {
            nSegs: segs.length, nCut: cut.length, midLine: mid,
            // the traced channel's own extent — a walk that collapsed would show up here as a degenerate box
            span: cut.length ? {
                dx: +(Math.max(...cut.map((s) => s.x2)) - Math.min(...cut.map((s) => s.x1))).toFixed(2),
                dy: +(Math.max(...cut.map((s) => s.y2)) - Math.min(...cut.map((s) => s.y1))).toFixed(2),
                dz: +(Math.min(...cut.map((s) => Math.min(s.z1, s.z2)))).toFixed(2),
            } : null,
            start,
        };
    });
    if (box) await page.screenshot({ path: 'scratchpad/slot_repoint_1500_midplay.png', clip: box });
    await page.screenshot({ path: 'scratchpad/slot_repoint_1500_desktop.png' });

    // the shots are evidence, not the assertion — but a frame of a dead or degenerate sim proves nothing, so the
    // traced path IS asserted: real cutting motion, spanning the angled channel, down to the asked depth.
    expect(sim, 'the 3D panel exposes its traced path').toBeTruthy();
    expect(sim.nCut, 'the sim traced real cutting motion for the re-pointed slot').toBeGreaterThan(20);
    expect(sim.span.dz, 'and it cut down to the asked depth (6mm)').toBeCloseTo(-6, 1);
    // a 30° slot 60mm long: the channel spans roughly 60·cos30 in X and 60·sin30 in Y, plus the width across
    expect(sim.span.dx, 'the traced channel runs the slot\'s length in X…').toBeGreaterThan(45);
    expect(sim.span.dy, '…and its rise in Y — the passes really do run on the bearing, not along X').toBeGreaterThan(25);
    expect(state.hasRegs && state.hasGoto, 'and the previewed program is the parametric one').toBe(true);
});
});

/**
 * ── THE ARM IS LIVE, NOT BAKED — the derived sockets track the operator's numbers ──────────────────────────────────
 *
 * The superset template is frozen at SLOT_DEFAULTS (a 60mm due-east slot at width 6). `instantiate` re-runs
 * `deriveGuards` → `pruneGuards` → `bindingSpecs` → `postInstantiate` on EVERY build, so a twin built at other
 * numbers must carry THOSE numbers. A twin that silently cut the template's default slot would still be
 * byte-identical to nothing at all, so this is asserted against the DECLARED geometry rather than against the form.
 */
test('THE DERIVED SOCKETS ARE LIVE — a twin built at new geometry carries it, on both arms', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { slotDataDef, SLOT_DEFAULTS, SLOT_DATA_OPTYPE } = await import('/blocks/dataOps/slotData.js');
        const { registerUserOp, flattenBlocks } = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { slotRasterParams } = await import('/wizards/ops/slot.js');
        const { slotLeafParams } = await import('/wizards/slotWizard.js');
        registerUserOp(slotDataDef());
        const build = builderOf(SLOT_DATA_OPTYPE);
        const one = (o) => { const p = { ...SLOT_DEFAULTS, ...o }; const f = flattenBlocks(build(p)); return { p, atom: f.find((b) => b.type === 'surfaceraster'), leaf: f.find((b) => b.type === 'slot') }; };
        // a 30° angled, width-16 slot on the PARAMETRIC arm
        const para = one({ width: 16, ax: 5, ay: 5, bx: 5 + 60 * Math.cos(Math.PI / 6), by: 5 + 60 * Math.sin(Math.PI / 6), toolDia: 8, depth: 6, stepdown: 2 });
        // …and a HELIX slot of the same geometry, which the gate routes LITERAL
        const lit = one({ width: 16, ax: 5, ay: 5, bx: 65, by: 5, entry: 'helix', depth: 6, stepdown: 2 });
        const want = slotRasterParams(slotLeafParams(para.p));
        return {
            hasAtom: !!para.atom, hasLeaf: !!lit.leaf,
            got: para.atom && { x: +para.atom.params.x.toFixed(6), y: +para.atom.params.y.toFixed(6), w: +para.atom.params.w.toFixed(6), h: para.atom.params.h, bearing: +para.atom.params.bearing.toFixed(6), toolDia: para.atom.params.toolDia, depth: para.atom.params.depth, stepdown: para.atom.params.stepdown, insetAcross: para.atom.params.insetAcross, rowAnchor: para.atom.params.rowAnchor },
            want: { x: +want.x.toFixed(6), y: +want.y.toFixed(6), w: +want.w.toFixed(6), h: want.h, bearing: +want.bearing.toFixed(6), toolDia: want.toolDia, depth: want.depth, stepdown: want.stepdown, insetAcross: want.insetAcross, rowAnchor: want.rowAnchor },
            litLeaf: lit.leaf && { x0: lit.leaf.params.x0, y0: lit.leaf.params.y0, x1: lit.leaf.params.x1, width: lit.leaf.params.width, depth: lit.leaf.params.depth },
        };
    });
    expect(r.hasAtom, 'the parametric arm pruned to the atom').toBe(true);
    // ⚠ against slotRasterParams — the DECLARATION — not against the other builder: two paths agreeing on a wrong
    // number is exactly what an equivalence sweep cannot see.
    expect(r.got, 'the atom carries the RESOLVED geometry, not the template default').toEqual(r.want);
    expect(r.got.bearing, 'a 30° slot really does bear 30 — the template default is 0').toBeCloseTo(30, 6);
    expect(r.hasLeaf, 'the refused arm pruned to the literal leaf').toBe(true);
    expect(r.litLeaf, 'and IT carries the resolved geometry too').toEqual({ x0: 5, y0: 5, x1: 65, width: 16, depth: 6 });
});

/**
 * ── t1506 — THE PAYOFF OF THE RETIRED GATE, DRIVEN IN THE REAL APP ────────────────────────────────────────────────
 *
 * The whole point of converging the slot kernel on the family's nominal descent was that the slot wizard's OWN
 * DEFAULTS — depth 4 at stepdown 1.5, which end on a partial 1.0mm bite — stopped being refused. Asserted through
 * the real wizard rather than through the predicate, because "the gate returns ''" and "the operator's default slot
 * now cuts a parametric program" are different claims and only the second one is the feature.
 */
test('THE DEFAULT RAMPING SLOT IS PARAMETRIC — driven in the real form, at the shipped defaults', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz && window.ddcsGetBlockProgram, null, { timeout: 20000 });
    /**
     * ⚠ DRIVEN ON THE TWIN'S FORM, and that is not a convenience. The BUILT-IN slot form has no depth-entry control
     * at all (`grep id="sl_` finds no `sl_entry`): the entry cluster was added at t842 as BINDINGS, so the surface an
     * operator actually picks "Ramp" on is `Slot (data)`. Driving the built-in form here would have set nothing and
     * passed for the wrong reason — the first cut of this test did exactly that.
     */
    await page.evaluate(() => window.openWiz('user_slot_data'));
    await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz; });
    // ONLY two edits away from the shipped defaults: a width the tool can clear, and the RAMP entry. Depth 4 and
    // stepdown 1.5 are left exactly as the wizard ships them — they are the partial-bite case the gate refused.
    await page.evaluate(() => {
        const form = document.getElementById('wiz_user_form');
        const set = (param, v) => {
            const e = form.querySelector(`[data-param="${param}"]`);
            if (!e) return false;
            e.value = String(v);
            e.dispatchEvent(new Event('input', { bubbles: true }));
            e.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        };
        window.__set = { width: set('width', 14), entry: set('entry', 'ramp') };
    });
    await page.waitForTimeout(600);

    const r = await page.evaluate(async () => {
        const { SLOT_DEFAULTS, SLOT_DATA_OPTYPE } = await import('/blocks/dataOps/slotData.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { flattenBlocks } = await import('/blocks/userOps.js');
        const form = document.getElementById('wiz_user_form');
        const read = (param) => { const e = form.querySelector(`[data-param="${param}"]`); return e ? e.value : null; };
        // build through the REGISTERED twin at exactly what the form now holds
        const p = { ...SLOT_DEFAULTS, width: Number(read('width')), entry: read('entry') };
        const types = flattenBlocks(builderOf(SLOT_DATA_OPTYPE)(p)).map((b) => b.type);
        return {
            set: window.__set,
            shippedDepth: SLOT_DEFAULTS.depth, shippedStepdown: SLOT_DEFAULTS.stepdown,
            formEntry: read('entry'), formWidth: read('width'),
            formDepth: read('depth'), formStepdown: read('stepdown'),
            parametric: types.includes('surfaceraster'), literal: types.includes('slot'),
        };
    });

    expect(r.set, 'both controls exist on the form and were set').toEqual({ width: true, entry: true });
    // the defaults really are the partial-bite case — if they ever change, this test should say so rather than drift
    expect(r.shippedDepth, 'the wizard still ships depth 4').toBe(4);
    expect(r.shippedStepdown, '…at stepdown 1.5, so the last bite is a partial 1.0mm').toBe(1.5);
    // …and the form is still sitting on those defaults; only width and entry were touched
    expect(Number(r.formDepth), 'the form still holds the shipped depth').toBe(4);
    expect(Number(r.formStepdown), '…and the shipped stepdown').toBe(1.5);
    expect(r.formEntry, 'with a RAMP entry — the descent the old third gate refused').toBe('ramp');
    expect(r.parametric, 'THE PAYOFF: the default ramping slot now cuts the PARAMETRIC atom').toBe(true);
    expect(r.literal, '…and carries no literal slot leaf at all').toBe(false);
});
