"""Source-linked checks and figures for 06_memory_screen.ipynb."""
import hashlib
import itertools
import json
import subprocess
import textwrap
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from matplotlib.offsetbox import AnnotationBbox, OffsetImage
from matplotlib.patches import Rectangle
from PIL import Image
from scipy.stats import binom, spearmanr

ROOT = Path(__file__).resolve().parents[2]
REF = ROOT/'design_checks/references/memory_screen'
OUT = ROOT/'design_checks/figures/memory_screen'
NORM_SHA = '72e7c0060ad232962b8eec953e3a34d37d6ff7aef7146f148519fb08cf161d68'
BLUE, GREEN, ORANGE, RED = '#245d96', '#257653', '#b77525', '#a0474d'


def load_design():
    OUT.mkdir(parents=True, exist_ok=True)
    data = json.loads(subprocess.check_output(
        ['node', str(ROOT/'design_checks/scripts/export_memory_screen.cjs')], text=True, cwd=ROOT))
    data['item_assets'] = []
    for item in data['screen']['items']:
        asset = ROOT/item['img']
        with Image.open(asset) as picture:
            picture.load()
            data['item_assets'].append(dict(concept=item['concept'], path=item['img'],
                sha256=hashlib.sha256(asset.read_bytes()).hexdigest(),
                size=list(picture.size), visible_bounds=list(picture.convert('RGBA').getbbox())))
    workbook = REF/'ferre_et_al_emojis_database.xlsx'
    assert hashlib.sha256(workbook.read_bytes()).hexdigest() == NORM_SHA
    norms = pd.read_excel(workbook)
    items = pd.DataFrame(data['screen']['items'])
    selected = items.merge(norms, left_on='norm_id', right_on='id', suffixes=('', '_norm'), validate='one_to_one')
    assert all(selected.emoji.str.replace('\ufe0f','') == selected.emoji_norm.str.replace('\ufe0f',''))
    plt.rcParams.update({'font.family':'DejaVu Sans', 'font.size':10.5,
        'axes.spines.top':False, 'axes.spines.right':False,
        'axes.titleweight':'bold', 'figure.facecolor':'white',
        'axes.facecolor':'white', 'savefig.facecolor':'white', 'figure.dpi':115})
    return data, norms, selected


def save(fig, name):
    fig.savefig(OUT/f'{name}.png', dpi=180, bbox_inches='tight', pad_inches=.2)
    plt.show()
    return OUT/f'{name}.png'


def series_row(name, drone, landing, visible, flagged=None, baseline=None, render_bounds=None):
    drone, landing = np.asarray(drone), np.asarray(landing)
    residual = landing-drone
    rendered=np.clip(landing,*render_bounds) if render_bounds is not None else landing
    display_residual=rendered-drone
    shifts = np.diff(drone if baseline is None else np.r_[baseline,drone])
    return dict(series=name, trials=len(drone), visible=visible, baseline=baseline,
        drone_min=drone.min(), drone_max=drone.max(),
        n_shifts=len(shifts), n_left=int(sum(shifts<0)), n_right=int(sum(shifts>0)),
        mean_abs_step=float(np.abs(shifts).mean()), max_step=np.abs(shifts).max(),
        residual_mean=residual.mean(), residual_sd=residual.std(ddof=0),
        mean_abs_distance_raw=float(abs(residual).mean()),
        mean_abs_distance_rendered=float(abs(display_residual).mean()),
        rendered_residual_sd=float(display_residual.std(ddof=0)),
        n_clipped_landings=int(sum(rendered!=landing)),
        max_abs_residual=np.abs(residual).max(),
        programmed_regime_changes=int(sum(flagged)) if flagged is not None else np.nan)


def trajectory_table(data):
    s = data['screen']
    rows = [series_row('Memory screen',s['drone_positions'],s['bag_positions'],s['drone_visible'],
                      s['change_points'],s['drone_initial_position'],data['renderer']['supply_bounds'])]
    for variant in data['variants']:
        suffix = 'reward shifted' if variant['reward_uses_shifted_sequences'] else 'loss shifted'
        for b in variant['blocks']:
            rows.append(series_row(f"Main {b['condition']} {b['valence']} | {suffix}",b['drone'],b['landing'],False,
                                   render_bounds=data['renderer']['supply_bounds']))
    return pd.DataFrame(rows)


def main_shift_table(data):
    """Report all transitions; calibrate movement using only nonzero shifts."""
    rows=[]
    for variant in data['variants']:
        assignment='reward shifted' if variant['reward_uses_shifted_sequences'] else 'loss shifted'
        for block in variant['blocks']:
            shifts=np.abs(np.diff(np.asarray(block['drone'],dtype=float)))
            rows.append(dict(assignment=assignment,condition=block['condition'],valence=block['valence'],
                vol_param=block['vol_param'],source_vol_label='low' if block['vol_param']==4 else 'high',
                n_transitions=len(shifts),n_zero_shifts=int(sum(shifts==0)),
                n_nonzero_shifts=int(sum(shifts>0)),
                mean_abs_shift=float(shifts.mean()),
                mean_nonzero_shift=float(shifts[shifts>0].mean())))
    return pd.DataFrame(rows)


def shift_calibration_table(data):
    reference=main_shift_table(data)
    screen=data['screen']
    moves=np.diff(np.r_[screen['drone_initial_position'],screen['drone_positions']])
    average=float(np.abs(moves).mean())
    rows=[]
    for assignment,blocks in reference.groupby('assignment',sort=False):
        low=float(blocks.loc[blocks.vol_param.eq(4),'mean_nonzero_shift'].mean())
        high=float(blocks.loc[blocks.vol_param.eq(49),'mean_nonzero_shift'].mean())
        rows.append(dict(assignment=assignment,low_vol_mean_nonzero_shift=low,
            high_vol_mean_nonzero_shift=high,midpoint=(low+high)/2,
            screen_mean_abs_shift=average,between_group_means=min(low,high)<average<max(low,high)))
    return pd.DataFrame(rows)


def stochasticity_reference_table(data):
    """Distances to actual circle centres, with raw/scoring geometry retained."""
    rows=[]
    bounds=data['renderer']['supply_bounds']
    for variant in data['variants']:
        assignment='reward shifted' if variant['reward_uses_shifted_sequences'] else 'loss shifted'
        for block in variant['blocks']:
            drone=np.asarray(block['drone'],dtype=float)
            raw=np.asarray(block['landing'],dtype=float)
            rendered=np.clip(raw,*bounds)
            residual=raw-drone; display_residual=rendered-drone
            rows.append(dict(assignment=assignment,condition=block['condition'],valence=block['valence'],
                stc_param=block['stc_param'],source_stc_label='low' if block['stc_param']==16 else 'high',
                n_trials=len(drone),n_clipped_landings=int(sum(raw!=rendered)),
                mean_abs_distance_raw=float(abs(residual).mean()),
                mean_abs_distance_rendered=float(abs(display_residual).mean()),
                residual_sd_raw=float(residual.std()),residual_sd_rendered=float(display_residual.std())))
    return pd.DataFrame(rows)


def noise_calibration_table(data):
    reference=stochasticity_reference_table(data)
    screen=data['screen']
    rendered=np.clip(screen['bag_positions'],*data['renderer']['supply_bounds'])
    distance=rendered-np.asarray(screen['drone_positions'])
    average=float(abs(distance).mean())
    rows=[]
    for assignment,blocks in reference.groupby('assignment',sort=False):
        low=float(blocks.loc[blocks.stc_param.eq(16),'mean_abs_distance_rendered'].mean())
        high=float(blocks.loc[blocks.stc_param.eq(64),'mean_abs_distance_rendered'].mean())
        midpoint=(low+high)/2
        rows.append(dict(assignment=assignment,low_stc_mean_abs_distance=low,
            high_stc_mean_abs_distance=high,midpoint=midpoint,screen_mean_abs_distance=average,
            between_group_means=min(low,high)<average<max(low,high),
            matches_midpoint=bool(np.isclose(average,midpoint,rtol=0,atol=1e-9))))
    return pd.DataFrame(rows)


def medium_level_table(data):
    movement=shift_calibration_table(data); distance=noise_calibration_table(data)
    return pd.DataFrame([
        dict(quantity='Volatility',measure='Mean absolute drone shift when position changes',
            source_low_mean=float(movement.low_vol_mean_nonzero_shift.mean()),
            screen_mean=float(movement.screen_mean_abs_shift.mean()),
            source_high_mean=float(movement.high_vol_mean_nonzero_shift.mean()),
            target_midpoint=float(movement.midpoint.mean())),
        dict(quantity='Stochasticity',measure='Mean absolute rendered landing distance',
            source_low_mean=float(distance.low_stc_mean_abs_distance.mean()),
            screen_mean=float(distance.screen_mean_abs_distance.mean()),
            source_high_mean=float(distance.high_stc_mean_abs_distance.mean()),
            target_midpoint=float(distance.midpoint.mean()))])


def check_all(data, selected):
    s = data['screen']; x = np.asarray(s['drone_positions']); e = np.asarray(s['wind_offsets'])
    results = []
    def check(name, condition, observed):
        results.append({'check':name, 'pass':bool(condition), 'observed':str(observed)})
    check('20 encoding turns and 10 questions',len(x)==20 and len(s['pairs'])==10,'20 / 10')
    check('Hidden target and zero regime changes',s['drone_visible'] is False and not any(s['change_points']), 'hidden / 0')
    timeline = data['screen_timeline']
    check('Drone hidden in all encoding trials and phase records',
          len(timeline['encoding']) == 20 and
          all(t['show_drone'] is False and t['animate_drone'] is False and
              t['screening_drone_visible'] is False for t in timeline['encoding']) and
          all(v is False for v in timeline['phase_visibility']) and
          timeline['initial_properties']['memory_screening_drone_visible'] is False and
          timeline['summary_properties']['memory_screening_drone_visible'] is False,
          '20 hidden trials; phase, entry, and summary metadata agree')
    check('Entry instructions describe the hidden drone',
          '<strong>drone will be hidden</strong>' in timeline['entry']['body'] and
          'see the drone' not in timeline['entry']['body'], timeline['entry']['body'])
    shifts=np.diff(np.r_[s['drone_initial_position'],x])
    check('All 20 shifts have equal displacement',len(shifts)==20 and np.allclose(abs(shifts),s['drone_step_size'],rtol=0,atol=1e-9),
          f'{len(shifts)} shifts of {s["drone_step_size"]} percentage points')
    calibration=shift_calibration_table(data)
    midpoint=float(calibration.midpoint.mean())
    check('Screen mean lies between main volatility groups',calibration.between_group_means.all(),
          f"source high {calibration.high_vol_mean_nonzero_shift.iloc[0]:.6f} < screen {abs(shifts).mean():.6f} < source low {calibration.low_vol_mean_nonzero_shift.iloc[0]:.6f}; nonzero main shifts, both assignments")
    check('Fixed step equals the rounded reference midpoint',np.isclose(s['drone_step_size'],round(midpoint,2),rtol=0,atol=1e-9),
          f'midpoint {midpoint:.9f}; fixed step {s["drone_step_size"]:.2f}')
    reference=main_shift_table(data)
    check('Main movement calibration excludes stationary transitions',
          reference.n_transitions.eq(49).all() and reference.n_zero_shifts.eq(34).all()
          and reference.n_nonzero_shifts.eq(15).all(),
          '15 actual shifts used per block; 34 stationary transitions excluded; no between-block moves')
    check('Movement calibration metric is saved consistently',
          s['drone_step_metric']=='mean_absolute_nonzero_main_drone_shift' and
          all(t['screening_drone_step_metric']==s['drone_step_metric'] for t in timeline['encoding']) and
          timeline['initial_properties']['memory_screening_drone_step_metric']==s['drone_step_metric'] and
          timeline['summary_properties']['memory_screening_drone_step_metric']==s['drone_step_metric'],
          s['drone_step_metric'])
    check('Ten shifts left and ten right',sum(shifts<0)==10 and sum(shifts>0)==10,
          f'{sum(shifts<0)} left / {sum(shifts>0)} right')
    check('Every turn uses the preceding target',s['drone_start_positions']==[s['drone_initial_position']]+list(x[:-1])
          and np.allclose(shifts,np.array(s['drone_directions'])*s['drone_step_size'],rtol=0,atol=1e-9), 'baseline plus preceding 19 targets')
    bounds=s['drone_initial_position']+np.array([-2,2])*s['drone_step_size']
    check('Target range and return to baseline',np.allclose([x.min(),x.max()],bounds,rtol=0,atol=1e-9)
          and x[-1]==s['drone_initial_position'],
          f'{x.min():g} to {x.max():g}; final {x[-1]:g}')
    check('Screen positions avoid display clipping',np.all((x>=12)&(x<=88)) and
          np.all((np.asarray(s['bag_positions'])>=18)&(np.asarray(s['bag_positions'])<=82)),
          'drone, supply and item positions inside renderer bounds')
    supply=np.asarray(s['bag_positions'])-x
    sides=np.sign(supply)
    noise=noise_calibration_table(data)
    check('Landing offsets match actual geometry',np.allclose(e,supply,rtol=0,atol=1e-9),
          'live bag positions minus live drone positions')
    check('Ten rendered landings on each side',sum(sides<0)==10 and sum(sides>0)==10 and sum(sides==0)==0,
          f'{sum(sides<0)} left / {sum(sides>0)} right / {sum(sides==0)} centred')
    check('Landing signs are nonalternating with short runs',np.any(sides[1:]==sides[:-1]) and
          max(len(list(run)) for _,run in itertools.groupby(sides))<=2,
          f'{sum(sides[1:]!=sides[:-1])} switches / 19 transitions; maximum run 2')
    check('Landing side is uncoupled from drone direction',abs(np.corrcoef(sides,s['drone_directions'])[0,1])<.1,
          f'correlation {np.corrcoef(sides,s["drone_directions"])[0,1]:.3f}')
    check('Fixed landing distance and zero signed bias',np.allclose(abs(supply),s['supply_offset_size'],rtol=0,atol=1e-9)
          and abs(supply.mean())<1e-9 and np.all(sides==s['supply_directions']),
          f'mean absolute {abs(supply).mean():.6f}; signed mean {supply.mean():.6f}')
    check('Noise metric names rendered circle distance',s['supply_offset_metric']=='mean_absolute_rendered_drone_to_landing_distance',
          s['supply_offset_metric'])
    check('Screen distance matches main stochasticity midpoint',noise.matches_midpoint.all() and noise.between_group_means.all(),
          f'source low {noise.low_stc_mean_abs_distance.iloc[0]:.6f}; screen {abs(supply).mean():.6f}; source high {noise.high_stc_mean_abs_distance.iloc[0]:.6f}; both assignments')
    noise_reference=stochasticity_reference_table(data)
    check('Stochasticity reference includes all 50 outcomes',noise_reference.n_trials.eq(50).all(),
          '50 actual circle centres per block, including zero distances')
    check('Circle and fragment bounds come from live renderer',data['renderer']['supply_bounds']==data['renderer']['fragment_bounds']
          and data['renderer']['source']=='static/task/trial.js',str(data['renderer']['supply_bounds']))
    check('Small rank correlation with serial position',abs(spearmanr(x,range(20)).statistic)<.2 and
          abs(spearmanr(e,range(20)).statistic)<.2,
          f'Spearman target {spearmanr(x,range(20)).statistic:.3f}; noise {spearmanr(e,range(20)).statistic:.3f}')
    for key, field in [('drone_positions','drone'),('bag_positions','landing')]:
        repeated = []
        for v in data['variants']:
            for b in v['blocks']:
                for j in range(31):
                    if np.allclose(s[key], b[field][j:j+20]): repeated.append((b['condition'],j))
        check(f'No reused 20 turn main segment in {key}',not repeated, repeated or 'none in either shift assignment')
    norm = lambda v: str(v).replace('\ufe0f','').replace('\ufe0e','').replace('_','-').lower()
    main = {norm(Path(p).stem) for p in data['main_pool']}
    prac = {norm(p['concept']) for p in data['practice']}
    emojis = {norm(p['emoji']) for p in data['practice']} | {norm(e) for e in data['fallback']}
    overlap = [item['concept'] for item in s['items'] if
               set(map(norm,[item['concept']]+item['aliases'])) & (main|prac) or norm(item['emoji']) in emojis]
    check('Concept, alias and Unicode overlap',not overlap,overlap or '0 main / 0 practice / 0 fallback')
    hashes = [hashlib.sha256((ROOT/i['img']).read_bytes()).hexdigest() for i in s['items']]
    main_hashes = {hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in data['main_pool']}
    check('20 unique image bytes absent from main PNGs',len(set(hashes))==20 and not(set(hashes)&main_hashes),'20 unique / 0 duplicates')
    check('Decoded PNGs have common canvas and visible size',all(a['size']==[256,256] and
          max(a['visible_bounds'][2]-a['visible_bounds'][0],a['visible_bounds'][3]-a['visible_bounds'][1])==192
          for a in data['item_assets']),'20 decoded; 256 pixel canvas / 192 pixel largest visible dimension')
    check('Normed moderate valence and low arousal',selected.val.between(4,6).all() and selected.aro.le(4.8).all(),
          f'valence {selected.val.min():.2f} to {selected.val.max():.2f}; arousal {selected.aro.min():.2f} to {selected.aro.max():.2f}')
    check('Source clarity and visual complexity',selected.clar.ge(3.5).all() and selected.vcomp.between(1.3,4.5).all(),
          f'clarity minimum {selected.clar.min():.2f}; complexity {selected.vcomp.min():.2f} to {selected.vcomp.max():.2f}')
    check('All selected source meanings unambiguous',selected.ambiguous.eq(0).all(),'20 of 20')
    coverage = sorted([n for p in s['pairs'] for n in [p['item1_trial'],p['item2_trial']]])
    check('Every studied identity tested exactly once',coverage==list(range(1,21)),coverage)
    check('Question gap and side balance',all(p['item2_trial']-p['item1_trial'] in [2,3] for p in s['pairs']) and
          sum(p['correct_side']=='left' for p in s['pairs'])==5,'4 gap 2 / 6 gap 3; 5 left / 5 right')
    seeds = data['seed_checks']
    check('Geometry invariant across 100 item/test seeds',all(t['drone']==s['drone_positions'] and t['wind']==s['wind_offsets'] for t in seeds),'100 of 100')
    check('Different families in every tested pair across seeds',all(all(t['families'][p['item1_trial']-1]!=t['families'][p['item2_trial']-1]
           for p in t['pairs']) for t in seeds),'1000 of 1000 pairs')
    check('No run of three same family items across seeds',all(all(not(t['families'][i]==t['families'][i-1]==t['families'][i-2])
          for i in range(2,20)) for t in seeds),'100 of 100 sequences')
    check('Item order varies independently of geometry',len({tuple(t['concepts']) for t in seeds})==100,'100 different orders')
    df = pd.DataFrame(results)
    df.to_csv(OUT/'automated_checks.csv',index=False)
    assert df['pass'].all(), df.loc[~df['pass']].to_string(index=False)
    return df


def plot_trajectories(data):
    fig=plt.figure(figsize=(14,10),layout='constrained')
    grid=fig.add_gridspec(3,2)
    axes=[fig.add_subplot(grid[0,0])]
    axes.extend(fig.add_subplot(grid[row,col],sharex=axes[0],sharey=axes[0])
                for row in [1,2] for col in [0,1])
    bounds=data['renderer']['supply_bounds']
    rows = [(data['screen']['drone_positions'],np.clip(data['screen']['bag_positions'],*bounds),'Memory screen | hidden target',GREEN)]
    for b in data['variants'][0]['blocks']:
        rows.append((b['drone'],np.clip(b['landing'],*bounds),f"Main {b['condition']} | {b['valence']} | vol {b['vol_param']} | stc {b['stc_param']}",BLUE))
    for ax,(x,y,title,color) in zip(axes,rows):
        t=np.arange(1,len(x)+1)
        if ax is axes[0]:
            ax.plot(np.r_[0,t],np.r_[data['screen']['drone_initial_position'],x],color=color,lw=2,label='Drone target')
            ax.scatter([0],[data['screen']['drone_initial_position']],s=35,facecolors='white',edgecolors=color,zorder=4,label='Starting position')
        else:
            ax.plot(t,x,color=color,lw=2,label='Drone target')
        ax.scatter(t,y,s=20,color='#526170',alpha=.8,label='Rendered supply centre',zorder=3)
        ax.fill_between(t,x,y,color=color,alpha=.13)
        ax.set_title(title,loc='left',fontsize=11)
        ax.set_xlim(-.5,50.5);ax.set_ylim(8,92);ax.set_xticks([0,10,20,30,40,50])
        ax.grid(alpha=.16)
    axes[0].legend(loc='upper right',frameon=False,fontsize=8)
    control=fig.add_subplot(grid[0,1]);control.set_axis_off()
    s=data['screen'];directions=np.asarray(s['drone_directions'])
    controls=[['Encoding turns',str(len(s['drone_positions']))],
              ['Every shift',f"{s['drone_step_size']} percentage points"],
              ['Direction counts',f"{sum(directions<0)} left / {sum(directions>0)} right"],
              ['Starting and final position',f"{s['drone_initial_position']} / {s['drone_positions'][-1]} percent"],
              ['Participant view','Drone hidden throughout']]
    table=control.table(cellText=controls,colWidths=[.53,.47],cellLoc='left',bbox=[.05,.15,.9,.65])
    table.auto_set_font_size(False);table.set_fontsize(10)
    for (row,col),cell in table.get_celld().items():
        cell.set_edgecolor('#e2e8ed');cell.set_linewidth(.6)
        if col==0:cell.set_facecolor('#f2f6f4')
    control.set_title('Constant movement controls',loc='left',fontsize=11)
    for ax in [axes[0],axes[1],axes[3]]:ax.set_ylabel('Horizontal position on rail (%)')
    for ax in axes[-2:]:ax.set_xlabel('Encoding turn')
    fig.suptitle('Memory screen and four experimental conditions',fontsize=16,fontweight='bold')
    return save(fig,'01_trajectory_comparison')


def plot_noise(data):
    s=data['screen'];x=np.array(s['drone_positions']);e=np.array(s['wind_offsets']);t=np.arange(1,21)
    fig,axes=plt.subplots(2,2,figsize=(14,8),layout='constrained')
    axes=axes.ravel()
    ax=axes[0];ax.plot(np.r_[0,t],np.r_[s['drone_initial_position'],x],'o-',color=GREEN,lw=2,label='Hidden drone target')
    ax.scatter(t,x+e,color='#4d5966',s=35,label='Landing',zorder=3)
    positions=np.r_[s['drone_initial_position'],x,x+e]
    padding=max(2,.08*np.ptp(positions))
    limits=(5*np.floor((positions.min()-padding)/5),5*np.ceil((positions.max()+padding)/5))
    ax.set(xlabel='Turn, with starting position at 0',ylabel='Rail position (%)',
           xlim=(-.5,len(t)+.5),ylim=limits,xticks=[0,5,10,15,20])
    ax.set_title('Memory screen trajectory',loc='left');ax.legend(frameon=False,fontsize=8)
    ax=axes[1];shifts=np.diff(np.r_[s['drone_initial_position'],x])
    ax.bar(t,shifts,color=[GREEN if d>0 else ORANGE for d in shifts],width=.65)
    ax.axhline(0,color='#999',lw=1)
    step=s['drone_step_size']
    ax.set(xlabel='Encoding turn',ylabel='Signed drone shift (percentage points)',ylim=(-1.4*step,1.4*step),xticks=[1,5,10,15,20],yticks=[-step,0,step])
    ax.set_title('20 equal shifts | 10 left and 10 right',loc='left')
    ax=axes[2];ax.axhline(0,color='#999',lw=1);ax.vlines(t,0,e,color=BLUE,lw=2);ax.scatter(t,e,color=BLUE,s=20)
    offset=s['supply_offset_size']
    ax.axhspan(-offset,offset,color=BLUE,alpha=.06)
    ax.set(xlabel='Turn',ylabel='Landing minus drone (percentage points)',ylim=(-1.4*offset,1.4*offset),xticks=[1,5,10,15,20],yticks=[-offset,0,offset])
    ax.set_title(f'20 landing sides | 10 left and 10 right',loc='left')
    summary=trajectory_table(data).iloc[:5]; ax=axes[3]
    labels=['Memory screen','Main 1','Main 2','Main 3','Main 4']
    ax.bar(labels,summary.mean_abs_distance_rendered,color=[GREEN]+[BLUE]*4,width=.65)
    for i,v in enumerate(summary.mean_abs_distance_rendered):ax.text(i,v+.09,f'{v:.3f}',ha='center',fontsize=9)
    ax.set(ylabel='Mean absolute rendered distance (pp)',ylim=(0,max(summary.mean_abs_distance_rendered)+1));ax.tick_params(axis='x',rotation=30)
    ax.set_title('Medium stochasticity by landing distance',loc='left')
    for ax in axes:ax.grid(axis='y',alpha=.15)
    return save(fig,'02_screening_noise')


def plot_shift_comparison(data):
    calibration=shift_calibration_table(data)
    reference=main_shift_table(data)
    fig,axes=plt.subplots(1,2,figsize=(14,5),layout='constrained')
    low=float(calibration.low_vol_mean_nonzero_shift.mean())
    high=float(calibration.high_vol_mean_nonzero_shift.mean())
    step=float(calibration.screen_mean_abs_shift.mean())
    values=[low,step,high]
    axes[0].bar(['Low volatility\nsource vol 4','Memory screen','High volatility\nsource vol 49'],
                values,color=[BLUE,GREEN,ORANGE],width=.6)
    for i,value in enumerate(values):
        axes[0].text(i,value+.09,f'{value:.3f}',ha='center',fontweight='bold')
    axes[0].set_title('Screen mean between the main-group means',loc='left',fontsize=12)
    blocks=reference.groupby(['condition','valence','vol_param'],sort=True).mean_nonzero_shift.agg(['mean','min','max']).reset_index()
    x=np.arange(len(blocks))
    error=np.vstack([blocks['mean']-blocks['min'],blocks['max']-blocks['mean']])
    axes[1].bar(x,blocks['mean'],yerr=error,capsize=5,width=.6,
        color=[BLUE if vol==4 else ORANGE for vol in blocks.vol_param])
    for i,value in enumerate(blocks['mean']):
        axes[1].text(i,value+.12,f'{value:.3f}',ha='center',fontsize=9)
    axes[1].axhline(step,color=GREEN,lw=2,ls='--')
    axes[1].text(.02,step+.25,f'Memory screen {step:.2f}',
        transform=axes[1].get_yaxis_transform(),color=GREEN,fontsize=9,va='bottom')
    axes[1].set_xticks(x,[f'Main {row.condition}\n{row.valence} | vol {row.vol_param}' for row in blocks.itertuples()],fontsize=8)
    axes[1].set_title('Main blocks across both shift assignments',loc='left',fontsize=12)
    for ax in axes:
        ax.set_ylabel('Mean absolute shift when position changes (pp)')
        ax.set_ylim(0,max(values)+.8)
        ax.grid(axis='y',alpha=.15)
    fig.supxlabel('Main means use 15 actual shifts per block; 34 stationary transitions excluded | Whiskers span both assignments | Source labels preserved',fontsize=9)
    return save(fig,'08_mean_shift_comparison')


def plot_medium_levels(data):
    levels=medium_level_table(data)
    fig,axes=plt.subplots(1,2,figsize=(14,5),layout='constrained')
    titles=['Medium volatility by drone movement','Medium stochasticity by landing distance']
    ylabels=['Mean absolute shift when position changes (pp)','Mean absolute rendered landing distance (pp)']
    for ax,(_,row),title,ylabel in zip(axes,levels.iterrows(),titles,ylabels):
        values=[row.source_low_mean,row.screen_mean,row.source_high_mean]
        ax.bar(['Source low','Memory screen','Source high'],values,color=[BLUE,GREEN,ORANGE],width=.6)
        for i,value in enumerate(values):
            ax.text(i,value+.07,f'{value:.3f}',ha='center',fontweight='bold')
        ax.axhline(row.target_midpoint,color=GREEN,ls='--',lw=1.5,
                   label=f'Reference midpoint {row.target_midpoint:.6f}')
        ax.set(ylabel=ylabel,ylim=(0,max(values)+.6))
        ax.set_title(title,loc='left',fontsize=12)
        ax.grid(axis='y',alpha=.15)
        ax.legend(frameon=False,fontsize=8,loc='upper right')
    fig.supxlabel('Movement uses 15 nonzero shifts per main block | Landing distance uses all 50 rendered circle centres | Source labels are preserved',fontsize=9)
    return save(fig,'09_medium_levels')


def item_image(item):
    return np.asarray(Image.open(ROOT/item['img']).convert('RGBA'))


def plot_items(selected):
    fig,axes=plt.subplots(4,5,figsize=(15,11),layout='constrained')
    for n,(ax,(_,item)) in enumerate(zip(axes.flat,selected.iterrows()),1):
        ax.imshow(item_image(item));ax.set_axis_off()
        ax.set_title(f"{n:02d}  {item.concept.replace('-',' ')}",fontsize=11,pad=3)
        ax.text(.5,-.03,f"Valence {item.val:.2f}   Arousal {item.aro:.2f}",ha='center',va='top',transform=ax.transAxes,fontsize=8,color='#465467')
    fig.suptitle('Twenty fixed object images | reference study order',fontsize=17,fontweight='bold')
    fig.supxlabel('Published ratings guide selection | exact task graphics shown | aesthetic appeal and memory are not normed here',fontsize=10)
    return save(fig,'03_item_contact_sheet')


def plot_affect(norms,selected):
    fig,axes=plt.subplots(1,2,figsize=(14,6),layout='constrained')
    ax=axes[0];ax.scatter(norms.val,norms.aro,s=9,c='#c6cdd5',alpha=.45,label='All 1031 source emoji')
    ax.scatter(selected.val,selected.aro,s=40,c=GREEN,label='Memory screen objects',zorder=3)
    ax.add_patch(Rectangle((4,1),2,3.8,fill=False,color=GREEN,ls='--',lw=1.2))
    ax.set(xlabel='Valence (1 unpleasant to 9 pleasant)',ylabel='Arousal (1 calm to 9 activated)',xlim=(.5,9.5),ylim=(.5,9.5))
    ax.legend(frameon=False,fontsize=9);ax.set_title('Source affect ratings and selection limits',loc='left')
    ax=axes[1]; y=np.arange(len(selected))
    ax.barh(y-.17,selected.clar,.30,label='Meaning clarity',color=BLUE)
    ax.barh(y+.17,selected.vcomp,.30,label='Visual complexity',color='#abb6c5')
    ax.set_yticks(y,selected.concept.str.replace('-',' '),fontsize=8);ax.invert_yaxis();ax.set_xlim(0,7.5)
    ax.set_xlabel('Source mean rating (1 to 7)');ax.set_title('Clarity and visible detail are different',loc='left');ax.legend(frameon=False,fontsize=8)
    fig.supxlabel('Emoji-SP used Facebook graphics and Spanish student raters | these are selection proxies, not Apple graphic or sample-specific norms',fontsize=9)
    return save(fig,'04_affect_and_detail')


def place_image(ax,item,x,y,zoom=.10):
    ax.add_artist(AnnotationBbox(OffsetImage(item_image(item),zoom=zoom), (x,y),frameon=False))


def plot_pairs(data):
    s=data['screen']; fig,(ax,left)=plt.subplots(1,2,figsize=(17,11),gridspec_kw={'width_ratios':[1.6,1]},layout='constrained')
    for row,p in enumerate(s['pairs']):
        y=10-row;a,b=p['item1_trial'],p['item2_trial']
        ax.plot([a,b],[y,y],color=BLUE,lw=2)
        place_image(ax,s['items'][a-1],a,y,.115);place_image(ax,s['items'][b-1],b,y,.115)
        ax.text(20.8,y,f"Gap {b-a}\n{b-a-1} intervening",fontsize=8,va='center')
        correct=p['correct_side'];first=s['items'][a-1];second=s['items'][b-1]
        l,r=(first,second) if correct=='left' else (second,first)
        place_image(left,l,0,y,.16);place_image(left,r,1.5,y,.16)
        left.text(0,y-.29,f"turn {a if correct=='left' else b}",ha='center',fontsize=8)
        left.text(1.5,y-.29,f"turn {b if correct=='left' else a}",ha='center',fontsize=8)
        left.text(2.5,y,'Left' if correct=='left' else 'Right',ha='left',va='center',color=GREEN,fontsize=10,fontweight='bold')
    ax.set(ylim=(.3,10.7),xlim=(0,23),xticks=range(1,21),xlabel='Encoding turn')
    ax.set_yticks(range(1,11),[f'Question {i}' for i in range(10,0,-1)]);ax.grid(axis='x',alpha=.18)
    ax.set_title('Every studied item is tested once',loc='left')
    left.set(ylim=(.3,10.7),xlim=(-.6,3.4),xticks=[0,1.5,2.8],yticks=[])
    left.set_xticklabels(['Left item','Right item','Correct side'])
    for spine in left.spines.values():spine.set_visible(False)
    left.set_title('Actual reference question order and layout',loc='left')
    fig.suptitle('Ten temporal order questions | researcher answer map',fontsize=16,fontweight='bold')
    fig.supxlabel('Same items as encoding | 4 pairs with one intervening item and 6 with two | 5 left and 5 right answers',fontsize=10)
    return save(fig,'05_order_question_map')


def plot_identity(data,selected):
    fig,(ax,review)=plt.subplots(1,2,figsize=(15,9),gridspec_kw={'width_ratios':[1.25,1]},layout='constrained')
    normalize=lambda text: str(text).lower().replace('_','-').replace('\ufe0f','').replace('\ufe0e','')
    main={normalize(Path(p).stem) for p in data['main_pool']}
    practice={normalize(p['concept']) for p in data['practice']}
    practice_emoji={normalize(p['emoji']) for p in data['practice']}
    fallback={normalize(e) for e in data['fallback']}
    main_hashes={hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in data['main_pool']}
    matrix=[]
    for _,item in selected.iterrows():
        concepts=set(map(normalize,[item.concept]+item.aliases))
        matrix.append([bool(concepts & main), bool(concepts & practice) or normalize(item.emoji) in practice_emoji,
            normalize(item.emoji) in fallback,hashlib.sha256((ROOT/item.img).read_bytes()).hexdigest() in main_hashes])
    matrix=np.asarray(matrix,dtype=int)
    ax.imshow(matrix,cmap='Greens_r',vmin=-1,vmax=1,aspect='auto')
    ax.set_yticks(range(20),selected.concept.str.replace('-',' '),fontsize=9)
    ax.set_xticks(range(4),['Main identities\nand aliases','Practice identities\nand Unicode','Real fallback\nUnicode','Main PNG\nbyte duplicate'],fontsize=9)
    for y in range(20):
        for x in range(4):ax.text(x,y,str(matrix[y,x]),ha='center',va='center',color=GREEN,fontweight='bold')
    ax.set_title(f'Exact identity audit | {matrix.sum()} overlaps',loc='left')
    review.set_axis_off()
    entries=[('Separate identities, related categories',
      'Clothing versus the main coat and shoes; clipboard and folder versus notebooks; test tube versus alembic; radio versus television. These are distinct objects, not semantically unrelated categories.'),
      ('Object families in the questions',
      'Each tested pair contains two different broad object families. Study assignments contain no run of three objects from the same family. Item and question order vary independently of the fixed drone trajectory.'),
      ('What requires participant evidence',
      'Whether each exact graphic is recognized, affectively moderate and similarly memorable. Published ratings and image features cannot establish this for the target sample.'),
      ('Rendering held constant',
      'Encoding, order questions and this notebook use the same 20 local PNGs. Missing or undecodable assets stop the requested screen before it begins.')]
    for y,(title,body) in zip([.95,.71,.47,.23],entries):
        review.text(0,y,title,fontsize=12,fontweight='bold',va='top',color='#243746')
        review.text(0,y-.045,textwrap.fill(body,56),fontsize=10,va='top',linespacing=1.5,color='#465467')
    return save(fig,'06_identity_and_selection_audit')


def plot_threshold():
    p=np.linspace(.01,.99,300);fig,axes=plt.subplots(1,2,figsize=(13,4.5),layout='constrained')
    k=np.arange(11);prob=binom.pmf(k,10,.5)
    axes[0].bar(k,prob,color=[GREEN if n>=6 else '#aeb8c4' for n in k]);axes[0].axvline(5.5,color=GREEN,ls='--')
    axes[0].set(xlabel='Correct answers out of 10',ylabel='Probability under independent guessing',xticks=k)
    axes[0].set_title(f'Guessing passes with probability {binom.sf(5,10,.5):.1%}',loc='left')
    axes[1].plot(p,binom.sf(5,10,p),color=BLUE,lw=2)
    for q in [.5,.6,.7,.8]:
        r=binom.sf(5,10,q);axes[1].scatter(q,r,color=BLUE);axes[1].annotate(f'{q:.0%} accuracy → {r:.0%} pass',(q,r),xytext=(8,-13 if q==.8 else 8),textcoords='offset points',fontsize=8)
    axes[1].set(xlabel='Assumed per-question accuracy',ylabel='Probability of meeting 6 of 10',xlim=(0,1),ylim=(0,1))
    axes[1].set_title('Short screens produce noisy selection',loc='left')
    for ax in axes:ax.grid(axis='y',alpha=.15)
    fig.supxlabel('Binomial illustration only | questions may be dependent | no participant performance has been estimated',fontsize=9)
    return save(fig,'07_threshold_operating_characteristics')


def export_tables(data,selected):
    trajectory_table(data).to_csv(OUT/'trajectory_metrics.csv',index=False)
    main_shift_table(data).to_csv(OUT/'main_shift_metrics.csv',index=False)
    shift_calibration_table(data).to_csv(OUT/'shift_calibration.csv',index=False)
    stochasticity_reference_table(data).to_csv(OUT/'stochasticity_reference.csv',index=False)
    noise_calibration_table(data).to_csv(OUT/'noise_calibration.csv',index=False)
    medium_level_table(data).to_csv(OUT/'medium_level_calibration.csv',index=False)
    data['movement_reference']={
        'metric':'Mean absolute nonzero consecutive drone position differences; stationary transitions, main baselines, and between-block transitions excluded',
        'main_blocks':main_shift_table(data).to_dict('records'),
        'calibration':shift_calibration_table(data).to_dict('records')}
    data['stochasticity_reference']={
        'metric':'Mean absolute distance from drone target to rendered supply centre over all 50 trials per main block',
        'renderer':data['renderer'],
        'main_blocks':stochasticity_reference_table(data).to_dict('records'),
        'calibration':noise_calibration_table(data).to_dict('records')}
    selected[['concept','emoji','family','norm_id','detail','val','aro','clar','fam','vcomp','ambiguous']].to_csv(OUT/'selected_item_ratings.csv',index=False)
    pd.DataFrame(data['screen']['pairs']).to_csv(OUT/'order_question_map.csv',index=False)
    (OUT/'design_manifest.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))
    return sorted(p.name for p in OUT.iterdir() if p.is_file())
