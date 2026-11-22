"""Writes src/img/demo.gif from the frames of scripts/record-demo.mjs.

Requires Pillow (pip install pillow), for instance in a virtual environment:
    python3 -m venv /tmp/gif && /tmp/gif/bin/pip install pillow && /tmp/gif/bin/python scripts/make-gif.py
"""
import json
import sys
from pathlib import Path

from PIL import Image

FRAMES = Path('test-results/demo-frames')
OUT = Path(sys.argv[1] if len(sys.argv) > 1 else 'src/img/demo.gif')
WIDTH = 1200
# About 10 frames per second: shorter frames are merged into the next one.
MIN_DURATION = 100
# The last frame stays a moment before the loop starts again.
LAST_DURATION = 1500

durations = json.loads((FRAMES / 'durations.json').read_text())
paths = sorted(FRAMES.glob('*.png'))

kept, times, pending = [], [], 0
for path, duration in zip(paths, durations):
    pending += duration
    if pending >= MIN_DURATION:
        kept.append(path)
        times.append(pending)
        pending = 0
times[-1] = LAST_DURATION


def load(path):
    image = Image.open(path).convert('RGB')
    return image.resize((WIDTH, round(image.height * WIDTH / image.width)), Image.LANCZOS)


# One palette for all the frames, taken from frames spread over the tour: no flicker between frames, and unchanged
# areas stay identical, so that only what changes is stored.
samples = [load(p) for p in kept[:: max(1, len(kept) // 12)]]
sheet = Image.new('RGB', (WIDTH, samples[0].height * len(samples)))
for i, sample in enumerate(samples):
    sheet.paste(sample, (0, i * sample.height))
palette = sheet.quantize(colors=255, method=Image.Quantize.FASTOCTREE)

frames = [load(p).quantize(palette=palette, dither=Image.Dither.NONE) for p in kept]
frames[0].save(OUT, save_all=True, append_images=frames[1:], duration=times, loop=0, optimize=True, disposal=1)
print(f'{OUT}: {len(frames)} frames, {sum(times) / 1000:.1f} s, {OUT.stat().st_size / 1e6:.1f} MB')
