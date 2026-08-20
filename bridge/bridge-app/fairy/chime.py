"""chime.py — t2097: the gateway's own audio feedback (human's feature, human chose the sounds; see
DDCS-Studio/web/assets/audio/PROVENANCE.md for why these three and not "nicer" tones — a stranger has
already learned a door chime / a register / a buzzer, no vocabulary to teach).

⛔ NEVER imported/called except through the Poller.on_sound callback bridge.py's run_loop() wires (mirroring
on_checkpoint) — and run_loop() is never reached by fairy's own unit tests or --self-test (they call
build() directly), so nothing in fairy's own test surface can trigger a sound. Importing this module does
NOT import winsound at module scope (winsound doesn't exist off Windows) — the import is deferred into the
thread that actually plays, guarded by the same platform check `play()` already did.
"""
import os
import sys
import threading

# event -> filename under <studio_dir>/assets/audio/ (see PROVENANCE.md for licence + why these three)
_FILES = {
    "received": "361564__matthewwong__ding-dong.wav",              # a job came in — the door chime
    "delivered": "209578__zott820__cash-register-purchase.wav",    # delivered to the controller — the register
    "failed": "700641__producing_raylite__incorrect-buzzer.wav",   # refused / delivery failed / stalled — the buzzer
}

_cache = {}   # event -> raw WAV bytes, loaded once


def _bytes_for(studio_dir, event):
    data = _cache.get(event)
    if data is None:
        fname = _FILES.get(event)
        if not fname:
            return None
        with open(os.path.join(studio_dir, "assets", "audio", fname), "rb") as f:
            data = f.read()
        _cache[event] = data
    return data


def play(studio_dir, event):
    """Fire-and-forget: play the WAV for `event` ('received' | 'delivered' | 'failed') on a throwaway
    thread, never blocking the caller (poller.py's delivery path blocks by design and must never wait on
    audio). A no-op off Windows, with no studio_dir, or on any read/playback error — audio feedback must
    never affect delivery, so every failure here is swallowed rather than raised."""
    if sys.platform != "win32" or not studio_dir:
        return
    try:
        data = _bytes_for(studio_dir, event)
        if not data:
            return
    except Exception:
        return

    def _go():
        try:
            import winsound
            winsound.PlaySound(data, winsound.SND_MEMORY | winsound.SND_ASYNC)
        except Exception:
            pass

    threading.Thread(target=_go, daemon=True).start()
