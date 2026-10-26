/*******************************************************************************
 * GOOGLE EARTH ENGINE FOR BEGINNERS — Landslides in the Polish Carpathians
 * FINAL PROJECT · Script 14 — Landslide maps of YOUR study area
 * -----------------------------------------------------------------------------
 * This template brings the whole course together. Change the SETTINGS in
 * PART 0 to your own study area and years, press Run, and you get:
 *
 *   MAP LAYERS   true colour · false colour · elevation with hillshade ·
 *                slope classes · NDVI · NDVI change · land-cover classification ·
 *                a simple landslide-susceptibility index · (your landslide inventory)
 *   MAP LAYOUT   title · legends · NDVI colour bar · location (inset) map ·
 *                north arrow · scale bar · summary statistics side panel
 *   OUTPUTS      PNG map images (download links) · GeoTIFFs and CSVs to Google Drive
 *
 * Final-project checklist for students:
 *   [ ] Your own study area in Poland (shapefile asset or drawn polygon)
 *   [ ] A cloud-free composite, at least two indices, and a slope map
 *   [ ] A land-cover classification with an accuracy assessment
 *   [ ] A change analysis between two years
 *   [ ] A landslide-susceptibility map (this simple index, or Script 12 PART 12)
 *   [ ] Finished maps with title, legend, scale, north arrow and data sources
 *   [ ] A short report: methods, maps, area tables, accuracy, discussion
 *
 * IMPORTANT: the susceptibility index here is a TEACHING tool, not an official
 * hazard map. Official landslide maps for Poland come from the SOPO project of
 * the Polish Geological Institute (PIG-PIB).
 ******************************************************************************/


// =============================================================================
// PART 0 — SETTINGS (the only part you normally need to change)
// =============================================================================

// ► Your name (shown under the map title).
var AUTHOR = 'Student name';

// ► The map title.
var MAP_TITLE = 'Landslide-prone slopes of the Limanowa–Rożnów area';

// ► Your study area. Option 1: a rectangle [west, south, east, north].
var aoi = ee.Geometry.Rectangle([20.25, 49.60, 20.80, 49.85]);

// ► Option 2: your uploaded shapefile — un-comment the next line and edit the path.
// var aoi = ee.FeatureCollection('projects/YOUR-PROJECT-ID/assets/study_area').geometry();

// ► Option 3: draw a polygon with the map tools, then un-comment:  var aoi = geometry;

// ► The main year to map.
var YEAR = 2024;

// ► The first and last month of the season used for the composite (6–8 = Jun–Aug).
var START_MONTH = 6;
var END_MONTH = 8;

// ► An earlier year for the change analysis (the same season is used).
var BASE_YEAR = 2019;

// ► Land-cover class names, in the order of the class codes 0, 1, 2, 3, 4, 5.
var classNames = ['Water', 'Forest', 'Shrub & grass', 'Cropland', 'Built-up', 'Bare / snow'];

// ► One colour per class, in the same order as the names.
var classPalette = ['1f78b4', '1b7837', 'a6d96a', 'fdae61', 'e31a1c', 'bdbdbd'];

// ► Susceptibility index weights (they must add up to 1).
var SLOPE_WEIGHT = 0.6;       // how much slope counts
var LANDCOVER_WEIGHT = 0.4;   // how much land cover counts

// ► Your landslide inventory (polygons, Script 06 step D). false = not used.
var USE_LANDSLIDE_INVENTORY = false;
var LANDSLIDE_ASSET = 'projects/YOUR-PROJECT-ID/assets/landslides';


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
  .addBands(dem.toFloat().divide(1500).rename('elev')) // + elevation ÷ 1500 (as decimals)
  .addBands(slope.divide(60).rename('slope'));    // + slope ÷ 60

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

// Confusion matrix of the TEST points (used for accuracy in PART 7).
var errorMatrix = testSet.classify(classifier).errorMatrix('landcover', 'classification');


// =============================================================================
// PART 4 — Slope classes and a simple landslide-susceptibility index
// =============================================================================

// Slope classes: 1 = 0–5°, 2 = 5–10°, 3 = 10–15°, 4 = 15–25°, 5 = over 25°.
var slopeClasses = ee.Image(1)
  .where(slope.gte(5), 2)                          // 5–10°
  .where(slope.gte(10), 3)                         // 10–15°
  .where(slope.gte(15), 4)                         // 15–25°
  .where(slope.gte(25), 5)                         // over 25°
  .updateMask(slope.mask())                        // same no-data areas as the slope
  .clip(aoi)                                       // cut to the AOI
  .rename('slope_class');                          // band name
var slopeClassNames = ['0–5°', '5–10°', '10–15°', '15–25°', '> 25°'];
var slopeClassPalette = ['ffffcc', 'fed976', 'fd8d3c', 'e31a1c', '800026'];

// SLOPE SCORE 0–1: flat land scores 0, slopes over 25° score 1.
// .toFloat() keeps the decimals (whole ÷ whole would give only 0 or 1).
var slopeScore = slopeClasses.subtract(1).toFloat().divide(4);

// LAND-COVER SCORE 0–1. Forest roots hold the soil, so forest scores low;
// fields, pasture and bare ground score high; water is excluded.
//   our class:  0 water, 1 forest, 2 shrub & grass, 3 cropland, 4 built-up, 5 bare
var landCoverScore = landCover.remap([0, 1, 2, 3, 4, 5],     // our class codes
                                     [0, 1, 2, 3, 2, 3])     // score 0–3
                              .toFloat()                     // as decimals
                              .divide(3);                    // → 0–1

// The index: a weighted sum of the two scores (0 = least, 1 = most susceptible).
var susIndex = slopeScore.multiply(SLOPE_WEIGHT)
  .add(landCoverScore.multiply(LANDCOVER_WEIGHT))
  .updateMask(landCover.neq(0))                    // leave out water
  .rename('sus_index');

// Four classes: 1 low (< 0.25), 2 moderate, 3 high, 4 very high (≥ 0.75).
var susClasses = ee.Image(1)
  .where(susIndex.gte(0.25), 2)                    // moderate
  .where(susIndex.gte(0.5), 3)                     // high
  .where(susIndex.gte(0.75), 4)                    // very high
  .updateMask(susIndex.mask())                     // same no-data areas as the index
  .rename('sus_class');                            // band name
var susClassNames = ['Low', 'Moderate', 'High', 'Very high'];
var susPalette = ['1a9850', 'ffffbf', 'fdae61', 'd7191c'];

// The landslide inventory, if you have one (an empty collection if not).
var landslides = USE_LANDSLIDE_INVENTORY ? ee.FeatureCollection(LANDSLIDE_ASSET)
                                         : ee.FeatureCollection([]);


// =============================================================================
// PART 5 — Map layers
// =============================================================================

// Satellite imagery as the background map.
Map.setOptions('SATELLITE');

// Zoom to the study area.
Map.centerObject(aoi, 10);

// True colour: red, green, blue (gamma 1.2 brightens the mid-tones a little).
var rgbVis = {bands: ['B4', 'B3', 'B2'], min: 0, max: 0.3, gamma: 1.2};

// False colour: NIR, red, green (vegetation appears red).
var fccVis = {bands: ['B8', 'B4', 'B3'], min: 0, max: 0.45};

// Elevation colours from green valleys to white summits.
var demVis = {min: 250, max: 1150, palette: ['006837', '78c679', 'ffffbf', 'd7b26b', '8c510a', 'ffffff']};

// NDVI colours from red (no vegetation) to dark green (dense vegetation).
var ndviVis = {min: 0, max: 0.9, palette: ['a50026', 'f46d43', 'fee08b', 'd9ef8b', '66bd63', '006837']};

// NDVI change colours: red = loss, white = no change, green = gain.
var changeVis = {min: -0.3, max: 0.3, palette: ['b2182b', 'f7f7f7', '1a9850']};

// Land-cover colours (one per class).
var lcVis = {min: 0, max: 5, palette: classPalette};

// Slope-class and susceptibility colours.
var slopeVis = {min: 1, max: 5, palette: slopeClassPalette};
var susVis = {min: 1, max: 4, palette: susPalette};

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

// Add the layers from bottom to top. Only the susceptibility map is switched on.
Map.addLayer(composite, rgbVis, '1. True colour ' + YEAR, false);                       // layer 1
Map.addLayer(composite, fccVis, '2. False colour (NIR) ' + YEAR, false);                // layer 2
Map.addLayer(shadedRelief, {min: 0, max: 255}, '3. Elevation with hillshade', false);   // layer 3
Map.addLayer(slopeClasses, slopeVis, '4. Slope classes', false);                         // layer 4
Map.addLayer(ndvi, ndviVis, '5. NDVI ' + YEAR, false);                                   // layer 5
Map.addLayer(dNDVI, changeVis, '6. NDVI change ' + BASE_YEAR + '–' + YEAR, false);       // layer 6
Map.addLayer(landCover, lcVis, '7. Land cover ' + YEAR, false);                          // layer 7
Map.addLayer(susClasses, susVis, '8. Landslide susceptibility (teaching index)');        // layer 8
Map.addLayer(landslides.style({color: '000000', fillColor: '00000000', width: 1}), {},
             'Landslide inventory', USE_LANDSLIDE_INVENTORY);                            // your landslides
Map.addLayer(outline, {palette: ['ffff00']}, 'Study area boundary');                     // outline on top


// =============================================================================
// PART 6 — Map layout elements
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

// ---- Legend -------------------------------------------------------------------

// A panel in the bottom-left corner of the map.
var legend = ui.Panel({style: {position: 'bottom-left', padding: '8px 12px'}});

// A function that adds a heading and one coloured row per class to the legend.
function addLegendSection(heading, names, palette) {
  // The heading.
  legend.add(ui.Label(heading, {fontWeight: 'bold', fontSize: '14px', margin: '6px 0 4px 0'}));
  // One row per class: a coloured square and the class name.
  names.forEach(function(name, i) {
    // The coloured square (an empty label with a background colour).
    var box = ui.Label('', {backgroundColor: '#' + palette[i], padding: '8px', margin: '0 6px 4px 0'});
    // The class name.
    var text = ui.Label(name, {margin: '0 0 4px 0'});
    // Put the square and the name side by side, and add the row to the legend.
    legend.add(ui.Panel([box, text], ui.Panel.Layout.Flow('horizontal')));
  });
}

// The two class legends.
addLegendSection('Landslide susceptibility', susClassNames, susPalette);
addLegendSection('Land cover ' + YEAR, classNames, classPalette);

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

// Small grey lines naming the datasets used (always cite your data!).
legend.add(ui.Label('Data: ESA Sentinel-2, NASA SRTM, ESA WorldCover (training)',
                    {fontSize: '10px', color: '#666666', margin: '8px 0 0 0'}));
legend.add(ui.Label('Susceptibility: simple teaching index, not an official hazard map',
                    {fontSize: '10px', color: '#666666', margin: '2px 0 0 0'}));

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
  max: 2000,                                                    // the highest Carpathian peaks
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

// NOTE: for published maps of Poland use official boundaries (PRG, GUGiK).


// =============================================================================
// PART 7 — Summary statistics side panel
// =============================================================================

// A panel 340 pixels wide for numbers and charts.
var sidePanel = ui.Panel({style: {width: '340px', padding: '8px'}});

// The panel heading.
sidePanel.add(ui.Label('Study area summary', {fontWeight: 'bold', fontSize: '16px'}));

// Insert the panel at position 0 of the screen (to the left of the map).
ui.root.insert(0, sidePanel);

// AOI area: computed on the server; .evaluate() brings the number back without freezing.
var aoiKm2 = aoi.area(10).divide(1e6);
aoiKm2.evaluate(function(value) {
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

// Area steeper than 15° and its share of the AOI.
ee.List([areaKm2(slope.gt(15), 30), aoiKm2]).evaluate(function(v) {
  // v[0] = steep area, v[1] = AOI area.
  sidePanel.add(ui.Label('Slopes > 15°: ' + v[0].toFixed(1) + ' km² (' + (100 * v[0] / v[1]).toFixed(1) + ' %)'));
});

// Share of the AOI in the high and very high susceptibility classes.
ee.List([areaKm2(susClasses.gte(3), 30), aoiKm2]).evaluate(function(v) {
  // v[0] = high + very high area, v[1] = AOI area.
  sidePanel.add(ui.Label('High + very high susceptibility: ' + (100 * v[0] / v[1]).toFixed(1) + ' % of the area'));
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

// Vegetation loss on slopes: NDVI above 0.4 in the base year, a drop of more
// than 0.2, and a slope steeper than 10° (candidate landslides, logging, …).
var vegLossMask = ndviBase.gt(0.4).and(dNDVI.lt(-0.2)).and(slope.gt(10));

// Its area in km², fetched and shown in the panel.
areaKm2(vegLossMask, 10).evaluate(function(v) {
  sidePanel.add(ui.Label('Vegetation loss on slopes ' + BASE_YEAR + '–' + YEAR + ': ' + v.toFixed(2) + ' km²'));
});

// CHECK THE INDEX against your landslides: which share of the landslide area
// falls in the high and very high classes? (A good index puts most of it there.)
if (USE_LANDSLIDE_INVENTORY) {
  // 1 inside landslide polygons, 0 elsewhere.
  var landslideMask = ee.Image(0).paint(landslides, 1).clip(aoi);
  // Landslide area in total, and landslide area in classes 3–4.
  ee.List([areaKm2(landslideMask, 10), areaKm2(landslideMask.and(susClasses.gte(3)), 10)])
    .evaluate(function(v) {
      sidePanel.add(ui.Label('Landslide area in high + very high classes: ' +
                             (100 * v[1] / v[0]).toFixed(1) + ' %'));
    });
}

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

// The same for the susceptibility classes (codes 1–4 → names at index code − 1).
var susGroups = ee.Image.pixelArea().divide(1e6).addBands(susClasses).reduceRegion({
  reducer: ee.Reducer.sum().group({groupField: 1, groupName: 'class'}),  // a sum per class
  geometry: aoi,                                                         // in the AOI
  scale: 30,                                                             // 30 m (the slope's pixel size)
  maxPixels: 1e10                                                        // allow many pixels
});
var susTable = ee.FeatureCollection(ee.List(susGroups.get('groups')).map(function(item) {
  // One {class, sum} dictionary.
  var d = ee.Dictionary(item);
  // The class code 1–4.
  var code = ee.Number(d.get('class')).int();
  // A table row.
  return ee.Feature(null, {
    class_code: code,                                           // e.g. 3
    class_name: ee.List(susClassNames).get(code.subtract(1)),   // e.g. 'High'
    area_km2: ee.Number(d.get('sum'))                           // area in km²
  });
}));

// A pie chart of the land-cover areas.
sidePanel.add(ui.Chart.feature.byFeature({
  features: areaTable,          // the table
  xProperty: 'class_name',      // slice labels
  yProperties: ['area_km2']     // slice sizes
}).setChartType('PieChart').setOptions({
  title: 'Land cover area (km²) ' + YEAR,   // chart title
  colors: classPalette,                     // same colours as the map
  legend: {position: 'right'}               // legend on the right
}));

// A column chart of the susceptibility-class areas.
sidePanel.add(ui.Chart.feature.byFeature({
  features: susTable,           // the table
  xProperty: 'class_name',      // class names on the x-axis
  yProperties: ['area_km2']     // areas on the y-axis
}).setChartType('ColumnChart').setOptions({
  title: 'Susceptibility class area (km²)', // chart title
  colors: ['d7191c'],                       // bar colour
  legend: {position: 'none'}                // no legend
}));


// =============================================================================
// PART 8 — Outputs
// =============================================================================

// ---- 8a. PNG pictures for your report (clickable links in the side panel) -----

// The outline as a yellow RGB picture, to lay on top of every PNG.
var outlineRgb = outline.visualize({palette: ['ffff00']});

// A dictionary: picture name → RGB picture. .blend() puts the outline on top.
var pngLayers = {
  'True colour': composite.visualize(rgbVis).blend(outlineRgb),        // true colour
  'Susceptibility': susClasses.visualize(susVis).blend(outlineRgb),    // susceptibility index
  'Slope classes': slopeClasses.visualize(slopeVis).blend(outlineRgb), // slope classes
  'Land cover': landCover.visualize(lcVis).blend(outlineRgb),          // classification
  'Elevation': shadedRelief.blend(outlineRgb)                          // shaded relief
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

// ---- 8b. GeoTIFFs and tables to Google Drive (Tasks tab → RUN each one) -------
// All rasters use EPSG:2180 (PUWG 1992), Poland's official coordinate system.

// True-colour picture (3 bands, 0–255) — opens directly in QGIS.
Export.image.toDrive({
  image: composite.visualize(rgbVis),           // RGB picture
  description: 'Final_TrueColour_' + YEAR,      // task / file name
  folder: 'GEE_final_project',                  // Drive folder
  region: aoi,                                  // area
  scale: 10,                                    // 10 m pixels
  crs: 'EPSG:2180',                             // national coordinate system
  maxPixels: 1e10                               // allow large exports
});

// Land-cover classes (one band, values 0–5).
Export.image.toDrive({
  image: landCover.toByte(),                    // classes as whole numbers 0–255
  description: 'Final_LandCover_' + YEAR,       // task / file name
  folder: 'GEE_final_project',                  // Drive folder
  region: aoi,                                  // area
  scale: 10,                                    // 10 m pixels
  crs: 'EPSG:2180',                             // national coordinate system
  maxPixels: 1e10                               // allow large exports
});

// Susceptibility classes (1–4) and slope classes (1–5), two bands of whole numbers.
Export.image.toDrive({
  image: susClasses.addBands(slopeClasses).toByte(), // 2 bands
  description: 'Final_Susceptibility_SlopeClasses',  // task / file name
  folder: 'GEE_final_project',                       // Drive folder
  region: aoi,                                       // area
  scale: 30,                                         // the slope's 30 m pixels
  crs: 'EPSG:2180',                                  // national coordinate system
  maxPixels: 1e10                                    // allow large exports
});

// NDVI and NDVI change (two decimal bands).
Export.image.toDrive({
  image: ndvi.addBands(dNDVI).toFloat(),                       // 2 bands
  description: 'Final_NDVI_change_' + BASE_YEAR + '_' + YEAR,  // task / file name
  folder: 'GEE_final_project',                                 // Drive folder
  region: aoi,                                                 // area
  scale: 10,                                                   // 10 m pixels
  crs: 'EPSG:2180',                                            // national coordinate system
  maxPixels: 1e10                                              // allow large exports
});

// Elevation in whole metres.
Export.image.toDrive({
  image: dem.toInt16(),                         // 16-bit whole numbers
  description: 'Final_DEM',                     // task / file name
  folder: 'GEE_final_project',                  // Drive folder
  region: aoi,                                  // area
  scale: 30,                                    // SRTM's 30 m pixels
  crs: 'EPSG:2180',                             // national coordinate system
  maxPixels: 1e10                               // allow large exports
});

// The land-cover and susceptibility area tables as CSV spreadsheets.
Export.table.toDrive({
  collection: areaTable,                                   // the table
  description: 'Final_LandCover_area_' + YEAR,             // task / file name
  folder: 'GEE_final_project',                             // Drive folder
  fileFormat: 'CSV',                                       // spreadsheet format
  selectors: ['class_code', 'class_name', 'area_km2']      // columns in this order
});
Export.table.toDrive({
  collection: susTable,                                    // the table
  description: 'Final_Susceptibility_area',                // task / file name
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
 *                   legend, inset map and data sources. Add a LiDAR hillshade
 *                   from geoportal.gov.pl under your layers for a sharp relief.
 *
 * SUGGESTED REPORT OUTLINE
 *   1. Introduction and study area (with the location map; why landslides here?)
 *   2. Data (satellites, dates, DEM, rainfall, landslide inventory if used)
 *   3. Methods (cloud masking, composite, indices, slope, classification,
 *      change, susceptibility index with its weights)
 *   4. Results (maps, area tables, accuracy, change statistics, share of land in
 *      each susceptibility class)
 *   5. Discussion (errors and limitations: 30 m DEM, WorldCover training labels,
 *      a simple index; comparison with the SOPO maps) and conclusion
 ******************************************************************************/
