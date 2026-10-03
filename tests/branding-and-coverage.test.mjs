import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const EXPECTED_CAMPUSES = {
  "uoft": [
    "utm",
    "utsg",
    "utsc"
  ],
  "carleton": [
    "carleton",
    "carleton-dominion-chalmers"
  ],
  "tmu": [
    "tmu",
    "tmu-brampton"
  ],
  "queens": [
    "queens",
    "queens-west"
  ],
  "laurier": [
    "waterloo",
    "laurier-brantford",
    "laurier-milton"
  ],
  "york": [
    "keele",
    "glendon",
    "markham"
  ],
  "mcmaster": [
    "mcmaster",
    "mcmaster-burlington"
  ],
  "western": [
    "western",
    "western-huron",
    "western-kings"
  ],
  "guelph": [
    "guelph",
    "guelph-ridgetown",
    "guelph-humber"
  ],
  "uottawa": [
    "uottawa",
    "uottawa-alta-vista"
  ],
  "brock": [
    "brock",
    "brock-miw"
  ],
  "ubc": [
    "ubc-vancouver",
    "ubc-okanagan"
  ],
  "waterloo": [
    "waterloo-main",
    "waterloo-cambridge",
    "waterloo-kitchener",
    "waterloo-stratford"
  ],
  "mcgill": [
    "mcgill-downtown",
    "mcgill-macdonald"
  ],
  "cmu": [
    "cmu-pittsburgh",
    "cmu-silicon-valley"
  ],
  "ucberkeley": [
    "ucberkeley-main",
    "ucberkeley-richmond"
  ],
  "nyu": [
    "nyu-washington-square",
    "nyu-brooklyn"
  ],
  "mit": [
    "mit-cambridge",
    "mit-lincoln-lab"
  ],
  "stanford": [
    "stanford-main",
    "stanford-redwood-city"
  ],
  "upenn": [
    "upenn-philadelphia",
    "upenn-pennovation",
    "upenn-new-bolton"
  ],
  "cornell": [
    "cornell-ithaca",
    "cornell-tech",
    "cornell-weill"
  ],
  "dartmouth": [
    "dartmouth-hanover",
    "dartmouth-lebanon"
  ],
  "brown": [
    "brown-providence",
    "brown-jewelry-district"
  ],
  "columbia": [
    "columbia-morningside",
    "columbia-manhattanville",
    "columbia-cuimc"
  ],
  "princeton": [
    "princeton-main",
    "princeton-forrestal",
    "princeton-meadows"
  ],
  "yale": [
    "yale-new-haven",
    "yale-medical",
    "yale-west"
  ],
  "harvard": [
    "harvard-cambridge",
    "harvard-allston",
    "harvard-longwood"
  ]
};

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
  const unis = Object.entries(EXPECTED_CAMPUSES).map(([id, campuses]) => ({ id, campuses }));
  // When the sibling gapwise checkout is present, the two repos must agree exactly.
  const gapwiseManifest = new URL("../../gapwise/universities.json", import.meta.url);
  if (existsSync(gapwiseManifest)) {
    const live = JSON.parse(readFileSync(gapwiseManifest, "utf8")).universities;
    assert.deepEqual(Object.fromEntries(live.map((u) => [u.id, u.campuses])), EXPECTED_CAMPUSES);
  }
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
        const routableCampuses = new Set([
          "utm", "utsg", "utsc", "carleton", "tmu", "queens", "waterloo", "keele",
          "mcmaster", "western", "guelph", "uottawa", "brock", "ubc-vancouver",
          "waterloo-main", "mcgill-downtown", "cmu-pittsburgh", "ucberkeley-main",
          "nyu-washington-square", "mit-cambridge", "stanford-main", "upenn-philadelphia",
          "cornell-ithaca", "dartmouth-hanover", "brown-providence", "columbia-morningside",
          "princeton-main", "yale-new-haven", "harvard-cambridge"
        ]);
        if (routableCampuses.has(campusId)) {
          assert.ok(campus.pathNodes?.length > 0, `${uni.id}/${campusId} must have pathNodes`);
          assert.ok(campus.pathEdges?.length > 0, `${uni.id}/${campusId} must have pathEdges`);
        }
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
