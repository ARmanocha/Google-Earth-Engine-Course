/*******************************************************************************
 * GOOGLE EARTH ENGINE FOR BEGINNERS — Landslides in the Polish Carpathians
 * Module 2 · Script 05 — A tour of the Earth Engine Data Catalog
 * -----------------------------------------------------------------------------
 * The catalog (https://developers.google.com/earth-engine/datasets) has 1000+
 * datasets. This script loads the most useful ones for landslide studies in
 * Poland, one by one. Each section is independent: every layer is added
 * switched OFF so the map stays fast — tick the layer in the Layers menu.
 *
 * DATASET               | ID in Earth Engine                      | Pixel | Since
 * ----------------------|-----------------------------------------|-------|------
 * Landsat 8 / 9         | LANDSAT/LC08(LC09)/C02/T1_L2            | 30 m  | 2013/2021
 * Landsat 5 (history)   | LANDSAT/LT05/C02/T1_L2                  | 30 m  | 1984–2012
 * Sentinel-2            | COPERNICUS/S2_SR_HARMONIZED             | 10 m  | 2017
 * Sentinel-1 (radar)    | COPERNICUS/S1_GRD                       | 10 m  | 2014
 * MODIS vegetation      | MODIS/061/MOD13Q1                       | 250 m | 2000
 * MODIS temperature     | MODIS/061/MOD11A2                       | 1 km  | 2000
 * SRTM DEM              | USGS/SRTMGL1_003                        | 30 m  | 2000
 * Copernicus DEM        | COPERNICUS/DEM/GLO30                    | 30 m  | 2011–15
 * ERA5-Land daily       | ECMWF/ERA5_LAND/DAILY_AGGR              | ~11 km| 1950
 * ERA5-Land monthly     | ECMWF/ERA5_LAND/MONTHLY_AGGR            | ~11 km| 1950
 * ESA WorldCover        | ESA/WorldCover/v200                     | 10 m  | 2021
 * CORINE Land Cover     | COPERNICUS/CORINE/V20/100m/2018         | 100 m | 2018
 * Dynamic World         | GOOGLE/DYNAMICWORLD/V1                  | 10 m  | 2015
 * JRC Surface Water     | JRC/GSW1_4/GlobalSurfaceWater           | 30 m  | 1984–2021
 *
 * NOTE: the popular CHIRPS rainfall dataset only covers 50 °S – 50 °N, so it
 * misses most of Poland. We use ERA5-Land for rainfall instead.
 *
 * HOW TO FIND A DATASET YOURSELF
 *   • Type its name in the search bar at the top of the Code Editor and click it.
 *   • The pop-up shows the description, BANDS (with scale factors!), PROPERTIES,
 *     and an example script. Click "IMPORT" to add it to your script.
 ******************************************************************************/


// =============================================================================
// PART 0 — Study area and dates
// =============================================================================

// Study area rectangle [west, south, east, north]: Limanowa and the Rożnów Reservoir.
var aoi = ee.Geometry.Rectangle([20.25, 49.60, 20.80, 49.85]);

// Zoom to it.
Map.centerObject(aoi, 10);

// We will look at the year 2024 for most datasets.
var start = '2024-01-01';  // first day included
var end = '2025-01-01';    // first day NOT included (so the whole of 2024)


// =============================================================================
// PART 1 — LANDSAT 8 and 9 (USGS/NASA, 30 m, every 8 days with both)
// =============================================================================

// Collection 2 Level-2 = surface reflectance (atmospherically corrected).
// Landsat 8 and Landsat 9 have identical bands, so we can MERGE them.
var landsat = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')          // Landsat 8
  .merge(ee.ImageCollection('LANDSAT/LC09/C02/T1_L2'))               // + Landsat 9
  .filterBounds(aoi)                                                 // our area
  .filterDate(start, end)                                            // 2024
  .filter(ee.Filter.lt('CLOUD_COVER', 20));                          // < 20 % cloud (Landsat's property name)

// How many images?
print('Landsat 8+9 images (2024, <20 % cloud):', landsat.size());

// Landsat pixel values are stored as integers to save space. The catalog says
// reflectance = value × 0.0000275 − 0.2. This function applies that "scale factor".
function scaleLandsat(image) {
  // Select the optical bands SR_B1 ... SR_B7 ('SR_B.' means "SR_B + any one character").
  var optical = image.select('SR_B.').multiply(0.0000275).add(-0.2);
  // Replace the original optical bands with the scaled ones (true = overwrite).
  return image.addBands(optical, null, true);
}

// Apply the function to every image, then take the median.
var landsatComposite = landsat.map(scaleLandsat).median().clip(aoi);

// Landsat 8/9 bands: SR_B2 blue, SR_B3 green, SR_B4 red, SR_B5 NIR, SR_B6 SWIR1, SR_B7 SWIR2.
// After scaling, reflectance is 0–1, so the stretch is 0–0.3.
Map.addLayer(landsatComposite, {bands: ['SR_B4', 'SR_B3', 'SR_B2'], min: 0, max: 0.3},
             'Landsat 8/9 true colour (2024)', false);

// Older Landsat for history: Landsat 5 (1984–2012) 'LANDSAT/LT05/C02/T1_L2' and
// Landsat 7 (1999–) 'LANDSAT/LE07/C02/T1_L2'. Their bands are numbered differently
// (red = SR_B3, NIR = SR_B4) — always check the catalog page!
// Landsat 5 is the only good 30 m archive for the landslides of 2010 (Script 13).


// =============================================================================
// PART 2 — SENTINEL-2 (ESA, 10 m, every ~5 days)
// =============================================================================

// Load, filter and composite Sentinel-2 surface reflectance for summer 2024.
var s2Composite = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(aoi)                                         // our area
  .filterDate('2024-06-01', '2024-09-01')                    // June–August 2024
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))       // fairly clear images
  .median()                                                  // median composite
  .clip(aoi);                                                // cut to AOI

// Values are reflectance × 10000, so the stretch is 0–3000.
Map.addLayer(s2Composite, {bands: ['B4', 'B3', 'B2'], min: 0, max: 3000},
             'Sentinel-2 true colour (summer 2024)', false);


// =============================================================================
// PART 3 — SENTINEL-1 (ESA radar, 10 m, sees through clouds, day and night)
// =============================================================================

// Radar is useful in Poland's often cloudy weather, when optical satellites
// only see clouds.
var s1 = ee.ImageCollection('COPERNICUS/S1_GRD')
  .filterBounds(aoi)                                                   // our area
  .filterDate(start, end)                                              // 2024
  .filter(ee.Filter.eq('instrumentMode', 'IW'))                        // standard land mode
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV')) // has the VV band
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH')) // has the VH band
  .filter(ee.Filter.eq('orbitProperties_pass', 'DESCENDING'))          // same viewing direction
  .select(['VV', 'VH']);                                               // keep the 2 radar bands

// Count the radar images.
print('Sentinel-1 images (2024):', s1.size());

// Values are backscatter in decibels (dB), usually −25 (dark) to 0 (bright).
// Water (e.g. the Rożnów Reservoir) is very dark (smooth surface); towns are very bright.
var s1Median = s1.median().clip(aoi);

// Show VV in grey.
Map.addLayer(s1Median.select('VV'), {min: -25, max: 0}, 'Sentinel-1 VV (dB)', false);

// A colour composite: VV in red, VH in green, VV again in blue.
Map.addLayer(s1Median, {bands: ['VV', 'VH', 'VV'], min: [-20, -25, -20], max: [0, -5, 0]},
             'Sentinel-1 VV/VH composite', false);

// NOTES on radar and landslides:
//   • On steep slopes radar has distortions (layover and shadow).
//   • Slow landslide movement (mm–cm per year) is measured with radar
//     INTERFEROMETRY (InSAR). That needs the radar PHASE, which this GRD dataset
//     does not contain — it is done in other software (e.g. ESA SNAP) or taken
//     from the European Ground Motion Service.


// =============================================================================
// PART 4 — MODIS (NASA, 250 m – 1 km, daily, since 2000)
// =============================================================================

// MOD13Q1 = 16-day vegetation index composites at 250 m.
var modisNdvi = ee.ImageCollection('MODIS/061/MOD13Q1')
  .filterDate(start, end)                  // 2024 (MODIS is global; no need for filterBounds)
  .select('NDVI');                         // keep the NDVI band

// MODIS NDVI is stored × 10000, so multiply by 0.0001 to get −1 … 1.
var modisNdviMean = modisNdvi.mean().multiply(0.0001).clip(aoi);

// A brown-to-green palette for vegetation.
var ndviPalette = ['a50026', 'f46d43', 'fee08b', 'd9ef8b', '66bd63', '006837'];

// Show the mean NDVI for 2024.
Map.addLayer(modisNdviMean, {min: 0, max: 0.8, palette: ndviPalette}, 'MODIS NDVI mean 2024', false);

// MOD11A2 = 8-day land surface temperature (LST) at 1 km.
var modisLst = ee.ImageCollection('MODIS/061/MOD11A2')
  .filterDate(start, end)                  // 2024
  .select('LST_Day_1km');                  // daytime temperature

// Stored in Kelvin × 50. Multiply by 0.02 → Kelvin, subtract 273.15 → °C.
var lstCelsius = modisLst.mean().multiply(0.02).subtract(273.15).clip(aoi);

// Show it from cold (blue) to hot (red).
Map.addLayer(lstCelsius, {min: 0, max: 30, palette: ['040274', '0602ff', '30c8e2', 'fff705', 'ff0000']},
             'MODIS daytime LST 2024 (°C)', false);


// =============================================================================
// PART 5 — DIGITAL ELEVATION MODELS and terrain (the basis of landslide work)
// =============================================================================

// SRTM: a single global image (60 °N to 56 °S — all of Poland is covered).
var srtm = ee.Image('USGS/SRTMGL1_003').clip(aoi);

// Copernicus GLO-30: stored as many tiles (an ImageCollection) → mosaic them.
var copDemCollection = ee.ImageCollection('COPERNICUS/DEM/GLO30').filterBounds(aoi);

// A mosaic loses the original projection, so we copy it from the first tile.
// (Terrain calculations like slope need a proper projection.)
var copDemProjection = copDemCollection.first().select('DEM').projection();

// Mosaic the tiles, select the DEM band, restore the projection and clip.
var copDem = copDemCollection.select('DEM').mosaic().setDefaultProjection(copDemProjection).clip(aoi);

// A palette for elevation.
var demPalette = ['006837', '78c679', 'ffffbf', 'd7b26b', '8c510a', 'ffffff'];

// Show both DEMs (this area spans about 265 m to 1,170 m).
Map.addLayer(srtm, {min: 250, max: 1150, palette: demPalette}, 'SRTM elevation', false);
Map.addLayer(copDem, {min: 250, max: 1150, palette: demPalette}, 'Copernicus DEM elevation', false);

// ee.Terrain functions compute terrain derivatives:
var slope = ee.Terrain.slope(srtm);            // steepness in degrees (0 = flat)
var aspect = ee.Terrain.aspect(srtm);          // direction the slope faces (0–360°, 0 = north)
var hillshade = ee.Terrain.hillshade(srtm);    // shaded relief (sun from the NW by default)

// Show them. Slope is the single most important factor for landslides.
Map.addLayer(hillshade, {min: 0, max: 255}, 'Hillshade', false);
Map.addLayer(slope, {min: 0, max: 35, palette: ['ffffcc', 'fed976', 'fd8d3c', 'e31a1c', '800026']},
             'Slope (°)', false);
Map.addLayer(aspect, {min: 0, max: 360, palette: ['red', 'yellow', 'green', 'blue', 'red']},
             'Aspect (°)', false);

// IMPORTANT: a 30 m DEM smooths away most landslides (many are only 50–200 m
// across). Poland publishes free 1 m LiDAR elevation models on geoportal.gov.pl.
// Upload a LiDAR DEM tile as an asset (Script 06) and its hillshade will show
// landslide scarps, cracks and bulging toes very clearly.


// =============================================================================
// PART 6 — CLIMATE: rainfall and temperature (ERA5-Land)
// =============================================================================

// ERA5-Land daily totals (reanalysis: a weather model fitted to observations).
// The band 'total_precipitation_sum' is the day's rain + snow in METRES of water.
var era5Daily = ee.ImageCollection('ECMWF/ERA5_LAND/DAILY_AGGR')
  .filterDate(start, end)                 // 2024
  .select('total_precipitation_sum');     // daily precipitation (m)

// .sum() adds up all daily images → total for the year; × 1000 converts m → mm.
var annualRain = era5Daily.sum().multiply(1000).clip(aoi);

// Show annual precipitation from dry (pale) to wet (dark blue).
// ERA5-Land pixels are ~11 km, so expect only a few big squares over the AOI.
Map.addLayer(annualRain, {min: 600, max: 1200, palette: ['ffffcc', 'a1dab4', '41b6c4', '2c7fb8', '253494']},
             'ERA5-Land precipitation 2024 (mm)', false);

// ERA5-Land monthly averages for temperature, 1950–present.
var era5Monthly = ee.ImageCollection('ECMWF/ERA5_LAND/MONTHLY_AGGR')
  .filterDate(start, end)                 // 2024
  .select('temperature_2m');              // air temperature 2 m above ground (Kelvin)

// Mean of the 12 months, converted from Kelvin to °C.
var meanTemp = era5Monthly.mean().subtract(273.15).clip(aoi);

// Show it.
Map.addLayer(meanTemp, {min: 2, max: 12, palette: ['313695', '74add1', 'ffffbf', 'f46d43', 'a50026']},
             'ERA5-Land mean air temperature 2024 (°C)', false);

// Why rainfall matters: most Carpathian landslides are TRIGGERED by long or
// intense rain (and snowmelt) that saturates the soil. Script 11 charts the
// rain before the landslides of May–June 2010.


// =============================================================================
// PART 7 — LAND COVER products
// =============================================================================

// ESA WorldCover 2021: 10 m global land cover with 11 classes.
// It is an ImageCollection with one image per version → take the first.
var worldCover = ee.ImageCollection('ESA/WorldCover/v200').first().clip(aoi);

// WorldCover stores its own colours, so {} (no options) shows the official legend.
Map.addLayer(worldCover, {}, 'ESA WorldCover 2021', false);

// CORINE Land Cover 2018: the European land-cover map (100 m, 44 classes).
// More detailed classes than WorldCover (e.g. "complex cultivation patterns",
// "land principally occupied by agriculture with natural vegetation").
var corine = ee.Image('COPERNICUS/CORINE/V20/100m/2018').select('landcover').clip(aoi);

// CORINE also stores its official colours, so {} shows them.
Map.addLayer(corine, {}, 'CORINE Land Cover 2018', false);

// Dynamic World: near-real-time land cover for EVERY Sentinel-2 image.
var dynamicWorld = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1')
  .filterBounds(aoi)                      // our area
  .filterDate(start, end)                 // 2024
  .select('label');                       // the most likely class (0–8) for each pixel

// .mode() = the most frequent class over the year at each pixel.
var dwMode = dynamicWorld.mode().clip(aoi);

// The 9 Dynamic World classes and their official colours, in order 0 → 8.
var dwPalette = [
  '419bdf', // 0 water
  '397d49', // 1 trees
  '88b053', // 2 grass
  '7a87c6', // 3 flooded vegetation
  'e49635', // 4 crops
  'dfc35a', // 5 shrub and scrub
  'c4281b', // 6 built area
  'a59b8f', // 7 bare ground
  'b39fe1'  // 8 snow and ice
];

// Show the yearly Dynamic World map.
Map.addLayer(dwMode, {min: 0, max: 8, palette: dwPalette}, 'Dynamic World 2024 (mode)', false);


// =============================================================================
// PART 8 — WATER: JRC Global Surface Water (Landsat, 1984–2021)
// =============================================================================

// "occurrence" = % of time a pixel was water over 1984–2021.
// Look at the edges of the Rożnów Reservoir: the water level goes up and down.
var waterOccurrence = ee.Image('JRC/GSW1_4/GlobalSurfaceWater').select('occurrence').clip(aoi);

// Show it from rarely water (light) to permanent water (dark blue).
Map.addLayer(waterOccurrence, {min: 0, max: 100, palette: ['ffffff', 'a6cee3', '1f78b4', '08306b']},
             'Surface water occurrence (%)', false);


// =============================================================================
// PART 9 — Printing to learn about any dataset
// =============================================================================

// The quickest way to learn a dataset: print its first image and expand it.
print('Example Landsat image (look at bands & properties):', landsat.first());
print('Example Sentinel-1 image:', s1.first());
print('Example ERA5-Land daily image:', era5Daily.first());


/*******************************************************************************
 * TRY IT YOURSELF
 *   1. Search the catalog for "VIIRS night" and add night-time lights for 2024.
 *   2. Make an ERA5-Land precipitation map for 15 May – 15 June 2010 only
 *      (the weeks of heavy rain before the Kłodne landslide).
 *   3. Compare the Landsat and Sentinel-2 composites when zoomed into Limanowa.
 *      Which is sharper? Why?
 *   4. Use the Inspector to click on a few pixels and compare WorldCover,
 *      CORINE and Dynamic World. Do they agree? Which is most detailed?
 ******************************************************************************/
