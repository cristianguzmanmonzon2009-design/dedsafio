from PIL import Image
import numpy as np

im = Image.open('logo_final.png').convert('RGBA')
arr = np.array(im)
H, W = arr.shape[:2]
r, g, b = arr[:, :, 0].astype(int), arr[:, :, 1].astype(int), arr[:, :, 2].astype(int)

morado = (b > g + 15) & (b > r + 10) & (r < 135) & (g < 100) & (b > 45)
yy, xx = np.ogrid[:H, :W]
dentro_elipse = (((yy - 345) / 290.0) ** 2 + ((xx - 783) / 285.0) ** 2) <= 1.0
letras = (r > 160) & (g > 80) & (b < 140)
sushi = letras | dentro_elipse
alpha = arr[:, :, 3].copy()
alpha[(morado & (~sushi))] = 0
alpha[(~sushi) & (r < 145) & (b > 40)] = 0
out = arr.copy()
out[:, :, 3] = alpha
mask = Image.fromarray((alpha > 10).astype('uint8') * 255)
bbox = mask.getbbox()
img = Image.fromarray(out, 'RGBA').crop(bbox)
img.save('logo_clean4.png')
print(img.size)
