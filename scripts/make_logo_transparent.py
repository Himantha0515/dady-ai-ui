from PIL import Image
from pathlib import Path

src = Path(r"C:\Users\fk\Documents\Dady.ai\dady-ai-ui\public\brand\dadys-ai-logo.png")
backup = Path(r"C:\Users\fk\Documents\Dady.ai\dady-ai-ui\public\brand\dadys-ai-logo-original.png")
out = src

img = Image.open(src).convert("RGBA")
if not backup.exists():
    img.save(backup)
else:
    # Always process from original so re-runs don't over-erode
    img = Image.open(backup).convert("RGBA")

pixels = img.load()
w, h = img.size
removed = 0
for y in range(h):
    for x in range(w):
        r, g, b, a = pixels[x, y]
        mx = max(r, g, b)
        if mx < 26:
            pixels[x, y] = (0, 0, 0, 0)
            removed += 1
        elif mx < 48:
            # soft edge fade for anti-aliased fringe on black
            na = int(255 * ((mx - 26) / 22.0))
            pixels[x, y] = (r, g, b, max(0, min(255, na)))

bbox = img.getbbox()
if bbox:
    img = img.crop(bbox)
    pad = 20
    padded = Image.new("RGBA", (img.width + pad * 2, img.height + pad * 2), (0, 0, 0, 0))
    padded.paste(img, (pad, pad), img)
    img = padded

img.save(out, optimize=True)
print(f"saved size={img.size} removed={removed}")
