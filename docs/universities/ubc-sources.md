# University of British Columbia Vancouver data sources

The canonical UBC Vancouver snapshot is generated from the University of British Columbia's own [Geospatial Open Data repository](https://github.com/UBCGeodata/ubc-geospatial-opendata) at commit `885732d875577a63bb7750e91506bc3f42e1fbef`. The source repository declares the Open Data Commons Public Domain Dedication and License (PDDL) 1.0.

The import uses these official UBC Vancouver layers:

- `ubcv_buildings.geojson` for official building names, codes, classifications, and footprints;
- `ubcv_building_entraces.geojson` (the upstream filename contains this spelling) for mapped entrance points; and
- `ubcv_routes.geojson` for route segments explicitly marked for pedestrian access.

Scope is the Point Grey/Vancouver campus. Buildings must be complete, occupied, under UBC jurisdiction, have an official building code, and have a student-facing academic, administrative, athletics, commons, housing, research, or services use. Operations and parking structures are intentionally excluded.

Mapped entrance points remain source-backed, but public access, accessibility, hours, and door type are recorded as unknown because the published field metadata does not establish semantics safe for those claims. A mapped entrance is connected only to the main official pedestrian component when it lies within 20 metres. That short entrance-to-route connector is explicitly classified as inferred; it is not represented as a verified walkway or physical door. Entrances farther away are omitted from routable coverage rather than snapped across an unsupported distance.

The snapshot currently includes 236 buildings, 905 routable mapped entrances across 217 buildings, and more than 11,000 graph edges. The uncovered records are mostly peripheral residences, child-care facilities, and farm/service locations. Regression tests validate several nearby and cross-campus routes, including residence-to-academic and academic-to-academic pairs.

Regenerate deterministically with:

```sh
node scripts/import-ubc-vancouver.mjs /path/to/ubc-geospatial-opendata
```
