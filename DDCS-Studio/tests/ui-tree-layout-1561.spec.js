import { test, expect } from '@playwright/test';

/**
 * t1561 — STEP 2: the three PURE-LAYOUT containers (group_box, grid_container, tab_group+tab_page) render for
 * real instead of falling into the unwired-placeholder branch (see ui-tree-unwired-1561.spec.js). group_box
 * REUSES the exact form-sec fold mechanism `section` already uses (same classes, same applyFold call) — no
 * second collapse implementation.
 */

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

test.describe('group_box (t1561)', () => {
    test('renders a titled, expanded-by-default card with no unwired placeholder', async ({ page }) => {
        await boot(page);
        const r = await page.evaluate(async () => {
            const m = await import('/ui/formWidgets.js');
            const host = document.createElement('div');
            const byParam = { foo: { row: (() => { const el = document.createElement('div'); el.className = 'probe-row'; return el; })(), read: () => ({ foo: 1 }) } };
            const tree = [{ type: 'group_box', params: { title: 'My Group', collapsible: true, collapsedDefault: false },
                children: { DO: [{ type: 'formfield', params: { param: 'foo' } }] } }];
            m.renderUiTree(host, tree, [], byParam);
            const sec = host.querySelector('.form-sec');
            return {
                hasPlaceholder: !!host.querySelector('.unwired-block'),
                title: sec && sec.querySelector('.form-sec-title').textContent,
                collapsed: sec && sec.getAttribute('data-collapsed'),
                hdrTag: sec && sec.querySelector(':scope > .form-sec-hdr').tagName,
                hasRow: !!host.querySelector('.probe-row'),
            };
        });
        expect(r.hasPlaceholder).toBe(false);
        expect(r.title).toBe('My Group');
        expect(r.collapsed).toBe('0');
        expect(r.hdrTag).toBe('BUTTON');
        expect(r.hasRow, 'the DO-mouth child rendered inside the card body').toBe(true);
    });

    test('collapsedDefault:true seeds the first render collapsed', async ({ page }) => {
        await boot(page);
        const collapsed = await page.evaluate(async () => {
            const m = await import('/ui/formWidgets.js');
            const host = document.createElement('div');
            const tree = [{ type: 'group_box', params: { title: 'Advanced', collapsible: true, collapsedDefault: true }, children: { DO: [] } }];
            m.renderUiTree(host, tree, [], {});
            return host.querySelector('.form-sec').getAttribute('data-collapsed');
        });
        expect(collapsed).toBe('1');
    });

    test('clicking the header toggles fold state', async ({ page }) => {
        await boot(page);
        const seq = await page.evaluate(async () => {
            const m = await import('/ui/formWidgets.js');
            const host = document.createElement('div');
            document.body.appendChild(host);
            const tree = [{ type: 'group_box', params: { title: 'Toggle Me', collapsible: true, collapsedDefault: false }, children: { DO: [] } }];
            m.renderUiTree(host, tree, [], {});
            const sec = host.querySelector('.form-sec');
            const before = sec.getAttribute('data-collapsed');
            sec.querySelector(':scope > .form-sec-hdr').click();
            const after = sec.getAttribute('data-collapsed');
            host.remove();
            return [before, after];
        });
        expect(seq).toEqual(['0', '1']);
    });

    test('collapsible:false renders a static (non-button) header, always expanded', async ({ page }) => {
        await boot(page);
        const r = await page.evaluate(async () => {
            const m = await import('/ui/formWidgets.js');
            const host = document.createElement('div');
            const tree = [{ type: 'group_box', params: { title: 'Static', collapsible: false }, children: { DO: [] } }];
            m.renderUiTree(host, tree, [], {});
            const sec = host.querySelector('.form-sec');
            return { hdrTag: sec.querySelector(':scope > .form-sec-hdr').tagName, collapsed: sec.getAttribute('data-collapsed') };
        });
        expect(r.hdrTag).toBe('DIV');
        expect(r.collapsed, 'never given a data-collapsed attribute at all, so it can never render collapsed').toBe(null);
    });
});

test.describe('grid_container (t1561)', () => {
    test('renders a CSS grid sized from its own columns/gap params, children land inside it', async ({ page }) => {
        await boot(page);
        const r = await page.evaluate(async () => {
            const m = await import('/ui/formWidgets.js');
            const host = document.createElement('div');
            const byParam = { foo: { row: (() => { const el = document.createElement('div'); el.className = 'probe-row'; return el; })(), read: () => ({ foo: 1 }) } };
            const tree = [{ type: 'grid_container', params: { columns: '3', gap: '24px' },
                children: { DO: [{ type: 'formfield', params: { param: 'foo' } }] } }];
            m.renderUiTree(host, tree, [], byParam);
            const box = host.firstElementChild;
            return { hasPlaceholder: !!host.querySelector('.unwired-block'), display: box.style.display,
                columns: box.style.gridTemplateColumns, gap: box.style.gap, rowInGrid: box.contains(host.querySelector('.probe-row')) };
        });
        expect(r.hasPlaceholder).toBe(false);
        expect(r.display).toBe('grid');
        expect(r.columns).toBe('repeat(3, 1fr)');
        expect(r.gap).toBe('24px');
        expect(r.rowInGrid, 'the DO-mouth child rendered inside the grid box, not beside it').toBe(true);
    });
});

test.describe('tab_group + tab_page (t1561)', () => {
    test('renders a tab strip; activeTab selects the initially-visible pane, others start hidden', async ({ page }) => {
        await boot(page);
        const r = await page.evaluate(async () => {
            const m = await import('/ui/formWidgets.js');
            const host = document.createElement('div');
            const byParam = {
                a: { row: (() => { const el = document.createElement('div'); el.className = 'row-a'; return el; })(), read: () => ({ a: 1 }) },
                b: { row: (() => { const el = document.createElement('div'); el.className = 'row-b'; return el; })(), read: () => ({ b: 1 }) },
            };
            const tree = [{
                type: 'tab_group', params: { activeTab: '0' },
                children: {
                    TABS: [
                        { type: 'tab_page', params: { title: 'General' }, children: { DO: [{ type: 'formfield', params: { param: 'a' } }] } },
                        { type: 'tab_page', params: { title: 'Advanced' }, children: { DO: [{ type: 'formfield', params: { param: 'b' } }] } },
                    ],
                },
            }];
            m.renderUiTree(host, tree, [], byParam);
            const btns = [...host.querySelectorAll('.wiz-tab-btn')];
            const rowA = host.querySelector('.row-a'), rowB = host.querySelector('.row-b');
            return {
                hasPlaceholder: !!host.querySelector('.unwired-block'),
                btnLabels: btns.map((b) => b.textContent),
                rowAVisible: rowA.parentElement.style.display !== 'none',
                rowBVisible: rowB.parentElement.style.display !== 'none',
            };
        });
        expect(r.hasPlaceholder).toBe(false);
        expect(r.btnLabels).toEqual(['General', 'Advanced']);
        expect(r.rowAVisible, 'tab 0 (activeTab) starts visible').toBe(true);
        expect(r.rowBVisible, 'tab 1 starts hidden').toBe(false);
    });

    test('clicking a tab button swaps which pane is visible', async ({ page }) => {
        await boot(page);
        const r = await page.evaluate(async () => {
            const m = await import('/ui/formWidgets.js');
            const host = document.createElement('div');
            const byParam = {
                a: { row: (() => { const el = document.createElement('div'); el.className = 'row-a'; return el; })(), read: () => ({ a: 1 }) },
                b: { row: (() => { const el = document.createElement('div'); el.className = 'row-b'; return el; })(), read: () => ({ b: 1 }) },
            };
            const tree = [{
                type: 'tab_group', params: { activeTab: '0' },
                children: {
                    TABS: [
                        { type: 'tab_page', params: { title: 'General' }, children: { DO: [{ type: 'formfield', params: { param: 'a' } }] } },
                        { type: 'tab_page', params: { title: 'Advanced' }, children: { DO: [{ type: 'formfield', params: { param: 'b' } }] } },
                    ],
                },
            }];
            m.renderUiTree(host, tree, [], byParam);
            host.querySelectorAll('.wiz-tab-btn')[1].click();
            const rowA = host.querySelector('.row-a'), rowB = host.querySelector('.row-b');
            return { rowAVisible: rowA.parentElement.style.display !== 'none', rowBVisible: rowB.parentElement.style.display !== 'none' };
        });
        expect(r.rowAVisible, 'tab 0 hidden after switching').toBe(false);
        expect(r.rowBVisible, 'tab 1 now visible').toBe(true);
    });

    test('activeTab="1" selects the second pane on first render', async ({ page }) => {
        await boot(page);
        const r = await page.evaluate(async () => {
            const m = await import('/ui/formWidgets.js');
            const host = document.createElement('div');
            const tree = [{
                type: 'tab_group', params: { activeTab: '1' },
                children: { TABS: [
                    { type: 'tab_page', params: { title: 'A' }, children: { DO: [] } },
                    { type: 'tab_page', params: { title: 'B' }, children: { DO: [] } },
                ] },
            }];
            m.renderUiTree(host, tree, [], {});
            const panes = [...host.querySelectorAll('.wiz-tab-strip + div > div')];
            return panes.map((p) => p.style.display !== 'none');
        });
        expect(r).toEqual([false, true]);
    });
});
