"""
js_import.py — Parse DroneTask JS source files into Python objects.

Lives alongside the design-check notebooks (currently DroneTask/design_checks/,
but REPO_ROOT auto-detects regardless of nesting depth — see _find_repo_root).
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
    is found. Falls back to two levels up if nothing matches, so this
    works whether design_checks/ sits directly under the repo root or
    nested under analysis/ or anywhere else."""
    p = start
    for _ in range(max_up):
        if all((p / m).exists() for m in markers):
            return p
        if p.parent == p:
            break
        p = p.parent
    return start.parent.parent  # defensive fallback

DESIGN_DIR = Path(__file__).resolve().parent
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
