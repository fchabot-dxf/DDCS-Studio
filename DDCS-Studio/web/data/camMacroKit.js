/**
 * data/camMacroKit.js — shared DDCS-macro emitters for the CAM-slot generators (probeToSlot, millToSlot).
 *
 * Each generator used to re-implement these primitives; centralising them guarantees every slot uses the one
 * proven sequence (two-pass G31, indirect WCS write, raster) and keeps the generators short. Pure string
 * builders — no DOM, no state. Output is byte-stable so the cam-slot-sim tests guard any change here.
 *
 * Scratch-var convention these helpers own: WCS #70 (base) #71 (idx) #73 (addr); raster #27-#32.
 */

/** Spindle RPM field to append to a cutting slot's form, + the start/stop lines that bracket the toolpath. */
export const SPINDLE_FIELD = { key: 'rpm', label: 'Spindle RPM', units: 'rpm', def: 8000, min: 1, max: 60000, type: 0 };
// Forms verified against a real Expert macro (SYSDISK/key-7.nc): spindle speed is a BRACKETED var `S[#var]`
// and G04 P is in SECONDS (key-7: `G04 P[#142]`, #142=30 → "30 seconds"), not milliseconds.
/** Spindle on CW at the form RPM, with a short spin-up dwell (P = seconds). */
export const spindleOn = (rpmVar) => [`M3 S[${rpmVar}]   ( spindle on )`, 'G04 P2   ( spin-up dwell, seconds )'];
export const spindleOff = () => ['M5   ( spindle off )'];

/** Per-axis DDCS probe system vars: status (2=success) + trigger position (machine coord). */
export const PROBE = {
    X: { status: '#1920', result: '#1925' },
    Y: { status: '#1921', result: '#1926' },
    Z: { status: '#1922', result: '#1927' },
};

/** The 3 lines that compute the WCS base address #70 from a wcs var (0 = active → read #578). */
export function wcsBase(wcsVar) {
    return [`#71=${wcsVar}`, 'IF #71 EQ 0 THEN #71=#578', '#70=[805+[#71-1]*5]'];
}

/** Indirect write of `valueExpr` to the WCS offset for an axis (off 0=X, 1=Y, 2=Z), relative to base #70. */
export function writeAxis(off, valueExpr, note) {
    const c = note ? `   ;${note}` : '';
    if (off === 0) return [`#[#70]=${valueExpr}${c}`];
    return [`#73=[#70+${off}]`, `#[#73]=${valueExpr}${c}`];
}

/**
 * Two-pass G31 probe of one axis: fast touch → check → retract → slow touch → check. Returns the 5 core lines;
 * the caller appends its post-action (save / radius-comp / WCS write) + the final retract.
 * @param {'X'|'Y'|'Z'} ax
 * @param {{tgt:string, ret:string, fast:string, slow:string, port:string, level:string, err?:string}} o
 */
export function twoPassProbe(ax, o) {
    const st = PROBE[ax].status, err = o.err || '1';
    return [
        `G31 ${ax}${o.tgt} F${o.fast} P${o.port} L${o.level} Q1`, `IF ${st}!=2 GOTO ${err}`, `G0 ${ax}${o.ret}`,
        `G31 ${ax}${o.tgt} F${o.slow} P${o.port} L${o.level} Q1`, `IF ${st}!=2 GOTO ${err}`,
    ];
}

/** Two-pass probe that saves the trigger into `into` and retracts — the common case (inside/boss/alignment). */
export function probeSave(ax, o) {
    return [...twoPassProbe(ax, o), `${o.into}=${PROBE[ax].result}`, `G0 ${ax}${o.ret}`];
}

/**
 * Raster-clear a rectangle in Z layers: zig-zag rows inset half a stepover, optional wall finish pass per
 * layer. Owns scratch #27 (rows) #28 (z) #29 (yy) #30 (i) #31 (dir) #32 (xt). Bounds are var/expr strings.
 * @param {{x0,x1,y0,y1, depth, stepdown, stepover, feed, plunge, clearance:string, wall?:boolean}} o
 */
export function rasterClear(o) {
    const { x0, x1, y0, y1, depth, stepdown, stepover, feed, plunge, clearance, wall } = o;
    const lines = [
        `#27=FUP[[${y1}-${y0}]/${stepover}]   ;raster row count`,
        '',
        'G90   ( absolute )',
        `G0 Z${clearance}`,
        '#28=0   ;current depth',
        `WHILE #28 LT ${depth} DO1`,
        `  #28=[#28+${stepdown}]`,
        `  IF #28 GT ${depth} THEN #28=${depth}`,
        `  #29=[${y0}+${stepover}/2]   ;first row`,
        '  #30=0   ;row index',
        '  #31=1   ;zig direction',
        `  G0 X${x0} Y#29`,
        `  G1 Z[0-#28] F${plunge}`,
        '  WHILE #30 LT #27 DO2',
        `    IF #31 GT 0 THEN #32=${x1}`,
        `    IF #31 LT 0 THEN #32=${x0}`,
        `    G1 X#32 F${feed}`,
        '    #31=[0-#31]',
        '    #30=[#30+1]',
        `    #29=[${y0}+${stepover}/2+#30*${stepover}]`,
        `    IF #29 GT ${y1} THEN #29=${y1}`,
        `    G1 Y#29 F${feed}`,
        '  END2',
        `  G0 Z${clearance}`,
    ];
    if (wall) lines.push(
        '  ( wall finish pass at the inset boundary )',
        `  G0 X${x0} Y${y0}`,
        `  G1 Z[0-#28] F${plunge}`,
        `  G1 X${x1} Y${y0} F${feed}`,
        `  G1 X${x1} Y${y1}`,
        `  G1 X${x0} Y${y1}`,
        `  G1 X${x0} Y${y0}`,
        `  G0 Z${clearance}`,
    );
    lines.push('END1', `G0 Z${clearance}`);
    return lines;
}
