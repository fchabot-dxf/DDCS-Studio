/**
 * blocks/dataOps/faceProbeData.js — THE FACE PROBE as a data-op twin (t1299).
 *
 * THE FORM IS IDENTITY-FIRST, and this op's identity is one question: WHICH FACE IS ZERO. Everything else is probe
 * setup — the stylus, how far to seek, how fast. So "ahead of Z0" leads, alone, and the rest sits below it where a
 * turner who has already set their probe up once never has to look again.
 *
 * IT REGENERATES THROUGH THE ONE BUILDER. A twin's template is a SNAPSHOT taken at the defaults, so any branch that
 * runs at BUILD time freezes into it — the OD-turning taper blocker, one turn old. This op has such a branch (the
 * WCS choice reaches both the base compute and the write address), so `postInstantiate` rebuilds the macro from the
 * resolved params through `faceProbeStack` rather than patching values into a frozen shape.
 */
import { faceProbeStack, FACE_PROBE_DEFAULTS } from '../../wizards/lathe/faceProbe.js';
import { PROBE_VARS } from '../../wizards/lathe/latheProbe.js';
import { userOpFromStack } from '../userOps.js';
import { deriveBindingsFor } from './deriveBindings.js';
import { withLatheScene } from '../../viz/latheScene.js';

export const FACE_PROBE_DATA_OPTYPE = 'user_lathe_faceprobe';
export const LATHE_GROUP = 'lathe';

const V = PROBE_VARS;

/** WCS choices — the same seven the mill probes offer, because a datum is a datum. */
const WCS_OPTIONS = [['Active WCS', 'active'], ['G54', 'G54'], ['G55', 'G55'], ['G56', 'G56'], ['G57', 'G57'], ['G58', 'G58'], ['G59', 'G59']];

// t1756 — MACHINE VARIABLES ROLL OUT, probe family. Same shape as odProbeData (its lathe-probe sibling, same
// rebuild mechanism): postInstantiate (rebuildFaceProbe, below) regenerates the whole stack via `n(k)` —
// `Number.isFinite(Number(p[k])) ? Number(p[k]) : DEFAULT` — so a token in any of these 7 fields is silently
// swallowed back to the default today. None decide program SHAPE (faceProbe.js just plugs each resolved number
// into a probe atom's socket or a controller-side expression, e.g. `ahead` → `[surface-ahead]` computed AT the
// controller, never branched on in JS) — the corner `hopDist`/`planeZ` shape, so all 7 are DEFERRABLE-CANDIDATES.
const REBUILD_REFUSAL = 'This value is re-resolved by the operation\'s own rebuild before the program is built — it can\'t carry a live value yet.';
export const FACE_PROBE_BINDING_SPECS = [
    { param: 'ahead', match: { type: 'assign', var: V.ahead }, key: 'value', type: 'number', tokenRefusal: REBUILD_REFUSAL, tokenDeferrable: true,
      label: 'Touched face is ahead of Z0 by', section: 'IDENTITY', default: FACE_PROBE_DEFAULTS.ahead,
      help: 'Zero means the face you touch IS Z0 — the ordinary touch-off. Type the facing allowance instead and the datum lands on the FINISHED face, so Z0 is still Z0 after facing.' },
    { param: 'tipRadius', match: { type: 'assign', var: V.tip }, key: 'value', type: 'number', tokenRefusal: REBUILD_REFUSAL, tokenDeferrable: true,
      label: 'Stylus radius', section: 'PROBE', default: FACE_PROBE_DEFAULTS.tipRadius,
      help: 'The one number between the trigger position and the surface. Wrong here = every Z wrong by the difference.' },
    { param: 'maxDist', match: { type: 'assign', var: V.maxDist }, key: 'value', type: 'number', tokenRefusal: REBUILD_REFUSAL, tokenDeferrable: true,
      label: 'Max seek', section: 'PROBE', default: FACE_PROBE_DEFAULTS.maxDist,
      help: 'How far to travel before calling it a miss. Jog close first; this is a safety limit, not an approach.' },
    { param: 'retract', match: { type: 'assign', var: V.retract }, key: 'value', type: 'number', tokenRefusal: REBUILD_REFUSAL, tokenDeferrable: true,
      label: 'Retract between touches', section: 'PROBE', default: FACE_PROBE_DEFAULTS.retract,
      help: 'How far the probe backs off (mm) after the fast find, before creeping in again at the slow feed. Big enough to clear the surface, small enough that the slow touch is short.' },
    { param: 'feedFast', match: { type: 'assign', var: V.feedFast }, key: 'value', type: 'number', tokenRefusal: REBUILD_REFUSAL, tokenDeferrable: true,
      label: 'Fast find feed', section: 'PROBE', default: FACE_PROBE_DEFAULTS.feedFast,
      help: 'Feed for the FIRST approach (mm/min) — it only has to find the surface roughly, so it can be quick. The measurement comes from the slow touch, not this one.' },
    { param: 'feedSlow', match: { type: 'assign', var: V.feedSlow }, key: 'value', type: 'number', tokenRefusal: REBUILD_REFUSAL, tokenDeferrable: true,
      label: 'Slow touch feed', section: 'PROBE', default: FACE_PROBE_DEFAULTS.feedSlow,
      help: 'Feed for the SECOND, measuring touch (mm/min). This is the number that decides accuracy — slower gives a more repeatable trigger point.' },
    { param: 'port', match: { type: 'assign', var: V.port }, key: 'value', type: 'number', tokenRefusal: REBUILD_REFUSAL, tokenDeferrable: true,
      label: 'Probe port', section: 'PROBE', default: FACE_PROBE_DEFAULTS.port,
      help: 'Which controller input the probe is wired to. Must match the physical port, or the touch is never seen and the tool keeps driving.' },
];

// t1756 — NOT eligible, and not deferrable: the WCS choice reaches BOTH the base compute and the write address
// (per this file's own doc comment) — a categorical branch-selector (which register), not a coercion casualty.
/** WHERE THE ANSWER GOES — no socket of its own: it reaches the base compute AND the write address. */
export const FACE_PROBE_STRUCT_BINDINGS = [
    { param: 'wcs', type: 'enum', widget: 'select', tokenRefusal: 'Selects which work-coordinate register the measured datum is written to — this changes which G-code gets built, not a number inside it.', default: FACE_PROBE_DEFAULTS.wcs, label: 'Write to', section: 'IDENTITY',
      help: 'Which work coordinate system this datum lands in. The probe never READS it — it is the output.',
      widgetConfig: { options: WCS_OPTIONS } },
];

function faceProbeDataStack(p = FACE_PROBE_DEFAULTS) {
    return [{
        type: 'user_root',
        params: {},
        uiChildren: [
            { type: 'panel', params: { panel: 'form3d+2d' } },
            { type: 'layout', params: { kind: 'lathe_profile' } },
            // IRON RULE 2, declared to the preview: this op PRODUCES the WCS, so the picture must never be mapped
            // through the declared WCS table — that table describes a previous setup, not the one being measured.
            { type: 'sim', params: { probeWcs: true } },
            // t1301 — WHERE THE OPERATOR PUT THE STYLUS. The op's own prompt asks them to jog just clear of the face,
            // so the preview starts there: a negative `out` places it INSIDE the bar's radius (it touches the FACE,
            // not the round), a few mm ahead of the raw end in +Z. Without this the stroke began at the scene origin.
            { type: 'simstart', params: { anchor: 'lathe', out: -4, zplane: 6 } },
            { type: 'param_group', params: { group: 'Face Probe' }, children: [] },
        ],
        children: faceProbeStack(p),
    }];
}

export const FACE_PROBE_BINDINGS = deriveBindingsFor(faceProbeDataStack(FACE_PROBE_DEFAULTS), FACE_PROBE_BINDING_SPECS);

/** Rebuild the macro from the resolved params — one emit source, so nothing can drift out of the snapshot. */
export function rebuildFaceProbe(stack, resolved) {
    const p = resolved || {};
    const n = (k) => (Number.isFinite(Number(p[k])) ? Number(p[k]) : FACE_PROBE_DEFAULTS[k]);
    const built = faceProbeStack({
        ...FACE_PROBE_DEFAULTS,
        ahead: n('ahead'), tipRadius: n('tipRadius'), maxDist: n('maxDist'), retract: n('retract'),
        feedFast: n('feedFast'), feedSlow: n('feedSlow'), port: n('port'),
        wcs: p.wcs || FACE_PROBE_DEFAULTS.wcs,
    });
    const root = (stack || [])[0];
    if (root) root.children = built;
    return stack;
}

export function faceProbeDataDef() {
    const def = withLatheScene(userOpFromStack(
        'lathe_faceprobe',
        'Face probe (lathe)',
        faceProbeDataStack(FACE_PROBE_DEFAULTS),
        [...FACE_PROBE_BINDINGS, ...FACE_PROBE_STRUCT_BINDINGS],
        'form3d+2d',
        null,
        LATHE_GROUP,
    ), FACE_PROBE_DEFAULTS, 'probe', 'z');
    def.postInstantiate = (stack, resolved) => rebuildFaceProbe(stack, resolved);
    return def;
}
