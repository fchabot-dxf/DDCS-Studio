# Crazy Ideas

> Speculative, unfiltered. No commitment to build. Some of these will be dumb, some will be the next feature.

---

## Studio as a welding HMI

DDCS Expert running an automatic welder (X/Z linear + A rotary positioner). Spindle unused.
Re-map the S parameter to wire feed speed or torch power. The feed override knob controls traverse
speed in real time. A Studio "live control" panel writes correction offsets to user registers (#100–#110)
via the gateway while the program runs. The macro polls those registers between segments and applies
them as WCS offset nudges. Effectively a software control panel for any live parameter — torch height,
seam offset, wire feed — built on top of the existing gateway + macro infrastructure. No new firmware,
no new hardware.

---

## Live control panel — software knobs via gateway

Gateway writes to user registers mid-program. The macro reads them between moves. Studio shows sliders,
knobs, or number fields that map 1:1 to registers. Any program parameter becomes live-adjustable from
the Studio UI without stopping the machine. Applications: welding correction, plasma height, spindle
warmup ramp, feed scaling per material zone.

---

## Surface digitizing → terrain reconstruction

20×20 probe grid (400 G31 moves) stores Z results in #56–#455 (confirmed register space on Expert).
Gateway reads all 400 registers after the macro finishes. Studio reconstructs the point cloud and
renders it as a mesh. Use it to: place ops on real geometry, check deviation from nominal model,
re-use the scan as stock for a second setup, share the scan with the team. Essentially photogrammetry
but with a probe. Already on course.

---

## Probe array → adaptive toolpath correction

Run the surface scan before the job. Studio computes a correction map (actual surface vs. nominal).
The CAM toolpath gets Z-corrected per-point before sending to the machine. The part doesn't need to
be perfectly flat or level — Studio compensates for real-world stock geometry. Useful for sculptural
carving on slabbed material that isn't perfectly flat.

---

## Plasma/laser suite via community

The geometry engine is modality-agnostic — contours are just motion, milling was the first head.
Laser/plasma = same paths + process atoms (beam on/off, pierce, power ramp, kerf compensation).
A community plasma suite makes the DDCS viable in a market the vendor never built for. The I/O
automation atoms (setOutput/waitInput) already cover the digital signals. What's missing: a process
atom vocabulary (pierce dwell, lead-in/lead-out, power level) and a plasma-specific wizard group.
One expert user authors it as .wizard files, thousands run it.

---

## @DDCS:cam beacons → section navigator

Drop a CAM file into Studio. The beacon comments (emitted by the post) populate a section jump list:
"3/12 · pocket2d · T1 D10 · Z −8→−12mm". Click to jump to that line in the editor. For a sculptural
program with 20+ passes this is the difference between finding your place and scrolling forever.
Colour-code by tool, by depth range, by op type.

---

## Beacon → depth map visualization

All sections from a CAM file visualized as a stacked bar or timeline: which tool cuts which depth
range, which sections overlap in Z, which passes are roughing vs finishing. For a carving assembly
with many depth passes this immediately shows gaps, redundancy, or wrong order. Read entirely from
the @DDCS:cam markers — no G-code parsing.

---

## Wizard files as a community library

.wizard files are portable, shareable, not bound to a controller or profile. A community library
(GitHub repo or hosted index) where users publish their wizard files — plasma suites, welding
sequences, specialty probing routines, material-specific feeds+speeds templates. Studio has a
"Browse community wizards" panel that installs them into the local library. The validator runs on
install — safe by construction, same guarantees as a built-in.

---

## Post-processor as a Studio plugin

The @DDCS:cam marker work shows the post and Studio are already in conversation. Take it further:
Studio ships a "post simulator" that runs the .cps post logic in JS (transpiled or reimplemented for
the common subset) so you can preview the exact G-code output before sending to the machine. Catch
post-specific issues (arc format, feed mode, canned cycles) in Studio before they cause a crash.

---

## Rotary surface digitizing → wrap compensation

Probe the surface of a cylinder before carving. 360° × N points gives you the actual diameter
profile — the cylinder isn't perfectly round, the stock isn't perfectly centered. Studio computes
a per-angle radius correction map. The wrap toolpath gets compensated before output. Result: even
depth of cut on an imperfect cylinder without truing it.

---

## Machine as an instrument

The probe array + gateway data pipeline turns the CNC into a measuring instrument. Not just
"probe WCS" but actual metrology: flatness, squareness, parallelism, cylindricity. Studio shows
the measurement result as a report + visualization. The machine earns its keep between jobs as
a CMM for the shop's own parts.

---

## Persistent job memory

Every job that runs gets a record in Studio: which .nc file, which WCS, which tools, start/end
time, any probe results, any corrections applied. Not a log file — a structured record linked to
the profile. "Last time I ran this part I used G55 with a 6mm end mill and probed a −0.3mm
correction at the fence." Recall it for the next run. The controller already has timestamps,
the gateway already reads state — it's a pipeline question, not a new feature.

---

## Region primitive → spatial CAM feature-selection

The region picker (clickable zones over a backdrop, each mapping to a value) is a small instance of a bigger idea.
Generalize the backdrop from an icon to the actual part/stock drawing, and the region from an abstract zone to a
feature — a hole, a pocket, an edge. Now you build a CAM op by **clicking features on the part instead of typing
coordinates into fields**. The 2D layout canvas already renders features parametrically; this is the inverse —
pick the geometry, derive the op. Squarely the prefer-GUI-over-fields direction.

Gated on the same boundary as the typed-widget work: today a region commits a NUMBER (valid by construction in a
numeric socket). A CAM feature-region must commit a FEATURE or an operation — something richer than a number — which
needs the deferred non-numeric / field-targeting param mechanism. So this is not free; it rides on that larger piece.

The actionable consequence (recorded so the authoring-editor build doesn't preclude it): keep the region as its own
extracted PRIMITIVE — a shared drawing core consumed by both the icon editor and the region editor — NOT a layer
type buried inside iconEditor. If it's a primitive, it can later power spatial CAM. If it's trapped in iconEditor,
it stays icon-only forever.

---

## Alignment correction via rotation

The measured fence angle (from the alignment probe op, stored in #1512) could be used to rotate
the program coordinate frame in Studio before output — not G68 on the controller (unconfirmed on
Expert), but Studio rotates all XY coordinates in the emitted G-code by the measured angle.
Controller-agnostic, no firmware dependency, exact correction. Deferred but technically clean.

---
