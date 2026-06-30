# geo-guesser

A minimal Leaflet web app that draws region geometries from a TSV file on a
label-free map.

## Data format

Each `*-states.tsv` (and similar) file has two **quoted, tab-separated** columns,
no header:

```
"name"<TAB>"WKT geometry"
```

The geometry is `POLYGON((...))` or `MULTIPOLYGON(((...)))` with coordinates in
`lon lat` (WGS84) order.

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
  TSV loading, and the hover/click interactions.
