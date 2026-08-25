( Applies the tool length offset for H01 and holds so the Z reading can be compared. )
( Contains the G43 instruction on its own, because no file on this controller has used it before. )
( Commands no motion. )

G43 H1

#1505 = -5000(G43 H1 ran - read Z on the screen)
G04 P5.0

M30
