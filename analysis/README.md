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
| `drone_task/clean` | Metadata, encoding, memory, practice, comprehension, demographics, instructions, page views, interactions, response events, session events, save receipts, design manifests, preload diagnostics |
| `mouse_qc/clean` | Metadata, mouse trajectory, mouse summary, optional exploded mouse events |
| `memory_screen/clean` | Metadata, memory screening encoding, order, and summary |

Full-session metadata accompanies each module so requested, disabled,
technically failed, and interrupted sessions can remain in the appropriate
audit denominator. Raw files stored in a module-only raw directory contribute
metadata to that module's inventory. Missing optional rows never become
successful assessments.

Split filenames include participant and the run UUID. Older Pavlovia
files use date and full source time, and other files use their source stem. A short
digest prevents collisions introduced by filename sanitization. Distinct
sessions on the same day therefore retain separate tables. Metadata preserves
source filename, source hash, source row count, source time, assignments and
module versions.

The CLI consolidates cumulative checkpoint and final snapshots with the same
run UUID, selecting the largest recorded row sequence and row count. Direct
calls refuse to replace a more complete run with an older snapshot. Keep the
original raw files because incomplete checkpoints are recovery evidence.
When migrating previously generated tables that used participant and date only,
regenerate into an empty output directory. Otherwise old and new filenames can
coexist and appear to downstream glob loaders as duplicate sessions. The splitter
does not delete existing analysis files automatically.

Every clean table retains available run UUID, row UUID, row sequence and schema
version. Main encoding retains `completed`; memory retains separate stage
timeouts, omissions and attempt histories. Demographics exposes named columns
while retaining the original response object; multiple selections remain JSON
arrays. The response event table preserves completed memory subresponses even
when the later question was interrupted.

Instruction histories and normalized page views are exported separately.
Generic event and manifest tables retain all populated fields so new saving
diagnostics are not silently discarded by a column allowlist. An acknowledged
checkpoint is not evidence that the participant completed every task. Use
session outcome and expected versus observed counts when auditing completeness.

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

## Audit recording delivery

The [data saving notebook](../design_checks/notebooks/07_data_saving.ipynb)
explains the recorder and audits raw snapshots with optional receipt sidecars.
Use it before interpreting task outcomes as complete. The helper can also run
directly from the repository root.

```sh
python design_checks/scripts/data_saving_audit.py
```

Keep the final CSV and matching `.receipt.json` together in the raw folder.
The audit verifies hashes, record counts, module separation and delivery
status without writing participant identifiers into its report tables.
The [URL guide](../URLs%20CheatSheet.md#recording-audit) contains complete
recording rehearsal links for yourself and friends.
