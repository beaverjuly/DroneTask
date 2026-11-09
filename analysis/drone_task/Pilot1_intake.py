"""Private, read only reconciliation of one Prolific collection and Pavlovia.

Original platform downloads and task snapshots are never rewritten.  A task
run, a cumulative snapshot, and a Prolific submission are different units.
This module keeps all three visible and makes no payment or rejection action.
Only ordinal labels should be used in shared reports; exported review tables
contain private join keys and must remain in the ignored data directory.
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT / 'analysis') not in sys.path:
    sys.path.insert(0, str(ROOT / 'analysis'))
from session_io import load_module_tables


def _audit_module():
    spec = importlib.util.spec_from_file_location(
        '_Pilot1_saving_audit', ROOT / 'design_checks/scripts/data_saving_audit.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _text(value):
    if value is None or pd.isna(value):
        return ''
    answer = str(value).strip()
    return '' if answer.lower() in {'nan', 'none', 'null', '<na>'} else answer


def _key(value):
    return re.sub(r'[^a-z0-9]', '', str(value).lower())


def _truth(value):
    return {'true': True, '1': True, '1.0': True,
            'false': False, '0': False, '0.0': False}.get(_text(value).lower())


def _column(frame, name):
    return frame[name] if name in frame else pd.Series('', index=frame.index, dtype=object)


def _last(frame, name):
    values = _column(frame, name).map(_text)
    values = values[values.ne('')]
    return values.iloc[-1] if len(values) else ''


def _status(value):
    values = {'awaitingreview': 'AWAITING REVIEW', 'approved': 'APPROVED',
              'returned': 'RETURNED', 'timedout': 'TIMED-OUT',
              'rejected': 'REJECTED', 'active': 'ACTIVE', 'reserved': 'RESERVED',
              'screenedout': 'SCREENED OUT'}
    return values.get(_key(value), _text(value).upper())


def read_prolific_exports(directory):
    """Combine explicitly supplied exports without silently resolving conflicts.

    Multiple exports may repeat the same submission. Matching fields must
    agree. Conflicting statuses or IDs remain explicit review issues, rather
    than preferring whichever file happened to sort last.
    """
    directory = Path(directory)
    aliases = {
        'participantid': 'participant_id', 'prolificid': 'participant_id',
        'prolificparticipantid': 'participant_id', 'participantprolificid': 'participant_id',
        'submissionid': 'submission_id', 'sessionid': 'submission_id',
        'status': 'prolific_status', 'submissionstatus': 'prolific_status',
        'studyid': 'study_id', 'completioncode': 'completion_code',
        'enteredcode': 'completion_code', 'timetaken': 'time_taken',
        'startedat': 'started_at', 'completedat': 'completed_at',
    }
    observations, inputs, issues, seen = [], [], [], set()
    for path in sorted(directory.rglob('*.csv')) if directory.exists() else []:
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        inputs.append(dict(path=str(path.resolve()), sha256=digest, bytes=path.stat().st_size))
        if digest in seen:
            continue
        seen.add(digest)
        frame = pd.read_csv(path, dtype=str, keep_default_na=False)
        rename = {c: aliases.get(_key(c), _key(c)) for c in frame}
        if len(set(rename.values())) != len(rename):
            raise ValueError('A Prolific export has ambiguous normalized column names')
        frame = frame.rename(columns=rename)
        if 'participant_id' not in frame:
            issues.append(dict(severity='error', check='unrecognized_prolific_export',
                               detail='A CSV lacks a recognized Participant ID column'))
            continue
        for source_row, row in enumerate(frame.to_dict('records'), 2):
            row = {key: _text(value) for key, value in row.items()}
            row['source_export'] = str(path.resolve())
            row['source_row'] = source_row
            row['prolific_status'] = _status(row.get('prolific_status'))
            observations.append(row)
    if not observations:
        raise FileNotFoundError('No recognizable Prolific export is available in this batch')
    raw = pd.DataFrame(observations).fillna('')
    # If one companion export omits Submission ID, a unique known ID for that
    # participant permits an explicit join. Multiple IDs never get collapsed.
    known = {pid: set(g.submission_id) - {''}
             for pid, g in raw.assign(submission_id=_column(raw, 'submission_id')).groupby('participant_id')}
    raw['submission_id'] = _column(raw, 'submission_id')
    raw['match_group'] = [row.submission_id or next(iter(known[row.participant_id]))
                         if len(known[row.participant_id]) == 1 else row.submission_id
                         for row in raw.itertuples()]
    raw.loc[raw.match_group.eq(''), 'match_group'] = 'participant:' + raw.loc[raw.match_group.eq(''), 'participant_id']
    rows = []
    for _, group in raw.groupby('match_group', sort=False):
        record, conflicts = {}, []
        for field in [c for c in raw if c not in {'source_export', 'source_row', 'match_group'}]:
            values = list(dict.fromkeys(group[field].map(_text)))
            values = [v for v in values if v]
            record[field] = values[0] if len(values) == 1 else ''
            if len(values) > 1:
                conflicts.append(field)
        record['export_conflict_fields'] = json.dumps(conflicts)
        record['export_conflict'] = bool(conflicts)
        record['source_exports_json'] = json.dumps(sorted(set(group.source_export)))
        record['export_observation_count'] = len(group)
        rows.append(record)
    submissions = pd.DataFrame(rows)
    submissions.insert(0, 'submission_label', [f'Submission {i + 1:03d}' for i in range(len(submissions))])
    return submissions, pd.DataFrame(inputs, columns=['path', 'sha256', 'bytes']), pd.DataFrame(issues, columns=['severity', 'check', 'detail'])


def _observed_metrics(tables, sid):
    def table(name):
        frame = tables[name]
        return frame.loc[_column(frame, 'session_id').eq(sid)].copy()
    enc, mem, demo = table('encoding'), table('memory'), table('demographics')
    events, comp = table('response_events'), table('comprehension')
    mouse, mouse_summary = table('mouse_trajectory'), table('mouse_summary')
    mouse_samples = pd.to_numeric(_column(mouse, 'n_samples'), errors='coerce')
    enc_trial = pd.to_numeric(_column(enc, 'trial'), errors='coerce')
    enc_block = pd.to_numeric(_column(enc, 'block'), errors='coerce')
    mem_pair = pd.to_numeric(_column(mem, 'pair_index'), errors='coerce')
    mem_block = pd.to_numeric(_column(mem, 'block'), errors='coerce')
    enc_keys = pd.DataFrame({'block': enc_block, 'trial': enc_trial})
    mem_keys = pd.DataFrame({'block': mem_block, 'pair': mem_pair})
    expected_enc = {(b, t) for b in range(1, 5) for t in range(1, 51)}
    expected_mem = {(b, p) for b in range(1, 5) for p in range(1, 15)}
    enc_coverage = len(enc) == 200 and set(enc_keys.itertuples(index=False, name=None)) == expected_enc
    mem_coverage = len(mem) == 56 and set(mem_keys.itertuples(index=False, name=None)) == expected_mem
    exposure = _column(enc, 'stim_display_outcome')
    visible = pd.to_numeric(_column(enc, 'stim_visible_duration_ms'), errors='coerce')
    requested = pd.to_numeric(_column(enc, 'stim_requested_elapsed_ms'), errors='coerce')
    moves = pd.to_numeric(_column(enc, 'num_moves'), errors='coerce')
    first_move = pd.to_numeric(_column(enc, 'rt_first_move_ms'), errors='coerce')
    counts = dict(encoding_rows=len(enc), memory_pair_rows=len(mem), demographics_rows=len(demo),
                  full_encoding_coverage=bool(enc_coverage), full_memory_coverage=bool(mem_coverage),
                  main_encoding_completed=int(pd.to_numeric(_column(enc, 'completed'), errors='coerce').eq(1).sum()),
                  unique_main_items=int(_column(enc, 'stim_img').replace('', pd.NA).nunique()),
                  item_presentation_requests=int(requested.notna().sum()),
                  item_visible_duration_records=int(visible.notna().sum()),
                  item_visible_duration_median_ms=float(visible.median()) if visible.notna().any() else np.nan,
                  item_fallback_count=int(exposure.eq('fallback_emoji').sum()),
                  item_unshown_count=int(exposure.isin(['not_presented', 'hidden', 'unresolved', 'pending', 'failed']).sum()),
                  collector_move_records=int(moves.notna().sum()),
                  collector_trials_with_movement=int(moves.gt(0).sum()),
                  collector_movement_trials_with_first_rt=int((moves.gt(0) & first_move.notna()).sum()),
                  inactivity_reminders=int(_column(enc, 'inactivity_warning_shown').map(_truth).eq(True).sum()),
                  response_event_rows=len(events), comprehension_rows=len(comp),
                  comprehension_done=bool(_column(comp, 'done').map(_truth).eq(True).any()),
                  mouse_trajectory_rows=len(mouse),
                  mouse_summary_status=_last(mouse_summary, 'mt_status'),
                  mouse_raw_move_samples=int(mouse_samples.sum()),
                  mouse_paths_with_pointer_samples=int(mouse_samples.gt(0).sum()),
                  mouse_paths_without_pointer_samples=int(mouse_samples.eq(0).sum()),
                  mouse_continuous_path_available=bool(len(mouse) and mouse_samples.ge(2).all()),
                  mouse_truncated_paths=int(_column(mouse, 'samples_truncated').map(_truth).eq(True).sum()),
                  screen_encoding_rows=len(table('memory_screening_encoding')),
                  screen_order_rows=len(table('memory_screening_order')))
    for stage, field in [('order', 'order_correct_bin'), ('distance', 'distance_estimate'), ('placement', 'placement_slider_value')]:
        value = pd.to_numeric(_column(mem, field), errors='coerce')
        valid = value.isin([0, 1]) if stage == 'order' else value.between(0, 100)
        omission = _column(mem, stage + '_final_omission').map(_truth).eq(True)
        counts[stage + '_answered'] = int((valid & ~omission).sum())
        counts[stage + '_final_omissions'] = int(omission.sum())
        stage_events = events.loc[_column(events, 'response_stage').eq(stage)]
        counts[stage + '_timeout_attempts'] = int(_column(stage_events, 'stage_timed_out').map(_truth).eq(True).sum())
    counts['full_observable_task'] = bool(enc_coverage and mem_coverage and len(demo) == 1)
    return counts


def _match_submission(info, submissions, study_id):
    pid = _text(info.get('participant_id')) or _text(info.get('PROLIFIC_PID'))
    submission = _text(info.get('SESSION_ID'))
    recorded_study = _text(info.get('STUDY_ID'))
    reason, selected = '', None
    if study_id and recorded_study != study_id:
        reason = 'study_id_missing' if not recorded_study else 'other_study'
    elif submission:
        candidates = submissions.loc[_column(submissions, 'submission_id').eq(submission)]
        if len(candidates) == 1 and _text(candidates.iloc[0].get('participant_id')) == pid:
            selected = candidates.iloc[0]
        elif len(candidates) == 1:
            reason = 'participant_submission_identity_conflict'
        else:
            reason = 'submission_not_in_export' if not len(candidates) else 'ambiguous_submission_export'
    else:
        candidates = submissions.loc[_column(submissions, 'participant_id').eq(pid)]
        if pid and len(candidates) == 1:
            selected = candidates.iloc[0]
            reason = 'participant_only_session_id_unrecorded'
        else:
            reason = 'participant_not_in_export' if not len(candidates) else 'ambiguous_participant_export'
    matched = selected is not None
    result = dict(match_status='matched' if matched and not reason else reason,
                  matched_to_prolific=matched,
                  prolific_submission_id=_text(selected.get('submission_id')) if matched else '',
                  prolific_participant_id=_text(selected.get('participant_id')) if matched else '',
                  submission_label=_text(selected.get('submission_label')) if matched else '',
                  prolific_status=_text(selected.get('prolific_status')) if matched else '',
                  prolific_export_conflict=bool(selected.get('export_conflict')) if matched else False)
    if matched:
        for field in ['started_at', 'completed_at', 'time_taken', 'completion_code',
                      'age', 'sex', 'ethnicitysimplified', 'countryofresidence',
                      'countryofbirth', 'nationality', 'language', 'studentstatus', 'employmentstatus']:
            result['prolific_' + field] = selected.get(field, '')
    return result


def load_Pilot1(batch_root, study_id=None, expected_awaiting=15, export=True):
    """Audit an isolated private batch and prepare transparent cohort decisions.

    This is not an auto approval/rejection procedure. ``approve_completed``
    means the saved record supports completed participation. Technical audit
    flags remain separate and do not turn poor memory into a payment failure.
    ``analysis_session_ids`` defines a matched production completion cohort;
    individual missing responses remain missing and retain their denominators.
    """
    batch = Path(batch_root).expanduser().resolve()
    raw_dir = batch / 'raw'
    if not raw_dir.exists():
        raise FileNotFoundError('Pilot1 task raw directory does not exist')
    submissions, prolific_sources, prolific_issues = read_prolific_exports(batch / 'source_exports/prolific')
    study_id = _text(study_id) or None
    if not study_id:
        exported_studies = set(_column(submissions, 'study_id').map(_text)) - {''}
        if len(exported_studies) == 1:
            study_id = next(iter(exported_studies))
        else:
            filename_studies = {match.group(1) for path in (batch / 'source_exports/prolific').glob('*.csv')
                                if (match := re.search(r'^prolific_export_([a-fA-F0-9]{24})(?:[_.(]|$)', path.name))}
            if len(filename_studies) == 1:
                study_id = next(iter(filename_studies))
            else:
                raise ValueError('Supply the actual Prolific study ID explicitly to isolate this collection')
    bundle = load_module_tables('drone_task', root=ROOT, raw_dirs=raw_dir)
    saving = _audit_module()
    loaded = saving.load_samples(raw_dir)
    audit = saving.audit_samples(loaded)
    # The saving audit and canonical intake use different ordinal orderings.
    # Join by the immutable selected source hash, never by Session 001 labels.
    audit_ids = {}
    for i, group in enumerate(loaded['sessions'], 1):
        chosen = group['selected']
        run = _last(chosen['frame'], 'run_uuid')
        sid = run or 'legacy_' + chosen['sha256']
        audit_ids[f'Session {i:03d}'] = sid
    for key in ['sessions', 'checks', 'telemetry', 'coverage', 'snapshots']:
        if 'session' in audit[key]:
            audit[key]['session_id'] = audit[key].session.map(audit_ids)
    audit_summary = audit['sessions'].set_index('session_id') if len(audit['sessions']) else pd.DataFrame()
    review = []
    for _, info in bundle['inventory'].iterrows():
        sid = info.session_id
        row = info.to_dict()
        row.update(_match_submission(info, submissions, study_id))
        row.update(_observed_metrics(bundle['tables'], sid))
        if len(audit_summary) and sid in audit_summary.index:
            for field in ['content_status', 'delivery', 'n_fail', 'n_warn']:
                row['saving_audit_' + field] = audit_summary.loc[sid, field]
            failed = audit['checks'].loc[audit['checks'].session_id.eq(sid) & audit['checks'].status.eq('fail'), 'check']
            row['saving_audit_failures_json'] = json.dumps(list(failed))
        intake = bundle['issues'].loc[_column(bundle['issues'], 'session_id').eq(sid)]
        row['intake_error_count'] = int(_column(intake, 'severity').eq('error').sum())
        row['intake_issue_checks_json'] = json.dumps(list(_column(intake, 'check')))
        review.append(row)
    review = pd.DataFrame(review)
    if review.empty:
        raise ValueError('No canonical Pavlovia sessions were found in this isolated batch')
    match_counts = review.loc[review.matched_to_prolific].groupby('prolific_submission_id').size()
    review['matched_task_runs_for_submission'] = review.prolific_submission_id.map(match_counts).fillna(0).astype(int)
    review['has_main_task_observations'] = review[['encoding_rows', 'memory_pair_rows', 'demographics_rows']].gt(0).any(axis=1)
    substantive_counts = review.loc[review.matched_to_prolific & review.has_main_task_observations].groupby('prolific_submission_id').size()
    review['substantive_task_runs_for_submission'] = review.prolific_submission_id.map(substantive_counts).fillna(0).astype(int)
    review['startup_only_additional_runs'] = review.matched_task_runs_for_submission - review.substantive_task_runs_for_submission
    review['production_route'] = review.apply(lambda row: _truth(row.get('dev_mode')) is False and
                                              _truth(row.get('pilot_mode')) is False, axis=1)
    # Multiple startup-only runs are retained, but they do not make a unique
    # later substantive run into several participants. A second substantive
    # run is different: it remains an unresolved exposure/restart concern.
    review['identity_unambiguous'] = (review.match_status.eq('matched') &
                                     (review.matched_task_runs_for_submission.eq(1) |
                                      (review.has_main_task_observations & review.substantive_task_runs_for_submission.eq(1))) &
                                     ~review.prolific_export_conflict)
    review['consent_recorded'] = review.apply(lambda row: _truth(row.get('consent_accepted')) is True, axis=1)
    # Accepted consent is also observed in a dedicated raw consent row. The
    # metadata stamp may not include consent_accepted in older current runs.
    consent_by_run = {}
    for group in loaded['sessions']:
        f = group['selected']['frame']; sid = _last(f, 'run_uuid') or 'legacy_' + group['selected']['sha256']
        consent = f.loc[_column(f, 'trial_category').eq('consent')]
        accepted = pd.to_numeric(_column(consent, 'response'), errors='coerce').eq(0).any()
        consent_by_run[sid] = bool(accepted)
    review['consent_recorded'] = review.consent_recorded | review.session_id.map(consent_by_run).fillna(False)
    review['completion_supported'] = (review.full_observable_task &
                                      _column(review, 'outcome').eq('completed') & review.consent_recorded)
    complete_counts = review.loc[review.matched_to_prolific & review.completion_supported].groupby('prolific_submission_id').size()
    review['completed_task_runs_for_submission'] = review.prolific_submission_id.map(complete_counts).fillna(0).astype(int)
    review['analysis_include'] = (review.identity_unambiguous & review.production_route &
                                  _column(review, 'source_schema').eq('current') &
                                  review.completion_supported & review.intake_error_count.eq(0) &
                                  review.prolific_status.isin(['AWAITING REVIEW', 'APPROVED']))
    def decision(row):
        if not row.matched_to_prolific:
            return 'not_in_this_prolific_submission_set'
        if row.prolific_status == 'APPROVED':
            return 'already_approved'
        if row.prolific_status != 'AWAITING REVIEW':
            return 'retain_non_submitted_status_for_audit'
        if not row.has_main_task_observations and row.completed_task_runs_for_submission == 1:
            return 'startup_only_before_unique_completed_run'
        if not row.identity_unambiguous or row.intake_error_count:
            return 'review_identity_or_snapshot_conflict'
        if row.production_route and row.completion_supported:
            return 'approve_completed'
        return 'review_missing_completion'
    review['approval_recommendation'] = review.apply(decision, axis=1)
    matched = set(review.loc[review.matched_to_prolific, 'prolific_submission_id'])
    submissions['matched_task_runs'] = _column(submissions, 'submission_id').map(match_counts).fillna(0).astype(int)
    submissions['substantive_task_runs'] = _column(submissions, 'submission_id').map(substantive_counts).fillna(0).astype(int)
    submissions['completed_task_runs'] = _column(submissions, 'submission_id').map(complete_counts).fillna(0).astype(int)
    submissions['has_task_recording'] = _column(submissions, 'submission_id').isin(matched)
    submissions['requires_missing_record_review'] = submissions.prolific_status.eq('AWAITING REVIEW') & ~submissions.has_task_recording
    approval_rows = []
    for _, submission in submissions.iterrows():
        candidates = review.loc[review.prolific_submission_id.eq(_text(submission.get('submission_id')))]
        eligible = candidates.loc[candidates.approval_recommendation.eq('approve_completed')]
        row = submission.to_dict()
        if submission.prolific_status != 'AWAITING REVIEW':
            row['approval_recommendation'] = 'already_approved' if submission.prolific_status == 'APPROVED' else 'retain_non_submitted_status_for_audit'
        elif len(eligible) == 1:
            selected = eligible.iloc[0]
            row.update(approval_recommendation='approve_completed',
                       selected_task_session_id=selected.session_id,
                       selected_task_session_label=selected.session_label,
                       encoding_rows=selected.encoding_rows, memory_pair_rows=selected.memory_pair_rows,
                       demographics_rows=selected.demographics_rows,
                       saving_audit_failures=int(selected.get('saving_audit_n_fail', 0)),
                       saving_audit_warnings=int(selected.get('saving_audit_n_warn', 0)),
                       startup_only_additional_runs=selected.startup_only_additional_runs)
        else:
            row['approval_recommendation'] = 'review_missing_recording' if candidates.empty else 'review_identity_or_completion'
        approval_rows.append(row)
    approval_table = pd.DataFrame(approval_rows)
    summary = dict(study_id=study_id, prolific_submissions=len(submissions),
                   status_counts=submissions.prolific_status.value_counts().to_dict(),
                   expected_awaiting=int(expected_awaiting),
                   expected_awaiting_matches=int(submissions.prolific_status.eq('AWAITING REVIEW').sum()) == expected_awaiting,
                   canonical_task_runs=len(review), analysis_participants=int(review.analysis_include.sum()),
                   submitted_missing_recording=int(submissions.requires_missing_record_review.sum()),
                   approval_recommendation_counts=review.approval_recommendation.value_counts().to_dict(),
                   submission_approval_recommendation_counts=approval_table.approval_recommendation.value_counts().to_dict(),
                   original_exports_modified=False, payment_actions_performed=False)
    result = dict(bundle=bundle, tables=bundle['tables'], inventory=review, review=review,
                  submissions=submissions, prolific_sources=prolific_sources,
                  approval_table=approval_table,
                  prolific_issues=prolific_issues, audit=audit, summary=summary,
                  analysis_session_ids=set(review.loc[review.analysis_include, 'session_id']),
                  batch_root=batch, study_id=study_id)
    if export:
        export_Pilot1(result)
    return result


def export_Pilot1(result):
    """Write private derived tables and immutable source provenance only."""
    batch = result['batch_root']; out = batch / 'derived/intake'; out.mkdir(parents=True, exist_ok=True)
    result['review'].to_csv(out / 'private_session_review.csv', index=False)
    result['submissions'].to_csv(out / 'private_prolific_submissions.csv', index=False)
    result['approval_table'].to_csv(out / 'private_approval_review.csv', index=False)
    result['bundle']['issues'].to_csv(out / 'intake_issues.csv', index=False)
    result['prolific_issues'].to_csv(out / 'prolific_export_issues.csv', index=False)
    (out / 'intake_summary.json').write_text(json.dumps(result['summary'], indent=2) + '\n')
    audit_out = out / 'data_saving_audit'
    _audit_module().export_report(result['audit'], audit_out)
    # Public-facing audit helper output still gets stable private keys here.
    for name in ['sessions', 'checks', 'coverage', 'telemetry', 'snapshots']:
        result['audit'][name].to_csv(audit_out / (name + '.csv'), index=False)
    sources = []
    for area in ['source_exports', 'raw']:
        for p in sorted((batch / area).rglob('*')) if (batch / area).exists() else []:
            if p.is_file():
                sources.append(dict(path=str(p.relative_to(batch)), bytes=p.stat().st_size,
                                    sha256=hashlib.sha256(p.read_bytes()).hexdigest()))
    manifest = dict(collection='Pilot1', study_id=result['study_id'], sources=sources,
                    runtime_contract=result['audit']['contract'],
                    intake_code_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                    analysis_session_ids=sorted(result['analysis_session_ids']),
                    decisions=dict(complete_observation_counts=[200, 56, 1],
                                   memory_accuracy_exclusion=False, authenticity_exclusion=False,
                                   automatic_payment_or_rejection=False,
                                   snapshot_deduplication='one canonical snapshot per run UUID; conflicts retained',
                                   startup_reruns='retain all; include a unique substantive completed run when other matched runs contain no main task observations',
                                   cohort='unique matched production completed submissions in this Prolific study'))
    (out / 'private_source_manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    return out


build_Pilot1 = load_Pilot1
