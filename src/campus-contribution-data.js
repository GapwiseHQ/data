import {
  buildings as utmBuildings,
  entranceFeatures as utmEntranceFeatures,
  footprintFeatures as utmFootprintFeatures,
  geometryCoordinates,
  metersBetween,
  todayLocalDate,
} from "./entrance-map-data.js";
import utsgRegistry from "../data/utsg/buildings.json";
import utsgFootprintsJson from "../data/utsg/buildings.geojson?raw";
import utscRegistry from "../data/utsc/buildings.json";
import utscFootprintsJson from "../data/utsc/buildings.geojson?raw";
import carletonCampus from "../universities/carleton/campus.json";
import tmuCampus from "../universities/tmu/campus.json";
import queensCampus from "../universities/queens/campus.json";
import laurierCampus from "../universities/laurier/campus.json";
import yorkCampus from "../universities/york/campus.json";
import mcmasterCampus from "../universities/mcmaster/campus.json";
import westernCampus from "../universities/western/campus.json";
import guelphCampus from "../universities/guelph/campus.json";
import uottawaCampus from "../universities/uottawa/campus.json";
import brockCampus from "../universities/brock/campus.json";
import ubcCampus from "../universities/ubc/campus.json";
import waterlooCampus from "../universities/waterloo/campus.json";
import mcgillCampus from "../universities/mcgill/campus.json";
import {
  canonicalBuildingCodeForFeature,
  universityBuildingFootprint,
} from "./canonical-building-identity.js";

export { canonicalBuildingCodeForFeature } from "./canonical-building-identity.js";

const universityCampusModules = import.meta.glob(
  "../universities/**/campus.json",
  { eager: true, import: "default" },
);

const utsgFootprints = JSON.parse(utsgFootprintsJson);
const utscFootprints = JSON.parse(utscFootprintsJson);

export const MAP_WIDTH = 1200;
export const MAP_HEIGHT = 840;
const MAP_PADDING = 26;

function boundsFromFeatures(features, fallback) {
  const coordinates = features.flatMap((feature) =>
    geometryCoordinates(feature.geometry),
  );
  if (!coordinates.length) return fallback;
  const lons = coordinates.map(([lon]) => lon);
  const lats = coordinates.map(([, lat]) => lat);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const lonPad = Math.max((maxLon - minLon) * 0.09, 0.0007);
  const latPad = Math.max((maxLat - minLat) * 0.09, 0.0005);
  return {
    minLon: minLon - lonPad,
    maxLon: maxLon + lonPad,
    minLat: minLat - latPad,
    maxLat: maxLat + latPad,
  };
}

const UTM_FALLBACK = {
  minLon: -79.6755,
  maxLon: -79.6542,
  minLat: 43.5421,
  maxLat: 43.5577,
};

const UTSG_FALLBACK = {
  minLon: -79.4215,
  maxLon: -79.365,
  minLat: 43.645,
  maxLat: 43.6825,
};

const UTSC_FALLBACK = {
  minLon: -79.205,
  maxLon: -79.165,
  minLat: 43.772,
  maxLat: 43.7995,
};

const CARLETON_FALLBACK = {
  minLon: -75.705,
  maxLon: -75.688,
  minLat: 45.38,
  maxLat: 45.394,
};

const TMU_FALLBACK = {
  minLon: -79.385,
  maxLon: -79.373,
  minLat: 43.654,
  maxLat: 43.662,
};

const QUEENS_FALLBACK = {
  minLon: -76.502,
  maxLon: -76.49,
  minLat: 44.221,
  maxLat: 44.232,
};

const LAURIER_FALLBACK = {
  minLon: -80.536,
  maxLon: -80.523,
  minLat: 43.47,
  maxLat: 43.479,
};

const YORK_FALLBACK = {
  minLon: -79.515,
  maxLon: -79.493,
  minLat: 43.766,
  maxLat: 43.782,
};

const MCMASTER_FALLBACK = {
  minLon: -79.932,
  maxLon: -79.91,
  minLat: 43.256,
  maxLat: 43.268,
};

const WESTERN_FALLBACK = {
  minLon: -81.285,
  maxLon: -81.265,
  minLat: 42.996,
  maxLat: 43.015,
};

const GUELPH_FALLBACK = {
  minLon: -80.236,
  maxLon: -80.218,
  minLat: 43.524,
  maxLat: 43.538,
};

const UOTTAWA_FALLBACK = {
  minLon: -75.69,
  maxLon: -75.674,
  minLat: 45.416,
  maxLat: 45.426,
};

const BROCK_FALLBACK = {
  minLon: -79.256,
  maxLon: -79.24,
  minLat: 43.112,
  maxLat: 43.125,
};

const TRI_CAMPUS_REGISTRIES = {
  utsg: utsgRegistry,
  utsc: utscRegistry,
};

const TRI_CAMPUS_FOOTPRINTS = {
  utsg: Array.isArray(utsgFootprints?.features) ? utsgFootprints.features : [],
  utsc: Array.isArray(utscFootprints?.features) ? utscFootprints.features : [],
};

function universityFootprints(dataset) {
  return (dataset?.buildings || [])
    .filter((b) => b.geometry)
    .map(universityBuildingFootprint);
}

function universityBuildings(dataset, campusId) {
  return (dataset?.buildings || []).map((building) => {
    const feature = universityBuildingFootprint(building);
    const features = feature ? [feature] : [];
    const code = building.nativeCodes?.[0] || building.id.toUpperCase();
    const entrances = (dataset.entrances || []).filter(
      (e) => e.buildingId === building.id,
    );
    return {
      code,
      name: building.name,
      aliases: building.aliases ?? [],
      timetableCodes: building.nativeCodes ?? [],
      campus: campusId,
      source: "canonical",
      canonicalId: building.id,
      features,
      entranceCount: entrances.length,
      geometryStatus: feature ? "mapped" : "unresolved",
    };
  });
}

function universityEntrances(dataset) {
  const buildingById = new Map(
    (dataset?.buildings || []).map((b) => [b.id, b]),
  );
  return (dataset?.entrances || []).map((entrance) => {
    const building = buildingById.get(entrance.buildingId);
    return {
      type: "Feature",
      id: entrance.id,
      properties: {
        id: entrance.id,
        buildingId: entrance.buildingId,
        buildingCode: building?.nativeCodes?.[0] || entrance.buildingId,
        buildingName: building?.name || entrance.buildingId,
        access: entrance.access,
      },
      geometry: { type: "Point", coordinates: entrance.coordinate },
    };
  });
}

const CARLETON_FOOTPRINTS = universityFootprints(carletonCampus);
const TMU_FOOTPRINTS = universityFootprints(tmuCampus);
const QUEENS_FOOTPRINTS = universityFootprints(queensCampus);
const LAURIER_FOOTPRINTS = universityFootprints(laurierCampus);
const YORK_FOOTPRINTS = universityFootprints(yorkCampus);
const MCMASTER_FOOTPRINTS = universityFootprints(mcmasterCampus);
const WESTERN_FOOTPRINTS = universityFootprints(westernCampus);
const GUELPH_FOOTPRINTS = universityFootprints(guelphCampus);
const UOTTAWA_FOOTPRINTS = universityFootprints(uottawaCampus);
const BROCK_FOOTPRINTS = universityFootprints(brockCampus);
const UBC_FOOTPRINTS = universityFootprints(ubcCampus);
const WATERLOO_FOOTPRINTS = universityFootprints(waterlooCampus);
const MCGILL_FOOTPRINTS = universityFootprints(mcgillCampus);

function importedBuildingsForCampus(campusId) {
  const registry = TRI_CAMPUS_REGISTRIES[campusId];
  const footprints = TRI_CAMPUS_FOOTPRINTS[campusId] ?? [];
  if (!registry?.buildings) return [];

  const featuresByBuildingId = new Map();
  for (const feature of footprints) {
    const buildingId = feature?.properties?.buildingId ?? feature?.id;
    if (!buildingId) continue;
    const current = featuresByBuildingId.get(buildingId) ?? [];
    current.push(feature);
    featuresByBuildingId.set(buildingId, current);
  }

  return registry.buildings.map((building) => ({
    code: building.code,
    name: building.name,
    aliases: building.aliases ?? [],
    timetableCodes: building.timetableCodes ?? [],
    campus: campusId,
    source: "canonical",
    canonicalId: building.id,
    features: featuresByBuildingId.get(building.id) ?? [],
    entranceCount: 0,
    geometryStatus: featuresByBuildingId.has(building.id)
      ? "mapped"
      : "unresolved",
  }));
}

export const UNIVERSITIES = [
  {
    id: "uoft",
    name: "University of Toronto",
    shortName: "U of T",
    defaultCampus: "utm",
    campuses: [
      {
        id: "utm",
        name: "Mississauga",
        shortName: "UTM"
      },
      {
        id: "utsg",
        name: "St. George",
        shortName: "UTSG"
      },
      {
        id: "utsc",
        name: "Scarborough",
        shortName: "UTSC"
      }
    ]
  },
  {
    id: "carleton",
    name: "Carleton University",
    shortName: "Carleton",
    defaultCampus: "carleton",
    campuses: [
      {
        id: "carleton",
        name: "Carleton University main campus",
        shortName: "main campus"
      },
      {
        id: "carleton-dominion-chalmers",
        name: "Carleton Dominion-Chalmers Centre",
        shortName: "Carleton Dominion-Chalmers Centre"
      }
    ]
  },
  {
    id: "tmu",
    name: "Toronto Metropolitan University",
    shortName: "TMU",
    defaultCampus: "tmu",
    campuses: [
      {
        id: "tmu",
        name: "Toronto Metropolitan University campus",
        shortName: "campus"
      },
      {
        id: "tmu-brampton",
        name: "Toronto Metropolitan University Brampton Campus",
        shortName: "Brampton"
      }
    ]
  },
  {
    id: "queens",
    name: "Queen's University",
    shortName: "Queen's",
    defaultCampus: "queens",
    campuses: [
      {
        id: "queens",
        name: "Queen's University main campus",
        shortName: "main campus"
      },
      {
        id: "queens-west",
        name: "Queen's University West Campus",
        shortName: "West"
      }
    ]
  },
  {
    id: "laurier",
    name: "Wilfrid Laurier University",
    shortName: "Laurier",
    defaultCampus: "waterloo",
    campuses: [
      {
        id: "waterloo",
        name: "Wilfrid Laurier University Waterloo campus",
        shortName: "Waterloo campus"
      },
      {
        id: "laurier-brantford",
        name: "Wilfrid Laurier University Brantford Campus",
        shortName: "Brantford"
      },
      {
        id: "laurier-milton",
        name: "Wilfrid Laurier University Milton Campus",
        shortName: "Milton"
      }
    ]
  },
  {
    id: "york",
    name: "York University",
    shortName: "York",
    defaultCampus: "keele",
    campuses: [
      {
        id: "keele",
        name: "York University Keele campus",
        shortName: "Keele campus"
      },
      {
        id: "glendon",
        name: "York University Glendon Campus",
        shortName: "Glendon"
      },
      {
        id: "markham",
        name: "York University Markham Campus",
        shortName: "Markham"
      }
    ]
  },
  {
    id: "mcmaster",
    name: "McMaster University",
    shortName: "McMaster",
    defaultCampus: "mcmaster",
    campuses: [
      {
        id: "mcmaster",
        name: "McMaster University main campus",
        shortName: "main campus"
      },
      {
        id: "mcmaster-burlington",
        name: "McMaster University Ron Joyce Centre",
        shortName: "Ron Joyce Centre"
      }
    ]
  },
  {
    id: "western",
    name: "Western University",
    shortName: "Western",
    defaultCampus: "western",
    campuses: [
      {
        id: "western",
        name: "Western University main campus",
        shortName: "main campus"
      },
      {
        id: "western-huron",
        name: "Huron University College Campus",
        shortName: "Huron University College"
      },
      {
        id: "western-kings",
        name: "King's University College Campus",
        shortName: "King's University College"
      }
    ]
  },
  {
    id: "guelph",
    name: "University of Guelph",
    shortName: "Guelph",
    defaultCampus: "guelph",
    campuses: [
      {
        id: "guelph",
        name: "University of Guelph main campus",
        shortName: "main campus"
      },
      {
        id: "guelph-ridgetown",
        name: "University of Guelph Ridgetown Campus",
        shortName: "Ridgetown"
      },
      {
        id: "guelph-humber",
        name: "University of Guelph-Humber Campus",
        shortName: "-Humber"
      }
    ]
  },
  {
    id: "uottawa",
    name: "University of Ottawa",
    shortName: "uOttawa",
    defaultCampus: "uottawa",
    campuses: [
      {
        id: "uottawa",
        name: "University of Ottawa main campus",
        shortName: "main campus"
      },
      {
        id: "uottawa-alta-vista",
        name: "University of Ottawa Alta Vista Campus",
        shortName: "Alta Vista"
      }
    ]
  },
  {
    id: "brock",
    name: "Brock University",
    shortName: "Brock",
    defaultCampus: "brock",
    campuses: [
      {
        id: "brock",
        name: "Brock University main campus",
        shortName: "main campus"
      },
      {
        id: "brock-miw",
        name: "Marilyn I. Walker School of Fine and Performing Arts Campus",
        shortName: "Marilyn I. Walker School of Fine and Performing Arts"
      }
    ]
  },
  {
    id: "ubc",
    name: "University of British Columbia",
    shortName: "UBC",
    defaultCampus: "ubc-vancouver",
    campuses: [
      {
        id: "ubc-vancouver",
        name: "UBC Vancouver Campus",
        shortName: "UBC Vancouver"
      },
      {
        id: "ubc-okanagan",
        name: "UBC Okanagan Campus",
        shortName: "UBC Okanagan"
      }
    ]
  },
  {
    id: "waterloo",
    name: "University of Waterloo",
    shortName: "Waterloo",
    defaultCampus: "waterloo-main",
    campuses: [
      {
        id: "waterloo-main",
        name: "University of Waterloo main campus",
        shortName: "main campus"
      },
      {
        id: "waterloo-cambridge",
        name: "University of Waterloo Cambridge Campus",
        shortName: "Cambridge"
      },
      {
        id: "waterloo-kitchener",
        name: "University of Waterloo Kitchener Campus",
        shortName: "Kitchener"
      },
      {
        id: "waterloo-stratford",
        name: "University of Waterloo Stratford School",
        shortName: "Stratford School"
      }
    ]
  },
  {
    id: "mcgill",
    name: "McGill University",
    shortName: "McGill",
    defaultCampus: "mcgill-downtown",
    campuses: [
      {
        id: "mcgill-downtown",
        name: "McGill University downtown campus",
        shortName: "downtown campus"
      },
      {
        id: "mcgill-macdonald",
        name: "McGill University Macdonald Campus",
        shortName: "Macdonald"
      }
    ]
  },
  {
    id: "cmu",
    name: "Carnegie Mellon University",
    shortName: "CMU",
    defaultCampus: "cmu-pittsburgh",
    campuses: [
      {
        id: "cmu-pittsburgh",
        name: "Carnegie Mellon University Pittsburgh Campus",
        shortName: "Pittsburgh"
      },
      {
        id: "cmu-silicon-valley",
        name: "Carnegie Mellon University Silicon Valley Campus",
        shortName: "Silicon Valley"
      }
    ]
  },
  {
    id: "ucberkeley",
    name: "University of California, Berkeley",
    shortName: "UC Berkeley",
    defaultCampus: "ucberkeley-main",
    campuses: [
      {
        id: "ucberkeley-main",
        name: "University of California, Berkeley Campus",
        shortName: "University of California, Berkeley Campus"
      },
      {
        id: "ucberkeley-richmond",
        name: "UC Berkeley Richmond Field Station",
        shortName: "UC Berkeley Richmond Field Station"
      }
    ]
  },
  {
    id: "nyu",
    name: "New York University",
    shortName: "NYU",
    defaultCampus: "nyu-washington-square",
    campuses: [
      {
        id: "nyu-washington-square",
        name: "New York University Washington Square Campus",
        shortName: "Washington Square"
      },
      {
        id: "nyu-brooklyn",
        name: "New York University Brooklyn Campus",
        shortName: "Brooklyn"
      }
    ]
  },
  {
    id: "mit",
    name: "Massachusetts Institute of Technology",
    shortName: "MIT",
    defaultCampus: "mit-cambridge",
    campuses: [
      {
        id: "mit-cambridge",
        name: "Massachusetts Institute of Technology Cambridge Campus",
        shortName: "Cambridge"
      },
      {
        id: "mit-lincoln-lab",
        name: "MIT Lincoln Laboratory Campus",
        shortName: "MIT Lincoln Laboratory"
      }
    ]
  },
  {
    id: "stanford",
    name: "Stanford University",
    shortName: "Stanford",
    defaultCampus: "stanford-main",
    campuses: [
      {
        id: "stanford-main",
        name: "Stanford University Main Campus",
        shortName: "Main"
      },
      {
        id: "stanford-redwood-city",
        name: "Stanford Redwood City Campus",
        shortName: "Stanford Redwood City"
      }
    ]
  },
  {
    id: "upenn",
    name: "University of Pennsylvania",
    shortName: "Penn",
    defaultCampus: "upenn-philadelphia",
    campuses: [
      {
        id: "upenn-philadelphia",
        name: "University of Pennsylvania Philadelphia Campus",
        shortName: "Philadelphia"
      },
      {
        id: "upenn-pennovation",
        name: "Pennovation Works Campus",
        shortName: "Pennovation Works"
      },
      {
        id: "upenn-new-bolton",
        name: "University of Pennsylvania New Bolton Center",
        shortName: "New Bolton Center"
      }
    ]
  },
  {
    id: "cornell",
    name: "Cornell University",
    shortName: "Cornell",
    defaultCampus: "cornell-ithaca",
    campuses: [
      {
        id: "cornell-ithaca",
        name: "Cornell University Ithaca Campus",
        shortName: "Ithaca"
      },
      {
        id: "cornell-tech",
        name: "Cornell Tech Campus",
        shortName: "Cornell Tech"
      },
      {
        id: "cornell-weill",
        name: "Weill Cornell Medicine Campus",
        shortName: "Weill Cornell Medicine"
      }
    ]
  },
  {
    id: "dartmouth",
    name: "Dartmouth College",
    shortName: "Dartmouth",
    defaultCampus: "dartmouth-hanover",
    campuses: [
      {
        id: "dartmouth-hanover",
        name: "Dartmouth College Hanover Campus",
        shortName: "Hanover"
      },
      {
        id: "dartmouth-lebanon",
        name: "Dartmouth Health Lebanon Campus",
        shortName: "Dartmouth Health Lebanon"
      }
    ]
  },
  {
    id: "brown",
    name: "Brown University",
    shortName: "Brown",
    defaultCampus: "brown-providence",
    campuses: [
      {
        id: "brown-providence",
        name: "Brown University College Hill Campus",
        shortName: "College Hill"
      },
      {
        id: "brown-jewelry-district",
        name: "Brown University Jewelry District Campus",
        shortName: "Jewelry District"
      }
    ]
  },
  {
    id: "columbia",
    name: "Columbia University",
    shortName: "Columbia",
    defaultCampus: "columbia-morningside",
    campuses: [
      {
        id: "columbia-morningside",
        name: "Columbia University Morningside Campus",
        shortName: "Morningside"
      },
      {
        id: "columbia-manhattanville",
        name: "Columbia University Manhattanville Campus",
        shortName: "Manhattanville"
      },
      {
        id: "columbia-cuimc",
        name: "Columbia University Irving Medical Center Campus",
        shortName: "Irving Medical Center"
      }
    ]
  },
  {
    id: "princeton",
    name: "Princeton University",
    shortName: "Princeton",
    defaultCampus: "princeton-main",
    campuses: [
      {
        id: "princeton-main",
        name: "Princeton University Main Campus",
        shortName: "Main"
      },
      {
        id: "princeton-forrestal",
        name: "Princeton University Forrestal Campus",
        shortName: "Forrestal"
      },
      {
        id: "princeton-meadows",
        name: "Princeton University Meadows Campus",
        shortName: "Meadows"
      }
    ]
  },
  {
    id: "yale",
    name: "Yale University",
    shortName: "Yale",
    defaultCampus: "yale-new-haven",
    campuses: [
      {
        id: "yale-new-haven",
        name: "Yale University Central Campus",
        shortName: "Central"
      },
      {
        id: "yale-medical",
        name: "Yale School of Medicine Campus",
        shortName: "Yale School of Medicine"
      },
      {
        id: "yale-west",
        name: "Yale University West Campus",
        shortName: "West"
      }
    ]
  },
  {
    id: "harvard",
    name: "Harvard University",
    shortName: "Harvard",
    defaultCampus: "harvard-cambridge",
    campuses: [
      {
        id: "harvard-cambridge",
        name: "Harvard University Cambridge Campus",
        shortName: "Cambridge"
      },
      {
        id: "harvard-allston",
        name: "Harvard University Allston Campus",
        shortName: "Allston"
      },
      {
        id: "harvard-longwood",
        name: "Harvard Longwood Medical Area Campus",
        shortName: "Harvard Longwood Medical Area"
      }
    ]
  },
  {
    id: "sorbonne",
    name: "Sorbonne Université",
    shortName: "Sorbonne",
    defaultCampus: "sorbonne-pierre-et-marie-curie",
    campuses: [
      {
        id: "sorbonne-pierre-et-marie-curie",
        name: "Sorbonne Université Campus Pierre et Marie Curie",
        shortName: "Pierre et Marie Curie",
      },
      {
        id: "sorbonne-sorbonne",
        name: "Sorbonne Université Campus Sorbonne",
        shortName: "Sorbonne historique",
      },
      {
        id: "sorbonne-pitie-salpetriere",
        name: "Sorbonne Université Campus Pitié-Salpêtrière",
        shortName: "Pitié-Salpêtrière",
      },
      {
        id: "sorbonne-saint-antoine",
        name: "Sorbonne Université Campus Saint-Antoine",
        shortName: "Saint-Antoine",
      },
      {
        id: "sorbonne-cordeliers",
        name: "Sorbonne Université Campus des Cordeliers",
        shortName: "Cordeliers",
      },
      {
        id: "sorbonne-clignancourt",
        name: "Sorbonne Université Campus Clignancourt",
        shortName: "Clignancourt",
      },
      {
        id: "sorbonne-malesherbes",
        name: "Sorbonne Université Campus Malesherbes",
        shortName: "Malesherbes",
      },
    ],
  },
];

const UNIVERSITY_DATASETS = new Map();

for (const university of UNIVERSITIES) {
  if (university.id === "uoft") continue;
  for (const campus of university.campuses) {
    const subcampusPath = `../universities/${university.id}/campuses/${campus.id}/campus.json`;
    const primaryPath = `../universities/${university.id}/campus.json`;
    const dataset =
      universityCampusModules[subcampusPath] ??
      (campus.id === university.defaultCampus ? universityCampusModules[primaryPath] : undefined);
    if (dataset) UNIVERSITY_DATASETS.set(campus.id, dataset);
  }
}

export const CAMPUSES = {
  utm: {
    id: "utm",
    universityId: "uoft",
    shortName: "UTM",
    name: "University of Toronto Mississauga",
    bounds: boundsFromFeatures(utmFootprintFeatures, UTM_FALLBACK),
    tileZoom: 17,
  },
  utsg: {
    id: "utsg",
    universityId: "uoft",
    shortName: "UTSG",
    name: "University of Toronto St. George",
    bounds: boundsFromFeatures(TRI_CAMPUS_FOOTPRINTS.utsg, UTSG_FALLBACK),
    tileZoom: 16,
  },
  utsc: {
    id: "utsc",
    universityId: "uoft",
    shortName: "UTSC",
    name: "University of Toronto Scarborough",
    bounds: boundsFromFeatures(TRI_CAMPUS_FOOTPRINTS.utsc, UTSC_FALLBACK),
    tileZoom: 16,
  },
  carleton: {
    id: "carleton",
    universityId: "carleton",
    shortName: "Carleton",
    name: "Carleton University",
    bounds: boundsFromFeatures(CARLETON_FOOTPRINTS, CARLETON_FALLBACK),
    tileZoom: 16,
  },
  tmu: {
    id: "tmu",
    universityId: "tmu",
    shortName: "TMU",
    name: "Toronto Metropolitan University",
    bounds: boundsFromFeatures(TMU_FOOTPRINTS, TMU_FALLBACK),
    tileZoom: 17,
  },
  queens: {
    id: "queens",
    universityId: "queens",
    shortName: "Queen's",
    name: "Queen's University",
    bounds: boundsFromFeatures(QUEENS_FOOTPRINTS, QUEENS_FALLBACK),
    tileZoom: 16,
  },
  laurier: {
    id: "laurier",
    universityId: "laurier",
    shortName: "Laurier",
    name: "Wilfrid Laurier University",
    bounds: boundsFromFeatures(LAURIER_FOOTPRINTS, LAURIER_FALLBACK),
    tileZoom: 17,
  },
  york: {
    id: "york",
    universityId: "york",
    shortName: "York",
    name: "York University (Keele Campus)",
    bounds: boundsFromFeatures(YORK_FOOTPRINTS, YORK_FALLBACK),
    tileZoom: 16,
  },
  mcmaster: {
    id: "mcmaster",
    universityId: "mcmaster",
    shortName: "McMaster",
    name: "McMaster University",
    bounds: boundsFromFeatures(MCMASTER_FOOTPRINTS, MCMASTER_FALLBACK),
    tileZoom: 16,
  },
  western: {
    id: "western",
    universityId: "western",
    shortName: "Western",
    name: "Western University",
    bounds: boundsFromFeatures(WESTERN_FOOTPRINTS, WESTERN_FALLBACK),
    tileZoom: 16,
  },
  guelph: {
    id: "guelph",
    universityId: "guelph",
    shortName: "Guelph",
    name: "University of Guelph",
    bounds: boundsFromFeatures(GUELPH_FOOTPRINTS, GUELPH_FALLBACK),
    tileZoom: 16,
  },
  uottawa: {
    id: "uottawa",
    universityId: "uottawa",
    shortName: "uOttawa",
    name: "University of Ottawa",
    bounds: boundsFromFeatures(UOTTAWA_FOOTPRINTS, UOTTAWA_FALLBACK),
    tileZoom: 16,
  },
  brock: {
    id: "brock",
    universityId: "brock",
    shortName: "Brock",
    name: "Brock University",
    bounds: boundsFromFeatures(BROCK_FOOTPRINTS, BROCK_FALLBACK),
    tileZoom: 16,
  },
  "ubc-vancouver": {
    id: "ubc-vancouver",
    universityId: "ubc",
    shortName: "UBC Vancouver",
    name: "University of British Columbia Vancouver Campus",
    bounds: boundsFromFeatures(UBC_FOOTPRINTS, {
      minLon: ubcCampus.campus.bounds[0][0],
      maxLon: ubcCampus.campus.bounds[1][0],
      minLat: ubcCampus.campus.bounds[0][1],
      maxLat: ubcCampus.campus.bounds[1][1],
    }),
    tileZoom: 15,
  },
  "waterloo-main": {
    id: "waterloo-main",
    universityId: "waterloo",
    shortName: "Waterloo",
    name: "University of Waterloo Main Campus",
    bounds: boundsFromFeatures(WATERLOO_FOOTPRINTS, {
      minLon: waterlooCampus.campus.bounds[0][0],
      maxLon: waterlooCampus.campus.bounds[1][0],
      minLat: waterlooCampus.campus.bounds[0][1],
      maxLat: waterlooCampus.campus.bounds[1][1],
    }),
    tileZoom: 16,
  },
  "mcgill-downtown": {
    id: "mcgill-downtown",
    universityId: "mcgill",
    shortName: "McGill Downtown",
    name: "McGill University Downtown Campus",
    bounds: boundsFromFeatures(MCGILL_FOOTPRINTS, {
      minLon: mcgillCampus.campus.bounds[0][0],
      maxLon: mcgillCampus.campus.bounds[1][0],
      minLat: mcgillCampus.campus.bounds[0][1],
      maxLat: mcgillCampus.campus.bounds[1][1],
    }),
    tileZoom: 16,
  },
};

for (const university of UNIVERSITIES) {
  for (const campus of university.campuses) {
    if (university.id === "uoft") continue;
    const dataset = UNIVERSITY_DATASETS.get(campus.id);
    if (!dataset) continue;
    const [[minLon, minLat], [maxLon, maxLat]] = dataset.campus.bounds;
    const footprints = universityFootprints(dataset);
    CAMPUSES[campus.id] = {
      id: campus.id,
      universityId: university.id,
      shortName: campus.shortName,
      name: campus.name,
      bounds: boundsFromFeatures(footprints, { minLon, maxLon, minLat, maxLat }),
      tileZoom: 16,
    };
  }
}

// Retire the pre-registry aliases now that the real Keele and Laurier Waterloo IDs
// are first-class contribution targets.
delete CAMPUSES.york;
delete CAMPUSES.laurier;

export const CAMPUS_IDS = Object.keys(CAMPUSES);

export function campusFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const requestedCampus = params.get("campus")?.toLowerCase();
  const requestedUni = params.get("university")?.toLowerCase();
  if (requestedCampus) {
    if (CAMPUSES[requestedCampus]) return requestedCampus;
    if (requestedCampus === "ubc") return "ubc-vancouver";
    if (requestedCampus === "mcgill") return "mcgill-downtown";
  }
  if (requestedUni) {
    const uni = UNIVERSITIES.find((u) => u.id === requestedUni);
    if (uni) return uni.defaultCampus;
  }
  return "utm";
}

export function universityForCampus(campusId) {
  return CAMPUSES[campusId]?.universityId || "uoft";
}

export function canonicalBuildingsForCampus(campusId) {
  if (campusId === "utm") {
    return utmBuildings.map((building) => ({
      ...building,
      source: "canonical",
      campus: "utm",
    }));
  }
  if (campusId === "utsg" || campusId === "utsc") {
    return importedBuildingsForCampus(campusId);
  }
  return universityBuildings(UNIVERSITY_DATASETS.get(campusId), campusId);
}

export function canonicalFootprintsForCampus(campusId) {
  if (campusId === "utm") return utmFootprintFeatures;
  if (campusId === "utsg" || campusId === "utsc")
    return TRI_CAMPUS_FOOTPRINTS[campusId] ?? [];
  return universityFootprints(UNIVERSITY_DATASETS.get(campusId));
}

export function canonicalEntrancesForCampus(campusId) {
  if (campusId === "utm") return utmEntranceFeatures;
  if (campusId === "utsg" || campusId === "utsc") return [];
  return universityEntrances(UNIVERSITY_DATASETS.get(campusId));
}

export function createCampusProjection(campusId) {
  const campus = CAMPUSES[campusId] ?? CAMPUSES.utm;
  const { bounds } = campus;
  const middleLatitude = (bounds.minLat + bounds.maxLat) / 2;
  const longitudeScale = Math.cos((middleLatitude * Math.PI) / 180);
  const projectedWidth = (bounds.maxLon - bounds.minLon) * longitudeScale;
  const projectedHeight = bounds.maxLat - bounds.minLat;
  const canvasWidth = MAP_WIDTH - MAP_PADDING * 2;
  const canvasHeight = MAP_HEIGHT - MAP_PADDING * 2;
  const campusAspect = projectedWidth / projectedHeight;
  const canvasAspect = canvasWidth / canvasHeight;
  const contentWidth =
    campusAspect > canvasAspect ? canvasWidth : canvasHeight * campusAspect;
  const contentHeight =
    campusAspect > canvasAspect ? canvasWidth / campusAspect : canvasHeight;
  const originX = (MAP_WIDTH - contentWidth) / 2;
  const originY = (MAP_HEIGHT - contentHeight) / 2;

  function project([longitude, latitude]) {
    const xRatio =
      ((longitude - bounds.minLon) * longitudeScale) / projectedWidth;
    const yRatio = (bounds.maxLat - latitude) / projectedHeight;
    return [originX + xRatio * contentWidth, originY + yRatio * contentHeight];
  }

  function unproject([x, y]) {
    const xRatio = (x - originX) / contentWidth;
    const yRatio = (y - originY) / contentHeight;
    return [
      bounds.minLon + (xRatio * projectedWidth) / longitudeScale,
      bounds.maxLat - yRatio * projectedHeight,
    ];
  }

  return {
    campus,
    project,
    unproject,
    originX,
    originY,
    contentWidth,
    contentHeight,
  };
}

function ringPath(ring, project) {
  return (
    ring
      .map((coordinate, index) => {
        const [x, y] = project(coordinate);
        return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ") + " Z"
  );
}

export function geometryPath(geometry, project) {
  if (!geometry) return "";
  if (geometry.type === "Polygon")
    return geometry.coordinates
      .map((ring) => ringPath(ring, project))
      .join(" ");
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates
      .flatMap((polygon) => polygon.map((ring) => ringPath(ring, project)))
      .join(" ");
  }
  if (geometry.type === "LineString") {
    return geometry.coordinates
      .map((coordinate, index) => {
        const [x, y] = project(coordinate);
        return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
  }
  return "";
}

export function geometryBounds(geometry, project, paddingFactor = 0.75) {
  let coordinates = [];
  if (geometry?.type === "Polygon") coordinates = geometry.coordinates.flat();
  if (geometry?.type === "MultiPolygon")
    coordinates = geometry.coordinates.flat(2);
  if (geometry?.type === "LineString") coordinates = geometry.coordinates;
  if (geometry?.type === "Point") coordinates = [geometry.coordinates];
  if (!coordinates.length)
    return { x: 0, y: 0, width: MAP_WIDTH, height: MAP_HEIGHT };
  const points = coordinates.map(project);
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rawWidth = Math.max(80, maxX - minX);
  const rawHeight = Math.max(80, maxY - minY);
  const pad = Math.max(rawWidth, rawHeight) * paddingFactor;
  return {
    x: Math.max(0, minX - pad),
    y: Math.max(0, minY - pad),
    width: Math.min(MAP_WIDTH, rawWidth + pad * 2),
    height: Math.min(MAP_HEIGHT, rawHeight + pad * 2),
  };
}

export function featureCenter(feature) {
  const coordinates = geometryCoordinates(feature?.geometry);
  if (!coordinates.length) return null;
  const sum = coordinates.reduce(
    (acc, [lon, lat]) => [acc[0] + lon, acc[1] + lat],
    [0, 0],
  );
  return [sum[0] / coordinates.length, sum[1] / coordinates.length];
}

function lonToTileX(lon, zoom) {
  return ((lon + 180) / 360) * 2 ** zoom;
}

function latToTileY(lat, zoom) {
  const radians = (lat * Math.PI) / 180;
  return (
    ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) *
    2 ** zoom
  );
}

function tileXToLon(x, zoom) {
  return (x / 2 ** zoom) * 360 - 180;
}

function tileYToLat(y, zoom) {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** zoom;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

export function tilesForCampus(campusId, project) {
  const campus = CAMPUSES[campusId] ?? CAMPUSES.utm;
  const zoom = campus.tileZoom;
  const { minLon, maxLon, minLat, maxLat } = campus.bounds;
  const minX = Math.floor(lonToTileX(minLon, zoom));
  const maxX = Math.floor(lonToTileX(maxLon, zoom));
  const minY = Math.floor(latToTileY(maxLat, zoom));
  const maxY = Math.floor(latToTileY(minLat, zoom));
  const tiles = [];
  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      const west = tileXToLon(x, zoom);
      const east = tileXToLon(x + 1, zoom);
      const north = tileYToLat(y, zoom);
      const south = tileYToLat(y + 1, zoom);
      const [left, top] = project([west, north]);
      const [right, bottom] = project([east, south]);
      tiles.push({
        key: `${zoom}/${x}/${y}`,
        href: `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`,
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
      });
    }
  }
  return tiles;
}

export function makeId(prefix = "draft") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export { metersBetween, todayLocalDate };
