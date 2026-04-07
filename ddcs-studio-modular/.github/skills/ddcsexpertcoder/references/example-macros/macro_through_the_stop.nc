#769=1 //Enable #1503
#2040=1 //Enable #1503 non-disappearing string
#200=#200+1 // Increase the counter of points to be memorized
#1510=#200 //Transmit point number to #1505
#1505=-5000(Point %.0f saved. ENTER for next point, ESC for start moving).
#[2200+#200]=#880 //Save X coordinate
#[2300+#200]=#881 //Save Y coordinate
IF #1505==1 GOTO20 //If ENTER is pressed, go to N20
//If ESC is pressed, go to motion cycle

#100=0 //Zeroize the point counter for the motion cycle
WHILE #100<#200 DO2
#100=#100+1 // Increase the point counter for the motion cycle
#1510=#100 //Transmit point number to #1505
#1505=-5000(Go to point Point Point %.0f)
G53 X#[2200+#100] Y#[2300+#100]
END2
#200=0 //Zeroize the point counter to memorize before exiting.
#2040=0 //Disable non-disappearing line #1503 before exit
GOTO30

N20
#1510=#200+1 //Transmit point number to #1503
#1503=-3000(Move axis to point %.0f and press START.)
N30

