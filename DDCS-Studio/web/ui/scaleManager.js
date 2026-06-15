/**
 * Scale Manager - application-wide zoom.
 * One header button (🔍 AUTO (x%) / x%) that opens a small popover under it: a continuous
 * slider (50–250%) + an AUTO button (fit-to-viewport, recomputed on resize). Persists.
 */

// data-scale buckets — styles.css keys overflow/wizard guards off these exact values.
const BUCKETS = [50, 75, 100, 125, 150, 175, 200, 250];

export class ScaleManager {
    constructor() {
        this.storageKey = 'ddcs_scale_preference';
        this.scale = 'auto';                   // 'auto' | number (percent)
        this.lastAutoPct = 100;

        this.loadScale();
        this.setupControls();
        this.applyScale(this.scale);

        // In auto mode, recompute on resize
        window.addEventListener('resize', () => {
            if (this.isAutoScale()) this.applyScale('auto');
        });
    }

    loadScale() {
        const saved = localStorage.getItem(this.storageKey);
        if (!saved) return;
        if (saved === 'auto') { this.scale = 'auto'; return; }
        const num = parseInt(saved, 10);
        if (!isNaN(num)) this.scale = Math.max(50, Math.min(250, num));
    }

    saveScale() {
        localStorage.setItem(this.storageKey, this.scale === 'auto' ? 'auto' : this.scale.toString());
    }

    getCurrentScale() {
        return this.scale;
    }

    applyScale(scale) {
        // scale: 'auto' or a percent number (continuous — the slider isn't limited to presets)
        if (scale === 'auto') {
            const vw = window.innerWidth;
            const vh = window.innerHeight - 54;            // subtract header height
            const ratio = Math.min(vw / 1280, vh / 800);
            const pct = Math.max(75, Math.min(250, Math.round(ratio * 100)));   // AUTO floors at 75% — 50% via zoom doubles the body width and overflows on mobile WebKit; 50% stays available manually
            this.scale = 'auto';
            this.lastAutoPct = pct;
            document.body.setAttribute('data-scale', 'auto');
            this.applyBodyZoom(pct);
            this.updateControls();
            this.saveScale();
            window.dispatchEvent(new CustomEvent('scaleChanged', { detail: { scale: 'auto', value: pct } }));
            return;
        }
        const n = Math.max(50, Math.min(250, parseInt(scale, 10)));
        if (isNaN(n)) return;
        this.scale = n;
        // exact zoom inline; data-scale snapped to the nearest bucket so the CSS guards still apply
        const bucket = BUCKETS.reduce((b, v) => (Math.abs(v - n) < Math.abs(b - n) ? v : b));
        document.body.setAttribute('data-scale', bucket.toString());
        this.applyBodyZoom(n);
        this.updateControls();
        this.saveScale();
        window.dispatchEvent(new CustomEvent('scaleChanged', { detail: { scale: n } }));
    }

    /**
     * Apply the UI zoom to <body> — EXCEPT when the Blocks tab is showing. Blockly breaks inside ANY CSS-scaled
     * ancestor: its getBoundingClientRect viewport metrics go wrong, so zoomToFit mis-scales (e.g. 1.87×) and
     * parks the blocks far off-screen. A counter-zoom on #blocks-app made it WORSE — nested zoom (body × counter)
     * corrupts the same metrics. So when Blocks is active we force <body> to zoom 1, a true 1.0 context Blockly
     * can measure correctly; the blocks scale via Blockly's own workspace zoom. #blocks-app is never CSS-zoomed.
     */
    applyBodyZoom(pct) {
        const blk = document.getElementById('blocks-app');
        const blocksVisible = blk && !blk.classList.contains('hidden');
        document.body.style.zoom = (blocksVisible ? 1 : pct / 100).toString();
        if (blk) blk.style.zoom = '';   // never CSS-zoom the Blockly tab
    }

    currentPct() {
        return this.scale === 'auto' ? this.lastAutoPct : this.scale;
    }

    updateControls() {
        const auto = this.scale === 'auto';
        const pct = this.currentPct();
        const label = document.querySelector('#scaleBtn .op-label');
        if (label) label.textContent = auto ? `AUTO (${pct}%)` : `${pct}%`;
        const pop = document.getElementById('scale-pop');
        if (pop) {
            pop.querySelector('#scaleSlider').value = String(pct);
            pop.querySelector('#scaleVal').textContent = pct + '%';
            pop.querySelector('#scaleAutoBtn').classList.toggle('on', auto);
        }
    }

    toggleQuickPanel() {
        const open = document.getElementById('scale-pop');
        if (open) { open.remove(); return; }
        const wrap = document.querySelector('.scale-ctl');
        const btn = document.getElementById('scaleBtn');
        if (!wrap || !btn) return;
        const pop = document.createElement('div');
        pop.id = 'scale-pop';
        pop.className = 'scale-pop';
        pop.innerHTML =
            '<div class="sp-row">' +
            '<input type="range" id="scaleSlider" min="50" max="250" step="5">' +
            '<span id="scaleVal" class="scale-val"></span>' +
            '</div>' +
            '<button type="button" id="scaleAutoBtn" class="op-btn">🔍 AUTO — fit to window</button>';
        // Append to <body> as the LAST child + position:fixed under the button. DOM order makes it paint on top of
        // the absolutely-positioned .app-shell even where z-index is unreliable (mobile WebKit under body { zoom }) —
        // anchoring it inside the header let the app body cover it ("zoom tool behind the wizard bar"). body has the
        // UI zoom, so divide the button's screen rect by the zoom to get body-layout coords.
        const z = parseFloat(getComputedStyle(document.body).zoom) || 1;
        const r = btn.getBoundingClientRect();
        pop.style.position = 'fixed';
        pop.style.top = ((r.bottom + 6) / z) + 'px';
        pop.style.right = ((window.innerWidth - r.right) / z) + 'px';
        pop.style.zIndex = '100000';
        document.body.appendChild(pop);
        const slider = pop.querySelector('#scaleSlider');
        // Live readout while dragging, but apply the zoom only on release — re-zooming mid-drag
        // would move the slider out from under the cursor.
        slider.addEventListener('input', () => { pop.querySelector('#scaleVal').textContent = slider.value + '%'; });
        slider.addEventListener('change', () => this.applyScale(parseInt(slider.value, 10)));
        pop.querySelector('#scaleAutoBtn').addEventListener('click', () => this.applyScale('auto'));
        this.updateControls();
        setTimeout(() => document.addEventListener('click', function close(e) {
            const p = document.getElementById('scale-pop');
            if (!p) { document.removeEventListener('click', close); return; }
            if (!p.contains(e.target) && !btn.contains(e.target)) {
                p.remove();
                document.removeEventListener('click', close);
            }
        }), 0);
    }

    setupControls() {
        const btn = document.getElementById('scaleBtn');
        if (!btn) return;
        // Two instances exist (app.js + this module's self-init) — wire the button exactly once,
        // or every click toggles the popover twice (the old cycling button double-stepped for the
        // same reason).
        if (btn.dataset.scaleWired) return;
        btn.dataset.scaleWired = '1';
        btn.removeAttribute('onclick');
        btn.addEventListener('click', () => this.toggleQuickPanel());
    }

    // Backwards-compatible surface (older code calls these)
    apply() {
        this.applyScale(this.scale);
    }

    toggle() {
        this.applyScale('auto');               // cycling is gone — "toggle" now means back to AUTO
    }

    setScaleFromValue(value) {
        this.applyScale(value === 'auto' ? 'auto' : value);
    }

    isAutoScale() {
        return this.scale === 'auto';
    }
}

// Helper to detect a valid DDCS ScaleManager
function isValidScaleManager(obj) {
    return obj && typeof obj.getCurrentScale === 'function' && typeof obj.applyScale === 'function';
}

// Ensure a DDCS ScaleManager exists as window.scaleManager; replace incompatible instances
function ensureGlobalScaleManager() {
    if (!isValidScaleManager(window.scaleManager)) {
        window.scaleManager = new ScaleManager();
        try { window.scaleManager.__ddcs_managed = true; } catch (e) { /* noop */ }
    } else {
        try { window.scaleManager.__ddcs_managed = true; } catch (e) { /* noop */ }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureGlobalScaleManager);
} else {
    ensureGlobalScaleManager();
}

// Expose toggle function for backwards compatibility (header button used to cycle; now = AUTO)
window.toggleScale = function() {
    if (window.scaleManager) window.scaleManager.applyScale('auto');
};
