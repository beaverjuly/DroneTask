"""Numerical contrasts in dedicated, measurable subplot footer areas.

Confidence intervals come from participant differences. Fixed design arrays and
cohort allocation counts have descriptive differences without sampling intervals.
"""
import textwrap

import numpy as np
import pandas as pd


def numeric_interval_text(mean, lo, hi, label, decimals=3):
    """Format an already computed paired contrast, keeping its stated direction."""
    def number(value):
        return f'{float(value):+.{decimals}f}' if np.isfinite(value) else 'not estimable'
    interval = (f'95% interval [{number(lo)}, {number(hi)}]'
                if np.isfinite(lo) and np.isfinite(hi) else '95% interval not estimable')
    return f'{label}\nΔ {number(mean)}   {interval}'


def interval_text(values, label, mean_ci_fn, decimals=3):
    """Bootstrap participant difference values rather than marginal endpoints."""
    result = mean_ci_fn(values)
    return numeric_interval_text(result['mean'], result['ci_low'],
                                 result['ci_high'], label, decimals)


def paired_text(first, second, label, mean_ci_fn, decimals=3):
    """Align paired participant indices and report SECOND minus FIRST."""
    pairs = pd.concat([pd.to_numeric(first, errors='coerce').rename('first'),
                       pd.to_numeric(second, errors='coerce').rename('second')], axis=1).dropna()
    return interval_text(pairs['second']-pairs['first'], label, mean_ci_fn, decimals)


def fixed_text(delta, label, decimals=3):
    """A descriptive difference for a fixed array or allocation count."""
    number = f'{float(delta):+.{decimals}f}' if delta is not None and np.isfinite(delta) else 'not applicable'
    return f'{label}\nΔ {number}   interval not applicable'


def add_footers(fig, panels):
    """Reserve real layout space under each data axis for numerical summaries.

    Each original subplot becomes a nested chart/footer pair. Figure height grows
    once per original row, so extra text never borrows space from a neighboring
    chart. Footer axes are tagged for rendered bounding-box checks.
    """
    panels = list(panels)
    if not panels:
        return fig
    if getattr(fig, '_pilot1_footers', None):
        raise ValueError('Numerical footers have already been attached to this figure.')
    original_width, original_height = fig.get_size_inches()
    row_heights = {}
    specs = []
    for ax, texts in panels:
        spec = ax.get_subplotspec()
        top = spec.get_topmost_subplotspec()
        grid = top.get_gridspec()
        row_key = (id(grid), top.rowspan.start, top.rowspan.stop)
        rows = grid.nrows
        # Estimate printable width conservatively before constrained layout runs.
        width = original_width * (top.colspan.stop-top.colspan.start)/grid.ncols-.8
        fontsize = 9.0 if width < 4.2 else 9.5
        chars = max(36, int(width*72/(fontsize*.65)))
        blocks = []
        for text in texts:
            lines = []
            for line in str(text).splitlines():
                lines.extend(textwrap.wrap(line, width=chars, break_long_words=False,
                                           break_on_hyphens=False) or [''])
            blocks.append('\n'.join(lines))
        line_height = fontsize/72*1.50
        gap = .12
        height = sum(len(s.splitlines())*line_height for s in blocks) + gap*max(len(blocks)-1, 0)+.32
        height = max(height, .66)
        row_heights[row_key] = max(row_heights.get(row_key, 0), height)
        specs.append((ax, spec, row_key, max(original_height/rows-.9, 1.8), blocks, fontsize, line_height, gap))
    fig.set_size_inches(original_width, original_height+sum(row_heights.values())+.10*len(row_heights), forward=True)
    metadata = []
    for ax, spec, row_key, chart_height, blocks, fontsize, line_height, gap in specs:
        if ax.get_ylabel():
            # Long vertical unit labels must not run into another row's title.
            ax.set_ylabel('\n'.join(textwrap.fill(line, width=34,
                break_long_words=False, break_on_hyphens=False)
                for line in ax.get_ylabel().splitlines()))
        height = row_heights[row_key]
        nested = spec.subgridspec(2, 1, height_ratios=[chart_height, height], hspace=.035)
        ax.set_subplotspec(nested[0])
        footer = fig.add_subplot(nested[1])
        footer.set_axis_off()
        footer.set_xlim(0, 1)
        footer.set_ylim(0, height)
        footer._pilot1_footer = True
        footer._pilot1_chart = ax
        labels = []
        y = height-.08
        for block in blocks:
            text = footer.text(.5, y, block, transform=footer.transData,
                               ha='center', va='top', fontsize=fontsize,
                               linespacing=1.32, color='#273640', clip_on=False)
            labels.append(text)
            y -= len(block.splitlines())*line_height+gap
        metadata.append(dict(chart=ax, footer=footer, texts=labels))
    fig._pilot1_footers = metadata
    return fig
