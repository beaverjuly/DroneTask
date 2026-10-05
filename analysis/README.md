# DroneTask — Analysis

Post-processing and analysis tools for DroneTask data collected via Pavlovia.

## Folder layout

```
DroneTask/
├── analysis/
│   ├── split_drone_data.py     # raw → per-table CSVs (run first)
│   ├── drone_analysis.ipynb    # main analysis notebook (run second)
│   ├── mouse_qc/               # optional, self-contained mouse-QC analysis
│   │   ├── mouse_features.py
│   │   ├── mouse_trajectory_analysis.ipynb
│   │   └── README.md
│   └── README.md               # this file
└── data/
    ├── raw/                    # Pavlovia downloads land here (gitignored)
    └── clean/                  # split output (gitignored)
```

## Step 1 — Split raw Pavlovia CSVs

Pavlovia exports one wide CSV per session, named:

```
DroneTask_{participantId}_SESSION_{date}_{time}.csv
```

`split_drone_data.py` reads each raw CSV and writes the standard tidy tables,
dropping redundant session-stamped columns repeated on every raw row. If (and
only if) optional mouse-QC rows are present, it also writes compact trajectory
and summary tables. Core-only exports require no mouse-QC analysis code.

### Usage

```bash
# Process every CSV in data/raw/ → data/clean/
python analysis/split_drone_data.py data/raw/

# Process a single file
python analysis/split_drone_data.py data/raw/DroneTask_abc123_SESSION_2026-06-21_17h42.11.249.csv

# Custom output directory
python analysis/split_drone_data.py data/raw/ -o data/clean/

# Optional large, long-form pointer-event table when QC rows are present
python analysis/split_drone_data.py data/raw/ --explode-mouse
```

### Output (per participant, named `{pid}_{date}_{table}.csv`)

|Table          |Rows|Contents                                                       |
|---------------|----|---------------------------------------------------------------|
|`metadata`     |1   |Session IDs, Latin-square group/order, preload stats, totals   |
|`encoding`     |200 |Main-task game trials: drone/bag/bucket positions, catch, score|
|`memory`       |~56 |Order judgments, distance estimates, placement errors          |
|`practice`     |~13 |Practice game trials (same structure as encoding)              |
|`comprehension`|~4  |Comprehension-check responses, errors, attempts                |
|`demographics` |1   |Post-task survey responses                                     |
|`preload_diagnostics`|varies|Per-stimulus preload and fallback diagnostics             |
|`mouse_trajectory`|up to 8|Optional QC movements; raw samples/events remain JSON       |
|`mouse_summary`|1|Optional QC completion, device, browser, and geometry metadata      |
|`mouse_events`|varies|Optional long pointer table; written only with `--explode-mouse`|

The `pid` for filenames is taken from `PROLIFIC_PID` when present, otherwise
the participant ID parsed out of the Pavlovia filename. The parsed filename
fields (`pavlovia_pid`, `pavlovia_date`, `pavlovia_time`) are also appended to
the `metadata` table for provenance. Metadata also preserves the optional QC
assignment/load fields (`task_variant`, `mouse_qc_requested`,
`mouse_qc_enabled`, `mouse_qc_asset_status`, module/geometry versions,
`mt_status`, and the self-reported pointer type). Legacy files leave these
blank; current core-only runs explicitly record `core` / `not_requested` and
leave only module-result fields blank.

## Analysis notebook

```bash
pip install pandas numpy scipy statsmodels matplotlib seaborn
jupyter lab analysis/drone_analysis.ipynb
```

`drone_analysis.ipynb` loads every `*_encoding.csv` and `*_memory.csv` from
`data/clean/`, concatenates across participants, and runs the full analysis
pipeline (prediction errors, learning rates, memory segmentation, temporal
order / distance memory, and subjective duration bias), broken down by the
volatility / stochasticity / valence design factors. 

## Optional mouse-trajectory QC analysis

```bash
python analysis/mouse_qc/mouse_features.py --selftest
jupyter lab analysis/mouse_qc/mouse_trajectory_analysis.ipynb
```

See `analysis/mouse_qc/README.md`. The notebook counts every session assigned
or requesting QC in the completion denominator, including missing summaries,
and restricts primary kinematic summaries to completed rows from complete
eight-trajectory sessions. Skipped and incomplete data are audited separately.

## Design reference

The task uses a Latin-square-counterbalanced 2×2×2 design. The four canonical
conditions (each a 50-trial block) are:

|condition_id             |Volatility|Stochasticity|Valence|
|-------------------------|----------|-------------|-------|
|`A_reward_highVol_lowStc`|high      |low          |reward |
|`B_reward_lowVol_highStc`|low       |high         |reward |
|`C_loss_highVol_lowStc`  |high      |low          |loss   |
|`D_loss_lowVol_highStc`  |low       |high         |loss   |

`latin_square_order` (in `metadata`) records the per-participant presentation
order; `block` / `display_block` give the order each participant actually saw.
Always analyse by the **canonical** condition factors (`vol_level`,
`stc_level`, `valence`), not by display order.
