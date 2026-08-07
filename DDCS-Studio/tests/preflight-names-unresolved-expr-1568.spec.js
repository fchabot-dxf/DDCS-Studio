import { test, expect } from '@playwright/test';

/**
 * t1568 — THE CAUSE FINALLY GETS A READER: an unresolvable expression reaches the PRE-FLIGHT BADGE.
 *
 * t1566 made `lint.js` name the cause instead of swallowing it, and then found the channel had NO consumer —
 * `lintProgram` was called from nowhere and never had been. So the named message was real and invisible.
 *
 * The badge is the declared "warn BEFORE motion" surface and already has severity, a violation list, and a
 * row-click that jumps to the line, so it takes the second contributor rather than growing a rival surface.
 *
 * AMBER, NEVER RED, and the distinction is the point: amber means "can't verify (why)", which for this case is
 * literally true — if a coordinate never resolved, the envelope check on that line was never performed on a real
 * number. Red means "outside the envelope", a stronger claim that needs the very value we do not have.
 *
 * The QUIET half is pinned just as hard: a clean program must still say nothing. t1566 measured 1172 → 47 → 0
 * false positives at the lint layer, and that result has to survive the wiring.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

const stackWith = (xExpr) => ([
    { id: 'op1', type: 'move', params: { mode: 'rapid', x: xExpr, y: 10, z: -5, feed: 500 } },
]);

/** A machine with a DECLARED placement, so checkEnvelope can reach GREEN — otherwise it is amber for its own
 *  reason ("no WCS table pulled") and the green→amber escalation this act adds would never be exercised. */
async function declareMachine(page) {
    await page.evaluate(async () => {
        const SP = await import('/ui/settingsPanel.js');
        SP.applySettings({ stock: { x: 200, y: 120, z: 30, shape: 'box', show: true },
            machine: { x: 600, y: 600, z: -120, show: true, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: [{ x: 0, y: 0, z: 0 }] } } });
        window.dispatchEvent(new Event('ddcs:settings-changed'));
        await new Promise((r) => setTimeout(r, 200));
    });
}

async function loadAndCheck(page, stack) {
    return page.evaluate(async (s) => {
        window.ddcsLoadBlockStack(s);
        await new Promise((r) => setTimeout(r, 400));
        const res = window.ddcsPreflightCheck();
        const badge = document.getElementById('preflight-badge');
        const label = badge && badge.querySelector('.preflight-badge-label');
        return {
            status: res && res.status,
            reason: (res && res.reason) || '',
            exprRows: (res && res.violations || []).filter((v) => v.kind === 'unresolved-expr'),
            badgeHidden: badge ? badge.hidden : null,
            badgeClass: badge ? badge.className : '',
            labelText: label ? label.textContent : '',
        };
    }, stack);
}

test('a typo\'d identifier turns the badge AMBER and the list names it; a clean program stays silent', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsLoadBlockStack && window.ddcsPreflightCheck, undefined, { timeout: 30_000 });
    await declareMachine(page);

    // ── BROKEN: the identifier is named, the badge can't verify ───────────────────────────────────────────
    const bad = await loadAndCheck(page, stackWith('fedrate * 2'));
    expect(bad.status, 'an unresolvable coordinate means the envelope check could not be performed').toBe('amber');
    expect(bad.badgeClass, 'amber, never red — red is a claim we cannot support').toContain('preflight-amber');
    expect(bad.badgeHidden, 'the badge is visible').toBe(false);
    expect(bad.labelText).toContain('verify');
    expect(bad.exprRows.length, 'the expression produced its own row').toBe(1);
    expect(bad.exprRows[0].msg, 'and the row NAMES the identifier').toContain('fedrate');
    expect(bad.reason, 'the popover reason says why it could not verify').toContain('did not resolve');
    expect(bad.exprRows[0].line, 'the row carries a real line so the row-click can jump to it').toBeGreaterThan(0);

    // ── CLEAN: the 1172 -> 47 -> 0 result survives the wiring ─────────────────────────────────────────────
    const good = await loadAndCheck(page, stackWith('10 + 5'));
    expect(good.exprRows, 'valid arithmetic contributes nothing').toEqual([]);
    expect(good.status, 'with a declared machine a clean program verifies GREEN — the wiring adds no noise').toBe('green');

    const token = await loadAndCheck(page, stackWith('#7'));
    expect(token.exprRows, 'a DDCS #var rides to the controller — not ours to resolve, not a warning').toEqual([]);

    // ── the row-click lands on the line it names ──────────────────────────────────────────────────────────
    await loadAndCheck(page, stackWith('fedrate * 2'));
    const jumped = await page.evaluate(async () => {
        const badge = document.getElementById('preflight-badge');
        badge.querySelector('.preflight-badge-label').click();
        await new Promise((r) => setTimeout(r, 150));
        const row = [...badge.querySelectorAll('.preflight-row')].find((li) => li.textContent.includes('fedrate'));
        if (!row) return { found: false };
        const line = Number(row.getAttribute('data-line'));
        row.click();
        await new Promise((r) => setTimeout(r, 200));
        const ed = document.getElementById('editor');
        const upto = ed.value.slice(0, ed.selectionStart);
        return { found: true, line, caretLine: upto.split('\n').length, rowText: row.textContent };
    });
    expect(jumped.found, 'the named row is in the rendered list, not just the data').toBe(true);
    expect(jumped.rowText, 'the rendered row text names the identifier').toContain('fedrate');
    expect(jumped.caretLine, 'the row-click jumps the editor to the line the row names').toBe(jumped.line);
});

test('hand-edited G-code contributes NOTHING — a stale map must not produce confident line numbers', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsLoadBlockStack && window.ddcsPreflightCheck, undefined, { timeout: 30_000 });
    await declareMachine(page);

    const r = await page.evaluate(async () => {
        window.ddcsLoadBlockStack([{ id: 'op1', type: 'move', params: { mode: 'rapid', x: 'fedrate * 2', y: 10, z: -5, feed: 500 } }]);
        await new Promise((res) => setTimeout(res, 350));
        const withMap = (window.ddcsPreflightCheck().violations || []).filter((v) => v.kind === 'unresolved-expr').length;
        // now type over the editor so it no longer matches the projection
        const ed = document.getElementById('editor');
        ed.value = 'G0 X1 Y1\nG0 X2 Y2\nM30';
        ed.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise((res) => setTimeout(res, 700));
        const stale = (window.ddcsPreflightCheck().violations || []).filter((v) => v.kind === 'unresolved-expr').length;
        return { withMap, stale };
    });

    expect(r.withMap, 'with a valid map the expression row is present').toBe(1);
    expect(r.stale, 'once the editor diverges the map is stale — a wrong line is worse than no warning').toBe(0);
});
