# Community Patterns from DDCS M350 Users

## 📚 Complete 6-Part Series

This comprehensive documentation of battle-tested DDCS M350 MacroB patterns has been split into 6 focused parts for optimal navigation and readability.

**Original size**: 1,832 lines → **Split into 6 manageable parts (all under 650 lines)**

---

## Quick Access by Topic

### **🎯 I need to...**

**Find basic patterns** → [Part 1: Core Patterns](community-patterns-1-core.md)  
**Use boolean logic or dynamic G-code** → [Part 2: Boolean & Dynamic](community-patterns-2-boolean-dynamic.md)  
**Handle multiple tools** → [Part 3: Multi-Tool Workflows](community-patterns-3-multi-tool.md)  
**Write complex validation or indirection** → [Part 4: Advanced Syntax 1](community-patterns-4-syntax-1.md)  
**Use direction flags or math tricks** → [Part 5: Advanced Syntax 2](community-patterns-5-syntax-2.md)

---

## 📖 Series Contents

### **Part 1: Core Patterns & Best Practices** (606 lines)
[community-patterns-1-core.md](community-patterns-1-core.md)

**Essential patterns:**
- G31 Extended Syntax, G4P-1 Interactive Pause, G53 Machine Coordinates
- Dual-Gantry Sync, State Preservation, Loop-Based Position Memory
- Error Handling, Dynamic WCS, Best Practices, Debugging Patterns

**Start here if**: New to DDCS M350, need fundamental patterns

---

### **Part 2: Boolean & Dynamic G-code** (294 lines)
[community-patterns-2-boolean-dynamic.md](community-patterns-2-boolean-dynamic.md)

**From macro_Adaptive_Pocket.nc:**
- Boolean OR/AND operators, Dynamic G-code generation
- Advanced indirect addressing, Complex nested expressions

**Start here if**: Writing conditional logic, need runtime flexibility

---

### **Part 3: Multi-Tool Workflows** (428 lines)
[community-patterns-3-multi-tool.md](community-patterns-3-multi-tool.md)

**From Rectangle_test.tap:**
- Computed GOTO sequencing, Tool offset calculation
- Manual WCS setup, Position saving for multi-tool

**Start here if**: Working with tool changes, need WCS management

---

### **Part 4: Advanced Syntax Part 1** (367 lines)
[community-patterns-4-syntax-1.md](community-patterns-4-syntax-1.md)

**From macro_DA_without_relay_advanced.nc:**
- Multi-condition validation, Nested indirect addressing
- Axis-agnostic variable selection

**Start here if**: Building robust error handling, complex addressing

---

### **Part 5: Advanced Syntax Part 2** (234 lines)
[community-patterns-5-syntax-2.md](community-patterns-5-syntax-2.md)

**Final advanced patterns:**
- Direction flag to signed distance, Mathematical ternary
- Complete 23-point summary

**Start here if**: Optimizing code, mathematical tricks

---

## Quick Reference Table

| I need to... | Go to... |
|-------------|----------|
| Probe with G31 | Part 1 |
| Boolean logic | Part 2 |
| Tool changes | Part 3 |
| Input validation | Part 4 |
| Direction flags | Part 5 |
| Dual-gantry sync | Part 1 |
| Dynamic G-code | Part 2 |
| Save positions | Part 3 |
| Nested indirection | Part 4 |
| Eliminate IFs | Part 5 |

---

## File Sizes

| Part | Lines | Status |
|------|-------|--------|
| Part 1 | 606 | ✅ Under 650 |
| Part 2 | 294 | ✅ Under 500 |
| Part 3 | 428 | ✅ Under 500 |
| Part 4 | 367 | ✅ Under 500 |
| Part 5 | 234 | ✅ Under 500 |

**All parts under 650 lines!** ✅

---

## Start Reading

[Part 1: Core Patterns →](community-patterns-1-core.md)

---

**Series**: 6-Part Split Edition (2025-01-19)  
**Source**: DDCS M350 Community Battle-Tested Code
