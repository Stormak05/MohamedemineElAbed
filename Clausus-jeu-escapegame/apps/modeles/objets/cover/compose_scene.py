"""Assemble la scène de la cover (aperçu de lien) à partir des modèles Blockbench existants.

Chaque modèle est recopié tel quel (meshes, UV, textures) dans un groupe placé et tourné ;
rien n'est remodelé. Sortie : modeles/cover/cover_scene.bbmodel, à rendre avec bbmodel_render.
    python3 modeles/cover/compose_scene.py
"""
import copy, json, os, uuid

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # modeles/
OUT = os.path.join(ROOT, "cover", "cover_scene.bbmodel")

# (fichier, position en unités Blockbench (16 = 1 m), rotation Y en degrés, nom du groupe)
# La caméra du rendu regarde depuis -Z : le mur du fond est en +Z, face visible tournée vers -Z.
PLACEMENTS = [
    ("decor/sols/floor_2a.bbmodel", (-32, 0, 0), 0, "floor_l"),
    ("decor/sols/floor_2b.bbmodel", (0, 0, 0), 0, "floor_c"),
    ("decor/sols/floor_3a.bbmodel", (32, 0, 0), 0, "floor_r"),
    ("decor/sols/floor_2c.bbmodel", (-32, 0, -32), 0, "floor_lf"),
    ("decor/sols/floor_3b.bbmodel", (0, 0, -32), 0, "floor_cf"),
    ("decor/sols/floor_2a.bbmodel", (32, 0, -32), 0, "floor_rf"),
    ("decor/murs/wall_2a.bbmodel", (-32, 0, 16), 180, "wall_l"),
    ("decor/murs/wall_4_ne_dors_pas.bbmodel", (0, 0, 16), 180, "wall_c"),
    ("decor/murs/wall_3b.bbmodel", (32, 0, 16), 180, "wall_r"),
    ("objets/medical_bed.bbmodel", (-6, 0, 0), 90, "bed"),
    ("personnages/shadow_figure.bbmodel", (-37, 0, 7), 235, "shadow"),
    ("decor/equipements/red_light.bbmodel", (30, 26, 15.9), 180, "night_light"),
]


def load(rel):
    with open(os.path.join(ROOT, rel)) as f:
        return json.load(f)


def main():
    scene = load(PLACEMENTS[0][0])
    scene = {k: v for k, v in scene.items() if k not in ("elements", "groups", "outliner", "textures", "animations")}
    scene["name"] = "cover_scene"
    scene["model_identifier"] = "cover_scene"
    scene["resolution"] = {"width": 16, "height": 16}
    elements, groups, outliner, textures = [], [], [], []

    for rel, pos, rot_y, name in PLACEMENTS:
        src = load(rel)
        remap = {}  # ancien uuid -> nouveau, pour pouvoir poser deux fois le même modèle
        def nid(old):
            remap.setdefault(old, str(uuid.uuid4()))
            return remap[old]
        tex_base = len(textures)
        for t in src.get("textures", []):
            t = copy.deepcopy(t)
            t["uuid"] = str(uuid.uuid4())
            t["id"] = str(len(textures))
            t["name"] = f"{name}_{t['name']}"
            textures.append(t)

        def shift(p):
            return [p[0] + pos[0], p[1] + pos[1], p[2] + pos[2]]

        for e in src["elements"]:
            e = copy.deepcopy(e)
            e["uuid"] = nid(e["uuid"])
            e["origin"] = shift(e.get("origin", [0, 0, 0]))
            if "from" in e:
                e["from"], e["to"] = shift(e["from"]), shift(e["to"])
            for face in e.get("faces", {}).values():
                if isinstance(face.get("texture"), int):
                    face["texture"] += tex_base
                elif isinstance(face.get("texture"), str):
                    pass
            elements.append(e)
        for g in src.get("groups", []):
            g = copy.deepcopy(g)
            g["uuid"] = nid(g["uuid"])
            g["origin"] = shift(g.get("origin", [0, 0, 0]))
            groups.append(g)

        def walk(node):
            if isinstance(node, str):
                return nid(node)
            node = copy.deepcopy(node)
            node["uuid"] = nid(node["uuid"])
            node["children"] = [walk(c) for c in node.get("children", [])]
            return node

        wrapper = {
            "name": name, "uuid": str(uuid.uuid4()), "export": True, "locked": False, "scope": 0,
            "selected": False, "visibility": True, "origin": list(pos), "rotation": [0, rot_y, 0],
            "color": 0, "children": [], "reset": False, "shade": True, "mirror_uv": False, "isOpen": False,
            "primary_selected": False,
        }
        groups.append(wrapper)
        outliner.append({"uuid": wrapper["uuid"], "isOpen": False,
                         "children": [walk(n) for n in src.get("outliner", [])]})

    # Les textures référencées par uuid dans les faces : rien à faire, on ne les remappe pas (aucune dans ces modèles).
    scene.update(elements=elements, groups=groups, outliner=outliner, textures=textures)
    with open(OUT, "w") as f:
        json.dump(scene, f)
    print(OUT, len(elements), "éléments,", len(textures), "textures")


if __name__ == "__main__":
    main()
