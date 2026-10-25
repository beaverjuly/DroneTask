# DroneTask — Analysis

Post-processing and analysis tools for DroneTask data collected via Pavlovia.

## Folder layout

```
DroneTask/
├── analysis/
│   ├── split_drone_data.py     # raw → per-table CSVs (run first)
│   ├── drone_task/             # main task analysis notebook
│   ├── mouse_qc/               # mouse trajectory notebook and features
│   ├── memory_screen/          # memory screen notebook and helpers
│   ├── data/                   # private data, organized by module
│   │   ├── drone_task/         # raw/, clean/, derived/
│   │   ├── mouse_qc/           # raw/, clean/, derived/
│   │   └── memory_screen/      # raw/, clean/, derived/
│   ├── requirements.txt        # dependencies for all three analyses
│   └── README.md               # analysis workflow and data routing
├── design_checks/
│   ├── notebooks/              # design notebooks and Markdown reviews
│   ├── scripts/                # shared Python and JavaScript helpers
│   ├── figures/                # exported figures and audit tables
│   └── references/             # source data and attribution
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

`split_drone_data.py` reads each raw CSV and routes tidy tables to
`analysis/data/<module>/clean/`, dropping redundant columns. Main task,
mouse QC, and memory screen outputs have separate directories.

### Usage

```bash
# Process the three module raw folders into their own clean folders
python analysis/split_drone_data.py

# Single file
python analysis/split_drone_data.py analysis/data/drone_task/raw/DroneTask_abc123_SESSION_2026-06-21_17h42.csv

# Custom data root, containing <module>/clean/ output folders
python analysis/split_drone_data.py analysis/data/drone_task/raw/ -o /path/to/analysis-data
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
jupyter lab analysis/drone_task/drone_analysis.ipynb
```

The notebook loads `analysis/data/drone_task/clean/*_encoding.csv` and `*_memory.csv`,
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

## Optional memory screening

Enable `memory_screen=1` to insert an independent initial assessment after
comprehension and before the four main blocks. The participant plays 20 green
supply turns, then answers 10 order questions. At least 6 correct unlocks the
four blocks. A lower result ends the session through the normal saving flow.
These initial turns are not labelled as practice and do not contribute to
main analysis or bonus totals. The module is disabled by default and its
assets are not loaded on off routes.

| Use | Query parameters |
|---|---|
| Module only | `?dev=1&stage=memory-screen&consent=0&memory_screen=1` |
| Full development with screening | `?dev=1&stage=full&consent=0&memory_screen=1` |
| Full pilot with screening | `?pilot=1&memory_screen=1` |
| Full pilot without screening | `?pilot=1&memory_screen=0` |

The module uses a hidden drone that shifts exactly 9.05 percentage points on
each of 20 turns, with 10 left and 10 right shifts including the first move
from its baseline. The shift is the rounded midpoint of the main groups’ mean
absolute movements on turns when the drone changes position. Each main block
contributes 15 actual shifts; its 34 stationary transitions are excluded.
Supplies land exactly 2.957285 percentage points from the
drone, the midpoint of the main blocks’ mean absolute rendered distances, with
10 left and 10 right landings in an irregular order. These control movement
size and supply distance without establishing constant psychological surprise.
Twenty fixed object images were selected using published affect
and clarity ratings and checked against the practice and main identity pools.
A passing full route reminds participants that the drone remains hidden.
The executed [design notebook](design_checks/notebooks/06_memory_screen.ipynb) and
[exported figures](design_checks/figures/memory_screen/) document the decisions
and limitations. Its data are
split into screening encoding, order, and summary tables. A requested module
that cannot load blocks main entry. Below threshold production outcomes never
use the ordinary completion or rejection code. A separate destination can be
configured in `MEMORY_SCREENING_COMPLETION_URL`, otherwise a neutral saved
session message remains on screen. See
the consolidated [specification and design audit](design_checks/notebooks/06_memory_screen.ipynb),
the [separate screen analysis](analysis/memory_screen/memory_screen_analysis.ipynb),
and [`URLs CheatSheet.md`](URLs%20CheatSheet.md).

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
