## RC version! Still Under progress...
- Use at your own risk!
- Works with UCCNC v1.2117 (not v1.2113 because some tooltable commands are missing).
- Requires the Default2019 screenset and macros.

---

##### Changelog
> **2024.12.02**
> - Added Macro Description in README.md file.
> - Some comments translated to English (still contain Romanian comments, sorry).

---

##### HTM_ATC macros
- **Macroloops** (add them into macroloops):
  - [M20100](/Profiles/Macro_HTM/M20100.txt) - Float formatting macroloop - getting the Position DROs decimals (updown field 195) from Settings->Gen.Setup page.
  - [M20101](/Profiles/Macro_HTM/M20101.txt) - Read LEDs status for input pins (slot sensors, OSSD inputs).

- **Macros** (add them into macroloops):
  - [M20131](/Profiles/Macro_HTM/M20131.txt) - Not used anymore, kept for reference only - old macro for tool edit.
  - [M20200](/Profiles/Macro_HTM/M20200.txt) - ATC Setup page - ***Along X*** button - changes the rack orientation parallel with the X axis.
  - [M20201](/Profiles/Macro_HTM/M20201.txt) - ATC Setup page - ***Along Y*** button - changes the rack orientation parallel with the Y axis.
  - [M20202](/Profiles/Macro_HTM/M20202.txt) - ATC Setup page - ***Slot Sensors ON/OFF*** button - enables/disables slot sensors.
  - [M20203](/Profiles/Macro_HTM/M20203.txt) - ATC Setup page - ***Air Blow ON/OFF*** button - enables/disables air blow during TC operation (dedust).
  - [M20330](/Profiles/Macro_HTM/M20330.txt) - ATC Setup page - ***Measure TCP-TP position*** button - needs the Reference tool with known length as reference.
  - [M20331](/Profiles/Macro_HTM/M20331.txt) - Macro for measuring tools in TCP. **M20330** must be run first (once per setup). It is called by M6 and M20405.
  - [M20400](/Profiles/Macro_HTM/M20400.txt) - ATC Page - macro for handling the ***Edit Tool*** fields. Called by ***PLUS*** and ***MINUS*** buttons for tool selection.
  - [M20401](/Profiles/Macro_HTM/M20401.txt) - ATC Page ***Edit Tool*** fields - ***PLUS*** button for tool selection. Calls M20400 for next tool number selection (+1).
  - [M20402](/Profiles/Macro_HTM/M20402.txt) - ATC Page ***Edit Tool*** fields - ***MINUS*** button for tool selection. Calls M20400 for previous tool number selection (-1).
  - [M20403](/Profiles/Macro_HTM/M20403.txt) - ATC Page ***Edit Tool*** fields - ***RH/NRH*** button. Changes the tool type. RH = Repeatable Holder, NRH = Non-Repeatable Holder (needs measurement when loading).
  - [M20404](/Profiles/Macro_HTM/M20404.txt) - ATC Page ***Edit Tool*** fields - ***APPLY*** button. Saves the tool parameters in the tool table.
  - [M20405](/Profiles/Macro_HTM/M20405.txt) - ATC Page ***Edit Tool*** fields - ***Measure Tool*** button. Brings a confirmation dialog for measuring the selected tool.
  - [M20406](/Profiles/Macro_HTM/M20406.txt) - ATC Page - ***Remove Tool*** button. Removes the current tool from the spindle. The tool must be removed manually from the spindle.
  - [M20500](/Profiles/Macro_HTM/M20500.txt) - ATC Page - macro for assigning a specific tool to active slots. Called by ***M20501-M20510*** macros.
  - [M20501](/Profiles/Macro_HTM/M20501.txt) to [M20510](/Profiles/Macro_HTM/M20510.txt) - ATC Page - caller macros for tool assignment. Transparent buttons above T# fields. See ***M20500***.
  - [M20600](/Profiles/Macro_HTM/M20600.txt) - ATC Setup Page - macro called for slot setup. Called by ***M20601-M20610*** macros.
  - [M20601](/Profiles/Macro_HTM/M20601.txt) to [M20610](/Profiles/Macro_HTM/M20610.txt) - ATC Setup Page - caller macros for slot setup. Buttons ***S01-S10***. See ***M20600***.

---

