/**
 * DDCS Studio Code Snippets
 * Pre-defined G-code templates for common operations
 */

export const SNIPPETS = {
    safe_z: `( Safe Z Retract - DDCS Compliant )\n#99=0\nG53 Z#99`,
    
    probe: `( Smart Probe - DDCS Compliant )\nG91\nG31 Z-10 F100 P3 L0 Q1\nIF #1922!=2 GOTO1\n#1505=-5000(Contact!)\nGOTO2\nN1\n#1505=1(Miss!)\nN2\nG90\nM30`,
    
    wash: `+0`
};
