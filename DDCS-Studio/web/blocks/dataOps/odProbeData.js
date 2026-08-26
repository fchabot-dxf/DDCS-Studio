/**
 * blocks/dataOps/odProbeData.js — THE OD PROBE as a data-op twin (t1299).
 *
 * THE IDENTITY FIELD IS THE MEASUREMENT: what the calipers said. That number is the whole reason this op is not just
 * an edge probe — it is the one fact the machine cannot discover for itself, and everything the op writes is derived
 * from it. So it leads the form, labelled as a DIAMETER, because that is what a caliper reads and what the DRO will
 * show afterwards. The halving happens once, on the controller, in `[#51/2]`.
 *
 * Like its sibling it regenerates through the one builder rather than patching a snapshot.
 */
import { odProbeStack, OD_PROBE_DEFAULTS } from '../../wizards/lathe/odProbe.js';
import { PROBE_VARS } from '../../wizards/lathe/latheProbe.js';
import { userOpFromStack } from '../userOps.js';
import { deriveBindingsFor } from './deriveBindings.js';
import { withLatheScene } from '../../viz/latheScene.js';

export const OD_PROBE_DATA_OPTYPE = 'user_lathe_odprobe';
export const LATHE_GROUP = 'lathe';

const V = PROBE_VARS;

const WCS_OPTIONS = [['Active WCS', 'active'], ['G54', 'G54'], ['G55', 'G55'], ['G56', 'G56'], ['G57', 'G57'], ['G58', 'G58'], ['G59', 'G59']];

// t1756 — MACHINE VARIABLES ROLL OUT, probe family. NOT the corner shape: this twin's postInstantiate
// (rebuildOdProbe, below) REGENERATES the whole stack every edit via `n(k)` — `Number.isFinite(Number(p[k])) ?
// Number(p[k]) : DEFAULT` — so a token typed into ANY of these 7 today fails the finite check and is silently
// swallowed back to the default, exactly the class this cycle exists to stop. None are branch-selectors though
// (each is a plain magnitude with no JS count/shape decision riding on it — odProbe.js just plugs the resolved
// number into a probe atom's value socket) — the SAME shape corner's `hopDist`/`planeZ` were found to be
// ("re-resolved by the atom itself... it can't carry a live value yet"), so all 7 are DEFERRABLE-CANDIDATES:
// eligible if/when rebuildOdProbe's numeric rebuild is replaced with a direct #var-identity bind like corner's.
const REBUILD_REFUSAL = 'This value is re-resolved by the operation\'s own rebuild before the program is built — it can\'t carry a live value yet.';
export const OD_PROBE_BINDING_SPECS = [
    // …a DIAMETER field bound to the DIAMETER socket. The rule exists because the failure is silent: a diameter
    // dropped into a radius socket makes every part exactly half size, with nothing on screen looking wrong.
    { param: 'caliperDiameter', match: { type: 'assign', var: V.caliper }, key: 'value', type: 'number', tokenRefusal: REBUILD_REFUSAL, tokenDeferrable: true,
      label: 'Measured bar Ø', section: 'IDENTITY', default: OD_PROBE_DEFAULTS.caliperDiameter,
      help: 'What the calipers read across the bar. After the touch the DRO shows exactly this diameter.' },
    { param: 'tipRadius', match: { type: 'assign', var: V.tip }, key: 'value', type: 'number', tokenRefusal: REBUILD_REFUSAL, tokenDeferrable: true,
      label: 'Stylus radius', section: 'PROBE', default: OD_PROBE_DEFAULTS.tipRadius,
      help: 'Compensated on the RADIUS, where the touch happens — so it moves the diameter by twice itself.' },
    { param: 'maxDist', match: { type: 'assign', var: V.maxDist }, key: 'value', type: 'number', tokenRefusal: REBUILD_REFUSAL, tokenDeferrable: true,
      label: 'Max seek', section: 'PROBE', default: OD_PROBE_DEFAULTS.maxDist,
      help: 'How far to travel inward before calling it a miss. Jog close first.' },
    { param: 'retract', match: { type: 'assign', var: V.retract }, key: 'value', type: 'number', tokenRefusal: REBUILD_REFUSAL, tokenDeferrable: true,
      label: 'Retract between touches', section: 'PROBE', default: OD_PROBE_DEFAULTS.retract,
      help: 'How far the probe backs off (mm) after the fast find, before creeping in again at the slow feed. Big enough to clear the surface, small enough that the slow touch is short.' },
    { param: 'feedFast', match: { type: 'assign', var: V.feedFast }, key: 'value', type: 'number', tokenRefusal: REBUILD_REFUSAL, tokenDeferrable: true,
      label: 'Fast find feed', section: 'PROBE', default: OD_PROBE_DEFAULTS.feedFast,
      help: 'Feed for the FIRST approach (mm/min) — it only has to find the diameter roughly, so it can be quick. The measurement comes from the slow touch, not this one.' },
    { param: 'feedSlow', match: { type: 'assign', var: V.feedSlow }, key: 'value', type: 'number', tokenRefusal: REBUILD_REFUSAL, tokenDeferrable: true,
      label: 'Slow touch feed', section: 'PROBE', default: OD_PROBE_DEFAULTS.feedSlow,
      help: 'Feed for the SECOND, measuring touch (mm/min). This is the number that decides accuracy — slower gives a more repeatable trigger point.' },
    { param: 'port', match: { type: 'assign', var: V.port }, key: 'value', type: 'number', tokenRefusal: REBUILD_REFUSAL, tokenDeferrable: true,
      label: 'Probe port', section: 'PROBE', default: OD_PROBE_DEFAULTS.port,
      help: 'Which controller input the probe is wired to. Must match the physical port, or the touch is never seen and the tool keeps driving.' },
];

// t1756 — NOT eligible: odProbe.js's `wcsArg(wcs)` COMPARES this value to pick a different literal ('#578' vs a
// computed Gnn-53 index) — a categorical branch-selector (which register gets written), not a magnitude — the
// same shape corner's own `wcs` carries, and unlike the 7 scalars above this one is a genuine selector, not a
// coercion casualty, so it is NOT deferrable either.
export const OD_PROBE_STRUCT_BINDINGS = [
    { param: 'wcs', type: 'enum', widget: 'select', tokenRefusal: 'Selects which work-coordinate register the measured diameter is written to — this changes which G-code gets built, not a number inside it.', default: OD_PROBE_DEFAULTS.wcs, label: 'Write to', section: 'IDENTITY',
      help: 'Which work coordinate system this datum lands in. The probe never READS it — it is the output.',
      widgetConfig: { options: WCS_OPTIONS } },
];

function odProbeDataStack(p = OD_PROBE_DEFAULTS) {
    return [{
        type: 'user_root',
        params: {},
        uiChildren: [
            { type: 'layout', params: { kind: 'lathe_profile' } },
            // t2301 (BACKLOG 20) — 'panel' removed: inert + id-collided with sim's own layout2d pane (see
            // drillData.js's own t2301 comment for the full mechanism, first fixed for ATC at t2257).
            { type: 'sim', params: { probeWcs: true } },   // this op PRODUCES the WCS — never render through the table
            // t1301 — WHERE THE OPERATOR PUT THE STYLUS: just outside the bar, a little back along the round and
            // clear of the chuck, which is word for word what this op's prompt asks them to do.
            { type: 'simstart', params: { anchor: 'lathe', out: 4, zplane: -8 } },
            { type: 'param_group', params: { group: 'OD Probe' }, children: [] },
        ],
        children: odProbeStack(p),
    }];
}

export const OD_PROBE_BINDINGS = deriveBindingsFor(odProbeDataStack(OD_PROBE_DEFAULTS), OD_PROBE_BINDING_SPECS);

export function rebuildOdProbe(stack, resolved) {
    const p = resolved || {};
    const n = (k) => (Number.isFinite(Number(p[k])) ? Number(p[k]) : OD_PROBE_DEFAULTS[k]);
    const built = odProbeStack({
        ...OD_PROBE_DEFAULTS,
        caliperDiameter: n('caliperDiameter'), tipRadius: n('tipRadius'), maxDist: n('maxDist'), retract: n('retract'),
        feedFast: n('feedFast'), feedSlow: n('feedSlow'), port: n('port'),
        wcs: p.wcs || OD_PROBE_DEFAULTS.wcs,
    });
    const root = (stack || [])[0];
    if (root) root.children = built;
    return stack;
}

export function odProbeDataDef() {
    const def = withLatheScene(userOpFromStack(
        'lathe_odprobe',
        'OD probe (lathe)',
        odProbeDataStack(OD_PROBE_DEFAULTS),
        [...OD_PROBE_BINDINGS, ...OD_PROBE_STRUCT_BINDINGS],
        'form3d+2d',
        null,
        LATHE_GROUP,
    ), OD_PROBE_DEFAULTS, 'probe', 'x');
    def.postInstantiate = (stack, resolved) => rebuildOdProbe(stack, resolved);
    return def;
}
