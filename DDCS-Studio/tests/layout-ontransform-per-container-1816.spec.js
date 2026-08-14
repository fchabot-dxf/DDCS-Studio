import { test, expect } from '@playwright/test';

/**
 * t1816 — the SECOND symptom of `_layout`'s old shared-singleton shape (see layout-singleton-reparent-1814's own
 * doc comment for the first: the drag hit-test). `FeatureCanvas.onTransform(cb)` (featureCanvas.js:89) is a
 * SINGLE-SLOT assignment, not a subscriber list, fired on every `_draw` (pan/zoom/fit/resize/render — its own
 * comment calls this "the one choke point"). `userOpView.js`'s `wireAnimOverlay` calls `fc.onTransform(...)`
 * once per CONTAINER (gated by `container.__animOverlay`) to re-pin that container's own 2D animation overlay —
 * but when `fc` was the one shared `_layout` singleton, whichever surface's `wireAnimOverlay` ran LAST owned the
 * ONE `_onTransform` slot, silently stopping the OTHER surface's overlay from ever re-pinning again (traced,
 * WORK-LOG t1814).
 *
 * t1816 fixed `renderLayout2D` to cache its `FeatureCanvas` per CONTAINER (`container.__layout`), which makes
 * `_onTransform` per-instance for free — proved here directly rather than merely asserted, per the dispatch's own
 * instruction to guard this symptom with its OWN test.
 *
 * Deterministic and gesture-free (same style as canvas-handle-writable-1804's t1806 host-A/host-B test) —
 * `_layout`'s reparenting bug made a real drag-based repro of this specific symptom hard to isolate cleanly
 * (t1806 hit exactly this confound), so this drives `renderLayout2D` directly instead of a mouse gesture.
 */

test('t1816: onTransform stays per-container — a later container\'s registration does not steal an earlier one\'s slot', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });

    const r = await page.evaluate(async () => {
        const PT = await import('/wizards/ops/panelTypes.js');
        const def = { bindings: [] };

        const host = document.createElement('div'); host.id = 'test_1816_host'; document.body.appendChild(host);
        const containerA = document.createElement('div'); containerA.id = 'test_1816_containerA';
        containerA.style.width = '300px'; containerA.style.height = '200px'; document.body.appendChild(containerA);
        const containerB = document.createElement('div'); containerB.id = 'test_1816_containerB';
        containerB.style.width = '300px'; containerB.style.height = '200px'; document.body.appendChild(containerB);

        try {
            PT.setFormHost(() => host);

            const fcA = PT.renderLayout2D(containerA, def, {});
            let firedA = 0;
            fcA.onTransform(() => { firedA++; });

            const fcB = PT.renderLayout2D(containerB, def, {});
            let firedB = 0;
            fcB.onTransform(() => { firedB++; });

            const sameInstance = fcA === fcB;

            // Re-render A only — must fire A's OWN callback, never B's (which is exactly what the old shared
            // singleton did NOT guarantee: registering B's callback overwrote the ONE slot both were fighting over).
            PT.renderLayout2D(containerA, def, {});

            return { sameInstance, firedA, firedB };
        } finally {
            host.remove(); containerA.remove(); containerB.remove();
        }
    });

    expect(r.sameInstance, 'each container gets its OWN FeatureCanvas, not one shared singleton').toBe(false);
    expect(r.firedA, "container A's own onTransform callback fired for A's own re-render").toBeGreaterThan(0);
    expect(r.firedB, "container B's callback must NOT fire from A's re-render (no slot theft)").toBe(0);
});
