import { test, expect } from '@playwright/test';

/**
 * t1325 (1) — ONE TABLE, PER-KIND ROWS.
 *
 * The stock-modal pattern applied to tools. A turning insert has no flute count and no plunge feed; a parting blade's
 * whole identity is its width. So a LATHE workspace's tool table speaks lathe — while the MILL table keeps its exact
 * shape, which is asserted BOTH WAYS (the mill columns are still there for a mill, and the lathe branch does not
 * leak into it).
 *
 * AND THE UNIT IS A FACT ABOUT THE TOOL, not a mode the machine is in: an imperial blade in a metric shop is normal.
 * The label carries the unit everywhere the number surfaces, and the conversion happens ONCE in the macro header —
 * never G20/G21, which would rescale every word after it.
 */
test.use({ viewport: { width: 1400, height: 950 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

// Set the workspace machine kind, then open the tool library the way Settings does.
const openTable = async (page, kind, tools) => page.evaluate(async ({ kind, tools }) => {
    const wm = await import('/data/workspaceMachine.js');
    wm.setMachine({ ...wm.getMachine(), kind });
    const S = window.ddcsGetSettings();
    S.atc = S.atc || {};
    S.atc.tools = tools;
    // the module's OWN entry point (the one the wizard's Tool gear calls) — it builds the settings overlay first
    const SP = await import('/ui/settingsPanel.js');
    SP.openToolLibrary();
    await new Promise((r) => setTimeout(r, 700));
    const head = document.querySelector('#toollib-modal thead');
    const rows = Array.from(document.querySelectorAll('#toollib-rows tr'));
    return {
        headers: head ? Array.from(head.querySelectorAll('th')).map((t) => t.textContent.trim()) : null,
        rowKinds: rows.map((r) => r.dataset.kind || null),
        fields: rows.map((r) => Array.from(r.querySelectorAll('[data-field]')).map((el) => el.dataset.field)),
        blanks: rows.map((r) => r.querySelectorAll('td.tl-nofact').length),
    };
}, { kind, tools });

test('A LATHE workspace speaks lathe — kind, unit, and the quick facts of each kind', async ({ page }) => {
    await boot(page);
    const r = await openTable(page, 'lathe', [
        { num: 1, name: '93 DCMT', kind: 'turning', leadAngle: 93, noseRadius: 0.4 },
        { num: 2, name: '3mm blade', kind: 'parting', bladeWidth: 3 },
    ]);
    expect(r.headers, `the lathe head: ${JSON.stringify(r.headers)}`).toContain('Kind');
    expect(r.headers, 'and the per-tool unit is a column, because it belongs to the tool').toContain('Unit');
    expect(r.headers.join('|'), 'with the quick facts of every kind').toMatch(/Lead angle/);
    expect(r.headers.join('|')).toMatch(/Blade width/);
    // THE MILL COLUMNS ARE GONE from a lathe table — a turning insert has no flutes, and an empty cell would be a lie
    expect(r.headers, 'no flute count on a lathe table').not.toContain('Flutes');
    expect(r.rowKinds, 'each row declares its kind').toEqual(['turning', 'parting']);
    // A FACT OF ANOTHER KIND IS ABSENT, NOT BLANK: a turning insert does not have an empty blade width, it has no blade
    expect(r.blanks[0], 'the turning row leaves the parting/drill facts as no-cells').toBeGreaterThan(0);
    expect(r.fields[0], 'and it carries its own two facts').toEqual(expect.arrayContaining(['leadAngle', 'noseRadius', 'kind', 'unit']));
    expect(r.fields[0], 'but not another kind’s').not.toContain('bladeWidth');
    expect(r.fields[1], 'while the parting row carries the width and nothing else').toEqual(expect.arrayContaining(['bladeWidth']));
    expect(r.fields[1]).not.toContain('leadAngle');
});

test('A MILL workspace is UNCHANGED — the exact columns it has always had', async ({ page }) => {
    await boot(page);
    const r = await openTable(page, 'mill', [{ num: 1, name: '6mm flat', type: 'endmill', dia: 6, flutes: 2, rpm: 12000, feed: 3800, plunge: 950 }]);
    // the mill header, verbatim — this is the "asserted unchanged" half of one table, per-kind rows
    expect(r.headers, `the mill head is untouched: ${JSON.stringify(r.headers)}`).toEqual(
        ['Tool #', 'Name', 'Type', 'Profile', 'Ø mm', 'Flutes', 'Length', 'RPM', 'Feed', 'Plunge', 'Angle°', '']);
    expect(r.rowKinds, 'a mill row declares no lathe kind at all').toEqual([null]);
    expect(r.fields[0], 'and it edits the mill fields').toEqual(expect.arrayContaining(['num', 'name', 'type', 'dia', 'flutes', 'length', 'rpm', 'feed', 'plunge']));
    expect(r.fields[0], 'with no lathe kind picker leaking in').not.toContain('kind');
});

test('THE RECORD KEEPS ITS NEW FACTS — and every tool that exists today normalizes unchanged', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { normalizeTool } = await import('/ui/settingsPanel.js');
        const old = normalizeTool({ num: 3, name: '6mm flat', type: 'endmill', dia: 6, flutes: 2, rpm: 12000, feed: 3800, plunge: 950, length: 40, angle: '' }, 3);
        const lathe = normalizeTool({ num: 4, name: '1/8 blade', kind: 'parting', unit: 'inch', bladeWidth: 0.125 }, 4);
        return { old, lathe };
    });
    // an EXISTING mill tool: the new keys arrive empty, so no stored number changes and no column gains a value
    expect(r.old.kind, 'a mill tool declares no lathe kind').toBe('');
    expect(r.old.unit, 'and no unit override — it is mm-native as it always was').toBe('');
    expect(r.old.dia, 'its own numbers are untouched').toBe(6);
    expect(r.old.flutes).toBe(2);
    // a LATHE tool keeps its kind, its unit, and its kind's fact
    expect(r.lathe.kind).toBe('parting');
    expect(r.lathe.unit).toBe('inch');
    expect(r.lathe.bladeWidth).toBe(0.125);
});

test('THE UNIT CONVERTS ONCE, IN THE HEADER — and never with G20/G21', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const LT = await import('/data/latheTools.js');
        const inchBlade = { kind: 'parting', unit: 'inch', bladeWidth: 0.125 };
        const mmBlade = { kind: 'parting', unit: 'mm', bladeWidth: 3 };
        const insert = { kind: 'turning', unit: 'inch', leadAngle: 93, noseRadius: 0.031 };
        return {
            inchMm: LT.factMm(inchBlade, 'parting', 'bladeWidth'),
            mmMm: LT.factMm(mmBlade, 'parting', 'bladeWidth'),
            angle: LT.factMm(insert, 'turning', 'leadAngle'),
            labelIn: LT.factLabel(inchBlade, 'parting', 'bladeWidth'),
            labelMm: LT.factLabel(mmBlade, 'parting', 'bladeWidth'),
            header: LT.factHeaderLine(inchBlade, 'parting', 'bladeWidth', '#120'),
            headerMm: LT.factHeaderLine(mmBlade, 'parting', 'bladeWidth', '#120'),
        };
    });
    // 1/8" is 3.175mm exactly — the same exactness the mill catalog has always kept
    expect(r.inchMm).toBeCloseTo(3.175, 6);
    expect(r.mmMm, 'a metric tool converts by nothing at all').toBe(3);
    // AN ANGLE IS NOT A LENGTH: 93° is 93° in either unit, and scaling it would be a silently wrong tool
    expect(r.angle, 'a lead angle never converts').toBe(93);
    // THE LABEL CARRIES THE UNIT wherever the number surfaces — that is what stops an inch blade reading as 3mm
    expect(r.labelIn).toBe('Blade width [in]');
    expect(r.labelMm).toBe('Blade width [mm]');
    // THE HEADER does the conversion visibly, in the program the operator reads
    expect(r.header, `the inch header line: ${r.header}`).toContain('25.4');
    expect(r.header).toContain('#120=[0.125 * 25.4]');
    expect(r.header, 'and it says why it is not a mode switch').toMatch(/never G20\/G21/);
    expect(r.headerMm, 'a metric tool needs no arithmetic').toBe('#120=3   ;Blade width [mm]');
    expect(r.headerMm, 'and emits no modal unit code').not.toMatch(/G2[01]/);
});
