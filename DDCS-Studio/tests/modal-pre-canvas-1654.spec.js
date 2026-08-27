import { test, expect } from '@playwright/test';
import { waitReady } from './_boot.js';

/**
 * t1654 — a DURABLE top-level record field survives the Blockly CANVAS round-trip, not just the text one.
 *
 * t1652 declared `modalPre` (a carried modal G-word, e.g. G91 riding with a relative plunge) as a top-level
 * sibling of a leaf record's `params` — deliberately NOT a param, so blockEmitter's `resolveParams` could never
 * mistake it for a reporter-pill socket. That choice had a real cost the text-only round-trip tests could not
 * see: `stackBridge.js`'s `toRecord`/`recToJson` only ever knew about `{id,type,params,children}` (plus two
 * existing hand-special-cased fields, `collapsed` and `_expose`) — a THIRD hand-copied special case for
 * `modalPre` would have repeated the exact shape t1638 already collapsed once for block mouths. So: declared
 * once (`DURABLE_DATA_FIELDS` in stackBridge.js), read once, written once — and a record carrying an
 * UNDECLARED top-level field now throws instead of silently losing it (the same "fail loud, never silently
 * drop" standard t1638 set for children).
 *
 * Drives the REAL gesture: reconcile a pasted line into a stack (gcodeToStack.js, t1652's own mechanism), load
 * it into the actual Blockly workspace (the same path `ddcsLoadBlockStack` uses), read the workspace back out,
 * and check the re-emitted text — not a unit test of stackBridge's functions in isolation.
 */
const boot = async (page) => {
    await page.goto('/', { timeout: 30000 });
    // t2351 — the app's own declared "everything is wired" signal (t1279), not a hand-picked global subset —
    // see wizard-face-1599's own boot() for the full trace of why this class of wait was silently racy.
    await waitReady(page, () => document.documentElement.dataset.ddcsReady === '1');
    await page.evaluate(() => window.showApp && window.showApp('blocks'));
    await waitReady(page, () => !!window.__blkws);
};

test('a relative plunge (G1 G91 Z-5) keeps its G91 through the REAL editor -> stack -> canvas -> stack -> emit gesture', async ({ page }) => {
    test.setTimeout(60000);
    page.on('dialog', (d) => d.accept());
    await boot(page);

    const r = await page.evaluate(async () => {
        const { parseGcodeToStack } = await import('/blocks/gcodeToStack.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const stack1 = parseGcodeToStack('G1 G91 Z-5');   // the exact t1654 repro line
        window.ddcsLoadBlockStack(stack1);                  // stack -> the REAL Blockly workspace
        await new Promise((res) => setTimeout(res, 800));   // let the canvas settle
        const blockData = window.__blkws.getAllBlocks().map((b) => b.data).filter(Boolean);
        const stack2 = window.ddcsGetBlockProgram();        // workspace -> stack, the real read-back path
        const after = emitMapped(stack2).text;
        return { blockData, stack2, after };
    });

    expect(r.blockData.some((d) => d.includes('modalPre')), 'the block on the CANVAS itself carries modalPre in its data (not just the pre-canvas stack)').toBe(true);
    expect(r.stack2[0].modalPre, 'reading the workspace back out still carries modalPre').toEqual(['G91']);
    expect(r.after, 'the re-emitted program still carries G91 — the plunge stays RELATIVE').toContain('G91');
    expect(r.after, 'and the move itself is still there').toContain('G1');
});

test('an undeclared top-level record field FAILS LOUD on the canvas write, instead of silently vanishing', async ({ page }) => {
    test.setTimeout(60000);
    page.on('dialog', (d) => d.accept());
    await boot(page);

    // ⚠ ddcsLoadBlockStack's own write reaches stackToWorkspace through programModel.js's onChange subscriber
    // loop, which wraps EVERY subscriber in `try { fn() } catch (_) { /* a view threw */ }` — a PRE-EXISTING
    // swallow that applies just as much to t1638's own mouth-children throw as to this one (not a gap this act
    // introduces or a regression from it). Calling `stackToWorkspace` directly is the deterministic way to
    // assert the guard itself, the same layer t1638's own throw lives at.
    const r = await page.evaluate(async () => {
        const { stackToWorkspace } = await import('/blocks/blockly/stackBridge.js');
        const { parseGcodeToStack } = await import('/blocks/gcodeToStack.js');
        const stack = parseGcodeToStack('G0 X10');
        stack[0].somethingNoOneDeclared = ['nope'];   // simulate a FUTURE field nobody added to DURABLE_DATA_FIELDS
        try { stackToWorkspace(stack, window.__blkws); return { threw: false }; }
        catch (e) { return { threw: true, msg: String(e && e.message || e) }; }
    });
    expect(r.threw, 'an undeclared top-level field throws instead of being silently dropped').toBe(true);
    expect(r.msg, 'the thrown message names the offending field, so the fix is obvious').toContain('somethingNoOneDeclared');
});
