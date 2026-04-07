// Utilities for mapping wizard params to middleViz SVG IDs

export function getVizIds({ featureType = 'pocket', axis = 'X', dir1 = 'pos', twoAxis = false } = {}) {
  const root = `middle_probe_${featureType}`;
  const axisGroupId = `${root}_${axis}_${dir1}`; // e.g. middle_probe_pocket_X_pos
  const oppositeAxis = axis === 'X' ? 'Y' : 'X';
  const oppositeAxisGroup = `${root}_${oppositeAxis}_${dir1}`;
  const axisDirKey = `${oppositeAxis}to${axis}`; // e.g. YtoX

  const probeCandidates = [
    `${axisGroupId}_1axis_XY_probepath1`,
    `${axisGroupId}_1axis_XY_probepath1_2`,
    `${axisGroupId}_1axis_XZ_probepath1`,
    `${axisGroupId}_1axis_XZ_probepath1_2`
  ];

  const probe2Candidates = [
    `${axisGroupId}_1axis_XY_probepath2`,
    `${axisGroupId}_1axis_XY_probepath2_2`,
    `${axisGroupId}_1axis_XZ_probepath2`,
    `${axisGroupId}_1axis_XZ_probepath2_2`
  ];

  const retractCandidates = [
    `${axisGroupId}_1axis_XY_retractpathpos`,
    `${axisGroupId}_1axis_XY_retractpathneg`,
    `${axisGroupId}_1axis_XY_retractpathpos_2`,
    `${axisGroupId}_1axis_XY_retractpathneg_2`,
    `${axisGroupId}_1axis_XY_retractarrowpos`,
    `${axisGroupId}_1axis_XY_retractarrowneg`
  ];

  const jogCandidates = [
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
    probePathId: `#${probeCandidates[0]}`,
    probePath2Id: `#${probe2Candidates[0]}`,
    jogPathId: `#${jogCandidates[0]}`,
    twoAxis: !!twoAxis
  };
}

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
    resolved.probePathSelector = findFirst(ids.probeCandidates) || findFirst(ids.probe2Candidates) || null;
    resolved.probePath2Selector = findFirst(ids.probe2Candidates) || findFirst(ids.probeCandidates) || null;
    resolved.retractPathSelector = findFirst(ids.retractCandidates) || null;
    resolved.jogPathSelector = findFirst(ids.jogCandidates) || null;

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

if (typeof window !== 'undefined') {
  window.getVizIds = getVizIds;
  window.resolveVizIds = resolveVizIds;
}
