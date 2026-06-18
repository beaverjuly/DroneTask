
## Base URLs

|Environment |Base URL                                     |
|------------|---------------------------------------------|
|**Local**   |`http://localhost:8000/index.html`           |
|**Pavlovia**|`https://run.pavlovia.org/jiaheyi/DroneTask/`|

-----

## Dev/QA URLs (Local)

Use these locally for testing. All save to a CSV download at the end (not to Pavlovia).

### Core Routes

```
http://localhost:8000/index.html?dev=1&stage=STAGE&consent=0&block=BLOCK
```

|Stage          |Purpose                                                         |Example URL                                        |Console output                                                                  |
|---------------|----------------------------------------------------------------|---------------------------------------------------|--------------------------------------------------------------------------------|
|`instructions` |Full instructions + practice trials + comprehension loops       |`?dev=1&stage=instructions&consent=0`              |`[DEV] stage: instructions only`                                                |
|`comprehension`|**NEW**: Comprehension checks only (skips inst decks & practice)|`?dev=1&stage=comprehension&consent=0`             |`[DEV] stage: comprehension checks only (loops until correct, never terminates)`|
|`encoding`     |Encoding trials (single block, capped)                          |`?dev=1&stage=encoding&block=1&ntrials=5&consent=0`|`[DEV] stage: encoding, block=1`                                                |
|`test`         |Memory test only (seeded fake encoding data)                    |`?dev=1&stage=test&block=1&consent=0`              |`[DEV] Seeded 50 trials…`                                                       |
|`encoding-test`|**PREFERRED**: Full block = encoding + memory                   |`?dev=1&stage=encoding-test&block=1&consent=0`     |`[DEV] stage: encoding+test (block 1)`                                          |
|`termination`  |Termination screen only                                         |`?dev=1&stage=termination&consent=0`               |`[DEV] stage: termination`                                                      |

### Individual Block Testing

```bash
# Block 1 (encoding only, 5 trials)
?dev=1&stage=encoding&block=1&ntrials=5&consent=0

# Block 2 (encoding only, 5 trials)
?dev=1&stage=encoding&block=2&ntrials=5&consent=0

# Memory test, block 1 (all 14 pairs, seeded data)
?dev=1&stage=test&block=1&consent=0

# Memory test, block 2 (all 14 pairs, seeded data)
?dev=1&stage=test&block=2&consent=0

# Memory test, block 2 with alias
?dev=1&stage=test&block=boundary&consent=0

# Full encoding+test, block 1 (50 encoding + 14 memory pairs)
?dev=1&stage=encoding-test&block=1&consent=0

# Full encoding+test, block 2 (50 encoding + 14 memory pairs)
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

Same dev routes as local, but data is saved to Pavlovia CSV (not downloaded) and metadata is stamped.

Replace the base URL with Pavlovia: `https://run.pavlovia.org/jiaheyi/DroneTask/`

```

### Force Pavlovia Save (even in dev mode)

```bash
?dev=1&stage=test&block=1&pavlovia_save=1&consent=0
```

-----

## Production URLs (Prolific Participants)

### Pavlovia Pilot Run (Researcher testing before launch)

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

Prolific automatically injects:

- `PROLIFIC_PID` — participant ID
- `STUDY_ID` — study ID
- `SESSION_ID` — session ID

Data is saved to Pavlovia and the participant is redirected to Prolific completion codes (or reject, depending on data quality checks).

**Before deploying to Prolific**, replace the placeholder completion codes in `index.html` (lines ~180–181):

```javascript
var CODE_SUCCESS = 'REPLACE_WITH_PROLIFIC_SUCCESS_CODE';
var CODE_REJECT  = 'REPLACE_WITH_PROLIFIC_REJECT_CODE';
```

-----

## Parameter Reference

|Parameter      |Value(s)                |Effect                                                               |Safe in production?                                       |
|---------------|------------------------|---------------------------------------------------------------------|----------------------------------------------------------|
|`dev`          |`1`                     |Activates debug routing (`stage=` branches); suppresses Pavlovia save|❌ QA only                                                 |
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
|`comprehension`       |**NEW**: Comprehension checks only     |Skips inst1–inst4 decks and practice trials; review decks still render on click|
|`encoding`            |Encoding trials only                   |One block, capped via `ntrials`                                                |
|`test` / `recognition`|Memory test only                       |One block, seeded with fake encoding data                                      |
|`encoding-test`       |Full block                             |Encoding (50 trials) + memory test (14 pairs)                                  |
|`termination`         |Termination screen only                |Shows payoff message                                                           |
|*(omitted)*           |Full experiment                        |All 4 blocks, consent, demographics, feedback                                  |

-----

## File Structure

```
static/
├── task/
│   ├── comprehension1.js          (Mechanics check, loops until correct)
│   ├── comprehension2.js          (Mission check, loops until correct)
│   ├── dev_routes.js              (Dev/QA route handling, stage selection)
│   ├── data_saving.js             (Pavlovia/CSV persistence)
│   ├── dev_routes.js              (QA route builder)
│   ├── instructions.js            (Inst1–4, quiz, practice intros)
│   ├── latin_square.js            (Block order counterbalancing)
│   ├── memory_task.js             (Recognition memory plugin)
│   ├── preload.js                 (Image preloading)
│   ├── stimuli.js                 (Stimulus definitions, PREDEFINED_PAIRS)
│   ├── trial.js                   (Main drone-task trial plugin)
│   └── game.min.css               (Task styling)
├── lib/
│   ├── jspsych-6.3.1/             (jsPsych library & plugins)
│   └── jspsych-pavlovia-3.2.5.js  (Pavlovia integration)
└── js/
    ├── jspsych-survey-*.js        (Survey plugins)
    ├── nivturk-plugins.js         (MTurk compatibility)
    └── jspsych-screen-check.js    (Device requirements)

index.html                          (Main entry point with timeline construction)
```