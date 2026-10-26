/*******************************************************************************
 * GOOGLE EARTH ENGINE FOR BEGINNERS
 * Module 3 · Script 09 — Functions and mapping over collections
 * -----------------------------------------------------------------------------
 * In Earth Engine we almost never use for-loops on images. Instead we:
 *   1. write a FUNCTION that does the job for ONE item (one image / one feature);
 *   2. use .map(function) to run it on EVERY item of a collection, in parallel,
 *      on Google's servers.
 *
 * WHAT YOU WILL LEARN
 *   • Writing functions that take an image and return an image
 *   • .map() over an ImageCollection, a FeatureCollection and an ee.List
 *   • Adding new bands and properties (date, month, NDVI …) to every image
 *   • Functions that need extra settings ("function factories")
 *   • Building monthly composites with ee.List.sequence + map
 *   • The golden rules (and common errors) of map()
 ******************************************************************************/


// =============================================================================
// PART 0 — Study area and the raw collection
// =============================================================================

// Study area rectangle [west, south, east, north].
var aoi = ee.Geometry.Rectangle([76.75, 31.45, 77.25, 31.85]);

// Zoom to it.
Map.centerObject(aoi, 10);

// Cloud Score+ for cloud masking.
var csPlus = ee.ImageCollection('GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED');

// All Sentinel-2 images over the AOI in 2024, with the cloud score attached.
var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(aoi)                         // our area
  .filterDate('2024-01-01', '2025-01-01')    // the year 2024
  .linkCollection(csPlus, ['cs_cdf']);       // add the cs_cdf band to each image

// How many images do we start with?
print('Raw S2 images in 2024:', s2.size());


// =============================================================================
// PART 1 — A function for ONE image
// =============================================================================

// Function 1: mask clouds and scale to reflectance.
// INPUT: one Sentinel-2 image.   OUTPUT: one cleaned image.
function maskAndScale(image) {
  // Clear pixels have a Cloud Score+ value of at least 0.6.
  var clear = image.select('cs_cdf').gte(0.6);
  // Select the reflectance bands and scale them from 0–10000 to 0–1.
  var scaled = image.select(['B2', 'B3', 'B4', 'B8', 'B11', 'B12']).multiply(0.0001);
  // Hide cloudy pixels, copy the date back, and RETURN the result.
  // (A function used in .map() MUST return something.)
  return ee.Image(scaled.updateMask(clear).copyProperties(image, ['system:time_start']));
}

// Function 2: add an NDVI band to an image.
function addNDVI(image) {
  // Compute NDVI and name the band.
  var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
  // Return the ORIGINAL image with NDVI added as an extra band.
  return image.addBands(ndvi);
}

// Test the functions on ONE image first — always a good habit.
var testImage = addNDVI(maskAndScale(s2.first()));

// Print its bands: B2 … B12 plus NDVI.
print('Bands after our two functions:', testImage.bandNames());


// =============================================================================
// PART 2 — .map() over an ImageCollection
// =============================================================================

// Run the functions on EVERY image. .map() can be chained.
var s2Clean = s2
  .map(maskAndScale)     // step 1: clean each image
  .map(addNDVI);         // step 2: add NDVI to each image

// Same number of images, but each one is now cleaned and has NDVI.
print('Images after mapping:', s2Clean.size());
print('First cleaned image:', s2Clean.first());

// A composite of the NDVI band only: the maximum NDVI of each pixel in 2024.
var maxNdvi = s2Clean.select('NDVI').max().clip(aoi);

// Show it.
Map.addLayer(maxNdvi, {min: 0, max: 0.9, palette: ['white', 'yellow', 'green', 'darkgreen']},
             'Maximum NDVI 2024');


// =============================================================================
// PART 3 — Adding PROPERTIES (metadata) to every image
// =============================================================================

// Function 3: store the month, year and day-of-year as properties.
function addDateProperties(image) {
  // Get the acquisition date of this image.
  var date = image.date();
  // .set() adds properties and returns the image.
  return image.set({
    month: date.get('month'),                        // 1–12
    year: date.get('year'),                          // e.g. 2024
    doy: date.getRelative('day', 'year').add(1),     // day of year 1–366
    date_text: date.format('YYYY-MM-dd')             // readable date
  });
}

// Map it over the collection.
var s2WithDates = s2Clean.map(addDateProperties);

// Now we can FILTER on our own properties, e.g. only November images.
var november = s2WithDates.filter(ee.Filter.eq('month', 11));
print('Images in November 2024:', november.size());

// And list them.
print('Dates of the November images:', november.aggregate_array('date_text'));


// =============================================================================
// PART 4 — Adding a BAND that holds the date (needed for trend analysis)
// =============================================================================

// Function 4: add a constant band with the image's time in fractional years.
function addTimeBand(image) {
  // Years since 1 Jan 2024, e.g. 0.5 for 1 July 2024.
  var years = image.date().difference(ee.Date('2024-01-01'), 'year');
  // ee.Image(number) makes an image where every pixel has that value.
  var timeBand = ee.Image(years).float().rename('t');
  // Add it to the image.
  return image.addBands(timeBand);
}

// Apply it and check the band list.
var s2WithTime = s2Clean.map(addTimeBand);
print('Bands with the time band:', s2WithTime.first().bandNames());


// =============================================================================
// PART 5 — Functions that need SETTINGS (a "function factory")
// =============================================================================

// .map() always gives the function exactly ONE input (the image). If we want
// to choose the bands too, we write a function that BUILDS and returns
// another function with the settings "baked in".
function makeIndexAdder(bandA, bandB, indexName) {
  // This inner function is what .map() will actually run.
  return function(image) {
    // (bandA − bandB) / (bandA + bandB), named indexName.
    return image.addBands(image.normalizedDifference([bandA, bandB]).rename(indexName));
  };
}

// Build three ready-made functions from the factory.
var addNDWI = makeIndexAdder('B3', 'B8', 'NDWI');     // water
var addNDBI = makeIndexAdder('B11', 'B8', 'NDBI');    // built-up
var addNBR = makeIndexAdder('B8', 'B12', 'NBR');      // burn

// Use them like any other function.
var s2AllIndices = s2Clean.map(addNDWI).map(addNDBI).map(addNBR);
print('Bands after the factory functions:', s2AllIndices.first().bandNames());


// =============================================================================
// PART 6 — .map() over a FeatureCollection
// =============================================================================

// A few sites (points).
var sites = ee.FeatureCollection([
  ee.Feature(ee.Geometry.Point([76.9318, 31.7084]), {name: 'Mandi town'}),
  ee.Feature(ee.Geometry.Point([77.1009, 31.7543]), {name: 'Prashar Lake'}),
  ee.Feature(ee.Geometry.Point([76.9000, 31.5900]), {name: 'Balh valley'})
]);

// For each site: make a 500 m buffer and calculate the mean of the max-NDVI inside it.
var siteNdvi = sites.map(function(feature) {
  // A 500 m circle around the point.
  var circle = feature.geometry().buffer(500);
  // The mean NDVI inside the circle (reduceRegion → see Script 10).
  var stats = maxNdvi.reduceRegion({
    reducer: ee.Reducer.mean(),   // average
    geometry: circle,             // inside the circle
    scale: 10                     // at 10 m
  });
  // Store the answer as a new property, and make the feature's shape the circle.
  return feature.setGeometry(circle).set('mean_max_ndvi', stats.get('NDVI'));
});

// Print the table: each site now has a mean_max_ndvi value.
print('Mean of maximum NDVI around each site:', siteNdvi);

// Show the circles.
Map.addLayer(siteNdvi, {color: 'red'}, 'Site buffers (500 m)');


// =============================================================================
// PART 7 — .map() over an ee.List: MONTHLY composites
// =============================================================================

// A server-side list of months: [1, 2, … 12].
var months = ee.List.sequence(1, 12);

// For each month, build one median composite and return it as an image.
var monthlyImages = months.map(function(m) {
  // Keep only images taken in month m (calendarRange works on the image date).
  var monthCollection = s2Clean.filter(ee.Filter.calendarRange(m, m, 'month'));
  // Median NDVI of that month, with the month and image count stored as properties.
  return monthCollection.select('NDVI')                   // just the NDVI band
                        .median()                         // the monthly composite
                        .set('month', m)                  // remember which month
                        .set('n_images', monthCollection.size()) // how many images were used
                        .set('system:time_start', ee.Date.fromYMD(2024, m, 15).millis()); // a date for charts
});

// Turn the list of images into an ImageCollection.
var monthlyNdvi = ee.ImageCollection.fromImages(monthlyImages);

// 12 images, one per month.
print('Monthly NDVI collection:', monthlyNdvi);

// How many S2 images were available each month? (The monsoon has fewer clear ones.)
print('Images per month:', monthlyNdvi.aggregate_array('n_images'));

// A quick chart of the AOI-average NDVI for each month (charts → Script 11).
print(ui.Chart.image.series({
  imageCollection: monthlyNdvi,       // the 12 monthly images
  region: aoi,                        // average over the AOI
  reducer: ee.Reducer.mean(),         // mean
  scale: 100                          // 100 m is fine for an average
}).setOptions({title: 'Monthly median NDVI, 2024', vAxis: {title: 'NDVI'}, hAxis: {title: 'Month'}}));

// Colours for the monthly NDVI maps.
var ndviVis = {min: 0, max: 0.8, palette: ['white', 'yellow', 'green', 'darkgreen']};

// Pick single months out of the list: index 3 = April, index 9 = October
// (lists count from 0). ee.Image() tells Earth Engine the item is an image.
var aprilNdvi = ee.Image(monthlyImages.get(3)).clip(aoi);
var octoberNdvi = ee.Image(monthlyImages.get(9)).clip(aoi);

// Show the April and October composites to compare.
Map.addLayer(aprilNdvi, ndviVis, 'NDVI April 2024', false);
Map.addLayer(octoberNdvi, ndviVis, 'NDVI October 2024', false);


// =============================================================================
// PART 8 — The GOLDEN RULES of .map()
// =============================================================================

// Rule 1: The function must RETURN an object of the same kind (image → image,
//         feature → feature). Forgetting "return" is the most common error.
//
// Rule 2: Inside .map() you are on the SERVER. Do NOT use:
//           print(), Map.addLayer(), .getInfo(), ordinary if/else on ee objects.
//
// Rule 3: To make a decision inside .map(), use server-side tools. Example below.
//
// Rule 4: Items from a list or .first() are "generic" — wrap them:
//           ee.Number(x), ee.Image(x), ee.Feature(x)   so methods work.

// Example for Rule 3: label each image 'clear' or 'cloudy' with ee.Algorithms.If.
var labelled = s2.map(function(image) {
  // CLOUDY_PIXEL_PERCENTAGE of this image (a server-side number).
  var cloud = ee.Number(image.get('CLOUDY_PIXEL_PERCENTAGE'));
  // ee.Algorithms.If(condition, valueIfTrue, valueIfFalse) — a server-side if.
  var label = ee.Algorithms.If(cloud.lt(20), 'clear', 'cloudy');
  // Store the label as a property.
  return image.set('sky', label);
});

// Count each label.
print('Clear images (<20 % cloud):', labelled.filter(ee.Filter.eq('sky', 'clear')).size());
print('Cloudy images:', labelled.filter(ee.Filter.eq('sky', 'cloudy')).size());

// TIP: Often a FILTER is simpler and faster than ee.Algorithms.If, e.g.
//      s2.filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))


/*******************************************************************************
 * TRY IT YOURSELF
 *   1. Write a function addEVI(image) using .expression() (see Script 08) and
 *      map it over s2Clean.
 *   2. Use makeIndexAdder to add MNDWI ('B3', 'B11').
 *   3. Change PART 7 to make monthly composites of MNDWI. When is Pandoh
 *      reservoir largest?
 *   4. Make YEARLY maximum-NDVI composites for 2019–2024 with
 *      ee.List.sequence(2019, 2024).map(...). (Hint: use ee.Date.fromYMD(y, 1, 1)
 *      and .advance(1, 'year') for the date range.)
 ******************************************************************************/
