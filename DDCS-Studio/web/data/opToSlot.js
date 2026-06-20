/**
 * data/opToSlot.js — generate a CAM-slot starting point from a Studio op (drill/bore × pattern).
 *
 * This is the wizard→CAM bridge ("Add from op"): instead of hand-entering form fields, pick an op + pattern
 * and get a filled slot — form fields (label/units/default/min/max/var) + a small, EDITABLE macro body that
 * reads the #2600 mirrors and calls a shared per-hole sub (M_drillhole / M_borehole). The author then tweaks.
 *
 * Per the project priority (friendliness/customization first): one small per-slot loop per pattern + a shared
 * cut sub — no monolithic dispatcher. See the cam-menu-architecture memory + docs/CAM-MENU-RESEARCH.md.
 */
import { nextParam, mirrorVar } from './camPack.js';

// Field specs: label / units / default / min / max / type (1=decimal, 0=integer). `def` may depend on method.
const SPEC = {
    posX: { label: 'Centre X', units: 'mm', def: 0, min: -99999, max: 99999, type: 1 },
    posY: { label: 'Centre Y', units: 'mm', def: 0, min: -99999, max: 99999, type: 1 },
    dia: { label: 'Bolt-circle Ø', units: 'mm', def: 50, min: 1, max: 99999, type: 1 },
    count: { label: 'Hole count', units: '', def: 6, min: 1, max: 999, type: 0 },
    startAngle: { label: 'Start angle', units: 'deg', def: 0, min: 0, max: 360, type: 1 },
    cols: { label: 'Columns', units: '', def: 3, min: 1, max: 999, type: 0 },
    rows: { label: 'Rows', units: '', def: 3, min: 1, max: 999, type: 0 },
    dx: { label: 'X spacing', units: 'mm', def: 20, min: 0, max: 99999, type: 1 },
    dy: { label: 'Y spacing', units: 'mm', def: 20, min: 0, max: 99999, type: 1 },
    spacing: { label: 'Spacing', units: 'mm', def: 20, min: 0, max: 99999, type: 1 },
    angle: { label: 'Line angle', units: 'deg', def: 0, min: 0, max: 360, type: 1 },
    w: { label: 'Width', units: 'mm', def: 100, min: 1, max: 99999, type: 1 },
    h: { label: 'Height', units: 'mm', def: 80, min: 1, max: 99999, type: 1 },
    nx: { label: 'Holes / width', units: '', def: 3, min: 2, max: 999, type: 0 },
    ny: { label: 'Holes / height', units: '', def: 2, min: 2, max: 999, type: 0 },
    holeDia: { label: 'Hole Ø', units: 'mm', def: 6, min: 0.1, max: 9999, type: 1 },
    toolDia: { label: 'Tool Ø', units: 'mm', def: 6, min: 0.1, max: 9999, type: 1 },
    depth: { label: 'Depth', units: 'mm', def: 5, min: 0, max: 9999, type: 1 },
    peck: { label: 'Peck', units: 'mm', def: 3, min: 0.1, max: 9999, type: 1 },
    pitch: { label: 'Pitch (Z/turn)', units: 'mm', def: 0.5, min: 0.05, max: 999, type: 1 },
    feed: { label: 'Feed', units: 'mm/min', def: 300, min: 1, max: 99999, type: 0 },
    clearance: { label: 'Clearance Z', units: 'mm', def: 5, min: 0, max: 9999, type: 1 },
};

const PATTERN_FIELDS = { circle: ['dia', 'count', 'startAngle'], grid: ['cols', 'rows', 'dx', 'dy'], line: ['count', 'spacing', 'angle'], rect: ['w', 'h', 'nx', 'ny'] };
const HOLE_FIELDS = { drill: ['holeDia', 'depth', 'peck'], bore: ['holeDia', 'toolDia', 'depth', 'pitch'] };
const PATTERN_LABEL = { circle: 'bolt circle', grid: 'grid', line: 'line', rect: 'rectangle' };

/** The shared per-hole sub text (installed once; the slot macros call it). Reads working vars #30+ at current X/Y. */
export function sharedSub(method) {
    if (method === 'bore') {
        // Position-INDEPENDENT (called centred at each hole): incremental XY ring so it works at any centre.
        return ['( M_borehole — bore ONE hole centred at the current X/Y. Reads #30=holeDia #31=toolDia',
            '  #32=depth #33=pitch #34=feed #35=clearance. Ring-step, no helical G3. Assumes holeDia >= toolDia. )',
            '#40=[#30-#31]/2          ;cut radius', '#41=0',
            'G90 G0 Z#35', 'G91 G0 X#40 Y0          ;out to cut radius (relative to centre)',
            'WHILE #41 LT #32 DO1', '  #41=#41+#33', '  IF #41 GT #32 THEN #41=#32',
            '  G90 G1 Z[-#41] F#34', '  G91 G3 X0 Y0 I[-#40] J0 F#34   ;full circle', 'END1',
            'G90 G0 Z#35', 'G91 G0 X[-#40] Y0       ;back to centre', 'G90', 'M99'].join('\n') + '\n';
    }
    return ['( M_drillhole — peck-drill ONE hole at the current X/Y. Reads #30=holeDia #31=depth',
        '  #32=peck #33=feed #34=clearance )',
        '#41=0', 'G90 G0 Z#34',
        'WHILE #41 LT #31 DO1', '  #41=#41+#32', '  IF #41 GT #31 THEN #41=#31',
        '  G1 Z[-#41] F#33', '  G0 Z#34   ;full retract to clear chips', 'END1',
        'M99'].join('\n') + '\n';
}

/** The pattern loop body (uses the var map; positions each point + calls the shared sub `call`). */
function loopBody(pattern, v, call) {
    if (pattern === 'circle') {
        return ['#50=0', `WHILE #50 LT ${v.count} DO1`, `  #51=${v.startAngle}+#50*360/${v.count}`,
            `  G0 X[${v.posX}+[${v.dia}/2]*COS[#51]] Y[${v.posY}+[${v.dia}/2]*SIN[#51]]`, `  ${call}`, '  #50=#50+1', 'END1'].join('\n');
    }
    if (pattern === 'line') {
        return ['#50=0', `WHILE #50 LT ${v.count} DO1`,
            `  G0 X[${v.posX}+#50*${v.spacing}*COS[${v.angle}]] Y[${v.posY}+#50*${v.spacing}*SIN[${v.angle}]]`, `  ${call}`, '  #50=#50+1', 'END1'].join('\n');
    }
    if (pattern === 'grid') {
        return ['#52=0', `WHILE #52 LT ${v.rows} DO1`, '  #50=0', `  WHILE #50 LT ${v.cols} DO2`,
            `    G0 X[${v.posX}+#50*${v.dx}] Y[${v.posY}+#52*${v.dy}]`, `    ${call}`, '    #50=#50+1', '  END2', '  #52=#52+1', 'END1'].join('\n');
    }
    // rect perimeter: top+bottom rows (nx each), then interior left+right columns (ny, skip shared corners)
    return ['#50=0', `WHILE #50 LT ${v.nx} DO1`, `  #53=${v.posX}+${v.w}*#50/[${v.nx}-1]`,
        `  G0 X#53 Y${v.posY}`, `  ${call}`, `  G0 X#53 Y[${v.posY}+${v.h}]`, `  ${call}`, '  #50=#50+1', 'END1',
        '#52=1', `WHILE #52 LT [${v.ny}-1] DO1`, `  #54=${v.posY}+${v.h}*#52/[${v.ny}-1]`,
        `  G0 X${v.posX} Y#54`, `  ${call}`, `  G0 X[${v.posX}+${v.w}] Y#54`, `  ${call}`, '  #52=#52+1', 'END1'].join('\n');
}

/**
 * Build a slot starting point. method 'drill'|'bore', pattern 'circle'|'grid'|'line'|'rect'.
 * `used` = Set of #11xx already taken in the pack (for collision-free allocation).
 * Returns { name, fields:[{idx,label,units,def,min,max,type,var}], body }  — plugs straight into camPack.
 */
export function slotFromOp(method, pattern, used = new Set()) {
    const order = ['posX', 'posY', ...PATTERN_FIELDS[pattern], ...HOLE_FIELDS[method], 'feed', 'clearance'];
    const taken = new Set(used);
    const fields = order.map((key, i) => {
        const idx = nextParam(taken); if (idx != null) taken.add(idx);
        const s = SPEC[key];
        const def = key === 'holeDia' && method === 'drill' ? 6 : s.def;
        return { key, idx, var: '#' + (i + 1), label: s.label, units: s.units, def, min: s.min, max: s.max, type: s.type };
    });
    const v = {}; fields.forEach((f) => { v[f.key] = f.var; });
    const call = method === 'bore' ? 'M_borehole' : 'M_drillhole';
    // copy the hole params (+ feed/clearance) into the sub's working vars #30+, then run the pattern loop.
    const wv = method === 'bore'
        ? `#30=${v.holeDia} #31=${v.toolDia} #32=${v.depth} #33=${v.pitch} #34=${v.feed} #35=${v.clearance}`
        : `#30=${v.holeDia} #31=${v.depth} #32=${v.peck} #33=${v.feed} #34=${v.clearance}`;
    const body = [`( ${method} ${PATTERN_LABEL[pattern]} — needs the ${call} sub installed )`, wv, loopBody(pattern, v, call)].join('\n');
    const name = method === 'bore' ? `Bore — ${PATTERN_LABEL[pattern]}` : `Drill — ${PATTERN_LABEL[pattern]}`;
    return { name, fields, body };
}

export { mirrorVar };   // re-export for callers that show the #11xx→#2600 mapping
