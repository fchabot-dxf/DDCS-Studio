(V18f - does a bare H01 apply the offset with no G43 anywhere)
(This is the case real programs hit. The Fusion post writes Z15.24H01 on the first Z move and the)
(file contains no G43 at all, so whether the H word alone binds decides whether posted programs)
(carry a live tool offset.)

(A bare H01 block is NOT attested in the corpus - only H01 attached to a Z move - so it sits alone)
(here and a parse error names this line and nothing else.)

(Samples the applied offset before and after. The offset is machine Z minus workpiece Z, which is)
(#882 minus #792. It has read -104.844 in every measurement so far.)

(If this macro stops early, V18b puts H01 back from #2520.)

(Prime)
#111 = 1
#112 = 1

(Keep the current H01 and write a test value)
#2520 = #900
#900 = 10.0

(Sample before)
#111 = [#882 - #792]

H01

(Sample after)
#112 = [#882 - #792]

#1510 = #111
#1511 = #112
#1505 = -5000(V18f before=%.3f afterH01=%.3f)
G04 P8.0

(Put H01 back)
#900 = #2520

#1510 = #900
#1505 = -5000(V18f H01 restored to %.3f)
G04 P4.0

M30
