from PIL import Image, ImageDraw
import os

img = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Синий фон с закруглёнными углами
def rounded_rect(draw, xy, radius, fill):
    x1,y1,x2,y2 = xy
    draw.rectangle([x1+radius,y1,x2-radius,y2], fill=fill)
    draw.rectangle([x1,y1+radius,x2,y2-radius], fill=fill)
    draw.ellipse([x1,y1,x1+radius*2,y1+radius*2], fill=fill)
    draw.ellipse([x2-radius*2,y1,x2,y1+radius*2], fill=fill)
    draw.ellipse([x1,y2-radius*2,x1+radius*2,y2], fill=fill)
    draw.ellipse([x2-radius*2,y2-radius*2,x2,y2], fill=fill)

rounded_rect(draw, (0,0,512,512), 80, (0, 120, 215, 255))

# Монитор - корпус
draw.rounded_rectangle([60, 80, 452, 330], radius=18, fill=(220,220,220,255), outline=(160,160,160,255), width=6)
# Экран
draw.rounded_rectangle([85, 105, 427, 305], radius=8, fill=(30, 80, 160, 255))
# График на экране
pts = [(100,260),(150,200),(210,230),(280,160),(350,190),(415,140)]
for i in range(len(pts)-1):
    draw.line([pts[i], pts[i+1]], fill=(100,200,255,255), width=8)
draw.ellipse([pts[-1][0]-8, pts[-1][1]-8, pts[-1][0]+8, pts[-1][1]+8], fill=(255,220,50,255))

# Подставка
draw.rectangle([220, 330, 292, 390], fill=(180,180,180,255))
# Основание
draw.rounded_rectangle([150, 385, 362, 415], radius=10, fill=(180,180,180,255), outline=(140,140,140,255), width=3)

# Клавиатура
draw.rounded_rectangle([80, 430, 432, 490], radius=12, fill=(210,210,210,255), outline=(160,160,160,255), width=4)
for row in range(2):
    for col in range(10):
        x = 105 + col * 33
        y = 442 + row * 22
        draw.rounded_rectangle([x, y, x+26, y+14], radius=3, fill=(240,240,240,255), outline=(180,180,180,255), width=1)

img.save('icon_source.png')
print("✅ Иконка Мой компьютер создана!")

sizes = {'mdpi':48,'hdpi':72,'xhdpi':96,'xxhdpi':144,'xxxhdpi':192}
base_path = 'android/app/src/main/res'
for folder, size in sizes.items():
    os.makedirs(f'{base_path}/mipmap-{folder}', exist_ok=True)
    resized = img.resize((size, size), Image.LANCZOS)
    resized.save(f'{base_path}/mipmap-{folder}/ic_launcher.png')
    resized.save(f'{base_path}/mipmap-{folder}/ic_launcher_round.png')
    print(f"✅ {folder}: {size}x{size}")

print("\n🎉 Все иконки готовы!")
