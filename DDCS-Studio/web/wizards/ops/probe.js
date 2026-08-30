/**
 * wizards/ops/probe.js — PROBE primitive: a single-axis probe move. PROFILE-AWARE via the active dialect:
 * Expert/V4.1 → `G31 <axis><to> …`, DM500 → `M101 / G01 / M102` (move-until-input), Centroid → `M115 …`,
 * RS274NGC → `G38.2 …`. Verified single-axis vs the real macros (3D PROBE G55.nc probes one axis at a time).
 * The rapid-to-XY / clearance / incremental setup around it is composed from Move + Distance blocks.
 */
import { num, val } from './util.js';

export const probeBlock = {
    type: 'probe', label: 'Probe', kind: 'leaf', category: 'Move',
    help: "Probes one axis: travels toward `to` and stops the instant the probe input trips, or refuses if it never does. Use it inside a probe cycle — the rapid-to-position and clearance moves around it are ordinary Move blocks.",
    // t2433 (BACKLOG #49) — `level` ANSWERED (was flagged t2431): the probe input's trigger polarity, confirmed
    // three independent ways (the ddcs-expert skill's own variable table, the vendor's own config text, and a
    // live differential toggle recorded in the owner's own FINDINGS.md). Deliberately no register number in the
    // wording — a SETTING number and a MACRO variable with the same digits mean different things on this
    // controller, so a number here risks sending someone to the wrong table.
    labels: { to: 'probe toward', port: 'probe input port', level: 'trigger polarity' },
    fieldHelp: { level: "Which electrical state counts as contact: 0 for a normally-open probe (the common case — contact CLOSES the circuit), 1 for normally-closed (contact OPENS it). Must match how the probe is actually wired, or it will either never trigger or read as already triggered before it touches anything." },
    defaults: { axis: 'Z', to: -10, feed: 100, port: 3, level: 0 },
    fields: ['axis', 'to', 'feed', 'port', 'level'],
    // to/feed/port accept literals OR #var/[expr] refs (probe macros probe to #8 at feed #3, port #5).
    emit: (p, dx, dy, dialect) => dialect.probeMove(p.axis || 'Z', val(p.to, -10),
        { feed: val(p.feed, 100), port: val(p.port, 3), level: num(p.level, 0) }),
};
