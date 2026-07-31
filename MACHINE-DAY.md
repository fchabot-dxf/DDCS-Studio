# MACHINE DAY — everything pending at CNC-FAIRY, in order (2026-07-31)

This is the one doc. Every payload named here lives in this repo — pull first on the shop PC.

---

## 1 ⚠ URGENT — restore your 3 custom system macros (BEFORE the next full homing)

**Why:** the 2026-04-10 firmware flash reverted three of YOUR custom system macros to factory.
Right now the machine homes all five axes INDEPENDENTLY — your dual-gantry A-follows-Y sync is
GONE. A full homing in this state can move A independently of Y.

**The files (your own December versions, unmodified):**

    bridge/controllers/expert-m350/assets/community/modbus-slave-2025-12-11/RESTORE-CUSTOM-MACROS/
        fndzero.nc     home-all: Z, X, Y (A follows) + SYNC A to Y + mark A homed
        sysstart.nc    the same sync at every boot, after M115 homing
        mdi.nc         your MDI hook (#1505=#470)

**Do:** copy all three onto the controller's **SYSDISK**, overwriting the factory ones — over the
SMB share from the shop PC (fairy can see it), or by USB + the pendant's file copy.
**Verify:** power-cycle → home → the screen shows **"HOMING COMPLETE — A SYNCED TO Y"**.

---

## 2 ✅ ALREADY DONE (for the record — no action)

- Firmware **2026-04-10** flashed (your capture proves it).
- **P279 = Slave**, **P267 = 115200**, 8N1 set. The Modbus live channel is configured.

---

## 3 Proof of life — the Modbus slave channel (5 minutes, any time)

With the COM cable in and the machine rebooted since setting P279:
- Easiest: run the OEM's **M350_LiveG_v1.7.exe** (github.com/foinnc/M350-LiveG → release V1.7)
  on the connected PC → it should show machine state and accept a `G91 G0 X0`.
- One good connect = the Gateway-Live arc's evidence gate is open. Tell the advisor.

---

## 4 Next visit's test-file copy list (one stick, copy to CNCDISK)

The machine still carries the OLD V-series. The current generation, all in ONE folder:

    bridge/controllers/expert-m350/verify/
        V13_trig.nc      run FIRST (combined; its abort = the unknown-function-loudness evidence)
        V13a_cos.nc · V13b_sin.nc · V13c_sqrt.nc · V13d_atan.nc   ← the trig deciders, one form each
                                                                    (lift 3 boundaries + 2 shipped-emit checks)
        V14_wcs_pos.nc                                             ← skim registers (shipped-consumed)
        V15_indent.nc                                              ← leading-whitespace tolerance
        V16_helical_arc.nc                                         ← helical G2/G3 (reports Z-drop as a number)
        V7_read_dro.nc                                             ← never run

Run order and what each decides: see the file headers — every macro names its three outcomes
(works / silently-wrong-number / loud refusal).

---

## 5 The flash payload (KEPT for reference — already applied)

    bridge/controllers/expert-m350/assets/community/modbus-slave-2025-12-11/
        USB-READY/install/     the 2026-04-10 V1 firmware, ready-to-copy (the `setting`
                               factory-reset file deliberately excluded)
        FLASH-DAY.md           the original flash checklist
        *.pdf / modbus-examples / Upgrade log.txt   the OEM Modbus documentation archive
