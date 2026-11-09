"""Pilot1 effect estimates, timing and compact comparison figures.

The participant is the sampling unit. No outcome or timing cutoff excludes a
participant. The current implementation retains only the shared calculations needed by this
report. Historical v1 source and outputs remain in the private archive.
"""
from pathlib import Path
import hashlib
import json
import platform

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

import drone_analysis as base
from Pilot1_randomization import audit_randomization
from Pilot1_learning_validation import build_learning_validation
from Pilot1_memory_diagnostics import build_memory_diagnostics
from Pilot1_plot_annotations import add_footers, paired_text, fixed_text

SEED = 20261108

LOW_REGIME = 'Low movement / high supply variability'

HIGH_REGIME = 'High movement / low supply variability'

CORE_METRICS = {
    'order_accuracy': ('Order accuracy', 'Fraction correct among answered pairs'),
    'distance_mean': ('Subjective temporal distance', 'Slider units from 0 to 100'),
    'placement_mae_pp': ('Placement absolute error', 'Percentage points'),
    'center_pull_pp': ('Placement pull toward the midpoint', 'Percentage points, off-center probes'),
    'target_mae_pp': ('Collector target error', 'Percentage points'),
    'update_slope': ('Descriptive update slope', 'Next movement per current prediction error'),
}

def mean_ci(values, seed=SEED, n_boot=10000):
    x = np.asarray(pd.to_numeric(pd.Series(values), errors='coerce').dropna(), float)
    if not len(x):
        return dict(n=0, mean=np.nan, sd=np.nan, ci_low=np.nan, ci_high=np.nan)
    if len(x) < 2:
        return dict(n=len(x), mean=float(x.mean()), sd=np.nan, ci_low=np.nan, ci_high=np.nan)
    rng = np.random.default_rng(seed)
    boot = x[rng.integers(0, len(x), size=(n_boot, len(x)))].mean(axis=1)
    lo, hi = np.quantile(boot, [.025, .975])
    return dict(n=len(x), mean=float(x.mean()), sd=float(x.std(ddof=1)), ci_low=float(lo), ci_high=float(hi))

def _regimes(enc, mem):
    """Retain saved labels, add a separate realized-geometry analysis mapping."""
    geometry = []
    for (sid, block), e in enc.groupby(['session_id', 'block']):
        steps = e.target_step.abs()
        offset = base.numeric(e, 'bag_scoring_position')
        offset = offset.fillna(base.numeric(e, 'bag_rendered_position')).fillna(base.numeric(e, 'bag_position'))
        geometry.append(dict(session_id=sid, block=block, session_label=e.session_label.iloc[0],
            valence=e.valence.iloc[0], recorded_vol_level=e.vol_level.iloc[0], recorded_stc_level=e.stc_level.iloc[0],
            mean_nonzero_target_shift_pp=steps[steps.gt(1e-8)].mean(),
            mean_abs_supply_offset_pp=(offset-base.numeric(e, 'drone_position')).abs().mean(),
            canonical_design_idx=base.numeric(e, 'canonical_design_idx').iloc[0]))
    geometry = pd.DataFrame(geometry)
    if geometry.empty:
        raise ValueError('No complete encoding observations are available for group analysis.')
    geometry['analysis_regime'] = pd.NA
    geometry['geometry_valid'] = False
    for _, g in geometry.groupby(['session_id', 'valence']):
        if len(g) != 2 or g.mean_nonzero_target_shift_pp.isna().any() or g.mean_abs_supply_offset_pp.isna().any():
            continue
        lo = g.mean_nonzero_target_shift_pp.idxmin()
        hi = g.mean_nonzero_target_shift_pp.idxmax()
        if lo == hi or not geometry.loc[lo, 'mean_abs_supply_offset_pp'] > geometry.loc[hi, 'mean_abs_supply_offset_pp']:
            continue
        geometry.loc[lo, 'analysis_regime'] = LOW_REGIME
        geometry.loc[hi, 'analysis_regime'] = HIGH_REGIME
        geometry.loc[[lo, hi], 'geometry_valid'] = True
    expected_vol = geometry.analysis_regime.map({LOW_REGIME: 'low', HIGH_REGIME: 'high'})
    expected_stc = geometry.analysis_regime.map({LOW_REGIME: 'high', HIGH_REGIME: 'low'})
    geometry['saved_labels_agree'] = (geometry.recorded_vol_level.eq(expected_vol) & geometry.recorded_stc_level.eq(expected_stc))
    if not geometry.geometry_valid.all():
        raise ValueError('Realized regime geometry is not identifiable for every included condition block; inspect the private geometry audit.')
    cols = ['session_id', 'block', 'analysis_regime']
    enc = enc.merge(geometry[cols], on=['session_id', 'block'], how='left', validate='many_to_one')
    mem = mem.merge(geometry[cols], on=['session_id', 'block'], how='left', validate='many_to_one')
    return enc, mem, geometry

def prepare(intake):
    ids = list(intake['analysis_session_ids'])
    if not ids:
        raise ValueError('No submitted sessions currently meet the documented intake inclusion rules.')
    tables = base.prepare_tables(intake['tables'], ids)
    enc, mem, geometry = _regimes(tables['encoding'], tables['memory'])
    mem['true_target_rounded'] = mem.placement_target_pct.round(6)
    mem['crosses_change'] = mem.hidden_change_count.gt(0).where(mem.span_observed.eq(True))
    mem['center_pull_pp'] = mem.placement_error_pp * np.sign(50 - mem.placement_target_pct)
    mem.loc[np.isclose(mem.placement_target_pct, 50), 'center_pull_pp'] = np.nan
    tables['encoding'], tables['memory'] = enc, mem
    return tables, geometry

def condition_summary(enc, mem):
    rows = []
    for (sid, block), e in enc.groupby(['session_id', 'block']):
        m = mem.loc[mem.session_id.eq(sid) & mem.block.eq(block)]
        xy = e[['outcome_error', 'collector_update']].dropna()
        rank_ok = len(xy) >= 5 and np.ptp(xy.outcome_error) > 1e-8
        slope = np.linalg.lstsq(np.c_[np.ones(len(xy)), xy.outcome_error], xy.collector_update, rcond=None)[0][1] if rank_ok else np.nan
        row = dict(session_id=sid, session_label=e.session_label.iloc[0], block=block,
            valence=e.valence.iloc[0], analysis_regime=e.analysis_regime.iloc[0],
            order_correct=int(base.numeric(m, 'order_correct_bin').sum()), order_answered=int(m.order_answered.sum()),
            order_accuracy=base.numeric(m, 'order_correct_bin').mean(),
            order_accuracy_intended=base.numeric(m, 'order_correct_bin').sum()/14,
            distance_answered=int(m.distance_answered.sum()), distance_mean=base.numeric(m, 'distance_estimate').mean(),
            placement_answered=int(m.placement_answered.sum()), placement_mae_pp=m.placement_abs_error_pp.mean(),
            placement_bias_pp=m.placement_error_pp.mean(), center_pull_pp=m.center_pull_pp.mean(),
            target_mae_pp=e.abs_target_error.mean(), caught_fraction=base.numeric(e, 'supply_caught').mean()/10,
            update_slope=slope, update_transitions=len(xy),
            stationary_fraction=base.boolean(e, 'stayed').astype(float).mean())
        rows.append(row)
    return pd.DataFrame(rows)

def descriptive_summary(condition, mem):
    rows = []
    for metric in [*CORE_METRICS, 'placement_bias_pp', 'order_accuracy_intended', 'caught_fraction', 'stationary_fraction']:
        participant = condition.groupby('session_id')[metric].mean()
        rows.append(dict(metric=metric, **mean_ci(participant)))
    descriptive = pd.DataFrame(rows)
    stage_rows = []
    for s in ['order','distance','placement']:
        answered = mem[f'{s}_answered']
        own_omission = base.boolean(mem, f'{s}_final_omission').fillna(False) & ~answered
        not_reached = (~mem.order_answered & ~answered) if s != 'order' else pd.Series(False, index=mem.index)
        # These are distinct denominators, not three independent omission rates.
        stage_rows.append(dict(stage=s,intended=len(condition)*14,answered=int(answered.sum()),
            unanswered=int((~answered).sum()), own_final_omissions=int(own_omission.sum()),
            not_reached_after_order_omission=int(not_reached.sum()),
            other_unanswered=int((~answered & ~own_omission & ~not_reached).sum())))
    stage = pd.DataFrame(stage_rows)
    return descriptive, stage

def placement_benchmarks(mem):
    """Post-outcome descriptive strategies, matched to observed target weights.

    These benchmarks are not new confirmatory hypothesis tests. Constant 50
    exploits the task's target distribution; it is not a random-memory model.
    """
    valid=mem.loc[mem.placement_answered].copy()
    valid['observed_mae_pp']=valid.placement_abs_error_pp
    target=valid.placement_target_pct
    valid['constant_midpoint_mae_pp']=(50-target).abs()
    valid['uniform_rating_expected_mae_pp']=(target**2+(100-target)**2)/200
    valid['actual_minus_midpoint_pp']=valid.observed_mae_pp-valid.constant_midpoint_mae_pp
    valid['actual_minus_uniform_pp']=valid.observed_mae_pp-valid.uniform_rating_expected_mae_pp
    metrics=['observed_mae_pp','constant_midpoint_mae_pp','uniform_rating_expected_mae_pp',
             'actual_minus_midpoint_pp','actual_minus_uniform_pp']
    rows=[]
    for label,frame in [('All answered',valid),('One intervening item',valid.loc[valid.true_gap.eq(1)]),
                        ('Two intervening items',valid.loc[valid.true_gap.eq(2)])]:
        participants=frame.groupby(['session_id','block'])[metrics].mean().groupby('session_id').mean()
        for metric in metrics:rows.append(dict(separation=label,metric=metric,**mean_ci(participants[metric])))
    return pd.DataFrame(rows)


VERSION = 'Pilot1-diagnostics-v5-20261109'
FACTORS = {
    'Uncertainty regime': ('analysis_regime', LOW_REGIME, HIGH_REGIME,
                           ['LowVol + highSto', 'HighVol + lowSto']),
    'Valence': ('valence', 'loss', 'reward', ['Loss', 'Reward'])}
METRICS = {
    'update_slope': ('Error driven update gain', 'Next movement / prediction error'),
    'target_mae_pp': ('Hidden target tracking error', 'Absolute error in percentage points'),
    'order_accuracy': ('Temporal order accuracy', 'Fraction correct among answered pairs'),
    'distance_mean': ('Temporal distance rating', 'Slider units from 0 to 100'),
    'placement_mae_pp': ('Placement absolute error', 'Percentage points'),
    'placement_bias_pp': ('Signed placement bias', 'Response minus true position in percentage points'),
    'center_pull_pp': ('Pull toward the midpoint', 'Percentage points for off center probes'),
    'game_initiation_ms': ('Collector movement initiation', 'Milliseconds among moving turns'),
    'order_initiation_ms': ('Order decision time', 'Milliseconds from question onset'),
    'distance_initiation_ms': ('Distance response initiation', 'Milliseconds from question onset'),
    'placement_initiation_ms': ('Placement response initiation', 'Milliseconds from question onset'),
    'distance_adjustment_ms': ('Distance adjustment time', 'Milliseconds after the first arrow press'),
    'placement_adjustment_ms': ('Placement adjustment time', 'Milliseconds after the first arrow press'),
    'distance_submission_ms': ('Distance total response time', 'Milliseconds from question onset'),
    'placement_submission_ms': ('Placement total response time', 'Milliseconds from question onset'),
}


def truth(series):
    return series.astype(str).str.lower().isin(['true', '1', '1.0'])


def response_timing(tables, condition):
    enc, mem = tables['encoding'], tables['memory']
    events = tables['response_events'].copy()
    events = events.loc[events.module.eq('memory') & events.response_stage.isin(['order', 'distance', 'placement'])]
    keys = ['session_id', 'block', 'pair_index', 'response_stage']
    numeric = ['first_interaction_rt_ms', 'submitted_rt_ms', 'stage_visible_rt_ms', 'response_attempt', 'row_sequence']
    for key in numeric:
        events[key] = pd.to_numeric(events[key], errors='coerce')
    events['timed_out'] = truth(events.stage_timed_out)
    events['answered'] = ~events.timed_out & events.first_interaction_rt_ms.notna() & events.submitted_rt_ms.notna()
    success = events.loc[events.answered].sort_values('row_sequence')
    if success.duplicated(keys).any():
        raise ValueError('Multiple successful events for one memory stage require explicit review')
    success = success.merge(condition[['session_id','block','valence','analysis_regime']], on=['session_id','block'], validate='many_to_one')
    success['initiation_ms'] = success.first_interaction_rt_ms
    success['submission_ms'] = success.submitted_rt_ms
    success['adjustment_ms'] = success.submission_ms - success.initiation_ms
    success['display_adjusted_initiation_ms'] = success.initiation_ms - success.stage_visible_rt_ms
    checks = []
    for stage in ['order', 'distance', 'placement']:
        q = success.loc[success.response_stage.eq(stage)]
        expected = mem.loc[mem[f'{stage}_answered'], ['session_id','block','pair_index',f'{stage}_rt']]
        joined = expected.merge(q, on=['session_id','block','pair_index'], how='outer', indicator=True, validate='one_to_one')
        agreement = (pd.to_numeric(joined[f'{stage}_rt'], errors='coerce') - joined.submission_ms).abs().le(2)
        checks.append(dict(stage=stage, intended_pairs=len(mem), answered=len(expected),
                           timed_out_attempts=int(events.loc[events.response_stage.eq(stage),'timed_out'].sum()),
                           answered_events=len(q), event_summary_matches=int((joined['_merge'].eq('both') & agreement).sum()),
                           valid_time_order=int((q.initiation_ms.ge(0) & q.adjustment_ms.ge(0)).sum()),
                           below_150_ms=int(q.initiation_ms.lt(150).sum()),
                           automatic_submissions=int(q.submit_method.eq('automatic_after_first_move').sum()),
                           manual_submissions=int(q.submit_method.isin(['keyboard_confirm','arrow_key']).sum()),
                           display_adjusted_negative=int(q.display_adjusted_initiation_ms.lt(0).sum())))
    c = condition.copy()
    moving = enc.loc[pd.to_numeric(enc.num_moves,errors='coerce').gt(0)]
    med = moving.groupby(['session_id','block']).rt_first_move_ms.median()
    c = c.merge(med.rename('game_initiation_ms'), on=['session_id','block'], how='left', validate='one_to_one')
    for stage in ['order', 'distance', 'placement']:
        q = success.loc[success.response_stage.eq(stage)]
        for field in ['initiation_ms','submission_ms','adjustment_ms']:
            med = q.groupby(['session_id','block'])[field].median().rename(stage+'_'+field)
            c = c.merge(med, on=['session_id','block'], how='left', validate='one_to_one')
    timing_checks = pd.DataFrame(checks)
    if not (timing_checks.answered.eq(timing_checks.answered_events).all() and
            timing_checks.answered.eq(timing_checks.event_summary_matches).all() and
            timing_checks.answered.eq(timing_checks.valid_time_order).all()):
        raise ValueError('Memory timing events do not reconcile with answered pair summaries')
    return c, success, timing_checks


def paired_effects(condition):
    rows, people = [], []
    for name, (factor, low, high, short) in FACTORS.items():
        for metric, (title, unit) in METRICS.items():
            wide = condition.groupby(['session_id',factor])[metric].mean().unstack(factor).reindex(columns=[low,high]).dropna()
            diff = wide[high] - wide[low]
            ci = mean_ci(diff)
            rows.append(dict(comparison=name, metric=metric, outcome=title, unit=unit,
                             first_level=short[0], second_level=short[1],
                             first_mean=wide[low].mean(), second_mean=wide[high].mean(),
                             **ci, positive=int(diff.gt(1e-10).sum()), negative=int(diff.lt(-1e-10).sum()),
                             tied=int(diff.abs().le(1e-10).sum()),
                             paired_standardized_difference=diff.mean()/diff.std(ddof=1) if diff.std(ddof=1)>0 else np.nan))
            for sid in wide.index:
                people.append(dict(session_id=sid, comparison=name, metric=metric,
                                   first_value=wide.loc[sid,low], second_value=wide.loc[sid,high], difference=diff[sid]))
    return pd.DataFrame(rows), pd.DataFrame(people)


def comparison_figure(condition, metrics, title):
    fig, axes = plt.subplots(len(metrics), 2, figsize=(12, 3.1*len(metrics)+.5), squeeze=False, layout='constrained')
    footers = []
    for col, (name, (factor, low, high, short)) in enumerate(FACTORS.items()):
        colors=['#3c7194','#b35c4c'] if factor=='analysis_regime' else ['#b35c4c','#3c7194']
        for row, metric in enumerate(metrics):
            ax = axes[row,col]
            wide = condition.groupby(['session_id',factor])[metric].mean().unstack(factor).reindex(columns=[low,high]).dropna()
            for _, values in wide.iterrows():
                ax.plot([0,1], values, 'o-', color='#8a98a5', alpha=.46, linewidth=.9, markersize=3)
            for j, level in enumerate([low, high]):
                ci = mean_ci(wide[level])
                ax.errorbar(j, ci['mean'], yerr=[[ci['mean']-ci['ci_low']],[ci['ci_high']-ci['mean']]],
                            fmt='o', color=colors[j], capsize=5, ms=8, zorder=10)
            metric_title, unit = METRICS[metric]
            ax.set(xticks=[0,1], xticklabels=short, xlim=(-.25,1.25), ylabel=unit,
                   title=f'{metric_title}\n{name}')
            if metric=='order_accuracy':
                ax.axhline(.5, color='#666',ls=':',lw=1)
                ax.set_ylim(0,1)
            if metric in ['placement_bias_pp','center_pull_pp']:
                ax.axhline(0, color='#666',ls=':',lw=1)
                if metric=='center_pull_pp':
                    ax.axhline(100/6, color='#666',ls='--',lw=1,
                               label='Constant midpoint reference 16.67')
                    ax.legend(frameon=False,fontsize=8,loc='best')
            else:
                ax.set_ylim(bottom=0)
            footers.append((ax, [paired_text(wide[low], wide[high],
                f'{short[1]} minus {short[0]}', mean_ci)]))
            ax.spines[['top','right']].set_visible(False)
            ax.grid(axis='y',alpha=.13)
    # The two intended comparisons use identical units and identical y limits
    # on each row, so axis scaling cannot exaggerate one comparison.
    for row in axes:
        limits=[ax.get_ylim() for ax in row]
        for ax in row:
            ax.set_ylim(min(v[0] for v in limits),max(v[1] for v in limits))
    fig.suptitle(title+'\nEach line is one participant    Colored means and participant bootstrap 95% intervals',fontsize=13)
    add_footers(fig, footers)
    return fig


def _learning_bar_limits(vectors):
    """Common zero based limits retaining all participant values and intervals."""
    finite = [pd.to_numeric(pd.Series(v), errors='coerce').dropna().to_numpy()
              for v in vectors]
    finite = [v for v in finite if len(v)]
    bounds = [0.0]
    for values in finite:
        ci = mean_ci(values)
        bounds.extend([values.min(), values.max(), ci['ci_low'], ci['ci_high']])
    bounds = np.asarray(bounds, float)
    bounds = bounds[np.isfinite(bounds)]
    low, high = float(bounds.min()), float(bounds.max())
    span = max(high-low, .1)
    return (low-.10*span if low < 0 else 0.0, high+.22*span), span


def _learning_bar(ax, x, values, color, width, span, decimals, label=None):
    """Draw one participant mean and its participant bootstrap interval."""
    ci = mean_ci(values)
    ax.bar(x, ci['mean'], width=width, color=color, alpha=.65,
           edgecolor=color, linewidth=.8, label=label, zorder=1)
    ax.errorbar(x, ci['mean'],
                yerr=[[ci['mean']-ci['ci_low']], [ci['ci_high']-ci['mean']]],
                fmt='none', ecolor='#273640', capsize=5, linewidth=1.3,
                zorder=5)
    negative = ci['mean'] < 0
    anchor = ci['ci_low']-.035*span if negative else ci['ci_high']+.035*span
    ax.text(x, anchor, f'{ci["mean"]:.{decimals}f}', ha='center',
            va='top' if negative else 'bottom', fontsize=10,
            fontweight='bold', color='#273640', zorder=6)


def learning_bar_figure(condition):
    """The two intended marginal comparisons without changing the estimands."""
    metrics = ['update_slope', 'target_mae_pp']
    fig, axes = plt.subplots(2, 2, figsize=(12, 7.3), layout='constrained')
    footers = []
    for row, metric in enumerate(metrics):
        panels = []
        for name, (factor, low, high, short) in FACTORS.items():
            wide = (condition.groupby(['session_id', factor])[metric].mean()
                    .unstack(factor).reindex(columns=[low, high]).dropna())
            panels.append((name, factor, low, high, short, wide))
        limits, span = _learning_bar_limits(
            [wide[level] for _, _, low, high, _, wide in panels for level in [low, high]])
        for col, (name, factor, low, high, short, wide) in enumerate(panels):
            ax = axes[row, col]
            colors = ['#3c7194', '#b35c4c'] if factor == 'analysis_regime' else ['#b35c4c', '#3c7194']
            for j, level in enumerate([low, high]):
                _learning_bar(ax, j, wide[level], colors[j], .56, span,
                              3 if metric == 'update_slope' else 2)
            for _, values in wide.iterrows():
                ax.plot([0, 1], values, 'o-', color='#697b88', alpha=.35,
                        linewidth=.7, markersize=3, zorder=3)
            title = 'Learning rate estimate' if metric == 'update_slope' else 'Hidden target tracking error'
            unit = 'OLS update slope β' if metric == 'update_slope' else 'Absolute error in percentage points'
            ax.set(xticks=[0, 1], xticklabels=short, xlim=(-.5, 1.5),
                   ylim=limits, ylabel=unit, title=f'{title}\n{name}')
            ax.axhline(0, color='#687783', linewidth=.7, zorder=0)
            footers.append((ax, [paired_text(wide[low], wide[high],
                f'{short[1]} minus {short[0]}', mean_ci)]))
            ax.grid(axis='y', alpha=.13, zorder=0)
            ax.spines[['top', 'right']].set_visible(False)
    fig.suptitle('Learning and tracking comparisons\nBars show participant means and bootstrap 95% intervals    Thin lines join each participant', fontsize=13)
    add_footers(fig, footers)
    return fig


def _condition_cell_footers(condition, metric):
    """Four simple paired comparisons with the same block/participant weights."""
    lines = []
    for valence in ['reward', 'loss']:
        wide = (condition.loc[condition.valence.eq(valence)]
                .pivot(index='session_id', columns='analysis_regime', values=metric))
        lines.append(paired_text(wide[LOW_REGIME], wide[HIGH_REGIME],
            f'HighVol + lowSto minus LowVol + highSto within {valence}', mean_ci))
    for regime, name in [(LOW_REGIME, 'LowVol + highSto'), (HIGH_REGIME, 'HighVol + lowSto')]:
        wide = (condition.loc[condition.analysis_regime.eq(regime)]
                .pivot(index='session_id', columns='valence', values=metric))
        lines.append(paired_text(wide['loss'], wide['reward'],
            f'Reward minus loss within {name}', mean_ci))
    return lines


def learning_condition_bar_figure(condition):
    """All four cells for learning and tracking with semantic valence colors."""
    metrics = ['update_slope', 'target_mae_pp']
    fig, axes = plt.subplots(1, 2, figsize=(12, 4.1), layout='constrained')
    footers = []
    for ax, metric in zip(axes, metrics):
        data = {}
        for valence in ['reward', 'loss']:
            wide = (condition.loc[condition.valence.eq(valence)]
                    .pivot(index='session_id', columns='analysis_regime', values=metric)
                    .reindex(columns=[LOW_REGIME, HIGH_REGIME]).dropna())
            data[valence] = wide
        limits, span = _learning_bar_limits(
            [wide[level] for wide in data.values() for level in [LOW_REGIME, HIGH_REGIME]])
        for shift, valence, color in [(-.18, 'reward', '#3c7194'), (.18, 'loss', '#b35c4c')]:
            wide = data[valence]
            for j, level in enumerate([LOW_REGIME, HIGH_REGIME]):
                _learning_bar(ax, j+shift, wide[level], color, .30, span,
                              3 if metric == 'update_slope' else 2,
                              label=valence.capitalize() if j == 0 else None)
            for _, values in wide.iterrows():
                ax.plot(np.arange(2)+shift, values, 'o-', color=color,
                        alpha=.22, linewidth=.65, markersize=2.5, zorder=3)
        title = 'Learning rate estimate' if metric == 'update_slope' else 'Hidden target tracking error'
        unit = 'OLS update slope β' if metric == 'update_slope' else 'Absolute error in percentage points'
        ax.set(xticks=[0, 1], xticklabels=['LowVol + highSto', 'HighVol + lowSto'],
               ylim=limits, xlim=(-.55, 1.55), title=title, ylabel=unit)
        ax.axhline(0, color='#687783', linewidth=.7, zorder=0)
        ax.grid(axis='y', alpha=.13, zorder=0)
        ax.spines[['top', 'right']].set_visible(False)
        ax.legend(frameon=False, loc='upper left', ncol=2, fontsize=9)
        footers.append((ax, _condition_cell_footers(condition, metric)))
    fig.suptitle('Learning and tracking in all four conditions\nEach cell contains 15 participant block estimates', fontsize=13)
    add_footers(fig, footers)
    return fig


def cell_figure(condition):
    metrics = ['order_accuracy','distance_mean','placement_mae_pp']
    fig, axes = plt.subplots(1,3,figsize=(14,4),layout='constrained')
    footers = []
    for ax, metric in zip(axes.flat, metrics):
        for j,(val,color) in enumerate([('loss','#b35c4c'),('reward','#3c7194')]):
            subset=condition.loc[condition.valence.eq(val)]
            summaries=[mean_ci(subset.loc[subset.analysis_regime.eq(regime),metric])
                       for regime in [LOW_REGIME,HIGH_REGIME]]
            means=np.array([c['mean'] for c in summaries])
            ax.errorbar(np.arange(2)+(j-.5)*.07,means,
                yerr=np.array([[c['mean']-c['ci_low'] for c in summaries],[c['ci_high']-c['mean'] for c in summaries]]),
                color=color,marker='o',capsize=4,label=val.capitalize())
        ax.set(xticks=[0,1],xticklabels=['LowVol + highSto','HighVol + lowSto'],title=METRICS[metric][0],ylabel=METRICS[metric][1])
        ax.spines[['top','right']].set_visible(False)
        ax.legend(frameon=False)
        footers.append((ax, _condition_cell_footers(condition, metric)))
    fig.suptitle('Memory in all four condition cells',fontsize=14)
    add_footers(fig, footers)
    return fig


def calibration_figure(mem):
    fig,axes=plt.subplots(2,2,figsize=(12,8),layout='constrained')
    footers = []
    for col,(name,(factor,lo,hi,short)) in enumerate(FACTORS.items()):
        colors=['#3c7194','#b35c4c'] if factor=='analysis_regime' else ['#b35c4c','#3c7194']
        for level,label,color in zip([lo,hi],short,colors):
            q=mem.loc[mem[factor].eq(level)]
            for row,(stratum,value) in enumerate([('true_gap','distance_estimate'),('true_target_rounded','placement_slider_value')]):
                block=q.groupby(['session_id','block',stratum])[value].mean()
                person=block.groupby(['session_id',stratum]).mean().reset_index()
                xs=sorted(person[stratum].unique())
                cs=[mean_ci(person.loc[person[stratum].eq(x),value]) for x in xs]
                axes[row,col].errorbar(xs,[c['mean'] for c in cs],
                    yerr=np.array([[c['mean']-c['ci_low'] for c in cs],[c['ci_high']-c['mean'] for c in cs]]),
                    marker='o',capsize=4,label=label,color=color)
        axes[0,col].set(title=name,xlabel='Actual intervening items',ylabel='Mean distance rating',xticks=[1,2],ylim=(0,100))
        axes[1,col].plot([0,100],[0,100],':',color='gray',label='Accurate placement')
        axes[1,col].axhline(50,color='gray',ls='--',alpha=.5,label='Constant midpoint')
        axes[1,col].set(xlabel='True temporal position in percent',ylabel='Mean placement response',xticks=[100/3,50,200/3],ylim=(0,100),xlim=(25,75))
        for row, (stratum, value) in enumerate([('true_gap', 'distance_estimate'),
                                               ('true_target_rounded', 'placement_slider_value')]):
            block = mem.groupby(['session_id', 'block', factor, stratum])[value].mean()
            person = block.groupby(['session_id', factor, stratum]).mean().reset_index()
            texts = []
            for x in sorted(person[stratum].unique()):
                wide = (person.loc[person[stratum].eq(x)]
                        .pivot(index='session_id', columns=factor, values=value))
                target = f'Gap {int(x)}' if row == 0 else f'True position {x:.1f}%'
                label = f'{target}   {short[1]} minus {short[0]}'
                texts.append(paired_text(wide[lo], wide[hi], label, mean_ci))
            footers.append((axes[row, col], texts))
    for ax in axes.flat:
        ax.legend(frameon=False,fontsize=9)
        ax.spines[['top','right']].set_visible(False)
    fig.suptitle('Memory calibration by the two intended comparisons\nIntervals resample participants rather than memory pairs',fontsize=14)
    add_footers(fig, footers)
    return fig


def timing_figure(success, condition):
    fig,axes=plt.subplots(1,3,figsize=(13,3.8),layout='constrained')
    footers = []
    for ax,stage in zip(axes,['order','distance','placement']):
        q=success.loc[success.response_stage.eq(stage)]
        for method,color in [('arrow_key','#3c7194'),('keyboard_confirm','#3c7194'),('automatic_after_first_move','#b35c4c')]:
            v=q.loc[q.submit_method.eq(method),'adjustment_ms']/1000
            if len(v):
                ax.hist(v,bins=np.linspace(0,7.5,31),color=color,alpha=.65,label=method.replace('_',' '))
        if stage!='order':
            ax.axvline(7,ls=':',color='black',label='Automatic timer')
        ax.set(title=stage.capitalize(),xlabel='Seconds after the first response',ylabel='Answered stages')
        ax.legend(fontsize=8,frameon=False)
        ax.spines[['top','right']].set_visible(False)
        texts = []
        metric = f'{stage}_adjustment_ms'
        for name, (factor, lo, hi, short) in FACTORS.items():
            wide = (condition.groupby(['session_id', factor])[metric].mean()
                    .unstack(factor).reindex(columns=[lo, hi]))/1000
            texts.append(paired_text(wide[lo], wide[hi],
                f'Block median seconds   {short[1]} minus {short[0]}', mean_ci))
        footers.append((ax, texts))
    fig.suptitle('Timing mechanism check    Manual confirmation and automatic submission remain distinct',fontsize=13)
    add_footers(fig, footers)
    return fig


def learning_timecourse(enc):
    q=enc.copy()
    q['turn_bin']=((q.trial-1)//10).astype(int)*10+5.5
    block=q.groupby(['session_id','block','valence','analysis_regime','turn_bin']).abs_target_error.mean().reset_index()
    fig,axes=plt.subplots(1,2,figsize=(12,3.8),layout='constrained')
    footers = []
    for ax,valence in zip(axes,['loss','reward']):
        for level,label,color in [(LOW_REGIME,'LowVol + highSto','#3c7194'),(HIGH_REGIME,'HighVol + lowSto','#b35c4c')]:
            d=block.loc[block.valence.eq(valence)&block.analysis_regime.eq(level)]
            xs=sorted(d.turn_bin.unique()); cs=[mean_ci(d.loc[d.turn_bin.eq(x),'abs_target_error']) for x in xs]
            ys=[c['mean'] for c in cs]
            ax.plot(xs,ys,'o-',label=label,color=color)
            ax.fill_between(xs,[c['ci_low'] for c in cs],[c['ci_high'] for c in cs],color=color,alpha=.12)
        ax.set(title=valence.capitalize(),xlabel='Within block turn bin center',ylabel='Absolute target error in percentage points')
        ax.legend(frameon=False);ax.spines[['top','right']].set_visible(False)
        overall = (enc.loc[enc.valence.eq(valence)]
                   .groupby(['session_id', 'analysis_regime']).abs_target_error.mean()
                   .unstack('analysis_regime'))
        footers.append((ax, [paired_text(overall[LOW_REGIME], overall[HIGH_REGIME],
            'Overall block mean\nHighVol + lowSto minus LowVol + highSto', mean_ci)]))
    fig.suptitle('Tracking across the block    Same fixed change schedule in each condition',fontsize=13)
    add_footers(fig, footers)
    return block,fig


def period_sensitivity(condition):
    """Marginal OLS contrasts with participant and displayed period effects.

    A descriptive imbalance check, not an additional significance test.
    """
    import statsmodels.formula.api as smf
    frame=condition.copy()
    frame['reward']=frame.valence.eq('reward').astype(int)
    frame['high']=frame.analysis_regime.eq(HIGH_REGIME).astype(int)
    rows=[]
    for metric in ['update_slope','order_accuracy','distance_mean','placement_mae_pp']:
        fit=smf.ols(f'{metric} ~ C(session_id) + C(block) + reward * high',frame).fit()
        for comparison,key,interaction in [('Valence','reward','reward:high'),('Uncertainty regime','high','reward:high')]:
            estimate=fit.params[key]+.5*fit.params[interaction]
            rows.append(dict(comparison=comparison,metric=metric,period_adjusted_difference=estimate))
    return pd.DataFrame(rows)


def calculation_flow():
    fig,ax=plt.subplots(figsize=(12,2.5),layout='constrained')
    ax.set(xlim=(0,1),ylim=(0,1));ax.axis('off')
    labels=['Confirm the recorded\nconditions and coverage','Evaluate learning\nacross uncertainty regimes','Check memory\nsensitivity and response use','Explore condition\ndifferences with these limits']
    xs=np.linspace(.12,.88,4)
    for i,(x,label) in enumerate(zip(xs,labels)):
        ax.text(x,.67,label,ha='center',va='center',fontsize=10,fontweight='bold',color='#27475e')
        if i<3:
            ax.annotate('',xy=(xs[i+1]-.08,.67),xytext=(x+.08,.67),arrowprops=dict(arrowstyle='->',color='#74838d',lw=1.5))
    ax.text(.5,.25,'Matched participants → Block summaries → Participant comparisons     Timing and omissions retained throughout',ha='center',fontsize=10)
    add_footers(fig, [(ax, [fixed_text(None, 'Workflow diagram without a numerical contrast')])])
    return fig


def run_comparisons(batch_root, intake=None):
    import Pilot1_intake
    batch=Path(batch_root)
    root=batch.parents[2]
    intake=intake or Pilot1_intake.load_Pilot1(batch)
    tables,geometry=prepare(intake)
    condition=condition_summary(tables['encoding'],tables['memory'])
    condition,success,timing_checks=response_timing(tables,condition)
    effects,paired=paired_effects(condition)
    sensitivity=period_sensitivity(condition).merge(effects[['comparison','metric','mean']],on=['comparison','metric'],validate='one_to_one')
    randomization=audit_randomization(intake,tables,geometry,root)
    if randomization['checks'].status.ne('Pass').any():
        raise ValueError('Randomization checks require review before interpreting conditions')
    descriptions,stages=descriptive_summary(condition,tables['memory'])
    benchmark_summary=placement_benchmarks(tables['memory'])
    learning_validation=build_learning_validation(condition,tables['encoding'],mean_ci,root=root)
    memory_diagnostics=build_memory_diagnostics(tables['memory'],condition,mean_ci)
    timecourse,time_fig=learning_timecourse(tables['encoding'])
    figures={
        'learning_comparisons':learning_bar_figure(condition),
        'learning_condition_bars':learning_condition_bar_figure(condition),
        'memory_comparisons':comparison_figure(condition,['order_accuracy','distance_mean','placement_mae_pp'],'Memory performance'),
        'placement_bias_comparisons':comparison_figure(condition,['placement_bias_pp','center_pull_pp'],'Placement response biases'),
        'memory_calibration':calibration_figure(tables['memory']),
        'condition_cells':cell_figure(condition),
        'response_initiation':comparison_figure(condition,['game_initiation_ms','order_initiation_ms','distance_initiation_ms','placement_initiation_ms'],'Response initiation'),
        'slider_timing':comparison_figure(condition,['distance_adjustment_ms','placement_adjustment_ms'],'Slider adjustment duration'),
        'timing_mechanism':timing_figure(success, condition),
        'tracking_timecourse':time_fig,
        'randomization':randomization['figure'],
        'calculation_flow':calculation_flow()}
    figures.update(learning_validation['figures'])
    figures.update(memory_diagnostics['figures'])
    out=batch/'derived/group_analysis'
    out.mkdir(parents=True,exist_ok=True)
    paths={}
    annotations=[]
    for name,fig in figures.items():
        for panel_index, panel in enumerate(getattr(fig, '_pilot1_footers', []), start=1):
            for statistic_index, text in enumerate(panel['texts'], start=1):
                annotations.append(dict(figure=name,panel=panel_index,
                    title=panel['chart'].get_title(),statistic=statistic_index,text=text.get_text()))
        path=out/'figures'/f'{name}.png';path.parent.mkdir(exist_ok=True)
        fig.savefig(path,dpi=180,bbox_inches='tight');paths[name]=path
        plt.close(fig)
    exports={'focused_condition_summary':condition,'focused_effects':effects,'focused_paired_values':paired,
             'memory_response_times':success,'timing_recording_checks':timing_checks,
             'randomization_checks':randomization['checks'],'randomization_balance':randomization['balance'],
             'randomization_diversity':randomization['diversity'],'tracking_timecourse':timecourse,
             'period_sensitivity':sensitivity,
             'placement_strategy_benchmarks':benchmark_summary,'response_denominators':stages,
             'plot_annotations':pd.DataFrame(annotations)}
    exports.update(learning_validation['tables'])
    exports.update(memory_diagnostics['tables'])
    for name,frame in exports.items():
        frame.to_csv(out/f'{name}.csv',index=False)
    summary=dict(version=VERSION,participants=len(condition.session_id.unique()),
        comparison_unit='Participant with equally weighted blocks',rt_summary='Median answered RT per block, then equal block average per factor level',
        ci='10000 participant bootstrap resamples with fixed seed',
        plot_annotations='Dedicated footer areas state each paired contrast direction and numerical 95% interval; fixed design and allocation summaries have no sampling interval',
        scope='Pilot estimates and individual directions, no significance gate or new exclusion',
        interpretation_order=['Learning validation','Memory sensitivity','Exploratory condition patterns','Timing and recording diagnostics'],
        uncertainty_tracking_status='Provisional. Memory contrasts do not establish uncertainty tracking.',
        randomization_checks_pass=int(randomization['checks'].status.eq('Pass').sum()),
        randomization_checks_total=len(randomization['checks']),figures={k:v.name for k,v in paths.items()})
    (out/'focused_analysis_summary.json').write_text(json.dumps(summary,indent=2)+'\n')
    return dict(intake=intake,tables=tables,geometry=geometry,condition=condition,effects=effects,
                paired=paired,timing=success,timing_checks=timing_checks,randomization=randomization,
                descriptions=descriptions,stages=stages,benchmark_summary=benchmark_summary,sensitivity=sensitivity,
                learning_validation=learning_validation,memory_diagnostics=memory_diagnostics,
                figures=figures,figure_paths=paths,summary=summary)


def display_effects(result, metrics):
    """Safe aggregate table; never exposes private join keys."""
    q=result['effects'].loc[result['effects'].metric.isin(metrics)].copy()
    q['Difference and 95% interval']=q.apply(lambda x:f'{x["mean"]:+.3f} [{x.ci_low:+.3f}, {x.ci_high:+.3f}]',axis=1)
    q['Higher / lower / tied']=q.apply(lambda x:f'{x.positive} / {x.negative} / {x.tied}',axis=1)
    return q[['comparison','outcome','first_mean','second_mean','Difference and 95% interval','Higher / lower / tied','n']].rename(
        columns={'first_mean':'First level','second_mean':'Second level','n':'Participants'}).round(3).reset_index(drop=True)


def write_provenance(root,batch,notebook):
    root,batch=Path(root),Path(batch)
    paths=[root/'analysis/drone_task'/name for name in ['Pilot1_analysis.py','Pilot1_intake.py','Pilot1_randomization.py',
        'Pilot1_learning_validation.py','Pilot1_memory_diagnostics.py','Pilot1_plot_annotations.py',
        'drone_analysis.py','references/Piray2024_learning_benchmark.json']]
    paths += [root/'analysis/session_io.py',root/'analysis/split_drone_data.py']
    hashes={str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}
    path=batch/'derived/group_analysis/focused_provenance.json'
    source=json.loads(Path(notebook).read_text())
    notebook_source='\n'.join(''.join(c['source']) for c in source['cells'])
    path.write_text(json.dumps(dict(version=VERSION,python=platform.python_version(),source_sha256=hashes,
        notebook_source_sha256=hashlib.sha256(notebook_source.encode()).hexdigest()),indent=2)+'\n')
    return pd.DataFrame({'Material':['Analysis helpers','Executed notebook','Private outputs','Raw source files'],
                         'Policy':['SHA256 recorded','Run with drone-design kernel','Retain joins in ignored batch folder','Preserved without modification']})
