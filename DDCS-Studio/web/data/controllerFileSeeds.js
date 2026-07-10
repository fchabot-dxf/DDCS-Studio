/**
 * data/controllerFileSeeds.js — first-open SEED bodies for the declared baseline files (t662, E1). When a plain file is
 * opened for the first time and the user hasn't edited it (nothing in settings.workspace[path]), the editor DISPLAYS the
 * dump copy from here so the controller's real structure is visible + a starting point to edit. Editing persists into
 * settings.workspace (the seed is never silently written — unedited files re-display the seed deterministically).
 *
 * These are reference firmware constants copied VERBATIM from the repo dumps (same pattern as data/factoryMacros.js):
 *   V4.1  → bridge/controllers/v4.1/assets/firmware/ddcs v4.1/ddcsv4(2025-04-04)/ddcsv4(2025-04-04)/ddcsv4/
 *   DM500 → bridge/controllers/dm500/install/
 * Files we don't have a clean text copy for (e.g. DM500 probe.nc has GBK comments, the big .rc dialogs, slib libraries)
 * are intentionally absent → the editor opens empty (honest: "we don't ship a copy; pull or paste your own").
 */

export const CONTROLLER_FILE_SEEDS = {
    'ddcs-v41': {
        'advstart.nc': `M98P8001`,
        'probe-fix.nc': `;固定对刀
M5

MarcoDialog "probe-fix.rc"

G0G53Z#102
G53X#103Y#104
G53Z#105

G91G31Z-1000L#682Q1K0F#106
#1556=#1502
#108=#1502
G91G0Z#107`,
        'selcoord.nc': `#1=146
MarcoDialog "selcoord.rc"`,
        'gotoz.nc': `IF#1406==0GOTO1
G90G0G53Z#1402
G90G0X0Y0
A0B0C0
GOTO3
N1IF#1508>#1407GOTO2
G0Z#1407
G90G0X0Y0
A0B0C0
GOTO3
N2
G90G0X0Y0
A0B0C0
G0Z#1407
N3`,
        'safez.nc': `(全局参数#1402:Z轴安全高度)
(全局参数#1400:Z轴是否回安全高度)
G52X0Y0
IF#1400==0GOTO1
G0G53Z#1402
N1

#490=#1500
#491=#1501
#492=#1502
#493=#1503
#494=#1504
#495=#1505`,
        'pause.nc': `G52X0Y0Z0A0B0C0
IF#1403==1GOTO1
G91G0Z#1404
GOTO2
N1G0G53Z#1302
G0G53X#1300Y#1301
G0A0B0C0
N2`,
    },
    'ddcs-v3-dm500': {
        'defprobe.nc': `;#2000 Cutter diameter
;#2001 Tool plate thick for X
;#2002 Tool plate thick for Y
;#2003 Tool plate thick for Z
;#2004 shift of X axis before probed
;#2005 shift of Y axis before probed
;#2006 Z position before X(Y)-axis probed:-0.25
;#2007 Back distance when the tool touches the X-axis edge
;#2008 Back distance when the tool touches the Y-axis edge
;#2009 Back distance when the tool touches the Z-axis edge
;#2010 center of tool plate
;#2011 Probe feedrate

G04 P0
M5

M101
G91 G01 Z-100 F#2011
M102
G04 P0
G90 G92 Z#2003
G91 G0 Z#2009
G91 G0 X#2004
G90 G0 Z#2006

M101
G91 G01 X-#2004 F#2011
M102
G04 P0

IF #2004LT0 GOTO1
G90 G92 X#2000/2+#2001
G91 G0 X#2007
G90 G0 Z#2003+#2009
G90 G0 X-#2010
GOTO2
N1 G90 G92 X-#2000/2-#2001
G91 G0 X-#2007
G90 G0 Z#2003+#2009
G90 G0 X#2010
N2 G91 G0 Y#2005
G90 G0 Z#2006

M101
G91 G01 Y-#2005F#2011
M102
G04 P0

IF #2005LT0 GOTO3
G90 G92 Y#2000/2+#2002
G91 G0 Y#2008
G90 G0 Z#2003+#2009
GOTO4
N3 G90 G92 Y-#2000/2-#2002
G91 G0 Y-#2008
G90 G0 Z#2003+#2009
N4 G90 G0 X0 Y0`,
        'safez.nc': `M98 P101`,
        'gotoz.nc': `M98 P100`,
        'pause.nc': `G91G0Z#589`,
    },
};

/** The declared seed body for controllerId/path, or '' if we don't ship a copy. */
export function seedBody(controllerId, path) {
    const c = CONTROLLER_FILE_SEEDS[controllerId];
    return (c && typeof c[path] === 'string') ? c[path] : '';
}
