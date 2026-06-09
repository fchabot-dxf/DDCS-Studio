import { el } from './uiUtils.js';
import { injectVirtualInput, getVirtualInput, ioState } from './virtualIO.js';

class IOTabManager {
    constructor() {
        this.intervalId = null;
        this.domInitialized = false;
    }

    initSettingsDOM(ov) {
        if (this.domInitialized) return;

        const inputsGrid = ov.querySelector('#set_inputs_grid');
        const outputsGrid = ov.querySelector('#set_outputs_grid');

        if (!inputsGrid || !outputsGrid) return;

        // Build 24 Input LEDs
        for (let i = 1; i <= 24; i++) {
            const btn = document.createElement('button');
            btn.className = 'io-led io-input';
            btn.dataset.pin = i;
            btn.innerHTML = `<span class="io-led-indicator"></span> IN${i}`;
            
            // Manual Triggering
            btn.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                injectVirtualInput(i, true);
                this.updateLEDs(ov);
            });
            btn.addEventListener('pointerup', (e) => {
                e.preventDefault();
                injectVirtualInput(i, false);
                this.updateLEDs(ov);
            });
            btn.addEventListener('pointerleave', (e) => {
                e.preventDefault();
                injectVirtualInput(i, false);
                this.updateLEDs(ov);
            });

            inputsGrid.appendChild(btn);
        }

        // Build 24 Output LEDs
        for (let i = 1; i <= 24; i++) {
            const div = document.createElement('div');
            div.className = 'io-led io-output';
            div.dataset.pin = i;
            div.innerHTML = `<span class="io-led-indicator"></span> OUT${i}`;
            outputsGrid.appendChild(div);
        }
        
        this.domInitialized = true;
    }

    updateLEDs(ov) {
        const inputsGrid = ov ? ov.querySelector('#set_inputs_grid') : document.getElementById('set_inputs_grid');
        if (inputsGrid) {
            const inputs = inputsGrid.querySelectorAll('.io-input');
            inputs.forEach(btn => {
                const pin = parseInt(btn.dataset.pin, 10);
                // virtualIO stores numeric pins and named pins.
                const stateNum = !!ioState.inputs.get(pin) || !!ioState.inputs.get(String(pin));
                btn.classList.toggle('active', stateNum);
            });
        }
        
        const outputsGrid = ov ? ov.querySelector('#set_outputs_grid') : document.getElementById('set_outputs_grid');
        if (outputsGrid) {
            const outputs = outputsGrid.querySelectorAll('.io-output');
            outputs.forEach(div => {
                const pin = parseInt(div.dataset.pin, 10);
                const stateNum = !!ioState.outputs.get(pin) || !!ioState.outputs.get(String(pin));
                div.classList.toggle('active', stateNum);
            });
        }
    }

    startRefreshLoop() {
        if (!this.intervalId) {
            this.intervalId = setInterval(() => this.updateLEDs(), 100);
        }
    }

    stopRefreshLoop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
}

// Initialize
function initIOTab() {
    if (!window.ioTabManager) {
        window.ioTabManager = new IOTabManager();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initIOTab);
} else {
    initIOTab();
}
