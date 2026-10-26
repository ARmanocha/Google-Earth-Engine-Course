/*******************************************************************************
 * GOOGLE EARTH ENGINE FOR BEGINNERS — Landslides in the Polish Carpathians
 * Module 2 · Script 06 — Using your own data (assets) and exporting results
 * -----------------------------------------------------------------------------
 * WHAT YOU WILL LEARN
 *   • How to upload a SHAPEFILE, a CSV of points and a GeoTIFF raster as ASSETS
 *   • How to load your assets in a script (and use one as your study area)
 *   • How to load a LANDSLIDE INVENTORY and measure it
 *   • How to EXPORT images and tables to Google Drive or back to your assets
 *
 * PRACTICE DATA (in the course folder "practice_data"):
 *   field_sites_limanowa.csv → 10 example points with latitude/longitude
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
 *    2. Select practice_data/field_sites_limanowa.csv.
 *    3. Asset ID: field_sites_limanowa
 *    4. Open "Advanced options" and check that the X (longitude) column is
 *       "longitude" and the Y (latitude) column is "latitude".
 *    5. UPLOAD and wait for the task to finish.
 *
 * C) A GEOTIFF RASTER (e.g. a LiDAR DEM tile, a drone orthomosaic, a classified map)
 *    1. Assets → NEW → "Image" → "GeoTIFF (.tif, .tiff) or TFRecord".
 *    2. Select the .tif, give it an Asset ID (e.g. lidar_dem), UPLOAD.
 *    Polish 1 m LiDAR elevation models can be downloaded for free from
 *    geoportal.gov.pl (GUGiK). Tiles are large: start with one or two.
 *
 * D) A LANDSLIDE INVENTORY (polygons)
 *    Landslide outlines for many Carpathian municipalities are mapped by the
 *    Polish Geological Institute in the SOPO project (System Osłony
 *    Przeciwosuwiskowej). View them on the PIG-PIB geoportal; the data are made
 *    available through the institute's Central Geological Archive — check the
 *    terms of use. You can also draw your own landslide polygons on a LiDAR
 *    hillshade. Upload them as a shapefile (step A) with the Asset ID "landslides".
 *
 * TIPS
 *   • Shapefiles must have a .prj file (the coordinate system) or uploads fail.
 *     Polish data often use EPSG:2180 (PUWG 1992) — that is fine, GEE converts it.
 *   • Keep attribute names short, without spaces or Polish letters (ą, ł, ż …).
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

// ► Set this to true AFTER you have uploaded field_sites_limanowa.csv.
var USE_MY_FIELD_SITES = false;

// ► Set this to true AFTER you have uploaded a landslide shapefile as "landslides".
var USE_MY_LANDSLIDES = false;


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
    ee.Feature(ee.Geometry.Rectangle([20.25, 49.60, 20.80, 49.85]), {name: 'Limanowa–Rożnów study area'})
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
  fieldSites = ee.FeatureCollection(MY_PROJECT + 'field_sites_limanowa');
} else {
  // ...otherwise build a few of the same points by hand.
  fieldSites = ee.FeatureCollection([
    ee.Feature(ee.Geometry.Point([20.4228, 49.7064]), {site_id: 'S01', name: 'Limanowa', cover: 'built-up'}),
    ee.Feature(ee.Geometry.Point([20.5661, 49.6850]), {site_id: 'S02', name: 'Kłodne', cover: 'landslide area'}),
    ee.Feature(ee.Geometry.Point([20.7144, 49.7322]), {site_id: 'S03', name: 'Rożnów Reservoir', cover: 'water'})
  ]);
}

// Print the table of points and show them in red.
print('Field sites:', fieldSites);
Map.addLayer(fieldSites, {color: 'red'}, 'Field sites');

// Example of USING your points: read the elevation AND slope under each one.
// Stack elevation and slope into one 2-band image first.
var srtm = ee.Image('USGS/SRTMGL1_003');
var terrain = srtm.addBands(ee.Terrain.slope(srtm));   // bands: 'elevation', 'slope'

// .sampleRegions() extracts pixel values at each feature and adds them as properties.
var sitesWithTerrain = terrain.sampleRegions({
  collection: fieldSites,    // the points to sample
  scale: 30,                 // pixel size to sample at (SRTM is 30 m)
  geometries: true           // keep the point geometry in the output
});

// Each site now has "elevation" (m) and "slope" (degrees) properties.
print('Field sites with elevation and slope:', sitesWithTerrain);


// =============================================================================
// PART 4 — Loading your own raster (GeoTIFF) asset
// =============================================================================

// After uploading a GeoTIFF, load it with ee.Image('path'). Un-comment to try.
// For a LiDAR DEM tile, a hillshade makes landslides easy to see:
// var lidarDem = ee.Image(MY_PROJECT + 'lidar_dem');
// print('My LiDAR DEM:', lidarDem);
// Map.addLayer(ee.Terrain.hillshade(lidarDem), {min: 0, max: 255}, 'LiDAR hillshade');


// =============================================================================
// PART 5 — Loading a LANDSLIDE INVENTORY (polygons)
// =============================================================================

// Declare the variable for the landslides.
var landslides;

// If you uploaded a landslide shapefile, load it...
if (USE_MY_LANDSLIDES) {
  // Each polygon is one landslide; its attributes come from the .dbf file.
  landslides = ee.FeatureCollection(MY_PROJECT + 'landslides');
} else {
  // ...otherwise use ONE practice shape: a 150 m circle at Kłodne village.
  // This is NOT the real landslide outline — it only lets the code run.
  landslides = ee.FeatureCollection([
    ee.Feature(ee.Geometry.Point([20.5661, 49.6850]).buffer(150), {name: 'practice shape', year: 2010})
  ]);
}

// How many landslides, and what attributes do they have?
print('Number of landslide polygons:', landslides.size());
print('Attributes of the first landslide:', ee.Feature(landslides.first()).propertyNames());

// Add each polygon's area in hectares as a new property (.map from Script 03).
var landslidesWithArea = landslides.map(function(feature) {
  // m² ÷ 10,000 = hectares.
  return feature.set('area_ha', feature.geometry().area(1).divide(10000));
});

// Total landslide area, and the share of the study area it covers.
var totalHa = landslidesWithArea.aggregate_sum('area_ha');
print('Total landslide area (ha):', totalHa);
print('Share of the study area covered by landslides (%):',
      ee.Number(totalHa).divide(aoi.area(10).divide(10000)).multiply(100));

// Draw the landslides with a red outline and a light-red fill.
Map.addLayer(landslidesWithArea.style({color: 'ff0000', fillColor: 'ff000044', width: 2}), {}, 'Landslides');


// =============================================================================
// PART 6 — Something to export: a Sentinel-2 composite and NDVI
// =============================================================================

// Build a median composite for June–August 2024 (see Script 04 for details).
var composite = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(aoi)                                    // our area
  .filterDate('2024-06-01', '2024-09-01')               // Jun–Aug 2024
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))  // fairly clear images
  .median()                                             // median composite
  .clip(aoi);                                           // cut to the study area

// NDVI from NIR (B8) and red (B4) — explained in Module 3.
var ndvi = composite.normalizedDifference(['B8', 'B4']).rename('NDVI');

// Show both.
Map.addLayer(composite, {bands: ['B4', 'B3', 'B2'], min: 0, max: 3000}, 'S2 composite');
Map.addLayer(ndvi, {min: 0, max: 0.8, palette: ['brown', 'yellow', 'green']}, 'NDVI', false);


// =============================================================================
// PART 7 — EXPORTING (results appear in the "Tasks" tab — click RUN there!)
// =============================================================================

// ---- 7a. Export an IMAGE to Google Drive as a GeoTIFF ----------------------
// crs = the coordinate reference system of the output file:
//   'EPSG:2180'  → PUWG 1992, the official national system of Poland (metres)
//   'EPSG:32634' → UTM zone 34N (metres), good for 18–24 °E
//   'EPSG:4326'  → WGS84 latitude/longitude (degrees)
Export.image.toDrive({
  image: ndvi,                               // the image to export
  description: 'NDVI_Limanowa_2024_JJA',     // the task name (no spaces)
  folder: 'GEE_exports',                     // Google Drive folder (created if missing)
  fileNamePrefix: 'NDVI_Limanowa_2024_JJA',  // the file name
  region: aoi,                               // the area to export
  scale: 10,                                 // pixel size in metres
  crs: 'EPSG:2180',                          // Poland's national coordinate system
  maxPixels: 1e10,                           // allow large exports (default limit is small)
  fileFormat: 'GeoTIFF'                      // output format
});

// ---- 7b. Export a multi-band image (select bands, convert to one data type) ---
// All bands in a GeoTIFF must share a data type; .toFloat() makes them all decimals.
Export.image.toDrive({
  image: composite.select(['B2', 'B3', 'B4', 'B8', 'B11', 'B12']).toFloat(), // 6 bands
  description: 'S2_composite_Limanowa_2024_JJA',  // task name
  folder: 'GEE_exports',                          // Drive folder
  region: aoi,                                    // area
  scale: 10,                                      // 10 m pixels
  crs: 'EPSG:2180',                               // national coordinate system
  maxPixels: 1e10                                 // allow large exports
});

// ---- 7c. Export a TABLE to Google Drive (CSV or Shapefile) -----------------
Export.table.toDrive({
  collection: sitesWithTerrain,        // the FeatureCollection to export
  description: 'field_sites_terrain',  // task name
  folder: 'GEE_exports',               // Drive folder
  fileFormat: 'CSV'                    // 'CSV', 'SHP', 'GeoJSON', 'KML' or 'KMZ'
});

// ---- 7d. Export the landslides with their areas as a SHAPEFILE ---------------
Export.table.toDrive({
  collection: landslidesWithArea,      // polygons with the new area_ha column
  description: 'landslides_with_area', // task name
  folder: 'GEE_exports',               // Drive folder
  fileFormat: 'SHP'                    // shapefile (opens in QGIS)
});

// ---- 7e. Export an IMAGE to your ASSETS (to reuse in other scripts) --------
// Saving intermediate results as assets makes later scripts much faster.
Export.image.toAsset({
  image: ndvi,                                     // the image
  description: 'NDVI_to_asset',                    // task name
  assetId: MY_PROJECT + 'NDVI_Limanowa_2024_JJA',  // where to save it (needs your project ID!)
  region: aoi,                                     // area
  scale: 10,                                       // 10 m
  maxPixels: 1e10                                  // allow large exports
});

// ---- 7f. Export a TABLE to your ASSETS -------------------------------------
Export.table.toAsset({
  collection: sitesWithTerrain,                    // the FeatureCollection
  description: 'sites_to_asset',                   // task name
  assetId: MY_PROJECT + 'field_sites_terrain'      // where to save it
});

// After running the script:
//   1. Open the "Tasks" tab (right panel). Each export is listed with a RUN button.
//   2. Click RUN, check the settings in the pop-up, click RUN again.
//   3. Big exports can take minutes to hours. You can close the browser meanwhile.
//   4. GeoTIFFs and shapefiles open directly in QGIS/ArcGIS; CSVs in Excel.


/*******************************************************************************
 * TRY IT YOURSELF
 *   1. Upload practice_data/field_sites_limanowa.csv, set USE_MY_FIELD_SITES = true,
 *      put in your project ID, and run again. Do all 10 points appear? Which
 *      point is on the steepest slope?
 *   2. Draw a polygon around a bare scar on a hillside with the drawing tool,
 *      then export it as a shapefile with Export.table.toDrive and
 *      fileFormat: 'SHP'. (Hint: ee.FeatureCollection([ee.Feature(geometry)]) )
 *   3. Export the S2 composite at 30 m instead of 10 m. How does the file size change?
 *   4. If you have a landslide inventory: sort the landslides by area_ha and
 *      print the 5 largest.
 ******************************************************************************/
