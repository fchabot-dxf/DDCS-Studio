import { expect } from '@playwright/test';

/**
 * tests/support/affordancePresence.js — t2465 (BACKLOG #61, ARC A / L2: THE PRESENCE PRIMITIVE).
 *
 * `dragRenderTruth.js` (L1, t2461) and the mutation manifest (t2463) both assert a handle's REAL rendered
 * position is faithful to a drag — both assume the handle EXISTS to measure. An affordance that never renders
 * at all has no rect to read (BACKLOG #62's own analysis, correct): "the missing pane sizer" class of defect
 * needs a smaller, structurally DIFFERENT check — not "is it in the right place," just "is it there at all."
 *
 * Mirrors `dragRenderTruth.js`'s own shape (a small module, `page.evaluate`-with-a-self-contained-function for
 * the real DOM read, same convention `drawingCheck.js` established) — reused, not reinvented.
 *
 * THE PROPERTY L1 EARNED, kept here: **a declaration that can't be satisfied must THROW, not silently pass.**
 * L1's risk was a stale FIND STRING (source drifted, the mutation matches zero times — caught by asserting
 * exactly-once). The analogous risk here is different in shape: a presence check's "not found" result is the
 * EXPECTED, correct answer under a mutation (that is the whole point), so "not found" can never itself be the
 * throw condition — an always-absent affordance and a correctly-mutated one look IDENTICAL from that angle
 * alone. The real danger is a selector that never matches ANYTHING, ever, including on a clean, unmutated
 * render — that is a STALE DECLARATION (a wrong/rotted selector), not a caught defect, and it would silently
 * report "still red" forever without this check. `checkAffordancesPresent` THROWS if the declared CONTAINER
 * itself never rendered (the render surface never came up at all — a boot failure, louder and different than
 * one missing affordance within it); callers are expected to additionally verify their own CLEAN-phase result
 * shows every declared affordance present (the manifest runner's own GREEN assertion already does this,
 * exactly the way L1's GREEN assertion re-proves the mutation is reversible, not just that RED happened).
 */

/** Self-contained (no outer closure) — passed to `page.evaluate` as a function reference. Returns which of the
 *  declared `selectors` are present in the DOM right now, and whether the `containerSelector` itself rendered
 *  at all (a container that never appears means the render surface never came up — a different, louder failure
 *  than "one affordance inside it is missing"). */
export const readAffordancePresence = ({ containerSelector, selectors }) => {
    const container = document.querySelector(containerSelector);
    const present = {};
    for (const sel of selectors) present[sel] = !!(container ? container.querySelector(sel) : document.querySelector(sel));
    return { containerFound: !!container, present };
};

/**
 * Check whether every declared affordance selector is present under `containerSelector`.
 * @param {import('@playwright/test').Page} page
 * @param {{containerSelector:string, selectors:string[]}} decl
 * @returns {{ok:boolean, missing:string[], containerFound:boolean}}
 * @throws if `containerSelector` itself never rendered — a stale declaration or a genuine boot failure, never
 *         a legitimate "the mutation worked" result (a mutation hides ONE affordance, not the whole surface).
 */
export async function checkAffordancesPresent(page, decl) {
    const result = await page.evaluate(readAffordancePresence, decl);
    if (!result.containerFound) throw new Error(`affordancePresence: container "${decl.containerSelector}" never rendered — a stale declaration (wrong selector) or a genuine boot failure, not a caught defect`);
    const missing = decl.selectors.filter((s) => !result.present[s]);
    return { ok: missing.length === 0, missing, containerFound: true };
}

/** Playwright-assertion convenience wrapper, mirroring `assertDragRenderFaithful`'s own shape (throws via
 *  `expect`, for callers that want a bare assert rather than a {ok, missing} result to branch on). */
export function assertAffordancesPresent(result, { label = 'affordances' } = {}) {
    expect(result.ok, `${label}: missing ${JSON.stringify(result.missing)}`).toBe(true);
}
