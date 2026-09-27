# Public distribution contract

Gapwise Data maintains canonical campus models across 11 supported universities (13 campus models) under `universities/<id>/campus.json`. Applications can discover them programmatically via the public API at `https://api.gapwise.ca/v1/universities` and `https://api.gapwise.ca/v1/campuses`.

In addition, `data/utm` is the canonical UTM raw distribution subtree. A production build copies that validated tree to `https://data.gapwise.ca/datasets/utm/latest/` and generates `manifest.json` with SHA-256 hashes and byte sizes. Additional university models (Carleton, Queen's, Western, Ottawa, McMaster, Laurier, York, Guelph, Brock, UTSG, and UTSC) remain canonical repository data with dedicated campus models.

This is a distribution surface, not a runtime dependency of Gapwise. The web app and public API ship with a tested snapshot so a Data-site outage does not break student routing.

Prefer:

- `api.gapwise.ca/v1` or official SDKs for stable campus-intelligence semantics;
- `data.gapwise.ca/datasets/utm/latest/` for raw UTM source-level artifacts;
- `docs.gapwise.ca/data/` for schemas, provenance, uncertainty, versioning, and reuse guidance.
