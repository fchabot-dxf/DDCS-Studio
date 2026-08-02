(S5k - the BARE increment, no brackets, exactly as the factory writes it. No loop, cannot hang.)
(S5i tests the BRACKETED form. This tests the factory's unbracketed form. Together they say)
(which assignment style this parser accepts, which is what decides whether S5d could ever exit.)
(NO MOTION. READ #190 - 2 means the bare increment works.)
(0 or -99999 or an error means it does not, and that alone explains the S5d freeze.)
#190 = -99999
#191 = 0
#191=#191+1
#191=#191+1
#190 = #191
M30
