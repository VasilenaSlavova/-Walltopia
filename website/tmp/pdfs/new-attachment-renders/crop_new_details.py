from pathlib import Path
from PIL import Image, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parents[3]
RENDER_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = ROOT / "manuals" / "attachment" / "details"

DETAILS = [
    ("CF-01", "concrete-floor-01", (181, 192, 1028, 898)),
    ("CF-02", "concrete-floor-02", (1028, 192, 2024, 898)),
    ("CF-03", "concrete-floor-03", (2024, 192, 2945, 898)),
    ("CF-04", "concrete-floor-04", (2989, 192, 3537, 898)),
    ("CF-05", "concrete-floor-05", (3566, 192, 4114, 898)),
    ("CW-01", "concrete-wall-01", (181, 984, 1177, 1514)),
    ("CW-02", "concrete-wall-02", (1237, 984, 2155, 1514)),
    ("CW-03", "concrete-wall-03", (2176, 984, 3200, 1514)),
    ("SC-01", "steel-column-01", (181, 1613, 1439, 2237)),
    ("SC-02", "steel-column-02", (1471, 1613, 2527, 2237)),
    ("SC-03", "steel-column-03", (2559, 1613, 3654, 2237)),
    ("SC-04", "steel-column-04", (3686, 1613, 4579, 2237)),
    ("MW-01", "masonry-wall-01", (181, 2827, 1232, 3394)),
    ("MW-02", "masonry-wall-02", (1262, 2827, 2313, 3394)),
]


def remove_red_code(image):
    rgb = image.convert("RGB")
    red_points = []
    for y in range(rgb.height):
        for x in range(rgb.width):
            r, g, b = rgb.getpixel((x, y))
            if r > 175 and g < 115 and b < 115 and r > g * 1.7:
                red_points.append((x, y))
    if not red_points:
        return rgb
    xs = [point[0] for point in red_points]
    ys = [point[1] for point in red_points]
    box = (max(1, min(xs) - 4), max(1, min(ys) - 4), min(rgb.width - 2, max(xs) + 5), min(rgb.height - 2, max(ys) + 5))
    ImageDraw.Draw(rgb).rectangle(box, fill="white")
    return rgb


def make_contact_sheet(unit, generated):
    cell_w, cell_h = 420, 300
    sheet = Image.new("RGB", (cell_w * 3, cell_h * 5), "#e9ebf0")
    draw = ImageDraw.Draw(sheet)
    for index, (detail_id, path) in enumerate(generated):
        preview = Image.open(path).convert("RGB")
        preview.thumbnail((cell_w - 24, cell_h - 42), Image.Resampling.LANCZOS)
        x = (index % 3) * cell_w + (cell_w - preview.width) // 2
        y = (index // 3) * cell_h + 28 + (cell_h - 36 - preview.height) // 2
        sheet.paste(preview, (x, y))
        draw.text(((index % 3) * cell_w + 10, (index // 3) * cell_h + 7), f"{detail_id} - {unit}", fill="#ec1c24")
    sheet.save(RENDER_DIR / f"contact-{unit}.png", optimize=True)


for unit in ("metric", "imperial"):
    source = Image.open(RENDER_DIR / f"{unit}.png").convert("RGB")
    generated = []
    for detail_id, stem, (left, top, right, bottom) in DETAILS:
        crop = source.crop((left - 2, top - 2, right + 3, bottom + 3))
        crop = remove_red_code(crop)
        output = OUTPUT_DIR / f"{stem}-{unit}.png"
        crop.save(output, optimize=True)
        generated.append((detail_id, output))
    make_contact_sheet(unit, generated)
