# DroneTask — Analysis

Post-processing and analysis tools for DroneTask data collected via Pavlovia.

## Folder layout

```
DroneTask/
├── analysis/
│   ├── split_drone_data.py     # raw → per-table CSVs (run first)
│   ├── drone_analysis.ipynb    # pilot viability analysis (run second)
│   └── README.md               # this file
├── data/
│   ├── raw/                    # Pavlovia downloads land here (gitignored)
│   └── clean/                  # split output (gitignored)
│       └── derived/            # analysis outputs (gitignored)
├── static/
│   ├── task/
│   │   ├── ui-helpers.js       # glowSquaresScreen — shared UI helper
│   │   ├── trial.js            # encoding trial plugin
│   │   ├── memory_task.js      # memory test plugin
│   │   ├── survey.js           # demographics survey builder
│   │   ├── instructions.js     # instruction decks
│   │   ├── comprehension.js    # combined mechanics and mission check
│   │   ├── preload.js          # blob-URL image preloader
│   │   ├── stimuli.js          # stimulus pool & pairs
│   │   ├── stimuli-details.js  # valence config, drop constants
│   │   ├── latin_square.js     # counterbalancing
│   │   ├── data_saving.js      # Pavlovia / CSV persistence
│   │   ├── dev_routes.js       # dev/QA route handling
│   │   ├── consent.js          # required USC IRB consent gate
│   │   ├── mouse_qc/           # optional, default-off mouse-QC module
│   │   │   ├── mouse_trajectory.js
│   │   │   └── mouse_trajectory.css
│   │   └── game.min.css        # task styling
│   ├── lib/                    # jsPsych 6.3.1 + plugins
│   ├── js/                     # survey-demo, nivturk, template plugins
│   └── stimuli/                # 200 object PNGs
├── index.html                  # main entry point
├── URLs CheatSheet.md          # dev/QA/production link reference
└── README.md                   # repo-level readme
```

## Step 1 — Split raw Pavlovia CSVs

Pavlovia exports one wide CSV per session, named:

```
DroneTask_{participantId}_SESSION_{date}_{time}.csv
```

`split_drone_data.py` reads each raw CSV and writes **seven tidy tables per
participant**, dropping redundant columns.

### Usage

```bash
# Process every CSV in data/raw/ → data/clean/
python analysis/split_drone_data.py data/raw/

# Single file
python analysis/split_drone_data.py data/raw/DroneTask_abc123_SESSION_2026-06-21_17h42.csv

# Custom output directory
python analysis/split_drone_data.py data/raw/ -o data/clean/
```

### Output (per participant, named `{pid}_{date}_{table}.csv`)

|Table                |Rows|Contents                                                      |
|---------------------|----|--------------------------------------------------------------|
|`metadata`           |1   |Session IDs, Latin-square, preload stats, totals              |
|`encoding`           |200 |Main-task game trials: positions, catch, score, PE, display QA|
|`memory`             |~56 |Order judgments, distance estimates, placement errors         |
|`practice`           |~13 |Practice game trials                                          |
|`comprehension`      |~4  |Comprehension-check responses, errors, attempts               |
|`demographics`       |1   |Post-task survey responses                                    |
|`preload_diagnostics`|200 |Per-URL preload outcome, encoding/memory fallback counts      |

### Requirements

```bash
pip install pandas
```

## Step 2 — Run the analysis notebook

```bash
pip install pandas numpy scipy statsmodels matplotlib seaborn
jupyter lab analysis/drone_analysis.ipynb
```

The notebook loads `data/clean/*_encoding.csv` and `*_memory.csv`,
concatenates across participants, and runs the full pilot viability
pipeline:

|Section                         |Purpose                                                  |
|--------------------------------|---------------------------------------------------------|
|Completion & data integrity     |Session completion rate, missing blocks/trials           |
|Preload & technical health      |Asset failure rate, preload timing                       |
|Prediction errors & learning    |PE distributions, learning rate by regime × valence      |
|Order memory above chance       |Per-participant accuracy, one-sample t vs 50%            |
|Distance estimation variability |Within-participant SD, signed bias by condition          |
|Segmentation index computability|Boundary tagging, cross-vs-within contrast, cell coverage|
|Kalman-filter parameter recovery|MLE fit of (vol, stc, motor noise) per block             |
|Directional plausibility        |Matched-PE segmentation index, effect sizes, power       |
|Pilot decision summary          |Go/no-go table across all checks                         |

## Design reference

|condition_id             |Volatility|Stochasticity|Valence|
|-------------------------|----------|-------------|-------|
|`A_reward_highVol_lowStc`|high      |low          |reward |
|`B_reward_lowVol_highStc`|low       |high         |reward |
|`C_loss_highVol_lowStc`  |high      |low          |loss   |
|`D_loss_lowVol_highStc`  |low       |high         |loss   |

## Dev routes

All dev routes require `?dev=1`. Add `&consent=0` to skip consent.

|Stage        |URL parameter        |Purpose                         |
|-------------|---------------------|--------------------------------|
|instructions |`stage=instructions` |Full instructions + practice    |
|comprehension|`stage=comprehension`|Comprehension checks only       |
|encoding     |`stage=encoding`     |One encoding block              |
|test         |`stage=test`         |One memory test (seeded data)   |
|encoding-test|`stage=encoding-test`|Full block: encoding + memory   |
|mouse-test   |`stage=mouse-test`   |Mouse-QC module only            |
|survey       |`stage=survey`       |Demographics survey preview only|

## Optional mouse-trajectory QC

The browser module is isolated in `static/task/mouse_qc/` and is disabled by
default. It is enabled only by the exact query parameter `mouse_qc=1`.
Absent, empty, `0`, or any other value runs the core task and does not create
HTML asset elements or request files from the optional module directory. This
means the directory can be left out of a deployment—or deleted—without
affecting core/off routes.

When enabled successfully, the module runs after all game and memory trials
and before the completion/demographics screens. The `encoding-test` dev route
also appends it after that block's memory test for faster integrated QA.

|Variant|Query flag|Saved `task_variant`|
|-------|----------|--------------------|
|Core|absent or `mouse_qc=0`|`core`|
|Core + mouse QC|`mouse_qc=1`|`core+mouse-qc`|
|Requested but unavailable (non-dev)|`mouse_qc=1`|`core+mouse-qc-load-failed`|

Developer routes fail with a configuration-error-only screen if `mouse_qc=1`
was requested but its assets or builder are unavailable. Pilot/production
routes continue through the core task so an optional-module deployment error
does not strand a participant; the failure is recorded in every data row.
Every row also receives `task_version`, `stimuli_version`,
`mouse_qc_requested`, `mouse_qc_enabled`, `mouse_qc_asset_status`, and the
module/geometry versions. Raw trajectories remain confined to the module's own
trial rows.

### Paired QA and pilot routes

```text
# Full local dev, core
http://localhost:8000/index.html?dev=1&stage=full&latin_group=0&consent=0&mouse_qc=0

# Full local dev, core + mouse QC
http://localhost:8000/index.html?dev=1&stage=full&latin_group=0&consent=0&mouse_qc=1

# Fast integrated QA (one complete encoding + memory block, then mouse QC)
http://localhost:8000/index.html?dev=1&stage=encoding-test&block=1&latin_group=0&consent=0&mouse_qc=1

# Mouse-QC module only
http://localhost:8000/index.html?dev=1&stage=mouse-test&consent=0&mouse_qc=1

# Pavlovia pilot, core
https://run.pavlovia.org/jiaheyi/DroneTask/?pilot=1&mouse_qc=0

# Pavlovia pilot, core + mouse QC
https://run.pavlovia.org/jiaheyi/DroneTask/?pilot=1&mouse_qc=1
```

See `URLs CheatSheet.md` for the complete route reference.

The standalone lab briefing deck is at
`design_checks/mouse_qc_lab_brief.html`. Serve the repository locally and open
`http://localhost:8000/design_checks/mouse_qc_lab_brief.html` to present it.
