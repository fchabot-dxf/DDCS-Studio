import { test, expect } from './support/harness.mjs';

/**
 * PROBE-DATUM CORRECTNESS (t644, F4). The WCS-write must land such that the TOUCHED FACE reads the intended work coordinate
 * (work-0), per each post's own idiom. Expert writes the offset REGISTER = the face machine coord (probe-fix.nc). V4.1/DM500
 * use G92 — and G92 takes a WORK value for the CURRENT position, so the fix emits `G92 <axis>[#dro - value]` (value = the face
 * machine coord) so the offset lands = value regardless of where the tool sits. VERIFY = THE DATUM, NOT THE FORM: run the real
 * WCS-write emit in the exec engine with the tool at a POST-RETRACT position ≠ the face, and assert the face reads work-0.
 * Expert is the known-good the harness is proven against first; a buggy `G92 <axis>#value` control must FAIL the same check.
 */
const FACE = 100, TOOL = 97;   // face machine coord; a post-retract tool position (≠ face) where the WCS-write runs

test('the touched face reads work-0 after the WCS-write on Expert / V4.1 / DM500 (datum, not form)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async ({ FACE, TOOL }) => {
        const { getDialect } = await import('/wizards/dialects/index.js');
        const { GcodeExecutionEngine } = await import('/engine/index.js');
        // the REAL per-post WCS-write for axis X, writing the captured face coord #50 into the datum
        const wcsWrite = (d) => (typeof d.wcsWriteIndirect === 'function')
            ? ['#70=805', ...d.wcsWriteIndirect({ offset: 0, value: '#50' })]   // Expert: the #[#70+0]=#50 register idiom
            : d.setWorkOffset('#578', 'X', '#50');                              // V4.1/DM500: the G92 datum
        // datum harness: seed the captured face (#50), MOVE the tool to a post-retract position, run the real WCS-write,
        // then read the engine's resulting datum origin (machine coord of work-0). The face reads work-0 ⟺ datumX == FACE.
        const datumX = (lines, wcsBase) => {
            const eng = new GcodeExecutionEngine({ autoAnswer: true, wcsBase });
            eng.trace(['G90', `#50=${FACE}`, `G0 X${TOOL}`, ...lines].join('\n') + '\nM30');
            return eng._datumOrigin.x;
        };
        const out = {};
        for (const id of ['ddcs-expert-m350', 'ddcs-v41', 'ddcs-v3-dm500']) {
            const d = getDialect(id);
            out[id] = { form: wcsWrite(d).join(' | '), datumX: datumX(wcsWrite(d), (d.vars && d.vars.wcsBase) || null) };
        }
        // the BUGGY control (the old form): G92 X#50 (value = the machine coord, not a work value) — must MISS the datum
        out.buggy = datumX(['G90 G92 X#50'], null);
        return out;
    }, { FACE, TOOL });

    // Expert (the known-good the harness is proven against): the offset register = the face → the face reads work-0
    expect(r['ddcs-expert-m350'].datumX, 'Expert: the touched face is the datum origin (work-0)').toBeCloseTo(FACE, 3);
    // V4.1 / DM500 (the fix): the G92 [#dro - value] form lands the SAME datum — the face reads work-0
    expect(r['ddcs-v41'].datumX, 'V4.1: the touched face reads work-0 after the G92 datum').toBeCloseTo(FACE, 3);
    expect(r['ddcs-v3-dm500'].datumX, 'DM500: the touched face reads work-0 after the G92 datum').toBeCloseTo(FACE, 3);
    // prove the harness would have CAUGHT the bug: the old `G92 X#value` form lands the datum at (TOOL - FACE), NOT the face
    expect(r.buggy, 'the old buggy G92 X#value form does NOT put the face at work-0 (harness catches it)').not.toBeCloseTo(FACE, 3);
    expect(r.buggy, 'the old form lands the datum at the retracted position offset (TOOL - FACE)').toBeCloseTo(TOOL - FACE, 3);
});

/**
 * PROBE-DATUM CORRECTNESS — the Z (rawAxis) shape (t644, F4). Unlike the XY literal above, the corner/edge Z write does NOT
 * capture the trigger into a scratch var: the value is the LIVE, radius-comped trigger register `[#trig-#6]` (wcsIndirect.js
 * rawAxis path). So the G92 form is `G90 G92 Z[#dro-[#dro-#6]]` — position-DEPENDENT: it lands the correct datum ONLY when the
 * write runs AT CONTACT (live #dro == trigger), which is where cornerWizard emits it (zOnly: wcswrite right after the probe,
 * trailingRetract:false — no motion between). This asserts the touched TOP surface reads work-0 = the radius-comped contact,
 * BYTE-for-datum equal to Expert's known-good `#[#73]=[#1927-#6]`. A literal-only harness can't catch a position-dependence
 * regression here, so this case is verified explicitly.
 */
const TRIG = 100, RAD = 3;   // Z trigger DRO latched at contact; stylus ball radius (#6). comped surface = TRIG - RAD.

test('the touched TOP surface reads work-0 after the Z rawAxis WCS-write (comped trigger, at contact)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async ({ TRIG, RAD }) => {
        const { getDialect } = await import('/wizards/dialects/index.js');
        const { GcodeExecutionEngine } = await import('/engine/index.js');
        // the REAL corner-Z write: value = the live, radius-comped trigger `[#trig - #6]` (wcsIndirect rawAxis, compDir '-')
        const zWrite = (d) => {
            const value = `[${d.probeTrigVar('Z')}-#6]`;
            return (typeof d.wcsWriteIndirect === 'function')
                ? ['#70=805', ...d.wcsWriteIndirect({ offset: 2, addrVar: '#73', value })]   // Expert: the #73=[#70+2] / #[#73]=v indirect WCS-table write
                : d.setWorkOffset('#578', 'Z', value);                                        // V4.1/DM500: the G92 datum
        };
        // AT CONTACT: place the tool at machine Z = TRIG (so V4.1/DM500 DRO==trigger reads TRIG); Expert's trigger is a SEPARATE
        // latch (#1927 != DRO #882), so seed it. Then run the real write and read the datum origin Z.
        const datumZ = (d) => {
            const eng = new GcodeExecutionEngine({ autoAnswer: true, wcsBase: (d.vars && d.vars.wcsBase) || null, wcsStride: (d.vars && d.vars.wcsStride) || 5 });
            const seed = (d.vars && d.vars.probeTrig !== d.vars.dro) ? [`${d.probeTrigVar('Z')}=${TRIG}`] : [];
            eng.trace(['G90', `#6=${RAD}`, ...seed, `G0 Z${TRIG}`, ...zWrite(d), 'M30'].join('\n'));
            return eng._datumOrigin.z;
        };
        const out = {};
        for (const id of ['ddcs-expert-m350', 'ddcs-v41', 'ddcs-v3-dm500']) {
            const d = getDialect(id);
            out[id] = { form: zWrite(d).join(' | '), datumZ: datumZ(d) };
        }
        return out;
    }, { TRIG, RAD });

    // Expert (known-good): the WCS-table Z slot = the comped surface → the surface reads work-0
    expect(r['ddcs-expert-m350'].datumZ, 'Expert: the comped top surface is the Z datum origin (work-0)').toBeCloseTo(TRIG - RAD, 3);
    // V4.1 / DM500 (the fix): the at-contact G92 lands the SAME datum — the touched surface reads work-0
    expect(r['ddcs-v41'].datumZ, 'V4.1: the touched surface reads work-0 after the at-contact Z G92').toBeCloseTo(TRIG - RAD, 3);
    expect(r['ddcs-v3-dm500'].datumZ, 'DM500: the touched surface reads work-0 after the at-contact Z G92').toBeCloseTo(TRIG - RAD, 3);
});
