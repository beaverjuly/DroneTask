"""Inspect raw experiment snapshots and optional save receipts.

Public tables use ordinal session labels. Raw identifiers and source paths stay
inside the loader. This is a delivery and record integrity audit, not a rule for
excluding participants because of memory or mouse performance.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
from collections import defaultdict
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_INPUTS = [ROOT / 'analysis/data' / module / 'raw'
                  for module in ['drone_task', 'memory_screen', 'mouse_qc']]
DEFAULT_OUTPUT = ROOT / 'analysis/data/drone_task/derived/data_saving_audit'
SCHEMA_VERSION = 'drone-data-v2'
COMMON_FIELDS = ['data_schema_version', 'run_uuid', 'row_uuid', 'row_sequence',
                 'task_phase', 'elapsed_ms', 'utc_timestamp']


def value(data, key, default=None):
    if isinstance(data, pd.DataFrame):
        if key not in data:
            return default
        entries = data[key].dropna()
        entries = entries[entries.astype(str).ne('')]
        return entries.iloc[-1] if len(entries) else default
    answer = data.get(key, default)
    return default if answer is None or (isinstance(answer, str) and not answer.strip()) else answer


def decoded(data, default=None):
    if isinstance(data, (dict, list)):
        return data
    try:
        return json.loads(data)
    except (TypeError, ValueError):
        return default


def truth(data):
    if isinstance(data, (bool, np.bool_)):
        return bool(data)
    text = str(data).strip().lower()
    return True if text in {'true', '1', '1.0'} else False if text in {'false', '0', '0.0'} else None


def number(data, default=np.nan):
    try:
        answer = float(data)
        return answer if np.isfinite(answer) else default
    except (ValueError, TypeError):
        return default


def column(frame, name, default=''):
    return frame[name] if name in frame else pd.Series(default, index=frame.index)


def runtime_contract():
    """Evaluate current task material rather than transcribe trial counts."""
    program = r"""
const fs=require('fs'),vm=require('vm');
const ctx={console:{log(){},warn(){}},Math,Set};ctx.window=ctx;
ctx.jsPsych={plugins:{parameterType:new Proxy({}, {get:(o,k)=>k})},
 randomization:{shuffle:x=>x.slice()}};vm.createContext(ctx);
for(const file of ['static/task/stimuli.js','static/task/preload.js',
 'static/task/memory_task.js','static/task/mouse_qc/mouse_trajectory.js',
 'static/task/memory_screening/memory_screening.js'])
 vm.runInContext(fs.readFileSync(file,'utf8'),ctx);
const screen=ctx.MemoryScreening.createDesign({seed:'data-saving-audit'});
console.log(JSON.stringify({main_blocks:ctx.main_drone_position.length,
 main_trials_per_block:ctx.main_drone_position[0].length,
 main_pairs_per_block:ctx.PREDEFINED_PAIRS.length,
 mouse_trajectories:ctx.MOUSE_TRAJECTORY_GEOMETRY.targets.length,
 screen_encoding:screen.n_encoding,screen_order:screen.n_pairs,
 screen_min_correct:screen.min_correct,screen_series_version:screen.series_version,
 screen_drone_step:screen.drone_step_size,screen_supply_offset:screen.supply_offset_size,
 main_pool:ctx.STIMULUS_IMAGE_POOL,main_pairs:ctx.PREDEFINED_PAIRS,
 main_drone_positions:ctx.main_drone_position,main_supply_positions:ctx.main_bag_position,
 main_valences:ctx.factors_valence,mouse_geometry:ctx.MOUSE_TRAJECTORY_GEOMETRY,
 screen_design:screen}));
"""
    result = json.loads(subprocess.check_output(['node', '-e', program], cwd=ROOT, text=True))
    result['main_encoding'] = result['main_blocks'] * result['main_trials_per_block']
    result['main_memory_pairs'] = result['main_blocks'] * result['main_pairs_per_block']
    result['source_hashes'] = {
        path: hashlib.sha256((ROOT / path).read_bytes()).hexdigest()
        for path in ['static/task/data_saving.js', 'static/task/data_recorder.js',
                     'static/task/progress.js',
                     'static/lib/jspsych-pavlovia-3.2.5.js', 'index.html',
                     'static/task/memory_screening/memory_screening.js',
                     'static/task/mouse_qc/mouse_trajectory.js', 'analysis/split_drone_data.py']}
    return result


def _kind(path, frame):
    if 'recovery' in path.stem.lower():
        return 'recovery'
    if 'final' in path.stem.lower():
        return 'final'
    if 'checkpoint' in path.stem.lower():
        return 'checkpoint'
    if column(frame, 'trial_category').eq('session_summary').any():
        return 'final'
    return 'raw'


def load_samples(inputs=None):
    """Load explicit directories or files and deduplicate byte identical copies.

    Multiple snapshots of one run are grouped, not counted as new participants.
    Legacy files without a run UUID remain separate source sessions.
    """
    inputs = DEFAULT_INPUTS if inputs is None else inputs
    if isinstance(inputs, (str, Path)):
        inputs = [inputs]
    paths = []
    for entry in map(Path, inputs):
        paths.extend([entry] if entry.is_file() else sorted(entry.rglob('*.csv')) if entry.exists() else [])
    groups, seen, errors, duplicates = defaultdict(list), set(), [], 0
    receipt_paths = set()
    for path in paths:
        receipt_paths.update(path.parent.glob('*.receipt.json'))
        blob = path.read_bytes()
        digest = hashlib.sha256(blob).hexdigest()
        if digest in seen:
            duplicates += 1
            continue
        seen.add(digest)
        try:
            frame = pd.read_csv(path, keep_default_na=False, dtype=str)
            if frame.empty:
                raise ValueError('empty CSV')
            # A clean table is not a complete session snapshot.
            if not {'trial_type', 'trial_category'} & set(frame):
                raise ValueError('not a raw session snapshot')
            ids = column(frame, 'run_uuid').astype(str)
            ids = ids[ids.ne('')].unique()
            if len(ids) > 1:
                raise ValueError('multiple run identifiers in one file')
            key = ('run', ids[0]) if len(ids) else ('legacy', digest)
            groups[key].append(dict(path=path, frame=frame, sha256=digest,
                                    bytes=len(blob), kind=_kind(path, frame)))
        except Exception as error:
            errors.append(dict(source=path, kind='CSV input', error_type=type(error).__name__))
    receipts = []
    for path in sorted(receipt_paths):
        try:
            record = json.loads(path.read_text())
            if isinstance(record.get('receipt'), dict):
                record = dict(record, **record['receipt'])
            receipts.append(dict(path=path, record=record))
        except Exception as error:
            errors.append(dict(source=path, kind='Receipt input', error_type=type(error).__name__))
    sessions = []
    for candidates in groups.values():
        def rank(item):
            seq = pd.to_numeric(column(item['frame'], 'row_sequence'), errors='coerce')
            final = column(item['frame'], 'trial_category').eq('session_summary').any()
            return (int(final), number(seq.max(), 0), len(item['frame']), item['path'].stat().st_mtime_ns)
        selected = max(candidates, key=rank)
        run = value(selected['frame'], 'run_uuid')
        related = [r for r in receipts if (run and value(r['record'], 'run_uuid') == run)
                   or value(r['record'], 'filename') == selected['path'].name]
        sessions.append(dict(candidates=candidates, selected=selected, receipts=related))
    return dict(sessions=sessions, errors=errors, duplicate_copies=duplicates,
                n_unique_csv=len(seen), n_receipts=len(receipts))


def _masks(frame):
    kind, phase, category = column(frame, 'trial_type'), column(frame, 'task_phase'), column(frame, 'trial_category')
    screen = phase.eq('memory_screening') | column(frame, 'memory_screening').map(truth).eq(True) | category.str.startswith('memory_screening_')
    practice = pd.to_numeric(column(frame, 'practice_no'), errors='coerce')
    return {
        'main_encoding': kind.eq('trial') & practice.eq(0) & ~screen,
        'main_memory_pairs': kind.eq('memory-task') & ~screen,
        'screen_encoding': screen & (kind.eq('trial') | category.eq('memory_screening_encoding')),
        'screen_order': screen & (kind.eq('memory-screening-order') | category.eq('memory_screening_order')),
        'demographics': kind.eq('survey-demo'),
        'mouse_trajectories': column(frame, 'mt_row').eq('trajectory'),
        'mouse_summary': column(frame, 'mt_row').eq('summary'),
        'comprehension': kind.str.contains('comprehension', case=False),
        'instructions': kind.eq('instructions'),
        'response_events': category.eq('response_event'),
        'interaction_events': category.eq('interaction_event'),
        'save_events': category.eq('save_event'),
    }


def _screen_check(enc, order):
    items = {int(number(row.get('screening_trial', row.get('trial')))): row.get('stim_img')
             for row in enc.to_dict('records') if np.isfinite(number(row.get('screening_trial', row.get('trial'))))}
    correct, valid, endpoints = 0, True, []
    for row in order.to_dict('records'):
        a, b = number(row.get('item1_trial')), number(row.get('item2_trial'))
        if not np.isfinite(a) or not np.isfinite(b) or a != int(a) or b != int(b) or int(a) not in items or int(b) not in items:
            valid = False
            continue
        a, b = int(a), int(b)
        endpoints.extend([a, b])
        earlier = items[min(a, b)]
        images = {row.get('left_img'), row.get('right_img')}
        if images != {items[a], items[b]}:
            valid = False
        side = row.get('order_choice_side')
        chosen = row.get('left_img') if side == 'left' else row.get('right_img') if side == 'right' else None
        verified = bool(chosen and chosen == earlier and truth(row.get('timed_out')) is not True)
        correct += int(verified)
        saved = number(row.get('order_correct_bin'))
        if np.isfinite(saved) and bool(saved) != verified:
            valid = False
    return correct, valid, sorted(endpoints)


def audit_samples(loaded, contract=None):
    contract = runtime_contract() if contract is None else contract
    checks, summaries, coverage, snapshots = [], [], [], []
    for index, bundle in enumerate(loaded['sessions'], 1):
        session = f'Session {index:03d}'
        chosen = bundle['selected']; frame = chosen['frame']; masks = _masks(frame)
        summary = frame[column(frame, 'trial_category').eq('session_summary')]
        schema = value(frame, 'data_schema_version', 'legacy')
        current = schema == SCHEMA_VERSION
        outcome = value(summary, 'outcome', 'interrupted' if current else 'legacy')
        def check(name, passed, detail, severity='fail'):
            checks.append(dict(session=session, check=name, status='pass' if passed else severity, detail=str(detail)))
        counts = {key: int(mask.sum()) for key, mask in masks.items()}
        check('Current schema available', current, schema, 'unverified')
        if current:
            missing = [f for f in COMMON_FIELDS if f not in frame or column(frame, f).astype(str).eq('').any()]
            check('Common fields populated', not missing, ', '.join(missing) if missing else 'All common fields present')
            check('Schema version consistent', set(column(frame, 'data_schema_version')) == {SCHEMA_VERSION},
                  'Every row uses the same current schema')
            seq = pd.to_numeric(column(frame, 'row_sequence'), errors='coerce')
            expected_seq = np.arange(1, len(frame) + 1)
            check('Row sequence complete and ordered', np.array_equal(seq.to_numpy(), expected_seq), f'{len(frame)} rows')
            ids = column(frame, 'row_uuid').astype(str)
            check('Row identifiers unique', ids.ne('').all() and not ids.duplicated().any(), f'{ids.duplicated().sum()} duplicates')
            elapsed = pd.to_numeric(column(frame, 'elapsed_ms'), errors='coerce')
            check('Elapsed times ordered', elapsed.notna().all() and elapsed.ge(0).all() and elapsed.diff().dropna().ge(-.01).all(), 'Monotonic elapsed recording clock')
            utc = pd.to_datetime(column(frame, 'utc_timestamp'), utc=True, errors='coerce', format='mixed')
            check('UTC timestamps parse', utc.notna().all(), f'{utc.isna().sum()} invalid timestamps')
            repeated = []
            immutable_fields = {'design_manifest_json', 'mt_geometry_json', 'stimulus_block_orders',
                                'memory_screening_drone_positions_json', 'memory_screening_bag_positions_json',
                                'memory_screening_drone_directions_json', 'memory_screening_supply_directions_json',
                                'memory_screening_items_json', 'memory_screening_pairs_json'}
            for name in immutable_fields & set(frame):
                entries = frame[name].astype(str)
                large = entries[entries.str.len().gt(512)]
                if large.duplicated().any():
                    repeated.append(name)
            check('Large immutable payloads stored once', not repeated,
                  ', '.join(repeated) if repeated else 'No repeated large design JSON values', 'warn')
            check('Session summary unique', len(summary) == 1, f'{len(summary)} summary records', 'warn' if outcome == 'interrupted' else 'fail')
            check('Session manifest unique', column(frame, 'trial_category').eq('session_manifest').sum() == 1,
                  'One session manifest is expected after consent')
            check('Design manifest present', column(frame, 'trial_category').eq('design_manifest').any(),
                  'Immutable design material is recorded once per design')
            # Stable observation fields should agree where checkpoint snapshots overlap.
            stable = ['trial_type', 'trial_category', 'task_phase', 'trial', 'block', 'stim_img', 'drone_position',
                      'bag_position', 'order_choice_side', 'placement_slider_value', 'samples', 'events']
            observations = defaultdict(set)
            for snapshot in bundle['candidates']:
                for row in snapshot['frame'].to_dict('records'):
                    key = row.get('row_uuid')
                    if key:
                        observations[key].add(json.dumps({f: row.get(f, '') for f in stable}, sort_keys=True))
            conflicts = sum(len(versions) > 1 for versions in observations.values())
            check('Overlapping snapshots agree', conflicts == 0, f'{conflicts} conflicting observation records')
        complete = outcome in {'completed', 'module_completed'}
        full = outcome == 'completed'
        screened = outcome == 'memory_screened_out'
        screen_enabled = truth(value(frame, 'memory_screening_enabled')) is True
        mouse_enabled = truth(value(frame, 'mouse_qc_enabled')) is True
        pilot = truth(value(frame, 'pilot_mode')) is True
        audit_full = truth(value(frame, 'audit_full')) is True
        expected = {
            'main_encoding': contract['main_encoding'] if full else 0 if screened or complete else None,
            'main_memory_pairs': contract['main_memory_pairs'] if full else 0 if screened or complete else None,
            'screen_encoding': contract['screen_encoding'] if screen_enabled and (complete or screened) else 0 if not screen_enabled and current else None,
            'screen_order': contract['screen_order'] if screen_enabled and (complete or screened) else 0 if not screen_enabled and current else None,
            'demographics': 1 if complete else 0 if screened else None,
            'mouse_trajectories': contract['mouse_trajectories'] if mouse_enabled and complete else 0 if screened or (not mouse_enabled and current) else None,
            'mouse_summary': 1 if mouse_enabled and complete else 0 if screened or (not mouse_enabled and current) else None,
        }
        mouse_status = value(frame.loc[masks['mouse_summary']], 'mt_status')
        if complete and truth(value(frame, 'dev_mode')) is True:
            declared_mouse = number(value(summary, 'expected_mouse_trajectories'))
            if np.isfinite(declared_mouse):
                expected['mouse_summary'] = int(declared_mouse > 0)
        for stage, target in expected.items():
            declared = number(value(summary, 'expected_' + stage))
            if complete and truth(value(frame, 'dev_mode')) is True and np.isfinite(declared):
                target = int(declared)
            observed = counts[stage]
            status = 'unverified' if not current or target is None else 'pass' if observed == target else 'fail'
            if stage == 'mouse_trajectories' and mouse_status in {'skipped', 'incomplete', 'unsupported'} and complete:
                status = 'warn' if observed <= contract['mouse_trajectories'] else 'fail'
            coverage.append(dict(session=session, module=stage, expected=target, observed=observed, status=status))
            if current and target is not None:
                check('Record count ' + stage.replace('_', ' '), status == 'pass', f'Observed {observed}; expected {target}', status)
                if np.isfinite(declared):
                    check('Declared expectation ' + stage.replace('_', ' '), declared == target,
                          f'Summary {declared:g}; route reference {target:g}')
        if current and full:
            check('Comprehension complete', column(frame.loc[masks['comprehension']], 'done').map(truth).eq(True).any(), 'At least one completed comprehension record')
            check('Instruction history present', counts['instructions'] > 0 and 'view_history' in frame, f'{counts["instructions"]} instruction records')
            check('Production does not bypass screening', not audit_full or pilot, 'Audit continuation is restricted to pilot mode')
            if truth(value(frame, 'mouse_qc_requested')) is True:
                check('Requested mouse module enabled', mouse_enabled, 'Requested module did not silently become disabled')
            if truth(value(frame, 'memory_screening_requested')) is True:
                check('Requested screen module enabled', screen_enabled, 'Requested module did not silently become disabled')
        if current and len(summary):
            for stage in ['main_encoding', 'main_memory_pairs', 'screen_encoding', 'screen_order',
                          'mouse_trajectories', 'demographics']:
                saved_count = number(value(summary, 'observed_' + stage))
                if np.isfinite(saved_count):
                    check('Summary observed ' + stage.replace('_', ' '), saved_count == counts[stage],
                          f'Summary {saved_count:g}; raw records {counts[stage]}')
        if current and counts['instructions']:
            valid_views = True; n_views = 0
            for raw_history in column(frame.loc[masks['instructions']], 'view_history'):
                history = decoded(raw_history)
                if not isinstance(history, list):
                    valid_views = False
                    continue
                for view in history:
                    n_views += 1
                    if not isinstance(view, dict):
                        valid_views = False
                        continue
                    valid_views &= bool(number(view.get('viewing_time'), -1) >= 0 and
                                        number(view.get('page_index'), -1) >= 0)
            check('Instruction views readable', valid_views and n_views > 0, f'{n_views} page view records')
        enc = frame.loc[masks['main_encoding']]
        manifests = frame[column(frame, 'trial_category').eq('design_manifest')]
        main_manifest = next((decoded(row.get('design_manifest_json'), {})
                              for row in manifests.to_dict('records') if row.get('design_id') == 'main_task'), {})
        if len(enc):
            imgs = column(enc, 'stim_img')
            check('Main identities unique', imgs.ne('').all() and not imgs.duplicated().any(), f'{imgs.nunique()} distinct items')
            check('Main stimulus pool valid', set(imgs) <= set(contract['main_pool']), 'Current experimental image pool', 'warn' if not current else 'fail')
            if current:
                check('Encoding completion field present', 'completed' in enc and column(enc, 'completed').astype(str).ne('').all(), 'Distinguishes missing responses from completed trials')
                check('Main design manifest readable', bool(main_manifest) and
                      all(key in main_manifest for key in ['drone_positions', 'supply_positions', 'stimulus_block_orders']),
                      'Geometry arrays and item assignments are available for reconstruction')
                if full:
                    coordinates = list(zip(pd.to_numeric(column(enc, 'block'), errors='coerce'),
                                           pd.to_numeric(column(enc, 'trial'), errors='coerce')))
                    expected_coordinates = [(b, t) for b in range(1, contract['main_blocks'] + 1)
                                            for t in range(1, contract['main_trials_per_block'] + 1)]
                    check('Main encoding coordinates complete', sorted(coordinates) == expected_coordinates,
                          'Each expected block and trial occurs once')
                if main_manifest:
                    arrays = main_manifest.get('drone_positions'), main_manifest.get('supply_positions')
                    images = main_manifest.get('stimulus_block_orders')
                    geometry_ok, identities_ok = True, True
                    for row in enc.to_dict('records'):
                        try:
                            canonical = int(number(row.get('canonical_design_idx', row.get('design_idx'))))
                            trial = int(number(row.get('trial'))) - 1
                            display = int(number(row.get('display_block', row.get('block')))) - 1
                            if canonical < 0 or trial < 0 or display < 0:
                                raise ValueError('invalid coordinate')
                            geometry_ok &= bool(np.isclose(number(row.get('drone_position')), arrays[0][canonical][trial]) and
                                                np.isclose(number(row.get('bag_position')), arrays[1][canonical][trial]))
                            block_images = images[display].split('|') if isinstance(images[display], str) else images[display]
                            identities_ok &= row.get('stim_img') == block_images[trial]
                        except (ValueError, TypeError, IndexError, KeyError):
                            geometry_ok = identities_ok = False
                    check('Main geometry matches saved design', geometry_ok, 'Canonical condition and serial position map to saved arrays')
                    check('Main identities match saved order', identities_ok, 'Display block and serial position map to saved image order')
        for field, calculated in [('total_score', pd.to_numeric(column(enc, 'score'), errors='coerce').sum()),
                                  ('total_supply_caught', pd.to_numeric(column(enc, 'supply_caught'), errors='coerce').sum())]:
            saved = number(value(summary, field, value(frame, field)))
            if np.isfinite(saved):
                check('Main only ' + field.replace('_', ' '), np.isclose(saved, calculated), f'Recorded {saved:g}; reconstructed {calculated:g}')
        screen_enc = frame.loc[masks['screen_encoding']]; screen_order = frame.loc[masks['screen_order']]
        if current and full and counts['main_memory_pairs']:
            memory = frame.loc[masks['main_memory_pairs']]
            keys = list(zip(pd.to_numeric(column(memory, 'block'), errors='coerce'),
                            pd.to_numeric(column(memory, 'pair_index'), errors='coerce')))
            expected_keys = [(b, p) for b in range(1, contract['main_blocks'] + 1)
                             for p in range(1, contract['main_pairs_per_block'] + 1)]
            check('Main memory coordinates complete', sorted(keys) == expected_keys,
                  'Each expected block and pair occurs once')
            skipped = column(memory, 'skipped_pair').map(truth).eq(True)
            minimum_events = 3 * int((~skipped).sum()) + int(skipped.sum())
            check('Main response events present', counts['response_events'] >= minimum_events,
                  f'{counts["response_events"]} stage response events for {len(memory)} pairs', 'warn')
        if len(screen_enc) or len(screen_order):
            correct, valid, endpoints = _screen_check(screen_enc, screen_order)
            finished = len(screen_enc) == contract['screen_encoding'] and len(screen_order) == contract['screen_order']
            if finished:
                check('Screen encoding completed', pd.to_numeric(column(screen_enc, 'completed'), errors='coerce').eq(1).all(),
                      'All twenty encoding records finished before criterion evaluation')
                serials = pd.to_numeric(column(screen_enc, 'screening_trial', None), errors='coerce')
                if serials.isna().all():
                    serials = pd.to_numeric(column(screen_enc, 'trial'), errors='coerce')
                check('Screen encoding identifiers complete', sorted(serials.tolist()) == list(range(1, contract['screen_encoding'] + 1)),
                      'Each screening encoding serial occurs once')
                pair_ids = pd.to_numeric(column(screen_order, 'pair_index'), errors='coerce').tolist()
                check('Screen question identifiers complete', sorted(pair_ids) == list(range(1, contract['screen_order'] + 1)),
                      'Each screening question occurs once')
                check('Screen answer keys reconstruct', valid and endpoints == list(range(1, contract['screen_encoding'] + 1)), f'{correct} independently verified correct')
                passed = correct >= contract['screen_min_correct']
                saved = truth(value(frame, 'memory_screening_passed'))
                check('Screen criterion agrees', saved is passed, f'{correct} of {contract["screen_order"]}; threshold {contract["screen_min_correct"]}')
                check('Screen continuation agrees', (complete and (passed or (pilot and audit_full))) or (screened and not passed) or outcome not in {'completed', 'memory_screened_out'}, 'Pilot audit continuation does not change the saved criterion')
            saved_screen = frame[column(frame, 'trial_category').eq('memory_screening_summary')]
            saved_drone = decoded(value(saved_screen, 'memory_screening_drone_positions_json'))
            saved_supply = decoded(value(saved_screen, 'memory_screening_bag_positions_json'))
            if isinstance(saved_drone, list) and isinstance(saved_supply, list):
                geometry_ok = len(saved_drone) == len(saved_supply) == contract['screen_encoding']
                for row in screen_enc.to_dict('records'):
                    try:
                        serial = number(row.get('screening_trial', row.get('trial')))
                        if serial != int(serial) or not 1 <= serial <= contract['screen_encoding']:
                            raise ValueError('invalid serial')
                        geometry_ok &= bool(np.isclose(number(row.get('drone_position')), saved_drone[int(serial)-1]) and
                                            np.isclose(number(row.get('bag_position')), saved_supply[int(serial)-1]))
                    except (ValueError, TypeError, IndexError):
                        geometry_ok = False
                check('Screen geometry matches saved design', geometry_ok, 'Encoding positions match that session’s saved arrays')
            overlap = set(column(screen_enc, 'stim_img')) & set(column(enc, 'stim_img')) - {''}
            check('Screen and main items separate', not overlap, f'{len(overlap)} shared identities')
        for responses in column(frame.loc[masks['demographics']], 'responses'):
            answers = decoded(responses, {})
            if current:
                check('Race selections preserve arrays', isinstance(answers, dict) and isinstance(answers.get('race'), list), 'Repeated checkbox selections remain an array')
        trajectories = frame.loc[masks['mouse_trajectories']]
        sample_valid = True; truncated = 0; mouse_geometry_ok = True
        mouse_geometry = decoded(value(frame.loc[masks['mouse_summary']], 'mt_geometry_json'))
        for row in trajectories.to_dict('records'):
            samples = decoded(row.get('samples'), None); events = decoded(row.get('events'), None)
            if not isinstance(samples, list) or not isinstance(events, list):
                sample_valid = False
                continue
            try:
                times = np.asarray([sample[0] for sample in samples], dtype=float)
                valid = all(len(sample) >= 4 for sample in samples) and np.isfinite(times).all() and np.all(times >= -.1) and np.all(np.diff(times) >= -.1)
                sample_valid &= valid and number(row.get('n_samples')) == len(samples)
            except (TypeError, ValueError, IndexError):
                sample_valid = False
            truncated += truth(row.get('samples_truncated')) is True
            if mouse_geometry:
                try:
                    serial = int(number(row.get('trajectory_id'))) - 1
                    if serial < 0 or serial >= len(mouse_geometry['targets']):
                        raise ValueError('invalid trajectory')
                    start = mouse_geometry['start'] if serial == 0 else mouse_geometry['targets'][serial-1]
                    end = mouse_geometry['targets'][serial]
                    mouse_geometry_ok &= all(np.isclose(number(row.get('target_' + which + '_' + axis)), point[axis])
                                             for which, point in [('start', start), ('end', end)] for axis in ['x', 'y'])
                except (ValueError, TypeError, IndexError, KeyError):
                    mouse_geometry_ok = False
        if len(trajectories):
            check('Mouse samples readable and ordered', sample_valid, f'{len(trajectories)} trajectories inspected')
            check('Mouse samples not truncated', truncated == 0, f'{truncated} truncated trajectories', 'warn')
            if current:
                trajectory_ids = pd.to_numeric(column(trajectories, 'trajectory_id'), errors='coerce')
                check('Mouse trajectory identifiers unique', trajectory_ids.notna().all() and not trajectory_ids.duplicated().any(),
                      'Each persisted trajectory occurs once')
                check('Mouse geometry matches saved design', bool(mouse_geometry) and mouse_geometry_ok,
                      'Target coordinates match the saved module geometry')
        # Delivery is separate from content validity. A client side sidecar is
        # inspectable evidence of the response, not independent server attestation.
        delivery = 'not_observed'; receipt_match = None
        receipts = [r['record'] for r in bundle['receipts']
                    if truth(value(r['record'], 'is_final')) is True
                    and (value(r['record'], 'filename') == chosen['path'].name or
                         value(r['record'], 'payload_sha256') == chosen['sha256'])]
        if not receipts:
            related_final = [r['record'] for r in bundle['receipts'] if truth(value(r['record'], 'is_final')) is True]
            if len(related_final) == 1 and chosen['kind'] == 'final':
                receipts = related_final
        if receipts:
            receipt = receipts[-1]
            expected_filename = 'drone_task_' + str(value(frame, 'run_uuid')) + '_final.csv'
            receipt_match = (value(receipt, 'filename') == expected_filename and
                             value(receipt, 'payload_sha256') == chosen['sha256'] and
                             number(value(receipt, 'payload_bytes')) == chosen['bytes'] and
                             number(value(receipt, 'row_count')) == len(frame))
            check('Receipt matches exact snapshot', receipt_match, 'SHA256, bytes, row count and filename')
            disposition = value(receipt, 'disposition')
            delivery = 'receipt_mismatch' if not receipt_match else 'server_acknowledged' if truth(value(receipt, 'acknowledged')) is True and disposition == 'uploaded' else 'local_copy_offered' if disposition == 'downloaded' else 'not_acknowledged'
            if disposition == 'uploaded' and truth(value(receipt, 'acknowledged')) is True and 'session_closed' in receipt:
                check('Final server session closed', truth(value(receipt, 'session_closed')) is True,
                      'Final upload acknowledgement is followed by session closure')
        elif current and complete:
            check('Final receipt available', False, 'Optional sidecar not supplied; cloud delivery cannot be independently checked here', 'unverified')
        for k, snapshot in enumerate(bundle['candidates'], 1):
            snapshots.append(dict(session=session, snapshot=f'Snapshot {k:02d}', kind=snapshot['kind'],
                                  selected=snapshot is chosen, rows=len(snapshot['frame']), bytes=snapshot['bytes']))
        session_checks = [c for c in checks if c['session'] == session]
        n_fail = sum(c['status'] == 'fail' for c in session_checks)
        n_warn = sum(c['status'] == 'warn' for c in session_checks)
        status = 'legacy' if not current else 'issues_found' if n_fail else 'interrupted' if outcome == 'interrupted' else 'content_verified'
        summaries.append(dict(session=session, schema='current' if current else 'legacy', outcome=outcome,
                              content_status=status, rows=len(frame), bytes=chosen['bytes'],
                              snapshots=len(bundle['candidates']), selected_kind=chosen['kind'],
                              delivery=delivery, n_fail=n_fail, n_warn=n_warn))
    return dict(sessions=pd.DataFrame(summaries, columns=['session','schema','outcome','content_status','rows','bytes',
                    'snapshots','selected_kind','delivery','n_fail','n_warn']),
                checks=pd.DataFrame(checks, columns=['session','check','status','detail']),
                coverage=pd.DataFrame(coverage, columns=['session','module','expected','observed','status']),
                snapshots=pd.DataFrame(snapshots, columns=['session','snapshot','kind','selected','rows','bytes']),
                inventory=pd.DataFrame([dict(unique_csv=loaded['n_unique_csv'],
                    exact_copies_ignored=loaded['duplicate_copies'], receipts=loaded['n_receipts'],
                    read_errors=len(loaded['errors']), sessions=len(loaded['sessions']))]),
                input_errors=pd.DataFrame([dict(input=f'Input {i:03d}', kind=error['kind'], error_type=error['error_type'])
                                           for i, error in enumerate(loaded['errors'], 1)],
                                          columns=['input', 'kind', 'error_type']),
                contract=contract)


def export_report(report, output=DEFAULT_OUTPUT):
    output = Path(output); output.mkdir(parents=True, exist_ok=True)
    names = []
    for key in ['inventory', 'sessions', 'checks', 'coverage', 'snapshots', 'input_errors']:
        report[key].to_csv(output / f'{key}.csv', index=False)
        names.append(f'{key}.csv')
    return names


def make_synthetic_cases(contract, directory):
    """Write labelled diagnostic fixtures only into a caller owned temporary directory.

    Values use the current source material with deterministic synthetic answers.
    They never represent a participant, observed pass rate or production save.
    """
    import copy
    from datetime import datetime, timedelta, timezone

    directory = Path(directory); directory.mkdir(parents=True, exist_ok=True)
    screen = contract['screen_design']
    cases = ['Complete with receipt', 'Screening exit', 'Interrupted session',
             'Duplicate record', 'Changed receipt', 'Pilot audit continuation']
    outputs = []
    for case_index, case in enumerate(cases):
        run = f'syntheticrun{case_index + 1:02d}'
        screenout = case == 'Screening exit'
        override = case == 'Pilot audit continuation'
        correct_count = 4 if screenout or override else 8
        metadata = dict(data_schema_version=SCHEMA_VERSION, run_uuid=run,
                        pilot_mode=True, audit_full=override, memory_screening_enabled=True,
                        mouse_qc_enabled=True, memory_screening_passed=correct_count >= contract['screen_min_correct'])
        rows = []
        def add(row):
            n = len(rows) + 1
            when = datetime(2026, 10, 26, 12, tzinfo=timezone.utc) + timedelta(milliseconds=100 * n)
            rows.append(dict(metadata, row_uuid=f'{run}row{n:04d}', row_sequence=n,
                             elapsed_ms=100 * n, utc_timestamp=when.isoformat(), **row))
        add(dict(trial_type='call-function', trial_category='session_manifest', task_phase='setup',
                 expected_main_encoding=contract['main_encoding'], expected_main_memory_pairs=contract['main_memory_pairs']))
        add(dict(trial_type='call-function', trial_category='design_manifest', task_phase='setup',
                 design_id='main_task', design_manifest_json=json.dumps({
                     'drone_positions': contract['main_drone_positions'],
                     'supply_positions': contract['main_supply_positions'],
                     'stimulus_block_orders': [contract['main_pool'][i*50:(i+1)*50] for i in range(contract['main_blocks'])]})))
        add(dict(trial_type='instructions', task_phase='instructions', view_history=json.dumps([
            {'page_index': 0, 'viewing_time': 800}, {'page_index': 1, 'viewing_time': 1100}]), rt=1900))
        add(dict(trial_type='comprehension1', task_phase='comprehension', done=True,
                 responses=json.dumps(['True']), correctness_responses='[1]', attempts=1))
        for n, item in enumerate(screen['items'], 1):
            add(dict(trial_type='trial', trial_category='memory_screening_encoding', task_phase='memory_screening',
                     screening_trial=n, trial=n, practice_no=0, completed=1, stim_img=item['img'],
                     drone_position=screen['drone_positions'][n-1], bag_position=screen['bag_positions'][n-1]))
        for n, pair in enumerate(screen['pairs'], 1):
            side = pair['correct_side'] if n <= correct_count else 'left' if pair['correct_side'] == 'right' else 'right'
            add(dict(trial_type='memory-screening-order', trial_category='memory_screening_order', task_phase='memory_screening',
                     pair_index=n, item1_trial=pair['item1_trial'], item2_trial=pair['item2_trial'],
                     left_img=pair['left_img'], right_img=pair['right_img'], order_choice_side=side,
                     order_correct_bin=int(n <= correct_count), order_rt=700, timed_out=False))
        add(dict(trial_type='call-function', trial_category='memory_screening_summary', task_phase='memory_screening',
                 memory_screening_n_correct=correct_count, memory_screening_min_correct=contract['screen_min_correct'],
                 memory_screening_drone_positions_json=json.dumps(screen['drone_positions']),
                 memory_screening_bag_positions_json=json.dumps(screen['bag_positions'])))
        if not screenout:
            for block in range(1, contract['main_blocks'] + 1):
                for trial in range(1, contract['main_trials_per_block'] + 1):
                    idx = (block-1)*contract['main_trials_per_block'] + trial-1
                    add(dict(trial_type='trial', task_phase='encoding', practice_no=0, completed=1,
                             block=block, trial=trial, stim_img=contract['main_pool'][idx],
                             canonical_design_idx=block-1, display_block=block,
                             drone_position=contract['main_drone_positions'][block-1][trial-1],
                             bag_position=contract['main_supply_positions'][block-1][trial-1],
                             score=0, supply_caught=10))
                for pair_index, pair in enumerate(contract['main_pairs'], 1):
                    for stage in ['order', 'distance', 'placement']:
                        add(dict(trial_type='record-event', trial_category='response_event', task_phase='memory',
                                 block=block, pair_index=pair_index, response_stage=stage,
                                 stage_timed_out=False, submitted_rt=900))
                    add(dict(trial_type='memory-task', task_phase='memory', block=block, pair_index=pair_index,
                             trial1_index=pair[0], trial2_index=pair[1], order_correct_bin=1,
                             distance_attempt_number=1, timed_out=False, skipped_pair=False))
            for i, target in enumerate(contract['mouse_geometry']['targets'], 1):
                start = contract['mouse_geometry']['start'] if i == 1 else contract['mouse_geometry']['targets'][i-2]
                add(dict(trial_type='mouse-trajectory', task_phase='mouse_qc', mt_row='trajectory',
                         trajectory_id=i, trajectory_completed=True, samples_truncated=False, n_samples=3,
                         target_start_x=start['x'], target_start_y=start['y'], target_end_x=target['x'], target_end_y=target['y'],
                         samples=json.dumps([[0, .5, .5, 0], [10, .55, .5, 0], [20, target['x'], target['y'], 0]]),
                         events=json.dumps([[0, .5, .5, 'down_start', 0, 'mouse'], [25, target['x'], target['y'], 'down_hit', 0, 'mouse']])))
            add(dict(trial_type='mouse-trajectory', task_phase='mouse_qc', mt_row='summary', mt_status='completed',
                     mt_n_trajectories_completed=contract['mouse_trajectories'],
                     mt_geometry_json=json.dumps(contract['mouse_geometry'])))
            add(dict(trial_type='survey-demo', task_phase='demographics',
                     responses=json.dumps({'age': '30', 'race': ['Asian', 'White']}), rt=5000))
        add(dict(trial_type='record-event', trial_category='interaction_event', task_phase='saving', event='focus'))
        add(dict(trial_type='record-event', trial_category='save_event', task_phase='saving', save_reason='final_requested'))
        add(dict(trial_type='record-event', trial_category='session_summary', task_phase='saving',
                 outcome='memory_screened_out' if screenout else 'completed',
                 exit_reason='memory_criterion' if screenout else 'task_completed',
                 expected_main_encoding=0 if screenout else contract['main_encoding'],
                 expected_main_memory_pairs=0 if screenout else contract['main_memory_pairs'],
                 expected_screen_encoding=contract['screen_encoding'], expected_screen_order=contract['screen_order'],
                 expected_mouse_trajectories=0 if screenout else contract['mouse_trajectories'],
                 expected_demographics=0 if screenout else 1))
        if case == 'Interrupted session':
            rows = rows[:80]
        if case == 'Duplicate record':
            rows.insert(10, copy.deepcopy(rows[9]))
        path = directory / f'drone_task_{run}_final.csv'
        pd.DataFrame(rows).to_csv(path, index=False)
        blob = path.read_bytes()
        if case == 'Complete with receipt':
            # One partial checkpoint plus one exact copy exercise reconciliation.
            pd.DataFrame(rows[:60]).to_csv(directory / f'drone_task_{run}_checkpoint.csv', index=False)
            (directory / f'drone_task_{run}_final_copy.csv').write_bytes(blob)
        receipt = dict(run_uuid=run, filename=path.name, payload_sha256=hashlib.sha256(blob).hexdigest(),
                       payload_bytes=len(blob), row_count=len(rows), acknowledged=True,
                       disposition='uploaded', is_final=True, attempts=1)
        if case == 'Changed receipt':
            receipt['payload_sha256'] = '0' * 64
        if case not in {'Interrupted session'}:
            path.with_suffix('.receipt.json').write_text(json.dumps(receipt))
        outputs.append(dict(case=case, source=path))
    return outputs


def main():
    parser = argparse.ArgumentParser(description='Audit raw task CSV snapshots and optional receipt sidecars')
    parser.add_argument('inputs', nargs='*', type=Path, help='Raw CSV files or directories')
    parser.add_argument('--output', type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    report = audit_samples(load_samples(args.inputs or DEFAULT_INPUTS))
    print(report['inventory'].to_string(index=False))
    if len(report['input_errors']):
        print(report['input_errors'].to_string(index=False))
    if len(report['sessions']):
        print(report['sessions'].to_string(index=False))
    else:
        print('No readable raw session snapshots are available.')
    export_report(report, args.output)
    print('Audit tables exported to the configured private output directory.')


if __name__ == '__main__':
    main()
