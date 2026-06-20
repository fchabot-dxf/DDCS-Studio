/**
 * data/opToSlot.js — generate a CAM-slot starting point from a Studio op (drill/bore × pattern).
 *
 * This is the wizard→CAM bridge ("Add from op"): instead of hand-entering form fields, pick an op + pattern
 * and get a filled slot — form fields (label/units/default/min/max/var) + a small, EDITABLE macro body that
 * reads the #2600 mirrors and cuts each hole inline. The author then tweaks.
 *
 * Per the project priority (friendliness/customization first): one small SELF-CONTAINED per-slot loop per
 * pattern, with the per-hole cut inlined — no shared sub to install, no monolithic dispatcher. DDCS has no
 * named M-codes (M-codes are numeric: M15 → O10015), so a "sub" would be a numeric O-program the operator must
 * install separately — fragile and easy to forget; inlining keeps every slot runnable on its own.
 * See the cam-menu-architecture memory + docs/CAM-MENU-RESEARCH.md.
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
    ax: { label: 'A — X', units: 'mm', def: 0, min: -99999, max: 99999, type: 1 },
    ay: { label: 'A — Y', units: 'mm', def: 0, min: -99999, max: 99999, type: 1 },
    bx: { label: 'B — X', units: 'mm', def: 60, min: -99999, max: 99999, type: 1 },
    by: { label: 'B — Y', units: 'mm', def: 0, min: -99999, max: 99999, type: 1 },
    stepdown: { label: 'Stepdown', units: 'mm', def: 1.5, min: 0.1, max: 9999, type: 1 },
};

// Standalone ops (not point-patterns) — each: the form fields it exposes + a parametric body builder(v).
const STANDALONE = {
    slot: {
        label: 'Slot',
        fields: ['ax', 'ay', 'bx', 'by', 'depth', 'stepdown', 'feed', 'clearance'],
        body: (v) => ['( slot A->B centerline, stepping down. For width > tool, add perpendicular offset passes. )',
            '#50=0',
            `WHILE #50 LT ${v.depth} DO1`,
            `  #50=#50+${v.stepdown}`,
            `  IF #50 GT ${v.depth} THEN #50=${v.depth}`,
            `  G0 X${v.ax} Y${v.ay}`,
            `  G1 Z[-#50] F${v.feed}`,
            `  G1 X${v.bx} Y${v.by} F${v.feed}`,
            `  G0 Z${v.clearance}`,
            'END1'].join('\n'),
    },
};

const PATTERN_FIELDS = { circle: ['dia', 'count', 'startAngle'], grid: ['cols', 'rows', 'dx', 'dy'], line: ['count', 'spacing', 'angle'], rect: ['w', 'h', 'nx', 'ny'] };
const HOLE_FIELDS = { drill: ['holeDia', 'depth', 'peck'], bore: ['holeDia', 'toolDia', 'depth', 'pitch'] };
const PATTERN_LABEL = { circle: 'bolt circle', grid: 'grid', line: 'line', rect: 'rectangle' };

/** The inline per-hole cut at the CURRENT X/Y — no named sub (DDCS has no named M-codes). `doN` is the DO/END
 *  number for the cut's own inner loop; it must be deeper than the surrounding pattern loop's nesting (the cut
 *  sits inside DO1 → use DO2, inside DO2 → use DO3). Uses scratch #40/#41 only (volatile, never persisted). */
function cutLines(method, v, doN) {
    if (method === 'bore') {
        // Ring-step: plunge in Z (G1) then a planar full-circle G3 at that depth — no helical G3. holeDia >= toolDia.
        return ['( bore one hole at current X/Y — ring-step down, no helical G3. Assumes hole Ø >= tool Ø. )',
            `#40=[${v.holeDia}-${v.toolDia}]/2   ;cut radius`, '#41=0',
            `G90 G0 Z${v.clearance}`, 'G91 G0 X#40 Y0   ;out to cut radius (relative to centre)',
            `WHILE #41 LT ${v.depth} DO${doN}`, `  #41=#41+${v.pitch}`, `  IF #41 GT ${v.depth} THEN #41=${v.depth}`,
            `  G90 G1 Z[-#41] F${v.feed}`, `  G91 G3 X0 Y0 I[-#40] J0 F${v.feed}   ;full circle`, `END${doN}`,
            `G90 G0 Z${v.clearance}`, 'G91 G0 X[-#40] Y0   ;back to centre', 'G90'];
    }
    return ['( peck-drill one hole at current X/Y — full retract each peck to clear chips )',
        '#41=0', `G90 G0 Z${v.clearance}`,
        `WHILE #41 LT ${v.depth} DO${doN}`, `  #41=#41+${v.peck}`, `  IF #41 GT ${v.depth} THEN #41=${v.depth}`,
        `  G1 Z[-#41] F${v.feed}`, `  G0 Z${v.clearance}   ;full retract to clear chips`, `END${doN}`];
}

const indent = (lines, pad) => lines.map((l) => pad + l);

/** The pattern loop body (uses the var map; positions each point + inlines the per-hole cut). */
function loopBody(pattern, v, method) {
    if (pattern === 'circle') {
        return ['#50=0', `WHILE #50 LT ${v.count} DO1`, `  #51=${v.startAngle}+#50*360/${v.count}`,
            `  G0 X[${v.posX}+[${v.dia}/2]*COS[#51]] Y[${v.posY}+[${v.dia}/2]*SIN[#51]]`,
            ...indent(cutLines(method, v, 2), '  '), '  #50=#50+1', 'END1'].join('\n');
    }
    if (pattern === 'line') {
        return ['#50=0', `WHILE #50 LT ${v.count} DO1`,
            `  G0 X[${v.posX}+#50*${v.spacing}*COS[${v.angle}]] Y[${v.posY}+#50*${v.spacing}*SIN[${v.angle}]]`,
            ...indent(cutLines(method, v, 2), '  '), '  #50=#50+1', 'END1'].join('\n');
    }
    if (pattern === 'grid') {
        return ['#52=0', `WHILE #52 LT ${v.rows} DO1`, '  #50=0', `  WHILE #50 LT ${v.cols} DO2`,
            `    G0 X[${v.posX}+#50*${v.dx}] Y[${v.posY}+#52*${v.dy}]`,
            ...indent(cutLines(method, v, 3), '    '), '    #50=#50+1', '  END2', '  #52=#52+1', 'END1'].join('\n');
    }
    // rect perimeter: top+bottom rows (nx each), then interior left+right columns (ny, skip shared corners)
    return ['#50=0', `WHILE #50 LT ${v.nx} DO1`, `  #53=${v.posX}+${v.w}*#50/[${v.nx}-1]`,
        `  G0 X#53 Y${v.posY}`, ...indent(cutLines(method, v, 2), '  '),
        `  G0 X#53 Y[${v.posY}+${v.h}]`, ...indent(cutLines(method, v, 2), '  '), '  #50=#50+1', 'END1',
        '#52=1', `WHILE #52 LT [${v.ny}-1] DO1`, `  #54=${v.posY}+${v.h}*#52/[${v.ny}-1]`,
        `  G0 X${v.posX} Y#54`, ...indent(cutLines(method, v, 2), '  '),
        `  G0 X[${v.posX}+${v.w}] Y#54`, ...indent(cutLines(method, v, 2), '  '), '  #52=#52+1', 'END1'].join('\n');
}

/**
 * Build a slot starting point. method 'drill'|'bore', pattern 'circle'|'grid'|'line'|'rect'.
 * `used` = Set of #11xx already taken in the pack (for collision-free allocation).
 * Returns { name, fields:[{idx,label,units,def,min,max,type,var}], body }  — plugs straight into camPack.
 */
export function slotFromOp(method, pattern, used = new Set(), varOffset = 0) {
    const std = STANDALONE[method];
    const order = std ? std.fields : ['posX', 'posY', ...PATTERN_FIELDS[pattern], ...HOLE_FIELDS[method], 'feed', 'clearance'];
    const taken = new Set(used);
    const fields = order.map((key, i) => {
        const idx = nextParam(taken); if (idx != null) taken.add(idx);
        const s = SPEC[key];
        // Bore needs hole Ø > tool Ø (else the cut radius is 0); drill bores at tool Ø.
        const def = key === 'holeDia' ? (method === 'bore' ? 12 : 6) : s.def;
        return { key, idx, var: '#' + (varOffset + i + 1), label: s.label, units: s.units, def, min: s.min, max: s.max, type: s.type };
    });
    const v = {}; fields.forEach((f) => { v[f.key] = f.var; });
    if (std) {   // standalone op (slot/pocket/surfacing) — no pattern, no shared sub
        const reads = fields.map((f) => `${f.var}=#${f.idx + 1500}   ;${f.label}${f.units ? ' [' + f.units + ']' : ''} =${f.def} [${f.min}~${f.max}]`);
        const body = [`( ${std.label} )`, ...reads, '', std.body(v)].join('\n');
        return { name: std.label, fields, body };
    }
    // The body IS the scannable macro: structured mirror-read header (so "Refresh fields" can re-derive the
    // form) + the pattern loop with the per-hole cut inlined. All scratch vars (#1-#54) are < #500 = safe/volatile.
    const reads = fields.map((f) => `${f.var}=#${f.idx + 1500}   ;${f.label}${f.units ? ' [' + f.units + ']' : ''} =${f.def} [${f.min}~${f.max}]`);
    const body = [`( ${method} ${PATTERN_LABEL[pattern]} — self-contained, no sub to install )`, ...reads, '', loopBody(pattern, v, method)].join('\n');
    const name = method === 'bore' ? `Bore — ${PATTERN_LABEL[pattern]}` : `Drill — ${PATTERN_LABEL[pattern]}`;
    return { name, fields, body };
}

export { mirrorVar };   // re-export for callers that show the #11xx→#2600 mapping
