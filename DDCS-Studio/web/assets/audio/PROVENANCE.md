# Audio assets — where they came from, and what you may do with them

Every file here is **CC0 (public domain)** — no attribution is legally required, no commercial
restriction applies. This file exists anyway so nobody has to re-derive it, and so a future
addition cannot quietly slip in something that ISN'T CC0.

⭐ **The provenance is IN THE FILENAME**, and that is the convention to keep:
`<freesound-id>__<uploader>__<name>.wav`. The id alone recovers the licence from the API:
`GET https://freesound.org/apiv2/sounds/<id>/?fields=license`

| file | Freesound id | by | length | licence |
|---|---|---|---|---|
| `361564__matthewwong__ding-dong.wav` | [361564](https://freesound.org/s/361564/) | MatthewWong | 2.80s | CC0 |
| `209578__zott820__cash-register-purchase.wav` | [209578](https://freesound.org/s/209578/) | Zott820 | 2.75s | CC0 |
| `700641__producing_raylite__incorrect-buzzer.wav` | [700641](https://freesound.org/s/700641/) | Producing_RayLite | 0.60s | CC0 |

t2125 — `421337__jaszunio15__click_100.wav` (the browser's UI-click sample) is gone from this table
because it's gone from the folder: `ui/sound.js`'s themed synthesis replaced it, so there is no file
left for this row to describe. The three job sounds above are unaffected — they stay sampled
(SOUND-PLAN.md section 5), unthemed, on purpose.

## ⭐ WHY THESE THREE SOUNDS, and not "nicer" ones
The human's design, and it is better than the one it replaced: **use sounds people have ALREADY
LEARNED.** A convenience store teaches everyone two meanings for free —

- **the door chime** = *something just came in, look up*  → a job was CLAIMED
- **the register** = *the transaction COMPLETED*          → delivered to the controller
- **the buzzer** = *wrong* (every game show ever)         → delivery FAILED

An operator needs no training and no manual. The earlier proposal (a tick, a bell, a buzz at
different pitches) required someone to LEARN a vocabulary, and pitch differences do not survive a
running spindle. ⚠ **If these are ever replaced, replace them with sounds from three different
FAMILIES that a stranger could already interpret** — not with three pleasant tones.

## FORMAT — a hard constraint, not a preference
WAV, PCM 16-bit, mono, 44.1 kHz. ⛔ **Not MP3, not OGG.** The gateway plays these through Python's
`winsound`, which handles PCM WAV only. The browser would accept anything; the daemon would not,
and both ends play the same files.

⚠ Freesound's API token only serves **MP3 previews** — the original file needs OAuth2. These were
fetched as `preview-hq-mp3` and converted with ffmpeg (`-ac 1 -ar 44100 -acodec pcm_s16le`).
That is lossy→PCM, which is inaudible in a 0.6-2.8s notification and saves the OAuth work.
The credential used is the local one at `~/.claude/freesound-token.txt` (see
`APPS/claude-audio-feedback/freesound-get.ps1`) — **it is not in this repo and must not be.**
