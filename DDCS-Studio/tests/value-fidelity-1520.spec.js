import { test, expect } from '@playwright/test';

/**
 * t1520 — THE VALUE-FIDELITY ELEVEN, TAKEN TO THEIR ROOT CAUSES.
 *
 * The iron-rule sweep (roundtrip-whole-program-1319.spec.js) pinned ELEVEN ops whose TEXT changed across the
 * wizard → blocks → wizard round trip. No block was ever lost — the structure survived and the VALUES did not.
 * Measured op by op and then param by param, the eleven turned out to be THREE causes, and all three were
 * closable at the source. What each cause actually did to a program:
 *
 *  1. AN ENUM VOCABULARY COLLISION (six of the eleven). The Blockly bridge resolved a dropdown's options from a
 *     GLOBAL table keyed by BARE FIELD NAME, so one field name meant one enum across the whole registry. Field
 *     names collide: `dir` is the spindle's cw/ccw on progstart, but the stylus-compensation SIGN (+/-) on
 *     radiuscomp and the probe TRAVEL sign on probecheck; `pattern`/`cycle` name a wider vocabulary on holecycle
 *     than on the array block. A value outside a dropdown's options CANNOT BE HELD BY THE FIELD — Blockly keeps
 *     option[0] — so the canvas silently rewrote `-` to `cw` (which the emit reads as `+`) and `single` to `grid`.
 *     A probed surface came back on the WRONG SIDE of the trigger by twice the stylus radius, and a one-hole
 *     drill came back a six-hole grid. CLOSED by letting the atom DECLARE its own vocabulary (`selects`), read
 *     before the shared table — see the invariant test below, which is the check that would have caught all six.
 *
 *  2. A NUMERIC SOCKET CANNOT SAY "ABSENT" (four of the eleven, five occurrences). `confirm.mode` is an ENUM
 *     (`#1505=<mode>`: 1 = OK/Cancel, 3 = binary) that was declared as a NUMBER, so every caller that omitted it
 *     — the ATC and rotary confirms, all wanting the declared default 1 — had it materialised on the canvas as
 *     the math_number shadow's `Number(undefined) || 0`. The operator gate came home reading `#1505=0`, which is
 *     the value ESC writes to CANCEL. CLOSED by declaring the vocabulary it always had: a CHOICE takes its atom's
 *     default when absent (t1319's rule), so the 1 comes back for free and mode=7 stops being representable.
 *
 *  3. AN EMPTY STRING IS A VALUE (one of the eleven). `isAbsent` folded '' in with undefined — right for a
 *     dropdown (no empty state, so '' can only mean "nothing was said"), wrong for free TEXT. comm declares an
 *     empty operator message; the canvas handed back the `message` atom's own default, so the program came home
 *     saying "check setup" where the op had deliberately said nothing.
 *
 * THE COUNT WENT 11 → 0, and it went there BY CLOSING CAUSES: no assert was widened, no tolerance loosened. The
 * proof that the fix is confined to the ROUND TRIP is that all 32 registered ops emit BYTE-IDENTICALLY to the
 * pre-change tree (measured against a clean origin/main worktree) — the wizards were never wrong, the canvas was.
 */
test.use({ viewport: { width: 1400, height: 950 } });

const inBlocks = async (page) => {
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    await page.evaluate(() => window.showApp && window.showApp('blocks'));
    await page.waitForTimeout(2200);
};

/** Build an op from its declared defaults, run it through the canvas, hand back BOTH emits. */
const roundTrip = async (page, opType) => page.evaluate(async (type) => {
    const uo = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitProgram } = await import('/blocks/blockEmitter.js');
    const SB = await import('/blocks/blockly/stackBridge.js');
    const ws = Blockly.getMainWorkspace();
    const def = uo.listUserOps().find((d) => d.opType === type);
    const stack = builderOf(type)(uo.defaultParams(def));
    const before = String(emitProgram(stack));
    ws.clear();
    SB.stackToWorkspace(stack, ws);
    const after = String(emitProgram(SB.workspaceToStack(ws)));
    return { before, after };
}, opType);

test('THE INVARIANT — no dropdown may fail to represent its own atom\'s default', async ({ page }) => {
    await inBlocks(page);
    const r = await page.evaluate(async () => {
        const { PALETTE } = await import('/wizards/ops/index.js');
        const BR = await import('/blocks/blockly/bridge.js');
        const bad = [], drops = [];
        for (const def of PALETTE) for (const f of BR.fieldsOf(def)) {
            if (BR.fieldKind(def, f) !== 'dropdown') continue;
            const opts = (BR.fieldOptions(def, f) || []).map((o) => (Array.isArray(o) ? o[1] : o));
            drops.push(`${def.type}.${f}`);
            const d = def.defaults[f];
            if (d !== undefined && !opts.includes(String(d))) bad.push({ atom: def.type, field: f, default: d, options: opts });
        }
        return { bad, n: drops.length };
    });
    // NOT VACUOUS: the registry really does present dozens of dropdowns to this check. Before the fix this same
    // sweep named five — holecycle.pattern, radiuscomp.dir, probecheck.dir, setworkoffset.wcs, wcswrite.wcs.
    expect(r.n, 'the whole registry\'s dropdowns were swept').toBeGreaterThan(70);
    // A dropdown that cannot hold the value its own atom declares is a SILENT REWRITE waiting to happen: Blockly
    // keeps option[0], so the block loads reading something the op never said. This is the general form of cause 1.
    expect(r.bad, `these atoms declare a default their own dropdown cannot represent: ${JSON.stringify(r.bad)}`).toEqual([]);
});

test('THE DECLARED VOCABULARY WINS over the shared by-name table', async ({ page }) => {
    await inBlocks(page);
    const r = await page.evaluate(async () => {
        const { BLOCKS } = await import('/wizards/ops/index.js');
        const BR = await import('/blocks/blockly/bridge.js');
        const opts = (t, f) => (BR.fieldOptions(BLOCKS[t], f) || []).map((o) => (Array.isArray(o) ? o[1] : o));
        return {
            radiuscompDir: opts('radiuscomp', 'dir'),
            probecheckDir: opts('probecheck', 'dir'),
            spindleDir: opts('spindle', 'dir'),
            pattern: opts('holecycle', 'pattern'),
            cycle: opts('holecycle', 'cycle'),
            confirmMode: opts('confirm', 'mode'),
        };
    });
    // The SAME field name, two atoms, two vocabularies — which is the fact the global table could not express.
    expect(r.radiuscompDir, 'radiuscomp\'s dir is a SIGN').toEqual(['+', '-']);
    expect(r.probecheckDir, 'probecheck\'s dir is a travel sign too').toEqual(['+', '-']);
    expect(r.spindleDir, 'and the spindle\'s dir is UNTOUCHED — the shared table still serves every atom that never declares').toEqual(['cw', 'ccw']);
    // holecycle's own five patterns (the array block's four have no `single`) and its own three cycles.
    expect(r.pattern, 'holecycle patterns, `single` included').toEqual(['single', 'grid', 'line', 'circle', 'rect']);
    expect(r.cycle, 'holecycle cycles — the two bore ramps are not the canned-cycle words').toEqual(['peck', 'bore-step', 'bore-helix']);
    expect(r.confirmMode, 'the prompt mode is the dialect\'s two, not a free number').toEqual(['1', '3']);
});

test('CAUSE 1 — the stylus-radius SIGN survives the canvas, both walls of it', async ({ page }) => {
    await inBlocks(page);
    const r = await roundTrip(page, 'user_middle_data');
    // THE INDEPENDENT TRUTH, and why this op is the one to drive: a middle probe measures BOTH walls, so it emits
    // one comped line each way. The bug made them AGREE (`+` twice) — a pocket centre computed from two surfaces
    // pushed the same direction is wrong by a stylus diameter, and nothing in the text looks broken. The pair
    // disagreeing IS the property; asserting the round trip merely matched itself would have passed while wrong.
    expect(r.after, 'the first wall compensates ONE way').toContain('#51=[#1925+#6]');
    expect(r.after, 'and the opposite wall the OTHER way — the sign is the measurement').toContain('#52=[#1925-#6]');
    expect(r.before, 'the wizard always emitted the pair correctly; the canvas is what lost it').toContain('#52=[#1925-#6]');
    expect(r.after === r.before, 'and the whole op is byte-identical through the canvas').toBe(true);
});

test('CAUSE 1 — a ONE-HOLE drill does not come back a six-hole grid, and a BORE stays a bore', async ({ page }) => {
    await inBlocks(page);
    const drill = await roundTrip(page, 'user_drill_data');
    const bore = await roundTrip(page, 'user_bore_data');
    // The pattern word is load-bearing: `single` is not in the array block's list, so the canvas rewrote it to
    // `grid` and the program came back drilling SIX holes on a 20mm pitch that the operator never asked for.
    // t2305 — the header used to nest `(single)` inside the comment's own outer `( … )`, invalid G-code
    // (DDCS closes at the first `)`); fixed at the emitter (holecycle.js) by replacing the nesting with `:`.
    expect(drill.after, 'one hole, single, peck').toContain('DRILL, parametric: 1 hole: single x peck');
    expect(drill.after, 'and the loop walks exactly one').toContain('WHILE [#89 < 1] DO1');
    expect(drill.after, 'byte-identical through the canvas').toBe(drill.before);
    // …and `cycle` the same way: `bore-step` is not one of the canned-cycle words, so a BORE came back a DRILL —
    // a helical/stepped bore replaced by a peck cycle at the bore's feed is a broken part, not a cosmetic diff.
    expect(bore.after, 'still a bore, still stepping').toContain('BORE, parametric: 1 hole: single x bore-step');
    expect(bore.after, 'and it still cuts the full circle a bore is').toContain('( full circle )');
    expect(bore.after, 'byte-identical through the canvas').toBe(bore.before);
});

test('CAUSE 2 — the operator gate comes back ARMED (=1), not pre-cancelled (=0)', async ({ page }) => {
    await inBlocks(page);
    for (const op of ['user_atc_warmup_data', 'user_rotary_clock_data']) {
        const r = await roundTrip(page, op);
        // `#1505=0` is not a harmless zero: 0 is what ESC writes, so the confirm the wizard armed came back reading
        // as ALREADY CANCELLED. Assert the VALUE the dialect defines (1 = OK/Cancel), not merely that it round-tripped.
        expect(r.after, `${op}: the prompt is mode 1`).toMatch(/#1505=1\(/);
        expect(r.after, `${op}: and no gate came back at ESC's cancel value`).not.toMatch(/#1505=0\(/);
        expect(r.after === r.before, `${op}: byte-identical through the canvas`).toBe(true);
    }
});

test('CAUSE 3 — an op that declares an EMPTY message keeps it empty', async ({ page }) => {
    await inBlocks(page);
    const r = await roundTrip(page, 'user_comm_data');
    // comm's own default message is '' (commData COMM_DEFAULTS.msg). The canvas used to substitute the `message`
    // atom's default, so a banner the operator never wrote appeared in their program. Fidelity is not improvement.
    expect(r.after, 'the empty banner stays empty').toContain('#1505=-5000()');
    expect(r.after, 'the atom\'s own default did not leak in').not.toContain('check setup');
    expect(r.after === r.before, 'byte-identical through the canvas').toBe(true);
});
