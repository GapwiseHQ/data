import assert from "node:assert/strict";
import test from "node:test";

import { readFile } from "node:fs/promises";

import {
  canonicalBuildingCodeForFeature,
  universityBuildingFootprint,
} from "../src/canonical-building-identity.js";

for (const campusId of ["carleton", "queens", "harvard"]) {
  test(`${campusId} footprints retain one selectable canonical building identity`, () => {
    return readFile(
      new URL(`../universities/${campusId}/campus.json`, import.meta.url),
      "utf8",
    ).then((raw) => {
      const buildings = JSON.parse(raw).buildings;
      const footprints = buildings
        .map(universityBuildingFootprint)
        .filter(Boolean);
      const selectableCodes = new Set(
        buildings.map((building) =>
          (
            building.nativeCodes?.[0] || building.id.toUpperCase()
          ).toUpperCase(),
        ),
      );
      const footprintCodes = footprints.map(canonicalBuildingCodeForFeature);

      assert.ok(
        buildings.length > 1,
        `${campusId} should expose multiple selectable buildings`,
      );
      assert.ok(
        footprints.length > 1,
        `${campusId} should expose multiple mapped footprints`,
      );
      assert.equal(
        footprintCodes.includes(null),
        false,
        `${campusId} footprints need stable IDs`,
      );
      assert.ok(
        new Set(footprintCodes).size > 1,
        `${campusId} footprints must not collapse to one shared selection key`,
      );
      for (const code of footprintCodes) {
        assert.ok(
          selectableCodes.has(code),
          `${campusId} footprint ${code} must select a building`,
        );
      }
    });
  });
}

test("U of T buildingCode identities remain compatible", () => {
  assert.equal(
    canonicalBuildingCodeForFeature({ properties: { buildingCode: "ba" } }),
    "BA",
  );
});
