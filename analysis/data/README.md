# Analysis data

| Component | Raw exports | Split tables | Derived outputs |
|---|---|---|---|
| Drone task | `drone_task/raw/` | `drone_task/clean/` | `drone_task/derived/` |
| Mouse QC | `mouse_qc/raw/` | `mouse_qc/clean/` | `mouse_qc/derived/` |
| Memory screen | `memory_screen/raw/` | `memory_screen/clean/` | `memory_screen/derived/` |

Paths in this table are relative to `analysis/data/`. The data subfolders are
private and gitignored. The shared splitter creates missing folders.

Store a full mixed session once in `drone_task/raw/`. Its experimental, mouse,
and screening rows are routed to separate clean directories. Store module-only
development sessions in that module's raw folder. Exact byte copies are ignored
during default raw discovery.

Run `python analysis/split_drone_data.py` from the repository root. Its optional
`-o` argument points to an alternate data root with the same three-module layout.
Full-session metadata is available in all three clean folders to support
assignment and completion audits. Module-only sources contribute metadata to
their own module.

Mouse QC accepts `DRONE_CLEAN_DIR` and `DRONE_DERIVED_DIR` for a separate QA
dataset. The memory-screen notebook exposes raw, clean, and derived directory
settings and an explicit raw or clean input mode. It can discover shared full
sessions without copying them into its own raw folder.

The preserved mouse development dataset is under
`mouse_qc/clean/debug_2026-10-04/`, with its derived results under
`mouse_qc/derived/debug_2026-10-04/`.
