# Source data for the memory screen audit

`ferre_et_al_emojis_database.xlsx` is the unmodified Emoji-SP normative database by Pilar Ferré, Juan Haro, Miguel Ángel Pérez-Sánchez, Irene Moreno, and José Antonio Hinojosa. The journal article appeared online in 2022 and in Behavior Research Methods volume 55 in 2023.

* Article <https://doi.org/10.3758/s13428-022-01893-6>
* Authors' data repository <https://osf.io/dtfjv/>
* Original download <https://osf.io/download/p3azd/>
* Original SHA256 `72e7c0060ad232962b8eec953e3a34d37d6ff7aef7146f148519fb08cf161d68`
* Data license Creative Commons Attribution 4.0 International <https://creativecommons.org/licenses/by/4.0/>
* Accessed 2026-10-24

`osf_metadata.json` records the source project metadata. The source sample comprises Spanish university students and used Facebook emoji graphics. Those ratings guide selection; they are not measurements of our participant population or the fixed Apple graphics used in this task. Familiarity rates communicative use and should not be relabelled object recognizability. Valence and arousal use 1 to 9 scales. Complexity, clarity, and familiarity use 1 to 7 scales.

The fixed PNG assets in `static/task/memory_screening/items/` were rendered from the installed Apple Color Emoji font with `design_checks/scripts/render_memory_screen_items.py`. The task and notebook load those same PNGs. OS-specific emoji fonts therefore do not change the participant-facing screening items. Apple Color Emoji artwork remains attributable to Apple. The normative workbook supplies ratings, not these graphics.
