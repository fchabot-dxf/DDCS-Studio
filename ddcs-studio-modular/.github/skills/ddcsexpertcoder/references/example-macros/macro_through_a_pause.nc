#769=1 //Turn on #1503
#2040=1 // Turn on the #1503 non-disappearing line
#1510=0 //Zeroize the point counter for the memorization cycle
#593=1 //Switch pause mode to G4P-1
#584=0 //Disable spindle pause stop, for acceleration.
#591=0 //Disable Z-axis lift on pause, for acceleration

//Cycle for memorizing points
WHILE [#1505!=0]+[#1510==0] DO1
#1510=#1510+1 // Increase the point counter for the move cycle
#1503=-3000(Move axis to point %.0f and press START.)
G4P-1
G1
#1505=-5000(Point %.0f saved. ENTER for next point, ESC for start moving.)
#[2200+#1510]=#880 //Save X coordinate.
#[2300+#1510]=#881 //Save Y coordinate
END1

#593=0 //Switch to pause mode, by PAUSE button
#584=1 //Switch on spindle pause stop
#591=1 //Enable Z-axis lift on pause.
#200=#1510 //Transfer point counter value to another variable
#100=0 //Resetting the point counter for the motion cycle

//Motion cycle
WHILE #100<#200 DO2
#100=#100+1 // Increase the point counter for the motion cycle
#1510=#100 //Transmit point number to #1505
#1505=-5000(Go to point Point Point %.0f)
G53 X#[2200+#100] Y#[2300+#100]
END2
#200=0 //Zeroes the point counter to memorize before exiting.
#1510=0 //Zeroes the counter of points to be memorized, before exit
#2040=0 //Turn off non-disappearing line #1503 before exit



