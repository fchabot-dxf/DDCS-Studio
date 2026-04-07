;;Before using this program, please delete all comments that follow ";;;". For example, using Notepad++. Search - Replace - Regular expressions - in the "find" line write ;;;.* - leave the "Replace with" line empty - "Replace all".

//Internal settings
#91=0 //number of the main axis of homing. The one by the sensor of which 0 is set.  0=X; 1=Y; 2=Z; 3=4th; 4=5th.
#2=0 //number of the slave axis of homing.  0=X; 1=Y; 2=Z; 3=4th; 4=5th
#41=0 //Master sensor (slave sensor) port number
#43=0 //Slave sensor port number 
#19=0 //Pre-alignment port number
#62=0 //Number of free input port (nothing connected to it)
#27=0 //Fast feed. 0=off; not =0 - distance from sensor. 
#25=1 //Pre-alignment. 0 = off.
#57=1 //Two Pre-alignment feeds. 1 = on (2 feeds). 0 = off (1 inlet)
#26=1 //Fine alignment. 0 = off.
#31=5 //Max. gantry alignment distance. The setting is necessary not to bend the gantry in case of incorrect operation of the sensor.
//Alignment correctors are also taken into account.
#34=0 //Main side alignment corrector, i.e. after alignment, the main side will perform G91G0#34.!!!DANGER!!!!
#33=0 //Slave side alignment corrector, that is, after alignment, the slave side will execute G91G0#33.!!!DANGER!!!!
#50=0 //Check the reliability of the sensor contact. Turning it off speeds up the homing. Useless on inductive sensors. 1=on 0=off
#16=0 //Autorestart homing when the error is exceeded. If off, a dialog box will appear. 1=on 0=off
#49=5000 //Maximum homing distance of the 1st approach (double axis length).
#53=3 //Maximum homing distance of non 1st approach [and branch]. 
#54=1 //Disregard 1st approach coordinates 1=disregard 0=disregard (only for fine alignment).
#65=0 //Pause for calming down after 1st approach, in milliseconds.
#59=0 //Port number of the fast approach cancel button. If =0, it is disabled.
#63=1 //Stop type at 1st approach. =0 smooth =1 sharp !!!DANGER!!!!

;;External settings
;;#107-#111 - sets the 1st homing speed.
;;#118 - sets the 2nd homing speed. It is the same for all axes. If #118=0, this speed is taken from the starting speed of the motors.
;;#546,#549,#552,#555,#558 - enable or disable homing for each axis.
;;#106 - the number of home runs. Anti debouncing works with at least 3 runs
;;#235-#239 Offsets the zero mach. position for each axis. That is, after the homing is done, it will not be 0, but this number.
;;#122-#126 Machine position to which the selected axis will move after the homing is completed
;;#117 - Maximum error value in mm. If #117=0, it is not checked. If the error value is exceeded, the program is terminated.
;;#488-#492 - Settings of axis combination function. That is, when two axes work as one.
;;#2111-#2118 - Variables to memorize the max. error, during the last homing.
;;#2800-#2815 - Cumulative variables to memorize the max. error of the homing.


;;Check settings
IF [#91<0]+[#91>4]+[#2<0]+[#2>4]+[#41==0]+[#43==0]+[#62==0]+[#50<0]+[#50>1]+[#19<0] GOTO711 
IF [#16<0]+[#16>1]+[#49<=0]+[#53<=0]+[#54<0]+[#54>1]+[#57<0]+[#57>1] GOTO711 
IF [#25==0]*[#26==0] GOTO711 ;;If both the PA and the high-precision homing are turned off, exit.
IF [#19==0]*[#25==0] GOTO711 ;;Check if the pre-alignment port is configured. If not, but it is enabled - exit. 
GOTO710
N711
#1505=-5000(Error in program settings!)
GOTO30
N710

IF #[1046+#91*3]!=0 GOTO550 ;;Check to see if homing is enabled for the selected axis. If not, exit. The message is not shown so that we can move to another axis immediately.
#1510=#91
#1503=-3000(Axis homing %.0f is off).
GOTO30
N550

IF #[988+#91]==#[988+#2]GOTO580 ;;If the slave axis is configured, go to 580
#1505=-5000(Double axis setting error!)
GOTO30
N580

IF #43!=#[15*#[612+#91]+1015+#91*3]GOTO581 ;;If the slave sensor is not limit, skip to 581 (calculate the limit port variable number of the selected axis, depending on the direction of homing)
#1505=-5000(Limit sensor is set incorrectly!)
GOTO30
N581

#191=#[940+#91] ;;Calculate the letter of the main axis (letter number). 0=X; 1=Y; 2=Z; 3=A; 4=B; 5=C. The letter number of the slave axis does not need to be calculated. Because it is not substituted as a distance.
#1618=0 ;;;Reset the homing progress bar at boot and make the rotary axes LINEAR.
#34=#34-#33 ;;Reduce axis alignment to one main axis

#22=#[607+#91] ;;Transfer to a variable, the first homing speed.
N2
#20=#618+#500*[1-ROUND[#618/[#618+0.1]]] ;;Transfer to the variable, the second rate of homing. If it is not set, make it equal to the starting speed of the motors
#37=#606 ;;Transfer the number of homing cycles to the variable.
#32=#[612+#91] ;;Transfer the direction of homing to the variable.
#45=#41 ;;Transmit to the variable, the port of the master sensor (in the first FA run, the master sensor is detected).
#99=#91 ;;Transfer to variable, main axis number, for error calculation (in the first FA run, the main axis is defined).

#113=0 ;;Zero the flag of the already triggered sensor
#71=0 ;;Reset the variable for the direction and distance of X homing.
#72=0 ;;Zero the variable for the direction and distance of the Y homing.
#73=0 ;;Zero out the variable for the direction and distance of homing Z
#74=0 ;;Zero the variable for the direction and distance of homing A (PA only)
#75=0 ;;Zero the variable for the direction and distance of homing B (for PA only)
#76=0 ;;Zero the variable for the direction and distance of homing C (only for PA)
#108=0 ;;Zero the contact check flag
#112=0 ;;Zero the contact check variable
#121=0 ;;Zeroize the machine coordinates memory variable for calculating thePAdistance.
#47=0 ;;Zero the variable-indicator of the main side homing fulfillment
#300=0 ;;Zero the variable of coordinates accumulation by approaches
#321=0 ;;Zero the counter of total number of leads
#111=0 ;;Zero the counter of the number of informative leads
#35=0 ;;Zero the variable for calculating the PA distance.
#36=0 ;;Reset the PA direction variable to zero

;;---------------------------------------------------------------------------------
;;Checking a sensor that has already been triggered
IF [#[1519+#41]!=0]*[#[1519+#43]!=0] GOTO107  ;;If no sensor is triggered - switch to "fast feed" function.
#113=1 ;;Flag an already triggered sensor.
IF #25!=0 GOTO220 ;;If the P-A is enabled, go to the P-A diversion.
IF #[1519+#41]==0 GOTO155 ;;If the master sensor is triggered and the P-A is off, move to the fine alignment tap-off. 
#[71+#191]=[#32*2-1]*#53 ;;Determine the direction and distance of homing of the non- 1st approach.
GOTO207 ;;If the slave sensor is triggered and the master sensor is not triggered, go to the exact alignment (if the slave sensor is triggered, it does not prevent us from looking for the master sensor), but count it for the 1st approach.
;;---------------------------------------------------------------------------------
N107
;;Start of the "Fast Feed" function
IF #27==0 GOTO100 ;;If the "fast feed" function is disabled, skip to P-A
;;Fast feed skip function, while holding down the key.
IF #59==0 GOTO12
IF #[1519+#59]==0 GOTO100 
IF #[1519+#59]==0 GOTO100 
N12
#[71+#191]=#27*[1-#32*2]-#[880+#91] ;;Determine the direction and distance of the fast feed.
IF #19==0 GOTO101 ;;If the P-A port is not configured, go to 101
G91G31X#71Y#72Z#73 F#563 P#19 L0 K1 Q1 ;;Fast pull-in, protection on P-A port
GOTO102
N101
G91G31X#71Y#72Z#73A#74B#75C#76 F#563 P#41 L0 K1 Q1 ;;Fast push, master sensor protection
N102
IF #[1920+#91]<3 GOTO200 ;;If homing or not reaching sensor, go to 200
#1505=-5000(Limit collision!) 
IF #1505==1 GOTO30 ;;If you hit a limit that is not homing and ENTER is pressed, exit.
#30=1/0(EARLY EXIT, PUSH RESET) ;;If ESC is pressed - full exit from the macro that caused the homing.
;;Important: If the sensor is both limiting and homing, it still outputs 2.

N200 IF #[1920+#91]!=2 GOTO100 ;;If the sensor fails to work, switch to Pre-alignment
IF #25!=0 GOTO220 ;;If the sensor is triggered and P-A is enabled, do not perform P-A subtraction. (because G31 does not work correctly if the sensor is already triggered. And it is not known what coordinates it is in). 
#113=1 ;;Flag the already triggered sensor.
#57=1 ;;Enable double-submarine P-A. Since the 1st underwater was already there anyway.
IF #[1519+#41]!=0 GOTO155 ;;If the master sensor is triggered and the P-A is turned off, we move to the fine alignment lead. 
#[71+#191]=[#32*2-1]*#53 ;;Determine the direction and distance of the 1st approach of the FA and the diverter.
GOTO207 ;;If the slave sensor is triggered and the master sensor is not triggered, go to the exact alignment (if the slave sensor is triggered, it does not prevent us from looking for the master sensor), but consider it as the 1st unaccounted for feeder
;;So we set the second speed. And count all the feeds.
;;The end of the "Fast Feed" function.
;;---------------------------------------------------------------------------------
N100
;;Start of the "Pre-alignment"  function  
IF #25==0 GOTO150 ;;If P-A is off, jump P-A
;;First P-A feed
#[71+#191]=[#32*2-1]*#49 ;;Determine direction and distance of 1st approach of P-A
G91G31X#71Y#72Z#73A#74B#75C#76 F#22 P#19 L0 K0 Q#63 ;;First P-A feed. Looking for a common port.
G4P#65 ;;Pause to calm down. If the machine is wobbly, allows you to increase the accuracy of the homing.
IF #[1920+#91]>=2 GOTO105 ;;If the sensor is not found at the specified distance - exit
#1505=-5000(Homing sensor not found 1!)
IF #1505==1 GOTO30 ;;If ENTER is pressed - output
#30=1/0(EARLY EXIT, PRESS RESET) ;;If ESC is pressed - full exit from the macro that caused homing.
N105
IF #[1920+#91]<3 GOTO220 ;;If arrived at a common port or did not reach the sensor, go to 220
#1505=-5000(Limit collision!) 
IF #1505==1 GOTO30 ;;If you hit a limit that is not homing and ENTER is pressed, exit.
#30=1/0(EARLY EXIT, PUSH RESET) ;;If ESC is pressed - full exit from the macro that caused the homing.
;;Important: If the sensor serves as a limit and a homing at the same time, it still outputs 2.
N220

IF #57==0 GOTO159 ;;If the alignment is single-pipeline - do not divert, but start alignment immediately.

#[71+#191]=[#32*2-1]*#53 ;;Determine the direction and distance of the 2nd P-A lead and diverter.
G91G31X-#71Y-#72Z-#73A-#74B-#75C-#76 F#563 P#19 L1 K0 Q0 ;;Divert until the common port is turned off, at speed G0, with a soft stop. Do not count the limit. Otherwise, if one of the sensors is limit, there will be an error.
IF #[1920+#91]>=2 GOTO400 ;;If the common port is not open at the specified distance, exit
#1505=-5000(P-A diversion error!)
IF #1505==1 GOTO30 ;;If ENTER is pressed - output
#30=1/0(EARLY EXIT, PUSH RESET) ;;If ESC is pressed - full exit from the macro that caused homing.
N400

;;Second P-A feed
G91G31X#71Y#72Z#73A#74B#75C#76 F#20 P#19 L0 K0 Q1 ;;Second P-A feed with abrupt stop. Do not count limit.
IF #[1920+#91]>=2 GOTO402 ;;If the sensor is not found at the given distance - exit
#1505=-5000(Homing sensor not found 2!)
IF #1505==1 GOTO30 ;;If ENTER is pressed - output
#30=1/0(ENTER EXIT, PUSH RESET) ;;If ESC is pressed - full exit from the macro that caused homing.
N402
#189=#[1925+#91] ;;Store the coordinates of the master sensor triggering into a temporary variable.

;;Alignment
N159
IF [#[1519+#41]==0]*[#[1519+#43]==0] GOTO66  ;;If both sensors are triggered, the portal is considered pre-aligned.
;;But this is not a substitute for precise alignment! Because the sensors may be triggered with an error.
#[71+#191]=[#32*2-1]*#31 ;;Determine the direction and distance for one-way P-A.
#121=#[880+#91] ;;Memorize the machine coordinates to the P-A. To calculate the distance of the P-A. It is the machine coordinates that are needed, not the triggering moment.
IF #[1519+#41]==0 GOTO67 ;;If the master sensor is triggered, go to 67.
IF #[1519+#43]==0 GOTO69 ;;If the slave sensor is triggered, skip to 69.
#1505=-5000(Ports set incorrectly!)
IF #1505==1 GOTO30 ;;If ENTER is pressed, exit.
#30=1/0(EARLY EXIT, PRESS RESET) ;;If ESC is pressed - full exit from the macro that caused the homing.

N69
#[988+#2]=5 ;;Disable the WEDOM driver (set the setting to out of axis range).
G91G31X#71Y#72Z#73A#74B#75C#76 F#20 P#41 L0 K0 Q1 ;;P-A for main side
#[988+#2]=#91 ;;Enable the HEAD driver. 
#36=-1 ;;If we drive the main side, the minus corrector of the main side, will reduce the total gantry alignment (bending) distance.
GOTO68

N67
#[988+#91]=5 ;;Disable the main driver (set to out of axis range).
G91G31X#71Y#72Z#73A#74B#75C#76 F#20 P#43 L0 K0 Q1 ;;P-A for slave side.
#[988+#91]=#91 ;;Enable the main driver. 
#36=1 ;;If we drive the slave side, the plus corrector of the main side will increase the total gantry alignment (bending) distance.
N68
IF #[1920+#91]>=2 GOTO66 ;;If the sensor is not found at the specified distance - output
#1505=-5000(P-A distance exceeded 1!)
IF #1505==1 GOTO30 ;;If ENTER is pressed - output
#30=1/0(EARLY EXIT, PUSH RESET) ;;If ESC is pressed - full exit from the macro that caused the homing.

N66 
#35=ABS[#121-#[1925+#91]] ;;Transfer the alignment distance to a variable
IF #26==1 GOTO155 ;; Fine alignment is enabled, go to the branch. P-A does NOT count for the 1st lead. Because the gantry deformation changes the position of the sensors.

;;If the exact alignment is off, use the correctors.

IF #35+#34*#36<=#31 GOTO222 ;;If the alignment distance plus the main axis corrector is less than or equal to the max. alignment distance, go to 222 (#36=-1 if the drive side and +1 if the driven side).
#1505=-5000 (P-A distance exceeded 2!)
IF #1505==1 GOTO30 ;;If ENTER is pressed, exit.
#30=1/0(ENTER EXIT, PUSH RESET) ;;If ESC is pressed - full exit from the macro that caused the homing.
N222

#[880+#91]= #[880+#91]-#[1925+#91]+#[735+#91] ;;If the FA is off - reset the main side of the axis to zero, taking into account the configured offset of homing. 
#[71+#191]=[1-#32*2]*#34 ;;Determine the direction and distance to correct the main side alignment 
#[988+#2]=5 ;;Disable the SLAVE driver (set to out of axis range).
G91G31X#71Y#72Z#73A#74B#75C#76 F#563 P#62 L0 K0 Q1 ;;Move the main side by the correction value. G31 rather than G0 to avoid reacting to the limit. If the home side is a limit.
#[988+#2]=#91 ;;Enable the SLAVE driver. 
GOTO73 ;;If FA is off, go to Mach position after "axle" go home
;;End of "Pre-alignment" function.
;;---------------------------------------------------------------------------------

;;Start of the "Fine Alignment" function
;; First approach
N150 #[71+#191]=[#32*2-1]*#49 ;;Determine the direction and distance of the 1st approach of the FA.
G91G31X#71Y#72Z#73A#74B#75C#76 F#22 P#45 L0 K1 Q#63 ;;First FA feeder with abrupt stop, search by master sensor, consider limit
IF #[1920+#91]==2 GOTO155 ;;If you have arrived at the homing, go to 155
;;Important! If the sensor serves as both limit and homing, it still outputs 2.
#1505=-5000(No homing sensor found 4!) 
IF #1505==1 GOTO30 ;;If you have arrived at a limit that is not a homing, or have not reached the sensor, and ENTER is pressed, exit.
#30=1/0 (ENTER EXIT, PRESS RESET) ;;If ESC is pressed - full exit from the macro that caused the homing.
N155 G4P#65 ;;Pause to calm down. If the machine is wobbly, allows you to increase the accuracy of the homing.
#[71+#191]=[#32*2-1]*#53 ;;Determine the direction and distance of the non 1st approach of FA and diverter
IF [#37>1]*[#54==1] GOTO210 ;;If the number of cycles is greater than 1 and the coord. of the 1st approach are not counted, then we do not add the coordinates of the homing, do not increase the number of the productive cycle, do not check the contacts. But increase the total cycle number.
GOTO[208+#113] ;;If there are less than 2 leads, or the 1st lead is counted, then we switch to checking the contacts, or to diverting without increasing the counters, if the sensor is already triggered.

;;Start of the homing cycle of the "Fine Alignment" function.
;;---------------------------------------------------------------------------------
;;---------------------------------------------------------------------------------
N207 G91G31X#71Y#72Z#73A#74B#75C#76 F#20 P#45 L0 K0 Q1 ;;Not the first FA feed with an abrupt stop, do not count the limit
IF #[1920+#91]>=2 GOTO208 ;;If arrived at a homing sensor - go to N208
#1505=-5000(Homing sensor not found 3!) 
IF #1505==1 GOTO30 ;;If the sensor is not found at the given distance or if we have arrived at a limit that is not homing and ENTER is pressed - exit
#30=1/0 (ENTER EXIT, PRESS RESET) ;;If ESC is pressed - full exit from the macro that caused the homing.

N208 IF [#50==0]+[#108==1] GOTO211 ;;If contact verification is disabled, or the submarine is not the first, jump the verification.

;;Start of the contact check algorithm
;;The while-do-end loop is 40% faster than the IF-GOTO-N loop. And faster than just repeating lines by a factor of 2.
WHILE #112<70 DO2
#112 = #112+ABS[#[1519+#45]-1]+10 ;;Invert the port state (because it outputs 0 when closed). And add it to the counter variable.
END2
#108=1 ;;Toggle the contact check flag
IF #112-70>=7 GOTO211 ;;If a good contact is detected, proceed to the tap.
#1505=-5000(Bad contact detected!)
;;End of contact checking algorithm

N211 #300=#300+#[1925+#91] ;;Add the machine coordinates found to #300. 
#[2100+#111]=#[1925+#91] ;;Store the found machine position of this homing cycle in the range of variables #2100 - #2104. Each cycle is a new variable.
#111=#111+1 ;;Increase the informative cycle number
N210 #321=#321+1 ;;Increase the total cycle number

N209 G91G31X-#71Y-#72Z-#73A-#74B-#75C-#76 F#563 P#45 L1 K0 Q0 ;;Cycle until the sensor is turned off at speed G0, with a soft stop, ignoring the limit (otherwise it will not work if there is 1 sensor for homing and limit).

IF #321<#37 GOTO207 ;;If the number of cycles is not reached, start the homing cycle again.
;;---------------------------------------------------------------------------------
;;---------------------------------------------------------------------------------
;;End of the homing cycle of the "Fine Alignment" function.

;;Check max. error
IF [#617<=0]+[#37==1]+[#37==2]*[#54==1] GOTO225 ;;If the max. error distance check of the homing error is disabled, or if 1 feeder or 2 feeders and the coord. 1st approach is not counted, go to N225.
#[2099+#606]=#[2099+#606-1*#54] ;;Fill in the missing error calculation variable if the 1st feed was not counted.
#2105=10+#99 ;;Pass the axis number to the variable that checks the max error. !!!This may fail under certain conditions!!!
#[2111+#99]=#2106 ;;Store in the variable the max. error at the last homing, for statistics.
#[2800+#99]=#[2800+#99]+#2106 ;;Increase the value of the cumulative variable, for the statistics
#[2808+#99]=#[2808+#99]+1 ;;Increase the value of the counter variable, for statistics.
IF #2105==0 GOTO225 ;;If the error distance is not exceeded, go to N225 (if it is, #2105=1).
#25=0 ;;Turn off Pre-alignment, because if it comes to here, it is already done.
#27=0 ;;Turn off fast feed.
#50=0 ;;Turn off contact checking.
#22=#20 ;;Make the 1st homing speed equal to the second.
#54=0 ;;Take into account the coordinates of the 1st approach.
IF #16==1 GOTO2 ;;If auto-restart is enabled, start over.
#[1515+#91]=0 ;;Toggle the homing indicator after loading
#1510=#99+1 
#1511=#2106 
#1505=-5000(Axis error[%.0f]=%.3fmm. ESC-output. ENTER-repeat).
IF #1505==1 GOTO2 ;;If ENTER is pressed, start the program from the beginning.
#30=1/0(ENTER EXIT, PRESS RESET) ;;If ESC is pressed, exit the macro that caused the homing.
GOTO30 ;;If ESC is pressed, exit the program.
N225

;;Switching side. Second slave.
IF #47!=0 GOTO56 ;;If the 2nd (slave) side was homing, jump to the main side procedure
#[880+#91]= #[880+#91]-[#300/#111]+#[735+#91] ;;Reset the mach. position of the double axis to zero, taking into account the adjusted homing offset and the arithmetic mean of the cycles.
#45=#43 ;;Redirect the slave sensor port to a variable.
#47=1 ;;Switch the master side homing progress bar.
#99=#2 ;;Transfer the slave axis number to the variable for error calculation.
#211=0 ;;Zeroize the coordinate accumulation variable by approach
#321=0 ;;Zero the counter of the total number of approaches
#111=0 ;;Reset the counter of the number of informative leads to zero
#108=0 ;;Zero the contact check flag
#300=0 ;;Zero the coordinate accumulation variable
#1503=1000 ;;Clear the status line
IF #[1519+#43]==0 GOTO209 ;;If the slave sensor is triggered, proceed to the tap without incrementing the counters.
GOTO207 ;;If the slave sensor is not triggered, go to the tap
N56

;;Alignment
#[71+#191]=-[[#300/#111]-#[735+#91]]+#34 ;;Determine the alignment direction and distance, taking into account the adjusted homing offset and found arithmetic mean of the cycles, and the main side alignment corrector.
IF ABS[#[71+#191]+#35*#36]<=#31 GOTO57  ;;Check the gantry alignment distance, calculate the alignment corrector and the Pre-alignment.
#1505=-5000(FA distance exceeded!)
IF #1505==1 GOTO30 ;;If ENTER is pressed, exit.
#30=1/0 (PRESET EXIT, PRESS RESET) ;;If ESC is pressed - full exit from the macro that caused the homing.
GOTO30
N57
#[988+#2]=5 ;;Disable the SLAVE driver (the one that was homing second).
G91G31X#71Y#72Z#73A#74B#75C#76 F#563 P#62 L0 K0 Q1;;Align. G31 rather than G0 to avoid reacting to the limit. If homing is a limit.
#[988+#2]=#91 ;;Enable the SLAVE driver (which was homing second)
;;It is important for us that the found coordinates of the master side are accurate (not drifting away), relative to the master sensor. Therefore, we disable the slave driver. Because, the main one is already set and its coordinates will be recorded when moving. And if we disable the main side, the coordinates would change, but the main axis would not move. And the position of the master sensor would be off.
;; Then the master side will go back to where it should be, with Mach position function after "axle" go home
N73
;;End of the "Fine Alignment" function
;;---------------------------------------------------------------------------------
;;Mach position after "axle" go home.
#1618=1 ;;Switching the homing indicator after loading and making the rotary axles rotate again.
IF [[#[622+#91]-#[735+#91]]*[1-#32*2]>=0]+[#91>2] GOTO140 ;;Check position. Does not fly into the sensor when moving to a pose after homing. For rotary axes, do not check.
;;It is important to check the position now, not at the beginning. If it is not correct and go out at the beginning, the Z homing will not be done. And problems can occur.
#1510=622+#91-500
#1511=735+#91-500
#1505=-5000(Setting 0%.0f or 0%.0f is not correct!).
IF #1505==1 GOTO30 ;;If ENTER is pressed, exit.
#30=1/0 (ENTER EXIT, PRESS RESET) ;;If ESC is pressed - full exit from the macro that caused the homing.
N140
#[71+#191]=#[622+#91]-#[880+#91] ;;Determine direction and distance Mach position after "axle" go home
IF #91>2GOTO556
G91G31X#71Y#72Z#73A#74B#75C#76 F#563 P#62 L0 K0 Q1 ;;Go to coordinates. For linear axes. G31 rather than G0 to avoid reacting to the limit. If the homing is a limit.
GOTO312
N556
G91G0X#71Y#72Z#73A#74B#75C#76 ;;Going to coordinates. For rotary axes
;;---------------------------------------------------------------------------------

N312 #[1515+#91]=1 ;;Switch the axis lock indicator.

N30 ;;End of the homing program
