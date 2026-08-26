import { test, expect } from '@playwright/test';

/**
 * t2305 — LIVE DEFECT, owner-reported: inserting Drill emitted a header comment with a NESTED paren
 * (`( ---- DRILL, parametric: N holes (single) x peck ---- )`) — DDCS closes a comment at the FIRST `)` it
 * sees (no vendor dialect ever nests one, bridge/controllers/COMMENT-CHARACTERS.md §1: 0/2248 vendor
 * comments), so " x peck ---- )" fell OUTSIDE the comment and was parsed as G-code words. Root-caused to
 * `wizards/ops/holecycle.js` (a hardcoded template literal, not user-interpolated text — BACKLOG #22's
 * stripCommentParens sanitiser was never in this path because it only wired into sites that interpolate
 * USER text). A same-class sweep found two more: `wizards/ops/probe_titles.js`'s circular-probe title, and
 * `wizards/ops/surfaceraster.js`'s ramp-entry comment (only reachable off the non-default `entry:'ramp'`
 * arm, which is why a defaults-only check would have missed it). All three fixed by REPLACING the nested
 * parens with a vetted non-paren separator (that doc's own §2/§5 ranked list: `-` `.` `:` `=` `!` `,`), not
 * by blanket-stripping the string (which would eat an author's OWN intended punctuation elsewhere).
 *
 * THE GUARD (per the dispatch's own instruction): emit every built-in wizard, every data-op twin, every
 * raw PALETTE block, at defaults AND a light pass of branch-selecting param variants, and assert no
 * emitted line's FIRST comment ever opens a second `(` before its own `)` closes. Catches the next one.
 */

test('COMMENT NESTING GUARD: every built-in wizard, data-op twin, and raw block emits zero nested-paren comments', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);

    const r = await page.evaluate(async () => {
        const hasNested = (line) => {
            const open = line.indexOf('(');
            if (open < 0) return false;
            const close = line.indexOf(')', open);
            const secondOpen = line.indexOf('(', open + 1);
            return secondOpen >= 0 && (close < 0 || secondOpen < close);
        };
        const violations = [];

        // 1) Every built-in WIZARD STACK builder, at defaults.
        const { BUILDERS } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        for (const [opType, stackFn] of Object.entries(BUILDERS)) {
            try {
                const text = emitMapped(stackFn({})).text;
                text.split('\n').forEach((line, i) => { if (hasNested(line)) violations.push({ source: 'wizard', opType, line: i, text: line }); });
            } catch (e) { /* a builder that throws on {} is a different, pre-existing concern — not this guard's */ }
        }

        // 2) A light pass of BRANCH-SELECTING param variants — a nested paren can hide in a template literal
        //    only a non-default arm reaches (exactly how the surfaceraster.js instance above was found).
        const VARIANTS = {
            drill: [{ method: 'helical', holeDia: 12, toolDia: 6 }, { pattern: 'circle' }, { pattern: 'line' }, { pattern: 'rect' }],
            pocket: [{ shape: 'circle' }, { shape: 'polygon' }, { shape: 'ellipse' }, { strategy: 'raster' }, { entry: 'ramp' }, { entry: 'helix' }],
            surfacing: [{ strategy: 'concentric' }, { entry: 'ramp' }, { entry: 'helix' }],
            slot: [{ entry: 'ramp' }, { entry: 'helix' }],
            text: [{ align: 'center' }, { align: 'right' }],
            contour: [{ side: 'inside' }, { side: 'outside' }, { entry: 'ramp' }, { entry: 'helix' }],
            corner: [{ probeZFirst: true }, { probeZFirst: false }],
        };
        for (const [opType, variants] of Object.entries(VARIANTS)) {
            const stackFn = BUILDERS[opType];
            if (!stackFn) continue;
            for (const v of variants) {
                try {
                    const text = emitMapped(stackFn(v)).text;
                    text.split('\n').forEach((line, i) => { if (hasNested(line)) violations.push({ source: 'wizard-variant', opType, variant: v, line: i, text: line }); });
                } catch (e) { /* a variant this builder doesn't accept — not this guard's concern */ }
            }
        }

        // 3) Every registered data-op TWIN (the wizards-as-data arc), at its own DATA-level defaults.
        const dataOpModules = [
            ['drill', '/blocks/dataOps/drillData.js', 'drillDataDef', 'DRILL_DATA_OPTYPE'],
            ['bore', '/blocks/dataOps/boreData.js', 'boreDataDef', 'BORE_DATA_OPTYPE'],
            ['pocket', '/blocks/dataOps/pocketData.js', 'pocketDataDef', 'POCKET_DATA_OPTYPE'],
            ['surfacing', '/blocks/dataOps/surfacingData.js', 'surfacingDataDef', 'SURFACING_DATA_OPTYPE'],
            ['text', '/blocks/dataOps/textData.js', 'textDataDef', 'TEXT_DATA_OPTYPE'],
        ];
        const { registerUserOp } = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        for (const [name, path, defFn, optypeKey] of dataOpModules) {
            try {
                const m = await import(path);
                if (typeof m[defFn] !== 'function') continue;
                const def = m[defFn]();
                registerUserOp(def);
                const build = builderOf(m[optypeKey]);
                if (!build) continue;
                const text = emitMapped(build({})).text;
                text.split('\n').forEach((line, i) => { if (hasNested(line)) violations.push({ source: 'dataop', name, line: i, text: line }); });
            } catch (e) { violations.push({ source: 'dataop', name, error: String((e && e.message) || e) }); }
        }

        // 4) Every raw PALETTE block type, called directly with its own declared defaults — catches an atom
        //    whose `.emit` returns a plain STRING (a comment/title block) regardless of whether any current
        //    wizard stack assembles it (e.g. probe_titles.js's circular_title, unreferenced by any stack today).
        const { PALETTE } = await import('/wizards/ops/index.js');
        for (const d of PALETTE) {
            if (typeof d.emit !== 'function') continue;
            try {
                const out = d.emit(d.defaults || {}, []);
                if (typeof out === 'string') {
                    out.split('\n').forEach((line, i) => { if (hasNested(line)) violations.push({ source: 'block', type: d.type, line: i, text: line }); });
                }
            } catch (_) { /* needs a real stack/children context — covered by the wizard sweep above instead */ }
        }

        return { violations, wizardCount: Object.keys(BUILDERS).length, paletteCount: PALETTE.length };
    });

    if (r.violations.length) console.log('NESTED PAREN VIOLATIONS:\n' + JSON.stringify(r.violations, null, 2));
    expect(r.wizardCount, 'sanity: the wizard registry is not empty').toBeGreaterThan(15);
    expect(r.paletteCount, 'sanity: the block palette is not empty').toBeGreaterThan(50);
    expect(r.violations, 'no emitted line ever nests a second ( before the first ) closes').toEqual([]);
});
