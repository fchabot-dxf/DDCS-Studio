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
import { PROBE, wcsBase, writeAxis, twoPassProbe, probeSave } from './camMacroKit.js';

// Probe port + trigger level are MACHINE-CONSTANT config, so the macros read them from the controller's
// floating-probe params (Pr578→#1078 port, Pr580→#1080 level) instead of charging a form row for each — the
// "machine-portable probe config" technique (CAM-MENU-RESEARCH §6, proven in Brad Goldbeck's cam13). The
// operator sets the probe once in the controller's probe settings; every probe slot inherits it.
const PORT = '#1078', LEVEL = '#1080';

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
    // port (P) + level (L) come from the controller's floating-probe config (#1078/#1080), not form rows
];

/** Allocate #11xx params + #-vars for a field list. Returns {fields, v} where v maps key → its #var. */
export function allocFields(spec, used, varOffset) {
    const taken = new Set(used);
    const fields = spec.map((s, i) => {
        const idx = nextParam(taken); if (idx != null) taken.add(idx);
        return { key: s.key, idx, var: '#' + (varOffset + i + 1), label: s.label, units: s.units, def: s.def, min: s.min, max: s.max, type: s.type };
    });
    const v = {}; fields.forEach((f) => { v[f.key] = f.var; });
    return { fields, v };
}

export const readLine = (f) => `${f.var}=#${f.idx + 1500}   ;${f.label}${f.units ? ' [' + f.units + ']' : ''} =${f.def} [${f.min}~${f.max}]`;

/**
 * Build the "Probe outside corner" CAM slot. One branching macro: #corner→signs, #wcs→base address,
 * #probeZ→optional Z surface, #seq→wall order. Returns { name, fields, body } (plugs into camPack).
 */
export function cornerSlot(used = new Set(), varOffset = 0) {
    const { fields, v } = allocFields(CORNER_FIELDS, used, varOffset);

    // One wall: fast touch → check → retract → slow touch → check → radius-comp → WCS write → back off + lift.
    // sgn = ±1 sign var for this axis; the wall is at trigger + sgn*radius (outside/boss corner).
    const wall = (ax) => {
        const tgt = ax === 'X' ? '#93' : '#94';      // signed probe target
        const ret = ax === 'X' ? '#95' : '#96';      // signed retract (away from wall)
        const sgn = ax === 'X' ? '#90' : '#91';
        const comp = ax === 'X' ? '#102' : '#101';
        return [
            ...twoPassProbe(ax, { tgt, ret, fast: v.fast, slow: v.slow, port: PORT, level: LEVEL }),
            `${comp}=[${PROBE[ax].result}+${sgn}*${v.radius}]   ;trigger + sign*radius`,
            ...writeAxis(ax === 'X' ? 0 : 1, comp, 'write WCS ' + ax),
            `G0 ${ax}${ret}   ;back off the wall`, `G0 Z#92   ;lift to safe Z`,
        ];
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
        ...wcsBase(v.wcs),
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
        ...twoPassProbe('Z', { tgt: '#97', ret: v.retract, fast: v.fast, slow: v.slow, port: PORT, level: LEVEL }),
        ...writeAxis(2, '#1927', 'write WCS Z = trigger (machine coord)'),
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

const ZPROBE_FIELDS = [
    { key: 'wcs', label: 'WCS (0act 1-6 G54-G59)', units: '', def: 0, min: 0, max: 6, type: 0 },
    { key: 'maxProbe', label: 'Max probe down', units: 'mm', def: 50, min: 1, max: 9999, type: 1 },
    { key: 'retract', label: 'Retract', units: 'mm', def: 2, min: 0.1, max: 999, type: 1 },
    { key: 'safeZ', label: 'Safe Z lift', units: 'mm', def: 10, min: 0.1, max: 999, type: 1 },
    { key: 'surfaceZ', label: 'Surface = Z', units: 'mm', def: 0, min: -9999, max: 9999, type: 1 },
    { key: 'fast', label: 'Fast feed', units: 'mm/min', def: 200, min: 1, max: 9999, type: 0 },
    { key: 'slow', label: 'Slow feed', units: 'mm/min', def: 50, min: 1, max: 9999, type: 0 },
    // port (P) + level (L) come from the controller's floating-probe config (#1078/#1080), not form rows
];

/**
 * Build the "Probe Z surface" CAM slot — touch Z down to a surface (part top or a setter block) and set the
 * WCS Z datum. Two-pass G31 down; WCS Z = trigger − (trigger − surfaceZ), i.e. the touched point reads as the
 * `Surface = Z` value (default 0 → touch is Z0). Position the probe over the surface, press Enter.
 */
export function probeZSlot(used = new Set(), varOffset = 0) {
    const { fields, v } = allocFields(ZPROBE_FIELDS, used, varOffset);
    const body = [
        '( Probe Z down to a surface → set the WCS Z datum. Position the probe over the surface, press Enter. )',
        ...fields.map(readLine),
        '',
        '( WCS base address — 0 = read the active WCS from #578 )',
        ...wcsBase(v.wcs),
        '',
        `#93=[0-${v.maxProbe}]   ;Z probe target (down)`,
        `#95=${v.retract}   ;Z retract (up)`,
        '',
        `#1505=1   ;Position the probe over the surface, press Enter`,
        'G91   ( incremental )',
        ...twoPassProbe('Z', { tgt: '#93', ret: '#95', fast: v.fast, slow: v.slow, port: PORT, level: LEVEL }),
        `#50=[${PROBE.Z.result}-${v.surfaceZ}]   ;WCS Z offset so the touch reads as Surface = Z`,
        ...writeAxis(2, '#50', 'write WCS Z'),
        `G0 Z${v.safeZ}   ;lift clear`,
        'G90   ( absolute )',
        '#1505=-5000   ;Z datum set',
        'GOTO 2',
        '( error handler )',
        'N1',
        'G90',
        '#1505=1   ;ERROR: probe did not trigger',
        'N2',
        'M30',
    ].join('\n');
    return { name: 'Probe Z surface', fields, body };
}

const EDGE_FIELDS = [
    { key: 'axis', label: 'Axis (0X 1Y)', units: '', def: 0, min: 0, max: 1, type: 0 },
    { key: 'dir', label: 'Direction (0pos 1neg)', units: '', def: 0, min: 0, max: 1, type: 0 },
    { key: 'wcs', label: 'WCS (0act 1-6 G54-G59)', units: '', def: 0, min: 0, max: 6, type: 0 },
    { key: 'maxProbe', label: 'Max probe', units: 'mm', def: 100, min: 1, max: 9999, type: 1 },
    { key: 'retract', label: 'Retract', units: 'mm', def: 5, min: 0.1, max: 999, type: 1 },
    { key: 'radius', label: 'Stylus radius', units: 'mm', def: 2, min: 0.001, max: 99, type: 1 },
    { key: 'fast', label: 'Fast feed', units: 'mm/min', def: 200, min: 1, max: 9999, type: 0 },
    { key: 'slow', label: 'Slow feed', units: 'mm/min', def: 50, min: 1, max: 9999, type: 0 },
    // port (P) + level (L) come from the controller's floating-probe config (#1078/#1080), not form rows
];

/**
 * Build the "Probe edge" CAM slot — probe ONE wall on the chosen axis/direction, set that WCS axis to the
 * edge (trigger + sign*radius). #axis branches X/Y (the G31 letter is fixed), #dir is a sign var. No Z motion
 * (probes at the current height) — position the tool clear of the wall at probing depth, press Enter.
 */
export function edgeSlot(used = new Set(), varOffset = 0) {
    const { fields, v } = allocFields(EDGE_FIELDS, used, varOffset);
    const wallProbe = (ax) => [
        ...twoPassProbe(ax, { tgt: '#93', ret: '#95', fast: v.fast, slow: v.slow, port: PORT, level: LEVEL }),
        `#50=[${PROBE[ax].result}+#90*${v.radius}]   ;edge = trigger + sign*radius`,
        ...writeAxis(ax === 'X' ? 0 : 1, '#50', 'write WCS ' + ax),
        `G0 ${ax}#95   ;back off the wall`,
    ];
    const body = [
        '( Probe ONE edge → set one WCS axis. Position clear of the wall at probe depth, press Enter. )',
        ...fields.map(readLine),
        '',
        `( direction sign: 0=pos → +1, 1=neg → -1 )`,
        '#90=1',
        `IF ${v.dir} EQ 1 THEN #90=0-1`,
        '',
        '( WCS base address — 0 = read the active WCS from #578 )',
        ...wcsBase(v.wcs),
        '',
        `#93=[#90*${v.maxProbe}]   ;signed probe target`,
        `#95=[[0-#90]*${v.retract}]   ;signed retract (away from wall)`,
        '',
        `#1505=1   ;Position clear of the wall at probe depth, press Enter`,
        'G91   ( incremental )',
        '',
        `IF ${v.axis} EQ 1 GOTO 20`,
        '( X edge )',
        ...wallProbe('X'),
        'GOTO 30',
        'N20',
        '( Y edge )',
        ...wallProbe('Y'),
        'N30',
        '',
        'G90   ( absolute )',
        '#1505=-5000   ;edge found',
        'GOTO 2',
        '( error handler )',
        'N1',
        'G90',
        '#1505=1   ;ERROR: probe did not trigger',
        'N2',
        'M30',
    ].join('\n');
    return { name: 'Probe edge', fields, body };
}

const INSIDE_FIELDS = [
    { key: 'wcs', label: 'WCS (0act 1-6 G54-G59)', units: '', def: 0, min: 0, max: 6, type: 0 },
    { key: 'maxProbe', label: 'Max probe', units: 'mm', def: 25, min: 1, max: 9999, type: 1 },
    { key: 'retract', label: 'Retract', units: 'mm', def: 2, min: 0.1, max: 999, type: 1 },
    { key: 'safeZ', label: 'Safe Z lift', units: 'mm', def: 10, min: 0.1, max: 999, type: 1 },
    { key: 'fast', label: 'Fast feed', units: 'mm/min', def: 200, min: 1, max: 9999, type: 0 },
    { key: 'slow', label: 'Slow feed', units: 'mm/min', def: 50, min: 1, max: 9999, type: 0 },
    // port (P) + level (L) come from the controller's floating-probe config (#1078/#1080), not form rows
];

/**
 * Build the "Probe inside centre" CAM slot — works for a rectangular POCKET or a round BORE. Probe ±X to find
 * the X centre, re-centre X (G53) so the Y touch is a true diameter (essential for a circle, harmless for a
 * rectangle — parallel walls), probe ±Y, write centre to WCS X/Y. Reports X/Y span (= diameters for a bore,
 * width/height for a pocket) and roundness. No radius comp needed — the midpoint cancels the stylus radius.
 * Position the probe INSIDE the feature at probe depth, press Enter. Ported from circularStack (bore). Inside
 * only: the tool crosses the open cavity. (Outside/boss needs operator repositions — a separate slot.)
 */
export function insideCentreSlot(used = new Set(), varOffset = 0) {
    const { fields, v } = allocFields(INSIDE_FIELDS, used, varOffset);
    // Two-pass probe (fast→slow) in one direction, saving the trigger; retract after each pass.
    const twoPass = (ax, tgt, ret, into) =>
        probeSave(ax, { tgt, ret, into, fast: v.fast, slow: v.slow, port: PORT, level: LEVEL });
    const body = [
        '( Probe INSIDE centre — rect pocket OR round bore. Position the probe INSIDE the feature at depth, press Enter. )',
        ...fields.map(readLine),
        '',
        '( WCS base address — 0 = read the active WCS from #578 )',
        ...wcsBase(v.wcs),
        '',
        `#90=${v.maxProbe}   ;+max probe`,
        `#91=[0-${v.maxProbe}]   ;-max probe`,
        `#92=${v.retract}   ;+retract`,
        `#93=[0-${v.retract}]   ;-retract`,
        '',
        `#1505=1   ;Position the probe INSIDE the feature at depth, press Enter`,
        'G91   ( incremental )',
        '',
        '( X axis: probe both walls across the cavity → X centre )',
        ...twoPass('X', '#90', '#93', '#51'),
        ...twoPass('X', '#91', '#92', '#52'),
        '#53=[[#51+#52]/2]   ;X centre (machine coord)',
        '( re-centre X so the Y touch is a true diameter, not a chord )',
        'G53 X#53',
        'G91   ( incremental )',
        '',
        '( Y axis: probe both walls at the X centre → Y centre )',
        ...twoPass('Y', '#90', '#93', '#54'),
        ...twoPass('Y', '#91', '#92', '#55'),
        '#56=[[#54+#55]/2]   ;Y centre (machine coord)',
        '',
        '( spans: diameters for a bore, width/height for a pocket )',
        '#58=[#51-#52]   ;X span',
        '#59=[#54-#55]   ;Y span',
        '#61=[#58-#59]   ;roundness (X span - Y span)',
        '',
        `G0 Z${v.safeZ}   ;lift clear`,
        ...writeAxis(0, '#53', 'write WCS X centre'),
        ...writeAxis(1, '#56', 'write WCS Y centre'),
        '',
        'G90   ( absolute )',
        '#1505=-5000   ;centre found',
        'GOTO 2',
        '( error handler )',
        'N1',
        'G91',
        `G0 Z${v.safeZ}   ;lift clear`,
        'G90',
        '#1505=1   ;ERROR: probe did not trigger',
        'N2',
        'M30',
    ].join('\n');
    return { name: 'Probe inside centre', fields, body };
}

const BOSS_FIELDS = [
    { key: 'wcs', label: 'WCS (0act 1-6 G54-G59)', units: '', def: 0, min: 0, max: 6, type: 0 },
    { key: 'maxProbe', label: 'Max probe', units: 'mm', def: 50, min: 1, max: 9999, type: 1 },
    { key: 'retract', label: 'Retract', units: 'mm', def: 2, min: 0.1, max: 999, type: 1 },
    { key: 'safeZ', label: 'Safe Z lift', units: 'mm', def: 15, min: 0.1, max: 999, type: 1 },
    { key: 'fast', label: 'Fast feed', units: 'mm/min', def: 200, min: 1, max: 9999, type: 0 },
    { key: 'slow', label: 'Slow feed', units: 'mm/min', def: 50, min: 1, max: 9999, type: 0 },
    // port (P) + level (L) come from the controller's floating-probe config (#1078/#1080), not form rows
];

/**
 * Build the "Probe boss centre" CAM slot — find the centre of an OUTSIDE feature (post/boss). Probe each of
 * the 4 faces FROM OUTSIDE; because the tool can't cross a solid boss, the operator must move AROUND it — so
 * the macro PAUSES with a reposition prompt (#1505) between faces, saving/restoring probe-height Z via the Z
 * DRO (#882) + G53, and re-centres X at safe Z before the Y faces (never cross the boss at depth). Writes the
 * centre to WCS X/Y; reports span/roundness. Ported from circularStack (boss).
 */
export function bossCentreSlot(used = new Set(), varOffset = 0) {
    const { fields, v } = allocFields(BOSS_FIELDS, used, varOffset);
    // Two-pass probe of one face: approach (tgt), retract (ret = away from the face), save trigger.
    const face = (ax, tgt, ret, into) =>
        probeSave(ax, { tgt, ret, into, fast: v.fast, slow: v.slow, port: PORT, level: LEVEL });
    // Save probe-height Z, lift clear, optional re-centre, PAUSE for the operator to move around, return to Z.
    const reposition = (msg, recentreAx, recentreVal) => {
        const L = ['#57=#882   ;save probe-height Z (machine DRO)', `G0 Z${v.safeZ}   ;lift clear of the boss`];
        if (recentreAx) L.push(`G53 ${recentreAx}${recentreVal}   ;re-centre at safe Z (never cross the boss at depth)`);
        L.push(`#1505=1   ;REPOSITION: ${msg}, then press Enter`, 'IF #1505 EQ 0 GOTO 2', 'G53 Z#57   ;back to probe height', 'G91   ( incremental )');
        return L;
    };
    const body = [
        '( Probe BOSS / outside centre. Position clear of the +X face at probe depth, press Enter. You will be prompted to move around between faces. )',
        ...fields.map(readLine),
        '',
        '( WCS base address — 0 = read the active WCS from #578 )',
        ...wcsBase(v.wcs),
        '',
        `#90=${v.maxProbe}   ;+max probe`,
        `#91=[0-${v.maxProbe}]   ;-max probe`,
        `#92=${v.retract}   ;+retract`,
        `#93=[0-${v.retract}]   ;-retract`,
        '',
        `#1505=1   ;Position clear of the +X face at probe depth, press Enter`,
        'IF #1505 EQ 0 GOTO 2',
        'G91   ( incremental )',
        '',
        '( +X face: approach from +X, probe -X )',
        ...face('X', '#91', '#92', '#51'),
        ...reposition('move clear, around to the -X side of the boss'),
        '( -X face: approach from -X, probe +X )',
        ...face('X', '#90', '#93', '#52'),
        '#53=[[#51+#52]/2]   ;X centre (machine coord)',
        ...reposition('move clear, around to the +Y side of the boss', 'X', '#53'),
        '( +Y face: approach from +Y, probe -Y )',
        ...face('Y', '#91', '#92', '#54'),
        ...reposition('move clear, around to the -Y side of the boss'),
        '( -Y face: approach from -Y, probe +Y )',
        ...face('Y', '#90', '#93', '#55'),
        '#56=[[#54+#55]/2]   ;Y centre (machine coord)',
        '',
        '( spans: diameters for a round boss, width/height for a rectangular boss )',
        '#58=[#51-#52]   ;X span',
        '#59=[#54-#55]   ;Y span',
        '#61=[#58-#59]   ;roundness (X span - Y span)',
        '',
        `G0 Z${v.safeZ}   ;lift clear`,
        ...writeAxis(0, '#53', 'write WCS X centre'),
        ...writeAxis(1, '#56', 'write WCS Y centre'),
        '',
        'G90   ( absolute )',
        '#1505=-5000   ;boss centre found',
        'GOTO 2',
        '( error handler )',
        'N1',
        'G91',
        `G0 Z${v.safeZ}   ;lift clear`,
        'G90',
        '#1505=1   ;ERROR: probe did not trigger',
        'N2',
        'M30',
    ].join('\n');
    return { name: 'Probe boss centre', fields, body };
}

const ALIGN_FIELDS = [
    { key: 'checkAxis', label: 'Fence along (0X 1Y)', units: '', def: 0, min: 0, max: 1, type: 0 },
    { key: 'dir', label: 'Probe dir (0pos 1neg)', units: '', def: 0, min: 0, max: 1, type: 0 },
    { key: 'maxProbe', label: 'Max probe', units: 'mm', def: 20, min: 1, max: 9999, type: 1 },
    { key: 'retract', label: 'Retract', units: 'mm', def: 2, min: 0.1, max: 999, type: 1 },
    { key: 'safeZ', label: 'Safe Z lift', units: 'mm', def: 10, min: 0.1, max: 999, type: 1 },
    { key: 'fast', label: 'Fast feed', units: 'mm/min', def: 200, min: 1, max: 9999, type: 0 },
    { key: 'slow', label: 'Slow feed', units: 'mm/min', def: 20, min: 1, max: 9999, type: 0 },
    // port (P) + level (L) come from the controller's floating-probe config (#1078/#1080), not form rows
];

/**
 * Build the "Probe alignment" CAM slot — measure a fence's angular misalignment. Probe the fence at point A,
 * the operator jogs along it to point B, probe again; angle = atan2(Δcontact, span) in degrees. Reports to the
 * #1510-1512 popups; it does NOT write a WCS. #checkAxis (0=fence along X→probe Y, 1=fence along Y→probe X)
 * branches the probe axis + the DRO read (#880 X / #881 Y); #dir is a sign var. Ported from alignmentStack.
 */
export function alignmentSlot(used = new Set(), varOffset = 0) {
    const { fields, v } = allocFields(ALIGN_FIELDS, used, varOffset);
    // One point: confirm prompt → read the check-axis DRO → two-pass probe of the perpendicular fence face.
    const point = (probeAx, machVar, into, prompt, descend) => {
        const L = [`#1505=1   ;${prompt}`, `${into === '#50' ? '#70' : '#71'}=${machVar}   ;check-axis machine coord`];
        if (into === '#51') L.push('#72=[#71-#70]   ;span = B - A along the fence');
        L.push('G91   ( incremental )');
        if (descend) L.push(`G0 Z[0-${v.safeZ}]   ;descend to probe height`);
        L.push(...probeSave(probeAx, { tgt: '#93', ret: '#95', into, fast: v.fast, slow: v.slow, port: PORT, level: LEVEL }));
        if (!descend) L.push(`G0 Z${v.safeZ}   ;lift to clear for the jog`);
        L.push('G90   ( absolute )');
        return L;
    };
    const path = (probeAx, machVar) => [
        ...point(probeAx, machVar, '#50', 'Position the probe at point A on the fence, press Enter', false),
        ...point(probeAx, machVar, '#51', 'Jog along the fence to point B (same Y/Z), press Enter', true),
    ];
    const body = [
        '( Probe ALIGNMENT — measure a fence angle. Probe A, jog to B along the fence, probe again. )',
        ...fields.map(readLine),
        '',
        '( probe direction sign: 0=pos → +1, 1=neg → -1 )',
        '#90=1',
        `IF ${v.dir} EQ 1 THEN #90=0-1`,
        `#93=[#90*${v.maxProbe}]   ;signed probe target`,
        `#95=[[0-#90]*${v.retract}]   ;signed retract`,
        '',
        `IF ${v.checkAxis} EQ 1 GOTO 20`,
        '( fence along X → probe Y, read X DRO #880 )',
        ...path('Y', '#880'),
        'GOTO 30',
        'N20',
        '( fence along Y → probe X, read Y DRO #881 )',
        ...path('X', '#881'),
        'N30',
        '',
        '( compute misalignment )',
        '#52=[#51-#50]   ;delta: fence wander A→B',
        '#53=ABS[#72]   ;absolute span',
        'IF #53 EQ 0 GOTO 1',
        '#54=ATAN[#52]/[#53]   ;angle (deg) = atan2(delta, span)',
        `G0 Z${v.safeZ}`,
        'G90   ( absolute )',
        '#1510=#52   ;drift',
        '#1511=#53   ;span',
        '#1512=#54   ;angle (deg)',
        '#1505=-5000   ;Drift=#1510 Span=#1511 Angle=#1512 deg',
        'GOTO 2',
        '( error handler )',
        'N1',
        'G90',
        '#1505=1   ;ERROR: probe did not trigger or zero span',
        'N2',
        'M30',
    ].join('\n');
    return { name: 'Probe alignment', fields, body };
}
