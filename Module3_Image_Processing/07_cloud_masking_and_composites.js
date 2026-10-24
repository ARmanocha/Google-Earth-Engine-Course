/*******************************************************************************
 * GOOGLE EARTH ENGINE FOR BEGINNERS
 * Module 3 · Script 07 — Cloud masking and composites (median, seasonal, annual)
 * -----------------------------------------------------------------------------
 * THE PROBLEM: Optical satellites cannot see through clouds. In the Himalaya,
 * the monsoon (June–September) means most images are partly cloudy.
 *
 * THE SOLUTION:
 *   1. MASK  — mark cloudy pixels in each image as "no data" (transparent).
 *   2. COMPOSITE — combine many masked images; for each pixel use the clear
 *      observations only (e.g. their median). Result: one cloud-free image.
 *
 * WHAT YOU WILL LEARN
 *   • Sentinel-2 cloud masking with Cloud Score+ (recommended) and with SCL
 *   • Landsat 8/9 cloud masking with the QA_PIXEL band (bit flags)
 *   • Applying scale factors
 *   • Median, mean, percentile and "greenest-pixel" composites
 *   • Seasonal and annual composites, and counting clear observations
 ******************************************************************************/


// =============================================================================
// PART 0 — Study area and visualisation settings
// =============================================================================

// Study area rectangle [west, south, east, north].
var aoi = ee.Geometry.Rectangle([76.75, 31.45, 77.25, 31.85]);

// Zoom to it.
Map.centerObject(aoi, 10);

// Visualisation for Sentinel-2 AFTER scaling to reflectance (0–1).
var s2Vis = {bands: ['B4', 'B3', 'B2'], min: 0, max: 0.3};

// Visualisation for Landsat 8/9 AFTER scaling to reflectance (0–1).
var lsVis = {bands: ['SR_B4', 'SR_B3', 'SR_B2'], min: 0, max: 0.3};


// =============================================================================
// PART 1 — Why we need masking: a raw cloudy image
// =============================================================================

// Get all Sentinel-2 images over the AOI during the 2024 monsoon.
var s2Monsoon = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(aoi)                          // our area
  .filterDate('2024-07-01', '2024-09-30');    // July–September 2024

// How many images? (Most will be cloudy.)
print('Monsoon 2024 S2 images:', s2Monsoon.size());

// Show one raw image (values 0–10000, so max = 3000).
Map.addLayer(s2Monsoon.first(), {bands: ['B4', 'B3', 'B2'], min: 0, max: 3000},
             '1) One raw monsoon image', false);

// A plain median of these unmasked images — clouds still spoil it.
Map.addLayer(s2Monsoon.median().clip(aoi), {bands: ['B4', 'B3', 'B2'], min: 0, max: 3000},
             '2) Median WITHOUT cloud mask', false);


// =============================================================================
// PART 2 — Sentinel-2 cloud masking with CLOUD SCORE+ (recommended)
// =============================================================================

// Cloud Score+ is a Google dataset that gives every Sentinel-2 pixel a score:
//   1 = definitely clear,   0 = definitely cloud / shadow / haze.
// Its band 'cs_cdf' is the recommended one to use.
var csPlus = ee.ImageCollection('GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED');

// Pixels with a score at or above this threshold are kept as "clear".
// 0.5–0.65 works well in most places. Higher = stricter (fewer clouds, fewer pixels).
var CLEAR_THRESHOLD = 0.60;

// A FUNCTION that masks and scales ONE Sentinel-2 image.
// We will run it on every image with .map().
function maskS2withCloudScore(image) {
  // Make a mask: 1 where the image is clear, 0 where it is cloudy.
  var clearMask = image.select('cs_cdf').gte(CLEAR_THRESHOLD);
  // Keep only the surface-reflectance bands we need (B2 … B12).
  var bands = image.select(['B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B8A', 'B11', 'B12']);
  // Sentinel-2 stores reflectance × 10000 → multiply by 0.0001 to get 0–1.
  var scaled = bands.multiply(0.0001);
  // Apply the mask (cloudy pixels become transparent). Maths like .multiply()
  // drops the metadata, so .copyProperties() copies the image date back.
  // ee.Image( ... ) makes sure the result is still treated as an image.
  return ee.Image(scaled.updateMask(clearMask)
                        .copyProperties(image, ['system:time_start']));
}

// Build the cleaned collection for the monsoon.
var s2MonsoonMasked = s2Monsoon
  .linkCollection(csPlus, ['cs_cdf'])   // attach the matching Cloud Score+ band to each S2 image
  .map(maskS2withCloudScore);           // mask and scale every image

// Median of the MASKED images: only clear observations are used at each pixel.
var monsoonComposite = s2MonsoonMasked.median().clip(aoi);

// Compare this with layer 2 — far fewer clouds.
Map.addLayer(monsoonComposite, s2Vis, '3) Monsoon median WITH Cloud Score+ mask', false);


// =============================================================================
// PART 3 — Alternative Sentinel-2 mask: the SCL (Scene Classification) band
// =============================================================================

// Every Sentinel-2 L2A image has an 'SCL' band produced by ESA, with classes:
//   3 = cloud shadow, 8 = cloud (medium), 9 = cloud (high), 10 = thin cirrus,
//   11 = snow/ice, 4 = vegetation, 5 = bare soil, 6 = water, ...
function maskS2withSCL(image) {
  // Read the SCL band.
  var scl = image.select('SCL');
  // Keep pixels that are NOT shadow (3), cloud (8, 9) or cirrus (10).
  var clearMask = scl.neq(3)                // not cloud shadow
    .and(scl.neq(8))                        // and not medium-probability cloud
    .and(scl.neq(9))                        // and not high-probability cloud
    .and(scl.neq(10));                      // and not thin cirrus
  // Scale to reflectance, apply the mask and keep the date.
  return ee.Image(image.select(['B2', 'B3', 'B4', 'B8', 'B11', 'B12']) // the bands we need
                       .multiply(0.0001)                               // to reflectance 0–1
                       .updateMask(clearMask)                          // hide cloudy pixels
                       .copyProperties(image, ['system:time_start'])); // keep the date
}

// Apply the SCL mask to the same monsoon images and take the median.
var monsoonCompositeSCL = s2Monsoon.map(maskS2withSCL).median().clip(aoi);

// Compare with layer 3. Cloud Score+ is usually cleaner around cloud edges.
Map.addLayer(monsoonCompositeSCL, s2Vis, '4) Monsoon median WITH SCL mask', false);


// =============================================================================
// PART 4 — Landsat 8/9 cloud masking with QA_PIXEL bits
// =============================================================================

// Landsat stores cloud information as BITS inside one number (the QA_PIXEL band).
// Think of it as a row of on/off switches:
//   bit 0 = fill (no data)     bit 1 = dilated cloud    bit 2 = cirrus
//   bit 3 = cloud              bit 4 = cloud shadow     bit 5 = snow
// "1 << 3" means "the number with only switch 3 turned on" (= 8).
// .bitwiseAnd(1 << 3) checks if switch 3 is on in each pixel.
function maskAndScaleLandsat(image) {
  // Read the quality band.
  var qa = image.select('QA_PIXEL');
  // TRUE where each problem is present.
  var fill = qa.bitwiseAnd(1 << 0).neq(0);         // bit 0: no data
  var dilatedCloud = qa.bitwiseAnd(1 << 1).neq(0); // bit 1: area around clouds
  var cirrus = qa.bitwiseAnd(1 << 2).neq(0);       // bit 2: thin high cloud
  var cloud = qa.bitwiseAnd(1 << 3).neq(0);        // bit 3: cloud
  var shadow = qa.bitwiseAnd(1 << 4).neq(0);       // bit 4: cloud shadow
  // A pixel is "bad" if ANY of the problems is present (.or combines them).
  var bad = fill.or(dilatedCloud).or(cirrus).or(cloud).or(shadow);
  // Saturated pixels (sensor overloaded) are also unusable: QA_RADSAT must be 0.
  var saturated = image.select('QA_RADSAT').neq(0);
  // Scale optical bands to reflectance: value × 0.0000275 − 0.2.
  var optical = image.select('SR_B.').multiply(0.0000275).add(-0.2);
  // Scale thermal band to Kelvin: value × 0.00341802 + 149.
  var thermal = image.select('ST_B10').multiply(0.00341802).add(149.0);
  // Replace the original bands with the scaled ones, then mask bad pixels.
  // .not() flips true/false, so we KEEP pixels that are NOT bad.
  return image.addBands(optical, null, true)
              .addBands(thermal, null, true)
              .updateMask(bad.not())
              .updateMask(saturated.not());
}

// Landsat 8 + Landsat 9 for Oct–Dec 2024, masked and scaled.
var landsatMasked = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')   // Landsat 8
  .merge(ee.ImageCollection('LANDSAT/LC09/C02/T1_L2'))              // + Landsat 9
  .filterBounds(aoi)                                                // our area
  .filterDate('2024-10-01', '2025-01-01')                           // Oct–Dec 2024
  .map(maskAndScaleLandsat);                                        // clean every image

// Count and composite.
print('Landsat 8+9 images, Oct–Dec 2024:', landsatMasked.size());
var landsatComposite = landsatMasked.median().clip(aoi);

// Show the Landsat composite.
Map.addLayer(landsatComposite, lsVis, '5) Landsat 8/9 median Oct–Dec 2024', false);


// =============================================================================
// PART 5 — A reusable function for Sentinel-2 composites
// =============================================================================

// We will make many composites, so we wrap all the steps into ONE function.
// Inputs: the region, a start date and an end date. Output: a cloud-free image.
function getS2Composite(region, startDate, endDate) {
  // Find, filter and mask the images.
  var collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(region)                                  // images over the region
    .filterDate(startDate, endDate)                        // within the dates
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 70))   // skip almost fully cloudy scenes (faster)
    .linkCollection(csPlus, ['cs_cdf'])                    // attach Cloud Score+
    .map(maskS2withCloudScore);                            // mask and scale each image
  // Median composite, clipped to the region.
  return collection.median().clip(region);
}

// The main post-monsoon composite of 2024 (October–December is usually clearest).
var postMonsoon2024 = getS2Composite(aoi, '2024-10-01', '2025-01-01');

// Show it — this is the layer switched ON.
Map.addLayer(postMonsoon2024, s2Vis, '6) S2 post-monsoon 2024 (median)');


// =============================================================================
// PART 6 — Other kinds of composites
// =============================================================================

// The masked collection for the same period (we need the collection, not the median).
var postMonsoonCollection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(aoi)                                   // our area
  .filterDate('2024-10-01', '2025-01-01')              // Oct–Dec 2024
  .linkCollection(csPlus, ['cs_cdf'])                  // attach Cloud Score+
  .map(maskS2withCloudScore);                          // mask and scale

// MEAN composite — sensitive to leftover clouds/shadows (outliers).
var meanComposite = postMonsoonCollection.mean().clip(aoi);
Map.addLayer(meanComposite, s2Vis, '7) Mean composite', false);

// PERCENTILE composite — e.g. the 25th percentile is darker than the median,
// which helps remove thin haze. Band names get a suffix: B4 → B4_p25.
var p25Composite = postMonsoonCollection.reduce(ee.Reducer.percentile([25])).clip(aoi);
Map.addLayer(p25Composite, {bands: ['B4_p25', 'B3_p25', 'B2_p25'], min: 0, max: 0.3},
             '8) 25th-percentile composite', false);

// GREENEST-PIXEL composite: for each pixel, take the whole observation from the
// date when NDVI was highest. First add an NDVI band to every image...
var withNdvi = postMonsoonCollection.map(function(image) {
  // NDVI = (NIR − red) / (NIR + red), explained in Script 08.
  return image.addBands(image.normalizedDifference(['B8', 'B4']).rename('NDVI'));
});

// ...then .qualityMosaic('NDVI') keeps, per pixel, the image with the highest NDVI.
var greenest = withNdvi.qualityMosaic('NDVI').clip(aoi);
Map.addLayer(greenest, s2Vis, '9) Greenest-pixel composite', false);


// =============================================================================
// PART 7 — How many CLEAR observations went into each pixel?
// =============================================================================

// .count() counts the unmasked (clear) values per pixel. We count one band (B4).
var clearCount = postMonsoonCollection.select('B4').count().clip(aoi);

// Show it: red = few clear observations, green = many.
Map.addLayer(clearCount, {min: 0, max: 30, palette: ['red', 'yellow', 'green']},
             '10) Number of clear observations', false);

// Print the min, mean and max count over the AOI (reducers are explained in Script 10).
print('Clear observations per pixel (min / mean / max):', clearCount.reduceRegion({
  reducer: ee.Reducer.minMax().combine(ee.Reducer.mean(), '', true), // min, max and mean together
  geometry: aoi,                                                     // over the AOI
  scale: 100,                                                        // 100 m is enough for a summary
  maxPixels: 1e9                                                     // allow many pixels
}));


// =============================================================================
// PART 8 — SEASONAL composites for one year
// =============================================================================

// A dictionary: season name → [start date, end date]. Seasons for northern India.
var seasons = {
  'Winter (Jan-Feb)': ['2024-01-01', '2024-03-01'],
  'Pre-monsoon (Mar-May)': ['2024-03-01', '2024-06-01'],
  'Monsoon (Jun-Sep)': ['2024-06-01', '2024-10-01'],
  'Post-monsoon (Oct-Dec)': ['2024-10-01', '2025-01-01']
};

// Object.keys() gives the list of season names; .forEach runs code for each name.
// (This loop runs in your browser, which is fine for adding a few map layers.)
Object.keys(seasons).forEach(function(seasonName) {
  // Look up this season's [start, end] dates.
  var dates = seasons[seasonName];
  // Make the composite for these dates.
  var seasonal = getS2Composite(aoi, dates[0], dates[1]);
  // Add it to the map (switched off) with the season in the layer name.
  Map.addLayer(seasonal, s2Vis, 'Season 2024: ' + seasonName, false);
});


// =============================================================================
// PART 9 — ANNUAL composites for several years
// =============================================================================

// A plain JavaScript list of years to compare.
var years = [2019, 2021, 2023, 2025];

// For each year, make an Oct–Dec composite and add it to the map.
years.forEach(function(year) {
  // Start date: 1 October of that year (text joined with +).
  var startDate = year + '-10-01';
  // End date: 1 January of the next year.
  var endDate = (year + 1) + '-01-01';
  // Build the composite.
  var annual = getS2Composite(aoi, startDate, endDate);
  // Add it to the map.
  Map.addLayer(annual, s2Vis, 'Oct-Dec ' + year, false);
});

// A FULL-YEAR composite (all seasons mixed) — useful for general base maps.
var fullYear2024 = getS2Composite(aoi, '2024-01-01', '2025-01-01');
Map.addLayer(fullYear2024, s2Vis, 'Full year 2024', false);


/*******************************************************************************
 * TRY IT YOURSELF
 *   1. Change CLEAR_THRESHOLD to 0.4 and to 0.8. What happens to cloud edges
 *      and to the number of clear observations (layer 10)?
 *   2. Add snow (SCL class 11) to the SCL mask. Where does it make a difference?
 *   3. Use getS2Composite() to make a composite for Mar–May 2025.
 *   4. Make a Landsat composite for Oct–Dec 2014 (Landsat 8 only) and compare
 *      it with 2024. What has changed around Mandi town?
 ******************************************************************************/
