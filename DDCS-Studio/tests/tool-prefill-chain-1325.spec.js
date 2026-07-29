import { test, expect } from '@playwright/test';

/**
 * t1325 (3) — THE PREFILL CHAIN, TOOL → FORM → EMIT.
 *
 * A blade's kerf is the number a turner picks the blade BY, so typing it a second time into the parting form is an
 * invitation to drift. The picker offers only the kinds the op declares it can hold, and picking one fills the
 * field — with the conversion done ONCE, and a note saying where the number came from and in what unit the tool was
 * bought. An op-level typed value still wins for that instance, because the fill runs on PICK, not on every render.
 *
 * The chain is asserted to the EMIT, not to the form: a prefill that stops at a text box has not done anything.
 */
test.use({ viewport: { width: 1400, height: 950 } });

const LIB = [
    { num: 1, name: '93 DCMT', kind: 'turning', leadAngle: 93, noseRadius: 0.4 },
    { num: 2, name: '3mm blade', kind: 'parting', unit: 'mm', bladeWidth: 3 },
    { num: 3, name: '1/8 blade', kind: 'parting', unit: 'inch', bladeWidth: 0.125 },
    { num: 4, name: 'A2 centre', kind: 'centredrill', dia: 3 },
    { num: 5, name: '6mm flat', type: 'endmill', dia: 6, flutes: 2 },
];

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    await page.evaluate(async ({ LIB }) => {
        const wm = await import('/data/workspaceMachine.js');
        wm.setMachine({ ...wm.getMachine(), kind: 'lathe' });
        const S = window.ddcsGetSettings();
        S.atc = S.atc || {};
        S.atc.tools = LIB;
    }, { LIB });
};

test('THE PICKER OFFERS ONLY WHAT THE OP CAN HOLD — blades for a parting op, not endmills', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { toolsOfKinds, getToolLibrary } = await import('/wizards/toolPicker.js');
        return {
            parting: toolsOfKinds(['parting']).map((t) => t.num),
            centre: toolsOfKinds(['centredrill', 'drill']).map((t) => t.num),
            none: toolsOfKinds(null).map((t) => t.num),
            labels: getToolLibrary().map((t) => t.label),
        };
    });
    expect(r.parting, 'a parting op sees the two blades and nothing else').toEqual([2, 3]);
    expect(r.centre, 'a centre-drill op sees the centre drill').toEqual([4]);
    // AN OP THAT DECLARES NO KINDS IS UNCHANGED — every mill op, so this filter is inert until a def opts in
    expect(r.none, 'no declaration → the whole library, exactly as before').toEqual([1, 2, 3, 4, 5]);
    // AND A LATHE TOOL READS AS ITSELF: the fact it is chosen by, in the unit it was bought in
    expect(r.labels[2], `the inch blade's label: ${r.labels[2]}`).toContain('0.125 in');
    expect(r.labels[1]).toContain('3 mm');
    expect(r.labels[4], 'while a mill tool keeps its own label form').toContain('Ø6');
});

test('THE DECLARATION IS ON THE OP — parting declares blades and the field its width fills', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const P = await import('/blocks/dataOps/partingData.js');
        const C = await import('/blocks/dataOps/centerDrillData.js');
        const tsel = (specs) => specs.find((b) => b.match && b.match.type === 'toolsel');
        return { parting: tsel(P.PART_BINDING_SPECS).widgetConfig, centre: tsel(C.CDRILL_BINDING_SPECS).widgetConfig };
    });
    expect(r.parting.toolKinds, 'parting holds blades').toEqual(['parting']);
    expect(r.parting.fill, 'and the blade’s width fills the width field — one declaration, no widget code').toEqual({ bladeWidth: 'width' });
    expect(r.centre.toolKinds, 'the centre drill holds centre drills and drills').toEqual(['centredrill', 'drill']);
    // NOTHING TO PREFILL THERE, and that is a fact about the op: the drill is on the centreline, so no diameter ever
    // reaches the macro. A dia param existing only to receive a prefill would be a socket the program does not use.
    expect(r.centre.fill, 'the centre drill fills nothing').toBeUndefined();
});

test('TOOL → FORM → EMIT — a metric blade’s width reaches the G-code', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const uo = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const { factMm } = await import('/data/latheTools.js');
        const { getTool } = await import('/wizards/toolPicker.js');
        const def = uo.getUserDef('user_lathe_parting');
        const P = uo.defaultParams(def);
        const blade = getTool(2);
        // what the PICK does: the tool's fact, converted once, into the form's width field
        const width = factMm(blade, 'parting', 'bladeWidth');
        const emit = String(emitProgram(builderOf('user_lathe_parting')({ ...P, width, toolNum: 2 })));
        return { width, emit, defaultWidth: P.width };
    });
    expect(r.width, 'a metric blade needs no conversion').toBe(3);
    // THE NUMBER IS IN THE PROGRAM — the chain does not stop at the form
    expect(r.emit, `the parting emit carries the kerf: ${r.emit.split('\n').filter((l) => /3/.test(l)).slice(0, 3).join(' | ')}`).toMatch(/=\s*3\b/);
});

test('AN INCH BLADE CONVERTS ONCE — 0.125 in reaches the emit as 3.175 mm, with no G20', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const uo = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const { factMm, factLabel } = await import('/data/latheTools.js');
        const { getTool } = await import('/wizards/toolPicker.js');
        const def = uo.getUserDef('user_lathe_parting');
        const P = uo.defaultParams(def);
        const blade = getTool(3);
        const width = factMm(blade, 'parting', 'bladeWidth');
        const emit = String(emitProgram(builderOf('user_lathe_parting')({ ...P, width, toolNum: 3 })));
        return { width, label: factLabel(blade, 'parting', 'bladeWidth'), emit };
    });
    expect(r.width, '1/8 inch is 3.175 mm exactly').toBeCloseTo(3.175, 6);
    expect(r.label, 'and the label carries the unit it was bought in, wherever it surfaces').toBe('Blade width [in]');
    expect(r.emit, 'the converted number is what the program carries').toMatch(/3\.175/);
    // NEVER A MODAL UNIT SWITCH: a G20 would rescale every word after it — feeds, the retract, an unrelated axis
    expect(r.emit, 'no G20/G21 anywhere in the program').not.toMatch(/\bG2[01]\b/);
});

test('A TYPED VALUE STILL WINS — the fill happens on PICK, not on every render', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const uo = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const def = uo.getUserDef('user_lathe_parting');
        const P = uo.defaultParams(def);
        // the operator picked T2 (a 3mm blade) and then typed 2.5 — a reground blade, and they are right about it
        const emit = String(emitProgram(builderOf('user_lathe_parting')({ ...P, toolNum: 2, width: 2.5 })));
        return { emit };
    });
    expect(r.emit, 'the typed 2.5 is what the op runs').toMatch(/=\s*2\.5\b/);
    expect(r.emit, 'the tool’s 3 does not overwrite it').not.toMatch(/=\s*3\s*$/m);
});
