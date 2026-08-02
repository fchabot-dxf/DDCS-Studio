(S5i - does the INCREMENT work. No loop at all, so this CANNOT hang.)
(If S5d froze because the increment silently failed, this is where it shows.)
(NO MOTION. No flow control of any kind.)
(READ #190 - 2 means the increment works and S5d froze for a DIFFERENT reason.)
(0 or -99999 means the increment is what failed, which fully explains S5d.)
#190 = -99999
#191 = 0
#191=[#191+1]
#191=[#191+1]
#190 = #191
M30
