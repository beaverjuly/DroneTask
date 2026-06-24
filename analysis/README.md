# DroneTask — Analysis

Post-processing and analysis tools for DroneTask data collected via Pavlovia.

## Folder layout

```
DroneTask/
├── analysis/
│   ├── split_drone_data.py     # raw → per-table CSVs (run first)
│   ├── drone_analysis.ipynb    # main analysis notebook (run second)
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

`split_drone_data.py` reads each raw CSV and writes **six tidy tables per
participant**, dropping the redundant session-stamped columns that are
repeated on every row of the raw file.

### Usage

```bash
# Process every CSV in data/raw/ → data/clean/
python analysis/split_drone_data.py data/raw/

# Process a single file
python analysis/split_drone_data.py data/raw/DroneTask_abc123_SESSION_2026-06-21_17h42.11.249.csv

# Custom output directory
python analysis/split_drone_data.py data/raw/ -o data/clean/
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

The `pid` for filenames is taken from `PROLIFIC_PID` when present, otherwise
the participant ID parsed out of the Pavlovia filename. The parsed filename
fields (`pavlovia_pid`, `pavlovia_date`, `pavlovia_time`) are also appended to
the `metadata` table for provenance.

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