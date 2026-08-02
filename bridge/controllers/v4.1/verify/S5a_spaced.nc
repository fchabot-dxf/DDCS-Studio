(S5a - does the DDCS V4.1 macro parser accept Studios SPACED multi-word style. ONE risky form per file.)
(t1536 t1538. The factory corpus is uniformly unspaced, e.g. G91G31Z-1000L#682Q1K0F#106, probe-float.nc.)
(Studio emits SPACED, e.g. G91 G31 Z-1000 L#682 Q1 K0 F#106, words.js shared policy. The user has already)
(confirmed spaced G-code runs on THIS bench unit -- USER-ATTESTED tier, see data portingArc.js)
(V41_SPACING_DELTA. This file exists to upgrade that to a BENCH-CONFIRMED result, the strongest tier the)
(trigEvidence discipline recognises.)

(NO MOTION. Two spaced, already-inert G-words -- G90, an absolute-distance mode select with no coordinate)
(word, and G04 P0, a zero-length dwell, the exact form Experts own kit uses for its own inert probes.)
(Nothing is saved because nothing is changed.)

(HOW TO READ THE RESULT -- read #190, see README.md for both the on-screen and the SMB uservar path.)
(  #190 EQ 100 -- SPACED multi-word G-code PARSED AND RAN. The user-attested answer is now bench-confirmed.)
(  #190 EQ -99999, the sentinel, unchanged, with a SYNTAX ERROR -- the spaced form was REJECTED. Note the)
(    line number the controller names. That is a real, useful answer -- it means Studios spacing choice)
(    needs to change for this target, not that the test failed.)

(Prime -- a value no correct run can leave behind)
#190 = -99999

(The probe -- two spaced words, no coordinate word, no motion)
G90 G04 P0

(Reached the end)
#190 = 100

M30
