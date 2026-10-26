/*******************************************************************************
 * GOOGLE EARTH ENGINE FOR BEGINNERS
 * Module 2 · Script 06 — Using your own data (assets) and exporting results
 * -----------------------------------------------------------------------------
 * WHAT YOU WILL LEARN
 *   • How to upload a SHAPEFILE, a CSV of points and a GeoTIFF raster as ASSETS
 *   • How to load your assets in a script (and use one as your study area)
 *   • How to EXPORT images and tables to Google Drive or back to your assets
 *
 * PRACTICE DATA (in the course folder "practice_data"):
 *   field_sites_mandi.csv  → 10 example field points with latitude/longitude
 *
 * =============================================================================
 * STEP-BY-STEP: UPLOADING DATA (done with the mouse, not with code)
 * =============================================================================
 *
 * A) A SHAPEFILE (e.g. your study-area boundary)
 *    1. Left panel → "Assets" tab → red "NEW" button → "Shape files".
 *    2. Click "SELECT" and choose ALL the parts of the shapefile at once:
 *         myfile.shp  myfile.shx  myfile.dbf  myfile.prj   (and .cpg if you have it)
 *       (or a single .zip that contains them).
 *    3. Asset ID: give it a short name, e.g.  study_area
 *    4. Click "UPLOAD". Watch progress in the "Tasks" tab (right panel).
 *    5. When it finishes, it appears in the Assets tab. Its full path looks like:
 *         projects/YOUR-PROJECT-ID/assets/study_area
 *
 * B) A CSV FILE OF POINTS
 *    1. Assets → NEW → "CSV file (.csv)".
 *    2. Select practice_data/field_sites_mandi.csv.
 *    3. Asset ID: field_sites_mandi
 *    4. Open "Advanced options" and check that the X (longitude) column is
 *       "longitude" and the Y (latitude) column is "latitude".
 *    5. UPLOAD and wait for the task to finish.
 *
 * C) A GEOTIFF RASTER (e.g. a drone orthomosaic, a classified map, a DEM)
 *    1. Assets → NEW → "Image" → "GeoTIFF (.tif, .tiff) or TFRecord".
 *    2. Select the .tif, give it an Asset ID, UPLOAD.
 *
 * TIPS
 *   • Shapefiles must have a .prj file (the coordinate system) or uploads fail.
 *   • Keep attribute names short and without spaces or special characters.
 *   • Click an asset in the Assets tab → "SHARE" to let classmates use it
 *     ("Anyone can read" makes it readable by anyone who has the path).
 *   • Click the arrow → "Import" next to an asset to add it to the IMPORTS
 *     section at the top of your script automatically.
 ******************************************************************************/


// =============================================================================
// PART 1 — Settings: tell the script about YOUR assets
// =============================================================================

// ► Replace YOUR-PROJECT-ID with your own Cloud project ID (see Assets tab).
var MY_PROJECT = 'projects/YOUR-PROJECT-ID/assets/';

// ► Set this to true AFTER you have uploaded the study-area shapefile.
var USE_MY_STUDY_AREA = false;

// ► Set this to true AFTER you have uploaded field_sites_mandi.csv.
var USE_MY_FIELD_SITES = false;


// =============================================================================
// PART 2 — Loading a study area: your shapefile, or a built-in fallback
// =============================================================================

// Declare the variable first; we fill it in the if / else below.
var studyArea;

// If you uploaded a shapefile, load it as a FeatureCollection...
if (USE_MY_STUDY_AREA) {
  // ee.FeatureCollection('path') loads a vector asset (shapefile / CSV upload).
  studyArea = ee.FeatureCollection(MY_PROJECT + 'study_area');
} else {
  // ...otherwise make a FeatureCollection from our usual rectangle so the
  // rest of the script still works.
  studyArea = ee.FeatureCollection([
    ee.Feature(ee.Geometry.Rectangle([76.75, 31.45, 77.25, 31.85]), {name: 'Mandi study area'})
  ]);
}

// Many functions need a GEOMETRY rather than a FeatureCollection.
// .geometry() merges all features into one geometry.
var aoi = studyArea.geometry();

// Print some information about the study area.
print('Study area:', studyArea);
print('Study area size (km²):', aoi.area(10).divide(1e6));

// Zoom to it and draw its outline in yellow.
Map.centerObject(aoi, 10);
Map.addLayer(studyArea.style({color: 'yellow', fillColor: '00000000', width: 2}), {}, 'Study area');


// =============================================================================
// PART 3 — Loading the field-site CSV
// =============================================================================

// Declare the variable for the points.
var fieldSites;

// If you uploaded the CSV, load it...
if (USE_MY_FIELD_SITES) {
  // A CSV upload becomes a FeatureCollection of points, one per row.
  fieldSites = ee.FeatureCollection(MY_PROJECT + 'field_sites_mandi');
} else {
  // ...otherwise build a few of the same points by hand.
  fieldSites = ee.FeatureCollection([
    ee.Feature(ee.Geometry.Point([76.9318, 31.7084]), {site_id: 'S01', name: 'Mandi town', cover: 'built-up'}),
    ee.Feature(ee.Geometry.Point([77.1009, 31.7543]), {site_id: 'S02', name: 'Prashar Lake', cover: 'water'}),
    ee.Feature(ee.Geometry.Point([76.8336, 31.6336]), {site_id: 'S03', name: 'Rewalsar Lake', cover: 'water'})
  ]);
}

// Print the table of points and show them in red.
print('Field sites:', fieldSites);
Map.addLayer(fieldSites, {color: 'red'}, 'Field sites');

// Example of USING your points: read the elevation under each one.
// .sampleRegions() extracts pixel values at each feature and adds them as properties.
var sitesWithElevation = ee.Image('USGS/SRTMGL1_003').sampleRegions({
  collection: fieldSites,    // the points to sample
  scale: 30,                 // pixel size to sample at (SRTM is 30 m)
  geometries: true           // keep the point geometry in the output
});

// Each site now has an "elevation" property.
print('Field sites with elevation:', sitesWithElevation);


// =============================================================================
// PART 4 — Loading your own raster (GeoTIFF) asset
// =============================================================================

// After uploading a GeoTIFF, load it with ee.Image('path'). Un-comment to try:
// var myRaster = ee.Image(MY_PROJECT + 'my_raster');
// print('My raster:', myRaster);
// Map.addLayer(myRaster, {min: 0, max: 255}, 'My uploaded raster');


// =============================================================================
// PART 5 — Something to export: a Sentinel-2 composite and NDVI
// =============================================================================

// Build a median composite for Oct–Dec 2024 (see Script 04 for details).
var composite = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(aoi)                                    // our area
  .filterDate('2024-10-01', '2025-01-01')               // Oct–Dec 2024
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))  // fairly clear images
  .median()                                             // median composite
  .clip(aoi);                                           // cut to the study area

// NDVI from NIR (B8) and red (B4) — explained in Module 3.
var ndvi = composite.normalizedDifference(['B8', 'B4']).rename('NDVI');

// Show both.
Map.addLayer(composite, {bands: ['B4', 'B3', 'B2'], min: 0, max: 3000}, 'S2 composite');
Map.addLayer(ndvi, {min: 0, max: 0.8, palette: ['brown', 'yellow', 'green']}, 'NDVI', false);


// =============================================================================
// PART 6 — EXPORTING (results appear in the "Tasks" tab — click RUN there!)
// =============================================================================

// ---- 6a. Export an IMAGE to Google Drive as a GeoTIFF ----------------------
Export.image.toDrive({
  image: ndvi,                          // the image to export
  description: 'NDVI_Mandi_2024_OND',   // the task name (no spaces)
  folder: 'GEE_exports',                // Google Drive folder (created if missing)
  fileNamePrefix: 'NDVI_Mandi_2024_OND',// the file name
  region: aoi,                          // the area to export
  scale: 10,                            // pixel size in metres
  crs: 'EPSG:4326',                     // coordinate system (WGS84 lat/lon); or e.g. 'EPSG:32643' for UTM 43N
  maxPixels: 1e10,                      // allow large exports (default limit is small)
  fileFormat: 'GeoTIFF'                 // output format
});

// ---- 6b. Export a multi-band image (select bands, convert to one data type) ---
// All bands in a GeoTIFF must share a data type; .toFloat() makes them all decimals.
Export.image.toDrive({
  image: composite.select(['B2', 'B3', 'B4', 'B8', 'B11', 'B12']).toFloat(), // 6 bands
  description: 'S2_composite_Mandi_2024_OND',  // task name
  folder: 'GEE_exports',                       // Drive folder
  region: aoi,                                 // area
  scale: 10,                                   // 10 m pixels
  maxPixels: 1e10                              // allow large exports
});

// ---- 6c. Export a TABLE to Google Drive (CSV or Shapefile) -----------------
Export.table.toDrive({
  collection: sitesWithElevation,      // the FeatureCollection to export
  description: 'field_sites_elevation',// task name
  folder: 'GEE_exports',               // Drive folder
  fileFormat: 'CSV'                    // 'CSV', 'SHP', 'GeoJSON', 'KML' or 'KMZ'
});

// ---- 6d. Export an IMAGE to your ASSETS (to reuse in other scripts) --------
// Saving intermediate results as assets makes later scripts much faster.
Export.image.toAsset({
  image: ndvi,                                     // the image
  description: 'NDVI_to_asset',                    // task name
  assetId: MY_PROJECT + 'NDVI_Mandi_2024_OND',     // where to save it (needs your project ID!)
  region: aoi,                                     // area
  scale: 10,                                       // 10 m
  maxPixels: 1e10                                  // allow large exports
});

// ---- 6e. Export a TABLE to your ASSETS -------------------------------------
Export.table.toAsset({
  collection: sitesWithElevation,                  // the FeatureCollection
  description: 'sites_to_asset',                   // task name
  assetId: MY_PROJECT + 'field_sites_elevation'    // where to save it
});

// After running the script:
//   1. Open the "Tasks" tab (right panel). Each export is listed with a RUN button.
//   2. Click RUN, check the settings in the pop-up, click RUN again.
//   3. Big exports can take minutes to hours. You can close the browser meanwhile.
//   4. GeoTIFFs open directly in QGIS/ArcGIS; CSVs in Excel.


/*******************************************************************************
 * TRY IT YOURSELF
 *   1. Upload practice_data/field_sites_mandi.csv, set USE_MY_FIELD_SITES = true,
 *      put in your project ID, and run again. Do all 10 points appear?
 *   2. Draw a polygon around your village with the drawing tool, then export
 *      it as a shapefile with Export.table.toDrive and fileFormat: 'SHP'.
 *      (Hint: ee.FeatureCollection([ee.Feature(geometry)]) )
 *   3. Export the S2 composite at 30 m instead of 10 m. How does the file size change?
 ******************************************************************************/
