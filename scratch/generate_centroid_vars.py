import sys
import re

def main():
    lines = []
    with open('c:/Users/danse/APPS/ddcs-studio-project/scratch/centroid_vars_full.txt', 'r', encoding='utf-8') as f:
        lines = [line.strip() for line in f.readlines() if line.strip() and not line.startswith('--- PAGE')]
    
    out = []
    
    # We'll just build it manually from the text since parsing is brittle
    csv = [
        ("1-3", "R/W", "Macro arguments A-C", ""),
        ("4-6", "R/W", "Macro arguments I-K (1st set)", ""),
        ("7-9", "R/W", "Macro arguments D-F or 2nd set of I-K", ""),
        ("10", "R/W", "3rd I (G is invalid)", ""),
        ("11", "R/W", "Macro argument H or 3rd J", ""),
        ("12", "R/W", "3rd K (L is invalid)", ""),
        ("13", "R/W", "Macro argument M or 4th I", ""),
        ("14", "R/W", "4th J (N is invalid)", ""),
        ("15", "R/W", "4th K (O is invalid)", ""),
        ("16", "R/W", "5th I (P is invalid)", ""),
        ("17-18", "R/W", "Macro argument Q-R or 5th J-K", ""),
        ("19-21", "R/W", "Macro arguments S,T,U or 6th set of I-K", ""),
        ("22-24", "R/W", "Macro arguments V,W,X or 7th set of I-K", ""),
        ("25-27", "R/W", "Macro arguments Y,Z or 8th set of I-K", ""),
        ("28-30", "R/W", "9th set of I-K", ""),
        ("31-33", "R/W", "10th set of I-K", ""),
        ("100-149", "R/W", "User variables", ""),
        ("150-159", "R/W", "Nonvolatile user variables", ""),
        ("300-399", "R/W", "User string variables", ""),
        ("2400, 2401-2418", "R/W", "Active WCS, WCS #1-18 CSR angles", ""),
        ("2500, 2501-2518", "R/W", "Active WCS, WCS #1-18 Axis 1 values", ""),
        ("2600, 2601-2618", "R/W", "Active WCS, WCS #1-18 Axis 2 values", ""),
        ("2700, 2701-2718", "R/W", "Active WCS, WCS #1-18 Axis 3 values", ""),
        ("2800, 2801-2818", "R/W", "Active WCS, WCS #1-18 Axis 4 values", ""),
        ("2900, 2901-2918", "R/W", "Active WCS, WCS #1-18 Axis 5 values", ""),
        ("3000, 3001-3018", "R/W", "Active WCS, WCS #1-18 Axis 6 values", ""),
        ("3100, 3101-3118", "R/W", "Active WCS, WCS #1-18 Axis 7 values", ""),
        ("3200, 3201-3218", "R/W", "Active WCS, WCS #1-18 Axis 8 values", ""),
        ("3901", "R/W", "Parts Cut (Part #)", ""),
        ("3902", "R/W", "Parts Required (Part Cnt)", ""),
        ("4001", "R/O", "Move mode", "0.0 (rapid) or 1.0 (feed)"),
        ("4003", "R/O", "Positioning mode", "90.0 (abs) or 91.0 (inc)"),
        ("4006", "R/O", "Units of measure", "20.0 (inches) or 21.0 (metric)"),
        ("4014", "R/O", "WCS", "54.0-71.0 (WCS#1-18)"),
        ("4109", "R/O", "Feedrate (F)", ""),
        ("4119", "R/O", "Spindle Speed (S)", ""),
        ("4120", "R/O", "Tool Number (T)", ""),
        ("4121", "R/O", "Current height offset number (H)", ""),
        ("4122", "R/O", "Current diameter offset number (D, mill only)", ""),
        ("4201", "R/O", "Job processing state", "0 = normal, 1 = graph"),
        ("4202", "R/O", "Job Search mode", "0 = off, 1 = line, 2 = block, 3 = tool, 4 = resuming"),
        ("4203", "R/O", "Tool in spindle", ""),
        ("5021-5028", "R/O", "Machine Position", "axis 1 = 5021, axis 2 = 5022, etc."),
        ("5041-5048", "R/O", "Current Position", "axis 1 = 5041, axis 2 = 5042, etc."),
        ("9000-9399", "R/O", "Parameter values 0 - 399", ""),
        ("9900-9999", "R/O", "Parameter values 900 - 999", ""),
        ("10000", "R/W", "Mill: Height offset amount, active H", ""),
        ("10001-10200", "R/W", "Mill: Height offset amount, H001-H200", ""),
        ("11000", "R/W", "Mill: Diameter offset amount, active D", ""),
        ("11001-11200", "R/W", "Mill: Diameter offset amount, D001-D200", ""),
        ("12000", "R/W", "Mill: Tool H number, active tool (T)", ""),
        ("12001-12200", "R/W", "Mill: Tool H number, tools 1-200", ""),
        ("13000", "R/W", "Mill: Tool D number, active tool (T)", ""),
        ("13001-13200", "R/W", "Mill: Tool D number, tools 1-200", ""),
        ("14000", "R/W", "Mill: Tool coolant, active tool (T)", ""),
        ("14001-14200", "R/W", "Mill: Tool coolant, tools 1-200", ""),
        ("15000", "R/W", "Mill: Tool spindle direction, active tool (T)", ""),
        ("15001-15200", "R/W", "Mill: Tool spindle direction, tools 1-200", ""),
        ("16000", "R/W", "Mill: Tool spindle speed, active tool (T)", ""),
        ("16001-16200", "R/W", "Mill: Tool spindle speed, tools 1-200", ""),
        ("17000", "R/W", "Mill: Tool bin number, active tool (T)", ""),
        ("17001-17200", "R/W", "Mill: Tool bin number, tools 1-200", ""),
        ("18000", "R/W", "Mill: Tool putback, active tool (T)", ""),
        ("18001-18200", "R/W", "Mill: Tool putback, tools 1-200", ""),
        ("19000", "R/W", "Tool Life Data: Tool T1 Tool Type", ""),
        ("19001", "R/W", "Tool Life Data: Tool T1 Total Life", ""),
        ("19002", "R/W", "Tool Life Data: Tool T1 Used Life", ""),
        ("19003", "R/W", "Tool Life Data: Tool T1 Units", ""),
        ("19004", "R/W", "Tool Life Data: Tool T1 Update Mode", ""),
        ("19005-19009", "R/W", "Tool Life Data for Tool T2", ""),
        ("19010-19014", "R/W", "Tool Life Data for Tool T3", ""),
        ("19015-19999", "R/W", "Tool Life Data for Tools T4 through T200", ""),
        ("20001-20008", "R/O", "max rate for axes 1-8", ""),
        ("20101-20108", "R/O", "label for axes 1-8", ""),
        ("20201-20208", "R/O", "slow jog for axes 1-8", ""),
        ("20301-20308", "R/O", "fast jog for axes 1-8", ""),
        ("20401-20408", "R/W", "screw pitch for axes 1-8", ""),
        ("20501-20508", "R/O", "lash comp for axes 1-8", ""),
        ("20601-20608", "R/O", "counts per unit for axes 1-8", ""),
        ("20701-20708", "R/O", "accel time for axes 1-8", ""),
        ("20801-20808", "R/O", "deadstart velocity for axes 1-8", ""),
        ("20901-20908", "R/O", "delta vmax for axes 1-8", ""),
        ("21001-21008", "R/O", "counts per turn for axes 1-8", ""),
        ("21101-21108", "R/O", "minus limit for axes 1-8", ""),
        ("21201-21208", "R/O", "plus limit for axes 1-8", ""),
        ("21301-21308", "R/O", "minus home for axes 1-8", ""),
        ("21401-21408", "R/O", "plus home for axes 1-8", ""),
        ("21501-21508", "R/O", "reversed for axes 1-8", ""),
        ("21601-21608", "R/O", "laser comp for axes 1-8", ""),
        ("21701-21708", "R/O", "proportional for axes 1-8", ""),
        ("21801-21808", "R/O", "integration limit for axes 1-8", ""),
        ("21901-21908", "R/O", "kg for axes 1-8", ""),
        ("22001-22008", "R/O", "integral for axes 1-8", ""),
        ("22101-22108", "R/O", "kv1 for axes 1-8", ""),
        ("22201-22208", "R/O", "derivative for axes 1-8", ""),
        ("22301-22308", "R/O", "ka for axes 1-8", ""),
        ("22401-22408", "R/O", "num motor poles for axes 1-8", ""),
        ("22501-22508", "R/O", "drive current for axes 1-8", ""),
        ("22601-22608", "R/O", "drive offset angle for axes 1-8", ""),
        ("22701-22708", "R/O", "pwm kp for axes 1-8", ""),
        ("22801-22808", "R/O", "pwm ki for axes 1-8", ""),
        ("22901-22908", "R/O", "pwm kd for axes 1-8", ""),
        ("23001-23008", "R/O", "abrupt kp for axes 1-8", ""),
        ("23101-23108", "R/O", "feed forward kp for axes 1-8", ""),
        ("23201-23208", "R/O", "max error (PID) for axes 1-8", ""),
        ("23301-23308", "R/O", "min error (PID) for axes 1-8", ""),
        ("23401-23408", "R/O", "at index pulse for axes 1-8", ""),
        ("23501-23508", "R/W", "travel minus for axes 1-8", ""),
        ("23601-23608", "R/W", "travel plus for axes 1-8", ""),
        ("23701-23708", "R/O", "axis home set for axes 1-8", ""),
        ("23801-23808", "R/O", "abs position (encoder counts) for axes 1-8", ""),
        ("23901-23908", "R/O", "PID out for axes 1-8", ""),
        ("24001-24008", "R/O", "reference set for axes 1-8", ""),
        ("24101-24108", "R/O", "Axis reference value for axes 1-8", ""),
        ("24201-24208", "R/O", "tilt table level offsets for axes 1-8", ""),
        ("24301-24308", "R/O", "dsp positions for axes 1-8", ""),
        ("24401-24408", "R/O", "abs position (encoder counts) for axes 1-8", ""),
        ("24501-24508", "R/O", "dsp positon in local cooridinates for axes 1-8", ""),
        ("24601-24608", "R/O", "local probing +limit position for axes 1-8", ""),
        ("24701-24708", "R/O", "local probing -limit position for axes 1-8", ""),
        ("24801-24808", "R/O", "probe stylus compensation amount for axes 1-8", ""),
        ("24901-24908", "R/O", "servo controlled axis indicator for axes 1-8", ""),
        ("25000", "R/O", "DRO display units", ""),
        ("25001", "R/O", "default units of measure", ""),
        ("25002", "R/O", "PLC type", ""),
        ("25003", "R/O", "console type", ""),
        ("25004", "R/O", "jog panel optional", ""),
        ("25005", "R/O", "min spin high", ""),
        ("25006", "R/O", "max spin high", ""),
        ("25007", "R/O", "home at powerup", ""),
        ("25008", "R/O", "screen blank time", ""),
        ("25009", "R/O", "Displayed / Calculated spindle speed", ""),
        ("25010", "R/O", "current spindle position (in counts)", ""),
        ("25011", "R/O", "dsp time (in seconds)", ""),
        ("25012", "R/O", "time (in seconds)", ""),
        ("25013", "R/O", "clear max/min PID errors", ""),
        ("25014", "R/O", "software type (Mill/Lathe)", ""),
        ("25015", "R/O", "feedrate override", ""),
        ("25016", "R/O", "spindle override", ""),
        ("25017", "R/O", "OS", ""),
        ("25018", "R/O", "CNC series number", ""),
        ("25019", "R/O", "Software version number", ""),
        ("25020", "R/O", "Software Beta revision number", ""),
        ("25021", "R/O", "Digitizing boundary hit", ""),
        ("25022", "R/O", "last M115/116/125/126 probe trip", ""),
        ("25023", "R/O", "Drive type", ""),
        ("25101-25108", "R/O", "Encoder counts away from index pulse for axes 1-8", ""),
        ("26001-26008", "R/O", "dsp mechanical machine positions for axes 1-8", ""),
        ("26101-26108", "R/O", "dsp mechanical local positions for axes 1-8", ""),
        ("26201-26208", "R/O", "local + travel limit position for axes 1-8", ""),
        ("26301-26308", "R/O", "local - travel limit position for axes 1-8", ""),
        ("26401-26404", "R/O", "Axis 1 reference points 1-4", ""),
        ("26501-26504", "R/O", "Axis 2 reference points 1-4", ""),
        ("26601-26604", "R/O", "Axis 3 reference points 1-4", ""),
        ("26701-26704", "R/O", "Axis 4 reference points 1-4", ""),
        ("26801-26804", "R/O", "Axis 5 reference points 1-4", ""),
        ("26901-26904", "R/O", "Axis 6 reference points 1-4", ""),
        ("27001-27004", "R/O", "Axis 7 reference points 1-4", ""),
        ("27101-27104", "R/O", "Axis 8 reference points 1-4", ""),
        ("27201-27208", "R/O", "ACDC drive estimated brake wattage for axes 1-8", ""),
        ("27301-27308", "R/O", "Real motor encoder positions for axes 1-8", ""),
        ("27401-27408", "R/O", "Scale encoder positions for axes 1-8", ""),
        ("29000-31999", "R/W", "User variables", ""),
        ("32000-34999", "R/W", "Reserved for internal use", ""),
        ("50001-51312", "R/O", "PLC Inputs 1-1312", ""),
        ("60001-61312", "R/O", "PLC Outputs 1-1312", ""),
        ("70001-71024", "R/O", "PLC Memory Bits 1-1024", ""),
        ("80001-89999", "R/O", "Reserved", ""),
        ("90001-90064", "R/O", "Timer 1-64 status bits", ""),
        ("93001-93256", "R/O", "Stage 1-256 status bits", ""),
        ("94001-94256", "R/O", "Fast Stage 1-256 status bits", ""),
        ("96001-96044", "R/O", "W1-W44 (32-bit signed integers)", ""),
        ("97001-97022", "R/O", "DW1-DW22 (64-bit signed integers)", ""),
        ("98001-98044", "R/O", "FW1-FW44 (32-bit floats)", ""),
        ("99001-99022", "R/O", "DFW1-DFW22 (64-bit floats)", "")
    ]

    with open('c:/Users/danse/APPS/ddcs-studio-project/DDCS-Studio/web/data/default_vars_centroid.js', 'w', encoding='utf-8') as f:
        f.write("export const DEFAULT_VAR_CSV_CENTROID = `\n")
        for row in csv:
            desc = row[2].replace('"', '""')
            notes = row[3].replace('"', '""')
            id_str = row[0]
            
            def parse_part(part):
                part = part.strip()
                if '-' in part:
                    s, e = part.split('-')
                    return list(range(int(s), int(e) + 1))
                else:
                    return [int(part)]
            
            if ',' in id_str or '-' in id_str:
                all_ids = []
                for p in id_str.split(','):
                    all_ids.extend(parse_part(p))
            else:
                all_ids = [id_str]
                
            for v_id in all_ids:
                f.write(f'"{v_id}","{row[1]}","{desc}","{notes}"\n')
        f.write("`;\n")

if __name__ == '__main__':
    main()
