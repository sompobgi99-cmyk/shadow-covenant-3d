from pathlib import Path
from datetime import datetime, timezone
import json

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage


ROOT = Path("assets/character-bank")
KEY = "gravekeeper_openai"
CHAR_DIR = ROOT / KEY
SOURCE = CHAR_DIR / "source" / "gravekeeper_walk_alpha.png"
DIRECTIONS = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"]
FRAME_SIZE = 64
FRAME_COUNT = 4


def detect_characters(image):
    alpha = np.asarray(image.getchannel("A")) > 32
    labels, _ = ndimage.label(alpha)
    boxes = []
    for index, slices in enumerate(ndimage.find_objects(labels), start=1):
        if slices is None:
            continue
        area = int((labels[slices] == index).sum())
        if area < 300:
            continue
        y_slice, x_slice = slices
        boxes.append((x_slice.start, y_slice.start, x_slice.stop, y_slice.stop))
    boxes.sort(key=lambda box: (box[1], box[0]))
    if len(boxes) != 28:
        raise RuntimeError(f"Expected 28 character cells, found {len(boxes)}")
    return [boxes[row * 4:(row + 1) * 4] for row in range(7)]


def normalize_frames(image, rows):
    max_width = max(box[2] - box[0] for row in rows for box in row)
    max_height = max(box[3] - box[1] for row in rows for box in row)
    scale = min(58 / max_width, 58 / max_height)
    normalized = []
    for row in rows:
        frames = []
        for box in row:
            frame = image.crop(box)
            alpha = frame.getchannel("A").point(lambda value: 255 if value >= 96 else 0)
            frame.putalpha(alpha)
            width = max(1, round(frame.width * scale))
            height = max(1, round(frame.height * scale))
            frame = frame.resize((width, height), Image.Resampling.NEAREST)
            cell = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
            x = (FRAME_SIZE - width) // 2
            y = 62 - height
            cell.alpha_composite(frame, (x, y))
            frames.append(cell)
        normalized.append(frames)
    # The model rendered horizontal directions mirrored from their prompt labels.
    # Remap by visible facing direction and derive only the missing south-east row.
    return [
        normalized[0],
        [frame.transpose(Image.Transpose.FLIP_LEFT_RIGHT) for frame in normalized[1]],
        normalized[6],
        normalized[5],
        normalized[4],
        normalized[3],
        normalized[2],
        normalized[1],
    ]


def stabilize_walk(frames):
    stabilized = []
    for direction_frames in frames:
        base = direction_frames[0]
        boxes = [frame.getbbox() for frame in direction_frames if frame.getbbox()]
        bottom = max(box[3] for box in boxes)
        leg_cut = max(40, bottom - 20)
        row = []
        for pose in direction_frames:
            output = base.copy()
            output.paste((0, 0, 0, 0), (0, leg_cut, FRAME_SIZE, FRAME_SIZE))
            output.alpha_composite(pose.crop((0, leg_cut, FRAME_SIZE, FRAME_SIZE)), (0, leg_cut))
            row.append(output)
        stabilized.append(row)
    return stabilized


def save_sources(frames):
    raw = CHAR_DIR / "raw"
    for row, direction in enumerate(DIRECTIONS):
        direction_dir = raw / "walk" / direction
        direction_dir.mkdir(parents=True, exist_ok=True)
        frames[row][0].save(raw / f"{direction}.png")
        for frame_index, frame in enumerate(frames[row]):
            frame.save(direction_dir / f"{frame_index:02d}.png")
        idle_dir = raw / "idle" / direction
        idle_dir.mkdir(parents=True, exist_ok=True)
        for frame_index in range(FRAME_COUNT):
            frames[row][0].save(idle_dir / f"{frame_index:02d}.png")


def build_sheet(frames, output):
    sheet = Image.new("RGBA", (FRAME_SIZE * FRAME_COUNT, FRAME_SIZE * len(DIRECTIONS)), (0, 0, 0, 0))
    for row in range(len(DIRECTIONS)):
        for column in range(FRAME_COUNT):
            sheet.alpha_composite(frames[row][column], (column * FRAME_SIZE, row * FRAME_SIZE))
    sheet.save(output)


def build_portrait(front):
    box = front.getbbox()
    subject = front.crop(box) if box else front
    subject = subject.resize((subject.width * 2, subject.height * 2), Image.Resampling.NEAREST)
    portrait = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
    portrait.alpha_composite(subject, ((96 - subject.width) // 2, 94 - subject.height))
    portrait.save(CHAR_DIR / f"char_{KEY}_portrait.png")
    (CHAR_DIR / "raw" / "portrait.png").parent.mkdir(parents=True, exist_ok=True)
    portrait.save(CHAR_DIR / "raw" / "portrait.png")


def build_preview(frames):
    scale = 3
    canvas = Image.new("RGBA", (FRAME_SIZE * scale * 4, FRAME_SIZE * scale * 8 + 34), (13, 10, 18, 255))
    draw = ImageDraw.Draw(canvas)
    draw.text((10, 9), "Gravekeeper OpenAI - walk 4 frames / 8 directions", fill=(244, 207, 115, 255))
    for row in range(8):
        for column in range(4):
            frame = frames[row][column].resize((FRAME_SIZE * scale, FRAME_SIZE * scale), Image.Resampling.NEAREST)
            canvas.alpha_composite(frame, (column * FRAME_SIZE * scale, 34 + row * FRAME_SIZE * scale))
    canvas.save(CHAR_DIR / "preview_gravekeeper_openai.png")


def write_data():
    description = "Adult gothic cemetery keeper in a short black undertaker coat, charcoal waistcoat, brimmed hat, gloves and sturdy boots."
    metadata = {
        "key": KEY,
        "name": "Gravekeeper (OpenAI Prototype)",
        "description": description,
        "directions": DIRECTIONS,
        "walkFrames": FRAME_COUNT,
        "idleFrames": FRAME_COUNT,
        "walkCols": FRAME_COUNT,
        "idleCols": FRAME_COUNT,
        "frameWidth": FRAME_SIZE,
        "walkFrameHeight": FRAME_SIZE,
        "idleFrameHeight": FRAME_SIZE,
        "dirRows": [0, 7, 6, 5, 4, 3, 2, 1],
        "source": "OpenAI Images",
        "sourceRows": 7,
        "derivedDirection": "south-east mirrored from south-west",
        "walkProcessing": "upper body stabilized; generated leg poses retained below knee",
        "idleType": "static prototype",
        "wiredIntoGame": False,
    }
    (CHAR_DIR / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    roster = {"generatedAt": "2026-07-15", "wiredIntoGame": False, "characters": [{"key": KEY, "name": metadata["name"], "description": description}]}
    (ROOT / "roster.json").write_text(json.dumps(roster, indent=2), encoding="utf-8")
    report = {
        "assembled": [KEY],
        "count": 1,
        "incomplete": {},
        "assetVersion": datetime.now(timezone.utc).isoformat(),
    }
    (ROOT / "build-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")


def main():
    image = Image.open(SOURCE).convert("RGBA")
    rows = detect_characters(image)
    frames = stabilize_walk(normalize_frames(image, rows))
    save_sources(frames)
    build_sheet(frames, CHAR_DIR / f"char_{KEY}_walk.png")
    idle = [[row[0] for _ in range(FRAME_COUNT)] for row in frames]
    build_sheet(idle, CHAR_DIR / f"char_{KEY}_idle.png")
    build_portrait(frames[0][0])
    build_preview(frames)
    write_data()
    print(json.dumps({"key": KEY, "directions": 8, "walkFrames": 4, "idleFrames": 4, "derived": "south-east"}, indent=2))


if __name__ == "__main__":
    main()
