/*******************************************************************************
 * GOOGLE EARTH ENGINE FOR BEGINNERS — Landslides in the Polish Carpathians
 * Module 4 · Script 13 — Change detection
 * Author: AKSHAY RAJ MANOCHA
 *         University of Silesia, Katowice, Poland
 * -----------------------------------------------------------------------------
 * CHANGE DETECTION compares the same place at two (or more) dates.
 * A fresh landslide removes vegetation and exposes soil, so it shows up as a
 * DROP in NDVI and a RISE in bare-soil brightness — on a slope.
 *
 *   PART A  Land-cover change      — compare two land-cover maps ("from → to")
 *   PART B  The landslides of 2010 — Landsat NDVI before/after + slope filter
 *   PART C  Forest loss            — the Hansen Global Forest Change product
 *   PART D  New bare ground        — Sentinel-2, 2019 → 2024, exported as polygons
 *
 * Rules for fair comparisons:
 *   • Use the SAME season in both years (otherwise you detect seasons, not change).
 *   • Use the SAME sensor and processing for both dates.
 *   • Expect some "false change" (harvested fields, logging, building sites,
 *     classification errors) — check with the imagery before believing a change.
 ******************************************************************************/


// =============================================================================
// PART 0 — Study area, slope and helper functions
// =============================================================================

// Study area rectangle [west, south, east, north]: Limanowa and the Rożnów Reservoir.
var aoi = ee.Geometry.Rectangle([20.25, 49.60, 20.80, 49.85]);

// Zoom to it.
Map.centerObject(aoi, 10);

// Slope in degrees from SRTM (30 m) — landslides happen on slopes.
var slope = ee.Terrain.slope(ee.Image('USGS/SRTMGL1_003')).clip(aoi);

// The village of Kłodne (landslide of June 2010), for orientation.
var klodne = ee.Geometry.Point([20.5661, 49.6850]);

// Cloud Score+ for masking Sentinel-2.
var csPlus = ee.ImageCollection('GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED');

// Function: cloud-free Sentinel-2 median composite (reflectance 0–1) for a region and dates.
function getS2Composite(region, startDate, endDate) {
  // Find the images, mask clouds, scale, and take the median.
  return ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(region)                                  // images over the region
    .filterDate(startDate, endDate)                        // within the dates
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 70))   // skip very cloudy scenes
    .linkCollection(csPlus, ['cs_cdf'])                    // attach the cloud score
    .map(function(img) {                                   // for each image:
      return img.select(['B2', 'B3', 'B4', 'B8', 'B11', 'B12'])      // keep useful bands
                .multiply(0.0001)                                    // scale to 0–1
                .updateMask(img.select('cs_cdf').gte(0.6));          // hide clouds
    })
    .median()                                              // composite
    .clip(region);                                         // cut to the region
}

// Visualisation for true colour composites.
var rgbVis = {bands: ['B4', 'B3', 'B2'], min: 0, max: 0.3};

// Show the slope and Kłodne (switched off).
Map.addLayer(slope, {min: 0, max: 35, palette: ['ffffcc', 'fed976', 'fd8d3c', 'e31a1c', '800026']},
             'Slope (°)', false);
Map.addLayer(klodne, {color: 'yellow'}, 'Kłodne', false);


// #############################################################################
// PART A — LAND-COVER CHANGE with Dynamic World (2018 → 2024)
// #############################################################################

// The 9 Dynamic World classes (codes 0–8) and their official colours.
var dwNames = ['Water', 'Trees', 'Grass', 'Flooded vegetation', 'Crops',
               'Shrub & scrub', 'Built area', 'Bare ground', 'Snow & ice'];
var dwPalette = ['419bdf', '397d49', '88b053', '7a87c6', 'e49635',
                 'dfc35a', 'c4281b', 'a59b8f', 'b39fe1'];

// Function: the most common Dynamic World class at each pixel in the growing
// season (May–September) of a given year. Winter is left out because snow
// would turn many pixels into "Snow & ice".
function dynamicWorldYear(year) {
  // 1 May of that year.
  var start = ee.Date.fromYMD(year, 5, 1);
  // Load, filter and take the mode (most frequent label) of the season.
  return ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1')
    .filterBounds(aoi)                         // our area
    .filterDate(start, start.advance(5, 'month')) // May–September
    .select('label')                           // the class label band (0–8)
    .mode()                                    // most frequent class
    .clip(aoi);                                // cut to AOI
}

// The two land-cover maps to compare.
var lcBefore = dynamicWorldYear(2018);
var lcAfter = dynamicWorldYear(2024);

// Show them.
var dwVis = {min: 0, max: 8, palette: dwPalette};
Map.addLayer(lcBefore, dwVis, 'A) Land cover 2018 (Dynamic World)', false);
Map.addLayer(lcAfter, dwVis, 'A) Land cover 2024 (Dynamic World)', false);

// ---- Simple change maps -----------------------------------------------------

// Any change: the class is different in 2024 than in 2018.
var anyChange = lcBefore.neq(lcAfter).selfMask();
Map.addLayer(anyChange, {palette: ['ff00ff']}, 'A) Any land-cover change', false);

// Tree loss: trees (1) in 2018, but NOT trees in 2024.
var treeLoss = lcBefore.eq(1).and(lcAfter.neq(1)).selfMask();
Map.addLayer(treeLoss, {palette: ['ff0000']}, 'A) Trees → something else', false);

// New bare ground ON SLOPES: not bare (7) in 2018, bare in 2024, slope > 10°.
var newBareOnSlopes = lcBefore.neq(7).and(lcAfter.eq(7)).and(slope.gt(10)).selfMask();
Map.addLayer(newBareOnSlopes, {palette: ['ffff00']}, 'A) New bare ground on slopes > 10°', false);

// ---- The full "from → to" transition table ----------------------------------

// Combine both maps into one code: from × 10 + to. E.g. trees(1) → bare(7) = 17.
var transitionCode = lcBefore.multiply(10).add(lcAfter).rename('transition');

// Sum pixel area (km²) for every transition code.
var transitionAreas = ee.Image.pixelArea().divide(1e6).addBands(transitionCode).reduceRegion({
  reducer: ee.Reducer.sum().group({groupField: 1, groupName: 'code'}), // area per code
  geometry: aoi,      // in the AOI
  scale: 10,          // Dynamic World is 10 m
  maxPixels: 1e10     // allow many pixels
});

// Convert the list of {code, sum} into a readable table.
var transitionTable = ee.FeatureCollection(ee.List(transitionAreas.get('groups')).map(function(item) {
  // One {code, sum} dictionary.
  var d = ee.Dictionary(item);
  // The combined code, e.g. 17.
  var code = ee.Number(d.get('code')).int();
  // "from" class = tens digit (17 → 1); "to" class = units digit (17 → 7).
  var fromClass = code.divide(10).floor().int();
  var toClass = code.mod(10).int();
  // A table row with names and the area.
  return ee.Feature(null, {
    transition: ee.String(ee.List(dwNames).get(fromClass))   // e.g. "Trees"
                  .cat(' → ')                                 // arrow
                  .cat(ee.List(dwNames).get(toClass)),        // e.g. "Bare ground"
    changed: fromClass.neq(toClass),                          // 1 if the class changed, else 0
    area_km2: d.get('sum')                                    // area in km²
  });
}));

// Keep only real changes, biggest first.
var changesOnly = transitionTable.filter(ee.Filter.eq('changed', 1)).sort('area_km2', false);

// Show the top 15 transitions as a table chart.
print(ui.Chart.feature.byFeature({
  features: changesOnly.limit(15),   // the 15 largest changes
  xProperty: 'transition',           // first column
  yProperties: ['area_km2']          // second column
}).setChartType('Table').setOptions({title: 'Largest land-cover transitions 2018 → 2024 (km²)'}));

// Total area that changed class.
print('A) Total area that changed class (km²):', changesOnly.aggregate_sum('area_km2'));

// CAUTION: part of this "change" is classification noise. Always compare with
// the satellite images (below) before reporting a change.
Map.addLayer(getS2Composite(aoi, '2018-06-01', '2018-09-01'), rgbVis, 'A) S2 Jun–Aug 2018', false);
Map.addLayer(getS2Composite(aoi, '2024-06-01', '2024-09-01'), rgbVis, 'A) S2 Jun–Aug 2024', false);


// #############################################################################
// PART B — THE LANDSLIDES OF MAY–JUNE 2010 (Landsat 5 and 7)
// #############################################################################

// Sentinel-2 did not exist in 2010, so we use Landsat (30 m). Landsat 5 and
// Landsat 7 have the same band numbers, so we merge them to get more images.
// (Landsat 7 has striped gaps since 2003; a median of several dates fills most.)
//   SR_B1 blue | SR_B2 green | SR_B3 red | SR_B4 NIR | SR_B5 SWIR1 | SR_B7 SWIR2

// Function: mask clouds and scale one Landsat 5/7 image.
function maskAndScaleL57(image) {
  // The quality band: bit 0 fill, bit 1 dilated cloud, bit 3 cloud, bit 4 shadow.
  var qa = image.select('QA_PIXEL');
  // TRUE where any problem is present.
  var bad = qa.bitwiseAnd(1 << 0).neq(0)     // no data
    .or(qa.bitwiseAnd(1 << 1).neq(0))        // area around clouds
    .or(qa.bitwiseAnd(1 << 3).neq(0))        // cloud
    .or(qa.bitwiseAnd(1 << 4).neq(0));       // cloud shadow
  // Scale the optical bands to reflectance: value × 0.0000275 − 0.2.
  var optical = image.select(['SR_B1', 'SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B7'])
                     .multiply(0.0000275).add(-0.2);
  // Keep only the good pixels.
  return optical.updateMask(bad.not());
}

// Function: a Landsat 5+7 median composite for two dates.
function getLandsat57Composite(startDate, endDate) {
  // Merge both satellites, filter, mask and take the median.
  return ee.ImageCollection('LANDSAT/LT05/C02/T1_L2')            // Landsat 5
    .merge(ee.ImageCollection('LANDSAT/LE07/C02/T1_L2'))          // + Landsat 7
    .filterBounds(aoi)                                            // our area
    .filterDate(startDate, endDate)                               // the dates
    .map(maskAndScaleL57)                                         // mask + scale
    .median()                                                     // composite
    .clip(aoi);                                                   // cut to the AOI
}

// BEFORE: summer 2009. AFTER: summer 2010 (after the landslides of late May
// and June). The SAME months are used in both years.
var before2009 = getLandsat57Composite('2009-07-01', '2009-10-01');
var after2010 = getLandsat57Composite('2010-07-01', '2010-10-01');

// How many images went into each composite? (Few images = noisier composite.)
print('B) Landsat 5+7 images, Jul–Sep 2009:', ee.ImageCollection('LANDSAT/LT05/C02/T1_L2')
  .merge(ee.ImageCollection('LANDSAT/LE07/C02/T1_L2')).filterBounds(aoi)
  .filterDate('2009-07-01', '2009-10-01').size());
print('B) Landsat 5+7 images, Jul–Sep 2010:', ee.ImageCollection('LANDSAT/LT05/C02/T1_L2')
  .merge(ee.ImageCollection('LANDSAT/LE07/C02/T1_L2')).filterBounds(aoi)
  .filterDate('2010-07-01', '2010-10-01').size());

// Show both in false colour (SWIR1, NIR, red): vegetation green, bare soil pink-brown.
var landsatFalseColour = {bands: ['SR_B5', 'SR_B4', 'SR_B3'], min: 0, max: 0.4};
Map.addLayer(before2009, landsatFalseColour, 'B) Landsat Jul–Sep 2009', false);
Map.addLayer(after2010, landsatFalseColour, 'B) Landsat Jul–Sep 2010', false);

// NDVI for each date (NIR = SR_B4, red = SR_B3 for Landsat 5/7).
var ndviBefore = before2009.normalizedDifference(['SR_B4', 'SR_B3']);
var ndviAfter = after2010.normalizedDifference(['SR_B4', 'SR_B3']);

// dNDVI = after − before. Negative = vegetation decreased.
var dNDVI2010 = ndviAfter.subtract(ndviBefore).rename('dNDVI');
Map.addLayer(dNDVI2010, {min: -0.4, max: 0.4, palette: ['b2182b', 'f7f7f7', '1a9850']},
             'B) NDVI change 2009 → 2010', false);

// Landslide CANDIDATES: green before (NDVI > 0.5), a big drop (dNDVI < −0.2),
// and on a slope steeper than 10°.
var candidates2010 = ndviBefore.gt(0.5)
  .and(dNDVI2010.lt(-0.2))
  .and(slope.gt(10));

// Remove single "speckle" pixels: keep groups of at least 5 connected pixels
// (5 × 30 m × 30 m ≈ 0.45 ha). connectedPixelCount counts each pixel's group size.
var groupSize = candidates2010.selfMask().connectedPixelCount(100, true);
var candidates2010Clean = candidates2010.updateMask(groupSize.gte(5)).selfMask();

// Show them in red.
Map.addLayer(candidates2010Clean, {palette: ['ff0000']}, 'B) 2010 landslide candidates');

// Their total area (hectares).
var candidateArea2010 = ee.Image.pixelArea().updateMask(candidates2010Clean).reduceRegion({
  reducer: ee.Reducer.sum(),   // add pixel areas
  geometry: aoi,               // in the AOI
  scale: 30,                   // Landsat is 30 m
  maxPixels: 1e10              // allow many pixels
});
print('B) Area of 2010 candidates (ha):', ee.Number(candidateArea2010.get('area')).divide(1e4));

// CAUTION: these are CANDIDATES. Harvested fields, logging and clouds missed by
// the mask also cause NDVI to drop. Zoom to Kłodne and to other candidates and
// compare the 2009 and 2010 false-colour layers. Many 2010 landslides were small,
// narrow or under forest, so a 30 m satellite will miss some of them.


// #############################################################################
// PART C — FOREST LOSS: Global Forest Change (Hansen et al., Landsat, 2001–2023)
// #############################################################################

// A ready-made global product of yearly forest loss.
var gfc = ee.Image('UMD/hansen/global_forest_change_2023_v1_11').clip(aoi);

// Tree cover in 2000 (% canopy), shown in green.
Map.addLayer(gfc.select('treecover2000'), {min: 0, max: 100, palette: ['ffffff', '006400']},
             'C) Tree cover 2000 (%)', false);

// "lossyear": 1 = loss in 2001, 2 = 2002 … 23 = 2023 (0 = no loss).
var lossYear = gfc.select('lossyear').selfMask();

// Show loss by year: yellow (early) → red (recent).
Map.addLayer(lossYear, {min: 1, max: 23, palette: ['ffff00', 'ff8000', 'ff0000']},
             'C) Forest loss year (2001–2023)', false);

// Area of forest loss for EACH year (grouped reducer on lossyear).
var lossByYear = ee.Image.pixelArea().divide(1e6).addBands(lossYear).reduceRegion({
  reducer: ee.Reducer.sum().group({groupField: 1, groupName: 'lossyear'}), // per year
  geometry: aoi,      // in the AOI
  scale: 30,          // Hansen is 30 m
  maxPixels: 1e10     // allow many pixels
});

// Convert to a table: year and area.
var lossTable = ee.FeatureCollection(ee.List(lossByYear.get('groups')).map(function(item) {
  // One {lossyear, sum} dictionary.
  var d = ee.Dictionary(item);
  // Year = 2000 + code; area in km².
  return ee.Feature(null, {
    year: ee.Number(d.get('lossyear')).add(2000),  // e.g. 10 → 2010
    loss_km2: d.get('sum')                         // area lost that year
  });
}));

// Column chart of forest loss per year. Is 2010 different from other years?
print(ui.Chart.feature.byFeature({
  features: lossTable,          // the table
  xProperty: 'year',            // x = year
  yProperties: ['loss_km2']     // y = loss area
}).setChartType('ColumnChart').setOptions({
  title: 'C) Forest loss per year in the AOI (Hansen GFC)',  // title
  hAxis: {title: 'Year', format: '####'},                    // x label, no comma in years
  vAxis: {title: 'Loss (km²)'},                              // y label
  colors: ['d7301f'],                                        // red bars
  legend: {position: 'none'}                                 // no legend
}));

// NOTE: Hansen "loss" means any removal of tree cover: logging, storms, bark-beetle
// dieback AND landslides. It cannot tell them apart by itself.


// #############################################################################
// PART D — NEW BARE GROUND ON SLOPES, 2019 → 2024 (Sentinel-2, 10 m)
// #############################################################################

// Same season (June–August) in both years.
var s2Before = getS2Composite(aoi, '2019-06-01', '2019-09-01');
var s2After = getS2Composite(aoi, '2024-06-01', '2024-09-01');

// Show both in true colour (switched off).
Map.addLayer(s2Before, rgbVis, 'D) S2 Jun–Aug 2019', false);
Map.addLayer(s2After, rgbVis, 'D) S2 Jun–Aug 2024', false);

// A function that adds NDVI and the Bare Soil Index (BSI, Script 08) to a composite.
function addNdviBsi(image) {
  // NDVI from NIR (B8) and red (B4).
  var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
  // BSI = ((SWIR1 + red) − (NIR + blue)) / ((SWIR1 + red) + (NIR + blue)).
  var bsi = image.expression(
    '((S + R) - (N + B)) / ((S + R) + (N + B))',
    {S: image.select('B11'), R: image.select('B4'), N: image.select('B8'), B: image.select('B2')}
  ).rename('BSI');
  // Return both bands.
  return ndvi.addBands(bsi);
}

// NDVI and BSI for each year.
var idxBefore = addNdviBsi(s2Before);
var idxAfter = addNdviBsi(s2After);

// The changes: dNDVI (negative = less green) and dBSI (positive = more bare).
var dNDVI = idxAfter.select('NDVI').subtract(idxBefore.select('NDVI'));
var dBSI = idxAfter.select('BSI').subtract(idxBefore.select('BSI'));

// New bare ground: green before, much less green after, more bare, on a slope.
var newBare = idxBefore.select('NDVI').gt(0.5)   // vegetated in 2019
  .and(dNDVI.lt(-0.25))                          // NDVI fell by more than 0.25
  .and(dBSI.gt(0.1))                             // bare-soil index rose by more than 0.1
  .and(slope.gt(10));                            // on a slope steeper than 10°

// Keep groups of at least 10 pixels (10 × 10 m × 10 m = 0.1 ha).
var newBareClean = newBare.updateMask(newBare.selfMask().connectedPixelCount(200, true).gte(10)).selfMask();

// Show them in bright yellow.
Map.addLayer(newBareClean, {palette: ['ffff00']}, 'D) New bare ground on slopes 2019 → 2024');

// Turn the pixel groups into POLYGONS (one per patch) so they can be checked
// in the field or in QGIS.
var patches = newBareClean.rename('patch').reduceToVectors({
  geometry: aoi,               // where to look
  scale: 10,                   // at 10 m
  geometryType: 'polygon',     // outlines (not centroids)
  eightConnected: true,        // diagonal neighbours belong to the same patch
  labelProperty: 'patch',      // the property that stores the pixel value (1)
  maxPixels: 1e10              // allow many pixels
});

// Add each patch's area in hectares, and sort the biggest first.
var patchesWithArea = patches.map(function(feature) {
  // m² ÷ 10,000 = hectares.
  return feature.set('area_ha', feature.geometry().area(1).divide(1e4));
}).sort('area_ha', false);

// How many patches, and the 10 largest.
print('D) Number of new bare patches on slopes:', patchesWithArea.size());
print('D) The 10 largest patches (ha):', patchesWithArea.limit(10).aggregate_array('area_ha'));

// Draw the outlines in black on top.
Map.addLayer(patchesWithArea.style({color: '000000', fillColor: '00000000', width: 1}), {},
             'D) Patch outlines', false);

// Export the patches as a shapefile for checking (Tasks tab → RUN).
Export.table.toDrive({
  collection: patchesWithArea,                       // the polygons
  description: 'new_bare_slopes_2019_2024',          // task name
  folder: 'GEE_exports',                             // Drive folder
  fileFormat: 'SHP'                                  // shapefile
});

// HOW TO CHECK A PATCH: zoom in, compare the 2019 and 2024 layers, look at the
// satellite basemap, and if possible at Polish orthophotos and LiDAR hillshades on
// geoportal.gov.pl. Decide: landslide, logging, building site, field, or error?


/*******************************************************************************
 * TRY IT YOURSELF
 *   1. PART A: change the years to 2019 → 2023. Which transitions are largest?
 *   2. PART B: change the thresholds (NDVI before > 0.6, dNDVI < −0.3). Does
 *      the number of candidates near Kłodne go up or down?
 *   3. PART D: open the 5 largest patches one by one and classify each as
 *      landslide / logging / construction / field / other. How many are landslides?
 *   4. Find a landslide event in your own region (news reports or the PIG-PIB
 *      geoportal) and change the dates in PART D to before and after it.
 ******************************************************************************/
