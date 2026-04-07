/**
 * DDCS Studio - WCS (Work Coordinate System) Wizard
 * Generates G-code for zeroing WCS offsets
 * V9.20 - DDCS Compliant (Direct #805+ writes, NO G10)
 */

// WCSWizard: Generates WCS zeroing G-code. No runtime verifier invoked here to keep generation deterministic.
export class WCSWizard {
    constructor() {
        // WCS base addresses for G54-G59
        this.wcsBaseMap = {
            '54': 805,  // G54
            '55': 810,  // G55
            '56': 815,  // G56
            '57': 820,  // G57
            '58': 825,  // G58
            '59': 830   // G59
        };
    }

    generate(params) {
        const {
            sys,        // WCS system: "0" for auto-detect, or "54"-"59" for specific
            axisX,      // Zero X axis
            axisY,      // Zero Y axis
            axisZ,      // Zero Z axis
            sync,       // Enable dual gantry sync
            slave       // Slave axis: "3" for A, "4" for B
        } = params;

        const auto = (sys === "0");
        
        // Build axis list
        const axes = [];
        if (axisX) axes.push({ axis: "X", offset: 0, var: "#880" });
        if (axisY) axes.push({ axis: "Y", offset: 1, var: "#881" });
        if (axisZ) axes.push({ axis: "Z", offset: 2, var: "#882" });

        let gcode = this.generateHeader();

        if (auto) {
            gcode += this.generateAutoWCS(axes);
        } else {
            gcode += this.generateFixedWCS(sys, axes);
        }

        if (sync) {
            gcode += this.generateDualGantrySync(auto, sys, slave);
        }

        // Generation complete - no verifier run here (verifier module is paused)

        return gcode;
    }

    generateHeader() {
        let header = `( WCS | Direct #805+ writes )\n`;
        header += `( M350 Ready - G10 not used )\n\n`;
        return header;
    }

    generateAutoWCS(axes) {
        let gcode = `( Auto-detect active WCS from #578 )\n`;
        gcode += `#150=#578\n`;
        gcode += `#151=805+[#150-1]*5\n\n`;
        gcode += `( Zero selected axes )\n`;
        
        axes.forEach(a => {
            gcode += `#[#151+${a.offset}]=${a.var}\n`;
        });

        return gcode;
    }

    generateFixedWCS(sys, axes) {
        const wcsIndex = parseInt(sys) - 53;
        const base = 805 + (wcsIndex - 1) * 5;
        
        let gcode = `( Fixed WCS: G${sys} - Base address #${base} )\n`;
        gcode += `( Zero selected axes )\n`;
        
        axes.forEach(a => {
            gcode += `#${base + a.offset}=${a.var}\n`;
        });

        return gcode;
    }

    generateDualGantrySync(auto, sys, slave) {
        const slaveOffset = (slave === "3") ? 3 : 4;
        const slaveChar = (slave === "3") ? "A" : "B";

        let gcode = `\n( Dual Gantry Sync - Slave ${slaveChar} )\n`;
        
        if (auto) {
            gcode += `#152=[#151+${slaveOffset}] ( Base WCS + Slave Offset )\n`;
            gcode += `#[#152]=#88${slave}\n`;
        } else {
            const wcsIndex = parseInt(sys) - 53;
            const base = 805 + (wcsIndex - 1) * 5;
            gcode += `#${base + slaveOffset}=#88${slave}\n`;
        }

        return gcode;
    }

    /**
     * Get WCS system name for display
     */
    getWCSName(sys) {
        if (sys === "0") return "Active WCS";
        return `G${sys}`;
    }

    /**
     * Get WCS base address
     */
    getWCSBase(sys) {
        if (sys === "0") return "Auto-detected";
        return this.wcsBaseMap[sys] || "Unknown";
    }

    /**
     * Validate WCS system number
     */
    isValidWCS(sys) {
        return sys === "0" || (sys >= "54" && sys <= "59");
    }
}
