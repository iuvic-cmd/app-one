from PIL import Image
import os

img = Image.open('icon_source.png').convert('RGBA')

# Белый фон (убираем прозрачность)
bg = Image.new('RGBA', img.size, (255, 255, 255, 255))
bg.paste(img, mask=img.split()[3])
img = bg.convert('RGB')

sizes = {'mdpi':48,'hdpi':72,'xhdpi':96,'xxhdpi':144,'xxxhdpi':192}
base_path = 'android/app/src/main/res'
for folder, size in sizes.items():
    os.makedirs(f'{base_path}/mipmap-{folder}', exist_ok=True)
    resized = img.resize((size, size), Image.LANCZOS)
    resized.save(f'{base_path}/mipmap-{folder}/ic_launcher.png')
    resized.save(f'{base_path}/mipmap-{folder}/ic_launcher_round.png')
    print(f"✅ {folder}: {size}x{size}")
print("🎉 Готово!")
