import { test, expect } from '@playwright/test';

// The ViewCube only snapped on an exact box-silhouette hit; the cube viewport square's corners (around the
// rotated box) were a dead zone. A click anywhere in the square now snaps to the nearest VISIBLE face.
test.use({ viewport: { width: 1280, height: 900 } });

test('clicking a corner of the cube viewport square (off the box) still snaps the view', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForFunction(() => {
    const p = window.ddcsStudio.wizardManager._activePanel;
    return p && p.viz && p.viz._cubeRect && p.viz.renderer;
  });

  const r = await page.evaluate(() => {
    const viz = window.ddcsStudio.wizardManager._activePanel.viz;
    viz.theta = 0.6; viz.phi = 0.9; viz._applyCamera(); viz.render();   // a clearly non-cardinal orientation
    const before = { theta: viz.theta, phi: viz.phi };
    const rect = viz.renderer.domElement.getBoundingClientRect();
    const { size, m } = viz._cubeRect;
    // top-right corner of the cube square — near the square edge, off the rotated box silhouette
    const e = { clientX: rect.left + rect.width - m - 2, clientY: rect.top + m + 2 };
    const consumed = viz._pickCube(e);
    return { before, consumed, after: { theta: viz.theta, phi: viz.phi } };
  });

  expect(r.consumed, 'a click in the cube square is handled (not passed to orbit)').toBeTruthy();
  const moved = Math.abs(r.before.theta - r.after.theta) + Math.abs(r.before.phi - r.after.phi);
  expect(moved, 'the corner click snapped the camera to a face view').toBeGreaterThan(0.05);
});

// Clicking a CUBE CORNER (the box vertices) orients the camera to a 45° isometric direction — reachable even from
// an orthographic FACE view (so you can get back to iso without orbiting by hand).
test('clicking a cube corner snaps to a 45° iso view (from an ortho face view too)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForFunction(() => {
    const p = window.ddcsStudio.wizardManager._activePanel;
    return p && p.viz && p.viz._cubeRect && p.viz.renderer;
  });

  const r = await page.evaluate(() => {
    const viz = window.ddcsStudio.wizardManager._activePanel.viz;
    viz.setView('top');   // start on an orthographic FACE view (phi≈0)
    viz.render();
    const before = { theta: viz.theta, phi: viz.phi, ortho: !!viz._ortho };
    // Project the cube's +X+Y+Z corner to screen and click it.
    const THREE = viz.THREE;
    const rect = viz.renderer.domElement.getBoundingClientRect();
    const { size, m } = viz._cubeRect;
    const left = rect.width - size - m, top = m;
    const v = new THREE.Vector3(0.5, 0.5, 0.5).project(viz._cubeCam);
    const sx = rect.left + left + (v.x * 0.5 + 0.5) * size;
    const sy = rect.top + top + (-v.y * 0.5 + 0.5) * size;
    const consumed = viz._pickCube({ clientX: sx, clientY: sy });
    return { before, consumed, after: { theta: viz.theta, phi: viz.phi } };
  });

  expect(r.consumed, 'the corner click is handled').toBeTruthy();
  // Iso = body-diagonal: phi ≈ acos(1/√3) ≈ 0.955 rad, theta a 45° diagonal (π/4 family).
  expect(r.after.phi, 'iso polar ≈ 54.7° off +Z (not the top-view pole)').toBeGreaterThan(0.6);
  expect(r.after.phi).toBeLessThan(1.3);
  const t = Math.abs(((r.after.theta % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2) - Math.PI / 4);
  expect(t, 'azimuth is a 45° diagonal').toBeLessThan(0.05);
});

// Clicking a CUBE EDGE midpoint orients the camera to the 45° view BETWEEN the two adjacent faces — its view
// direction has exactly two equal-magnitude axis components and one ~zero (e.g. the +X+Z edge → look from (1,0,1)).
// Reachable from a plain face view too.
test('clicking a cube edge snaps to a 45° edge view (two equal axis components)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForFunction(() => {
    const p = window.ddcsStudio.wizardManager._activePanel;
    return p && p.viz && p.viz._cubeRect && p.viz.renderer;
  });

  const r = await page.evaluate(() => {
    const viz = window.ddcsStudio.wizardManager._activePanel.viz;
    viz.setView('front');   // start on a plain orthographic FACE view (the edge view is reachable from it)
    viz.render();
    const before = { theta: viz.theta, phi: viz.phi };
    const THREE = viz.THREE;
    const rect = viz.renderer.domElement.getBoundingClientRect();
    const { size, m } = viz._cubeRect;
    const left = rect.width - size - m, top = m;
    // Orient the cube cam iso-ish so the top edges are broadside-visible & well-separated from the corners, then
    // click the +Y+Z edge midpoint (0, 0.5, 0.5) — runs along X, seen broadside (not end-on).
    viz.theta = 0.6; viz.phi = 0.9; viz._applyCamera(); viz.render();
    const v = new THREE.Vector3(0, 0.5, 0.5).project(viz._cubeCam);
    const sx = rect.left + left + (v.x * 0.5 + 0.5) * size;
    const sy = rect.top + top + (-v.y * 0.5 + 0.5) * size;
    const consumed = viz._pickCube({ clientX: sx, clientY: sy });
    // Reconstruct the camera view direction (toward the target) from theta/phi.
    const sp = Math.sin(viz.phi);
    const dir = [sp * Math.cos(viz.theta), sp * Math.sin(viz.theta), Math.cos(viz.phi)];
    return { before, consumed, after: { theta: viz.theta, phi: viz.phi }, dir };
  });

  expect(r.consumed, 'the edge click is handled').toBeTruthy();
  // The view direction of a 45° edge view has two axis components of equal magnitude and one ~0.
  const mag = r.dir.map((c) => Math.abs(c)).sort((a, b) => a - b);   // [smallest, mid, largest]
  expect(mag[0], 'one axis component is ~zero (edge, not corner)').toBeLessThan(0.1);
  expect(Math.abs(mag[1] - mag[2]), 'the two non-zero axis components are equal magnitude (45°)').toBeLessThan(0.05);
  expect(mag[2], 'the dominant components are substantial').toBeGreaterThan(0.5);
});

// A click in the CENTRE of a visible face must still give that face's ORTHOGRAPHIC standard view — the corner/edge
// hot-zones are tight enough that they don't steal a mid-face click (the bug the tightening fixes).
test('clicking the centre of a face still snaps to its orthographic standard view', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForFunction(() => {
    const p = window.ddcsStudio.wizardManager._activePanel;
    return p && p.viz && p.viz._cubeRect && p.viz.renderer;
  });

  const r = await page.evaluate(() => {
    const viz = window.ddcsStudio.wizardManager._activePanel.viz;
    viz.theta = 0.6; viz.phi = 0.9; viz._applyCamera(); viz.render();   // a generic iso-ish orientation
    const THREE = viz.THREE;
    const rect = viz.renderer.domElement.getBoundingClientRect();
    const { size, m } = viz._cubeRect;
    const left = rect.width - size - m, top = m;
    // Project the +Z (TOP) face CENTRE and click dead-centre of it.
    const v = new THREE.Vector3(0, 0, 0.5).project(viz._cubeCam);
    const sx = rect.left + left + (v.x * 0.5 + 0.5) * size;
    const sy = rect.top + top + (-v.y * 0.5 + 0.5) * size;
    const consumed = viz._pickCube({ clientX: sx, clientY: sy });
    return { consumed, theta: viz.theta, phi: viz.phi };
  });

  expect(r.consumed, 'the face-centre click is handled').toBeTruthy();
  // TOP view = looking straight down +Z: phi ≈ 0 (the pole), NOT a 45° corner/edge angle.
  expect(r.phi, 'a mid-face click gives the orthographic TOP view (phi≈0), not a corner/edge tilt').toBeLessThan(0.1);
});

// HOVER feedback (Fusion/CAD-style): hovering a cube corner shows the corner chip, an edge shows the edge bar, a
// mid-face shows the face tint — and the highlight matches the click priority (corner > edge > face). Drives the
// same handler path the pointermove listener uses (_cubeFaceAt stashes the event, _highlightCubeFace previews it).
test('hovering a corner / edge / face highlights exactly what a click would select', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForFunction(() => {
    const p = window.ddcsStudio.wizardManager._activePanel;
    return p && p.viz && p.viz._cubeRect && p.viz.renderer;
  });

  const r = await page.evaluate(() => {
    const viz = window.ddcsStudio.wizardManager._activePanel.viz;
    viz.theta = 0.6; viz.phi = 0.9; viz._applyCamera(); viz.render();   // iso-ish: corners/edges well separated
    const THREE = viz.THREE;
    const rect = viz.renderer.domElement.getBoundingClientRect();
    const { size, m } = viz._cubeRect;
    const left = rect.width - size - m, top = m;
    const screen = (vec) => {
      const v = new THREE.Vector3(vec[0], vec[1], vec[2]).project(viz._cubeCam);
      return { clientX: rect.left + left + (v.x * 0.5 + 0.5) * size, clientY: rect.top + top + (-v.y * 0.5 + 0.5) * size };
    };
    // Mimic the pointermove path: stash the event via _cubeFaceAt, then preview via _highlightCubeFace.
    const hover = (vec) => { const e = screen(vec); viz._highlightCubeFace(viz._cubeFaceAt(e)); };

    hover([0.5, 0.5, 0.5]);                 // a CORNER
    const onCorner = { corner: !!(viz._cubeCorner && viz._cubeCorner.visible), edge: !!(viz._cubeEdge && viz._cubeEdge.visible), faceTinted: viz._cubeMats.some((mt) => mt.color.getHex() !== 0xffffff) };

    hover([0, 0.5, 0.5]);                    // an EDGE (runs along X)
    const onEdge = { corner: viz._cubeCorner.visible, edge: viz._cubeEdge.visible, edgeIdx: viz._cubeEdgeIdx };

    hover([0, 0, 0.5]);                      // a FACE centre (+Z)
    const onFace = { corner: viz._cubeCorner.visible, edge: viz._cubeEdge.visible, faceTinted: viz._cubeMats.some((mt) => mt.color.getHex() !== 0xffffff) };

    // Leave the cube square entirely → everything clears.
    viz._cubeFaceAt({ clientX: rect.left + 5, clientY: rect.top + rect.height - 5 });
    viz._highlightCubeFace(-1);
    const onLeave = { corner: viz._cubeCorner.visible, edge: viz._cubeEdge.visible, faceTinted: viz._cubeMats.some((mt) => mt.color.getHex() !== 0xffffff) };

    return { onCorner, onEdge, onFace, onLeave };
  });

  expect(r.onCorner.corner, 'corner hover shows the corner chip').toBeTruthy();
  expect(r.onCorner.edge, 'corner hover does NOT show the edge bar').toBeFalsy();
  expect(r.onCorner.faceTinted, 'corner hover does NOT tint a face').toBeFalsy();

  expect(r.onEdge.edge, 'edge hover shows the edge bar').toBeTruthy();
  expect(r.onEdge.corner, 'edge hover does NOT show the corner chip').toBeFalsy();
  expect(r.onEdge.edgeIdx, 'edge cue tracks a real edge index').toBeGreaterThanOrEqual(0);

  expect(r.onFace.faceTinted, 'face-centre hover tints the face').toBeTruthy();
  expect(r.onFace.corner, 'face hover shows no corner chip').toBeFalsy();
  expect(r.onFace.edge, 'face hover shows no edge bar').toBeFalsy();

  expect(r.onLeave.corner || r.onLeave.edge || r.onLeave.faceTinted, 'leaving the cube clears all hover cues').toBeFalsy();
});
