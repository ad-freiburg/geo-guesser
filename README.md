# geo-guesser

A minimal Leaflet web app that draws region geometries from a TSV file on a
label-free map.

## Data format

Datasets live in the [`datasets/`](datasets/) directory. Each `*.tsv` file there
has two **quoted, tab-separated** columns, no header:

```
"name"<TAB>"WKT geometry"
```

The geometry is `POLYGON((...))` or `MULTIPOLYGON(((...)))` with coordinates in
`lon lat` (WGS84) order. Each dataset's SPARQL query is the sibling `*.rq` file
(endpoint <https://qlever.dev/api/osm-planet>).

The picker is **not** hard-coded: `app.js` derives the list from the directory
listing the static server returns for `datasets/`, so dropping a new `.tsv`
in there makes it appear automatically.

## Run

`fetch()` needs HTTP (not `file://`), so serve the directory statically:

```bash
cd /local/data-ssd/bast/geo-guesser
python3 -m http.server 8077
```

Then open <http://localhost:8077/> (or `http://<host>:8077/`).

## Behavior

- Draws every geometry from the selected dataset.
- **Hover** a region → it highlights in a different color.
- **Click** a region → its name appears in the upper-left box.
- Base map has **no labels** (CARTO `light_nolabels` tiles).
- Dataset picker (upper right) switches files; `?file=us-states.tsv` also works.

## Files

- `index.html` — page + styles, loads Leaflet from the CDN.
- `app.js` — map setup, a small self-contained WKT (POLYGON/MULTIPOLYGON) parser,
  dataset discovery, TSV loading, and the hover/click interactions.
- `datasets/` — the `*.tsv` data files and their `*.rq` SPARQL queries.
