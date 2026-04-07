//Macros of cylindrical thread milling. Version 11.12.2024
//Macro author Nikolay Zvyagintsev.

#50=0 //0 - Internal thread. 1- External thread.
#51=10 //Depth.
#90=0.05 //Gap from the bottom. Possible negative.
#52=6.65 //Internal thread diameter.
#53=8.1 //External thread diameter.
#54=6 //Diameter of thread cutter.
#55=1.25 //Thread pitch.
#56=3 //Number of turns of the thread cutter.
#57=0.3 //Depth of milling for 1 pass.
#58=0 //Direction of thread. 0-right. 1-left.
#59=1 //Milling direction. 0-from top. 1-from bottom.

#60=0 //Chamfer 0- off; 1- from top; 2- from top and bottom.  
#61=0.85 //Distance from tooth to cutter tip in mm.
#62=100 //Chamfer diameter in percentage
#63=0.3 //Chamfer depth
#64=0.7 //Begin of chamfer machining above the surface
#65=0.05 //Chamfer pitch

#66=720 //Roughing feed rate.
#67=10500 //Spindle speed roughing.
#68=0 //Dip and plunge test. 1- on 0- off.
#69=0 //Remove cutter for cleaning. 1- on 0- off.
#70=0 //Cutting step in mm. 0-off.
#71=0 //Finishing allowance in mm. 0- finishing off.
#72=250 //Finishing feed rate.
#73=24000 //Spindle speed finishing.
#74=0.5 //Safe distance from the wall for external threads.
#75=15 //Safe height in Z.
#76=-20 //Safe distance in X.
#77=20 //Safe distance in Y.
#78=1 //Z lift prohibition on pause. 1- on. 0- off.
#79=2 //Algorithm for lifting Z on pause, after completion.
#80=0 //Through cutting. 1- on 0- off.

G[53+#578] ;;Prevent switching to G54

;;Check settings
IF [#50<0]+[#50>1]+[#53<=#52]+[#54>#52]+[#55==0]+[#56<1]+[#57==0]+[#58<0]+[#58>1]+[#59<0]+[#59>1]+[#60<0]+[#60>2]+[#65==0]+[#68<0]+[#68>1]+[#69<0]+[#69>1]+[#74==0]+[#78<0]+[#78>1]+[#79<0]+[#79>3]+[#80<0]+[#80>1] GOTO401
GOTO404
N401
#1505=-5000(The macro settings are not correct.)
GOTO161
N404

;;Remove the minuses from the settings.
#91=0
WHILE #91 <= 25 DO1
#[50+#91]=ABS[#[50+#91]]
#91=#91+1
END1

;;Prohibit lifting on pause, if enabled
IF #78==0 GOTO118
#591=0
N118

#190=#51-ABS[#90] ;;Transmit depth (height), remove minus.
IF #80==0 GOTO298
#190=#51+#61-#90 ;;Transmit depth (height) for through-cutting, do NOT remove minus
N298

#185=#66 ;;Transmit feed rate
#186=#67 ;;Transmit spindle speed

#120=ABS[#58-#59] ;;Calculate direction of rotation - 0 clockwise, 1 counterclockwise
#55=#55*[#59*2-1] ;;Calculate Z pitch direction

#116=FUP[[[[#53-#52]/2-#71]/#57] ;;Y step count [#53-#52]/2 - groove depth

#100=[#52-#54]/2 ;;Coordinate of the hole wall touch with the cutter.
#105=0 ;;Safe Y coordinate for Z movement
#106=[[#53-#52]/2-#71]/#116 ;;Y step (positive) [#53-#52]/2 - groove depth
IF #50==0 GOTO109
#100=[#53+#54]/2 ;;Coordinate of touching the pin wall with the mill.
#105=#100+#74 ;;Safe Y coordinate for Z movement
#106=-#106 ;;Y step (negative) [#53-#52]/2 - groove depth
#70=-#70 ;;Y step for re-cutting (negative)
N109

IF #71==0 GOTO122 ;;Add 1 more Y step if finishing is enabled.
#116=#116+1 
N122

#101=#100 ;;Current plunge Y coordinate (set to touch the workpiece)
#103=ABS[FUP[#190/#55]]-#56+1 ;;Z number of turns
IF #103>=1 GOTO162
#103=1
N162


;;Test dive and safe altitude.
IF #68==0 GOTO100
G0 Z#75
G0 X#76Y#77
#1505=-5000(Safe Altitude Test. Press ENTER) 
IF #1505==0 GOTO160

G0 X0Y#105

IF [#80==1]*[#60==2]*[#56<5] GOTO202
G0 Z-#190
GOTO203
N202
G0Z-1*[#51+#61+#56*#55-#55+#64]
N203
#1505=-5000(Plunge test. Press ENTER) 
IF #1505==0 GOTO160

GOTO101
N100

;;Move to the center of the hole
G0 Z#75
G0 X0Y#105
N101

M3S#186


;;Start of milling cycle
N107
#101=#101+#106 ;;Increase or decrease the Y coordinate
#102=-#190 ;;Current Z coordinate
IF #59==1 GOTO106 ;;If from bottom, move to N106.
#102=-#190-#103*#55 ;;If from top
N106

#104=0 ;;§°§Ò§ß§å§Ý§ñ§Ö§Þ §ã§é§×§ä§é§Ú§Ü §à§Ò§à§â§à§ä§à§Ó §á§à Z
G4P100
G0 Z#102 ;;§±§Ö§â§Ö§Þ§Ö§ë§Ö§ß§Ú§Ö §Ü §ß§Ñ§é§Ñ§Ý§å §æ§â§Ö§Ù§Ö§â§à§Ó§Ñ§ß§Ú§ñ §á§à Z
G0 Y#101-#106 ;;§±§Ö§â§Ö§Þ§Ö§ë§Ö§ß§Ú§Ö §Ü §ß§Ñ§é§Ñ§Ý§å §æ§â§Ö§Ù§Ö§â§à§Ó§Ñ§ß§Ú§ñ §ß§Ñ 12 §é§Ñ§ã§à§Ó
G1 Y#101 F#185 ;;§£§â§Ö§Ù§Ñ§Ö§Þ§ã§ñ

WHILE #104<#103 DO2 ;;#103 - Number of turns
G[#120+2] X0Y-#101Z#102+#55*0.5 I0J-#101 F#185 ;;1st half turn
G[#120+2] X0Y#101Z#102+#55 I0J#101 ;;2nd half twist 
#102=#102+#55 ;;Z position counter
#104=#104+1 ;;Turn counter to exit the loop
END2

G0Y#105 ;;Y to safe coordinate
#116=#116-1
#1510=#116 
#1503=-3000(%.0f passes remaining.) 

IF [#69==0]+[#116<=0] GOTO111 ;;Output to clear
M5
G0 Z#75 ;;Z to safe height
G0 X#76Y#77 ;;Move XY away
#1505=-5000(Clearing. %.0f passes remaining.) 
IF [#71!=0]*[#116<=1] GOTO116 ;;If the next step is finishing - no need to start the spindle.
M3S#186
N116
G0X0Y#105 ;;Y to safe coordinate
N111

IF #116>1 GOTO107 
IF [#116>0] * [#71==0] GOTO107 
IF [#71==0]+[#116<1] GOTO120 ;;If there is no clean pass, or it is already done, go to 120

;;Setting the finishing pass

#185=#72 ;;Change the milling speed
#186=#73 ;;Change spindle speed
M3S#186
;;Calculate the current plunge Y coordinate for the finishing pass
#106=#71 ;;Change the milling step.
#101=[#53-#54]/2-#106 ;;If we are cutting a nut.
IF #50==0 GOTO121
#106=-#71 ;;Change the milling step.
#101=[#52+#54]/2-#106 ;;If cutting a bolt
N121
GOTO107
N120 
;;End of milling cycle


;; Chamfer
IF #60==0 GOTO115
M3S#67

;;Calculate the Z chamfer steps
#113=FUP[[#64+#63]/#65] ;;Number of Z passes
#114=[#64+#63]/#113 ;;Step by Z

;;Calculate the chamfer depth in Y
#191=#100+[[#53-#52]/2*#62/100] ;;[#53-#52]/2 - groove depth
IF #50==0 GOTO201
#191=#100-[[#53-#52]/2*#62/100] ;;[#53-#52]/2 - groove depth
N201

;;Upper chamfer
#115=-#61+#64 ;;Start of Z milling
#118=0 ;;Set pass counter
G0X0Y#105 ;;Y to safe coordinate
G0Z#115;;Lower cutter tooth, to the height of the beginning of milling.
G0Y#100 ;;Y to the wall
G1 Y#191 F#66 ;;Cut in.

WHILE #118<=#113 DO3
G1 Z#115-#114*#118 ;;Depth in Z
G[#120+2] X0Y-#191 I0J-#191 ;;1st half twist
G[#120+2] X0Y#191 I0J#191 ;;2nd half twist 
#118=#118+1 ;;Increase Z pass counter
END3

G0 X0Y#105 ;;Y to safe coordinate
IF [#60!=2]+[#80!=1]+[#56>4] GOTO115


;;Bottom chamfer
#115=-1*[#51+#61+#56*#55-#55+#64] ;;Start Z milling
#118=0 ;;Set pass counter

G0Z#115 ;;Top tooth of the cutter, to the height of the beginning of milling.
G0Y#100 ;;Y to wall
G1 Y#191 F#66 ;;Cut in.

WHILE #118<=#113 DO4
G1 Z#115+#114*#118 ;;Depth in Z
G[#120+2] X0Y-#191 I0J-#191 ;;1st half twist
G[#120+2] X0Y#191 I0J#191 ;;2nd half twist 
#118=#118+1 ;;Increase Z pass counter
END4

G0 X0Y#105 ;;Y to safe coordinate
N115

;; Final cut
IF #70==0 GOTO160
N114
M5
G0 Z#75 ;;Z to safe height
G0 X#76Y#77 ;;Move back XY

#101=#101+#70 ;;Increase depth of cut

#1510=ABS[#70]
#1511=#101*2+#54*[#59*2-1]
#1505=-5000(Cut to %.3f mm, to D= %.3f mm? ESC-out). 
IF #1505==0 GOTO160
M3S#186

#104=0 ;;Zero the revolution counter (turns by Z)

#102=-#190 ;;Current Z coordinate
IF #59==1 GOTO113 ;;If from bottom, go to N113
#102=-#190-#103*#55 ;;If from top
N113

G4P500
G0 X0Y#105 ;;Y to safe coordinate
G0 Z#102 ;;Move to the beginning of milling in Z
G0 Y#101-#70 ;;Advance to the beginning of milling for 12 hours
G1 Y#101 F#185 ;;Cut in

WHILE #104<#103 DO5 ;;#103 - Number of turns
G[#120+2] X0Y-#101Z#102+#55*0.5 I0J-#101 F#185 ;;1st half turn
G[#120+2] X0Y#101Z#102+#55 I0J#101 ;;2nd half twist 
#102=#102+#55 ;;Z position counter
#104=#104+1 ;;Turn counter, to exit the loop
END5
GOTO114
N112

N160
M5
G0Z#75 ;;Z to safe height
N161
;;Return paused climb if enabled
IF #78==0 GOTO119
#591=#79
N119

