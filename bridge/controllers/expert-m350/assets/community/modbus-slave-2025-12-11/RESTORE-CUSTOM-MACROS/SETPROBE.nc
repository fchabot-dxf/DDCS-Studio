( Fixed-probe config: input port, level, fast first probe, only 2 touches )
( sysstart runs these at boot; kept here to run manually / for the record )
#1075 = 2      ( fixed probe input port = IN02 )
#1077 = 1      ( fixed probe level )
#632 = 800     ( first-probe feed - fast find )
#631 = 2       ( detection times - fast find plus one accurate re-probe )
#1510 = #632
#1511 = #631
#1505 = -5000(1st feed=%.0f  touches=%.0f  reprobe~80)
M30
