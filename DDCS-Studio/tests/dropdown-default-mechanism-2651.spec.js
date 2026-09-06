import { test, expect } from '@playwright/test';

/**
 * t2651 (BACKLOG #78 census follow-up, t2649) — THE GENERAL FIX: `ddcs_dropdown_defaults` (bridge.js) reads
 * `def.defaults[f]` into a dropdown field's VALUE at init time, closing the defect t2643 named but did not
 * generally fix (Blockly's stock `field_dropdown` has no "initial value" property — a fresh block always got
 * `options[0]`, regardless of the block's own declared default). The census (t2649, WORK-LOG) measured 19
 * registry-wide blocks silently wrong; this proves the mechanism fixes them, never touches a menu's own
 * declared order (the REJECTED alternative — reordering options — would have scrambled visible menus like
 * axis's X/Y/Z), never clobbers a real saved value, and degrades loudly rather than throwing on a bad default.
 */
test.use({ viewport: { width: 1280, height: 900 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.showApp);
    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(() => window.__blkws);
};

// The 19 genuinely-wrong cases from the t2649 census (WORK-LOG), one row per block.field.
const CASES = [
    ['probe', 'AXIS', 'Z'],
    ['machinemove', 'AXIS', 'Z'],
    ['proberead', 'AXIS', 'Z'],
    ['readmachine', 'AXIS', 'Z'],
    ['probestart', 'AXIS', 'Z'],
    ['probecheck', 'AXIS', 'Z'],
    ['contour', 'SIDE', 'on'],
    ['pocketfill', 'STRATEGY', 'concentric'],
    ['drillcycle', 'CYCLE', 'peck'],
    ['wcs', 'WCS', 'G54'],
    ['ifgoto', 'OP', '!='],
    ['corner_config', 'PROBESEQ', 'YX'],
    ['math', 'OP', '/'],
    ['waitinput', 'MODE', 'rise'],
    ['grid_container', 'GAP', '16px'],
    ['length_handle', 'AXIS', 'Y'],
    ['sc_travelapproach', 'VALUE', 'auto'],
    ['sc_axisorder', 'VALUE', 'XY'],
];

// t2651 — THE CENSUS, RE-RUN AS THE VERIFICATION INSTRUMENT (the dispatch's own explicit ask). t2649's own
// census compared `def.defaults[f]` against the RAW DECLARED option order (`optionsFor()[0]`) — a comparison
// that can never change since this fix does not touch declared option order at all (on purpose — see the file
// header). This sweep instead drives a REAL Blockly block for every dropdown field in the registry and reads
// its ACTUAL live value, which is what a person authoring in Blocks actually sees. Doubles as a standing
// regression guard: any future op def with a mismatched default fails this test immediately, the same
// "cannot silently reopen" property dropdown-domain-2393's own spec already gives the option-DOMAIN question.
test('CENSUS: every dropdown field in the registry now defaults correctly on a fresh block — 0 of 92, not 19', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { PALETTE } = await import('/wizards/ops/index.js');
        const { fieldsOf, fieldKind, fieldOptions } = await import('/blocks/blockly/bridge.js');
        const ws = window.__blkws;
        let total = 0;
        const mismatches = [];
        for (const def of PALETTE) {
            for (const f of fieldsOf(def)) {
                if (fieldKind(def, f) !== 'dropdown') continue;
                total++;
                const declared = def.defaults ? def.defaults[f] : undefined;
                if (declared === undefined) continue;
                const opts = (fieldOptions(def, f) || []).map((o) => (Array.isArray(o) ? o[1] : o));
                if (!opts.length) continue;
                let live = null, threw = false;
                try {
                    const b = ws.newBlock(def.type);
                    live = b.getFieldValue(f.toUpperCase());
                    b.dispose();
                } catch (e) { threw = true; }
                if (threw || String(live) !== String(declared)) {
                    mismatches.push({ type: def.type, field: f, declared, live, threw });
                }
            }
        }
        return { total, mismatches };
    });
    expect(r.total, 'the same 92 dropdown fields the t2649 census scanned').toBe(92);
    expect(r.mismatches, `${r.mismatches.length} block(s) still wrong: ${JSON.stringify(r.mismatches)}`).toEqual([]);
});

test('every t2649-census mismatch now defaults correctly on a fresh block', async ({ page }) => {
    await boot(page);
    const results = await page.evaluate((cases) => {
        const ws = window.__blkws;
        return cases.map(([type, field]) => {
            const b = ws.newBlock(type);
            const v = b.getFieldValue(field);
            b.dispose();
            return { type, field, v };
        });
    }, CASES);
    for (let i = 0; i < CASES.length; i++) {
        const [type, field, expected] = CASES[i];
        expect(results[i].v, `${type}.${field} defaults to its declared value, not options[0]`).toBe(expected);
    }
});

// confirm.mode's own mismatch was a TYPE mismatch, not a value one (declared 1 (number) vs options[0] "1"
// (string) — the SAME visible option, so a fresh block already looked right) — checked separately so a type
// coercion regression would still be caught even though the visible value never changed.
test('confirm.mode (the type-mismatch case) still reads "1" on a fresh block, coerced to the option string', async ({ page }) => {
    await boot(page);
    const v = await page.evaluate(() => {
        const b = window.__blkws.newBlock('confirm');
        const val = b.getFieldValue('MODE');
        b.dispose();
        return val;
    });
    expect(v).toBe('1');
});

test('feature_canvas.panel still defaults to form2d (t2643), now via the general mechanism not a per-field reorder', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(() => {
        const b = window.__blkws.newBlock('feature_canvas');
        const v = b.getFieldValue('PANEL');
        const opts = b.getField('PANEL').getOptions().map((o) => o[1]);
        b.dispose();
        return { v, opts };
    });
    expect(r.v, 'the value is still correct').toBe('form2d');
    // t2643's own per-field reorder (jsonDef's `if (f === 'panel' && def.type === 'feature_canvas')` branch) is
    // RETIRED by this turn — the general mechanism supersedes it, so the menu reverts to PANEL_TYPES' own
    // natural declared order instead of being artificially sorted to put the default first.
    expect(r.opts, 'the menu is back to its natural declared order, not reordered for the default').toEqual(['form', 'form3d', 'form2d', 'form3d+2d', 'commscreen']);
});

test('every dropdown menu keeps its own natural option order — the fix changes VALUES, never ORDER', async ({ page }) => {
    await boot(page);
    // axis is the sharpest case: X/Y/Z/A/B/C is how a machinist reads axes, and 6 of the 19 census mismatches
    // share this exact list — the dispatch's own reason for rejecting a reorder as the general fix.
    const opts = await page.evaluate(() => {
        const b = window.__blkws.newBlock('probe');
        const o = b.getField('AXIS').getOptions().map((x) => x[1]);
        b.dispose();
        return o;
    });
    expect(opts).toEqual(['X', 'Y', 'Z', 'A', 'B', 'C']);
});

test('LIVE: a real saved value survives — the mechanism never clobbers a loaded field, only a fresh one', async ({ page }) => {
    await boot(page);
    const v = await page.evaluate(() => {
        // probe.axis defaults to Z; loading a block whose SAVED state explicitly says X (a real, deliberate
        // author choice, not the bug) must keep X — proving the extension only ever fires on FRESH state,
        // never fights a real deserialized value.
        const blk = window.Blockly.serialization.blocks.append({ type: 'probe', fields: { AXIS: 'X' } }, window.__blkws);
        const val = blk.getFieldValue('AXIS');
        blk.dispose();
        return val;
    });
    expect(v, 'a saved AXIS=X round-trips as X, not reset to the declared default Z').toBe('X');
});

test('an illegal declared default cannot crash a block init — it degrades loudly, never throws', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { PALETTE } = await import('/wizards/ops/index.js');
        const def = PALETTE.find((d) => d.type === 'probe');
        const original = def.defaults.axis;
        def.defaults.axis = 'NOT_A_REAL_AXIS_VALUE';
        const warnings = [];
        const origWarn = console.warn;
        console.warn = (...args) => warnings.push(args.join(' '));
        let threw = false, value = null;
        try {
            const b = window.__blkws.newBlock('probe');
            value = b.getFieldValue('AXIS');
            b.dispose();
        } catch (e) { threw = true; }
        console.warn = origWarn;
        def.defaults.axis = original;   // restore — this mutates the live shared registry object
        return { threw, value, warned: warnings.some((w) => w.includes('NOT_A_REAL_AXIS_VALUE')) };
    });
    expect(r.threw, 'an illegal default must never throw out of block init').toBe(false);
    expect(r.value, 'falls back to the field\'s own initial value (options[0]) rather than an illegal one').toBe('X');
    expect(r.warned, 'and says so loudly, not silently').toBe(true);
});
