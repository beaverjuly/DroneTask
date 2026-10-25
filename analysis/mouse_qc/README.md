# Mouse-trajectory QC analysis

This directory is the optional analysis companion to
`static/task/mouse_qc/`. The core DroneTask analysis does not import it, and
deleting this directory does not affect core task execution or the standard
encoding/memory outputs from `analysis/split_drone_data.py`.

## Run

```bash
python analysis/split_drone_data.py analysis/data/drone_task/raw/
python analysis/mouse_qc/mouse_features.py --selftest
jupyter lab analysis/mouse_qc/mouse_trajectory_analysis.ipynb
```

Pass `--explode-mouse` to the splitter only when a long, one-row-per-pointer-
event table is needed. The compact trajectory CSV keeps raw `samples` and
`events` as JSON and is the notebook's normal input. Module-only mouse exports
can be placed in `analysis/data/mouse_qc/raw/` and passed to the same splitter.
Mixed full-task raw exports remain in `analysis/data/drone_task/raw/`; the
splitter routes mouse tables and session metadata into the mouse clean folder.

| Location | Contents |
|---|---|
| `analysis/mouse_qc/` | Feature helper and analysis notebook |
| `analysis/data/mouse_qc/raw/` | Module-only raw exports |
| `analysis/data/mouse_qc/clean/` | Split trajectory, summary, event, and session metadata tables |
| `analysis/data/mouse_qc/derived/` | Analysis summaries and derived features |

The notebook resolves the repository whether Jupyter starts from the root,
`analysis/`, or `analysis/mouse_qc/`. Set `DRONE_CLEAN_DIR` to inspect another
clean-data directory and `DRONE_DERIVED_DIR` for a separate output location.
Debug data in a nested folder are not pooled into the default pilot sample.
For the retained debug run, launch Jupyter with both paths set explicitly.

```bash
DRONE_CLEAN_DIR="$PWD/analysis/data/mouse_qc/clean/debug_2026-10-04" DRONE_DERIVED_DIR="$PWD/analysis/data/mouse_qc/derived/debug_2026-10-04" jupyter lab analysis/mouse_qc/mouse_trajectory_analysis.ipynb
```

When no valid complete QC session is present, the notebook still exports the
session and exclusion audits and marks feature analyses as not evaluated.
Legacy unknown assignments remain distinct from explicitly disabled sessions
in the metadata assignment inventory.

## Pipeline and criterion map

The analysis branches after the raw export is split. The splitter changes file
shape only; it does not score participants or decide which trajectories are
usable.

| Stage | What happens | Floor check fed |
|---|---|---|
| Raw task CSV | Stores QC configuration, browser data, up to eight trajectory rows with compact JSON samples/events, and one summary row if the module reaches that terminal step. | Source evidence |
| `split_drone_data.py` | Writes separate metadata, trajectory, and summary tables. `--explode-mouse` optionally writes an event-long table. | Inputs for all five checks |
| Session audit | Builds the expected-session denominator and keeps asset failures or missing summaries visible. It separately gates feature analysis to sessions with a complete summary, exactly one completed trajectory for every ID 1–8, and `mt_n_trajectories_completed == 8` when that summary field is present. | Completion; gates the other four checks |
| Feature extraction | Reconstructs each opening-click → pointer-samples → closing-click path, sorts by time, removes consecutive numerically identical or near-identical points, applies no smoothing, and computes point count, median Δt, path length, efficiency, turning, and the other preregistered features. | Sampling and geometry |
| Notebook comparisons | Compares observed features with target geometry and same-target synthetic paths, correlates turning with median Δt, and writes the summary and derived CSVs. | Geometry, synthetic sanity, and sampling sensitivity |

The eight-trajectory validity gate defines the feature-analysis population. It
requires a complete summary, IDs 1–8 exactly once, and a completed-count of 8
when that field is present. It is not a sixth floor check. Skipped, incomplete,
duplicated-ID, unexpected-ID, and missing sessions remain in a separate audit
table.

## Why the proposed floors exist

These numbers are proposed lab operating tolerances to agree on before pilot
review. The cited papers motivate the acquisition paradigm and synthetic
comparisons, but they do not establish these numerical cutoffs.

| Check | Implemented or proposed rule | Reason for the floor |
|---|---|---|
| Completion | At least 90% of expected QC sessions have a present summary with `mt_status == 'complete'`. | Operational feasibility. More than about one loss in ten would make an optional measure difficult to justify. |
| Sampling | At least 80% of valid completed sessions have, across their eight trajectories, median reconstructed point count ≥20 and median Δt ≤20 ms. | Twenty points provide up to 18 possible heading changes before zero-length segments are removed. A 20 ms median interval is a median cadence equivalent to at least 50 Hz. The 80% rule allows some browser and device loss while requiring most sessions to be usable. |
| Geometry sanity | Trajectory-level Spearman ρ between nominal distance and path length >.50, and pooled median efficiency <.99. | Designed movement amplitude should remain visible in the recorded paths. Efficiency below .99 rules out a degenerate set of nearly perfect straight lines. |
| Synthetic sanity | Separation ≥.80 on efficiency or turning versus type A, a perfectly straight path generated at constant speed. | This is a deliberately easy positive control. A separation of .80 corresponds to rank AUC ≥.90 after ignoring direction. Efficiency and turning test shape, not the constant-speed profile or realistic bots. |
| Sampling sensitivity | Estimable trajectory-level \|Spearman ρ(turning, median Δt)\| <.50. | Turning should not mainly reflect browser sampling cadence. An unavailable correlation should be reported as not evaluable. |

Passing these floors would show that the signal is technically interpretable
enough to pilot. It would not show that the module detects low-quality
participants. The current notebook treats an unavailable sampling-sensitivity
correlation as a pass; change that behavior to `not evaluable` before using the
criterion for a pilot decision.

Derived files are written under `analysis/data/mouse_qc/derived/` and are
gitignored.
