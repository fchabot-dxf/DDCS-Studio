import { test, expect } from '@playwright/test';

/**
 * gateway-jobs-history-view-2026 — t2026: THE VIEW A HUMAN ACTUALLY REACHES, not just the pure
 * `historyToCSV()` function node-tested in t2024. `jobs.js` changed by +65 lines across two turns (t2020's
 * "last time" column, t2024's Export CSV button) with no Playwright spec ever RENDERING it — the
 * green-tests-over-a-dead-ui-path shape this session has hit before: the logic is tested, the surface a
 * person actually clicks is not.
 *
 * t2241 — jobs.js is gone; Jobs folded into Send (a merged queue+history list living under the send form,
 * BACKLOG amendment 7/14). Same table, now reached via the Send tab instead of a Jobs tab.
 *
 * t2649 (BACKLOG #78) — the table used to also carry Duration/Last-time columns, and a stalled-run test
 * proving "last time" skipped a stalled row's own truncated duration and linked to the real completion
 * instead. Both were derived from the removed beacon mechanism's own per-job progress signal
 * (`duration_s`/`last_beacon`/`total_beacons`) — delivery is now synchronous, so there is no "how long did
 * the cut take" signal this process can observe, and those columns/that test are removed with it (they would
 * read "—" forever if kept). The table is now job/state/finished; `resultLabel` is a bare `final_state`
 * pass-through.
 *
 * Bridges to the gateway suite's OWN established fake/offline techniques rather than inventing a third way to
 * stand a gateway up: `page.route` response mocking (gateway-quiet-offline-1307) + the navigate/click-the-tab
 * pattern (gateway-state-contract-1327). Deliberately does NOT depend on a real bridge process answering on
 * this machine — gateway-state-contract-1327's own "connected" tests `test.skip` when nothing real is
 * reachable; mocking the three endpoints this view actually calls (`/api/descriptor`, `/api/queue`,
 * `/api/history`) gets a genuinely CONNECTED, DATA-BEARING state deterministically, every run, on any machine.
 */
test.use({ viewport: { width: 1280, height: 900 } });

// Newest-first, matching what backend.list_history() really returns (poller.py sorts recorded_at DESC).
const HISTORY_ROWS = [
    { jobId: 'J2', name: 'bracket.nc', final_state: 'delivered', delivered_at: '2026-08-16T10:00:00Z', content_hash: 'HASH-A' },
    { jobId: 'J1', name: 'bracket.nc', final_state: 'delivered', delivered_at: '2026-08-15T10:00:00Z', content_hash: 'HASH-A' },
];

const boot = async (page, { historyRows = HISTORY_ROWS } = {}) => {
    // Mocked, not a real gateway — but the SAME three calls send.js's own onPoll makes, so what renders is
    // exactly what a connected bridge answering this data would produce.
    await page.route('**/api/descriptor', (route) => route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ service: 'gateway', controller_connected: true, device: 'M350' }),
    }));
    await page.route('**/api/queue', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/history*', (route) => route.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify(historyRows),
    }));
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    await page.evaluate(() => window.showApp && window.showApp('gateway'));
    await page.waitForTimeout(1500);   // the panel's own first poll
    await page.evaluate(() => {
        const t = [...document.querySelectorAll('#gateway-app .settings-main-tab')].find((b) => b.textContent.trim() === 'Send');
        if (t) t.click();
    });
    await page.waitForTimeout(900);
};

test('a human reaching History sees the finished jobs and a live Export CSV control', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(() => {
        const root = document.querySelector('#gateway-app .gw-view');
        const rows = [...root.querySelectorAll('table tr')].slice(1);   // drop the header row
        const cellsOf = (tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim());
        const exportBtn = [...root.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Export CSV');
        return {
            rowTexts: rows.map(cellsOf),
            exportPresent: !!exportBtn,
            exportDisabled: exportBtn ? exportBtn.disabled : null,
        };
    });
    expect(r.rowTexts, 'both finished jobs render as rows a person can read').toHaveLength(2);
    expect(r.rowTexts[0][0], 'the program name').toBe('bracket.nc');
    expect(r.rowTexts[0][1], 'the outcome').toBe('delivered');
    expect(r.rowTexts[0][2], 'when it finished').toBe('2026-08-16 10:00:00');
    expect(r.exportPresent, 'the Export CSV control exists on screen').toBe(true);
    expect(r.exportDisabled, 'and it is clickable, not greyed out').toBeFalsy();
});

test('with NO jobs at all (queue or history), the list says so plainly and offers no Export control to click', async ({ page }) => {
    await boot(page, { historyRows: [] });
    const r = await page.evaluate(() => {
        const root = document.querySelector('#gateway-app .gw-view');
        return {
            text: root.textContent,
            exportPresent: [...root.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Export CSV'),
            rows: root.querySelectorAll('table tr').length,
        };
    });
    // t2241 — "no finished jobs yet" (jobs.js's old, history-only wording) would now UNDERSTATE the empty
    // state: the merged list covers the live queue too, so "no jobs sent yet this session" is the honest one.
    expect(r.text, 'the empty state is stated, not a blank table').toMatch(/no jobs sent yet/i);
    expect(r.rows, 'no table at all when there is nothing to show').toBe(0);
    expect(r.exportPresent, 'no export button when there is nothing to export').toBe(false);
});

test('the Export CSV button is WIRED — clicking it actually triggers a file download, not just a click', async ({ page }) => {
    await boot(page);
    const downloadEvent = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
    await page.evaluate(() => {
        const root = document.querySelector('#gateway-app .gw-view');
        const btn = [...root.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Export CSV');
        btn.click();
    });
    const download = await downloadEvent;
    // Chromium's download manager DOES fire for an `<a download>` click on a blob: URL (UIUtils.downloadFile's
    // own mechanism) — Playwright can intercept that here. This is the honest assertion the dispatch asked
    // for: if this harness genuinely could not observe the download, the fallback below says so plainly
    // instead of quietly passing on a bare click (the exact defect shape this turn exists to close).
    expect(download, 'the click produced a real browser download, not just a DOM click').not.toBeNull();
    expect(download.suggestedFilename(), 'a dated .csv filename').toMatch(/^ddcs-job-history-.*\.csv$/);
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const csv = Buffer.concat(chunks).toString('utf-8');
    // THE ACTUAL BYTES THAT LEFT THE BROWSER, not the pure-function unit test's return value — the two rows
    // this test staged are really in the downloaded file.
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('"Job","Result","Finished"');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe('"bracket.nc","delivered","2026-08-16 10:00:00"');
    expect(lines[2]).toBe('"bracket.nc","delivered","2026-08-15 10:00:00"');
});
