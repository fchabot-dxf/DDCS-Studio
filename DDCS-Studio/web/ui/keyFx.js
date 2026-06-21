/**
 * ui/keyFx.js — Corsair-style reactive key lighting for the on-screen keypad (visuals are futuristic-only;
 * the CSS for .kp-flash is scoped to [data-theme="futuristic"], so other themes are unaffected).
 *
 *  • Reactive press flash — a key glows bright then fades (~1.3s) when pressed.
 *
 * Just toggles a class; the look lives in CSS (styles.css → kp-flash keyframes).
 */
export function initKeyFx() {
    const dock = document.getElementById('controller-dock');
    if (!dock) return;

    const reduce = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };
    const isFuturistic = () => document.body.getAttribute('data-theme') === 'futuristic';

    // re-add a class so the animation restarts on every trigger
    const pulse = (el, cls, ms) => {
        el.classList.remove(cls);
        void el.offsetWidth;             // force reflow
        el.classList.add(cls);
        setTimeout(() => el.classList.remove(cls), ms);
    };

    // Reactive press flash (delegated; works for keys rendered later too).
    dock.addEventListener('pointerdown', (e) => {
        if (reduce() || !isFuturistic()) return;
        const key = e.target.closest('.dock-body .toolbar-btn, .editor-keys-row .toolbar-btn');
        if (key) pulse(key, 'kp-flash', 2250);
    }, true);
}
