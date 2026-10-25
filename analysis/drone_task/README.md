# Drone task analysis

[drone_analysis.ipynb](drone_analysis.ipynb) analyzes the four experimental blocks,
including tracking, prediction errors, learning, temporal memory, segmentation,
and pilot viability checks.

| Stage | Directory |
|---|---|
| Full session raw exports | `analysis/data/drone_task/raw/` |
| Main task split tables | `analysis/data/drone_task/clean/` |
| Derived tables and figures | `analysis/data/drone_task/derived/` |

From the repository root,

```sh
python analysis/split_drone_data.py
jupyter lab analysis/drone_task/drone_analysis.ipynb
```

The notebook resolves paths from the repository root and excludes screening
rows from the main encoding, memory, and practice tables. Optional components
have separate [mouse QC](../mouse_qc/README.md) and
[memory screen](../memory_screen/README.md) analyses. The shared splitter routes
their data into the matching folders under `analysis/data/`.
