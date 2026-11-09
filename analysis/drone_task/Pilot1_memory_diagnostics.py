"""Descriptive memory sensitivity checks for Pilot1.

No participant is excluded for an outcome. Differences require both relevant
strata within a block. Repeated trials never become independent people.
"""
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from Pilot1_plot_annotations import paired_text, add_footers

LOW_REGIME = 'Low movement / high supply variability'
HIGH_REGIME = 'High movement / low supply variability'
BLOCK_KEYS = ['session_id', 'block', 'valence', 'analysis_regime']
FACTORS = {
    'Uncertainty regime': ('analysis_regime', [LOW_REGIME, HIGH_REGIME],
                           ['LowVol + highSto', 'HighVol + lowSto'], ['#3c7194', '#b35c4c']),
    'Valence': ('valence', ['loss', 'reward'], ['Loss', 'Reward'], ['#b35c4c', '#3c7194']),
}
TARGETS = [round(100/3, 6), 50.0, round(200/3, 6)]
EARLY, MIDDLE, LATE = TARGETS
METRICS = {
    'distance_gap_difference': ('Temporal distance sensitivity', 'Gap two minus gap one in rating units'),
    'placement_discrimination': ('Temporal placement discrimination', 'Late minus early response in percentage points'),
}


def _numeric(frame, column):
    return pd.to_numeric(frame[column], errors='coerce')


def _answered(frame, stage):
    values = frame[f'{stage}_answered']
    return values.astype(str).str.lower().isin(['true', '1', '1.0'])


def _block_strata(mem, condition, stage, stratum, levels, value):
    """Complete design grid keeps unanswered strata distinguishable from zero."""
    frame = mem.copy()
    frame['_value'] = _numeric(frame, value).where(_answered(frame, stage))
    observed = frame.groupby(BLOCK_KEYS+[stratum], dropna=False).agg(
        intended=('_value', 'size'), answered=('_value', 'count'),
        value=('_value', 'mean')).reset_index()
    observed = observed.loc[observed[stratum].isin(levels)]
    grid = condition[BLOCK_KEYS].merge(pd.DataFrame({stratum: levels}), how='cross')
    result = grid.merge(observed, on=BLOCK_KEYS+[stratum], how='left', validate='one_to_one')
    result[['intended', 'answered']] = result[['intended', 'answered']].fillna(0).astype(int)
    result['unanswered'] = result.intended-result.answered
    result['stage'] = stage
    return result


def _difference(blocks, stratum, first, second, metric):
    means = blocks.pivot(index=BLOCK_KEYS, columns=stratum, values='value').reindex(columns=[first, second])
    counts = blocks.pivot(index=BLOCK_KEYS, columns=stratum, values='answered').reindex(columns=[first, second])
    result = means.reset_index()[BLOCK_KEYS]
    result['metric'] = metric
    result['first_value'] = means[first].to_numpy()
    result['second_value'] = means[second].to_numpy()
    result['first_answered'] = counts[first].to_numpy()
    result['second_answered'] = counts[second].to_numpy()
    result['paired_support'] = means.notna().all(axis=1).to_numpy()
    result['value'] = (means[second]-means[first]).to_numpy()
    return result


def _participant_factor(blocks, factor, metric=None, strata=None):
    keys = ['session_id', factor]+list(strata or [])
    data = blocks.loc[blocks.metric.eq(metric)] if metric is not None else blocks
    return data.groupby(keys, dropna=False).agg(
        value=('value', 'mean'), contributing_blocks=('value', 'count'),
        first_answered=('first_answered', 'sum') if 'first_answered' in data else ('answered', 'sum'),
        second_answered=('second_answered', 'sum') if 'second_answered' in data else ('answered', 'sum'),
    ).reset_index()


def _ci_points(ax, x, values, color, mean_ci):
    ci = mean_ci(values)
    if ci['n']:
        ax.errorbar(x, ci['mean'], yerr=[[ci['mean']-ci['ci_low']],
                                       [ci['ci_high']-ci['mean']]],
                    fmt='o', color=color, capsize=4, markersize=7, zorder=5)
    return ci


def _order_gap_figure(order, mean_ci):
    fig, axes = plt.subplots(1, 2, figsize=(12, 4.3), layout='constrained')
    footers = []
    for ax, (title, (factor, levels, labels, colors)) in zip(axes, FACTORS.items()):
        p = _participant_factor(order, factor, strata=['true_gap'])
        for index, (level, label, color) in enumerate(zip(levels, labels, colors)):
            q = p.loc[p[factor].eq(level)]
            xs = np.array([1, 2])+(index-.5)*.06
            means = []
            for x, gap in zip(xs, [1, 2]):
                values = q.loc[q.true_gap.eq(gap), 'value'].dropna()
                ci = _ci_points(ax, x, values, color, mean_ci)
                means.append(ci['mean'])
                jitter = np.linspace(-.035, .035, len(values))
                ax.scatter(x+jitter, values, color=color, alpha=.2, s=11, zorder=2)
            ax.plot(xs, means, color=color, label=label, linewidth=1.6)
        ax.axhline(.5, color='#687783', linestyle=':', linewidth=1.2, label='Chance 50%')
        ax.set(title=title, xlabel='Actual number of intervening items',
               ylabel='Order accuracy among answered pairs', xticks=[1, 2], ylim=(0, 1))
        ax.legend(frameon=False, fontsize=9)
        ax.spines[['top', 'right']].set_visible(False)
        ax.grid(axis='y', alpha=.13)
        footer = []
        condition_label = ('HighVol + lowSto minus LowVol + highSto'
                           if factor == 'analysis_regime' else 'Reward minus loss')
        for gap in [1, 2]:
            wide = p.loc[p.true_gap.eq(gap)].pivot(
                index='session_id', columns=factor, values='value').reindex(columns=levels)
            footer.append(paired_text(wide[levels[0]], wide[levels[1]],
                f'{condition_label} at gap {gap}', mean_ci))
        for level, label in zip(levels, labels):
            wide = p.loc[p[factor].eq(level)].pivot(
                index='session_id', columns='true_gap', values='value').reindex(columns=[1, 2])
            footer.append(paired_text(wide[1], wide[2],
                f'Gap two minus gap one in {label}', mean_ci))
        footers.append((ax, footer))
    fig.suptitle('Order memory sensitivity by actual gap\nParticipant means and bootstrap 95% intervals    Chance is evaluated separately at each gap', fontsize=13)
    add_footers(fig, footers)
    return fig


def _discrimination_figure(differences, mean_ci):
    fig, axes = plt.subplots(2, 2, figsize=(12, 8.1), layout='constrained')
    footers = []
    for row, (metric, (title, units)) in enumerate(METRICS.items()):
        panels, bounds = [], [0.0]
        if metric == 'placement_discrimination':
            bounds.append(LATE-EARLY)
        for factor_title, (factor, levels, labels, colors) in FACTORS.items():
            p = _participant_factor(differences, factor, metric)
            wide = p.pivot(index='session_id', columns=factor, values='value').reindex(columns=levels).dropna()
            panels.append((factor_title, levels, labels, colors, wide))
            for level in levels:
                values = wide[level].dropna()
                ci = mean_ci(values)
                bounds.extend(values.tolist()+[ci['ci_low'], ci['ci_high']])
        finite = np.array(bounds, float)
        finite = finite[np.isfinite(finite)]
        span = max(np.ptp(finite), 1)
        limits = (finite.min()-.15*span, finite.max()+.18*span)
        for col, (factor_title, levels, labels, colors, wide) in enumerate(panels):
            ax = axes[row, col]
            for _, values in wide.iterrows():
                ax.plot([0, 1], values, 'o-', color='#84939e', alpha=.36,
                        linewidth=.8, markersize=3)
            for j, (level, color) in enumerate(zip(levels, colors)):
                ci = _ci_points(ax, j, wide[level], color, mean_ci)
                ax.bar(j, ci['mean'], color=color, alpha=.13, width=.5, zorder=0)
            ax.axhline(0, color='#687783', linestyle=':', linewidth=1.2,
                       label='No separation')
            if metric == 'placement_discrimination':
                ax.axhline(LATE-EARLY, color='#687783', linestyle='--', linewidth=1,
                           label='Accurate separation 33.3')
            label = ('HighVol + lowSto minus LowVol + highSto'
                     if factor_title == 'Uncertainty regime' else 'Reward minus loss')
            footers.append((ax, [paired_text(wide[levels[0]], wide[levels[1]],
                                             label, mean_ci)]))
            ax.set(title=f'{title}\n{factor_title}', ylabel=units,
                   xticks=[0, 1], xticklabels=labels, xlim=(-.3, 1.3), ylim=limits)
            ax.spines[['top', 'right']].set_visible(False)
            ax.grid(axis='y', alpha=.13)
    fig.suptitle('Memory sensitivity by actual separation and position\nEach line joins one participant    Group means and participant bootstrap 95% intervals\nDotted zero indicates no separation    Dashed 33.3 indicates accurate placement separation', fontsize=12)
    add_footers(fig, footers)
    return fig


def _histograms(mem, condition):
    bins = np.linspace(0, 100, 11)
    rows = []
    for _, block in condition[BLOCK_KEYS].iterrows():
        q = mem.loc[mem.session_id.eq(block.session_id) & mem.block.eq(block.block)]
        for target in TARGETS:
            values = _numeric(q, 'placement_slider_value').loc[
                q.placement_target_pct.eq(target) & _answered(q, 'placement')].dropna()
            counts, _ = np.histogram(values, bins=bins)
            for index, count in enumerate(counts):
                rows.append(dict(**block.to_dict(), target=target, bin_left=bins[index],
                    bin_right=bins[index+1], answered=len(values),
                    value=count/len(values) if len(values) else np.nan))
    return pd.DataFrame(rows)


def _distribution_figure(histograms, placement, mean_ci):
    fig, axes = plt.subplots(2, 3, figsize=(14, 8.1), layout='constrained')
    largest = 0
    footers = []
    for row, (factor_title, (factor, levels, labels, colors)) in enumerate(FACTORS.items()):
        p = histograms.groupby(['session_id', factor, 'target', 'bin_left', 'bin_right']).value.mean().reset_index()
        summary = p.groupby([factor, 'target', 'bin_left', 'bin_right']).value.mean().reset_index()
        largest = max(largest, summary.value.max()*100)
        for col, target in enumerate(TARGETS):
            ax = axes[row, col]
            for level, label, color in zip(levels, labels, colors):
                q = summary.loc[summary[factor].eq(level) & summary.target.eq(target)].sort_values('bin_left')
                ax.stairs(q.value.to_numpy()*100, np.r_[q.bin_left.to_numpy(), q.bin_right.iloc[-1]],
                          color=color, linewidth=1.8, label=label)
            ax.axvline(target, linestyle=':', color='#5d6970', linewidth=1)
            if target != MIDDLE:
                ax.axvline(50, linestyle='--', color='#9a9fa3', linewidth=.8)
            ax.set(title=f'{factor_title}\nTrue position {target:.1f}%',
                   xlabel='Reported temporal position from 0 to 100',
                   ylabel='Mean percentage of answers', xlim=(0, 100), xticks=[0, 25, 50, 75, 100])
            ax.set_title(f'{factor_title}\nTrue position {target:.1f}%', pad=35)
            ax.legend(frameon=False, fontsize=8, ncol=2, loc='lower left', bbox_to_anchor=(0, 1.01))
            ax.spines[['top', 'right']].set_visible(False)
            actual = placement.loc[placement.placement_target_pct.eq(target)].groupby(
                ['session_id', factor]).value.mean().unstack(factor).reindex(columns=levels)
            label = ('Mean reported position\nHighVol + lowSto minus LowVol + highSto'
                     if factor == 'analysis_regime'
                     else 'Mean reported position\nReward minus loss')
            footers.append((ax, [paired_text(actual[levels[0]], actual[levels[1]],
                                             label, mean_ci)]))
    for ax in axes.flat:
        ax.set_ylim(0, max(10, largest*1.18))
    fig.suptitle('Placement response distributions by actual temporal position\nTen point bins    Equal block and participant weighting\nDotted vertical line marks the true position    Dashed vertical line marks the midpoint', fontsize=12)
    add_footers(fig, footers)
    return fig


def build_memory_diagnostics(mem, condition, mean_ci_fn):
    """Return private tidy tables, aggregate summaries and three figures.

    Missing responses remain absent values with explicit denominators. No
    response values, omissions or participant rows are imputed or excluded.
    """
    required = set(BLOCK_KEYS+['true_gap', 'order_correct_bin', 'distance_estimate',
        'placement_slider_value', 'placement_target_pct', 'order_answered',
        'distance_answered', 'placement_answered'])
    if not required.issubset(mem.columns):
        raise ValueError('Prepared memory data are missing required diagnostic fields')
    frame = mem.copy()
    frame['placement_target_pct'] = _numeric(frame, 'placement_target_pct').round(6)
    for column in ['order_correct_bin', 'distance_estimate', 'placement_slider_value']:
        frame[column] = _numeric(frame, column)
    condition = condition[BLOCK_KEYS].copy()
    if condition.duplicated(['session_id', 'block']).any():
        raise ValueError('Condition summaries must contain one row per participant block')
    order = _block_strata(frame, condition, 'order', 'true_gap', [1, 2], 'order_correct_bin')
    distance = _block_strata(frame, condition, 'distance', 'true_gap', [1, 2], 'distance_estimate')
    placement = _block_strata(frame, condition, 'placement', 'placement_target_pct', TARGETS, 'placement_slider_value')
    differences = pd.concat([
        _difference(distance, 'true_gap', 1, 2, 'distance_gap_difference'),
        _difference(placement, 'placement_target_pct', EARLY, LATE, 'placement_discrimination')], ignore_index=True)
    participant = differences.groupby(['session_id', 'metric']).agg(
        value=('value', 'mean'), contributing_blocks=('value', 'count')).reset_index()
    rows = []
    for gap in [1, 2]:
        p = order.loc[order.true_gap.eq(gap)].groupby('session_id').value.mean()
        rows.append(dict(metric='order_accuracy', stratum=f'Gap {gap}', reference=.5,
                         diagnostic=f'Order accuracy with {gap} intervening items',
                         unit='Fraction correct', reference_label='Chance', ideal=1.0,
                         **mean_ci_fn(p)))
    for metric in METRICS:
        p = participant.loc[participant.metric.eq(metric), 'value']
        rows.append(dict(metric=metric, stratum='All conditions', reference=0,
                         diagnostic=METRICS[metric][0], unit=METRICS[metric][1],
                         reference_label='No separation',
                         ideal=LATE-EARLY if metric=='placement_discrimination' else np.nan,
                         **mean_ci_fn(p)))
    for target in TARGETS:
        p = placement.loc[placement.placement_target_pct.eq(target)].groupby('session_id').value.mean()
        rows.append(dict(metric='placement_reported_position', stratum=f'True {target:.1f}%',
                         reference=target, diagnostic='Mean reported temporal position',
                         unit='Percent of reference interval', reference_label='True position',
                         ideal=target, **mean_ci_fn(p)))
    summary = pd.DataFrame(rows)
    effect_rows = []
    for factor_title, (factor, levels, labels, colors) in FACTORS.items():
        for metric in METRICS:
            p = _participant_factor(differences, factor, metric)
            wide = p.pivot(index='session_id', columns=factor, values='value').reindex(columns=levels).dropna()
            diff = wide[levels[1]]-wide[levels[0]]
            effect_rows.append(dict(comparison=factor_title, metric=metric,
                first_level=labels[0], second_level=labels[1],
                first_mean=wide[levels[0]].mean(), second_mean=wide[levels[1]].mean(),
                positive=int(diff.gt(1e-10).sum()), negative=int(diff.lt(-1e-10).sum()),
                tied=int(diff.abs().le(1e-10).sum()), **mean_ci_fn(diff)))
    effects = pd.DataFrame(effect_rows)
    support = pd.concat([
        order.rename(columns={'true_gap': 'stratum'}),
        distance.rename(columns={'true_gap': 'stratum'}),
        placement.rename(columns={'placement_target_pct': 'stratum'})], ignore_index=True)
    support = support.groupby(['stage', 'valence', 'analysis_regime', 'stratum']).agg(
        intended=('intended', 'sum'), answered=('answered', 'sum'),
        unanswered=('unanswered', 'sum'),
        participant_blocks_with_answers=('answered', lambda values: int(values.gt(0).sum()))).reset_index()
    unknown = frame.placement_target_pct.isna()
    support['unknown_target_pairs_in_cohort'] = 0
    if unknown.any():
        # Unknown planned target is not assigned to a temporal location merely
        # to make the denominator look complete.
        row = dict(stage='placement', valence='All', analysis_regime='All', stratum='Unknown target',
                   intended=int(unknown.sum()), answered=int((_answered(frame, 'placement') & unknown).sum()),
                   unanswered=int((~_answered(frame, 'placement') & unknown).sum()),
                   participant_blocks_with_answers=np.nan,
                   unknown_target_pairs_in_cohort=int(unknown.sum()))
        support = pd.concat([support, pd.DataFrame([row])], ignore_index=True)
    histogram = _histograms(frame, condition)
    figures = dict(order_gap_diagnostic=_order_gap_figure(order, mean_ci_fn),
                   memory_discrimination=_discrimination_figure(differences, mean_ci_fn),
                   placement_response_distributions=_distribution_figure(histogram, placement, mean_ci_fn))
    tables = dict(memory_order_gap_blocks=order, memory_distance_gap_blocks=distance,
        memory_placement_target_blocks=placement, memory_discrimination_blocks=differences,
        memory_diagnostic_participants=participant, memory_diagnostic_summary=summary,
        memory_discrimination_effects=effects, memory_placement_response_histograms=histogram,
        memory_measure_support=support)
    return dict(tables=tables, summary=summary, effects=effects, support=support,
                figures=figures)
