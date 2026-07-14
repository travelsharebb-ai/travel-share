export const skinCatalog = [
  { category: "basic", filename: "basic-modern-tiles.png", name: "Modern Tiles", priceCents: 0 },
  { category: "basic", filename: "basic-sunset-hills.png", name: "Sunset Hills", priceCents: 0 },
  { category: "premium", filename: "premium-photoroom-stylized.png", name: "Studio Portrait", priceCents: 299 },
  { category: "premium", filename: "premium-forest-path.png", name: "Forest Path", priceCents: 299 },
  { category: "premium", filename: "premium-abstract-watercolor.png", name: "Abstract Watercolor", priceCents: 299 },
  { category: "premium", filename: "premium-mountain-range.png", name: "Mountain Range", priceCents: 299 },
  { category: "premium", filename: "premium-tropical-beach.png", name: "Tropical Beach", priceCents: 299 },
  { category: "premium", filename: "premium-studio-lighting.png", name: "Studio Lighting", priceCents: 299 },
  { category: "premium", filename: "premium-coastal-sunset.png", name: "Coastal Sunset", priceCents: 299 },
  { category: "premium", filename: "premium-night-sky.png", name: "Night Sky", priceCents: 299 },
  { category: "seasonal", filename: "seasonal-minimalist-geometry.png", name: "Minimalist Geometry", priceCents: 399 },
  { category: "seasonal", filename: "seasonal-cityscape-evening.png", name: "Cityscape Evening", priceCents: 399 }
].map((skin) => ({
  ...skin,
  sku: `${skin.category}/${skin.filename}`,
  previewUrl: `/assets/skins/${skin.category}/${skin.filename}`
}));

export function skinMetadata(skin) {
  const included = skin.category === "basic";
  return {
    category: skin.category,
    frameAssetUrl: skin.previewUrl,
    previewImage: skin.previewUrl,
    isPremium: !included,
    unlockType: included ? "included" : "purchase"
  };
}

export function isBasicSkinRecord(skin) {
  const metadata = skin?.metadata && typeof skin.metadata === "object" ? skin.metadata : {};
  return skin?.type === "image_skin"
    && skin?.active !== false
    && (metadata.category === "basic" || skin.priceCents === 0);
}
