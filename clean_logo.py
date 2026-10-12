from PIL import Image
import numpy as np

im = Image.open('logo_final.png').convert('RGBA')
arr = np.array(im).astype(int)
r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
# fondo cosmico morado: hue alto azul/morado, saturacion media, sin amarillo/blanco del logo
es_morado = (b > 90) & (b > r) & (r < 140) & (g < 80)
es_amarillo = (r > 150) & (g > 90) & (b < 130)
fondo = es_morado & (~es_amarillo)
alpha = arr[:, :, 3].copy()
alpha[fondo] = 0
out = arr.copy()
out[:, :, 3] = alpha
img = Image.fromarray(out.astype('uint8'), 'RGBA')
# recortar lo que tenga contenido
nz = np.where(alpha > 10)
y0, y1 = nz[0].min(), nz[0].max()
x0, x1 = nz[1].min(), nz[1].max()
pad = 15
x0 = max(0, x0 - pad); y0 = max(0, y0 - pad); x1 = min(im.width, x1 + pad); y1 = min(im.height, y1 + pad)
img = img.crop((x0, y0, x1, y1))
img.save('logo_clean.png')
print(img.size)
