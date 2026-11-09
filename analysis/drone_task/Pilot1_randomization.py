"""Source-derived assignment checks for Pilot1, without exposing identifiers."""
from pathlib import Path
import hashlib
import json
import re
import subprocess

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

from Pilot1_plot_annotations import add_footers, fixed_text


def source_contract(root):
    """Evaluate the actual fixed stimulus arrays for both sequence assignments."""
    script = r"""
const fs=require('fs'),vm=require('vm'),root=process.argv[1];
function arrays(randomValue){
 const c={console:{log(){},warn(){}},Math:Object.create(Math),window:{}};
 c.Math.random=()=>randomValue;vm.createContext(c);
 vm.runInContext(fs.readFileSync(root+'/static/task/stimuli.js','utf8'),c);
 vm.runInContext(fs.readFileSync(root+'/static/task/latin_square.js','utf8'),c);
 return {drone:c.main_drone_position,supply:c.main_bag_position,
  pool:c.STIMULUS_IMAGE_POOL,latin:c.LATIN_SQUARE_4,labels:c.CANONICAL_CONDITION_LABELS};
}
process.stdout.write(JSON.stringify({shifted:arrays(.1),base:arrays(.9)}));
"""
    obj = json.loads(subprocess.run(['node', '-e', script, str(root)], check=True,
                                    capture_output=True, text=True).stdout)
    text = (root / 'static/task/memory_task.js').read_text()
    obj['pairs'] = json.loads(re.search(r'var PREDEFINED_PAIRS\s*=\s*(\[[\s\S]*?\]);', text).group(1))
    return obj


def js_hash(text):
    h = 0
    # Provider IDs are ASCII, for which this exactly matches JS charCodeAt.
    for char in str(text):
        h = (31 * h + ord(char)) & 0xffffffff
    return abs(h if h < 2**31 else h - 2**32)


def audit_randomization(intake, tables, geometry, root):
    contract = source_contract(Path(root))
    latin = contract['base']['latin']
    labels = contract['base']['labels']
    checks = []
    def check(name, passed, total, expectation):
        checks.append(dict(check=name, passed=int(passed), checked=int(total),
                           status='Pass' if passed == total and total > 0 else 'Review',
                           expectation=expectation))
    check('Latin square balances every condition at each position',
          sum(sorted(column) == list(range(4)) for column in zip(*latin)), 4,
          'One occurrence per position across the four assigned rows')
    adjacent=[(a,b) for row in latin for a,b in zip(row[:-1],row[1:])]
    check('Latin square balances first order carryover pairs',len(set(adjacent)),12,
          'Every directed pair of different conditions occurs once across rows')
    meta, enc, mem = (tables[k] for k in ['metadata', 'encoding', 'memory'])
    manifests = intake['tables']['design_manifests']
    manifests = manifests.loc[manifests.session_id.isin(intake['analysis_session_ids'])]
    record = {}
    for sid, rows in manifests.groupby('session_id'):
        if len(rows) == 1:
            record[sid] = json.loads(rows.iloc[0].design_manifest_json)
    check('One saved design manifest per participant', len(record), len(meta), 'One immutable design specification')
    count = {k: 0 for k in ['hash', 'row', 'permutation', 'sequence', 'items', 'item_order',
                            'pairs', 'side', 'probe', 'probe_balance', 'labels']}
    block_n = 0
    retrieval_orders, item_orders, side_orders = [], [], []
    counts = []
    for _, row in meta.iterrows():
        sid = row.session_id
        spec = record.get(sid, {})
        group = int(row.latin_square_group)
        order = spec.get('block_order', [])
        count['hash'] += group == js_hash(row.PROLIFIC_PID) % 4
        count['row'] += order == latin[group] and str(row.latin_square_order) == ','.join(map(str, order))
        count['permutation'] += sorted(order) == list(range(4))
        shifted = str(row.reward_uses_shifted_sequences).lower() in ['true', '1', '1.0']
        source = contract['shifted' if shifted else 'base']
        seq_ok = all(np.allclose(spec.get(key, []), source[src], atol=1e-9, rtol=0)
                     for key, src in [('drone_positions', 'drone'), ('supply_positions', 'supply')])
        chunks = [chunk.split('|') for chunk in spec.get('stimulus_block_orders', [])]
        flat = sum(chunks, [])
        count['items'] += len(chunks) == 4 and all(len(c) == 50 for c in chunks) and len(set(flat)) == 200 and set(flat) == set(source['pool'])
        for block, e in enc.loc[enc.session_id.eq(sid)].groupby('block'):
            block_n += 1
            b = int(block) - 1
            d = order[b]
            e = e.sort_values('trial')
            m = mem.loc[mem.session_id.eq(sid) & mem.block.eq(block)].sort_values('pair_index')
            seq_ok &= np.allclose(e.drone_position, source['drone'][d], atol=1e-9, rtol=0)
            seq_ok &= np.allclose(e.bag_position, source['supply'][d], atol=1e-9, rtol=0)
            count['labels'] += (e.canonical_design_idx.eq(d).all() and e.condition_id.eq(labels[d]).all()
                                and spec['block_order_labels'][b] == labels[d])
            count['item_order'] += len(chunks) == 4 and e.stim_img.tolist() == chunks[b]
            pairs = list(zip(m.trial1_index.astype(int), m.trial2_index.astype(int)))
            count['pairs'] += len(pairs) == len(contract['pairs']) and set(pairs) == set(map(tuple, contract['pairs']))
            lookup = e.set_index('trial').stim_img
            side_ok, probe_ok = True, True
            for _, q in m.iterrows():
                a, z = int(q.trial1_index), int(q.trial2_index)
                side_ok &= {q.stim_left_img, q.stim_right_img} == {lookup[a], lookup[z]}
                # Unreached placement stages have no selected probe in the pair row.
                if pd.notna(q.placement_probe_index):
                    p = int(q.placement_probe_index)
                    probe_ok &= a < p < z and q.placement_probe_img == lookup[p]
                    probe_ok &= np.isclose(q.placement_target_pct, 100*(p-a)/(z-a))
            count['side'] += side_ok
            count['probe'] += probe_ok
            # Saved response events do not identify unreached probes. Check only
            # blocks with all 8 two-intervening probes actually selected.
            q2 = m.loc[m.true_gap.eq(2) & m.placement_probe_index.notna()]
            if len(q2) == 8:
                balanced = (q2.placement_probe_index - q2.trial1_index).value_counts().to_dict() == {1.0: 4, 2.0: 4}
                count['probe_balance'] += balanced
            item_orders.append(tuple(e.stim_img))
            retrieval_orders.append(tuple(pairs))
            sides = (m.stim_left_img == m.expected_first_image).astype(int)
            side_orders.append(tuple(sides))
            counts.append(dict(session_id=sid, block=int(block), group=group,
                               condition=labels[d][0], first_item_left=int(sides.sum()),
                               pairs=len(m), full_probe_balance_observed=len(q2)==8))
        count['sequence'] += seq_ok
    for key, name, expected in [
        ('hash', 'Provider ID hash matches assigned group', 'Source hash modulo four'),
        ('row', 'Saved order matches assigned Latin row', 'Saved metadata and manifest agree'),
        ('permutation', 'Every participant receives all four conditions', 'One occurrence of A B C D'),
        ('sequence', 'Observed target and supply match assigned fixed arrays', 'Both sequence variants evaluated from source'),
        ('items', 'Experimental item pool is unique and complete', '200 items without replacement in four disjoint sets')]:
        check(name, count[key], len(meta), expected)
    for key, name, expected in [
        ('labels', 'Displayed condition labels follow the Latin assignment', 'Canonical condition and realized geometry'),
        ('item_order', 'Encoded items follow the saved item order', '50 items per displayed block'),
        ('pairs', 'Each fixed memory pair occurs exactly once', '14 source pairs per block'),
        ('side', 'Memory left and right items match encoding', 'One copy of each reference item'),
        ('probe', 'Selected placement probes match encoding and true location', 'Probe strictly between references')]:
        check(name, count[key], block_n, expected)
    complete_balance = sum(r['full_probe_balance_observed'] for r in counts)
    check('Earlier and later probes balanced where fully observed', count['probe_balance'], complete_balance,
          'Four earlier and four later probes among eight gap two pairs')
    check('Saved high and low labels match realized geometry', geometry.saved_labels_agree.sum(), len(geometry),
          'Larger changes and smaller supply offsets in highVol plus lowSto')
    provenance = json.loads((Path(intake['batch_root'])/'source_exports/acquisition_manifest.json').read_text())
    source_files = provenance['source_checkout_files']
    # Provenance layout is read explicitly rather than assuming source is unchanged.
    provenance_checks = []
    if isinstance(source_files, dict):
        source_files = [dict(path=k, **v) if isinstance(v, dict) else dict(path=k, sha256=v)
                        for k, v in source_files.items()]
    for item in source_files:
        path = item.get('path', item.get('relative_path', ''))
        if path and (Path(root)/path).is_file():
            provenance_checks.append(hashlib.sha256((Path(root)/path).read_bytes()).hexdigest() == item.get('sha256'))
    if provenance_checks:
        check('Runtime source matches collection acquisition hashes', sum(provenance_checks), len(provenance_checks), 'No task source changes since acquisition')
    audit = pd.DataFrame(checks)
    balance = pd.DataFrame(counts)
    diversity = pd.DataFrame([
        ['Unique item orders', len(set(item_orders)), len(item_orders)],
        ['Unique memory pair orders', len(set(retrieval_orders)), len(retrieval_orders)],
        ['Unique left right patterns', len(set(side_orders)), len(side_orders)],
        ['Blocks with all eight probe selections observable', complete_balance, block_n]],
        columns=['Diagnostic', 'Observed', 'Possible records'])
    fig, axes = plt.subplots(1, 3, figsize=(14, 3.8), layout='constrained')
    position = pd.crosstab(balance.block, balance.condition).reindex(index=range(1,5), columns=list('ABCD'), fill_value=0)
    image = axes[0].imshow(position, cmap='Blues', vmin=0, vmax=max(position.max().max(), 1))
    for i in range(4):
        for j in range(4):
            axes[0].text(j, i, str(position.iloc[i,j]), ha='center', va='center')
    axes[0].set(xticks=range(4), xticklabels=list('ABCD'), yticks=range(4), yticklabels=range(1,5),
                xlabel='Canonical condition', ylabel='Displayed block', title='Latin position counts')
    group_counts = meta.latin_square_group.value_counts().reindex(range(4), fill_value=0)
    axes[1].bar(range(4), group_counts, color='#548b9a')
    axes[1].set(xticks=range(4), xlabel='Hash assigned Latin group', ylabel='Participants', title='Group allocation')
    shift_counts = meta.reward_uses_shifted_sequences.astype(str).str.lower().isin(['true','1','1.0']).value_counts().reindex([False,True], fill_value=0)
    axes[2].bar(['Loss shifted', 'Reward shifted'], shift_counts, color=['#bb6750','#4d93ae'])
    axes[2].set(ylabel='Participants', title='Sequence offset assignment')
    for ax in axes[1:]:
        ax.set_ylim(0,len(meta)+1)
        for bar in ax.patches:
            ax.text(bar.get_x()+bar.get_width()/2,bar.get_height()+.2,str(int(bar.get_height())),ha='center')
        ax.spines[['top','right']].set_visible(False)
    # Allocation counts describe this cohort and are not participant-resampled
    # outcome estimates. A matrix of condition by position has no single delta.
    add_footers(fig,[
        (axes[0],[fixed_text(None,'Condition by position allocation counts')]),
        (axes[1],[fixed_text(group_counts.max()-group_counts.min(),
                            'Most minus least populated Latin group',decimals=0)]),
        (axes[2],[fixed_text(shift_counts.loc[True]-shift_counts.loc[False],
                            'Reward shifted minus loss shifted',decimals=0)])])
    return dict(checks=audit, balance=balance, diversity=diversity, figure=fig, position=position,
                source_contract=contract)
