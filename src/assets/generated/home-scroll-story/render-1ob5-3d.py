"""Offline 3D snapshot of 1OB5 chain F (tRNA-Phe), C1' backbone trace colored by
real reactivity using the home-scroll-story single-source color scale.
Uncovered residues (no reactivity datum) -> neutral grey. No fabricated values.
"""
import json
import warnings
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D  # noqa: F401
from Bio.PDB import MMCIFParser

warnings.simplefilter("ignore")

STOPS = [(23, 75, 58), (230, 194, 96), (232, 116, 62)]  # #174B3A / #E6C260 / #E8743E
NEUTRAL = (233 / 255, 237 / 255, 234 / 255)  # #E9EDEA


def color(t):
    t = max(0.0, min(1.0, t))
    if t < 0.5:
        lo, hi, f = STOPS[0], STOPS[1], t / 0.5
    else:
        lo, hi, f = STOPS[1], STOPS[2], (t - 0.5) / 0.5
    return tuple((lo[i] + (hi[i] - lo[i]) * f) / 255 for i in range(3))


story = json.load(open(
    "src/assets/generated/home-scroll-story/story.json"))["cases"][0]
positions = story["positions"]
react = story["reactivity"]
ceiling = story["norm_ceiling"]
react_by_pos = {p: r for p, r in zip(positions, react)}

parser = MMCIFParser(QUIET=True)
structure = parser.get_structure("1ob5", "/tmp/1ob5.cif")
chF = structure[0]["F"]

xs, ys, zs, cols = [], [], [], []
for res in chF:
    if res.id[0] != " " or "C1'" not in res:
        continue
    num = res.id[1]
    x, y, z = res["C1'"].coord
    xs.append(x)
    ys.append(y)
    zs.append(z)
    if num in react_by_pos:
        cols.append(color(max(0.0, min(1.0, (react_by_pos[num] or 0) / ceiling))))
    else:
        cols.append(NEUTRAL)

pts = np.column_stack([xs, ys, zs]).astype(float)
# Orient via PCA so the two longest principal axes (the tRNA L arms) lie in
# the viewing plane -> the classic L-shape reads clearly from a fixed camera.
center = pts.mean(axis=0)
centered = pts - center
_, _, vt = np.linalg.svd(centered, full_matrices=False)
aligned = centered @ vt.T  # cols: PC1 (longest), PC2, PC3
xs, ys, zs = aligned[:, 0], aligned[:, 1], aligned[:, 2]

fig = plt.figure(figsize=(5.2, 5.6), dpi=150)
ax = fig.add_subplot(111, projection="3d")
ax.plot(xs, ys, zs, color="#9FB0A6", lw=1.6, alpha=0.7, zorder=1)
ax.scatter(xs, ys, zs, c=cols, s=46, edgecolors="white", linewidths=0.6,
           depthshade=False, zorder=2)

# Frame as the classic tRNA L-shape: equalize aspect, clean background.
max_range = np.array([xs.max() - xs.min(), ys.max() - ys.min(),
                      zs.max() - zs.min()]).max() / 2.0
mid = [(xs.max() + xs.min()) / 2, (ys.max() + ys.min()) / 2,
       (zs.max() + zs.min()) / 2]
ax.set_xlim(mid[0] - max_range, mid[0] + max_range)
ax.set_ylim(mid[1] - max_range, mid[1] + max_range)
ax.set_zlim(mid[2] - max_range, mid[2] + max_range)
ax.view_init(elev=90, azim=-90)
ax.set_axis_off()
fig.patch.set_alpha(0)
ax.patch.set_alpha(0)
fig.tight_layout(pad=0)
out = "src/assets/generated/home-scroll-story/1ob5-3d.png"
fig.savefig(out, transparent=True, bbox_inches="tight", pad_inches=0.1)
print("wrote", out, "| residues plotted:", len(xs),
      "| colored:", sum(1 for c in cols if c != NEUTRAL))
