import { expect } from '@playwright/test';

/**
 * tests/support/affordanceReachability.js — t2481 (BACKLOG #61, ARC A / L3: THE REACHABILITY PRIMITIVE).
 *
 * `affordancePresence.js` (L2, t2465) asks whether a declared affordance EXISTS in the DOM. This asks the
 * sibling question: can it be REACHED — present, correctly sized, and within an area a real pointer could
 * actually land on (the current viewport, or a genuinely scrollable range that would bring it into view).
 * BACKLOG #62 (the mobile drawer) needed exactly this claim but couldn't get it built against a real defect —
 * headless Chromium has no dynamic toolbar, so the ONE historical case was structurally unprovable in this
 * harness (t2469's own finding). BACKLOG #68 is different: the inner tree-rendered visual pane can compute
 * `width:0`, landing `drill`'s own handle past the viewport edge with `document.scrollWidth` exactly equal to
 * `window.innerWidth` — no scroll mechanism exists at all. That IS directly measurable, live, in this harness.
 *
 * ⭐ THE PROOF PATTERN INVERTS FROM L1/L2, and that is the point, not a shortcut: L1's and L2's own guarded
 * defects were ALREADY FIXED by the time their primitives were built, so both needed an in-flight MUTATION
 * (`previewMutations.js`) to manufacture a RED case to prove against. #68 is LIVE AND UNFIXED — this primitive
 * is expected to go RED against the CURRENT, unmutated build, with no mutation manifest entry at all. If it
 * does not, that is itself a finding (the claim doesn't hold as stated), not a green result to celebrate.
 *
 * THE PROPERTY L1/L2 EARNED, kept here unchanged: a declaration that can't be satisfied must THROW, not
 * silently pass. Reused directly from L2's own reasoning: the declared CONTAINER never rendering is a stale
 * selector or a genuine boot failure — never a legitimate "unreachable" result. An affordance being
 * unreachable is a claim about ONE element's own geometry; it must never be conflated with "the render
 * surface never came up," which is a louder, different failure. A per-selector "unreachable" (including
 * "absent," a sub-case of unreachable) is the EXPECTED, correct signal a real defect like #68 produces, so it
 * must never itself be the throw condition — exactly L2's own "not found can't be the throw" reasoning,
 * carried over unchanged because the risk is identical in shape.
 *
 * SCOPE, stated plainly rather than implied: this checks reachability within the CURRENT render — is the
 * affordance inside the visible viewport, or inside a genuinely larger scrollable document that could bring
 * it into view. It does not attempt to drive an arbitrary scroll gesture to hunt for the affordance (that
 * would need a per-case scrollable-ancestor lookup this primitive doesn't try to generalize) — for #68's own
 * case this doesn't matter: `document.scrollWidth === window.innerWidth` means no scroll of any kind exists,
 * so the simpler check already answers the claim correctly, live, with no mutation.
 */

/** Self-contained (no outer closure) — passed to `page.evaluate` as a function reference, mirroring
 *  `readAffordancePresence`'s own convention. Returns per-selector reachability plus the raw rect/reasoning,
 *  so a caller can report WHY something is unreachable, not just that it is. */
export const readAffordanceReachability = ({ containerSelector, selectors }) => {
    const container = document.querySelector(containerSelector);
    const reach = {};
    for (const sel of selectors) {
        const el = container ? container.querySelector(sel) : document.querySelector(sel);
        if (!el) { reach[sel] = { present: false, reachable: false, detail: 'not present' }; continue; }
        const r = el.getBoundingClientRect();
        const vw = window.innerWidth, vh = window.innerHeight;
        const hasSize = r.width > 0 && r.height > 0;
        const withinViewport = hasSize && r.left >= 0 && r.top >= 0 && r.right <= vw && r.bottom <= vh;
        const scrollW = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
        const scrollH = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
        // a genuinely LARGER scrollable document, in the SAME direction the element sits outside the viewport —
        // not just "some scroll exists somewhere" (which would wrongly excuse an element off in a direction
        // nothing can actually scroll toward).
        const scrollableX = scrollW > vw && (r.left < 0 || r.right > vw);
        const scrollableY = scrollH > vh && (r.top < 0 || r.bottom > vh);
        const reachableViaScroll = hasSize && (withinViewport || ((r.right <= vw || scrollableX) && (r.bottom <= vh || scrollableY) && (r.left >= 0 || scrollableX) && (r.top >= 0 || scrollableY)));
        reach[sel] = {
            present: true, hasSize, withinViewport,
            reachable: withinViewport || reachableViaScroll,
            rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
            viewport: { w: vw, h: vh }, scroll: { w: scrollW, h: scrollH },
            detail: !hasSize ? 'zero size' : withinViewport ? 'within viewport' : (reachableViaScroll ? 'outside viewport, reachable via a real scroll range' : 'outside viewport, no scroll mechanism reaches it'),
        };
    }
    return { containerFound: !!container, reach };
};

/**
 * Check whether every declared affordance selector is reachable under `containerSelector`.
 * @param {import('@playwright/test').Page} page
 * @param {{containerSelector:string, selectors:string[]}} decl
 * @returns {{ok:boolean, unreachable:string[], reach:object, containerFound:boolean}}
 * @throws if `containerSelector` itself never rendered — a stale declaration or a genuine boot failure, never
 *         a legitimate "unreachable" result.
 */
export async function checkAffordancesReachable(page, decl) {
    const result = await page.evaluate(readAffordanceReachability, decl);
    if (!result.containerFound) throw new Error(`affordanceReachability: container "${decl.containerSelector}" never rendered — a stale declaration (wrong selector) or a genuine boot failure, not a caught defect`);
    const unreachable = decl.selectors.filter((s) => !result.reach[s].reachable);
    return { ok: unreachable.length === 0, unreachable, reach: result.reach, containerFound: true };
}

/** Playwright-assertion convenience wrapper, mirroring `assertAffordancesPresent`'s own shape. */
export function assertAffordancesReachable(result, { label = 'affordances' } = {}) {
    expect(result.ok, `${label}: unreachable ${JSON.stringify(result.unreachable)} — ${JSON.stringify(result.reach)}`).toBe(true);
}
