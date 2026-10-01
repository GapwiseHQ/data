# McGill University downtown data sources

The initial McGill model is deliberately scoped to the downtown Montreal campus. It does not claim coverage of Macdonald Campus, the Gault Nature Reserve, hospital interiors, indoor paths, or current construction detours.

Building identity comes from McGill University's 2025 Downtown Campus Map. Schedule abbreviations are included only where McGill's current Exam Locations directory publishes them. The importer does not infer a timetable code from a building's map number.

Redistributable geometry comes from OpenStreetMap under ODbL 1.0. Building footprints, explicitly tagged entrance nodes, and non-private outdoor pedestrian ways retain their native OSM IDs. The generated snapshot excludes private ways and indoor routing.

Where an explicit entrance node is not itself part of the pedestrian graph, its short graph connector is marked `inferred`. When a building has no explicit mapped entrance, the nearest footprint access point is also marked `inferred`. These records provide conservative building-to-network routing without claiming that an inferred point is a physical door. Entrance access remains `unknown` unless the source explicitly marks a restricted/service/emergency entrance. No entrance is labeled public or accessible by inference.

Canonical sources:

- [McGill 2025 Downtown Campus Map](https://www.mcgill.ca/boardofgovernors/sites/boardofgovernors/files/2025-10/board-of-governors-handbook-2025-26-web.pdf)
- [McGill Exam Locations](https://www.mcgill.ca/exams/buildings)
- [OpenStreetMap copyright and licence](https://www.openstreetmap.org/copyright)

McGill's official campus map depicts accessible entrances, but the present dataset does not transcribe those symbols. Accessibility remains unknown until a separately reviewable source transformation is implemented and validated.
