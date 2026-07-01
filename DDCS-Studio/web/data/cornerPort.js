import { cornerStack } from '../wizards/cornerWizard.js';
import { userOpFromStack } from '../blocks/userOps.js';

const CORNER_DEFAULTS = {
  corner: 'FL',
  probeSeq: 'YX',
  probeZFirst: false,
  wcs: 'active',
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
  syncA: false,
  slave: '3',
};

// cornerStack output at defaults (flat pre-order with notepad assigns):
//   0 comment · 1 comment · 2 comment · 3 comment("=== CONFIGURATION ===")
//   4 assign(#1 dist) · 5 assign(#2 retract) · 6 assign(#3 fFast) · 7 assign(#4 fSlow)
//   8 assign(#5 port) · 9 assign(#6 radius)
//  10 comment("=== CALCULATED MOTIONS ===")
//  11 assign(#7) · 12 assign(#8) · 13 assign(#9) · 14 assign(#10)
//  15 assign(#15 travelDist=0) · 16 assign(#16) · 17 assign(#17 plungeDepth)
//  18 assign(#18) · 19 assign(#19 safeZ)
//  20 assign(#_corner) · 21 assign(#_probe_seq) · 22 assign(#_probe_z)
//  23 assign(#_wcs) · 24 assign(#_level) · 25 assign(#_scan_depth)
//  26 assign(#_travel_dist) · 27 assign(#_sync_a) · 28 assign(#_slave)
//  29+ (wcs config, confirm, probe walls, footer)
//
// Every param has a dedicated assign socket at (blockIndex, key:'value').
const CORNER_EXEC_BINDINGS = [
  { param: 'dist', type: 'number', label: 'Max Probe Dist', default: CORNER_DEFAULTS.dist, section: 'TOOL & CUT', blockIndex: 4, key: 'value' },
  { param: 'retract', type: 'number', label: 'Retract', default: CORNER_DEFAULTS.retract, section: 'TOOL & CUT', blockIndex: 5, key: 'value' },
  { param: 'f_fast', type: 'number', label: 'Fast Feed', default: CORNER_DEFAULTS.f_fast, section: 'TOOL & CUT', blockIndex: 6, key: 'value' },
  { param: 'f_slow', type: 'number', label: 'Slow Feed', default: CORNER_DEFAULTS.f_slow, section: 'TOOL & CUT', blockIndex: 7, key: 'value' },
  { param: 'port', type: 'number', label: 'Port', default: CORNER_DEFAULTS.port, section: 'TOOL & CUT', blockIndex: 8, key: 'value' },
  { param: 'radius', type: 'number', label: 'Stylus Radius', default: CORNER_DEFAULTS.radius, section: 'TOOL & CUT', blockIndex: 9, key: 'value' },
  { param: 'safeZ', type: 'number', label: 'Safe Z', default: CORNER_DEFAULTS.safeZ, section: 'GEOMETRY', blockIndex: 19, key: 'value' },
  { param: 'corner', type: 'number', label: 'Corner', default: CORNER_DEFAULTS.corner, widget: 'dropdown', widgetConfig: { options: [['FL', 'FL'], ['FR', 'FR'], ['BL', 'BL'], ['BR', 'BR']] }, section: 'SETUP', blockIndex: 20, key: 'value' },
  { param: 'probeSeq', type: 'number', label: 'Probe Order', default: CORNER_DEFAULTS.probeSeq, widget: 'dropdown', widgetConfig: { options: [['YX', 'YX'], ['XY', 'XY']] }, section: 'SETUP', blockIndex: 21, key: 'value' },
  { param: 'probeZFirst', type: 'bool', label: 'Probe Z first', default: !!CORNER_DEFAULTS.probeZFirst, widget: 'toggle', section: 'SETUP', blockIndex: 22, key: 'value' },
  { param: 'wcs', type: 'number', label: 'WCS', default: CORNER_DEFAULTS.wcs, widget: 'dropdown', widgetConfig: { options: [['Active', 'active'], ['G54', 'G54'], ['G55', 'G55'], ['G56', 'G56'], ['G57', 'G57'], ['G58', 'G58'], ['G59', 'G59']] }, section: 'SETUP', blockIndex: 23, key: 'value' },
  { param: 'level', type: 'number', label: 'Level', default: CORNER_DEFAULTS.level, section: 'ADVANCED', blockIndex: 24, key: 'value' },
  { param: 'scanDepth', type: 'number', label: 'Scan Depth', default: CORNER_DEFAULTS.scanDepth, section: 'GEOMETRY', blockIndex: 25, key: 'value' },
  { param: 'travelDist', type: 'number', label: 'Travel Dist', default: CORNER_DEFAULTS.travelDist || 50, section: 'GEOMETRY', blockIndex: 26, key: 'value' },
  { param: 'syncA', type: 'bool', label: 'Sync A', default: !!CORNER_DEFAULTS.syncA, widget: 'toggle', section: 'ADVANCED', blockIndex: 27, key: 'value' },
  { param: 'slave', type: 'number', label: 'Slave Offset', default: Number(CORNER_DEFAULTS.slave), section: 'ADVANCED', blockIndex: 28, key: 'value' },
];

// Wrapped-template prefix: user_root + panel + sim + param_group occupy 4 flattened slots.
const WRAP_PREFIX = 4;
const CORNER_BINDINGS = CORNER_EXEC_BINDINGS.map((b) => ({ ...b, blockIndex: b.blockIndex + WRAP_PREFIX }));

/** Build the corner-as-data def — all 16 params bound to unique (blockIndex, key:'value') sockets
 *  via the notepad assigns added to cornerWizard.js. No build: hybrid — pure instantiate. */
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
