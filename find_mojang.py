import zipfile, io, sys
from PIL import Image
for p in [r'C:\Users\Usuario\.gradle\caches\forge_gradle\minecraft_repo\versions\1.20.1\client-extra.jar',
          r'C:\Users\Usuario\.gradle\caches\forge_gradle\minecraft_repo\versions\1.20.1\client.jar',
          r'C:\Users\Usuario\.gradle\caches\forge_gradle\minecraft_user_repo\net\minecraftforge\forge\1.20.1-47.3.0\forge-1.20.1-47.3.0-injected.jar']:
    try:
        z = zipfile.ZipFile(p)
        hits = [n for n in z.namelist() if 'mojangstudios' in n]
        print(p.split('\\')[-1], hits)
        for h in hits:
            im = Image.open(io.BytesIO(z.read(h)))
            print('  size', im.size, im.mode)
    except Exception as e:
        print('ERR', e)
