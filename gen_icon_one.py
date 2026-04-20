from PIL import Image, ImageDraw, ImageFont
import os

# Красный фон
img = Image.new('RGB', (512, 512), color='#e94560')
draw = ImageDraw.Draw(img)

# Белая цифра 1
try:
    font = ImageFont.truetype("/system/fonts/Roboto-Regular.ttf", 350)
except:
    font = ImageFont.load_default()

text = "1"
bbox = draw.textbbox((0, 0), text, font=font)
text_width = bbox[2] - bbox[0]
text_height = bbox[3] - bbox[1]
x = (512 - text_width) // 2
y = (512 - text_height) // 2 - 30
draw.text((x, y), text, fill='white', font=font)

img.save('icon_one_source.png')
print("✅ Иконка создана")

# Генерируем все размеры
sizes = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
base = 'android/app/src/main/res'

for folder, size in sizes.items():
    os.makedirs(f'{base}/mipmap-{folder}', exist_ok=True)
    resized = img.resize((size, size))
    resized.save(f'{base}/mipmap-{folder}/ic_launcher.png')
    resized.save(f'{base}/mipmap-{folder}/ic_launcher_round.png')
    print(f"✅ {folder}: {size}x{size}")

print("\n🎉 Готово!")
