from PIL import Image
import numpy as np
from collections import deque

im = Image.open('logo_final.png').convert('RGBA')
arr = np.array(im)
H, W = arr.shape[:2]
r, g, b = arr[:, :, 0].astype(int), arr[:, :, 1].astype(int), arr[:, :, 2].astype(int)
cand = (b > 80) & (b >= r) & (r < 170) & (g < 110)
visit = np.zeros((H, W), dtype=bool)
q = deque()
for x in range(W):
    for y in (0, H - 1):
        if cand[y, x] and not visit[y, x]:
            visit[y, x] = True
            q.append((y, x))
for y in range(H):
    for x in (0, W - 1):
        if cand[y, x] and not visit[y, x]:
            visit[y, x] = True
            q.append((y, x))
while q:
    y, x = q.popleft()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = y + dy, x + dx
        if 0 <= ny < H and 0 <= nx < W and cand[ny, nx] and not visit[ny, nx]:
            visit[ny, nx] = True
            q.append((ny, nx))
out = arr.copy()
out[:, :, 3][visit] = 0
img = Image.fromarray(out, 'RGBA')
alpha = out[:, :, 3]
nz = np.where(alpha > 10)
y0, y1 = nz[0].min(), nz[0].max()
x0, x1 = nz[1].min(), nz[1].max()
img = img.crop((x0, y0, x1 + 1, y1 + 1))
img.save('logo_clean2.png')
print(img.size)
