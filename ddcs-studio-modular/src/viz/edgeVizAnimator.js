/**
 * Edge Viz Animator
 * Mirrors CornerVizAnimator pattern but for edgeViz.svg
 */

import { PathAnimator, flashWcs } from './middleVizAnimator.js';

export class EdgeVizAnimator {
    constructor() {
        this._animator = new PathAnimator({
            pxPerSec: 40,
            holdMs: 300,
            loop: false,
            fastMultiplier: 3
        });
        this._token = 0;
    }

    _buildSteps(axis, dir) {
        const base = `#edge_${axis}_${dir}`;
        return [
            { selector: `${base}_probepath`,   type: 'probe',   stepNum: 1 },
            { selector: `${base}_retractpath`, type: 'retract', stepNum: 2 }
        ];
    }

    stop() {
        this._token++;
        this._animator.stop();
        if (this._animator._loopTimer) {
            clearTimeout(this._animator._loopTimer);
            this._animator._loopTimer = null;
        }
    }

    async play(axis = 'X', dir = 'pos') {
        this._token++;
        const myToken = this._token;

        this._animator.stop();

        const steps = this._buildSteps(axis, dir);

        // Wait for first step element to exist in DOM
        await new Promise(resolve => {
            const check = () => {
                const first = document.querySelector(steps[0]?.selector);
                if (first) { resolve(); }
                else setTimeout(check, 30);
            };
            check();
        });

        if (myToken !== this._token) return;

        const runLoop = async () => {
            if (myToken !== this._token) return;
            const wcsEl = document.getElementById(`edge_${axis}_${dir}_wcs`) || null;
            if (wcsEl) wcsEl.style.display = 'none';
            await this._animator.playSequence({ axis1Steps: steps }).catch(() => {});
            if (myToken !== this._token) return;
            if (wcsEl) await flashWcs(wcsEl);
            if (myToken !== this._token) return;
            setTimeout(() => {
                if (myToken === this._token) {
                    if (wcsEl) wcsEl.style.display = 'none';
                    runLoop();
                }
            }, 300);
        };

        runLoop();
    }
}

if (typeof window !== 'undefined') window.EdgeVizAnimator = EdgeVizAnimator;
