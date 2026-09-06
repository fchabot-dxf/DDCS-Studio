"""
ROLES — S0: THE ROLE EXISTS, AUTOMATICALLY (t2103, ROLES-PLAN.md).

The claim gate is the authoritative one: `poller._maybe_claim()` must refuse whenever the effective role is
`client`, regardless of what the UI shows or hides. Driven against the REAL `Poller`/`LocalFolderBackend`/`Ops`
classes, asserting the actual OUTCOME (does the job stay queued, does it get claimed) — a test that only checks
`effective_role()` returns the right string would pass even if `_maybe_claim` never read it.

Run standalone:  python bridge/bridge-app/tests/test_role_claim_gate_2103.py
"""
import os
import shutil
import sys
import tempfile

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_HERE, ".."))
from fairy.backend.local_folder import LocalFolderBackend    # noqa: E402
from fairy.config import Config, ROLE_CLIENT, ROLE_GATEWAY, effective_role, role_conflict   # noqa: E402
from fairy.ops import Ops, make_job_id                        # noqa: E402
from fairy.poller import Poller                                # noqa: E402


class _StubTransfer:
    def __init__(self):
        self.calls = []

    def reachable(self):
        # t2105 — this file is about the ROLE gate specifically; stay reachable so the (separate) t2105
        # reachability gate never interferes with what these tests are actually proving.
        return True

    def deliver(self, nc, name):
        self.calls.append((nc, name))
        return r"\\stub\cncdisk\%s" % name


def _make_poller(tmp_root, expert_dest="", role_override=""):
    backend = LocalFolderBackend(tmp_root)
    cfg = Config(local_root=tmp_root, expert_dest=expert_dest, role_override=role_override)
    transfer = _StubTransfer()
    return Poller(backend, transfer, cfg, log=lambda *a: None), backend, cfg, transfer


def _submit(backend, cfg, name="part.nc", nc="G0 X0\nM30\n"):
    return Ops(backend, cfg).submit_job(name, nc)


# ── the actual safety property ──────────────────────────────────────────────────────────────────────────────

def test_client_role_derived_leaves_the_job_queued_and_never_touches_transfer():
    """No expert_dest -> DERIVED client (the pre-t2103 behaviour, reproduced under the new gate)."""
    tmp = tempfile.mkdtemp()
    try:
        poller, backend, cfg, transfer = _make_poller(tmp, expert_dest="")
        r = _submit(backend, cfg)
        poller.tick()
        assert backend.list_inbox() == [r["jobId"]], "the job must stay QUEUED, not vanish or fail"
        assert transfer.calls == [], "a client must never even ATTEMPT delivery"
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_client_role_OVERRIDE_wins_even_with_a_controller_disk_configured():
    """⭐ THE property S0 actually adds: expert_dest IS set (would derive gateway), but an explicit override
    says client — the claim gate must obey the override, not the disk path. This is the stale-config case."""
    tmp = tempfile.mkdtemp()
    disk = tempfile.mkdtemp()
    try:
        poller, backend, cfg, transfer = _make_poller(tmp, expert_dest=disk, role_override=ROLE_CLIENT)
        r = _submit(backend, cfg)
        poller.tick()
        assert backend.list_inbox() == [r["jobId"]], "an overridden client must not claim just because a disk path is still configured"
        assert transfer.calls == [], "and must never attempt delivery either"
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
        shutil.rmtree(disk, ignore_errors=True)


def test_gateway_role_still_claims_and_delivers_the_common_case_unchanged():
    """The derived default must reproduce today's behaviour for every existing install (ROLES-PLAN.md S0's
    own gate) — a gateway with expert_dest set claims and delivers exactly as it always has."""
    tmp = tempfile.mkdtemp()
    disk = tempfile.mkdtemp()
    try:
        poller, backend, cfg, transfer = _make_poller(tmp, expert_dest=disk)
        r = _submit(backend, cfg)
        poller.tick()
        assert backend.list_inbox() == [], "a real gateway must still claim — the FIFO must actually drain"
        assert len(transfer.calls) == 1, transfer.calls
        status = backend.get_status(r["jobId"])
        assert status["state"] in ("delivered", "running"), status
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
        shutil.rmtree(disk, ignore_errors=True)


def test_gateway_override_with_no_disk_yet_still_does_not_claim():
    """An explicit 'gateway' override with expert_dest EMPTY is a stated intent, not a green light to deliver
    into nothing: the pre-existing 'no controller configured' guard must still hold beneath the role gate.
    Seeded directly via backend.put_job() (not Ops.submit_job): t2107 added the identical check to submit_job
    too, which is correct defense in depth, but it means this test's own subject — the CLAIM gate's
    independent 'no expert_dest' guard — needs a job that reaches the inbox some other way, exactly as it
    would if the workspace's disk field were cleared AFTER a job was already queued."""
    tmp = tempfile.mkdtemp()
    try:
        poller, backend, cfg, transfer = _make_poller(tmp, expert_dest="", role_override=ROLE_GATEWAY)
        job_id = make_job_id("part.nc")
        backend.put_job(job_id, "G0 X0\nM30\n", None)
        poller.tick()
        assert backend.list_inbox() == [job_id], "gateway role alone is not enough without an actual disk path"
        assert transfer.calls == []
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


# ── effective_role()/role_conflict() — the pure derivation, isolated ───────────────────────────────────────────

def test_effective_role_derivation_and_override_precedence():
    assert effective_role(Config(expert_dest="")) == ROLE_CLIENT
    assert effective_role(Config(expert_dest=r"\\bench\cncdisk")) == ROLE_GATEWAY
    assert effective_role(Config(expert_dest=r"\\bench\cncdisk", role_override=ROLE_CLIENT)) == ROLE_CLIENT
    assert effective_role(Config(expert_dest="", role_override=ROLE_GATEWAY)) == ROLE_GATEWAY
    assert effective_role(Config(expert_dest="", role_override="garbage")) == ROLE_CLIENT, \
        "an invalid override must fall back to the derivation, not crash or silently pick gateway"


def test_role_conflict_fires_ONLY_for_client_override_plus_a_configured_disk():
    assert role_conflict(Config(expert_dest=r"\\bench\cncdisk", role_override=ROLE_CLIENT)) is True
    assert role_conflict(Config(expert_dest="", role_override=ROLE_CLIENT)) is False, \
        "no disk configured -> nothing to disagree with"
    assert role_conflict(Config(expert_dest=r"\\bench\cncdisk", role_override=ROLE_GATEWAY)) is False, \
        "gateway override + a disk agree with each other"
    assert role_conflict(Config(expert_dest=r"\\bench\cncdisk", role_override="")) is False, \
        "no override at all -> nothing declared to conflict with the derivation"
    assert role_conflict(Config(expert_dest="", role_override=ROLE_GATEWAY)) is False, \
        "gateway override with no disk yet is a stated intent, not a contradiction (see role_conflict's own docstring)"


if __name__ == "__main__":
    for name, fn in sorted((n, f) for n, f in globals().items()
                           if n.startswith("test_") and callable(f)):
        fn()
        print("  ok  ", name)
    print("PASS -- the S0 claim gate is authoritative: a client (derived OR overridden) never claims and never "
          "touches transfer; a gateway (derived OR overridden, with a real disk) claims and delivers exactly as "
          "before t2103. effective_role/role_conflict verified in isolation too.")
