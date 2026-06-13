;#2000 Cutter diameter
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
N4 G90 G0 X0 Y0
