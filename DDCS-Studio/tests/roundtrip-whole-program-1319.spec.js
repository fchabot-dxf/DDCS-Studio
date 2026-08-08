import { test, expect } from '@playwright/test';

/**
 * t1319 — THE CANVAS KEEPS THE WHOLE PROGRAM.
 *
 * TWO UNRELATED CAUSES, and they are kept apart deliberately — one story must not cover two facts:
 *
 *  1. THE TAIL. An absent boolean/dropdown param was materialised on the block as false / '' instead of the ATOM'S
 *     DEFAULT, so a `progend` authored as `params: {}` came back with spindleOff/coolantOff/retract all false. The
 *     program returned from Blocks LEAVING THE SPINDLE RUNNING — a safety-grade fidelity failure, and the same
 *     family as t1317's axis bug: absence turned into a wrong concrete value.
 *  2. THE REPOSITION. `safetraverse` CARRIES the traverse it bundles, but was declared `kind: 'leaf'` — so the
 *     bridge gave it no mouth and its children never became blocks at all. A corner op came back without the step
 *     that routes the tool AROUND the corner to wall 2.
 */
test.use({ viewport: { width: 1400, height: 950 } });

const inBlocks = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    await page.evaluate(() => window.showApp && window.showApp('blocks'));
    await page.waitForTimeout(2200);
};

test('CAUSE 1 — a program comes back with its TAIL: spindle off, coolant off, the safe retract', async ({ page }) => {
    await inBlocks(page);
    const r = await page.evaluate(async () => {
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const SB = await import('/blocks/blockly/stackBridge.js');
        const ws = Blockly.getMainWorkspace();
        // authored the way a wizard authors it: progend carries NO params, so every one of its defaults applies
        const stack = [
            { type: 'progstart', params: { rpm: 900, clearance: 5 } },
            { type: 'move', params: { mode: 'rapid', x: 5 } },
            { type: 'move', params: { mode: 'cut', x: 20, feed: 300 } },
            { type: 'progend', params: {} },
        ];
        const before = String(emitProgram(stack));
        SB.stackToWorkspace(stack, ws);
        const after = String(emitProgram(SB.workspaceToStack(ws)));
        const moves = (nc) => (traceToolpath(nc).segments || []).map((s) => [+s.x2.toFixed(3), +s.y2.toFixed(3), +s.z2.toFixed(3), !!s.rapid]);
        return { same: before === after, after, movesSame: JSON.stringify(moves(before)) === JSON.stringify(moves(after)) };
    });
    expect(r.after, 'THE SPINDLE IS STOPPED — a program that comes back running is the failure this guards').toContain('M5');
    expect(r.after, 'the coolant too').toContain('M9');
    expect(r.after, 'and the safe retract, which needs its staged variable').toMatch(/#101 = 0[\s\S]*G53 Z#101/);
    expect(r.same, 'byte-identical through the canvas').toBe(true);
    expect(r.movesSame, 'and the sim executes the same moves either way').toBe(true);
});

test('CAUSE 2 — the corner op keeps its REPOSITION step, hand-derived sequence intact', async ({ page }) => {
    await inBlocks(page);
    const r = await page.evaluate(async () => {
        const uo = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const SB = await import('/blocks/blockly/stackBridge.js');
        const ws = Blockly.getMainWorkspace();
        const def = uo.listUserOps().find((d) => d.opType === 'user_corner_data');
        const stack = builderOf('user_corner_data')(uo.defaultParams(def));
        const before = String(emitProgram(stack));
        SB.stackToWorkspace(stack, ws);
        const after = String(emitProgram(SB.workspaceToStack(ws)));
        const lines = after.split(String.fromCharCode(10));
        const i = lines.findIndex((l) => /REPOSITION/.test(l));
        return { same: before === after, hasRepo: i >= 0, seq: lines.slice(i, i + 4) };
    });
    // THE SAFE DOG-LEG: the traverse goes out on ONE axis first, then in on the other — that ordering is what routes
    // the tool AROUND the outside corner instead of diagonally through the stock, and it is what went missing.
    expect(r.hasRepo, 'the reposition step is still in the program').toBe(true);
    expect(r.seq[1], 'travelling out on the first axis').toMatch(/^G0 X#23$/);
    expect(r.seq[2], 'then in on the second — the order IS the safety').toMatch(/^G0 Y#24$/);
    expect(r.same, 'and the whole op is byte-identical through the canvas').toBe(true);
});

test('THE TWO CAUSES ARE SEPARATE — each is declared where its own fact lives', async ({ page }) => {
    await inBlocks(page);
    const r = await page.evaluate(async () => {
        const { BLOCKS } = await import('/wizards/ops/index.js');
        return {
            traverseKind: BLOCKS.safetraverse && BLOCKS.safetraverse.kind,
            moveAbsentable: BLOCKS.move && BLOCKS.move.absentable,
            progendDefaults: BLOCKS.progend && { spindleOff: BLOCKS.progend.defaults.spindleOff, retract: BLOCKS.progend.defaults.retract },
        };
    });
    // cause 2's fix is a DECLARATION on the block that carries children, not a special case in the bridge
    expect(r.traverseKind, 'safetraverse says it carries its traverse').toBe('container');
    // cause 1's fix is the general rule (absent → the atom's default), so progend needs no special-casing at all:
    // its defaults were always right, and now the canvas shows them
    expect(r.progendDefaults, 'progend already declared the tail it emits').toEqual({ spindleOff: true, retract: true });
    // …and t1317's rule is untouched: an axis word's absence is still absence, not a default
    expect(r.moveAbsentable, 'the axes stay absentable — absence there means NO word').toEqual(['x', 'y', 'z', 'a', 'b']);
});

test('AND NOTHING IS LOST FROM ANY OP — the whole registered family round-trips block for block', async ({ page }) => {
    await inBlocks(page);
    const r = await page.evaluate(async () => {
        const uo = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const SB = await import('/blocks/blockly/stackBridge.js');
        const ws = Blockly.getMainWorkspace();
        const flat = (st, out = []) => { for (const x of (st || [])) { out.push(x.type); flat(x.children, out); flat(x.uiChildren, out); } return out; };
        const out = [];
        for (const def of uo.listUserOps()) {
            if (def.hidden) continue;
            let stack;
            try { stack = builderOf(def.opType)(uo.defaultParams(def)); } catch (_) { continue; }
            if (!stack || !stack.length) continue;
            const before = String(emitProgram(stack));
            SB.stackToWorkspace(stack, ws);
            const back = SB.workspaceToStack(ws);
            out.push({ op: def.opType, same: before === String(emitProgram(back)), blocks: flat(stack).length, kept: flat(back).length });
        }
        return out;
    });
    expect(r.length, 'every registered op was tried').toBeGreaterThan(20);
    // THE PROPERTY THIS TURN ESTABLISHES: no op loses a BLOCK. Before the fix, corner lost 4 and middle lost 5 —
    // measured by stashing the change and re-running, which is also what proves this assert is not vacuous.
    const lost = r.filter((x) => x.kept !== x.blocks);
    expect(lost, `no op loses a block on the way through: ${JSON.stringify(lost)}`).toEqual([]);
    // …and CORNER — the op this turn was about — is byte-identical end to end. Middle carries a traverse too and
    // keeps every block now, but its TEXT still differs for a reason of the pre-existing class below; it is counted
    // there rather than claimed here, because the structural loss is what this turn fixed.
    // (t1520 — middle's text difference is CLOSED: it was the stylus-comp sign, cause 1 below. It is byte-identical
    // now, and the count it was counted in is 0. The wording above is left as the record of what this turn owned.)
    const corner = r.find((x) => x.op === 'user_corner_data');
    expect(corner.same, `the corner op round-trips byte-identically: ${JSON.stringify(corner)}`).toBe(true);
    // t1632 — the pin was the literal 63 of the day it was written; b95540d9 (t1111) then grew every registered
    // template with its materialized param_field rows, and those round-trip like any block. The CLAIM ("middle
    // keeps every block") is what matters, so it is asserted as itself rather than as a count that moves with the
    // form: kept == built. (The lost==[] sweep above already holds this for the whole family; this line keeps
    // middle's historical byline without a number to go stale.)
    { const m = r.find((x) => x.op === 'user_middle_data'); expect(m.kept, 'and middle keeps every block, which it did not before').toBe(m.blocks); }
    // A REMAINING, SEPARATE CLASS, counted rather than hidden: some ops still differ in their TEXT across a round
    // trip for reasons that predate this turn (verified by stash: the same ops differ without this change). Nothing
    // is lost — the block counts match — so it is a value-fidelity question, not a structural one. Pinned as a
    // COUNT so it cannot quietly grow, and so the day it is fixed this line is what gets updated.
    //
    // t1377 — MEASURED AGAIN, and the number did not move: still exactly 11, and the SAME eleven (atc warmup/length/
    // check, drill, bore, middle, rotary centre/clock, comm, the two lathe probes). The modal-feed fold learning flow
    // put two F words back into surfacing's emit, and surfacing is NOT in this list either before or after — the
    // round-trip reproduces it byte-for-byte, because gcodeToStack's backfill reads an explicit F as happily as an
    // inherited one. The iron rule holds: the count may only shrink, and it shrank by nothing rather than growing.
    const differs = r.filter((x) => !x.same).map((x) => x.op);
    // t1385 — PRINT THE NUMBER, always. The iron rule is "may only SHRINK from 11", and a rule about a trend is useless if
    // the value is only visible when it breaks: a turn that shrank it had no way to say so, and a turn that left it at the
    // ceiling looked the same as one that fixed something. Logged so the count and its members are in every run's output.
    //
    // ⇩ t1520 — THE CEILING CAME DOWN 11 → 0, AND IT CAME DOWN BY CLOSING CAUSES. Taken one at a time to their root, the
    // eleven were THREE (value-fidelity-1520.spec.js carries each with its own symptom asserted):
    //   · SIX were one enum-vocabulary collision — the bridge resolved a dropdown's options from a table keyed by BARE
    //     FIELD NAME, and a value outside a dropdown's options cannot be held by the field. `-` became `cw` (emit: `+`),
    //     so a probed surface landed on the wrong side of the trigger by twice the stylus radius; `single` became `grid`,
    //     so a one-hole drill came back a six-hole grid. Closed by letting the atom DECLARE its own vocabulary.
    //   · FOUR were `confirm.mode` — an ENUM declared as a NUMBER, so its absence materialised as the shadow's 0, and
    //     the operator gate came home reading `#1505=0`, the value ESC writes to CANCEL. Closed the same way.
    //   · ONE was an explicit '' read as absence, so comm's deliberately-empty banner came back saying "check setup".
    // NOTHING WAS LOOSENED to get here: the assert below TIGHTENED from `<= 11` to `=== 0`, and the proof the change is
    // confined to the CANVAS is that all 32 ops emit byte-identically to the pre-change tree (measured against a clean
    // origin/main worktree — the wizards were never wrong). The rule is unchanged in kind: this may only ever SHRINK,
    // and it is now at the floor, so any regression is a hard red naming the op that broke.
    console.log(`IRON RULE — round-trip text differences: ${differs.length}/0 :: ${JSON.stringify(differs)}`);
    expect(differs, `a round-trip text difference is a REGRESSION now, not a pre-existing class: ${JSON.stringify(differs)}`).toEqual([]);
});
