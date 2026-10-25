# Memory screen analysis

Open `analysis/memory_screen/memory_screen_analysis.ipynb` to analyze the optional initial screen separately from the four experimental blocks. The accompanying `memory_screen_analysis.py` supplies session loading, criterion reconstruction, accuracy and timing summaries, and delivery audits.

| Location | Contents |
|---|---|
| `analysis/data/memory_screen/raw/` | Module-only raw session CSVs |
| `analysis/data/drone_task/raw/` | Shared full-task raw sessions, including optional screen rows |
| `analysis/data/memory_screen/clean/` | Split screen encoding, order, summary, and session metadata tables |
| `analysis/data/memory_screen/derived/` | Analysis audit CSVs and observed-data figures |

The notebook defaults to raw input, discovering both raw directories and ignoring exact copies. It processes each raw file separately so repeated same-day sessions remain distinct. Raw and clean tables are never pooled. Set `INPUT_MODE = 'clean'` when the raw collection is incomplete and the split screen tables are the intended source.

The notebook resolves the repository root and runs from the repository root, `analysis/`, or its own directory. It loads the shared splitter from `analysis/split_drone_data.py` and the current design from `design_checks/scripts/export_memory_screen.cjs`.

Run with the Python dependencies in `design_checks/requirements-memory-screen.txt` and Node. The [design specification](../../design_checks/notebooks/06_memory_screen.ipynb) documents the participant protocol and assigned material. The analysis preserves incomplete and technical outcomes and produces no invented behavioral estimates when screening observations are absent.
