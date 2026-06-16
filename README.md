# Drone Task

This repository contains the jsPsych implementation of the Drone Task, optimized for Pavlovia hosting, Prolific recruitment, and internal pilot testing. It includes a drone-based collection game (reward/loss blocks) and object-memory tests.

# Testing & Deployment Links

## Local base: http://localhost:8000/index.html

## Pavlovia base: https://run.pavlovia.org/jiaheyi/DroneTask/

|Environment |Purpose                                       |Example URL                                              |Save behavior                            |Console confirmation                             |Safe for participants?                                |
|------------|----------------------------------------------|---------------------------------------------------------|-----------------------------------------|-------------------------------------------------|------------------------------------------------------|
|**Local**   |Compat gate only                              |`?dev=1&stage=gate`                                      |CSV download at end                      |`[DEV] stage: compatibility gate only`           |QA only                                               |
|**Local**   |Instructions only                             |`?dev=1&stage=instructions`                              |CSV download at end                      |`[DEV] stage: instructions only`                 |QA only                                               |
|**Local**   |Short encoding block 1, 5 trials              |`?dev=1&stage=encoding&block=1&ntrials=5`                |CSV download at end                      |`[DEV] stage: encoding, block=1`                 |QA only                                               |
|**Local**   |Memory test only, block 1 (seeded)            |`?dev=1&stage=test&block=1`                              |CSV download at end                      |`[DEV] Seeded 50 trials…` + `Verification: 50/50`|QA only                                               |
|**Local**   |Memory test only, block 2                     |`?dev=1&stage=test&block=2`                              |CSV download at end                      |Same as above with block=2                       |QA only                                               |
|**Local**   |Memory test all boundary pairs (block 2 alias)|`?dev=1&stage=test&block=boundary`                       |CSV download at end                      |`DEV_BLOCK_NUM=2`                                |QA only — note: runs *all* 14 pairs, not only boundary|
|**Local**   |Slider QA — all pair types                    |`?dev=1&stage=test&block=1`                              |CSV download at end                      |Slider-probe spot-check in console               |QA only                                               |
|**Local**   |Full block (encoding + memory), 5 trials      |`?dev=1&stage=block&block=1&ntrials=5`                   |CSV download at end                      |`[DEV] stage: full block 1`                      |QA only                                               |
|**Local**   |Full pilot (all 4 blocks, no consent, no gate)|`?pilot=1&consent=0&gate=0`                              |CSV download at end                      |`DATA_SAVE_MODE = download`                      |Researcher testing                                    |
|**Local**   |Termination screen                            |`?dev=1&stage=termination`                               |CSV download at end                      |`[DEV] stage: termination`                       |QA only                                               |
|**Pavlovia**|Compat gate QA                                |`?dev=1&stage=gate`                                      |CSV download                             |`IS_PAVLOVIA=true, DATA_SAVE_MODE=download`      |QA only                                               |
|**Pavlovia**|Memory test QA, block 1                       |`?dev=1&stage=test&block=1&consent=0`                    |CSV download                             |`[DEV] Seeded 50 trials`                         |QA only                                               |
|**Pavlovia**|Memory test QA, block=boundary                |`?dev=1&stage=test&block=boundary&consent=0`             |CSV download                             |`DEV_BLOCK_NUM=2`                                |QA only                                               |
|**Pavlovia**|Full encoding block QA                        |`?dev=1&stage=encoding&block=1&ntrials=5&consent=0`      |CSV download                             |`[DEV] stage: encoding`                          |QA only                                               |
|**Pavlovia**|Dev + force Pavlovia save                     |`?dev=1&stage=test&block=1&pavlovia_save=1`              |Pavlovia session save                    |`USE_PAVLOVIA=true, DATA_SAVE_MODE=pavlovia`     |QA only                                               |
|**Pavlovia**|Pilot run (no Prolific redirect)              |`?pilot=1&consent=0`                                     |Pavlovia session save                    |`USE_PAVLOVIA=true, PILOT_MODE=true`             |Researcher pilot                                      |
|**Pavlovia**|Production / real Prolific participants       |*(no special params; Prolific injects PROLIFIC_PID etc.)*|Pavlovia session save + Prolific redirect|`USE_PAVLOVIA=true, PILOT_MODE=false`            |✅ Real participants                                   |

## Parameter glossary for the table above:

|Param               |Meaning                                                                                                |Safe in production?      |
|--------------------|-------------------------------------------------------------------------------------------------------|-------------------------|
|`dev=1`             |Activates debug routing (`stage=` branches); suppresses Pavlovia save                                  |No — QA only             |
|`pilot=1`           |No Prolific redirect at end; shows thank-you screen instead                                            |Yes — researcher piloting|
|`consent=0`         |Skips consent screen                                                                                   |No — research use only   |
|`gate=0`            |Compat gate is already off by default (`SHOW_COMPAT_GATE=false`); no effect unless you flip the default|N/A                      |
|`ntrials=N`         |Cap per-block trial count                                                                              |No — QA only             |
|`block=1–4`         |Which block to run in dev encoding/test/block stages                                                   |N/A — dev only           |
|`block=boundary`    |Alias for block=2 (note: not a pair filter)                                                            |N/A — dev only           |
|`latin_group=0–3`   |Force Latin-square group                                                                               |No — QA/testing only     |
|`pavlovia_save=1`   |Force Pavlovia save even with `dev=1`                                                                  |Researcher use           |
|`stage=gate`        |New: compat gate only                                                                                  |QA only                  |
|`stage=instructions`|Instructions only                                                                                      |QA only                  |
|`stage=encoding`    |Encoding trials only                                                                                   |QA only                  |
|`stage=test`        |Memory test only (seeded data)                                                                         |QA only                  |
|`stage=block`       |Full block: encoding + memory                                                                          |QA only                  |
