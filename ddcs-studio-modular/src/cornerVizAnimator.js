/**
 * DDCS Studio - Corner Viz Animator
 * Animates the corner probe SVG using the shared PathAnimator engine.
 */

import { PathAnimator, flashWcs } from './middleVizAnimator.js';

/** Hold duration (ms) for Zfirst miniprobe before travel begins */
const ZFIRST_HOLD_MS = 800;

export class CornerVizAnimator {
    constructor() {
        this._animator = new PathAnimator({
            pxPerSec: 40,
            holdMs: 300,
            loop: false, // we always manage the loop ourselves
            fastMultiplier: 3
        });
        this._token = 0; // incremented on each play() call to invalidate old loops
        this._zfirstTimer = null;
    }

    _buildSteps(corner, seq, zfirst) {
        const pfx = `#corner_${corner}_${seq}`;
        const steps = [];
        if (zfirst) {
            steps.push({ selector: `${pfx}_Zfirst_travel`, type: 'jog', stepNum: 1 });
        }
        if (seq === 'YX') {
            steps.push({ selector: `${pfx}_Y_probepath`,   type: 'probe',   stepNum: 2 });
            steps.push({ selector: `${pfx}_Y_retractpath`, type: 'retract', stepNum: 3 });
            steps.push({ selector: `${pfx}_travelpath`,    type: 'jog',     stepNum: 4 });
            steps.push({ selector: `${pfx}_X_probepath`,   type: 'probe',   stepNum: 5 });
            steps.push({ selector: `${pfx}_X_retractpath`, type: 'retract', stepNum: 6 });
        } else {
            steps.push({ selector: `${pfx}_X_probepath`,   type: 'probe',   stepNum: 2 });
            steps.push({ selector: `${pfx}_X_retractpath`, type: 'retract', stepNum: 3 });
            steps.push({ selector: `${pfx}_travelpath`,    type: 'jog',     stepNum: 4 });
            steps.push({ selector: `${pfx}_Y_probepath`,   type: 'probe',   stepNum: 5 });
            steps.push({ selector: `${pfx}_Y_retractpath`, type: 'retract', stepNum: 6 });
        }
        return steps;
    }

    _patchAnimator() {
        const origDuration = this._animator._durationForStep.bind(this._animator);
        this._animator._durationForStep = (el, type) => {
            if (el?.id && (el.id.includes('travelpath') || el.id.includes('Zfirst_travel'))) {
                return origDuration(el, 'probe');
            }
            return origDuration(el, type);
        };
    }

    _patchMiniprobe(corner, seq) {
        this._animator._findMiniprobe = () => {
            const el = document.getElementById(`corner_${corner}_${seq}_miniprobe`);
            if (!el) return null;
            try {
                const bb = el.getBBox();
                return { el, cx: bb.x + bb.width / 2, cy: bb.y + bb.height / 2 };
            } catch(e) { return null; }
        };
    }

    // Suppress miniprobe tracking for the Zfirst travel step only.
    // Patches _trackMiniprobeAlongPath to skip tracking for Zfirst_travel,
    // then restores normal tracking (and unhides miniprobe) for all subsequent steps.
    _patchMiniprobeHidden(corner, seq) {
        const origTrack = this._animator._trackMiniprobeAlongPath.bind(this._animator);
        this._animator._trackMiniprobeAlongPath = (pathEl, duration) => {
            if (pathEl?.id?.includes('Zfirst_travel')) {
                // Use the Zfirst miniprobe for tracking during this step
                const zfirstEl = document.getElementById(`corner_${corner}_${seq}_Zfirst_miniprobe`);
                if (zfirstEl) {
                    try {
                        const bb = zfirstEl.getBBox();
                        this._animator._miniprobeHome = {
                            el: zfirstEl,
                            cx: bb.x + bb.width / 2,
                            cy: bb.y + bb.height / 2
                        };
                    } catch(e) { this._animator._miniprobeHome = null; }
                } else {
                    this._animator._miniprobeHome = null;
                }
                return origTrack(pathEl, duration);
            }
            // First non-Zfirst step: hide Zfirst miniprobe, restore regular miniprobe
            this._animator._trackMiniprobeAlongPath = origTrack;
            const zfirstEl = document.getElementById(`corner_${corner}_${seq}_Zfirst_miniprobe`);
            if (zfirstEl) zfirstEl.style.display = 'none';
            const regular = document.getElementById(`corner_${corner}_${seq}_miniprobe`);
            if (regular) regular.style.display = '';
            this._patchMiniprobe(corner, seq);
            this._animator._miniprobeHome = this._animator._findMiniprobe();
            return origTrack(pathEl, duration);
        };
    }

    _showZfirstMiniprobe(corner, seq) {
        return new Promise(resolve => {
            // Hide regular miniprobe first to prevent flash
            const regular = document.getElementById(`corner_${corner}_${seq}_miniprobe`);
            if (regular) { regular.removeAttribute('transform'); regular.style.display = 'none'; }
            // Clear any leftover Zfirst travel
            const travel = document.querySelector(`#corner_${corner}_${seq}_Zfirst_travel`);
            if (travel) travel.classList.remove('path-draw');
            // Show Zfirst miniprobe
            const zfirst = document.getElementById(`corner_${corner}_${seq}_Zfirst_miniprobe`);
            if (zfirst) zfirst.style.display = 'block';
            this._zfirstTimer = setTimeout(() => {
                this._zfirstTimer = null;
                resolve();
            }, ZFIRST_HOLD_MS);
        });
    }

    _hideZfirstMiniprobe(corner, seq) {
        // Don't hide Zfirst miniprobe here — it stays visible to track along Zfirst_travel path.
        // _patchMiniprobeHidden will hide it when the first real probe step starts.
    }

    stop() {
        this._token++; // invalidate any running loop
        this._animator.stop();
        // Also clear PathAnimator's internal loop timer if accessible
        if (this._animator._loopTimer) {
            clearTimeout(this._animator._loopTimer);
            this._animator._loopTimer = null;
        }
        if (this._zfirstTimer) {
            clearTimeout(this._zfirstTimer);
            this._zfirstTimer = null;
        }
    }

    async play(corner, seq, zfirst) {
        // Increment token — any loop iteration holding an old token will bail
        this._token++;
        const myToken = this._token;

        this._animator.stop();
        if (this._zfirstTimer) { clearTimeout(this._zfirstTimer); this._zfirstTimer = null; }

        const steps = this._buildSteps(corner, seq, zfirst);

        this._patchAnimator();
        this._patchMiniprobe(corner, seq);

        // Wait for SVG element to exist before starting
        await new Promise(resolve => {
            const check = () => {
                const el = document.getElementById(`corner_${corner}_${seq}_miniprobe`);
                if (el) { el.removeAttribute('transform'); resolve(); }
                else setTimeout(check, 30);
            };
            check();
        });

        if (myToken !== this._token) return; // superseded

        const runLoop = async () => {
            if (myToken !== this._token) return; // superseded

            if (zfirst) {
                // Reset paths before Zfirst miniprobe appears
                this._animator.reset({ axis1Steps: steps });
                this._animator._resetMiniprobe();
                await this._showZfirstMiniprobe(corner, seq);
                if (myToken !== this._token) return;
                this._hideZfirstMiniprobe(corner, seq);
                // Keep miniprobe hidden during Zfirst travel — unhide only on first Y/X probe step
                this._patchMiniprobeHidden(corner, seq);
            }

            if (myToken !== this._token) return;

            const wcsEl = document.getElementById(`corner_${corner}_${seq}_wcs`) || null;
            if (wcsEl) wcsEl.style.display = 'none';
            await this._animator.playSequence({ axis1Steps: steps }).catch(() => {});

            if (myToken !== this._token) return;

            // Flash wcs then loop
            if (wcsEl) await flashWcs(wcsEl);
            if (myToken !== this._token) return;

            // Hold then loop — check token again inside the timer
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

if (typeof window !== 'undefined') window.CornerVizAnimator = CornerVizAnimator;
