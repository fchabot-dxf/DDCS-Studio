"""fairy/ — the headless bridge on CNC-FAIRY (the only PC cabled to the DDCS Expert).

A loop: poll the rendezvous store -> write the .nc to the Expert (SMB) -> "delivered". Outbound-only;
never internet-reachable. Optionally (BACKLOG #79, --position-poll) also polls the controller's own Modbus
Slave-mode registers for live position/run-state/executing-line — a separate, process-wide concern, not
attached to any one job (master.py's PositionPoller).

In offline/local configs it also serves the console + an operations API locally (see server.py).

See ../ARCHITECTURE.md (module map), ../CONFIGS.md (configs/vocab), ../shared/PROTOCOL.md (the contract).
"""

__version__ = "0.1.0"
