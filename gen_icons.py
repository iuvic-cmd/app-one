from PIL import Image, ImageDraw, ImageFont
import os

# Создаём картинку 512x512 с синим фоном
img = Image.new('RGB', (512, 512), color='#3498db')
draw = ImageDraw.Draw(img)

# Рисуем белую букву "Ш" по центру
try:
    font = ImageFont.truetype("/system/fonts/Roboto-Regular.ttf", 300)
except:
    font = ImageFont.load_default()

text = "Ш"
bbox = draw.textbbox((0, 0), text, font=font)
text_width = bbox[2] - bbox[0]
text_height = bbox[3] - bbox[1]
x = (512 - text_width) // 2
y = (512 - text_height) // 2 - 20
draw.text((x, y), text, fill='white', font=font)

# Сохраняем исходник
img.save('icon_source.png')
print("✅ Исходная иконка создана: icon_source.png")

# Генерируем все размеры для Android
sizes = {
    'mdpi': 48,
    'hdpi': 72,
    'xhdpi': 96,
    'xxhdpi': 144,
    'xxxhdpi': 192
}

base_path = 'android/app/src/main/res'

for folder, size in sizes.items():
    os.makedirs(f'{base_path}/mipmap-{folder}', exist_ok=True)
    resized = img.resize((size, size))
    resized.save(f'{base_path}/mipmap-{folder}/ic_launcher.png')
    resized.save(f'{base_path}/mipmap-{folder}/ic_launcher_round.png')
    print(f"✅ {folder}: {size}x{size}")

print("\n🎉 Все иконки сгенерированы!")
