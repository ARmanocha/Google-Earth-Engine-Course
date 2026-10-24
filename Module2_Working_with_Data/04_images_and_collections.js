/*******************************************************************************
 * GOOGLE EARTH ENGINE FOR BEGINNERS
 * Module 2 · Script 04 — Images and ImageCollections; filtering and clipping
 * -----------------------------------------------------------------------------
 * RASTER DATA in Earth Engine comes in two levels:
 *
 *   ee.Image            → ONE raster with one or more BANDS (layers of values)
 *                         plus PROPERTIES (metadata such as date, cloud cover).
 *   ee.ImageCollection  → a STACK of images (e.g. every Sentinel-2 image ever taken).
 *
 * WHAT YOU WILL LEARN
 *   • Inspect an image: bands, properties, pixel size
 *   • Filter a collection by AREA, DATE and METADATA
 *   • Count, list and pick images from a collection
 *   • Select bands, clip to a study area, and choose visualisation settings
 *   • The difference between .mosaic() and .median()
 ******************************************************************************/


// =============================================================================
// PART 0 — Study area
// =============================================================================

// Our study area: a rectangle around Mandi, Himachal Pradesh, India.
// ee.Geometry.Rectangle([west, south, east, north]) in degrees.
// ► To study your own area, change these four numbers.
var aoi = ee.Geometry.Rectangle([76.75, 31.45, 77.25, 31.85]);

// Zoom to the study area.
Map.centerObject(aoi, 10);

// Draw the study area outline. .style() with a transparent fill shows only the edge.
Map.addLayer(ee.FeatureCollection([ee.Feature(aoi)]).style({color: 'yellow', fillColor: '00000000'}),
             {}, 'Study area');


// =============================================================================
// PART 1 — A single ee.Image: the SRTM DEM
// =============================================================================

// Load the SRTM 30 m digital elevation model (one global image).
var dem = ee.Image('USGS/SRTMGL1_003');

// .bandNames() lists the bands. SRTM has a single band called 'elevation'.
print('DEM band names:', dem.bandNames());

// .projection() describes the coordinate system; .nominalScale() = pixel size in metres.
print('DEM pixel size (m):', dem.projection().nominalScale());

// .select('band') keeps just one band (useful when an image has many).
var elevation = dem.select('elevation');

// Add it to the map in greyscale (no palette → black to white).
Map.addLayer(elevation, {min: 500, max: 4000}, 'Elevation (grey)', false);


// =============================================================================
// PART 2 — An ee.ImageCollection: Sentinel-2
// =============================================================================

// Load the whole Sentinel-2 Level-2A (surface reflectance) collection.
// It contains MILLIONS of images — we never print it unfiltered!
var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED');

// ---- Filter by AREA ---------------------------------------------------------
// .filterBounds(geometry) keeps images whose footprint touches our study area.
var s2Aoi = s2.filterBounds(aoi);

// ---- Filter by DATE ---------------------------------------------------------
// .filterDate(start, end) keeps images from the start date up to (NOT including)
// the end date. Format: 'YYYY-MM-DD'.
var s2Aoi2024 = s2Aoi.filterDate('2024-01-01', '2025-01-01');

// .size() counts how many images are left.
print('S2 images over AOI in 2024:', s2Aoi2024.size());

// ---- Filter by METADATA (a property) ---------------------------------------
// Every Sentinel-2 image has a property CLOUDY_PIXEL_PERCENTAGE (0–100).
// ee.Filter.lt(property, value) keeps images where the property is LESS THAN value.
var s2Clear = s2Aoi2024.filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10));

// Count again — far fewer images are this clear.
print('...of which less than 10 % cloudy:', s2Clear.size());

// ---- Filter by MONTH regardless of year ------------------------------------
// ee.Filter.calendarRange(10, 12, 'month') keeps images from October to December.
var s2PostMonsoon = s2Clear.filter(ee.Filter.calendarRange(10, 12, 'month'));
print('...and taken in Oct–Dec:', s2PostMonsoon.size());

// ---- All filters in one chain (this is how you normally write it) -----------
var s2Filtered = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED') // start with all images
  .filterBounds(aoi)                                                // in our area
  .filterDate('2024-01-01', '2025-01-01')                           // in 2024
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10));             // mostly cloud-free

// Print the filtered collection (safe — it is now small). Expand it in the Console.
print('Filtered collection:', s2Filtered);


// =============================================================================
// PART 3 — Looking at the metadata of a collection
// =============================================================================

// .aggregate_array('property') pulls a property out of every image as a list.
print('Cloud % of each image:', s2Filtered.aggregate_array('CLOUDY_PIXEL_PERCENTAGE'));

// 'system:index' is the unique ID of each image (contains date and tile).
print('Image IDs:', s2Filtered.aggregate_array('system:index'));

// Sentinel-2 is cut into 110 × 110 km tiles. .distinct() removes duplicates
// so we see which tiles cover our area.
print('MGRS tiles covering the AOI:', s2Filtered.aggregate_array('MGRS_TILE').distinct());

// Which satellites took the images? (Sentinel-2A, -2B, -2C)
print('Satellites:', s2Filtered.aggregate_array('SPACECRAFT_NAME').distinct());


// =============================================================================
// PART 4 — Picking single images out of a collection
// =============================================================================

// .sort('property') orders images (smallest first); .first() takes the top one.
var clearest = s2Filtered.sort('CLOUDY_PIXEL_PERCENTAGE').first();

// .first() returns a generic object, so wrap it in ee.Image() to be safe.
clearest = ee.Image(clearest);

// List the bands of a Sentinel-2 image (B1–B12, B8A, SCL, QA60, ...).
print('Sentinel-2 bands:', clearest.bandNames());

// .get('property') reads ONE property of an image.
print('Cloud % of clearest image:', clearest.get('CLOUDY_PIXEL_PERCENTAGE'));

// .date() gives the acquisition date; .format() makes it readable.
print('Date of clearest image:', clearest.date().format('YYYY-MM-dd'));

// .propertyNames() lists ALL metadata fields stored with the image.
print('All property names:', clearest.propertyNames());

// Different bands have different pixel sizes in Sentinel-2:
print('Pixel size of B4 (m):', clearest.select('B4').projection().nominalScale());   // 10 m
print('Pixel size of B11 (m):', clearest.select('B11').projection().nominalScale()); // 20 m
print('Pixel size of B1 (m):', clearest.select('B1').projection().nominalScale());   // 60 m

// To get the N-th image, turn the collection into a list and use .get(index).
// .toList(5) makes a list of (up to) the first 5 images; index 1 = the 2nd image.
var secondImage = ee.Image(s2Filtered.toList(5).get(1));
print('Date of the 2nd image in the collection:', secondImage.date().format('YYYY-MM-dd'));


// =============================================================================
// PART 5 — Visualisation parameters
// =============================================================================

// TRUE COLOUR: red, green, blue bands → looks like a photograph.
var trueColour = {bands: ['B4', 'B3', 'B2'], min: 0, max: 3000};

// FALSE COLOUR (NIR): vegetation appears red. Great for crops and forests.
var falseColour = {bands: ['B8', 'B4', 'B3'], min: 0, max: 4000};

// SWIR COMPOSITE: SWIR-2, NIR, red. Separates water (dark), bare soil, burnt
// areas and vegetation (green) very clearly.
var swirColour = {bands: ['B12', 'B8', 'B4'], min: 0, max: 4000};

// "gamma" brightens (>1) or darkens (<1) the mid-tones.
var brightTrueColour = {bands: ['B4', 'B3', 'B2'], min: 0, max: 3000, gamma: 1.4};

// Add the clearest image with each style. Only the first is switched on.
Map.addLayer(clearest, trueColour, 'Clearest image — true colour');
Map.addLayer(clearest, falseColour, 'Clearest image — NIR false colour', false);
Map.addLayer(clearest, swirColour, 'Clearest image — SWIR false colour', false);
Map.addLayer(clearest, brightTrueColour, 'Clearest image — gamma 1.4', false);

// A SINGLE band can be coloured with a palette (multi-band images cannot).
Map.addLayer(clearest.select('B8'), {min: 0, max: 5000, palette: ['black', 'white', 'green']},
             'Clearest image — NIR band only', false);


// =============================================================================
// PART 6 — Clipping
// =============================================================================

// .clip(geometry) cuts an image to the shape of the study area.
// Pixels outside become transparent ("masked").
var clearestClipped = clearest.clip(aoi);

// Show the clipped version.
Map.addLayer(clearestClipped, trueColour, 'Clearest image — clipped to AOI', false);

// To clip EVERY image in a collection, use .map() with a small function.
var s2ClippedCollection = s2Filtered.map(function(image) {
  // Return the image cut to the AOI.
  return image.clip(aoi);
});

// The collection still has the same number of images, just smaller ones.
print('Clipped collection size:', s2ClippedCollection.size());

// TIP: You do NOT need to clip before calculating statistics — tell the
// calculation which region to use instead. Clipping is mostly for nice maps
// and smaller exports.


// =============================================================================
// PART 7 — From a collection to one image: mosaic vs. median
// =============================================================================

// .mosaic() stacks images like sheets of paper: the LAST image is on top.
// It keeps original pixels, but you can see seams and clouds.
var mosaic = s2Filtered.mosaic().clip(aoi);

// .median() takes, for each pixel, the MIDDLE value of all images.
// Clouds (very bright) and shadows (very dark) are often removed this way.
// This is called a "composite" — we do it properly in Module 3.
var median = s2Filtered.median().clip(aoi);

// Show both to compare.
Map.addLayer(mosaic, trueColour, 'Mosaic (last image on top)', false);
Map.addLayer(median, trueColour, 'Median composite');


// =============================================================================
// PART 8 — Other ways to filter
// =============================================================================

// Only images from one satellite.
var onlyS2A = s2Filtered.filter(ee.Filter.eq('SPACECRAFT_NAME', 'Sentinel-2A'));
print('Images from Sentinel-2A only:', onlyS2A.size());

// .limit(n, 'property') keeps only the n images with the smallest property values.
var fiveClearest = s2Aoi2024.limit(5, 'CLOUDY_PIXEL_PERCENTAGE');
print('Dates of the 5 clearest images of 2024:',
      fiveClearest.aggregate_array('system:time_start').map(function(t) {
        // Each value is milliseconds since 1970; convert it to a readable date.
        return ee.Date(t).format('YYYY-MM-dd');
      }));

// Filter images that cover a single POINT (e.g. a field site).
var overLake = s2Filtered.filterBounds(ee.Geometry.Point([77.1009, 31.7543]));
print('Clear 2024 images over Prashar Lake:', overLake.size());


/*******************************************************************************
 * TRY IT YOURSELF
 *   1. Change the date range to 2019 and compare the number of images.
 *   2. Change the cloud filter to 30 %. How many more images do you get?
 *   3. Use ee.Filter.calendarRange(3, 5, 'month') to keep only Mar–May images and
 *      make a median composite. Compare it with the Oct–Dec composite.
 *   4. Load Landsat 9 instead: 'LANDSAT/LC09/C02/T1_L2' and filter with the
 *      property 'CLOUD_COVER'. Print the band names — they differ from Sentinel-2!
 ******************************************************************************/
