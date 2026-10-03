import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const BRANDING_STRING =
  "North America’s largest free and open multi-university campus navigation dataset";

test("branding is exactly consistent across README, index.html, and main.jsx", () => {
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const mainJsx = readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");

  assert.ok(
    readme.includes(BRANDING_STRING),
    `README.md must contain exact branding: "${BRANDING_STRING}"`,
  );
  assert.ok(
    indexHtml.includes(BRANDING_STRING),
    `index.html must contain exact branding: "${BRANDING_STRING}"`,
  );
  assert.ok(
    mainJsx.includes(
      "North America’s largest free and open <span>multi-university</span> campus navigation dataset",
    ),
    "main.jsx must contain hero claim with North America’s branding",
  );
});

test("all 67 supported campuses across 27 universities have canonical datasets and building/map data", () => {
  const unis = JSON.parse(readFileSync(new URL("../../gapwise/universities.json", import.meta.url), "utf8")).universities;
  assert.equal(unis.length, 27, "Must support exactly 27 universities");

  let totalCampuses = 0;
  for (const uni of unis) {
    for (const campusId of uni.campuses) {
      totalCampuses += 1;
      if (uni.id === "uoft") {
        const buildingsJsonFile = new URL(`../data/${campusId}/buildings.json`, import.meta.url);
        const footprintsFile = new URL(`../data/${campusId}/buildings.geojson`, import.meta.url);
        assert.ok(existsSync(footprintsFile), `Canonical footprints for ${campusId} must exist`);

        const footprints = JSON.parse(readFileSync(footprintsFile, "utf8"));
        assert.ok(footprints.features?.length > 0, `${campusId} must have GeoJSON footprint features`);
        if (existsSync(buildingsJsonFile)) {
          const buildings = JSON.parse(readFileSync(buildingsJsonFile, "utf8"));
          assert.ok(buildings.buildings?.length > 0, `${campusId} must have buildings in registry`);
        }
      } else {
        let campusFile = new URL(`../universities/${uni.id}/campuses/${campusId}/campus.json`, import.meta.url);
        if (!existsSync(campusFile)) {
          campusFile = new URL(`../universities/${uni.id}/campus.json`, import.meta.url);
        }
        assert.ok(existsSync(campusFile), `Canonical campus.json for ${uni.id}/${campusId} must exist`);

        const campus = JSON.parse(readFileSync(campusFile, "utf8"));
        assert.equal(campus.institution, uni.id);
        assert.ok(campus.buildings?.length > 0, `${uni.id}/${campusId} must have buildings`);
        assert.ok(campus.pathNodes?.length > 0, `${uni.id}/${campusId} must have pathNodes`);
        assert.ok(campus.pathEdges?.length > 0, `${uni.id}/${campusId} must have pathEdges`);
        assert.ok(
          campus.buildings.some((b) => b.geometry && (b.geometry.type === "Polygon" || b.geometry.type === "MultiPolygon")),
          `${uni.id}/${campusId} must have polygon footprints`,
        );
      }
    }
  }
  assert.equal(totalCampuses, 67, "Must verify exactly 67 campuses across all 27 universities");

  // Verify campus-contribution-data source has all 27 universities in UNIVERSITIES
  const studioDataCode = readFileSync(new URL("../src/campus-contribution-data.js", import.meta.url), "utf8");
  for (const uni of unis) {
    assert.ok(
      studioDataCode.includes(`id: "${uni.id}"`),
      `campus-contribution-data.js must register university ${uni.id}`,
    );
  }
});
