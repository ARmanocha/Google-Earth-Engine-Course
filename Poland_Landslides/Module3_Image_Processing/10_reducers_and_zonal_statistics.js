/*******************************************************************************
 * GOOGLE EARTH ENGINE FOR BEGINNERS — Landslides in the Polish Carpathians
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
 * catchment, buffer, landslide polygon …) — done with reduceRegions().
 *
 * WHAT YOU WILL LEARN
 *   • reduceRegion with one or several reducers, and the scale/maxPixels settings
 *   • Area calculations with ee.Image.pixelArea() — e.g. how much land is steep
 *   • Area per land-cover class with a grouped reducer, on all land and on steep slopes
 *   • Zonal statistics for every district, a choropleth map, a chart and a CSV export
 ******************************************************************************/


// =============================================================================
// PART 0 — Study area and data
// =============================================================================

// Study area rectangle [west, south, east, north]: Limanowa and the Rożnów Reservoir.
var aoi = ee.Geometry.Rectangle([20.25, 49.60, 20.80, 49.85]);

// Zoom to it.
Map.centerObject(aoi, 10);

// SRTM elevation (metres).
var dem = ee.Image('USGS/SRTMGL1_003');

// Slope in degrees, computed from the DEM.
var slope = ee.Terrain.slope(dem);

// A Sentinel-2 NDVI composite for June–August 2024 (cloud-masked with Cloud Score+).
var csPlus = ee.ImageCollection('GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED');
var ndvi = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(aoi)                                         // our area
  .filterDate('2024-06-01', '2024-09-01')                    // Jun–Aug 2024
  .linkCollection(csPlus, ['cs_cdf'])                        // attach cloud score
  .map(function(img) {                                       // for each image:
    return img.updateMask(img.select('cs_cdf').gte(0.6));    //   hide cloudy pixels
  })
  .median()                                                  // median composite
  .normalizedDifference(['B8', 'B4'])                        // NDVI (scaling not needed for a ratio)
  .rename('NDVI')                                            // name the band
  .clip(aoi);                                                // cut to AOI

// Show NDVI, elevation and slope.
Map.addLayer(ndvi, {min: 0, max: 0.9, palette: ['brown', 'yellow', 'green']}, 'NDVI Jun–Aug 2024');
Map.addLayer(dem.clip(aoi), {min: 250, max: 1150, palette: ['green', 'yellow', 'brown', 'white']},
             'Elevation', false);
Map.addLayer(slope.clip(aoi), {min: 0, max: 35, palette: ['ffffcc', 'fed976', 'fd8d3c', 'e31a1c', '800026']},
             'Slope (°)', false);


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

// Apply all of them to the SLOPE inside the AOI.
var slopeStats = slope.reduceRegion({
  reducer: manyStats,   // the combined reducer
  geometry: aoi,        // in the AOI
  scale: 30,            // at 30 m (the DEM's pixel size)
  maxPixels: 1e10       // allow many pixels
});

// Result keys are band name + statistic, e.g. slope_mean, slope_p90.
// slope_p90 = 10 % of the area is steeper than this.
print('Slope statistics (degrees):', slopeStats);

// IMPORTANT SETTINGS for reduceRegion / reduceRegions:
//   scale      → ALWAYS set it. Too small = slow; too large = inaccurate.
//                (Slope is special: at a coarser scale the terrain is smoothed,
//                 so slopes come out LOWER. Use 30 m for slope when you can.)
//   maxPixels  → if you get "Too many pixels in the region", raise it (e.g. 1e13).
//   bestEffort → true lets Earth Engine increase the scale automatically if needed.
//   tileScale  → 2, 4, 8 or 16 if you get "Computation timed out" / "out of memory".


// =============================================================================
// PART 3 — Area with ee.Image.pixelArea(): how much of the land is steep?
// =============================================================================

// Every pixel of pixelArea() holds its own area in m² (correct at any latitude).
// Steep land is where most landslides start. Area steeper than 15 degrees:
var steep = slope.gt(15);                                  // 1 if steeper than 15°, else 0

// Show the steep land in orange (selfMask hides the 0 pixels).
Map.addLayer(steep.selfMask().clip(aoi), {palette: ['ff7f00']}, 'Slopes > 15°', false);

// Multiply: pixel area where steep, 0 elsewhere.
var steepArea = ee.Image.pixelArea().multiply(steep).rename('area_m2');

// Sum all the pixel areas inside the AOI.
var areaResult = steepArea.reduceRegion({
  reducer: ee.Reducer.sum(),   // add up
  geometry: aoi,               // in the AOI
  scale: 30,                   // at 30 m
  maxPixels: 1e10              // allow many pixels
});

// Convert m² → km² and print, plus the share of the whole AOI.
var steepKm2 = ee.Number(areaResult.get('area_m2')).divide(1e6);
print('Area steeper than 15° (km²):', steepKm2);
print('Share of the AOI steeper than 15° (%):', steepKm2.divide(aoi.area(1).divide(1e6)).multiply(100));


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

// A function that turns the grouped result into a FeatureCollection (one row per
// class) so we can chart or export it. We will use it twice.
function groupsToTable(groupedResult) {
  // The list of {class, sum} dictionaries is stored under the key 'groups'.
  return ee.FeatureCollection(ee.List(groupedResult.get('groups')).map(function(item) {
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
}

// The table for the whole AOI.
var classAreaTable = groupsToTable(classAreas);

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

// ---- The same, but ONLY on slopes steeper than 15° ---------------------------
// .updateMask(steep) hides the gentle slopes before we add up the areas.
var steepClassAreas = areaAndClass.updateMask(steep).reduceRegion({
  reducer: ee.Reducer.sum().group({groupField: 1, groupName: 'class'}), // area per class
  geometry: aoi,      // in the AOI
  scale: 10,          // 10 m
  maxPixels: 1e10     // allow many pixels
});

// Which land covers sit on steep, landslide-prone slopes?
print('Land cover on slopes > 15° (km²):', groupsToTable(steepClassAreas));


// =============================================================================
// PART 5 — ZONAL STATISTICS for many zones: the districts of the voivodeship
// =============================================================================

// The voivodeship (FAO GAUL level 1) that contains Limanowa (see Script 03).
var limanowa = ee.Geometry.Point([20.4228, 49.7064]);
var voivodeship = ee.Feature(ee.FeatureCollection('FAO/GAUL/2015/level1').filterBounds(limanowa).first());

// Its districts (GAUL level 2) — the zones for our statistics.
var districts = ee.FeatureCollection('FAO/GAUL/2015/level2')
  .filter(ee.Filter.eq('ADM1_CODE', voivodeship.get('ADM1_CODE')));
print('Number of districts:', districts.size());

// Data for the WHOLE voivodeship (larger area → we work at a coarser scale):
// (1) MODIS mean NDVI for 2024 (250 m), scaled by 0.0001.
var modisNdvi = ee.ImageCollection('MODIS/061/MOD13Q1')
  .filterDate('2024-01-01', '2025-01-01')    // 2024
  .select('NDVI')                            // NDVI band
  .mean()                                    // mean over the year
  .multiply(0.0001)                          // scale to −1…1
  .rename('ndvi_mean');                      // clear band name

// (2) ERA5-Land total precipitation for 2024: daily metres → sum → × 1000 = mm.
var rain = ee.ImageCollection('ECMWF/ERA5_LAND/DAILY_AGGR')
  .filterDate('2024-01-01', '2025-01-01')    // 2024
  .select('total_precipitation_sum')         // daily precipitation (m)
  .sum()                                     // add up all days
  .multiply(1000)                            // metres → millimetres
  .rename('rain_mm');                        // clear band name

// (3) Elevation and (4) slope.
var elevation = dem.rename('elev_m');
var slopeDeg = slope.rename('slope_deg');

// Stack the four into one image → one statistic per band per district.
var stack = modisNdvi.addBands(rain).addBands(elevation).addBands(slopeDeg);

// reduceRegions runs the reducer inside EVERY feature of the collection.
var districtStats = stack.reduceRegions({
  collection: districts,           // the zones
  reducer: ee.Reducer.mean(),      // the mean of each band
  scale: 250,                      // work at 250 m (MODIS pixel size)
  tileScale: 2                     // a bit more memory per tile
});

// NOTE: at 250 m the terrain is smoothed, so slope_deg is lower than the real
// 30 m slope. It is still fine for COMPARING districts with each other.

// Keep only the useful columns: district name + the four statistics.
var districtTable = districtStats.select(['ADM2_NAME', 'ndvi_mean', 'rain_mm', 'elev_m', 'slope_deg']);

// Print the results table (expand the features in the Console).
print('Zonal statistics per district:', districtTable);

// Bar chart: mean slope per district, from flattest to steepest.
print(ui.Chart.feature.byFeature({
  features: districtTable.sort('slope_deg'),   // sorted from low to high slope
  xProperty: 'ADM2_NAME',                      // district names on the x-axis
  yProperties: ['slope_deg']                   // slope on the y-axis
}).setChartType('ColumnChart').setOptions({
  title: 'Mean slope by district (250 m DEM)',  // title
  vAxis: {title: 'Slope (°)'},                  // y label
  legend: {position: 'none'},                   // no legend
  colors: ['e31a1c']                            // bar colour
}));

// Scatter chart: do steeper (mountain) districts get more rain?
print(ui.Chart.feature.byFeature({
  features: districtTable,         // the table
  xProperty: 'slope_deg',          // x = mean slope
  yProperties: ['rain_mm']         // y = rainfall
}).setChartType('ScatterChart').setOptions({
  title: 'District rainfall vs. mean slope, 2024', // title
  hAxis: {title: 'Mean slope (°)'},                // x label
  vAxis: {title: 'Precipitation (mm)'},            // y label
  legend: {position: 'none'},                      // no legend
  pointSize: 6                                     // size of the dots
}));


// =============================================================================
// PART 6 — A CHOROPLETH map of the zonal statistics
// =============================================================================

// .paint(collection, 'property') fills each district with its property value.
var slopeChoropleth = ee.Image().float().paint(districtTable, 'slope_deg');

// Draw district outlines on top so the zones are clear.
var outlines = ee.Image().byte().paint({featureCollection: districts, color: 1, width: 1});

// Show the choropleth and the outlines, then zoom out to the voivodeship.
// ► Print the table first and adjust min/max to the real range of slope_deg.
Map.addLayer(slopeChoropleth, {min: 0, max: 10, palette: ['ffffcc', 'fed976', 'fd8d3c', 'e31a1c', '800026']},
             'District mean slope (choropleth)');
Map.addLayer(outlines, {palette: ['000000']}, 'District boundaries');
Map.centerObject(districts, 8);


// =============================================================================
// PART 7 — Statistics of a TABLE column (reduceColumns / aggregate_*)
// =============================================================================

// Mean of the district rainfall values.
print('Average district precipitation (mm):', districtTable.aggregate_mean('rain_mm'));

// The steepest district: sort by slope descending and take the first.
print('Steepest district:', districtTable.sort('slope_deg', false).first().get('ADM2_NAME'));

// reduceColumns: correlation between two columns (Pearson's r).
print('Correlation slope vs precipitation:', districtTable.reduceColumns({
  reducer: ee.Reducer.pearsonsCorrelation(),   // correlation reducer (needs 2 inputs)
  selectors: ['slope_deg', 'rain_mm']          // the two columns
}));


// =============================================================================
// PART 8 — Export the tables to Google Drive as CSV
// =============================================================================

// District statistics (Tasks tab → RUN).
Export.table.toDrive({
  collection: districtTable,                                // the table
  description: 'district_zonal_stats_2024',                 // task name
  folder: 'GEE_exports',                                    // Drive folder
  fileFormat: 'CSV',                                        // spreadsheet format
  selectors: ['ADM2_NAME', 'ndvi_mean', 'rain_mm', 'elev_m', 'slope_deg'] // columns, in this order
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
 *   2. In PART 3 compute the area steeper than 25°. What share of the AOI is it?
 *   3. In PART 5 add a 5th band: mean land surface temperature from
 *      'MODIS/061/MOD11A2' (LST_Day_1km × 0.02 − 273.15). Which district is warmest?
 *   4. If you uploaded a landslide inventory (Script 06), use reduceRegions with
 *      the "slope" image to get the mean slope of every landslide polygon
 *      (scale: 30). What is the typical slope of landslides in your area?
 ******************************************************************************/
