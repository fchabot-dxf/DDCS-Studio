# FLASH DAY — CNC-FAIRY (M350 hardware V1) → firmware 2026-04-10 + Modbus Slave

The prepared payload is **`USB-READY/install/`** in this folder — 67 files, extracted from the
official `V1_M350_20260410.zip` (github.com/foinnc/M350, release 2026-04-10-00), verified to carry
`P279 = NO / Poll / Slave ("Restart takes effect")` in its parameter table.

⚠ **THE `setting` FILE IS DELIBERATELY EXCLUDED.** The OEM read-me: placing `setting` inside
`install/` **restores FACTORY parameters** during the upgrade. Your machine's whole setup (axes,
envelope, tool table, probe params) would be wiped. Do not add it. (It stays archived here beside
the zip if a factory reset is ever wanted on purpose.)

## The steps, in order

1. **BACKUP FIRST (at the pendant):** System → the backup/export-to-U function — take a fresh
   parameter backup onto a stick and keep it off the flash stick. (The 2025-12-31 backup exists in
   the corpus, but params have moved since — 30 seconds now beats an evening of re-setup.)
2. **Prepare the stick:** an empty, FAT32 USB stick. Copy the **`install`** folder (the folder
   itself, not its contents loose) to the stick's ROOT. Nothing else on the stick.
3. **Flash:** power the M350 OFF → stick in → power ON. The bootloader auto-loads `install/`
   (that's the V1 route; V2 machines use `psys/`). Wait for it to finish and boot normally —
   do not cut power mid-upgrade.
4. **Verify the firmware took:** the version screen should show **2026-04-10**; open parameter
   **P279** — it must now offer **NO / Poll / Slave**.
5. **Verify your parameters survived:** spot-check a few knowns (Z envelope −120, your tool
   offsets, probe params). They should be untouched (no `setting` file was included).
6. **Enable the channel:** `P279 = Slave` · `P267 = 115200` · P296/P297 at defaults (8N1) →
   **REBOOT** (the parameter says so itself).
7. **Proof of life (either):**
   - the OEM's `M350_LiveG_v1.7.exe` (github.com/foinnc/M350-LiveG, release V1.7) over the COM
     cable → send `G91 G0 X0` and watch it accept; or
   - our gateway probe once Gateway-Live's first slice lands (it will read register 10002 —
     state — and nothing else on day one).
8. Report back what P279 looked like before/after and whether LiveG connected — that's the
   evidence that opens the Gateway-Live arc.

## Rollback
Older release zips remain on github.com/foinnc/M350/releases (and `V1_M350_20251211.zip` is
archived here) — the same USB route flashes any of them. Your step-1 backup restores parameters
via the pendant's restore-from-U if ever needed.
