export class PathAnimator {
  constructor({ probeMs = 1000, retractMs = 500, jogMs = 1500 } = {}) {
    this.probeMs = probeMs;
    this.retractMs = retractMs;
    this.jogMs = jogMs;
    this._timers = new Set();
    this._stopped = false;
  }

  _clearTimers() {
    this._timers.forEach(t => clearTimeout(t));
    this._timers.clear();
  }

  reset(ids) {
    console.debug('PathAnimator.reset', { ids });
    // remove classes from any supplied selectors
    ['probePath', 'retractPath', 'jogPath', 'probePath2'].forEach(k => {
      const sel = ids && ids[k];
      if (!sel) return;
      const el = document.querySelector(sel);
      if (el) el.classList.remove('path-draw');
      const parent = el && el.closest('g');
      if (parent) parent.classList.remove('is-probing', 'is-retracting', 'is-jogging');
    });
  }

  stop() {
    this._stopped = true;
    this._clearTimers();
  }

  async playSequence(ids = {}) {
    console.debug('PathAnimator.playSequence START', { ids, probeMs: this.probeMs, retractMs: this.retractMs, jogMs: this.jogMs });
    this._stopped = false;
    this._clearTimers();
    this.reset(ids);
    // expose a DOM-visible flag so tests can detect animation state quickly
    const _setAnimState = (s) => { try { if (typeof document !== 'undefined' && document.body) document.body.setAttribute('data-middle-anim', s); } catch (e) { /* noop */ } };
    _setAnimState('running');

    const node = (s) => {
      if (!s) return null;
      const el = document.querySelector(s);
      if (!el) console.debug('PathAnimator: selector did not match any element', s);
      return el;
    };

    return new Promise((resolve, reject) => {
      if (this._stopped) {
        console.debug('PathAnimator.playSequence aborted: already stopped');
        try { _setAnimState('stopped'); } catch(e) {}
        return reject(new Error('stopped'));
      }

      // Step 1: probe primary
      const probeEl = node(ids.probePath);
      const probeParent = probeEl && probeEl.closest('g');
      console.debug('PathAnimator: probeEl, probeParent', { probeElExists: !!probeEl, probeParentExists: !!probeParent, probeSelector: ids.probePath });

      if (probeParent) probeParent.classList.add('is-probing');
      if (probeEl) {
        // ensure rAF so transition can apply
        requestAnimationFrame(() => {
          probeEl.classList.add('path-draw');
          console.debug('PathAnimator: probe started (class added)', ids.probePath);
        });
      } else {
        console.debug('PathAnimator: no probe element to animate');
      }

      // after probeMs, show retract
      const t1 = setTimeout(() => {
        if (this._stopped) {
          console.debug('PathAnimator: stopped during probe->retract');
          try { _setAnimState('stopped'); } catch(e) {}
          return reject(new Error('stopped'));
        }
        if (probeEl) {
          probeEl.classList.remove('path-draw');
          console.debug('PathAnimator: probe cleared (class removed)');
        }
        if (probeParent) probeParent.classList.remove('is-probing');

        const retractEl = node(ids.retractPath);
        const retractParent = retractEl && retractEl.closest('g');
        console.debug('PathAnimator: retractEl', { retractElExists: !!retractEl, retractSelector: ids.retractPath });

        if (retractParent) retractParent.classList.add('is-retracting');
        if (retractEl) {
          requestAnimationFrame(() => {
            retractEl.classList.add('path-draw');
            console.debug('PathAnimator: retract started (class added)');
          });
        }

        // after retractMs, continue with jog or second probe
        const t2 = setTimeout(() => {
          if (this._stopped) {
            console.debug('PathAnimator: stopped during retract->next');
            try { _setAnimState('stopped'); } catch(e) {}
            return reject(new Error('stopped'));
          }
          if (retractEl) {
            retractEl.classList.remove('path-draw');
            console.debug('PathAnimator: retract cleared (class removed)');
          }
          if (retractParent) retractParent.classList.remove('is-retracting');

          // If jogPath exists, animate it then transition to second probePath2
          const jogEl = node(ids.jogPath);
          const jogParent = jogEl && jogEl.closest('g');
          console.debug('PathAnimator: jogEl', { jogElExists: !!jogEl, jogSelector: ids.jogPath });

          if (jogEl) {
            if (jogParent) jogParent.classList.add('is-jogging');
            requestAnimationFrame(() => {
              jogEl.classList.add('path-draw');
              console.debug('PathAnimator: jog started (class added)');
            });
            const t3 = setTimeout(() => {
              if (this._stopped) {
                console.debug('PathAnimator: stopped during jog');
                try { _setAnimState('stopped'); } catch(e) {}
                return reject(new Error('stopped'));
              }
              if (jogEl) {
                jogEl.classList.remove('path-draw');
                console.debug('PathAnimator: jog cleared (class removed)');
              }
              if (jogParent) jogParent.classList.remove('is-jogging');

              // probePath2 if present
              const probe2 = node(ids.probePath2);
              const probe2Parent = probe2 && probe2.closest('g');
              console.debug('PathAnimator: probe2', { probe2Exists: !!probe2, probe2Selector: ids.probePath2 });

              if (probe2) {
                if (probe2Parent) probe2Parent.classList.add('is-probing');
                requestAnimationFrame(() => {
                  probe2.classList.add('path-draw');
                  console.debug('PathAnimator: probe2 started (class added)');
                });
                const t4 = setTimeout(() => {
                  if (probe2) probe2.classList.remove('path-draw');
                  if (probe2Parent) probe2Parent.classList.remove('is-probing');
                  console.debug('PathAnimator: sequence complete (probe2 done)');
                  try { _setAnimState('done'); } catch(e) {}
                  resolve();
                }, this.probeMs);
                this._timers.add(t4);
              } else {
                console.debug('PathAnimator: sequence complete (no probe2)');
                try { _setAnimState('done'); } catch(e) {}
                resolve();
              }
            }, this.jogMs);
            this._timers.add(t3);
          } else {
            // no jog — maybe a two-axis mode without explicit jog graphic — animate secondary probe directly if present
            const probe2 = node(ids.probePath2);
            console.debug('PathAnimator: no jog — probe2 fallback', { probe2Exists: !!probe2 });
            if (probe2) {
              const p2Parent = probe2.closest('g');
              if (p2Parent) p2Parent.classList.add('is-probing');
              requestAnimationFrame(() => {
                probe2.classList.add('path-draw');
                console.debug('PathAnimator: probe2 started (class added, no jog)');
              });
              const t5 = setTimeout(() => {
                if (probe2) probe2.classList.remove('path-draw');
                if (p2Parent) p2Parent.classList.remove('is-probing');
                console.debug('PathAnimator: sequence complete (probe2 no-jog)');
                try { _setAnimState('done'); } catch(e) {}
                resolve();
              }, this.probeMs);
              this._timers.add(t5);
            } else {
              console.debug('PathAnimator: sequence complete (no jog, no probe2)');
              try { _setAnimState('done'); } catch(e) {}
              resolve();
            }
          }
        }, this.retractMs);
        this._timers.add(t2);
      }, this.probeMs);
      this._timers.add(t1);
    });
  }
}

// expose for E2E
if (typeof window !== 'undefined') window.PathAnimator = PathAnimator;
