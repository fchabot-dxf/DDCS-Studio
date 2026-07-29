import { test, expect } from '@playwright/test';

/**
 * t867 RIDER (ratified user t866) — the preview status chip shows the RAW EXECUTING LINE, not a paraphrase: the chip text
 * becomes "lineNumber · <verbatim source line>" (the SAME text the editor highlights — one source with onActiveLine / the
 * progress counter), end-trimmed with an ellipsis when long. The per-move paraphrase (move length, feed, per-move seconds)
 * moves to the hover TOOLTIP. The progress bar underneath is unchanged (t865).
 */
test.use({ viewport: { width: 1200, height: 800 } });

test('the chip shows "N · raw" (one source with the executing index), long lines trimmed, the paraphrase in the tooltip', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio, null, { timeout: 15000 });
    await page.evaluate(async () => {
        const { createPreviewPanel } = await import('/viz/createPreviewPanel.js');
        document.querySelectorAll('.__chip').forEach((n) => n.remove());
        // long move lines (a trailing comment) so the sampled line is guaranteed to exercise the ellipsis trim
        const lines = ['G21 G90', ...Array.from({ length: 40 }, (_, i) => `G1 X${i % 20} Y${i % 15} F450 ( pass ${i} — a deliberately long trailing comment to force the chip ellipsis trim here )`), 'M30'];
        const host = document.createElement('div'); host.className = '__chip';
        host.style.cssText = 'position:fixed;left:0;top:0;width:520px;height:360px;z-index:99999';
        document.body.appendChild(host);
        window.__lastLine = -1;
        const panel = createPreviewPanel(host, { getGcode: () => lines.join('\n'), onLine: (i) => { if (i != null) window.__lastLine = i; } });
        window.__cp = panel; window.__lines = lines;
        host.querySelector('.pp-loop').click();   // loop → stays mid-run
        host.querySelector('.pp-run').click();
    });

    // wait until the chip is showing a TRIMMED long executing line ("N · … " ending in an ellipsis)
    // t1369 — THE CHIP FORMAT HAS A DECLARED OPTIONAL TAIL, and this regex did not know about it. fmtExecLine builds
    // `N · <raw, trimmed>` and then appends `  [tag]` whenever calcTagOf finds one for the line — so the ellipsis is
    // NOT the last character of the chip, and an `…$` anchor can never match a tagged line. The sample program here
    // is all `G1 … F450`, which tags as [set], so the wait could only ever time out: stale by construction, and it
    // fails on any machine whose settings produce a tag rather than being about this branch at all.
    // The claim is unchanged — a trimmed long line, ellipsis and all — read against the format as it is declared.
    await page.waitForFunction(() => {
        const s = document.querySelector('.__chip .pp-status');
        return s && /^\d+ · .*…(\s+\[[^\]]+\])?$/.test(s.textContent);
    }, null, { timeout: 15000 });
    const snap = await page.evaluate(() => {
        const s = document.querySelector('.__chip .pp-status');
        const text = s.textContent;
        // strip the DECLARED trailing `  [tag]` before treating the rest as the raw source line (see the wait above)
        const m = text.match(/^(\d+) · (.*?)(?:\s+\[[^\]]+\])?$/);
        const n = m ? +m[1] : 0, chipRaw = m ? m[2] : '';
        return { text, n, chipRaw, progLine: String(window.__lines[n - 1] || '').trim() };
    });
    // FORMAT: "N · <raw>" — the line number leads
    expect(snap.n, 'the chip leads with the executing line number').toBeGreaterThan(0);
    // ONE SOURCE: the chip's raw text IS the verbatim program line at the executing index (what the editor highlights)
    const untrimmed = snap.chipRaw.replace(/…$/, '');
    expect(snap.progLine.startsWith(untrimmed), `chip raw is the verbatim source line ${snap.n}: chip="${snap.chipRaw}" prog="${snap.progLine}"`).toBe(true);
    // LONG-LINE TRIM: the sampled long line is ellipsis-trimmed + bounded (not the whole 100+ char line)
    expect(snap.chipRaw.endsWith('…'), `the long line is ellipsis-trimmed: "${snap.chipRaw}"`).toBe(true);
    expect(snap.chipRaw.length, 'the trimmed raw is bounded').toBeLessThanOrEqual(54);
    expect(snap.progLine.length, 'the underlying source line really is long (the trim was needed)').toBeGreaterThan(54);

    // TOOLTIP carries the OLD semantics — the per-move paraphrase (length / feed / seconds) or the line counter
    await page.waitForFunction(() => {
        const s = document.querySelector('.__chip .pp-status');
        return s && /mm at F|arc|Running line \d+\/\d+/.test(s.title || '');
    }, null, { timeout: 8000 });
    const tip = await page.evaluate(() => {
        const t = document.querySelector('.__chip .pp-status').title;
        window.__cp.stop && window.__cp.stop();
        return t;
    });
    expect(/mm at F|arc|Running line \d+\/\d+/.test(tip), `the tooltip carries the paraphrase / counter: "${tip}"`).toBe(true);
    // the paraphrase is NOT in the chip text (it moved to the tooltip)
    expect(/mm at F/.test(snap.text), 'the paraphrase is NOT in the chip text (it moved to the tooltip)').toBe(false);
});
