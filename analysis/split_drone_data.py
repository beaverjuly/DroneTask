#!/usr/bin/env python3
"""
split_drone_data.py — Post-process DroneTask raw CSVs from Pavlovia.

Usage:
    python analysis/split_drone_data.py
    python analysis/split_drone_data.py analysis/data/drone_task/raw/single_file.csv
    python analysis/split_drone_data.py analysis/data/drone_task/raw/ -o /path/to/analysis-data

The CLI routes clean tables into drone_task, mouse_qc, and memory_screen
under analysis/data (or the data root supplied with -o). Full-session raw
exports belong in drone_task/raw; module-only raw exports have their own raw
folders. Full-session metadata is retained in every module for denominator audits.

Pavlovia filename format:
    DroneTask_{participantId}_SESSION_{date}_{time}.csv

For each distinct session, produces tables with a collision resistant prefix:
    {pid}_{date}_metadata.csv
    {pid}_{date}_encoding.csv
    {pid}_{date}_memory.csv
    {pid}_{date}_practice.csv
    {pid}_{date}_comprehension.csv
    {pid}_{date}_demographics.csv
    {pid}_{date}_preload_diagnostics.csv
    {pid}_{date}_mouse_trajectory.csv    (only when QC rows are present)
    {pid}_{date}_mouse_summary.csv       (only when a QC summary is present)
    {pid}_{date}_mouse_events.csv        (optional, --explode-mouse)
    {pid}_{date}_memory_screening_encoding.csv (optional screening turns)
    {pid}_{date}_memory_screening_order.csv    (optional order questions)
    {pid}_{date}_memory_screening_summary.csv  (optional screening result)
"""
import argparse, hashlib, json, os, re, sys
from pathlib import Path
import pandas as pd

ANALYSIS_DIR = Path(__file__).resolve().parent
DATA_DIR = ANALYSIS_DIR / 'data'
MODULES = ('drone_task', 'mouse_qc', 'memory_screen')

COMMON_COLS = [
    'run_uuid', 'row_uuid', 'row_sequence', 'data_schema_version',
    'task_phase', 'trial_category', 'elapsed_ms', 'utc_timestamp',
    'session_started_utc', 'session_start_utc', 'build_id',
]

# ─── Column definitions per table ────────────────────────────

MOUSE_QC_METADATA_COLS = [
    'task_variant', 'mouse_qc_requested', 'mouse_qc_enabled',
    'mouse_qc_asset_status', 'mouse_qc_module_version',
    'mouse_qc_geometry_version', 'mt_status',
    'mt_pointer_type_self_report',
]

MEMORY_SCREENING_METADATA_COLS = [
    'memory_screening_requested', 'memory_screening_enabled',
    'memory_screening_asset_status', 'memory_screening_version',
    'memory_screening_status', 'memory_screening_passed',
    'memory_screening_n_correct', 'memory_screening_n_pairs',
    'memory_screening_min_correct', 'memory_screening_seed',
    'memory_screening_run_id', 'memory_screening_n_encoding_completed',
    'memory_screening_item_version', 'memory_screening_drone_visible',
    'memory_screening_geometry_seed',
    'memory_screening_drone_initial_position', 'memory_screening_drone_step_size',
    'memory_screening_drone_step_metric',
    'memory_screening_supply_offset_size', 'memory_screening_supply_offset_metric',
    'memory_screening_n_order_answered', 'memory_screening_n_order_recorded',
    'memory_screening_n_timed_out', 'memory_screening_series_version',
]

META_COLS = [
    'workerId', 'subId', 'PROLIFIC_PID', 'STUDY_ID', 'SESSION_ID',
    'pilot_mode', 'dev_mode', 'consent_shown',
    'data_save_mode', 'is_pavlovia', 'is_local_env',
    'latin_square_group', 'latin_square_order', 'latin_square_order_labels',
    'reward_uses_shifted_sequences', 'stimulus_block_orders',
    'perf_timer_ms_per_call', 'perf_dom_ms_per_op', 'perf_slow_flag',
    'consent_study_id', 'consent_version_date', 'consent_accepted',
    'task_version', 'stimuli_version',
    'preload_loaded', 'preload_total', 'preload_failed',
    'preload_elapsed_ms', 'preload_mode',
    'preload_overall_timeout', 'preload_gate_wait_ms',
    'total_supply_caught', 'total_score', 'total_scored_trials',
    *MOUSE_QC_METADATA_COLS,
    *MEMORY_SCREENING_METADATA_COLS,
    'pavlovia_pid', 'pavlovia_date', 'pavlovia_time',
]

ENCODING_COLS = [
    'trial_index', 'time_elapsed',
    'block', 'display_block', 'trial',
    'design_idx', 'canonical_design_idx', 'condition_id',
    'true_vol_param', 'true_stc_param', 'vol_level', 'stc_level',
    'valence', 'stim_img',
    'drone_position', 'bag_position',
    'bucket_start_pos', 'bucket_end_pos', 'bucket_position',
    'supply_caught', 'score', 'stayed', 'completed',
    'num_moves', 'rt_first_move_ms', 'rt_last_move_ms',
    'movement_duration_ms',
    'trial_onset_elapsed', 'trial_duration_ms',
    'miss_reason',
    # Preload & display diagnostics
    'stim_display_outcome',   # cached | jit_success | fallback_emoji | direct_load
    'stim_preload_failed',    # true/false
    'stim_fallback_emoji',    # emoji string if fallback, else null
]

MEMORY_COLS = [
    'trial_index', 'time_elapsed',
    'block', 'display_block', 'pair_index',
    'design_idx', 'canonical_design_idx', 'randomized',
    'condition', 'condition_id',
    'condition_label_source', 'condition_label_mismatch',
    'condition_label_repaired',
    'valence', 'vol_level', 'stc_level',
    'true_vol_param', 'true_stc_param',
    'trial1_index', 'trial2_index',
    'stim_left_img', 'stim_right_img', 'stim_first_actual',
    'order_choice_side', 'order_choice_img',
    'order_correct', 'order_correct_bin', 'order_rt',
    'distance_estimate', 'distance_rt', 'pair_true_distance',
    'placement_trial_type',
    'placement_probe_index', 'placement_probe_img',
    'placement_probe_position',
    'placement_candidate_indices', 'placement_num_candidate_items',
    'placement_slider_value', 'placement_rt',
    'placement_true_position_pct', 'placement_error_from_true_position',
    'middle_item_index', 'middle_item_img', 'middle_item_is_boundary',
    'placement_true_midpoint_pct', 'placement_error_from_true_midpoint',
    'attempt_number', 'distance_attempt_number', 'timed_out', 'skipped_pair',
    'order_timed_out', 'distance_timed_out', 'placement_timed_out',
    'order_final_omission', 'distance_final_omission', 'placement_final_omission',
    'order_attempts_json', 'distance_attempts_json', 'placement_attempts_json',
    # Layout metadata
    'order_keymap_mode', 'order_layout_mode', 'was_legacy_slider_pair',
    # Preload failure tracking
    'stim_left_preload_failed',    # true/false
    'stim_right_preload_failed',   # true/false
    'stim_left_fallback_emoji',    # emoji string or null
    'stim_right_fallback_emoji',   # emoji string or null
]

PRACTICE_COLS = [
    'trial_index', 'time_elapsed',
    'practice_no', 'trial', 'practice_valence',
    'stim_img',
    'drone_position', 'bag_position',
    'bucket_start_pos', 'bucket_end_pos', 'bucket_position',
    'supply_caught', 'score', 'stayed', 'completed', 'practice_wind_offset',
    'num_moves', 'rt_first_move_ms', 'rt_last_move_ms',
    'movement_duration_ms',
    'trial_onset_elapsed', 'trial_duration_ms',
    'miss_reason',
    'stim_display_outcome', 'stim_preload_failed', 'stim_fallback_emoji',
]

COMPREHENSION_COLS = [
    'trial_index', 'time_elapsed', 'trial_type',
    'rt', 'responses', 'correctness_responses',
    'num_errors', 'correct_answers',
    'prompts', 'topics', 'attempts',
    'done', 'review_topic', 'clicked_question',
]

DEMOGRAPHICS_COLS = [
    'trial_index', 'time_elapsed', 'rt', 'responses',
]

INSTRUCTION_COLS = [
    'trial_index', 'time_elapsed', 'trial_type', 'rt', 'view_history',
    'screen_id', 'deck_id', 'instruction_version', 'instruction_screen_ids',
    'instruction_deck_id', 'instruction_deck_version', 'instruction_page_count',
]

# Optional mouse-trajectory QC outputs. Keeping these definitions here makes
# the splitter independent of the feature-analysis package: core-only data can
# be split without importing or installing any mouse-QC code.
MOUSE_TRAJECTORY_COLS = [
    'trial_index', 'time_elapsed',
    'trajectory_id', 'movement_label', 'target_start_label', 'target_end_label',
    'target_start_x', 'target_start_y', 'target_end_x', 'target_end_y',
    'nominal_length', 'nominal_direction_deg',
    'movement_orientation', 'movement_length_class',
    'click_start_x', 'click_start_y', 'click_end_x', 'click_end_y',
    'trajectory_duration_ms', 'trajectory_completed',
    'n_samples', 'n_dispatched_events', 'n_coalesced_samples', 'n_misclicks',
    'samples_truncated', 'pointer_type', 't0_event_ms', 't0_perf_ms',
    'samples', 'events',
]

MOUSE_SUMMARY_COLS = [
    'trial_index', 'time_elapsed',
    'mt_module_version', 'mt_geometry_version', 'mt_status',
    'mt_n_targets', 'mt_n_trajectories_completed',
    'mt_start_latency_ms', 'mt_total_task_ms', 'mt_total_samples',
    'mt_total_misclicks', 'mt_misclicks_before_start', 'mt_any_truncated',
    'mt_area_side_px', 'mt_device_pixel_ratio',
    'mt_viewport_w', 'mt_viewport_h', 'mt_screen_w', 'mt_screen_h',
    'mt_fullscreen', 'mt_pointer_events_supported', 'mt_coalesced_supported',
    'mt_pointer_types_api', 'mt_max_touch_points', 'mt_resized_during_task',
    'mt_pointer_type_self_report', 'mt_pointer_question_rt_ms',
    'mt_user_agent', 'mt_geometry_json',
]

# Screening has its own rows and outcomes. Never merge these turns/pairs into
# the four main blocks, even though the encoding plugin uses practice_no=0.
MEMORY_SCREENING_CONTEXT_COLS = [
    'memory_screening', 'task_phase', 'trial_category',
    'screening_run_id', 'screening_seed', 'screening_series_version',
    'screening_item_version', 'screening_drone_visible',
    'screening_drone_step_metric',
    'screening_supply_offset_size', 'screening_supply_offset_metric',
]

MEMORY_SCREENING_ENCODING_COLS = [
    *ENCODING_COLS, *MEMORY_SCREENING_CONTEXT_COLS,
    'screening_trial', 'screening_trial_index', 'stimulus_concept', 'stimulus_emoji',
    'practice_no', 'completed', 'memory_screening_version',
    'screening_wind_offset', 'screening_supply_side', 'screening_change_point',
    'screening_drone_start_position', 'screening_drone_step',
    'screening_drone_direction', 'screening_drone_animation_duration_ms',
]

MEMORY_SCREENING_ORDER_COLS = [
    'trial_index', 'time_elapsed', *MEMORY_SCREENING_CONTEXT_COLS,
    'pair_index', 'screening_pair_index', 'block', 'display_block',
    'condition_id', 'memory_screening_version',
    'item1_trial', 'item2_trial', 'item1_img', 'item2_img', 'item1_concept', 'item2_concept',
    'left_img', 'right_img', 'true_first_img', 'correct_side',
    'pair_true_distance',
    'order_choice_side', 'order_choice_img',
    'order_correct', 'order_correct_bin', 'order_rt', 'timed_out',
    'had_timeout', 'attempt_number', 'order_attempts_json',
    'order_total_duration_ms', 'response_timeout_ms',
    'order_keymap_mode', 'order_layout_mode',
]

MEMORY_SCREENING_SUMMARY_COLS = [
    'trial_index', 'time_elapsed', *MEMORY_SCREENING_CONTEXT_COLS,
    *MEMORY_SCREENING_METADATA_COLS,
    'memory_screening_drone_positions_json',
    'memory_screening_bag_positions_json',
    'memory_screening_drone_directions_json',
    'memory_screening_supply_directions_json',
    'memory_screening_items_json', 'memory_screening_pairs_json',
]

# ─── Filename parsing ─────────────────────────────────────────

_PAVLOVIA_RE = re.compile(
    r'^(?P<study>[^_]+(?:_[^_]+)?)_(?P<pid>.+?)_SESSION_'
    r'(?P<date>\d{4}-\d{2}-\d{2})_(?P<time>.+?)\.csv$'
)

def parse_filename(filepath):
    basename = os.path.basename(filepath)
    m = _PAVLOVIA_RE.match(basename)
    if m:
        return m.group('pid'), m.group('date'), m.group('time')
    return os.path.splitext(basename)[0], '', ''

def _keep(df, cols):
    return df[[c for c in dict.fromkeys(COMMON_COLS + cols) if c in df.columns]].copy()


def _sparse_rows(df):
    """Preserve every populated event field without exporting empty columns."""
    return df.dropna(axis=1, how='all').copy()


def _safe_stem(value):
    return re.sub(r'[^A-Za-z0-9_.-]+', '_', str(value)).strip('_.') or 'session'


def _session_stem(df, filepath, participant, date, time):
    """Stable reruns replace one session; distinct sessions never share a stem."""
    run = _last_scalar(df, 'run_uuid')
    if run is not None and str(run).strip():
        identity = str(run)
        suffix = hashlib.sha256(identity.encode('utf-8')).hexdigest()[:10]
        return '_'.join([_safe_stem(participant), 'run', _safe_stem(identity), suffix])
    elif time:
        identity = str(time)
    else:
        identity = Path(filepath).stem
    # A short digest prevents collisions introduced by filename sanitization.
    suffix = hashlib.sha256(identity.encode('utf-8')).hexdigest()[:10]
    return '_'.join([_safe_stem(participant), _safe_stem(date or 'nodatetime'),
                     _safe_stem(identity), suffix])


def _json_list(value):
    if isinstance(value, list):
        return value
    if not isinstance(value, str):
        return []
    try:
        result = json.loads(value)
    except (ValueError, TypeError):
        return []
    return result if isinstance(result, list) else []


def _instruction_views(instructions):
    rows = []
    for _, row in instructions.iterrows():
        screens = _json_list(row.get('instruction_screen_ids'))
        for ordinal, view in enumerate(_json_list(row.get('view_history')), 1):
            if not isinstance(view, dict):
                continue
            record = {key: row.get(key) for key in COMMON_COLS + ['trial_index', 'time_elapsed',
                      'screen_id', 'deck_id', 'instruction_version', 'instruction_deck_id',
                      'instruction_deck_version'] if key in row.index}
            record.update(view)
            record['view_ordinal'] = ordinal
            page = view.get('page_index')
            if isinstance(page, int) and 0 <= page < len(screens):
                record['viewed_screen_id'] = screens[page]
            rows.append(record)
    return pd.DataFrame(rows)


def _flatten_demographics(demo):
    output = _keep(demo, DEMOGRAPHICS_COLS)
    aliases = {'gender-categorical': 'gender_categorical',
               'gender-free-response': 'gender_free_response', 'weight': 'weight_lbs'}
    for index, row in demo.iterrows():
        value = row.get('responses')
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except (ValueError, TypeError):
                continue
        if not isinstance(value, dict):
            continue
        for key, answer in value.items():
            column = aliases.get(key, str(key).replace('-', '_'))
            if isinstance(answer, (list, dict)):
                column += '_json'
                answer = json.dumps(answer, ensure_ascii=False)
            output.loc[index, column] = answer
    return output


def _interaction_rows(df):
    """Combine explicit events and legacy packed logs without duplicate copies."""
    category = df.get('trial_category', pd.Series('', index=df.index)).fillna('')
    explicit = _sparse_rows(df[category.eq('interaction_event')])
    if len(explicit):
        return explicit
    rows, seen = [], set()
    if 'interactions' not in df:
        return pd.DataFrame()
    for _, row in df.iterrows():
        for event in _json_list(row.get('interactions')):
            if not isinstance(event, dict):
                continue
            identity = json.dumps(event, sort_keys=True)
            if identity in seen:
                continue
            seen.add(identity)
            record = {key: row.get(key) for key in COMMON_COLS if key in row.index}
            record.update(event)
            rows.append(record)
    return pd.DataFrame(rows)

def _scalar(df, col):
    if col not in df.columns:
        return None
    vals = df[col].dropna()
    return vals.iloc[0] if len(vals) > 0 else None


def _last_scalar(df, col):
    if col not in df.columns:
        return None
    vals = df[col].dropna()
    return vals.iloc[-1] if len(vals) > 0 else None


def _memory_screening_mask(df):
    """Recognize row-specific screening tags, including CSV boolean strings.

    Session-level memory_screening_enabled/requested must not select rows
    because they are stamped on the main task too.
    """
    flag = df.get('memory_screening', pd.Series('', index=df.index))
    phase = df.get('task_phase', pd.Series('', index=df.index))
    category = df.get('trial_category', pd.Series('', index=df.index))
    return (
        flag.fillna('').astype(str).str.strip().str.lower().isin(['true', '1', '1.0']) |
        phase.fillna('').eq('memory_screening') |
        category.fillna('').str.startswith('memory_screening_')
    )


def _repair_memory_condition_labels(mem, enc):
    """Make memory condition metadata match the encoding block actually shown.

    Builds before task version 3.2 indexed canonical factor arrays with the
    displayed block number, ignoring Latin-square order.  Encoding rows were
    labeled correctly, so they are the authoritative source for both legacy
    and current files.
    """
    if not len(mem) or not len(enc) or 'block' not in mem or 'block' not in enc:
        return mem

    repaired = mem.copy()
    condition_cols = [
        'display_block', 'design_idx', 'canonical_design_idx', 'randomized',
        'condition_id', 'true_vol_param', 'true_stc_param',
        'vol_level', 'stc_level', 'valence',
    ]
    available = [c for c in condition_cols if c in enc.columns]
    if not available:
        return repaired

    by_block = enc.groupby('block', dropna=False)[available].first()
    any_mismatch = pd.Series(False, index=repaired.index)
    any_repair = pd.Series(False, index=repaired.index)

    for col in available:
        authoritative = repaired['block'].map(by_block[col])
        has_authoritative = authoritative.notna()
        if col in repaired.columns:
            original = repaired[col]
            any_mismatch |= (
                original.notna() & has_authoritative & ~original.eq(authoritative)
            )
            any_repair |= has_authoritative & (
                original.isna() | ~original.eq(authoritative)
            )
            repaired.loc[has_authoritative, col] = authoritative[has_authoritative]
        else:
            repaired[col] = authoritative
            any_repair |= has_authoritative

    if {'true_vol_param', 'true_stc_param'}.issubset(repaired.columns):
        repaired['condition'] = (
            'vol' + repaired['true_vol_param'].astype('Int64').astype(str) +
            '_stc' + repaired['true_stc_param'].astype('Int64').astype(str)
        )

    if 'condition_label_source' not in repaired.columns:
        repaired['condition_label_source'] = pd.NA
    repaired['condition_label_source'] = repaired['condition_label_source'].fillna(
        'encoding_repair'
    )

    runtime_mismatch = (
        repaired['condition_label_mismatch'].fillna(False).astype(bool)
        if 'condition_label_mismatch' in repaired.columns
        else pd.Series(False, index=repaired.index)
    )
    repaired['condition_label_mismatch'] = runtime_mismatch | any_mismatch
    repaired['condition_label_repaired'] = any_repair
    return repaired

def _build_preload_diagnostics(df, enc, mem):
    """Build a per-URL preload diagnostics table.

    Columns:
        url               — original stimulus path
        preload_outcome   — 'success' or 'failed'
        n_encoding_trials — how many encoding trials used this URL
        n_encoding_fallback — how many showed fallback emoji
        n_memory_trials   — how many memory pairs included this URL
        n_memory_fallback — how many showed fallback emoji in memory
    """
    # Get the failed URLs list from metadata
    failed_json = _scalar(df, 'preload_failed_urls')
    failed_urls = set()
    if failed_json and isinstance(failed_json, str):
        try:
            failed_urls = set(json.loads(failed_json))
        except (json.JSONDecodeError, TypeError):
            pass

    # Collect all stimulus URLs from encoding
    all_urls = set()
    if len(enc) and 'stim_img' in enc.columns:
        all_urls.update(enc['stim_img'].dropna().unique())

    if not all_urls:
        return pd.DataFrame()

    rows = []
    for url in sorted(all_urls):
        # Encoding stats
        e_trials = enc[enc['stim_img'] == url] if len(enc) else pd.DataFrame()
        n_enc = len(e_trials)
        n_enc_fallback = 0
        if n_enc and 'stim_display_outcome' in e_trials.columns:
            n_enc_fallback = (e_trials['stim_display_outcome'] == 'fallback_emoji').sum()

        # Memory stats (URL might appear as left or right stim)
        n_mem = 0
        n_mem_fallback = 0
        if len(mem):
            for side, fail_col, fb_col in [
                ('stim_left_img',  'stim_left_preload_failed',  'stim_left_fallback_emoji'),
                ('stim_right_img', 'stim_right_preload_failed', 'stim_right_fallback_emoji')
            ]:
                if side in mem.columns:
                    matched = mem[mem[side] == url]
                    n_mem += len(matched)
                    if fail_col in matched.columns:
                        n_mem_fallback += matched[fail_col].fillna(False).astype(bool).sum()

        rows.append({
            'url': url,
            'preload_outcome': 'failed' if url in failed_urls else 'success',
            'n_encoding_trials': n_enc,
            'n_encoding_fallback': int(n_enc_fallback),
            'n_memory_trials': n_mem,
            'n_memory_fallback': int(n_mem_fallback),
        })

    return pd.DataFrame(rows)


def _json_list(value):
    """Decode an optional JSON-array cell without coupling to mouse_features."""
    if not isinstance(value, str) or not value.strip():
        return []
    try:
        decoded = json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return []
    return decoded if isinstance(decoded, list) else []


def _explode_mouse_rows(traj, participant_id):
    """Return one row per valid raw pointer sample/event."""
    rows = []
    for _, r in traj.iterrows():
        base = {
            'participant_id': participant_id,
            'trajectory_id': r.get('trajectory_id'),
            'target_start_x': r.get('target_start_x'),
            'target_start_y': r.get('target_start_y'),
            'target_end_x': r.get('target_end_x'),
            'target_end_y': r.get('target_end_y'),
        }
        for sample in _json_list(r.get('samples')):
            if not isinstance(sample, list) or len(sample) < 4:
                continue
            rows.append({
                **base, 'event_type': 'move', 't_ms': sample[0],
                'x_norm': sample[1], 'y_norm': sample[2],
                'pointer_type': r.get('pointer_type'),
                'coalesced': int(bool(sample[3])), 'button': None,
            })
        for event in _json_list(r.get('events')):
            if not isinstance(event, list) or len(event) < 6:
                continue
            rows.append({
                **base, 'event_type': event[3], 't_ms': event[0],
                'x_norm': event[1], 'y_norm': event[2],
                'pointer_type': event[5], 'coalesced': 0,
                'button': event[4],
            })
    columns = [
        'participant_id', 'trajectory_id', 'target_start_x', 'target_start_y',
        'target_end_x', 'target_end_y', 'event_type', 't_ms', 'x_norm',
        'y_norm', 'pointer_type', 'coalesced', 'button',
    ]
    if not rows:
        return pd.DataFrame(columns=columns)
    return (pd.DataFrame(rows)[columns]
            .sort_values(['trajectory_id', 't_ms'], kind='stable')
            .reset_index(drop=True))


def process_one(filepath, outdir, explode_mouse=False, module_dirs=None):
    """Split one raw export, optionally routing tables by module.

    Explicit Python callers retain flat output in outdir by default, useful
    for isolated in-memory analyses. The CLI supplies module_dirs and writes
    module-specific clean directories. Full-session metadata is copied to each
    module; module-only raw sources retain their own assignment inventory.
    """
    df = pd.read_csv(filepath)
    fname_pid, fname_date, fname_time = parse_filename(filepath)

    # Anonymous audit sessions still have a stable identity across renamed
    # checkpoint and final files. Never derive that identity from the filename
    # when a recorded identifier is available.
    out_pid = fname_pid
    for field in ('PROLIFIC_PID', 'workerId', 'subId', 'run_uuid'):
        candidate = _last_scalar(df, field)
        if candidate is not None and str(candidate).strip().lower() not in ('nan', 'none', 'null', ''):
            out_pid = str(candidate)
            break
    out_date = fname_date or 'nodatetime'
    directories = {module: Path((module_dirs or {}).get(module, outdir)) for module in MODULES}
    for directory in set(directories.values()):
        directory.mkdir(parents=True, exist_ok=True)
    session_stem = _session_stem(df, filepath, out_pid, out_date, fname_time)
    prefixes = {module: str(directory / session_stem) for module, directory in directories.items()}
    prefix = prefixes['drone_task']
    mouse_prefix = prefixes['mouse_qc']
    screen_prefix = prefixes['memory_screen']
    written  = []

    run_ids = df.get('run_uuid', pd.Series(dtype=object)).dropna().astype(str).unique()
    if len(run_ids) > 1:
        raise ValueError('Raw file contains more than one run_uuid; split runs before ingestion')
    maximum_sequence = pd.to_numeric(df.get('row_sequence', pd.Series(dtype=float)),
                                     errors='coerce').max()
    maximum_sequence = float(maximum_sequence) if pd.notna(maximum_sequence) else float(len(df))
    prior_metadata = Path(f'{prefix}_metadata.csv')
    if len(run_ids) == 1 and prior_metadata.exists():
        prior = pd.read_csv(prior_metadata)
        prior_sequence = pd.to_numeric(prior.get('source_max_row_sequence', pd.Series(dtype=float)), errors='coerce').max()
        prior_count = pd.to_numeric(prior.get('source_row_count', pd.Series(dtype=float)), errors='coerce').max()
        if pd.notna(prior_sequence) and (prior_sequence > maximum_sequence or
                (prior_sequence == maximum_sequence and pd.notna(prior_count) and prior_count > len(df))):
            print(f'  [{out_pid}] skipped an older snapshot of run {run_ids[0]}')
            return out_pid

    screening_mask = _memory_screening_mask(df)
    category = df.get('trial_category', pd.Series('', index=df.index)).fillna('')
    screening_summary = df[category.eq('memory_screening_summary')]

    # 1. Metadata
    meta_row = {'participant_id': out_pid}
    dynamic_meta = [c for c in df.columns if c.startswith((
        'expected_', 'save_', 'consent_', 'perf_', 'build_', 'session_',
        'instruction_version', 'comprehension_version', 'survey_version'))]
    for c in dict.fromkeys(COMMON_COLS + META_COLS + dynamic_meta):
        meta_row[c] = _last_scalar(df, c)
    # Result fields can change from pending to passed/failed after metadata
    # stamping. The completed summary is authoritative; otherwise preserve the
    # latest observed value so an interrupted screen remains auditable.
    for c in MEMORY_SCREENING_METADATA_COLS:
        value = _last_scalar(screening_summary, c)
        meta_row[c] = value if value is not None else _last_scalar(df, c)
    meta_row['pavlovia_pid']  = fname_pid
    meta_row['pavlovia_date'] = fname_date
    meta_row['pavlovia_time'] = fname_time
    meta_row['source_sha256'] = hashlib.sha256(Path(filepath).read_bytes()).hexdigest()
    meta_row['source_filename'] = Path(filepath).name
    meta_row['session_file_stem'] = session_stem
    meta_row['source_row_count'] = len(df)
    meta_row['source_max_row_sequence'] = maximum_sequence
    # Full-session raw files keep metadata in every module's inventory.
    # Module-only raw directories identify a narrower assignment population.
    origin_module = next((p.parent.name for p in Path(filepath).resolve().parents
                          if p.name == 'raw' and p.parent.name in MODULES), None)
    metadata_modules = (origin_module,) if origin_module in ('mouse_qc', 'memory_screen') else MODULES
    for metadata_prefix in {prefixes[module] for module in metadata_modules}:
        pd.DataFrame([meta_row]).to_csv(f'{metadata_prefix}_metadata.csv', index=False)
    written.append('metadata')

    # Treat trial_type as optional so even unusually sparse legacy exports
    # still yield their metadata table instead of failing immediately.
    trial_type = df.get('trial_type', pd.Series('', index=df.index)).fillna('')

    # 2. Main encoding trials (practice_no == 0), excluding the screen.
    prac_col = df.get('practice_no', pd.Series(float('nan'), index=df.index, dtype=float))
    enc = df[(trial_type == 'trial') & (prac_col.fillna(-1) == 0) & ~screening_mask]
    if len(enc):
        _keep(enc, ENCODING_COLS).to_csv(f'{prefix}_encoding.csv', index=False)
        written.append(f'encoding ({len(enc)})')

    # 3. Memory trials
    mem = df[(trial_type == 'memory-task') & ~screening_mask]
    if len(mem):
        mem = _repair_memory_condition_labels(mem, enc)
        _keep(mem, MEMORY_COLS).to_csv(f'{prefix}_memory.csv', index=False)
        written.append(f'memory ({len(mem)})')

    # 4. Practice trials (practice_no > 0)
    prac = df[(trial_type == 'trial') & (prac_col.fillna(0) > 0) & ~screening_mask]
    if len(prac):
        _keep(prac, PRACTICE_COLS).to_csv(f'{prefix}_practice.csv', index=False)
        written.append(f'practice ({len(prac)})')

    # 5. Comprehension
    comp = df[trial_type.str.contains('comprehension', case=False, na=False)]
    if len(comp):
        _keep(comp, COMPREHENSION_COLS).to_csv(f'{prefix}_comprehension.csv', index=False)
        written.append(f'comprehension ({len(comp)})')

    # 6. Demographics
    demo = df[trial_type == 'survey-demo']
    if len(demo):
        _flatten_demographics(demo).to_csv(f'{prefix}_demographics.csv', index=False)
        written.append(f'demographics ({len(demo)})')

    # Instruction histories and generic event streams remain separate from
    # scored trials. Sparse event tables retain unfamiliar future fields.
    instructions = df[(trial_type == 'instructions') |
                      category.eq('instruction_event')]
    if len(instructions):
        _keep(instructions, INSTRUCTION_COLS).to_csv(f'{prefix}_instructions.csv', index=False)
        written.append(f'instructions ({len(instructions)})')
        views = _instruction_views(instructions)
        if len(views):
            views.to_csv(f'{prefix}_instruction_views.csv', index=False)
            written.append(f'instruction_views ({len(views)})')
    interactions = _interaction_rows(df)
    if len(interactions):
        interactions.to_csv(f'{prefix}_interactions.csv', index=False)
        written.append(f'interactions ({len(interactions)})')
    event_groups = {
        'session_events': category.isin(['session_manifest', 'session_summary',
            'save_event', 'instruction_event', 'response_event', 'interaction_event']) |
            category.str.startswith('session_') | category.str.endswith('_event'),
        'save_receipts': category.eq('save_event') | category.str.startswith('save_'),
        'design_manifests': category.eq('design_manifest'),
        'response_events': category.eq('response_event'),
    }
    for name, mask in event_groups.items():
        events = df[mask]
        if len(events):
            _sparse_rows(events).to_csv(f'{prefix}_{name}.csv', index=False)
            written.append(f'{name} ({len(events)})')

    # 7. Preload diagnostics — per-URL success/failure + trial impact
    diag = _build_preload_diagnostics(df, enc, mem)
    if len(diag):
        diag.to_csv(f'{prefix}_preload_diagnostics.csv', index=False)
        n_failed = (diag['preload_outcome'] == 'failed').sum()
        written.append(f'preload_diagnostics ({n_failed} failed / {len(diag)} URLs)')

    # 8. Optional mouse-trajectory QC tables. No files are emitted for a
    # core-only session, so downstream core workflows remain unchanged.
    if 'mt_row' in df.columns:
        mouse_rows = df[(trial_type == 'mouse-trajectory') |
                        df['mt_row'].isin(['trajectory', 'summary'])]
        traj = mouse_rows[mouse_rows['mt_row'] == 'trajectory']
        summary = mouse_rows[mouse_rows['mt_row'] == 'summary']
        if len(traj):
            traj_out = _keep(traj, MOUSE_TRAJECTORY_COLS)
            traj_out.insert(0, 'participant_id', out_pid)
            traj_out.to_csv(f'{mouse_prefix}_mouse_trajectory.csv', index=False)
            written.append(f'mouse_trajectory ({len(traj_out)})')
            if explode_mouse:
                events = _explode_mouse_rows(traj, out_pid)
                if len(events):
                    events.to_csv(f'{mouse_prefix}_mouse_events.csv', index=False)
                    written.append(f'mouse_events ({len(events)})')
        if len(summary):
            summary_out = _keep(summary, MOUSE_SUMMARY_COLS)
            summary_out.insert(0, 'participant_id', out_pid)
            summary_out.to_csv(f'{mouse_prefix}_mouse_summary.csv', index=False)
            written.append(f'mouse_summary ({len(summary_out)})')

    # 9. Optional memory screen. A nonpassing participant still has a complete
    # screen export but no main encoding/memory output. Intro/transition rows
    # stay in the raw file, without entering the trial or pair tables.
    if screening_mask.any():
        screening_rows = df[screening_mask]
        screening_types = trial_type.loc[screening_rows.index]
        screening_categories = category.loc[screening_rows.index]
        screen_enc = screening_rows[
            screening_categories.eq('memory_screening_encoding') |
            screening_types.eq('trial')
        ]
        screen_order = screening_rows[
            screening_categories.eq('memory_screening_order') |
            screening_types.eq('memory-task')
        ]
        for name, table, columns in [
            ('memory_screening_encoding', screen_enc, MEMORY_SCREENING_ENCODING_COLS),
            ('memory_screening_order', screen_order, MEMORY_SCREENING_ORDER_COLS),
            ('memory_screening_summary', screening_summary, MEMORY_SCREENING_SUMMARY_COLS),
        ]:
            if len(table):
                output = _keep(table, columns)
                output.insert(0, 'participant_id', out_pid)
                output.to_csv(f'{screen_prefix}_{name}.csv', index=False)
                written.append(f'{name} ({len(output)})')

    print(f'  [{out_pid} | {fname_date}] → {", ".join(written)}')
    return out_pid


def main():
    ap = argparse.ArgumentParser(description='Split DroneTask Pavlovia CSVs.')
    ap.add_argument('input', nargs='?', default=str(DATA_DIR),
                    help='Single raw CSV, raw directory, or organized data root (default: analysis/data)')
    ap.add_argument('-o', '--outdir', default=None,
                    help='Organized data root containing module/clean directories (default: analysis/data)')
    ap.add_argument('--explode-mouse', action='store_true',
                    help='Also write a long mouse-events table when QC data exist')
    args = ap.parse_args()

    data_root = Path(args.outdir).expanduser().resolve() if args.outdir else DATA_DIR
    for module in MODULES:
        for stage in ('raw', 'clean', 'derived'):
            (data_root / module / stage).mkdir(parents=True, exist_ok=True)
    source = Path(args.input).expanduser()
    if source.is_file():
        candidates = [source]
    elif source.is_dir():
        raw_roots = [source / module / 'raw' for module in MODULES if (source / module / 'raw').is_dir()]
        if not raw_roots:
            raw_roots = [source / 'raw'] if (source / 'raw').is_dir() else [source]
        candidates = sorted(p for raw_root in raw_roots for p in raw_root.rglob('*.csv'))
    else:
        print(f'Error: {args.input!r} not found.', file=sys.stderr)
        sys.exit(1)

    files, seen = [], set()
    for candidate in candidates:
        digest = hashlib.sha256(candidate.read_bytes()).hexdigest()
        if digest not in seen:
            seen.add(digest)
            files.append(str(candidate))
    module_dirs = {module: data_root / module / 'clean' for module in MODULES}
    print(f'Output → {data_root}/<module>/clean/')
    if len(candidates) != len(files):
        print(f'Ignored {len(candidates) - len(files)} exact raw-file copies.')

    # A checkpoint and final file can be cumulative snapshots of one run.
    # Process the most complete snapshot once rather than count it as another
    # participant. Legacy exports without run_uuid remain distinct sessions.
    selected, by_run = [], {}
    for filename in files:
        header = pd.read_csv(filename, nrows=0).columns
        if 'run_uuid' not in header:
            selected.append(filename)
            continue
        columns = [name for name in ['run_uuid', 'row_sequence'] if name in header]
        values = pd.read_csv(filename, usecols=columns)
        identities = values.run_uuid.dropna().astype(str).unique()
        if len(identities) != 1:
            selected.append(filename)
            continue
        sequence = pd.to_numeric(values.get('row_sequence', pd.Series(dtype=float)), errors='coerce').max()
        rank = (float(sequence) if pd.notna(sequence) else len(values), len(values), str(filename))
        run = identities[0]
        if run not in by_run or rank > by_run[run][0]:
            by_run[run] = (rank, filename)
    selected.extend(record[1] for record in by_run.values())
    if len(selected) != len(files):
        print(f'Consolidated {len(files) - len(selected)} older cumulative run snapshots.')
    files = sorted(selected)

    ok, failed = 0, []
    for f in files:
        print(f'Processing {os.path.basename(f)} ...')
        try:
            process_one(f, module_dirs['drone_task'], explode_mouse=args.explode_mouse,
                        module_dirs=module_dirs)
            ok += 1
        except Exception as e:
            print(f'  ERROR: {e}', file=sys.stderr)
            failed.append(f)

    print(f'\nDone — {ok} participant(s)' +
          (f', {len(failed)} failed.' if failed else '.'))


if __name__ == '__main__':
    main()
