/*******************************************************************************
 * GOOGLE EARTH ENGINE FOR BEGINNERS
 * Module 2 · Script 03 — Geometries, Features and FeatureCollections
 * -----------------------------------------------------------------------------
 * VECTOR DATA in Earth Engine comes in three levels:
 *
 *   ee.Geometry          → just a shape (point, line, polygon). No attributes.
 *   ee.Feature           → a geometry + a table row of properties (attributes).
 *   ee.FeatureCollection → many features together (like a shapefile).
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

// A POINT: [longitude, latitude]. Prashar Lake, Mandi district.
var prashar = ee.Geometry.Point([77.1009, 31.7543]);

// Another point: Mandi town.
var mandiTown = ee.Geometry.Point([76.9318, 31.7084]);

// A LINE STRING: a list of [lon, lat] points joined in order.
// Here a straight line from Mandi town to Prashar Lake.
var lineToLake = ee.Geometry.LineString([[76.9318, 31.7084], [77.1009, 31.7543]]);

// A POLYGON: a list of RINGS; each ring is a list of [lon, lat] corners.
// That's why there are THREE levels of brackets: [ ring [ point [lon, lat] ] ].
// The ring closes automatically (last point joins back to the first).
var triangle = ee.Geometry.Polygon([
  [[76.85, 31.60], [77.05, 31.60], [76.95, 31.75]] // three corners → a triangle
]);

// A RECTANGLE is a quick way to make a box: [west, south, east, north].
// THIS is the study area (AOI = "area of interest") used throughout the course.
var aoi = ee.Geometry.Rectangle([76.75, 31.45, 77.25, 31.85]);

// Zoom the map so the whole study area is visible (zoom level 10).
Map.centerObject(aoi, 10);

// Add each geometry to the map with its own colour.
Map.addLayer(aoi, {color: 'yellow'}, 'Study area (AOI)');   // the rectangle
Map.addLayer(triangle, {color: 'orange'}, 'Triangle');      // the polygon
Map.addLayer(lineToLake, {color: 'cyan'}, 'Line to lake');  // the line
Map.addLayer(prashar, {color: 'red'}, 'Prashar Lake');      // point 1
Map.addLayer(mandiTown, {color: 'blue'}, 'Mandi town');     // point 2


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
print('Line length (km):', lineToLake.length(1).divide(1000));

// .distance() between two geometries, in metres.
print('Mandi → Prashar straight-line distance (km):',
      mandiTown.distance(prashar, 1).divide(1000));

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
// A 2 km circle around Prashar Lake:
var lakeBuffer = prashar.buffer(2000);

// Show the buffer.
Map.addLayer(lakeBuffer, {color: 'red'}, 'Prashar 2 km buffer');

// .intersection() keeps only the part where two shapes overlap.
var overlap = triangle.intersection(lakeBuffer, 1);

// .union() merges two shapes into one.
var merged = triangle.union(lakeBuffer, 1);

// Show both results (switched off — turn them on to look).
Map.addLayer(overlap, {color: 'green'}, 'Triangle ∩ buffer', false);
Map.addLayer(merged, {color: 'purple'}, 'Triangle ∪ buffer', false);

// .contains() and .intersects() answer yes/no questions (ee.Boolean).
print('Does the AOI contain Prashar Lake?', aoi.contains(prashar, 1));
print('Does the triangle touch the lake buffer?', triangle.intersects(lakeBuffer, 1));

// .bounds() gives the bounding rectangle of any shape.
print('Bounding box of the buffer:', lakeBuffer.bounds(1));


// =============================================================================
// PART 4 — Features: geometry + attributes
// =============================================================================

// ee.Feature(geometry, {properties}) attaches an attribute table row to a shape.
var lakeFeature = ee.Feature(prashar, {
  name: 'Prashar Lake',   // a text property
  type: 'lake',           // another text property
  elevation_m: 2730       // a number property (approximate)
});

// Print the feature — expand it to see "geometry" and "properties".
print('A feature:', lakeFeature);

// .get('property') reads one property value.
print('Feature name:', lakeFeature.get('name'));

// .set('property', value) returns a NEW feature with an extra/changed property.
// Earth Engine objects are never changed in place — always save the result!
var lakeFeature2 = lakeFeature.set('visited', 'yes');

// Print the property names of the new feature.
print('Properties after .set():', lakeFeature2.propertyNames());


// =============================================================================
// PART 5 — FeatureCollections
// =============================================================================

// ee.FeatureCollection([list of features]) groups features, like a shapefile.
var sites = ee.FeatureCollection([
  ee.Feature(ee.Geometry.Point([76.9318, 31.7084]), {name: 'Mandi town',   type: 'urban',     elevation_m: 760}),
  ee.Feature(ee.Geometry.Point([77.1009, 31.7543]), {name: 'Prashar Lake', type: 'lake',      elevation_m: 2730}),
  ee.Feature(ee.Geometry.Point([76.8336, 31.6336]), {name: 'Rewalsar',     type: 'lake',      elevation_m: 1360}),
  ee.Feature(ee.Geometry.Point([77.0645, 31.6705]), {name: 'Pandoh Dam',   type: 'reservoir', elevation_m: 900}),
  ee.Feature(ee.Geometry.Point([76.9000, 31.5900]), {name: 'Balh valley',  type: 'farmland',  elevation_m: 820})
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
Map.addLayer(sites, {color: 'magenta'}, 'Field sites');


// =============================================================================
// PART 6 — Filtering a FeatureCollection
// =============================================================================

// ee.Filter.eq(property, value) keeps features where property EQUALS value.
var lakes = sites.filter(ee.Filter.eq('type', 'lake'));
print('Only lakes:', lakes);

// ee.Filter.gt = greater than; also .lt (less than), .gte, .lte, .neq (not equal).
var highSites = sites.filter(ee.Filter.gt('elevation_m', 1000));
print('Sites above 1000 m:', highSites.aggregate_array('name'));

// ee.Filter.inList keeps features whose value is in a list of options.
var waterSites = sites.filter(ee.Filter.inList('type', ['lake', 'reservoir']));
print('Lakes and reservoirs:', waterSites.aggregate_array('name'));

// ee.Filter.and() combines two filters (both must be true).
var lowLakes = sites.filter(ee.Filter.and(
  ee.Filter.eq('type', 'lake'),          // must be a lake...
  ee.Filter.lt('elevation_m', 2000)      // ...AND lower than 2000 m
));
print('Lakes below 2000 m:', lowLakes.aggregate_array('name'));

// .filterBounds(geometry) keeps features that fall inside an area.
var sitesNearLake = sites.filterBounds(lakeBuffer);
print('Sites within 2 km of Prashar:', sitesNearLake.aggregate_array('name'));

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
Map.addLayer(styledSites, {}, 'Field sites (styled)');


// =============================================================================
// PART 9 — Administrative boundaries from the data catalog
// =============================================================================

// FAO GAUL = Global Administrative Unit Layers (country / state / district).
// level0 = countries, level1 = states/provinces, level2 = districts.
var gaulDistricts = ee.FeatureCollection('FAO/GAUL/2015/level2');

// Keep only the districts of Himachal Pradesh (property ADM1_NAME = state name).
var hpDistricts = gaulDistricts.filter(ee.Filter.eq('ADM1_NAME', 'Himachal Pradesh'));

// Count them and list their names (ADM2_NAME = district name).
print('Districts in Himachal Pradesh:', hpDistricts.size());
print('District names:', hpDistricts.aggregate_array('ADM2_NAME'));

// Keep just one district: Mandi.
var mandiDistrict = hpDistricts.filter(ee.Filter.eq('ADM2_NAME', 'Mandi'));

// To draw ONLY the outlines (no fill), "paint" the boundaries onto an empty image:
//   ee.Image()          → an empty image
//   .byte()             → store values as small whole numbers (saves memory)
//   .paint({...})       → burn the features into the image
//      featureCollection → which features
//      color: 1          → the pixel value to burn in
//      width: 2          → line width in pixels
var districtOutlines = ee.Image().byte().paint({
  featureCollection: hpDistricts, // the HP districts
  color: 1,                       // burn value 1 into the pixels under the lines
  width: 2                        // 2-pixel-wide lines
});

// Show the outlines in black.
Map.addLayer(districtOutlines, {palette: ['000000']}, 'HP district boundaries');

// Show Mandi district in red outline the same way.
Map.addLayer(ee.Image().byte().paint({featureCollection: mandiDistrict, color: 1, width: 3}),
             {palette: ['ff0000']}, 'Mandi district');

// Which districts touch our study area? filterBounds() answers that.
print('Districts touching the AOI:',
      gaulDistricts.filterBounds(aoi).aggregate_array('ADM2_NAME'));

// NOTE: Administrative boundary datasets are simplified and may not match your
// country's official boundaries. For published maps, use official boundary
// files (e.g. from your national survey department) uploaded as an asset.


// =============================================================================
// PART 10 — Drawing your own geometry (no code needed!)
// =============================================================================

// 1. Hover over the map's top-left corner and pick a drawing tool
//    (point, line, polygon or rectangle).
// 2. Draw on the map. A variable called "geometry" appears in the IMPORTS
//    section at the very top of the script.
// 3. Click the cog ⚙ next to it to rename it, change its colour, or turn it into
//    a Feature / FeatureCollection with a property (used for training data later).
// 4. You can then use it like any other variable, e.g.:
//       print(geometry.area(1).divide(1e6));
//       Map.centerObject(geometry);


/*******************************************************************************
 * TRY IT YOURSELF
 *   1. Add a new Feature to "sites" for a place you know, with name, type and
 *      elevation_m. Re-run and check the counts and the mean elevation.
 *   2. Make a 5 km buffer around Mandi town and find which sites fall inside.
 *   3. Filter the GAUL districts to YOUR state and print their names.
 *   4. Use .map() on hpDistricts to add an "area_km2" property to each district,
 *      then sort them and print the 3 largest. (Hint: .limit(3) keeps the first 3.)
 ******************************************************************************/
