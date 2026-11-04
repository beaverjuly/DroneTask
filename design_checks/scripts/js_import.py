"""
js_import.py — Parse DroneTask JS source files into Python objects.

Lives in design_checks/scripts, beside the notebooks and figures folders.
REPO_ROOT auto-detects regardless of nesting depth — see _find_repo_root.
All three design-check notebooks import from this module instead of
duplicating parser functions.

Usage:
    from js_import import load_sources, parse, save_fig, DESIGN_DIR
"""
import re, hashlib, textwrap
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

# ── Paths ──
def _find_repo_root(start, markers=("index.html", "static"), max_up=6):
    """Walk upward from `start` until a folder containing all `markers`
    is found. Raise clearly if no matching repository can be located."""
    p = start
    for _ in range(max_up):
        if all((p / m).exists() for m in markers):
            return p
        if p.parent == p:
            break
        p = p.parent
    raise FileNotFoundError(f"Cannot locate DroneTask repository above {start}")

SCRIPTS_DIR = Path(__file__).resolve().parent
DESIGN_DIR = SCRIPTS_DIR.parent
REPO_ROOT = _find_repo_root(DESIGN_DIR)
FIG_DIR = {
    "game":   DESIGN_DIR / "figures" / "game_trials",
    "memory": DESIGN_DIR / "figures" / "memory_task",
    "latin":  DESIGN_DIR / "figures" / "counterbalancing",
}
for d in FIG_DIR.values():
    d.mkdir(parents=True, exist_ok=True)

# ── Matplotlib publication style ──
def apply_style():
    plt.rcParams.update({
        "figure.facecolor": "white", "axes.facecolor": "white",
        "axes.grid": True, "grid.alpha": 0.25, "grid.linewidth": 0.4,
        "axes.spines.top": False, "axes.spines.right": False,
        "font.family": "sans-serif", "font.size": 11,
        "axes.titlesize": 13, "axes.titleweight": "bold",
        "axes.labelsize": 11, "figure.dpi": 180, "savefig.dpi": 300,
        "savefig.bbox": "tight", "savefig.pad_inches": 0.15,
    })

# ── JS source readers ──
def read_text(relpath):
    p = REPO_ROOT / relpath
    return p.read_text(encoding="utf-8") if p.exists() else None

def load_sources():
    """Load all relevant JS source files into a dict."""
    keys = {
        "stimuli":   "static/task/stimuli.js",
        "details":   "static/task/stimuli-details.js",
        "trial":     "static/task/trial.js",
        "memory":    "static/task/memory_task.js",
        "index":     "index.html",
        "preload":   "static/task/preload.js",
        "latin":     "static/task/latin_square.js",
        "instructions": "static/task/instructions.js",
    }
    src = {}
    for k, p in keys.items():
        txt = read_text(p)
        if txt:
            src[k] = txt
            print(f"  \u2713 {p} ({len(txt):,} chars)")
        else:
            src[k] = ""
            print(f"  \u2717 {p} NOT FOUND")
    return src

def load_runtime_design():
    """Execute both JS sequence assignments and all four Latin groups.

    Numeric factor values are nominal codes. Geometry is measured from the
    assembled arrays, after the same shift/clipping steps used by the browser.
    """
    import json
    import subprocess
    script = r"""
const fs = require('node:fs'), vm = require('node:vm');
const files = ['static/task/stimuli.js', 'static/task/latin_square.js'];
function load(shiftReward) {
  const math = Object.create(Math);
  math.random = () => shiftReward ? 0.25 : 0.75;
  const ctx = {Math:math, console:{log(){}, warn(){}}, Set};
  ctx.window=ctx;
  vm.createContext(ctx);
  files.forEach(file=>vm.runInContext(fs.readFileSync(file,'utf8'),ctx));
  const groups=[];
  for (let group=0;group<4;group++) {
    ctx._urlParams={get:name=>name==='latin_group'?String(group):null};
    ctx.PROLIFIC_PID='audit';
    ctx.workerId=ctx.subId=ctx.SESSION_ID='';
    ctx.initLatinSquare();
    groups.push({group:group,order:ctx.block_order.slice(),labels:ctx.block_order_labels.slice()});
  }
  return {reward_uses_shifted_sequences:shiftReward,
    stimuli_version:ctx.stimuli_version,condition_label_version:ctx.condition_label_version,
    factors_vol:ctx.factors_vol,factors_stc:ctx.factors_stc,factors_valence:ctx.factors_valence,
    condition_ids:ctx.CANONICAL_CONDITION_LABELS,latin_square:ctx.LATIN_SQUARE_4,
    latin_groups:groups,metrics:ctx.validateMainConditionLabels(),
    drone:ctx.main_drone_position,landing:ctx.main_bag_position,
    base_drone:[ctx.lowVol_base_drone,ctx.highVol_base_drone,ctx.lowVol_base_drone,ctx.highVol_base_drone],
    base_landing:[ctx.lowVol_base_bag,ctx.highVol_base_bag,ctx.lowVol_base_bag,ctx.highVol_base_bag],
    shift_deltas:[ctx.LOWVOL_SHIFT_DELTA,ctx.HIGHVOL_SHIFT_DELTA],
    stimulus_pool:ctx.STIMULUS_IMAGE_POOL,practice_emoji:ctx.PRACTICE_EMOJI,
    slider_pairs:ctx.SLIDER_PAIRS,boundary_pairs:ctx.BOUNDARY_MIDDLE_PAIRS,
    nonboundary_pairs:ctx.NONBOUNDARY_MIDDLE_PAIRS};
}
process.stdout.write(JSON.stringify({variants:[load(false),load(true)]}));
"""
    result = subprocess.run(['node', '-e', script], cwd=REPO_ROOT,
                            text=True, capture_output=True, check=True)
    return json.loads(result.stdout)


# ── JS value parsers ──
class parse:
    """Namespace of static methods for extracting JS values."""

    @staticmethod
    def flat_array(text, varname):
        m = re.search(rf'var\s+{varname}\s*=\s*\[([\s\S]*?)\];', text)
        if not m: return None
        return [float(x) for x in re.findall(r'-?\d+\.?\d*', m.group(1))]

    @staticmethod
    def array_2d(text, varname):
        m = re.search(rf'var\s+{varname}\s*=\s*\[([\s\S]*?)\];', text)
        if not m: return None
        rows = re.findall(r'\[([^\]]+)\]', m.group(1))
        return [[float(x) for x in re.findall(r'-?\d+\.?\d*', r)] for r in rows]

    @staticmethod
    def string(text, varname):
        m = re.search(rf'var\s+{varname}\s*=\s*["\']([^"\']*)["\']', text)
        return m.group(1) if m else None

    @staticmethod
    def string_array(text, varname):
        m = re.search(rf'var\s+{varname}\s*=\s*\[([\s\S]*?)\];', text)
        if not m: return None
        return re.findall(r'"([^"]*)"', m.group(1)) or re.findall(r"'([^']*)'", m.group(1))

    @staticmethod
    def int_pair_array(text, varname):
        m = re.search(rf'var\s+{varname}\s*=\s*\[([\s\S]*?)\];', text)
        if not m: return None
        pairs = re.findall(r'\[\s*(\d+)\s*,\s*(\d+)\s*\]', m.group(1))
        return [[int(a), int(b)] for a, b in pairs]

    @staticmethod
    def scalar(text, varname):
        m = re.search(rf'var\s+{varname}\s*=\s*([-\d.]+)', text)
        return float(m.group(1)) if m else None

    @staticmethod
    def capture_thresholds(text):
        """Extract computeCaptureCount step-function from trial.js."""
        thresholds = []
        for m in re.finditer(r'distance\s*<=\s*([\d.]+)\)\s*return\s+(\d+)', text):
            thresholds.append((float(m.group(1)), int(m.group(2))))
        thresholds.append((100.0, 0))
        return thresholds

# ── Figure export ──
def save_fig(fig, stem, category="game", also_html=False):
    """Save a figure as PNG + PDF to the appropriate subfolder."""
    d = FIG_DIR.get(category, DESIGN_DIR / "figures")
    d.mkdir(parents=True, exist_ok=True)
    for ext in ("png", "pdf"):
        path = d / f"{stem}.{ext}"
        fig.savefig(path)
    print(f"  \u2713 {d.name}/{stem}.png + .pdf")
    if also_html:
        import base64
        png_path = d / f"{stem}.png"
        b64 = base64.b64encode(png_path.read_bytes()).decode()
        html_path = d / f"{stem}.html"
        html_path.write_text(
            f'<!DOCTYPE html><html><body style="margin:0;background:#fff">'
            f'<img src="data:image/png;base64,{b64}" style="max-width:100%"></body></html>',
            encoding="utf-8")
        print(f"  \u2713 {d.name}/{stem}.html")


def save_html(html_str, filename, category="game"):
    """Save an HTML string to the appropriate category subfolder."""
    d = FIG_DIR.get(category, DESIGN_DIR / "figures")
    d.mkdir(parents=True, exist_ok=True)
    path = d / filename
    path.write_text(html_str, encoding="utf-8")
    print(f"  \u2713 {d.name}/{filename}")

def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()
