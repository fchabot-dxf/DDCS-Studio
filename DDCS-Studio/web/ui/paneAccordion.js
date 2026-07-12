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
 *   --drawer-dur (capped ≤350ms so personality never costs responsiveness) · --drawer-ease (timing function) ·
 *   --drawer-reveal (slide|roll|fade|wipe|unfold) · --drawer-dir (up|down|left|right) · --drawer-corner-{expanded,collapsed}.
 * This engine READS those tokens and drives ONE mechanism (measured-height collapse + a data-reveal/data-dir the CSS
 * keys the personality off) → N distinct personalities from pure data. prefers-reduced-motion ⇒ instant (rate-toast
 * precedent). View-only: no emit path is touched.
 */
import { isPaneCollapsed, setPaneCollapsed, onPaneChange, PANE_KINDS } from './panePrefs.js';

const LABEL = Object.fromEntries(PANE_KINDS.map((k) => [k.id, k.label]));
const DUR_CAP = 350;   // ms — the hard ceiling on any theme's drawer duration
const reduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };
const numDur = (raw) => { const m = /([\d.]+)\s*(ms|s)?/.exec(raw || ''); if (!m) return 220; const v = parseFloat(m[1]); return m[2] === 's' ? v * 1000 : v; };

// A chevron that rotates with the collapsed state (CSS handles the rotation off [data-collapsed]).
const CHEVRON = '<svg class="wiz-pane-chev" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';

// Read the ACTIVE theme's drawer tokens (getComputedStyle on <body>, where data-theme lives — the established pattern).
function motionTokens() {
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

function applyState(pane, collapsed, animate) {
    const body = pane.querySelector(':scope > .wiz-pane-body');
    const bar = pane.querySelector(':scope > .wiz-pane-bar');
    if (!body) return;
    const tk = motionTokens();
    pane.dataset.reveal = tk.reveal;
    pane.dataset.dir = tk.dir;
    pane.style.setProperty('--drawer-dur-eff', (animate && !reduced() ? tk.dur : 0) + 'ms');
    pane.style.setProperty('--drawer-ease-eff', tk.ease);
    pane.setAttribute('data-collapsed', collapsed ? '1' : '0');
    if (bar) bar.setAttribute('aria-expanded', collapsed ? 'false' : 'true');

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

    // Live cross-wizard sync: folding a kind in one open wizard re-applies (snapped) to every mounted pane of that kind.
    if (!_wired) {
        _wired = true;
        onPaneChange((id) => {
            document.querySelectorAll('.wiz-body [data-pane-kind]').forEach((pane) => {
                const kind = pane.dataset.paneKind;
                if (id && kind !== id) return;
                const want = isPaneCollapsed(kind);
                if ((pane.getAttribute('data-collapsed') === '1') !== want) applyState(pane, want, false);
            });
        });
    }
}
