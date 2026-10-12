from PIL import Image, ImageDraw
import numpy as np

im = Image.open('logo_final.png').convert('RGBA')
arr = np.array(im)
H, W = arr.shape[:2]
r, g, b = arr[:, :, 0].astype(int), arr[:, :, 1].astype(int), arr[:, :, 2].astype(int)

morado = (b > g + 15) & (b > r + 10) & (r < 135) & (g < 100) & (b > 45)

yy, xx = np.ogrid[:H, :W]
inside = ((yy - 345) ** 2 + (xx - 783) ** 2) <= 270 ** 2
letras = (r > 160) & (g > 80) & (b < 140)
proteger = inside | letras
fondo = morado & (~proteger)

alpha = arr[:, :, 3].copy()
alpha[fondo] = 0
out = arr.copy()
out[:, :, 3] = alpha

mask = Image.fromarray((alpha > 10).astype('uint8') * 255)
bbox = mask.getbbox()
img = Image.fromarray(out, 'RGBA').crop(bbox)
img.save('logo_clean3.png')
print(img.size)
