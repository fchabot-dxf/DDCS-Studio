# DDCS M350 G-Code Verifier Rules

**Purpose**: Implementable validation rules with regex patterns  
**Target**: JavaScript/TypeScript implementation

---

## 1. Error Severity Levels

| Level | Action | Description |
|-------|--------|-------------|
| **ERROR** | Must fix | Will cause syntax error or controller freeze |
| **WARNING** | Should fix | May work but unreliable |
| **INFO** | Optional | Style suggestion |

---

## 2. Critical Errors

### 2.1 Untested Positive Sign Before Variable

**Rule**: `AXIS+#VAR` pattern has NO examples in community macros. Treat as warning.

**IMPORTANT**: `AXIS-#VAR` (negative) DOES work! Verified in:
- macro_cam10.nc: `G91 G31 Z-#1`
- macro_cam11.nc: `G91 G31 Y-#2`, `G91 G31 X-#1`
- macro_cam12.nc: `G91 G31 Y-#2`, `G91 G31 X-#1`
- macro_Adaptive_Pocket.nc: `G1Z-#18`
- macro_Thread_milling.nc: `G0 Z-#190`

```javascript
const UNTESTED_POSITIVE_VAR = {
  // Only flag POSITIVE sign before variable (X+#1)
  // Do NOT flag negative (X-#1) - those work fine!
  pattern: /([XYZAB])\+#(\d+)/g,
  level: 'WARNING',
  message: (match) => `Untested pattern "${match[0]}": No community macro examples of AXIS+#VAR. Consider using brackets or pre-calculated variable.`,
  suggestion: (match) => {
    const axis = match[1];
    const varNum = match[2];
    return `Use ${axis}[#${varNum}] or pre-calculate: #8=#${varNum}, then use ${axis}#8`;
  }
};

// Test cases
// G31 Y+#1  → WARNING (untested)
// G0 X+#2   → WARNING (untested)
// G31 Z-#1  → OK (verified working)
// G0 X-#2   → OK (verified working)
// G31 Y#8   → OK
```

### 2.2 Bracketed Simple IF Conditions

**Rule**: Simple variable comparisons must NOT have brackets.

```javascript
const BRACKETED_SIMPLE_IF = {
  pattern: /IF\s*\[\s*(#\d+)\s*([!=<>]=?)\s*(\d+)\s*\]\s*GOTO/gi,
  level: 'ERROR',
  message: (match) => `Remove brackets from simple IF condition: "IF [${match[1]}${match[2]}${match[3]}]" should be "IF ${match[1]}${match[2]}${match[3]}"`,
  suggestion: (match) => `IF ${match[1]}${match[2]}${match[3]} GOTO`
};

// Test cases
// IF [#1922!=2] GOTO1   → ERROR
// IF [#100<50] GOTO2    → ERROR
// IF #1922!=2 GOTO1     → OK
// IF [#100+#200]>50 GOTO2 → OK (complex expression)
```

### 2.3 Space Before GOTO Label

**Rule**: No space allowed between GOTO and label number.

```javascript
const GOTO_SPACE = {
  pattern: /GOTO\s+(\d+)/gi,
  level: 'ERROR',
  message: (match) => `Remove space before label: "GOTO ${match[1]}" should be "GOTO${match[1]}"`,
  suggestion: (match) => `GOTO${match[1]}`
};

// Test cases
// GOTO 1    → ERROR
// GOTO 999  → ERROR
// GOTO1     → OK
// GOTO99    → OK
```

### 2.4 Direct Persistent Variable Assignment from System Vars

**Rule**: Assigning from #880+ to #1153+ directly causes controller freeze.

```javascript
const PRIMING_VIOLATION = {
  pattern: /#(1[1-5]\d{2}|[2-5]\d{3})\s*=\s*#(88[0-4])/g,
  level: 'ERROR',
  message: (match) => `Variable priming required: "#${match[1]}=#${match[2]}" will freeze controller. Prime through local variable first.`,
  suggestion: (match) => `#100=#${match[2]}\n#${match[1]}=#100`
};

// Test cases
// #1153=#880  → ERROR (freeze)
// #2100=#881  → ERROR (freeze)
// #100=#880   → OK
// #1153=#100  → OK
// #1153=#880+0 → OK (arithmetic wash)
```

### 2.5 G10 Usage (Broken on DDCS)

**Rule**: G10 causes unwanted motion on DDCS M350.

```javascript
const G10_USAGE = {
  pattern: /G10\s+L\d+/gi,
  level: 'ERROR',
  message: () => `G10 is broken on DDCS M350 - causes unwanted motion. Use direct variable writes instead.`,
  suggestion: () => `Replace with direct writes: #805=#880 (G54 X), #806=#881 (G54 Y), etc.`
};

// Test cases
// G10 L2 P1 X0 Y0 Z0  → ERROR
```

### 2.6 G53 with Hardcoded Constants

**Rule**: G53 requires variables, not hardcoded values.

```javascript
const G53_HARDCODED = {
  pattern: /G53\s+([XYZAB])(\d+)/gi,
  level: 'ERROR',
  message: (match) => `G53 requires variables: "G53 ${match[1]}${match[2]}" will fail. Use variable reference.`,
  suggestion: (match) => `#temp=${match[2]}\nG53 ${match[1]}#temp`
};

// Test cases
// G53 X0 Y0 Z0   → ERROR
// G53 X#x Y#y    → OK
```

---

## 3. Warnings

### 3.1 FANUC-Style Operators

**Rule**: C-style operators are reliable, FANUC-style may fail.

```javascript
const FANUC_OPERATORS = {
  pattern: /\b(EQ|NE|LT|GT|LE|GE)\b/g,
  level: 'WARNING',
  message: (match) => `FANUC-style operator "${match[1]}" may be unreliable. Use C-style operator instead.`,
  suggestion: (match) => {
    const map = { EQ: '==', NE: '!=', LT: '<', GT: '>', LE: '<=', GE: '>=' };
    return `Use "${map[match[1]]}" instead of "${match[1]}"`;
  }
};

// Test cases
// IF #100 EQ 5   → WARNING: Use ==
// IF #100 NE 0   → WARNING: Use !=
// IF #100==5     → OK
```

### 3.2 High Label Numbers

**Rule**: Labels with 3+ digits may cause "label not found" errors.

```javascript
const HIGH_LABEL_NUMBERS = {
  pattern: /N(\d{3,})/g,
  level: 'WARNING',
  message: (match) => `High label number N${match[1]} may be unreliable. Prefer single or double digit labels.`,
  suggestion: () => `Use N1-N99 for best reliability`
};

// Test cases
// N100  → WARNING
// N999  → WARNING
// N1    → OK
// N99   → OK
```

### 3.3 G53 with G0/G1 on Same Line

**Rule**: G53 should not be combined with G0/G1 on same line.

```javascript
const G53_WITH_MOTION = {
  pattern: /G53\s+G[01]\s+/gi,
  level: 'WARNING',
  message: () => `G53 combined with G0/G1 on same line may fail.`,
  suggestion: () => `Use G53 alone: "G53 X#x Y#y" (motion mode is automatic)`
};

// Test cases
// G53 G0 X#var  → WARNING
// G53 X#x Y#y   → OK
```

### 3.4 Missing Probe Error Check

**Rule**: G31 should be followed by probe status check.

```javascript
const MISSING_PROBE_CHECK = {
  // Look for G31 not followed by IF #192x check within 3 lines
  pattern: /G31\s+([XYZAB])/gi,
  level: 'WARNING',
  message: (match) => `G31 ${match[1]} probe should be followed by status check.`,
  suggestion: (match) => {
    const statusVar = { X: '#1920', Y: '#1921', Z: '#1922', A: '#1923', B: '#1924' };
    return `Add after G31: IF ${statusVar[match[1]]}!=2 GOTO<error_label>`;
  }
};
```

### 3.5 #2070 Writing to Invalid Range

**Rule**: #2070 input can only write to #50-#499.

```javascript
const INPUT_INVALID_RANGE = {
  pattern: /#2070\s*=\s*(\d+)/g,
  level: 'WARNING',
  validate: (match) => {
    const targetVar = parseInt(match[1]);
    return targetVar < 50 || targetVar > 499;
  },
  message: (match) => `#2070=${match[1]} may fail silently. #2070 can only write to #50-#499.`,
  suggestion: (match) => `Use #2070=100, then copy: #${match[1]}=#100`
};

// Test cases
// #2070=1175  → WARNING (outside range)
// #2070=100   → OK
// #2070=50    → OK
```

---

## 4. Info/Style Suggestions

### 4.1 Missing Comment on Variable

```javascript
const UNCOMMENTED_VARIABLE = {
  pattern: /^#\d+=\d+\s*$/gm,
  level: 'INFO',
  message: () => `Consider adding comment to explain variable purpose.`,
  suggestion: () => `#1=60 ( Max probe distance )`
};
```

### 4.2 Inconsistent Spacing

```javascript
const INCONSISTENT_SPACING = {
  pattern: /#\d+\s+=|=\s+#\d+/g,
  level: 'INFO',
  message: () => `Inconsistent spacing around = in variable assignment.`,
  suggestion: () => `Use consistent format: #var=value (no spaces)`
};
```

---

## 5. Validation Function Structure

```javascript
class GCodeVerifier {
  constructor() {
    this.rules = {
      errors: [
        INVALID_INLINE_ARITHMETIC,
        BRACKETED_SIMPLE_IF,
        GOTO_SPACE,
        PRIMING_VIOLATION,
        G10_USAGE,
        G53_HARDCODED
      ],
      warnings: [
        FANUC_OPERATORS,
        HIGH_LABEL_NUMBERS,
        G53_WITH_MOTION,
        MISSING_PROBE_CHECK,
        INPUT_INVALID_RANGE
      ],
      info: [
        UNCOMMENTED_VARIABLE,
        INCONSISTENT_SPACING
      ]
    };
  }

  validate(gcode) {
    const results = {
      errors: [],
      warnings: [],
      info: [],
      valid: true
    };

    const lines = gcode.split('\n');
    
    lines.forEach((line, lineNum) => {
      // Skip comment-only lines
      if (/^\s*[\(;\/]/.test(line)) return;
      
      // Check each rule category
      for (const rule of this.rules.errors) {
        const matches = [...line.matchAll(rule.pattern)];
        for (const match of matches) {
          results.errors.push({
            line: lineNum + 1,
            column: match.index,
            message: rule.message(match),
            suggestion: rule.suggestion?.(match),
            original: match[0]
          });
          results.valid = false;
        }
      }
      
      // Similar for warnings and info...
    });

    return results;
  }
}
```

---

## 6. Label Validation

```javascript
function validateLabels(gcode) {
  const defined = new Set();
  const referenced = [];
  const errors = [];

  // Find all label definitions
  const labelDefs = gcode.matchAll(/^N(\d+)/gm);
  for (const match of labelDefs) {
    defined.add(match[1]);
  }

  // Find all GOTO references
  const gotoRefs = gcode.matchAll(/GOTO(\d+)/gi);
  for (const match of gotoRefs) {
    referenced.push({
      label: match[1],
      index: match.index
    });
  }

  // Check for undefined labels
  for (const ref of referenced) {
    if (!defined.has(ref.label)) {
      errors.push({
        level: 'ERROR',
        message: `GOTO${ref.label} references undefined label N${ref.label}`,
        index: ref.index
      });
    }
  }

  return errors;
}
```

---

## 7. Complete Validation Example

```javascript
const testCode = `
( Corner Finder | FL | X+ Y+ + Z Surface | G57 )
#1=60 ( Max probe distance )
#2=5 ( Retract )
#3=200 ( Fast feed )

G91
G31 Z-#1 F#3 P#5 L0 Q1
IF [#1922!=2] GOTO1
G0 Z#10
G31 Y+#1 F#3 P#5 L0 Q1
IF #1921 NE 2 GOTO 1

N1
#1505=1(Failed!)
N2
M30
`;

const verifier = new GCodeVerifier();
const results = verifier.validate(testCode);

// Expected output:
// ERRORS:
// - Line 7: Invalid inline arithmetic "Z+#1"
// - Line 8: Remove brackets from simple IF condition
// - Line 10: Invalid inline arithmetic "Y+#1"
// - Line 11: Remove space before label: "GOTO 1"
// 
// WARNINGS:
// - Line 11: FANUC-style operator "NE" - use != instead
```

---

## 8. Auto-Fix Suggestions

```javascript
const autoFixes = {
  // Fix inline arithmetic
  'INLINE_ARITHMETIC': (line, match) => {
    // Cannot auto-fix - requires adding pre-calc variables
    return null;
  },
  
  // Fix bracketed IF
  'BRACKETED_IF': (line, match) => {
    return line.replace(
      /IF\s*\[\s*(#\d+\s*[!=<>]=?\s*\d+)\s*\]/gi,
      'IF $1'
    );
  },
  
  // Fix GOTO space
  'GOTO_SPACE': (line, match) => {
    return line.replace(/GOTO\s+(\d+)/gi, 'GOTO$1');
  },
  
  // Fix FANUC operators
  'FANUC_OPERATOR': (line, match) => {
    const map = { EQ: '==', NE: '!=', LT: '<', GT: '>', LE: '<=', GE: '>=' };
    let fixed = line;
    for (const [fanuc, cstyle] of Object.entries(map)) {
      fixed = fixed.replace(new RegExp(`\\b${fanuc}\\b`, 'gi'), cstyle);
    }
    return fixed;
  }
};
```

---

## 7. Community Macro Evidence

These patterns are verified working from production macros:

### 7.1 AXIS-#VAR Pattern (WORKS)

```gcode
;; macro_cam10.nc line 16
G91 G31 Z-#1 F#3 P#16 L0 Q1  ;probe down

;; macro_cam12.nc line 34
G91 G31 Y-#2 F[#3*3] P#16 L0 Q1  ;move back

;; macro_cam12.nc line 59
G91 G31 Y-#2 F#3 P#16 L0 Q1  ;fast scan

;; macro_DA_without_relay_advanced.nc line 158
G91G31X-#71Y-#72Z-#73A-#74B-#75C-#76 F#563 P#19 L1 K0 Q0

;; macro_Thread_milling.nc line 105
G0 Z-#190

;; macro_Adaptive_Pocket.nc line 51
G1Z-#18F#28
```

### 7.2 Bracket Expressions (WORKS)

```gcode
;; macro_cam10.nc line 19
G53 Z[#20+#15]   ;retract

;; macro_cam10.nc line 20
G91 G31 Z[-#15*2] F#14 P#16 L0 Q1

;; macro_cam12.nc line 34 - feedrate with expression
G91 G31 Y-#2 F[#3*3] P#16 L0 Q1

;; macro_cam12.nc line 45
G91 G31 Y[#15*2] F#14 P#16 L0 Q1

;; macro_cam12.nc line 64 - negative multiplier
G91 G31 Y[#15*-2] F#14 P#16 L0 Q1
```

### 7.3 AXIS+#VAR Pattern (NOT FOUND)

**Zero examples found in any community macro.**

Searched files:
- macro_cam10.nc
- macro_cam11.nc
- macro_cam12.nc
- macro_cam13.nc
- macro_Thread_milling.nc
- macro_Adaptive_Pocket.nc
- macro_DA_without_relay_advanced.nc
- All firmware macros in SystemBak

**Conclusion**: Treat `AXIS+#VAR` as WARNING (untested), not ERROR.

---

## Document Info

**Version**: 1.0  
**Last Updated**: February 2026  
**Target**: DDCS Studio G-Code Verifier Implementation
