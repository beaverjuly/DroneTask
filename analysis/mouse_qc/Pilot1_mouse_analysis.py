"""Technical mouse recording audit for the explicitly matched Pilot1 cohort.

No classifier, participant exclusion, or payment decision is made here.
"""
from pathlib import Path
import json
import sys

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from matplotlib.ticker import MaxNLocator, StrMethodFormatter

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
from mouse_features import GEOMETRY_G1, features_from_table, movement_table, trajectory_points


def _column(frame, name, default=np.nan):
    return frame[name] if name in frame else pd.Series(default, index=frame.index)


def _truth(value):
    return str(value).strip().lower() in {'true', '1', '1.0'}


def build_mouse_audit(intake, batch_root=None, write=True):
    """Return acquisition checks and a figure without judging authenticity."""
    selected = set(intake['analysis_session_ids'])
    tables = intake['tables']
    traj = tables['mouse_trajectory'].loc[
        _column(tables['mouse_trajectory'], 'session_id').isin(selected)].copy()
    summaries = tables['mouse_summary'].loc[
        _column(tables['mouse_summary'], 'session_id').isin(selected)].copy()
    features = features_from_table(
        traj, id_cols=('session_id', 'session_label', 'trajectory_id'))
    if len(features):
        num = lambda key: pd.to_numeric(_column(features, key), errors='coerce')
        features['sample_count_gap'] = num('n_samples') - num('raw_move_samples')
        features['coalesced_count_gap'] = num('n_coalesced_samples') - num('raw_coalesced_samples')
        features['signal_readable'] = (
            _column(features, 'parse_error', '').eq('') &
            num('n_opening_clicks').eq(1) & num('n_closing_clicks').eq(1) &
            num('move_negative_dt_count').eq(0) &
            ~_column(features, 'samples_truncated', False).map(_truth) &
            num('duration_ms').gt(0) & num('duration_gap_ms').abs().le(.2) &
            features.sample_count_gap.eq(0) & features.coalesced_count_gap.eq(0) &
            num('samples_outside_click_window').eq(0))
        # Valid opening/closing clicks do not establish a recorded movement
        # path. A click-only record cannot measure straightness or speed.
        features['continuous_path_evaluable'] = (
            features.signal_readable & num('raw_move_samples').ge(2) &
            num('move_median_positive_dt_ms').gt(0))
        path_metrics = ['path_length', 'mean_speed', 'efficiency', 'mean_abs_turn_deg',
                        'median_dt_ms', 'frac_zero_dt', 'onset_latency_ms', 'peak_speed']
        features.loc[~features.continuous_path_evaluable,
                     [k for k in path_metrics if k in features]] = np.nan
    rows = []
    for sid in sorted(selected):
        t = traj.loc[_column(traj, 'session_id').eq(sid)]
        s = summaries.loc[_column(summaries, 'session_id').eq(sid)]
        f = features.loc[_column(features, 'session_id').eq(sid)]
        ids = pd.to_numeric(_column(t, 'trajectory_id'), errors='coerce')
        exact_ids = len(t) == 8 and ids.notna().all() and set(ids) == set(range(1, 9)) and ids.nunique() == 8
        complete = len(s) == 1 and str(s.iloc[0].get('mt_status', '')).lower() in {'complete', 'completed'}
        geometry_ok = False
        if len(s) == 1:
            try:
                geom = json.loads(s.iloc[0].get('mt_geometry_json', ''))
                geometry_ok = all(geom.get(k) == GEOMETRY_G1[k] for k in
                                  ['start', 'targets', 'target_radius_frac', 'start_radius_frac'])
            except (TypeError, ValueError):
                pass
        row = dict(session_id=sid, trajectory_rows=len(t), summary_rows=len(s),
                   terminal_complete=bool(complete), exact_movement_ids=bool(exact_ids),
                   supported_geometry=bool(geometry_ok),
                   completed_movements=int(_column(t, 'trajectory_completed', False).map(_truth).sum()),
                   readable_signals=int(_column(f, 'signal_readable', False).sum()),
                   continuous_paths_evaluable=int(_column(f, 'continuous_path_evaluable', False).sum()),
                   off_square_movements=int(pd.to_numeric(_column(f, 'n_off_square_points'), errors='coerce').gt(0).sum()))
        for field in ['raw_move_samples', 'move_median_positive_dt_ms', 'duration_ms']:
            v = pd.to_numeric(_column(f, field), errors='coerce')
            row['median_' + field] = float(v.median()) if v.notna().any() else np.nan
        rows.append(row)
    sessions = pd.DataFrame(rows)
    summary = dict(participants=len(selected), trajectory_records=len(traj),
                   expected_trajectories=8 * len(selected),
                   complete_summaries=int(sessions.terminal_complete.sum()) if len(sessions) else 0,
                   exact_movement_sessions=int(sessions.exact_movement_ids.sum()) if len(sessions) else 0,
                   supported_geometry_sessions=int(sessions.supported_geometry.sum()) if len(sessions) else 0,
                   readable_signals=int(_column(features, 'signal_readable', False).sum()),
                   continuous_paths_evaluable=int(_column(features, 'continuous_path_evaluable', False).sum()),
                   participants_with_all_continuous_paths=int(sessions.continuous_paths_evaluable.eq(8).sum()) if len(sessions) else 0,
                   click_only_trajectories=int(pd.to_numeric(_column(features, 'raw_move_samples'), errors='coerce').eq(0).sum()),
                   parse_errors=int(_column(features, 'parse_error', '').ne('').sum()),
                   off_square_movements=int(pd.to_numeric(_column(features, 'n_off_square_points'), errors='coerce').gt(0).sum()),
                   interpretation='Recording diagnostics only. Click-only records do not establish straightness, speed, or continuous path quality. Off-square excursions remain in the data. No authenticity classification, participation exclusion, or payment gate.')
    for field in ['raw_move_samples', 'move_median_positive_dt_ms', 'duration_ms']:
        v = pd.to_numeric(_column(features, field), errors='coerce')
        summary['median_' + field] = float(v.median()) if v.notna().any() else None
    fig, axes = plt.subplots(1, 3, figsize=(12, 3.6), layout='constrained')
    for ax, key, label in zip(axes, ['raw_move_samples', 'move_median_positive_dt_ms', 'duration_ms'],
                             ['Recorded move samples', 'Positive move interval in ms', 'Click to click duration in ms']):
        v = pd.to_numeric(_column(features, key), errors='coerce').dropna()
        if len(v):
            ax.hist(v, bins=min(15, max(4, int(np.sqrt(len(v))))), color='#377f91', alpha=.85, edgecolor='white')
            ax.axvline(v.median(), color='#aa4b34', linewidth=1.5)
        ax.set(xlabel=label, ylabel='Movements', title=f'{len(v)} movements with measurements')
        ax.xaxis.set_major_locator(MaxNLocator(nbins=4))
        ax.xaxis.set_major_formatter(StrMethodFormatter('{x:,.0f}' if key != 'move_median_positive_dt_ms' else '{x:g}'))
        ax.spines[['top', 'right']].set_visible(False)
    fig.suptitle('Mouse acquisition in the matched cohort', fontsize=14, fontweight='bold')
    paths = []
    if write:
        batch = Path(batch_root or intake['batch_root'])
        out = batch / 'derived' / 'mouse_qc'
        out.mkdir(parents=True, exist_ok=True)
        figures = out / 'figures'
        figures.mkdir(parents=True, exist_ok=True)
        features.to_csv(out / 'movement_audit.csv', index=False)
        sessions.to_csv(out / 'session_audit.csv', index=False)
        (out / 'summary.json').write_text(json.dumps(summary, indent=2, allow_nan=False) + '\n')
        path = figures / 'mouse_acquisition.png'
        fig.savefig(path, dpi=180, bbox_inches='tight')
        paths.append(path)
    return dict(summary=summary, features=features, sessions=sessions,
                figure=fig, figure_paths=paths)


def run_mouse_report(intake):
    result=build_mouse_audit(intake)
    out=Path(intake['batch_root'])/'derived/mouse_qc'
    figures={'mouse_acquisition':result['figure']}
    f=result['features']
    trajectory=intake['tables']['mouse_trajectory']
    trajectory=trajectory.loc[trajectory.session_id.isin(intake['analysis_session_ids'])]
    eligible=set(map(tuple,f.loc[f.continuous_path_evaluable,['session_id','trajectory_id']].to_numpy()))
    geometry=movement_table()
    fig,axes=plt.subplots(2,4,figsize=(13,7),layout='constrained')
    for ax,(_,g) in zip(axes.flat,geometry.iterrows()):
        data=trajectory.loc[pd.to_numeric(trajectory.trajectory_id,errors='coerce').eq(g.trajectory_id)]
        n=0
        for _,row in data.iterrows():
            if (row.session_id,row.trajectory_id) not in eligible:
                continue
            t,x,y=trajectory_points(row.samples,row.events)
            ax.plot(x,y,color='#3c7194',alpha=.3,lw=.8)
            n+=1
        ax.plot([g.x0,g.x1],[g.y0,g.y1],ls=':',color='black',lw=1.2)
        ax.scatter([g.x0],[g.y0],color='#299572',s=35,zorder=5)
        ax.scatter([g.x1],[g.y1],color='#b35c4c',marker='x',s=40,zorder=5)
        ax.set(title=f'Movement {int(g.trajectory_id)}   {n} paths',xlabel='Normalized x',ylabel='Normalized y')
        ax.set_aspect('equal',adjustable='box')
        # Autoscale all paths, including off-square excursions, then retain the
        # entire nominal square. Do not clip excursions into plausible paths.
        xlim=ax.get_xlim();ylim=ax.get_ylim()
        ax.set_xlim(min(0,xlim[0]),max(1,xlim[1]))
        ax.set_ylim(max(1,ylim[1]),min(0,ylim[0]))
        ax.spines[['top','right']].set_visible(False)
    fig.suptitle('Recorded continuous paths    Green start    Red target\nClick only records are retained in the audit but do not become straight paths',fontsize=13)
    figures['mouse_paths']=fig
    fig,axes=plt.subplots(1,3,figsize=(13,4),layout='constrained')
    for ax,metric,title in zip(axes,['duration_ms','path_length','efficiency'],
                               ['Click to click duration in ms','Path length in square side units','Endpoint distance / path length']):
        subset=f if metric=='duration_ms' else f.loc[f.continuous_path_evaluable]
        wide=subset.pivot(index='session_id',columns='trajectory_id',values=metric)
        for _,row in wide.iterrows():
            ax.plot(wide.columns,row,'o-',alpha=.25,color='#3c7194',ms=3,lw=.8)
        ax.plot(wide.columns,wide.median(),'o-',color='#b35c4c',lw=2,label='Participant median')
        if metric=='duration_ms':
            ax.set_yscale('log')
        ax.set(title=title,xlabel='Movement ID',ylabel='Recorded value',xticks=range(1,9))
        ax.legend(frameon=False,fontsize=8);ax.spines[['top','right']].set_visible(False)
    fig.suptitle('Geometry and participant differences    Movement order and geometry are confounded',fontsize=13)
    figures['mouse_geometry']=fig
    paths={}
    for name,fig in figures.items():
        path=out/'figures'/f'{name}.png'
        path.parent.mkdir(parents=True,exist_ok=True)
        fig.savefig(path,dpi=180,bbox_inches='tight');paths[name]=path
        plt.close(fig)
    result['figures']=figures
    result['figure_paths']=paths
    summary=pd.DataFrame([
        ['Participants',result['summary']['participants']],
        ['Complete eight movement summaries',result['summary']['complete_summaries']],
        ['Readable click records',result['summary']['readable_signals']],
        ['Evaluable continuous paths',result['summary']['continuous_paths_evaluable']],
        ['Participants with all continuous paths',result['summary']['participants_with_all_continuous_paths']],
        ['Click only records',result['summary']['click_only_trajectories']],
        ['Paths leaving the nominal square',result['summary']['off_square_movements']],
        ['Parsing errors',result['summary']['parse_errors']]],columns=['Recording check','Observed'])
    result['safe_summary']=summary
    summary.to_csv(out/'aggregate_recording_summary.csv',index=False)
    return result
