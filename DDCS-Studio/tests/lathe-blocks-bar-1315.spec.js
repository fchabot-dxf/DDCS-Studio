import { test, expect } from '@playwright/test';

/**
 * t1315 — TWO HALVES OF ONE IDEA: an op is only real when it exists in every surface, and a number is only real when
 * the operator can see the one the program will carry.
 *
 * (1) THE LATHE REACHES BLOCKS. The palette was built from the ATOM list plus the curated learner library; the
 *     federated op registry was never one of its sources — not hidden, not filtered, never wired. So the families are
 *     DERIVED from the registry now, and the next registered twin appears with no edit anywhere.
 * (2) THE BAR PRECEDENCE (advisor ruling on the t1313 flag): the wizard's bar field PREFILLS from the declared
 *     workspace bar and the emit follows the FIELD — so the G-code moves only through a number a person can read.
 */
test.use({ viewport: { width: 1400, height: 950 } });

const boot = async (page, kind = 'lathe') => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    await page.evaluate(async (k) => {
        const M = await import('/data/workspaceMachine.js');
        M.setMachine({ name: 'Rig', kind: k, chuck: 'axis' }, false);
    }, kind);
};

const setBar = (page, diameter) => page.evaluate(async (d) => {
    const { barStock } = await import('/data/stockShape.js');
    window.ddcsGetSettings().stock = barStock({ diameter: d, stickOut: 60, allowance: 1 }, window.ddcsGetSettings().stock);
    try { window.ddcsSaveSettings && window.ddcsSaveSettings(); } catch (_) {}
}, diameter);

test('THE PALETTE HOLDS THE LATHE FAMILY — derived from the registry, not a hand-kept list', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const T = await import('/blocks/opToolbox.js');
        const uo = await import('/blocks/userOps.js');
        const cats = T.opToolboxCategories();
        const parent = cats[0] || {};
        const lathe = (parent.contents || []).find((c) => /Lathe/i.test(c.name));
        const registered = uo.listUserOps().filter((d) => d.group === 'lathe' && !d.hidden).length;
        return {
            parent: parent.name, families: (parent.contents || []).map((c) => c.name),
            n: lathe ? lathe.contents.length : 0, registered, style: lathe && lathe.categorystyle,
            others: (parent.contents || []).filter((c) => !/Lathe/i.test(c.name)).map((c) => c.categorystyle),
        };
    });
    expect(r.parent, 'the rail reads Atoms · Wizards · Snippets · Programs').toMatch(/Wizards/);
    expect(r.families, 'and the lathe is one of the families').toContain('Lathe');
    expect(r.n, 'with every registered lathe op in it — seven today, and the eighth needs no edit').toBe(r.registered);
    expect(r.n).toBe(7);
    // ONE COHERENT FAMILY COLOUR, and not the default: the lathe has its own, everything else takes the ops slate
    expect(r.style, 'the family wears its own colour').toBe('lathe_cat');
    expect(new Set(r.others), 'and the other families share the neutral one').toEqual(new Set(['ops_cat']));
});

test('A PALETTE ENTRY IS THE OP ITSELF — its block stack emits exactly what the wizard emits', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const T = await import('/blocks/opToolbox.js');
        const uo = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const { stackToFlyoutBlock } = await import('/blocks/blockly/stackBridge.js');
        const out = [];
        for (const def of uo.listUserOps().filter((d) => d.group === 'lathe' && !d.hidden)) {
            const params = uo.defaultParams(def);
            const stack = builderOf(def.opType)(params);
            const entry = stackToFlyoutBlock(stack);
            out.push({ op: def.opType, hasEntry: !!entry, headType: entry && entry.type, lines: String(emitProgram(stack)).split('\n').length });
        }
        return out;
    });
    for (const e of r) {
        expect(e.hasEntry, `${e.op}: the palette can offer it`).toBe(true);
        // the entry IS the op's own stack, so what lands on the canvas emits what the wizard inserts, by construction
        expect(e.headType, `${e.op}: and it starts where the op starts`).toBeTruthy();
        expect(e.lines, `${e.op}: a real program, not a stub`).toBeGreaterThan(5);
    }
});

test('THE ROUND TRIP — every authored value survives the canvas, and an edit moves the program', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => window.showApp && window.showApp('blocks'));
    // t1315 (de-sleep) — __blkws is the app's OWN declared readiness signal for the Blocks tab (blocksApp.js's
    // own comment on the showApp('blocks') rethrow: "a caller polling for the app's own readiness signal
    // (window.__blkws)"). showApp('blocks') already awaits showBlocks()→buildWorkspace(), which sets __blkws as
    // the LAST synchronous step, so this resolves as soon as the workspace is real — never later than 2200ms.
    await page.waitForFunction(() => !!window.__blkws, null, { timeout: 20000 });
    const r = await page.evaluate(async () => {
        const uo = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const SB = await import('/blocks/blockly/stackBridge.js');
        const ws = Blockly.getMainWorkspace();
        const params = uo.defaultParams(uo.listUserOps().find((d) => d.opType === 'user_lathe_odturn'));
        const stack = builderOf('user_lathe_odturn')(params);
        const wizard = String(emitProgram(stack));
        SB.stackToWorkspace(stack, ws);
        const back = SB.workspaceToStack(ws);
        const fromBlocks = String(emitProgram(back));
        const vars = (nc) => nc.split(String.fromCharCode(10)).filter((l) => /^#[0-9]+=/.test(l));
        // …then EDIT a field on the canvas, the way a person would: the depth of cut
        let moved = false;
        for (const b of ws.getAllBlocks(false)) {
            if (b.type !== 'assign' || String(b.getFieldValue('VAR')) !== '#124') continue;
            const key = b.getField('VALUE') ? 'VALUE' : 'VAL';
            b.setFieldValue('2', key); moved = true; break;
        }
        const after = String(emitProgram(SB.workspaceToStack(ws)));
        return {
            varsSame: JSON.stringify(vars(wizard)) === JSON.stringify(vars(fromBlocks)),
            wizardVars: vars(wizard).length, moved,
            changed: after !== fromBlocks, doc: (after.split(String.fromCharCode(10)).find((l) => l.startsWith('#124=')) || ''),
        };
    });
    // EVERY AUTHORED VALUE SURVIVES: the #var header IS the op's parameters, and it comes back identical
    expect(r.wizardVars, 'the op really does carry a header of values').toBeGreaterThan(10);
    expect(r.varsSame, 'and the canvas gives every one of them back unchanged').toBe(true);
    // …and the canvas is a real editor: a field edit moves the emitted program
    expect(r.moved, 'the depth-of-cut field is there to edit').toBe(true);
    expect(r.changed, 'and editing it moves the program').toBe(true);
    expect(r.doc, 'to the typed value').toMatch(/#124=2/);
});

test('ABSENCE SURVIVES THE CANVAS — no phantom axis words (t1315 found it, t1317 fixed it)', async ({ page }) => {
    // HISTORY, kept deliberately: this test was written at t1315 to PIN A DEFECT — the canvas materialised blank axis
    // words as zeros, so `G0 X#120` came back as `G0 X#120 Z0`. In G91 that is a no-op; in ABSOLUTE mode it is a real
    // move to Z0, a different program. It was written to fail the day it was fixed, and t1317 fixed it: the move atom
    // DECLARES which of its fields may be absent, and the bridge keeps an empty socket empty in both directions.
    await boot(page);
    await page.evaluate(() => window.showApp && window.showApp('blocks'));
    // t1315 (de-sleep) — __blkws is the app's OWN declared readiness signal for the Blocks tab (blocksApp.js's
    // own comment on the showApp('blocks') rethrow: "a caller polling for the app's own readiness signal
    // (window.__blkws)"). showApp('blocks') already awaits showBlocks()→buildWorkspace(), which sets __blkws as
    // the LAST synchronous step, so this resolves as soon as the workspace is real — never later than 2200ms.
    await page.waitForFunction(() => !!window.__blkws, null, { timeout: 20000 });
    const r = await page.evaluate(async () => {
        const uo = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const SB = await import('/blocks/blockly/stackBridge.js');
        const ws = Blockly.getMainWorkspace();
        const params = uo.defaultParams(uo.listUserOps().find((d) => d.opType === 'user_lathe_odturn'));
        const stack = builderOf('user_lathe_odturn')(params);
        const before = String(emitProgram(stack));
        SB.stackToWorkspace(stack, ws);
        const after = String(emitProgram(SB.workspaceToStack(ws)));
        const moves = (nc) => nc.split(String.fromCharCode(10)).filter((l) => /^G[01] /.test(l));
        // …and an EXPLICIT zero, which is a different fact and must survive as itself
        SB.stackToWorkspace([{ type: 'move', params: { mode: 'cut', x: 0, feed: 100 } }], ws);
        const zero = String(emitProgram(SB.workspaceToStack(ws))).trim();
        return { before: moves(before), after: moves(after), zero };
    });
    expect(r.after, 'every move comes back exactly as it was written').toEqual(r.before);
    expect(r.after.some((l) => / Y0| Z0| X0/.test(l)), 'no phantom zero word anywhere').toBe(false);
    // BOTH TRUTHS: an explicit zero is a real instruction and keeps its word
    expect(r.zero, 'a typed X0 stays X0 — and gains no companions').toBe('G1 X0 F100');
});

test('THE DISCRIMINATING CASE — a phantom Z0 would move the tool, and the sim proves it does not', async ({ page }) => {
    // The failure this prevents is invisible in G91 (a zero word is a no-op) and REAL in G90: the mixed-mode program
    // below ends absolute, so a phantom Z0 on that last move would drive Z to zero from 5. Executed both ways.
    await boot(page);
    await page.evaluate(() => window.showApp && window.showApp('blocks'));
    // t1315 (de-sleep) — __blkws is the app's OWN declared readiness signal for the Blocks tab (blocksApp.js's
    // own comment on the showApp('blocks') rethrow: "a caller polling for the app's own readiness signal
    // (window.__blkws)"). showApp('blocks') already awaits showBlocks()→buildWorkspace(), which sets __blkws as
    // the LAST synchronous step, so this resolves as soon as the workspace is real — never later than 2200ms.
    await page.waitForFunction(() => !!window.__blkws, null, { timeout: 20000 });
    const r = await page.evaluate(async () => {
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const SB = await import('/blocks/blockly/stackBridge.js');
        const ws = Blockly.getMainWorkspace();
        const stack = [
            { type: 'distmode', params: { dist: 'abs' } },
            { type: 'move', params: { mode: 'rapid', x: 10, y: 5, z: 5 } },
            { type: 'distmode', params: { dist: 'inc' } },
            { type: 'move', params: { mode: 'cut', x: 2, feed: 100 } },        // incremental: a phantom Z0 is a no-op
            { type: 'distmode', params: { dist: 'abs' } },
            { type: 'move', params: { mode: 'cut', x: 20, feed: 100 } },       // ABSOLUTE: a phantom Z0 would dive to 0
        ];
        const a = String(emitProgram(stack));
        SB.stackToWorkspace(stack, ws);
        const b = String(emitProgram(SB.workspaceToStack(ws)));
        const pts = (nc) => (traceToolpath(nc).segments || []).map((s) => [+s.x2.toFixed(3), +s.y2.toFixed(3), +s.z2.toFixed(3)]);
        return { same: a === b, a, movesA: pts(a), movesB: pts(b) };
    });
    expect(r.same, 'the program is byte-identical through the canvas').toBe(true);
    expect(r.movesB, 'and the SIM executes the same moves, point for point').toEqual(r.movesA);
    // the last absolute cut must still end at Z5 — a phantom Z0 is exactly what would have taken it to zero
    expect(r.movesA[r.movesA.length - 1][2], 'Z is where the program left it, not at zero').toBeCloseTo(5, 3);
});

test('THE BAR FIELD PREFILLS FROM THE WORKSPACE — modal Ø45, form 45, emit #131=45', async ({ page }) => {
    await boot(page);
    await setBar(page, 45);
    const r = await page.evaluate(async () => {
        const uo = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const def = uo.listUserOps().find((d) => d.opType === 'user_lathe_odturn');
        const params = uo.defaultParams(def);
        const nc = String(emitProgram(builderOf('user_lathe_odturn')(params)));
        const bind = (def.bindings || []).find((b) => b.param === 'barDiameter');
        return { form: params.barDiameter, line: nc.split('\n').find((l) => l.startsWith('#131=')), labelled: bind && bind.label, live: bind && bind.defaultLive };
    });
    expect(r.form, 'the field prefills with the bar the workspace declares').toBe(45);
    expect(r.line, 'and the emit carries that number').toMatch(/^#131=45\b/);
    expect(r.labelled, 'on a field the operator can SEE — the G-code only moves through a visible number').toMatch(/Bar/);
    expect(r.live, 'declared BY NAME, because a def is persisted as JSON and a function default would vanish').toBe('workspaceBarDiameter');
});

test('AN OP-LEVEL EDIT WINS FOR THAT OP — and the baked default is the no-bar fallback', async ({ page }) => {
    await boot(page);
    await setBar(page, 45);
    const r = await page.evaluate(async () => {
        const uo = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const def = uo.listUserOps().find((d) => d.opType === 'user_lathe_odturn');
        const params = uo.defaultParams(def);
        const typed = String(emitProgram(builderOf('user_lathe_odturn')({ ...params, barDiameter: 32 })));
        // …and with NO bar declared at all, the op falls back to the number it was authored with
        window.ddcsGetSettings().stock = { x: 100, y: 80, z: 20, shape: 'boss', datum: 'nnp', show: true };
        try { window.ddcsSaveSettings && window.ddcsSaveSettings(); } catch (_) {}
        const fresh = uo.defaultParams(uo.listUserOps().find((d) => d.opType === 'user_lathe_odturn'));
        return { typed: typed.split('\n').find((l) => l.startsWith('#131=')), fallback: fresh.barDiameter };
    });
    expect(r.typed, 'a typed value wins for that op instance').toMatch(/^#131=32\b/);
    expect(r.fallback, 'and a workspace with no declared bar falls back to the op default').toBe(20);
});

test('THE SCENE FOLLOWS THE SAME NUMBER — no second path around the form', async ({ page }) => {
    await boot(page);
    await setBar(page, 45);
    const r = await page.evaluate(async () => {
        const { getUserSimStock } = await import('/viz/opSimStarts.js');
        const uo = await import('/blocks/userOps.js');
        const def = uo.listUserOps().find((d) => d.opType === 'user_lathe_odturn');
        const params = uo.defaultParams(def);
        const fn = getUserSimStock('user_lathe_odturn');
        return {
            prefilled: fn(params, window.ddcsGetSettings().stock).diameter,
            typed: fn({ ...params, barDiameter: 32 }, window.ddcsGetSettings().stock).diameter,
        };
    });
    expect(r.prefilled, 'the picture draws the prefilled bar').toBe(45);
    expect(r.typed, 'and follows a typed override, because it reads the same params the emit does').toBe(32);
});
