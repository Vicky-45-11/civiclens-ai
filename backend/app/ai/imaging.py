"""Image validation, privacy scrubbing and fingerprinting for uploaded photos."""

import io
from dataclasses import dataclass

import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

Image.MAX_IMAGE_PIXELS = 40_000_000  # guards against decompression bombs
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
MAX_SIDE = 1600


class InvalidImage(ValueError):
    pass


@dataclass
class ProcessedImage:
    data: bytes  # re-encoded JPEG with no metadata
    width: int
    height: int
    phash: str  # 64-bit difference hash as 16 hex characters
    image: Image.Image  # RGB, scaled, for the AI step


def process_upload(raw: bytes) -> ProcessedImage:
    """Decode, verify, rotate by EXIF, then re-encode so GPS and camera metadata are dropped."""
    try:
        probe = Image.open(io.BytesIO(raw))
        probe.verify()
        img = Image.open(io.BytesIO(raw))
        if img.format not in ALLOWED_FORMATS:
            raise InvalidImage("Only JPEG, PNG or WebP photos are accepted.")
        img = ImageOps.exif_transpose(img).convert("RGB")
    except InvalidImage:
        raise
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, SyntaxError) as exc:
        raise InvalidImage("That file is not a readable photo.") from exc
    if min(img.size) < 64:
        raise InvalidImage("The photo is too small to be useful.")
    img.thumbnail((MAX_SIDE, MAX_SIDE))
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=85, optimize=True)  # no exif= argument: metadata is not carried over
    return ProcessedImage(out.getvalue(), img.width, img.height, dhash(img), img)


def dhash(img: Image.Image) -> str:
    small = np.asarray(img.convert("L").resize((9, 8), Image.Resampling.LANCZOS), dtype=np.int16)
    bits = (small[:, 1:] > small[:, :-1]).flatten()
    value = 0
    for b in bits:
        value = (value << 1) | int(b)
    return f"{value:016x}"


def hamming(a: str | None, b: str | None) -> int | None:
    if not a or not b:
        return None
    return bin(int(a, 16) ^ int(b, 16)).count("1")
