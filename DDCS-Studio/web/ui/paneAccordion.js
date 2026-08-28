/**
 * ui/paneAccordion.js — THE ONE accordion engine (t752 · per-pane split t784). Every wizard viz pane — the 3D verify,
 * the 2D layout, the code preview — is made individually collapsible from the SHARED host: one implementation, every
 * wizard inherits (called from wizardManager.open). Each pane DECLARES its kind in the HTML (`data-viz-pane`); the
 * engine enhances the declared panes (not the whole .wiz-visual), so the 3D and the 2D fold INDEPENDENTLY. Collapsed
 * state is app-wide per pane KIND (panePrefs), so folding the 3D in one wizard opens every wizard with the 3D folded.
 *
 * The affordance is a slim SIDE-CHEVRON strip (a vertical bar on the pane's left, ≥44px touch target, both platforms —
 * one collapse language). The REFLOW is a platform split, driven purely by CSS: desktop the surviving pane FILLS the
 * freed space (definite-height flex column); mobile the surviving pane KEEPS its size and the freed space goes to the
 * FORM below (content-sized stack). This engine only drives the measured-height collapse + the data-reveal/-dir keys.
 *
 * THE MOTION IS DECLARED PER THEME, not hand-rolled here: each theme sets a drawer-motion token block in styles.css —
 *   --drawer-dur (capped ≤350ms so personality never costs responsiveness) · --drawer-ease (a KEYWORD: linear|ease-out|
 *   overshoot|spring, mapped to a curve by mapEase — a raw bezier still passes through) · --drawer-reveal (slide|roll|
 *   fade|wipe|unfold, all implemented) · --drawer-dir (up|down|left|right — 4-way; drives the fold origin + slide/fade/wipe
 *   axis so every reveal consumes it) · --drawer-corner-{expanded,collapsed}. This engine READS those tokens and drives ONE
 *   mechanism (measured-height collapse + a data-reveal/data-dir the CSS keys the personality off) → N distinct personalities
 *   from pure data. Every declared token value has an effect (no silent no-ops). prefers-reduced-motion ⇒ instant. View-only.
 */
import { isPaneCollapsed, setPaneCollapsed, onPaneChange, PANE_KINDS, getPaneRatio, setPaneRatio, onRatioChange, RATIO_MIN, RATIO_MAX, getVisualHeight, setVisualHeight, onVisualHeightChange, VIZH_MIN, VIZH_MAX } from './panePrefs.js';

const LABEL = Object.fromEntries(PANE_KINDS.map((k) => [k.id, k.label]));
const DUR_CAP = 350;   // ms — the hard ceiling on any theme's drawer duration
const reduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };
const numDur = (raw) => { const m = /([\d.]+)\s*(ms|s)?/.exec(raw || ''); if (!m) return 220; const v = parseFloat(m[1]); return m[2] === 's' ? v * 1000 : v; };
// t887 — the DECLARED easing VOCABULARY: a keyword → its curve, so a theme declares `--drawer-ease: overshoot` (semantic),
// not a magic bezier. A raw cubic-bezier()/CSS timing keyword passes through (back-compat). Guarantees no easing keyword
// reaches CSS as an invalid timing-function (which would silently no-op to the browser default).
const EASE = { linear: 'linear', 'ease-out': 'cubic-bezier(.2,.7,.3,1)', overshoot: 'cubic-bezier(.34,1.5,.64,1)', spring: 'cubic-bezier(.5,1.65,.5,1)' };
const mapEase = (v) => EASE[String(v || '').trim()] || v || 'ease';

// A chevron that rotates with the collapsed state (CSS handles the rotation off [data-collapsed]).
const CHEVRON = '<svg class="wiz-pane-chev" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';

export { mapEase };   // t887 — the keyword→curve map (the no-op sweep verifies every declared easing keyword resolves)
// Read the ACTIVE theme's drawer tokens (getComputedStyle on <body>, where data-theme lives — the established pattern).
export function motionTokens() {
    let cs; try { cs = getComputedStyle(document.body); } catch (_) { cs = null; }
    const t = (n, d) => { try { return (cs && cs.getPropertyValue(n).trim()) || d; } catch (_) { return d; } };
    return {
        dur: Math.min(DUR_CAP, numDur(t('--drawer-dur', '220ms'))),
        ease: t('--drawer-ease', 'cubic-bezier(.2,.8,.2,1)'),
        reveal: t('--drawer-reveal', 'slide'),
        dir: t('--drawer-dir', 'up'),
    };
}

// Apply the collapsed/expanded state to one enhanced pane, animating per the active theme's tokens (or instant under
// reduced-motion / the initial paint). `animate=false` = snap (used on open + on a cross-wizard re-apply).
// t785 (user: 'uncollapsing is done in two times') — during the height transition the 3D canvas only truly resized at
// transitionend (the ResizeObserver fires on the container, whose layout settles late), so the expand read as TWO
// motions: the box opening, then the render snapping. This rAF loop follows the animation, resizing any mounted
// preview panel EACH frame until the transition ends — one continuous motion. Cheap: only runs during the ~200-300ms animation.
function followPanelResize(body) {
    const hosts = [...body.querySelectorAll('*')].filter((el) => el.__panel);
    if (!hosts.length) return () => {};
    let on = true;
    const tick = () => {
        if (!on) return;
        for (const h of hosts) { try { const v = h.__panel && h.__panel.viz; if (v && v._resize) v._resize(); } catch (_) { /* mid-teardown */ } }
        requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => { on = false; };
}

function hostsResizeOnce(body) {
    for (const el of body.querySelectorAll('*')) { if (el.__panel) { try { const v = el.__panel.viz; if (v && v._resize) v._resize(); } catch (_) { /* */ } } }
}

export function applyState(pane, collapsed, animate) {
    const body = pane.querySelector(':scope > .wiz-pane-body');
    const bar = pane.querySelector(':scope > .wiz-pane-bar');
    if (!body) return;
    const tk = motionTokens();
    pane.dataset.reveal = tk.reveal;
    pane.dataset.dir = tk.dir;
    pane.style.setProperty('--drawer-dur-eff', (animate && !reduced() ? tk.dur : 0) + 'ms');
    pane.style.setProperty('--drawer-ease-eff', mapEase(tk.ease));   // t887 — keyword easing → its curve
    pane.setAttribute('data-collapsed', collapsed ? '1' : '0');
    if (bar) bar.setAttribute('aria-expanded', collapsed ? 'false' : 'true');

    const split = pane.closest('.viz-split');
    if (split) {
        const allPanes = [...split.querySelectorAll(':scope > [data-viz-pane]')];
        const collapsedCount = allPanes.filter(p => p.getAttribute('data-collapsed') === '1').length;
        if (collapsedCount > 0 && collapsedCount < allPanes.length) {
            split.classList.add('has-collapsed-pane');
        } else {
            split.classList.remove('has-collapsed-pane');
        }
        
        const visual = split.closest('.wiz-visual');
        if (visual) {
            if (collapsedCount === allPanes.length) {
                visual.style.removeProperty('--viz-explicit-h');
            } else if (!visual.style.getPropertyValue('--viz-explicit-h') && getVisualHeight() != null) {
                applyVisualHeight(getVisualHeight());
            }
        }
        
        if (animate && !reduced()) {
            const stopAll = followPanelResize(split);
            setTimeout(() => stopAll(), (tk.dur || 200) + 50);
        }
    }

    if (!animate || reduced()) {                        // snap
        body.style.transition = 'none';
        body.style.height = collapsed ? '0px' : '';
        body.style.overflow = collapsed ? 'hidden' : '';
        void body.offsetHeight;                          // flush
        body.style.transition = '';
        return;
    }
    if (collapsed) {
        const full = body.getBoundingClientRect().height;   // the current (expanded) rendered height
        body.style.overflow = 'hidden';
        body.style.height = full + 'px';
        void body.offsetHeight;                          // reflow so the next frame animates from full
        const stopC = followPanelResize(body);
        const doneC = (e) => { if (e.target === body && e.propertyName === 'height') { stopC(); body.removeEventListener('transitionend', doneC); } };
        body.addEventListener('transitionend', doneC);
        requestAnimationFrame(() => { body.style.height = '0px'; });
    } else {
        // Measure the NATURAL expanded height: a collapsed flex-column body reports scrollHeight 0 (children shrink to
        // fit height:0), so briefly reveal it (transition off) to read the real height, then animate 0 → full.
        body.style.transition = 'none';
        body.style.height = 'auto';
        body.style.overflow = '';
        const full = body.getBoundingClientRect().height;
        body.style.height = '0px';
        body.style.overflow = 'hidden';
        void body.offsetHeight;
        body.style.transition = '';
        const stopE = followPanelResize(body);
        requestAnimationFrame(() => { body.style.height = full + 'px'; });
        const done = (e) => { if (e.target === body && e.propertyName === 'height') { body.style.height = ''; body.style.overflow = ''; stopE(); const v = hostsResizeOnce(body); body.removeEventListener('transitionend', done); } };
        body.addEventListener('transitionend', done);
    }
}

// Enhance one pane element: inject the slim side-chevron strip + wrap the content in a collapsible body (idempotent),
// apply the persisted state (snapped), and wire the strip to toggle + persist. `kind` is a panePrefs id; `title` labels
// the strip. The bar is the SAME element as t752 (a <button>.wiz-pane-bar) — CSS turns it into a vertical side strip.
function enhancePane(pane, kind, title) {
    if (!pane || pane.querySelector(':scope > .wiz-pane-bar')) { return; }   // already enhanced
    const body = document.createElement('div');
    body.className = 'wiz-pane-body';
    while (pane.firstChild) body.appendChild(pane.firstChild);              // move existing content into the body
    const bar = document.createElement('button');
    bar.type = 'button'; bar.className = 'wiz-pane-bar';
    bar.setAttribute('aria-expanded', 'true');
    bar.setAttribute('aria-label', `Collapse the ${title} pane`);           // NO visible label — the chevron is the whole strip
    bar.title = `${title} pane`;                                            // the identity lives in the tooltip, not a band
    bar.innerHTML = CHEVRON;
    pane.appendChild(bar);
    pane.appendChild(body);
    pane.dataset.paneKind = kind;
    applyState(pane, isPaneCollapsed(kind), false);
    bar.addEventListener('click', () => {
        const now = !(pane.getAttribute('data-collapsed') === '1');
        applyState(pane, now, true);
        setPaneCollapsed(kind, now);                                        // persist + notify (other open wizards re-apply)
    });
}

// ── t790 — THE PANE SPLITTER. A grabbable horizontal divider between the 3D and 2D panes rebalances their share
// continuously (the collapse chevrons are all-or-nothing; this is the ratio). The ratio (the 3D pane's fraction) is an
// app-wide display pref (panePrefs) applied via `--pane-ratio` on :root → flex-grow on desktop, body heights on mobile
// (CSS). The splitter is INERT/hidden while either pane is collapsed/hidden. WHILE DRAGGING the canvases resize live
// via followPanelResize (the t785 one-motion-fold helper, reused). ──
function applyPaneRatio(r) {
    try { document.documentElement.style.setProperty('--pane-ratio', String(r == null ? getPaneRatio() : r)); } catch (_) { /* */ }
}

// The splitter only means something with BOTH panes open + visible → toggle its inertness off collapse / display state.
// t790 (gate repair, t1718) — a COLLAPSED pane is not display:none (it folds to a slim strip, still in flow), so
// offsetParent alone never catches it; the collapsed check was missing, so the splitter stayed 'live' (data-split-on
// stuck at '1') the moment a pane folded, even though the MutationObserver above already re-runs this on every
// data-collapsed change — the recompute fired, the condition just never looked at what changed.
function updateSplitOn(split) {
    const panes = [...split.querySelectorAll(':scope > [data-viz-pane]')];
    const ok = panes.length === 2 && panes.every((p) => p.offsetParent !== null && p.getAttribute('data-collapsed') !== '1');
    split.dataset.splitOn = ok ? '1' : '0';
}

/**
 * t1239 (user) — THE SECOND HANDLE. The splitter ABOVE the feature canvas moves the 3D/2D ratio; this one sits BELOW
 * the last pane and moves the whole visual block's HEIGHT, so the canvas can be resized from both of its edges. The
 * two are different quantities on purpose (a share vs a size) and each persists on its own.
 */
/**
 * t1353 (user-live) — HOW TALL THE VISUAL BLOCK IS ALLOWED TO GET, ASKED OF THE CONTAINER RATHER THAN OF A CONSTANT.
 *
 * VIZH_MAX is 900px, and 900 is not a fact about anybody's screen. Measured on a 1000px viewport: the visual's own
 * host (`.wiz-2pane`) runs 90→890, so the real ceiling is 800 — and a down-drag to the constant pushed the block to
 * 990, a hundred pixels PAST its host, which is what put the 2D canvas and the sizer itself under the CANCEL/INSERT
 * footer. The host does not grow to accommodate it (height:100%), so the overflow is invisible to the layout and
 * only shows up as a handle you can no longer reach.
 *
 * So the ceiling is DERIVED at the moment it is needed: the host's bottom minus the visual's top, less the room any
 * sibling BELOW the visual still needs (the stacked/mobile layout puts the controls there; the side-by-side one has
 * nothing below, and the loop then contributes zero). VIZH_MAX stays as the absolute sanity bound above that.
 *
 * An unmeasurable host — a hidden wizard, zero rects — yields the constant rather than a garbage clamp, so the
 * cross-wizard sync below can safely walk every mounted visual including the ones nobody can see.
 */
function visualMaxHeight(visual) {
    const host = visual && visual.parentElement;
    if (!host) return VIZH_MAX;
    const hb = host.getBoundingClientRect(), vb = visual.getBoundingClientRect();
    if (!(hb.height > 0) || !(vb.width > 0)) return VIZH_MAX;   // not laid out / not visible → no opinion
    let below = 0;
    for (const sib of host.children) {
        if (sib === visual) continue;
        const sb = sib.getBoundingClientRect();
        if (sb.height > 0 && sb.top >= vb.top + 1) below += sb.height;   // stacked layout: that room is spoken for
    }
    return Math.max(VIZH_MIN, Math.min(VIZH_MAX, Math.floor(hb.bottom - vb.top - below)));
}

/**
 * t1468 (user defect) — THE STACKED LAYOUT'S SHARE OF THE HEIGHT, DERIVED RATHER THAN PINNED.
 *
 * Desktop's panes FLEX inside the visual's definite height, so resizing the block resizes the canvases for free.
 * The mobile stack cannot flex (the modal is height:auto — see the media query's own note), so its pane bodies carry
 * an explicit CSS height, and that height was the CONSTANT 400px. The sizer therefore wrote a quantity NOTHING
 * DOWNSTREAM CONSUMED: a down-drag opened bare panel below the previews — the "grey" the user reported — and an
 * up-drag pulled the block in under its own pinned content until the pane covered the handle and the gesture could
 * not be undone. Measured at 412px: visual 492→716 while both bodies stayed at exactly 200.
 *
 * So the CSS declares `--viz-stack-h` (defaulting to the same 400px for the never-dragged case) and this is the one
 * place that fills it in. CHROME IS MEASURED, NOT COUNTED: the split's gaps, the two pane borders, the ratio
 * splitter and the sizer itself come to 92px at one width and something else at another, and a formula that has to
 * be kept in step with four CSS rules is a second source. `visual − bodies` asks the layout instead, and because the
 * next pass reproduces exactly that difference the value is stable rather than drifting.
 *
 * Inert on desktop by construction: the rules that read the variable live inside the ≤860px media query, so nothing
 * here needs to know which layout it is in — the CSS decides who consumes it.
 */
function stackChrome(v) {
    const bodies = [...v.querySelectorAll('[data-viz-pane] > .wiz-pane-body')];
    if (!bodies.length) return null;
    // ⛔⛔ t2113 - THE COMMENT ABOVE CLAIMED THIS WAS STABLE ("the next pass reproduces exactly that
    // difference") AND IT IS NOT. `visual - bodies` infers chrome from whatever is not body - but the bodies
    // were ALREADY SHRUNK by the previous pass's --viz-stack-h. So each run measures a larger chrome, sets a
    // smaller body, and the next run measures larger still. REPRODUCED at 390px, five opens of one wizard:
    // pane bodies 51 -> 34 -> 24 -> 14 -> 4px. That is the human's "both panes open as ~40px strips", and it
    // keeps going to zero. The stored height is NOT the ratchet - it pins at the 160 floor on the first open
    // and stays there while the panes carry on shrinking.
    // ⇒ MEASURE WITH THE VARIABLE CLEARED, so the bodies are at their NATURAL size and the reading cannot be
    //   contaminated by our own previous write. Same 'ask the layout' philosophy the original chose - it just
    //   has to ask a layout we have not already deformed.
    // ⚠ BOTH of our own variables come off, not just one. Clearing --viz-stack-h alone still leaves
    //   --viz-explicit-h from the previous pass driving `vh`, and the reading stays contaminated - measured:
    //   that version traded a downward ratchet (51->34->24->14->4) for an upward one (51->58->65->72->79).
    //   Chrome is headers + splitter + sizer; it must be read from a layout WE have not touched at all.
    const hadStack = v.style.getPropertyValue('--viz-stack-h');
    const hadExpl = v.style.getPropertyValue('--viz-explicit-h');
    if (hadStack) v.style.removeProperty('--viz-stack-h');
    if (hadExpl) v.style.removeProperty('--viz-explicit-h');
    const vh = v.getBoundingClientRect().height;
    const sum = bodies.reduce((a, b) => a + b.getBoundingClientRect().height, 0);   // forced reflow: intentional
    if (hadStack) v.style.setProperty('--viz-stack-h', hadStack);
    if (hadExpl) v.style.setProperty('--viz-explicit-h', hadExpl);   // restored; the caller overwrites both
    if (!(vh > 0)) return null;                                   // not laid out → no opinion, leave the default
    return Math.max(0, Math.round(vh - sum));
}

// t2353 — `dragCap` ({visual, max}) lets an in-progress drag override the PER-FRAME `visualMaxHeight(v)` read
// below for the ONE visual it's actively resizing. Without it, hoisting the cap to pointerdown in the drag
// handlers (addVisualSizer/addPaneSplitter, see their own t2353 comments) was not enough: this function is
// what applyMove ultimately calls, and it was ALSO re-deriving `cap` fresh from the live DOM on every single
// invocation — the very read the handlers' own hoist was meant to remove, just one level down. In the tree's
// stacked layout that live re-derivation still tracked the visual's own just-written height every frame,
// re-imposing the ratchet on top of an already-fixed caller. Every OTHER mounted `.wiz-visual` (cross-wizard
// sync, the non-drag `h===undefined` heal path) keeps deriving its own cap fresh, unchanged — only the ONE
// visual actively being dragged borrows the caller's frozen number.
function applyVisualHeight(h, dragCap) {
    const px = h === undefined ? getVisualHeight() : h;
    let healed = null;
    document.querySelectorAll('.wiz-visual').forEach((v) => {
        if (px == null) { v.style.removeProperty('--viz-explicit-h'); v.style.removeProperty('--viz-stack-h'); v.style.removeProperty('height'); v.style.removeProperty('flex'); return; }
        // THE STORED VALUE HEALS. A 900 persisted before this fix (or saved on a taller window, or on a screen that
        // has since been resized) must not reopen every wizard with its handle buried — so a visual that cannot take
        // the stored height takes what it can, and the smallest such fit is written back below. Reopening broken is
        // the part the user actually felt: the clamp alone would fix the drag and leave the damage in localStorage.
        const cap = (dragCap && dragCap.visual === v) ? dragCap.max : visualMaxHeight(v);
        const fit = Math.min(px, cap);
        if (fit < px) healed = healed == null ? fit : Math.min(healed, fit);
        // derive the stacked share from the CLAMPED height (never the request), BEFORE the write moves the rects
        const chrome = stackChrome(v);
        v.style.setProperty('--viz-explicit-h', fit + 'px');
        if (chrome != null) v.style.setProperty('--viz-stack-h', Math.max(0, fit - chrome) + 'px');
    });
    // ⛔ t2113 - THE HEAL IS NO LONGER PERSISTED, and that is the point of the change.
    // getVisualHeight's own contract is "the visual block's height in px, or NULL WHEN THE USER HAS NEVER
    // DRAGGED IT". A fit-to-screen clamp is not a drag - it is an accommodation to the window in front of
    // you right now - and writing it into that slot made one device's constraint into every device's
    // preference. Open a wizard on a PHONE, where the form leaves ~160px for the visual, and the floor value
    // was saved; open the same wizard on a 1920px monitor and it started from the phone's number.
    // ⭐ The clamp still APPLIES (--viz-explicit-h below is the fit, never the raw request), so a stored 900
    // still cannot reopen a wizard with its handle buried. It is simply recomputed from the real window each
    // time instead of being written down, which is what a viewport-derived value should always have been.
    // ⚠ `healed` is deliberately still computed above: it is what feeds the clamp. Only the WRITE is gone.
}

function addVisualSizer(split) {
    const visual = split.closest('.wiz-visual');
    if (!visual || split.querySelector(':scope > .viz-pane-sizer')) return;
    const sp = document.createElement('div');
    sp.className = 'viz-pane-splitter viz-pane-sizer';   // same grip language as the ratio handle above
    sp.setAttribute('role', 'separator'); sp.setAttribute('aria-orientation', 'horizontal');
    sp.setAttribute('aria-label', 'Drag to resize the preview area'); sp.tabIndex = 0;
    sp.innerHTML = '<span class="viz-pane-splitter-grip" aria-hidden="true"></span>';
    split.appendChild(sp);   // BELOW the last pane (the feature canvas)

    let dragging = false, stopFollow = null, startTopHeight = 0;
    // t2345 — the pane list and their top/bottom order CANNOT change mid-drag (nothing else resizes this
    // split while a pointer is captured on it), so both are read ONCE at pointerdown and reused by every
    // onMove frame instead of re-querying + re-measuring on every pointermove (up to 120Hz on a phone) — that
    // was a read (querySelectorAll + 2x getBoundingClientRect) landing right after applyVisualHeight's OWN
    // write, forcing a synchronous reflow on every single event. rAF-coalescing (below) means the write side
    // (applyVisualHeight/applyPaneRatio — the latter itself doing a deliberate forced reflow per mounted
    // visual, see stackChrome) runs at most once per animation frame instead of once per pointer event too.
    let dragPanes = [], dragThreeDTop = false;
    // t2349 — DELTA-based, not frame-based: `heightAt` used to read `visual.getBoundingClientRect().top`
    // fresh on every call — the pointer's Y relative to the visual's CURRENT on-screen position. That position
    // is not provably stable across a multi-frame drag (a growing/shrinking visual can shift the surrounding
    // layout under it — the advisor's own suspected mechanism, e.g. browser scroll anchoring reacting to
    // content growth), so a request computed against a moving reference frame can silently diverge from the
    // pointer's actual on-screen travel. Captured once at pointerdown instead: `dragStartY` (the pointer's own
    // Y) and `dragStartHeight` — `heightAt(y)` is then a pure `dragStartHeight + (y - dragStartY)`, which only
    // ever depends on how far the POINTER itself has moved since pointerdown, never on where anything else
    // drew itself in between. Not confirmed this was the owner's own creep (the specific scroll-anchoring
    // theory was tested and found not to reproduce in this harness — see WORK-LOG), but it closes a real class
    // of fragility either way and needs no new read: the capture already happens once per drag either way.
    // (`dragStartHeight`'s own SOURCE changed at t2353 — see the pointerdown handler's own comment below for
    // why it is now the visual's exact rendered height, not the pointer-offset this paragraph originally used.)
    let dragStartY = 0, dragStartHeight = 0;
    // t2353 — THE RATCHET: visualMaxHeight(visual) was still called fresh on EVERY frame here, the one
    // per-frame layout read the t2345/t2349 hoists missed. In the TREE (a split_horizontal-wrapped visual,
    // e.g. the flipped drill, STACKED/mobile layout specifically — confirmed live, see WORK-LOG: at 412px
    // `visualMaxHeight` tracked the visual's OWN current height to within 1px the entire drag, both shrinking
    // AND growing, because its `host` (visual.parentElement, the split pane wrapper) is CONTENT-SIZED BY the
    // visual in that layout — there is no independent ceiling to ask. Every frame's write therefore fed the
    // NEXT frame's own "room available" reading back to itself: shrinking left ~0 headroom to grow back into,
    // and Math.floor bled a pixel here and there on top. Desktop was NOT reproducible (.ui-split-pane2 there
    // gets a real, independent row height from its own layout context — max stayed flat while height moved
    // freely both ways) — this is a stacked-layout-specific mechanism, not universal.
    // FIX: seed the ceiling at pointerdown, then let it only ever GROW during the drag — never shrink back down.
    // A pure one-time snapshot (captured once, never touched again) was tried first and reverted: it broke an
    // EARLIER, already-shipped fix (pane-sizer-mobile-1468.spec.js, t1468) — verified live (WORK-LOG): right
    // after a separate prior drag on a STACKED (412px) twin, the freshly-opened drag's very first ceiling
    // reading can be a TRANSIENT UNDER-count (measured: 305 while the true settled ceiling was north of 500) —
    // the "below" siblings' layout (the form, in stacked mode) hadn't finished reflowing from the PRIOR drag's
    // own write yet. The old (pre-t2353) code re-read fresh every frame and so self-corrected as reflow caught
    // up mid-drag; a frozen snapshot has no way back once it locks in the transient low number. Monotonic max
    // keeps that same self-correcting property — the read still happens every frame, but only a LARGER fresh
    // reading is ever adopted, never a smaller one — so a genuine ratchet (a CONTENT-DRIVEN host echoing the
    // visual's own just-shrunk height back at itself, see above) still cannot lower the room available for the
    // REST of this same drag, while a real settle-driven increase (t1468's case) still gets picked up as soon as
    // any frame observes it. Verified BOTH stay fixed together (WORK-LOG): the drill ratchet recovers fully
    // within one drag, AND t1468's cross-drag grow (a separate, later pointerdown after a separate shrink) is
    // unbroken again.
    let dragMaxHeight = VIZH_MAX;
    const heightAt = (y) => {
        const fresh = visualMaxHeight(visual);
        if (fresh > dragMaxHeight) dragMaxHeight = fresh;
        return Math.max(VIZH_MIN, Math.min(dragMaxHeight, Math.round(dragStartHeight + (y - dragStartY))));
    };
    let rafId = null, pendingY = null;
    const applyMove = (y) => {
        let clampedTotalHeight = heightAt(y);
        applyVisualHeight(clampedTotalHeight, { visual, max: dragMaxHeight });   // t2353 — pin the SAME cap applyVisualHeight would otherwise re-derive live
        if (dragPanes.length > 1) {
            let frac = startTopHeight / Math.max(1, clampedTotalHeight);
            let newRatio = Math.max(RATIO_MIN, Math.min(RATIO_MAX, dragThreeDTop ? frac : 1 - frac));
            applyPaneRatio(newRatio);
        }
    };
    const onMove = (e) => {
        if (!dragging) return;
        e.preventDefault();
        pendingY = e.clientY;
        if (rafId == null) rafId = requestAnimationFrame(() => { rafId = null; if (pendingY != null) applyMove(pendingY); });
    };
    const onUp = (e) => {
        if (!dragging) return;
        dragging = false;
        if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }   // a stale queued frame must not fire after this authoritative write
        pendingY = null;
        try { sp.releasePointerCapture(e.pointerId); } catch (_) { /* */ }
        sp.removeEventListener('pointermove', onMove); sp.removeEventListener('pointerup', onUp); sp.removeEventListener('pointercancel', onUp);
        if (stopFollow) { stopFollow(); stopFollow = null; }
        split.classList.remove('is-dragging');

        // t2349 — same delta-based heightAt, and the SAME dragPanes/dragThreeDTop every onMove frame used
        // (not a fresh re-query): the authoritative final write must land exactly where the last frame showed,
        // never recomputed against a possibly-shifted frame or a possibly-reordered re-query.
        let clampedTotalHeight = heightAt(e.clientY);
        setVisualHeight(clampedTotalHeight);

        if (dragPanes.length > 1) {
            let frac = startTopHeight / Math.max(1, clampedTotalHeight);
            let newRatio = Math.max(RATIO_MIN, Math.min(RATIO_MAX, dragThreeDTop ? frac : 1 - frac));
            setPaneRatio(newRatio);
        }
    };
    sp.addEventListener('pointerdown', (e) => {
        const panes = [...visual.querySelectorAll('.viz-split > [data-viz-pane]')];
        if (panes.length > 0) {
            const bottomPane = panes[panes.length - 1];
            if (bottomPane.getAttribute('data-collapsed') === '1') {
                const kind = bottomPane.dataset.vizPane;
                applyState(bottomPane, false, true);
                setPaneCollapsed(kind, false);
            }
        }
        dragPanes = panes;
        dragThreeDTop = panes.length > 1 && panes[0].getBoundingClientRect().top <= panes[1].getBoundingClientRect().top;
        if (panes.length > 1) {
            startTopHeight = panes[0].getBoundingClientRect().height;
        } else {
            startTopHeight = 0;
        }
        // t2349 — capture ONCE at pointerdown instead of re-reading every frame (`y - visual.top` every
        // pointermove, the original frame-based formula).
        // t2353 — the OWNER's second observation ("on touch it slightly increases size then just reduces"):
        // the captured baseline used to be `e.clientY - visual.top` (pointer distance from the visual's own
        // top edge) rather than the visual's own rendered height — the sizer's grab point sits at its own
        // vertical CENTER, a few px below the visual's true bottom edge (half the grip's own height), so a
        // zero-movement touch fed a baseline a few px short of the real height straight back into
        // applyVisualHeight, shrinking it the instant the drag started (verified live: ~2px at both 412px and
        // desktop). The sibling handler below hit the SAME class of gap at a much larger magnitude (the ratio
        // splitter sits a whole pane-boundary away from the visual's edge, not just a grip's-width away) — see
        // its own fix for the full reasoning. Captured as the visual's OWN exact rendered height here instead:
        // this handler's `heightAt` treats the baseline as the TOTAL requested height directly (unlike the
        // sibling's top/bottom split), so there is no separate "chrome" term to add back — the exact height IS
        // the whole quantity. (The old comment here warned this exact swap "stuck the ratio" — that bug lived
        // in the SIBLING handler's own top/bottom split math, not in this one, which never derives a ratio from
        // dragStartHeight; unaffected, and this fix's own acceptance test below confirms no ratio regression.)
        dragStartY = e.clientY;
        dragStartHeight = visual.getBoundingClientRect().height;
        dragMaxHeight = visualMaxHeight(visual);   // t2353 — seeded once; see the comment above heightAt for why it then only ever GROWS, never re-derives fresh
        dragging = true; e.preventDefault();
        try { sp.setPointerCapture(e.pointerId); } catch (_) { /* */ }
        split.classList.add('is-dragging');
        stopFollow = followPanelResize(split);   // rAF-resize both canvases live during the drag (same as the ratio handle)
        sp.addEventListener('pointermove', onMove); sp.addEventListener('pointerup', onUp); sp.addEventListener('pointercancel', onUp);
    });
    sp.addEventListener('keydown', (e) => {
        const panes = [...visual.querySelectorAll('.viz-split > [data-viz-pane]')];
        if (panes.length > 0) {
            const bottomPane = panes[panes.length - 1];
            if (bottomPane.getAttribute('data-collapsed') === '1') {
                const kind = bottomPane.dataset.vizPane;
                applyState(bottomPane, false, true);
                setPaneCollapsed(kind, false);
            }
        }
        const step = e.shiftKey ? 40 : 12;
        if (e.key === 'ArrowUp') { e.preventDefault(); setVisualHeight((getVisualHeight() || visual.getBoundingClientRect().height) - step); }
        if (e.key === 'ArrowDown') { e.preventDefault(); setVisualHeight((getVisualHeight() || visual.getBoundingClientRect().height) + step); }
    });
}

function addPaneSplitter(split) {
    if (!split || split.querySelector(':scope > .viz-pane-splitter')) { if (split) updateSplitOn(split); return; }
    const panes = [...split.querySelectorAll(':scope > [data-viz-pane]')];
    if (panes.length !== 2) return;                                // a ratio only exists between two panes
    const sp = document.createElement('div');
    sp.className = 'viz-pane-splitter';
    sp.setAttribute('role', 'separator'); sp.setAttribute('aria-orientation', 'horizontal');
    sp.setAttribute('aria-label', 'Drag to rebalance the 3D and 2D previews'); sp.tabIndex = 0;
    sp.innerHTML = '<span class="viz-pane-splitter-grip" aria-hidden="true"></span>';
    panes[0].after(sp);                                            // sits BETWEEN the two panes

    // the pointer Y → the 3D pane's fraction, order-independent (twin = 3D on top, built-in = 2D on top).
    const ratioAt = (y) => {
        const s = split.getBoundingClientRect();
        if (s.height <= 0) return getPaneRatio();
        const frac = (y - s.top) / s.height;                       // the TOP pane's share
        const a = split.querySelector(':scope > [data-viz-pane="preview3d"]');
        const b = split.querySelector(':scope > [data-viz-pane="layout2d"]');
        const threeDTop = a && b && a.getBoundingClientRect().top <= b.getBoundingClientRect().top;
        return Math.max(RATIO_MIN, Math.min(RATIO_MAX, threeDTop ? frac : 1 - frac));
    };
    let dragging = false, stopFollow = null, actsAsSizer = false;
    let startBottomHeight = 0;
    const visual = split.closest('.wiz-visual');
    // t2349 — DELTA-based, not frame-based: see addVisualSizer's own comment above for the full reasoning.
    // `dragStartY` (the pointer's own Y at pointerdown) plus `dragStartTopHeight`/`dragStartVisualHeight`
    // (the top pane's / the whole visual's height at that same instant) replace every mid-drag
    // `visual.getBoundingClientRect().top` read — the request now depends only on how far the POINTER has
    // moved since pointerdown, never on where anything else drew itself in between.
    let dragStartY = 0, dragStartTopHeight = 0, dragStartVisualHeight = 0, dragStartChrome = 0;
    // t2353 — same fix, same evidence as addVisualSizer's own comment above (including the t1468 cross-drag
    // regression that ruled out a pure one-time snapshot): the ceiling is seeded at pointerdown, then only ever
    // GROWS for the rest of this drag — never shrinks — via `freshenMax()`, called once per frame from
    // `applyMove` below (both branches) and once more from `onUp`'s own authoritative write.
    let dragMaxHeight = VIZH_MAX;
    const freshenMax = () => { if (visual) { const fresh = visualMaxHeight(visual); if (fresh > dragMaxHeight) dragMaxHeight = fresh; } };
    const heightAt = (y) => {
        if (!visual) return getVisualHeight();
        return Math.max(VIZH_MIN, Math.min(dragMaxHeight, Math.round(dragStartVisualHeight + (y - dragStartY))));
    };
    // t2345 — same shape/fix as addVisualSizer's onMove above: the a/b (preview3d/layout2d) top-order test is
    // invariant for the duration of a drag (they cannot swap position mid-drag), so it is read ONCE at
    // pointerdown instead of re-queried + re-measured on every pointermove; the write side is coalesced to one
    // requestAnimationFrame per frame instead of firing on every raw pointer event.
    let dragThreeDTop = false;
    let rafId = null, pendingY = null;
    const applyMove = (y) => {
        freshenMax();   // t2353 — may only raise dragMaxHeight, never lower it; see its own comment above
        if (actsAsSizer) {
            applyVisualHeight(heightAt(y), { visual, max: dragMaxHeight });   // t2353 — same pin as addVisualSizer's own applyMove
        } else {
            let requestedTopHeight = dragStartTopHeight + (y - dragStartY);
            let requestedTotalHeight = requestedTopHeight + startBottomHeight + dragStartChrome;
            let clampedTotalHeight = Math.max(VIZH_MIN, Math.min(dragMaxHeight, requestedTotalHeight));
            // t2353 — `dragStartChrome` reconstructs the TOTAL exactly (fixes both the stationary-touch height
            // jump AND, confirmed live on the flipped drill at desktop width — see WORK-LOG — a real ~0.09
            // ratio cliff on release even with zero pointer movement, since tree mode carries MORE chrome inside
            // one `.viz-split` than the classic shell: the "VISUALIZATION" label above it, the ratio bar AND the
            // bottom sizer bar both living inside the same split). UNSATURATED (the common case — nothing hit
            // VIZH_MIN/dragMaxHeight), subtract it here too so the ratio's own split reconstructs exactly.
            // SATURATED (the drag pushed past the ceiling), fall back to the OLD chrome-blind subtraction: a
            // clamped classic drag was verified (WORK-LOG A/B, exact number 0.44342291371994347 both before and
            // after this change) to land on a DIFFERENT ratio once chrome is subtracted there too — a real
            // behavior change the dispatch's "classic path byte-identical" requirement rules out shipping
            // without a dedicated look at how a ratio-splitter SHOULD rebalance once there's no more room to
            // give (a design question this turn didn't open). Both branches use the SAME already-exact
            // `clampedTotalHeight`, so only which quantity comes OUT of it changes, not the total itself.
            let saturated = clampedTotalHeight !== requestedTotalHeight;
            let actualTopHeight = saturated ? (clampedTotalHeight - startBottomHeight) : (clampedTotalHeight - startBottomHeight - dragStartChrome);
            // t2353 — THE REAL cliff, found via live numbers (WORK-LOG): `frac` used to divide by
            // `clampedTotalHeight` (the WHOLE visual, chrome included) instead of `actualTopHeight +
            // startBottomHeight` (the two PANES only — what `--pane-ratio` actually splits between; chrome
            // like the section-label and the two grab bars doesn't participate in the ratio at all). Measured
            // on the flipped drill at desktop width: top=160, bottom=160, chrome=72, visual=392 — the OLD
            // `160/392=0.408` against a starting ratio of 0.5, on a drag that never moved the pointer at all.
            // `160/(160+160)=0.5` — exact. In the SATURATED branch this is a pure no-op: there `actualTopHeight
            // + startBottomHeight` algebraically reduces to `clampedTotalHeight` (actualTopHeight is already
            // `clampedTotalHeight − startBottomHeight`), so the classic saturated-clamp landing this turn
            // proved byte-identical (WORK-LOG A/B) is untouched — only the UNSATURATED, chrome-subtracted
            // branch's own denominator was ever wrong.
            let frac = actualTopHeight / (actualTopHeight + startBottomHeight);
            let newRatio = Math.max(RATIO_MIN, Math.min(RATIO_MAX, dragThreeDTop ? frac : 1 - frac));
            applyVisualHeight(clampedTotalHeight, { visual, max: dragMaxHeight });   // t2353 — pin the SAME cap, not a fresh per-frame re-derive
            applyPaneRatio(newRatio);
        }
    };
    const onMove = (e) => {
        if (!dragging) return;
        e.preventDefault();
        pendingY = e.clientY;
        if (rafId == null) rafId = requestAnimationFrame(() => { rafId = null; if (pendingY != null) applyMove(pendingY); });
    };
    const onUp = (e) => {
        if (!dragging) return;
        dragging = false;
        if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }   // a stale queued frame must not fire after this authoritative write
        pendingY = null;
        try { sp.releasePointerCapture(e.pointerId); } catch (_) { /* */ }
        sp.removeEventListener('pointermove', onMove); sp.removeEventListener('pointerup', onUp); sp.removeEventListener('pointercancel', onUp);
        if (stopFollow) { stopFollow(); stopFollow = null; }
        split.classList.remove('is-dragging');
        freshenMax();   // t2353 — the authoritative final write gets the same chance to pick up a late-settling ceiling
        if (actsAsSizer) {
            setVisualHeight(heightAt(e.clientY));
        } else {
            // t2349 — same delta-based math and the SAME dragThreeDTop every onMove frame used (not a fresh
            // re-query): the authoritative final write must land exactly where the last frame showed.
            // t2353 — and the SAME captured dragMaxHeight, not a fresh visualMaxHeight(visual) read. Same
            // saturated/unsaturated chrome split as applyMove's own non-sizer branch above — see that comment.
            let requestedTopHeight = dragStartTopHeight + (e.clientY - dragStartY);
            let requestedTotalHeight = requestedTopHeight + startBottomHeight + dragStartChrome;
            let clampedTotalHeight = Math.max(VIZH_MIN, Math.min(dragMaxHeight, requestedTotalHeight));
            let saturated = clampedTotalHeight !== requestedTotalHeight;
            let actualTopHeight = saturated ? (clampedTotalHeight - startBottomHeight) : (clampedTotalHeight - startBottomHeight - dragStartChrome);
            let frac = actualTopHeight / (actualTopHeight + startBottomHeight);   // t2353 — see applyMove's own comment above
            let newRatio = Math.max(RATIO_MIN, Math.min(RATIO_MAX, dragThreeDTop ? frac : 1 - frac));
            setVisualHeight(clampedTotalHeight);
            setPaneRatio(newRatio);
        }
    };
    sp.addEventListener('pointerdown', (e) => {
        if (split.dataset.splitOn !== '1') return;
        const allPanes = [...split.querySelectorAll(':scope > [data-viz-pane]')];
        if (allPanes.length > 0) {
            const topPane = allPanes[0];
            if (topPane.getAttribute('data-collapsed') === '1') {
                const kind = topPane.dataset.vizPane;
                applyState(topPane, false, true);
                setPaneCollapsed(kind, false);
            }
        }
        if (allPanes.length > 1) {
            const bottomPane = allPanes[1];
            if (bottomPane.getAttribute('data-collapsed') === '1') {
                actsAsSizer = true;
            } else {
                actsAsSizer = false;
                startBottomHeight = bottomPane.getBoundingClientRect().height;
            }
        } else {
            actsAsSizer = false;
            startBottomHeight = 0;
        }
        const a = split.querySelector(':scope > [data-viz-pane="preview3d"]');
        const b = split.querySelector(':scope > [data-viz-pane="layout2d"]');
        dragThreeDTop = a && b && a.getBoundingClientRect().top <= b.getBoundingClientRect().top;
        // t2349 — capture EXACTLY what the old per-frame formula computed (`y - visual.top`), just once
        // instead of every frame: NOT the top pane's own `.getBoundingClientRect().height` — the visual's own
        // top edge sits above chrome (the "VISUALIZATION" section-label) the pane's own box does not include,
        // so that approximation was measurably wrong and stuck the ratio at 412px (verified: 0.5 → 0.5 across
        // a whole real-mouse drag with the height-based capture, vs the correct capture below moving it the
        // same amount the frame-based original did).
        dragStartY = e.clientY;
        if (visual) { const startOffset = e.clientY - visual.getBoundingClientRect().top; dragStartVisualHeight = startOffset; }   // actsAsSizer branch only — unchanged
        // t2353 — the OWNER's second observation ("on touch it slightly increases size then just reduces"):
        // `dragStartTopHeight` used to be the SAME `startOffset` as dragStartVisualHeight above (pointer
        // distance from the VISUAL's own top edge) — a stand-in for the top pane's height that is only exact
        // when the pointer sits precisely at the pane's own bottom edge. It doesn't: the splitter's grab point
        // is its own vertical CENTER, sitting ~half the splitter's own height below the pane boundary, and the
        // visual's top edge carries chrome the offset never counted — the "VISUALIZATION" section-label ABOVE
        // the split, and (once both handles are mounted) the SIZER bar itself sitting below the last pane. A
        // stationary touch (pointerup at the SAME y as pointerdown) fed that same wrong baseline back unchanged
        // — reproducing the gap as a real, measured jump the instant the drag started (verified live: a
        // zero-movement press-release at 412px moved the ratio-split visual by up to 29px).
        // Fix: capture the TOP PANE's own exact rendered height (exact, by construction — no offset to be
        // wrong about) PLUS `dragStartChrome`, everything else in the visual's total that ISN'T the two panes
        // or the already-exact `startBottomHeight` (the label, the ratio bar's own height, the sizer bar, any
        // gaps) — measured as one opaque leftover (`visual height − top pane − bottom pane`) rather than
        // enumerated piece by piece, so it stays correct even if the chrome changes shape later. Added back on
        // both the request AND the un-request (`actualTopHeight = clamped − bottom − chrome`) so a zero-move
        // drag reconstructs the CURRENT total exactly. Pure pointer delta (y - dragStartY) still drives every
        // subsequent frame — additive to t2349's own delta fix, not a reversion of it: t2349's bug was reading
        // `topPane.height` and the pointer-offset `startOffset` as ONE shared quantity across BOTH this branch
        // and the actsAsSizer branch above, which need genuinely different baselines (a pane's own height here
        // vs the visual's own extent there) — kept as separately-sourced variables this time, each exact for
        // what IT measures, with the leftover chrome accounted for explicitly instead of silently absorbed.
        if (visual && allPanes.length > 0) {
            const topH = allPanes[0].getBoundingClientRect().height;
            dragStartTopHeight = topH;
            dragStartChrome = visual.getBoundingClientRect().height - topH - startBottomHeight;
        }
        dragMaxHeight = visual ? visualMaxHeight(visual) : VIZH_MAX;   // t2353 — captured once; see heightAt's own comment above
        dragging = true; e.preventDefault();
        try { sp.setPointerCapture(e.pointerId); } catch (_) { /* */ }
        split.classList.add('is-dragging');
        stopFollow = followPanelResize(split);                     // reuse t785 — rAF-resize BOTH canvases live during the drag
        sp.addEventListener('pointermove', onMove); sp.addEventListener('pointerup', onUp); sp.addEventListener('pointercancel', onUp);
    });
    // keyboard a11y — arrows nudge the ratio (the separator role invites it)
    sp.addEventListener('keydown', (e) => {
        if (split.dataset.splitOn !== '1') return;
        const allPanes = [...split.querySelectorAll(':scope > [data-viz-pane]')];
        if (allPanes.length > 0) {
            const topPane = allPanes[0];
            if (topPane.getAttribute('data-collapsed') === '1') {
                const kind = topPane.dataset.vizPane;
                applyState(topPane, false, true);
                setPaneCollapsed(kind, false);
            }
        }
        actsAsSizer = allPanes.length > 1 && allPanes[1].getAttribute('data-collapsed') === '1';
        
        if (actsAsSizer) {
            const step = e.shiftKey ? 40 : 12;
            if (e.key === 'ArrowUp') { e.preventDefault(); setVisualHeight((getVisualHeight() || visual.getBoundingClientRect().height) - step); }
            if (e.key === 'ArrowDown') { e.preventDefault(); setVisualHeight((getVisualHeight() || visual.getBoundingClientRect().height) + step); }
        } else {
            const d = e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -0.05 : (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 0.05 : 0);
            if (!d) return;
            e.preventDefault();
            const a = split.querySelector(':scope > [data-viz-pane="preview3d"]'), b = split.querySelector(':scope > [data-viz-pane="layout2d"]');
            const threeDTop = a && b && a.getBoundingClientRect().top <= b.getBoundingClientRect().top;
            setPaneRatio(getPaneRatio() + (threeDTop ? -d : d));       // ArrowDown grows the bottom pane, regardless of which it is
            hostsResizeOnce(split);
        }
    });

    updateSplitOn(split);
    try { new MutationObserver(() => updateSplitOn(split)).observe(split, { attributes: true, attributeFilter: ['style', 'data-collapsed'], subtree: true, childList: true }); } catch (_) { /* */ }
}

let _wired = false;
/** Make every collapsible pane in `root` (a wizard panel) individually foldable. Idempotent — safe every open.
 *  Each viz pane DECLARES its kind via `data-viz-pane` (the 2D layout · the 3D verify); the code preview is 'code'. */
export function makePanesCollapsible(root) {
    if (!root) return;
    // The declared viz panes — 2D layout + 3D verify fold INDEPENDENTLY (t784), each on its own side-chevron strip.
    root.querySelectorAll('.wiz-visual [data-viz-pane]').forEach((pane) => {
        const kind = pane.dataset.vizPane;
        if (kind) enhancePane(pane, kind, LABEL[kind] || kind);
    });
    // The G-code preview block (inside the form) — a separate, independent pane kind.
    root.querySelectorAll('.preview-block').forEach((pb) => enhancePane(pb, 'code', LABEL.code || 'G-code'));
    // t790 — a drag-splitter between the two viz panes (idempotent); apply the persisted ratio.
    root.querySelectorAll('.wiz-visual .viz-split').forEach((split) => { addPaneSplitter(split); addVisualSizer(split); });
    applyPaneRatio();
    applyVisualHeight();

    // Live cross-wizard sync: folding a kind in one open wizard re-applies (snapped) to every mounted pane of that kind.
    if (!_wired) {
        _wired = true;
        applyPaneRatio();
        onRatioChange((r) => applyPaneRatio(r));                   // a drag in one wizard rebalances every mounted pane live
        onVisualHeightChange((h) => applyVisualHeight(h));         // …and the bottom handle resizes every mounted visual live
        onPaneChange((id) => {
            document.querySelectorAll('.wiz-body [data-pane-kind]').forEach((pane) => {
                const kind = pane.dataset.paneKind;
                if (id && kind !== id) return;
                const want = isPaneCollapsed(kind);
                if ((pane.getAttribute('data-collapsed') === '1') !== want) applyState(pane, want, false);
            });
            document.querySelectorAll('.wiz-visual .viz-split').forEach((split) => updateSplitOn(split));   // collapse → splitter inert
        });
    }
}
