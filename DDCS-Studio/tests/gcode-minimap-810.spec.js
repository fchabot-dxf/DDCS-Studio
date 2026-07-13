import { test, expect } from '@playwright/test';

/**
 * t810 — G-CODE MINIMAP. A VS Code-style overview strip on the editor's right edge: a canvas of the whole program in
 * miniature (rows tinted by token class → op regions read as bands), a draggable viewport box (drag scrolls / click
 * jumps, touch-native), and an EXECUTION MARKER that tracks the running line — driven by the SAME
 * editorManager.activeLineIndex the in-text highlight consumes (ONE source), with a minimum size + glow so it reads on a
 * huge program. Toggle persists (panePrefs `ddcs_minimap`); off at phone width.
 */

const PROG = (n) => Array.from({ length: n }, (_, i) => (i % 7 === 0 ? `( @DDCS:${i} op )` : `G1 X${i} Y${i % 30} F300`)).join('\n');

async function loadProgram(page, text) {
  await page.evaluate((g) => { const e = document.getElementById('editor'); e.value = g; e.dispatchEvent(new Event('input', { bubbles: true })); }, text);
  await page.waitForTimeout(150);
}
const markerTop = (page) => page.evaluate(() => { const ex = document.querySelector('.gm-exec'); return { hidden: ex.hidden, top: parseFloat(ex.style.top) || 0, h: ex.offsetHeight }; });
const stripH = (page) => page.evaluate(() => document.querySelector('.gcode-minimap').clientHeight);

test.describe('desktop', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('renders PROPORTIONALLY for a small AND a huge program; the marker stays legible on the huge one', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.editorManager);
    // SMALL — 12 lines
    await loadProgram(page, PROG(12));
    const H = await stripH(page);
    await page.evaluate(() => window.editorManager.setActiveLine(6));
    let m = await markerTop(page);
    expect(Math.abs(m.top - (6 / 12) * H), 'small: marker sits at index/total of the strip height').toBeLessThan(2);
    // HUGE — 5000 lines
    await loadProgram(page, PROG(5000));
    const H2 = await stripH(page);
    await page.evaluate(() => window.editorManager.setActiveLine(2500));
    m = await markerTop(page);
    expect(Math.abs(m.top - (2500 / 5000) * H2), 'huge: marker still proportional').toBeLessThan(2);
    expect(m.h, 'huge: the marker keeps a MIN legible height (a row is < 1px)').toBeGreaterThanOrEqual(3);
    // the canvas actually painted (non-empty silhouette)
    const painted = await page.evaluate(() => { const c = document.querySelector('.gm-canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, Math.min(c.height, 40)).data; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true; return false; });
    expect(painted, 'the silhouette canvas is painted').toBe(true);
  });

  test('CLICK jumps + DRAG scrolls the editor via the viewport', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.editorManager);
    await loadProgram(page, PROG(400));   // long enough to scroll
    const box = await page.locator('.gcode-minimap').boundingBox();
    const top0 = await page.evaluate(() => document.getElementById('editor').scrollTop);
    // click near the BOTTOM of the strip → jumps down
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.85);
    await page.waitForTimeout(80);
    const topAfterClick = await page.evaluate(() => document.getElementById('editor').scrollTop);
    expect(topAfterClick, 'clicking low on the strip jumps the editor down').toBeGreaterThan(top0 + 50);
    // drag from bottom to top → scrolls back up
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.85);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.1, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(80);
    const topAfterDrag = await page.evaluate(() => document.getElementById('editor').scrollTop);
    expect(topAfterDrag, 'dragging the viewport up scrolls the editor back up').toBeLessThan(topAfterClick);
  });

  test('the EXECUTION MARKER tracks the running line (20× end-state) — ONE source with the in-text highlight', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.editorManager);
    const N = 200;
    await loadProgram(page, PROG(N));
    const H = await stripH(page);
    for (let k = 0; k < 20; k++) {
      const i = Math.floor((k / 20) * N);
      const got = await page.evaluate((idx) => {
        window.editorManager.setActiveLine(idx);
        const ex = document.querySelector('.gm-exec');
        // ONE source: the marker index MUST equal editorManager.activeLineIndex (never a separate tracker)
        return { top: parseFloat(ex.style.top) || 0, active: window.editorManager.activeLineIndex, inText: !!document.querySelector(`#editor-highlight .g-line[data-line-index="${idx}"].active-line`) };
      }, i);
      expect(got.active, `active index is the one source (${i})`).toBe(i);
      expect(Math.abs(got.top - (i / N) * H), `marker at (${i}/${N})·H`).toBeLessThan(2);
      expect(got.inText, 'the same index drives the in-text highlight (unchanged)').toBe(true);
    }
    // clear → marker hides (idle)
    const cleared = await page.evaluate(() => { window.editorManager.clearActiveLine(); return document.querySelector('.gm-exec').hidden; });
    expect(cleared, 'idle (activeLineIndex null) → the marker hides').toBe(true);
  });

  test('REAL MOTION: during actual playback the marker follows the executing line (why: it reads the same activeLineIndex)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.editorManager && window.setGcodeView);
    // a real, runnable program
    await loadProgram(page, ['G0 X0 Y0', 'G1 X10 F200', 'G1 Y10', 'G1 X0', 'G1 Y0', 'G0 Z5', 'G1 Z-1', 'G1 X5 Y5', 'M5'].join('\n'));
    // capture the FIRST real engine tick: the onLine seam (the ONE source) fires → the marker's DOM top at that instant
    await page.evaluate(() => {
      window.__mm = null;
      window.editorManager.onActiveLine((idx) => {
        if (idx == null || window.__mm) return;
        const ex = document.querySelector('.gm-exec'), strip = document.querySelector('.gcode-minimap');
        const n = document.getElementById('editor').value.split('\n').length;
        window.__mm = { idx, top: parseFloat(ex.style.top) || 0, H: strip.clientHeight, n, hidden: ex.hidden };
      });
    });
    await page.evaluate(() => window.setGcodeView('3d'));
    await page.waitForFunction(() => window.__gpPanel, null, { timeout: 8000 });
    await page.locator('#gcodeViz3dContainer .pp-run').first().click().catch(() => {});
    await page.waitForFunction(() => window.__mm != null, null, { timeout: 10000 });
    const s = await page.evaluate(() => window.__mm);
    // WHY: the marker never runs a second tracker — it reads editorManager.activeLineIndex, so its y = (idx/n)·H by construction
    expect(s.hidden, 'the marker is visible during motion').toBe(false);
    expect(Math.abs(s.top - (s.idx / s.n) * s.H), 'the marker sits at the executing line (idx/n·H) during real playback').toBeLessThan(3);
  });

  test('t828 placement riders: the strip is FLUSH clear of the pull-tab, the toggle is off the Copy cluster, split hugs the text pane', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && document.querySelector('.gcode-minimap') && window.setGcodeView);
    await page.waitForFunction(() => document.querySelector('.editor-container').classList.contains('has-minimap'));   // the strip is mounted + has-minimap applied (drives the pull-tab move)
    await page.waitForTimeout(300);   // layout settle
    // (1) EDITOR-ONLY (drawer closed): t828 rider 2 — the strip is FLUSH to the pane right edge (the t812 30px inset applied
    //     everywhere with nothing to dodge; now only SPLIT view insets). The pull-tab moved to the strip's LEFT so it never
    //     occludes the map. t828 rider 1 — the ▤ toggle is a real touch-target away from the top-right Copy button (was one mis-tap).
    const eo = await page.evaluate(() => {
      const s = document.querySelector('.gcode-minimap').getBoundingClientRect();
      const tab = document.querySelector('.viz3d-handle').getBoundingClientRect();
      const tog = document.querySelector('.gm-toggle').getBoundingClientRect();
      const copy = document.querySelector('#editor-copy-btn').getBoundingClientRect();
      const dist = Math.hypot((tog.left + tog.right) / 2 - (copy.left + copy.right) / 2, (tog.top + tog.bottom) / 2 - (copy.top + copy.bottom) / 2);
      return { overlaps: !(s.left >= tab.right || s.right <= tab.left), rightGap: window.innerWidth - s.right, toggleCopyDist: Math.round(dist), copyVisibleZ: getComputedStyle(document.querySelector('#editor-copy-btn')).zIndex };
    });
    expect(eo.overlaps, 'the strip never overlaps the pull-tab (the tab moved to the strip left)').toBe(false);
    expect(eo.rightGap, 'the strip is FLUSH to the pane right edge (only a scrollbar sliver; the t812 30px inset is gone)').toBeLessThan(6);
    expect(eo.toggleCopyDist, 'the minimap toggle is a real touch-target (>44px) away from the Copy button (was one mis-tap)').toBeGreaterThan(44);
    await page.locator('.editor-container').screenshot({ path: 'scratchpad/minimap-editoronly-828.png' }).catch(() => {});
    // (2) SPLIT view: the strip hugs the TEXT pane's right edge (left of the 3D pane), not the window edge — t812 clearance KEPT
    await page.evaluate(() => window.setGcodeView('3d'));
    await page.waitForTimeout(300);
    const split = await page.evaluate(() => ({ insetFromRight: window.innerWidth - document.querySelector('.gcode-minimap').getBoundingClientRect().right }));
    expect(split.insetFromRight, 'in split view the strip sits well left of the window edge (over the text pane, not the 3D pane) — t812 clearance').toBeGreaterThan(eo.rightGap + 100);
    await page.locator('.editor-container').screenshot({ path: 'scratchpad/minimap-split-828.png' }).catch(() => {});
  });

  test('the TOGGLE persists across reload (panePrefs ddcs_minimap)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && document.querySelector('.gm-toggle'));
    // ON by default
    expect(await page.evaluate(() => document.querySelector('.editor-container').classList.contains('has-minimap'))).toBe(true);
    await page.click('.gm-toggle');   // → OFF
    await page.waitForTimeout(60);
    expect(await page.evaluate(() => document.querySelector('.gcode-minimap').style.display)).toBe('none');
    expect(await page.evaluate(() => localStorage.getItem('ddcs_minimap'))).toBe('0');
    await page.reload();
    await page.waitForFunction(() => window.ddcsStudio && document.querySelector('.gcode-minimap'));
    expect(await page.evaluate(() => document.querySelector('.gcode-minimap').style.display), 'stays OFF after reload').toBe('none');
    expect(await page.evaluate(() => document.querySelector('.editor-container').classList.contains('has-minimap'))).toBe(false);
  });
});

test('PHONE width (≤600px): the minimap is off (the text keeps the full width)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && document.querySelector('.gcode-minimap'));
  const shown = await page.evaluate(() => { const s = document.querySelector('.gcode-minimap'); return s.offsetWidth > 0 && s.offsetHeight > 0; });
  expect(shown, 'the strip is hidden at phone width').toBe(false);
});

test('THEMES: the minimap renders legibly in every theme (screenshots)', async ({ page }) => {
  test.use && 0;
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.editorManager && document.querySelector('.gcode-minimap'));
  await loadProgram(page, PROG(120));
  await page.evaluate(() => window.editorManager.setActiveLine(60));
  const themes = await page.evaluate(() => { try { return (window.ddcsStudio.themeManager && window.ddcsStudio.themeManager.THEMES) || ['studio', 'normal', 'steampunk', 'futuristic', 'organic']; } catch (_) { return ['studio', 'normal', 'steampunk', 'futuristic', 'organic']; } });
  for (const th of ['studio', 'normal', 'steampunk', 'futuristic', 'organic']) {
    await page.evaluate((t) => document.body.setAttribute('data-theme', t), th);
    await page.waitForTimeout(120);
    const painted = await page.evaluate(() => { const c = document.querySelector('.gm-canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true; return false; });
    expect(painted, `theme ${th}: the minimap silhouette is painted`).toBe(true);
    await page.locator('.editor-container').screenshot({ path: `scratchpad/minimap-${th}.png` }).catch(() => {});
  }
});
