# Analysis

Each task component has its own code folder and matching private data folder.

| Component | Notebook | Data |
|---|---|---|
| Drone task | [drone_analysis.ipynb](drone_task/drone_analysis.ipynb) | `analysis/data/drone_task/` |
| Mouse QC | [mouse_trajectory_analysis.ipynb](mouse_qc/mouse_trajectory_analysis.ipynb) | `analysis/data/mouse_qc/` |
| Memory screen | [memory_screen_analysis.ipynb](memory_screen/memory_screen_analysis.ipynb) | `analysis/data/memory_screen/` |

```text
analysis/
├── drone_task/
│   ├── drone_analysis.ipynb
│   └── README.md
├── mouse_qc/
│   ├── mouse_features.py
│   ├── mouse_trajectory_analysis.ipynb
│   └── README.md
├── memory_screen/
│   ├── memory_screen_analysis.py
│   ├── memory_screen_analysis.ipynb
│   └── README.md
├── data/
│   ├── drone_task/       # raw/, clean/, derived/
│   ├── mouse_qc/         # raw/, clean/, derived/
│   ├── memory_screen/    # raw/, clean/, derived/
│   └── README.md
├── split_drone_data.py   # shared dispatcher
├── requirements.txt
└── README.md
```

## Data preparation

Put full session exports in `analysis/data/drone_task/raw/`. A full export may
contain all three task components and should have one canonical raw copy.
Module-only development exports belong in the respective module's raw folder.
All raw, clean, and derived data folders are gitignored.

From the repository root, install dependencies and split the raw files.

```sh
python -m pip install -r analysis/requirements.txt
python analysis/split_drone_data.py
```

The splitter scans the three raw folders, ignores byte-identical raw copies,
and writes each table to its module's clean folder. It creates missing data
directories automatically. To process one source or use another organized data root,

```sh
python analysis/split_drone_data.py analysis/data/drone_task/raw/session.csv
python analysis/split_drone_data.py analysis/data/drone_task/raw/ -o /path/to/analysis-data
python analysis/split_drone_data.py --explode-mouse
```

`-o` specifies a data root containing `drone_task/clean`, `mouse_qc/clean`,
and `memory_screen/clean`. Direct Python calls to `process_one(filepath, outdir)`
retain flat output for isolated temporary ingestion. Optional `module_dirs`
enables the same routing used by the CLI.

| Output folder | Tables |
|---|---|
| `drone_task/clean` | Metadata, encoding, memory, practice, comprehension, demographics, preload diagnostics |
| `mouse_qc/clean` | Metadata, mouse trajectory, mouse summary, optional exploded mouse events |
| `memory_screen/clean` | Metadata, memory screening encoding, order, and summary |

Full-session metadata accompanies each module so requested, disabled,
technically failed, and interrupted sessions can remain in the appropriate
audit denominator. Raw files stored in a module-only raw directory contribute
metadata to that module's inventory. Missing optional rows never become
successful assessments.

Split filenames retain `{participant}_{date}_{table}.csv`. The metadata table
preserves source date and time and available assignment, module version, and
result fields. The memory-screen analysis reads raw files separately to avoid
same-day session overwrites; a clean-only analysis cannot recover files already
overwritten by an earlier split.

## Run the notebooks

```sh
jupyter lab analysis/drone_task/drone_analysis.ipynb
jupyter lab analysis/mouse_qc/mouse_trajectory_analysis.ipynb
jupyter lab analysis/memory_screen/memory_screen_analysis.ipynb
```

Each notebook resolves the repository root from its current working directory
and uses its own data folder. Open it from the repository root, `analysis`, or
its component directory. Derived outputs belong in that component's `derived`
folder.

The main task notebook excludes memory-screen rows from experimental encoding
and memory analyses. The optional notebooks preserve separate assignment and
completion audits. The memory-screen notebook independently recomputes the
6 of 10 criterion, retains omissions and technical failures, and keeps material
versions separate. See each component's README for analysis-specific controls.

The [data directory guide](data/README.md) describes placement and overrides.
The [memory screen design notebook](../design_checks/notebooks/06_memory_screen.ipynb)
contains the screening specification and figures.
