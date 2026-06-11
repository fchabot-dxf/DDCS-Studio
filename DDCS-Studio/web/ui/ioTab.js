/**
 * ioTab.js — Floating Virtual I/O panel
 *
 * A draggable, toggleable panel showing the controller's 24 inputs + 24 outputs
 * during simulation. Inputs are click-to-toggle (latched) so you can assert a
 * sensor state and exercise IF/GOTO branches; outputs are read-only and light
 * up as the program drives them (M10/M11).
 *
 * The panel speaks the engine's pin language: a click on IN5 injects the
 * RESOLVED virtual pin name (e.g. IN_DRAWBAR_CLOSED via HARDWARE_PIN_MAP), the
 * same name an M31 P5 wait polls — so manual toggles actually unblock waits.
 *
 * Auto-shown when execution parks on an input wait (the waited pin pulses).
 * "Auto sensors" (default ON) lets the engine answer waits by itself after a
 * short delay; turn it off to hand-drive sensors and test failure paths.
 *
 * API: window.ioPanel = { show, hide, toggle, setWait, isAutoSensors }
 */
import { injectVirtualInput, getVirtualInput, ioState, resolveVirtualPin } from '../engine/virtualIO.js';

const IO_PANEL_POS_KEY = 'ddcs_io_panel_pos';
const PIN_COUNT = 24;

class IOPanel {
    constructor() {
        this.el = null;
        this.intervalId = null;
        this.waitPin = null;     // numeric pin the engine is parked on (null = none)
    }

    _build() {
        if (this.el) return;
        const el = document.createElement('div');
        el.id = 'io-panel';
        el.className = 'io-panel';
        let inputs = '', outputs = '';
        for (let i = 1; i <= PIN_COUNT; i++) {
            const inName = resolveVirtualPin(i, 'IN');
            const outName = resolveVirtualPin(i, 'OUT');
            inputs += `<button class="io-led io-input" data-pin="${i}" title="IN${i}${inName !== 'IN_' + i ? ' — ' + inName : ''} (click to toggle)">` +
                `<span class="io-led-indicator"></span>${i}</button>`;
            outputs += `<div class="io-led io-output" data-pin="${i}" title="OUT${i}${outName !== 'OUT_' + i ? ' — ' + outName : ''}">` +
                `<span class="io-led-indicator"></span>${i}</div>`;
        }
        el.innerHTML = `
            <div class="io-panel-head">
                <span class="io-panel-title">VIRTUAL I/O</span>
                <label class="io-panel-auto" title="Sensors answer waits by themselves after a short delay (like the real hardware). Turn off to hand-drive inputs and test failure branches.">
                    <input type="checkbox" id="io_panel_auto" checked> Auto sensors</label>
                <span class="io-panel-close" title="Close">✕</span>
            </div>
            <div class="io-panel-body">
                <div class="io-panel-wait" id="io_panel_wait"></div>
                <div class="io-panel-section">INPUTS — click to toggle</div>
                <div class="io-led-grid io-inputs">${inputs}</div>
                <div class="io-panel-section">OUTPUTS</div>
                <div class="io-led-grid io-outputs">${outputs}</div>
            </div>`;
        document.body.appendChild(el);
        this.el = el;

        // Latched input toggle — inject the RESOLVED pin name (what M31/M33 polls)
        el.querySelector('.io-inputs').addEventListener('click', (e) => {
            const btn = e.target.closest('.io-input');
            if (!btn) return;
            const pin = parseInt(btn.dataset.pin, 10);
            const name = resolveVirtualPin(pin, 'IN');
            injectVirtualInput(name, !getVirtualInput(name));
            this.refresh();
        });

        el.querySelector('.io-panel-close').addEventListener('click', () => this.hide());
        el.querySelector('#io_panel_auto').addEventListener('change', (e) => {
            window.dispatchEvent(new CustomEvent('ddcs:auto-sensors-changed', { detail: { on: e.target.checked } }));
        });

        this._makeDraggable(el);
        this._restorePos(el);
        // Resizable via CSS (resize: both); persist the chosen size with the position.
        this._sizeRo = new ResizeObserver(() => {
            if (!this.isVisible()) return;
            clearTimeout(this._sizeT);
            this._sizeT = setTimeout(() => this._savePos(), 250);
        });
        this._sizeRo.observe(el);
        window.addEventListener('io_change', () => { if (this.isVisible()) this.refresh(); });
    }

    _makeDraggable(el) {
        const head = el.querySelector('.io-panel-head');
        let sx = 0, sy = 0, ox = 0, oy = 0, pid = null;
        head.addEventListener('pointerdown', (e) => {
            if (e.target.closest('input, .io-panel-close')) return;
            const r = el.getBoundingClientRect();
            sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top; pid = e.pointerId;
            try { head.setPointerCapture(pid); } catch (_) { /* older browsers */ }
            e.preventDefault();
        });
        head.addEventListener('pointermove', (e) => {
            if (pid === null || e.pointerId !== pid) return;
            const x = Math.max(0, Math.min(window.innerWidth - 60, ox + e.clientX - sx));
            const y = Math.max(0, Math.min(window.innerHeight - 30, oy + e.clientY - sy));
            el.style.left = x + 'px';
            el.style.top = y + 'px';
            el.style.right = 'auto';
        });
        const end = () => {
            if (pid === null) return;
            try { head.releasePointerCapture(pid); } catch (_) { /* ignore */ }
            pid = null;
            this._savePos();
        };
        head.addEventListener('pointerup', end);
        head.addEventListener('pointercancel', end);
    }

    _savePos() {
        const el = this.el;
        if (!el) return;
        try {
            localStorage.setItem(IO_PANEL_POS_KEY, JSON.stringify({
                left: el.style.left, top: el.style.top,
                width: el.style.width || (el.offsetWidth ? el.offsetWidth + 'px' : ''),
                height: el.style.height || (el.offsetHeight ? el.offsetHeight + 'px' : ''),
            }));
        } catch (_) { /* ignore */ }
    }

    _restorePos(el) {
        try {
            const p = JSON.parse(localStorage.getItem(IO_PANEL_POS_KEY) || 'null');
            if (!p) return;
            if (p.left && p.top) { el.style.left = p.left; el.style.top = p.top; el.style.right = 'auto'; }
            if (p.width) el.style.width = p.width;
            if (p.height) el.style.height = p.height;
        } catch (_) { /* ignore */ }
    }

    /** Read a pin's state across naming schemes (resolved name + legacy numeric keys). */
    _pinState(map, pin, mode) {
        return !!map.get(resolveVirtualPin(pin, mode)) || !!map.get(pin) || !!map.get(String(pin));
    }

    refresh() {
        if (!this.el) return;
        this.el.querySelectorAll('.io-input').forEach((btn) => {
            const pin = parseInt(btn.dataset.pin, 10);
            btn.classList.toggle('active', this._pinState(ioState.inputs, pin, 'IN'));
            btn.classList.toggle('wait', this.waitPin != null && pin === this.waitPin);
        });
        this.el.querySelectorAll('.io-output').forEach((div) => {
            const pin = parseInt(div.dataset.pin, 10);
            div.classList.toggle('active', this._pinState(ioState.outputs, pin, 'OUT'));
        });
    }

    /** Engine is parked on (or released from) an input wait — pulse that pin. */
    setWait(wait) {
        this.waitPin = wait && Number.isFinite(wait.pin) ? Math.round(wait.pin) : null;
        if (!this.el) {
            if (this.waitPin == null) return;
            this._build();
        }
        const msg = this.el.querySelector('#io_panel_wait');
        if (msg) {
            // Numbered pin (M31 P5) → "IN5 (IN_DRAWBAR_CLOSED)"; DDCS ATC sensor with a
            // controller-configured port (M302 etc.) → just the semantic name.
            const label = this.waitPin != null ? `IN${this.waitPin} (${wait && wait.pinName})` : (wait && wait.pinName);
            msg.textContent = wait
                ? `⚠ Waiting for ${label} to be ${wait.target ? 'ON' : 'OFF'}${this.waitPin != null ? ' — click it to satisfy' : ' (auto sensor or truth table answers)'}`
                : '';
            msg.style.display = wait ? 'block' : 'none';
        }
        this.refresh();
    }

    isVisible() { return !!(this.el && this.el.classList.contains('visible')); }
    isAutoSensors() {
        const cb = this.el && this.el.querySelector('#io_panel_auto');
        return cb ? cb.checked : true;
    }

    show() {
        this._build();
        this.el.classList.add('visible');
        this.refresh();
        // Poll while visible: outputs change without an io_change event (M10/M11),
        // and the truth table flips inputs on timers.
        if (!this.intervalId) this.intervalId = setInterval(() => this.refresh(), 150);
    }

    hide() {
        if (this.el) this.el.classList.remove('visible');
        if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; }
    }

    toggle() { this.isVisible() ? this.hide() : this.show(); }
}

function initIOPanel() {
    if (!window.ioPanel) window.ioPanel = new IOPanel();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initIOPanel);
} else {
    initIOPanel();
}
