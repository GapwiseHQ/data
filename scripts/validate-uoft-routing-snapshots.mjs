import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const errors = [];
const unique = (values, label) => {
  if (new Set(values).size !== values.length) errors.push(`${label} must be unique`);
};
const validCoordinate = (coordinate) =>
  Array.isArray(coordinate) &&
  coordinate.length === 2 &&
  Number.isFinite(coordinate[0]) &&
  coordinate[0] >= -180 &&
  coordinate[0] <= 180 &&
  Number.isFinite(coordinate[1]) &&
  coordinate[1] >= -90 &&
  coordinate[1] <= 90;

for (const campusId of ['utsg', 'utsc']) {
  const path = resolve(`data/${campusId}/campus.json`);
  const campus = JSON.parse(await readFile(path, 'utf8'));
  if (campus.schemaVersion !== 1) errors.push(`${campusId}: schemaVersion must be 1`);
  if (campus.institution !== 'uoft') errors.push(`${campusId}: institution must be uoft`);
  if (campus.campus?.id !== campusId) errors.push(`${campusId}: campus ID mismatch`);
  if (!Array.isArray(campus.buildings) || campus.buildings.length < 20) {
    errors.push(`${campusId}: insufficient building coverage`);
  }
  if (!Array.isArray(campus.entrances) || campus.entrances.length < 5) {
    errors.push(`${campusId}: insufficient source-backed entrance coverage`);
  }
  if (!Array.isArray(campus.pathNodes) || campus.pathNodes.length < 100) {
    errors.push(`${campusId}: insufficient pedestrian graph nodes`);
  }
  if (!Array.isArray(campus.pathEdges) || campus.pathEdges.length < 100) {
    errors.push(`${campusId}: insufficient pedestrian graph edges`);
  }

  const sourceIds = new Set(campus.sources.map((source) => source.id));
  const buildingIds = new Set(campus.buildings.map((building) => building.id));
  const nodes = new Map(campus.pathNodes.map((node) => [node.id, node]));
  unique(campus.sources.map((source) => source.id), `${campusId} source IDs`);
  unique(campus.buildings.map((building) => building.id), `${campusId} building IDs`);
  unique(
    campus.buildings.flatMap((building) => building.nativeCodes.map((code) => code.toUpperCase())),
    `${campusId} native building codes`,
  );
  unique(campus.entrances.map((entrance) => entrance.id), `${campusId} entrance IDs`);
  unique(campus.pathNodes.map((node) => node.id), `${campusId} graph node IDs`);
  unique(campus.pathEdges.map((edge) => edge.id), `${campusId} graph edge IDs`);

  for (const source of campus.sources) {
    if (!source.id || !source.url || !source.licenseOrTerms) {
      errors.push(`${campusId}: every source needs an ID, URL, and licence/terms`);
    }
  }
  for (const entrance of campus.entrances) {
    if (!buildingIds.has(entrance.buildingId)) errors.push(`${campusId}/${entrance.id}: unknown building`);
    const node = nodes.get(entrance.pathNodeId);
    if (!node) errors.push(`${campusId}/${entrance.id}: unknown graph node`);
    if (!validCoordinate(entrance.coordinate)) errors.push(`${campusId}/${entrance.id}: invalid coordinate`);
    if (node && JSON.stringify(node.coordinate) !== JSON.stringify(entrance.coordinate)) {
      errors.push(`${campusId}/${entrance.id}: entrance and graph-node coordinates differ`);
    }
    if (entrance.access === 'public') {
      errors.push(`${campusId}/${entrance.id}: OSM entrance must not imply public access`);
    }
    const provenance = entrance.provenance?.[0];
    if (
      provenance?.verification !== 'source-backed' ||
      !/^node\/\d+$/.test(provenance.nativeId ?? '') ||
      !sourceIds.has(provenance.sourceId)
    ) {
      errors.push(`${campusId}/${entrance.id}: entrance must cite a source-backed OSM node`);
    }
  }
  for (const edge of campus.pathEdges) {
    if (edge.from === edge.to || !nodes.has(edge.from) || !nodes.has(edge.to)) {
      errors.push(`${campusId}/${edge.id}: invalid or zero-length endpoints`);
    } else if (JSON.stringify(nodes.get(edge.from).coordinate) === JSON.stringify(nodes.get(edge.to).coordinate)) {
      errors.push(`${campusId}/${edge.id}: zero-length edge`);
    }
    if (edge.mode !== 'outdoor-walk') errors.push(`${campusId}/${edge.id}: indoor routing is unsupported`);
  }

  const coveredBuildings = new Set(campus.entrances.map((entrance) => entrance.buildingId));
  console.log(
    `${campusId}: validated ${campus.buildings.length} buildings, ${campus.entrances.length} source-backed entrances across ${coveredBuildings.size} buildings, and ${campus.pathNodes.length}/${campus.pathEdges.length} graph nodes/edges.`,
  );
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}
