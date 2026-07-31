# M350 Modbus — firmware 2025-12-11-00 ("slave mode") evidence drop

Provenance: downloaded 2026-07-31 from the OEM's GitHub (foinnc = 弗英科/FOINNC, the M350 manufacturer;
the same account publishes the official firmware releases Digital Dream sells as "DDCS Expert").

| File | Source | What it is |
|---|---|---|
| `V1_M350_20251211.zip` | github.com/foinnc/M350 release `2025-12-11-00` asset | The **V1-hardware** firmware that adds Modbus RTU **Slave** mode (P279) + M3X compatibility. Contents = the standard `install/` system pack (same layout as our `assets/cam-menu` bundles) + bilingual upgrade logs. **This is the update CNC-FAIRY needs for live-command Modbus.** |
| `read.me.txt` | same release | OEM install note: V1 hardware flashes from `install/`, V2 from `psys/`; optional `setting` restores factory params. |
| `setting` | same release | Factory parameter file (8000 bytes, binary). |
| `Upgrade log.txt` | inside the zip | FULL English firmware changelog 2021-02-02 → 2025-12-11. Modbus milestones: P279+MSETDATA 2022-06-02; MGETDATA/MDATA2BYTE/MBYTE2DATA 2022-06-09; M3K+Modbus concurrently 2022-06-15; **Slave mode + M3X 2025-12-11**. |
| `eng.V1_20251211` | inside the zip (`install/eng`) | The release's parameter-form table. Key line 916: `#279 … -i0"NO" -i1"Poll" -i2"Slave" -s3"Restart takes effect"` (old firmware had `NO/YES`; "Poll" = the renamed master mode). Also introduces hidden `#298 = 100` (undocumented, serial block — meaning unknown). |
| `M350-Modbus Manual_V1_1.pdf` (+ Chinese `M350 modbus 手册.pdf`) | repo `Docs/Modbus开发资料/` | Official Modbus manual — **master-mode macros only** (MGETDATA/MSETDATA/MBYTE2DATA/MDATA2BYTE), FC 01/02/03/04/0F/10, X6 exception-code table, worked frames with CRCs, float byte order. It does NOT document the slave-mode register map. |
| `modbus-examples/*.txt` | repo `Docs/Modbus开发资料/Modbus example for M350/` | One runnable macro per function code + the two float conversions. |

The slave-mode register map is documented ONLY in the OEM's open-source consumers
(both MIT):
- `github.com/foinnc/M3X-M350-IoT-Bridge` → `Firmware/01_Web_Touch_Console/main.ino`
  (FC03 reads: 7080+ work coords, 7260+ machine coords, 10002 status; FC10 write 6908
  virtual-key inject; float32 low-word-first).
- `github.com/foinnc/M350-LiveG` → `m350_liveg.py`
  (FC10 write of ASCII G-code, byte-pair-swapped, to register 3000, ≤246 chars;
  FC03 status poll at 10002; busy exception 0x90; motion-state settle logic).

Local ground truth: CNC-FAIRY's own SYSDISK capture (`assets/capture/20260610T163337Z/SYSDISK/eng`
line 916) still shows `#279 … NO/YES` → its firmware predates this release; no Slave option
until this zip is flashed (V1 hardware → `install/` folder, then power-cycle).


## Added 2026-07-31 (advisor): the CURRENT flash target
- V1_M350_20260410.zip - the NEWEST V1 firmware (release 2026-04-10-00, github.com/foinnc/M350/releases).
  VERIFIED to carry P279 max=2 NO/Poll/Slave (+ Restart takes effect) in install/eng - slave mode included,
  plus all fixes since 12-11 (incl. the A/B-axis tool-comp pause/resume fix). THIS is the file to flash on
  CNC-FAIRY (V1 hardware, install/ folder route); the 20251211 zip above is kept as the feature-origin document.
