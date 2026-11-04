# Drone task analysis

[drone_analysis.ipynb](drone_analysis.ipynb) checks recording completeness and describes tracking, updating, all three memory outcomes, response timing, pair design support, and comprehension review. Reusable transformations and figures are in [drone_analysis.py](drone_analysis.py).

| Material | Location |
|---|---|
| Raw full session exports | `analysis/data/drone_task/raw` |
| Existing split collections | `analysis/data/drone_task/clean` |
| Derived audit tables | `analysis/data/drone_task/derived` |
| Exported PNG figures | `analysis/data/drone_task/derived/figures` |

Open the notebook from within the repository and run all cells. The default reads raw files through [session_io.py](../session_io.py). It consolidates cumulative snapshots of the same run and excludes legacy protocols from the current analysis. Raw data and existing clean files are preserved.

The inventory includes every discovered session. The main report includes current sessions with an intended or observed main encoding task. Figures show one selected session rather than pooling repeated blocks across sessions. `DRONE_FOCUS_SESSION` selects a safe ordinal session label from the inventory. Ordinal labels can change as files are added; internal session identifiers remain stable in private derived tables.

| Optional setting | Purpose |
|---|---|
| `DRONE_INPUT_MODE=clean` | Explicitly analyze an existing split collection |
| `DRONE_CLEAN_DIR` | Select the flat clean directory for that mode |
| `DRONE_DERIVED_DIR` | Send all report outputs to an isolated audit location |

The current distance slider is subjective and ranges from 0 to 100. It is compared by actual item separation, never subtracted from intervening item counts. Placement error uses percentage points. Attempt timeouts, final omissions, and absent pair summaries remain distinct.

Block conditions are joined from encoding observations. Volatility and stochasticity are coupled in this design. Update slopes are descriptive regressions, not recovered learning parameters. The report does not use trial level significance tests, unvalidated behavioral pass gates, population power extrapolation, or unidentified Kalman parameter recovery claims. Missing diagnostics remain unrecorded or not evaluable.

The PNGs and saved notebook outputs use safe labels. Derived tables remain private and retain identifiers needed for joins. Optional components have separate [mouse QC](../mouse_qc/README.md) and [memory screen](../memory_screen/README.md) reports.

Historical v14 recordings have high and low condition labels opposite to their realized movement and supply distance ordering. From `condition_label_version=trajectory-aligned-v2-20261104`, labels match the realized ordering while trajectories, block indices, valence and boundaries stay fixed. The report preserves each session’s recorded labels and explicit geometry checks. It never relabels historical rows or treats corrected and historical label versions as equivalent.

The earlier renderer clamped the supply center to 12 through 88 percent although scoring used the raw position. New recordings retain `bag_rendered_position`, `bag_scoring_position` and `bag_position_adjusted` so equality is auditable. Historical positions and missing display telemetry cannot be reconstructed as newly recorded measurements.
