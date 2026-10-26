/*******************************************************************************
 * GOOGLE EARTH ENGINE FOR BEGINNERS
 * Module 3 · Script 10 — Reducers and zonal statistics
 * -----------------------------------------------------------------------------
 * A REDUCER turns MANY values into FEWER values (mean, sum, min, max, count …).
 * Where you apply it decides what you get:
 *
 *  collection.reduce(...)  / .median()   many IMAGES  → one image (per pixel)
 *  image.reduceRegion(...)               many PIXELS in ONE area → numbers
 *  image.reduceRegions(...)              many PIXELS in MANY areas → a table
 *  featureCollection.reduceColumns(...)  many TABLE ROWS → numbers
 *
 * "Zonal statistics" = statistics of a raster inside each zone (district,
 * watershed, buffer, field …) — done with reduceRegions().
 *
 * WHAT YOU WILL LEARN
 *   • reduceRegion with one or several reducers, and the scale/maxPixels settings
 *   • Area calculations with ee.Image.pixelArea()
 *   • Area per land-cover class with a grouped reducer
 *   • Zonal statistics for every district, a choropleth map, a chart and a CSV export
 ******************************************************************************/


// =============================================================================
// PART 0 — Study area and data
// =============================================================================

// Study area rectangle [west, south, east, north].
var aoi = ee.Geometry.Rectangle([76.75, 31.45, 77.25, 31.85]);

// Zoom to it.
Map.centerObject(aoi, 10);

// SRTM elevation (metres).
var dem = ee.Image('USGS/SRTMGL1_003');

// A Sentinel-2 NDVI composite for Oct–Dec 2024 (cloud-masked with Cloud Score+).
var csPlus = ee.ImageCollection('GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED');
var ndvi = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(aoi)                                         // our area
  .filterDate('2024-10-01', '2025-01-01')                    // Oct–Dec 2024
  .linkCollection(csPlus, ['cs_cdf'])                        // attach cloud score
  .map(function(img) {                                       // for each image:
    return img.updateMask(img.select('cs_cdf').gte(0.6));    //   hide cloudy pixels
  })
  .median()                                                  // median composite
  .normalizedDifference(['B8', 'B4'])                        // NDVI (scaling not needed for a ratio)
  .rename('NDVI')                                            // name the band
  .clip(aoi);                                                // cut to AOI

// Show NDVI and elevation.
Map.addLayer(ndvi, {min: 0, max: 0.8, palette: ['brown', 'yellow', 'green']}, 'NDVI Oct–Dec 2024');
Map.addLayer(dem.clip(aoi), {min: 500, max: 4000, palette: ['green', 'yellow', 'brown', 'white']},
             'Elevation', false);


// =============================================================================
// PART 1 — reduceRegion: one number for the whole area
// =============================================================================

// Mean NDVI over the AOI.
var meanNdvi = ndvi.reduceRegion({
  reducer: ee.Reducer.mean(),   // WHAT to calculate
  geometry: aoi,                // WHERE (the zone)
  scale: 10,                    // pixel size in metres to work at (use the data's native size)
  maxPixels: 1e10               // safety limit; raise it for big areas
});

// The answer is an ee.Dictionary: {band name: value}.
print('Mean NDVI (dictionary):', meanNdvi);

// .get('NDVI') pulls out the number.
print('Mean NDVI (number):', meanNdvi.get('NDVI'));

// Other single reducers work the same way:
print('Max elevation in AOI (m):', dem.reduceRegion({
  reducer: ee.Reducer.max(),    // the largest value
  geometry: aoi,                // in the AOI
  scale: 30,                    // SRTM is 30 m
  maxPixels: 1e10               // allow many pixels
}).get('elevation'));


// =============================================================================
// PART 2 — Several statistics at once (combined reducers)
// =============================================================================

// .combine() joins reducers; sharedInputs: true means they all read the same band.
var manyStats = ee.Reducer.mean()
  .combine({reducer2: ee.Reducer.stdDev(), sharedInputs: true})                // + standard deviation
  .combine({reducer2: ee.Reducer.minMax(), sharedInputs: true})                // + min and max
  .combine({reducer2: ee.Reducer.percentile([10, 50, 90]), sharedInputs: true})// + percentiles
  .combine({reducer2: ee.Reducer.count(), sharedInputs: true});                // + number of pixels

// Apply all of them to the elevation inside the AOI.
var elevationStats = dem.reduceRegion({
  reducer: manyStats,   // the combined reducer
  geometry: aoi,        // in the AOI
  scale: 30,            // at 30 m
  maxPixels: 1e10       // allow many pixels
});

// Result keys are band name + statistic, e.g. elevation_mean, elevation_p90.
print('Elevation statistics:', elevationStats);

// IMPORTANT SETTINGS for reduceRegion / reduceRegions:
//   scale      → ALWAYS set it. Too small = slow; too large = inaccurate.
//   maxPixels  → if you get "Too many pixels in the region", raise it (e.g. 1e13).
//   bestEffort → true lets Earth Engine increase the scale automatically if needed.
//   tileScale  → 2, 4, 8 or 16 if you get "Computation timed out" / "out of memory".


// =============================================================================
// PART 3 — Area with ee.Image.pixelArea()
// =============================================================================

// Every pixel of pixelArea() holds its own area in m² (correct at any latitude).
// Area of land above 2000 m:
var above2000 = dem.gt(2000);                              // 1 if above 2000 m, else 0

// Multiply: pixel area where above 2000 m, 0 elsewhere.
var areaAbove2000 = ee.Image.pixelArea().multiply(above2000).rename('area_m2');

// Sum all the pixel areas inside the AOI.
var areaResult = areaAbove2000.reduceRegion({
  reducer: ee.Reducer.sum(),   // add up
  geometry: aoi,               // in the AOI
  scale: 30,                   // at 30 m
  maxPixels: 1e10              // allow many pixels
});

// Convert m² → km² and print.
print('Area above 2000 m (km²):', ee.Number(areaResult.get('area_m2')).divide(1e6));


// =============================================================================
// PART 4 — Area of EVERY land-cover class (a grouped reducer)
// =============================================================================

// ESA WorldCover 2021 (10 m). Band 'Map' holds the class code.
var worldCover = ee.ImageCollection('ESA/WorldCover/v200').first().select('Map').clip(aoi);

// Show it with its built-in colours.
Map.addLayer(worldCover, {}, 'WorldCover 2021', false);

// Image with 2 bands: [0] pixel area in km², [1] the class code.
var areaAndClass = ee.Image.pixelArea().divide(1e6).addBands(worldCover);

// .group() makes a SEPARATE sum for each class code found in band 1.
var classAreas = areaAndClass.reduceRegion({
  reducer: ee.Reducer.sum().group({
    groupField: 1,          // band index of the class codes (band 1 = 'Map')
    groupName: 'class'      // what to call the class field in the output
  }),
  geometry: aoi,            // in the AOI
  scale: 10,                // WorldCover's 10 m pixels
  maxPixels: 1e10           // allow many pixels
});

// The raw answer: a list of {class: code, sum: area}.
print('Area per class (raw):', classAreas);

// WorldCover class codes → names (keys must be text).
var classNames = ee.Dictionary({
  '10': 'Tree cover', '20': 'Shrubland', '30': 'Grassland', '40': 'Cropland',
  '50': 'Built-up', '60': 'Bare / sparse vegetation', '70': 'Snow and ice',
  '80': 'Permanent water', '90': 'Herbaceous wetland', '95': 'Mangroves',
  '100': 'Moss and lichen'
});

// Turn the list into a FeatureCollection (one row per class) so we can chart/export it.
var classAreaTable = ee.FeatureCollection(ee.List(classAreas.get('groups')).map(function(item) {
  // Each item is a dictionary like {class: 10, sum: 123.4}.
  var dict = ee.Dictionary(item);
  // The class code as text, e.g. '10'.
  var code = ee.Number(dict.get('class')).format();
  // A feature with no geometry (null) = a table row.
  return ee.Feature(null, {
    class_code: code,                                       // the code
    class_name: classNames.get(code),                       // the name looked up in the dictionary
    area_km2: ee.Number(dict.get('sum'))                    // the area
  });
}));

// Print the table.
print('Area per WorldCover class (km²):', classAreaTable);

// A bar chart of area per class.
print(ui.Chart.feature.byFeature({
  features: classAreaTable,     // the table
  xProperty: 'class_name',      // categories on the x-axis
  yProperties: ['area_km2']     // values on the y-axis
}).setChartType('ColumnChart').setOptions({
  title: 'Land cover area in the AOI (ESA WorldCover 2021)',  // chart title
  vAxis: {title: 'Area (km²)'},                               // y label
  legend: {position: 'none'}                                  // no legend
}));


// =============================================================================
// PART 5 — ZONAL STATISTICS for many zones: districts of Himachal Pradesh
// =============================================================================

// Districts (zones) from FAO GAUL level 2.
var districts = ee.FeatureCollection('FAO/GAUL/2015/level2')
  .filter(ee.Filter.eq('ADM1_NAME', 'Himachal Pradesh'));

// Data for the WHOLE state (larger area → we use coarser datasets):
// (1) MODIS mean NDVI for 2024 (250 m), scaled by 0.0001.
var modisNdvi = ee.ImageCollection('MODIS/061/MOD13Q1')
  .filterDate('2024-01-01', '2025-01-01')    // 2024
  .select('NDVI')                            // NDVI band
  .mean()                                    // mean over the year
  .multiply(0.0001)                          // scale to −1…1
  .rename('ndvi_mean');                      // clear band name

// (2) CHIRPS total rainfall for 2024 (mm).
var rain = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY')
  .filterDate('2024-01-01', '2025-01-01')    // 2024
  .sum()                                     // add up daily rainfall
  .rename('rain_mm');                        // clear band name

// (3) Elevation.
var elevation = dem.rename('elev_m');

// Stack the three into one image → one statistic per band per district.
var stack = modisNdvi.addBands(rain).addBands(elevation);

// reduceRegions runs the reducer inside EVERY feature of the collection.
var districtStats = stack.reduceRegions({
  collection: districts,           // the zones
  reducer: ee.Reducer.mean(),      // the mean of each band
  scale: 250,                      // work at 250 m (MODIS pixel size)
  tileScale: 2                     // a bit more memory per tile
});

// Keep only the useful columns: district name + the three statistics.
var districtTable = districtStats.select(['ADM2_NAME', 'ndvi_mean', 'rain_mm', 'elev_m']);

// Print the results table (expand the features in the Console).
print('Zonal statistics per district:', districtTable);

// Bar chart: mean NDVI per district.
print(ui.Chart.feature.byFeature({
  features: districtTable.sort('ndvi_mean'),   // sorted from low to high NDVI
  xProperty: 'ADM2_NAME',                      // district names on the x-axis
  yProperties: ['ndvi_mean']                   // NDVI on the y-axis
}).setChartType('ColumnChart').setOptions({
  title: 'Mean NDVI 2024 by district (MODIS)',  // title
  vAxis: {title: 'NDVI'},                       // y label
  legend: {position: 'none'},                   // no legend
  colors: ['2ca25f']                            // bar colour
}));

// Scatter chart: does NDVI depend on rainfall?
print(ui.Chart.feature.byFeature({
  features: districtTable,         // the table
  xProperty: 'rain_mm',            // x = rainfall
  yProperties: ['ndvi_mean']       // y = NDVI
}).setChartType('ScatterChart').setOptions({
  title: 'District NDVI vs. rainfall, 2024',   // title
  hAxis: {title: 'Rainfall (mm)'},             // x label
  vAxis: {title: 'Mean NDVI'},                 // y label
  legend: {position: 'none'},                  // no legend
  pointSize: 6                                 // size of the dots
}));


// =============================================================================
// PART 6 — A CHOROPLETH map of the zonal statistics
// =============================================================================

// .paint(collection, 'property') fills each district with its property value.
var ndviChoropleth = ee.Image().float().paint(districtTable, 'ndvi_mean');

// Draw district outlines on top so the zones are clear.
var outlines = ee.Image().byte().paint({featureCollection: districts, color: 1, width: 1});

// Show the choropleth and the outlines, then zoom out to the state.
Map.addLayer(ndviChoropleth, {min: 0.2, max: 0.6, palette: ['fff7bc', 'addd8e', '31a354', '006837']},
             'District mean NDVI (choropleth)');
Map.addLayer(outlines, {palette: ['000000']}, 'District boundaries');
Map.centerObject(districts, 7);


// =============================================================================
// PART 7 — Statistics of a TABLE column (reduceColumns / aggregate_*)
// =============================================================================

// Mean of the district rainfall values (average of 12 numbers).
print('Average district rainfall (mm):', districtTable.aggregate_mean('rain_mm'));

// The wettest district: sort by rainfall descending and take the first.
print('Wettest district:', districtTable.sort('rain_mm', false).first().get('ADM2_NAME'));

// reduceColumns: correlation between two columns (Pearson's r).
print('Correlation NDVI vs rainfall:', districtTable.reduceColumns({
  reducer: ee.Reducer.pearsonsCorrelation(),   // correlation reducer (needs 2 inputs)
  selectors: ['rain_mm', 'ndvi_mean']          // the two columns
}));


// =============================================================================
// PART 8 — Export the tables to Google Drive as CSV
// =============================================================================

// District statistics (Tasks tab → RUN).
Export.table.toDrive({
  collection: districtTable,                                // the table
  description: 'HP_district_zonal_stats_2024',              // task name
  folder: 'GEE_exports',                                    // Drive folder
  fileFormat: 'CSV',                                        // spreadsheet format
  selectors: ['ADM2_NAME', 'ndvi_mean', 'rain_mm', 'elev_m']// columns, in this order
});

// Land-cover areas in the AOI.
Export.table.toDrive({
  collection: classAreaTable,                               // the table
  description: 'AOI_worldcover_area_km2',                   // task name
  folder: 'GEE_exports',                                    // Drive folder
  fileFormat: 'CSV',                                        // spreadsheet format
  selectors: ['class_code', 'class_name', 'area_km2']       // columns
});


/*******************************************************************************
 * TRY IT YOURSELF
 *   1. Add ee.Reducer.median() to the combined reducer in PART 2.
 *   2. In PART 5 add a 4th band: mean land surface temperature from
 *      'MODIS/061/MOD11A2' (LST_Day_1km × 0.02 − 273.15). Which district is hottest?
 *   3. Compute zonal statistics of Sentinel-2 NDVI for the 1 km buffers around
 *      the field sites of Script 03 (use scale: 10).
 *   4. Change the AOI and compute the area of each WorldCover class for it.
 ******************************************************************************/
