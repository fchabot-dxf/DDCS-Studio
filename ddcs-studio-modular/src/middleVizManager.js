export class MiddleVizManager {
  constructor(containerSelector = '#middleVizContainer') {
    this.container = typeof document !== 'undefined' ? document.querySelector(containerSelector) : null;
  }

  _hideAll() {
    if (!this.container) return;
    const svgRoot = this.container.querySelector('svg') || this.container;
    svgRoot.querySelectorAll('[id^="middle_probe_"]').forEach(e => e.style.display = 'none');
  }

  updateVisibility({ featureType = 'pocket', axis = 'X', dir1 = 'pos', findBoth = false, dir2 = null } = {}) {
    if (!this.container) return;
    const svgRoot = this.container.querySelector('svg') || this.container;

    const type = featureType;
    const selectedId = `middle_probe_${type}_${axis}_${dir1}`;

    // Hide everything, then selectively show
    this._hideAll();

    const featureRoot = svgRoot.querySelector(`#middle_probe_${type}`);
    if (featureRoot) featureRoot.style.display = '';

    // Show the axis group
    const sel = svgRoot.querySelector('#' + selectedId);
    if (sel) sel.style.display = 'block';

    // If findBoth: show the opposite-axis 2axis subgroup (and ensure its parent axisGroup is visible)
    if (findBoth) {
      const oppositeAxis = axis === 'X' ? 'Y' : 'X';
      const oppositeAxisGroupId = `middle_probe_${type}_${oppositeAxis}_${dir2 || dir1}`;
      const oppositeAxisGroup = svgRoot.querySelector('#' + oppositeAxisGroupId);
      if (oppositeAxisGroup) oppositeAxisGroup.style.display = 'block';

      // show its 2axis child if present
      const axisDirKey = `${oppositeAxis}to${axis}`;
      const twoAxisChildId = `${oppositeAxisGroupId}_2axis_${axisDirKey}_${dir1}`;
      const twoChild = svgRoot.querySelector('#' + twoAxisChildId);
      if (twoChild) {
        // ensure the 2axis parent is visible
        const twoParent = twoChild.parentElement;
        if (twoParent) twoParent.style.display = 'block';
        twoChild.style.display = 'block';
      }
    }
  }

  // Convenience toggles for sequential reveal of path sub-elements
  revealStep(featureType, axis, dir, stepName) {
    // stepName: 'probe' | 'retract' | 'jog'
    if (!this.container) return;
    const svgRoot = this.container.querySelector('svg') || this.container;
    const axisGroup = svgRoot.querySelector(`#middle_probe_${featureType}_${axis}_${dir}`);
    if (!axisGroup) return;

    const probe = axisGroup.querySelector('[id*="probepath"]');
    const retract = axisGroup.querySelector('[id*="retractpath"]') || axisGroup.querySelector('[id*="retractarrow"]');
    const jog = axisGroup.querySelector('[id*="jogpath"]') || axisGroup.querySelector('[id*="_2axis_"]');

    // remove all first
    [probe, retract, jog].forEach(el => { if (el) el.classList.remove('path-draw'); });

    if (stepName === 'probe' && probe) {
      probe.classList.add('path-draw');
      const p = probe.closest('g'); if (p) p.classList.add('is-probing');
    }
    if (stepName === 'retract' && retract) {
      retract.classList.add('path-draw');
      const p = retract.closest('g'); if (p) p.classList.add('is-retracting');
    }
    if (stepName === 'jog' && jog) {
      jog.classList.add('path-draw');
      const p = jog.closest('g'); if (p) p.classList.add('is-jogging');
    }
  }
}

if (typeof window !== 'undefined') window.MiddleVizManager = MiddleVizManager;
