import { test, expect } from './support/harness.mjs';

/**
 * t2141 — MACHINE-SAFETY FIX: CAM slot macros bypass BOTH DDCS-syntax guards. The generator arms
 * (`opToSlot.js`/`millToSlot.js`) build G-code TEXT directly — `surfaceRasterLines`' own output among it —
 * bypassing `emitMapped` entirely, so neither the flush-left strip nor the inline-`IF…THEN` rewrite ever ran
 * on a `camN.nc`. Both are bench-confirmed HARD SYNTAX ERRORS on the DDCS Expert (t2070). VERIFIED BY RUNNING
 * IT (not inferred): a default rect-pocket CAM slot, before this fix, emitted 28 indented lines (6 of them
 * indented N-labels) and at least one inline `IF … THEN var=val`.
 *
 * THE FIX runs both passes ONCE, at the `slotMacro` boundary, on the FULLY COMPOSED body (after
 * `composeParts` has already joined every part) — never per-part, because `applyInlineClampSkip`'s own label
 * allocator mints new labels by scanning the CURRENT max; running it before composition lets two parts
 * independently mint the SAME label, which the controller loads without complaint and then jumps to the
 * wrong place — a wrong-cut bug, strictly worse than a refused file. This spec builds a real MULTI-PART pack
 * (a rect pocket + a packed slot, both `surfaceRasterLines`-based) through the REAL export path
 * (`slotFromOp`/`pocketSlot` → `composeParts` → `slotMacro`) and asserts the label-uniqueness guarantee
 * directly, not just "the output looks flush."
 *
 * NODE-TIER CONVERSION: every test is pure (page.evaluate imports + returns data, plain expect() on it) — moved
 * whole, no behavioural change.
 */

test('a composed rect-pocket + packed-slot CAM macro, through the DDCS Expert dialect: flush-left, no inline IF..THEN, every N-label unique', async ({ page }) => {
    await page.goto('http://localhost:3211', { timeout: 30000 });
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { pocketSlot } = await import('/data/millToSlot.js');
        const { slotFromOp } = await import('/data/opToSlot.js');
        const { composeParts, slotMacro } = await import('/data/slotPack.js');
        const { getDialect } = await import('/wizards/dialects/index.js');

        const used = new Set();
        const a = pocketSlot(used, 0);                              // a default rect-pocket CAM generator body
        a.fields.forEach((f) => used.add(f.idx));
        const b = slotFromOp('slot', 'single', used, a.fields.length);   // the packed slot arm — also surfaceRasterLines-based

        const body = composeParts([a.body, b.body]);
        const dialect = getDialect('ddcs-expert-m350');
        const macro = slotMacro({ slot: 22, name: 'pocket+slot', fields: [...a.fields, ...b.fields], body }, dialect);

        const indented = macro.split('\n').filter((ln) => ln.length && /^[ \t]/.test(ln));
        const inlineThen = macro.split('\n').filter((ln) => /\bIF\b.*\bTHEN\b.*=/.test(ln));
        const labels = [...macro.matchAll(/^\s*N(\d+)\b/gm)].map((m) => Number(m[1]));
        const dupes = labels.filter((n, i) => labels.indexOf(n) !== i);

        return { macroLen: macro.length, indentedCount: indented.length, indentedSample: indented.slice(0, 5),
            inlineThenCount: inlineThen.length, inlineThenSample: inlineThen.slice(0, 3),
            labelCount: labels.length, dupeLabels: [...new Set(dupes)] };
    });
    expect(r.indentedCount, `no emitted line may start with whitespace — found: ${JSON.stringify(r.indentedSample)}`).toBe(0);
    expect(r.inlineThenCount, `no inline IF..THEN assignment may survive — found: ${JSON.stringify(r.inlineThenSample)}`).toBe(0);
    expect(r.labelCount, 'sanity: the composed macro actually declares N-labels (not a vacuous check)').toBeGreaterThan(0);
    expect(r.dupeLabels, 'every N-label in the joined macro must be UNIQUE — a duplicate is the wrong-cut hazard').toEqual([]);
});

test('a single-part CAM slot (no composeParts) also gets both guards — the fix is not composition-only', async ({ page }) => {
    await page.goto('http://localhost:3211', { timeout: 30000 });
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { pocketSlot } = await import('/data/millToSlot.js');
        const { slotMacro } = await import('/data/slotPack.js');
        const { getDialect } = await import('/wizards/dialects/index.js');
        const s = pocketSlot();
        const dialect = getDialect('ddcs-expert-m350');
        const macro = slotMacro({ slot: 10, name: s.name, fields: s.fields, body: s.body }, dialect);
        const indented = macro.split('\n').filter((ln) => ln.length && /^[ \t]/.test(ln));
        const inlineThen = macro.split('\n').filter((ln) => /\bIF\b.*\bTHEN\b.*=/.test(ln));
        return { indentedCount: indented.length, inlineThenCount: inlineThen.length };
    });
    expect(r.indentedCount, 'flush-left applies to a single-part slot too').toBe(0);
    expect(r.inlineThenCount, 'the inline-THEN rewrite applies to a single-part slot too').toBe(0);
});

test('a PROBE arm (cornerSlot — word-operator corner-select clamps, not a mill loop) also gets the inline-THEN fix', async ({ page }) => {
    await page.goto('http://localhost:3211', { timeout: 30000 });
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { cornerSlot } = await import('/data/probeToSlot.js');
        const { slotMacro } = await import('/data/slotPack.js');
        const { getDialect } = await import('/wizards/dialects/index.js');
        const s = cornerSlot();
        const dialect = getDialect('ddcs-expert-m350');
        const macro = slotMacro({ slot: 11, name: s.name, fields: s.fields, body: s.body }, dialect);
        const indented = macro.split('\n').filter((ln) => ln.length && /^[ \t]/.test(ln));
        const inlineThen = macro.split('\n').filter((ln) => /\bIF\b.*\bTHEN\b.*=/.test(ln));
        const labels = [...macro.matchAll(/^\s*N(\d+)\b/gm)].map((m) => Number(m[1]));
        const dupes = labels.filter((n, i) => labels.indexOf(n) !== i);
        return { indentedCount: indented.length, inlineThenCount: inlineThen.length,
            inlineThenSample: inlineThen.slice(0, 3), dupeLabels: [...new Set(dupes)] };
    });
    expect(r.indentedCount, 'flush-left applies to a probe arm too').toBe(0);
    expect(r.inlineThenCount, `the inline-THEN rewrite applies to a PROBE arm too (cornerSlot's word-operator corner-select clamps) — found: ${JSON.stringify(r.inlineThenSample)}`).toBe(0);
    expect(r.dupeLabels, 'no colliding N-labels introduced by the rewrite').toEqual([]);
});

test('a non-DDCS dialect (grbl — accepts inline THEN) is left alone; flush still applies unconditionally', async ({ page }) => {
    await page.goto('http://localhost:3211', { timeout: 30000 });
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { pocketSlot } = await import('/data/millToSlot.js');
        const { slotMacro } = await import('/data/slotPack.js');
        const { getDialect } = await import('/wizards/dialects/index.js');
        const s = pocketSlot();
        const macro = slotMacro({ slot: 10, name: s.name, fields: s.fields, body: s.body }, getDialect('grbl'));
        const indented = macro.split('\n').filter((ln) => ln.length && /^[ \t]/.test(ln));
        const inlineThenSurvived = macro.split('\n').some((ln) => /\bIF\b.*\bTHEN\b.*=/.test(ln));
        return { indentedCount: indented.length, inlineThenSurvived };
    });
    expect(r.indentedCount, 'flush is dialect-independent — grbl gets it too').toBe(0);
    expect(r.inlineThenSurvived, 'grbl accepts the inline THEN form, so the rewrite correctly does not fire for it').toBe(true);
});
