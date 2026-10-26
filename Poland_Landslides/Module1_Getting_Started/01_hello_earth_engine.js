/*******************************************************************************
 * GOOGLE EARTH ENGINE FOR BEGINNERS — Landslides in the Polish Carpathians
 * Module 1 · Script 01 — Hello, Earth Engine!
 * -----------------------------------------------------------------------------
 * WHAT YOU WILL LEARN
 *   • How to run a script and read the Console
 *   • How to move the map and change the background map
 *   • How to load a dataset and show it on the map
 *   • How to use the Inspector to read pixel values
 *
 * HOW TO USE
 *   1. Open https://code.earthengine.google.com
 *   2. Paste this whole file into the middle panel.
 *   3. Press "Run" (or Ctrl/Cmd + Enter).
 *
 * READING THIS SCRIPT
 *   Everything after // on a line is a COMMENT. Earth Engine ignores comments;
 *   they are notes for humans. Every line of real code has a comment above it
 *   (or at the end of it) explaining what it does.
 ******************************************************************************/


// =============================================================================
// PART 1 — Printing to the Console
// =============================================================================

// print() writes something into the "Console" tab on the right of the screen.
// Text must be wrapped in quotes. 'single' and "double" quotes both work.
// The semicolon ; at the end marks the end of an instruction (like a full stop).
print('Hello, Earth Engine!');

// print() can show several things at once — separate them with commas.
// Here the first item is text, the second is a calculation (2 + 3 = 5).
print('Two plus three equals:', 2 + 3);


// =============================================================================
// PART 2 — Moving the map
// =============================================================================

// Map.setCenter(longitude, latitude, zoom) moves the map to a place.
//   • longitude = east–west position (the "x"). Here 20.42 °E.
//   • latitude  = north–south position (the "y"). Here 49.71 °N.
//   • zoom      = 1 (whole world) … 20+ (single buildings). 10 ≈ a district.
// NOTE: Earth Engine ALWAYS wants longitude FIRST, then latitude.
// This is Limanowa, a town in the Beskid Wyspowy mountains of southern Poland.
Map.setCenter(20.42, 49.71, 10);

// Map.setOptions() changes the background (basemap) under your layers.
// Options are 'ROADMAP', 'SATELLITE', 'HYBRID' (satellite + labels), 'TERRAIN'.
Map.setOptions('HYBRID');


// =============================================================================
// PART 3 — Your first Earth Engine object: a point
// =============================================================================

// "var" creates a VARIABLE: a named box that stores something so we can reuse it.
// ee.Geometry.Point([longitude, latitude]) creates a point on the Earth.
// Anything starting with "ee." is an Earth Engine object that lives on
// Google's servers. Here: the village of Kłodne near Limanowa, where a large
// landslide started on 1 June 2010 after weeks of heavy rain.
// (The point is the village centre — approximate, not the exact landslide.)
var klodne = ee.Geometry.Point([20.5661, 49.6850]);

// Map.addLayer(what, how-to-draw-it, layer-name) puts something on the map.
//   • what           → the variable we want to show (our point)
//   • how-to-draw-it → visualisation options inside { } — here a red colour
//   • layer-name     → the name shown in the "Layers" menu (top-right of map)
Map.addLayer(klodne, {color: 'red'}, 'Kłodne (2010 landslide)');

// print() an Earth Engine object to see what is inside it.
// In the Console, click the small grey triangles to expand the details.
print('Our point:', klodne);


// =============================================================================
// PART 4 — Loading a dataset: a Digital Elevation Model (DEM)
// =============================================================================

// ee.Image('ID') loads ONE raster image from the Earth Engine data catalog.
// 'USGS/SRTMGL1_003' is the NASA SRTM elevation model (30 m pixels).
// Each pixel stores the height of the ground above sea level, in metres.
// Landslides happen on SLOPES, so elevation is the first dataset we look at.
var dem = ee.Image('USGS/SRTMGL1_003');

// Print the image to see its bands (layers of values) and properties (metadata).
print('SRTM elevation image:', dem);

// Visualisation parameters tell Earth Engine HOW to colour the pixels.
// They are written as a JavaScript "object": {key: value, key: value}.
//   • min     → pixels at or below this value get the FIRST colour
//   • max     → pixels at or above this value get the LAST colour
//   • palette → list of colours from low to high (names or hex codes)
var demVis = {
  min: 250,                                          // 250 m and lower = dark green (valleys)
  max: 1150,                                         // 1150 m and higher = white (summits)
  palette: ['006837', '78c679', 'ffffbf', 'd7b26b', '8c510a', 'ffffff'] // low → high
};

// Add the DEM to the map using the colours defined above.
Map.addLayer(dem, demVis, 'Elevation (m)');

// ee.Terrain.hillshade() makes a shaded-relief picture from the DEM, as if the
// sun shone from the north-west. Ridges, valleys and slopes become easy to see.
var hillshade = ee.Terrain.hillshade(dem);

// Add it switched OFF (the 4th argument "false"); tick it in the Layers menu.
Map.addLayer(hillshade, {min: 0, max: 255}, 'Hillshade', false);


// =============================================================================
// PART 5 — Loading a satellite image (Sentinel-2)
// =============================================================================

// Satellites take a NEW picture every few days, so most satellite datasets are
// ImageCollections (a stack of many images), not a single Image.
// The dots at the start of the next lines continue the same instruction:
// each line takes the result of the previous line and does one more thing.
var s2Image = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED') // all Sentinel-2 surface-reflectance images on Earth
  .filterBounds(klodne)                                         // keep only images that cover our point
  .filterDate('2024-06-01', '2024-09-01')                       // keep only images from June–August 2024
  .sort('CLOUDY_PIXEL_PERCENTAGE')                              // order them from least cloudy to most cloudy
  .first();                                                     // take the first one = the least cloudy image

// Print the chosen image. Expand it in the Console to see its 20+ bands.
print('Least cloudy Sentinel-2 image:', s2Image);

// Print the date the image was taken.
// .date() gets the acquisition date; .format() turns it into readable text.
print('Image date:', s2Image.date().format('YYYY-MM-dd'));

// Sentinel-2 bands: B2 = blue, B3 = green, B4 = red, B8 = near-infrared (NIR).
// A "true colour" picture puts red, green and blue into the screen's R, G, B.
// Sentinel-2 values are reflectance × 10000, so 0–3000 means 0–30 % reflectance.
var trueColourVis = {
  bands: ['B4', 'B3', 'B2'], // red, green, blue → looks like a normal photo
  min: 0,                    // darkest value
  max: 3000                  // brightest value
};

// Show the image in true colour.
Map.addLayer(s2Image, trueColourVis, 'Sentinel-2 true colour');

// A "false colour" picture puts NIR into the red channel.
// Healthy vegetation reflects lots of NIR, so it appears BRIGHT RED.
// Bare soil — such as a fresh landslide scar — stays dull grey-brown.
var falseColourVis = {
  bands: ['B8', 'B4', 'B3'], // NIR, red, green
  min: 0,                    // darkest value
  max: 4000                  // brightest value
};

// The 4th argument "false" adds the layer switched OFF.
// Turn it on in the Layers menu (top-right of the map) to compare.
Map.addLayer(s2Image, falseColourVis, 'Sentinel-2 false colour', false);


// =============================================================================
// PART 6 — Using the Inspector
// =============================================================================

// No code here — try this by hand:
//   1. Click the "Inspector" tab (top of the right panel).
//   2. Click anywhere on the map.
//   3. You will see the value of every layer at that pixel:
//        • the elevation in metres from the DEM
//        • the B4/B3/B2/B8 values from Sentinel-2
//   4. Click on forest, a meadow, the Rożnów Reservoir and the town of Limanowa.
//      How do the B8 (NIR) values differ?


// =============================================================================
// PART 7 — Centre the map on an object
// =============================================================================

// Map.centerObject(object, zoom) zooms the map to fit an object.
// Here we zoom to our point at zoom level 14 to look at the hillside closely.
Map.centerObject(klodne, 14);


/*******************************************************************************
 * TRY IT YOURSELF
 *   1. Change the point to your own town. (Find coordinates by clicking the map
 *      with the Inspector, or from Google Maps: right-click → copy.)
 *      Remember: [longitude, latitude].
 *   2. Change the dates in PART 5 to '2024-01-01', '2024-03-01'. What does the
 *      landscape look like in winter? (Snow is very bright in B2, B3 and B4.)
 *   3. Make a new false-colour layer with bands ['B12', 'B8', 'B4'] (SWIR, NIR,
 *      red). What colour are water, forest and bare soil?
 *   4. Switch on the Hillshade layer and zoom around Kłodne. Can you see the
 *      ridges and valleys? (A 30 m DEM is too coarse to show most landslides —
 *      Script 05 explains which elevation data can.)
 ******************************************************************************/
