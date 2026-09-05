# ⭐⭐ THE VENDOR'S LIVE REPO — CHECK THIS **FIRST**, BEFORE ANY MODBUS WORK

⛔ **`ddcnc.com` IS NOT THE SOURCE.** Its newest published DDCS-Expert firmware is **2025-06-19** — older
than the build on our machine. The vendor develops in the open on GitHub, and that is where the current
firmware and the only current documentation live.

| repo | what |
|---|---|
| ⭐ **https://github.com/foinnc/M350** | *"M350 CNC System Development Resources (Full Version)"* — firmware, `Docs/` |
| **https://github.com/foinnc/M350-LiveG** | *"Official PC tool… Real-time G-code"* — the reference implementation for register `3000` |
| https://github.com/foinnc/M3X-M350-IoT-Bridge | the M3X IoT box |

⚠ **Both were updated 2026-09-02** — three days before we read them. This is an actively developed product;
anything cached in this repo is a snapshot and goes stale.

## THE FILE HERE
`M3xx_Modbus_Address_Map_V1_0.xlsx` — `Docs/Modbus开发资料/`, committed **2026-09-02**, *"first creation",
Q.G. ZHANG*. ⭐ **This is the slave register map the project spent months treating as nonexistent.**
`FINDINGS.md` states *"there is no slave register map, because there is no slave… only foinnc can supply
it"* — foinnc has now supplied it.

⛔ **`Docs/` also holds ~40 folders we have never read**, including `虚拟按键` (virtual keys), `按键键值宏地址#2037`,
`宏列表` (macro list), `最完整的M350坐标换算公式` (coordinate transforms), `G_M代码列表` (full G/M code list),
`M3xx_M6xx数控系统手册V1_1(最新).pdf` (the current system manual, 4.7 MB). **Read the doc before testing the
thing the doc is about** — that rule has now cost this project twice in one day.

## ⛔ THE LESSON, WRITTEN DOWN SO IT STOPS RECURRING
Owner, 2026-09-05: *"obviously if you're looking at outdated docs it's meant to go bad."*
Two layers of staleness compounded: findings were being built on **this repo's summary** of a **2025 manual**,
for a **2026 firmware**, while the vendor's live repo sat unread.
⇒ **Check the upstream repo's commit date before trusting any Modbus fact in this project.**
