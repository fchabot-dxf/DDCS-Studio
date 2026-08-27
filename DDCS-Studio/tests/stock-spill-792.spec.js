import { test, expect } from '@playwright/test';

/**
 * t792 P1 — THE STOCK SPILL LEAVES THE WIZARD FORMS. A program runs on ONE setup with ONE stock; the per-op
 * stockW/stockH/stockZ/stockDatum fields were a data-model artifact, not a placement choice. They leave every mill
 * twin's FORM (declared `formHidden`) — the two REAL placement choices (Path Datum + Attach to Stock) remain. Nothing
 * is lost: the PlaceOnStock atom still carries the numbers in the stack (resolved from the global stock), Blocks still
 * edits them, and the emit is BYTE-IDENTICAL (the fields defaulted to follow-the-stock).
 *
 * ── t1357: RESTATED, AND THE DISTINCTION IS THE POINT ────────────────────────────────────────────────────────────
 * This asserted the fields were ABSENT FROM THE DOM. It began failing, and the honest question was whether the spill
 * had come back or the assert had gone stale. Measured: `stockW` renders at 0×0 inside a `display:none` ancestor,
 * while `stockAttach` and `pathDatum` render at 273×29 with no hidden ancestor. So the fields are NOT on screen —
 * the t792 ruling holds exactly as written — and what changed is the MECHANISM: `formHidden` now renders the input
 * into a hidden wrapper instead of omitting it, so the placement wiring can keep writing through it.
 *
 * A "not in the DOM" assert was therefore testing an implementation detail that was free to change, in the name of a
 * user-facing rule that had not. It is restated as the rule itself: the param EXISTS and is BOUND, it is NOT VISIBLE,
 * and the placement still RECEIVES it. That version cannot pass while the spill is back, and cannot fail because the
 * renderer changed its mind about how to hide something.
 *
 * ── t2335 (Finding 3, t2333): RESTATED AGAIN, for the SAME reason t1357 restated it ─────────────────────────────
 * "Path Datum + Attach remain VISIBLE" meant, unstated, "as the raw `[data-param]` field" — true for every twin
 * that renders them as an ordinary dropdown (every twin today). `path_anchor` (a TREE-mode uiChildren node,
 * `formWidgets.js`) DELIBERATELY hides that same raw field (`display:none`) and mounts a corner-grid PICKER
 * instead — faithfully reproducing the classic hardcoded shell's own convention (`type="hidden"`, no visible
 * dropdown, t2271's own "REPRODUCE, DON'T IMPROVE" ruling). Confirmed live, not assumed (t2333): the picker
 * builds correctly and is genuinely visible (360×43px, no hidden ancestor) once you look through the CORRECTLY
 * SCOPED path — `stock-spill-792` measuring the raw field alone would have read that state as `false` and
 * reported a spill that was never there. THIS IS NOT A LOOSENED CHECK: flat mode (every twin today) must still
 * show the raw field exactly as strictly as before; the only change is accepting path_anchor's own picker as
 * the SAME fact — "the real placement choice is visible" — expressed through whichever mechanism the twin
 * currently uses, since which one is live was never the rule, only that one of them is.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

// t800 — tap ADDED: the P5 help sweep found the tap twin still spilling its stock block; the P1 assert now extends to it (the 8th twin).
const TWINS = ['user_pocket_data', 'user_contour_data', 'user_drill_data', 'user_bore_data', 'user_surfacing_data', 'user_slot_data', 'user_text_data', 'user_tap_data'];
const STOCK = ['stockW', 'stockH', 'stockZ', 'stockDatum'];

test('the four stock fields are OFF SCREEN in every mill twin form; Path Datum + Attach remain visible', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.openWiz);

  for (const twin of TWINS) {
    await page.evaluate((t) => window.openWiz(t), twin);
    await page.waitForFunction(() => document.querySelector('#wiz_user_form [data-param]'), null, { timeout: 8000 });

    const r = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('#wiz_user_form [data-param]')];
      const visibleRect = (el) => {
        const b = el.getBoundingClientRect();
        let hidden = false;
        for (let n = el; n && n !== document.body; n = n.parentElement) {
          const c = getComputedStyle(n);
          if (c.display === 'none' || c.visibility === 'hidden') { hidden = true; break; }
        }
        return !hidden && b.width > 0 && b.height > 0;
      };
      const shown = (name) => {
        const el = rows.find((e) => e.dataset.param === name);
        if (!el) return { present: false, visible: false };
        return { present: true, visible: visibleRect(el) };
      };
      // t2335 (Finding 3, t2333) — scoped to the LIVE form (#wiz_user_form), not document-wide: t2333 found 7
      // .pa-mount[data-prefix] elements coexisting in the document (static-shell instances baked into
      // index.html), so an unscoped query risks finding a DIFFERENT twin's own (unbuilt) mount. Any .pa-mount
      // found here is necessarily THIS open twin's own, regardless of its own prefix value.
      const mount = document.querySelector('#wiz_user_form .pa-mount');
      const pickerVisible = !!(mount && mount.children.length > 0 && visibleRect(mount));
      return { stock: Object.fromEntries(['stockW', 'stockH', 'stockZ', 'stockDatum'].map((k) => [k, shown(k)])),
        pathDatum: shown('pathDatum'), stockAttach: shown('stockAttach'), pickerVisible };
    });

    for (const stock of STOCK) {
      // THE RULE: a stock dimension is not a per-op placement choice, so the operator is never asked for one.
      expect(r.stock[stock].visible, `${twin}: ${stock} must not be ON SCREEN`).toBe(false);
    }
    // …and the real placement choice IS on screen — as the raw fields (flat mode, every twin today) OR as
    // path_anchor's own picker (tree mode) — which is what stops this passing on an empty form either way.
    const rawFieldsVisible = r.pathDatum.visible && r.stockAttach.visible;
    expect(rawFieldsVisible || r.pickerVisible,
      `${twin}: the real placement choice must be visible, either as the raw Path Datum/Attach fields or as path_anchor's own picker`).toBe(true);
    await page.evaluate(() => window.closeWiz && window.closeWiz());
  }
});

/**
 * The other half of "nothing is lost" — asserted rather than asserted-about. The hidden fields are still BOUND, and
 * the placement block still receives their values, so hiding them cost the op nothing.
 */
test('t1357 — the hidden stock params are still bound, and PlaceOnStock still receives them', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });

  const r = await page.evaluate(async () => {
    const reg = await import('/blocks/userOps.js');
    const ob = await import('/blocks/opBuilders.js');
    const { flattenBlocks } = reg;
    const out = {};
    for (const twin of ['user_pocket_data', 'user_surfacing_data']) {
      const def = (reg.listUserOps ? reg.listUserOps() : []).find((d) => (d.opType || d) === twin);
      const bound = (def.bindings || []).filter((b) => /^stock(W|H|Z|Datum)$/.test(b.param));
      // build with a REAL stock and read the placement block back
      const stack = ob.builderOf(twin)({ stockW: 250, stockH: 175, stockZ: 32, stockAttach: 'pp' });
      const place = flattenBlocks(stack).find((b) => b.type === 'placeonstock');
      out[twin] = {
        boundCount: bound.length,
        allFormHidden: bound.every((b) => b.formHidden === true),
        place: place ? { stockW: place.params.stockW, stockH: place.params.stockH, stockZ: place.params.stockZ } : null,
      };
    }
    return out;
  });

  for (const twin of Object.keys(r)) {
    expect(r[twin].boundCount, `${twin}: all four stock params are still BOUND`).toBe(4);
    expect(r[twin].allFormHidden, `${twin}: and every one declares formHidden`).toBe(true);
    // the numbers really reach the placement — hidden is not the same as dropped
    expect(r[twin].place, `${twin}: the op still has a PlaceOnStock block`).not.toBeNull();
    expect(Number(r[twin].place.stockW), `${twin}: the placement received the stock width`).toBe(250);
    expect(Number(r[twin].place.stockH), `${twin}: …the height`).toBe(175);
    expect(Number(r[twin].place.stockZ), `${twin}: …and the thickness`).toBe(32);
  }
});
