# Merge-test state — for the restarted Ranchy session (2026-09-07)

Ranchy's Claude session was restarted here to update an outdated VS Code extension. The cross-machine shard
MERGE TEST was mid-flight. This carries the merge-test specifics the handoff loop marker (turn 2716, ball →
advisor, worker idle) does not.

## Where the merge test stands — two shards run, both GREEN, merge NOT yet done
- **Ranchy `report-01.zip`** — DONE @ 76dca562. `--shard=1/40`: node tier 795 green + e2e 67 passed / 0 failed /
  3 flaky / 0 unexpected. File already on disk here: `DDCS-Studio/blob-report-collected/report-01.zip` (112 KB).
- **ASUS `report-02.zip`** — DONE @ 8199b77d (on the ASUS TUF). `--shard=2/40`: 67 passed / 0 failed / 0 flaky.
  File on the ASUS: `C:\Users\danse\APPS\DDCS-Studio\DDCS-Studio\blob-report-collected\report-02.zip` (75 KB).
- ⚠ Same-commit nick (76dca562 vs 8199b77d) = support-batch-2 ONLY (PW_WORKERS override + progress multi-room),
  ZERO `tests/` changes → identical test set + `--shard` slicing → the merge is VALID. Named to the ASUS already.

## ⭐ REMAINING STEP (do after restart)
1. Get the ASUS's `report-02.zip` onto Ranchy — owner moves it via RustDesk into Ranchy's
   `DDCS-Studio/blob-report-collected/`, next to `report-01.zip` (both files must sit together).
2. `cd DDCS-Studio; npm run test:merge-reports` → eyeball `playwright-report/`.
   Expect: 2 shards, ~134 e2e tests, ALL GREEN, node tier ABSENT from the blob (it ran separately on shard-1 —
   that is the design working, not a loss).
3. Clean → the cross-machine sharding architecture is PROVEN; unblocks the §2b runner build.

## Pending OWNER decision (blocks the runner)
The §2b transfer MECHANISM for the AUTOMATED setup (RustDesk owner-drop is a one-shot, not it):
- **Self-hosted GitHub Actions runner** — transfer free via CI artifacts, CI merges. ⚠ NO `gh` CLI on the ASUS yet.
- **Polling wrapper + synced folder** (Drive/Syncthing/SMB) — simpler, but owner owns the sync; a half-synced
  zip merges as garbage.
Owner was deciding this post-restart. Agreed sequencing with the ASUS: merge test → transfer mechanism → runner
(watchdog / no-sleep / power LAST).

## ASUS coordination
- ASUS advisor `SendMessage` to: `bridge:session_011FrMxihDrSdLMVPz46vTVM` (name "You're advisor", hostname
  Fred-ASUS-TUF, session ddcs-studio-3d). Two-way works — occasional "delivery not confirmed" warnings but
  messages land; fall back to the owner if one seems to vanish. ⚠ Re-run `ListAgents` for its CURRENT ref before
  messaging (refs go stale on restart — that cost real time this session).
- ASUS owns box-local (runner, no-sleep, watchdog, Defender); Ranchy owns repo plumbing (DONE). See
  `context/HANDOFF-TO-ASUS.md` §2a (finalized `--shard` interface), `context/SENDMESSAGE-SETUP.md` (messaging
  setup + why the /remote-control toggle fails — fresh connected launch only), `context/SHARD-COMMS.md` (async log).

## Loop / repo state
`main` == `wizards-as-data-blocks` @ 76dca562 (migration + Phase-2 de-sleep + sharding plumbing + support batch 2
all merged). Handoff turn 2716, ball → advisor, worker idle. Phase 2 remaining (lower priority than sharding):
more de-sleep / the 70 MB PNG-write freebie / the 3D scene-graph sweep — see `DDCS-Studio/tests/TIER-MIGRATION-PLAN.md`.
