/**
 * Align Viz Animator
 * Plays alignment probe/retract/jog sequence with miniprobe tracking.
 */

import { PathAnimator, flashWcs } from './middleVizAnimator.js';

export class AlignVizAnimator {
    constructor() {
        this._animator = new PathAnimator({
            pxPerSec: 40,
            holdMs: 300,
            loop: false,
            fastMultiplier: 3
        });
        this._token = 0;
    }

    _groupId(checkAxis, probeDir) {
        const probeAxis = checkAxis === 'X' ? 'Y' : 'X';
        return `align_${checkAxis}_${probeAxis}${probeDir}`;
    }

    _buildSteps(checkAxis, probeDir) {
        const groupId = this._groupId(checkAxis, probeDir);
        return [
            { selector: `#${groupId}_probepath1`, type: 'probe', stepNum: 1 },
            { selector: `#${groupId}_retractpath1`, type: 'retract', stepNum: 2 },
            { selector: `#${groupId}_jogpath`, type: 'jog', stepNum: 3 },
            { selector: `#${groupId}_probepath2`, type: 'probe', stepNum: 4 },
            { selector: `#${groupId}_retractpath2`, type: 'retract', stepNum: 5 }
        ];
    }

    _patchMiniprobe(groupId) {
        this._animator._findMiniprobe = () => {
            const el = document.getElementById(`${groupId}_miniprobe`);
            if (!el) return null;
            try {
                const bb = el.getBBox();
                return { el, cx: bb.x + bb.width / 2, cy: bb.y + bb.height / 2 };
            } catch (e) {
                return null;
            }
        };
    }

    stop() {
        this._token++;
        this._animator.stop();
        if (this._animator._loopTimer) {
            clearTimeout(this._animator._loopTimer);
            this._animator._loopTimer = null;
        }
    }

    async play(checkAxis = 'X', probeDir = 'pos') {
        this._token++;
        const myToken = this._token;

        this._animator.stop();

        const groupId = this._groupId(checkAxis, probeDir);
        const steps = this._buildSteps(checkAxis, probeDir);
        this._patchMiniprobe(groupId);

        await new Promise(resolve => {
            const check = () => {
                const first = document.querySelector(steps[0]?.selector);
                const mini = document.getElementById(`${groupId}_miniprobe`);
                if (first && mini) {
                    mini.removeAttribute('transform');
                    resolve();
                } else {
                    setTimeout(check, 30);
                }
            };
            check();
        });

        if (myToken !== this._token) return;

        const runLoop = async () => {
            if (myToken !== this._token) return;
            const wcsEl = document.getElementById(`${groupId}_wcs`) || null;
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

if (typeof window !== 'undefined') window.AlignVizAnimator = AlignVizAnimator;
