import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateCampus } from "../scripts/validate-university-data.mjs";

const campus = JSON.parse(
  readFileSync(
    new URL("../universities/ubc/campus.json", import.meta.url),
    "utf8",
  ),
);

const buildingsByCode = new Map(
  campus.buildings.flatMap((building) =>
    building.nativeCodes.map((code) => [code, building]),
  ),
);
const entrancesByBuilding = new Map();
for (const entrance of campus.entrances) {
  const existing = entrancesByBuilding.get(entrance.buildingId) ?? [];
  existing.push(entrance);
  entrancesByBuilding.set(entrance.buildingId, existing);
}
const adjacency = new Map(campus.pathNodes.map((node) => [node.id, []]));
for (const edge of campus.pathEdges) {
  adjacency.get(edge.from).push(edge.to);
  adjacency.get(edge.to).push(edge.from);
}

function connected(from, to) {
  const visited = new Set([from]);
  const pending = [from];
  while (pending.length) {
    const current = pending.pop();
    if (current === to) return true;
    for (const neighbour of adjacency.get(current) ?? []) {
      if (visited.has(neighbour)) continue;
      visited.add(neighbour);
      pending.push(neighbour);
    }
  }
  return false;
}

function entranceFor(code) {
  const building = buildingsByCode.get(code);
  assert.ok(building, `official building code ${code} must be present`);
  const entrance = entrancesByBuilding.get(building.id)?.[0];
  assert.ok(entrance, `${code} must have a routable mapped entrance`);
  return entrance;
}

test("UBC Vancouver snapshot validates and has broad official coverage", () => {
  assert.deepEqual(validateCampus(campus), []);
  assert.equal(campus.campus.id, "ubc-vancouver");
  assert.ok(campus.buildings.length >= 225);
  assert.ok(campus.entrances.length >= 850);
  assert.ok(campus.pathNodes.length >= 10_000);
  assert.ok(campus.pathEdges.length >= 11_000);
  assert.ok(
    entrancesByBuilding.size / campus.buildings.length >= 0.9,
    "at least 90% of included student-facing buildings should be routable",
  );
});

test("UBC mapped records and inferred connectors retain honest provenance", () => {
  for (const building of campus.buildings) {
    assert.equal(building.provenance[0].verification, "source-backed");
  }
  for (const entrance of campus.entrances) {
    assert.equal(entrance.access, "unknown");
    assert.equal(entrance.provenance[0].verification, "source-backed");
    assert.match(entrance.provenance[0].nativeId, /^entrance\//);
  }
  const connectors = campus.pathEdges.filter((edge) =>
    edge.id.startsWith("ubc-inferred-connector-"),
  );
  const inferredEntranceNodes = new Set(
    campus.entrances
      .map((entrance) => entrance.pathNodeId)
      .filter((id) => id.startsWith("ubc-entrance-node-")),
  );
  assert.equal(connectors.length, inferredEntranceNodes.size);
  assert.ok(connectors.length >= 500);
  for (const connector of connectors) {
    assert.ok(inferredEntranceNodes.has(connector.from));
    assert.equal(connector.provenance[0].verification, "inferred");
    assert.match(connector.provenance[0].nativeId, /^entrance-to-route\//);
  }
  for (const edge of campus.pathEdges.filter((edge) =>
    edge.id.startsWith("ubc-route-edge-"),
  )) {
    assert.equal(edge.provenance[0].verification, "source-backed");
    assert.match(edge.provenance[0].nativeId, /^route\/\d+\/segment\/\d+$/);
  }
});

test("representative nearby, cross-campus, residence, and academic routes connect", () => {
  for (const [fromCode, toCode] of [
    ["BUCH", "KLIB"],
    ["ICCS", "CHEM"],
    ["MAR1", "PHRM"],
    ["ORCH", "BUCH"],
    ["LIFE", "PHRM"],
  ]) {
    const from = entranceFor(fromCode);
    const to = entranceFor(toCode);
    assert.ok(
      connected(from.pathNodeId, to.pathNodeId),
      `${fromCode} must route to ${toCode}`,
    );
  }
});
