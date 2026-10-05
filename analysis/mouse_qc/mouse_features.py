#!/usr/bin/env python3
"""
mouse_features.py — Feature extraction and synthetic baselines for the
DroneTask mouse-dynamics QC module (static/task/mouse_qc/mouse_trajectory.js).

Import from the notebook:

    import sys; sys.path.insert(0, 'analysis/mouse_qc')
    from mouse_features import *

Self-test:

    python analysis/mouse_qc/mouse_features.py --selftest

Everything here is deliberately simple so it can be preregistered as-is.
The six *core* features per trajectory (Acien et al. 2022 call this the
"global characteristics" family, in contrast to their 37-feature
Sigma-Lognormal decomposition):

    duration_ms       T   time from the click that opened the trajectory
                          (t = 0) to the click that closed it
    path_length       L   Σ ‖p_{i+1} − p_i‖   (side units; side = 1)
    displacement      D   ‖p_end − p_start‖   (side units)
    mean_speed        L / T                   (side units per second)
    efficiency        D / L                   (1 = perfectly straight)
    mean_abs_turn_deg mean |Δheading| over consecutive non-zero segments

Point set used for every feature: the opening click (down_start, t = 0),
every recorded pointermove sample (dispatched or coalesced), and the
closing click (down_hit). Consecutive points that repeat both time and
position are dropped. No resampling or smoothing is applied — these
choices are what make turning angle sensitive to sampling rate, which is
why the notebook reports sampling covariates alongside it.

Supplementary QC covariates (not part of the core set):

    n_points, median_dt_ms, frac_zero_dt, onset_latency_ms, peak_speed

Coordinates: x right, y down, normalised to the square task area.
"""
import json
import math
import sys
from typing import Dict, Iterable, List, Optional, Tuple

import numpy as np
import pandas as pd

# ─── Fixed geometry g1 (must match static/task/mouse_qc/mouse_trajectory.js) ─

GEOMETRY_G1: Dict = {
    'version': 'g1-2026-09-29',
    'target_radius_frac': 0.035,
    'start_radius_frac': 0.055,
    'start': {'label': 'S', 'x': 0.50, 'y': 0.50},
    'targets': [
        {'label': 'T1', 'x': 0.86, 'y': 0.50},
        {'label': 'T2', 'x': 0.86, 'y': 0.30},
        {'label': 'T3', 'x': 0.14, 'y': 0.30},
        {'label': 'T4', 'x': 0.14, 'y': 0.78},
        {'label': 'T5', 'x': 0.30, 'y': 0.62},
        {'label': 'T6', 'x': 0.58, 'y': 0.90},
        {'label': 'T7', 'x': 0.74, 'y': 0.90},
        {'label': 'T8', 'x': 0.32, 'y': 0.18},
    ],
}

CORE_FEATURES = ['duration_ms', 'path_length', 'displacement',
                 'mean_speed', 'efficiency', 'mean_abs_turn_deg']
SUPP_FEATURES = ['n_points', 'median_dt_ms', 'frac_zero_dt',
                 'onset_latency_ms', 'peak_speed']
FEATURE_LABELS = {
    'duration_ms': 'Duration T (ms)',
    'path_length': 'Path length L (side units)',
    'displacement': 'Displacement D (side units)',
    'mean_speed': 'Mean speed L/T (side units / s)',
    'efficiency': 'Efficiency D/L',
    'mean_abs_turn_deg': 'Mean |turning angle| (°)',
    'n_points': 'Points per trajectory',
    'median_dt_ms': 'Median inter-sample interval (ms)',
    'frac_zero_dt': 'Fraction of Δt = 0 samples',
    'onset_latency_ms': 'Onset latency (ms)',
    'peak_speed': 'Peak speed (side units / s)',
}


def movement_table(geometry: Dict = GEOMETRY_G1) -> pd.DataFrame:
    """Nominal properties of the 8 movements implied by the geometry."""
    pts = [geometry['start']] + geometry['targets']
    rows = []
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        dx, dy = b['x'] - a['x'], b['y'] - a['y']
        length = math.hypot(dx, dy)
        deg = (math.degrees(math.atan2(-dy, dx)) + 360) % 360
        ang = deg % 180
        orient = ('horizontal' if (ang < 20 or ang > 160)
                  else 'vertical' if 70 < ang < 110 else 'oblique')
        lclass = 'short' if length < 0.30 else ('medium' if length < 0.55 else 'long')
        rows.append({'trajectory_id': i + 1, 'from': a['label'], 'to': b['label'],
                     'x0': a['x'], 'y0': a['y'], 'x1': b['x'], 'y1': b['y'],
                     'nominal_length': round(length, 3),
                     'nominal_direction_deg': round(deg, 1),
                     'movement_orientation': orient,
                     'movement_length_class': lclass})
    return pd.DataFrame(rows)


# ─── Decoding the compact JSON columns ─────────────────────────────

def decode_samples(s) -> np.ndarray:
    """samples JSON → array (n, 4): t_ms, x_norm, y_norm, coalesced."""
    if s is None or (isinstance(s, float) and np.isnan(s)) or s == '':
        return np.zeros((0, 4))
    arr = np.asarray(json.loads(s), dtype=float)
    return arr.reshape(-1, 4) if arr.size else np.zeros((0, 4))


def decode_events(s) -> List[list]:
    """events JSON → list of [t_ms, x, y, kind, button, pointerType]."""
    if s is None or (isinstance(s, float) and np.isnan(s)) or s == '':
        return []
    return json.loads(s)


def trajectory_points(samples_json, events_json) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Return (t, x, y) for one trajectory: opening click + moves + closing click,
    sorted by time, exact consecutive duplicates removed."""
    pts = []
    for ev in decode_events(events_json):
        if ev[3] in ('down_start', 'down_hit'):
            pts.append((float(ev[0]), float(ev[1]), float(ev[2])))
    smp = decode_samples(samples_json)
    for row in smp:
        pts.append((row[0], row[1], row[2]))
    if not pts:
        return np.zeros(0), np.zeros(0), np.zeros(0)
    arr = np.array(sorted(pts, key=lambda p: p[0]))
    keep = np.ones(len(arr), dtype=bool)
    if len(arr) > 1:
        same = np.all(np.isclose(arr[1:], arr[:-1]), axis=1)
        keep[1:] = ~same
    arr = arr[keep]
    return arr[:, 0], arr[:, 1], arr[:, 2]


# ─── Features ──────────────────────────────────────────────────────

def compute_features(t: np.ndarray, x: np.ndarray, y: np.ndarray,
                     onset_threshold: float = 0.01) -> Dict[str, float]:
    """Core + supplementary features for one trajectory (see module docstring)."""
    out = {k: np.nan for k in CORE_FEATURES + SUPP_FEATURES}
    n = len(t)
    out['n_points'] = n
    if n < 2:
        return out
    dt = np.diff(t)
    dx, dy = np.diff(x), np.diff(y)
    seg = np.hypot(dx, dy)

    T = float(t[-1] - t[0])
    L = float(seg.sum())
    D = float(math.hypot(x[-1] - x[0], y[-1] - y[0]))
    out['duration_ms'] = T
    out['path_length'] = L
    out['displacement'] = D
    out['mean_speed'] = (L / (T / 1000.0)) if T > 0 else np.nan
    out['efficiency'] = (D / L) if L > 0 else np.nan

    nz = seg > 1e-9
    if nz.sum() >= 2:
        heading = np.arctan2(dy[nz], dx[nz])
        dh = np.diff(heading)
        dh = (dh + np.pi) % (2 * np.pi) - np.pi
        out['mean_abs_turn_deg'] = float(np.degrees(np.abs(dh)).mean())
    else:
        out['mean_abs_turn_deg'] = 0.0 if nz.sum() == 1 else np.nan

    out['median_dt_ms'] = float(np.median(dt)) if len(dt) else np.nan
    out['frac_zero_dt'] = float((dt <= 0).mean()) if len(dt) else np.nan
    disp_from_start = np.hypot(x - x[0], y - y[0])
    moved = np.where(disp_from_start > onset_threshold)[0]
    out['onset_latency_ms'] = float(t[moved[0]] - t[0]) if len(moved) else np.nan
    pos = dt > 0
    out['peak_speed'] = float((seg[pos] / (dt[pos] / 1000.0)).max()) if pos.any() else np.nan
    return out


def features_from_table(traj: pd.DataFrame,
                        id_cols: Iterable[str] = ('participant_id', 'trajectory_id')) -> pd.DataFrame:
    """Apply compute_features() to every row of a *_mouse_trajectory table."""
    id_cols = [c for c in id_cols if c in traj.columns]
    carry = [c for c in ['movement_label', 'movement_orientation', 'movement_length_class',
                         'nominal_length', 'nominal_direction_deg', 'trajectory_completed',
                         'n_misclicks', 'pointer_type', 'n_coalesced_samples',
                         'n_dispatched_events', 'samples_truncated'] if c in traj.columns]
    rows = []
    for _, r in traj.iterrows():
        t, x, y = trajectory_points(r.get('samples'), r.get('events'))
        f = compute_features(t, x, y)
        for c in id_cols + carry:
            f[c] = r[c]
        rows.append(f)
    cols = id_cols + carry + CORE_FEATURES + SUPP_FEATURES
    return pd.DataFrame(rows)[cols] if rows else pd.DataFrame(columns=cols)


def explode_to_long(traj: pd.DataFrame, participant_col: str = 'participant_id') -> pd.DataFrame:
    """Long format, one row per raw event/sample, matching the preregistered schema:
    participant_id, trajectory_id, target_start_x/y, target_end_x/y, event_type,
    t_ms, x_norm, y_norm, pointer_type (+ coalesced, button)."""
    rows = []
    for _, r in traj.iterrows():
        base = {
            'participant_id': r.get(participant_col),
            'trajectory_id': r.get('trajectory_id'),
            'target_start_x': r.get('target_start_x'), 'target_start_y': r.get('target_start_y'),
            'target_end_x': r.get('target_end_x'), 'target_end_y': r.get('target_end_y'),
        }
        ptype = r.get('pointer_type')
        for s in decode_samples(r.get('samples')):
            rows.append({**base, 'event_type': 'move', 't_ms': s[0], 'x_norm': s[1], 'y_norm': s[2],
                         'pointer_type': ptype, 'coalesced': int(s[3]), 'button': None})
        for e in decode_events(r.get('events')):
            rows.append({**base, 'event_type': e[3], 't_ms': e[0], 'x_norm': e[1], 'y_norm': e[2],
                         'pointer_type': e[5], 'coalesced': 0, 'button': e[4]})
    cols = ['participant_id', 'trajectory_id', 'target_start_x', 'target_start_y',
            'target_end_x', 'target_end_y', 'event_type', 't_ms', 'x_norm', 'y_norm',
            'pointer_type', 'coalesced', 'button']
    if not rows:
        return pd.DataFrame(columns=cols)
    return (pd.DataFrame(rows)[cols]
            .sort_values(['participant_id', 'trajectory_id', 't_ms'], kind='stable')
            .reset_index(drop=True))


def summarise_by_participant(feat: pd.DataFrame,
                             features: Iterable[str] = CORE_FEATURES) -> pd.DataFrame:
    """Median and IQR across trajectories in an already-filtered table.

    This function intentionally does not decide which rows are valid. Callers
    must explicitly select completed trajectories from completed sessions, as
    the QC notebook does, before computing primary summaries.
    """
    features = [f for f in features if f in feat.columns]
    g = feat.groupby('participant_id')[features]
    med = g.median().add_suffix('_median')
    iqr = (g.quantile(0.75) - g.quantile(0.25)).add_suffix('_iqr')
    n = g.size().rename('n_trajectories')
    return pd.concat([n, med, iqr], axis=1).reset_index()


# ─── Synthetic baselines (BeCAPTCHA-style shape × velocity variants) ─

SYNTH_KINDS = {
    'A_linear_const':      'straight path, constant speed',
    'B_linear_accdec':     'straight path, acceleration/deceleration (min-jerk)',
    'C_curved_accdec':     'curved (quadratic Bézier) path, acceleration/deceleration',
    'D_curved_accdec_noisy': 'C + Gaussian position jitter + Δt jitter (stress test)',
}


def _min_jerk(tau: np.ndarray) -> np.ndarray:
    return 10 * tau ** 3 - 15 * tau ** 4 + 6 * tau ** 5


def synth_trajectory(start, end, duration_ms: float, kind: str, rng: np.random.Generator,
                     dt_ms: float = 8.0, curvature: Optional[float] = None,
                     jitter_sd: float = 0.002, dt_jitter_ms: float = 2.0
                     ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Generate one synthetic trajectory from `start` to `end` (side units).

    kind: see SYNTH_KINDS. Returns (t, x, y) with t[0] = 0, t[-1] = duration_ms.
    """
    start = np.asarray(start, float)
    end = np.asarray(end, float)
    n = max(3, int(round(duration_ms / dt_ms)) + 1)
    t = np.linspace(0.0, duration_ms, n)
    tau = t / duration_ms
    s = tau if kind == 'A_linear_const' else _min_jerk(tau)

    chord = end - start
    L = np.linalg.norm(chord)
    perp = np.array([-chord[1], chord[0]]) / (L if L > 0 else 1.0)
    if kind in ('C_curved_accdec', 'D_curved_accdec_noisy'):
        if curvature is None:
            curvature = rng.uniform(0.08, 0.25) * rng.choice([-1, 1])
        ctrl = start + 0.5 * chord + perp * curvature * L
        # Quadratic Bézier evaluated at arc-progress s
        p = ((1 - s)[:, None] ** 2) * start + (2 * (1 - s) * s)[:, None] * ctrl + (s[:, None] ** 2) * end
    else:
        p = start + s[:, None] * chord

    if kind == 'D_curved_accdec_noisy':
        noise = rng.normal(0, jitter_sd, size=p.shape)
        noise[0] = 0; noise[-1] = 0
        p = p + noise
        jt = t + np.concatenate([[0], rng.normal(0, dt_jitter_ms, size=n - 2), [0]])
        t = np.maximum.accumulate(jt)
    return t, p[:, 0], p[:, 1]


def synth_participant(kind: str, durations_ms: Iterable[float], rng: np.random.Generator,
                      geometry: Dict = GEOMETRY_G1, click_scatter_frac: float = 0.3,
                      **kw) -> pd.DataFrame:
    """Eight synthetic trajectories for one pseudo-participant on geometry g1.

    Start/end points are the target centres plus a small click scatter
    (Gaussian, sd = click_scatter_frac × target radius). Returns a table in
    the same shape as a *_mouse_trajectory table (samples/events JSON), so
    the *same* feature extractor can be applied.
    """
    pts = [geometry['start']] + geometry['targets']
    r_click = geometry['target_radius_frac'] * click_scatter_frac
    durations = list(durations_ms)
    rows = []
    prev_click = np.array([pts[0]['x'], pts[0]['y']]) + rng.normal(0, r_click, 2)
    for i in range(8):
        a, b = pts[i], pts[i + 1]
        end_click = np.array([b['x'], b['y']]) + rng.normal(0, r_click, 2)
        t, x, y = synth_trajectory(prev_click, end_click, float(durations[i]), kind, rng, **kw)
        samples = [[round(float(tt), 1), round(float(xx), 4), round(float(yy), 4), 0]
                   for tt, xx, yy in zip(t[1:-1], x[1:-1], y[1:-1])]
        events = [[0.0, round(float(x[0]), 4), round(float(y[0]), 4), 'down_start', 0, 'synthetic'],
                  [round(float(t[-1]), 1), round(float(x[-1]), 4), round(float(y[-1]), 4), 'down_hit', 0, 'synthetic']]
        rows.append({'trajectory_id': i + 1, 'movement_label': f"{a['label']}->{b['label']}",
                     'target_start_x': a['x'], 'target_start_y': a['y'],
                     'target_end_x': b['x'], 'target_end_y': b['y'],
                     'trajectory_completed': True, 'n_misclicks': 0, 'pointer_type': 'synthetic',
                     'samples': json.dumps(samples), 'events': json.dumps(events)})
        prev_click = end_click
    return pd.DataFrame(rows)


def build_synthetic_set(human_feat: pd.DataFrame, n_per_kind: int, rng: np.random.Generator,
                        kinds: Iterable[str] = ('A_linear_const', 'B_linear_accdec', 'C_curved_accdec'),
                        dt_ms: float = 8.0) -> pd.DataFrame:
    """Synthetic pseudo-participants whose per-movement durations are drawn from
    the pooled human duration distribution for the same movement, so that
    human-vs-synthetic separation is not driven trivially by duration."""
    tables = []
    for kind in kinds:
        for k in range(n_per_kind):
            durs = []
            for tid in range(1, 9):
                pool = human_feat.loc[human_feat['trajectory_id'] == tid, 'duration_ms'].dropna().values
                durs.append(float(rng.choice(pool)) if len(pool) else 800.0)
            tab = synth_participant(kind, durs, rng, dt_ms=dt_ms)
            tab.insert(0, 'participant_id', f'{kind}_{k + 1:03d}')
            tab.insert(1, 'source', kind)
            tables.append(tab)
    return pd.concat(tables, ignore_index=True) if tables else pd.DataFrame()


# ─── Descriptive separation (not a classifier) ────────────────────

def rank_auc(a: np.ndarray, b: np.ndarray) -> float:
    """Probability that a random draw from `a` exceeds one from `b`
    (Mann–Whitney AUC). 0.5 = indistinguishable by a single threshold on
    this feature; near 0 or 1 = separable. Reported as a *descriptive*
    statistic — it is not a fitted or validated classifier."""
    a = np.asarray(a, float); b = np.asarray(b, float)
    a = a[np.isfinite(a)]; b = b[np.isfinite(b)]
    if len(a) == 0 or len(b) == 0:
        return np.nan
    # Direct pairwise form of the Mann–Whitney probability, with ties worth
    # one half. This keeps the feature module's self-test independent of SciPy.
    pairwise = a[:, None] - b[None, :]
    return float(((pairwise > 0).sum() + 0.5 * (pairwise == 0).sum()) /
                 pairwise.size)


# ─── Self-test ─────────────────────────────────────────────────────

def _selftest() -> None:
    rng = np.random.default_rng(0)
    # 1. straight, constant speed → efficiency 1, turn 0, mean_speed = D/T
    t, x, y = synth_trajectory((0.1, 0.2), (0.7, 0.2), 600.0, 'A_linear_const', rng)
    f = compute_features(t, x, y)
    assert abs(f['efficiency'] - 1.0) < 1e-9, f
    assert abs(f['mean_abs_turn_deg']) < 1e-9, f
    assert abs(f['mean_speed'] - 0.6 / 0.6) < 1e-9, f
    assert abs(f['duration_ms'] - 600.0) < 1e-9
    # 2. curved → efficiency < 1, turning > 0, displacement equal to straight case
    t, x, y = synth_trajectory((0.1, 0.2), (0.7, 0.2), 600.0, 'C_curved_accdec', rng, curvature=0.2)
    g = compute_features(t, x, y)
    assert g['efficiency'] < 0.99 and g['mean_abs_turn_deg'] > 0, g
    assert abs(g['displacement'] - 0.6) < 1e-9
    # 3. min-jerk profile starts/ends slowly → onset latency > 0 for B
    t, x, y = synth_trajectory((0.1, 0.2), (0.7, 0.2), 600.0, 'B_linear_accdec', rng)
    h = compute_features(t, x, y)
    assert h['onset_latency_ms'] > 0 and abs(h['efficiency'] - 1) < 1e-9, h
    # 4. table round-trip through JSON and the explode helper
    tab = synth_participant('C_curved_accdec', [500] * 8, rng)
    tab.insert(0, 'participant_id', 'selftest')
    feat = features_from_table(tab)
    assert len(feat) == 8 and feat['efficiency'].between(0.85, 1.0).all(), feat
    long = explode_to_long(tab)
    assert set(long['event_type']) == {'move', 'down_start', 'down_hit'}
    assert (long.groupby('trajectory_id')['t_ms'].min() == 0).all()
    # 5. duplicates removed; degenerate inputs handled
    t2 = np.array([0, 0, 10, 10, 20.]); x2 = np.array([0, 0, 0.1, 0.1, 0.2]); y2 = np.zeros(5)
    pts = trajectory_points(json.dumps([[0, 0, 0, 0], [10, .1, 0, 0], [10, .1, 0, 0]]),
                            json.dumps([[0, 0, 0, 'down_start', 0, 'mouse'], [20, .2, 0, 'down_hit', 0, 'mouse']]))
    assert len(pts[0]) == 3, pts
    assert np.isnan(compute_features(np.zeros(1), np.zeros(1), np.zeros(1))['duration_ms'])
    # 6. AUC sanity
    assert abs(rank_auc([1, 2, 3], [1, 2, 3]) - 0.5) < 1e-9
    assert rank_auc([10, 11, 12], [1, 2, 3]) == 1.0
    mt = movement_table()
    assert len(mt) == 8 and set(mt['movement_orientation']) == {'horizontal', 'vertical', 'oblique'}
    print('mouse_features self-test: OK')
    print(mt.to_string(index=False))


if __name__ == '__main__':
    if '--selftest' in sys.argv:
        _selftest()
    else:
        print(__doc__)
