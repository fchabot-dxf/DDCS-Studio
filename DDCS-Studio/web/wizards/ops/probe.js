/**
 * wizards/ops/probe.js — PROBE primitive: a single-axis probe move. PROFILE-AWARE via the active dialect:
 * Expert/V4.1 → `G31 <axis><to> …`, DM500 → `M101 / G01 / M102` (move-until-input), Centroid → `M115 …`,
 * RS274NGC → `G38.2 …`. Verified single-axis vs the real macros (3D PROBE G55.nc probes one axis at a time).
 * The rapid-to-XY / clearance / incremental setup around it is composed from Move + Distance blocks.
 */
import { num, val } from './util.js';

export const probeBlock = {
    type: 'probe', label: 'Probe', kind: 'leaf', category: 'Move',
    defaults: { axis: 'Z', to: -10, feed: 100, port: 3, level: 0 },
    fields: ['axis', 'to', 'feed', 'port', 'level'],
    // to/feed/port accept literals OR #var/[expr] refs (probe macros probe to #8 at feed #3, port #5).
    emit: (p, dx, dy, dialect) => dialect.probeMove(p.axis || 'Z', val(p.to, -10),
        { feed: val(p.feed, 100), port: val(p.port, 3), level: num(p.level, 0) }),
};
