import { test, expect } from '@playwright/test';

// SIM REFACTOR inc 2: passStarts is THE one declared source (computePassStarts), fed IDENTICALLY to the trace AND the
// engine. Coherence gap closed: while the sim RUNS, a live edit that changes the starts but NOT the macro (a STOCK change
// → new hints, same G-code) refreshes engine._passStarts too. (scheduleLiveRestart only re-plays on a G-CODE change, so it
// would otherwise leave the engine's per-pass starts stale — the trace path would lead the engine path.)
test.use({ viewport: { width: 1280, height: 900 } });

test('engine._passStarts stays coherent with the trace on a live STOCK edit while playing (same macro, new hints)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('middle'));
  await page.waitForSelector('#wiz_middle', { state: 'visible' });
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.engine !== undefined; });

  const r = await page.evaluate(() => {
    // boss probe-both AUTO → 2 per-pass starts ①②
    const set = (id, v, ev = 'change') => { const e = document.getElementById(id); if (!e) return; if (e.type === 'checkbox') e.checked = !!v; else e.value = v; e.dispatchEvent(new Event(ev, { bubbles: true })); };
    set('m_type', 'boss'); set('m_both', true);
    if (document.getElementById('m_inaxis')) set('m_inaxis', 'auto');
    if (document.getElementById('m_transaxis')) set('m_transaxis', 'auto');
    if (document.getElementById('m_dir')) set('m_dir', 'pos');
    if (document.getElementById('m_dir2')) set('m_dir2', 'neg');
    const stk = window.ddcsGetSettings().stock; stk.x = 100; stk.y = 80; stk.z = 20; stk.shape = 'boss'; stk.show = true;
    window.ddcsStudio.wizardManager.update();

    const panel = window.ddcsStudio.wizardManager._activePanel;
    const eng = panel.engine;
    // A known RUNNING state (the preview auto-plays; reset to a fresh play so _passStarts is the current snapshot).
    // Everything below is SYNCHRONOUS, so the engine stays running (its stepping is async) through the live edit.
    if (eng.running) panel.stop();
    panel.el.querySelector('.pp-run').click();   // fresh play → running=true, _passStarts = the current passStarts
    const running = !!eng.running;
    const before = (eng && eng._passStarts) ? eng._passStarts.map((s) => Math.round(s.y)) : null;

    // LIVE EDIT: enlarge the stock Y. The middle macro is stock-INDEPENDENT (it measures), so the G-code is UNCHANGED —
    // scheduleLiveRestart would skip; the inc2 single-feed must still refresh the engine's _passStarts.
    stk.y = 200;
    window.ddcsStudio.wizardManager.update();   // → setGcode → computePassStarts → the inc2 engine feed
    const after = (eng && eng._passStarts) ? eng._passStarts.map((s) => Math.round(s.y)) : null;
    panel.stop();
    return { running, before, after };
  });

  expect(r.running, 'the engine is running during the live edit').toBe(true);
  expect(r.before, 'boss-both auto → 2 per-pass starts').toHaveLength(2);
  expect(r.after, 'still 2 per-pass starts').toHaveLength(2);
  // ② = outside the +Y wall (dir2=neg) at sy+outset → it moves OUT when the stock Y grows. The engine saw the new starts.
  expect(r.after[1], 'engine ②.y followed the stock edit (coherent, not stale)').toBeGreaterThan(r.before[1]);
});
