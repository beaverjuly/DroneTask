# 05 — Mouse-dynamics quality-control module (exploratory)

**Status:** pilot measure, exploratory. **Version:** module `mt-1.0.3-2026-10-04`, geometry `g1-2026-09-29`.
**Code:** `static/task/mouse_qc/mouse_trajectory.js`, `static/task/mouse_qc/mouse_trajectory.css`, `analysis/mouse_qc/mouse_features.py`, `analysis/mouse_qc/mouse_trajectory_analysis.ipynb`, `analysis/split_drone_data.py`.

## 1. Purpose and scope

An **exploratory mouse-dynamics quality-control measure**, not a validated bot classifier.
During the pilot:

- no participant is excluded, flagged for payment, or treated differently on the basis of anything computed from this module;
- the questions are only (a) does the measure behave sensibly in our population and (b) does it add information beyond Prolific's existing protections;
- escalation (Sigma-Lognormal / neuromotor features, any classifier) is considered **only** if the pilot passes the proposed checks in §7 after the lab approves them.

## 2. Methodological anchor

Acquisition mirrors the fixed static-sequence paradigm used by Shen et al. (2014; 58 participants, 17,400 samples) and Acien et al. (2022, *Pattern Recognition*, BeCAPTCHA-Mouse): a central START target, then **eight sequentially appearing targets at fixed positions** chosen to produce movements of different directions and lengths; raw data are pointer position, event type and timestamp; a **trajectory is the movement between successive target clicks**. We do **not** reproduce Acien et al.'s 37-feature Sigma-Lognormal model or import their ≈93 % accuracy figure, which was obtained under their acquisition conditions and their synthetic attacks.

## 3. Placement in the DroneTask timeline

After **all** memory probes of the last block and before the "Game Complete" → demographics screens. `index.html` owns this shared full dev/pilot/production timeline; `dev_routes.js` uses the equivalent post-memory placement only for the one-block `encoding-test` QA route. Rationale: it cannot contaminate the memory outcome, and the memory probes are keyboard-driven, so the START click absorbs the hand-to-mouse transition — trajectory 1 begins at the START click, not at the reach for the mouse.

Participants see the following instructions.

1. Use your **mouse or trackpad** to click each circle as it appears.
2. Move at a natural pace. There is no need to rush.
3. When you are ready, click **Start** in the center of the box.

The word bot is never shown.

## 4. Geometry (fixed, not randomised)

Square task area (side = `clamp(420 px, 0.72 × min(viewport w, h), 760 px)`), coordinates normalised to the side, x right, y down. Target radius 0.035 side (START 0.055). One target visible at a time.

| # | from → to | (x, y) of target | length (side units) | direction (°, y-up) | orientation | length class |
|---|---|---|---|---|---|---|
| S | START | (0.50, 0.50) | — | — | — | — |
| 1 | S → T1 | (0.86, 0.50) | 0.360 | 0 | horizontal | medium |
| 2 | T1 → T2 | (0.86, 0.30) | 0.200 | 90 | vertical | short |
| 3 | T2 → T3 | (0.14, 0.30) | 0.720 | 180 | horizontal | long |
| 4 | T3 → T4 | (0.14, 0.78) | 0.480 | 270 | vertical | medium |
| 5 | T4 → T5 | (0.30, 0.62) | 0.226 | 45 | oblique | short |
| 6 | T5 → T6 | (0.58, 0.90) | 0.396 | 315 | oblique | medium |
| 7 | T6 → T7 | (0.74, 0.90) | 0.160 | 0 | horizontal | short |
| 8 | T7 → T8 | (0.32, 0.18) | 0.834 | 120 | oblique | long |

Minimum centre-to-centre distance 0.16 (≈ 4.6 radii); minimum edge margin 0.065. All eight targets have the same radius, so their Fitts index of difficulty varies from 1.7 to 3.7 bits through movement amplitude only. The geometry JSON is stored in every summary row (`mt_geometry_json`) so the data are self-describing; the analysis asserts it matches `mouse_features.GEOMETRY_G1`. **If the geometry ever changes, bump the version and analyse versions separately.**

Why square + one scale factor: normalising x and y independently on a non-square box distorts angles differently on every screen. Side length (`mt_area_side_px`) and `devicePixelRatio` are recorded so pixel units are recoverable.

## 5. Acquisition rules

- Pointer Events API (`pointermove` / `pointerdown` / `pointerup`) on `document`, so movement outside the box is still captured (coordinates may fall outside [0, 1]). Mouse-event fallback if `PointerEvent` is absent.
- **No client-side resampling.** Every dispatched `pointermove` is saved with `event.timeStamp` (DOMHighResTimeStamp); where `getCoalescedEvents()` exists, the coalesced samples are saved instead of the dispatched event (the dispatched event's coordinates equal the last coalesced one, per the W3C spec). `n_dispatched_events` and `n_coalesced_samples` quantify coalescing per trajectory.
- Hit test is geometric (distance to target centre ≤ 1.05 × radius), identical across browsers; only the primary button advances. Clicks outside the target are recorded (`down_miss`) and counted (`n_misclicks`).
- Trajectory *k* runs from the `pointerdown` that hit target *k − 1* (its `t = 0`; recorded as `down_start`) to the `pointerdown` that hits target *k* (`down_hit`). The intervening `pointerup` belongs to trajectory *k*.
- Timestamps are rounded to 0.1 ms; coordinates to 4 decimals. Per-trajectory sample cap 20,000 (`samples_truncated` flag).
- A keyboard-focusable skip button appears only after 20 s without a hit on START or the current target (safety valve for a broken device); the result is `mt_status = 'skipped'` with partial rows retained.
- After the eighth target, one self-report item asks **Which device did you use for this activity?** Choices are Mouse, Trackpad, and Other. This is needed because trackpads report `pointerType = "mouse"`.
- Environment stored on the summary row: browser UA, viewport, screen, area side px, DPR, fullscreen state, Pointer-Events / coalesced support, `maxTouchPoints`, whether the window was resized mid-task.

## 6. Data schema

Raw jsPsych rows with `trial_type = 'mouse-trajectory'`:

**`mt_row = 'trajectory'`** (8 rows): `trajectory_id`, `movement_label`, `target_start_{x,y}`, `target_end_{x,y}` (centres), `nominal_length`, `nominal_direction_deg`, `movement_orientation`, `movement_length_class`, `click_start_{x,y}`, `click_end_{x,y}`, `trajectory_duration_ms`, `trajectory_completed`, `n_samples`, `n_dispatched_events`, `n_coalesced_samples`, `n_misclicks`, `samples_truncated`, `pointer_type` (dominant API value), `t0_event_ms`, `t0_perf_ms`, and two JSON columns:

```
samples: [[t_ms, x_norm, y_norm, coalesced], ...]                 # pointermove
events:  [[t_ms, x_norm, y_norm, kind, button, pointerType], ...] # kind ∈ down_start | down_hit | down_miss | up
```

**`mt_row = 'summary'`** (1 row): `mt_*` columns listed in `split_drone_data.MOUSE_SUMMARY_COLS`.

`split_drone_data.py` writes `{pid}_{date}_mouse_trajectory.csv`, `{pid}_{date}_mouse_summary.csv`, and with `--explode-mouse` the long table `{pid}_{date}_mouse_events.csv` with exactly the preregistered columns `participant_id, trajectory_id, target_start_x, target_start_y, target_end_x, target_end_y, event_type, t_ms, x_norm, y_norm, pointer_type` (+ `coalesced`, `button`). `mt_status` and `mt_pointer_type_self_report` are also added to the metadata table.

## 7. Proposed pilot analysis (version 1)

Per trajectory, on the point set {`down_start`, all move samples, `down_hit`} sorted by time, consecutive numerically identical or near-identical points removed, **no smoothing or resampling**:

| feature | definition |
|---|---|
| duration T | t(down_hit) − t(down_start), ms — includes reaction/dwell, as in the published paradigm |
| path length L | Σ ‖p_{i+1} − p_i‖ (side units) |
| displacement D | ‖p_end − p_start‖ (click to click) |
| mean speed | L / T (side units · s⁻¹) |
| efficiency | D / L |
| mean \|turning angle\| | mean \|Δheading\| over consecutive non-zero segments, degrees |

Supplementary QC covariates (not features): points per trajectory, median Δt, fraction Δt = 0, onset latency, peak speed. Per-participant summaries: median and IQR across the eight trajectories. Acceleration, jerk and Sigma-Lognormal parameters are deliberately excluded from version 1 (sampling-rate and preprocessing sensitivity).

**Synthetic sanity checks** (same geometry, same extractor): A straight + constant speed; B straight + minimum-jerk acceleration/deceleration; C quadratic-Bézier curve + minimum-jerk; D = C + position and Δt jitter (stress test, reported but not a criterion). In plain language, straight constant-speed, straight accelerating, and curved paths for the same targets are scored by the same code. Separation runs from 0 (indistinguishable) to 1. Durations are drawn from the pooled human distribution for the same movement, so separation cannot be driven by duration alone. Separation index = 2 |AUC − 0.5| from the Mann–Whitney AUC (descriptive; not a fitted classifier).

**Developer QA evidence from two clean Mac Chrome sessions (not pilot evidence):**

- 16 of 16 trajectories completed with 506 pointer movement samples and no misclicks.
- Clicking took 8.7 and 10.2 seconds. Time from instructions through the device report was 23.0 and 12.7 seconds.
- Both sessions had a 16.2 ms median sample interval, or 61.7 Hz. This clears the proposed 20 ms bar with little headroom.
- `getCoalescedEvents()` was supported, but `n_coalesced_samples` equalled `n_dispatched_events` for all 16 movements, so it added no points.
- Durations reconstructed from the opening and closing samples matched all 16 stored trajectory durations exactly.

**Proposed pilot criteria (agree before reviewing group results):**

All five numerical cutoffs are pragmatic lab operating floors, not validated
standards from the cited literature.

| check | criterion |
|---|---|
| completion | ≥ 90 % of expected QC sessions have a present summary with `mt_status == 'complete'` |
| sampling quality | ≥ 80 % of valid completed sessions have, across their eight trajectories, median reconstructed point count ≥ 20 and median Δt ≤ 20 ms |
| geometry sanity | trajectory-level Spearman ρ(nominal length, path length) > 0.5 and pooled median efficiency < 0.99 |
| synthetic sanity | separation ≥ 0.8 on efficiency or turning versus type A, a perfectly straight path generated at constant speed |
| sampling sensitivity | estimable trajectory-level \|Spearman ρ(turning, median Δt)\| < 0.5 |

In the combined two-session developer-QA dataset, all five computed checks fall on the passing side. Type A separation is 0.99. Against curved synthetic paths, efficiency separation falls to 0.13 while turning separation remains 0.83. Because sample interval barely varied, the sampling-sensitivity result is not a meaningful stress test. **These floor checks show that the recorded signal is technically interpretable, not that the module catches low-quality participants.**

The synthetic rule tests an obvious shape contrast. Efficiency and turning do not test the constant-speed profile itself. Before the pilot decision, change the notebook so a nonfinite sampling-sensitivity correlation reports `not evaluable` rather than passing automatically.

Pilot usefulness should be evaluated against independent indicators, for example whether trajectory outliers coincide with comprehension-check failures. If the proposed checks pass with roughly 20 to 30 pilot participants, escalation to the Sigma-Lognormal feature family or a classifier can be *discussed*. Any such step needs its own validation rather than borrowing Acien et al.'s reported numbers.

## 8. What this module does not do

- It does not estimate bot-detection accuracy (no labelled bots in the pilot).
- It does not address replay or human-like simulated input beyond the type-D stress test.
- It does not change payment, exclusion, or attention-check logic anywhere in DroneTask.

## 9. Checks before deployment

- [ ] Confirm with the PI/IRB that recording pointer movement during a click task is covered by the consent language on interaction data (the game already records keyboard responses and jsPsych interaction events).
- [ ] QA route in Chrome, Firefox, Safari, Edge on a mouse **and** a trackpad: `?dev=1&stage=mouse-test&consent=0&mouse_qc=1` — check the path overlay, then the downloaded CSV via `split_drone_data.py`.
- [ ] One full dev run (`?dev=1&consent=0&mouse_qc=1`) to confirm placement after the last memory block.
- [ ] Commit to `main`, cherry-pick to `pavlovia-main`, push to Pavlovia; run `?pilot=1&mouse_qc=1` once and confirm the Pavlovia CSV contains `mt_row`.

## 10. Research sources

- Shen, Cai, Guan, and Maxion (2014), [Performance evaluation of anomaly-detection algorithms for mouse dynamics](https://doi.org/10.1016/j.cose.2014.05.002).
- Acien, Morales, Fierrez, and Vera-Rodriguez (2022), [BeCAPTCHA-Mouse: Synthetic mouse trajectories and improved bot detection](https://doi.org/10.1016/j.patcog.2022.108643).
- Fitts (1954), [The information capacity of the human motor system in controlling the amplitude of movement](https://doi.org/10.1037/h0055392).
- Warburton et al. (2025), [Input device matters for measures of behaviour in online experiments](https://doi.org/10.1007/s00426-024-02065-1).
- W3C (2026), [Pointer Events Level 3](https://www.w3.org/TR/pointerevents3/#coalesced-events).
