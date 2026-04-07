# Recommended Supplies & Parts List

**Essential components and tools for DDCS M350 CNC wiring and integration projects**

This list includes recommended parts for professional wiring, sensor integration, and machine construction based on production experience with the Ultimate Bee 1010 build.

---

## Electrical Connectors & Terminals

### Wire Ferrules (Essential for Professional Wiring)

**What they are:** Crimped metal sleeves that go on the end of stranded wire to create a solid termination point. Critical for preventing wire strand fraying in screw terminals.

**Recommended kit:** 230 Pcs Electrical Connectors Set

**Sizes included (AWG / mm²):**
- **FDD1.25-110** (Red, 22-16 AWG) - 10 PCS
- **FDD1.25-187** (Red, 22-16 AWG) - 20 PCS
- **FDD1.25-250** (Red, 22-16 AWG) - 10 PCS
- **FDD2.5-110** (Blue, 16-14 AWG) - 20 PCS
- **FDD2.5-187** (Blue, 16-14 AWG) - 10 PCS
- **FDD2.5-250** (Blue, 16-14 AWG) - 10 PCS
- **FDD5.5-250** (Yellow, 12-10 AWG) - 10 PCS
- **MDD1.25-110** (Red, 22-16 AWG) - 20 PCS
- **MDD1.25-187** (Red, 22-16 AWG) - 20 PCS
- **MDD2.5-110** (Blue, 16-14 AWG) - 20 PCS
- **MDD2.5-187** (Blue, 16-14 AWG) - 20 PCS
- **MDD2.5-250** (Blue, 16-14 AWG) - 10 PCS
- **MDD5.5-250** (Yellow, 12-10 AWG) - 10 PCS
- **RV1.25-3.2** (Red, 22-16 AWG) - 20 PCS
- **RV1.25-4** (Red, 22-16 AWG) - 20 PCS

**Where to use:**
- ✅ DDCS M350 screw terminal blocks (prevents wire damage)
- ✅ Stepper driver inputs (critical for DM542, DM556)
- ✅ VFD connections (spindle control)
- ✅ Breakout board terminals
- ✅ Any screw terminal connection with stranded wire

**Why they're critical:** Stranded wire will fray and break when clamped directly in screw terminals. Ferrules create a solid, professional termination that won't loosen over time.

**Tool required:** Ferrule crimping tool (Engineer PA-09, IWiss SN-28B, or equivalent)

---

### Ring Terminals (Fork & Ring Crimps)

**What they are:** Crimped terminals with ring or fork shapes for secure bolt/screw connections.

**Recommended assortment:** Mixed gauge ring and fork terminal kit

**Where to use:**
- ✅ Ground/earth connections (ring terminals on machine frame)
- ✅ Motor power connections (closed-loop stepper power leads)
- ✅ Power supply grounding (PSU chassis ground)
- ✅ VFD grounding connections
- ✅ Emergency stop circuit wiring
- ✅ Spindle motor connections

**Wire gauge recommendations:**
- **22-16 AWG (Red)**: Signal wiring, low-current connections
- **16-14 AWG (Blue)**: Stepper motor power, moderate current
- **12-10 AWG (Yellow)**: VFD power, spindle power, high current

**Tool required:** Standard crimping tool (ratcheting crimper recommended)

---

### Screw Terminal Blocks

**What they are:** Reusable terminal strips for creating distribution points or junction boxes.

**Types available:**
- **2-position blocks** - Simple connections, jumpers between adjacent terminals
- **3-position blocks** - Distribution hubs, sensor power distribution
- **4-position blocks** - Multi-wire junctions, complex routing
- **6+ position blocks** - Main distribution panels, breakout alternatives

**Where to use:**
- ✅ Sensor power distribution (5V, 12V, 24V rails)
- ✅ Ground distribution points
- ✅ Signal wire junction boxes
- ✅ Custom breakout panels
- ✅ Cable management / wire routing stations
- ✅ Future expansion points (leave extra positions)

**Mounting:** DIN rail mount or panel mount versions available

**Pro tip:** Use terminal blocks instead of wire nuts for permanent, serviceable connections.

---

### Cable Glands (Strain Relief & Sealing)

**What they are:** Threaded fittings that grip and seal cables entering enclosures.

**Common sizes:**
- **PG7** (3-6.5mm cable) - Small sensor cables, signal wires
- **PG9** (4-8mm cable) - Standard sensor cables, limit switches
- **PG11** (5-10mm cable) - Motor cables, power cables
- **PG13.5** (6-12mm cable) - Large motor cables, VFD connections
- **PG16** (10-14mm cable) - Spindle power, main power feeds

**Where to use:**
- ✅ DDCS M350 enclosure entries (controller protection)
- ✅ VFD enclosure (spindle cable entry)
- ✅ Motor cable entries (dust and chip protection)
- ✅ Sensor cable entries (strain relief on moving axes)
- ✅ Power supply enclosures

**Benefits:**
- Strain relief prevents cable pull from damaging connections
- IP rating protection (IP65-IP68 available)
- Professional appearance
- Cable organization

**Pro tip:** Install cable glands on ALL enclosure penetrations. Use appropriately sized glands for cable diameter - too loose and they don't seal, too tight and you can't install.

---

### WAGO 5-Way Lever Connectors

**What they are:** Tool-free reusable wire connectors with lever operation (WAGO 221 series or equivalent)

**Capacity:** Up to 5 wires per connector (various configurations available)

**Wire range:** Typically 24-12 AWG solid or stranded (verify specific model)

**Where to use:**
- ✅ Temporary connections during testing
- ✅ Sensor power distribution (distribute 24V or 5V to multiple sensors)
- ✅ Ground wire distribution points
- ✅ Quick prototyping and troubleshooting
- ✅ Service-friendly junction points (no tools needed)
- ✅ Parallel connections (splitting signals)

**Advantages over wire nuts:**
- Clear lever position (visual verification)
- Reusable (can disconnect/reconnect multiple times)
- More reliable with stranded wire
- Easier to verify good connection
- Faster installation

**Disadvantages:**
- More expensive than wire nuts
- Larger physical size
- Not as compact for tight enclosures

**Pro tip:** WAGO connectors are excellent for sensor power distribution. Run one power feed, split to multiple sensors cleanly.

---

## Recommended Additional Supplies

### Wire & Cable

**Signal Wire (Shielded):**
- **22 AWG shielded twisted pair** - Limit switches, probes (noise immunity)
- **24 AWG shielded cable** - Long sensor runs, analog signals
- Color-coded recommended (follow standard: Red=+24V, Black=Ground, Blue/White=Signal)

**Power Wire:**
- **18 AWG** - Stepper motor power (short runs <6 feet)
- **16 AWG** - Stepper motor power (standard), VFD control wiring
- **14 AWG** - High-current steppers, long runs
- **12 AWG** - Spindle power, main power distribution

**Control Wire:**
- **24 AWG solid core** - Short control panel runs, internal wiring
- **22 AWG stranded** - Flexible connections, door interlocks

### Heat Shrink Tubing

**Sizes:**
- **3-6mm** - Small sensor connections, wire repairs
- **6-12mm** - Ring terminal coverage, connector waterproofing
- **12-25mm** - Cable bundling, strain relief

**Adhesive-lined recommended** for vibration resistance and waterproofing

### Cable Management

- **Spiral wrap** - Flexible cable protection for moving cables (drag chains)
- **Split loom tubing** - Fixed cable routing, wire organization
- **Cable ties (zip ties)** - Various sizes, UV resistant for exposed routing
- **Velcro cable straps** - Reusable, service-friendly
- **Wire labels** - Printable or write-on, critical for troubleshooting

### Installation Hardware

**Standoffs & Spacers:**
- **M4 nylon standoffs** - Mounting breakout boards, avoiding shorts
- **M3 brass standoffs** - Mounting small PCBs, sensor brackets

**Mounting Screws:**
- **M3, M4, M5 stainless screws** - Corrosion resistance, professional appearance
- **#6, #8 self-tapping screws** - Mounting to aluminum extrusion

**DIN Rail:**
- **35mm DIN rail** - Standard for terminal blocks, power supplies, relays
- DIN rail end stops
- DIN rail cutters or hacksaw

### Enclosures

**Electronics Enclosures:**
- **IP65 rated boxes** - DDCS M350 controller housing
- **Vented enclosures** - VFD cooling (spindle control)
- **Clear lid boxes** - Easy inspection without opening

**Junction Boxes:**
- **Small weatherproof boxes** - Sensor wire junctions on machine
- **Large junction boxes** - Main cable routing points

---

## Tools Required

### Crimping Tools

**Ferrule Crimper:**
- **Engineer PA-09** (recommended, expensive but excellent)
- **IWiss SN-28B** (good budget option)
- **Generic ferrule crimpers** (minimum requirement)

**Ring/Fork Terminal Crimper:**
- Ratcheting crimper (prevents under-crimping)
- Wire gauge specific dies (22-16, 16-14, 12-10 AWG)

### Wire Tools

- **Wire strippers** - Automatic or manual (Klein 11061 popular choice)
- **Flush cutters** - Clean wire cuts
- **Needle nose pliers** - Positioning terminals
- **Cable knife** - Outer jacket removal (careful technique required)

### Measurement & Testing

- **Multimeter** - Essential for continuity, voltage verification
- **Wire gauge tool** - Verify wire size before crimping
- **Continuity tester** - Quick checks without multimeter

### Other Useful Tools

- **Heat gun** - Heat shrink application
- **Screwdriver set** - Flat and Phillips for terminals
- **Hex key set (metric)** - Machine assembly, DIN rail mounting
- **Label maker** - Professional wire identification

---

## PNP to NPN Converter Components

For building signal converters (reference: `pnp-to-npn-converter.md`):

### NPN Transistor Circuit (Recommended - $0.50)
- **2N3904 NPN transistor** (or equivalent: BC547, 2N2222)
- **10kΩ resistor** (pull-down, brown-black-orange)
- **1kΩ resistor** (base current limiting, brown-black-red)
- Small perfboard or terminal strip
- Heat shrink tubing

### Relay Circuit (Simple - $3-5)
- **12V or 24V relay** (coil voltage matches your system)
- **1N4001 flyback diode** (protection)
- **Relay socket** (optional but recommended)
- Small project box

### Opto-Isolator Circuit (Best Isolation - $1-2)
- **PC817 opto-isolator** (or 4N25, 4N35)
- **470Ω resistor** (LED current limiting, yellow-violet-brown)
- **10kΩ resistor** (pull-up, brown-black-orange)
- Small perfboard

---

## Where to Buy

**Electrical Connectors:**
- **Amazon** - Connector assortment kits (good for variety)
- **McMaster-Carr** - Individual part numbers (professional quality)
- **Digi-Key / Mouser** - Exact specifications (engineering grade)
- **AliExpress** - Budget bulk purchases (longer shipping)

**Wire & Cable:**
- **Local electrical supply** - Best for bulk wire by the foot
- **McMaster-Carr** - Consistent quality, fast shipping
- **Amazon** - Convenient for small quantities

**Tools:**
- **Amazon** - Wide selection, fast delivery
- **Local hardware stores** - Immediate availability
- **Professional tool suppliers** - Klein, Knipex, Engineer brands

**Specialty Items:**
- **DIN rail, terminal blocks** - AutomationDirect, Allied Electronics
- **Cable glands** - McMaster-Carr, Automation suppliers
- **WAGO connectors** - Electrical wholesalers, Amazon

---

## Budget Recommendations

### Minimum Setup ($50-100):
- Ferrule crimper and ferrule assortment
- Basic wire stripper and cutters
- Multimeter
- Assorted heat shrink
- Cable ties and basic wire

### Professional Setup ($200-400):
- Quality ferrule crimper (Engineer PA-09 or IWiss)
- Ratcheting ring terminal crimper
- Automatic wire stripper
- Fluke multimeter
- Complete connector assortment
- Heat gun
- Label maker
- Full wire inventory

### Ultimate Setup ($500+):
- Above professional tools
- Full terminal block assortment on DIN rail
- Complete cable gland kit (all sizes)
- Wire inventory (all gauges, colors)
- Organized storage system
- Backup tools (second crimper, extra strippers)

---

## Storage & Organization Tips

**Connector Organization:**
- Small parts organizers (like the 230 pcs kit shown in photo)
- Label each compartment clearly
- Sort by type and size
- Keep crimp pins separate from housings

**Wire Management:**
- Pegboard with wire spools
- Color-coded wire bundles
- Cut wire to standard lengths (1ft, 2ft, 3ft) for quick use
- Label wire gauge and type

**Tool Storage:**
- Tool chest or rolling cart
- Dedicated crimper storage (prevent damage)
- Multimeter always accessible
- Heat gun stored safely (away from plastic)

---

## Pro Tips

### Crimping Quality:
1. Strip wire to correct length (check ferrule or terminal depth)
2. Insert wire fully into terminal (visual check)
3. Center terminal in crimper jaws
4. Apply full crimper pressure (ratcheting crimper will release when complete)
5. Pull test every connection (gentle tug should not remove wire)

### Wire Management:
1. Use service loops (extra wire length) at every connection point
2. Route cables away from spindle and moving parts
3. Separate power and signal wiring (minimize noise)
4. Label both ends of every wire
5. Leave spare wires in cable bundles for future expansion

### Professional Appearance:
1. Use consistent wire colors (establish your standard)
2. Keep wires parallel and organized in bundles
3. Use cable ties at regular intervals
4. Trim cable tie tails flush
5. Route wires at right angles (not diagonal)
6. Use proper sized cable glands (not loose, not forced)

### Maintenance Considerations:
1. Use ferrules on ALL stranded wire in screw terminals
2. Check screw terminals annually (vibration can loosen)
3. Document your wiring (photos + notes)
4. Keep spare connectors and wire for repairs
5. Use strain relief everywhere (cable glands, zip ties)

---

## Safety Notes

**Electrical Safety:**
- ⚠️ **Power OFF** when working on connections
- ⚠️ Lock out / tag out for service work
- ⚠️ Verify voltage with multimeter before touching
- ⚠️ Use appropriate wire gauge for current (prevents overheating)
- ⚠️ Ground all metal enclosures properly

**Crimping Safety:**
- Eye protection (wire ends can fly when cutting)
- Proper technique (prevent repetitive strain injury)
- Inspect every crimp (bad crimps cause fires or failures)

**Wire Routing Safety:**
- Keep clear of pinch points and moving axes
- Protect from sharp edges (use grommets or rounded entries)
- Avoid heat sources (VFD, motors, spindle)
- Use rated cable for temperature environment

---

## Conclusion

Having the right connectors and tools makes CNC wiring professional, reliable, and serviceable. The investment in quality ferrules, proper crimpers, and organization pays off in reduced troubleshooting time and improved machine reliability.

**Essential priorities:**
1. **Ferrules** - Non-negotiable for stranded wire in screw terminals
2. **Proper wire gauge** - Match to current requirements
3. **Cable management** - Organization prevents failures
4. **Good crimping tools** - Cheap crimpers make bad connections
5. **Documentation** - Label everything, take photos

**See also:**
- `hardware-config.md` - Complete wiring architecture and I/O assignments
- `pnp-to-npn-converter.md` - Sensor signal conversion circuits
- DDCS M350 controller manual - Official terminal assignments

---

**Having these supplies on hand will make your DDCS M350 installation professional, reliable, and maintainable!**
