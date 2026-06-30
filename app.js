"use strict";

// Datasets are TSV files in the `datasets/` directory: two quoted columns, no
// header:  "name"<TAB>"WKT geometry (POLYGON or MULTIPOLYGON, coordinates lon lat)"
//
// The list is NOT hard-coded: it is derived at runtime from the directory
// listing that the static file server returns for `datasets/`, so adding a new
// .tsv there makes it show up in the picker with no change to this file.
const DATASETS_DIR = "datasets/";

// Fetch `datasets/` and pull the .tsv file names out of its autoindex HTML.
async function listDatasets() {
  const resp = await fetch(DATASETS_DIR);
  if (!resp.ok) throw new Error("HTTP " + resp.status);
  const doc = new DOMParser().parseFromString(await resp.text(), "text/html");
  const names = [...doc.querySelectorAll("a[href]")]
    .map((a) => decodeURIComponent(a.getAttribute("href").split("/").pop()))
    .filter((name) => name.endsWith(".tsv"));
  return [...new Set(names)].sort();
}

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
    const resp = await fetch(DATASETS_DIR + file);
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
// Dataset picker (upper right). Options come from the datasets/ listing.
// Default: germany-states.tsv if present, else the first one; ?file= overrides.
// ---------------------------------------------------------------------------
const picker = document.getElementById("picker");

async function init() {
  let datasets;
  try {
    datasets = await listDatasets();
  } catch (e) {
    info.textContent = "Could not list " + DATASETS_DIR + " (" + e.message + ")";
    return;
  }
  if (!datasets.length) {
    info.textContent = "No .tsv datasets found in " + DATASETS_DIR;
    return;
  }
  for (const d of datasets) {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = d.replace(/\.tsv$/, "");
    picker.appendChild(opt);
  }
  const requested = new URLSearchParams(location.search).get("file");
  picker.value = datasets.includes(requested)
    ? requested
    : datasets.includes("germany-states.tsv") ? "germany-states.tsv" : datasets[0];
  picker.addEventListener("change", () => load(picker.value));
  load(picker.value);
}

init();
