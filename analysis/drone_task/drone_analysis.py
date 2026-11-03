"""Descriptive main task analysis with explicit recording and protocol checks.

The notebook is the report. This module keeps its reusable transformations
auditable without treating trials as independent participants or fitting an
unidentified process noise versus observation noise model.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

STAGES = ('order', 'distance', 'placement')
CONDITION_COLUMNS = ('canonical_design_idx', 'condition_id', 'valence',
                     'vol_level', 'stc_level', 'true_vol_param', 'true_stc_param')
COLORS = ('#2878a5', '#bf6043', '#34846a', '#8a69a6')
SUMMARY_COLUMNS = ['session_id', 'session_label', 'block', 'condition_id', 'condition_label',
    'valence', 'vol_level', 'stc_level', 'encoding_rows', 'memory_pairs', 'caught_fraction', 'score',
    'median_target_error_pp', 'median_landing_error_pp', 'mean_abs_target_step_pp',
    'mean_nonzero_target_step_pp', 'target_changes', 'target_transitions', 'mean_abs_wind_offset_pp',
    'stayed_fraction', 'update_slope', 'update_slope_status', 'update_transitions',
    'order_correct', 'order_answered', 'order_accuracy_answered', 'order_accuracy_all_recorded_pairs',
    'distance_answered', 'placement_answered', 'placement_mae_pp']


def numeric(frame, name):
    return pd.to_numeric(frame.get(name, pd.Series(np.nan, index=frame.index)), errors='coerce')


def boolean(frame, name):
    values = frame.get(name, pd.Series(pd.NA, index=frame.index))
    return values.astype('string').str.lower().map(
        {'true': True, '1': True, '1.0': True, 'false': False, '0': False, '0.0': False}
    ).astype('boolean')


def json_value(value, default=None):
    if isinstance(value, (list, dict)):
        return value
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return default


def prepare_tables(tables, session_ids):
    """Use encoding condition labels and one based recorded trial indices."""
    out = {name: frame.loc[frame.session_id.isin(session_ids)].copy()
           if 'session_id' in frame else frame.copy() for name, frame in tables.items()}
    enc, mem = out['encoding'], out['memory']
    # Empty tables from an interrupted session still have a defined analysis
    # schema. Their absence must produce missing content checks, not a crash.
    required_mem = ['session_id', 'session_label', 'block', 'pair_index', 'trial1_index', 'trial2_index',
        'placement_probe_index', 'placement_true_position_pct', 'stim_left_img', 'stim_right_img',
        'stim_first_actual', 'order_choice_img', 'order_correct_bin', 'pair_true_distance',
        'distance_estimate', 'placement_slider_value', 'true_gap', 'placement_target_pct',
        'placement_error_pp', 'placement_abs_error_pp', 'span_observed', 'hidden_change_count',
        'largest_hidden_step', 'expected_first_image', 'expected_second_image',
        *[f'{s}_{suffix}' for s in STAGES for suffix in ('answered', 'final_omission', 'value_recorded')]]
    mem = mem.reindex(columns=list(dict.fromkeys([*mem.columns, *required_mem])))
    out['memory'] = mem
    required_enc = ['session_id', 'session_label', 'block', 'trial', 'drone_position', 'bag_position',
        'bucket_position', 'stim_img', *CONDITION_COLUMNS, 'outcome_error', 'target_error',
        'abs_outcome_error', 'abs_target_error', 'abs_wind_offset', 'target_step', 'collector_update']
    enc = enc.reindex(columns=list(dict.fromkeys([*enc.columns, *required_enc])))
    out['encoding'] = enc
    for frame in (enc, mem):
        for column in ('block', 'trial', 'pair_index', *CONDITION_COLUMNS[0:1]):
            if column in frame:
                frame[column] = numeric(frame, column)
    if enc.empty:
        return out
    # A mixed label within a displayed block is an error, not a majority vote.
    cols = [c for c in CONDITION_COLUMNS if c in enc]
    conditions = enc.groupby(['session_id', 'block'], dropna=False)[cols].nunique(dropna=True)
    if conditions.gt(1).any().any():
        raise ValueError('Inconsistent encoding condition labels within a displayed block')
    block_conditions = enc.groupby(['session_id', 'block'], as_index=False)[cols].first()
    if len(mem):
        mem = mem.drop(columns=cols, errors='ignore').merge(
            block_conditions, on=['session_id', 'block'], how='left', validate='many_to_one')
    for frame in (enc, mem):
        if frame.empty:
            continue
        frame['regime'] = frame['vol_level'].astype('string') + ' volatility\n' + frame['stc_level'].astype('string') + ' stochasticity'
        frame['condition_label'] = frame['valence'].astype('string').str.capitalize() + '\n' + frame['regime']
    enc = enc.sort_values(['session_id', 'block', 'trial']).copy()
    enc['outcome_error'] = numeric(enc, 'bag_position') - numeric(enc, 'bucket_position')
    enc['target_error'] = numeric(enc, 'bucket_position') - numeric(enc, 'drone_position')
    enc['abs_outcome_error'] = enc.outcome_error.abs()
    enc['abs_target_error'] = enc.target_error.abs()
    enc['abs_wind_offset'] = (numeric(enc, 'bag_position') - numeric(enc, 'drone_position')).abs()
    group = enc.groupby(['session_id', 'block'], sort=False)
    enc['target_step'] = group['drone_position'].diff()
    enc['collector_update'] = group['bucket_position'].shift(-1) - numeric(enc, 'bucket_position')
    next_trial = group['trial'].shift(-1)
    enc.loc[next_trial.ne(enc.trial + 1), 'collector_update'] = np.nan
    # Do not make a jump across a missing encoding record into a target step.
    previous_trial = group['trial'].shift(1)
    enc.loc[previous_trial.ne(enc.trial - 1), 'target_step'] = np.nan
    if len(mem):
        mem['true_gap'] = (numeric(mem, 'trial2_index') - numeric(mem, 'trial1_index')).abs() - 1
        mem['placement_target_pct'] = 100 * (numeric(mem, 'placement_probe_index') - numeric(mem, 'trial1_index')) / (
            numeric(mem, 'trial2_index') - numeric(mem, 'trial1_index'))
        mem['placement_error_pp'] = numeric(mem, 'placement_slider_value') - mem.placement_target_pct
        mem['placement_abs_error_pp'] = mem.placement_error_pp.abs()
        mem['order_answered'] = numeric(mem, 'order_correct_bin').isin([0, 1]) & ~boolean(mem, 'order_final_omission').fillna(False)
        mem['distance_answered'] = numeric(mem, 'distance_estimate').between(0, 100) & ~boolean(mem, 'distance_final_omission').fillna(False)
        mem['placement_answered'] = numeric(mem, 'placement_slider_value').between(0, 100) & ~boolean(mem, 'placement_final_omission').fillna(False)
        for stage, value in [('order', 'order_correct_bin'), ('distance', 'distance_estimate'), ('placement', 'placement_slider_value')]:
            mem[f'{stage}_value_recorded'] = mem[value]
            mem.loc[~mem[f'{stage}_answered'], value] = np.nan
        mem.loc[~mem.placement_answered, ['placement_error_pp', 'placement_abs_error_pp']] = np.nan
        indexed = enc.drop_duplicates(['session_id', 'block', 'trial']).set_index(['session_id', 'block', 'trial'])
        mem['expected_first_image'] = [indexed.stim_img.get((r.session_id, r.block, min(r.trial1_index, r.trial2_index)), np.nan) for _, r in mem.iterrows()]
        mem['expected_second_image'] = [indexed.stim_img.get((r.session_id, r.block, max(r.trial1_index, r.trial2_index)), np.nan) for _, r in mem.iterrows()]
        # Only changes between the two item onsets are counted. Positions and
        # memory indices are both one based in the runtime implementation.
        spans = []
        for _, row in mem.iterrows():
            lo, hi = sorted([row.trial1_index, row.trial2_index])
            block = enc.loc[(enc.session_id == row.session_id) & (enc.block == row.block)]
            interval = block.loc[block.trial.between(lo + 1, hi)]
            observed = len(interval) == hi - lo and interval.target_step.notna().all()
            spans.append(dict(
                span_observed=observed,
                hidden_change_count=int(interval.target_step.abs().gt(1e-8).sum()) if observed else np.nan,
                largest_hidden_step=interval.target_step.abs().max() if observed else np.nan,
            ))
        span_frame = pd.DataFrame(spans, index=mem.index)
        for column in span_frame:
            mem[column] = span_frame[column]
    out['encoding'], out['memory'] = enc, mem
    return out


def recording_checks(tables, inventory):
    """Structural integrity is distinct from response quality and delivery."""
    enc, mem = tables['encoding'], tables['memory']
    rows = []
    def add(label, name, status, observed, expected):
        rows.append(dict(session_label=label, check=name, status=status, observed=observed, expected=expected))
    for _, info in inventory.iterrows():
        sid, label = info.session_id, info.session_label
        e, m = enc.loc[enc.session_id.eq(sid)], mem.loc[mem.session_id.eq(sid)]
        # Current routes record their intended counts. Fall back to the full
        # protocol only when that older metadata is genuinely absent.
        expected_enc = pd.to_numeric(info.get('expected_main_encoding'), errors='coerce')
        expected_mem = pd.to_numeric(info.get('expected_main_memory_pairs'), errors='coerce')
        expected_enc = int(expected_enc) if pd.notna(expected_enc) else 200
        expected_mem = int(expected_mem) if pd.notna(expected_mem) else 56
        for name, frame, expected, keys in (
            ('Encoding rows', e, expected_enc, ['block', 'trial']),
            ('Memory pair summaries', m, expected_mem, ['block', 'pair_index'])):
            unique = len(frame.drop_duplicates(keys)) if len(frame) else 0
            add(label, name, 'pass' if len(frame) == unique == expected else 'fail', len(frame), expected)
        complete_blocks = sum(set(g.trial.dropna()) == set(range(1, 51)) and len(g) == 50 for _, g in e.groupby('block'))
        expected_blocks = expected_enc / 50
        block_status = ('pass' if complete_blocks == expected_blocks else 'fail') if expected_enc % 50 == 0 else 'not_applicable'
        add(label, 'Complete encoding blocks', block_status, complete_blocks, expected_blocks)
        memory_blocks = sum(set(g.pair_index.dropna()) == set(range(1, 15)) and len(g) == 14 for _, g in m.groupby('block')) if len(m) else 0
        memory_block_status = ('pass' if memory_blocks == expected_mem / 14 else 'fail') if expected_mem % 14 == 0 else 'not_applicable'
        add(label, 'Complete memory blocks', memory_block_status, memory_blocks, expected_mem / 14)
        valid_pos = all(numeric(e, c).between(0, 100).all() for c in ('bag_position', 'drone_position', 'bucket_position')) and len(e) > 0
        add(label, 'Finite positions within the rail', 'pass' if valid_pos else 'fail', int(valid_pos), 1)
        catch = numeric(e, 'supply_caught')
        reconstructed = catch.where(e.valence.eq('reward'), catch - 10)
        score_match = np.isclose(numeric(e, 'score'), reconstructed, equal_nan=False)
        add(label, 'Scoring agrees with pieces caught', 'pass' if len(e) and score_match.all() else 'fail', int(score_match.sum()), len(e))
        gap_ok = np.isclose(numeric(m, 'pair_true_distance'), numeric(m, 'true_gap'), equal_nan=False)
        add(label, 'Memory gap agrees with item indices', ('pass' if gap_ok.all() else 'fail') if len(m) else ('not_applicable' if expected_mem == 0 else 'not_evaluable'), int(gap_ok.sum()), len(m))
        recorded = numeric(m, 'placement_true_position_pct').notna()
        place_ok = np.isclose(numeric(m, 'placement_true_position_pct')[recorded], numeric(m, 'placement_target_pct')[recorded])
        add(label, 'Recorded placement targets agree with indices', ('pass' if place_ok.all() else 'fail') if len(place_ok) else 'not_evaluable', int(place_ok.sum()), int(recorded.sum()))
        answered = numeric(m, 'order_correct_bin').notna()
        cols = ['order_choice_img', 'stim_first_actual']
        evaluable = answered & m[cols].notna().all(axis=1)
        derived = m.order_choice_img.eq(m.stim_first_actual).astype(int)
        matches = numeric(m, 'order_correct_bin')[evaluable].eq(derived[evaluable])
        add(label, 'Order correctness agrees with selected image', ('pass' if matches.all() else 'fail') if len(matches) else 'not_evaluable', int(matches.sum()), int(evaluable.sum()))
        if len(m):
            image_evaluable = m[['expected_first_image', 'expected_second_image']].notna().all(axis=1)
            correct_pair = pd.Series([
                set([r.stim_left_img, r.stim_right_img]) == set([r.expected_first_image, r.expected_second_image])
                and r.stim_first_actual == r.expected_first_image
                and (not r.order_answered or r.order_choice_img in (r.stim_left_img, r.stim_right_img))
                for _, r in m.iterrows()], index=m.index)
            add(label, 'Memory images agree with studied item indices',
                ('pass' if correct_pair.all() else 'fail') if image_evaluable.all() else 'not_evaluable',
                int((correct_pair & image_evaluable).sum()), len(m))
            for stage in STAGES:
                value = numeric(m, f'{stage}_value_recorded')
                recorded_value = m[f'{stage}_value_recorded'].notna()
                in_range = value.isin([0, 1]) if stage == 'order' else value.between(0, 100)
                add(label, f'{stage.capitalize()} response values in range',
                    'fail' if (recorded_value & ~in_range).any() else 'pass',
                    int((recorded_value & in_range).sum()), int(recorded_value.sum()))
                flag = boolean(m, f'{stage}_final_omission')
                contradictions = value.notna() & flag.fillna(False)
                unknown = value.notna() & flag.isna()
                add(label, f'{stage.capitalize()} final response flags', 'fail' if contradictions.any() else ('not_recorded' if unknown.any() else 'pass'),
                    int((value.notna() & flag.eq(False).fillna(False)).sum()), int(value.notna().sum()))
        final = str(info.get('outcome', '')).lower() == 'completed' and bool(info.get('has_session_summary', False))
        add(label, 'Terminal completion record', 'pass' if final else 'not_observed', int(final), 1)
        display_count = e.get('stim_display_outcome', pd.Series(dtype=str)).notna().sum()
        add(label, 'Encoding display outcomes recorded', 'pass' if display_count == len(e) and len(e) else 'not_recorded', int(display_count), len(e))
    return pd.DataFrame(rows)


def block_summary(enc, mem):
    rows = []
    for (sid, block), e in enc.groupby(['session_id', 'block'], sort=True):
        m = mem.loc[mem.session_id.eq(sid) & mem.block.eq(block)]
        good = e[['outcome_error', 'collector_update']].dropna()
        # Descriptive OLS includes an intercept and never pools transitions
        # across displayed blocks. This slope is not a recovered learning rate.
        x, y = good.outcome_error.to_numpy(), good.collector_update.to_numpy()
        rank_ok = len(x) >= 5 and np.ptp(x) > 1e-8
        slope = np.linalg.lstsq(np.column_stack([np.ones(len(x)), x]), y, rcond=None)[0][1] if rank_ok else np.nan
        row = dict(session_id=sid, session_label=e.session_label.iloc[0], block=block,
                   condition_id=e.condition_id.iloc[0], condition_label=e.condition_label.iloc[0],
                   valence=e.valence.iloc[0], vol_level=e.vol_level.iloc[0], stc_level=e.stc_level.iloc[0],
                   encoding_rows=len(e), memory_pairs=len(m),
                   caught_fraction=numeric(e, 'supply_caught').mean() / 10,
                   score=numeric(e, 'score').sum(min_count=1),
                   median_target_error_pp=e.abs_target_error.median(),
                   median_landing_error_pp=e.abs_outcome_error.median(),
                   mean_abs_target_step_pp=e.target_step.abs().mean(),
                   mean_nonzero_target_step_pp=e.loc[e.target_step.abs().gt(1e-8), 'target_step'].abs().mean(),
                   target_changes=int(e.target_step.abs().gt(1e-8).sum()),
                   target_transitions=int(e.target_step.notna().sum()),
                   mean_abs_wind_offset_pp=e.abs_wind_offset.mean(),
                   stayed_fraction=boolean(e, 'stayed').mean(),
                   update_slope=slope, update_slope_status='estimated' if rank_ok else 'not_evaluable',
                   update_transitions=len(good),
                   order_correct=numeric(m, 'order_correct_bin').sum(min_count=1),
                   order_answered=int(m.order_answered.sum()) if len(m) else 0,
                   order_accuracy_answered=numeric(m, 'order_correct_bin').mean(),
                   order_accuracy_all_recorded_pairs=numeric(m, 'order_correct_bin').sum(min_count=1) / len(m) if len(m) else np.nan,
                   distance_answered=int(m.distance_answered.sum()) if len(m) else 0,
                   placement_answered=int(m.placement_answered.sum()) if len(m) else 0,
                   placement_mae_pp=m.loc[m.placement_answered, 'placement_abs_error_pp'].mean() if len(m) else np.nan)
        rows.append(row)
    return pd.DataFrame(rows, columns=SUMMARY_COLUMNS)


def manipulation_checks(summary):
    rows = []
    for label, frame in summary.groupby('session_label'):
        for factor, metric, description in [
            ('vol_level', 'mean_nonzero_target_step_pp', 'Movement size when the drone changes position'),
            ('stc_level', 'mean_abs_wind_offset_pp', 'Absolute supply landing distance from the drone')]:
            means = frame.groupby(factor)[metric].mean()
            high, low = means.get('high', np.nan), means.get('low', np.nan)
            status = 'not_evaluable' if not np.isfinite([high, low]).all() else ('as_named' if high > low else 'inverted' if high < low else 'equal')
            rows.append(dict(session_label=label, nominal_factor=factor, metric=description,
                             saved_high_mean_pp=high, saved_low_mean_pp=low, ordering=status))
    return pd.DataFrame(rows)


def stage_summary(mem, events, intended_pairs=None):
    rows = []
    for stage in STAGES:
        ev = events.loc[events.response_stage.eq(stage)].copy() if 'response_stage' in events else pd.DataFrame()
        answered = int(mem[f'{stage}_answered'].sum()) if len(mem) else 0
        timed = boolean(ev, 'stage_timed_out')
        # Derive answered final rows separately from timeout attempts. A retry
        # can contain a timeout while ultimately providing a valid response.
        rows.append(dict(stage=stage, recorded_pairs=len(mem), intended_pairs=intended_pairs,
                         missing_pair_summaries=max(0, intended_pairs - len(mem)) if intended_pairs is not None else np.nan,
                         final_answered=answered,
                         final_unanswered=len(mem) - answered, recorded_attempts=len(ev),
                         timeout_attempts=int(timed.fillna(False).sum()),
                         timeout_flag_missing=int(timed.isna().sum()),
                         timing_available=len(ev) > 0))
    return pd.DataFrame(rows)


def pair_support(mem):
    valid = mem.loc[mem.span_observed].copy()
    valid['crosses_hidden_change'] = valid.hidden_change_count.gt(0)
    return valid.groupby(['session_label', 'block', 'condition_id', 'true_gap', 'crosses_hidden_change'], observed=True).agg(
        n_pairs=('pair_index', 'size'), n_order=('order_correct_bin', 'count'),
        n_distance=('distance_estimate', 'count'), n_placement=('placement_slider_value', 'count'),
        order_accuracy=('order_correct_bin', 'mean'), distance_slider_mean=('distance_estimate', 'mean')
    ).reset_index()


def export_figure(fig, path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(path, dpi=170, bbox_inches='tight', facecolor='white')
    return fig


def block_labels(summary):
    return [f'Block {int(row.block)}\n{row.condition_label}' for _, row in summary.iterrows()]


def one_session(frame):
    if 'session_id' in frame and frame.session_id.nunique() > 1:
        raise ValueError('Comparative figures require one selected session and must not pool repeated blocks across people')


def plot_tracking(enc, summary):
    one_session(enc)
    one_session(summary)
    blocks = sorted(enc.block.dropna().unique())
    fig, axes = plt.subplots(2, 2, figsize=(13, 8), sharex=True, sharey=True, layout='constrained')
    for ax, block, color in zip(axes.flat, blocks, COLORS):
        g = enc.loc[enc.block.eq(block)].sort_values('trial')
        row = summary.loc[summary.block.eq(block)].iloc[0]
        ax.plot(g.trial, g.drone_position, color='#333d48', lw=1.7, label='Hidden drone')
        ax.scatter(g.trial, g.bag_position, color='#cc9e37', s=16, alpha=.7, label='Recorded supply')
        ax.plot(g.trial, g.bucket_position, color=color, lw=1.3, label='Collector')
        ax.set_title(f'Block {int(block)}   {row.valence.capitalize()}\n{row.vol_level.capitalize()} volatility   {row.stc_level} stochasticity', fontsize=11)
        ax.set(xlim=(.2, 50.8), ylim=(-2, 102), xlabel='Encoding turn', ylabel='Rail position in percent')
    for ax in list(axes.flat)[len(blocks):]:
        ax.set_visible(False)
    axes.flat[0].legend(loc='upper left', fontsize=8, ncol=3)
    fig.suptitle('Recorded trajectories in presentation order', fontsize=15, weight='bold')
    return fig


def plot_behavior(enc, summary):
    one_session(enc)
    one_session(summary)
    fig, axes = plt.subplots(1, 3, figsize=(14, 4.6), layout='constrained')
    x = np.arange(len(summary))
    axes[0].bar(x, summary.caught_fraction * 100, color=COLORS[:len(x)])
    axes[0].set(ylabel='Percent of ten pieces caught', ylim=(0, 100), title='Comparable performance across score signs')
    for pos, value in zip(x, summary.caught_fraction):
        axes[0].text(pos, value * 100 + 2, f'{value:.1%}', ha='center', fontsize=9)
    width = .35
    axes[1].bar(x - width/2, summary.median_target_error_pp, width, label='Hidden drone', color='#536777')
    axes[1].bar(x + width/2, summary.median_landing_error_pp, width, label='Recorded supply', color='#c49a3e')
    axes[1].set(ylabel='Median absolute error in percentage points', title='Collector error relative to each location')
    axes[1].legend(fontsize=8)
    axes[2].bar(x, summary.update_slope, color=COLORS[:len(x)])
    axes[2].axhline(0, color='black', lw=.6)
    axes[2].set(ylabel='Next collector update versus current error', title='Descriptive update slope within each block')
    for pos, row in summary.reset_index(drop=True).iterrows():
        axes[2].annotate(f'n = {row.update_transitions}', (pos, row.update_slope if np.isfinite(row.update_slope) else 0),
                         xytext=(0, 5), textcoords='offset points', ha='center', fontsize=8)
    for ax in axes:
        ax.set_xticks(x, [f'Block {int(b)}' for b in summary.block])
        ax.grid(axis='x', visible=False)
    fig.suptitle('Behavioral summaries for one session', fontsize=15, weight='bold')
    return fig


def plot_manipulations(summary):
    one_session(summary)
    fig, axes = plt.subplots(1, 3, figsize=(14, 4.7), layout='constrained')
    for ax, metric, title in zip(axes,
            ['mean_abs_target_step_pp', 'mean_nonzero_target_step_pp', 'mean_abs_wind_offset_pp'],
            ['Drone movement across all transitions', 'Drone movement when position changes', 'Supply landing distance from drone']):
        x = np.arange(len(summary))
        ax.bar(x, summary[metric], color=COLORS[:len(x)])
        for pos, value in zip(x, summary[metric]):
            if np.isfinite(value):
                ax.text(pos, value + summary[metric].max()*.025, f'{value:.2f}', ha='center', fontsize=9)
        factor = 'vol_level' if metric != 'mean_abs_wind_offset_pp' else 'stc_level'
        ax.set_xticks(x, [f'Block {int(r.block)}\nSaved {r[factor]}' for _, r in summary.iterrows()])
        ax.set(ylabel='Mean absolute distance in percentage points', title=title)
        ax.set_ylim(0, max(1, summary[metric].max()*1.18))
    fig.suptitle('Saved nominal labels compared with recorded geometry', fontsize=15, weight='bold')
    return fig


def plot_memory(mem, summary):
    one_session(mem)
    one_session(summary)
    if 'source_schema' in mem and not mem.source_schema.eq('current').all():
        raise ValueError('Distance response scales differ across protocols. Current memory plots cannot include legacy responses')
    fig, axes = plt.subplots(1, 3, figsize=(14, 4.8), layout='constrained')
    x = np.arange(len(summary))
    axes[0].bar(x, summary.order_accuracy_answered, color=COLORS[:len(x)])
    axes[0].axhline(.5, color='#777', ls=':', lw=1)
    for pos, r in summary.reset_index(drop=True).iterrows():
        axes[0].text(pos, r.order_accuracy_answered + .035, f'{int(r.order_correct)}/{r.order_answered}', ha='center', fontsize=9)
    axes[0].set(ylim=(0, 1.05), ylabel='Fraction correct among answered pairs', title='Temporal order with response denominators')
    axes[0].set_xticks(x, [f'Block {int(b)}' for b in summary.block])
    for block, color in zip(sorted(mem.block.unique()), COLORS):
        g = mem.loc[mem.block.eq(block) & mem.distance_answered]
        points = g.groupby('true_gap').distance_estimate.agg(['mean', 'count'])
        axes[1].plot(points.index, points['mean'], 'o-', color=color, label=f'Block {int(block)}')
    axes[1].set(xticks=[1, 2], xlim=(.85, 2.15), ylim=(0, 100), xlabel='Actual number of intervening items',
                ylabel='Mean subjective slider value from 0 to 100', title='Distance ratings by actual separation')
    axes[1].legend(fontsize=8, ncol=2)
    g = mem.loc[mem.placement_answered]
    for block, color in zip(sorted(mem.block.unique()), COLORS):
        h = g.loc[g.block.eq(block)]
        axes[2].scatter(h.placement_target_pct, h.placement_slider_value, alpha=.7, s=27, color=color)
    axes[2].plot([0, 100], [0, 100], ls=':', color='#777')
    axes[2].set(xlim=(0, 100), ylim=(0, 100), xlabel='Actual relative position in percent',
                ylabel='Placement response in percent', title=f'Placement accuracy with {len(g)}/{len(mem)} answers')
    fig.suptitle('Three memory outcomes with their correct units', fontsize=15, weight='bold')
    return fig


def plot_response_timing(events, summary):
    one_session(events)
    fig, axes = plt.subplots(1, 3, figsize=(14, 4.6), layout='constrained')
    for pos, stage in enumerate(STAGES):
        g = events.loc[events.response_stage.eq(stage)].copy()
        first = numeric(g, 'first_interaction_rt_ms')
        # Both offsets share the stage construction origin. Subtract the
        # recorded asset visibility offset for participant visible latency.
        visible = first - numeric(g, 'stage_visible_rt_ms')
        latency = visible.where(visible.ge(0)).dropna() / 1000
        spread = np.linspace(-.13, .13, len(latency))
        axes[0].scatter(pos + spread, latency, color=COLORS[pos], s=17, alpha=.6)
        if len(latency):
            axes[0].plot([pos-.2, pos+.2], [latency.median()]*2, color='#222', lw=2)
        if stage != 'order':
            after = (numeric(g, 'submitted_rt_ms') - first).dropna() / 1000
            after = after.loc[after.ge(0)]
            axes[1].scatter(pos-1 + np.linspace(-.13, .13, len(after)), after, color=COLORS[pos], s=17, alpha=.6)
    axes[0].axhline(5, color='#a55b3f', ls=':', label='First response notice')
    axes[0].set(xticks=range(3), xticklabels=[s.capitalize() for s in STAGES], ylabel='Seconds after recorded asset visibility', title='First interaction for answered attempts')
    axes[0].legend(fontsize=8)
    axes[1].axhline(7, color='#a55b3f', ls=':', label='Automatic submission notice')
    axes[1].set(xticks=[0, 1], xticklabels=['Distance', 'Placement'], ylabel='Seconds after first interaction', title='Time used to finish a slider response')
    axes[1].legend(fontsize=8)
    x = np.arange(3)
    for delta, col, label, color in [(-.18, 'timeout_attempts', 'Timeout attempts', '#c49a3e'), (.18, 'final_unanswered', 'Final unanswered pairs', '#a65b55')]:
        axes[2].bar(x+delta, summary[col], width=.35, label=label, color=color)
        for p, n in zip(x+delta, summary[col]):
            axes[2].text(p, n+.08, str(int(n)), ha='center', fontsize=9)
    axes[2].set(xticks=x, xticklabels=[s.capitalize() for s in STAGES], ylabel='Recorded count', title='Retries do not equal final omissions')
    axes[2].legend(fontsize=8)
    axes[2].set_ylim(0, max(3, summary[['timeout_attempts', 'final_unanswered']].max().max()+1.5))
    fig.suptitle('Response timing and missingness for one session', fontsize=15, weight='bold')
    return fig


def plot_pair_support(support, summary):
    one_session(summary)
    if 'session_label' in support and support.session_label.nunique() > 1:
        raise ValueError('Pair support must describe one selected session')
    columns = pd.MultiIndex.from_product([[1, 2], [False, True]], names=['true_gap', 'crosses_hidden_change'])
    table = support.pivot_table(index='block', columns=['true_gap', 'crosses_hidden_change'], values='n_pairs', fill_value=0)
    table = table.reindex(index=summary.block, columns=columns, fill_value=0).astype(int)
    fig, ax = plt.subplots(figsize=(9, 4.5), layout='constrained')
    image = ax.imshow(table.to_numpy(), cmap='Blues', vmin=0, vmax=max(1, table.to_numpy().max()), aspect='auto')
    for i in range(len(table)):
        for j in range(len(columns)):
            n = table.iloc[i, j]
            ax.text(j, i, str(n), ha='center', va='center', color='white' if n > table.to_numpy().max()*.55 else '#223343', fontsize=13)
    ax.set_xticks(range(4), ['1 item\nNo hidden change', '1 item\nHidden change', '2 items\nNo hidden change', '2 items\nHidden change'])
    ax.set_yticks(range(len(table)), [f'Block {int(b)}' for b in table.index])
    ax.set(xlabel='Actual separation and hidden position change between the two item onsets', title='Memory pair support before any segmentation contrast')
    ax.grid(False)
    fig.colorbar(image, ax=ax, label='Number of tested pairs', shrink=.8)
    return fig


def comprehension_summary(comprehension):
    rows = []
    for _, row in comprehension.iterrows():
        correct = json_value(row.get('correctness_responses'), [])
        rows.append(dict(session_label=row.session_label, attempt=row.get('attempts'),
                         questions=len(correct), correct=sum(v == 1 for v in correct),
                         errors=row.get('num_errors'), completed=row.get('done'),
                         review_topic=row.get('review_topic')))
    return pd.DataFrame(rows)


def plot_comprehension(comprehension):
    records = [json_value(value, []) for value in comprehension.correctness_responses]
    width = max(map(len, records), default=0)
    data = np.full((len(records), width), np.nan)
    for i, values in enumerate(records):
        data[i, :len(values)] = values
    fig, ax = plt.subplots(figsize=(10, max(2.2, len(records)*.55)), layout='constrained')
    from matplotlib.colors import ListedColormap
    ax.imshow(data, cmap=ListedColormap(['#c88e70', '#538977']), vmin=0, vmax=1, aspect='auto')
    for i, values in enumerate(records):
        for j, value in enumerate(values):
            ax.text(j, i, 'Correct' if value == 1 else 'Review', ha='center', va='center', fontsize=8, color='white')
    ax.set(xticks=range(width), xticklabels=range(1, width+1), xlabel='Comprehension question',
           yticks=range(len(records)), yticklabels=[f'Attempt {i+1}' for i in range(len(records))],
           title='Comprehension revision across submission attempts')
    ax.grid(False)
    return fig
