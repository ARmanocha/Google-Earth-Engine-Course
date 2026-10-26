/*******************************************************************************
 * GOOGLE EARTH ENGINE FOR BEGINNERS — Landslides in the Polish Carpathians
 * Module 4 · Script 12 — Supervised classification and accuracy assessment
 * -----------------------------------------------------------------------------
 * SUPERVISED CLASSIFICATION = teach the computer what each land-cover class
 * looks like using EXAMPLES (training data), then let it label every pixel.
 *
 * WORKFLOW
 *   1. Make a cloud-free image + extra "predictor" bands (indices, terrain)
 *   2. Collect labelled training points (one class code per point)
 *   3. Split points: 70 % for TRAINING, 30 % for TESTING
 *   4. Train classifiers: Random Forest, CART, SVM
 *   5. Check ACCURACY on the test points (confusion matrix, overall accuracy, kappa)
 *   6. Classify the whole image, calculate area per class, export
 *   (+ OPTIONAL PART 12: a landslide SUSCEPTIBILITY map from your own inventory)
 *
 * CLASSES USED HERE (codes 0–5)
 *   0 Water | 1 Forest | 2 Shrub & grass | 3 Cropland | 4 Built-up | 5 Bare / snow
 *
 * TRAINING DATA — two options:
 *   A) READY-TO-USE (default): points sampled automatically from the ESA
 *      WorldCover 2021 map. Great for practice; but WorldCover has its own
 *      errors, so for real projects collect your own (option B).
 *   B) YOUR OWN: draw points/polygons for each class with the map tools.
 *      Instructions are in PART 2B.
 *
 * WHY LAND COVER MATTERS FOR LANDSLIDES: forest roots hold the soil and trees
 * use up water; slopes cleared for fields, pasture or roads slide more easily.
 ******************************************************************************/


// =============================================================================
// PART 0 — Settings
// =============================================================================

// Study area rectangle [west, south, east, north].
var aoi = ee.Geometry.Rectangle([20.25, 49.60, 20.80, 49.85]);

// Year of the image (2021 matches the WorldCover 2021 labels used in option A).
var YEAR = 2021;

// false = use automatic WorldCover points (option A); true = use your own (option B).
var USE_MY_OWN_TRAINING_DATA = false;

// Class names and colours, in the order of the class codes 0, 1, 2, 3, 4, 5.
var classNames = ['Water', 'Forest', 'Shrub & grass', 'Cropland', 'Built-up', 'Bare / snow'];
var classPalette = ['1f78b4', '1b7837', 'a6d96a', 'fdae61', 'e31a1c', 'bdbdbd'];

// Zoom to the study area.
Map.centerObject(aoi, 10);


// =============================================================================
// PART 1 — The image to classify (Sentinel-2 + indices + terrain)
// =============================================================================

// Cloud Score+ for masking.
var csPlus = ee.ImageCollection('GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED');

// Function: mask clouds and scale to reflectance.
function maskS2(image) {
  // Clear pixels have a cloud score of at least 0.6.
  var clear = image.select('cs_cdf').gte(0.6);
  // Scale the bands we want to 0–1 and hide cloudy pixels.
  return image.select(['B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B11', 'B12'])
              .multiply(0.0001)
              .updateMask(clear);
}

// Median composite of the growing season, April–October (no snow, plants green).
var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(aoi)                                                // our area
  .filterDate(YEAR + '-04-01', YEAR + '-11-01')                      // April–October of the chosen year
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 70))              // skip very cloudy scenes
  .linkCollection(csPlus, ['cs_cdf'])                               // attach cloud score
  .map(maskS2)                                                      // mask + scale
  .median()                                                         // composite
  .clip(aoi);                                                       // cut to AOI

// Spectral indices help the classifier separate classes.
var ndvi = s2.normalizedDifference(['B8', 'B4']).rename('NDVI');    // vegetation
var ndwi = s2.normalizedDifference(['B3', 'B8']).rename('NDWI');    // water
var ndbi = s2.normalizedDifference(['B11', 'B8']).rename('NDBI');   // built-up

// Terrain also helps in mountains (e.g. crops are on flatter, lower land).
var srtm = ee.Image('USGS/SRTMGL1_003');
// Elevation ÷ 1500 and slope ÷ 60 put them on a ~0–1 scale like the other bands.
// (Similar ranges matter for SVM; Random Forest and CART don't mind.)
// .toFloat() first: SRTM stores whole numbers, and whole ÷ whole drops the decimals
// (400 ÷ 1500 would give 0 instead of 0.27).
var elevation = srtm.toFloat().divide(1500).rename('elev');
var slope = ee.Terrain.slope(srtm).divide(60).rename('slope');

// Stack everything into one image of "predictors".
var predictors = s2.addBands(ndvi).addBands(ndwi).addBands(ndbi)
                   .addBands(elevation).addBands(slope)
                   .clip(aoi);

// The list of band names the classifier will use.
var bands = predictors.bandNames();
print('Predictor bands:', bands);

// Show the composite.
Map.addLayer(s2, {bands: ['B4', 'B3', 'B2'], min: 0, max: 0.3}, 'S2 composite ' + YEAR);


// =============================================================================
// PART 2A — READY-TO-USE training points from ESA WorldCover
// =============================================================================

// WorldCover 2021 class codes.
var worldCover = ee.ImageCollection('ESA/WorldCover/v200').first().select('Map');

// .remap(fromList, toList) converts WorldCover codes into OUR class codes:
//   10 tree→1, 20 shrub→2, 30 grass→2, 40 crop→3, 50 built→4, 60 bare→5,
//   70 snow→5, 80 water→0, 90 wetland→0, 95 mangrove→1, 100 moss→5
var labels = worldCover.remap(
  [10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 100],   // WorldCover codes
  [1,  2,  2,  3,  4,  5,  5,  0,  0,  1,  5]      // our codes
).rename('landcover');                             // name the label band

// Show the labels with our colours.
Map.addLayer(labels.clip(aoi), {min: 0, max: 5, palette: classPalette}, 'Labels (WorldCover remapped)', false);

// stratifiedSample takes the SAME number of random points from EACH class,
// reading the label AND all predictor bands at each point.
var autoSamples = predictors.addBands(labels).stratifiedSample({
  numPoints: 300,          // up to 300 points per class (fewer if a class is rare)
  classBand: 'landcover',  // the band holding the class codes
  region: aoi,             // where to sample
  scale: 10,               // sample at 10 m pixels
  seed: 42,                // fixed "random" seed → same points every run
  geometries: true         // keep the point locations (so we can map them)
});


// =============================================================================
// PART 2B — YOUR OWN training data (optional)
// =============================================================================

// HOW TO COLLECT YOUR OWN TRAINING DATA
//   1. Map → geometry tools → "+ new layer". Click the cog ⚙ of the new layer:
//        Name: water   |   Import as: FeatureCollection   |   + Property:
//        landcover = 0   |   pick a colour.  Click OK.
//   2. Draw 20–50 points (or small polygons) on clear examples of water.
//   3. Repeat for forest (landcover = 1), shrub_grass (2), cropland (3),
//      builtup (4) and bare (5). Use the Satellite basemap and the composite.
//   4. Set USE_MY_OWN_TRAINING_DATA = true at the top and run.
//   TIP: spread points across the WHOLE area; include shadowed slopes too.

// Declare the variable that will hold the training samples.
var samples;

// Choose the training data source.
if (USE_MY_OWN_TRAINING_DATA) {
  // Merge your six drawn FeatureCollections into one.
  var myPoints = water.merge(forest).merge(shrub_grass).merge(cropland).merge(builtup).merge(bare);
  // Read the predictor values under each point/polygon.
  samples = predictors.sampleRegions({
    collection: myPoints,         // your labelled features
    properties: ['landcover'],    // copy this property to each sample
    scale: 10,                    // 10 m pixels
    tileScale: 4,                 // extra memory for many polygons
    geometries: true              // keep locations
  });
} else {
  // Use the automatic WorldCover samples.
  samples = autoSamples;
}

// How many samples per class? .aggregate_histogram counts each class code.
print('Number of samples:', samples.size());
print('Samples per class:', samples.aggregate_histogram('landcover'));

// Show the sample points coloured by class (style each class separately).
classNames.forEach(function(name, code) {
  // Keep the points of this class and draw them in the class colour.
  Map.addLayer(samples.filter(ee.Filter.eq('landcover', code)),
               {color: classPalette[code]}, 'Samples: ' + name, false);
});


// =============================================================================
// PART 3 — Split into TRAINING (70 %) and TESTING (30 %) sets
// =============================================================================

// .randomColumn() adds a property "random" with a value between 0 and 1.
var withRandom = samples.randomColumn('random', 42);

// Points with random < 0.7 → training.
var trainSet = withRandom.filter(ee.Filter.lt('random', 0.7));

// Points with random ≥ 0.7 → testing (the classifier never sees these).
var testSet = withRandom.filter(ee.Filter.gte('random', 0.7));

// Check the sizes.
print('Training points:', trainSet.size());
print('Testing points:', testSet.size());


// =============================================================================
// PART 4 — Train three classifiers
// =============================================================================

// RANDOM FOREST: many decision trees vote. Usually the most accurate.
var rf = ee.Classifier.smileRandomForest({
  numberOfTrees: 100,   // number of trees in the forest
  seed: 42              // fixed seed → repeatable results
}).train({
  features: trainSet,          // training points
  classProperty: 'landcover',  // the property with the correct class
  inputProperties: bands       // the predictor bands to learn from
});

// CART: a single decision tree. Fast and easy to explain, less accurate.
var cart = ee.Classifier.smileCart().train({
  features: trainSet,          // training points
  classProperty: 'landcover',  // correct class
  inputProperties: bands       // predictors
});

// SVM: Support Vector Machine. Draws boundaries between classes in "band space".
var svm = ee.Classifier.libsvm({
  kernelType: 'RBF',  // a flexible, curved boundary
  gamma: 1,           // how "wiggly" the boundary can be
  cost: 10            // how strongly to avoid training mistakes
}).train({
  features: trainSet,          // training points
  classProperty: 'landcover',  // correct class
  inputProperties: bands       // predictors
});


// =============================================================================
// PART 5 — Accuracy assessment on the TEST points
// =============================================================================

// A function that tests one classifier and prints all the usual metrics.
function assessAccuracy(classifier, name) {
  // Classify the TEST points; adds a "classification" property to each one.
  var tested = testSet.classify(classifier);
  // Confusion (error) matrix: rows = true class, columns = predicted class.
  var matrix = tested.errorMatrix('landcover', 'classification');
  // Print the results.
  print('========== ' + name + ' ==========');
  print(name + ' — confusion matrix (rows = reference, cols = predicted):', matrix);
  print(name + ' — overall accuracy (0–1):', matrix.accuracy());
  print(name + ' — kappa coefficient:', matrix.kappa());
  print(name + " — producer's accuracy per class (omission errors):", matrix.producersAccuracy());
  print(name + " — user's accuracy per class (commission errors):", matrix.consumersAccuracy());
  print(name + ' — F1 score per class:', matrix.fscore());
  // Return the overall accuracy so we can compare classifiers.
  return matrix.accuracy();
}

// Assess each classifier.
var rfAccuracy = assessAccuracy(rf, 'Random Forest');
var cartAccuracy = assessAccuracy(cart, 'CART');
var svmAccuracy = assessAccuracy(svm, 'SVM');

// Side-by-side comparison of overall accuracy.
print('Overall accuracy — RF / CART / SVM:', ee.List([rfAccuracy, cartAccuracy, svmAccuracy]));

// HOW TO READ THE METRICS
//   Overall accuracy  = share of test points labelled correctly.
//   Kappa             = agreement beyond chance (> 0.8 strong, 0.6–0.8 good).
//   Producer's acc.   = of the real forest points, how many did we map as forest?
//   User's acc.       = of the pixels we mapped as forest, how many really are?


// =============================================================================
// PART 6 — Which bands mattered most? (Random Forest variable importance)
// =============================================================================

// .explain() returns information about a trained classifier, incl. importance.
var importance = ee.Dictionary(rf.explain().get('importance'));

// Put the dictionary into a one-row table so we can chart it.
var importanceTable = ee.FeatureCollection([ee.Feature(null, importance)]);

// Bar chart: one bar per band.
print(ui.Chart.feature.byProperty({features: importanceTable})
  .setChartType('ColumnChart')
  .setOptions({
    title: 'Random Forest — variable importance',  // title
    vAxis: {title: 'Importance'},                  // y label
    hAxis: {title: 'Band'},                        // x label
    legend: {position: 'none'}                     // no legend
  }));


// =============================================================================
// PART 7 — Classify the whole image
// =============================================================================

// .classify(classifier) labels every pixel of the predictor image.
var rfMap = predictors.classify(rf).rename('landcover');
var cartMap = predictors.classify(cart).rename('landcover');
var svmMap = predictors.classify(svm).rename('landcover');

// Visualisation for our 6 classes.
var classVis = {min: 0, max: 5, palette: classPalette};

// Show the maps (Random Forest switched on).
Map.addLayer(cartMap, classVis, 'Classification — CART', false);
Map.addLayer(svmMap, classVis, 'Classification — SVM', false);
Map.addLayer(rfMap, classVis, 'Classification — Random Forest');

// OPTIONAL clean-up: a majority (mode) filter removes isolated single pixels.
var rfSmoothed = rfMap.focalMode({radius: 1, kernelType: 'square', units: 'pixels'});
Map.addLayer(rfSmoothed, classVis, 'Random Forest — smoothed (3×3 mode)', false);


// =============================================================================
// PART 8 — A legend for the map
// =============================================================================

// A panel in the bottom-left corner of the map.
var legend = ui.Panel({style: {position: 'bottom-left', padding: '8px 12px'}});

// The legend title.
legend.add(ui.Label('Land cover', {fontWeight: 'bold', fontSize: '14px', margin: '0 0 6px 0'}));

// One row (colour box + name) for each class.
classNames.forEach(function(name, code) {
  // A small coloured square.
  var colourBox = ui.Label('', {backgroundColor: '#' + classPalette[code], padding: '8px', margin: '0 6px 4px 0'});
  // The class name.
  var label = ui.Label(name, {margin: '0 0 4px 0'});
  // Put them side by side in a horizontal row.
  legend.add(ui.Panel([colourBox, label], ui.Panel.Layout.Flow('horizontal')));
});

// Add the legend to the map.
Map.add(legend);


// =============================================================================
// PART 9 — Area of each class (km²)
// =============================================================================

// Image with [pixel area in km², class code].
var areaImage = ee.Image.pixelArea().divide(1e6).addBands(rfMap);

// Sum the area separately for each class code.
var areas = areaImage.reduceRegion({
  reducer: ee.Reducer.sum().group({groupField: 1, groupName: 'class'}), // sum per class
  geometry: aoi,      // in the AOI
  scale: 10,          // 10 m
  maxPixels: 1e10     // allow many pixels
});

// Turn the result into a table with class names.
var areaTable = ee.FeatureCollection(ee.List(areas.get('groups')).map(function(item) {
  // One {class, sum} dictionary.
  var d = ee.Dictionary(item);
  // The class code as a whole number (.int() so it can be used as a list index).
  var code = ee.Number(d.get('class')).int();
  // A row with the code, the name and the area.
  return ee.Feature(null, {
    class_code: code,                                  // e.g. 1
    class_name: ee.List(classNames).get(code),         // e.g. 'Forest'
    area_km2: d.get('sum')                             // the area in km²
  });
}));

// Print the table and a pie chart.
print('Area per class (km²):', areaTable);
print(ui.Chart.feature.byFeature({
  features: areaTable,          // the table
  xProperty: 'class_name',      // slice names
  yProperties: ['area_km2']     // slice sizes
}).setChartType('PieChart').setOptions({
  title: 'Land cover ' + YEAR + ' — Random Forest',  // title
  colors: classPalette                               // same colours as the map
}));


// =============================================================================
// PART 10 — OPTIONAL: tuning — how many trees are enough?
// =============================================================================

// Try different numbers of trees and record the test accuracy for each.
var treeCounts = ee.List.sequence(10, 150, 20);   // 10, 30, 50 … 150

// For each number of trees: train, test, return the accuracy.
var accuracies = treeCounts.map(function(n) {
  // Train a forest with n trees.
  var model = ee.Classifier.smileRandomForest({numberOfTrees: n, seed: 42})
    .train({features: trainSet, classProperty: 'landcover', inputProperties: bands});
  // Test it and return the overall accuracy.
  return testSet.classify(model).errorMatrix('landcover', 'classification').accuracy();
});

// Chart accuracy vs. number of trees.
print(ui.Chart.array.values({array: ee.Array(accuracies), axis: 0, xLabels: treeCounts})
  .setOptions({
    title: 'Random Forest: accuracy vs. number of trees',  // title
    hAxis: {title: 'Number of trees'},                     // x label
    vAxis: {title: 'Overall accuracy'},                    // y label
    legend: {position: 'none'},                            // no legend
    pointSize: 5                                           // show points
  }));


// =============================================================================
// PART 11 — Exports
// =============================================================================

// The classified map as a GeoTIFF (byte = whole numbers 0–255, small files).
Export.image.toDrive({
  image: rfMap.toByte(),                              // the map
  description: 'LandCover_RF_' + YEAR,                // task name
  folder: 'GEE_exports',                              // Drive folder
  region: aoi,                                        // area
  scale: 10,                                          // 10 m
  maxPixels: 1e10                                     // allow large exports
});

// The area table as a CSV.
Export.table.toDrive({
  collection: areaTable,                              // the table
  description: 'LandCover_RF_area_' + YEAR,           // task name
  folder: 'GEE_exports',                              // Drive folder
  fileFormat: 'CSV',                                  // spreadsheet
  selectors: ['class_code', 'class_name', 'area_km2'] // columns
});

// The training samples (to reuse or to share with classmates).
Export.table.toDrive({
  collection: samples,                                // the samples
  description: 'Training_samples_' + YEAR,            // task name
  folder: 'GEE_exports',                              // Drive folder
  fileFormat: 'SHP'                                   // shapefile
});


// =============================================================================
// PART 12 — OPTIONAL: a landslide SUSCEPTIBILITY map from your own inventory
// =============================================================================

// Susceptibility = how LIKELY a place is to have landslides, judged from places
// where landslides already happened. It is the same idea as land-cover
// classification, with two classes: 1 = landslide, 0 = no landslide.
// It needs a landslide inventory uploaded as an asset (Script 06, step D).

// ► Set to true after uploading your landslide polygons, and put in the path.
var USE_LANDSLIDE_INVENTORY = false;
var LANDSLIDE_ASSET = 'projects/YOUR-PROJECT-ID/assets/landslides';

// Everything below runs only when the setting above is true.
if (USE_LANDSLIDE_INVENTORY) {
  // The landslide polygons.
  var landslides = ee.FeatureCollection(LANDSLIDE_ASSET);

  // Factors that control landslides, stacked into one image:
  var susPredictors = ee.Image.cat([
    ee.Terrain.slope(srtm).rename('slope_deg'),                      // steepness
    srtm.rename('elevation'),                                        // height
    ee.Terrain.aspect(srtm).multiply(Math.PI / 180).cos()            // aspect turned into
      .rename('northness'),                                          //   1 = north-facing, −1 = south-facing
    ndvi,                                                            // vegetation
    rfMap.rename('landcover_class')                                  // our land-cover map
  ]).clip(aoi);

  // A 0/1 image: 1 inside landslide polygons, 0 everywhere else.
  // ee.Image(0) is all zeros; .paint() burns the value 1 into the polygons.
  var landslideLabel = ee.Image(0).paint(landslides, 1).rename('landslide').clip(aoi);

  // Equal numbers of landslide and non-landslide points, with all factors read.
  var susSamples = susPredictors.addBands(landslideLabel).stratifiedSample({
    numPoints: 500,          // up to 500 points per class
    classBand: 'landslide',  // 0 or 1
    region: aoi,             // inside the AOI
    scale: 30,               // 30 m (the DEM's pixel size)
    seed: 7,                 // repeatable
    geometries: true         // keep locations
  }).randomColumn('random', 7);

  // 70 % to train, 30 % to test — as in PART 3.
  var susTrain = susSamples.filter(ee.Filter.lt('random', 0.7));
  var susTest = susSamples.filter(ee.Filter.gte('random', 0.7));

  // A Random Forest that outputs a PROBABILITY (0–1) instead of a class.
  var susModel = ee.Classifier.smileRandomForest({numberOfTrees: 100, seed: 7})
    .setOutputMode('PROBABILITY')                          // probability of class 1 (landslide)
    .train({features: susTrain, classProperty: 'landslide', inputProperties: susPredictors.bandNames()});

  // The susceptibility map: the probability of "landslide" at every pixel.
  var susceptibility = susPredictors.classify(susModel).rename('susceptibility');
  Map.addLayer(susceptibility, {min: 0, max: 1, palette: ['1a9850', 'ffffbf', 'fdae61', 'd7191c']},
               'Landslide susceptibility (probability)');
  Map.addLayer(landslides.style({color: '000000', fillColor: '00000000', width: 1}), {}, 'Landslide inventory');

  // Check on the test points: probability ≥ 0.5 counts as "landslide".
  var susTested = susTest.classify(susModel).map(function(f) {
    // Turn the probability into 0 or 1 and store it.
    return f.set('predicted', ee.Number(f.get('classification')).gte(0.5));
  });
  var susMatrix = susTested.errorMatrix('landslide', 'predicted');
  print('Susceptibility model — confusion matrix:', susMatrix);
  print('Susceptibility model — overall accuracy:', susMatrix.accuracy());

  // Which factors mattered most?
  print('Susceptibility model — variable importance:', ee.Dictionary(susModel.explain().get('importance')));

  // CAUTION: this is a FIRST, simple model for learning. Real susceptibility
  // studies add geology and LiDAR-based terrain factors, test on separate areas,
  // and compare with the official SOPO maps of the Polish Geological Institute.
}


/*******************************************************************************
 * TRY IT YOURSELF
 *   1. Remove 'elev' and 'slope' from the predictors. Does accuracy drop?
 *      (Hint: predictors = predictors.select(bands.removeAll(['elev', 'slope'])) )
 *   2. Change numPoints from 300 to 100 and to 600. What happens to accuracy?
 *   3. Draw your own training data (PART 2B) and compare with WorldCover labels.
 *   4. Classify 2024 using the classifier trained on 2021 (change YEAR only for
 *      the image). Which classes change? (This is Script 13!)
 *   5. If you have a landslide inventory, run PART 12. Which factor is most
 *      important? Do high-probability areas match the SOPO maps?
 ******************************************************************************/
