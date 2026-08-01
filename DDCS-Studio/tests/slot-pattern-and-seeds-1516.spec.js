import { test, expect } from '@playwright/test';

/**
 * ── t1516 — TWO HONESTY PIECES ────────────────────────────────────────────────────────────────────────────────────
 *
 * 1. THE LITERAL ARM'S SILENT PATTERN DROP. A slot op with a pattern and a width at or under its tool packed a CAM
 *    slot and returned `camType: 'slot'` — and the generator emits ONE slot body. Six drawn, one cut, no message, and
 *    no pattern row in the seeded table for the operator to notice was missing. The WIDE half was already refused, but
 *    only as a side effect of the arm question quoting a pattern gap. Both halves refuse for the pattern's own reason
 *    now, before either arm is chosen.
 *
 *    ⚠ AND THE CONDITION IS NOT "IS IT PATTERNED", which is measured rather than reasoned: the generator's one slot is
 *    the right part exactly when the pattern resolves to a single point AT THE ORIGIN. A 1×1 grid is that and must
 *    still pack; a bolt-circle of ONE is not (it sits on the circle) and must refuse. A count test misses the second
 *    and a `slotPatterned` test wrongly refuses the first.
 *
 * 2. THE SLOT'S SEEDS, through the declaration `SPEC`'s own header has promised since it was written. `feed` 300 and
 *    `depth` 5 are DRILL numbers, and a slot's are its wizard's (2000 / 4). The per-method override was a ternary with
 *    one case in it; it is a data map now, and drill's and bore's seeded rows must be byte-for-byte unmoved.
 */

const boot = async (page) => {
    page.on('dialog', (d) => d.accept());
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

const BASE = { ax: 0, ay: 0, bx: 60, by: 0, toolDia: 6, stepdown: 1.5, entry: 'plunge' };

/**
 * ── PROOF 1 — THE DROP IS CLOSED, ON BOTH ARMS, AND THE REFUSAL IS THE PATTERN'S OWN ──────────────────────────────
 *
 * The narrow half is the one that was silent; the wide half was refused for someone else's reason. Both are asserted,
 * with the drop itself measured first — the generator really does emit one body for an op that draws six.
 */
test('PROOF 1 — a patterned slot REFUSES on both arms, for the pattern\'s own reason', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (base) => {
        const { camTypeOf, slotPackArm } = await import('/data/opCamMap.js');
        const { slotFromOp, SLOT_ARM } = await import('/data/opToSlot.js');
        const grid = { pattern: 'grid', cols: 3, rows: 2, dx: 20, dy: 20 };
        const at = (over) => { const p = { ...base, ...over }; const g = camTypeOf({ opType: 'slot', params: p });
            return { camType: g.camType || '', why: g.unsupported || '', arm: slotPackArm(p) }; };
        // THE DROP, measured: the generator's body cuts ONE slot whichever pattern the op carries
        const bodyOf = (pat) => slotFromOp('slot', pat, new Set(), 0).body;
        const g0 = bodyOf(''), gA = bodyOf(SLOT_ARM.atom);
        const moves = (b) => b.split('\n').filter((l) => /^\s*G[01] .*X/.test(l)).length;
        return {
            narrow: at({ width: 6, ...grid }),          // ⚠ the silent one: packed and cut 1 of 6
            wide: at({ width: 12, ...grid }),           // refused before, for the ARM's reason
            litMoves: moves(g0), atomMoves: moves(gA),
            litHasLoop: /WHILE|DO1/.test(g0),
        };
    }, BASE);
    // the generator really is a ONE-SLOT body — the premise the refusal rests on
    expect(r.litMoves, 'the literal arm emits a single slot\'s moves').toBeGreaterThan(0);
    expect(r.atomMoves, '…and so does the packed arm').toBeGreaterThan(0);
    // ⚠ THE PIN THAT FLIPPED: this read `camType: 'slot'` — packed, and one slot cut where six were drawn
    expect(r.narrow.camType, '⚠ a NARROW patterned slot is REFUSED — it used to pack and drop five of six silently').toBe('');
    expect(r.narrow.why, '…naming what was drawn').toMatch(/6 slots in a grid pattern/);
    expect(r.narrow.why, '…and what packing it would have cut').toMatch(/drop the other 5/);
    expect(r.narrow.why, '…said as a DIFFERENT part, not a smaller one').toMatch(/different part/);
    expect(r.narrow.why, '…with the exit named (t1444)').toMatch(/Slot wizard/);
    // the wide half refuses too, and now for the same reason as the narrow one rather than the arm's
    expect(r.wide.camType, 'a WIDE patterned slot refuses as well').toBe('');
    expect(r.wide.why, '…for the PATTERN\'s reason, not the arm\'s self-framing one').toMatch(/6 slots in a grid pattern/);
    expect(r.wide.why, '…so no operator is told about `array` containers for a question they did not ask').not.toContain('array');
    expect(r.wide.why, r.narrow.why === r.wide.why ? '' : 'both arms give the SAME sentence — the reason is the pattern, not the width').toBe(r.narrow.why);
});

/**
 * ── PROOF 2 — THE CONDITION IS THE MEASURED ONE, so the refusal neither over- nor under-reaches ───────────────────
 *
 * "Every clause a NARROWING" is `slotRasterArmGap`'s own rule, and refusing a config the macro cuts correctly is the
 * same defect class as packing one it does not. The two degenerates are where a lazier predicate would be wrong.
 */
test('PROOF 2 — a 1×1 grid still PACKS; a bolt-circle of ONE refuses, and says why', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (base) => {
        const { camTypeOf, slotPatternPack } = await import('/data/opCamMap.js');
        const { slotPatterned, slotPatternPoints } = await import('/wizards/slotWizard.js');
        const at = (over) => { const g = camTypeOf({ opType: 'slot', params: { ...base, ...over } });
            return { camType: g.camType || '', why: g.unsupported || '' }; };
        const pts = (over) => slotPatternPoints({ ...base, ...over }).map((q) => [q.x, q.y]);
        const one = { width: 6 };
        return {
            grid11: at({ ...one, pattern: 'grid', cols: 1, rows: 1, dx: 20, dy: 20 }),
            grid11Pts: pts({ pattern: 'grid', cols: 1, rows: 1, dx: 20, dy: 20 }),
            grid11Patterned: slotPatterned({ pattern: 'grid', cols: 1, rows: 1 }),
            line1: at({ ...one, pattern: 'line', count: 1, spacing: 30, angle: 0 }),
            circle1: at({ ...one, pattern: 'circle', count: 1, dia: 80, startAngle: 0 }),
            circle1Pts: pts({ pattern: 'circle', count: 1, dia: 80, startAngle: 0 }),
            plain: at(one),
            // the predicate itself, so a future reader sees which shape it keys on
            packGrid11: slotPatternPack({ ...base, pattern: 'grid', cols: 1, rows: 1 }),
            packCircle1: slotPatternPack({ ...base, pattern: 'circle', count: 1, dia: 80 }),
        };
    }, BASE);
    // A 1×1 GRID: patterned by the wizard's predicate, ONE point, AT the origin → the single slot IS the part
    expect(r.grid11Patterned, 'the wizard calls a 1×1 grid patterned').toBe(true);
    expect(r.grid11Pts, '…and it resolves to one point at the origin').toEqual([[0, 0]]);
    expect(r.grid11.camType, '⚠ so it still PACKS — refusing it would be a refusal of a correct macro').toBe('slot');
    expect(r.packGrid11, '…and the predicate says so rather than the gate special-casing it').toBeNull();
    expect(r.line1.camType, 'a line of ONE likewise').toBe('slot');
    // A BOLT-CIRCLE OF ONE: one point, and NOT at the origin → one slot, in the wrong place
    expect(r.circle1Pts[0][0], 'a bolt-circle of one sits on the circle, not at A').toBeCloseTo(40, 6);
    expect(r.circle1.camType, '⚠ so it REFUSES — a count test would have packed it').toBe('');
    expect(r.circle1.why, '…for the offset, not for a dropped instance').toMatch(/OFF its own A→B line/);
    expect(r.circle1.why, '…and NOT with the plural sentence, which would be broken grammar carrying a wrong reason').not.toMatch(/drop the other/);
    expect(r.circle1.why, '…with both exits named').toMatch(/Slot wizard/);
    expect(r.packCircle1, 'and the predicate reports it as the single-offset shape').toEqual({ n: 1, kind: 'circle' });
    // an UNPATTERNED slot is untouched by any of it
    expect(r.plain.camType, 'a plain slot packs exactly as before').toBe('slot');
});

/**
 * ── PROOF 3 — THE PENDING CAPABILITY IS DECLARED AS DATA, and NOT built ───────────────────────────────────────────
 *
 * t1515's ruling. A refusal with no recorded way out reads as a permanent law; the arc's own `SLOT_ARC_NOT_INCLUDED`
 * draws exactly this line between a TEACHABLE gap and an evidence-blocked one, and this is teachable — the offsets are
 * already build-time, so nothing here waits on the controller.
 */
test('PROOF 3 — the pattern-emit lift is recorded as a teachable gap, not built', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const m = await import('/data/opCamMap.js');
        const src = await (await fetch('/data/opToSlot.js')).text();
        return {
            gap: m.SLOT_PATTERN_PACK_GAP,
            // the LIFT is not built: the slot generator has no per-instance loop over pattern offsets
            slotBodyHasPatternLoop: /slotPatternPoints|patternPoints/.test(src),
        };
    });
    expect(r.gap, 'the gap is inert data a future act can read').toBeTruthy();
    expect(r.gap.what, 'it states the mismatch in one line').toMatch(/ONE slot body/);
    expect(r.gap.whyRefusedRatherThanDegraded, '…why a degrade was not the answer').toMatch(/DIFFERENT PART/);
    expect(r.gap.whatALiftWouldNeed, '…what the lift would actually be').toMatch(/loop/);
    expect(r.gap.whatALiftWouldNeed, '…and that it is NOT evidence-gated, so nobody adds it to the machine visit').toMatch(/NOT trig- or V13-gated/);
    expect(r.gap.whyNotFoldedIntoThisAct, '…and why it is not in this act').toMatch(/emit act/i);
    expect(r.slotBodyHasPatternLoop, 'the lift itself is NOT built — the generator reads no pattern offsets').toBe(false);
});

/**
 * ── PROOF 4 — THE SLOT'S SEEDS ARE ITS WIZARD'S, and every other method's are byte-for-byte unmoved ───────────────
 *
 * The seeds are what an operator sees in the `#2600` table before touching anything, so a slot arriving at 300mm/min
 * proposes a feed six times slow. The fix is one lookup against a declared map — and the whole risk of it is that the
 * map reaches a method it should not, which is what the second half of this proof exists to catch.
 */
test('PROOF 4 — the slot seeds feed 2000 / depth 4; drill and bore keep 300 / 5', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { slotFromOp, SLOT_ARM } = await import('/data/opToSlot.js');
        const { slotLeafParams } = await import('/wizards/slotWizard.js');
        const rows = (m, pat) => { const o = {}; for (const f of slotFromOp(m, pat, new Set(), 0).fields) o[f.key] = f.def; return o; };
        const out = { slotLit: rows('slot', ''), slotAtom: rows('slot', SLOT_ARM.atom) };
        for (const pat of ['circle', 'grid', 'line', 'rect']) { out['drill_' + pat] = rows('drill', pat); out['bore_' + pat] = rows('bore', pat); }
        // the WIZARD's own seeds, so the slot's numbers are read from one source rather than restated here
        out.wizard = slotLeafParams({});
        return out;
    });
    // the slot's two arms carry the WIZARD's seeds
    for (const arm of ['slotLit', 'slotAtom']) {
        expect(r[arm].feed, `${arm}: the feed seed is the wizard's, not the drill's 300`).toBe(r.wizard.feed);
        expect(r[arm].depth, `${arm}: …and so is the depth, not the drill's 5`).toBe(r.wizard.depth);
        expect(r[arm].stepdown, `${arm}: the seeds that already agreed are untouched`).toBe(r.wizard.stepdown);
        expect(r[arm].clearance, `${arm}: …clearance too`).toBe(r.wizard.clearance);
    }
    expect(r.wizard.feed, 'and those numbers really are 2000 / 4 — a slot cuts fast and shallow beside a drilled hole').toBe(2000);
    expect(r.wizard.depth).toBe(4);
    expect(r.slotAtom.plunge, 'the packed arm\'s plunge feed was already the wizard\'s and stays').toBe(r.wizard.plunge);
    // ⚠ NOBODY ELSE MOVES — every drill/bore pattern's whole seeded row set, asserted
    for (const pat of ['circle', 'grid', 'line', 'rect']) {
        expect(r['drill_' + pat].feed, `drill/${pat}: feed unmoved`).toBe(300);
        expect(r['drill_' + pat].depth, `drill/${pat}: depth unmoved`).toBe(5);
        expect(r['drill_' + pat].holeDia, `drill/${pat}: the ternary's own case survives the move to data`).toBe(6);
        expect(r['bore_' + pat].feed, `bore/${pat}: feed unmoved`).toBe(300);
        expect(r['bore_' + pat].depth, `bore/${pat}: depth unmoved`).toBe(5);
        expect(r['bore_' + pat].holeDia, `bore/${pat}: …and bore still seeds a hole WIDER than its tool`).toBe(12);
        expect(r['bore_' + pat].toolDia, `bore/${pat}: …which the tool seed is what makes meaningful`).toBe(6);
    }
});

/**
 * ── PROOF 5 — THE SEED REACHES THE MACRO an operator reads, not just the field object ─────────────────────────────
 *
 * A default that lives only in a returned object is a default nobody sees. The generator writes each field's seed into
 * its own read-line comment (`#6=#2605   ;Feed [mm/min] =2000 [1~99999]`), which is the line the operator checks
 * against the pendant — so that is where the change is asserted.
 */
test('PROOF 5 — the new seeds appear in the macro\'s own read-lines', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { slotFromOp, SLOT_ARM } = await import('/data/opToSlot.js');
        const lineFor = (body, label) => body.split('\n').map((l) => l.trim()).find((l) => l.includes(';' + label));
        const slot = slotFromOp('slot', SLOT_ARM.atom, new Set(), 0).body;
        const drill = slotFromOp('drill', 'grid', new Set(), 0).body;
        return { slotFeed: lineFor(slot, 'Feed'), slotDepth: lineFor(slot, 'Depth'),
                 drillFeed: lineFor(drill, 'Feed'), drillDepth: lineFor(drill, 'Depth') };
    });
    expect(r.slotFeed, 'the slot macro proposes the wizard\'s feed').toMatch(/=2000 /);
    expect(r.slotDepth, '…and its depth').toMatch(/=4 /);
    expect(r.drillFeed, 'the drill macro is untouched').toMatch(/=300 /);
    expect(r.drillDepth, '…in both').toMatch(/=5 /);
});
