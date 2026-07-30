from pathlib import Path

from PIL import Image


SOURCE = Path("assets/character-bank/gravekeeper_openai/source/gravekeeper_walk_alpha.png")
OUTPUT_DIR = Path("assets/character-bank/gravekeeper_v2/source")
OUTPUT = OUTPUT_DIR / "master_south_passing.png"
CHROMA = (255, 0, 255, 255)


def main():
    image = Image.open(SOURCE).convert("RGBA")
    subject = image.crop((240, 10, 362, 194))
    box = subject.getbbox()
    if box is None:
        raise RuntimeError("Master subject is empty")
    subject = subject.crop(box)
    scale = min(640 / subject.height, 440 / subject.width)
    subject = subject.resize((round(subject.width * scale), round(subject.height * scale)), Image.Resampling.NEAREST)
    canvas = Image.new("RGBA", (1024, 1024), CHROMA)
    canvas.alpha_composite(subject, ((1024 - subject.width) // 2, 860 - subject.height))
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(OUTPUT)
    print(OUTPUT)


if __name__ == "__main__":
    main()
