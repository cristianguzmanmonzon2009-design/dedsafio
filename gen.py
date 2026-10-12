import random
from PIL import Image, ImageDraw, ImageFilter

random.seed(7)
W, H = 1920, 1080
bg = Image.new('RGB', (W, H))
px = bg.load()
for y in range(H):
    t = y / H
    for x in range(W):
        px[x, y] = (int(8 + 26 * t), int(4 + 10 * t), int(30 + 40 * t))
d = ImageDraw.Draw(bg)
for _ in range(400):
    x, y = random.randint(0, W), random.randint(0, H)
    r = random.choice([1, 1, 1, 2])
    c = random.choice([(200, 170, 255), (150, 110, 230), (255, 255, 255), (120, 80, 200)])
    d.ellipse([x - r, y - r, x + r, y + r], fill=c)
bg = bg.filter(ImageFilter.GaussianBlur(0.5))
bg.save('src/main/resources/assets/endersafio/textures/gui/menu_bg.png')

S = 512
c = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(c)
white = (255, 255, 255, 255)
d.ellipse([70, 50, 235, 265], fill=white)
d.ellipse([277, 50, 442, 265], fill=white)
d.ellipse([95, 250, 225, 445], fill=white)
d.ellipse([287, 250, 417, 445], fill=white)
d.rounded_rectangle([238, 70, 274, 460], radius=18, fill=(190, 140, 255, 255))
d.ellipse([150, 480, 180, 520], fill=(190, 140, 255, 255))
c = c.filter(ImageFilter.GaussianBlur(1))
c.save('src/main/resources/assets/endersafio/textures/gui/butterfly.png')
print('ok')
