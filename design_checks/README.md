# Design checks

| Folder | Contents |
|---|---|
| `notebooks/` | Executable design notebooks and numbered Markdown review documents |
| `scripts/` | Shared Python helpers, JavaScript design exporter, and item rendering utility |
| `figures/` | Exported figures and audit tables grouped by task component |
| `references/` | Cached source data and attribution |

## Review documents

| Topic | File |
|---|---|
| Game trials | [01 game trials.ipynb](notebooks/01%20game%20trials.ipynb) |
| Memory task | [02 memory task.ipynb](notebooks/02%20memory%20task.ipynb) |
| Counterbalancing | [03 counterbalancing.ipynb](notebooks/03%20counterbalancing.ipynb) |
| Instruction wording | [04_instruction_wording_alignment.md](notebooks/04_instruction_wording_alignment.md) |
| Mouse trajectory QC | [05_mouse_trajectory_qc.md](notebooks/05_mouse_trajectory_qc.md) |
| Memory screen | [06_memory_screen.ipynb](notebooks/06_memory_screen.ipynb) |
| Data saving | [07_data_saving.ipynb](notebooks/07_data_saving.ipynb) |

The [mouse QC briefing](mouse_qc_lab_brief.html) remains available at its existing
local browser URL, `http://localhost:8000/design_checks/mouse_qc_lab_brief.html`.

## Execution

The notebooks locate the repository root and import helpers from `scripts/`.
They can run with the working directory at the repository root, `design_checks`,
or `design_checks/notebooks`. Exports continue to use `design_checks/figures/`.

For the memory-screen design notebook, install the dependencies listed in
`design_checks/requirements-memory-screen.txt`, select that Python environment,
and execute all cells. Node is required to evaluate the live task configuration.

```sh
python -m nbconvert --to notebook --execute --inplace design_checks/notebooks/06_memory_screen.ipynb
node design_checks/scripts/export_memory_screen.cjs
```

Routine execution reads existing item PNGs. The separate asset-generation utility
`design_checks/scripts/render_memory_screen_items.py` requires macOS and the
installed Apple Color Emoji font and should run only when deliberately revising
those assets. Participant-data analysis is organized separately under
[`analysis/`](../analysis/README.md).

The data saving notebook explains the recording lifecycle and includes an
executable audit for raw session CSV files and optional receipt JSON files.
It exports source configuration and synthetic diagnostic figures under
`figures/data_saving`. Participant audit tables remain in the ignored directory
`analysis/data/drone_task/derived/data_saving_audit`.

```sh
python design_checks/scripts/data_saving_audit.py /path/to/sample/folder
python -m nbconvert --to notebook --execute --inplace design_checks/notebooks/07_data_saving.ipynb
```

## Participant progress

`static/task/progress.js` measures completed participant activities across the
selected route. It advances through nested blocks, instruction pages, memory
stages and mouse trajectories. Instruction reviews and repeated responses
cannot add extra credit. Skipped conditional branches leave the denominator
only when their conditions are evaluated during normal execution.

Setup and preload bookkeeping do not advance the bar. The last step belongs
to final saving. Saving and retry screens retain the bar, and an early exit
does not fill activities that were never completed. This is activity progress,
not an estimate of elapsed time, performance or cloud delivery status.
