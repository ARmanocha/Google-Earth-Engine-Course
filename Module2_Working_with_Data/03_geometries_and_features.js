/*******************************************************************************
 * GOOGLE EARTH ENGINE FOR BEGINNERS — Landslides in the Polish Carpathians
 * Module 2 · Script 03 — Geometries, Features and FeatureCollections
 * -----------------------------------------------------------------------------
 * VECTOR DATA in Earth Engine comes in three levels:
 *
 *   ee.Geometry          → just a shape (point, line, polygon). No attributes.
 *   ee.Feature           → a geometry + a table row of properties (attributes).
 *   ee.FeatureCollection → many features together (like a shapefile).
 *
 * A landslide inventory is a good example: each landslide is a polygon (the
 * geometry) with attributes such as its type, its activity and when it moved.
 *
 * WHAT YOU WILL LEARN
 *   • Create points, lines, polygons, rectangles and buffers
 *   • Measure area, length and distance
 *   • Attach attributes to make Features
 *   • Build, filter, style and summarise FeatureCollections
 *   • Load administrative boundaries from the data catalog
 *   • Draw your own geometries with the map tools
 ******************************************************************************/


// =============================================================================
// PART 1 — Geometries
// =============================================================================

// A POINT: [longitude, latitude]. The centre of Limanowa.
var limanowa = ee.Geometry.Point([20.4228, 49.7064]);

// Another point: the village of Kłodne, hit by a landslide in June 2010.
// (Village centre — approximate. The landslide itself is on the nearby slope.)
var klodne = ee.Geometry.Point([20.5661, 49.6850]);

// A LINE STRING: a list of [lon, lat] points joined in order.
// Here a straight line from Limanowa to Kłodne.
var lineToKlodne = ee.Geometry.LineString([[20.4228, 49.7064], [20.5661, 49.6850]]);

// A POLYGON: a list of RINGS; each ring is a list of [lon, lat] corners.
// That's why there are THREE levels of brackets: [ ring [ point [lon, lat] ] ].
// The ring closes automatically (last point joins back to the first).
var triangle = ee.Geometry.Polygon([
  [[20.45, 49.64], [20.62, 49.64], [20.53, 49.76]] // three corners → a triangle
]);

// A RECTANGLE is a quick way to make a box: [west, south, east, north].
// THIS is the study area (AOI = "area of interest") used throughout the course:
// the Beskid Wyspowy mountains and the Rożnów Reservoir, Polish Carpathians.
var aoi = ee.Geometry.Rectangle([20.25, 49.60, 20.80, 49.85]);

// Zoom the map so the whole study area is visible (zoom level 10).
Map.centerObject(aoi, 10);

// Add each geometry to the map with its own colour.
Map.addLayer(aoi, {color: 'yellow'}, 'Study area (AOI)');      // the rectangle
Map.addLayer(triangle, {color: 'orange'}, 'Triangle');         // the polygon
Map.addLayer(lineToKlodne, {color: 'cyan'}, 'Line to Kłodne'); // the line
Map.addLayer(limanowa, {color: 'blue'}, 'Limanowa');           // point 1
Map.addLayer(klodne, {color: 'red'}, 'Kłodne');                // point 2


// =============================================================================
// PART 2 — Measuring geometries
// =============================================================================

// .area() returns the area in SQUARE METRES. The "1" is the allowed error in
// metres (Earth Engine needs it for curved-earth calculations).
// .divide(1e6) converts m² to km² (1e6 = 1,000,000).
var aoiAreaKm2 = aoi.area(1).divide(1e6);

// Print the area of the study area.
print('AOI area (km²):', aoiAreaKm2);

// .length() of a line, in metres; divide by 1000 for kilometres.
print('Line length (km):', lineToKlodne.length(1).divide(1000));

// .distance() between two geometries, in metres.
print('Limanowa → Kłodne straight-line distance (km):',
      limanowa.distance(klodne, 1).divide(1000));

// .perimeter() of a polygon, in metres.
print('Triangle perimeter (km):', triangle.perimeter(1).divide(1000));

// .centroid() returns the centre point of a shape.
var aoiCentre = aoi.centroid(1);

// Show the centroid on the map, switched off (false) by default.
Map.addLayer(aoiCentre, {color: 'white'}, 'AOI centroid', false);

// .coordinates() lists the corner coordinates of a geometry.
print('Rectangle corner coordinates:', aoi.coordinates());


// =============================================================================
// PART 3 — Geometry operations
// =============================================================================

// .buffer(distance) makes a zone around a geometry. Distance is in METRES.
// A 1 km zone around Kłodne — e.g. "which houses and roads are near the landslide?"
var klodneBuffer = klodne.buffer(1000);

// Show the buffer.
Map.addLayer(klodneBuffer, {color: 'red'}, 'Kłodne 1 km buffer');

// .intersection() keeps only the part where two shapes overlap.
var overlap = triangle.intersection(klodneBuffer, 1);

// .union() merges two shapes into one.
var merged = triangle.union(klodneBuffer, 1);

// Show both results (switched off — turn them on to look).
Map.addLayer(overlap, {color: 'green'}, 'Triangle ∩ buffer', false);
Map.addLayer(merged, {color: 'purple'}, 'Triangle ∪ buffer', false);

// .contains() and .intersects() answer yes/no questions (ee.Boolean).
print('Does the AOI contain Kłodne?', aoi.contains(klodne, 1));
print('Does the triangle touch the Kłodne buffer?', triangle.intersects(klodneBuffer, 1));

// .bounds() gives the bounding rectangle of any shape.
print('Bounding box of the buffer:', klodneBuffer.bounds(1));


// =============================================================================
// PART 4 — Features: geometry + attributes
// =============================================================================

// ee.Feature(geometry, {properties}) attaches an attribute table row to a shape.
var landslideFeature = ee.Feature(klodne, {
  name: 'Kłodne landslide',    // a text property
  type: 'landslide',           // another text property
  year_activated: 2010         // a number property
});

// Print the feature — expand it to see "geometry" and "properties".
print('A feature:', landslideFeature);

// .get('property') reads one property value.
print('Feature name:', landslideFeature.get('name'));

// .set('property', value) returns a NEW feature with an extra/changed property.
// Earth Engine objects are never changed in place — always save the result!
var landslideFeature2 = landslideFeature.set('monitored', 'yes');

// Print the property names of the new feature.
print('Properties after .set():', landslideFeature2.propertyNames());


// =============================================================================
// PART 5 — FeatureCollections
// =============================================================================

// ee.FeatureCollection([list of features]) groups features, like a shapefile.
// Elevations are APPROXIMATE (town centres, summit, reservoir water level);
// Script 06 reads exact values from a DEM.
var sites = ee.FeatureCollection([
  ee.Feature(ee.Geometry.Point([20.4228, 49.7064]), {name: 'Limanowa',          type: 'town',      elevation_m: 400}),
  ee.Feature(ee.Geometry.Point([20.5661, 49.6850]), {name: 'Kłodne',            type: 'landslide', elevation_m: 500}),
  ee.Feature(ee.Geometry.Point([20.7144, 49.7322]), {name: 'Rożnów Reservoir',  type: 'reservoir', elevation_m: 265}),
  ee.Feature(ee.Geometry.Point([20.2767, 49.6552]), {name: 'Mogielica',         type: 'summit',    elevation_m: 1170}),
  ee.Feature(ee.Geometry.Point([20.7022, 49.6203]), {name: 'Nowy Sącz',         type: 'town',      elevation_m: 290})
]);

// .size() counts the features.
print('Number of sites:', sites.size());

// Print the whole collection (works well for small collections).
print('All sites:', sites);

// .aggregate_array('property') pulls one column out as a list.
print('Site names:', sites.aggregate_array('name'));

// .aggregate_mean / _min / _max / _sum summarise a numeric column.
print('Mean elevation of sites (m):', sites.aggregate_mean('elevation_m'));

// .first() returns the first feature in the collection.
print('First site:', sites.first());

// Add the collection to the map in magenta.
Map.addLayer(sites, {color: 'magenta'}, 'Sites');


// =============================================================================
// PART 6 — Filtering a FeatureCollection
// =============================================================================

// ee.Filter.eq(property, value) keeps features where property EQUALS value.
var towns = sites.filter(ee.Filter.eq('type', 'town'));
print('Only towns:', towns);

// ee.Filter.gt = greater than; also .lt (less than), .gte, .lte, .neq (not equal).
var highSites = sites.filter(ee.Filter.gt('elevation_m', 450));
print('Sites above 450 m:', highSites.aggregate_array('name'));

// ee.Filter.inList keeps features whose value is in a list of options.
var hazardSites = sites.filter(ee.Filter.inList('type', ['landslide', 'reservoir']));
print('Landslide and reservoir sites:', hazardSites.aggregate_array('name'));

// ee.Filter.and() combines two filters (both must be true).
var lowTowns = sites.filter(ee.Filter.and(
  ee.Filter.eq('type', 'town'),          // must be a town...
  ee.Filter.lt('elevation_m', 350)       // ...AND lower than 350 m
));
print('Towns below 350 m:', lowTowns.aggregate_array('name'));

// .filterBounds(geometry) keeps features that fall inside an area.
var sitesNearKlodne = sites.filterBounds(klodneBuffer);
print('Sites within 1 km of Kłodne:', sitesNearKlodne.aggregate_array('name'));

// .sort('property', false) orders features; false = descending (high → low).
print('Sites from highest to lowest:', sites.sort('elevation_m', false).aggregate_array('name'));


// =============================================================================
// PART 7 — Doing something to EVERY feature with .map()
// =============================================================================

// .map(function) runs the same function on every feature and returns a new collection.
var siteBuffers = sites.map(function(feature) {
  // Make a 1 km buffer around this feature's point.
  var buffered = feature.buffer(1000);
  // Calculate its area in hectares (m² ÷ 10,000) and store it as a new property.
  return buffered.set('area_ha', buffered.geometry().area(1).divide(10000));
});

// Print the buffered collection — note the new "area_ha" property.
print('Sites with 1 km buffers:', siteBuffers);

// Show the buffers on the map.
Map.addLayer(siteBuffers, {color: 'white'}, 'Site buffers (1 km)', false);


// =============================================================================
// PART 8 — Styling vector layers
// =============================================================================

// .style() gives more control over how features are drawn.
//   color     → outline colour       fillColor → inside colour ('00000000' = transparent)
//   width     → outline thickness    pointSize → size of point symbols
var styledSites = sites.style({
  color: 'ffff00',        // yellow outline
  fillColor: 'ff000088',  // red fill, 88 = half-transparent (last 2 hex digits)
  pointSize: 7,           // big points
  width: 2                // outline width in pixels
});

// A styled collection is already an image, so we give NO visualisation options {}.
Map.addLayer(styledSites, {}, 'Sites (styled)');


// =============================================================================
// PART 9 — Administrative boundaries from the data catalog
// =============================================================================

// FAO GAUL = Global Administrative Unit Layers.
// level0 = countries, level1 = provinces (in Poland: voivodeships),
// level2 = the next level down (districts).
var gaulCountries = ee.FeatureCollection('FAO/GAUL/2015/level0');
var gaulProvinces = ee.FeatureCollection('FAO/GAUL/2015/level1');
var gaulDistricts = ee.FeatureCollection('FAO/GAUL/2015/level2');

// The country outline: keep the feature whose ADM0_NAME is 'Poland'.
var poland = gaulCountries.filter(ee.Filter.eq('ADM0_NAME', 'Poland'));

// The voivodeship that CONTAINS Limanowa. filterBounds() with a point finds it
// without needing to know how the name is spelled in the dataset.
var voivodeship = gaulProvinces.filterBounds(limanowa);

// Print its name as stored in GAUL (useful if you later filter by name).
print('Voivodeship containing Limanowa:', voivodeship.aggregate_array('ADM1_NAME'));

// ee.Feature( ... first() ) takes that single voivodeship as a Feature.
var voivodeshipFeature = ee.Feature(voivodeship.first());

// All districts of this voivodeship: same province code (ADM1_CODE).
var districts = gaulDistricts.filter(ee.Filter.eq('ADM1_CODE', voivodeshipFeature.get('ADM1_CODE')));

// Count them and list their names (ADM2_NAME = district name).
print('Districts in the voivodeship:', districts.size());
print('District names:', districts.aggregate_array('ADM2_NAME'));

// The single district that contains Limanowa.
var limanowaDistrict = districts.filterBounds(limanowa);
print('District containing Limanowa:', limanowaDistrict.aggregate_array('ADM2_NAME'));

// To draw ONLY the outlines (no fill), "paint" the boundaries onto an empty image:
//   ee.Image()          → an empty image
//   .byte()             → store values as small whole numbers (saves memory)
//   .paint({...})       → burn the features into the image
//      featureCollection → which features
//      color: 1          → the pixel value to burn in
//      width: 2          → line width in pixels
var districtOutlines = ee.Image().byte().paint({
  featureCollection: districts,   // the districts of the voivodeship
  color: 1,                       // burn value 1 into the pixels under the lines
  width: 2                        // 2-pixel-wide lines
});

// Show the outlines in black.
Map.addLayer(districtOutlines, {palette: ['000000']}, 'District boundaries');

// Show the Limanowa district in a red outline the same way.
Map.addLayer(ee.Image().byte().paint({featureCollection: limanowaDistrict, color: 1, width: 3}),
             {palette: ['ff0000']}, 'Limanowa district');

// Show the national border in a thick dark-blue line (switched off).
Map.addLayer(ee.Image().byte().paint({featureCollection: poland, color: 1, width: 3}),
             {palette: ['08306b']}, 'Poland (GAUL)', false);

// Which districts touch our study area? filterBounds() answers that.
print('Districts touching the AOI:',
      gaulDistricts.filterBounds(aoi).aggregate_array('ADM2_NAME'));

// NOTE: GAUL boundaries are simplified and may not match Poland's official
// boundaries. For published maps use the official State Register of Boundaries
// (PRG) from GUGiK, uploaded as an asset (Script 06).


// =============================================================================
// PART 10 — Drawing your own geometry (no code needed!)
// =============================================================================

// 1. Switch the basemap to "Satellite" (top-right of the map) and zoom in near
//    Kłodne. Look for a bare, scarred patch on a forested or grassy slope.
// 2. Hover over the map's top-left corner and pick the polygon tool.
// 3. Draw around the patch. A variable called "geometry" appears in the IMPORTS
//    section at the very top of the script.
// 4. Click the cog ⚙ next to it to rename it (e.g. "my_landslide"), change its
//    colour, or turn it into a Feature / FeatureCollection with a property.
// 5. You can then use it like any other variable, e.g.:
//       print(geometry.area(1).divide(10000));   // area in hectares
//       Map.centerObject(geometry);
// This is exactly how landslide inventories start: someone draws the outline
// of each landslide on imagery or a LiDAR hillshade.


/*******************************************************************************
 * TRY IT YOURSELF
 *   1. Add a new Feature to "sites" for a place you know, with name, type and
 *      elevation_m. Re-run and check the counts and the mean elevation.
 *   2. Make a 5 km buffer around Limanowa and find which sites fall inside.
 *   3. Change "limanowa" in PART 9 to a point in YOUR voivodeship and print
 *      the district names there.
 *   4. Use .map() on "districts" to add an "area_km2" property to each district,
 *      then sort them and print the 3 largest. (Hint: .limit(3) keeps the first 3.)
 ******************************************************************************/
