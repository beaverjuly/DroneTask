"""Offline descriptive learning benchmarks for the intended Pilot1 jump task.

Only aggregate published reference values are bundled. This report does not
make a replication pass decision, fit a latent model or exclude participants.
"""
from pathlib import Path
import json

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

from Pilot1_plot_annotations import add_footers, fixed_text, numeric_interval_text

LOW_REGIME = 'Low movement / high supply variability'
HIGH_REGIME = 'High movement / low supply variability'
REFERENCE_PATH = Path(__file__).resolve().parent / 'references/Piray2024_learning_benchmark.json'


def _benchmark_table(condition, reference, mean_ci_fn):
    rows = []
    for study in reference['studies']:
        rows.append(dict(study=study['study'], n=study['contrast']['n'],
            low_mean=study['low']['mean'], low_ci_low=study['low']['ci_low'], low_ci_high=study['low']['ci_high'],
            high_mean=study['high']['mean'], high_ci_low=study['high']['ci_low'], high_ci_high=study['high']['ci_high'],
            difference=study['contrast']['mean'], difference_sd=study['contrast']['sd'],
            ci_low=study['contrast']['ci_low'], ci_high=study['contrast']['ci_high'],
            positive=study['positive'], negative=study['negative'], tied=study['tied'],
            reference_role='Published benchmark from a different noise design'))
    wide=(condition.groupby(['session_id','analysis_regime']).update_slope.mean()
          .unstack('analysis_regime').reindex(columns=[LOW_REGIME,HIGH_REGIME]).dropna())
    low=mean_ci_fn(wide[LOW_REGIME]); high=mean_ci_fn(wide[HIGH_REGIME])
    difference=wide[HIGH_REGIME]-wide[LOW_REGIME]; ci=mean_ci_fn(difference)
    rows.append(dict(study='Pilot1',n=ci['n'],low_mean=low['mean'],low_ci_low=low['ci_low'],low_ci_high=low['ci_high'],
        high_mean=high['mean'],high_ci_low=high['ci_low'],high_ci_high=high['ci_high'],
        difference=ci['mean'],difference_sd=ci['sd'],ci_low=ci['ci_low'],ci_high=ci['ci_high'],
        positive=int(difference.gt(1e-10).sum()),negative=int(difference.lt(-1e-10).sum()),
        tied=int(difference.abs().le(1e-10).sum()),reference_role='Current intended jump task'))
    table=pd.DataFrame(rows)
    table['positive_fraction']=table.positive/table.n
    return table


def _geometry_tables(enc, reference):
    blocks=[]
    for (sid,block),q in enc.groupby(['session_id','block']):
        q=q.sort_values('trial')
        target=pd.to_numeric(q.drone_position,errors='coerce').to_numpy(float)
        supply=pd.to_numeric(q.get('bag_scoring_position',q.bag_position),errors='coerce').fillna(
            pd.to_numeric(q.bag_position,errors='coerce')).to_numpy(float)
        shifts=np.diff(target); finite=np.isfinite(shifts)
        shift=np.abs(shifts[finite]); offsets=supply-target; offsets=offsets[np.isfinite(offsets)]
        changes=shift>1e-8
        blocks.append(dict(session_id=sid,block=block,study='Pilot1',
            regime='LowVol + highSto' if q.analysis_regime.iloc[0]==LOW_REGIME else 'HighVol + lowSto',
            turns=len(q),transitions=int(finite.sum()),target_changes=int(changes.sum()),
            nonzero_shift_mean_pp=float(shift[changes].mean()) if changes.any() else np.nan,
            all_shift_mean_pp=float(shift.mean()) if len(shift) else np.nan,
            supply_offset_sd_pp=float(offsets.std(ddof=0)) if len(offsets) else np.nan,
            supply_offset_mean_abs_pp=float(np.abs(offsets).mean()) if len(offsets) else np.nan,
            supply_offset_mean_square_pp2=float((offsets**2).mean()) if len(offsets) else np.nan))
    private=pd.DataFrame(blocks)
    fields=['turns','transitions','target_changes','nonzero_shift_mean_pp','all_shift_mean_pp',
            'supply_offset_sd_pp','supply_offset_mean_abs_pp','supply_offset_mean_square_pp2']
    pilot=private.groupby(['study','regime'],as_index=False)[fields].mean()
    # Both published experiments use identical geometry. Keep one descriptive
    # geometry row per regime rather than duplicating the reference trajectory.
    published=pd.DataFrame(reference['geometry'])
    published=published.loc[published.study.eq('Piray 2024 Experiment 1'),['study','regime',*fields]].copy()
    published['study']='Piray published arrays'
    comparison=pd.concat([published,pilot],ignore_index=True)
    comparison['offset_sd_ddof']=0
    return private,comparison


def _benchmark_figure(table):
    fig,axes=plt.subplots(2,1,figsize=(11.5,7.6),layout='constrained',gridspec_kw={'height_ratios':[1.1,1]})
    top,bottom=axes
    x=np.arange(len(table))
    for offset,prefix,label,color in [(-.18,'low','LowVol + highSto','#3c7194'),(.18,'high','HighVol + lowSto','#b35c4c')]:
        y=table[prefix+'_mean'].to_numpy()
        top.bar(x+offset,y,.30,color=color,alpha=.72,label=label)
        top.errorbar(x+offset,y,yerr=np.vstack([y-table[prefix+'_ci_low'],table[prefix+'_ci_high']-y]),fmt='none',color='#273640',capsize=4,lw=1.2)
        for j,value in enumerate(y):
            top.text(j+offset,table[prefix+'_ci_high'].iloc[j]+.018,f'{value:.3f}',ha='center',fontsize=10,fontweight='bold')
    labels=[f'Piray Experiment 1\nn = {int(table.n.iloc[0])}',f'Piray Experiment 2\nn = {int(table.n.iloc[1])}',f'Pilot1\nn = {int(table.n.iloc[2])}']
    top.set(xticks=x,xticklabels=labels,ylabel='Block OLS learning rate',ylim=(min(0,table[['low_ci_low','high_ci_low']].min().min()-.04),table[['low_ci_high','high_ci_high']].max().max()+.17),title='Mean learning rates in the two regimes')
    top.legend(frameon=False,loc='upper left',ncol=2,fontsize=9)
    maximum=max(table.ci_high.max(),0);minimum=min(table.ci_low.min(),0)
    span=max(maximum-minimum,.1)
    colors=['#687f8c','#687f8c','#a65d42']
    for j,(_,row) in enumerate(table.iterrows()):
        bottom.errorbar(row.difference,j,xerr=[[row.difference-row.ci_low],[row.ci_high-row.difference]],fmt='o',ms=7,color=colors[j],capsize=4,lw=1.5)
    bottom.axvline(0,color='#687783',lw=1,ls=':')
    bottom.set(yticks=x,yticklabels=['Piray Experiment 1','Piray Experiment 2','Pilot1'],xlabel='HighVol plus lowSto minus lowVol plus highSto',xlim=(minimum-.12*span,maximum+.12*span),ylim=(2.6,-.6),title='Paired participant contrasts and 95 percent bootstrap intervals')
    for ax in axes:
        ax.grid(axis='y' if ax is top else 'x',alpha=.13)
        ax.spines[['top','right']].set_visible(False)
    fig.suptitle('Learning validation before memory interpretation\nPublished values are descriptive benchmarks across different intended designs',fontsize=13)
    # These are paired contrast intervals, not differences between the marginal
    # error-bar endpoints shown above. Keep the same contrast under both views.
    footer=[]
    for j,(_,row) in enumerate(table.iterrows()):
        study=['Piray Experiment 1','Piray Experiment 2','Pilot1'][j]
        label=f'{study} highVol + lowSto minus lowVol + highSto, {int(row.positive)}/{int(row.n)} positive'
        footer.append(numeric_interval_text(row.difference,row.ci_low,row.ci_high,label))
    add_footers(fig,[(top,footer),(bottom,footer)])
    return fig


def _geometry_figure(comparison):
    fig,axes=plt.subplots(1,2,figsize=(11.5,3.8),layout='constrained')
    studies=['Piray published arrays','Pilot1']
    for ax,metric,title,unit in zip(axes,['target_changes','supply_offset_sd_pp'],
            ['Intended target change schedule','Realised supply scatter around the target'],
            ['Changes among 49 transitions','Offset standard deviation in percentage points']):
        for offset,regime,color in [(-.18,'LowVol + highSto','#3c7194'),(.18,'HighVol + lowSto','#b35c4c')]:
            values=comparison.loc[comparison.regime.eq(regime)].set_index('study').reindex(studies)[metric]
            ax.bar(np.arange(2)+offset,values,.30,color=color,alpha=.72,label=regime)
            for j,value in enumerate(values):ax.text(j+offset,value+(1.1 if metric=='target_changes' else .16),f'{value:.0f}' if metric=='target_changes' else f'{value:.2f}',ha='center',fontsize=10)
        ax.set(xticks=[0,1],xticklabels=['Published arrays','Pilot1'],ylabel=unit,title=title,ylim=(0,68 if metric=='target_changes' else comparison[metric].max()+3.4))
        ax.legend(frameon=False,fontsize=8,ncol=1,loc='upper center')
        ax.spines[['top','right']].set_visible(False)
    fig.suptitle('Design calibration context    Pilot1 occasional jumps are intentional\nSupply SD uses population moments of each fixed series in both datasets',fontsize=13)
    change_counts=comparison.pivot(index='study',columns='regime',values='target_changes')
    target_footer=[fixed_text(change_counts.loc['Pilot1',regime]-change_counts.loc['Piray published arrays',regime],
                              f'Pilot1 minus published target changes, {regime}',decimals=0)
                   for regime in ['LowVol + highSto','HighVol + lowSto']]
    supply_sd=comparison.pivot(index='study',columns='regime',values='supply_offset_sd_pp')
    supply_footer=[fixed_text(supply_sd.loc[study,'LowVol + highSto']-supply_sd.loc[study,'HighVol + lowSto'],
                              f'High minus low supply SD, {"published arrays" if study == "Piray published arrays" else study}')
                   for study in studies]
    add_footers(fig,[(axes[0],target_footer),(axes[1],supply_footer)])
    return fig


def build_learning_validation(condition, enc, mean_ci_fn, root=None):
    """Return aggregate benchmark, private geometry checks and unexported figures.

    The caller owns figure export and closing. Normal execution reads only
    the bundled aggregate JSON and the current prepared Pilot1 tables.
    """
    path=Path(root)/'analysis/drone_task/references/Piray2024_learning_benchmark.json' if root is not None else REFERENCE_PATH
    reference=json.loads(path.read_text())
    table=_benchmark_table(condition,reference,mean_ci_fn)
    private,geometry=_geometry_tables(enc,reference)
    current=table.loc[table.study.eq('Pilot1')].iloc[0]
    interpretation=pd.DataFrame([
        ['Expected regime ordering',f'Observed mean difference {current.difference:+.3f}','Positive mean alone is not joint uncertainty inference'],
        ['Participant consistency',f'{int(current.positive)} of {int(current.n)} positive','Inspect individual directions alongside the mean'],
        ['Estimate uncertainty',f'95 percent interval {current.ci_low:+.3f} to {current.ci_high:+.3f}','A small pilot can accommodate several underlying magnitudes'],
        ['Identification','Two coupled uncertainty regimes','Volatility and stochasticity effects are not independently identified'],
        ['Interpretation priority','Learning validation before memory mechanisms','No automatic pass threshold or participant exclusion is applied']],columns=['Validation question','Observed or design fact','Interpretation'])
    return dict(summary=table,geometry=geometry,interpretation=interpretation,reference_provenance=reference,
                tables={'learning_replication_benchmark':table,'learning_validation_geometry_blocks':private,
                        'learning_validation_geometry':geometry,'learning_validation_interpretation':interpretation},
                figures={'learning_replication_benchmark':_benchmark_figure(table),
                         'learning_design_geometry':_geometry_figure(geometry)})
