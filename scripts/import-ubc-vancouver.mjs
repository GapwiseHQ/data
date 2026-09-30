import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const sourceRoot = process.argv[2];
if (!sourceRoot) {
  console.error(
    "Usage: node scripts/import-ubc-vancouver.mjs /path/to/ubc-geospatial-opendata",
  );
  process.exit(1);
}

const repositoryRoot = resolve(import.meta.dirname, "..");
const readJson = async (relativePath) =>
  JSON.parse(await readFile(resolve(sourceRoot, relativePath), "utf8"));

const [buildingsGeoJson, entrancesGeoJson, routesGeoJson, boundaryGeoJson] =
  await Promise.all([
    readJson("ubcv/locations/geojson/ubcv_buildings.geojson"),
    readJson("ubcv/locations/geojson/ubcv_building_entraces.geojson"),
    readJson("ubcv/transportation/geojson/ubcv_routes.geojson"),
    readJson("ubcv/planning/geojson/ubcv_legal_boundary.geojson"),
  ]);

const SOURCE_ID = "ubc-open-geodata-2026-08";
const SOURCE = {
  id: SOURCE_ID,
  title: "UBC Vancouver Geospatial Open Data",
  url: "https://github.com/UBCGeodata/ubc-geospatial-opendata/tree/885732d875577a63bb7750e91506bc3f42e1fbef/ubcv",
  retrievedAt: "2026-09-29",
  licenseOrTerms:
    "Open Data Commons Public Domain Dedication and License (PDDL) 1.0",
  redistribution: "permitted",
  attribution: "University of British Columbia",
  transformation:
    "Selected completed, occupied, UBC-jurisdiction student-facing buildings with official codes; retained official footprints and current mapped entrances; converted pedestrian-access route coordinates into graph nodes and edges. Entrance-to-route connectors of at most 20 metres are routing inferences and are explicitly marked inferred. Entrance accessibility, public access, hours, and door semantics are not inferred.",
};

const includedUsages = new Set([
  "Academic",
  "Administrative",
  "Athletics",
  "Commons",
  "Housing",
  "Research",
  "Services",
  "StudentHousing",
]);

const roundCoordinate = ([longitude, latitude]) => [
  Number(longitude.toFixed(7)),
  Number(latitude.toFixed(7)),
];
const coordinateKey = (coordinate) => roundCoordinate(coordinate).join(",");
const slug = (value) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const provenance = (nativeId, verification = "source-backed") => [
  { sourceId: SOURCE_ID, nativeId, verification },
];

const buildingFeatures = buildingsGeoJson.features
  .filter(({ properties }) => {
    const code = properties.BLDG_CODE?.trim();
    return (
      properties.JURISDICTION === "UBC" &&
      properties.CONSTR_STATUS === "Complete" &&
      properties.BLDG_STATE === "Occupied" &&
      Boolean(code) &&
      includedUsages.has(properties.BLDG_USAGE)
    );
  })
  .sort((a, b) => a.properties.BLDG_CODE.localeCompare(b.properties.BLDG_CODE));

const usedBuildingIds = new Set();
const buildingByUid = new Map();
const buildings = buildingFeatures.map((feature) => {
  const properties = feature.properties;
  const baseId = slug(properties.NAME) || slug(properties.BLDG_CODE);
  let id = baseId;
  if (usedBuildingIds.has(id)) id = `${baseId}-${slug(properties.BLDG_CODE)}`;
  usedBuildingIds.add(id);
  buildingByUid.set(properties.BLDG_UID, id);

  const aliases = [properties.SHORTNAME, properties.LABEL_NAME]
    .map((value) => value?.trim())
    .filter(
      (value, index, values) =>
        value && value !== properties.NAME && values.indexOf(value) === index,
    );
  const category = ["Housing", "StudentHousing"].includes(properties.BLDG_USAGE)
    ? "residence"
    : ["Academic", "Research"].includes(properties.BLDG_USAGE)
      ? "academic"
      : "facility";

  return {
    id,
    name: properties.NAME.trim(),
    nativeCodes: [properties.BLDG_CODE.trim()],
    aliases,
    category,
    geometry: feature.geometry,
    provenance: provenance(`building/${properties.BLDG_UID}`),
  };
});

const pathNodes = [];
const pathEdges = [];
const nodeIdByCoordinate = new Map();
const edgeKeys = new Set();
const routeNodeCoordinates = [];

function routeNodeId(coordinate) {
  const normalized = roundCoordinate(coordinate);
  const key = coordinateKey(normalized);
  const existing = nodeIdByCoordinate.get(key);
  if (existing) return existing;
  const id = `ubc-route-node-${pathNodes.length + 1}`;
  nodeIdByCoordinate.set(key, id);
  pathNodes.push({
    id,
    coordinate: normalized,
    provenance: provenance(`route-coordinate/${key}`),
  });
  routeNodeCoordinates.push({ id, coordinate: normalized });
  return id;
}

for (const [routeIndex, feature] of routesGeoJson.features.entries()) {
  if (
    feature.properties.PEDESTRIAN_ACCESS !== "Y" ||
    !["UBC", "Shared"].includes(feature.properties.JURISDICTION)
  ) {
    continue;
  }
  for (
    let coordinateIndex = 1;
    coordinateIndex < feature.geometry.coordinates.length;
    coordinateIndex += 1
  ) {
    const from = routeNodeId(feature.geometry.coordinates[coordinateIndex - 1]);
    const to = routeNodeId(feature.geometry.coordinates[coordinateIndex]);
    if (from === to) continue;
    const edgeKey = [from, to].sort().join(":");
    if (edgeKeys.has(edgeKey)) continue;
    edgeKeys.add(edgeKey);
    pathEdges.push({
      id: `ubc-route-edge-${pathEdges.length + 1}`,
      from,
      to,
      mode: "outdoor-walk",
      provenance: provenance(
        `route/${routeIndex}/segment/${coordinateIndex - 1}`,
      ),
    });
  }
}

const routeAdjacency = new Map(pathNodes.map(({ id }) => [id, []]));
for (const edge of pathEdges) {
  routeAdjacency.get(edge.from).push(edge.to);
  routeAdjacency.get(edge.to).push(edge.from);
}
const visitedRouteNodes = new Set();
let mainRouteComponent = new Set();
for (const id of routeAdjacency.keys()) {
  if (visitedRouteNodes.has(id)) continue;
  const component = new Set([id]);
  const pending = [id];
  visitedRouteNodes.add(id);
  while (pending.length) {
    const current = pending.pop();
    for (const neighbour of routeAdjacency.get(current)) {
      if (visitedRouteNodes.has(neighbour)) continue;
      visitedRouteNodes.add(neighbour);
      component.add(neighbour);
      pending.push(neighbour);
    }
  }
  if (component.size > mainRouteComponent.size) mainRouteComponent = component;
}

function distanceMeters([longitudeA, latitudeA], [longitudeB, latitudeB]) {
  const latitudeRadians = ((latitudeA + latitudeB) / 2) * (Math.PI / 180);
  const x = (longitudeB - longitudeA) * Math.cos(latitudeRadians);
  const y = latitudeB - latitudeA;
  return Math.hypot(x, y) * (Math.PI / 180) * 6371000;
}

function nearestRouteNode(coordinate) {
  let nearest = null;
  for (const node of routeNodeCoordinates) {
    if (!mainRouteComponent.has(node.id)) continue;
    const distance = distanceMeters(coordinate, node.coordinate);
    if (!nearest || distance < nearest.distance)
      nearest = { ...node, distance };
  }
  return nearest;
}

const entrances = [];
for (const feature of entrancesGeoJson.features) {
  const buildingId = buildingByUid.get(feature.properties.BLDG_UID);
  if (!buildingId || feature.properties.STATUS !== "Current") continue;
  const coordinate = roundCoordinate(feature.geometry.coordinates);
  const nearest = nearestRouteNode(coordinate);
  if (!nearest || nearest.distance > 20) continue;

  const nativeId = feature.properties.GLOBALID.replace(
    /[{}]/g,
    "",
  ).toLowerCase();
  const id = `ubc-entrance-${nativeId}`;
  const routeCoordinateKey = coordinateKey(coordinate);
  let pathNodeId = nodeIdByCoordinate.get(routeCoordinateKey);
  if (!pathNodeId) {
    pathNodeId = `ubc-entrance-node-${nativeId}`;
    nodeIdByCoordinate.set(routeCoordinateKey, pathNodeId);
    pathNodes.push({
      id: pathNodeId,
      coordinate,
      provenance: provenance(`entrance/${nativeId}`),
    });
    pathEdges.push({
      id: `ubc-inferred-connector-${nativeId}`,
      from: pathNodeId,
      to: nearest.id,
      mode: "outdoor-walk",
      provenance: provenance(
        `entrance-to-route/${nativeId}/${nearest.id}`,
        "inferred",
      ),
    });
  }
  entrances.push({
    id,
    buildingId,
    coordinate,
    pathNodeId,
    access: "unknown",
    provenance: provenance(`entrance/${nativeId}`),
  });
}

function geometryCoordinates(geometry) {
  const coordinates = [];
  const walk = (value) => {
    if (
      Array.isArray(value) &&
      value.length >= 2 &&
      typeof value[0] === "number" &&
      typeof value[1] === "number"
    ) {
      coordinates.push(value);
    } else if (Array.isArray(value)) {
      for (const child of value) walk(child);
    }
  };
  walk(geometry.coordinates);
  return coordinates;
}

const boundaryCoordinates = geometryCoordinates(
  boundaryGeoJson.features[0].geometry,
);
const bounds = [
  [
    Math.min(...boundaryCoordinates.map(([longitude]) => longitude)),
    Math.min(...boundaryCoordinates.map(([, latitude]) => latitude)),
  ],
  [
    Math.max(...boundaryCoordinates.map(([longitude]) => longitude)),
    Math.max(...boundaryCoordinates.map(([, latitude]) => latitude)),
  ],
].map(roundCoordinate);

const campus = {
  schemaVersion: 1,
  institution: "ubc",
  campus: {
    id: "ubc-vancouver",
    name: "UBC Vancouver Campus",
    bounds,
  },
  sources: [SOURCE],
  buildings,
  entrances,
  pathNodes,
  pathEdges,
};
const academic = {
  schemaVersion: 1,
  institution: "ubc",
  sources: [],
  terms: [],
  courses: [],
};

const outputDirectory = resolve(repositoryRoot, "universities/ubc");
await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(
    resolve(outputDirectory, "campus.json"),
    `${JSON.stringify(campus, null, 2)}\n`,
  ),
  writeFile(
    resolve(outputDirectory, "academic.json"),
    `${JSON.stringify(academic, null, 2)}\n`,
  ),
]);

const coveredBuildings = new Set(
  entrances.map((entrance) => entrance.buildingId),
);
console.log(
  `Imported ${buildings.length} buildings, ${entrances.length} mapped entrances, ` +
    `${pathNodes.length} path nodes, and ${pathEdges.length} path edges.`,
);
console.log(
  `Routable building coverage: ${coveredBuildings.size}/${buildings.length} ` +
    `(${((coveredBuildings.size / buildings.length) * 100).toFixed(1)}%).`,
);
