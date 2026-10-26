/*******************************************************************************
 * GOOGLE EARTH ENGINE FOR BEGINNERS
 * Module 4 · Script 11 — Time-series analysis and charts
 * -----------------------------------------------------------------------------
 * A TIME SERIES follows how a value (NDVI, rainfall, temperature …) changes
 * over time at a place. Earth Engine's archive goes back decades, so you can
 * study seasons (phenology), droughts, and long-term trends.
 *
 * WHAT YOU WILL LEARN
 *   • ui.Chart.image.series         — one line for one place
 *   • ui.Chart.image.seriesByRegion — several places on one chart
 *   • ui.Chart.image.doySeriesByYear — compare years on a day-of-year axis
 *   • Building monthly rainfall totals and charting them
 *   • A linear TREND map (slope per pixel) with ee.Reducer.linearFit
 *   • Clicking the map to make a chart (interactive)
 ******************************************************************************/


// =============================================================================
// PART 0 — Study area and sample sites
// =============================================================================

// Study area rectangle [west, south, east, north].
var aoi = ee.Geometry.Rectangle([76.75, 31.45, 77.25, 31.85]);

// Zoom to it.
Map.centerObject(aoi, 10);

// Sample sites for the charts. ► Check them with the Inspector and move them
// onto the land cover you want (or draw your own points).
var sites = ee.FeatureCollection([
  ee.Feature(ee.Geometry.Point([76.9000, 31.5900]), {name: 'Farmland (Balh valley)'}),
  ee.Feature(ee.Geometry.Point([77.0800, 31.7400]), {name: 'Forest near Prashar'}),
  ee.Feature(ee.Geometry.Point([76.9318, 31.7084]), {name: 'Mandi town'})
]);

// Show the sites.
Map.addLayer(sites, {color: 'red'}, 'Chart sites');


// =============================================================================
// PART 1 — A Sentinel-2 NDVI time series (2022–2024)
// =============================================================================

// Cloud Score+ for masking.
var csPlus = ee.ImageCollection('GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED');

// Function: mask clouds and compute NDVI, keeping the image date.
function s2Ndvi(image) {
  // Clear-sky mask from Cloud Score+.
  var clear = image.select('cs_cdf').gte(0.6);
  // NDVI from NIR (B8) and red (B4), with cloudy pixels hidden.
  var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI').updateMask(clear);
  // Return NDVI with the date copied from the original image.
  return ee.Image(ndvi.copyProperties(image, ['system:time_start']));
}

// NDVI collection over the AOI for three years.
var ndviCollection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(aoi)                           // our area
  .filterDate('2022-01-01', '2025-01-01')      // 2022, 2023 and 2024
  .linkCollection(csPlus, ['cs_cdf'])          // attach cloud score
  .map(s2Ndvi);                                // cloud-masked NDVI for each image

// How many images?
print('S2 NDVI images 2022–2024:', ndviCollection.size());

// ---- Chart 1: NDVI at ONE site ---------------------------------------------
// The first site (the farmland point).
var farmPoint = ee.Feature(sites.first()).geometry();

// ui.Chart.image.series(collection, region, reducer, scale) draws value vs. date.
var chartOneSite = ui.Chart.image.series({
  imageCollection: ndviCollection,        // images to read
  region: farmPoint,                      // the place
  reducer: ee.Reducer.mean(),             // how to summarise pixels in the region
  scale: 10,                              // pixel size
  xProperty: 'system:time_start'          // x-axis = image date
}).setOptions({
  title: 'Sentinel-2 NDVI — farmland site',          // chart title
  vAxis: {title: 'NDVI', viewWindow: {min: -0.1, max: 1}}, // y-axis label and range
  hAxis: {title: 'Date', format: 'MMM yyyy'},        // x-axis label and date format
  lineWidth: 1,                                      // thin line
  pointSize: 3,                                      // show each observation as a dot
  colors: ['e37d05']                                 // orange
});

// Print the chart. Hover over points to see values; click the ↗ icon to enlarge,
// and download the data as CSV/PNG from there.
print(chartOneSite);

// ---- Chart 2: NDVI at SEVERAL sites ----------------------------------------
var chartSites = ui.Chart.image.seriesByRegion({
  imageCollection: ndviCollection,   // images to read
  regions: sites,                    // all sites
  reducer: ee.Reducer.mean(),        // summarise each site
  band: 'NDVI',                      // the band to chart
  scale: 10,                         // pixel size
  seriesProperty: 'name'             // use the "name" property for the legend
}).setOptions({
  title: 'Sentinel-2 NDVI at three sites',              // title
  vAxis: {title: 'NDVI', viewWindow: {min: -0.1, max: 1}}, // y-axis
  hAxis: {title: 'Date', format: 'MMM yyyy'},           // x-axis
  lineWidth: 1,                                         // thin lines
  pointSize: 3                                          // dots for each image
});

// Print it.
print(chartSites);

// NOTE: gaps = dates when the site was cloudy (masked). Crops show 2 peaks a
// year (rabi wheat in spring, kharif maize/rice in late summer); forest is
// steadily high; the town stays low.


// =============================================================================
// PART 2 — Long-term MODIS NDVI (2001–2024) for the whole AOI
// =============================================================================

// MODIS 16-day NDVI at 250 m, converted to −1…1, keeping the date.
var modisNdvi = ee.ImageCollection('MODIS/061/MOD13Q1')
  .filterDate('2001-01-01', '2025-01-01')            // 24 years
  .select('NDVI')                                    // NDVI band
  .map(function(image) {                             // for each image:
    return ee.Image(image.multiply(0.0001)           //   scale it
      .copyProperties(image, ['system:time_start'])); //   keep its date
  });

// Chart the AOI-average NDVI for 24 years.
print(ui.Chart.image.series({
  imageCollection: modisNdvi,     // ~550 images
  region: aoi,                    // the whole AOI
  reducer: ee.Reducer.mean(),     // average over the AOI
  scale: 250                      // MODIS pixel size
}).setOptions({
  title: 'MODIS NDVI 2001–2024, AOI mean',  // title
  vAxis: {title: 'NDVI'},                   // y label
  hAxis: {title: 'Year'},                   // x label
  lineWidth: 1,                             // thin line
  colors: ['1a9850'],                       // green
  trendlines: {0: {color: 'red', lineWidth: 2, opacity: 0.6}} // straight-line trend in red
}));


// =============================================================================
// PART 3 — Comparing YEARS on a day-of-year axis
// =============================================================================

// Each year becomes one coloured line from day 1 to day 365.
print(ui.Chart.image.doySeriesByYear({
  imageCollection: modisNdvi.filterDate('2020-01-01', '2025-01-01'), // 5 years
  bandName: 'NDVI',                   // the band
  region: aoi,                        // the AOI
  regionReducer: ee.Reducer.mean(),   // average over the AOI
  scale: 250,                         // MODIS pixel size
  startDay: 1,                        // 1 January
  endDay: 365                         // 31 December
}).setOptions({
  title: 'MODIS NDVI by day of year (2020–2024)', // title
  vAxis: {title: 'NDVI'},                         // y label
  hAxis: {title: 'Day of year'},                  // x label
  lineWidth: 2                                    // thicker lines
}));


// =============================================================================
// PART 4 — Monthly rainfall totals from CHIRPS (2015–2024)
// =============================================================================

// Daily rainfall (mm/day).
var chirps = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY').select('precipitation');

// A list of the first day of every month: 120 months from Jan 2015.
var startDate = ee.Date('2015-01-01');                  // the first month
var monthOffsets = ee.List.sequence(0, 119);            // 0, 1, 2 … 119

// For each month: sum the daily images → a monthly total image.
var monthlyRain = ee.ImageCollection.fromImages(monthOffsets.map(function(n) {
  // The first day of this month.
  var monthStart = startDate.advance(n, 'month');
  // The first day of the next month.
  var monthEnd = monthStart.advance(1, 'month');
  // Sum all days of the month and attach the month's date for the chart.
  return chirps.filterDate(monthStart, monthEnd)       // the days in the month
               .sum()                                   // total rainfall (mm)
               .rename('rain_mm')                       // band name
               .set('system:time_start', monthStart.millis()); // date for the x-axis
}));

// Column chart of monthly rainfall over the AOI.
print(ui.Chart.image.series({
  imageCollection: monthlyRain,   // 120 monthly totals
  region: aoi,                    // the AOI
  reducer: ee.Reducer.mean(),     // average over the AOI
  scale: 5000                     // CHIRPS pixel size (~5 km)
}).setChartType('ColumnChart').setOptions({
  title: 'Monthly rainfall (CHIRPS), AOI mean',  // title
  vAxis: {title: 'Rainfall (mm/month)'},         // y label
  hAxis: {title: 'Month'},                       // x label
  colors: ['2b8cbe'],                            // blue bars
  legend: {position: 'none'}                     // no legend
}));


// =============================================================================
// PART 5 — A TREND MAP: is NDVI going up or down at each pixel?
// =============================================================================

// Step 1: one image per year = that year's mean NDVI, with a time band "t".
var years = ee.List.sequence(2001, 2024);

// Build the annual images.
var annualNdvi = ee.ImageCollection.fromImages(years.map(function(y) {
  // Mean NDVI for year y.
  var yearMean = modisNdvi.filter(ee.Filter.calendarRange(y, y, 'year')).mean();
  // A band holding the year itself (the x of our regression).
  var timeBand = ee.Image.constant(y).float().rename('t');
  // linearFit needs [x, y] in that ORDER: time first, NDVI second.
  return timeBand.addBands(yearMean.rename('NDVI'))
                 .set('system:time_start', ee.Date.fromYMD(y, 7, 1).millis()); // mid-year date
}));

// Step 2: fit a straight line NDVI = offset + scale × year at EVERY pixel.
// Output bands: 'scale' = slope (NDVI change per year), 'offset' = intercept.
var fit = annualNdvi.select(['t', 'NDVI']).reduce(ee.Reducer.linearFit());

// Slope per year × 10 = change per decade (easier to read).
var slopePerDecade = fit.select('scale').multiply(10).clip(aoi);

// Show it: brown = browning (decline), white = no change, green = greening.
Map.addLayer(slopePerDecade, {min: -0.1, max: 0.1, palette: ['8c510a', 'f5f5f5', '01665e']},
             'NDVI trend 2001–2024 (per decade)');

// A more robust alternative (less affected by outliers): Sen's slope.
var sensSlope = annualNdvi.select(['t', 'NDVI']).reduce(ee.Reducer.sensSlope());
Map.addLayer(sensSlope.select('slope').multiply(10).clip(aoi),
             {min: -0.1, max: 0.1, palette: ['8c510a', 'f5f5f5', '01665e']},
             "NDVI Sen's slope (per decade)", false);


// =============================================================================
// PART 6 — INTERACTIVE: click the map to get a chart for that spot
// =============================================================================

// A panel (box) on the map to hold the chart.
var chartPanel = ui.Panel({style: {width: '420px', position: 'bottom-right'}});

// An instruction label inside the panel.
chartPanel.add(ui.Label('Click anywhere on the map to see its MODIS NDVI history.'));

// Add the panel to the map.
Map.add(chartPanel);

// Map.onClick runs our function every time the user clicks the map.
Map.onClick(function(coords) {
  // coords contains lon and lat of the click. Make a point there.
  var clickedPoint = ee.Geometry.Point([coords.lon, coords.lat]);
  // Build a chart of MODIS NDVI at that point.
  var clickChart = ui.Chart.image.series({
    imageCollection: annualNdvi.select('NDVI'),  // annual mean NDVI
    region: clickedPoint,                        // the clicked point
    reducer: ee.Reducer.mean(),                  // value at the point
    scale: 250                                   // MODIS pixel size
  }).setOptions({
    title: 'Annual mean NDVI at ' + coords.lon.toFixed(3) + ', ' + coords.lat.toFixed(3), // title
    vAxis: {title: 'NDVI'},                                  // y label
    trendlines: {0: {color: 'red'}},                         // add a trend line
    legend: {position: 'none'}                               // no legend
  });
  // Replace whatever was in the panel with the new chart.
  chartPanel.widgets().reset([clickChart]);
});

// Use a cross-hair cursor so users know they can click.
Map.style().set('cursor', 'crosshair');


/*******************************************************************************
 * TRY IT YOURSELF
 *   1. Add a 4th site on Pandoh reservoir and chart MNDWI ('B3','B11') instead
 *      of NDVI. When is the reservoir fullest?
 *   2. Change PART 4 to annual rainfall totals for 1981–2024 (use 'year' instead
 *      of 'month'). Was any recent year exceptionally wet?
 *   3. Make a temperature time series with 'MODIS/061/MOD11A2' (LST_Day_1km × 0.02
 *      − 273.15).
 *   4. In PART 5 compute the trend of annual MAXIMUM NDVI (.max() instead of .mean()).
 ******************************************************************************/
