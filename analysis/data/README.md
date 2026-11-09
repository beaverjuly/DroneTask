# Analysis data

| Cohort | Folder | Intake and reports |
| --- | --- | --- |
| Earlier development and friend sessions | `prePilot/` | The three `prePilot_` notebooks and default shared loader |
| First Prolific pilot | `Pilot1/` | `Pilot1_intake.py`, `Pilot1_analysis.ipynb` and `Pilot1_mouse_analysis.ipynb` |

Both folders are private and gitignored. The cohorts are loaded separately.
Original provider filenames and file contents are preserved inside their
labelled cohort directories.

## prePilot layout

| Component | Raw exports | Optional split tables | Derived outputs |
| --- | --- | --- | --- |
| Drone task | `prePilot/drone_task/raw/` | `prePilot/drone_task/clean/` | `prePilot/drone_task/derived/` |
| Mouse QC | `prePilot/mouse_qc/raw/` | `prePilot/mouse_qc/clean/` | `prePilot/mouse_qc/derived/` |
| Memory screen | `prePilot/memory_screen/raw/` | `prePilot/memory_screen/clean/` | `prePilot/memory_screen/derived/` |

Full mixed sessions belong once in `prePilot/drone_task/raw/`. Module only
development sessions belong in that module's raw folder. The default session
loader reconciles repeated copies and cumulative checkpoints within these
three folders. Existing mouse debug collections remain under the corresponding
prePilot clean and derived directories.

`python analysis/split_drone_data.py` defaults to `analysis/data/prePilot/`.
Its optional `-o` selects another data root with the same three module layout.
Explicit raw, clean and derived overrides remain supported.

## Pilot1 layout

| Folder | Purpose |
| --- | --- |
| `Pilot1/source_exports/` | Original Pavlovia and Prolific exports with acquisition provenance |
| `Pilot1/raw/` | All original working task CSV copies, including partials and checkpoints |
| `Pilot1/derived/intake/` | Canonical runs, submission matching and recording audit |
| `Pilot1/derived/group_analysis/` | Main learning, memory, response timing and assignment analyses |
| `Pilot1/derived/mouse_qc/` | Separate mouse tables and figures |
| `Pilot1/derived/archives/` | Earlier analysis sources and results retained as provenance |

The Pilot1 notebook imports its dedicated intake helper and never relies on the
prePilot defaults. `Pilot1_relocation_manifest.json` records the former and
current input paths and verifies unchanged hashes. Original acquisition and
historical provenance manifests retain their recorded paths.
