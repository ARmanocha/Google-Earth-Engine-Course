# Google Earth Engine for Beginners — Landslides in the Polish Carpathians

A step-by-step course built around a **landslide study area in Poland**. Students start with no
programming or GEE experience and finish with landslide-focused maps of their own study area.

Every script is written for the **GEE Code Editor (JavaScript)**. **Every line of code is
explained** in a comment, and each script ends with *TRY IT YOURSELF* exercises.

---

## Folder contents

| # | File | Topic | Landslide focus |
|---|------|-------|-----------------|
| 0 | `Module1_Getting_Started/00_Setup_and_Code_Editor_Tour.md` | What GEE is, account + Cloud project, Code Editor tour | The study area, the 2010 event, Polish data sources |
| 1 | `Module1_Getting_Started/01_hello_earth_engine.js` | First script: print, map, layers, Inspector | DEM, hillshade and Sentinel-2 at Kłodne |
| 2 | `Module1_Getting_Started/02_javascript_basics.js` | Variables, lists, objects, functions, **client vs server**, `ee` types | Slope % ↔ degrees; dates around the 2010 landslide |
| 3 | `Module2_Working_with_Data/03_geometries_and_features.js` | Geometries, Features, FeatureCollections, admin boundaries | Sites, buffers, the voivodeship and its districts |
| 4 | `Module2_Working_with_Data/04_images_and_collections.js` | Filter by area/date/metadata, clip, mosaic vs median | Summer (leaf-on) image selection |
| 5 | `Module2_Working_with_Data/05_data_catalog_tour.js` | Landsat, Sentinel-1/2, MODIS, DEMs, ERA5-Land, WorldCover, CORINE, Dynamic World, JRC water | Slope, aspect, rainfall; why a 30 m DEM misses landslides |
| 6 | `Module2_Working_with_Data/06_assets_upload_and_export.js` | Upload shapefile/CSV/GeoTIFF; export to Drive/Assets | Landslide inventory (SOPO) and LiDAR DEM; exports in EPSG:2180 |
| 7 | `Module3_Image_Processing/07_cloud_masking_and_composites.js` | Cloud Score+, SCL, Landsat QA bits; composites | Polish seasons; summer composites |
| 8 | `Module3_Image_Processing/08_band_math_and_indices.js` | NDVI, EVI, SAVI, NDWI, MNDWI, NDBI, NBR, **BSI** | Bare ground on slopes > 15° (candidate scars) |
| 9 | `Module3_Image_Processing/09_functions_and_mapping.js` | Functions, `.map()`, monthly composites | Monthly MNDWI of the Rożnów Reservoir |
| 10 | `Module3_Image_Processing/10_reducers_and_zonal_statistics.js` | Reducers, area, grouped reducers, district zonal stats | Area of steep land; land cover on steep slopes; mean slope per district |
| 11 | `Module4_Analysis/11_time_series_and_charts.js` | Time series, multi-site charts, trend maps, click-to-chart | **Daily and cumulative rain before the June 2010 landslide** |
| 12 | `Module4_Analysis/12_supervised_classification.js` | RF / CART / SVM, confusion matrix, area, legend | Optional **susceptibility model** from your own inventory |
| 13 | `Module4_Analysis/13_change_detection.js` | Land-cover change, Landsat 2009→2010, Hansen loss, Sentinel-2 2019→2024 | **Landslide candidates** after 2010; new bare patches exported as polygons |
| 14 | `Final_Project/14_final_study_area_map.js` | **Final project template** with full map layout and outputs | Slope classes and a simple **susceptibility index** |
| – | `practice_data/field_sites_limanowa.csv` | 10 practice points for the asset-upload exercise | – |
| – | `web/earth_engine_for_beginners.html` | Course web page: browse, read and copy every script (built from the files above) | – |

---

## Course web page

`web/earth_engine_for_beginners.html` is a single-page site where students can browse the
lessons, read each script with line numbers and colour-coded code, and copy it with one click.
It also contains the setup guide, the schedule, the common-errors table and the practice CSV.

The page is **generated** from the scripts, so never edit it by hand. After changing any script,
the setup guide or the CSV, rebuild it:

```bash
python3 web/build.py
```

`web/build.py` reads `web/template.html` (layout, styles and page logic), embeds every lesson,
and writes `web/earth_engine_for_beginners.html`. It needs only Python 3, with no extra packages.
A lesson shows a **Slides** button when its deck link is added to `SLIDES` in `web/build.py`.

---

## Slide decks

This course has no slide decks yet, so the web page shows no Slides buttons. To add one, put the
deck link for that lesson in `SLIDES` in `web/build.py` and rebuild the page.

---

## Study area

All scripts use the same **area of interest (`aoi`)**:

```js
var aoi = ee.Geometry.Rectangle([20.25, 49.60, 20.80, 49.85]);
```

About 40 × 28 km of the **Beskid Wyspowy** mountains and the **Rożnów Reservoir** around
**Limanowa**, Małopolska (Lesser Poland), in the flysch Outer Carpathians. Over 95 % of Poland's
landslides are in the Carpathians. Elevation runs from about 265 m (the reservoir) to 1,170 m
(Mogielica), with forest, farmland on slopes, towns, rivers and a reservoir.

| Place | Lon, lat | Used for |
|---|---|---|
| Limanowa | 20.4228, 49.7064 | Main town |
| Kłodne | 20.5661, 49.6850 | Large landslide that started on 1 June 2010 |
| Rożnów Reservoir | 20.7144, 49.7322 | Water, reservoir level |
| Mogielica | 20.2767, 49.6552 | Highest summit, forest |
| Nowy Sącz | 20.7022, 49.6203 | City at the south edge |

Coordinates are village, town or lake centres from public gazetteers, not surveyed landslide
positions. The other points in the practice CSV (S06–S10) are for students to identify.

**To use another area**, change the `aoi` line at the top of a script. Most of the scripts
work anywhere in Poland. The Kłodne point and the 2010 dates in Scripts 11 and 13 are specific
to this area, so swap in a landslide event from the new area.

---

## Data choices in this edition

- **Rainfall: ERA5-Land, not CHIRPS.** CHIRPS only covers 50 °S – 50 °N, which misses most of
  Poland. ERA5-Land (`ECMWF/ERA5_LAND/DAILY_AGGR`, band `total_precipitation_sum`, in metres)
  covers the whole country from 1950. Its ~11 km pixels give area averages, so use IMGW-PIB
  station data for research.
- **The 2010 event uses Landsat 5 + 7.** Sentinel-2 starts in 2015–2017, so Script 13 Part B
  compares Landsat composites from Jul–Sep 2009 and Jul–Sep 2010.
- **Composites use summer (June–August)**, when trees are in leaf and there is no snow.
  Classification uses April–October.
- **Exports use EPSG:2180 (PUWG 1992)**, Poland's official coordinate system.
- **CORINE Land Cover 2018** is added to the catalog tour alongside WorldCover and Dynamic World.

### Polish data students can upload as assets

- **Landslide inventory:** SOPO (*System Osłony Przeciwosuwiskowej*), Polish Geological
  Institute (PIG-PIB), mapped at 1:10 000. View it on the PIG-PIB geoportal; the data are made
  available through the institute's Central Geological Archive. Check the terms of use.
- **LiDAR elevation models (1 m):** geoportal.gov.pl (GUGiK). A LiDAR hillshade shows landslide
  scarps that the 30 m SRTM cannot.
- **Official boundaries:** the national boundary register (PRG) from GUGiK.

---

## Suggested schedule (8 sessions × 2–3 hours)

| Session | Scripts | Outcome |
|---|---|---|
| 1 | 00, 01 | Everyone has a working account and has put a DEM and a satellite image on the map |
| 2 | 02, 03 | Can read and write basic code; can create and filter vector data |
| 3 | 04, 05, 06 | Can find and filter any dataset; can upload a landslide inventory and export results |
| 4 | 07, 08 | Can make cloud-free composites, indices and a bare-ground-on-slopes map |
| 5 | 09, 10 | Can write functions and measure steep land and land cover per district |
| 6 | 11 | Can chart rainfall before a landslide event and map NDVI trends |
| 7 | 12, 13 | Can classify land cover and detect landslide candidates |
| 8 | 14 | Final project: landslide maps of own study area + short presentation |

For a 3-day workshop: Day 1 = scripts 00–06, Day 2 = 07–11, Day 3 = 12–14.

---

## Notes for the instructor

- **Run each script yourself the day before class.** Datasets and the Code Editor occasionally
  change. Verify each dataset ID in the [Data Catalog](https://developers.google.com/earth-engine/datasets).
- **Candidates are not landslides.** Scripts 08, 13 and 14 find bare or newly cleared ground on
  slopes. Logging, quarries, forest roads, building sites and harvested fields look the same.
  Make students check candidates against the imagery, orthophotos and LiDAR hillshades.
- **The susceptibility index in Script 14 is a teaching tool**: a weighted sum of slope class and
  land cover with weights the student chooses. It is not an official hazard map. Compare it with
  the SOPO maps, and with the student's own inventory using the check in the side panel.
- **The optional model in Script 12 (Part 12)** needs a landslide inventory asset. It shows the
  idea of data-driven susceptibility; real studies add geology and LiDAR terrain factors.
- **Script 12 uses ESA WorldCover as ready-made training labels** so it runs for everyone
  instantly. In the final project, students should collect their own training data.
- **GAUL boundaries** (Scripts 03 and 10) are simplified. Scripts find the voivodeship with a
  point (`filterBounds`) so they do not depend on how names are spelled in the dataset.
- Heavy scripts (10, 12, 13, 14) may take 30–90 s to finish all Console outputs. If a student sees
  *"Computation timed out"* or *"User memory limit exceeded"*, increase `scale`, add
  `tileScale: 4`, or make the study area smaller.

---

## Common errors and fixes

| Error message | Usual cause | Fix |
|---|---|---|
| `... is not defined` | Typo in a variable name, or it was created further down | Check spelling and capitalisation; define before use |
| `Unexpected token` / red underline | Missing comma, bracket or quote; a decimal comma (`20,42`) | Count `( ) [ ] { }`; use a dot for decimals |
| Point appears in Saudi Arabia | Latitude and longitude swapped | Use `[longitude, latitude]`, e.g. `[20.42, 49.71]` |
| `Image.select: Pattern 'B8' did not match any bands` | Wrong band name for this dataset (e.g. Landsat uses `SR_B4`) | Print the image and read the band names |
| Empty composite / empty chart | Filters removed every image (dates, area, cloud %), or snow and clouds masked everything | Print `.size()` after each filter; use summer dates |
| `Too many pixels in the region` | Area too big for the chosen `scale` | Add `maxPixels: 1e13`, or use a coarser `scale` |
| `Computation timed out` | Interactive request too heavy | Use **Export** instead of `print`, coarser `scale`, `tileScale` |
| `User memory limit exceeded` | Very large reduction or sampling | Add `tileScale: 4` (or 8/16) |
| `Asset not found` / `permission denied` | Wrong asset path or asset not shared | Copy the exact path from the Assets tab; check sharing |
| Export task never starts | Task created but not run | Open **Tasks** tab and click **RUN** |
