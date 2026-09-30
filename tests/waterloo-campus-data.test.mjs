import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateCampus } from "../scripts/validate-university-data.mjs";

const campus = JSON.parse(
  readFileSync(new URL("../universities/waterloo/campus.json", import.meta.url), "utf8"),
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

function entranceFor(code) {
  const building = buildingsByCode.get(code);
  assert.ok(building, `official building code ${code} must be present`);
  const entrance = entrancesByBuilding.get(building.id)?.[0];
  assert.ok(entrance, `${code} must have a routable access point`);
  return entrance;
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

test("Waterloo main-campus snapshot validates with broad coded-building coverage", () => {
  assert.deepEqual(validateCampus(campus), []);
  assert.equal(campus.institution, "waterloo");
  assert.equal(campus.campus.id, "waterloo-main");
  assert.ok(campus.buildings.length >= 65);
  assert.ok(campus.pathNodes.length >= 10_000);
  assert.ok(campus.pathEdges.length >= 12_000);
  assert.ok(
    entrancesByBuilding.size / campus.buildings.length >= 0.9,
    "at least 90% of included buildings should be routable",
  );
  assert.equal(buildingsByCode.get("E7")?.name, "Pearl Sullivan Engineering Building");
});

test("Waterloo entrances and graph connectors preserve their actual provenance", () => {
  const mapped = campus.entrances.filter(
    (entrance) => entrance.provenance[0].verification === "source-backed",
  );
  const inferred = campus.entrances.filter(
    (entrance) => entrance.provenance[0].verification === "inferred",
  );
  assert.ok(mapped.length >= 150);
  assert.ok(inferred.length >= 10);
  assert.ok(campus.entrances.every((entrance) => entrance.access !== "public"));
  assert.ok(mapped.every((entrance) => /^node\/\d+$/.test(entrance.provenance[0].nativeId)));
  assert.ok(
    inferred.every((entrance) =>
      entrance.provenance[0].nativeId.startsWith("inferred/footprint/"),
    ),
  );

  const inferredEdges = campus.pathEdges.filter(
    (edge) => edge.provenance[0].verification === "inferred",
  );
  assert.ok(inferredEdges.length >= inferred.length);
  assert.ok(
    inferredEdges.every((edge) => edge.id.startsWith("inferred-")),
    "inferred links must be visibly classified",
  );
  assert.ok(
    campus.pathEdges
      .filter((edge) => edge.id.startsWith("osm-way-"))
      .every((edge) => edge.provenance[0].verification === "source-backed"),
  );
});

test("representative Waterloo nearby, cross-campus, and residence routes connect", () => {
  for (const [fromCode, toCode] of [
    ["MC", "QNC"],
    ["RAC", "SCH"],
    ["MKV", "PSE"],
    ["UWP", "DC"],
    ["EC1", "AL"],
  ]) {
    const from = entranceFor(fromCode);
    const to = entranceFor(toCode);
    assert.ok(
      connected(from.pathNodeId, to.pathNodeId),
      `${fromCode} must route to ${toCode}`,
    );
  }
});
