from PIL import Image
import numpy as np

im = Image.open('logo_final.png').convert('RGBA')
arr = np.array(im)
H, W = arr.shape[:2]
r, g, b = arr[:, :, 0].astype(int), arr[:, :, 1].astype(int), arr[:, :, 2].astype(int)

yy, xx = np.ogrid[:H, :W]
dentro_disco = ((yy - 340) / 1.0) ** 2 + ((xx - 783) / 1.0) ** 2 <= 265 ** 2

morado = (b > g + 15) & (b > r + 10) & (r < 135) & (g < 100) & (b > 45)
letras = (r > 160) & (g > 80) & (b < 140)
sushi = letras | dentro_disco
alpha = arr[:, :, 3].copy()
alpha[morado & (~sushi)] = 0
alpha[(~sushi) & (r < 145) & (b > 40)] = 0

naranja_malo = (r > 130) & (g > 70) & (g < 140) & (b < 90) & (np.abs(r - g) < 70)
alpha[naranja_malo & (yy > 320) & (~dentro_disco)] = 0

out = arr.copy()
out[:, :, 3] = alpha
mask = Image.fromarray((alpha > 10).astype('uint8') * 255)
bbox = mask.getbbox()
Image.fromarray(out, 'RGBA').crop(bbox).save('logo_clean5.png')
print('ok')
