"""Pipeline tests for the PyTorch classifier.

These train a tiny network on synthetic colour swatches to prove that training, checkpointing, loading and
inference are wired correctly. They say nothing about accuracy on real civic photos: no such model ships.
"""

import pytest

pytest.importorskip("torch")
pytest.importorskip("torchvision")

from PIL import Image  # noqa: E402

from app.ai.classifier import Classifier, reset_classifier  # noqa: E402
from app.ai.train import train  # noqa: E402
from app.config import get_settings  # noqa: E402

from .conftest import H, client_for, jpeg, make_user  # noqa: E402,F401

SWATCH = {"pothole": (40, 40, 40), "streetlight": (250, 240, 60), "water_leak": (40, 90, 220)}


@pytest.fixture(scope="module")
def checkpoint(tmp_path_factory):
    root = tmp_path_factory.mktemp("data")
    for cls, colour in SWATCH.items():
        (root / cls).mkdir()
        for i in range(12):
            tint = tuple(max(0, min(255, c + (i * 3) - 18)) for c in colour)
            Image.new("RGB", (96, 96), tint).save(root / cls / f"{i}.jpg")
    out = tmp_path_factory.mktemp("model") / "tiny.pt"
    train(str(root), epochs=6, out=str(out), pretrained=False, batch_size=8)
    return str(out)


def test_checkpoint_loads_and_predicts_trained_classes(checkpoint):
    clf = Classifier(checkpoint)
    assert clf.loaded and clf.error is None
    assert sorted(clf.classes) == sorted(SWATCH)
    s = clf.suggest(Image.new("RGB", (120, 120), SWATCH["streetlight"]))
    assert s.is_demo is False and s.category in SWATCH
    assert 0 < s.confidence <= 1 and abs(sum(s.probabilities.values()) - 1) < 1e-4
    assert 1 <= s.severity <= 5


def test_missing_or_broken_checkpoint_falls_back_to_demo(tmp_path):
    missing = Classifier(str(tmp_path / "nope.pt"))
    assert not missing.loaded and "does not exist" in missing.error
    bad = tmp_path / "bad.pt"
    bad.write_bytes(b"not a checkpoint")
    broken = Classifier(str(bad))
    assert not broken.loaded and broken.error
    s = broken.suggest(Image.new("RGB", (50, 50)), "pothole")
    assert s.is_demo and s.category == "pothole" and s.confidence is None


def test_api_reports_model_mode_when_checkpoint_configured(checkpoint, client, monkeypatch):
    monkeypatch.setattr(get_settings(), "model_path", checkpoint)
    reset_classifier()
    try:
        assert client.get("/api/health").json()["ai_mode"] == "model"
        c = client_for("ai@example.com")
        r = c.post("/api/issues/preview", files=[("photos", ("a.jpg", jpeg(), "image/jpeg"))], data={"lat": "12.97", "lon": "80.04"}, headers=H)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ai"]["is_demo"] is False
        assert body["ai"]["confidence"] is not None
    finally:
        monkeypatch.undo()
        reset_classifier()
