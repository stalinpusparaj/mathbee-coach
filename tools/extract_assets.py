#!/usr/bin/env python3
"""Extract individual sprites from the supplied transparent asset sheets.

The eleven PNG sheets in the project root ("ChatGPT Image ... PM-N.png") have a real
alpha channel; each object sits on fully transparent pixels. This script labels the
connected opaque regions, crops each one, names it from the table below, downsizes it
and writes WebP files to public/assets/sprites/ plus src/assets/sprites.generated.json.

Outputs are committed, so this only needs re-running if the sheets change.
Requirements: Python 3 with pillow, numpy, scipy.
"""
import glob
import json
import os

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "assets", "sprites")
MAX_SIDE = 360

# Sheets where neighbouring objects touch after dilation need less merging.
LOW_DILATION = {3, 4, 9}

# (sheet, index in reading order of labels) -> (logical id, alt text)
NAMES = {
    (1, 0): ("pot_terracotta", "Terracotta flowerpot"),
    (1, 1): ("pot_green", "Green ribbed flowerpot"),
    (1, 2): ("pot_cream", "Cream flowerpot with leaves"),
    (1, 3): ("bee", "Bee, the friendly garden guide"),
    (1, 4): ("flower_potted", "Yellow flower with roots"),
    (1, 5): ("seedling", "Seedling with roots"),
    (1, 6): ("watering_can", "Yellow watering can"),
    (1, 7): ("glove", "Garden glove"),
    (2, 0): ("post", "Wooden post with rope"),
    (2, 1): ("rope_fence", "Rope fence"),
    (2, 2): ("plank", "Wooden plank"),
    (2, 3): ("flag", "Yellow flag"),
    (2, 4): ("beaver", "Beaver builder"),
    (2, 5): ("riverbank", "Grassy riverbank"),
    (2, 6): ("rock", "Mossy rock"),
    (2, 7): ("toolbox", "Toolbox"),
    (3, 0): ("workshop", "Shape workshop cottage"),
    (3, 1): ("workbench", "Workbench"),
    (3, 2): ("hedgehog", "Hedgehog helper"),
    (3, 3): ("brush", "Paint brush"),
    (3, 4): ("mallet", "Wooden mallet"),
    (3, 5): ("rosette", "Yellow rosette"),
    (3, 6): ("scroll", "Paper scroll"),
    (3, 7): ("tray", "Wooden tray"),
    (4, 0): ("paper_cone", "Paper bouquet wrap"),
    (4, 1): ("tulip", "Pink tulip"),
    (4, 2): ("rose", "Red rose"),
    (4, 3): ("daisy", "Yellow daisy"),
    (4, 4): ("bow", "Red bow"),
    (4, 5): ("bunny_florist", "Bunny florist"),
    (4, 6): ("shop_counter", "Shop counter"),
    (4, 7): ("bucket", "Metal bucket"),
    (5, 0): ("pear", "Pear"),
    (5, 1): ("apple_red", "Red apple"),
    (5, 2): ("apple_green", "Green apple"),
    (5, 3): ("orange", "Orange"),
    (5, 4): ("squirrel_gardener", "Squirrel gardener"),
    (5, 5): ("basket", "Wicker basket"),
    (5, 6): ("cart", "Wooden cart"),
    (5, 7): ("crate", "Wooden crate"),
    (6, 0): ("penguin_walk", "Penguin walking"),
    (6, 1): ("penguin", "Penguin"),
    (6, 2): ("penguin_wave", "Penguin waving"),
    (6, 3): ("boat", "Rowing boat"),
    (6, 4): ("lighthouse", "Lighthouse"),
    (6, 5): ("dock", "Small dock"),
    (6, 6): ("ice_floe", "Ice island"),
    (6, 7): ("lifebuoy", "Lifebuoy"),
    (7, 0): ("sign_board", "Wooden sign board"),
    (7, 1): ("lily_pad", "Lily pad"),
    (7, 2): ("stepping_stone", "Stepping stone"),
    (7, 3): ("cattails", "Cattails"),
    (7, 4): ("gate", "Garden gate"),
    (7, 5): ("firefly", "Firefly"),
    (7, 6): ("frog", "Frog"),
    (8, 0): ("trowel", "Trowel"),
    (8, 1): ("picnic_basket", "Picnic basket"),
    (8, 2): ("watering_can_flowers", "Flowery watering can"),
    (8, 3): ("book", "Open book"),
    (8, 4): ("chair", "Garden chair"),
    (8, 5): ("seed_packet", "Seed packet"),
    (8, 6): ("card_frame", "Blank card"),
    (8, 7): ("bunny_sleeping", "Sleeping bunny"),
    (9, 0): ("clock_tower", "Clock tower"),
    (9, 1): ("round_frame", "Round frame"),
    (9, 2): ("owl_keeper", "Owl clock keeper"),
    (9, 3): ("bell", "Bell"),
    (9, 4): ("gear", "Gear"),
    (9, 5): ("key", "Wind-up key"),
    (9, 6): ("sun", "Smiling sun"),
    (9, 7): ("moon", "Sleeping moon"),
    (10, 0): ("calendar_easel", "Blank calendar easel"),
    (10, 1): ("lantern", "Lantern"),
    (10, 2): ("bunting", "Bunting"),
    (10, 3): ("gift", "Gift box"),
    (10, 4): ("squirrel_messenger", "Squirrel with a card"),
    (10, 5): ("notice_board", "Notice board"),
    (10, 6): ("wreath", "Flower wreath"),
    (10, 7): ("picnic_hamper", "Picnic hamper"),
    (11, 0): ("apple", "Apple"),
    (11, 1): ("coconut", "Coconut"),
    (11, 2): ("bluebird", "Bluebird"),
    (11, 3): ("chocolate", "Chocolate"),
    (11, 4): ("rabbit_helper", "Rabbit helper"),
    (11, 5): ("help_desk_stall", "Help desk stall"),
    (11, 6): ("basket_tall", "Tall basket"),
    (11, 7): ("choc_box", "Empty chocolate box"),
}


def sheet_number(path):
    return int(path.rsplit("-", 1)[1].split(".")[0])


def main():
    os.makedirs(OUT, exist_ok=True)
    records = []
    sheets = sorted(glob.glob(os.path.join(ROOT, "ChatGPT Image *-*.png")), key=sheet_number)
    for path in sheets:
        sheet = sheet_number(path)
        arr = np.array(Image.open(path).convert("RGBA"))
        mask = arr[..., 3] > 40
        dil = ndimage.binary_dilation(mask, iterations=1 if sheet in LOW_DILATION else 6)
        labels, _ = ndimage.label(dil)
        k = 0
        for i, sl in enumerate(ndimage.find_objects(labels)):
            if (labels[sl] == i + 1).sum() < 1500:
                continue
            key = (sheet, k)
            k += 1
            if key not in NAMES:
                continue
            logical, alt = NAMES[key]
            y0, y1, x0, x1 = sl[0].start, sl[0].stop, sl[1].start, sl[1].stop
            crop = arr[y0:y1, x0:x1].copy()
            crop[..., 3] = np.where(labels[y0:y1, x0:x1] == i + 1, crop[..., 3], 0)
            crop[crop[..., 3] == 0] = 0
            img = Image.fromarray(crop)
            img.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
            img.save(os.path.join(OUT, logical + ".webp"), "WEBP", quality=86, method=6)
            records.append({
                "id": logical,
                "file": f"assets/sprites/{logical}.webp",
                "width": img.width,
                "height": img.height,
                "alt": alt,
                "source": os.path.basename(path),
                "sourceRect": [int(x0), int(y0), int(x1 - x0), int(y1 - y0)],
            })

    # Decorative scenery crop from the garden-map concept image (logo, buttons and text excluded).
    concept = os.path.join(ROOT, "download", "ChatGPT_Image_Sep_27,_2026,_20260927194655.jpg")
    if os.path.exists(concept):
        bg = Image.open(concept).convert("RGB").crop((470, 95, 1490, 740))
        bg.thumbnail((1280, 1280), Image.LANCZOS)
        bg.save(os.path.join(ROOT, "public", "assets", "garden_scenery.webp"), "WEBP", quality=78, method=6)
        records.append({
            "id": "garden_scenery",
            "file": "assets/garden_scenery.webp",
            "width": bg.width,
            "height": bg.height,
            "alt": "",
            "source": os.path.basename(concept),
            "sourceRect": [470, 95, 1020, 645],
        })

    with open(os.path.join(ROOT, "src", "assets", "sprites.generated.json"), "w") as fh:
        json.dump(records, fh, indent=1)
    print(f"wrote {len(records)} assets")


if __name__ == "__main__":
    main()
