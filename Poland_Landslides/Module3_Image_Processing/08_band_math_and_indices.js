/*******************************************************************************
 * GOOGLE EARTH ENGINE FOR BEGINNERS — Landslides in the Polish Carpathians
 * Module 3 · Script 08 — Band math and spectral indices
 * -----------------------------------------------------------------------------
 * A SPECTRAL INDEX combines two or more bands into one number that highlights
 * something: vegetation, water, buildings, bare soil, burnt land, snow …
 *
 * Most indices are a NORMALISED DIFFERENCE:   (A − B) / (A + B)
 * which always lies between −1 and +1.
 *
 *  Index | Formula (Sentinel-2 bands)            | Highlights
 *  ------|----------------------------------------|---------------------------
 *  NDVI  | (NIR − Red) / (NIR + Red)   B8, B4     | green vegetation
 *  EVI   | 2.5·(NIR−Red)/(NIR+6Red−7.5Blue+1)     | vegetation (dense canopies)
 *  SAVI  | 1.5·(NIR−Red)/(NIR+Red+0.5)            | vegetation on bright soils
 *  NDWI  | (Green − NIR) / (Green + NIR) B3, B8   | open water
 *  MNDWI | (Green − SWIR1)/(Green + SWIR1) B3, B11| water (better near towns)
 *  NDBI  | (SWIR1 − NIR) / (SWIR1 + NIR) B11, B8  | built-up / bare land
 *  NBR   | (NIR − SWIR2) / (NIR + SWIR2) B8, B12  | burnt or freshly cleared land
 *  BSI   | ((SWIR1+Red)−(NIR+Blue)) /             | bare soil: fresh landslide
 *        | ((SWIR1+Red)+(NIR+Blue)) B11,B4,B8,B2  | scars, ploughed fields
 *  NDSI  | (Green − SWIR1)/(Green + SWIR1) B3, B11| snow (same maths as MNDWI)
 *
 * WHAT YOU WILL LEARN
 *   • Three ways to do band math: normalizedDifference(), maths methods, expression()
 *   • Colour palettes for indices
 *   • Thresholds, masks and simple rule-based classes
 *   • Combining an index with SLOPE to find bare ground on steep hillsides
 *   • Area of a thresholded class, and a histogram chart
 ******************************************************************************/


// =============================================================================
// PART 0 — Study area and a cloud-free Sentinel-2 composite
// =============================================================================

// Study area rectangle [west, south, east, north].
var aoi = ee.Geometry.Rectangle([20.25, 49.60, 20.80, 49.85]);

// Zoom to it.
Map.centerObject(aoi, 10);

// Cloud Score+ collection, used to mask clouds (see Script 07).
var csPlus = ee.ImageCollection('GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED');

// Function: mask clouds and scale one Sentinel-2 image to reflectance (0–1).
function maskS2(image) {
  // 1 where the pixel is clear (score ≥ 0.6), 0 where cloudy.
  var clear = image.select('cs_cdf').gte(0.6);
  // Keep the useful bands, scale them, hide cloudy pixels, keep the date.
  return ee.Image(image.select(['B2', 'B3', 'B4', 'B5', 'B8', 'B11', 'B12'])
                       .multiply(0.0001)
                       .updateMask(clear)
                       .copyProperties(image, ['system:time_start']));
}

// Summer 2024 median composite (trees in leaf, no snow).
var composite = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(aoi)                          // our area
  .filterDate('2024-06-01', '2024-09-01')     // Jun–Aug 2024
  .linkCollection(csPlus, ['cs_cdf'])         // attach cloud scores
  .map(maskS2)                                // mask + scale each image
  .median()                                   // median composite
  .clip(aoi);                                 // cut to AOI

// Show it in true colour.
Map.addLayer(composite, {bands: ['B4', 'B3', 'B2'], min: 0, max: 0.3}, 'S2 true colour');


// =============================================================================
// PART 1 — NDVI three different ways (all give the same answer)
// =============================================================================

// ---- Way 1: the built-in shortcut ------------------------------------------
// normalizedDifference(['A', 'B']) computes (A − B) / (A + B).
// .rename() gives the new band a clear name (otherwise it's called 'nd').
var ndvi = composite.normalizedDifference(['B8', 'B4']).rename('NDVI');

// ---- Way 2: step-by-step maths methods --------------------------------------
// Pull out the two bands we need.
var nir = composite.select('B8');   // near-infrared
var red = composite.select('B4');   // red
// (NIR − red) ÷ (NIR + red), using server-side maths methods.
var ndviManual = nir.subtract(red).divide(nir.add(red)).rename('NDVI_manual');

// ---- Way 3: a formula written as text with expression() --------------------
// Write the formula as text; then say which band each letter stands for.
var ndviExpression = composite.expression(
  '(NIR - RED) / (NIR + RED)',      // the formula
  {
    NIR: composite.select('B8'),    // NIR in the formula = band B8
    RED: composite.select('B4')     // RED in the formula = band B4
  }
).rename('NDVI_expression');

// Palette 1: brown → teal → dark green (an alternative colour scheme).
var ndviPalette = ['8c510a', 'd8b365', 'f6e8c3', 'c7eae5', '5ab4ac', '01665e', '00441b'];
// Palette 2: red → yellow → green: low NDVI red, high NDVI dark green (most common).
var ndviPalette2 = ['a50026', 'f46d43', 'fee08b', 'ffffbf', 'd9ef8b', '66bd63', '006837'];

// Show NDVI. Values: water < 0, bare soil/buildings ~0–0.2, crops/grass 0.3–0.6, forest > 0.6.
Map.addLayer(ndvi, {min: -0.2, max: 0.8, palette: ndviPalette2}, 'NDVI');

// The manual and expression versions are switched off; check them with the Inspector.
Map.addLayer(ndviManual, {min: -0.2, max: 0.8, palette: ndviPalette2}, 'NDVI (manual maths)', false);
Map.addLayer(ndviExpression, {min: -0.2, max: 0.8, palette: ndviPalette}, 'NDVI (expression)', false);


// =============================================================================
// PART 2 — More vegetation indices with expression()
// =============================================================================

// EVI — Enhanced Vegetation Index. Needs reflectance 0–1 (we already scaled).
var evi = composite.expression(
  '2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))', // the formula
  {
    NIR: composite.select('B8'),    // near-infrared
    RED: composite.select('B4'),    // red
    BLUE: composite.select('B2')    // blue
  }
).rename('EVI');

// SAVI — Soil-Adjusted Vegetation Index. The soil factor L = 0.5 is written
// straight into the formula as a number (so 1 + L = 1.5).
var savi = composite.expression(
  '((NIR - RED) / (NIR + RED + 0.5)) * 1.5', // the formula
  {
    NIR: composite.select('B8'),    // near-infrared
    RED: composite.select('B4')     // red
  }
).rename('SAVI');

// Show them (switched off).
Map.addLayer(evi, {min: 0, max: 0.6, palette: ndviPalette2}, 'EVI', false);
Map.addLayer(savi, {min: 0, max: 0.6, palette: ndviPalette2}, 'SAVI', false);


// =============================================================================
// PART 3 — Water, built-up, burn and bare-soil indices
// =============================================================================

// NDWI (McFeeters): green vs NIR. Water > 0.
var ndwi = composite.normalizedDifference(['B3', 'B8']).rename('NDWI');

// MNDWI: green vs SWIR1. Water > 0; separates water from buildings better.
var mndwi = composite.normalizedDifference(['B3', 'B11']).rename('MNDWI');

// NDBI: SWIR1 vs NIR. Built-up and bare land are positive.
var ndbi = composite.normalizedDifference(['B11', 'B8']).rename('NDBI');

// NBR: NIR vs SWIR2. Healthy vegetation high; burnt or freshly cleared land low.
var nbr = composite.normalizedDifference(['B8', 'B12']).rename('NBR');

// BSI — Bare Soil Index. Bare soil is bright in SWIR1 and red, dull in NIR and
// blue, so BSI is positive on bare ground and negative under green plants.
var bsi = composite.expression(
  '((SWIR1 + RED) - (NIR + BLUE)) / ((SWIR1 + RED) + (NIR + BLUE))', // the formula
  {
    SWIR1: composite.select('B11'),   // short-wave infrared 1
    RED: composite.select('B4'),      // red
    NIR: composite.select('B8'),      // near-infrared
    BLUE: composite.select('B2')      // blue
  }
).rename('BSI');

// A white → blue palette for water indices.
var waterPalette = ['ffffff', 'c6dbef', '6baed6', '2171b5', '08306b'];

// Show each index (switched off).
Map.addLayer(ndwi, {min: -0.5, max: 0.5, palette: waterPalette}, 'NDWI', false);
Map.addLayer(mndwi, {min: -0.5, max: 0.5, palette: waterPalette}, 'MNDWI', false);
Map.addLayer(ndbi, {min: -0.5, max: 0.3, palette: ['1a9850', 'ffffbf', 'd73027']}, 'NDBI', false);
Map.addLayer(nbr, {min: -0.3, max: 0.7, palette: ['7a0403', 'f58b1f', 'ffffbf', '1a9850']}, 'NBR', false);
Map.addLayer(bsi, {min: -0.4, max: 0.2, palette: ['1a9850', 'ffffbf', 'a6611a']}, 'BSI (bare soil)', false);


// =============================================================================
// PART 4 — Putting all indices into ONE image
// =============================================================================

// .addBands() stacks images together into a multi-band image.
var indices = ndvi
  .addBands(evi)        // band 2
  .addBands(savi)       // band 3
  .addBands(ndwi)       // band 4
  .addBands(mndwi)      // band 5
  .addBands(ndbi)       // band 6
  .addBands(nbr)        // band 7
  .addBands(bsi);       // band 8

// Check the band names.
print('Index image bands:', indices.bandNames());

// TIP: Turn on the Inspector and click the map — you now see ALL indices at once.
// Add the stack to the map (switched off) so the Inspector can read it.
Map.addLayer(indices, {bands: ['NDVI'], min: 0, max: 0.8}, 'All indices (for Inspector)', false);


// =============================================================================
// PART 5 — Thresholds and masks
// =============================================================================

// A comparison like .gt(0) (greater than) gives 1 where TRUE and 0 where FALSE.
// Other comparisons: .lt() .gte() .lte() .eq() .neq()
var waterBinary = mndwi.gt(0);

// .selfMask() hides the 0 pixels so only the water (1) is shown.
var water = waterBinary.selfMask();

// Show water in blue — mostly the Rożnów Reservoir and the Dunajec river.
Map.addLayer(water, {palette: ['0000ff']}, 'Water (MNDWI > 0)');

// Combine conditions with .and() / .or(): dense vegetation = NDVI > 0.6 AND not water.
var denseVegetation = ndvi.gt(0.6).and(mndwi.lte(0)).selfMask();
Map.addLayer(denseVegetation, {palette: ['006400']}, 'Dense vegetation (NDVI > 0.6)', false);

// .updateMask() uses one image to hide pixels of another.
// Show the NDVI values only where vegetation is dense.
var ndviOnlyDense = ndvi.updateMask(ndvi.gt(0.6));
Map.addLayer(ndviOnlyDense, {min: 0.6, max: 0.9, palette: ['c2e699', '006837']}, 'NDVI where dense', false);


// =============================================================================
// PART 6 — A simple rule-based classification with .where()
// =============================================================================

// Start with an image of zeros the same shape as NDVI, then fill in classes.
// .where(condition, value) replaces pixels where the condition is true.
var ndviClasses = ee.Image(0)                    // 0 = water / no vegetation (NDVI < 0)
  .where(ndvi.gte(0).and(ndvi.lt(0.2)), 1)       // 1 = bare / built-up
  .where(ndvi.gte(0.2).and(ndvi.lt(0.4)), 2)     // 2 = sparse vegetation
  .where(ndvi.gte(0.4).and(ndvi.lt(0.6)), 3)     // 3 = moderate vegetation
  .where(ndvi.gte(0.6), 4)                       // 4 = dense vegetation
  .updateMask(ndvi.mask())                       // keep the same no-data areas as NDVI
  .clip(aoi)                                     // cut to the AOI
  .rename('ndvi_class');                         // name the band

// One colour per class, in order 0 → 4.
var classPalette = ['2166ac', 'd9d9d9', 'fee08b', '91cf60', '1a9850'];

// Show the classes.
Map.addLayer(ndviClasses, {min: 0, max: 4, palette: classPalette}, 'NDVI classes');


// =============================================================================
// PART 7 — Bare ground on steep slopes (where landslide scars can hide)
// =============================================================================

// A fresh landslide strips the vegetation and leaves BARE SOIL on a SLOPE.
// We can look for exactly that combination: high BSI, low NDVI, steep terrain.

// Slope in degrees from the SRTM DEM (30 m), clipped to the AOI.
var slope = ee.Terrain.slope(ee.Image('USGS/SRTMGL1_003')).clip(aoi);

// Show the slope map: pale = flat, dark red = steep.
Map.addLayer(slope, {min: 0, max: 35, palette: ['ffffcc', 'fed976', 'fd8d3c', 'e31a1c', '800026']},
             'Slope (°)', false);

// Three conditions, combined with .and():
//   BSI > 0      → the surface behaves like bare soil
//   NDVI < 0.3   → there is little green vegetation
//   slope > 15   → the ground is steeper than 15 degrees
var bareSteep = bsi.gt(0)
  .and(ndvi.lt(0.3))
  .and(slope.gt(15))
  .selfMask();                                   // show only the pixels where all three are true

// Show them in bright red on top of the true-colour image.
Map.addLayer(bareSteep, {palette: ['ff0000']}, 'Bare ground on slopes > 15°');

// CAUTION: these pixels are CANDIDATES, not landslides. Quarries, forest roads,
// ski runs, building sites and ploughed fields on hillsides look the same.
// Zoom in and check each one against the satellite basemap (and a LiDAR
// hillshade if you have one) before calling it a landslide.


// =============================================================================
// PART 8 — How much area is water? And bare steep ground? (pixel area)
// =============================================================================

// ee.Image.pixelArea() gives the area of every pixel in m².
// Multiplying by the 0/1 water image keeps area only where there is water.
var waterArea = ee.Image.pixelArea().multiply(waterBinary).rename('water_m2');

// Add up all pixel areas inside the AOI (reduceRegion is explained in Script 10).
var waterAreaSum = waterArea.reduceRegion({
  reducer: ee.Reducer.sum(),   // add the values
  geometry: aoi,               // inside the AOI
  scale: 10,                   // at 10 m pixels
  maxPixels: 1e10              // allow many pixels
});

// The result is a dictionary; get the number and convert m² → km².
var waterKm2 = ee.Number(waterAreaSum.get('water_m2')).divide(1e6);
print('Water area in the AOI (km²):', waterKm2);

// The same recipe for the bare-steep candidates. .unmask(0) turns the hidden
// (masked) pixels back into 0 so they add nothing to the sum.
var bareSteepArea = ee.Image.pixelArea().multiply(bareSteep.unmask(0)).rename('bare_m2')
  .reduceRegion({reducer: ee.Reducer.sum(), geometry: aoi, scale: 10, maxPixels: 1e10});
print('Bare ground on slopes > 15° (hectares):', ee.Number(bareSteepArea.get('bare_m2')).divide(1e4));


// =============================================================================
// PART 9 — A histogram of NDVI values
// =============================================================================

// ui.Chart.image.histogram draws how many pixels have each NDVI value.
var ndviHistogram = ui.Chart.image.histogram({
  image: ndvi,          // the single-band image
  region: aoi,          // over the AOI
  scale: 30,            // sample at 30 m (faster than 10 m)
  maxBuckets: 100,      // number of bars
  maxPixels: 1e8        // allow many pixels
}).setOptions({
  title: 'NDVI histogram, Jun–Aug 2024',   // chart title
  hAxis: {title: 'NDVI'},                  // x-axis label
  vAxis: {title: 'Number of pixels'},      // y-axis label
  legend: {position: 'none'},              // no legend needed
  colors: ['1a9850']                       // bar colour
});

// Print the chart to the Console.
print(ndviHistogram);


/*******************************************************************************
 * TRY IT YOURSELF
 *   1. Compute the Normalised Difference Red-Edge index NDRE = (B8 − B5)/(B8 + B5).
 *   2. Change the water threshold from 0 to 0.2. How does the water area change?
 *   3. Compare NDVI for Mar–May 2024 and Jun–Aug 2024 (change the dates).
 *      Which areas change most? (Hint: subtract one NDVI from the other.)
 *   4. In PART 7 change the slope limit to 10° and then to 25°. How does the
 *      candidate area change? Zoom into three candidates near Kłodne and
 *      decide what each one really is.
 ******************************************************************************/
