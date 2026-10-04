export function universityBuildingFootprint(building) {
  if (!building?.geometry) return null;
  const buildingCode = building.nativeCodes?.[0] || String(building.id).toUpperCase();
  return {
    type: "Feature",
    id: building.id,
    properties: {
      buildingId: building.id,
      buildingCode,
      code: building.nativeCodes?.[0] || building.id,
      name: building.name,
    },
    geometry: building.geometry,
  };
}

export function canonicalBuildingCodeForFeature(feature) {
  const value =
    feature?.properties?.buildingCode ??
    feature?.properties?.code ??
    feature?.properties?.buildingId ??
    feature?.id;
  return value == null ? null : String(value).trim().toUpperCase() || null;
}
