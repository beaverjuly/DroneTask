# Memory screen analysis

Open [memory_screen_analysis.ipynb](memory_screen_analysis.ipynb) for the optional initial memory screen. The companion helper reconstructs the criterion, audits recorded geometry and items, distinguishes retry history from final omissions, and compares order accuracy with the same session’s main blocks.

| Location | Contents |
|---|---|
| `analysis/data/memory_screen/raw/` | Module only raw exports |
| `analysis/data/drone_task/raw/` | Shared full experiment exports |
| `analysis/data/memory_screen/clean/` | Explicit alternative split screen collection |
| `analysis/data/memory_screen/derived/` | Audit CSVs with public session labels |
| `analysis/data/memory_screen/derived/figures/` | Embedded figures exported as PNG files |

Raw input is the default. `DRONE_INPUT_MODE` can select `raw` or `clean`. An explicit `DRONE_CLEAN_DIR` defaults to clean input unless `DRONE_INPUT_MODE=raw` is set. `DRONE_DERIVED_DIR` redirects all module audit exports and the figures subfolder. The notebook controls remain editable after these environment defaults are applied. The shared [session loader](../session_io.py) consolidates cumulative checkpoint and final snapshots by run identity, checks overlapping recorded observations, and preserves distinct legacy sessions. It never rewrites clean files or pools raw and clean copies. Set `INPUT_MODE = 'clean'` and optionally `CLEAN_DIR` for a selected flat clean collection. `RAW_DIRS` can restrict raw intake to a folder, file or list of sources.

The notebook displays only public session labels and selected scientific fields. Raw identifiers, source filenames and demographics remain private. All observed screens remain in audit tables, including incomplete and technically problematic runs. Legacy sessions without screen assignment metadata remain unknown rather than assumed failures.

The figures show one explicitly labelled screening assessment. `FOCAL_SESSION = None` selects the last observed screen in the canonical inventory. Set a public session label to inspect another. Audit CSVs retain all sessions, and question summaries remain separated by material version.

The selection rule remains at least 6 correct answers out of 10. Correctness is independently reconstructed from the earlier studied item and displayed answer sides. Each of the 20 items must appear exactly once among the 10 pairs. Three initial timeouts in the current pilot were followed by answers, so they are retries rather than final omissions. The current pilot has 6 of 10 screening answers and 33 of 56 main order answers correct. With one assessment, these results support delivery auditing rather than screening validity or a population effect. Independent random binary guesses pass the rule approximately 37.7 percent of the time.

Observed positions are checked against saved arrays, and against the live design only when series versions match. Medium describes the versioned reference geometry rather than establishing an empirical ranking from saved condition names. The main task audit flags the historical v14 mismatch between saved labels and realized movement. Runtime label version `trajectory-aligned-v2-20261104` corrects this ordering without changing the assigned main trajectories. Compare recorded trajectories and version specific calculations rather than retroactively changing the historical labels. The current pilot matches hidden medium v5 geometry, with 10 drone shifts in each direction, 10 supply offsets on each side, and 20 unique items disjoint from its 200 main items. Its screen display outcome fields are unrecorded, so successful rendering cannot be inferred from absent preload failure flags.

Run from the repository root, `analysis/`, or this module directory using the project environment and Node. The [design notebook](../../design_checks/notebooks/06_memory_screen.ipynb) documents assigned materials. To execute and save all outputs from the repository root use

```sh
MPLBACKEND=Agg MPLCONFIGDIR="$PWD/.venv-design/matplotlib" JUPYTER_PATH="$PWD/.venv-design/share/jupyter" IPYTHONDIR="$PWD/.venv-design/ipython" .venv-design/bin/python -m nbconvert --to notebook --execute --inplace analysis/memory_screen/memory_screen_analysis.ipynb --ExecutePreprocessor.timeout=180 --ExecutePreprocessor.kernel_name=drone-design
```
