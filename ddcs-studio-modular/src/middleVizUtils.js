// Utilities for mapping wizard params to middleViz SVG IDs

export function getVizIds({ featureType = 'pocket', axis = 'X', dir1 = 'pos', twoAxis = false } = {}) {
  const root = `middle_probe_${featureType}`;
  const axisGroupId = `${root}_${axis}_${dir1}`; // e.g. middle_probe_pocket_X_pos
  const oppositeAxis = axis === 'X' ? 'Y' : 'X';
  const oppositeAxisGroup = `${root}_${oppositeAxis}_${dir1}`;
  const axisDirKey = `${oppositeAxis}to${axis}`; // e.g. YtoX

  // Build candidate lists for each semantic path type so resolveVizIds can pick
  // the first one that actually exists in the injected SVG.
  // New sequential naming: probepath_step1, probepath_step3
  // Legacy naming: probepath1, probepath2
  const probeCandidates = [
    // Common (simplified) naming used in many SVGs
    `${axisGroupId}_probepath_step1`,
    `${axisGroupId}_probepath1`,
    // Sequential step1 (NEW, legacy-prefixed formats)
    `${axisGroupId}_1axis_XY_probepath_step1`,
    `${axisGroupId}_1axis_XZ_probepath_step1`,
    `${axisGroupId}_1axis_YZ_probepath_step1`,
    // Legacy probepath1 variants
    `${axisGroupId}_1axis_XY_probepath1`,
    `${axisGroupId}_1axis_XY_probepath1_2`,
    `${axisGroupId}_1axis_XZ_probepath1`,
    `${axisGroupId}_1axis_XZ_probepath1_2`
  ];

  const probe2Candidates = [
    // Common (simplified) naming for second probe
    `${axisGroupId}_probepath_step3`,
    `${axisGroupId}_probepath2`,
    // Sequential step3 (NEW)
    `${axisGroupId}_1axis_XY_probepath_step3`,
    `${axisGroupId}_1axis_XZ_probepath_step3`,
    `${axisGroupId}_1axis_YZ_probepath_step3`,
    // Legacy probepath2 variants
    `${axisGroupId}_1axis_XY_probepath2`,
    `${axisGroupId}_1axis_XY_probepath2_2`,
    `${axisGroupId}_1axis_XZ_probepath2`,
    `${axisGroupId}_1axis_XZ_probepath2_2`
  ];

  // retract candidates: new sequential (step2, step4) + legacy (pos/neg)
  // step2 = retract after first probe (step1)
  // step4 = retract after second probe (step3) - may not exist yet
  const retract1Candidates = [
    // Sequential step2 (NEW)
    `${axisGroupId}_1axis_XY_retractpath_step2`,
    `${axisGroupId}_1axis_XZ_retractpath_step2`,
    `${axisGroupId}_1axis_YZ_retractpath_step2`,
    // Legacy
    `${axisGroupId}_1axis_XY_retractpath1`,
    `${axisGroupId}_1axis_XY_retractpathpos`,
    `${axisGroupId}_1axis_XY_retractpathneg`,
    `${axisGroupId}_1axis_XY_retractpathpos_2`,
    `${axisGroupId}_1axis_XY_retractarrowpos`,
    `${axisGroupId}_1axis_XY_retractarrowneg`
  ];
  const retract2Candidates = [
    // Sequential step4 (NEW) - user will add later
    `${axisGroupId}_1axis_XY_retractpath_step4`,
    `${axisGroupId}_1axis_XZ_retractpath_step4`,
    `${axisGroupId}_1axis_YZ_retractpath_step4`,
    // Legacy
    `${axisGroupId}_1axis_XY_retractpath2`
  ];
  const retractCandidates = retract1Candidates.concat(retract2Candidates);

  const jogCandidates = [
    // Sequential step5 (NEW)
    `${oppositeAxisGroup}_2axis_${axisDirKey}_${dir1}_jogpath_step5`,
    `${axisGroupId}_1axis_XY_jogpath_step5`,
    // Legacy
    `${axisGroupId}_1axis_XY_jogpath`,
    `${axisGroupId}_1axis_XY_2_jogpath`,
    `${oppositeAxisGroup}_2axis_${axisDirKey}_${dir1}_jogpath`,
    `${oppositeAxisGroup}_2axis_${axisDirKey}_${dir1}_jogpath_2`
  ];

  const twoAxisParent = `${oppositeAxisGroup}_2axis`;
  const twoAxisChild = `${oppositeAxisGroup}_2axis_${axisDirKey}_${dir1}`;

  return {
    rootId: `#${root}`,
    axisGroupId: `#${axisGroupId}`,
    probeCandidates: probeCandidates.map(id => `#${id}`),
    probe2Candidates: probe2Candidates.map(id => `#${id}`),
    retractCandidates: retractCandidates.map(id => `#${id}`),
    jogCandidates: jogCandidates.map(id => `#${id}`),
    twoAxisParentId: `#${twoAxisParent}`,
    twoAxisChildId: `#${twoAxisChild}`,
    // keep legacy single-id fields for backward-compat where helpful
    probePathId: `#${probeCandidates[0]}`,
    probePath2Id: `#${probe2Candidates[0]}`,
    jogPathId: `#${jogCandidates[0]}`,
    twoAxis: !!twoAxis
  };
}

// Resolve the first existing selector from the candidates and return element selectors that exist in DOM
export function resolveVizIds(params) {
  const ids = getVizIds(params);
  const doc = typeof document !== 'undefined' ? document : null;
  const resolved = { ...ids };

  const findFirst = (candidates) => {
    if (!doc || !candidates) return null;
    for (const sel of candidates) {
      const el = doc.querySelector(sel);
      if (el) return `#${el.id}`;
    }
    return null;
  };

  if (doc) {
    // probe (try probeCandidates then probe2Candidates)
    resolved.probePathSelector = findFirst(ids.probeCandidates) || findFirst(ids.probe2Candidates) || null;
    resolved.probePath2Selector = findFirst(ids.probe2Candidates) || findFirst(ids.probeCandidates) || null;

    // retract: resolve numbered + pos/neg candidates separately so we can
    // match the retract that corresponds to the resolved probe (probe1 -> retract1)
    resolved.retractPath1Selector = findFirst((ids.retract1Candidates || ids.retractCandidates) ) || null;
    resolved.retractPath2Selector = findFirst((ids.retract2Candidates || [])) || null;

    // prefer retract that matches the probe number when possible
    const probeSel = resolved.probePathSelector || '';
    if (/probepath1/.test(probeSel)) {
      resolved.retractPathSelector = resolved.retractPath1Selector || resolved.retractPath2Selector || findFirst(ids.retractCandidates) || null;
      resolved.retractMatch = resolved.retractPath1Selector ? '1' : (resolved.retractPath2Selector ? '2' : null);
    } else if (/probepath2/.test(probeSel)) {
      resolved.retractPathSelector = resolved.retractPath2Selector || resolved.retractPath1Selector || findFirst(ids.retractCandidates) || null;
      resolved.retractMatch = resolved.retractPath2Selector ? '2' : (resolved.retractPath1Selector ? '1' : null);
    } else {
      resolved.retractPathSelector = findFirst(ids.retractCandidates) || null;
      resolved.retractMatch = null;
    }

    // jog path
    resolved.jogPathSelector = findFirst(ids.jogCandidates) || null;

    // two-axis parent/child presence
    const twoParent = doc.querySelector(ids.twoAxisParentId);
    const twoChild = doc.querySelector(ids.twoAxisChildId);
    resolved.twoAxisParentExists = !!twoParent;
    resolved.twoAxisChildExists = !!twoChild;
  } else {
    resolved.probePathSelector = null;
    resolved.probePath2Selector = null;
    resolved.retractPathSelector = null;
    resolved.jogPathSelector = null;
    resolved.twoAxisParentExists = false;
    resolved.twoAxisChildExists = false;
  }

  console.debug('resolveVizIds ->', { params, resolved });
  return resolved;
}

/**
 * Discover all animation steps in the DOM for an axis group, sorted by step number.
 * Returns { axis1Steps, jogPath, axis2Steps } where each step is
 * { selector, type: 'probe'|'retract'|'jog', stepNum }.
 *
 * @param {object} opts
 * @param {string} opts.featureType  'pocket' | 'boss'
 * @param {string} opts.axis         'X' | 'Y'
 * @param {string} opts.dir1         'pos' | 'neg'
 * @param {boolean} opts.twoAxis     whether "Find Both" is active
 * @param {string} [opts.dir2]       direction for second axis (defaults to dir1)
 */
export function discoverAnimSteps({ featureType = 'pocket', axis = 'X', dir1 = 'pos', twoAxis = false, dir2 } = {}) {
  const doc = typeof document !== 'undefined' ? document : null;
  if (!doc) return { axis1Steps: [], jogPath: null, axis2Steps: [] };

  const root = `middle_probe_${featureType}`;
  const axis1GroupId = `${root}_${axis}_${dir1}`;
  const oppositeAxis = axis === 'X' ? 'Y' : 'X';
  const axis2Dir = dir2 || dir1;

  // Helper: find all step-numbered paths inside a group element
  const findSteps = (groupId) => {
    const group = doc.getElementById(groupId);
    if (!group) return [];
    // Match any path whose id contains _step followed by a number
    const paths = group.querySelectorAll('path[id*="_step"]');
    const steps = [];
    for (const el of paths) {
      const m = el.id.match(/_step(\d+)$/);
      if (!m) continue;
      const stepNum = parseInt(m[1], 10);
      let type = 'probe';
      if (/retractpath/.test(el.id)) type = 'retract';
      else if (/jogpath/.test(el.id) || /traversepath/.test(el.id)) type = 'jog';
      steps.push({ selector: `#${el.id}`, type, stepNum });
    }
    steps.sort((a, b) => a.stepNum - b.stepNum);
    return steps;
  };

  const axis1Steps = findSteps(axis1GroupId);

  // Jog path between axes (for 2-axis / Find Both mode)
  let jogPath = null;
  if (twoAxis) {
    // Pattern: middle_probe_{type}_jogpath_{axis}_{dir1}_to_{axis2}_{dir2}
    const jogId = `${root}_jogpath_${axis}_${dir1}_to_${oppositeAxis}_${axis2Dir}`;
    const jogEl = doc.getElementById(jogId);
    if (jogEl) {
      jogPath = { selector: `#${jogId}`, type: 'jog', stepNum: 0 };
    }
  }

  // Axis 2 steps (for 2-axis mode)
  let axis2Steps = [];
  if (twoAxis) {
    const axis2GroupId = `${root}_${oppositeAxis}_${axis2Dir}`;
    axis2Steps = findSteps(axis2GroupId);
  }

  console.debug('discoverAnimSteps ->', { axis1Steps, jogPath, axis2Steps });
  return { axis1Steps, jogPath, axis2Steps };
}

// Expose helpers to the global window for Playwright/E2E access
if (typeof window !== 'undefined') {
  window.getVizIds = getVizIds;
  window.resolveVizIds = resolveVizIds;
  window.discoverAnimSteps = discoverAnimSteps;
}
