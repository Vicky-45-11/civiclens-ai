"""Issue classification with PyTorch.

If MODEL_PATH points at a checkpoint produced by ai/train.py, photos are classified by that
network. Without a checkpoint nothing is classified: the API says so and marks the result as a demo,
and the resident's own category choice is used. No pretrained civic model ships with this repository.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from pathlib import Path

from PIL import Image

from ..config import get_settings
from ..models import Category
from . import severity

log = logging.getLogger("civiclens.ai")

CATEGORIES = [c.value for c in Category]
IMG_SIZE = 224
MEAN = (0.485, 0.456, 0.406)
STD = (0.229, 0.224, 0.225)


@dataclass
class Suggestion:
    category: str | None
    confidence: float | None
    severity: int
    model: str
    is_demo: bool
    note: str
    probabilities: dict[str, float] | None = None


def build_model(num_classes: int, pretrained: bool = False):
    from torchvision.models import MobileNet_V3_Small_Weights, mobilenet_v3_small

    weights = MobileNet_V3_Small_Weights.DEFAULT if pretrained else None
    net = mobilenet_v3_small(weights=weights)
    in_features = net.classifier[3].in_features
    net.classifier[3] = __import__("torch").nn.Linear(in_features, num_classes)
    return net


def preprocess(img: Image.Image):
    import torch

    img = img.convert("RGB").resize((IMG_SIZE, IMG_SIZE), Image.Resampling.BILINEAR)
    arr = torch.from_numpy(__import__("numpy").asarray(img).copy()).float().div(255).permute(2, 0, 1)
    mean = torch.tensor(MEAN).view(3, 1, 1)
    std = torch.tensor(STD).view(3, 1, 1)
    return ((arr - mean) / std).unsqueeze(0)


class Classifier:
    def __init__(self, checkpoint: str | None) -> None:
        self.net = None
        self.classes: list[str] = []
        self.name = "none"
        self.error: str | None = None
        if checkpoint and Path(checkpoint).is_file():
            self._load(checkpoint)
        elif checkpoint:
            self.error = f"MODEL_PATH {checkpoint!r} does not exist"

    def _load(self, path: str) -> None:
        try:
            import torch

            ckpt = torch.load(path, map_location="cpu", weights_only=True)
            classes = list(ckpt["classes"])
            unknown = [c for c in classes if c not in CATEGORIES]
            if unknown:
                raise ValueError(f"checkpoint has unknown classes: {unknown}")
            net = build_model(len(classes))
            net.load_state_dict(ckpt["state_dict"])
            net.eval()
            self.net, self.classes = net, classes
            self.name = f"pytorch:{ckpt.get('arch', 'mobilenet_v3_small')}:{os.path.basename(path)}"
        except Exception as exc:  # a bad checkpoint must not take the API down
            self.error = f"could not load checkpoint: {exc}"
            log.warning(self.error)

    @property
    def loaded(self) -> bool:
        return self.net is not None

    def suggest(self, img: Image.Image, chosen_category: str | None = None) -> Suggestion:
        sev = severity.suggest_severity(img)
        if not self.loaded:
            return Suggestion(
                category=chosen_category,
                confidence=None,
                severity=sev,
                model=severity.NAME,
                is_demo=True,
                note=(
                    "Demo mode: no trained image classifier is loaded, so the category was not detected from the photo. "
                    "The severity is a simple image-statistics estimate. A person reviews both."
                ),
            )
        import torch

        with torch.no_grad():
            probs = torch.softmax(self.net(preprocess(img)), dim=1)[0]
        idx = int(probs.argmax())
        return Suggestion(
            category=self.classes[idx],
            confidence=float(probs[idx]),
            severity=sev,
            model=self.name,
            is_demo=False,
            note="Suggested by the image classifier. A person reviews it before anything is acted on.",
            probabilities={c: float(p) for c, p in zip(self.classes, probs, strict=True)},
        )


_classifier: Classifier | None = None


def get_classifier() -> Classifier:
    global _classifier
    if _classifier is None:
        _classifier = Classifier(get_settings().model_path)
    return _classifier


def reset_classifier() -> None:
    global _classifier
    _classifier = None
