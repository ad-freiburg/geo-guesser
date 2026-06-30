"use strict";

// Datasets are TSV files in this directory: two quoted columns, no header:
//   "name"<TAB>"WKT geometry (POLYGON or MULTIPOLYGON, coordinates lon lat)"
const DATASETS = [
  "germany-states.tsv",
  "austria-states.tsv",
  "switzerland-states.tsv",
  "us-states.tsv",
  "bayern-regbez.tsv",
];

const STYLE = { color: "#ffffff", weight: 1, fillColor: "#4a8fd6", fillOpacity: 0.65 };
const HOVER = { color: "#ffffff", weight: 1.5, fillColor: "#e8743b", fillOpacity: 0.85 };

// ---------------------------------------------------------------------------
// Map with a label-free base layer (CARTO "light_nolabels").
// ---------------------------------------------------------------------------
const map = L.map("map");
L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
  {
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    subdomains: "abcd",
    maxZoom: 19,
  }
).addTo(map);

const info = document.getElementById("info");

// ---------------------------------------------------------------------------
// Minimal WKT parser for POLYGON / MULTIPOLYGON.
// Returns Leaflet lat/lng nesting, always shaped as a MultiPolygon:
//   [ polygon, ... ]  where polygon = [ ring, ... ]  and ring = [ [lat,lng], ... ]
// (L.polygon accepts this nesting directly, holes included.)
// ---------------------------------------------------------------------------
function extractGroups(s) {
  // Content of every top-level (...) group in `s`, respecting nesting.
  const groups = [];
  let depth = 0, start = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "(") { if (depth === 0) start = i + 1; depth++; }
    else if (c === ")") { depth--; if (depth === 0) groups.push(s.slice(start, i)); }
  }
  return groups;
}

function ringFromCoords(s) {
  return s.split(",").map((pair) => {
    const [lng, lat] = pair.trim().split(/\s+/).map(Number); // WKT is "lon lat"
    return [lat, lng];                                        // Leaflet wants [lat, lng]
  });
}

function parseWKT(wkt) {
  const isMulti = /^\s*MULTIPOLYGON/i.test(wkt);
  const body = wkt.slice(wkt.indexOf("("));                  // outermost "(...)"
  const inner = body.slice(1, body.lastIndexOf(")"));        // strip outermost parens
  if (isMulti) {
    // inner = "((ring),(hole)),((ring))" -> one group per polygon
    return extractGroups(inner).map((poly) => extractGroups(poly).map(ringFromCoords));
  }
  // inner = "(ring),(hole)" -> a single polygon's rings
  return [extractGroups(inner).map(ringFromCoords)];
}

// ---------------------------------------------------------------------------
// TSV parsing: each line is  "name"\t"wkt"  (surrounding quotes stripped).
// ---------------------------------------------------------------------------
function parseTSV(text) {
  const rows = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const tab = line.indexOf("\t");
    if (tab < 0) continue;
    const unquote = (s) => s.trim().replace(/^"/, "").replace(/"$/, "");
    rows.push({ name: unquote(line.slice(0, tab)), wkt: unquote(line.slice(tab + 1)) });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Load and draw a dataset.
// ---------------------------------------------------------------------------
let layer = null;

function resetInfo() {
  info.innerHTML = '<span class="hint">Click a region to see its name</span>';
}

async function load(file) {
  if (layer) { map.removeLayer(layer); layer = null; }
  resetInfo();

  let text;
  try {
    const resp = await fetch(file);
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    text = await resp.text();
  } catch (e) {
    info.textContent = "Failed to load " + file + " (" + e.message + ")";
    return;
  }

  layer = L.layerGroup();
  for (const { name, wkt } of parseTSV(text)) {
    let latlngs;
    try {
      latlngs = parseWKT(wkt);
    } catch (e) {
      console.warn("Could not parse geometry for", name, e);
      continue;
    }
    const poly = L.polygon(latlngs, STYLE);
    poly.on("mouseover", () => { poly.setStyle(HOVER); poly.bringToFront(); });
    poly.on("mouseout", () => { poly.setStyle(STYLE); });
    poly.on("click", () => { info.textContent = name; });
    poly.addTo(layer);
  }
  layer.addTo(map);

  // Zoom to the drawn geometries.
  const bounds = L.latLngBounds([]);
  layer.eachLayer((l) => bounds.extend(l.getBounds()));
  if (bounds.isValid()) map.fitBounds(bounds, { padding: [20, 20] });
}

// ---------------------------------------------------------------------------
// Dataset picker (upper right). Default: germany-states.tsv, or ?file=...
// ---------------------------------------------------------------------------
const picker = document.getElementById("picker");
for (const d of DATASETS) {
  const opt = document.createElement("option");
  opt.value = d;
  opt.textContent = d.replace(/\.tsv$/, "");
  picker.appendChild(opt);
}
const requested = new URLSearchParams(location.search).get("file");
picker.value = DATASETS.includes(requested) ? requested : "germany-states.tsv";
picker.addEventListener("change", () => load(picker.value));

load(picker.value);
