# Mouse trajectory recording audit

## Pilot1

[Pilot1_mouse_analysis.ipynb](Pilot1_mouse_analysis.ipynb) analyzes only
the 15 matched submitted participants in `analysis/data/Pilot1/`. It shares
the main task intake without pooling historical or development recordings.
`Pilot1_mouse_analysis.py` checks acquisition and exports sampling summaries,
full continuous paths and geometry comparisons.
Tables and PNGs are in `analysis/data/Pilot1/derived/mouse_qc/`.

Click only records retain endpoints and duration but cannot establish path
straightness or continuous speed. Off square paths remain visible. No mouse
classifier or participation exclusion is applied. The ordinary notebook below
retains its existing data scope and measurement controls.

The notebook audits the optional eight movement mouse module. It does not change experiment execution or exclude participants. Eight movements from one person are repeated observations rather than eight independent participants. Synthetic paths test measurement behaviour, not bot detection accuracy.

## Run

The default input is canonical raw data, loaded through `analysis/session_io.py`. Repeated copies and cumulative checkpoint exports are reconciled with final exports before module tables are extracted. No manual split is needed to include a newly downloaded full experiment.

```bash
.venv-design/bin/python analysis/mouse_qc/mouse_features.py --selftest
MPLBACKEND=Agg MPLCONFIGDIR="$PWD/.venv-design/matplotlib" JUPYTER_PATH="$PWD/.venv-design/share/jupyter" IPYTHONDIR="$PWD/.venv-design/ipython" .venv-design/bin/python -m nbconvert --to notebook --execute --inplace analysis/mouse_qc/prePilot_mouse_analysis.ipynb --ExecutePreprocessor.kernel_name=drone-design --ExecutePreprocessor.timeout=180
```

Run from anywhere within the repository. Jupyter resolves the root from the notebook location. For interactive use, open the notebook with the `drone-design` kernel.

| Location | Contents |
| --- | --- |
| `analysis/mouse_qc/` | Feature helper and executed analysis notebook |
| `analysis/data/prePilot/mouse_qc/raw/` | Module only raw exports |
| `analysis/data/prePilot/drone_task/raw/` | Full experiment raw exports, including mouse rows |
| `analysis/data/prePilot/mouse_qc/clean/` | Optional split metadata, trajectory and summary tables |
| `analysis/data/prePilot/mouse_qc/derived/` | Audit tables, usable features and session summaries |
| `analysis/data/prePilot/mouse_qc/derived/figures/` | Three PNG figures also embedded in the notebook |

An explicit `DRONE_CLEAN_DIR` switches to clean input and reads only the specified flat folder. Nested debug collections are excluded by default. `DRONE_INPUT_MODE` can explicitly select `raw` or `clean`. Use `DRONE_DERIVED_DIR` to keep debug outputs separate.

```bash
DRONE_CLEAN_DIR="$PWD/analysis/data/prePilot/mouse_qc/clean/debug_2026-10-04" DRONE_DERIVED_DIR="$PWD/analysis/data/prePilot/mouse_qc/derived/debug_2026-10-04" jupyter lab analysis/mouse_qc/prePilot_mouse_analysis.ipynb
```

## Audit and interpretation

| Stage | Behaviour |
| --- | --- |
| Assignment inventory | Retains all canonical runs. Known requested sessions define the completion denominator. Unknown assignments remain unknown. |
| Session gate | Requires one complete summary, integer movement IDs 1 through 8 exactly once, every movement complete, count 8 when supplied, and the supported recorded geometry. Both `complete` and `completed` terminal status values are accepted. |
| Signal audit | Checks JSON structure, opening and closing clicks, timestamp reversals, recorded sample counts, duration agreement and truncation. Invalid signals remain in the audit. |
| Feature extraction | Reconstructs opening click, moves and closing click. Removes only exact consecutive duplicates, retains zero time intervals and off square coordinates, applies no smoothing or resampling, and computes timing and geometry summaries. |
| Measurement controls | Retains each actual endpoint, full timestamp array and duration. Generates straight constant speed, straight minimum jerk and curved minimum jerk paths through the same extractor. Input counts match, although coincident simulated points at tied timestamps can collapse during reconstruction. |
| Sensitivity view | Shows geometry checks with all usable paths and without off square paths. The latter is a labelled diagnostic, not an automatic exclusion. |
| Scientific limit | Session counts, distinct recorded identities and repeated sessions are distinguished. No population p values, classifier accuracy or quality based participant exclusion is reported. |

Click to click duration includes waiting and corrective action. The first to last move sample span is a different descriptive quantity, not an estimate of pure motor movement time. Raw positive move cadence is shown separately from cadence including click endpoints. Instantaneous speed ignores zero time intervals and those intervals remain reported.

The October pilot contains one complete current mouse session. Its first movement includes an off square excursion and lasts about 10.8 seconds. That path is retained, fully plotted and flagged. It is not evidence of a bot. The remaining seven movements take about 0.7 to 1.1 seconds.

## Proposed operating tolerances

These are lab tolerances for technical review. The cited papers do not establish the numerical values. A descriptive pass does not validate population screening. Missing or constant inputs produce `not_evaluable`, never pass.

| Check | Proposed rule |
| --- | --- |
| Completion | At least 90 percent of known requested sessions have a complete terminal summary |
| Sampling | At least 80 percent of complete sessions have all eight usable signals, median reconstructed points at least 20, and median interval at most 20 ms |
| Geometry | Descriptive rank correlation between nominal distance and path length above 0.50, and median efficiency below 0.99 |
| Straight control | Separation of at least 0.80 on efficiency or turning compared with a straight constant speed path |
| Sampling sensitivity | Estimable absolute rank correlation between turning and median interval below 0.50 |

The sampling correlation is a repeated movement diagnostic. It cannot isolate a browser effect from movement geometry. A larger sample with independent participants and appropriate labelled outcomes is necessary before considering exclusion or classifier claims.

The notebook writes private identifier based tables for joins, but prints public session labels only. Raw filenames, browser strings and demographic values are excluded from saved displays. Raw, clean and derived research data remain gitignored. No test scripts are added.
