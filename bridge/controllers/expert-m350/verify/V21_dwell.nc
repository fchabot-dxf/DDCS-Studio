(V21 - occupies the controller for thirty real seconds so run-state can be watched)
(G04 P is MILLISECONDS on this controller, so P30000 is 30 s. Earlier macros used P8.0 and dwelled)
(for eight milliseconds, which is why nothing could be observed while they ran.)

(No message and no dialog: a dialog blocks waiting for Enter, which is a paused state rather than)
(a running one, and the two must not be confused.)

(Commands no motion and writes nothing.)

G04 P30000

M30
