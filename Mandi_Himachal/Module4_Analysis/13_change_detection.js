/*******************************************************************************
 * GOOGLE EARTH ENGINE FOR BEGINNERS
 * Module 4 · Script 13 — Change detection
 * -----------------------------------------------------------------------------
 * CHANGE DETECTION compares the same place at two (or more) dates.
 *
 *   PART A  Land-cover change      — compare two classified maps ("from → to")
 *   PART B  Vegetation loss        — subtract NDVI of two dates; Hansen forest loss
 *   PART C  Burned areas           — dNBR = NBR(before fire) − NBR(after fire)
 *
 * Rules for fair comparisons:
 *   • Use the SAME season in both years (otherwise you detect seasons, not change).
 *   • Use the SAME sensor and processing for both dates.
 *   • Expect some "false change" from classification errors — check with the
 *     imagery before believing a change.
 ******************************************************************************/


// =============================================================================
// PART 0 — Study area and helper function
// =============================================================================

// Study area rectangle [west, south, east, north].
var aoi = ee.Geometry.Rectangle([76.75, 31.45, 77.25, 31.85]);

// Zoom to it.
Map.centerObject(aoi, 10);

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


// #############################################################################
// PART A — LAND-COVER CHANGE with Dynamic World (2018 → 2024)
// #############################################################################

// The 9 Dynamic World classes (codes 0–8) and their official colours.
var dwNames = ['Water', 'Trees', 'Grass', 'Flooded vegetation', 'Crops',
               'Shrub & scrub', 'Built area', 'Bare ground', 'Snow & ice'];
var dwPalette = ['419bdf', '397d49', '88b053', '7a87c6', 'e49635',
                 'dfc35a', 'c4281b', 'a59b8f', 'b39fe1'];

// Function: the most common Dynamic World class at each pixel in a given year.
function dynamicWorldYear(year) {
  // 1 January of that year.
  var start = ee.Date.fromYMD(year, 1, 1);
  // Load, filter and take the mode (most frequent label) of the year.
  return ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1')
    .filterBounds(aoi)                         // our area
    .filterDate(start, start.advance(1, 'year')) // that whole year
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

// New built-up: NOT built (6) in 2018, built in 2024.
var newBuilt = lcBefore.neq(6).and(lcAfter.eq(6)).selfMask();
Map.addLayer(newBuilt, {palette: ['ffff00']}, 'A) New built-up area');

// ---- The full "from → to" transition table ----------------------------------
// Combine both maps into one code: from × 10 + to. E.g. trees(1) → built(6) = 16.
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
  // The combined code, e.g. 16.
  var code = ee.Number(d.get('code')).int();
  // "from" class = tens digit (16 → 1); "to" class = units digit (16 → 6).
  var fromClass = code.divide(10).floor().int();
  var toClass = code.mod(10).int();
  // A table row with names and the area.
  return ee.Feature(null, {
    transition: ee.String(ee.List(dwNames).get(fromClass))   // e.g. "Trees"
                  .cat(' → ')                                 // arrow
                  .cat(ee.List(dwNames).get(toClass)),        // e.g. "Built area"
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
Map.addLayer(getS2Composite(aoi, '2018-10-01', '2019-01-01'), rgbVis, 'A) S2 Oct–Dec 2018', false);
Map.addLayer(getS2Composite(aoi, '2024-10-01', '2025-01-01'), rgbVis, 'A) S2 Oct–Dec 2024', false);


// #############################################################################
// PART B — VEGETATION LOSS
// #############################################################################

// ---- B1: NDVI difference between two dates (same season) -------------------
// NDVI for Oct–Dec 2019 and Oct–Dec 2024.
var ndviBefore = getS2Composite(aoi, '2019-10-01', '2020-01-01').normalizedDifference(['B8', 'B4']);
var ndviAfter = getS2Composite(aoi, '2024-10-01', '2025-01-01').normalizedDifference(['B8', 'B4']);

// dNDVI = after − before.  Negative = vegetation decreased; positive = increased.
var dNDVI = ndviAfter.subtract(ndviBefore).rename('dNDVI');

// Show it: red = loss, white = no change, green = gain.
Map.addLayer(dNDVI, {min: -0.4, max: 0.4, palette: ['b2182b', 'f7f7f7', '1a9850']},
             'B1) NDVI change 2019 → 2024', false);

// Vegetation LOSS = was vegetated before (NDVI > 0.4) AND dropped by more than 0.2.
var vegLoss = ndviBefore.gt(0.4).and(dNDVI.lt(-0.2)).selfMask();
Map.addLayer(vegLoss, {palette: ['ff0000']}, 'B1) Vegetation loss (dNDVI < −0.2)', false);

// Area of vegetation loss.
var vegLossArea = ee.Image.pixelArea().updateMask(vegLoss).reduceRegion({
  reducer: ee.Reducer.sum(),   // add pixel areas
  geometry: aoi,               // in the AOI
  scale: 10,                   // 10 m
  maxPixels: 1e10              // allow many pixels
});
print('B1) Vegetation loss area (km²):', ee.Number(vegLossArea.get('area')).divide(1e6));

// ---- B2: Global Forest Change (Hansen et al., Landsat, 2001–2023) ---------
// A ready-made global product of yearly forest loss.
var gfc = ee.Image('UMD/hansen/global_forest_change_2023_v1_11').clip(aoi);

// Tree cover in 2000 (% canopy), shown in green.
Map.addLayer(gfc.select('treecover2000'), {min: 0, max: 100, palette: ['ffffff', '006400']},
             'B2) Tree cover 2000 (%)', false);

// "lossyear": 1 = loss in 2001, 2 = 2002 … 23 = 2023 (0 = no loss).
var lossYear = gfc.select('lossyear').selfMask();

// Show loss by year: yellow (early) → red (recent).
Map.addLayer(lossYear, {min: 1, max: 23, palette: ['ffff00', 'ff8000', 'ff0000']},
             'B2) Forest loss year (2001–2023)', false);

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
    year: ee.Number(d.get('lossyear')).add(2000),  // e.g. 5 → 2005
    loss_km2: d.get('sum')                         // area lost that year
  });
}));

// Column chart of forest loss per year.
print(ui.Chart.feature.byFeature({
  features: lossTable,          // the table
  xProperty: 'year',            // x = year
  yProperties: ['loss_km2']     // y = loss area
}).setChartType('ColumnChart').setOptions({
  title: 'B2) Forest loss per year in the AOI (Hansen GFC)', // title
  hAxis: {title: 'Year', format: '####'},                    // x label, no comma in years
  vAxis: {title: 'Loss (km²)'},                              // y label
  colors: ['d7301f'],                                        // red bars
  legend: {position: 'none'}                                 // no legend
}));


// #############################################################################
// PART C — BURNED AREA with dNBR (example: Dixie Fire, California, 2021)
// #############################################################################

// Mandi has small, scattered fires, so we practise on a large, well-known fire.
// ► Replace fireAoi and the dates with a fire in your own region.
var fireAoi = ee.Geometry.Rectangle([-121.5, 39.8, -120.4, 40.6]);

// BEFORE the fire: early summer 2021 (fire started 13 July 2021).
var preFire = getS2Composite(fireAoi, '2021-06-01', '2021-07-12');

// AFTER the fire: the same season one year later (no smoke, same vegetation stage).
var postFire = getS2Composite(fireAoi, '2022-06-01', '2022-07-31');

// NBR = (NIR − SWIR2) / (NIR + SWIR2). Healthy vegetation high; burnt land low.
var nbrPre = preFire.normalizedDifference(['B8', 'B12']).rename('NBR');
var nbrPost = postFire.normalizedDifference(['B8', 'B12']).rename('NBR');

// dNBR = pre − post. A big positive value = a big drop in NBR = severe burn.
var dNBR = nbrPre.subtract(nbrPost).rename('dNBR');

// Show before / after images (SWIR false colour shows burn scars in dark red-brown).
var swirVis = {bands: ['B12', 'B8', 'B4'], min: 0, max: 0.4};
Map.addLayer(preFire, swirVis, 'C) Before fire (SWIR composite)', false);
Map.addLayer(postFire, swirVis, 'C) After fire (SWIR composite)', false);

// Show dNBR: green = regrowth, white = unchanged, red/purple = burnt.
Map.addLayer(dNBR, {min: -0.25, max: 1, palette: ['1a9850', 'ffffff', 'fdae61', 'd7191c', '7b3294']},
             'C) dNBR', false);

// ---- Burn severity classes (USGS / UN-SPIDER thresholds) --------------------
//   < −0.25 high regrowth | −0.25…−0.1 low regrowth | −0.1…0.1 unburned
//   0.1…0.27 low | 0.27…0.44 moderate-low | 0.44…0.66 moderate-high | > 0.66 high
var severity = ee.Image(0)                               // start everything at 0
  .where(dNBR.lt(-0.25), 1)                              // 1 = high regrowth
  .where(dNBR.gte(-0.25).and(dNBR.lt(-0.1)), 2)          // 2 = low regrowth
  .where(dNBR.gte(-0.1).and(dNBR.lt(0.1)), 3)            // 3 = unburned
  .where(dNBR.gte(0.1).and(dNBR.lt(0.27)), 4)            // 4 = low severity
  .where(dNBR.gte(0.27).and(dNBR.lt(0.44)), 5)           // 5 = moderate-low severity
  .where(dNBR.gte(0.44).and(dNBR.lt(0.66)), 6)           // 6 = moderate-high severity
  .where(dNBR.gte(0.66), 7)                              // 7 = high severity
  .updateMask(dNBR.mask())                               // keep dNBR's no-data areas
  .clip(fireAoi)                                         // cut to the fire area
  .rename('severity');                                   // band name

// The standard severity colours, in order 1 → 7.
var severityPalette = ['7a8737', 'acbe4d', '0ae042', 'fff70b', 'ffaf38', 'ff641b', 'a41fd6'];
Map.addLayer(severity, {min: 1, max: 7, palette: severityPalette}, 'C) Burn severity', false);

// Total burned area = any severity class from "low" upwards (dNBR ≥ 0.1).
var burned = dNBR.gte(0.1);
var burnedArea = ee.Image.pixelArea().updateMask(burned).reduceRegion({
  reducer: ee.Reducer.sum(),   // add pixel areas
  geometry: fireAoi,           // in the fire AOI
  scale: 20,                   // B12 is 20 m
  maxPixels: 1e10,             // allow many pixels
  tileScale: 4                 // extra memory for a large area
});
print('C) Burned area, dNBR ≥ 0.1 (km²):', ee.Number(burnedArea.get('area')).divide(1e6));

// ---- MODIS burned-area product as a cross-check -----------------------------
// MCD64A1: monthly 500 m burned area; 'BurnDate' = day of year the pixel burned.
var modisBurn = ee.ImageCollection('MODIS/061/MCD64A1')
  .filterDate('2021-07-01', '2021-12-01')    // the fire season
  .select('BurnDate')                        // burn day-of-year band
  .max()                                     // any burn in the period
  .clip(fireAoi);                            // cut to the fire area

// Show it: early burn (yellow) → late burn (red).
Map.addLayer(modisBurn, {min: 190, max: 300, palette: ['ffff00', 'ff8000', 'ff0000']},
             'C) MODIS burn date (day of year)', false);


// =============================================================================
// Buttons to jump between the two study areas
// =============================================================================

// A button that zooms the map to the fire example.
var fireButton = ui.Button({
  label: 'Zoom to fire example (Part C)',            // button text
  onClick: function() { Map.centerObject(fireAoi, 9); }, // what happens on click
  style: {position: 'top-center'}                    // where on the map
});

// A button that zooms back to Mandi.
var mandiButton = ui.Button({
  label: 'Back to Mandi (Parts A & B)',              // button text
  onClick: function() { Map.centerObject(aoi, 10); },    // what happens on click
  style: {position: 'top-center'}                    // where on the map
});

// Add both buttons to the map.
Map.add(fireButton);
Map.add(mandiButton);


/*******************************************************************************
 * TRY IT YOURSELF
 *   1. PART A: change the years to 2019 → 2023. Which transitions are largest?
 *   2. PART A: map "crops → built area" only. Where is the town growing?
 *   3. PART B: change the vegetation-loss threshold to −0.3. How does the area change?
 *   4. PART C: find a forest fire in your state (news reports or NASA FIRMS)
 *      and compute its dNBR and burned area.
 ******************************************************************************/
