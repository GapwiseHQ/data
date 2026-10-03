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

test("all 16 supported campuses have canonical datasets and building/map data", () => {
  const expectedCampuses = [
    { id: "utm", universityId: "uoft", type: "tri-campus" },
    { id: "utsg", universityId: "uoft", type: "tri-campus" },
    { id: "utsc", universityId: "uoft", type: "tri-campus" },
    { id: "carleton", universityId: "carleton", type: "standalone" },
    { id: "tmu", universityId: "tmu", type: "standalone" },
    { id: "queens", universityId: "queens", type: "standalone" },
    { id: "laurier", universityId: "laurier", type: "standalone" },
    { id: "york", universityId: "york", type: "standalone" },
    { id: "mcmaster", universityId: "mcmaster", type: "standalone" },
    { id: "western", universityId: "western", type: "standalone" },
    { id: "guelph", universityId: "guelph", type: "standalone" },
    { id: "uottawa", universityId: "uottawa", type: "standalone" },
    { id: "brock", universityId: "brock", type: "standalone" },
    { id: "ubc-vancouver", universityId: "ubc", type: "standalone" },
    { id: "waterloo-main", universityId: "waterloo", type: "standalone" },
    { id: "mcgill-downtown", universityId: "mcgill", type: "standalone" },
  ];

  for (const { id, universityId, type } of expectedCampuses) {
    if (type === "tri-campus") {
      const buildingsJsonFile = new URL(`../data/${id}/buildings.json`, import.meta.url);
      const footprintsFile = new URL(`../data/${id}/buildings.geojson`, import.meta.url);
      assert.ok(existsSync(footprintsFile), `Canonical footprints for ${id} must exist`);

      const footprints = JSON.parse(readFileSync(footprintsFile, "utf8"));
      assert.ok(footprints.features?.length > 0, `${id} must have GeoJSON footprint features`);
      if (existsSync(buildingsJsonFile)) {
        const buildings = JSON.parse(readFileSync(buildingsJsonFile, "utf8"));
        assert.ok(buildings.buildings?.length > 0, `${id} must have buildings in registry`);
      }
    } else {
      const campusFile = new URL(`../universities/${universityId}/campus.json`, import.meta.url);
      assert.ok(existsSync(campusFile), `Canonical campus.json for ${universityId} must exist`);

      const campus = JSON.parse(readFileSync(campusFile, "utf8"));
      assert.equal(campus.institution, universityId);
      assert.ok(campus.buildings?.length > 0, `${universityId} must have buildings`);
      assert.ok(campus.pathNodes?.length > 0, `${universityId} must have pathNodes`);
      assert.ok(campus.pathEdges?.length > 0, `${universityId} must have pathEdges`);
      assert.ok(
        campus.buildings.some((b) => b.geometry && (b.geometry.type === "Polygon" || b.geometry.type === "MultiPolygon")),
        `${universityId} must have polygon footprints`,
      );
    }
  }

  // Verify campus-contribution-data source has all 14 universities in UNIVERSITIES
  const studioDataCode = readFileSync(new URL("../src/campus-contribution-data.js", import.meta.url), "utf8");
  const expectedUniversities = [
    "uoft",
    "carleton",
    "tmu",
    "queens",
    "laurier",
    "york",
    "mcmaster",
    "western",
    "guelph",
    "uottawa",
    "brock",
    "ubc",
    "waterloo",
    "mcgill",
  ];
  for (const uniId of expectedUniversities) {
    assert.ok(
      studioDataCode.includes(`id: "${uniId}"`),
      `campus-contribution-data.js must register university ${uniId}`,
    );
  }
});
