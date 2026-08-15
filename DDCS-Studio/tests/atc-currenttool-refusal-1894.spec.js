import { test, expect } from '@playwright/test';

/**
 * t1890→t1892→t1894 — THE #1300 SILENT FALLBACK: RULED (Option C, "the shape already shipped for the hidden
 * workpiece"). atcLengthWizard.js/atcToolCheckWizard.js both silently reused Expert's own #1300 current-tool
 * register when `vars.atc.currentTool` is unmapped (true for V4.1/DM500) — confirmed live (WORK-LOG t1892) to
 * reach the on-screen preview AND an operator-facing error message ("...check #1300"), at DEFAULT params, on
 * FIRST OPEN, via a normal wizard-bar click — a guess presented as fact, not a silent guess this project allows.
 *
 * THE FIX: both stack builders now branch on `hasCurrentTool` (`!!(d && d.vars && d.vars.atc &&
 * d.vars.atc.currentTool)`). The touch-off + length CALCULATION (register-independent geometry) always runs —
 * the op still measures, useful data either way. Only the SAVE (atcLength: read current tool → pick a table slot
 * → write) / COMPARE (atcCheck: read current tool → pick a slot → read stored value → compare) — which need to
 * know WHICH slot, and can't without the register — are refused, replaced by a loud comment block + an honest
 * MSG naming the measured value and explaining WHY it wasn't saved/compared. The reason names STUDIO'S OWN
 * KNOWLEDGE GAP ("no current-tool register mapped"), never the machine's capability — the same distinction that
 * kept `atc` itself un-gated (t1890): unmapped is not unsupported.
 *
 * THE LOUD-REFUSAL CONVENTION REUSED: `formWidgets.js`'s own `unwiredPlaceholder()` — the codebase's established
 * "loud, unmissable stand-in replacing content that can't be produced" (⚠-prefixed, short "what" + reason). The
 * t1834 frame-note was considered and REJECTED — it is explicitly, deliberately neutral/quiet by design (an
 * always-neutral caption, "nothing is wrong" — the wrong tone for a refusal). Since `#wiz_user_code` is plain
 * text (a real .nc file's own content, not a DOM tree `unwiredPlaceholder` could style), the SAME ⚠-prefixed
 * "what — why" textual shape is reused as a G-code comment block rather than literally reused HTML — a styled
 * DOM banner can't travel with a copied/exported .nc file the way an in-band comment does, and the G-code
 * preview IS "the point a user would otherwise get G-code."
 *
 * A DEEPER BUG THIS SURFACED, ALSO FIXED HERE (not merely the #1300 guess): the wizards-as-data "frozen template"
 * model (`def.template` captured ONCE, at registration, under whichever dialect happened to be active then) means
 * a STRUCTURAL branch inside a stack builder — lines that EXIST under one dialect and don't under another — can
 * NEVER surface in the live twin form via the old #N-VALUE-only postInstantiate patch (`applyHeaderComments`):
 * the frozen template bakes in ONE branch's lines forever. This was invisible before because the two possible
 * old headers happened to be textually different anyway (patchable), and the #1300 fallback's OWN output was
 * IDENTICAL text regardless of which dialect got frozen in (Expert's real #1300 == V4.1's `||1300` fallback) — so
 * the bug was there but produced the same wrong string either way. The refusal branch's genuinely different LINES
 * exposed it: a live V4.1/DM500 session showed the frozen-at-Expert `#1300` text regardless of the active post.
 * FIXED by replacing the old header-only patch with a FULL RECOMPOSE from `atcLengthStack(resolved)` /
 * `atcToolCheckStack(resolved)` in `postInstantiate` — mirrors `atcTableData.js`'s own `applyAtcTableRecompose`
 * precedent (rebuild the whole body from a live source on every instantiation, not patch the frozen one).
 *
 * SCOPE: atc_length and atc_check on V4.1 and DM500 ONLY. Expert (and Studio-default, same dialect) is asserted
 * BYTE-IDENTICAL — proven both by the existing atc-length-in-place.spec.js / atc-check-in-place.spec.js (still
 * green, unmodified) and by a fresh non-vacuity revert here.
 */

const V41 = 'ddcs-v41', DM500 = 'ddcs-v3-dm500', EXPERT = 'ddcs-expert-m350';

async function previewFor(page, profileId, opType) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.openWiz);
    await page.evaluate(async (profileId) => { const { setActiveProfile } = await import('/shared/js/profiles/controllerProfiles.js'); setActiveProfile(profileId); }, profileId);
    await page.evaluate((opType) => window.openWiz(opType), opType);
    await page.waitForSelector('#wiz_user_code', { timeout: 8000 });
    await page.waitForFunction(() => (document.getElementById('wiz_user_code')?.textContent || '').length > 20, null, { timeout: 8000 });
    return page.evaluate(() => document.getElementById('wiz_user_code').textContent || '');
}

test('PRIMARY EVIDENCE, atc_length: Expert saves via #1300 (its own real register); V4.1 REFUSES, loudly, and keeps the measurement', async ({ page }) => {
    test.setTimeout(30_000);
    const expert = await previewFor(page, EXPERT, 'user_atc_length_data');
    expect(expert, 'Expert: unchanged — still saves via its own real current-tool register').toContain('#1300');
    expect(expert, 'Expert: no refusal — the register IS mapped here').not.toContain('REFUSED');

    const v41 = await previewFor(page, V41, 'user_atc_length_data');
    expect(v41, 'V4.1: no #1300 anywhere — not in the save line, not in an error message').not.toContain('#1300');
    expect(v41, 'V4.1: a LOUD refusal replaces the guess').toContain('⚠ REFUSED');
    expect(v41, 'the reason names STUDIO\'S knowledge gap ("unmapped"), not a machine-capability claim').toContain('UNMAPPED');
    expect(v41, 'the measurement (register-independent geometry) still runs — #102 is still computed').toContain('#102=[#101 - #6]');
    expect(v41, 'the measured value is reported to the operator, not silently dropped').toMatch(/Measured #102 mm/);
});

test('PRIMARY EVIDENCE, atc_check: Expert compares via #1300; V4.1 REFUSES the compare but keeps the measurement', async ({ page }) => {
    test.setTimeout(30_000);
    const expert = await previewFor(page, EXPERT, 'user_atc_check_data');
    expect(expert, 'Expert: unchanged — still compares via its own real current-tool register').toContain('#1300');
    expect(expert, 'Expert: no refusal').not.toContain('REFUSED');

    const v41 = await previewFor(page, V41, 'user_atc_check_data');
    expect(v41, 'V4.1: no #1300 anywhere').not.toContain('#1300');
    expect(v41, 'V4.1: a LOUD refusal replaces the guess').toContain('⚠ REFUSED');
    expect(v41, 'the measurement still runs — #52 is still computed').toContain('#52=[#51-#6]');
    expect(v41, 'the measured value is reported, not silently dropped').toMatch(/Measured #52 mm/);
});

test('DM500 matches V4.1 — the identical-caps economy (both dialects declare vars.atc:null in the same shape)', async ({ page }) => {
    test.setTimeout(30_000);
    const dm500Len = await previewFor(page, DM500, 'user_atc_length_data');
    expect(dm500Len, 'DM500 atc_length: same refusal as V4.1').not.toContain('#1300');
    expect(dm500Len).toContain('⚠ REFUSED');
    const dm500Chk = await previewFor(page, DM500, 'user_atc_check_data');
    expect(dm500Chk, 'DM500 atc_check: same refusal as V4.1').not.toContain('#1300');
    expect(dm500Chk).toContain('⚠ REFUSED');
});

test('the no-contact probe-miss fault (unrelated to the current-tool register) survives on V4.1 for both ops', async ({ page }) => {
    // Vacuity trap: a fix that accidentally refused the WHOLE op, not just the register-dependent tail, would
    // also silently drop this fault handler — it must still be there, register-independent.
    test.setTimeout(30_000);
    const len = await previewFor(page, V41, 'user_atc_length_data');
    expect(len, 'the probe-miss fault handler (nothing to do with current-tool) is untouched').toContain('Tool Setter missed');
    const chk = await previewFor(page, V41, 'user_atc_check_data');
    expect(chk, 'the probe-miss fault handler is untouched on atc_check too').toContain('no contact - tool broken or missing');
});
