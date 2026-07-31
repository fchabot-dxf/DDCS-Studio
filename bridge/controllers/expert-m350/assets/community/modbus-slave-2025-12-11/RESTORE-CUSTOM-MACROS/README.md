# RESTORE THESE AFTER THE 2026-04-10 FLASH (urgent before next full homing)
The firmware install reverted three CUSTOM system macros to factory. These are the user's
December-2025 versions (dual-gantry homing sync). Copy all three onto the controller SYSDISK
(overwrite), same route as any system file. What they restore:
- fndzero.nc: home Z/X/Y with A as slave + SYNC A to Y (#883=#881) + mark A homed (#1518=1).
  The factory version homes all five axes independently - NO gantry sync.
- sysstart.nc: the same sync at startup after M115 homing.
- mdi.nc: the user MDI hook (#1505=#470; factory writes #571=1).
Verify after copying: power-cycle, home, and confirm the HOMING COMPLETE - A SYNCED message.
