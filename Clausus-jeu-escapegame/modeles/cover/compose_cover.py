"""Monte la cover 1200×630 (aperçu de lien Discord, Slack, X…) à partir d'une capture du jeu.

    python3 modeles/cover/compose_cover.py <SpecialElite-Regular.ttf>

Source : modeles/cover/cover_ingame.png, capture du canvas du jeu (1200×630) dans la chambre 104,
vue de départ (`?jouer`), réglages `dRes: 630` et `shadows: 'high'` (clé localStorage `clausus-settings-v1`),
lue avec canvas.toDataURL() (le rendu garde preserveDrawingBuffer). Le jeu se lance avec
`node packages/game/serve.mjs`.

Sortie : apps/web/public/og-cover-<VERSION>.jpg. Pillow seulement, aucun contenu généré :
l'image vient du jeu, le logo de 2d/title.png, le texte est en Special Elite (police du jeu, Apache 2.0).
"""
import math, os, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
SHOT = os.path.join(HERE, "cover_ingame.png")
LOGO = os.path.join(REPO, "2d/title.png")  # logo de Jules, celui du jeu et du site
SUBTITLE = "Personne ne quitte la 104."
# Discord garde l'image en cache d'après son URL : à chaque nouvelle cover, passer au numéro suivant
# et mettre à jour og:image et twitter:image dans apps/web/index.html.
VERSION = 4
OUT = os.path.join(REPO, f"apps/web/public/og-cover-{VERSION}.jpg")
W, H = 1200, 630


def main(font_path):
    img = Image.open(SHOT).convert("RGB")

    # Léger zoom : retire le bord arrondi du filtre écran du jeu.
    z = 1.06
    cw, ch = W / z, H / z
    x0, y0 = (W - cw) / 2, (H - ch) / 2 - 6
    img = img.crop((round(x0), round(y0), round(x0 + cw), round(y0 + ch))).resize((W, H), Image.LANCZOS)

    # Vignette et bas assombri pour le titre.
    mask = Image.new("L", (W, H))
    px = mask.load()
    for y in range(H):
        for x in range(W):
            dx, dy = (x - W / 2) / (W * 0.62), (y - H * 0.4) / (H * 0.75)
            v = max(0.0, min(1.0, (math.hypot(dx, dy) - 0.55) / 0.5))
            v = max(v, max(0.0, (y - H * 0.52) / (H * 0.42)) ** 1.3 * 0.93)
            px[x, y] = int(255 * min(1.0, v))
    canvas = Image.composite(Image.new("RGB", (W, H), (3, 3, 5)), img, mask).convert("RGBA")

    # Logo du jeu.
    logo = Image.open(LOGO).convert("RGBA")
    lw = 640
    logo = logo.resize((lw, round(logo.height * lw / logo.width)), Image.LANCZOS)
    lx, ly = (W - lw) // 2, 438
    shadow = Image.new("RGBA", logo.size, (0, 0, 0, 0))
    shadow.putalpha(logo.getchannel("A").point(lambda a: int(a * 0.85)))
    shadow = shadow.filter(ImageFilter.GaussianBlur(12))
    canvas.alpha_composite(shadow, (lx, ly + 8))
    canvas.alpha_composite(logo, (lx, ly))

    # Sous-titre.
    d = ImageDraw.Draw(canvas)
    font = ImageFont.truetype(font_path, 29)
    tw = d.textlength(SUBTITLE, font=font)
    d.text(((W - tw) / 2, ly + logo.height + 16), SUBTITLE, font=font, fill=(214, 204, 186, 255))

    out = canvas.convert("RGB")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    out.save(OUT, quality=88, optimize=True, progressive=True)
    print(OUT, out.size, os.path.getsize(OUT) // 1024, "Ko")


if __name__ == "__main__":
    main(sys.argv[1])
