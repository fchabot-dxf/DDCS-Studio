/**
 * data/probeToSlot.js — generate a CAM-slot starting point from a PROBE op (Expert-only).
 *
 * Unlike drill/bore (a point pattern), a probe slot is one self-positioning sequence that sets the WCS. The
 * discrete choices the operator wants to change AT THE MACHINE (which corner, which WCS, Z-first, wall order)
 * can't be dropdowns on the DDCS CAM form — it only has numeric fields — so the macro reads them as #-fields
 * and BRANCHES (IF…THEN / IF…GOTO). The 4 corners collapse to two sign vars (#90 X, #91 Y), so corner switching
 * is 4 IF…THEN lines, not 4 separate slots.
 *
 * The probe logic itself (two-pass G31 fast→slow, status check #1920+ax !=2, radius comp, indirect WCS write to
 * #[805+(wcs-1)*5+ax] — G10 L2/L20 is broken on M350) is ported verbatim from the proven corner wizard
 * (wizards/cornerWizard.js) — the ground truth. See the cam-menu-architecture + ddcs-ground-truth memories.
 *
 * Scratch use: fields via their assigned vars; calc in #70/#71/#73 (WCS), #90–#99 (signs/targets), #101/#102
 * (radius-comp temps) — clear of drill/bore's #30–#54 so a probe can share a slot if ever appended.
 */
import { nextParam } from './camPack.js';

// Probe form fields, in display + #-var order. type 1 = decimal, 0 = integer. Legends use ( ) not [ ]/=
// so the mirror-read comment stays parseable by fieldsFromMacro ("Refresh fields").
const CORNER_FIELDS = [
    { key: 'corner', label: 'Corner (1FL 2FR 3BL 4BR)', units: '', def: 1, min: 1, max: 4, type: 0 },
    { key: 'wcs', label: 'WCS (0act 1-6 G54-G59)', units: '', def: 0, min: 0, max: 6, type: 0 },
    { key: 'probeZ', label: 'Probe Z first (0no 1yes)', units: '', def: 0, min: 0, max: 1, type: 0 },
    { key: 'seq', label: 'Wall order (0 YX 1 XY)', units: '', def: 0, min: 0, max: 1, type: 0 },
    { key: 'maxProbe', label: 'Max probe', units: 'mm', def: 100, min: 1, max: 9999, type: 1 },
    { key: 'retract', label: 'Retract', units: 'mm', def: 5, min: 0.1, max: 999, type: 1 },
    { key: 'radius', label: 'Stylus radius', units: 'mm', def: 2, min: 0.001, max: 99, type: 1 },
    { key: 'safeZ', label: 'Safe Z', units: 'mm', def: 10, min: 0.1, max: 999, type: 1 },
    { key: 'travel', label: 'Travel', units: 'mm', def: 50, min: 0, max: 9999, type: 1 },
    { key: 'scan', label: 'Scan depth', units: 'mm', def: 5, min: 0.1, max: 999, type: 1 },
    { key: 'fast', label: 'Fast feed', units: 'mm/min', def: 200, min: 1, max: 9999, type: 0 },
    { key: 'slow', label: 'Slow feed', units: 'mm/min', def: 50, min: 1, max: 9999, type: 0 },
    { key: 'port', label: 'Probe port P', units: '', def: 3, min: 0, max: 99, type: 0 },
    { key: 'level', label: 'Trigger level L (0 1)', units: '', def: 0, min: 0, max: 1, type: 0 },
];

/** Allocate #11xx params + #-vars for a field list. Returns {fields, v} where v maps key → its #var. */
function allocFields(spec, used, varOffset) {
    const taken = new Set(used);
    const fields = spec.map((s, i) => {
        const idx = nextParam(taken); if (idx != null) taken.add(idx);
        return { key: s.key, idx, var: '#' + (varOffset + i + 1), label: s.label, units: s.units, def: s.def, min: s.min, max: s.max, type: s.type };
    });
    const v = {}; fields.forEach((f) => { v[f.key] = f.var; });
    return { fields, v };
}

const readLine = (f) => `${f.var}=#${f.idx + 1500}   ;${f.label}${f.units ? ' [' + f.units + ']' : ''} =${f.def} [${f.min}~${f.max}]`;

/**
 * Build the "Probe outside corner" CAM slot. One branching macro: #corner→signs, #wcs→base address,
 * #probeZ→optional Z surface, #seq→wall order. Returns { name, fields, body } (plugs into camPack).
 */
export function cornerSlot(used = new Set(), varOffset = 0) {
    const { fields, v } = allocFields(CORNER_FIELDS, used, varOffset);

    // One wall: fast touch → check → retract → slow touch → check → radius-comp → WCS write → back off + lift.
    // sgn = ±1 sign var for this axis; the wall is at trigger + sgn*radius (outside/boss corner).
    const wall = (ax) => {
        const st = ax === 'X' ? '#1920' : '#1921';   // probe status (2 = success)
        const res = ax === 'X' ? '#1925' : '#1926';  // trigger position (machine coord)
        const tgt = ax === 'X' ? '#93' : '#94';      // signed probe target
        const ret = ax === 'X' ? '#95' : '#96';      // signed retract (away from wall)
        const sgn = ax === 'X' ? '#90' : '#91';
        const L = [
            `G31 ${ax}${tgt} F${v.fast} P${v.port} L${v.level} Q1`,
            `IF ${st}!=2 GOTO 1`,
            `G0 ${ax}${ret}`,
            `G31 ${ax}${tgt} F${v.slow} P${v.port} L${v.level} Q1`,
            `IF ${st}!=2 GOTO 1`,
        ];
        if (ax === 'X') {
            L.push(`#102=[${res}+${sgn}*${v.radius}]   ;trigger + sign*radius`, `#[#70]=#102   ;write WCS X`);
        } else {
            L.push(`#101=[${res}+${sgn}*${v.radius}]   ;trigger + sign*radius`, `#73=[#70+1]`, `#[#73]=#101   ;write WCS Y`);
        }
        L.push(`G0 ${ax}${ret}   ;back off the wall`, `G0 Z#92   ;lift to safe Z`);
        return L;
    };

    // Reposition between walls: move ALONG the just-probed wall (own dir) + AROUND to the next (opposite dir).
    // own = +sign*travel, opp = -sign*travel.  (firstAx own, secondAx opp — matches the wizard's travelOwn/Opp.)
    const travel = (firstAx, firstSgn, secondAx, secondSgn) => [
        `G0 ${firstAx}[${firstSgn}*${v.travel}] ${secondAx}[0-${secondSgn}*${v.travel}]   ;travel past corner`,
        `G0 Z[0-#92]   ;plunge to scan depth`,
    ];

    // A seq path: optional escape off the corner (only when Z-first left us over the material), then
    // plunge + first wall, reposition, plunge + second wall.
    const path = (firstAx, firstSgn, secondAx, secondSgn, escLabel) => [
        `IF ${v.probeZ} EQ 0 GOTO ${escLabel}`,
        `G0 ${firstAx}[0-${firstSgn}*${v.travel}]   ;Z-first: step off the corner to reach the first wall`,
        `N${escLabel}`,
        `G0 Z[0-#92]   ;plunge to scan depth`,
        ...wall(firstAx),
        ...travel(firstAx, firstSgn, secondAx, secondSgn),
        ...wall(secondAx),
    ];

    const body = [
        '( Probe OUTSIDE corner — sets WCS X/Y (+ optional Z). Position over/near the corner, press Enter. )',
        ...fields.map(readLine),
        '',
        '( corner → X/Y sign:  FL=+ +   FR=- +   BL=+ -   BR=- - )',
        '#90=1',
        '#91=1',
        `IF ${v.corner} EQ 2 THEN #90=0-1`,
        `IF ${v.corner} EQ 4 THEN #90=0-1`,
        `IF ${v.corner} EQ 3 THEN #91=0-1`,
        `IF ${v.corner} EQ 4 THEN #91=0-1`,
        '',
        '( WCS base address — 0 = read the active WCS from #578 )',
        `#71=${v.wcs}`,
        `IF #71 EQ 0 THEN #71=#578`,
        '#70=[805+[#71-1]*5]',
        '',
        '( calculated motions )',
        `#92=[${v.safeZ}+${v.scan}]   ;plunge depth = safe Z + scan`,
        `#93=[#90*${v.maxProbe}]   ;X probe target (signed)`,
        `#94=[#91*${v.maxProbe}]   ;Y probe target (signed)`,
        `#95=[[0-#90]*${v.retract}]   ;X retract (away from wall)`,
        `#96=[[0-#91]*${v.retract}]   ;Y retract`,
        `#97=[0-${v.maxProbe}]   ;Z probe target (down)`,
        '',
        `#1505=1   ;Position over/near the chosen corner, then press Enter`,
        'G91   ( incremental — the macro positions itself at the corner )',
        '',
        '( optional Z surface probe )',
        `IF ${v.probeZ} EQ 0 GOTO 10`,
        `G31 Z#97 F${v.fast} P${v.port} L${v.level} Q1`,
        'IF #1922!=2 GOTO 1',
        `G0 Z${v.retract}`,
        `G31 Z#97 F${v.slow} P${v.port} L${v.level} Q1`,
        'IF #1922!=2 GOTO 1',
        '#73=[#70+2]',
        '#[#73]=#1927   ;write WCS Z = trigger (machine coord)',
        `G0 Z${v.safeZ}   ;lift to safe Z`,
        'N10',
        '',
        '( two walls, in the chosen order )',
        `IF ${v.seq} EQ 1 GOTO 20`,
        '( YX: Y wall first )',
        ...path('Y', '#91', 'X', '#90', 11),
        'GOTO 30',
        'N20',
        '( XY: X wall first )',
        ...path('X', '#90', 'Y', '#91', 21),
        'N30',
        '',
        'G90   ( absolute )',
        '#1505=-5000   ;corner found',
        'GOTO 2',
        '( error handler )',
        'N1',
        'G91',
        'G0 Z#92   ;lift clear',
        'G90',
        '#1505=1   ;ERROR: probe did not trigger',
        'N2',
        'M30',
    ].join('\n');

    return { name: 'Probe corner', fields, body };
}
