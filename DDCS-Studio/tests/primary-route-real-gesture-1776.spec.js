import { test, expect } from '@playwright/test';

/**
 * t1776 — THE PRIMARY ROUTE, END TO END, ALL REAL CLICKS.
 *
 * The audit found: 0 specs click a bar entry, 1 clicks INSERT, 0 click the Blocks tab, and the file NAMED
 * pane-visual-host-real-gesture-1762 (despite its name) drives none of them — it calls the JS functions
 * (openWiz/insertWiz) directly, never the DOM the user actually clicks. This is the first real one: click a
 * command-bar entry (through its group dropdown, which is click-to-toggle — see commandDeck.js:741 — NOT
 * hover-only), fill a distinctive value into the real form field, click the real INSERT button
 * (index.html:1156's `.wiz-foot button.primary`), click the real BLOCKS tab (`[data-app="blocks"]`,
 * index.html:136), and assert the Wizard View shows that exact value. No window.openWiz, no insertWiz, no
 * showApp anywhere in this file.
 */

test.use({ viewport: { width: 1500, height: 950 } });

test('the primary route: bar entry -> fill -> Insert -> Blocks tab -> the Wizard View shows the value', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });

    // 1) CLICK a command-bar entry. The group dropdown is click-to-toggle (commandDeck.js:741 — a real click
    // listener on the group button, not a CSS :hover rule), so a real click genuinely opens it.
    await page.locator('.dock-header .toolbar-dropdown > button.wizard-btn', { hasText: 'Probe' }).click();
    // wizItemHtml stamps data-optype from `e.type || e.opensAs || e.id` — corner's library entry declares
    // `type: 'corner'`, which wins over its `opensAs: 'user_corner_data'`, so the DOM attribute is "corner".
    const cornerEntry = page.locator('.dock-header .toolbar-dropdown-content button[data-optype="corner"]');
    await expect(cornerEntry).toBeVisible({ timeout: 5000 });
    await cornerEntry.click();

    // 2) FILL a distinctive value into a real form field (the wizard opened as the shared modal — corner's
    // panel is form3d+2d, which wizItemOnclick routes through openWiz, landing on the SAME #wiz_user_form /
    // .wiz-foot as every other bar-opened wizard).
    const distField = page.locator('#wiz_user_form [data-param="dist"]');
    await expect(distField).toBeVisible({ timeout: 5000 });
    const DISTINCTIVE = '777';
    await distField.fill(DISTINCTIVE);
    await distField.dispatchEvent('change');   // formWidgets listens on change/input to persist into the live op

    // 3) CLICK the real INSERT button (index.html:1156).
    await page.locator('.wiz-foot button.primary', { hasText: 'INSERT' }).click();

    // 4) CLICK the real BLOCKS tab (index.html:136).
    await page.locator('[data-app="blocks"]').click();
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsGetBlockProgram().length > 0, null, { timeout: 10000 });

    // 5) ASSERT the Wizard View shows THAT value — either as the live re-derived form field, or in the
    // rendered G-code preview (both are legitimate "the Wizard View shows it" surfaces; check both, report
    // which actually carries it rather than assuming).
    await page.waitForTimeout(600);   // let the pane's own render settle (async import + form build)
    const found = await page.evaluate((val) => {
        const fieldEls = Array.from(document.querySelectorAll('[data-param="dist"]'));
        const fieldMatch = fieldEls.some((el) => String(el.value) === val);
        const codeEls = Array.from(document.querySelectorAll('pre[id^="wiz_"][id$="_code"], #blk_wiz_user pre'));
        const codeText = codeEls.map((el) => el.textContent || '').join('\n');
        const codeMatch = codeText.includes(`#1=${val}`);
        return { fieldMatch, codeMatch, fieldCount: fieldEls.length, codeSnippetAround: codeText.split('\n').find((l) => /#1=/.test(l)) || null };
    }, DISTINCTIVE);

    expect(found.fieldMatch || found.codeMatch, `the Wizard View must show ${DISTINCTIVE} somewhere (field=${found.fieldMatch}, code=${found.codeMatch}, fields seen=${found.fieldCount}, code line=${found.codeSnippetAround})`).toBe(true);
});
