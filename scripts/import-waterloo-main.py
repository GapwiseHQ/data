#!/usr/bin/env python3
"""Build the canonical University of Waterloo main-campus snapshot.

Usage:
  python3 scripts/import-waterloo-main.py \
    /tmp/waterloo-main.xml /tmp/waterloo-north.xml /tmp/waterloo-east.xml

Building identities and codes come from Waterloo's official August 2025 campus
map, with the current Pearl Sullivan Engineering name cross-checked against the
university's 2025 renaming announcement. Geometry, mapped entrance nodes, and
pedestrian ways come from the supplied OpenStreetMap extracts. A connector may
be inferred solely to join an access point to the path graph; it never acquires
door, public-access, or accessibility semantics.
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
OSM_SOURCE_ID = "osm-waterloo-main-2026-09"
OFFICIAL_SOURCE_ID = "waterloo-official-campus-map-2025"
CURRENT_NAME_SOURCE_ID = "waterloo-pse-renaming-2025"
BOUNDS = [[-80.558, 43.462], [-80.522, 43.493]]

# (code, official/current name, OSM primitive, aliases, category)
# Buildings without a source-backed OSM footprint are intentionally omitted.
# The official map entries CIM, CLN, CLV, and COG remain documented by the
# source, but current redistributable geometry was not identifiable without
# guessing. IOG is an outdoor gathering space rather than a building.
BUILDINGS = [
    ("AL", "Arts Lecture Hall", "way/43250619", [], "academic"),
    ("AVR", "Autonomous Vehicle Research & Intelligence Laboratory", "way/731803685", ["AVRIL"], "academic"),
    ("B1", "Biology 1", "way/43250632", [], "academic"),
    ("B2", "Biology 2", "way/43250628", [], "academic"),
    ("BMH", "B.C. Matthews Hall", "way/43250643", ["Matthews Hall"], "academic"),
    ("BRH", "Brubacher House", "way/141711583", [], "facility"),
    ("BSC", "Bright Starts Co-operative Early Learning Centre", "way/368656349", ["Bright Starts"], "facility"),
    ("C2", "Chemistry 2", "way/43250634", [], "academic"),
    ("CGR", "Conrad Grebel University College", "way/43250610", ["Conrad Grebel"], "academic"),
    ("CIF", "Columbia Icefield", "way/43250639", ["Columbia Icefield Field House"], "facility"),
    ("CMH", "Claudette Millar Hall", "way/382872689", [], "residence"),
    ("COM", "Commissary", "way/43250642", [], "facility"),
    ("CPH", "Carl A. Pollock Hall", "way/43250635", ["Pollock Hall"], "academic"),
    ("CSB", "Central Services Building", "way/43250641", [], "facility"),
    ("DC", "William G. Davis Computer Research Centre", "relation/8765264", ["Davis Centre"], "academic"),
    ("DWE", "Douglas Wright Engineering Building", "way/147379102", ["Douglas Wright Engineering"], "academic"),
    ("E2", "Engineering 2", "way/43250604", [], "academic"),
    ("E3", "Engineering 3", "way/43250605", [], "academic"),
    ("E5", "Engineering 5", "way/51125806", [], "academic"),
    ("E6", "Engineering 6", "way/158807251", [], "academic"),
    ("PSE", "Pearl Sullivan Engineering Building", "way/382735686", ["Engineering 7", "E7"], "academic"),
    ("EC1", "East Campus 1", "way/43325856", [], "academic"),
    ("EC2", "East Campus 2", "way/43325858", [], "academic"),
    ("EC3", "East Campus 3", "way/43325857", [], "academic"),
    ("EC4", "East Campus 4", "way/43325864", [], "academic"),
    ("EC5", "East Campus 5", "way/59036407", [], "academic"),
    ("ECH", "East Campus Hall", "way/43250646", [], "academic"),
    ("EIT", "Centre for Environmental & Information Technology", "way/188703119", ["Environmental and Information Technology"], "academic"),
    ("ERC", "Energy Research Centre", "way/154056255", [], "academic"),
    ("ESC", "Earth Sciences & Chemistry", "way/43250629", [], "academic"),
    ("EV1", "Environment 1", "way/48359807", [], "academic"),
    ("EV2", "Environment 2", "way/48359806", [], "academic"),
    ("EV3", "Environment 3", "way/167411346", [], "academic"),
    ("EXP", "Health Expansion Building", "way/382726586", ["HLTH EXP", "Applied Health Sciences Expansion Building"], "academic"),
    ("FED", "Federation Hall", "way/43250640", [], "facility"),
    ("GH", "Graduate House", "way/145890265", [], "facility"),
    ("GSC", "General Services Complex", "way/350394201", [], "facility"),
    ("HH", "J.G. Hagey Hall of the Humanities", "way/43250624", ["Hagey Hall", "Humanities Theatre"], "academic"),
    ("HS", "Health Services", "way/43250611", [], "facility"),
    ("LHI", "Lyle S. Hallman Institute for Health Promotion", "way/142917787", ["Hallman Institute"], "academic"),
    ("LIB", "Dana Porter Library", "way/43250626", ["Porter Library"], "facility"),
    ("M3", "Mathematics 3", "way/1342934521", [], "academic"),
    ("MC", "Mathematics & Computer Building", "way/43250630", ["Math and Computer"], "academic"),
    ("MHR", "Minota Hagey Residence", "way/43250609", [], "residence"),
    ("MKV", "William Lyon Mackenzie King Village", "way/148285604", ["Mackenzie King Village"], "residence"),
    ("ML", "Modern Languages", "way/43250621", ["Theatre of the Arts"], "academic"),
    ("NH", "Ira G. Needles Hall and Extension", "way/43250620", ["Needles Hall"], "academic"),
    ("OPT", "School of Optometry and Vision Science", "way/43250638", ["Optometry"], "academic"),
    ("PAC", "Physical Activities Complex", "way/43250596", [], "facility"),
    ("PAS", "Psychology, Anthropology, Sociology", "way/43250606", [], "academic"),
    ("PHY", "Physics", "way/43250631", [], "academic"),
    ("QNC", "Mike & Ophelia Lazaridis Quantum-Nano Centre", "way/182091547", ["Quantum Nano Centre"], "academic"),
    ("RAC", "Research Advancement Centre", "way/175808262", [], "academic"),
    ("RA2", "Research Advancement Centre 2", "way/175808266", [], "academic"),
    ("RCH", "J.R. Coutts Engineering Lecture Hall", "way/43250607", ["Coutts Engineering Lecture Hall"], "academic"),
    ("REN", "Renison University College", "way/1246717243", ["Renison"], "academic"),
    ("REV", "Ron Eydt Village", "way/43250590", [], "residence"),
    ("SCH", "South Campus Hall", "way/43250637", [], "academic"),
    ("SLC", "Student Life Centre", "way/43250627", [], "facility"),
    ("STC", "Science Teaching Complex", "way/370204260", [], "academic"),
    ("STJ", "St. Jerome's University", "way/43250612", ["St. Jerome’s University"], "academic"),
    ("TC", "William M. Tatham Centre for Co-operative and Experiential Education", "way/130348900", ["Tatham Centre"], "academic"),
    ("TJB", "Toby Jenkins Applied Health Research Building", "way/170097694", ["Toby Jenkins Building"], "academic"),
    ("TH", "Tutors' Houses", "way/43250591", ["Tutors’ Houses"], "residence"),
    ("UC", "University Club", "way/43250617", [], "facility"),
    ("UTD", "United College", "way/43250608", ["St. Paul's University College"], "academic"),
    ("UWP", "University of Waterloo Place", "way/143668848", ["UW Place", "Grand Commons"], "residence"),
    ("V1", "Student Village 1", "way/141712445", ["Village 1"], "residence"),
]


def slug(value: str) -> str:
    return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", value.lower()))


def distance_metres(a: list[float], b: list[float]) -> float:
    latitude = math.radians((a[1] + b[1]) / 2)
    x = math.radians(b[0] - a[0]) * math.cos(latitude)
    y = math.radians(b[1] - a[1])
    return math.hypot(x, y) * 6_371_000


def provenance(source_id: str, native_id: str, verification: str = "source-backed") -> list[dict]:
    return [{"sourceId": source_id, "nativeId": native_id, "verification": verification}]


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("Pass one or more OSM XML extracts.")

    nodes: dict[str, dict] = {}
    ways: dict[str, dict] = {}
    relations: dict[str, dict] = {}
    for filename in sys.argv[1:]:
        root = ET.parse(filename).getroot()
        for node in root.findall("node"):
            node_id = node.attrib["id"]
            nodes[node_id] = {
                "coordinate": [round(float(node.attrib["lon"]), 7), round(float(node.attrib["lat"]), 7)],
                "tags": {tag.attrib["k"]: tag.attrib["v"] for tag in node.findall("tag")},
            }
        for way in root.findall("way"):
            way_id = way.attrib["id"]
            ways[way_id] = {
                "nodes": [member.attrib["ref"] for member in way.findall("nd")],
                "tags": {tag.attrib["k"]: tag.attrib["v"] for tag in way.findall("tag")},
            }
        for relation in root.findall("relation"):
            relation_id = relation.attrib["id"]
            relations[relation_id] = {
                "members": [member.attrib for member in relation.findall("member")],
                "tags": {tag.attrib["k"]: tag.attrib["v"] for tag in relation.findall("tag")},
            }

    def rings_for_primitive(primitive: str) -> tuple[list[list[list[float]]], set[str]]:
        kind, native_id = primitive.split("/", 1)
        if kind == "way":
            refs = ways[native_id]["nodes"]
            coordinates = [nodes[ref]["coordinate"] for ref in refs if ref in nodes]
            if coordinates and coordinates[0] != coordinates[-1]:
                coordinates.append(coordinates[0])
            return [coordinates], set(refs)
        outer_members = [
            member["ref"]
            for member in relations[native_id]["members"]
            if member.get("type") == "way" and member.get("role") in ("outer", "")
        ]
        rings = []
        refs = set()
        for way_id in outer_members:
            way = ways.get(way_id)
            if not way:
                continue
            coordinates = [nodes[ref]["coordinate"] for ref in way["nodes"] if ref in nodes]
            if coordinates and coordinates[0] != coordinates[-1]:
                coordinates.append(coordinates[0])
            if len(coordinates) >= 4:
                rings.append(coordinates)
                refs.update(way["nodes"])
        return rings, refs

    buildings = []
    footprint_nodes: dict[str, set[str]] = {}
    for code, name, primitive, aliases, category in BUILDINGS:
        rings, refs = rings_for_primitive(primitive)
        if not rings:
            raise RuntimeError(f"No valid footprint for {code} ({primitive})")
        building_id = slug(name)
        footprint_nodes[building_id] = refs
        source_list = provenance(OSM_SOURCE_ID, primitive) + provenance(OFFICIAL_SOURCE_ID, code)
        if code == "PSE":
            source_list += provenance(CURRENT_NAME_SOURCE_ID, "pearl-sullivan-engineering-building")
        buildings.append(
            {
                "id": building_id,
                "name": name,
                "nativeCodes": [code, "E7"] if code == "PSE" else [code],
                "aliases": aliases,
                "category": category,
                "geometry": {
                    "type": "Polygon" if len(rings) == 1 else "MultiPolygon",
                    "coordinates": [rings[0]] if len(rings) == 1 else [[ring] for ring in rings],
                },
                "provenance": source_list,
            }
        )

    eligible_highways = {"footway", "path", "pedestrian", "steps", "sidewalk", "living_street"}
    route_ways = []
    adjacency: dict[str, set[str]] = defaultdict(set)
    for way_id, way in ways.items():
        tags = way["tags"]
        if tags.get("highway") not in eligible_highways:
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

    visited = set()
    components = []
    for node_id in adjacency:
        if node_id in visited:
            continue
        component = set([node_id])
        pending = deque([node_id])
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
        node_id: {
            "id": f"osm-node-{node_id}",
            "coordinate": nodes[node_id]["coordinate"],
            "provenance": provenance(OSM_SOURCE_ID, f"node/{node_id}"),
        }
        for node_id in main_component
    }
    path_edges = []
    edge_keys = set()
    for way_id, refs in route_ways:
        for left, right in zip(refs, refs[1:]):
            if left not in main_component or right not in main_component or left == right:
                continue
            key = tuple(sorted((left, right)))
            if key in edge_keys:
                continue
            edge_keys.add(key)
            path_edges.append(
                {
                    "id": f"osm-way-{way_id}-{len(path_edges) + 1}",
                    "from": f"osm-node-{left}",
                    "to": f"osm-node-{right}",
                    "mode": "outdoor-walk",
                    "provenance": provenance(OSM_SOURCE_ID, f"way/{way_id}"),
                }
            )

    route_coordinates = [(node_id, nodes[node_id]["coordinate"]) for node_id in main_component]

    def nearest_route(coordinate: list[float], limit: float) -> tuple[str, float] | None:
        best = None
        for node_id, candidate in route_coordinates:
            distance = distance_metres(coordinate, candidate)
            if distance <= limit and (best is None or distance < best[1]):
                best = (node_id, distance)
        return best

    entrances = []
    used_entrance_nodes = set()
    for building in buildings:
        building_id = building["id"]
        explicit = []
        for node_id in footprint_nodes[building_id]:
            entrance_value = nodes.get(node_id, {}).get("tags", {}).get("entrance")
            if entrance_value and entrance_value != "no":
                explicit.append(node_id)

        for node_id in explicit:
            coordinate = nodes[node_id]["coordinate"]
            route = nearest_route(coordinate, 35)
            if not route:
                continue
            graph_node_id = f"osm-node-{node_id}"
            if node_id not in path_nodes:
                path_nodes[node_id] = {
                    "id": graph_node_id,
                    "coordinate": coordinate,
                    "provenance": provenance(OSM_SOURCE_ID, f"node/{node_id}"),
                }
                path_edges.append(
                    {
                        "id": f"inferred-entrance-connector-{node_id}",
                        "from": graph_node_id,
                        "to": f"osm-node-{route[0]}",
                        "mode": "outdoor-walk",
                        "provenance": provenance(
                            OSM_SOURCE_ID,
                            f"inferred/entrance-node/{node_id}/to/{route[0]}",
                            "inferred",
                        ),
                    }
                )
            tags = nodes[node_id]["tags"]
            access = "restricted" if tags.get("access") in {"private", "no"} or tags.get("entrance") in {"service", "emergency"} else "unknown"
            entrances.append(
                {
                    "id": f"osm-entrance-{node_id}-{building_id}",
                    "buildingId": building_id,
                    "coordinate": coordinate,
                    "pathNodeId": graph_node_id,
                    "access": access,
                    "provenance": provenance(OSM_SOURCE_ID, f"node/{node_id}"),
                }
            )
            used_entrance_nodes.add(node_id)

        if explicit:
            continue
        footprint_coordinates = [nodes[node_id]["coordinate"] for node_id in footprint_nodes[building_id] if node_id in nodes]
        best = None
        for coordinate in footprint_coordinates:
            route = nearest_route(coordinate, 60)
            if route and (best is None or route[1] < best[2]):
                best = (coordinate, route[0], route[1])
        if not best:
            continue
        coordinate, route_node_id, _distance = best
        inferred_id = f"inferred-access-{building_id}"
        path_nodes[inferred_id] = {
            "id": inferred_id,
            "coordinate": coordinate,
            "provenance": provenance(OSM_SOURCE_ID, f"inferred/footprint/{building_id}", "inferred"),
        }
        path_edges.append(
            {
                "id": f"inferred-building-connector-{building_id}",
                "from": inferred_id,
                "to": f"osm-node-{route_node_id}",
                "mode": "outdoor-walk",
                "provenance": provenance(OSM_SOURCE_ID, f"inferred/footprint/{building_id}/to/{route_node_id}", "inferred"),
            }
        )
        entrances.append(
            {
                "id": f"{inferred_id}-entrance",
                "buildingId": building_id,
                "coordinate": coordinate,
                "pathNodeId": inferred_id,
                "access": "unknown",
                "provenance": provenance(OSM_SOURCE_ID, f"inferred/footprint/{building_id}", "inferred"),
            }
        )

    sources = [
        {
            "id": OFFICIAL_SOURCE_ID,
            "title": "University of Waterloo Campus Map (August 2025)",
            "url": "https://uwaterloo.ca/about/sites/default/files/uploads/documents/fp3574-2025-campusmap-padded-tearoff_lr-final-ua.pdf",
            "retrievedAt": RETRIEVED_AT,
            "licenseOrTerms": "Published factual building names and codes; map artwork is not copied",
            "redistribution": "permitted",
            "attribution": "University of Waterloo",
            "transformation": "Transcribed factual building names and short codes from the official building index; entries lacking independently redistributable geometry were not guessed.",
        },
        {
            "id": CURRENT_NAME_SOURCE_ID,
            "title": "Honouring the legacy of Dr. Pearl Sullivan and the future of education",
            "url": "https://uwaterloo.ca/news/eweal-honouring-legacy-pearl-sullivan-future-education",
            "retrievedAt": RETRIEVED_AT,
            "licenseOrTerms": "Published factual building rename; page content is not copied",
            "redistribution": "permitted",
            "attribution": "University of Waterloo",
            "transformation": "Used the university's current Pearl Sullivan Engineering name while retaining E7 as a searchable schedule alias.",
        },
        {
            "id": OSM_SOURCE_ID,
            "title": "OpenStreetMap University of Waterloo main-campus extract",
            "url": "https://www.openstreetmap.org/copyright",
            "retrievedAt": RETRIEVED_AT,
            "licenseOrTerms": "Open Database License (ODbL) 1.0",
            "redistribution": "permitted",
            "attribution": "© OpenStreetMap contributors",
            "transformation": "Selected official-map buildings with identifiable OSM footprints, explicit mapped entrance nodes, and non-private outdoor pedestrian ways. Inferred building-to-path and entrance-to-path connectors are marked inferred; access and accessibility remain unknown unless the source explicitly restricts access.",
        },
    ]
    campus = {
        "schemaVersion": 1,
        "institution": "waterloo",
        "campus": {"id": "waterloo-main", "name": "University of Waterloo main campus", "bounds": BOUNDS},
        "sources": sources,
        "buildings": buildings,
        "entrances": entrances,
        "pathNodes": list(path_nodes.values()),
        "pathEdges": path_edges,
    }
    academic = {"schemaVersion": 1, "institution": "waterloo", "sources": [], "terms": [], "courses": []}
    output = ROOT / "universities" / "waterloo"
    output.mkdir(parents=True, exist_ok=True)
    (output / "campus.json").write_text(json.dumps(campus, indent=2, ensure_ascii=False) + "\n")
    (output / "academic.json").write_text(json.dumps(academic, indent=2) + "\n")

    explicit_count = sum(
        1 for entrance in entrances if entrance["provenance"][0]["verification"] == "source-backed"
    )
    covered = len({entrance["buildingId"] for entrance in entrances})
    print(
        f"Waterloo: {len(buildings)} buildings, {covered} routable, "
        f"{explicit_count} explicit mapped entrances, {len(path_nodes)} nodes, {len(path_edges)} edges."
    )


if __name__ == "__main__":
    main()
