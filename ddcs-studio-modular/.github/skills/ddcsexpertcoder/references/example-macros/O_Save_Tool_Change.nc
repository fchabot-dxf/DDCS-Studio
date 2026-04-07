(FILENAME: O_Save_Tool_Change.nc)
(ROLE: Saves current machine position to User Variables #1155/#1156)
(DOCUMENTATION: Matches 'Variables-ENG' - User storage Tool Change Park)

(Safety: Prime variables to prevent freeze)
#1155 = 1
#1156 = 1

(Action: Save Current Machine Coordinates)
#1155 = #880    (Save Machine X to Tool Change X)
#1156 = #881    (Save Machine Y to Tool Change Y)

(Feedback)
#1505 = 1 (TOOL CHANGE POS Updated: #1155/56)
M30
