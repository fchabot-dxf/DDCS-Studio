import { test, expect } from '@playwright/test';

/**
 * t1271 — split from lathe-pilot-1271.spec.js at the t2689 tier migration (batch 2). Every other test in that file
 * moved to tests/node/lathe-pilot-1271.test.mjs; this one stayed because it builds a real `<button>` via `innerHTML`
 * and finds it with `host.querySelector('[data-optype="pocket"]')` — the node tier's document is structural-only
 * (innerHTML is a plain string property, querySelector always returns null), so it needs a real browser DOM.
 */
test.use({ viewport: { width: 1280, height: 900 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsSetMachine, null, { timeout: 15000 });
};

test('(4) THE GATING IS APPLIED AND REVERSIBLE — greyed, never hidden, and it comes back', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const G = await import('/ui/axisGating.js');
        const M = await import('/data/workspaceMachine.js');
        // two entries as the bar renders them
        const host = document.createElement('div');
        host.innerHTML = '<button data-optype="pocket" title="Pocket">Pocket</button>'
                       + '<button data-optype="user_lathe_facing" title="Facing">Facing</button>';
        document.body.appendChild(host);

        M.setMachine({ kind: 'lathe' }, false);
        G.applyAxisGating(host);
        const pocket = host.querySelector('[data-optype="pocket"]');
        const facing = host.querySelector('[data-optype="user_lathe_facing"]');
        const gated = {
            pocketGated: pocket.classList.contains('axis-gated'),
            pocketVisible: getComputedStyle(pocket).display !== 'none',   // GREY, not hidden
            pocketTitle: pocket.title,
            facingGated: facing.classList.contains('axis-gated'),
        };
        M.setMachine({ kind: 'mill' }, false);
        G.applyAxisGating(host);
        const restored = { pocketGated: pocket.classList.contains('axis-gated'), pocketTitle: pocket.title };
        host.remove();
        return { gated, restored };
    });
    expect(r.gated.pocketGated, 'the impossible op is greyed').toBe(true);
    expect(r.gated.pocketVisible, 'and STILL THERE — hiding would answer a question nobody asked').toBe(true);
    expect(r.gated.pocketTitle, 'the tooltip is the whole explanation').toMatch(/needs a Y axis/);
    expect(r.gated.facingGated, 'the lathe op is not greyed').toBe(false);
    expect(r.restored.pocketGated, 'switching back to a mill un-greys it').toBe(false);
    expect(r.restored.pocketTitle, 'and its own tooltip returns').toBe('Pocket');
});
