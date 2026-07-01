import { cornerStack } from '../wizards/cornerWizard.js';
import { userOpFromStack } from '../blocks/userOps.js';

const CORNER_DEFAULTS = {
  corner: 1,
  probeSeq: 0,
  probeZFirst: 0,
  wcs: 0,
  dist: 500,
  retract: 5,
  f_fast: 200,
  f_slow: 50,
  port: 3,
  level: 0,
  safeZ: 10,
  scanDepth: 5,
  radius: 2,
  startX: 0,
  startY: 0,
  cross1_x: 0,
  cross1_y: 0,
  syncA: 0,
  slave: '3',
};

// cornerStack output (flat pre-order, all default params):
//   0 comment(text) · 1 comment(text) · 2 comment(text)
//   3 assign(#1 value dist) · 4 assign(#2 value retract)
//   5 assign(#3 value fFast) · 6 assign(#4 value fSlow)
//   7 assign(#5 value port) · 8 assign(#6 value radius)
//   9 assign(#7) · 10 assign(#8) · 11 assign(#9) · 12 assign(#10)
//   13 assign(#17 value plungeDepth) · 14 assign(#18) · 15 assign(#19 value safeZ)
//   16 assign(#23 value cross1_x) · 17 assign(#24 value cross1_y)
//   18+ (wcs config, confirm, probe walls, footer)
//
// BINDABLE params = those with a dedicated assign socket (key:'value').
// Unbound (held at default, like drill's clearance/method):
//   corner, probeSeq, probeZFirst, wcs — structural, embedded in comment strings or control flow
//   scanDepth, level — embedded in plungeDepth or probeSurfaceStack (no single socket)
//   startX, startY — in the probeZ conditional (absent in default template)
//   syncA, slave — in a conditional block at the end
//
// Block index = position in the flat execution stack (pre-wrap).
// At seed the template wraps in user_root + panel + sim + param_group (+4 offset).
const CORNER_EXEC_BINDINGS = [
  { param: 'dist', type: 'number', label: 'Max Probe Dist', default: CORNER_DEFAULTS.dist, section: 'TOOL & CUT', blockIndex: 3, key: 'value' },
  { param: 'retract', type: 'number', label: 'Retract', default: CORNER_DEFAULTS.retract, section: 'TOOL & CUT', blockIndex: 4, key: 'value' },
  { param: 'f_fast', type: 'number', label: 'Fast Feed', default: CORNER_DEFAULTS.f_fast, section: 'TOOL & CUT', blockIndex: 5, key: 'value' },
  { param: 'f_slow', type: 'number', label: 'Slow Feed', default: CORNER_DEFAULTS.f_slow, section: 'TOOL & CUT', blockIndex: 6, key: 'value' },
  { param: 'port', type: 'number', label: 'Port', default: CORNER_DEFAULTS.port, section: 'TOOL & CUT', blockIndex: 7, key: 'value' },
  { param: 'radius', type: 'number', label: 'Stylus Radius', default: CORNER_DEFAULTS.radius, section: 'TOOL & CUT', blockIndex: 8, key: 'value' },
  { param: 'safeZ', type: 'number', label: 'Safe Z', default: CORNER_DEFAULTS.safeZ, section: 'GEOMETRY', blockIndex: 15, key: 'value' },
  { param: 'cross1_x', type: 'number', label: 'Wall 2 dX', default: CORNER_DEFAULTS.cross1_x, section: 'GEOMETRY', blockIndex: 16, key: 'value' },
  { param: 'cross1_y', type: 'number', label: 'Wall 2 dY', default: CORNER_DEFAULTS.cross1_y, section: 'GEOMETRY', blockIndex: 17, key: 'value' },
];

// Wrapped-template prefix: user_root + panel + sim + param_group occupy 4 flattened slots.
const WRAP_PREFIX = 4;
const CORNER_BINDINGS = CORNER_EXEC_BINDINGS.map((b) => ({ ...b, blockIndex: b.blockIndex + WRAP_PREFIX }));
/** Build the corner-as-data def — same userOpFromStack pattern as drill/surfacing/slot/text/atcWarmup.
 *  Structural params (corner/probeSeq/probeZFirst/wcs) are held at default like drill's clearance/method,
 *  because they are embedded in comment strings or control flow, not in a single bindable socket. */
export function cornerPortDef() {
  const exec = cornerStack(CORNER_DEFAULTS);
  const stack = [{
    type: 'user_root',
    params: {},
    uiChildren: [
      { type: 'panel', params: { panel: 'form3d' } },
      { type: 'sim', params: { rotary: false, machine: true, magazine: false } },
      {
        type: 'param_group',
        params: { group: 'Corner' },
        children: [],
      },
    ],
    children: exec,
  }];
  return userOpFromStack('corner_port', 'Corner (data)', stack, CORNER_BINDINGS, 'form3d', { forceMachine: true }, 'probe_datawiz');
}

