import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";
import { CAMPUS_IDS as catalogCampusIds } from "../src/campus-catalog.js";

test("the contribution runtime renders nonblank map and building data for all 90 campuses", async (t) => {
  const vite = await createServer({
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true },
  });
  t.after(() => vite.close());

  const runtime = await vite.ssrLoadModule("/src/campus-contribution-data.js");
  assert.equal(runtime.UNIVERSITIES.length, 38);
  assert.equal(runtime.CAMPUS_IDS.length, 90);
  assert.equal(new Set(runtime.CAMPUS_IDS).size, 90);
  assert.deepEqual([...runtime.CAMPUS_IDS].sort(), [...catalogCampusIds].sort());

  const previousWindow = globalThis.window;
  globalThis.window = { location: { search: "" } };
  t.after(() => {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  });
  for (const university of runtime.UNIVERSITIES) {
    globalThis.window.location.search = `?university=${encodeURIComponent(university.id)}`;
    assert.equal(runtime.campusFromQuery(), university.defaultCampus, `${university.id}: selection`);
  }

  for (const campusId of runtime.CAMPUS_IDS) {
    const campus = runtime.CAMPUSES[campusId];
    assert.ok(campus, `${campusId}: registry entry must load`);
    assert.equal(campus.id, campusId, `${campusId}: runtime ID must remain stable`);
    globalThis.window.location.search = `?campus=${encodeURIComponent(campusId)}`;
    assert.equal(runtime.campusFromQuery(), campusId, `${campusId}: deep link`);
    assert.equal(runtime.universityForCampus(campusId), campus.universityId);

    const buildings = runtime.canonicalBuildingsForCampus(campusId);
    const footprints = runtime.canonicalFootprintsForCampus(campusId);
    assert.ok(buildings.length > 0, `${campusId}: contribution building list must be nonblank`);
    assert.ok(footprints.length > 0, `${campusId}: contribution map must have footprints`);
    assert.ok(
      footprints.every((feature) => ["Polygon", "MultiPolygon"].includes(feature.geometry?.type)),
      `${campusId}: map footprints must be polygon geometry`,
    );

    const projection = runtime.createCampusProjection(campusId);
    assert.ok(projection.contentWidth > 0 && projection.contentHeight > 0, `${campusId}: projection`);
    assert.ok(
      runtime.tilesForCampus(campusId, projection.project).length > 0,
      `${campusId}: map tiles must load`,
    );
  }
});
