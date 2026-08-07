/**
 * harness.mjs — the browser-free tier's `test` + `page`, shaped so a converted spec's BODY is unchanged.
 *
 * ── WHY A SHIM AND NOT A REWRITE ─────────────────────────────────────────────────────────────────────────────────
 * The specs being converted here boot the whole app for one reason: to reach `page.evaluate`, import an app module
 * inside the page, and assert on what a function RETURNED. The browser contributes nothing to that — the assertions
 * are about G-code text and declared data. But rewriting ~100 hand-derived assertions by hand is exactly how a
 * "speed-up" quietly becomes a coverage cut. So the conversion is MECHANICAL instead: `page.evaluate(fn, arg)`
 * becomes `await fn(arg)` in this process, and every `expect(...)` line — matcher, message and all — is carried
 * across byte-for-byte. If an assertion survives the copy, it survives the conversion.
 *
 * ── THE ONE PLACE THIS IS MORE PERMISSIVE THAN A BROWSER ─────────────────────────────────────────────────────────
 * Playwright serialises the evaluate callback to source, so it cannot close over spec-scope variables; here it can.
 * That only ever ACCEPTS code the browser tier would have rejected, so it cannot mask a failure — but a converted
 * spec must still pass its data through the argument, as the browser one did, or the two tiers stop being the same
 * test. Every conversion in this directory keeps the argument-passing exactly as it was.
 *
 * ── WHAT `page.goto` MEANS HERE ──────────────────────────────────────────────────────────────────────────────────
 * Nothing, and that is the entire saving. `boot(page)` in the original waits for the app to declare itself ready
 * because the module graph is loaded by the page; here the module graph is loaded by `import()` on demand. A spec
 * that actually needed the booted app's STATE (a live settings object, a rendered canvas, a registered wizard) is
 * not a candidate for this tier and stays where it is.
 */
import { test as nodeTest, beforeEach as nodeBeforeEach, afterEach as nodeAfterEach } from 'node:test';
export { expect } from '@playwright/test';

/**
 * THE CONSOLE BRIDGE. `page.on('console', …)` is how a spec catches a warning the app raised while emitting — a
 * refusal reason, a clamp notice. In the browser the listener sits on the page's console; here the app code IS this
 * process, so the listener sits on THIS console. Same event, same text, same assertion. The listener list is reset
 * per test so one test's captured warnings can never leak into another's.
 */
const consoleListeners = [];
const realWarn = console.warn.bind(console);
console.warn = (...a) => {
    const text = a.map((x) => (typeof x === 'string' ? x : String(x))).join(' ');
    const msg = { type: () => 'warning', text: () => text, args: () => a };
    for (const cb of consoleListeners) { try { cb(msg); } catch { /* a listener must not break the emit */ } }
    realWarn(...a);
};

/** The inert stand-in. Only the members a genuinely pure spec touches exist; anything else throws by design. */
export const page = {
    /**
     * "Loading the app" in this tier means establishing the module-level singletons a pure emit legitimately reads
     * — nothing more. settingsPanel.js is the one that matters: importing it builds the DEFAULT settings object and
     * publishes `window.ddcsGetSettings`, which is exactly what the browser boot does. localStorage is empty in
     * both tiers (agent runs never seed it), so the two produce the SAME defaults — verified against a real boot:
     * the spindle block a surfacing emit folds in is byte-identical here and in Chromium.
     */
    async goto() { await import('/ui/settingsPanel.js'); },
    async waitForFunction() { /* nothing to wait for */ },
    async waitForTimeout() { },
    async evaluate(fn, arg) { return fn(arg); },
    async close() { },
    setViewportSize() { },
    on(event, cb) {
        if (event !== 'console') throw new Error(`page.on('${event}') has no browser-free equivalent — this spec is not a candidate for the node tier`);
        consoleListeners.push(cb);
    },
    off(event, cb) {
        const i = consoleListeners.indexOf(cb);
        if (i >= 0) consoleListeners.splice(i, 1);
    },
};

const wrap = (fn) => async () => { await fn({ page }); };

// every test starts with a clean console-listener list, the way a fresh page would
nodeBeforeEach(() => { consoleListeners.length = 0; });

export const test = Object.assign(
    (title, fn) => nodeTest(title, wrap(fn)),
    {
        beforeEach: (fn) => nodeBeforeEach(wrap(fn)),
        afterEach: (fn) => nodeAfterEach(wrap(fn)),
        skip: (title, fn) => nodeTest(title, { skip: true }, wrap(fn)),
        fixme: (title, fn) => nodeTest(title, { skip: true }, wrap(fn)),
        only: (title, fn) => nodeTest(title, { only: true }, wrap(fn)),
        describe: (title, fn) => nodeTest(title, () => { fn(); }),
        // a viewport declaration is meaningless without a browser; accepted so the header of a converted spec can
        // stay put rather than being edited away (an edit is a chance to drop something)
        use: () => { },
    },
);
