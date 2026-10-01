#!/usr/bin/env python3
"""Build McGill's downtown-campus snapshot from official identities and OSM geometry.

Usage: python3 scripts/import-mcgill-downtown.py /tmp/mcgill-core.xml

McGill's official 2025 downtown map supplies campus identity and building names.
The official exam-location directory supplies schedule codes where it publishes
them. OSM supplies redistributable footprints, entrance nodes, and pedestrian
ways. Inferred graph connectors remain explicitly inferred and never acquire
door, access, or accessibility claims.
"""

from __future__ import annotations

import json
import math
import re
import sys
import xml.etree.ElementTree as ET
from collections import defaultdict, deque
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RETRIEVED_AT = "2026-09-30"
OFFICIAL_SOURCE = "mcgill-downtown-map-2025"
CODE_SOURCE = "mcgill-exam-locations-2026"
OSM_SOURCE = "osm-mcgill-downtown-2026-09"
BOUNDS = [[-73.584, 45.499], [-73.570, 45.514]]

# code is an official schedule code when published by McGill's exam-location
# directory. Otherwise it is the official numeric building ID on the 2025 map.
# (code, official name, OSM primitive, aliases, category, has schedule code)
BUILDINGS = [
    ("ADAMS", "Frank Dawson Adams Building", "way/112976640", ["Adams Building", "FDA"], "academic", True),
    ("185", "Donald E. Armstrong Building", "way/30176570", ["Armstrong Building"], "academic", False),
    ("ARTS", "McCall MacBain Arts Building", "way/21340756", ["Arts Building"], "academic", True),
    ("134", "Bishop Mountain Hall", "way/28326202", [], "residence", False),
    ("124", "Birks Building", "way/21341787", [], "academic", False),
    ("BRONF", "Bronfman Building", "way/20169169", [], "academic", True),
    ("BROWN", "Brown Student Services Building", "way/30176563", ["William and Mary Brown Student Services Building"], "facility", False),
    ("BURN", "Burnside Hall", "way/20168777", [], "academic", True),
    ("121", "Carrefour Sherbrooke Residence", "way/341495947", ["Carrefour Sherbrooke"], "residence", False),
    ("122", "Chancellor Day Hall", "way/340258402", [], "academic", False),
    ("173", "Charles Meredith House", "way/340257925", [], "facility", False),
    ("252", "La Citadelle Residence", "way/340072817", ["La Citadelle"], "residence", False),
    ("GYM", "McGill Sports Complex", "way/28994383", ["Arthur Currie Gymnasium", "Currie Gym", "Fieldhouse"], "facility", True),
    ("125", "Douglas Hall", "way/30176594", [], "residence", False),
    ("169", "Duff Medical Building", "way/23815120", ["Duff Building"], "academic", False),
    ("168", "Education Building", "way/46867137", ["Faculty of Education"], "academic", False),
    ("245", "Elizabeth Wirth Music Building", "way/80263149", ["New Music Building"], "academic", False),
    ("129", "Faculty Club", "way/21342091", [], "facility", False),
    ("197", "Ferrier Building", "way/21340757", [], "academic", False),
    ("133", "Gardner Hall", "way/28994376", [], "residence", False),
    ("112", "James Administration Building", "way/21340759", [], "facility", False),
    ("LEA", "Leacock Building", "way/19912994", ["Leacock"], "academic", True),
    ("MAASS", "Otto Maass Chemistry Building", "way/20168778", ["Maass Chemistry Building"], "academic", True),
    ("ENGMD", "Macdonald Engineering Building", "way/20168784", [], "academic", True),
    ("MDHAR", "Macdonald-Harrington Building", "way/20168782", [], "academic", True),
    ("170", "Macdonald-Stewart Library Building", "way/20168781", ["Macdonald Stewart Library"], "facility", False),
    ("105", "McConnell Arena", "way/30176590", ["McConnell Winter Stadium"], "facility", False),
    ("ENGMC", "McConnell Engineering Building", "way/112977926", [], "academic", True),
    ("221", "McConnell Hall", "way/28994378", [], "residence", False),
    ("155", "McIntyre Medical Building", "way/1434436103", [], "academic", False),
    ("108", "McLennan Library Building", "way/19912993", ["McLennan Library"], "facility", False),
    ("116", "Molson Hall", "way/28994377", [], "residence", False),
    ("163", "Morrice Hall", "way/20168954", ["Islamic Studies Library"], "academic", False),
    ("NRH", "New Residence Hall", "way/143174079", ["McGill New Residence Hall"], "residence", True),
    ("189", "Rutherford Physics Building", "way/21341559", ["Rutherford Building"], "academic", False),
    ("SH680", "680 Sherbrooke Street West", "way/372921057", ["Sherbrooke 680", "School of Continuing Studies"], "academic", False),
    ("SH688", "688 Sherbrooke Street West", "way/372921058", ["Sherbrooke 688"], "academic", True),
    ("111", "Stewart Biological Sciences Building", "way/19913855", ["Stewart Biology Building"], "academic", False),
    ("242", "Strathcona Anatomy and Dentistry Building", "way/21341172", [], "academic", False),
    ("MUSIC", "Strathcona Music Building", "way/80263147", [], "academic", True),
    ("172", "University Centre", "way/30176564", [], "facility", False),
    ("251", "University Hall Residence", "relation/18237980", ["University Hall"], "residence", False),
    ("WILSON", "Wilson Hall", "way/21341788", [], "academic", True),
    ("WONG", "Wong Building", "way/21340760", [], "academic", True),
    ("RPHYS", "Rutherford Physics Building", "way/21341559", ["Rutherford Physics"], "academic", True),
    ("ENGTR", "Trottier Building", "way/21341557", [], "academic", True),
    ("RMUS", "Redpath Museum", "way/20168831", [], "facility", False),
    ("RLIB", "Redpath Library Building", "way/20168923", ["Redpath Library"], "facility", False),
    ("RHALL", "Redpath Hall", "way/20168924", [], "facility", False),
    ("THOMSON", "Thomson House", "way/165265063", [], "facility", False),
]


def slug(value: str) -> str:
    return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", value.lower()))


def distance(a: list[float], b: list[float]) -> float:
    latitude = math.radians((a[1] + b[1]) / 2)
    return math.hypot(math.radians(b[0] - a[0]) * math.cos(latitude), math.radians(b[1] - a[1])) * 6_371_000


def provenance(source: str, native: str, verification: str = "source-backed") -> list[dict]:
    return [{"sourceId": source, "nativeId": native, "verification": verification}]


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Pass the McGill downtown OSM XML extract.")
    root = ET.parse(sys.argv[1]).getroot()
    nodes = {
        node.attrib["id"]: {
            "coordinate": [round(float(node.attrib["lon"]), 7), round(float(node.attrib["lat"]), 7)],
            "tags": {tag.attrib["k"]: tag.attrib["v"] for tag in node.findall("tag")},
        }
        for node in root.findall("node")
    }
    ways = {
        way.attrib["id"]: {
            "nodes": [member.attrib["ref"] for member in way.findall("nd")],
            "tags": {tag.attrib["k"]: tag.attrib["v"] for tag in way.findall("tag")},
        }
        for way in root.findall("way")
    }
    relations = {
        relation.attrib["id"]: [member.attrib for member in relation.findall("member")]
        for relation in root.findall("relation")
    }

    def rings(primitive: str) -> tuple[list[list[list[float]]], set[str]]:
        kind, native = primitive.split("/", 1)
        if kind == "way":
            refs = ways[native]["nodes"]
            coordinates = [nodes[ref]["coordinate"] for ref in refs if ref in nodes]
            if coordinates and coordinates[0] != coordinates[-1]:
                coordinates.append(coordinates[0])
            return [coordinates], set(refs)
        result, refs = [], set()
        for member in relations.get(native, []):
            if member.get("type") != "way" or member.get("role") not in ("outer", ""):
                continue
            way = ways.get(member["ref"])
            if not way:
                continue
            coordinates = [nodes[ref]["coordinate"] for ref in way["nodes"] if ref in nodes]
            if coordinates and coordinates[0] != coordinates[-1]:
                coordinates.append(coordinates[0])
            if len(coordinates) >= 4:
                result.append(coordinates)
                refs.update(way["nodes"])
        return result, refs

    buildings, footprint_nodes, seen = [], {}, set()
    for code, name, primitive, aliases, category, has_schedule_code in BUILDINGS:
        building_id = slug(name)
        if building_id in seen:
            # Rutherford has both an official map ID and an official schedule code.
            existing = next(building for building in buildings if building["id"] == building_id)
            if has_schedule_code and code not in existing["nativeCodes"]:
                existing["nativeCodes"].insert(0, code)
                existing["provenance"] += provenance(CODE_SOURCE, code)
            continue
        geometry_rings, refs = rings(primitive)
        if not geometry_rings:
            raise RuntimeError(f"No source geometry for {name} ({primitive})")
        seen.add(building_id)
        footprint_nodes[building_id] = refs
        sources = provenance(OSM_SOURCE, primitive) + provenance(OFFICIAL_SOURCE, code)
        if has_schedule_code:
            sources += provenance(CODE_SOURCE, code)
        buildings.append({
            "id": building_id,
            "name": name,
            "nativeCodes": [code],
            "aliases": aliases,
            "category": category,
            "geometry": {
                "type": "Polygon" if len(geometry_rings) == 1 else "MultiPolygon",
                "coordinates": [geometry_rings[0]] if len(geometry_rings) == 1 else [[ring] for ring in geometry_rings],
            },
            "provenance": sources,
        })

    adjacency, route_ways = defaultdict(set), []
    for way_id, way in ways.items():
        tags = way["tags"]
        if tags.get("highway") not in {"footway", "path", "pedestrian", "steps", "sidewalk", "living_street"}:
            continue
        if tags.get("access") in {"private", "no"} or tags.get("indoor") == "yes":
            continue
        refs = [ref for ref in way["nodes"] if ref in nodes]
        if len(refs) < 2:
            continue
        route_ways.append((way_id, refs))
        for left, right in zip(refs, refs[1:]):
            if left != right:
                adjacency[left].add(right)
                adjacency[right].add(left)

    visited, components = set(), []
    for node_id in adjacency:
        if node_id in visited:
            continue
        component, pending = {node_id}, deque([node_id])
        visited.add(node_id)
        while pending:
            current = pending.popleft()
            for neighbour in adjacency[current]:
                if neighbour not in visited:
                    visited.add(neighbour)
                    component.add(neighbour)
                    pending.append(neighbour)
        components.append(component)
    main_component = max(components, key=len)
    path_nodes = {
        node_id: {"id": f"osm-node-{node_id}", "coordinate": nodes[node_id]["coordinate"], "provenance": provenance(OSM_SOURCE, f"node/{node_id}")}
        for node_id in main_component
    }
    path_edges, edge_keys = [], set()
    for way_id, refs in route_ways:
        for left, right in zip(refs, refs[1:]):
            key = tuple(sorted((left, right)))
            if left not in main_component or right not in main_component or left == right or key in edge_keys:
                continue
            edge_keys.add(key)
            path_edges.append({"id": f"osm-way-{way_id}-{len(path_edges)+1}", "from": f"osm-node-{left}", "to": f"osm-node-{right}", "mode": "outdoor-walk", "provenance": provenance(OSM_SOURCE, f"way/{way_id}")})

    route_coordinates = [(node_id, nodes[node_id]["coordinate"]) for node_id in main_component]

    def nearest(coordinate: list[float], limit: float):
        matches = [(node_id, distance(coordinate, candidate)) for node_id, candidate in route_coordinates]
        matches = [match for match in matches if match[1] <= limit]
        return min(matches, key=lambda match: match[1]) if matches else None

    entrances = []
    for building in buildings:
        building_id = building["id"]
        explicit = [node_id for node_id in footprint_nodes[building_id] if nodes.get(node_id, {}).get("tags", {}).get("entrance") not in (None, "no")]
        for node_id in explicit:
            coordinate, tags = nodes[node_id]["coordinate"], nodes[node_id]["tags"]
            route = nearest(coordinate, 35)
            if not route:
                continue
            if node_id not in path_nodes:
                path_nodes[node_id] = {"id": f"osm-node-{node_id}", "coordinate": coordinate, "provenance": provenance(OSM_SOURCE, f"node/{node_id}")}
                path_edges.append({"id": f"inferred-entrance-connector-{node_id}", "from": f"osm-node-{node_id}", "to": f"osm-node-{route[0]}", "mode": "outdoor-walk", "provenance": provenance(OSM_SOURCE, f"inferred/entrance/{node_id}/to/{route[0]}", "inferred")})
            restricted = tags.get("access") in {"private", "no"} or tags.get("entrance") in {"service", "emergency"}
            entrances.append({"id": f"osm-entrance-{node_id}-{building_id}", "buildingId": building_id, "coordinate": coordinate, "pathNodeId": f"osm-node-{node_id}", "access": "restricted" if restricted else "unknown", "provenance": provenance(OSM_SOURCE, f"node/{node_id}")})
        if explicit:
            continue
        best = None
        for node_id in footprint_nodes[building_id]:
            if node_id not in nodes:
                continue
            route = nearest(nodes[node_id]["coordinate"], 70)
            if route and (best is None or route[1] < best[2]):
                best = (nodes[node_id]["coordinate"], route[0], route[1])
        if not best:
            continue
        coordinate, route_node, _ = best
        inferred_id = f"inferred-access-{building_id}"
        path_nodes[inferred_id] = {"id": inferred_id, "coordinate": coordinate, "provenance": provenance(OSM_SOURCE, f"inferred/footprint/{building_id}", "inferred")}
        path_edges.append({"id": f"inferred-building-connector-{building_id}", "from": inferred_id, "to": f"osm-node-{route_node}", "mode": "outdoor-walk", "provenance": provenance(OSM_SOURCE, f"inferred/footprint/{building_id}/to/{route_node}", "inferred")})
        entrances.append({"id": f"{inferred_id}-entrance", "buildingId": building_id, "coordinate": coordinate, "pathNodeId": inferred_id, "access": "unknown", "provenance": provenance(OSM_SOURCE, f"inferred/footprint/{building_id}", "inferred")})

    sources = [
        {"id": OFFICIAL_SOURCE, "title": "McGill 2025 Downtown Campus Map", "url": "https://www.mcgill.ca/boardofgovernors/sites/boardofgovernors/files/2025-10/board-of-governors-handbook-2025-26-web.pdf", "retrievedAt": RETRIEVED_AT, "licenseOrTerms": "Published factual building identities; map artwork is not copied", "redistribution": "permitted", "attribution": "McGill University", "transformation": "Transcribed factual downtown building names and map IDs; only entries with independently redistributable geometry were included."},
        {"id": CODE_SOURCE, "title": "McGill Exam Locations", "url": "https://www.mcgill.ca/exams/buildings", "retrievedAt": RETRIEVED_AT, "licenseOrTerms": "Published factual building codes and addresses; page content is not copied", "redistribution": "permitted", "attribution": "McGill University", "transformation": "Attached only building abbreviations explicitly published in McGill's current exam-location directory."},
        {"id": OSM_SOURCE, "title": "OpenStreetMap McGill downtown extract", "url": "https://www.openstreetmap.org/copyright", "retrievedAt": RETRIEVED_AT, "licenseOrTerms": "Open Database License (ODbL) 1.0", "redistribution": "permitted", "attribution": "© OpenStreetMap contributors", "transformation": "Selected reconciled footprints, explicit entrance nodes, and non-private outdoor pedestrian ways. Inferred building and entrance connectors are marked inferred; accessibility and public access remain unknown."},
    ]
    campus = {"schemaVersion": 1, "institution": "mcgill", "campus": {"id": "mcgill-downtown", "name": "McGill University downtown campus", "bounds": BOUNDS}, "sources": sources, "buildings": buildings, "entrances": entrances, "pathNodes": list(path_nodes.values()), "pathEdges": path_edges}
    output = ROOT / "universities" / "mcgill"
    output.mkdir(parents=True, exist_ok=True)
    (output / "campus.json").write_text(json.dumps(campus, indent=2, ensure_ascii=False) + "\n")
    (output / "academic.json").write_text(json.dumps({"schemaVersion": 1, "institution": "mcgill", "sources": [], "terms": [], "courses": []}, indent=2) + "\n")
    explicit_count = sum(1 for entrance in entrances if entrance["provenance"][0]["verification"] == "source-backed")
    print(f"McGill downtown: {len(buildings)} buildings, {len({e['buildingId'] for e in entrances})} routable, {explicit_count} explicit entrances, {len(path_nodes)} nodes, {len(path_edges)} edges")


if __name__ == "__main__":
    main()
