/** Animation speed in pixels per second */
export const ANIM_PACE = 40;
/** Jog/traverse paths animate at 3x the base pace */
export const ANIM_PACE_FAST = ANIM_PACE * 3;

export class PathAnimator {
  constructor({ pxPerSec = ANIM_PACE, holdMs = 300, loop = true, fastMultiplier = 3, fastPxPerSec = null } = {}) {
    this.pxPerSec = pxPerSec;           // Uniform animation speed (px/sec) for all non-jog paths
    this.holdMs = holdMs;               // Extra time to hold completed animation visible
    this.loop = loop;                   // Whether to loop the animation continuously

    // Jog/traverse fast pace: either derived from pxPerSec * fastMultiplier, or explicit fastPxPerSec
    this.fastMultiplier = fastMultiplier;
    this.fastPxPerSec = fastPxPerSec;   // if set, overrides derived fast pace

    this._timers = new Set();
    this._stopped = false;
    this._sessionId = 0;             // incremented on each playSequence call
    this._loopTimer = null;
    this._miniprobeRaf = null;       // current rAF id for miniprobe tracking
    this._miniprobeHome = null;      // { el, cx, cy } — original miniprobe position
  }

  /**
   * Find the miniprobe <g> for the axis group containing a step element.
   * Returns { el, cx, cy } or null.
   */
  _findMiniprobe(stepEl) {
    if (!stepEl) return null;
    // Walk up the ancestor chain and search each ancestor for a descendant
    // element whose id contains 'miniprobe'. This is more flexible than
    // relying on a fixed group id like 'middle_probe' and supports edge_*
    // groups (e.g., edge_X_pos_miniprobe).
    let ancestor = stepEl.closest('g') || stepEl.parentElement;
    while (ancestor) {
      try {
        if (ancestor.querySelector) {
          const mpEl = ancestor.querySelector('[id*="miniprobe"]');
          if (mpEl) {
            const bb = mpEl.getBBox();
            return { el: mpEl, cx: bb.x + bb.width / 2, cy: bb.y + bb.height / 2 };
          }
        }
      } catch (e) {
        // getBBox can throw for non-rendered elements; ignore and continue climbing
      }
      // stop at the SVG root
      if (ancestor.nodeName && ancestor.nodeName.toLowerCase() === 'svg') break;
      ancestor = ancestor.parentElement;
    }

    // Fallback: search the entire SVG for a miniprobe element (first found)
    try {
      const svgRoot = stepEl.ownerSVGElement || stepEl.closest('svg');
      if (svgRoot) {
        const mpEl = svgRoot.querySelector('[id*="miniprobe"]');
        if (mpEl) {
          const bb = mpEl.getBBox();
          return { el: mpEl, cx: bb.x + bb.width / 2, cy: bb.y + bb.height / 2 };
        }
      }
    } catch (e) { /* noop */ }

    return null;
  }

  /**
   * Move the miniprobe group so its center sits at (x, y).
   */
  _moveMiniprobe(mp, x, y) {
    if (!mp || !mp.el) return;
    const dx = x - mp.cx;
    const dy = y - mp.cy;
    mp.el.setAttribute('transform', `translate(${dx},${dy})`);
  }

  /**
   * Reset miniprobe to its home position (remove transform).
   */
  _resetMiniprobe() {
    if (this._miniprobeRaf) {
      cancelAnimationFrame(this._miniprobeRaf);
      this._miniprobeRaf = null;
    }
    if (this._miniprobeHome && this._miniprobeHome.el) {
      this._miniprobeHome.el.removeAttribute('transform');
    }
  }

  /**
   * Start a rAF loop that moves the miniprobe along a path for `duration` ms.
   * Returns a function to cancel the loop.
   */
  _trackMiniprobeAlongPath(pathEl, duration) {
    if (!this._miniprobeHome || !pathEl || typeof pathEl.getPointAtLength !== 'function') return () => {};
    const mp = this._miniprobeHome;
    const totalLen = this._getPathLength(pathEl);
    if (totalLen <= 0) return () => {};

    const startTime = performance.now();
    let cancelled = false;

    const tick = () => {
      if (cancelled || this._stopped) return;
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      const len = progress * totalLen;
      const pt = pathEl.getPointAtLength(len);
      this._moveMiniprobe(mp, pt.x, pt.y);
      if (progress < 1) {
        this._miniprobeRaf = requestAnimationFrame(tick);
      }
    };
    this._miniprobeRaf = requestAnimationFrame(tick);
    return () => { cancelled = true; };
  }

  _clearTimers() {
    this._timers.forEach(t => clearTimeout(t));
    this._timers.clear();
  }

  /** Get the length of a path element in px */
  _getPathLength(el) {
    if (!el || typeof el.getTotalLength !== 'function') return 0;
    return el.getTotalLength();
  }

  /** Duration (ms) for a step based on its path length and pace (jog/traverse use fast pace) */
  _durationForStep(el, type) {
    if (!el) return 200; // fallback
    const len = this._getPathLength(el);
    if (len <= 0) return 200;
    const fastPace = this.fastPxPerSec || (this.pxPerSec * this.fastMultiplier);
    const pace = (type === 'jog') ? fastPace : this.pxPerSec;
    return Math.max(200, Math.round((len / pace) * 1000));
  }

  /** Parent CSS class for a given step type */
  _parentClassFor(type) {
    if (type === 'retract') return 'is-retracting';
    if (type === 'jog') return 'is-jogging';
    return 'is-probing';
  }

  /**
   * Set stroke-dasharray and stroke-dashoffset to the actual path length
   * so the draw animation matches the real stroke perfectly.
   */
  _initPathLength(el) {
    if (!el || typeof el.getTotalLength !== 'function') return;
    const len = Math.ceil(el.getTotalLength()) + 1; // +1 for rounding safety
    el.style.strokeDasharray = len;
    el.style.strokeDashoffset = len;
  }

  /**
   * Instantly reset a path element to its hidden state (no transition).
   * Uses .path-reset to suppress CSS transitions during the reset.
   */
  _resetElement(el) {
    if (!el) return;
    // Add path-reset to disable transitions
    el.classList.add('path-reset');
    el.classList.remove('path-draw');
    // Clear any inline transition-duration set during animation
    el.style.transitionDuration = '';
    // Re-apply the hidden dashoffset based on actual path length
    this._initPathLength(el);
    const parent = el.closest('g');
    if (parent) parent.classList.remove('is-probing', 'is-retracting', 'is-jogging');

    // Remove any reveal mask we may have created for jog/traverse
    try {
      const maskAttr = el.getAttribute && el.getAttribute('mask');
      if (maskAttr) {
        const m = maskAttr.match(/url\(#([^\)]+)\)/);
        if (m && m[1] && m[1].startsWith('reveal-mask-')) {
          const svgRoot = el.ownerSVGElement || el.closest('svg');
          const maskEl = svgRoot && svgRoot.querySelector('#' + m[1]);
          if (maskEl) maskEl.remove();
        }
        el.removeAttribute('mask');
      }
    } catch (e) { /* ignore cleanup errors */ }

    // Force layout so the reset takes effect before we remove path-reset
    // eslint-disable-next-line no-unused-expressions
    el.getBoundingClientRect();
    el.classList.remove('path-reset');
  }

  /**
   * Remove path-draw and parent state classes from all steps (instant, no reverse animation).
   */
  reset(input) {
    console.debug('PathAnimator.reset');
    const resetSel = (sel) => {
      if (!sel) return;
      const el = document.querySelector(sel);
      this._resetElement(el);
    };

    if (Array.isArray(input)) {
      input.forEach(s => resetSel(s.selector));
    } else if (input && typeof input === 'object') {
      const steps = this._buildStepList(input);
      steps.forEach(s => resetSel(s.selector));
    }
  }

  stop() {
    this._stopped = true;
    this._clearTimers();
    this._resetMiniprobe();
    if (this._loopTimer) {
      clearTimeout(this._loopTimer);
      this._loopTimer = null;
    }
  }

  /**
   * Play the full animation sequence.
   *
   * New format (preferred):
   *   playSequence({ axis1Steps, jogPath, axis2Steps })
   *   where each step is { selector, type: 'probe'|'retract'|'jog', stepNum }
   *
   * Legacy format (backward-compat):
   *   playSequence({ probePath, retractPath, jogPath, probePath2 })
   */
  async playSequence(input = {}) {
    this._stopped = false;
    this._sessionId++;               // invalidate all callbacks from previous call
    const mySession = this._sessionId;
    this._clearTimers();
    this._currentInput = input;

    const _setAnimState = (s) => {
      try { if (typeof document !== 'undefined' && document.body) document.body.setAttribute('data-middle-anim', s); } catch (e) { /* noop */ }
    };
    _setAnimState('running');

    // Build a flat ordered list of steps from either input format
    const allSteps = this._buildStepList(input);
    console.debug('PathAnimator.playSequence START', { stepCount: allSteps.length, allSteps });

    // Reset all steps first (instant, no transition)
    this.reset(allSteps);
    this._resetMiniprobe();

    // Hide wcs element(s) at sequence start if provided
    const wcsEls = input.wcsEls ? input.wcsEls : (input.wcsEl ? [input.wcsEl] : []);
    wcsEls.forEach(el => { if (el) el.style.display = 'none'; });

    // Discover miniprobe from the first step's axis group
    const firstEl = allSteps[0]?.selector ? document.querySelector(allSteps[0].selector) : null;
    this._miniprobeHome = this._findMiniprobe(firstEl);
    if (this._miniprobeHome) {
      console.debug('PathAnimator: miniprobe found', this._miniprobeHome.el.id,
        `home=(${this._miniprobeHome.cx.toFixed(1)},${this._miniprobeHome.cy.toFixed(1)})`);
    }

    // Track all animated elements for cleanup at loop end
    const animatedElements = [];

    if (this._stopped) {
      _setAnimState('stopped');
      return Promise.reject(new Error('stopped'));
    }

    if (allSteps.length === 0) {
      console.debug('PathAnimator: no steps to animate');
      _setAnimState('done');
      return Promise.resolve();
    }

    console.debug(`PathAnimator: pace = ${this.pxPerSec} px/sec`);

    // Chain steps using transitionend — each step waits for previous stroke to finish
    const runStep = (idx) => {
      return new Promise((resolve) => {
        if (this._stopped) { _setAnimState('stopped'); return resolve(); }

        const step = allSteps[idx];
        const el = step.selector ? document.querySelector(step.selector) : null;
        if (!el) {
          console.debug(`PathAnimator: step ${idx} selector not found`, step.selector);
          return resolve(); // skip to next
        }

        const parent = el.closest('g');
        const parentClass = this._parentClassFor(step.type);
        animatedElements.push({ el, parent, type: step.type });

        // Add parent state class
        if (parent) parent.classList.add(parentClass);

        const duration = this._durationForStep(el, step.type);

        // Jog/traverse: reveal the already-dashed path using an SVG mask so the
        // dashed segments remain stationary while the path is progressively shown.
        if (step.type === 'jog') {
          const len = Math.ceil(this._getPathLength(el));
          const DASH = 8, GAP = 6; // visible dash pattern for jog/traverse
          const SVG_NS = 'http://www.w3.org/2000/svg';

          // Ensure path itself displays as a dashed stroke (static pattern)
          el.style.transition = 'none';
          el.style.strokeDasharray = `${DASH} ${GAP}`;
          el.style.strokeDashoffset = '0';

          // Create a mask path that will reveal the dashed stroke along the exact path
          const svgRoot = el.ownerSVGElement || el.closest('svg');
          if (!svgRoot) { console.warn('PathAnimator: SVG root not found for jog mask', step.selector); resolve(); return; }

          let defs = svgRoot.querySelector('defs');
          if (!defs) {
            defs = document.createElementNS(SVG_NS, 'defs');
            svgRoot.insertBefore(defs, svgRoot.firstChild);
          }

          // mask id bound to element id when available for predictable cleanup
          const maskId = `reveal-mask-${el.id || Math.random().toString(36).slice(2,9)}`;
          // remove existing mask with same id if present
          const prev = defs.querySelector(`#${maskId}`);
          if (prev) prev.remove();

          const mask = document.createElementNS(SVG_NS, 'mask');
          mask.setAttribute('id', maskId);
          mask.setAttribute('maskUnits', 'userSpaceOnUse');
          mask.setAttribute('maskContentUnits', 'userSpaceOnUse');

          const maskPath = document.createElementNS(SVG_NS, 'path');
          const d = (el.tagName.toLowerCase() === 'path') ? el.getAttribute('d') : (el.querySelector('path')?.getAttribute('d') || '');
          maskPath.setAttribute('d', d);
          maskPath.setAttribute('fill', 'none');
          maskPath.setAttribute('stroke', '#fff');
          maskPath.setAttribute('stroke-width', el.getAttribute('stroke-width') || '4');
          maskPath.setAttribute('stroke-linecap', el.getAttribute('stroke-linecap') || 'round');

          // hide mask path initially by dashoffset (solid white stroke acts as reveal)
          maskPath.style.strokeDasharray = String(len);
          maskPath.style.strokeDashoffset = String(len);
          mask.appendChild(maskPath);
          defs.appendChild(mask);

          // attach mask to element and animate the mask's dashoffset (reveals the dashed stroke)
          el.setAttribute('mask', `url(#${maskId})`);

          // commit styles then animate maskPath stroke-dashoffset -> 0
          // eslint-disable-next-line no-unused-expressions
          maskPath.getBoundingClientRect();
          maskPath.style.transition = `stroke-dashoffset ${duration}ms linear`;

          const onMaskEnd = (ev) => {
            if (ev.propertyName !== 'stroke-dashoffset') return;
            maskPath.removeEventListener('transitionend', onMaskEnd);
            try { el.removeAttribute('mask'); } catch (e) {}
            try { mask.remove(); } catch (e) {}
            if (jogFallback) { clearTimeout(jogFallback); this._timers.delete(jogFallback); }
            if (this._stopped || mySession !== this._sessionId) { _setAnimState('stopped'); return reject(new Error('aborted')); }
            console.debug(`PathAnimator: step ${idx} finished (jog reveal) dur=${duration}ms`, step.selector);
            resolve();
          };
          maskPath.addEventListener('transitionend', onMaskEnd);

          const jogFallback = setTimeout(() => {
            maskPath.removeEventListener('transitionend', onMaskEnd);
            try { el.removeAttribute('mask'); } catch (e) {}
            try { mask.remove(); } catch (e) {}
            this._timers.delete(jogFallback);
            if (this._stopped || mySession !== this._sessionId) { _setAnimState('stopped'); return reject(new Error('aborted')); }
            console.warn('PathAnimator: jog reveal fallback triggered', step.selector);
            resolve();
          }, duration + 120);
          this._timers.add(jogFallback);

          // kick off the reveal on next frame
          requestAnimationFrame(() => {
            maskPath.style.strokeDashoffset = '0';
            this._trackMiniprobeAlongPath(el, duration);
            console.debug(`PathAnimator: step ${idx} started jog reveal dur=${duration}ms len=${len}px`, step.selector);
          });

          return;
        }

        // Probe/retract: solid line draw via CSS transition
        this._initPathLength(el);
        el.style.transitionDuration = `${duration}ms`;

        const onEnd = (e) => {
          if (e.propertyName !== 'stroke-dashoffset') return;
          el.removeEventListener('transitionend', onEnd);
          if (this._stopped || mySession !== this._sessionId) { _setAnimState('stopped'); return reject(new Error('aborted')); }
          console.debug(`PathAnimator: step ${idx} finished (${step.type}, step${step.stepNum}) dur=${duration}ms`, step.selector);
          resolve();
        };
        el.addEventListener('transitionend', onEnd);

        const fallback = setTimeout(() => {
          el.removeEventListener('transitionend', onEnd);
          if (this._stopped || mySession !== this._sessionId) { _setAnimState('stopped'); return reject(new Error('aborted')); }
          resolve();
        }, duration + 100);
        this._timers.add(fallback);

        requestAnimationFrame(() => {
          el.classList.add('path-draw');
          this._trackMiniprobeAlongPath(el, duration);
          console.debug(`PathAnimator: step ${idx} started (${step.type}, step${step.stepNum}) dur=${duration}ms len=${this._getPathLength(el).toFixed(1)}px`, step.selector);
        });
      });
    };

    // Run all steps in sequence, each waiting for the previous to finish drawing
    const abort = new Error('aborted');
    let chain = Promise.resolve();
    for (let i = 0; i < allSteps.length; i++) {
      chain = chain.then(() => (this._stopped || mySession !== this._sessionId) ? Promise.reject(abort) : runStep(i));
    }

    return chain.then(() => {
      console.debug('PathAnimator: sequence complete - all paths visible');
      _setAnimState('done');

      // Flash wcs element(s) on completion if provided
      const flashDone = wcsEls.length > 0
        ? flashWcs(wcsEls[0]).then(() => { wcsEls.slice(1).forEach(el => { if (el) el.style.display = 'block'; }); })
        : Promise.resolve();

      // Loop: hold visible, then instant-clear and restart
      flashDone.then(() => {
        if (this.loop && !this._stopped) {
          this._loopTimer = setTimeout(() => {
            animatedElements.forEach(({ el }) => this._resetElement(el));
            this._resetMiniprobe();
            wcsEls.forEach(el => { if (el) el.style.display = 'none'; });
            console.debug('PathAnimator: cleared all paths, restarting...');
            this.playSequence(this._currentInput).catch(() => {});
          }, 800);
        }
      });
    }).catch((err) => {
      // Silently swallow aborts; re-throw unexpected errors
      if (err && err.message !== 'aborted') throw err;
    });
  }

  /**
   * Convert input (either new or legacy format) into a flat ordered array of steps.
   */
  _buildStepList(input) {
    // New format: { axis1Steps, jogPath, axis2Steps }
    if (input.axis1Steps || input.axis2Steps) {
      const steps = [];
      if (Array.isArray(input.axis1Steps)) {
        steps.push(...input.axis1Steps);
      }
      if (input.jogPath) {
        steps.push(input.jogPath);
      }
      if (Array.isArray(input.axis2Steps)) {
        steps.push(...input.axis2Steps);
      }
      return steps.filter(s => s && s.selector);
    }

    // Legacy format: { probePath, retractPath, jogPath, probePath2 }
    // Also supports resolveVizIds output: { probePathSelector, retractPathSelector, ... }
    const steps = [];
    const probe = input.probePath || input.probePathSelector;
    const retract = input.retractPath || input.retractPathSelector;
    const jog = input.jogPath || input.jogPathSelector;
    const probe2 = input.probePath2 || input.probePath2Selector;
    if (probe) steps.push({ selector: probe, type: 'probe', stepNum: 1 });
    if (retract) steps.push({ selector: retract, type: 'retract', stepNum: 2 });
    if (jog) steps.push({ selector: jog, type: 'jog', stepNum: 3 });
    if (probe2) steps.push({ selector: probe2, type: 'probe', stepNum: 4 });
    return steps;
  }
}

// expose for E2E
if (typeof window !== 'undefined') window.PathAnimator = PathAnimator;

/**
 * flashWcs(wcsEl)
 * Hides the WCS element, then flashes it 5 times and leaves it visible.
 * Returns a Promise that resolves when the flash sequence is complete.
 */
export function flashWcs(wcsEl) {
  if (!wcsEl) return Promise.resolve();
  return new Promise(resolve => {
    wcsEl.style.display = 'none';
    const FLASH_ON  = 120;  // ms visible per flash
    const FLASH_OFF = 100;  // ms hidden per flash
    const FLASHES   = 5;
    let count = 0;
    const tick = () => {
      if (count >= FLASHES) {
        wcsEl.style.display = 'block';  // leave visible (must override CSS [id$="_wcs"] rule)
        resolve();
        return;
      }
      wcsEl.style.display = 'block';
      setTimeout(() => {
        wcsEl.style.display = 'none';
        setTimeout(() => {
          count++;
          tick();
        }, FLASH_OFF);
      }, FLASH_ON);
    };
    tick();
  });
}

if (typeof window !== 'undefined') window.flashWcs = flashWcs;
