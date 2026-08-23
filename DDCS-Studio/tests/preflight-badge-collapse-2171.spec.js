// t2171 — THE PRE-FLIGHT BADGE COLLAPSES TO ITS ICON after 2s idle (dispatch: "make it collapse after 2 second
// both grreen or red" — every visible state collapses the same way, not just the two named colours). This came
// from the human asking whether the badge could be REMOVED entirely; the advisor argued against removal because
// in its RELATIVE-anchor (info/"green") state it is the ONLY travel check a jog-start program gets — no anchor,
// no guilty line, so the extent statement REPLACES per-line checking rather than decorating it. Collapse is the
// middle option: still there, still coloured, just narrower once the operator has had a chance to read it.
//
// THREE RULES, each with its own test below:
//   1. collapsed is NOT hidden — the colour (className) and icon survive; only the text hides. THE TEST THAT
//      MATTERS is this one: a width-only check would pass on a badge that collapsed to a colourless grey dot,
//      which is exactly the failure this feature must not have.
//   2. a STATE CHANGE re-expands and un-collapses, restarting the 2s clock (this turn's own addition, beyond
//      the literal ask — flagged in WORK-LOG, easy to overrule if the human wants a stricter always-2s clock).
//   3. never collapses while the popover is open, or while the pointer is over the badge.
import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1400, height: 950 } });

const ready = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && document.getElementById('preflight-badge'));
};

// AMBER, via the same declared/undeclared-placement path preflight-badge-838.spec.js uses — deterministic
// (settings-changed renders synchronously, no debounce race to wait out).
async function configureAmber(page) {
    const program = 'G21 G90 M3 S1000\nG1 Z3 F100';
    await page.evaluate((prog) => {
        const s = window.ddcsGetSettings();
        s.machine = s.machine || {};
        Object.assign(s.machine, { x: 300, y: 300, z: -120 });
        s.machine.wcs = { active: 1, table: null };   // undeclared placement → amber, can't verify
        const ed = document.getElementById('editor');
        ed.value = prog;
        ed.dispatchEvent(new Event('input', { bubbles: true }));
    }, program);
    const lastLine = program.trim().split('\n').pop().trim().replace(/\s+/g, ' ');
    await page.waitForFunction((t) => { const o = document.getElementById('editor-highlight'); return !!(o && o.textContent.replace(/\s+/g, ' ').includes(t)); }, lastLine, { timeout: 8000 });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('ddcs:settings-changed')));
}

// RED (whole-program) — a jog-start skim wider than the declared travel (envelope-extent-1323.spec.js's own
// SKIM/setMachine pattern), the OTHER visible-chip state besides amber/info.
const SKIM = [
    '( skim )', 'G91', 'M3 S12000', 'G1 Z-1.5 F200', 'G1 X100 F900', 'G1 Y18', 'G0 Z10.5', 'M5', 'M30',
].join('\n');
async function configureRed(page) {
    await page.evaluate((prog) => {
        const ed = document.getElementById('editor');
        ed.value = prog;
        ed.dispatchEvent(new Event('input', { bubbles: true }));
    }, SKIM);
    await page.waitForTimeout(500);
    await page.evaluate(() => {
        const S = window.ddcsGetSettings();
        S.machine = { ...(S.machine || {}), x: 60, y: 200, z: -120, wcs: { active: 1, table: [{ n: 1, x: 0, y: 0, z: 0 }] } };
        window.dispatchEvent(new Event('ddcs:settings-changed'));
    });
    await page.waitForTimeout(500);
}

const badgeState = (page) => page.evaluate(() => {
    const badge = document.getElementById('preflight-badge');
    const label = badge.querySelector('.preflight-badge-label');
    const text = badge.querySelector('.preflight-badge-text');
    const icon = badge.querySelector('.preflight-badge-icon');
    return {
        collapsed: badge.classList.contains('collapsed'),
        textDisplay: getComputedStyle(text).display,
        iconText: icon.textContent,
        bg: getComputedStyle(label).backgroundColor,
        cls: badge.className,
    };
});

test('RULE 1 — collapses to icon after 2s, and the COLOUR SURVIVES (not a width-only change)', async ({ page }) => {
    await ready(page);
    await configureAmber(page);
    const before = await badgeState(page);
    expect(before.collapsed, 'starts expanded').toBe(false);
    expect(before.textDisplay, 'text visible before the timer fires').not.toBe('none');
    expect(before.iconText.trim(), 'the icon is present').not.toBe('');

    await page.waitForTimeout(2200);
    const after = await badgeState(page);
    expect(after.collapsed, 'collapsed after 2s idle').toBe(true);
    expect(after.textDisplay, 'the TEXT span is what hides').toBe('none');
    // THE TEST THAT MATTERS: colour is unchanged by collapse — a badge that faded to a neutral/grey dot on
    // collapse would pass a width-only check and still fail the actual safety property.
    expect(after.bg, `background colour survives collapse: ${before.bg} -> ${after.bg}`).toBe(before.bg);
    // 'collapsed' is ADDED as its own class (it has to be, to select on) — the assertion is that the COLOUR
    // class survives alongside it, not that className is byte-identical.
    expect(after.cls, 'the colour-driving class is still present alongside "collapsed"').toContain('preflight-amber');
    expect(after.iconText.trim(), 'the icon itself is still there, readable at a glance').not.toBe('');
});

test('RULE 1, RED state: a whole-program breach also collapses without losing its red', async ({ page }) => {
    await ready(page);
    await configureRed(page);
    const before = await badgeState(page);
    expect(before.cls).toContain('preflight-red');
    await page.waitForTimeout(2200);
    const after = await badgeState(page);
    expect(after.collapsed).toBe(true);
    expect(after.cls).toContain('preflight-red');
    expect(after.bg).toBe(before.bg);
});

test('RULE 3 — never collapses while the popover is open', async ({ page }) => {
    await ready(page);
    await configureAmber(page);
    await page.click('#preflight-badge .preflight-badge-label');
    await expect(page.locator('.preflight-pop')).toBeVisible();
    await page.waitForTimeout(2400);   // well past the 2s window
    const s = await badgeState(page);
    expect(s.collapsed, 'stayed expanded the whole time the popover was open').toBe(false);
});

test('RULE 3 — never collapses while the pointer is over the badge; resumes on mouseleave', async ({ page }) => {
    await ready(page);
    await configureAmber(page);
    await page.hover('#preflight-badge');
    await page.waitForTimeout(2400);
    const hovered = await badgeState(page);
    expect(hovered.collapsed, 'stayed expanded while hovered, past the 2s window').toBe(false);

    await page.mouse.move(5, 5);   // move off the badge
    await page.waitForTimeout(2200);
    const after = await badgeState(page);
    expect(after.collapsed, 'collapses once the pointer leaves and the clock is allowed to run again').toBe(true);
});

test('RULE 2 — a real state change re-expands and restarts the timer (this turn\'s own addition)', async ({ page }) => {
    await ready(page);
    await configureAmber(page);
    await page.waitForTimeout(2200);
    expect((await badgeState(page)).collapsed, 'collapsed once idle').toBe(true);

    // a genuine state change: amber (can't-verify) -> red (whole-program breach) — different className AND text.
    await configureRed(page);
    const justChanged = await badgeState(page);
    expect(justChanged.collapsed, 'a real state change re-expands immediately, not waiting out an old timer').toBe(false);
    expect(justChanged.cls).toContain('preflight-red');

    await page.waitForTimeout(2200);
    expect((await badgeState(page)).collapsed, 'and the NEW state collapses on its own fresh 2s clock').toBe(true);
});

// t2176 amendment 2 (human: "the needs dimension chip doesnt close after 2 second") — REGRESSION FOUND: the
// change-detection key used to read `badge.className` DIRECTLY, and collapsing itself adds 'collapsed' to that
// SAME className — so any INCIDENTAL re-render after the 2s mark (nothing about the verdict actually changed)
// saw a "new" key purely from the collapse marker, and re-expanded. The tests above only ever proved a single,
// isolated collapse; none of them re-rendered the SAME state afterward, so none of them could have caught this.
// Fixed by excluding the collapse marker from the key (semanticClass(), preflightBadge.js). This test is what
// that fix's own absence would have failed on: fails 1/1 against the pre-fix key computation (confirmed live —
// see WORK-LOG), passes now.
test('RULE 2, THE REGRESSION IT MISSED — an UNCHANGED verdict re-rendering after collapse must not re-expand it', async ({ page }) => {
    await ready(page);
    await configureAmber(page);
    await page.waitForTimeout(2200);
    expect((await badgeState(page)).collapsed, 'collapsed once idle').toBe(true);

    // re-render the SAME amber verdict several times (programModel's onChange fires on ANY settings-changed
    // event, whether or not the computed status actually differs) — none of these is a real state change.
    for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.dispatchEvent(new CustomEvent('ddcs:settings-changed')));
        await page.waitForTimeout(150);
    }
    const s = await badgeState(page);
    expect(s.collapsed, 'an incidental re-render of the UNCHANGED verdict must not undo the collapse').toBe(true);
    expect(s.cls).toContain('preflight-amber');
});

// t2176 amendment 4B (human: "clicking the need envellop chip should collapse uncollapse, simple") — click
// REVEALS WHATEVER DETAIL EXISTS: collapsed → expand; expanded + a popover with real content (amber/red) →
// toggle the popover; expanded + no popover worth opening (the relative-anchor info note, whose popover only
// repeats the label) → a direct manual collapse, no 2s wait.
test('RULE 4 (new) — clicking a COLLAPSED badge always expands it first, regardless of state', async ({ page }) => {
    await ready(page);
    await configureAmber(page);
    await page.waitForTimeout(2200);
    expect((await badgeState(page)).collapsed).toBe(true);
    await page.click('#preflight-badge .preflight-badge-label');
    const s = await badgeState(page);
    expect(s.collapsed, 'the click expanded it').toBe(false);
});

test('RULE 4 (new) — the INFO/relative-anchor state (no popover payload): click is a plain manual toggle, no popover opens', async ({ page }) => {
    await ready(page);
    await page.evaluate(() => {
        const S = window.ddcsGetSettings();
        S.machine = { ...(S.machine || {}), x: 300, y: 200, z: -120, wcs: { active: 1, table: [{ n: 1, x: 0, y: 0, z: 0 }] } };
        window.dispatchEvent(new Event('ddcs:settings-changed'));
    });
    const SKIM_FITS = ['( skim )', 'G91', 'M3 S12000', 'G1 Z-1.5 F200', 'G1 X50 F900', 'G1 Y18', 'G0 Z10.5', 'M5', 'M30'].join('\n');
    await page.evaluate((prog) => {
        const ed = document.getElementById('editor');
        ed.value = prog;
        ed.dispatchEvent(new Event('input', { bubbles: true }));
    }, SKIM_FITS);
    await page.waitForTimeout(600);
    const before = await badgeState(page);
    expect(before.cls, 'this is the info state, not amber/red').toContain('preflight-info');
    expect(before.collapsed).toBe(false);

    // click while EXPANDED, no detail → manual collapse, immediate (not a 2s wait)
    await page.click('#preflight-badge .preflight-badge-label');
    const afterFirstClick = await badgeState(page);
    expect(afterFirstClick.collapsed, 'a click on this state collapses it directly').toBe(true);
    await expect(page.locator('.preflight-pop'), 'no popover opened — there is nothing in it beyond the label').toBeHidden();

    // click again while COLLAPSED → expands (rule: collapsed always expands first)
    await page.click('#preflight-badge .preflight-badge-label');
    const afterSecondClick = await badgeState(page);
    expect(afterSecondClick.collapsed, 'a second click expands it back — simple toggle').toBe(false);
});

test('RULE 4 (new) — an EXPANDED amber badge (has real popover detail): click still opens the popover, unchanged', async ({ page }) => {
    await ready(page);
    await configureAmber(page);
    // still expanded (well under 2s) — click should behave exactly as before this amendment
    await page.click('#preflight-badge .preflight-badge-label');
    await expect(page.locator('.preflight-pop'), 'amber HAS real detail (the reason) — the popover still opens').toBeVisible();
    const s = await badgeState(page);
    expect(s.collapsed, 'opening the popover does not collapse the badge').toBe(false);
});
