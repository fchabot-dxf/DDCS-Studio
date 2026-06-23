import { test, expect } from '@playwright/test';

// Contour `side` (software cutter-comp): `on` = tool centre on the boundary (the pocket-wall finish, default —
// pocket pre-insets its region so this is an inside finish); `outside`/`inside` = offset the toolpath by the tool
// radius (the profile cut). rect/polygon/ellipse trace the offset polygon; circle uses a true G3 arc.
test.use({ viewport: { width: 1280, height: 900 } });

test('contour side offsets the traced boundary by the tool radius', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const bm = await import('/blocks/blockModel.js');
    const w = (side) => {
      const b = bm.newBlock('contour');
      b.params = { region: { type: 'region', params: { shape: 'rect', x: 0, y: 0, w: 50, h: 30 } }, side, tool: 6, z: -2, feed: 400, plunge: 200, clearance: 5 };
      return bm.emitProgram([b]);
    };
    const circ = bm.newBlock('contour');
    circ.params = { region: { type: 'region', params: { shape: 'circle', x: 0, y: 0, w: 50 } }, side: 'outside', tool: 6, z: -2, feed: 400, plunge: 200 };
    return { on: w('on'), outside: w('outside'), inside: w('inside'), circle: bm.emitProgram([circ]) };
  });
  // tool Ø6 → radius 3, rect 0,0,50,30:
  expect(r.on, 'on traces the boundary itself').toContain('X50');
  expect(r.on, 'on has no offset').not.toContain('X53');
  expect(r.outside, 'outside grows by r (min corner −3)').toContain('X-3');
  expect(r.outside, 'outside max X = 50+3').toContain('X53');
  expect(r.inside, 'inside shrinks by r → max X 47').toContain('X47');
  expect(r.inside, 'inside never reaches the outside corner').not.toContain('X53');
  // circle Ø50 → R25; outside +3 → R28, crisp G3 arc.
  expect(r.circle, 'circle contour is a true G3 arc').toContain('G3');
  expect(r.circle, 'circle radius offset to 28').toContain('X28');
});
