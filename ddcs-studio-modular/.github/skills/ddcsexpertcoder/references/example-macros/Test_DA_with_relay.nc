#2070=60(Master sensor port number:)
#2070=61(Slave sensor port number:)
#2070=62(Common port number:)
#2070=63(Relay port number:)

IF #62!=0 GOTO1
#1=0
N1

WHILE [#[1519+#60]==1]+[#[1519+#62]==1] DO1
#1503=-3000(Activate master sensor)
END1

#1505=-5000(Master sensor is operational.)

WHILE [#[1519+#61]==1]+[#[1519+#62]==1] DO2
#1503=-3000(Activate slave sensor.)
END2

#1505=-5000(Slave sensor is operational.)

G4P1000
#2038=0
IF #63==0 GOTO2
WHILE #2038==0 DO3
#1503=-3000(Relay test, press any key to exit).
#[1551+#63]=1
G4P200
#[1551+#63]=0
G4P200
END3
N2

