import { test, expect } from '@playwright/test';

/**
 * t1585 — THE SEND GATE: refuse what the CONTROLLER would refuse, judged FROM THE FILE.
 *
 * The close of the arc. Studio no longer launders a broken expression at any layer, so the author's text now
 * reaches the file — and the file is what gets pushed. Bench-confirmed on the V4.1: the controller answers
 * `Unrecognized file format: L<n>[<line>]`, and probe S6e proved it runs every line BEFORE the fault first. So
 * pushing one of these does not simply fail: the operations ahead of it CUT, then the machine halts with the tool
 * in the material. That is the cost the gate exists to prevent.
 *
 * JUDGED FROM THE FILE, not from Studio's memory of building it — `send.js` pushes an ARBITRARY file (imported,
 * hand-edited, authored elsewhere), so block-side knowledge is absent exactly when it matters most. The gate uses
 * `defaultSyntaxVerify`, the same parser the sim runs.
 *
 * ⚠ THE TOLERANCE IS ASYMMETRIC. Too STRICT = a FALSE REFUSAL that stops real work. Too LENIENT = waves through a
 * file the controller rejects, which is merely where we already were. They are not equally bad, so the MUST-NOT-
 * REFUSE half below is the load-bearing half of this spec: a gate that refuses everything looks like it works.
 */
const verify = async (page, text) => page.evaluate(async (t) => {
    const { GcodeExecutionEngine } = await import('/engine/GcodeExecutionEngine.js');
    const r = GcodeExecutionEngine.defaultSyntaxVerify(t);
    const byLine = new Map();
    for (const e of r.errors) if (!byLine.has(e.lineIndex)) byLine.set(e.lineIndex, e);
    return { valid: r.valid, lines: [...byLine.keys()].map((i) => i + 1), rows: [...byLine.values()].map((e) => `line ${e.lineIndex + 1}: ${String(e.line || '').trim()}`) };
}, text);

test('the gate REFUSES an unreadable file and names the line the controller would name', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram, undefined, { timeout: 20_000 });

    // the emit this arc now produces for a typo'd identifier — the case the whole family was about
    const emitted = await verify(page, 'G90\nG0 X10 Y10\nG0 Xwidht / 2 Y20 Z-5\nG0 Z5\nM30');
    expect(emitted.valid, 'a file carrying the author\'s unreadable text must not be waved through').toBe(false);
    expect(emitted.lines, 'and the offending LINE is named — one row, not one per letter').toEqual([3]);
    expect(emitted.rows[0], 'the row quotes the line back, the way the controller does').toContain('G0 Xwidht / 2');

    // the two forms the V4.1 refused on the bench, by their real strings
    const s6a = await verify(page, '#190 = -99999\n#191 = 1234\n#190 = #191k8\nM30');
    expect(s6a.valid, 'S6a — the controller answered "Unrecognized file format"').toBe(false);
    expect(s6a.lines).toEqual([3]);

    const s6b = await verify(page, '#190 = [1 + 2 k 8]\nM30');
    expect(s6b.valid, 'S6b — likewise').toBe(false);

    // a bare unreadable token, which is what an unresolvable loop bound / IF condition now emits
    const bare = await verify(page, 'G90\nG0 X1 Y1\nnosuch\nM30');
    expect(bare.valid).toBe(false);
    expect(bare.lines, 'one row for the one bad line').toEqual([3]);
});

test('⚠ the gate must NOT refuse: a clean file, or one using RUNTIME values', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram, undefined, { timeout: 20_000 });

    const clean = await verify(page, 'G90\nG0 X10 Y10\nG1 Z-2 F300\nG0 Z5\nM30');
    expect(clean.valid, 'an ordinary program sends — a gate that refuses everything only LOOKS like it works').toBe(true);
    expect(clean.rows).toEqual([]);

    // ⚠ RUNTIME TOKENS. Unknowable at authoring time BY DESIGN; the controller reads them at run time. Fifth act
    // running for this carve-out, and the one thing a false refusal here would break is a legitimate workflow.
    const runtime = await verify(page, 'G90\nG0 X#500 Y10\nG1 Z#1512 F300\nM30');
    expect(runtime.valid, 'a #var coordinate is a runtime value, not an unreadable line').toBe(true);

    const probe = await verify(page, 'G90\nG31 Z-20 F50\n#100 = #5063\nG0 Z[#100 + 5]\nM30');
    expect(probe.valid, 'a probe result and a bracketed expression over it must send').toBe(true);

    // the comma form — this is WHY t1583 had to land before this gate. Before it, the parser rejected a form the
    // hardware ACCEPTS (probe S5o), so this very gate would have refused a legitimate job on day one.
    const comma = await verify(page, '#190 = ATAN[1, 1] * 100\nM30');
    expect(comma.valid, 'ATAN[a, b] is hardware-attested and must send').toBe(true);

    const comments = await verify(page, '( a comment )\nG90 ( trailing )\nM30');
    expect(comments.valid, 'comments are not code').toBe(true);
});

test('the KNOWN leniency is named, not silently assumed away', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram, undefined, { timeout: 20_000 });

    // An unclosed bracket still PARSES, so the gate lets it through. That is deliberate, not an oversight: probe
    // S6f is written and waiting to say what the machine does, and guessing tight would risk a false refusal —
    // the one failure mode this gate cannot have. Pinned so the day S6f comes back, this assertion is the
    // reminder that a decision is owed here.
    const unclosed = await verify(page, '#190 = [1 + 2\nM30');
    expect(unclosed.valid, 'KNOWN LENIENCY: an unclosed bracket still passes — S6f will settle it').toBe(true);
});
