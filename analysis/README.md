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
│   ├── drone_analysis.py
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
├── session_io.py         # canonical read only notebook intake
├── requirements.txt
└── README.md
```

## Data preparation

Put full session exports in `analysis/data/drone_task/raw/`. A full export may
contain all three task components and should have one canonical raw copy.
Module-only development exports belong in the respective module's raw folder.
All raw, clean, and derived data folders are gitignored.

From the repository root, install dependencies. The notebooks read raw files
directly through the shared session loader, so splitting is optional.

```sh
python -m pip install -r analysis/requirements.txt
```

The default loader scans the three raw folders and ignores byte identical
copies. Cumulative checkpoint and final snapshots with one run UUID represent
one session. A terminal summary is preferred, then the largest row sequence
and row count. Overlapping immutable observations are compared across snapshots.
Conflicts and noncumulative snapshots remain explicit audit issues rather than
silently becoming additional participants or replacing recorded outcomes.

```python
from session_io import load_module_tables

bundle = load_module_tables('drone_task', root=ROOT)
tables = bundle['tables']
sessions = bundle['inventory']
intake_issues = bundle['issues']
```

All three notebooks use this interface. Every table carries a stable
`session_id`, an anonymous `session_label`, a `source_schema` cohort, the task
version and source kind. Current runs use their UUID and legacy sessions use
the full source content hash. Display labels are ordinal and may change when
the collection grows. They are not join keys. Participant identifiers and raw
source paths remain private and must not be shown in public figures or reports.

The inventory retains all canonical sessions, including those without an
optional module. Missing assignment, completion or outcome fields remain
unknown. A legacy session with 200 encoding turns and 56 memory rows has
observable task coverage, but no terminal completion record. Current and legacy
task versions are described separately rather than pooled as a single pilot
cohort. A final CSV and its checkpoint never count as two people.

The loader uses temporary split tables and never rewrites raw files or existing
clean folders. To inspect an isolated raw collection, pass `raw_dirs` as a file,
folder or list of paths. For an intentionally retained clean collection, opt in
explicitly.

```python
bundle = load_module_tables('mouse_qc', root=ROOT, input_mode='clean',
                            clean_dir=ROOT / 'analysis/data/mouse_qc/clean/debug_2026-10-04')
```

Clean intake searches only that folder. Nested debug folders are excluded from
the default collection. A clean table requires its matching metadata prefix;
unassigned or duplicate session prefixes are reported and not silently pooled.
All three notebooks support `DRONE_INPUT_MODE` to select raw or clean input,
`DRONE_CLEAN_DIR` to select an existing split collection, and
`DRONE_DERIVED_DIR` to isolate the resulting exports. Supplying a clean directory
selects clean input unless raw mode is explicitly requested. The memory screen
notebook also has editable `INPUT_MODE`, `CLEAN_DIR` and `RAW_DIRS` variables.
See the component guides before selecting an existing collection.

To create persistent clean tables for another workflow, run the optional splitter.

```sh
python analysis/split_drone_data.py
```

The splitter scans the three raw folders, ignores byte identical raw copies,
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

The splitter CLI consolidates cumulative checkpoint and final snapshots with the same
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

The main task notebook excludes memory screen rows from experimental encoding
and memory analyses. Coverage, valid responses and omissions are distinct
quantities. Pair summaries and response events are audited separately so an
interrupted later stage does not erase an earlier recorded response. The
optional notebooks preserve separate assignment and completion audits. The
memory screen notebook independently recomputes the 6 of 10 criterion, retains
omissions and technical failures, and keeps material versions separate. With
one current pilot, cross module comparisons describe that run and do not
estimate population effects or validate a screening rule. See each component's
README for analysis specific controls.

Figures are embedded in the executed notebooks and exported into each module's
private `derived/figures` folder. Audit tables and tidy analysis tables stay in
the same module's `derived` directory. Exports can contain stable private join
keys; share only the figures and explicitly anonymized report tables.

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

The main task report preserves recorded condition labels and compares them
with realized movement and supply distances. Historical v14 recordings have
inverted high and low labels. From `trajectory-aligned-v2-20261104`, the runtime
labels match the realized ordering without changing assigned trajectories.
The loader preserves `condition_label_version` and includes it in the
comparability group when recorded. Historical data are never relabelled.

Split encoding, practice and screening tables retain rendered and scoring
landing positions, display load and decode status, actual visible timing, and
fallback reasons when supplied. Missing legacy telemetry remains missing.
Metadata also retains the consent source and text versions and the configured
completion route. A configured return route is not proof the browser navigated
or that Prolific approved payment.
