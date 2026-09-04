(V20 - reads the tool-setter calibration reference and reports it)
(CALIBRATE.nc stores the setter-to-spoilboard reference in #2500, and the patched slib-g O502)
(writes the tool length as [touch - #2500]. If #2500 is zero the tool length would be the raw)
(touch height, so its value decides whether the fixed probe is calibrated.)

(#2500 is in neither setting, camsetting nor uservar, so a macro is the only way to read it.)
(Reports the active tool Z offset alongside it for comparison.)

(Commands no motion and writes nothing.)

(Prime)
#101 = 1
#102 = 1

#101 = #2500
#102 = #1430

#1510 = #101
#1511 = #102
#1505 = -5000(V20 ref2500=%.3f toolZ=%.3f)
G04 P8.0

M30
