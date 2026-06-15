import { test, expect } from '@playwright/test';

// Follow-cam + animated trail + on-open defaults.
//  - Opening a preview defaults to centre-lock (follow-cam ON) and auto-play in a loop (Settings → Preview).
//  - The bold "executed" trail grows by a PARTIAL current segment whose tip sits exactly on the tool head,
//    instead of revealing whole segments at a time (which read as a visibility toggle).
test.use({ viewport: { width: 1280, height: 900 } });

const openDrill = async (page) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForFunction(() => {
    const p = window.ddcsStudio.wizardManager._activePanel;
    return p && p.viz && p.viz._animSegs && p.viz._animSegs.length;
  });
};

test('preview opens with centre-lock + auto-loop on (the on-open defaults)', async ({ page }) => {
  await openDrill(page);
  await page.waitForTimeout(200);   // let autoStartOnOpen → play() spin up the engine
  const r = await page.evaluate(() => {
    const panel = window.ddcsStudio.wizardManager._activePanel;
    const root = panel.el;
    const followBtn = root.querySelector('.pp-follow');
    const loopBtn = root.querySelector('.pp-loop');
    return {
      followVisible: followBtn && getComputedStyle(followBtn).display !== 'none',
      followLit: followBtn && followBtn.classList.contains('on'),
      followCam: !!panel.viz.followCam,
      loopLit: loopBtn && loopBtn.classList.contains('on'),
      running: !!(panel.engine && panel.engine.running),
    };
  });
  expect(r.followVisible, 'follow-cam button shows in 3D').toBeTruthy();
  expect(r.followLit, 'follow-cam button is lit on open').toBeTruthy();
  expect(r.followCam, 'viz follow-cam is enabled on open').toBeTruthy();
  expect(r.loopLit, 'loop button is lit on open').toBeTruthy();
  expect(r.running, 'engine auto-plays on open').toBeTruthy();
});

test('bold trail draws a partial current segment ending on the tool head (animated, not a toggle)', async ({ page }) => {
  await openDrill(page);
  const r = await page.evaluate(() => {
    const panel = window.ddcsStudio.wizardManager._activePanel;
    panel.stop();                       // stop the auto-play so our manual setToolPosition isn't fought by the engine
    const v = panel.viz;
    const segs = v._animSegs;
    // a segment long enough that its midpoint is clearly not an endpoint
    const s = segs.find((g) => Math.hypot(g.bx - g.ax, g.by - g.ay, g.bz - g.az) > 0.5) || segs[0];
    const segLen = Math.hypot(s.bx - s.ax, s.by - s.ay, s.bz - s.az);
    const mid = { x: (s.ax + s.bx) / 2, y: (s.ay + s.by) / 2, z: (s.az + s.bz) / 2 };
    const o = v.starts[0] || { x: 0, y: 0, z: 0 };   // setToolPosition re-applies the start offset, so feed RAW coords
    v.setToolPosition({ x: mid.x - o.x, y: mid.y - o.y, z: mid.z - o.z });
    const pos = v._trailLine.geometry.getAttribute('position');
    const idx = v._trailTipIdx;
    const tip = idx != null ? { x: pos.getX(idx), y: pos.getY(idx), z: pos.getZ(idx) } : null;
    const dMid = tip ? Math.hypot(tip.x - mid.x, tip.y - mid.y, tip.z - mid.z) : 999;
    const dEnd = tip ? Math.hypot(tip.x - s.bx, tip.y - s.by, tip.z - s.bz) : 999;
    return { segLen, dMid, dEnd, drawCount: v._trailLine.geometry.drawRange.count };
  });
  expect(r.drawCount, 'trail is being drawn').toBeGreaterThan(0);
  expect(r.dMid, 'trail tip sits ON the tool head (partial segment)').toBeLessThan(0.05);
  expect(r.dEnd, 'trail tip is NOT snapped to the segment endpoint').toBeGreaterThan(0.1);
});

test('Settings → Preview exposes the on-open + damping controls and they persist', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetSettings && window.openSettings);
  await page.evaluate(() => window.openSettings());
  await page.waitForFunction(() => !!document.getElementById('set_pv_autoloop'));
  // the Preview tab + its controls are rendered (tab content is display:none until selected, but present in the DOM)
  const r = await page.evaluate(() => ({
    tab: !!document.querySelector('.settings-tab[data-target="set_tab_preview"]'),
    controls: ['set_pv_follow_default', 'set_pv_autoloop', 'set_pv_followdamp'].every((id) => !!document.getElementById(id)),
  }));
  expect(r.tab, 'Preview sidebar tab present').toBeTruthy();
  expect(r.controls, 'on-open + damping controls present').toBeTruthy();

  // toggle auto-loop off → persisted to settings.preview.autoLoop (drive the input directly; the overlay
  // intercepts real clicks in the headless harness)
  await page.evaluate(() => { const c = document.getElementById('set_pv_autoloop'); c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForTimeout(80);
  const saved = await page.evaluate(() => window.ddcsGetSettings().preview.autoLoop);
  expect(saved, 'auto-loop setting persisted').toBe(false);
});
