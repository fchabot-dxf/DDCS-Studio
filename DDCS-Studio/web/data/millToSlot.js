/**
 * data/millToSlot.js — generate a CAM-slot starting point from a MILL AREA op (pocket, surfacing).
 *
 * Unlike the wizard (which UNROLLS the toolpath into explicit moves for one fixed size), a CAM slot must be
 * PARAMETRIC: the operator changes the form values on the controller and the macro recomputes the passes with
 * loops. So this is not a verbatim port — it re-expresses the wizard's validated strategy (raster zig-zag rows
 * inset half a stepover + a wall finish pass, per Z layer — see pocketWizard.js) as WHILE/DO loops.
 *
 * Runs at the WCS origin corner (the slot's WCS dropdown sets the frame); tool-centre paths are inset by the
 * tool radius so the FINISHED pocket = W x H. Spindle is assumed already running (same as the drill/bore slots).
 * See [[cam-probing-and-simulate]], [[cam-menu-architecture]], [[priorities-friendliness-over-perf]].
 */
import { allocFields, readLine } from './probeToSlot.js';

const POCKET_FIELDS = [
    { key: 'w', label: 'Width (X)', units: 'mm', def: 80, min: 1, max: 99999, type: 1 },
    { key: 'h', label: 'Height (Y)', units: 'mm', def: 60, min: 1, max: 99999, type: 1 },
    { key: 'depth', label: 'Depth', units: 'mm', def: 4, min: 0.1, max: 9999, type: 1 },
    { key: 'stepdown', label: 'Stepdown', units: 'mm', def: 1.5, min: 0.1, max: 999, type: 1 },
    { key: 'stepover', label: 'Stepover', units: 'mm', def: 2.4, min: 0.1, max: 999, type: 1 },
    { key: 'toolDia', label: 'Tool Ø', units: 'mm', def: 6, min: 0.1, max: 999, type: 1 },
    { key: 'feed', label: 'Feed', units: 'mm/min', def: 600, min: 1, max: 99999, type: 0 },
    { key: 'plunge', label: 'Plunge feed', units: 'mm/min', def: 150, min: 1, max: 99999, type: 0 },
    { key: 'clearance', label: 'Clearance Z', units: 'mm', def: 5, min: 0, max: 9999, type: 1 },
];

/**
 * Build the "Pocket (rect)" CAM slot — raster-clear a rectangular pocket layer by layer, then a wall finish
 * pass. Parametric: rows + Z layers recompute from the form. Tool-centre region inset by the tool radius.
 */
export function pocketSlot(used = new Set(), varOffset = 0) {
    const { fields, v } = allocFields(POCKET_FIELDS, used, varOffset);
    const body = [
        '( Rectangular pocket — raster clear + wall finish, layer by layer. Runs at the WCS origin corner. )',
        '( Spindle must already be running. Edit #20/#21 to offset the pocket within the WCS. )',
        ...fields.map(readLine),
        '',
        '#20=0   ;origin X (edit to offset)',
        '#21=0   ;origin Y',
        '( tool-centre clearing region, inset by the tool radius → finished size = W x H )',
        `#22=[${v.toolDia}/2]`,
        `#23=[#20+#22]   ;x0`,
        `#24=[#20+${v.w}-#22]   ;x1`,
        `#25=[#21+#22]   ;y0`,
        `#26=[#21+${v.h}-#22]   ;y1`,
        '( guard: the pocket must be larger than the tool )',
        'IF #24 LE #23 GOTO 8',
        'IF #26 LE #25 GOTO 8',
        `#27=FUP[[#26-#25]/${v.stepover}]   ;raster row count`,
        '',
        'G90   ( absolute )',
        `G0 Z${v.clearance}`,
        '#28=0   ;current depth',
        `WHILE #28 LT ${v.depth} DO1`,
        `  #28=[#28+${v.stepdown}]`,
        `  IF #28 GT ${v.depth} THEN #28=${v.depth}`,
        '  ( raster rows — zig-zag in Y, inset half a stepover from the walls )',
        `  #29=[#25+${v.stepover}/2]   ;first row`,
        '  #30=0   ;row index',
        '  #31=1   ;zig direction',
        '  G0 X#23 Y#29',
        `  G1 Z[0-#28] F${v.plunge}`,
        '  WHILE #30 LT #27 DO2',
        '    IF #31 GT 0 THEN #32=#24',
        '    IF #31 LT 0 THEN #32=#23',
        `    G1 X#32 F${v.feed}`,
        '    #31=[0-#31]',
        '    #30=[#30+1]',
        `    #29=[#25+${v.stepover}/2+#30*${v.stepover}]`,
        '    IF #29 GT #26 THEN #29=#26',
        `    G1 Y#29 F${v.feed}`,
        '  END2',
        `  G0 Z${v.clearance}`,
        '  ( wall finish pass at the inset boundary )',
        '  G0 X#23 Y#25',
        `  G1 Z[0-#28] F${v.plunge}`,
        `  G1 X#24 Y#25 F${v.feed}`,
        '  G1 X#24 Y#26',
        '  G1 X#23 Y#26',
        '  G1 X#23 Y#25',
        `  G0 Z${v.clearance}`,
        'END1',
        `G0 Z${v.clearance}`,
        'GOTO 9',
        '( error )',
        'N8',
        '#1505=1   ;ERROR: pocket smaller than the tool',
        'N9',
        'M30',
    ].join('\n');
    return { name: 'Pocket (rect)', fields, body };
}

const SURFACE_FIELDS = [
    { key: 'w', label: 'Area X', units: 'mm', def: 100, min: 1, max: 99999, type: 1 },
    { key: 'h', label: 'Area Y', units: 'mm', def: 80, min: 1, max: 99999, type: 1 },
    { key: 'depth', label: 'Depth', units: 'mm', def: 0.5, min: 0.05, max: 999, type: 1 },
    { key: 'stepdown', label: 'Stepdown', units: 'mm', def: 0.5, min: 0.05, max: 999, type: 1 },
    { key: 'stepover', label: 'Stepover', units: 'mm', def: 7.2, min: 0.1, max: 999, type: 1 },
    { key: 'toolDia', label: 'Tool Ø', units: 'mm', def: 12, min: 0.1, max: 999, type: 1 },
    { key: 'feed', label: 'Feed', units: 'mm/min', def: 800, min: 1, max: 99999, type: 0 },
    { key: 'plunge', label: 'Plunge feed', units: 'mm/min', def: 200, min: 1, max: 99999, type: 0 },
    { key: 'clearance', label: 'Clearance Z', units: 'mm', def: 5, min: 0, max: 9999, type: 1 },
];

/**
 * Build the "Surface / face" CAM slot — raster the top of the stock flat. Like the pocket raster but with NO
 * radius inset (the area is the tool-CENTRE sweep, so the tool overhangs the edges and faces the whole top)
 * and NO wall pass. Shallow Z (skim). Runs at the WCS origin corner; spindle assumed running.
 */
export function surfacingSlot(used = new Set(), varOffset = 0) {
    const { fields, v } = allocFields(SURFACE_FIELDS, used, varOffset);
    const body = [
        '( Surface / face mill — raster the top flat. Tool-centre sweeps Area X x Y; the tool overhangs the edges. )',
        '( Spindle must already be running. Edit #20/#21 to offset within the WCS. )',
        ...fields.map(readLine),
        '',
        '#20=0   ;origin X (edit to offset)',
        '#21=0   ;origin Y',
        '( tool-centre sweep area — no inset, the tool overhangs by its radius on all sides )',
        '#23=#20   ;x0',
        `#24=[#20+${v.w}]   ;x1`,
        '#25=#21   ;y0',
        `#26=[#21+${v.h}]   ;y1`,
        'IF #24 LE #23 GOTO 8',
        'IF #26 LE #25 GOTO 8',
        `#27=FUP[[#26-#25]/${v.stepover}]   ;raster row count`,
        '',
        'G90   ( absolute )',
        `G0 Z${v.clearance}`,
        '#28=0   ;current depth',
        `WHILE #28 LT ${v.depth} DO1`,
        `  #28=[#28+${v.stepdown}]`,
        `  IF #28 GT ${v.depth} THEN #28=${v.depth}`,
        `  #29=[#25+${v.stepover}/2]   ;first row`,
        '  #30=0   ;row index',
        '  #31=1   ;zig direction',
        '  G0 X#23 Y#29',
        `  G1 Z[0-#28] F${v.plunge}`,
        '  WHILE #30 LT #27 DO2',
        '    IF #31 GT 0 THEN #32=#24',
        '    IF #31 LT 0 THEN #32=#23',
        `    G1 X#32 F${v.feed}`,
        '    #31=[0-#31]',
        '    #30=[#30+1]',
        `    #29=[#25+${v.stepover}/2+#30*${v.stepover}]`,
        '    IF #29 GT #26 THEN #29=#26',
        `    G1 Y#29 F${v.feed}`,
        '  END2',
        `  G0 Z${v.clearance}`,
        'END1',
        `G0 Z${v.clearance}`,
        'GOTO 9',
        '( error )',
        'N8',
        '#1505=1   ;ERROR: zero area',
        'N9',
        'M30',
    ].join('\n');
    return { name: 'Surface / face', fields, body };
}
