/*******************************************************************************
 * GOOGLE EARTH ENGINE FOR BEGINNERS
 * FINAL PROJECT · Script 14 — Maps of YOUR study area
 * -----------------------------------------------------------------------------
 * This template brings the whole course together. Change the SETTINGS in
 * PART 0 to your own study area and years, press Run, and you get:
 *
 *   MAP LAYERS   true colour · false colour · elevation with hillshade · NDVI ·
 *                land-cover classification · NDVI change
 *   MAP LAYOUT   title · legend · NDVI colour bar · location (inset) map ·
 *                north arrow · scale bar · summary statistics side panel
 *   OUTPUTS      PNG map images (download links) · GeoTIFFs and CSV to Google Drive
 *
 * Final-project checklist for students:
 *   [ ] Your own study area (shapefile asset or drawn polygon)
 *   [ ] A cloud-free composite and at least two indices
 *   [ ] A land-cover classification with an accuracy assessment
 *   [ ] A change analysis between two years
 *   [ ] Finished maps with title, legend, scale, north arrow and data sources
 *   [ ] A short report: methods, maps, area table, accuracy, discussion
 ******************************************************************************/


// =============================================================================
// PART 0 — SETTINGS (the only part you normally need to change)
// =============================================================================

// ► Your name (shown under the map title).
var AUTHOR = 'Student name';

// ► The map title.
var MAP_TITLE = 'Land cover and vegetation of the Mandi study area';

// ► Your study area. Option 1: a rectangle [west, south, east, north].
var aoi = ee.Geometry.Rectangle([76.75, 31.45, 77.25, 31.85]);

// ► Option 2: your uploaded shapefile — un-comment the next line and edit the path.
// var aoi = ee.FeatureCollection('projects/YOUR-PROJECT-ID/assets/study_area').geometry();

// ► Option 3: draw a polygon with the map tools, then un-comment:  var aoi = geometry;

// ► The main year to map.
var YEAR = 2024;

// ► The first and last month of the season used for the composite (10–12 = Oct–Dec).
var START_MONTH = 10;
var END_MONTH = 12;

// ► An earlier year for the change analysis (the same season is used).
var BASE_YEAR = 2019;

// ► Land-cover class names, in the order of the class codes 0, 1, 2, 3, 4, 5.
var classNames = ['Water', 'Forest', 'Shrub & grass', 'Cropland', 'Built-up', 'Bare / snow'];

// ► One colour per class, in the same order as the names.
var classPalette = ['1f78b4', '1b7837', 'a6d96a', 'fdae61', 'e31a1c', 'bdbdbd'];


// =============================================================================
// PART 1 — Helper functions
// =============================================================================

// Cloud Score+ collection, used to mask clouds in Sentinel-2.
var csPlus = ee.ImageCollection('GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED');

// Function: a cloud-free Sentinel-2 composite (reflectance 0–1) for one year's season.
function seasonalComposite(year) {
  // First day of the start month.
  var start = ee.Date.fromYMD(year, START_MONTH, 1);
  // First day AFTER the end month (so that the end month is included).
  var end = ee.Date.fromYMD(year, END_MONTH, 1).advance(1, 'month');
  // Find, mask, scale and composite the images.
  return ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(aoi)                                     // images over the AOI
    .filterDate(start, end)                                // in the season
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 70))   // skip very cloudy scenes
    .linkCollection(csPlus, ['cs_cdf'])                    // attach the cloud score
    .map(function(img) {                                   // for each image:
      return img.select(['B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B11', 'B12']) //   keep these bands
                .multiply(0.0001)                                              //   scale to 0–1
                .updateMask(img.select('cs_cdf').gte(0.6));                    //   hide clouds
    })
    .median()                                              // median composite
    .clip(aoi);                                            // cut to the AOI
}

// Function: total area (km²) of the pixels where a 0/1 image equals 1.
function areaKm2(maskImage, scale) {
  // Keep each pixel's area only where the mask is 1, then add them up.
  var sum = ee.Image.pixelArea().updateMask(maskImage).reduceRegion({
    reducer: ee.Reducer.sum(),   // add up
    geometry: aoi,               // inside the AOI
    scale: scale,                // at this pixel size (metres)
    maxPixels: 1e10              // allow many pixels
  });
  // pixelArea's band is called 'area'; convert m² → km² and return the number.
  return ee.Number(sum.get('area')).divide(1e6);
}


// =============================================================================
// PART 2 — Data: composites, indices and terrain
// =============================================================================

// Composite for the main year.
var composite = seasonalComposite(YEAR);

// Composite for the base (earlier) year.
var baseComposite = seasonalComposite(BASE_YEAR);

// NDVI — vegetation.
var ndvi = composite.normalizedDifference(['B8', 'B4']).rename('NDVI');

// NDWI — water.
var ndwi = composite.normalizedDifference(['B3', 'B8']).rename('NDWI');

// NDBI — built-up.
var ndbi = composite.normalizedDifference(['B11', 'B8']).rename('NDBI');

// NDVI of the base year.
var ndviBase = baseComposite.normalizedDifference(['B8', 'B4']).rename('NDVI');

// NDVI change = main year − base year (negative = vegetation decreased).
var dNDVI = ndvi.subtract(ndviBase).rename('dNDVI');

// SRTM elevation (m), cut to the AOI.
var dem = ee.Image('USGS/SRTMGL1_003').clip(aoi);

// Slope in degrees.
var slope = ee.Terrain.slope(dem);

// Shaded relief (0–255).
var hillshade = ee.Terrain.hillshade(dem);


// =============================================================================
// PART 3 — Land-cover classification (Random Forest) + accuracy
// =============================================================================

// Stack all predictor bands. Terrain is divided so values are roughly 0–1.
var predictors = composite
  .addBands(ndvi)                                 // + NDVI
  .addBands(ndwi)                                 // + NDWI
  .addBands(ndbi)                                 // + NDBI
  .addBands(dem.divide(4000).rename('elev'))      // + elevation ÷ 4000
  .addBands(slope.divide(90).rename('slope'));    // + slope ÷ 90

// The names of all predictor bands (the classifier needs this list).
var bands = predictors.bandNames();

// Training labels from ESA WorldCover 2021, converted to our 6 class codes.
// ► For your final project, replace these with your OWN training data (Script 12, PART 2B).
var labels = ee.ImageCollection('ESA/WorldCover/v200').first().select('Map') // WorldCover classes
  .remap([10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 100],                     // WorldCover codes
         [1, 2, 2, 3, 4, 5, 5, 0, 0, 1, 5])                                 // → our codes
  .rename('landcover');                                                     // label band name

// Take up to 300 random points per class, reading labels + predictors at each.
var samples = predictors.addBands(labels).stratifiedSample({
  numPoints: 300,          // points per class
  classBand: 'landcover',  // the band with class codes
  region: aoi,             // sample inside the AOI
  scale: 10,               // at 10 m pixels
  seed: 42,                // same random points every run
  geometries: true         // keep the point locations
}).randomColumn('random', 42);  // add a random number 0–1 to each point (for splitting)

// 70 % of the points for training.
var trainSet = samples.filter(ee.Filter.lt('random', 0.7));

// The other 30 % for testing.
var testSet = samples.filter(ee.Filter.gte('random', 0.7));

// Train a Random Forest with 100 trees.
var classifier = ee.Classifier.smileRandomForest({numberOfTrees: 100, seed: 42}) // the model
  .train({
    features: trainSet,          // training points
    classProperty: 'landcover',  // the correct class of each point
    inputProperties: bands       // the bands to learn from
  });

// Classify every pixel, then remove single isolated pixels with a 3×3 majority filter.
var landCover = predictors.classify(classifier)                        // classify
  .focalMode({radius: 1, kernelType: 'square', units: 'pixels'})       // 3×3 majority
  .clip(aoi)                                                           // cut to AOI
  .rename('landcover');                                                // band name

// Confusion matrix of the TEST points (used for accuracy in PART 6).
var errorMatrix = testSet.classify(classifier).errorMatrix('landcover', 'classification');


// =============================================================================
// PART 4 — Map layers
// =============================================================================

// Satellite imagery as the background map.
Map.setOptions('SATELLITE');

// Zoom to the study area.
Map.centerObject(aoi, 10);

// True colour: red, green, blue (gamma 1.2 brightens the mid-tones a little).
var rgbVis = {bands: ['B4', 'B3', 'B2'], min: 0, max: 0.3, gamma: 1.2};

// False colour: NIR, red, green (vegetation appears red).
var fccVis = {bands: ['B8', 'B4', 'B3'], min: 0, max: 0.45};

// Elevation colours from green lowlands to white peaks.
var demVis = {min: 500, max: 4000, palette: ['006837', '78c679', 'ffffbf', 'd7b26b', '8c510a', 'ffffff']};

// NDVI colours from red (no vegetation) to dark green (dense vegetation).
var ndviVis = {min: 0, max: 0.8, palette: ['a50026', 'f46d43', 'fee08b', 'd9ef8b', '66bd63', '006837']};

// NDVI change colours: red = loss, white = no change, green = gain.
var changeVis = {min: -0.3, max: 0.3, palette: ['b2182b', 'f7f7f7', '1a9850']};

// Land-cover colours (one per class).
var lcVis = {min: 0, max: 5, palette: classPalette};

// Elevation colours shaded by the hillshade:
//   .visualize() turns the DEM into an RGB picture (0–255),
//   hillshade ÷ 255 gives 0–1, multiplying darkens slopes facing away from the sun.
var shadedRelief = dem.visualize(demVis)    // coloured elevation
  .multiply(hillshade.divide(255))          // shade it
  .toByte();                                // back to 0–255 whole numbers

// The study-area outline drawn into an image, 3 pixels wide.
var outline = ee.Image().byte().paint({
  featureCollection: ee.FeatureCollection([ee.Feature(aoi)]), // the AOI as a collection
  color: 1,                                                   // burn value 1 into the outline
  width: 3                                                    // 3-pixel line
});

// Add the layers from bottom to top. Only the land-cover map is switched on.
Map.addLayer(composite, rgbVis, '1. True colour ' + YEAR, false);                       // layer 1
Map.addLayer(composite, fccVis, '2. False colour (NIR) ' + YEAR, false);                // layer 2
Map.addLayer(shadedRelief, {min: 0, max: 255}, '3. Elevation with hillshade', false);   // layer 3
Map.addLayer(ndvi, ndviVis, '4. NDVI ' + YEAR, false);                                   // layer 4
Map.addLayer(dNDVI, changeVis, '5. NDVI change ' + BASE_YEAR + '–' + YEAR, false);       // layer 5
Map.addLayer(landCover, lcVis, '6. Land cover ' + YEAR);                                 // layer 6
Map.addLayer(outline, {palette: ['ffff00']}, 'Study area boundary');                     // outline on top


// =============================================================================
// PART 5 — Map layout elements
// =============================================================================

// ---- Title ------------------------------------------------------------------
// The main title text.
var titleLabel = ui.Label(MAP_TITLE, {fontSize: '20px', fontWeight: 'bold', margin: '2px 8px'});

// The subtitle: data source, year, season and author.
var subtitleLabel = ui.Label(
  'Sentinel-2, ' + YEAR + ' (months ' + START_MONTH + '–' + END_MONTH + ')  ·  ' + AUTHOR, // the text
  {fontSize: '12px', color: '#555555', margin: '2px 8px'}                                  // grey, small
);

// A panel (white box) holding both labels, placed at the top-centre of the map.
var titlePanel = ui.Panel({
  widgets: [titleLabel, subtitleLabel],            // the two labels, one under the other
  style: {position: 'top-center', padding: '4px'}  // where the box sits on the map
});

// Put the title box on the map.
Map.add(titlePanel);

// ---- Land-cover legend --------------------------------------------------------
// A panel in the bottom-left corner of the map.
var legend = ui.Panel({style: {position: 'bottom-left', padding: '8px 12px'}});

// The legend heading.
legend.add(ui.Label('Land cover ' + YEAR, {fontWeight: 'bold', fontSize: '14px', margin: '0 0 6px 0'}));

// One row per class: a coloured square and the class name.
classNames.forEach(function(name, i) {
  // The coloured square (an empty label with a background colour).
  var box = ui.Label('', {backgroundColor: '#' + classPalette[i], padding: '8px', margin: '0 6px 4px 0'});
  // The class name.
  var text = ui.Label(name, {margin: '0 0 4px 0'});
  // Put the square and the name side by side, and add the row to the legend.
  legend.add(ui.Panel([box, text], ui.Panel.Layout.Flow('horizontal')));
});

// ---- NDVI colour bar ------------------------------------------------------------
// A tiny image whose values run from 0 (left) to 1 (right), coloured with the NDVI palette.
var colourBar = ui.Thumbnail({
  image: ee.Image.pixelLonLat().select(0),     // each pixel's x-position becomes its value
  params: {
    bbox: [0, 0, 1, 0.1],                      // x from 0 to 1, a thin strip
    dimensions: '160x10',                      // 160 × 10 pixels
    format: 'png',                             // picture format
    min: 0,                                    // left end
    max: 1,                                    // right end
    palette: ndviVis.palette                   // the NDVI colours
  },
  style: {stretch: 'horizontal', margin: '4px 0', maxHeight: '16px'} // fill the legend width
});

// The minimum value written under the left end of the bar (String() turns a number into text).
var barMin = ui.Label(String(ndviVis.min), {margin: '0'});

// The maximum value written under the right end of the bar.
var barMax = ui.Label(String(ndviVis.max), {margin: '0', textAlign: 'right', stretch: 'horizontal'});

// The heading for the colour bar.
legend.add(ui.Label('NDVI', {fontWeight: 'bold', margin: '8px 0 0 0'}));

// The bar itself.
legend.add(colourBar);

// The min and max labels side by side.
legend.add(ui.Panel([barMin, barMax], ui.Panel.Layout.Flow('horizontal')));

// ---- Data sources ---------------------------------------------------------------
// A small grey line naming the datasets used (always cite your data!).
legend.add(ui.Label('Data: ESA Sentinel-2, NASA SRTM, ESA WorldCover (training)',
                    {fontSize: '10px', color: '#666666', margin: '8px 0 0 0'}));

// Put the finished legend on the map.
Map.add(legend);

// ---- North arrow ------------------------------------------------------------------
// A label with an arrow and "N"; whiteSpace 'pre' keeps the line break (\n).
var northArrow = ui.Label('▲\nN', {
  position: 'top-right',     // top-right corner of the map
  fontWeight: 'bold',        // bold text
  fontSize: '18px',          // large
  whiteSpace: 'pre',         // respect the line break
  textAlign: 'center',       // centre the arrow over the N
  padding: '4px 8px'         // space around it
});

// Put the north arrow on the map.
Map.add(northArrow);

// ---- Scale bar --------------------------------------------------------------------
// The Code Editor map has a built-in scale bar (bottom-right); make sure it is shown.
Map.setControlVisibility({scaleControl: true});

// ---- Location (inset) map ------------------------------------------------------------
// A box of about 600 × 600 km centred on the AOI (300 km buffer → its bounding box).
var regionBox = aoi.centroid(100).buffer(300000).bounds();

// A background picture of the region: elevation in soft colours.
var insetBackground = ee.Image('USGS/SRTMGL1_003').visualize({
  min: 0,                                                       // sea level
  max: 5000,                                                    // high mountains
  palette: ['c7e9c0', '74c476', 'fdd49e', 'd7b26b', 'ffffff']   // green → brown → white
});

// The AOI outline in red, 3 pixels wide.
var insetAoi = ee.Image().byte()                                // empty image
  .paint(ee.FeatureCollection([ee.Feature(aoi)]), 1, 3)         // draw the AOI edge (value 1, width 3)
  .visualize({palette: ['ff0000']});                            // colour it red

// A small picture (thumbnail) of background + outline for the inset.
var insetThumb = ui.Thumbnail({
  image: insetBackground.blend(insetAoi),                        // outline on top of background
  params: {region: regionBox, dimensions: 180, format: 'png'},   // 180-pixel picture of the region
  style: {position: 'bottom-right', margin: '0 0 30px 0'}        // above the scale bar
});

// Put the inset on the map.
Map.add(insetThumb);

// NOTE: SRTM covers 60 °N – 56 °S. If you add national borders to a published
// map, use your country's official boundary data.


// =============================================================================
// PART 6 — Summary statistics side panel
// =============================================================================

// A panel 340 pixels wide for numbers and a chart.
var sidePanel = ui.Panel({style: {width: '340px', padding: '8px'}});

// The panel heading.
sidePanel.add(ui.Label('Study area summary', {fontWeight: 'bold', fontSize: '16px'}));

// Insert the panel at position 0 of the screen (to the left of the map).
ui.root.insert(0, sidePanel);

// AOI area: computed on the server; .evaluate() brings the number back without freezing.
aoi.area(10).divide(1e6).evaluate(function(value) {
  // value is now a normal number; .toFixed(1) rounds it to 1 decimal place.
  sidePanel.add(ui.Label('Study area: ' + value.toFixed(1) + ' km²'));
});

// Mean NDVI of the AOI (at 30 m, which is plenty for an average).
ndvi.reduceRegion({reducer: ee.Reducer.mean(), geometry: aoi, scale: 30, maxPixels: 1e10}) // the mean
  .get('NDVI')                                                                              // the number
  .evaluate(function(value) {                                                               // fetch it
    sidePanel.add(ui.Label('Mean NDVI ' + YEAR + ': ' + value.toFixed(3)));                 // show it
  });

// Elevation range (min and max) of the AOI.
dem.reduceRegion({reducer: ee.Reducer.minMax(), geometry: aoi, scale: 30, maxPixels: 1e10}) // min & max
  .evaluate(function(d) {                                                                    // fetch both
    sidePanel.add(ui.Label('Elevation: ' + d.elevation_min + ' – ' + d.elevation_max + ' m')); // show them
  });

// Overall accuracy of the classification (test points).
errorMatrix.accuracy().evaluate(function(oa) {
  // Convert 0–1 into a percentage.
  sidePanel.add(ui.Label('Classification overall accuracy: ' + (oa * 100).toFixed(1) + ' %'));
});

// Kappa coefficient of the classification.
errorMatrix.kappa().evaluate(function(k) {
  // Show it with 3 decimals.
  sidePanel.add(ui.Label('Kappa: ' + k.toFixed(3)));
});

// Vegetation loss: NDVI above 0.4 in the base year AND a drop of more than 0.2.
var vegLossMask = ndviBase.gt(0.4).and(dNDVI.lt(-0.2));

// Its area in km², fetched and shown in the panel.
areaKm2(vegLossMask, 10).evaluate(function(v) {
  sidePanel.add(ui.Label('Vegetation loss ' + BASE_YEAR + '–' + YEAR + ': ' + v.toFixed(2) + ' km²'));
});

// Area of each land-cover class: sum pixel areas (km²) grouped by class code.
var areaGroups = ee.Image.pixelArea().divide(1e6).addBands(landCover).reduceRegion({
  reducer: ee.Reducer.sum().group({groupField: 1, groupName: 'class'}),  // a sum per class
  geometry: aoi,                                                         // in the AOI
  scale: 10,                                                             // at 10 m
  maxPixels: 1e10                                                        // allow many pixels
});

// Turn the grouped result into a table (one row per class).
var areaTable = ee.FeatureCollection(ee.List(areaGroups.get('groups')).map(function(item) {
  // One {class, sum} dictionary.
  var d = ee.Dictionary(item);
  // The class code as a whole number.
  var code = ee.Number(d.get('class')).int();
  // A table row (feature without geometry).
  return ee.Feature(null, {
    class_code: code,                           // e.g. 1
    class_name: ee.List(classNames).get(code),  // e.g. 'Forest'
    area_km2: ee.Number(d.get('sum'))           // area in km²
  });
}));

// A pie chart of the class areas.
var pieChart = ui.Chart.feature.byFeature({
  features: areaTable,          // the table
  xProperty: 'class_name',      // slice labels
  yProperties: ['area_km2']     // slice sizes
}).setChartType('PieChart').setOptions({
  title: 'Land cover area (km²) ' + YEAR,   // chart title
  colors: classPalette,                     // same colours as the map
  legend: {position: 'right'}               // legend on the right
});

// Put the chart in the side panel.
sidePanel.add(pieChart);


// =============================================================================
// PART 7 — Outputs
// =============================================================================

// ---- 7a. PNG pictures for your report (clickable links in the side panel) -----
// The outline as a yellow RGB picture, to lay on top of every PNG.
var outlineRgb = outline.visualize({palette: ['ffff00']});

// A dictionary: picture name → RGB picture. .blend() puts the outline on top.
var pngLayers = {
  'True colour': composite.visualize(rgbVis).blend(outlineRgb),   // true colour
  'NDVI': ndvi.visualize(ndviVis).blend(outlineRgb),               // NDVI
  'Land cover': landCover.visualize(lcVis).blend(outlineRgb),      // classification
  'Elevation': shadedRelief.blend(outlineRgb)                      // shaded relief
};

// A heading for the links.
sidePanel.add(ui.Label('Download map images (PNG):', {fontWeight: 'bold', margin: '12px 0 0 0'}));

// For each picture, ask the server for a PNG link and add it to the panel.
Object.keys(pngLayers).forEach(function(name) {
  // getThumbURL makes a PNG of the AOI, 1600 pixels wide, then runs our function with its URL.
  pngLayers[name].getThumbURL({region: aoi, dimensions: 1600, format: 'png'}, function(url) {
    // ui.Label(text, style, link) makes a clickable link.
    sidePanel.add(ui.Label(name, {color: '#1a73e8'}, url));
  });
});

// ---- 7b. GeoTIFFs and tables to Google Drive (Tasks tab → RUN each one) -------
// True-colour picture (3 bands, 0–255) — opens directly in QGIS.
Export.image.toDrive({
  image: composite.visualize(rgbVis),           // RGB picture
  description: 'Final_TrueColour_' + YEAR,      // task / file name
  folder: 'GEE_final_project',                  // Drive folder
  region: aoi,                                  // area
  scale: 10,                                    // 10 m pixels
  maxPixels: 1e10                               // allow large exports
});

// Land-cover classes (one band, values 0–5).
Export.image.toDrive({
  image: landCover.toByte(),                    // classes as whole numbers 0–255
  description: 'Final_LandCover_' + YEAR,       // task / file name
  folder: 'GEE_final_project',                  // Drive folder
  region: aoi,                                  // area
  scale: 10,                                    // 10 m pixels
  maxPixels: 1e10                               // allow large exports
});

// NDVI and NDVI change (two decimal bands).
Export.image.toDrive({
  image: ndvi.addBands(dNDVI).toFloat(),                       // 2 bands
  description: 'Final_NDVI_change_' + BASE_YEAR + '_' + YEAR,  // task / file name
  folder: 'GEE_final_project',                                 // Drive folder
  region: aoi,                                                 // area
  scale: 10,                                                   // 10 m pixels
  maxPixels: 1e10                                              // allow large exports
});

// Elevation in whole metres.
Export.image.toDrive({
  image: dem.toInt16(),                         // 16-bit whole numbers
  description: 'Final_DEM',                     // task / file name
  folder: 'GEE_final_project',                  // Drive folder
  region: aoi,                                  // area
  scale: 30,                                    // SRTM's 30 m pixels
  maxPixels: 1e10                               // allow large exports
});

// The land-cover area table as a CSV spreadsheet.
Export.table.toDrive({
  collection: areaTable,                                   // the table
  description: 'Final_LandCover_area_' + YEAR,             // task / file name
  folder: 'GEE_final_project',                             // Drive folder
  fileFormat: 'CSV',                                       // spreadsheet format
  selectors: ['class_code', 'class_name', 'area_km2']      // columns in this order
});

// The study-area boundary as a shapefile, for your QGIS map layout.
Export.table.toDrive({
  collection: ee.FeatureCollection([ee.Feature(aoi, {name: 'study_area'})]), // AOI as a feature
  description: 'Final_StudyArea_boundary',                                   // task / file name
  folder: 'GEE_final_project',                                               // Drive folder
  fileFormat: 'SHP'                                                          // shapefile
});


/*******************************************************************************
 * HOW TO FINISH YOUR MAPS
 *   Quick:          Click the PNG links in the side panel and save the images.
 *                   For a figure with legend, title and inset, take a screenshot
 *                   of the map area (switch on the layer you want first).
 *   Print-quality:  Run the GeoTIFF exports → open them in QGIS → Project →
 *                   New Print Layout → add map, grid, scale bar, north arrow,
 *                   legend, inset map and data sources.
 *
 * SUGGESTED REPORT OUTLINE
 *   1. Introduction and study area (with the location map)
 *   2. Data (satellites, dates, other datasets)
 *   3. Methods (cloud masking, composite, indices, classification, change)
 *   4. Results (maps, area table, accuracy, change statistics)
 *   5. Discussion (errors and limitations) and conclusion
 ******************************************************************************/
