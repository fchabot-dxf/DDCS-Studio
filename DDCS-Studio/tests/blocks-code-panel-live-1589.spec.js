import { test, expect } from '@playwright/test';

/**
 * t1589 — THE "DOES IT RUN" SPEC for the Blocks code panel's four capabilities.
 *
 * 0bd8b38c deleted `#blk-gcode` from the shell but left ~100 lines still writing into it, so `out` resolved to a
 * DETACHED div: setExecLine, `.warm` hover, `.thot` token-boxing and `has-sel` selection all kept running, kept
 * setting their classes, and were invisible. The capability specs (blocks-exec-glow, blocks-hover, context-menu)
 * could not see that — they assert CLASSES, and classes apply just as well to a node outside the document.
 *
 * So this spec asserts the one property those cannot: that the highlight is PAINTED. For each capability it drives
 * the real gesture, then compares the computed style of a highlighted span against a plain sibling on the same
 * panel. A detached panel (or a `display:none` face, which is the same bug one layer up) makes every one of these
 * comparisons collapse to equality — which is exactly the failure mode that shipped.
 *
 * Pair this with the capability specs, never instead of them: they prove it is RIGHT, this proves it RUNS.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

// Reads the panel's paint: a highlighted span vs a plain one. Equal styling == the highlight did nothing visible.
const PAINT = () => {
  const out = document.getElementById('blk-gcode');
  if (!out) return { fatal: 'no #blk-gcode in the document' };
  if (!out.isConnected) return { fatal: '#blk-gcode is DETACHED — the t1589 bug' };
  const cs = (el) => (el ? getComputedStyle(el) : null);
  const gls = [...out.querySelectorAll('.gl')];
  const plain = gls.find((sp) => !sp.className.split(' ').some((c) => ['active-line', 'warm', 'hot'].includes(c)));
  const box = out.getBoundingClientRect();
  return {
    connected: true,
    visible: getComputedStyle(out).display !== 'none' && box.width > 0 && box.height > 0,
    lines: gls.length,
    plainBg: cs(plain) && cs(plain).backgroundColor,
    plainOpacity: cs(plain) && cs(plain).opacity,
    active: (() => { const el = out.querySelector('.gl.active-line'); return el ? { bg: cs(el).backgroundColor, h: Math.round(el.getBoundingClientRect().height) } : null; })(),
    tail: [...out.querySelectorAll('.gl[data-exec-age]')].map((el) => cs(el).backgroundColor),
    warm: (() => { const el = out.querySelector('.gl.warm'); return el ? { bg: cs(el).backgroundColor, h: Math.round(el.getBoundingClientRect().height) } : null; })(),
    hot: (() => { const el = out.querySelector('.gl.hot'); return el ? { opacity: cs(el).opacity, h: Math.round(el.getBoundingClientRect().height) } : null; })(),
    hasSel: out.classList.contains('has-sel'),
    thot: [...out.querySelectorAll('.thot')].map((el) => ({ text: el.textContent, w: Math.round(el.getBoundingClientRect().width) })),
  };
};

async function seedAndOpen(page, wiz) {
  page.on('dialog', (d) => d.accept());
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.updateWiz && window.insertWiz && window.closeWiz && window.showApp && window.ddcsGetBlockProgram);
  await page.evaluate(async (w) => {
    window.openWiz(w, undefined, true); window.updateWiz(); await window.insertWiz(); window.closeWiz && window.closeWiz();
  }, wiz);
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks(false).length > 0, { timeout: 8000 });
  // same steady state the capability specs use: the panel's ancestry ids ARE the current workspace ids
  await page.waitForFunction(() => {
    const ws = window.__blkws, out = document.getElementById('blk-gcode');
    if (!ws || !out) return false;
    const gls = [...out.querySelectorAll('.gl')];
    if (!gls.length) return false;
    const wsIds = new Set(ws.getAllBlocks(false).map((x) => x.id));
    const srcIds = [...new Set(gls.flatMap((sp) => (sp.dataset.src || '').split(',')).filter(Boolean))];
    return srcIds.length > 0 && srcIds.every((id) => wsIds.has(id));
  }, { timeout: 10000 });
}

test('the code panel is ATTACHED and VISIBLE on the ordinary path (no wizard tree)', async ({ page }) => {
  await seedAndOpen(page, 'surfacing');
  const r = await page.evaluate(PAINT);
  expect(r.fatal, 'the panel is in the document').toBeUndefined();
  expect(r.visible, 'and painted — not a display:none face, which is the same bug one layer up').toBe(true);
  expect(r.lines, 'it carries the projected program').toBeGreaterThan(5);
  // the FACE: no wizard tree here, so the column shows Preview + G-code rather than the Generator Modal
  const face = await page.evaluate(() => {
    const right = document.querySelector('#blocks-app .right');
    const box = (s) => { const el = document.querySelector(s); return el ? getComputedStyle(el).display !== 'none' : false; };
    return { wizardView: right.classList.contains('wizard-view'), pv: box('#blocks-app .pv'), form: box('#blk-formpane') };
  });
  expect(face.wizardView, 'no wizard tree → not the Wizard View face').toBe(false);
  expect(face.pv, 'the toolpath preview has the column').toBe(true);
  expect(face.form, 'and the Generator Modal pane is the one standing down').toBe(false);
});

test('CAPABILITY 1/4 — the sim execution line is PAINTED, and the comet-tail behind it', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);
  await page.evaluate(async () => { const U = await import('/blocks/userOps.js'); const CD = await import('/blocks/dataOps/cornerData.js'); localStorage.removeItem('ddcs_user_ops'); U.createUserOp(CD.cornerDataDef()); });
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('user_corner_data'));
  await page.waitForSelector('#wiz_user_form', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.evaluate(() => { const b = document.getElementById('wiz_user_insert') || document.querySelector('#wiz_user [data-act="insert"]'); if (b) b.click(); });
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => document.querySelectorAll('#blk-gcode .gl').length > 5, { timeout: 10000 });

  const step = page.locator('#blocks-app .pp-step').first();
  for (let k = 0; k < 8; k++) { await step.click({ force: true }); await page.waitForTimeout(120); }

  const r = await page.evaluate(PAINT);
  expect(r.active, 'an executing line exists').not.toBeNull();
  expect(r.active.h, 'and occupies real height on screen').toBeGreaterThan(0);
  expect(r.active.bg, 'the exec glow is a DIFFERENT colour from a plain line — the rule matched').not.toBe(r.plainBg);
  expect(r.tail.length, 'a comet-tail follows it').toBeGreaterThan(0);
  expect(new Set(r.tail).size >= 1 && r.tail.every((c) => c !== r.plainBg), 'every tail line is tinted too').toBe(true);
  await page.screenshot({ path: 'verification/t1589-2-exec-line.png' });
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});

test('CAPABILITY 2/4 — hovering a block PAINTS its emitted lines warm', async ({ page }) => {
  await seedAndOpen(page, 'contour');
  await page.evaluate(() => {
    const ws = window.__blkws, out = document.getElementById('blk-gcode');
    const gls = [...out.querySelectorAll('.gl')];
    const owned = (id) => gls.filter((sp) => (sp.dataset.src || '').split(',').includes(id)).length;
    const b = ws.getAllBlocks(false).map((x) => ({ x, n: owned(x.id) })).filter((o) => o.n).sort((a, c) => c.n - a.n)[0];
    b.x.getSvgRoot().dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  });
  const r = await page.evaluate(PAINT);
  expect(r.warm, 'hovering warmed at least one line').not.toBeNull();
  expect(r.warm.h, 'the warmed line is on screen').toBeGreaterThan(0);
  expect(r.warm.bg, 'warm is a DIFFERENT colour from a plain line — not just a class on a dead node').not.toBe(r.plainBg);
  await page.screenshot({ path: 'verification/t1589-3-hover-warm.png' });
});

test('CAPABILITY 3/4 — selecting a block DIMS the rest and keeps its own lines lit (has-sel)', async ({ page }) => {
  await seedAndOpen(page, 'surfacing');
  await page.evaluate(() => {
    const ws = window.__blkws, out = document.getElementById('blk-gcode');
    const gls = [...out.querySelectorAll('.gl')];
    const owned = (id) => gls.filter((sp) => (sp.dataset.src || '').split(',').includes(id)).length;
    const b = ws.getAllBlocks(false).map((x) => ({ x, n: owned(x.id) })).filter((o) => o.n).sort((a, c) => c.n - a.n).pop();
    const sp = gls.find((s) => (s.dataset.src || '').split(',').includes(b.x.id));
    sp.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  const r = await page.evaluate(PAINT);
  expect(r.hasSel, 'the panel entered its selected state').toBe(true);
  expect(r.hot, 'the selected op keeps lines lit').not.toBeNull();
  // ⚠ The opacity comparison alone is NOT a paint proof, and I know that because mutating the face to `display:none`
  // left this test GREEN: getComputedStyle still reports the cascaded .3 / 1 on a hidden node. So the layout checks
  // below carry the "does it run" claim, and the opacity pair carries the "is the rule matching" one. Both are needed.
  expect(r.visible, 'the panel is painted, not a hidden face').toBe(true);
  expect(r.hot.h, 'the lit lines occupy real height — laid out, not merely styled').toBeGreaterThan(0);
  // styles.css:5389-5390 — `.has-sel .gl` drops to .3 while `.gl.hot` stays 1.
  expect(Number(r.hot.opacity), 'the selected lines stay fully lit').toBeGreaterThan(Number(r.plainOpacity));
  expect(Number(r.plainOpacity), 'and the rest are dimmed by the has-sel rule').toBeLessThan(1);
  await page.screenshot({ path: 'verification/t1589-4-selection.png' });
});

test('CAPABILITY 4/4 — hovering a value BOXES its emitted token (.thot) with real width', async ({ page }) => {
  await seedAndOpen(page, 'surfacing');
  await page.evaluate(async () => {
    const ws = window.__blkws;
    const { FN } = await import('/blocks/blockly/bridge.js');
    const leaf = ws.getAllBlocks(false).find((b) => (b.inputList || []).some((i) => i.connection && i.connection.targetBlock() && i.connection.targetBlock().type === 'math_number'));
    const inp = leaf.inputList.find((i) => i.connection && i.connection.targetBlock() && i.connection.targetBlock().type === 'math_number');
    void FN;
    inp.connection.targetBlock().getSvgRoot().dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  });
  const r = await page.evaluate(PAINT);
  expect(r.thot.length, 'the value under the cursor is boxed in the emitted code').toBeGreaterThan(0);
  expect(r.thot.every((t) => t.w > 0), 'each boxed token has real width — it is laid out, not orphaned').toBe(true);
  await page.screenshot({ path: 'verification/t1589-5-value-token.png' });
});
