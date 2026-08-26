(V19 - does a MACRO write reach the disk, or only a pendant edit)
(A pendant edit of #131 appeared in SYSDISK/setting immediately. This writes the same parameter from)
(a macro instead, so the only thing that differs between the two cases is who wrote it.)

(#131 is the probing cycle count. The macro address is #631, which is #131 plus 500.)
(It is left at 4 so the disk can be read while the value is live. Set it back to 2 on the pendant)
(afterwards, or run this again after editing the value below.)

(Commands no motion and touches no offset or coordinate.)

(Prime)
#101 = 1

(Read the current value back through the macro address)
#101 = #631

#1510 = #101
#1505 = -5000(V19 cycle count reads %.3f - writing 4)
G04 P4.0

(Write from the macro)
#631 = 4

#1510 = #631
#1505 = -5000(V19 macro now reads %.3f - check the disk before touching anything)
G04 P8.0

M30
