"""Visual severity suggestion.

This is a transparent image-statistics heuristic, NOT a trained model: it looks at how much of the
photo is very dark (cavities, standing water, shadow), how much edge detail there is (cracks, debris)
and overall contrast. It produces a 1-5 suggestion that a human must confirm during triage.
"""

import numpy as np
from PIL import Image

NAME = "visual-heuristic-v1"


def suggest_severity(img: Image.Image) -> int:
    g = np.asarray(img.convert("L").resize((160, 160)), dtype=np.float32) / 255.0
    dark = float((g < 0.18).mean())
    gx = np.abs(np.diff(g, axis=1))[:-1, :]
    gy = np.abs(np.diff(g, axis=0))[:, :-1]
    edges = float((np.hypot(gx, gy) > 0.12).mean())
    contrast = float(g.std())
    score = 2.2 * dark + 3.0 * edges + 1.2 * contrast  # roughly 0 .. 1.5
    return int(min(5, max(1, round(1 + score * 3.2))))
