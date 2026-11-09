// Tint only clothing meshes; the atlas is shared with skin, hair and the wristband.
export function createPlayerOutfit(roots) {
  const garments = [];
  for (const root of roots) root.traverse((o) => {
    if (!o.isMesh || !/^(gown_|sleeve(?:_|$))/.test(o.name)) return;
    o.material = o.material.clone();
    garments.push({ material: o.material, color: o.material.color.clone(), emissive: o.material.emissive.clone() });
  });
  let previous;
  return (wearingCoat) => {
    if (wearingCoat === previous) return;
    previous = wearingCoat;
    for (const { material, color, emissive } of garments) {
      material.color.copy(color);
      material.emissive.copy(emissive);
      if (!wearingCoat) {
        material.color.set(0x668a9e);
        material.emissive.multiply(material.color);
      }
    }
  };
}
