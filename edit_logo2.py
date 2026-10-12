from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np

LOGO_SRC = r'C:\Users\Usuario\Pictures\Screenshots\Captura de pantalla 2026-10-05 161120.png'
BG_SRC = r'C:\Users\Usuario\Pictures\Screenshots\Captura de pantalla 2026-10-05 161058.png'

img = Image.open(LOGO_SRC).convert('RGBA')
W, H = img.size
print('logo src', img.size)

arr = np.array(img.convert('RGB')).astype(int)
r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
# mascara de letras doradas/amarillas en la mitad superior
yy = np.arange(H)[:, None]
mask = (r > 150) & (g > 90) & (g < 200) & (b < 110) & (r > b + 60) & ((yy > 140) & (yy < 400))
mask_img = Image.fromarray((mask * 255).astype('uint8')).filter(ImageFilter.MaxFilter(15))
mask_img = mask_img.filter(ImageFilter.GaussianBlur(10))

blurred = img.filter(ImageFilter.GaussianBlur(50))
out = img.copy()
out.paste(blurred, (0, 0), mask_img)

md = np.array(mask_img) > 100
ys, xs = np.where(md)
x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
print('bbox letras', x0, y0, x1, y1)

d = ImageDraw.Draw(out)
cy = (y0 + y1) // 2
target_w = x1 - x0
for size in range(400, 20, -2):
    try:
        f = ImageFont.truetype(r'C:\Windows\Fonts\impact.ttf', size)
    except Exception:
        f = ImageFont.load_default()
    try:
        bb = f.getbbox('ENDERSAFIO')
        wtxt = bb[2] - bb[0]
    except Exception:
        wtxt = d.textlength('ENDERSAFIO', font=f)
    if wtxt <= target_w:
        break
bb = f.getbbox('ENDERSAFIO')
wtxt = bb[2] - bb[0]
xt = (x0 + x1) // 2 - wtxt // 2 - bb[0]
yt = cy - (bb[3] - bb[1]) // 2 - bb[1]
outline = (60, 30, 10, 255)
for dx in (-4, 0, 4):
    for dy in (-4, 0, 4):
        if dx or dy:
            d.text((xt + dx, yt + dy), 'ENDERSAFIO', font=f, fill=outline)
d.text((xt, yt), 'ENDERSAFIO', font=f, fill=(247, 201, 76, 255))

out.save('logo_final.png')

# version para el overlay de carga (512x512, logo centrado horizontal, ancho completo)
logo = out.crop((0, 150, W, 620))
lw, lh = logo.size
tw = 512
th = int(lh * tw / lw)
logo_sq = Image.new('RGBA', (tw, tw), (0, 0, 0, 0))
logo_sq.paste(logo.resize((tw, th), Image.LANCZOS), (0, (tw - th) // 2), logo.resize((tw, th), Image.LANCZOS))
logo_sq.save('mojangstudios.png')

# fondo del menu
bg = Image.open(BG_SRC).convert('RGB').resize((1920, 1080), Image.LANCZOS)
bg.save('menu_bg.png')
print('listo')
