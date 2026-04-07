/**
 * Scale Manager - Handles application-wide zoom functionality
 * Syncs with scale button in header
 */

export class ScaleManager {
    constructor() {
        // Supported scale options (percent) and a special 'auto' mode.
        // Start at 75% and go up to 250% (keep 100% as normal baseline). 'auto' sits near 100% for natural cycling.
        this.scales = [75, 100, 'auto', 125, 150, 175, 200, 250];
        this.currentIndex = this.scales.indexOf('auto'); // default to 'auto' (fit-to-viewport)
        this.storageKey = 'ddcs_scale_preference';

        // Load saved scale preference (if present)
        this.loadScale();

        // If no saved preference or invalid index, ensure we start at baseline (100%)
        if (this.currentIndex < 0 || this.scales[this.currentIndex] === undefined) {
            const idx100 = this.scales.indexOf(100);
            if (idx100 !== -1) {
                this.currentIndex = idx100;
                console.debug('ScaleManager: defaulting initial scale to 100%');
            }
        }

        // Setup button and observers
        this.setupButton();

        // Apply initial scale (numeric or auto)
        this.applyScale(this.getCurrentScale());

        // If we're in auto mode, ensure we recompute on resize
        window.addEventListener('resize', () => {
            if (this.isAutoScale()) {
                this.applyScale('auto');
            }
        });
    }
    
    loadScale() {
        const saved = localStorage.getItem(this.storageKey);
        if (saved) {
            // support both numeric and 'auto'
            const num = parseInt(saved, 10);
            let index = -1;
            if (!isNaN(num)) index = this.scales.indexOf(num);
            if (index === -1 && saved === 'auto') index = this.scales.indexOf('auto');
            if (index !== -1) {
                this.currentIndex = index;
            }
        }
    }
    
    saveScale() {
        const cur = this.getCurrentScale();
        localStorage.setItem(this.storageKey, cur === 'auto' ? 'auto' : cur.toString());
    }
    
    getCurrentScale() {
        return this.scales[this.currentIndex];
    }
    
    getNextScale() {
        // Support configurable cycle direction (default: ascending small->large)
        const old = this.currentIndex;
        if (this.cycleForward === undefined) this.cycleForward = true;
        if (this.cycleForward) {
            this.currentIndex = (this.currentIndex + 1) % this.scales.length;
        } else {
            this.currentIndex = (this.currentIndex - 1 + this.scales.length) % this.scales.length;
        }
        console.debug('ScaleManager.getNextScale', { from: this.scales[old], to: this.scales[this.currentIndex], forward: this.cycleForward });
        return this.getCurrentScale();
    }
    
    applyScale(scale) {
        // scale can be a number (50/75/100/...) or the string 'auto'
        if (scale === 'auto') {
            // compute a reasonable automatic scale based on viewport vs design size
            const vw = window.innerWidth;
            const vh = window.innerHeight - 54; // subtract header height
            const ratio = Math.min(vw / 1280, vh / 800);
            // Allow auto to pick up to 250% (previously capped at 200)
            const pct = Math.max(75, Math.min(250, Math.round(ratio * 100))); // minimum 75, max 250
            // set attribute to 'auto' (so we know mode) and apply explicit zoom value
            document.body.setAttribute('data-scale', 'auto');
            document.body.style.zoom = (pct / 100).toString();
            // Ensure currentIndex reflects 'auto' so saveScale stores 'auto'
            const ai = this.scales.indexOf('auto');
            if (ai !== -1) this.currentIndex = ai;
            this.updateButton('auto', pct);
            this.saveScale();
            window.dispatchEvent(new CustomEvent('scaleChanged', { detail: { scale: 'auto', value: pct } }));
            console.log(`Scale changed to auto (${pct}%)`);
            return;
        }

        // numeric scale - prefer CSS rules (body[data-scale] selectors)
        const n = parseInt(scale, 10);
        if (isNaN(n)) return;
        // clear any inline zoom
        document.body.style.zoom = '';
        document.body.setAttribute('data-scale', n.toString());
        this.updateButton(n);
        this.saveScale();
        window.dispatchEvent(new CustomEvent('scaleChanged', { detail: { scale: n } }));
        console.log(`Scale changed to ${n}%`);
    }
    
    updateButton(scale, autoValue) {
        const btn = document.getElementById('scaleBtn');
        if (!btn) return;
        // Mark that we are updating the button so the MutationObserver ignores this change
        try { btn.dataset.__ddcs_updating = '1'; } catch (e) { /* noop */ }

        if (scale === 'auto') {
            btn.textContent = `🔍 AUTO (${autoValue}%)`;
            btn.setAttribute('title', `Current Zoom: AUTO (${autoValue}%) - Click to change`);
            // Clear the updating flag shortly after to allow external syncs
            setTimeout(() => { try { delete btn.dataset.__ddcs_updating; } catch (e) { /* noop */ } }, 40);
            return;
        }
        btn.textContent = `🔍 ${scale}%`;
        btn.setAttribute('title', `Current Zoom: ${scale}% - Click to change`);
        setTimeout(() => { try { delete btn.dataset.__ddcs_updating; } catch (e) { /* noop */ } }, 40);
    }
    
    setupButton() {
        const btn = document.getElementById('scaleBtn');
        if (!btn) {
            console.warn('Scale button #scaleBtn not found');
            return;
        }

        // Remove any existing onclick handler
        btn.removeAttribute('onclick');

        // Add click handler - ensure our manager controls scaling
        btn.addEventListener('click', () => {
            const nextScale = this.getNextScale();
            this.applyScale(nextScale);
        });

        // Watch for external changes to the button text (e.g., Live Preview injection)
        // Ignore mutations that we caused intentionally via updateButton (use data flag)
        const mo = new MutationObserver(() => {
            try {
                // If we're the ones updating the button, skip syncing to avoid feedback loops
                if (btn.dataset && btn.dataset.__ddcs_updating) return;
                const txt = btn.textContent || '';
                const m = txt.match(/(\d+)%/);
                if (m) {
                    const v = parseInt(m[1], 10);
                    // If button reports a scale different from our value, sync
                    if (v !== this.getCurrentScale()) {
                        console.debug('ScaleManager: button mutation detected, syncing to', v);
                        this.setScaleFromValue(v);
                    }
                }
            } catch (err) { /* noop */ }
        });
        mo.observe(btn, { characterData: true, childList: true, subtree: true });

        // Observe body[data-scale] attribute changes (external scripts may set it)
        const bodyObserver = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.type === 'attributes' && m.attributeName === 'data-scale') {
                    const val = document.body.getAttribute('data-scale');
                    const v = val ? parseInt(val, 10) : null;
                    if (v && v !== this.getCurrentScale()) {
                        console.debug('ScaleManager: body[data-scale] changed externally, syncing to', v);
                        this.setScaleFromValue(v);
                    }
                }
            }
        });
        bodyObserver.observe(document.body, { attributes: true });

        console.log('Scale button initialized');
    }

    // Backwards-compatible methods expected by existing code
    apply() {
        this.applyScale(this.getCurrentScale());
    }

    toggle() {
        const next = this.getNextScale();
        this.applyScale(next);
    }

    // Toggle cycle direction (true = ascending 50->200->auto, false = descending)
    reverseCycleDirection() {
        this.cycleForward = !this.cycleForward;
        console.debug('ScaleManager: cycle direction reversed, now forward=', this.cycleForward);
    }

    // Allow setting scale by numeric value (e.g., 100/125/150). If the
    // value doesn't match an existing scale, choose the closest match.
    setScaleFromValue(value) {
        if (value === 'auto') {
            const idx = this.scales.indexOf('auto');
            if (idx !== -1) { this.currentIndex = idx; this.applyScale('auto'); }
            return;
        }
        if (!value || typeof value !== 'number') return;
        let idx = this.scales.indexOf(value);
        if (idx === -1) {
            // Find nearest numeric scale (ignore 'auto')
            let best = 0;
            let bestDiff = Infinity;
            this.scales.forEach((s, i) => {
                if (typeof s !== 'number') return;
                const d = Math.abs(s - value);
                if (d < bestDiff) { bestDiff = d; best = i; }
            });
            idx = best;
        }
        this.currentIndex = idx;
        this.applyScale(this.getCurrentScale());
    }

    // Compatibility: older code expected an isAutoScale() method
    // Since this manager does not implement 'auto' scaling by default,
    // return false. This makes callers safe without changes.
    isAutoScale() {
        return this.getCurrentScale() === 'auto';
    }
}

// Helper to detect a valid DDCS ScaleManager
function isValidScaleManager(obj) {
    return obj && typeof obj.getCurrentScale === 'function' && typeof obj.applyScale === 'function';
}

// Ensure a DDCS ScaleManager exists as window.scaleManager; replace incompatible instances
function ensureGlobalScaleManager() {
    if (!isValidScaleManager(window.scaleManager)) {
        console.debug('ScaleManager: Installing DDCS ScaleManager (replacing invalid/global)');
        // Create and assign our instance
        window.scaleManager = new ScaleManager();
        // mark for identification
        try { window.scaleManager.__ddcs_managed = true; } catch (e) { /* noop */ }
    } else {
        // mark existing valid manager as managed if possible
        try { window.scaleManager.__ddcs_managed = true; } catch (e) { /* noop */ }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureGlobalScaleManager);
} else {
    ensureGlobalScaleManager();
}

// Expose toggle function for backwards compatibility
window.toggleScale = function() {
    if (window.scaleManager && typeof window.scaleManager.getNextScale === 'function') {
        const nextScale = window.scaleManager.getNextScale();
        window.scaleManager.applyScale(nextScale);
    }
};