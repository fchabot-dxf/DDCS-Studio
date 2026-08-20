r"""transfer.py — the ONLY module that touches the controller (ARCHITECTURE.md §9).

Copy the instrumented .nc onto the Expert's CNCDISK over SMB. The hardware surface is
exactly this one file write, so it stays small and auditable. For a no-hardware test,
point `dest` at an ordinary folder (it behaves identically).

Confirmed 2026-06-06: \\192.168.0.99\CNCDISK is R/W (guest=root). The file is delivered
under its ORIGINAL name (map "source") so the operator sees the expected filename on the panel.
"""
import os


def controller_disk_reachable(expert_dest) -> bool:
    """t2105 (JOB-RULES.md §2) — is the controller's disk actually THERE right now? The one fact deliver()
    needs to succeed. Not cached: power/cable/network can change between any two calls, and this must always
    read the current truth, never a stale one. ONE source, shared by Ops.controller_reachable() (the
    descriptor/UI's own check) and the Poller's claim gate — a UI that says "reachable" and a poller that
    just destroyed a job for being unreachable must never be able to disagree about what "reachable" means."""
    if not expert_dest:
        return False
    try:
        return os.path.isdir(expert_dest)
    except OSError:
        return False


class Transfer:
    def __init__(self, config):
        self.cfg = config                            # read expert_dest live (Setup can change it without restart)

    def reachable(self) -> bool:
        """t2105 — convenience for callers (the Poller) that already hold a Transfer, not a Config alone."""
        return controller_disk_reachable(self.cfg.expert_dest)

    def deliver(self, nc_bytes, name) -> str:
        """Write nc_bytes to <expert_dest>/<name>. Returns the path; raises OSError on failure."""
        dest = self.cfg.expert_dest
        if not dest:
            raise OSError("no controller disk configured")
        try:
            os.makedirs(dest, exist_ok=True)        # no-op for an existing SMB share / local dir
        except OSError:
            pass                                     # share roots can't be "made"; the write below is the real test
        path = os.path.join(dest, name)
        with open(path, "wb") as f:
            f.write(nc_bytes)
        return path
