# Future Feature Evaluation: Tower Light (Stack Light) on DDCS Expert 2.1

## Goal

Control a 3-colour tower light from the DDCS Expert M350 controller:

| Colour | State |
|---|---|
| Green | Machine running (NC executing, spindle on) |
| Yellow | Machine paused |
| Red | Emergency stop or alarm |

## The Core Problem

The Pause state is the hard one. When the operator presses Pause, the NC program stops executing — so any macro logic running inside the NC can't detect it. You need a mechanism that runs *outside* the NC program to observe the controller state.

## Approaches

### 1. DDCS Digital Outputs + NC Macros (partial solution)

The DDCS Expert has configurable digital outputs controllable via system variables in the NC:

```
#[1551 + N - 1] = 1   ; set output N high
#[1551 + N - 1] = 0   ; set output N low
```

- **Green**: set output high at program start, low at M30
- **Red**: detectable via alarm M-codes or error handling in the macro
- **Yellow/Pause**: ✗ not detectable from inside NC — NC is frozen when paused

This covers running and end-of-program, but misses Pause.

### 2. Modbus Slave Interface (most promising for Studio integration)

The DDCS Expert exposes a Modbus slave. The DDCS Studio gateway already reads from it (`ModbusBeaconSource`). Modbus registers may include machine state flags.

**Research needed**: which Modbus register holds running/paused/alarm state on the Expert 2.1. If one exists, the gateway could:
- Poll the state register continuously
- Drive an external smart relay / IoT output module wired to the tower light

This approach requires no NC changes and detects Pause independently. It's the natural extension of what the beacon tracker already does.

### 3. External PLC or Microcontroller Watching I/O Pins

Wire the DDCS's dedicated output pins (Feed Hold, Spindle On, E-Stop) to an external controller (PLC, Arduino, Raspberry Pi). The external controller drives the tower light based on pin state:

- Spindle on + no alarm → Green
- Feed Hold active → Yellow
- E-Stop or alarm output → Red

The DDCS Expert reportedly has a dedicated Feed Hold output pin — this is the most reliable Pause indicator since it's hardware-level, not NC-level.

**Pro**: fully independent of NC program execution.
**Con**: requires external hardware and wiring.

### 4. Watching the Beacon Variable via Modbus (indirect)

The beacon mechanism already writes `#250 = N` + `MSETDATA[250,1,0,2,16,300]` at Z-up moves. Between beacons the gateway can infer "running". If the variable stops incrementing but M30 hasn't fired, the machine may be paused or stalled — the gateway already tracks this as a "stalled" job state.

This gives a soft Pause indicator without any new hardware, but it's an inference, not a direct state read.

## Open Research Questions

- Does the DDCS Expert 2.1 expose a machine-state register (running/paused/alarm) via Modbus? If so, which register?
- Is there a dedicated Feed Hold / Pause output pin on the Expert 2.1 terminal block?
- Has anyone in the DDCS community wired a tower light to the Expert controller? Forum sources to check:
  - CNCzone DDCS thread
  - Facebook DDCS Users group
  - AliExpress seller support (Fuling)

## Studio Integration Angle

If Modbus state registers exist, the gateway could expose a `/api/machineState` endpoint returning `{ state: "running" | "paused" | "alarm" | "idle" }`. Studio UI (and the Fusion palette) could display the state. A future I/O automation wizard could let users map DDCS outputs to tower light colours from within Studio — no external PLC required.

## Verdict

Not enough verified information to implement yet. The Pause state detection gap is real and the Modbus register map for machine state on the Expert 2.1 is unconfirmed. **Gate**: find a community report of Modbus register for Pause/Feed Hold state OR confirm the Feed Hold output pin exists on the Expert 2.1 terminal block before designing the Studio feature.
