/**
 * blocks/dataOps/polygonData.js — POLYGON TURNING as a DATA-OP TWIN (t1277).
 *
 * The family's fifth op and its only AXIS-MODE member: it needs the chuck commanded to an angle, so it declares that
 * need and greys — with the reason — on a workspace whose chuck is a spindle. That is the axis-gating pattern doing
 * exactly what it was built for on the first machine fact it was NOT built for: not a missing linear axis, but a
 * chuck that turns the wrong way for this job.
 *
 * ITS BINDINGS ARE UNLIKE THE FAMILY'S, and honestly so. The other four bind form fields to macro #vars, because
 * their macros are recipes the operator can retune at the machine. This one's PATH is computed at post time (the
 * controller has no cosine — see wizards/lathe/polygon.js), so the sizes that shape the path have no socket to bind:
 * they are Studio-side parameters that regenerate the whole program. Only the numbers that still mean something on
 * the controller — the extent, the feed — are bound to vars. Pretending otherwise would put a field on screen whose
 * edit the machine could not honour.
 */
import { polygonStack, POLY_DEFAULTS, POLY_VARS, POLY_PRESETS } from '../../wizards/lathe/polygon.js';
import { userOpFromStack } from '../userOps.js';
import { deriveBindingsFor } from './deriveBindings.js';
import { appendToolSel } from '../../wizards/ops/toolsel.js';
import { LATHE_GROUP } from './facingData.js';
import { withLatheScene } from '../../viz/latheScene.js';   // t1281 — the bar, in the 3D scene

export const POLY_DATA_OPTYPE = 'user_lathe_polygon';

/** The sockets that really exist: the numbers the controller still owns. */
export const POLY_BINDING_SPECS = [
    { param: 'depth', match: { type: 'assign', var: POLY_VARS.depth }, key: 'value', type: 'number',
      label: 'Extent', help: 'How far along the bar the polygon section runs, from the workpiece face.',
      section: 'GEOMETRY', units: 'mm', default: POLY_DEFAULTS.depth },
    { param: 'feed', match: { type: 'assign', var: POLY_VARS.feed }, key: 'value', type: 'number',
      label: 'Feed', section: 'TOOL & CUT', units: 'mm/min', default: POLY_DEFAULTS.feed },
    { param: 'toolNum', match: { type: 'toolsel' }, key: 'toolNum', type: 'number',
      label: 'Tool', help: 'The tool-library number this op runs. Unset = no declared tool.', section: 'TOOL & CUT' },
];

/**
 * The STUDIO-SIDE parameters: they regenerate the path rather than writing a socket, so they carry no `match`.
 * `sides` is the identity — it is what the part IS — and the presets are the ones people actually cut.
 */
export const POLY_STRUCT_BINDINGS = [
    { param: 'sides', type: 'enum', widget: 'segmented', default: String(POLY_DEFAULTS.sides), label: 'Flats', section: 'IDENTITY',
      help: 'How many flats. A hex is the common one — it is a wrench size.',
      widgetConfig: { options: POLY_PRESETS.map((x) => [x.label, String(x.sides)]) } },
    { param: 'acrossFlats', type: 'number', default: POLY_DEFAULTS.acrossFlats, label: 'Across flats', section: 'GEOMETRY', units: 'mm',
      help: 'The wrench size — flat to opposite flat, which is what the drawing says and what you measure. The corners stand further out than this.' },
    { param: 'doc', type: 'number', default: POLY_DEFAULTS.doc, label: 'Depth per sweep', section: 'GEOMETRY', units: 'mm',
      help: 'How much RADIUS each roughing sweep takes off. The light sweep falls first, meeting the round bar.' },
    { param: 'segmentsPerFace', type: 'number', default: POLY_DEFAULTS.segmentsPerFace, label: 'Segments per face', section: 'GEOMETRY',
      help: 'How finely each flat is chopped into A/X moves. Per FACE, not per turn, so every shape gets the same fidelity per flat. Rounded to an even number so a point lands on each corner AND on the middle of each flat.' },
];

function polyDataStack(p = POLY_DEFAULTS) {
    return [{
        type: 'user_root',
        params: {},
        uiChildren: [
            // t2301 (BACKLOG 20) — 'panel' removed, 'sim' ADDED: id-collision fix, see centerDrillData.js's own
            // fuller comment (same reasoning, no existing plain-lathe-cutting-twin precedent to match).
            { type: 'sim', params: {} },
            { type: 'layout', params: { kind: 'lathe_profile' } },
            { type: 'param_group', params: { group: 'Polygon' }, children: [] },
        ],
        children: appendToolSel(polygonStack(p)),
    }];
}

export const POLY_BINDINGS = deriveBindingsFor(polyDataStack(POLY_DEFAULTS), POLY_BINDING_SPECS);

/**
 * THE PATH IS REGENERATED, not patched. Every Studio-side parameter changes the whole sweep, so the honest hook
 * rebuilds the program from the resolved params rather than trying to edit blocks into a new shape.
 */
export function rebuildPolygon(stack, resolved) {
    const p = resolved || {};
    const built = polygonStack({
        ...POLY_DEFAULTS,
        sides: Number(p.sides) || POLY_DEFAULTS.sides,
        acrossFlats: Number(p.acrossFlats) || POLY_DEFAULTS.acrossFlats,
        depth: Number(p.depth) || POLY_DEFAULTS.depth,
        segmentsPerFace: Number(p.segmentsPerFace) || POLY_DEFAULTS.segmentsPerFace,
        doc: Number(p.doc) || POLY_DEFAULTS.doc,
        feed: Number(p.feed) || POLY_DEFAULTS.feed,
    });
    const root = Array.isArray(stack) && stack[0] ? stack[0] : null;
    if (!root) return stack;
    // keep any non-macro siblings the wrap added (the tool marker), then the freshly computed program
    const keep = (root.children || []).filter((b) => b && b.type === 'toolsel');
    root.children = [...built, ...keep];
    return stack;
}

export function polygonDataDef() {
    const def = withLatheScene(userOpFromStack(
        'lathe_polygon', 'Polygon Turn (lathe)', polyDataStack(POLY_DEFAULTS),
        [...POLY_BINDINGS, ...POLY_STRUCT_BINDINGS], 'form3d+2d', null, LATHE_GROUP,
    ), POLY_DEFAULTS);
    def.postInstantiate = (stack, resolved) => rebuildPolygon(stack, resolved);
    return def;
}
