(FILENAME: O_Save_Safe_Park.nc)
(ROLE: Saves current machine position to User Variables #1153/#1154)
(DOCUMENTATION: Matches 'Variables-ENG' - User storage Safe Park)

(Safety: Prime variables to prevent freeze)
#1153 = 1
#1154 = 1

(Action: Save Current Machine Coordinates)
#1153 = #880    (Save Machine X to Safe Park X)
#1154 = #881    (Save Machine Y to Safe Park Y)

(Feedback)
#1505 = 1 (SAFE PARK Updated: #1153/54)
M30
