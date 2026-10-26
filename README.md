# Google Earth Engine for Beginners — Course Scripts

A step-by-step course that takes students with **no programming or GEE experience** through to
complete remote-sensing workflows, ending with a map of their own study area.

Every script is written for the **GEE Code Editor (JavaScript)**. **Every line of code is
explained** in a comment, and each script ends with *TRY IT YOURSELF* exercises.

**Another edition:** [`Poland_Landslides/`](Poland_Landslides/README.md) is the same course
rebuilt around landslides in the Polish Carpathians (Limanowa and the Rożnów Reservoir), with
ERA5-Land rainfall, a 2010 landslide event, and a susceptibility map in the final project.

---

## Folder contents

| # | File | Topic | Key functions |
|---|------|-------|---------------|
| 0 | `Module1_Getting_Started/00_Setup_and_Code_Editor_Tour.md` | What GEE is, account + Cloud project, Code Editor tour | – |
| 1 | `Module1_Getting_Started/01_hello_earth_engine.js` | First script: print, map, layers, Inspector | `print`, `Map.addLayer`, `ee.Image` |
| 2 | `Module1_Getting_Started/02_javascript_basics.js` | Variables, lists, objects, functions, **client vs server**, `ee.Number/List/Date` | `ee.List.sequence`, `.map`, `.evaluate` |
| 3 | `Module2_Working_with_Data/03_geometries_and_features.js` | Geometries, Features, FeatureCollections, admin boundaries | `ee.Geometry.*`, `ee.Filter.*`, `.buffer`, `.area` |
| 4 | `Module2_Working_with_Data/04_images_and_collections.js` | Images vs collections, filter by area/date/metadata, clip, mosaic vs median | `filterBounds`, `filterDate`, `ee.Filter.lt`, `.clip` |
| 5 | `Module2_Working_with_Data/05_data_catalog_tour.js` | Landsat, Sentinel-1/2, MODIS, DEMs, CHIRPS, ERA5, WorldCover, Dynamic World, JRC water | scale factors, `ee.Terrain` |
| 6 | `Module2_Working_with_Data/06_assets_upload_and_export.js` | Upload shapefile/CSV/GeoTIFF as assets; export to Drive/Assets | `Export.image.toDrive`, `Export.table.toDrive` |
| 7 | `Module3_Image_Processing/07_cloud_masking_and_composites.js` | Cloud Score+, SCL, Landsat QA bits; median/percentile/greenest; seasonal & annual composites | `linkCollection`, `bitwiseAnd`, `qualityMosaic` |
| 8 | `Module3_Image_Processing/08_band_math_and_indices.js` | NDVI, EVI, SAVI, NDWI, MNDWI, NDBI, NBR; thresholds; histogram | `normalizedDifference`, `expression`, `.where` |
| 9 | `Module3_Image_Processing/09_functions_and_mapping.js` | Writing functions, `.map()` on collections and lists, monthly composites | function factories, `ee.Algorithms.If` |
| 10 | `Module3_Image_Processing/10_reducers_and_zonal_statistics.js` | `reduceRegion`, combined & grouped reducers, area per class, district zonal stats, choropleth | `reduceRegions`, `pixelArea`, `.group` |
| 11 | `Module4_Analysis/11_time_series_and_charts.js` | NDVI time series, multi-site charts, day-of-year charts, monthly rainfall, trend maps, click-to-chart | `ui.Chart.image.*`, `linearFit`, `sensSlope` |
| 12 | `Module4_Analysis/12_supervised_classification.js` | Training data, Random Forest / CART / SVM, confusion matrix, kappa, importance, area, legend | `stratifiedSample`, `ee.Classifier.*`, `errorMatrix` |
| 13 | `Module4_Analysis/13_change_detection.js` | Land-cover transitions, NDVI loss, Hansen forest loss, dNBR burn severity, MODIS burned area | `from*10+to`, `dNBR`, `MCD64A1` |
| 14 | `Final_Project/14_final_study_area_map.js` | **Final project template**: full workflow → map with title, legend, colour bar, inset, north arrow, statistics panel, PNG + GeoTIFF outputs | `ui.Panel`, `ui.Thumbnail`, `getThumbURL` |
| – | `practice_data/field_sites_mandi.csv` | 10 practice points for the asset-upload exercise | – |
| – | `web/earth_engine_for_beginners.html` | Course web page: browse, read and copy every script, and open each lesson's slides (built from the files above) | – |

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
Each lesson on the page has a **Slides** button that opens its slide deck; the links are set in
`SLIDES` in `web/build.py`.

---

## Slide decks

Every lesson has a slide deck that explains its script step by step, with highlighted code,
diagrams, exercises, a recap and speaker notes for the instructor.

| # | Lesson | Slides |
|---|--------|--------|
| 00 | Setting up Earth Engine | [Open deck](https://claude.ai/artifact/VHJ5FSC7x5HpHRynVTZ2bE) |
| 01 | Hello, Earth Engine | [Open deck](https://claude.ai/artifact/CpR7dGjLgWi7sXmaonDaUB) |
| 02 | JavaScript basics | [Open deck](https://claude.ai/artifact/19SWHHQMYCKhS9PchPACNn) |
| 03 | Geometries and features | [Open deck](https://claude.ai/artifact/RcEQykiqSBUeu4FxhZTYgA) |
| 04 | Images and collections | [Open deck](https://claude.ai/artifact/EFi9EFTSMED7uy6KJKopt6) |
| 05 | Data catalog tour | [Open deck](https://claude.ai/artifact/Y42UTBZJaeH1NbVQQu5kE1) |
| 06 | Assets and exports | [Open deck](https://claude.ai/artifact/6wvNzEB2q1qiuxKLmc5WXw) |
| 07 | Cloud masking and composites | [Open deck](https://claude.ai/artifact/EvJQqVtdBPYotSdCb4RgGE) |
| 08 | Band math and indices | [Open deck](https://claude.ai/artifact/9GmbFFLH57PakkcAK6Yapn) |
| 09 | Functions and mapping | [Open deck](https://claude.ai/artifact/7NK7SvK1WmGwe3txZDhMJV) |
| 10 | Reducers and zonal statistics | [Open deck](https://claude.ai/artifact/U7StN2tAg9weBhhYbWGSV5) |
| 11 | Time series and charts | [Open deck](https://claude.ai/artifact/Su77TzeVXXjkjRerf6Mo1B) |
| 12 | Supervised classification | [Open deck](https://claude.ai/artifact/1NBJ7RnqGsnckzqWUVfTZR) |
| 13 | Change detection | [Open deck](https://claude.ai/artifact/NHN25rtbKtQhqoARszxnEp) |
| 14 | Final project map | [Open deck](https://claude.ai/artifact/3JCenbTZjTHYcqbmKkyLxF) |

The decks are private until shared: open each one and use its **Share** menu before giving the
link to students. Each deck can also be downloaded as PPTX or PDF for offline teaching. Numbers
shown as examples on the slides (for instance the confusion matrix in deck 12) are for teaching,
not real results.

---

## Default study area

All scripts use the same **area of interest (`aoi`)**: a ~50 × 45 km rectangle around **Mandi,
Himachal Pradesh, India** (Mandi town, Prashar Lake, Rewalsar Lake, Pandoh reservoir, Balh valley).
It has forests, farmland, a town, rivers and lakes, and an elevation range of roughly 600–3,000 m,
which suits every exercise.

**To use another area**, change one line at the top of a script:

```js
var aoi = ee.Geometry.Rectangle([west, south, east, north]);
```

Script 13 Part C uses the **2021 Dixie Fire (California)** as a burned-area example, because it is
large and well documented. Students can swap in a fire from their own region.

---

## Suggested schedule (8 sessions × 2–3 hours)

| Session | Scripts | Outcome |
|---|---|---|
| 1 | 00, 01 | Everyone has a working account and has put a satellite image on the map |
| 2 | 02, 03 | Can read and write basic code; can create and filter vector data |
| 3 | 04, 05, 06 | Can find, filter and visualise any dataset; can upload and export data |
| 4 | 07, 08 | Can make cloud-free composites and spectral indices |
| 5 | 09, 10 | Can write functions, map over collections and calculate statistics |
| 6 | 11 | Can build time series, charts and trend maps |
| 7 | 12, 13 | Can classify land cover, assess accuracy and detect change |
| 8 | 14 | Final project: map of own study area + short presentation |

For a 3-day workshop: Day 1 = scripts 00–06, Day 2 = 07–11, Day 3 = 12–14.

---

## Notes for the instructor

- **Run each script yourself the day before class.** Datasets and the Code Editor occasionally
  change. Every dataset ID used is listed in Script 05 and should be verified in the
  [Data Catalog](https://developers.google.com/earth-engine/datasets).
- **Cloud masking uses Cloud Score+** (`GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED`), which is the
  current recommended approach for Sentinel-2. The SCL method is shown for comparison.
- **Script 12 uses ESA WorldCover as ready-made training labels** so it runs for everyone
  instantly. Make clear that this is for practice; in the final project students should
  collect their own training data (instructions are in Script 12, Part 2B).
- **Script 10 uses FAO GAUL boundaries.** These are simplified and not official boundaries; for
  published maps, use official boundary files uploaded as assets.
- Heavy scripts (10, 12, 13, 14) may take 30–90 s to finish all Console outputs. If a student sees
  *"Computation timed out"* or *"User memory limit exceeded"*, increase `scale`, add
  `tileScale: 4`, or make the study area smaller.
- Share the scripts with a **Get Link** URL or a shared repository
  (Scripts tab → NEW → Repository → share with the class's Google group).

---

## Common errors and fixes

| Error message | Usual cause | Fix |
|---|---|---|
| `... is not defined` | Typo in a variable name, or it was created further down | Check spelling and capitalisation; define before use |
| `Unexpected token` / red underline | Missing comma, bracket or quote | Count `( ) [ ] { }` and check commas between items |
| `Image.select: Pattern 'B8' did not match any bands` | Wrong band name for this dataset (e.g. Landsat uses `SR_B5`) | Print the image and read the band names |
| `Collection.first: Error in map` / empty results | Filters removed every image (dates, area, cloud %) | Print `.size()` after each filter |
| `Too many pixels in the region` | Area too big for the chosen `scale` | Add `maxPixels: 1e13`, or use a coarser `scale` |
| `Computation timed out` | Interactive request too heavy | Use **Export** instead of `print`, coarser `scale`, `tileScale` |
| `User memory limit exceeded` | Very large reduction or sampling | Add `tileScale: 4` (or 8/16) |
| `Asset not found` / `permission denied` | Wrong asset path or asset not shared | Copy the exact path from the Assets tab; check sharing |
| Export task never starts | Task created but not run | Open **Tasks** tab and click **RUN** |
