( V15_indent - DOES THE PARSER TOLERATE LEADING WHITESPACE? )
( t1450. Studio's parametric bodies have shipped INDENTED since the first one: a loop body is )
( stepped in by two spaces so a macro reads like the structure it is. Nothing has ever tested )
( whether this controller's parser is happy with that, and the corpus cannot answer it: )
(   MEASURED - 285 captured .nc files, ZERO lines with leading whitespace before a code token. )
( So every factory macro is flush-left. That is not evidence AGAINST indentation - it is the )
( ABSENCE of evidence either way, which is exactly the class of thing this file exists to close. )
( Studio ships indented BY DEFAULT and carries a Settings switch to emit FLUSH; this macro is )
( what decides whether that switch is a preference or a requirement. )
( THIS MACRO CUTS NOTHING AND MOVES NOTHING - it only assigns, loops and reports. )

( HOW TO RUN IT: )
(   1. Run it. Nothing should move; the spindle should not start. )
(   2. Read the two messages it puts up [2 seconds each]. )
( HOW TO READ THE RESULT: )
(   #106 = 100 at the end and the count reads 3 -> INDENTATION IS FINE. The parser ignores )
(          leading spaces in assignments, WHILE/END and IF/GOTO alike. Studio's default stands )
(          and the Settings switch is a preference. )
(   a syntax / unknown-command error -> WRITE DOWN THE LINE NUMBER the controller names, and )
(          match it against the three sections below to see WHICH construct it choked on: )
(            the indented ASSIGNMENT   [section A]  -> spaces break plain assignment )
(            the indented WHILE body   [section B]  -> spaces break loop bodies )
(            the indented IF/GOTO      [section C]  -> spaces break branch lines )
(          then set Settings -> G-CODE OUTPUT -> Indentation to "Flush left". That emits the )
(          identical program with the leading spaces removed - whitespace-only, nothing else )
(          moves - and record the finding in FINDINGS.md so the default can be revisited. )
(   #106 = 100 but the count is NOT 3 -> the lines PARSED but did not all EXECUTE. That would )
(          be the worst outcome and the most important to report: silently skipped indented )
(          lines, which no error message would have told you about. )

( --- sentinels: a value no correct run can leave behind --- )
#100 = -99999
#106 = 0

( --- SECTION A: an indented plain ASSIGNMENT --- )
#100 = 0
  #100 = 1

( --- SECTION B: an indented WHILE body. Two levels, because Studio emits two. --- )
#101 = 0
WHILE [#101 < 3] DO1
  #101 = [#101 + 1]
  IF [#101 > 99] THEN #101 = 0
END1

( --- SECTION C: an indented IF/GOTO and its label --- )
#102 = 0
  IF [#101 == 3] GOTO15
  #102 = -1
N15
  #102 = [#102 + 7]

( --- report: the loop count, then the two guard values --- )
#1510 = #101
#1505 = -5000(V15 indent: loop count=%.0f - expect 3)
G04 P2.0
#1510 = #100
#1511 = #102
#1505 = -5000(V15 indent: A=%.0f C=%.0f - expect 1 and 7)
G04 P2.0

( --- reached the end --- )
#106 = 100
M30
