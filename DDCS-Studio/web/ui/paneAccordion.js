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

function applyVisualHeight(h) {
    const px = h === undefined ? getVisualHeight() : h;
    let healed = null;
    document.querySelectorAll('.wiz-visual').forEach((v) => {
        if (px == null) { v.style.removeProperty('--viz-explicit-h'); v.style.removeProperty('--viz-stack-h'); v.style.removeProperty('height'); v.style.removeProperty('flex'); return; }
        // THE STORED VALUE HEALS. A 900 persisted before this fix (or saved on a taller window, or on a screen that
        // has since been resized) must not reopen every wizard with its handle buried — so a visual that cannot take
        // the stored height takes what it can, and the smallest such fit is written back below. Reopening broken is
        // the part the user actually felt: the clamp alone would fix the drag and leave the damage in localStorage.
        const cap = visualMaxHeight(v);
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

    // The ceiling is asked of the container at DRAG TIME, not read from a constant — see visualMaxHeight.
    const heightAt = (y) => Math.max(VIZH_MIN, Math.min(visualMaxHeight(visual), Math.round(y - visual.getBoundingClientRect().top)));
    let dragging = false, stopFollow = null, startTopHeight = 0;
    // t2345 — the pane list and their top/bottom order CANNOT change mid-drag (nothing else resizes this
    // split while a pointer is captured on it), so both are read ONCE at pointerdown and reused by every
    // onMove frame instead of re-querying + re-measuring on every pointermove (up to 120Hz on a phone) — that
    // was a read (querySelectorAll + 2x getBoundingClientRect) landing right after applyVisualHeight's OWN
    // write, forcing a synchronous reflow on every single event. rAF-coalescing (below) means the write side
    // (applyVisualHeight/applyPaneRatio — the latter itself doing a deliberate forced reflow per mounted
    // visual, see stackChrome) runs at most once per animation frame instead of once per pointer event too.
    let dragPanes = [], dragThreeDTop = false;
    let rafId = null, pendingY = null;
    const applyMove = (y) => {
        let clampedTotalHeight = heightAt(y);
        applyVisualHeight(clampedTotalHeight);
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

        let clampedTotalHeight = heightAt(e.clientY);
        setVisualHeight(clampedTotalHeight);

        const panes = [...visual.querySelectorAll('.viz-split > [data-viz-pane]')];
        if (panes.length > 1) {
            let frac = startTopHeight / Math.max(1, clampedTotalHeight);
            const a = panes[0];
            const b = panes[1];
            const threeDTop = a && b && a.getBoundingClientRect().top <= b.getBoundingClientRect().top;
            let newRatio = Math.max(RATIO_MIN, Math.min(RATIO_MAX, threeDTop ? frac : 1 - frac));
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
    const heightAt = (y) => {
        if (!visual) return getVisualHeight();
        return Math.max(VIZH_MIN, Math.min(visualMaxHeight(visual), Math.round(y - visual.getBoundingClientRect().top)));
    };
    // t2345 — same shape/fix as addVisualSizer's onMove above: the a/b (preview3d/layout2d) top-order test is
    // invariant for the duration of a drag (they cannot swap position mid-drag), so it is read ONCE at
    // pointerdown instead of re-queried + re-measured on every pointermove; the write side is coalesced to one
    // requestAnimationFrame per frame instead of firing on every raw pointer event.
    let dragThreeDTop = false;
    let rafId = null, pendingY = null;
    const applyMove = (y) => {
        if (actsAsSizer) {
            applyVisualHeight(heightAt(y));
        } else {
            let requestedTopHeight = y - visual.getBoundingClientRect().top;
            let requestedTotalHeight = requestedTopHeight + startBottomHeight;
            let clampedTotalHeight = Math.max(VIZH_MIN, Math.min(visualMaxHeight(visual), requestedTotalHeight));
            let actualTopHeight = clampedTotalHeight - startBottomHeight;
            let frac = actualTopHeight / clampedTotalHeight;
            let newRatio = Math.max(RATIO_MIN, Math.min(RATIO_MAX, dragThreeDTop ? frac : 1 - frac));
            applyVisualHeight(clampedTotalHeight);
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
        if (actsAsSizer) {
            setVisualHeight(heightAt(e.clientY));
        } else {
            let requestedTopHeight = e.clientY - visual.getBoundingClientRect().top;
            let requestedTotalHeight = requestedTopHeight + startBottomHeight;
            let clampedTotalHeight = Math.max(VIZH_MIN, Math.min(visualMaxHeight(visual), requestedTotalHeight));
            let actualTopHeight = clampedTotalHeight - startBottomHeight;
            const a = split.querySelector(':scope > [data-viz-pane="preview3d"]');
            const b = split.querySelector(':scope > [data-viz-pane="layout2d"]');
            const threeDTop = a && b && a.getBoundingClientRect().top <= b.getBoundingClientRect().top;
            let frac = actualTopHeight / clampedTotalHeight;
            let newRatio = Math.max(RATIO_MIN, Math.min(RATIO_MAX, threeDTop ? frac : 1 - frac));
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
