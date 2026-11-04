"""Canonical, read only session intake shared by the three analysis notebooks.

Raw exports are the default. Byte identical copies and cumulative snapshots of
the same run are never additional participants. Existing clean files are not
rewritten, migrated, or implicitly mixed into the raw collection. Identifiers
and source paths in these tables are private; display ``session_label`` only.
"""
from __future__ import annotations

import contextlib
import hashlib
import importlib.util
import io
from pathlib import Path
import tempfile

import pandas as pd

ANALYSIS_DIR = Path(__file__).resolve().parent
REPOSITORY_ROOT = ANALYSIS_DIR.parent
MODULES = ('drone_task', 'mouse_qc', 'memory_screen')
TABLE_NAMES = (
    'metadata', 'encoding', 'memory', 'practice', 'comprehension',
    'demographics', 'instructions', 'instruction_views', 'interactions',
    'session_events', 'save_receipts', 'design_manifests', 'response_events',
    'preload_diagnostics', 'mouse_trajectory', 'mouse_summary', 'mouse_events',
    'memory_screening_encoding', 'memory_screening_order',
    'memory_screening_summary',
)
IDENTITY_COLUMNS = (
    'session_id', 'session_label', 'participant_id', 'source_schema',
    'task_version', 'source_kind', 'comparability_group',
)
ISSUE_COLUMNS = ('session_id', 'session_label', 'severity', 'check', 'detail')


def _import_file(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _root_path(root):
    root = Path(root).expanduser().resolve() if root is not None else REPOSITORY_ROOT
    if (root / 'analysis').is_dir():
        return root
    if root.name == 'analysis' and (root / 'split_drone_data.py').exists():
        return root.parent
    raise ValueError('root must be the repository root or its analysis directory')


def _last(frame, column, default=pd.NA):
    if column not in frame:
        return default
    values = frame[column].dropna()
    values = values[values.astype(str).str.strip().ne('')]
    return values.iloc[-1] if len(values) else default


def _present(value):
    return pd.notna(value) and str(value).strip().lower() not in ('', 'nan', 'none', 'null')


def _column(frame, name):
    return frame[name] if name in frame else pd.Series('', index=frame.index)


def _read_csv(path):
    # Recorded numeric identifiers must not acquire rounding or lose zeroes.
    identity = {c: 'string' for c in (
        'participant_id', 'run_uuid', 'row_uuid', 'PROLIFIC_PID', 'workerId',
        'subId', 'STUDY_ID', 'SESSION_ID', 'session_id',
    )}
    return pd.read_csv(path, dtype=identity, low_memory=False)


def _raw_metadata(frame, split_metadata):
    """Keep session manifest and terminal results beyond the split allowlist."""
    meta = split_metadata.iloc[0].to_dict() if len(split_metadata) else {}
    for col in frame:
        if col.startswith(('expected_', 'observed_', 'session_', 'browser_',
                           'viewport_', 'device_', 'route_', 'build_',
                           'mouse_qc_', 'memory_screening_', 'instruction_',
                           'comprehension_', 'survey_', 'condition_label_',
                           'consent_')) or col in (
            'outcome', 'exit_reason', 'final_phase', 'screening_criterion_passed',
            'data_saving_version', 'cache_status', 'audit_full',
            'completion_path', 'completion_route_configured',
            'inactivity_policy_version', 'inactivity_auto_terminate',
        ):
            meta[col] = _last(frame, col)
    return meta


def _attach(frame, identity):
    frame = frame.copy()
    for key in IDENTITY_COLUMNS:
        frame[key] = identity.get(key, pd.NA)
    return frame


def _comparability_group(schema, version, metadata):
    group = schema + ' | ' + (str(version) if _present(version) else 'unknown version')
    label_version = metadata.get('condition_label_version')
    if _present(label_version):
        group += ' | condition labels ' + str(label_version)
    policy_version = metadata.get('inactivity_policy_version')
    return group + ' | inactivity policy ' + str(policy_version) if _present(policy_version) else group


def _version_checks(frame):
    """Version changes within one run are a recording conflict, not a cohort.

    Older runs may omit these fields. Their recorded labels and display
    outcomes remain historical observations rather than inferred new values.
    """
    issues = []
    for column in ('condition_label_version', 'consent_text_version',
                   'inactivity_policy_version', 'inactivity_auto_terminate'):
        if column not in frame:
            continue
        versions = [value for value in frame[column].dropna().unique() if _present(value)]
        if len(versions) > 1:
            issues.append(('error', 'mixed_' + column,
                           'More than one recorded value occurs within a canonical run'))
    return issues


def _snapshot_checks(candidates, selected):
    """Detect changed observations without treating global metadata as trials.

    jsPsych stamps updated global outcome fields onto earlier rows. Comparing
    those fields across snapshots would produce false conflicts, so overlap
    comparison is restricted to immutable observation and row identity fields.
    """
    issues = []
    frame = selected['frame']
    uuids = _column(frame, 'row_uuid')
    if uuids.ne('').any() and uuids[uuids.ne('')].duplicated().any():
        issues.append(('error', 'duplicate_row_uuid', 'Selected snapshot repeats a recorded row UUID'))
    if len(candidates) <= 1:
        return issues
    immutable = {
        'row_sequence', 'trial_index', 'trial_type', 'trial_category', 'task_phase',
        'elapsed_ms', 'utc_timestamp', 'block', 'display_block', 'trial', 'pair_index',
        'practice_no', 'drone_position', 'bag_position', 'bucket_start_pos',
        'bucket_end_pos', 'stim_img', 'stim_left_img', 'stim_right_img',
        'trial1_index', 'trial2_index', 'item1_trial', 'item2_trial',
        'order_choice_side', 'order_choice_img', 'order_correct_bin',
        'distance_estimate', 'placement_slider_value', 'response_stage',
        'response_value', 'response_attempt', 'final_omission', 'stage_timed_out',
        'completed', 'supply_caught', 'score', 'trajectory_id', 'samples', 'events',
        'mt_row', 'trajectory_completed', 'order_attempts_json',
        'distance_attempts_json', 'placement_attempts_json',
        'memory_item_display_log_json', 'memory_item_display_schema_version',
        'stim_left_fallback_used', 'stim_right_fallback_used',
        'condition_label_version', 'consent_text_version',
        'inactivity_policy_version', 'inactivity_auto_terminate',
        'inactivity_streak_length', 'inactivity_episode_eligible',
        'inactivity_episode_count', 'inactivity_warning_scheduled',
        'inactivity_warning_shown', 'inactivity_warning_severity',
        'inactivity_legacy_threshold_reached',
        'bag_rendered_position', 'bag_scoring_position', 'bag_position_adjusted',
        'stim_display_outcome', 'stim_display_status', 'stim_load_route',
        'stim_preload_failed', 'stim_fallback_emoji', 'stim_image_loaded',
        'stim_image_decoded', 'stim_load_error', 'stim_fallback_reason',
        'stim_requested_elapsed_ms', 'stim_visible_elapsed_ms', 'stim_visible_duration_ms',
    }
    chosen = frame.loc[uuids.ne('')].drop_duplicates('row_uuid').set_index('row_uuid') if uuids.ne('').any() else pd.DataFrame()
    conflicting, missing = set(), set()
    for candidate in candidates:
        if candidate is selected:
            continue
        other = candidate['frame']
        other_ids = _column(other, 'row_uuid')
        if not other_ids.ne('').any() or chosen.empty:
            continue
        other = other.loc[other_ids.ne('')].drop_duplicates('row_uuid').set_index('row_uuid')
        missing.update(set(other.index) - set(chosen.index))
        common = chosen.index.intersection(other.index)
        columns = sorted(immutable.intersection(chosen).intersection(other))
        if len(common) and columns:
            left = chosen.loc[common, columns].fillna('').astype(str)
            right = other.loc[common, columns].fillna('').astype(str)
            conflicts = left.ne(right).any(axis=1)
            conflicting.update(common[conflicts])
    if conflicting:
        issues.append(('error', 'snapshot_overlap_conflict',
                       f'{len(conflicting)} overlapping recorded observations differ between snapshots'))
    if missing:
        issues.append(('error', 'snapshot_non_cumulative',
                       f'{len(missing)} earlier row UUIDs are absent from the selected snapshot'))
    return issues


def _raw_load(root, raw_dirs):
    audit = _import_file('_drone_session_audit', root / 'design_checks/scripts/data_saving_audit.py')
    splitter = _import_file('_drone_session_splitter', root / 'analysis/split_drone_data.py')
    inputs = raw_dirs if raw_dirs is not None else [root / 'analysis/data' / module / 'raw' for module in MODULES]
    loaded = audit.load_samples(inputs)
    groups = loaded['sessions']
    # Display ordinals are intentionally not persistent identifiers. The UUID
    # or full legacy source hash remains stable after new sessions are added.
    groups.sort(key=lambda group: (
        str(_last(group['selected']['frame'], 'session_started_at',
                  _last(group['selected']['frame'], 'session_started_utc', ''))),
        group['selected']['path'].name,
    ))
    parts = {name: [] for name in TABLE_NAMES}
    inventory, issues = [], []
    for number, group in enumerate(groups, 1):
        selected = group['selected']
        raw = selected['frame']
        run = _last(raw, 'run_uuid')
        session_id = str(run) if _present(run) else 'legacy_' + selected['sha256']
        label = f'Session {number:03d}'
        split_error = None
        with tempfile.TemporaryDirectory(prefix='drone_session_') as temp_dir:
            # The splitter prints private participant IDs. Silence it even in
            # notebooks, and use only temporary output paths for ingestion.
            try:
                with contextlib.redirect_stdout(io.StringIO()):
                    splitter.process_one(selected['path'], temp_dir)
            except Exception as error:
                # Retain the session in the denominator. A partially written
                # temporary split must not masquerade as valid complete data.
                split_error = type(error).__name__
                issues.append(dict(session_id=session_id, session_label=label,
                                   severity='error', check='split_failed',
                                   detail=f'Canonical source could not be normalized ({split_error})'))
            session_tables = {}
            for table in TABLE_NAMES:
                paths = [] if split_error else list(Path(temp_dir).glob(f'*_{table}.csv'))
                # Avoid suffix overlap such as encoding versus screen encoding.
                paths = [p for p in paths if not any(
                    p.name.endswith('_' + other + '.csv') for other in TABLE_NAMES
                    if other != table and other.endswith('_' + table))]
                if len(paths) > 1:
                    raise ValueError('One canonical raw snapshot produced ambiguous table outputs')
                session_tables[table] = _read_csv(paths[0]) if paths else pd.DataFrame()
        meta = _raw_metadata(raw, session_tables['metadata'])
        if not _present(meta.get('participant_id')):
            meta['participant_id'] = next((_last(raw, field) for field in (
                'PROLIFIC_PID', 'workerId', 'subId') if _present(_last(raw, field))), pd.NA)
        source_schema = 'current' if _present(run) and _present(_last(raw, 'data_schema_version')) else 'legacy'
        version = _last(raw, 'task_version')
        identity = dict(session_id=session_id, session_label=label,
                        participant_id=meta.get('participant_id', pd.NA),
                        source_schema=source_schema, task_version=version,
                        source_kind=selected['kind'],
                        comparability_group=_comparability_group(source_schema, version, meta))
        meta.update(identity)
        meta.update(input_mode='raw', selected_source=str(selected['path'].resolve()),
                    source_snapshot_count=len(group['candidates']), snapshot_count=len(group['candidates']),
                    source_sha256=selected['sha256'], source_row_count=len(raw),
                    intake_status='split_failed' if split_error else 'loaded')
        meta['has_session_summary'] = _column(raw, 'trial_category').eq('session_summary').any()
        inventory.append(meta)
        session_tables['metadata'] = pd.DataFrame([meta])
        for table, frame in session_tables.items():
            if len(frame):
                parts[table].append(_attach(frame, identity))
        for severity, check, detail in _snapshot_checks(group['candidates'], selected):
            issues.append(dict(session_id=session_id, session_label=label,
                               severity=severity, check=check, detail=detail))
        for severity, check, detail in _version_checks(raw):
            issues.append(dict(session_id=session_id, session_label=label,
                               severity=severity, check=check, detail=detail))
    for error in loaded['errors']:
        issues.append(dict(session_id=pd.NA, session_label=pd.NA, severity='error',
                           check='input_read_error', detail=f"{error['kind']} could not be read ({error['error_type']})"))
    if loaded['duplicate_copies']:
        issues.append(dict(session_id=pd.NA, session_label=pd.NA, severity='info',
                           check='byte_identical_copies', detail=f"Ignored {loaded['duplicate_copies']} byte identical source copies"))
    return parts, inventory, issues


def _clean_load(root, module, clean_dir):
    directory = Path(clean_dir).expanduser().resolve() if clean_dir is not None else root / 'analysis/data' / module / 'clean'
    parts = {name: [] for name in TABLE_NAMES}
    inventory, issues, accounted = [], [], set()
    # Flat only. An old nested debug folder requires its own explicit path.
    metadata_paths = sorted(directory.glob('*_metadata.csv'))
    seen = {}
    for path in metadata_paths:
        metadata = _read_csv(path)
        if len(metadata) != 1:
            raise ValueError('Each clean metadata file must describe exactly one session')
        meta = metadata.iloc[0].to_dict()
        stem = path.name[:-len('_metadata.csv')]
        run = meta.get('run_uuid')
        source_hash = meta.get('source_sha256')
        if _present(run):
            session_id = str(run)
        elif _present(source_hash):
            session_id = 'legacy_' + str(source_hash)
        else:
            # Older clean files may predate source hashes. Full filename stem
            # distinguishes same participant on different dates, unlike pid.
            session_id = 'clean_' + hashlib.sha256(stem.encode()).hexdigest()
        if session_id in seen:
            issues.append(dict(session_id=session_id, session_label=seen[session_id], severity='error',
                               check='duplicate_clean_session', detail='More than one clean prefix represents this session; later prefix was not pooled'))
            continue
        label = f'Session {len(inventory) + 1:03d}'
        seen[session_id] = label
        schema = 'current' if _present(run) and _present(meta.get('data_schema_version')) else 'legacy'
        version = meta.get('task_version', pd.NA)
        identity = dict(session_id=session_id, session_label=label,
                        participant_id=meta.get('participant_id', pd.NA),
                        source_schema=schema, task_version=version, source_kind='clean',
                        comparability_group=_comparability_group(schema, version, meta))
        meta.update(identity)
        meta.update(input_mode='clean', selected_source=str(path), source_snapshot_count=pd.NA,
                    snapshot_count=pd.NA, intake_status='loaded')
        inventory.append(meta)
        parts['metadata'].append(pd.DataFrame([meta]))
        accounted.add(path)
        for table in TABLE_NAMES:
            if table == 'metadata':
                continue
            table_path = directory / f'{stem}_{table}.csv'
            if table_path.exists():
                parts[table].append(_attach(_read_csv(table_path), identity))
                accounted.add(table_path)
    unassigned = set(directory.glob('*.csv')) - accounted
    if unassigned:
        issues.append(dict(session_id=pd.NA, session_label=pd.NA, severity='warning',
                           check='unassigned_clean_files', detail=f'{len(unassigned)} clean tables lack a unique loaded metadata prefix and were not pooled'))
    return parts, inventory, issues


def load_module_tables(module, root=None, input_mode='raw', clean_dir=None, raw_dirs=None):
    """Return ``tables``, ``inventory``, and ``issues`` DataFrames for analysis.

    ``module`` selects the default clean directory. Raw intake discovers all
    three module raw folders, retaining metadata even when an optional module
    was not assigned. All available table names are returned so a module can
    make same run comparisons without importing the source a second time.

    ``root`` accepts the repository root or its analysis directory. Explicit
    ``raw_dirs`` accepts a path or list of paths for isolated data collections.
    ``input_mode='clean'`` enables retained clean exports; it never searches
    recursively. Supply ``clean_dir`` to opt into a specific debug collection.
    Missing flags and outcomes remain missing, never false, passed, or complete.
    """
    if module not in MODULES:
        raise ValueError(f'module must be one of {MODULES}')
    if input_mode not in ('raw', 'clean'):
        raise ValueError('input_mode must be raw or clean')
    if input_mode == 'raw' and clean_dir is not None:
        raise ValueError('clean_dir requires input_mode=clean')
    if input_mode == 'clean' and raw_dirs is not None:
        raise ValueError('raw_dirs requires input_mode=raw')
    root = _root_path(root)
    parts, inventory, issues = (_raw_load(root, raw_dirs) if input_mode == 'raw'
                                else _clean_load(root, module, clean_dir))
    tables = {name: pd.concat(frames, ignore_index=True, sort=False) if frames
              else pd.DataFrame(columns=IDENTITY_COLUMNS) for name, frames in parts.items()}
    inventory = pd.DataFrame(inventory) if inventory else pd.DataFrame(columns=IDENTITY_COLUMNS)
    return dict(tables=tables, inventory=inventory,
                issues=pd.DataFrame(issues, columns=ISSUE_COLUMNS),
                input_mode=input_mode, module=module)
