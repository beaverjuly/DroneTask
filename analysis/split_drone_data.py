#!/usr/bin/env python3
"""
split_drone_data.py — Post-process DroneTask raw CSVs from Pavlovia.

Usage:
    python analysis/split_drone_data.py data/raw/
    python analysis/split_drone_data.py data/raw/single_file.csv
    python analysis/split_drone_data.py data/raw/ -o data/clean/

Pavlovia filename format:
    DroneTask_{participantId}_SESSION_{date}_{time}.csv

For each participant, produces:
    {pid}_{date}_metadata.csv
    {pid}_{date}_encoding.csv
    {pid}_{date}_memory.csv
    {pid}_{date}_practice.csv
    {pid}_{date}_comprehension.csv
    {pid}_{date}_demographics.csv
    {pid}_{date}_preload_diagnostics.csv
"""
import argparse, json, os, re, sys
import pandas as pd

# ─── Column definitions per table ────────────────────────────

META_COLS = [
    'workerId', 'subId', 'PROLIFIC_PID', 'STUDY_ID', 'SESSION_ID',
    'pilot_mode', 'dev_mode', 'consent_shown',
    'data_save_mode', 'is_pavlovia', 'is_local_env',
    'latin_square_group', 'latin_square_order',
    'task_version', 'stimuli_version',
    'preload_loaded', 'preload_total', 'preload_failed',
    'preload_elapsed_ms', 'preload_mode',
    'preload_overall_timeout', 'preload_gate_wait_ms',
    'total_supply_caught', 'total_score', 'total_scored_trials',
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
    'supply_caught', 'score', 'stayed',
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
    'block', 'pair_index',
    'condition', 'condition_id',
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
    'attempt_number', 'timed_out', 'skipped_pair',
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
    'supply_caught', 'score', 'stayed',
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
    return df[[c for c in cols if c in df.columns]].copy()

def _scalar(df, col):
    if col not in df.columns:
        return None
    vals = df[col].dropna()
    return vals.iloc[0] if len(vals) > 0 else None

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


def process_one(filepath, outdir):
    df = pd.read_csv(filepath)
    fname_pid, fname_date, fname_time = parse_filename(filepath)

    prolific = _scalar(df, 'PROLIFIC_PID')
    out_pid  = prolific if prolific and str(prolific).lower() not in ('nan', 'none', '') \
               else fname_pid
    out_date = fname_date or 'nodatetime'
    prefix   = os.path.join(outdir, f'{out_pid}_{out_date}')
    written  = []

    # 1. Metadata
    meta_row = {}
    for c in META_COLS:
        meta_row[c] = _scalar(df, c)
    meta_row['pavlovia_pid']  = fname_pid
    meta_row['pavlovia_date'] = fname_date
    meta_row['pavlovia_time'] = fname_time
    pd.DataFrame([meta_row]).to_csv(f'{prefix}_metadata.csv', index=False)
    written.append('metadata')

    # 2. Encoding trials (practice_no == 0)
    prac_col = df.get('practice_no', pd.Series(dtype=float))
    enc = df[(df['trial_type'] == 'trial') & (prac_col.fillna(-1) == 0)]
    if len(enc):
        _keep(enc, ENCODING_COLS).to_csv(f'{prefix}_encoding.csv', index=False)
        written.append(f'encoding ({len(enc)})')

    # 3. Memory trials
    mem = df[df['trial_type'] == 'memory-task']
    if len(mem):
        _keep(mem, MEMORY_COLS).to_csv(f'{prefix}_memory.csv', index=False)
        written.append(f'memory ({len(mem)})')

    # 4. Practice trials (practice_no > 0)
    prac = df[(df['trial_type'] == 'trial') & (prac_col.fillna(0) > 0)]
    if len(prac):
        _keep(prac, PRACTICE_COLS).to_csv(f'{prefix}_practice.csv', index=False)
        written.append(f'practice ({len(prac)})')

    # 5. Comprehension
    comp = df[df['trial_type'].str.contains('comprehension', case=False, na=False)]
    if len(comp):
        _keep(comp, COMPREHENSION_COLS).to_csv(f'{prefix}_comprehension.csv', index=False)
        written.append(f'comprehension ({len(comp)})')

    # 6. Demographics
    demo = df[df['trial_type'] == 'survey-demo']
    if len(demo):
        _keep(demo, DEMOGRAPHICS_COLS).to_csv(f'{prefix}_demographics.csv', index=False)
        written.append(f'demographics ({len(demo)})')

    # 7. Preload diagnostics — per-URL success/failure + trial impact
    diag = _build_preload_diagnostics(df, enc, mem)
    if len(diag):
        diag.to_csv(f'{prefix}_preload_diagnostics.csv', index=False)
        n_failed = (diag['preload_outcome'] == 'failed').sum()
        written.append(f'preload_diagnostics ({n_failed} failed / {len(diag)} URLs)')

    print(f'  [{out_pid} | {fname_date}] → {", ".join(written)}')
    return out_pid


def main():
    ap = argparse.ArgumentParser(description='Split DroneTask Pavlovia CSVs.')
    ap.add_argument('input', help='Single CSV or directory of CSVs')
    ap.add_argument('-o', '--outdir', default=None,
                    help='Output directory (default: data/clean/ relative to input)')
    args = ap.parse_args()

    if os.path.isfile(args.input):
        files = [args.input]
        default_out = os.path.join(os.path.dirname(args.input) or '.', '..', 'clean')
    elif os.path.isdir(args.input):
        files = sorted(
            os.path.join(args.input, f)
            for f in os.listdir(args.input) if f.endswith('.csv')
        )
        default_out = os.path.join(args.input, '..', 'clean')
    else:
        print(f'Error: {args.input!r} not found.', file=sys.stderr)
        sys.exit(1)

    outdir = os.path.normpath(args.outdir or default_out)
    os.makedirs(outdir, exist_ok=True)
    print(f'Output → {outdir}/')

    ok, failed = 0, []
    for f in files:
        print(f'Processing {os.path.basename(f)} ...')
        try:
            process_one(f, outdir)
            ok += 1
        except Exception as e:
            print(f'  ERROR: {e}', file=sys.stderr)
            failed.append(f)

    print(f'\nDone — {ok} participant(s)' +
          (f', {len(failed)} failed.' if failed else '.'))


if __name__ == '__main__':
    main()
