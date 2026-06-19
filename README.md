## Base URLs

|Environment |Base URL                                     |
|------------|---------------------------------------------|
|**Local**   |`http://localhost:8000/index.html`           |
|**Pavlovia**|`https://run.pavlovia.org/jiaheyi/DroneTask/`|

-----

## Data-saving

`USE_PAVLOVIA = IS_PAVLOVIA && hasPavloviaPlugin && (!devMode || pavlovia_save=1)`

In plain terms: **any link with `dev=1` downloads a CSV to your computer
and does not touch the Pavlovia server — even on `run.pavlovia.org`.**
This applies uniformly to every dev/QA route below, on both local and
Pavlovia hosting. To force a real save to the Pavlovia server while
testing, add `&pavlovia_save=1`.

Only two link types save to Pavlovia automatically: **pilot** runs
(`?pilot=1`, no `dev=1`) and the **production** link (no parameters).

-----

## Dev/QA URLs (Local)

All save to a CSV download at the end (not to Pavlovia).

### Core Routes

```
http://localhost:8000/index.html?dev=1&stage=STAGE&consent=0&block=BLOCK
```

|Stage          |Purpose                                                  |Example URL                                        |Console output                                                                  |
|---------------|---------------------------------------------------------|---------------------------------------------------|--------------------------------------------------------------------------------|
|`instructions` |Full instructions + practice trials + comprehension loops|`?dev=1&stage=instructions&consent=0`              |`[DEV] stage: instructions only`                                                |
|`comprehension`|Comprehension checks only (skips inst decks & practice)  |`?dev=1&stage=comprehension&consent=0`             |`[DEV] stage: comprehension checks only (loops until correct, never terminates)`|
|`encoding`     |Encoding trials (single block, capped)                   |`?dev=1&stage=encoding&block=1&ntrials=5&consent=0`|`[DEV] stage: encoding, block=1`                                                |
|`test`         |Memory test only (seeded fake encoding data)             |`?dev=1&stage=test&block=1&consent=0`              |`[DEV] Seeded 50 trials…`                                                       |
|`encoding-test`|**Preferred**: full block = encoding + memory            |`?dev=1&stage=encoding-test&block=1&consent=0`     |`[DEV] stage: encoding+test (block 1)`                                          |

### Individual Block Testing

```bash
# Block 1 / 2 (encoding only, 5 trials)
?dev=1&stage=encoding&block=1&ntrials=5&consent=0
?dev=1&stage=encoding&block=2&ntrials=5&consent=0

# Memory test, block 1 / 2 (all 14 pairs, seeded data)
?dev=1&stage=test&block=1&consent=0
?dev=1&stage=test&block=2&consent=0

# Memory test, block 2 via alias
?dev=1&stage=test&block=boundary&consent=0

# Full encoding+test, block 1 / 2 (50 encoding + 14 memory pairs)
?dev=1&stage=encoding-test&block=1&consent=0
?dev=1&stage=encoding-test&block=2&consent=0
```

### Full Experiment Simulation (Local, Pilot Mode)

```bash
# Full experiment, 4 blocks, no Prolific redirect, consent skipped
http://localhost:8000/index.html?pilot=1&consent=0

# Full experiment, 4 blocks, normal flow with consent screen
http://localhost:8000/index.html
```

-----

## Dev/QA URLs (Pavlovia)

Same dev routes and same CSV-download behavior as local — see
“Data-saving behavior” above. Replace the base URL with Pavlovia:
`https://run.pavlovia.org/jiaheyi/DroneTask/`

### Force a real Pavlovia save (even in dev mode)

```bash
?dev=1&stage=test&block=1&pavlovia_save=1&consent=0
```

-----

## Production URLs (Prolific Participants)

### Pavlovia Pilot Run (researcher testing before launch)

```bash
# Full experiment, 4 blocks, no Prolific redirect, consent screen shown
https://run.pavlovia.org/jiaheyi/DroneTask/?pilot=1

# Same but skip consent (research use only)
https://run.pavlovia.org/jiaheyi/DroneTask/?pilot=1&consent=0
```

Console output:

```
[MODE] PILOT_MODE = true  (no Prolific redirect)
USE_PAVLOVIA = true
DATA_SAVE_MODE = pavlovia
```

### Production: Real Prolific Participants

```bash
https://run.pavlovia.org/jiaheyi/DroneTask/
```

Prolific automatically injects `PROLIFIC_PID`, `STUDY_ID`, and
`SESSION_ID`. Data is saved to Pavlovia and the participant is redirected
to a Prolific completion code (success or reject, depending on data
quality checks).

**Before deploying to Prolific**, replace the placeholder completion
codes in `index.html`:

```javascript
var CODE_SUCCESS = 'REPLACE_WITH_PROLIFIC_SUCCESS_CODE';
var CODE_REJECT  = 'REPLACE_WITH_PROLIFIC_REJECT_CODE';
```

-----

## Consent screen (static/task/consent.js)

Consent is no longer hardcoded in `index.html`. It now lives in its own
file, `static/task/consent.js`, which exports `buildConsentTrial()`.

- If the file is present → the consent screen is shown automatically
  (unless `?consent=0`).
- If the file is missing from the repo → consent is skipped automatically,
  no code change needed.

Edit the placeholder study description, risks, compensation, and IRB
contact text directly inside `consent.js` before deploying.

-----

## Full screen

Production, pilot, and the full (no-`stage`) dev route all open in full
screen. A small, low-contrast badge appears in the corner if a participant
exits full screen mid-session, prompting them to return — it never
overlays the game area or memory-test stimuli. The short QA stage routes
(`instructions`, `comprehension`, `encoding`, `test`, `encoding-test`)
never force full screen, so DevTools stay usable while testing.

-----

## Randomization

- **Condition order**: a 4×4 Latin square assigns each participant’s
  block order (reward/loss × high/low volatility), deterministically
  hashed from their Prolific ID — no two participants need to share an
  order, but it’s reproducible from the ID alone.
- **Stimulus order**: the full object pool is shuffled once per
  participant, split into four unique 50-item blocks, then each block is
  independently re-shuffled. This decouples object identity from trial
  position within a block. The resulting per-block order is saved as
  `stimulus_block_orders` for auditing.

-----

## Data columns of note

|Column                  |Meaning                                                                        |
|------------------------|-------------------------------------------------------------------------------|
|`supply_caught`         |Raw fragments captured this trial (0–10). Drives the participant bonus.        |
|`score`                 |Points actually shown to the participant (reward 0 to +10, loss −10 to 0).     |
|`total_supply_caught`   |Session-level sum of `supply_caught` across all main-task trials.              |
|`total_score`           |Session-level sum of `score` across all main-task trials.                      |
|`perf_timer_ms_per_call`|Timer-resolution benchmark (ms/call), recorded once per session.               |
|`perf_dom_ms_per_op`    |DOM create/destroy benchmark (ms/op), recorded once per session.               |
|`perf_slow_flag`        |`true` if either benchmark exceeds threshold — flags possibly slow devices.    |
|`stimulus_block_orders` |The shuffled per-block stimulus order, for reconstructing object-trial mapping.|

All `bird_*` / `coins_*` naming has been renamed to `drone_*` / `supply_*`
throughout the code and saved data (e.g. `bird_position` → `drone_position`,
`coins_caught` → `supply_caught`) for consistency with the cover story.

-----

## Parameter Reference

|Parameter      |Value(s)                |Effect                                                               |Safe in production?                                       |
|---------------|------------------------|---------------------------------------------------------------------|----------------------------------------------------------|
|`dev`          |`1`                     |Activates debug routing (`stage=` branches); forces CSV-download save|❌ QA only                                                 |
|`stage`        |see table below         |Selects which route/portion of the task to run                       |❌ QA only (except when absent, which runs full experiment)|
|`block`        |`1–4` or `boundary`     |Which block to load in `encoding`, `test`, or `encoding-test` stages |❌ QA only                                                 |
|`ntrials`      |integer                 |Cap the number of trials per encoding block                          |❌ QA only                                                 |
|`pilot`        |`1`                     |Pilot mode: no Prolific redirect; shows thank-you screen instead     |✅ Yes, for researcher testing                             |
|`consent`      |`0`                     |Skip consent screen                                                  |❌ Research use only                                       |
|`pavlovia_save`|`1`                     |Force Pavlovia save even with `dev=1`                                |⚠️ Researcher use                                          |
|`latin_group`  |`0–3`                   |Force specific Latin-square group (overrides randomization)          |❌ QA only                                                 |
|`version`      |`simple`, `rich`, `full`|Task variant selector (if implemented)                               |❌ QA only                                                 |

### Stage values (QA only, all require `dev=1`)

|Stage                 |Purpose                                |Behavior                                                                       |
|----------------------|---------------------------------------|-------------------------------------------------------------------------------|
|`instructions`        |Instructions + practice + comprehension|Full walkthrough (no main task)                                                |
|`comprehension`       |Comprehension checks only              |Skips inst1–inst4 decks and practice trials; review decks still render on click|
|`encoding`            |Encoding trials only                   |One block, capped via `ntrials`                                                |
|`test` / `recognition`|Memory test only                       |One block, seeded with fake encoding data                                      |
|`encoding-test`       |Full block                             |Encoding (50 trials) + memory test (14 pairs)                                  |
|*(omitted)*           |Full experiment                        |All 4 blocks, consent, demographics, feedback                                  |

-----

## File Structure

```
static/
├── task/
│   ├── comprehension1.js          (Mechanics check, loops until correct)
│   ├── comprehension2.js          (Mission check, loops until correct)
│   ├── consent.js                 (IRB consent screen — optional, auto-detected)
│   ├── dev_routes.js              (Dev/QA route handling, stage selection)
│   ├── data_saving.js             (Pavlovia/CSV persistence)
│   ├── instructions.js            (Inst1–4, quiz, practice intros)
│   ├── latin_square.js            (Block order counterbalancing)
│   ├── memory_task.js             (Recognition memory plugin)
│   ├── preload.js                 (Image preloading)
│   ├── stimuli.js                 (Stimulus definitions, PREDEFINED_PAIRS)
│   ├── stimuli-details.js         (Valence config, drop animation constants)
│   ├── trial.js                   (Main drone-task trial plugin)
│   └── game.min.css               (Task styling)
├── lib/
│   ├── jspsych-6.3.1/             (jsPsych library & core plugins)
│   └── jspsych-pavlovia-3.2.5.js  (Pavlovia integration)
└── js/
    ├── jspsych-survey-demo.js     (Demographics form)
    ├── jspsych-survey-template.js (Likert/survey scaffold)
    └── nivturk-plugins.js         (Prolific redirect handling)

index.html                          (Main entry point with timeline construction)
```