"""Fine-tune the issue classifier on your own labelled photos.

Folder layout (class names must match the categories):
    data/pothole/*.jpg  data/streetlight/*.jpg  data/overflowing_bin/*.jpg ...

    python -m app.ai.train --data ./data --epochs 8 --out ./models/civiclens.pt [--pretrained]

--pretrained downloads ImageNet weights (needs internet access to download.pytorch.org) and gives
far better accuracy on small datasets. Without it the network trains from scratch.
Review the printed validation accuracy before pointing MODEL_PATH at the result.
"""

from __future__ import annotations

import argparse
import random
from pathlib import Path

from .classifier import CATEGORIES, IMG_SIZE, MEAN, STD, build_model


def train(data: str, epochs: int, out: str, pretrained: bool, batch_size: int = 16, lr: float = 1e-3, seed: int = 0) -> float:
    import torch
    from torch import nn
    from torch.utils.data import DataLoader, random_split
    from torchvision import datasets, transforms

    torch.manual_seed(seed)
    random.seed(seed)
    tf = transforms.Compose(
        [
            transforms.Resize((IMG_SIZE, IMG_SIZE)),
            transforms.RandomHorizontalFlip(),
            transforms.ColorJitter(0.2, 0.2, 0.2),
            transforms.ToTensor(),
            transforms.Normalize(MEAN, STD),
        ]
    )
    ds = datasets.ImageFolder(data, transform=tf)
    unknown = [c for c in ds.classes if c not in CATEGORIES]
    if unknown:
        raise SystemExit(f"Folder names must be categories {CATEGORIES}; found {unknown}")
    if len(ds) < 10:
        raise SystemExit("Need at least 10 images to train.")
    n_val = max(1, len(ds) // 5)
    train_ds, val_ds = random_split(ds, [len(ds) - n_val, n_val], generator=torch.Generator().manual_seed(seed))
    net = build_model(len(ds.classes), pretrained=pretrained)
    opt = torch.optim.AdamW(net.parameters(), lr=lr)
    loss_fn = nn.CrossEntropyLoss()
    acc = 0.0
    for epoch in range(epochs):
        net.train()
        for x, y in DataLoader(train_ds, batch_size=batch_size, shuffle=True):
            opt.zero_grad()
            loss_fn(net(x), y).backward()
            opt.step()
        net.eval()
        correct = 0
        with torch.no_grad():
            for x, y in DataLoader(val_ds, batch_size=batch_size):
                correct += int((net(x).argmax(1) == y).sum())
        acc = correct / n_val
        print(f"epoch {epoch + 1}/{epochs}  validation accuracy {acc:.3f} ({n_val} images)")
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    torch.save({"arch": "mobilenet_v3_small", "classes": ds.classes, "state_dict": net.state_dict(), "val_accuracy": acc}, out)
    print(f"saved {out}")
    return acc


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--data", required=True)
    p.add_argument("--epochs", type=int, default=8)
    p.add_argument("--out", default="./models/civiclens.pt")
    p.add_argument("--pretrained", action="store_true")
    a = p.parse_args()
    train(a.data, a.epochs, a.out, a.pretrained)
