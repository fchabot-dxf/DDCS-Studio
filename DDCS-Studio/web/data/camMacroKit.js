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
// Spindle speed is a BRACKETED var `S[#var]` (key-7.nc: `M03 S[#140]`). G04 P units depend on FORMAT on the
// Expert: an INTEGER is milliseconds (slib-g.nc `G04 P100 //100ms`, `P2000`=2s), a DECIMAL is seconds
// (`P5.2`=5.2s). So P2000 (integer) = 2 s. (key-7's `P30` integer = 30ms — its "30s" comment is a bug.)
/** Spindle on CW at the form RPM, with a ~2-second spin-up dwell (integer P2000 = 2000 ms). */
export const spindleOn = (rpmVar) => [`M3 S[${rpmVar}]   ( spindle on )`, 'G04 P2000   ( spin-up dwell 2000ms = 2s )'];
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
 * layer, with a zig ramp lead-in (no vertical plunge into solid). Owns scratch #27 (rows) #28 (z) #29 (yy)
 * #30 (i) #31 (dir) #32 (xt) #33 (ramp len) — callers own #20–#26, so the kit stays at #27+. Bounds are var/expr.
 * `dir` picks the row axis: 'x' (default) sweeps rows along X stepping over in Y; 'y' swaps them. The wall pass
 * traces the same rectangle either way.
 * @param {{x0,x1,y0,y1, depth, stepdown, stepover, feed, plunge, clearance:string, wall?:boolean, dir?:'x'|'y'}} o
 */
export function rasterClear(o) {
    const { x0, x1, y0, y1, depth, stepdown, stepover, feed, plunge, clearance, wall } = o;
    // Row axis sweeps rowLo↔rowHi each pass; step axis advances stepLo→stepHi by stepover between rows.
    const yDir = o.dir === 'y';
    const rowAx = yDir ? 'Y' : 'X', stepAx = yDir ? 'X' : 'Y';
    const rowLo = yDir ? y0 : x0, rowHi = yDir ? y1 : x1;
    const stepLo = yDir ? x0 : y0, stepHi = yDir ? x1 : y1;
    const lines = [
        `#27=FUP[[${stepHi}-${stepLo}]/${stepover}]   ;raster row count`,
        `#33=${stepover}   ;ramp lead-in length`,
        '',
        'G90   ( absolute )',
        `G0 Z${clearance}`,
        '#28=0   ;current depth',
        `WHILE #28 LT ${depth} DO1`,
        `  #28=[#28+${stepdown}]`,
        `  IF #28 GT ${depth} THEN #28=${depth}`,
        `  #29=[${stepLo}+${stepover}/2]   ;first row`,
        '  #30=0   ;row index',
        '  #31=1   ;zig direction',
        `  G0 ${rowAx}${rowLo} ${stepAx}#29`,
        `  G0 Z[${stepdown}-#28]   ;rapid through cleared air to the previous depth`,
        `  G1 ${rowAx}[${rowLo}+#33] Z[0-#28] F${plunge}   ;ramp down into the layer (no vertical plunge into solid)`,
        `  G1 ${rowAx}${rowLo} F${feed}   ;back to the row start at depth`,
        '  WHILE #30 LT #27 DO2',
        `    IF #31 GT 0 THEN #32=${rowHi}`,
        `    IF #31 LT 0 THEN #32=${rowLo}`,
        `    G1 ${rowAx}#32 F${feed}`,
        '    #31=[0-#31]',
        '    #30=[#30+1]',
        `    #29=[${stepLo}+${stepover}/2+#30*${stepover}]`,
        `    IF #29 GT ${stepHi} THEN #29=${stepHi}`,
        `    G1 ${stepAx}#29 F${feed}`,
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

/**
 * Concentric-circle clear of a ROUND pocket, Z layers, inside-out (plunge at centre → rings out to the wall).
 * Rings are planar full-circle G3 arcs, with a zig ramp lead-in. Owns scratch #27 (maxR) #28 (z) #29 (ring
 * radius) #33 (ramp len) — callers own #20–#26. `cx`/`cy` = centre,
 * `maxR` = max tool-centre radius (= dia/2 − toolR). Expr/var strings throughout. `arc` is the ring direction:
 * 'G3' (CCW, default — climb for an internal pocket with a CW/M3 spindle) or 'G2' (CW, conventional).
 * @param {{cx,cy,maxR, depth, stepdown, stepover, feed, plunge, clearance:string, arc?:'G2'|'G3'}} o
 */
export function ringClear(o) {
    const { cx, cy, maxR, depth, stepdown, stepover, feed, plunge, clearance } = o;
    const arc = o.arc === 'G2' ? 'G2' : 'G3';
    return [
        `#27=${maxR}   ;max tool-centre radius`,
        `#33=${stepover}   ;ramp lead-in length`,
        '',
        'G90   ( absolute )',
        `G0 Z${clearance}`,
        '#28=0   ;current depth',
        `WHILE #28 LT ${depth} DO1`,
        `  #28=[#28+${stepdown}]`,
        `  IF #28 GT ${depth} THEN #28=${depth}`,
        `  G0 X${cx} Y${cy}   ;to centre`,
        `  G0 Z[${stepdown}-#28]   ;rapid through cleared air to the previous depth`,
        `  G1 X[${cx}+#33] Z[0-#28] F${plunge}   ;ramp down into the layer (no vertical plunge)`,
        `  G1 X${cx} F${feed}   ;back to centre at depth`,
        `  #29=${stepover}   ;ring radius`,
        '  WHILE #29 LT #27 DO2',
        `    G1 X[${cx}+#29] Y${cy} F${feed}   ;step out to the ring`,
        `    ${arc} X[${cx}+#29] Y${cy} I[0-#29] J0 F${feed}   ;full circle`,
        `    #29=[#29+${stepover}]`,
        '  END2',
        '  ( final wall ring at the full radius )',
        `  G1 X[${cx}+#27] Y${cy} F${feed}`,
        `  ${arc} X[${cx}+#27] Y${cy} I[0-#27] J0 F${feed}`,
        `  G0 Z${clearance}`,
        'END1',
        `G0 Z${clearance}`,
    ];
}
