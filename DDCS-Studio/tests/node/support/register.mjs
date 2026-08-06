/**
 * register.mjs — the ONE preload for the browser-free tier (`node --import ./tests/node/support/register.mjs`).
 *
 * It does two things and deliberately no more:
 *   1. installs the root-absolute `/…` resolve hook, so `import('/wizards/…')` means the same thing it means in the
 *      browser;
 *   2. installs the SMALLEST set of browser globals an emit module can legitimately touch at module scope.
 *
 * (2) is a load-bearing honesty rule, not a convenience. A module that needs a real DOM to produce G-code is a
 * module whose emit is NOT pure, and that is a finding — it must keep its browser test. So the stubs here are inert:
 * a bag-of-properties `window`, a `localStorage` that starts EMPTY (an emit that silently depended on a persisted
 * setting would read undefined here and fail loudly, which is the correct outcome), and a `document` that answers
 * structural questions with nothing. If a converted spec needs more than this, it does not belong in this tier.
 */
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./webResolve.mjs', pathToFileURL(import.meta.filename));

const store = new Map();
const localStorage = {
    getItem: (k) => (store.has(String(k)) ? store.get(String(k)) : null),
    setItem: (k, v) => { store.set(String(k), String(v)); },
    removeItem: (k) => { store.delete(String(k)); },
    clear: () => store.clear(),
    key: (i) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
};

// a CSSStyleDeclaration-shaped bag: modules set custom properties on a throwaway element at import time to read a
// theme token back. It accepts and remembers, and answers '' for anything never set — the same answer a detached
// element gives in a browser.
const styleBag = () => {
    const s = {};
    return Object.assign(s, {
        setProperty: (k, v) => { s[k] = v; },
        getPropertyValue: (k) => (typeof s[k] === 'string' ? s[k] : ''),
        removeProperty: (k) => { delete s[k]; },
    });
};

const noElement = {
    get style() { return styleBag(); }, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    appendChild(x) { return x; }, removeChild(x) { return x; }, setAttribute() {}, getAttribute: () => null,
    addEventListener() {}, removeEventListener() {}, querySelector: () => null, querySelectorAll: () => [],
    children: [], childNodes: [], textContent: '', innerHTML: '',
};

const document = {
    documentElement: { ...noElement, dataset: {} },
    body: { ...noElement },
    head: { ...noElement },
    createElement: () => ({ ...noElement }),
    createElementNS: () => ({ ...noElement }),
    createDocumentFragment: () => ({ ...noElement }),
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    getElementsByClassName: () => [],
    addEventListener() {},
    removeEventListener() {},
};

if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
// the page-level event bus, inert. A module may WIRE itself at import ("re-render when settings change"); nothing
// in this tier ever fires an event, so the listener is registered and never called — which is the point: the emit
// under test must not depend on having been poked.
if (typeof globalThis.addEventListener === 'undefined') globalThis.addEventListener = () => { };
if (typeof globalThis.removeEventListener === 'undefined') globalThis.removeEventListener = () => { };
if (typeof globalThis.dispatchEvent === 'undefined') globalThis.dispatchEvent = () => true;
if (typeof globalThis.document === 'undefined') globalThis.document = document;
if (typeof globalThis.localStorage === 'undefined') globalThis.localStorage = localStorage;
if (typeof globalThis.sessionStorage === 'undefined') globalThis.sessionStorage = localStorage;
if (typeof globalThis.navigator === 'undefined') globalThis.navigator = { userAgent: 'node', language: 'en-US' };
if (typeof globalThis.matchMedia === 'undefined') globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
if (typeof globalThis.requestAnimationFrame === 'undefined') globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(Date.now()), 0);
if (typeof globalThis.cancelAnimationFrame === 'undefined') globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
