# Drone task analysis

## Pilot1 collection

[Pilot1_analysis.ipynb](Pilot1_analysis.ipynb) is the isolated group report
for the downloaded Prolific pilot. It uses
[Pilot1_intake.py](Pilot1_intake.py) to match the provider export, retain
partial runs and checkpoints, and select one unambiguous completed run per
submitted participant. Its inputs are under `analysis/data/Pilot1/`, outside
the older default module raw folders. Original downloads and private matching
tables remain gitignored.

The report evaluates learning validation first, memory measurement sensitivity
next, and exploratory memory condition differences afterward. It focuses on
highVol plus lowSto against lowVol plus highSto, and reward against loss. Paired participant plots,
differences, direction counts and participant bootstrap intervals cover update
gain, tracking, all three memory outcomes, placement biases and response timing.
The Learning and tracking section gives the prediction error, next collector
update, OLS slope and participant contrast formulas, with a numerical example.
Comparison bars show both marginal effects and all four condition cells,
retaining individual points and participant bootstrap intervals. Learning rates
are block regression slopes with intercepts, not mean trialwise ratios or
values clipped to zero through one.
Every plot panel reserves a separate footer area for its numerical difference
and 95% interval, with the subtraction direction stated explicitly. Calibration
panels show differences at each actual gap or target. Four condition panels
show the comparisons within each valence and within each regime. Fixed design
arrays and allocation counts have descriptive differences without sampling
intervals. `Pilot1_plot_annotations.py` manages these shared footer layouts;
`plot_annotations.csv` exports their aggregate text alongside the figures.
The published learning benchmark is recomputed from the authors' public data,
stored as aggregate values with source hashes and used offline. The intentional
Pilot1 jump schedule is retained and distinguished from the published design.

Memory diagnostics compare order accuracy at each true gap with chance,
distance ratings between true gaps, and placement responses between true early
and late positions. Response distributions use equal participant and block
weighting. Constant midpoint references remain separate from discrimination.
Both the learning and memory checks qualify interpretation of exploratory
condition effects without excluding participants for their outcomes.
Four condition plots retain the interaction pattern. Distance and placement
calibration and strategy benchmarks distinguish response differences from
memory accuracy. No significance threshold selects an outcome or participant.

`Pilot1_analysis.py` builds the focused report. `Pilot1_randomization.py`
checks the actual source arrays against saved manifests and observations,
including the Latin square, canonical conditions, sequence variants, item
assignment, retrieval pairs and placement probes. Response timing reconciles
successful stage events with pair summaries. Block RT medians are averaged
equally within factor levels. Slider initiation, adjustment and total duration
remain distinct; manual confirmation and the automatic seven second timer are
both retained. Fast responses are flagged without exclusion.

`Pilot1_learning_validation.py` supplies published benchmarks and realised
geometry checks. `Pilot1_memory_diagnostics.py` supplies memory sensitivity,
paired stratum support and response distribution summaries. These are runtime
dependencies of the notebook. Published reference provenance is documented in
[references/README.md](references/README.md).

The earlier significance tables and v1 notebook remain in the private archive
at `analysis/data/Pilot1/derived/archives/Pilot1_v1_20261109/`.
Their scientific estimates are preserved, while the current presentation
emphasizes descriptive pilot comparisons. Group
figures are embedded and exported to
`analysis/data/Pilot1/derived/group_analysis/figures/`. Private results and
the approval review are distinct; neither low memory accuracy nor a missing
continuous mouse path is a payment gate. The researcher performs final
Prolific payment approval. The separate
[Pilot1 mouse notebook](../mouse_qc/Pilot1_mouse_analysis.ipynb) exports its
own tables and figures to `analysis/data/Pilot1/derived/mouse_qc/`.

The ordinary notebook below remains a descriptive session report and does not
automatically select this new Prolific cohort.

[prePilot_drone_analysis.ipynb](prePilot_drone_analysis.ipynb) checks recording completeness and describes tracking, updating, all three memory outcomes, response timing, pair design support, and comprehension review. Reusable transformations and figures are in [drone_analysis.py](drone_analysis.py).

| Material | Location |
|---|---|
| Raw full session exports | `analysis/data/prePilot/drone_task/raw` |
| Existing split collections | `analysis/data/prePilot/drone_task/clean` |
| Derived audit tables | `analysis/data/prePilot/drone_task/derived` |
| Exported PNG figures | `analysis/data/prePilot/drone_task/derived/figures` |

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
