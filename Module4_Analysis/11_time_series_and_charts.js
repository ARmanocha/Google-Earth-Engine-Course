/*******************************************************************************
 * GOOGLE EARTH ENGINE FOR BEGINNERS — Landslides in the Polish Carpathians
 * Module 4 · Script 11 — Time-series analysis and charts
 * -----------------------------------------------------------------------------
 * A TIME SERIES follows how a value (NDVI, rainfall, temperature …) changes
 * over time at a place. Earth Engine's archive goes back decades, so you can
 * study seasons, droughts, long-term trends — and the rain that triggered
 * the landslides of May–June 2010.
 *
 * WHAT YOU WILL LEARN
 *   • ui.Chart.image.series         — one line for one place
 *   • ui.Chart.image.seriesByRegion — several places on one chart
 *   • ui.Chart.image.doySeriesByYear — compare years on a day-of-year axis
 *   • Building monthly rainfall totals and charting them
 *   • Daily and CUMULATIVE rainfall before a landslide event
 *   • A linear TREND map (slope per pixel) with ee.Reducer.linearFit
 *   • Clicking the map to make a chart (interactive)
 ******************************************************************************/


// =============================================================================
// PART 0 — Study area and sample sites
// =============================================================================

// Study area rectangle [west, south, east, north]: Limanowa and the Rożnów Reservoir.
var aoi = ee.Geometry.Rectangle([20.25, 49.60, 20.80, 49.85]);

// Zoom to it.
Map.centerObject(aoi, 10);

// Sample sites for the charts. ► These points are approximate: check them with
// the Inspector and move them onto the land cover you want (or draw your own).
var sites = ee.FeatureCollection([
  ee.Feature(ee.Geometry.Point([20.4000, 49.7500]), {name: 'Farmland north of Limanowa'}),
  ee.Feature(ee.Geometry.Point([20.2800, 49.6600]), {name: 'Forest on Mogielica'}),
  ee.Feature(ee.Geometry.Point([20.4228, 49.7064]), {name: 'Limanowa town'})
]);

// The village of Kłodne, where a large landslide started on 1 June 2010.
var klodne = ee.Geometry.Point([20.5661, 49.6850]);

// Show the sites.
Map.addLayer(sites, {color: 'red'}, 'Chart sites');
Map.addLayer(klodne, {color: 'yellow'}, 'Kłodne');


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
  vAxis: {title: 'NDVI', viewWindow: {min: -0.2, max: 1}}, // y-axis label and range
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
  vAxis: {title: 'NDVI', viewWindow: {min: -0.2, max: 1}}, // y-axis
  hAxis: {title: 'Date', format: 'MMM yyyy'},           // x-axis
  lineWidth: 1,                                         // thin lines
  pointSize: 3                                          // dots for each image
});

// Print it.
print(chartSites);

// NOTE: gaps = dates when the site was cloudy (masked). Fields are green in late
// spring and early summer and drop sharply at harvest (July–August); forest is
// high from May to October and lower in winter (leafless beech, snow); the town
// stays low. Snow can push NDVI below 0 on winter dates.


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
// PART 4 — Monthly precipitation totals from ERA5-Land (2015–2024)
// =============================================================================

// Daily precipitation in METRES of water (rain + melted snow).
var era5 = ee.ImageCollection('ECMWF/ERA5_LAND/DAILY_AGGR').select('total_precipitation_sum');

// A list of the first day of every month: 120 months from Jan 2015.
var startDate = ee.Date('2015-01-01');                  // the first month
var monthOffsets = ee.List.sequence(0, 119);            // 0, 1, 2 … 119

// For each month: sum the daily images → a monthly total image in mm.
var monthlyRain = ee.ImageCollection.fromImages(monthOffsets.map(function(n) {
  // The first day of this month.
  var monthStart = startDate.advance(n, 'month');
  // The first day of the next month.
  var monthEnd = monthStart.advance(1, 'month');
  // Sum all days of the month, convert m → mm, and attach the month's date.
  return era5.filterDate(monthStart, monthEnd)         // the days in the month
             .sum()                                     // total precipitation (m)
             .multiply(1000)                            // metres → millimetres
             .rename('rain_mm')                         // band name
             .set('system:time_start', monthStart.millis()); // date for the x-axis
}));

// Column chart of monthly precipitation over the AOI.
print(ui.Chart.image.series({
  imageCollection: monthlyRain,   // 120 monthly totals
  region: aoi,                    // the AOI
  reducer: ee.Reducer.mean(),     // average over the AOI
  scale: 11132                    // ERA5-Land pixel size (~11 km)
}).setChartType('ColumnChart').setOptions({
  title: 'Monthly precipitation (ERA5-Land), AOI mean',  // title
  vAxis: {title: 'Precipitation (mm/month)'},            // y label
  hAxis: {title: 'Month'},                               // x label
  colors: ['2b8cbe'],                                    // blue bars
  legend: {position: 'none'}                             // no legend
}));


// =============================================================================
// PART 5 — The rain before the landslides of May–June 2010
// =============================================================================

// Landslides in the Carpathians are usually TRIGGERED by rain that soaks the
// ground for days or weeks. Here we look at the precipitation at Kłodne before
// its landslide started on 1 June 2010.

// ---- 5a. Daily precipitation, 1 April – 31 July 2010 ------------------------
// Each daily image converted to mm (and the date kept for the chart).
var daily2010 = era5.filterDate('2010-04-01', '2010-08-01').map(function(image) {
  return ee.Image(image.multiply(1000).rename('rain_mm')
    .copyProperties(image, ['system:time_start']));
});

// A column chart: one bar per day.
print(ui.Chart.image.series({
  imageCollection: daily2010,     // ~120 daily images
  region: klodne,                 // the value at Kłodne
  reducer: ee.Reducer.mean(),     // the pixel value
  scale: 11132                    // ERA5-Land pixel size
}).setChartType('ColumnChart').setOptions({
  title: 'Daily precipitation at Kłodne, Apr–Jul 2010 (landslide: 1 June)', // title
  vAxis: {title: 'Precipitation (mm/day)'},   // y label
  hAxis: {title: 'Date'},                     // x label
  colors: ['08519c'],                         // dark blue bars
  legend: {position: 'none'}                  // no legend
}));

// ---- 5b. CUMULATIVE precipitation: 2010 compared with 2009 -----------------
// For day n after 1 April, add up all the rain from 1 April to that day —
// once for 2010 and once for 2009, the year before, for comparison.
var dayOffsets = ee.List.sequence(0, 121);               // 0 … 121 = 1 April … 31 July

var cumulative = ee.ImageCollection.fromImages(dayOffsets.map(function(n) {
  // The day in 2010 and the same calendar day in 2009.
  var day2010 = ee.Date('2010-04-01').advance(n, 'day');
  var day2009 = ee.Date('2009-04-01').advance(n, 'day');
  // Sum from 1 April up to and including that day (the end date is not included,
  // so we advance one more day), then convert m → mm.
  var total2010 = era5.filterDate('2010-04-01', day2010.advance(1, 'day')).sum().multiply(1000);
  var total2009 = era5.filterDate('2009-04-01', day2009.advance(1, 'day')).sum().multiply(1000);
  // One image with two bands, dated on the 2010 day so both lines share the x-axis.
  return total2010.rename('cumulative_2010')
    .addBands(total2009.rename('cumulative_2009'))
    .set('system:time_start', day2010.millis());
}));

// Two lines on one chart: how fast did the water add up in each year?
print(ui.Chart.image.series({
  imageCollection: cumulative,    // 122 images, 2 bands each
  region: klodne,                 // at Kłodne
  reducer: ee.Reducer.mean(),     // the pixel value
  scale: 11132                    // ERA5-Land pixel size
}).setOptions({
  title: 'Cumulative precipitation since 1 April at Kłodne: 2010 vs 2009', // title
  vAxis: {title: 'Precipitation since 1 April (mm)'},  // y label
  hAxis: {title: 'Date (2010 axis)', format: 'd MMM'}, // x label
  colors: ['d7301f', '969696'],                        // 2010 red, 2009 grey
  lineWidth: 2                                         // thick lines
}));

// ---- 5c. Was May 2010 unusual? Compare with the 1991–2020 average May --------
// May total for each year 1991–2020 (30 images), in mm.
var mayTotals = ee.ImageCollection.fromImages(ee.List.sequence(1991, 2020).map(function(y) {
  // 1 May and 1 June of year y.
  var mayStart = ee.Date.fromYMD(y, 5, 1);
  // Sum the 31 days of May and convert m → mm.
  return era5.filterDate(mayStart, mayStart.advance(1, 'month')).sum().multiply(1000).rename('rain_mm');
}));

// The long-term average May total.
var mayAverage = mayTotals.mean();

// The May 2010 total.
var may2010 = era5.filterDate('2010-05-01', '2010-06-01').sum().multiply(1000).rename('rain_mm');

// Read both values at Kłodne (reduceRegion from Script 10).
var mayAverageValue = mayAverage.reduceRegion({reducer: ee.Reducer.mean(), geometry: klodne, scale: 11132}).get('rain_mm');
var may2010Value = may2010.reduceRegion({reducer: ee.Reducer.mean(), geometry: klodne, scale: 11132}).get('rain_mm');

// Print them and their ratio (how many times the normal amount fell).
print('Average May precipitation at Kłodne, 1991–2020 (mm):', mayAverageValue);
print('May 2010 precipitation at Kłodne (mm):', may2010Value);
print('May 2010 ÷ average May:', ee.Number(may2010Value).divide(mayAverageValue));

// CAUTION: ERA5-Land pixels are ~11 km wide, so the values are averages for a
// large area; a rain gauge at the site can record more or less. For research,
// use station data from IMGW-PIB (the Polish national weather service).


// =============================================================================
// PART 6 — A TREND MAP: is NDVI going up or down at each pixel?
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
// PART 7 — INTERACTIVE: click the map to get a chart for that spot
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
 *   1. Add a 4th site on the Rożnów Reservoir (20.7144, 49.7322) and chart
 *      MNDWI ('B3','B11') instead of NDVI. When is the reservoir fullest?
 *   2. In PART 5b compare 2010 with 2011 instead of 2009. Then try 2014 or
 *      2019. Which years came closest to 2010?
 *   3. Make a temperature time series with 'MODIS/061/MOD11A2' (LST_Day_1km × 0.02
 *      − 273.15). When does the ground usually thaw in spring?
 *   4. In PART 6 compute the trend of annual MAXIMUM NDVI (.max() instead of .mean()).
 ******************************************************************************/
