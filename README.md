# Google Earth Engine for Beginners — Landslides in the Polish Carpathians

A step-by-step course in Google Earth Engine (GEE) for students with no programming or remote
sensing experience. It is built around a landslide-prone study area in the Polish Carpathians and
ends with students making landslide maps of their own study area.

Every script is written for the **GEE Code Editor (JavaScript)**. **Every line of code is
explained** in a comment, and each script ends with *TRY IT YOURSELF* exercises.

## Course structure

| Module | Lessons |
|---|---|
| 1 · Getting started | 00 Setup and Code Editor tour · 01 Hello, Earth Engine · 02 JavaScript basics |
| 2 · Working with data | 03 Geometries and features · 04 Images and collections · 05 Data catalog tour · 06 Assets and exports |
| 3 · Image processing | 07 Cloud masking and composites · 08 Band math and indices · 09 Functions and mapping · 10 Reducers and zonal statistics |
| 4 · Analysis | 11 Time series and charts · 12 Supervised classification · 13 Change detection |
| Final project | 14 Landslide maps of your study area |

## How to use the scripts

1. **Get access.** Sign in at [code.earthengine.google.com](https://code.earthengine.google.com)
   with a Google account and register a non-commercial Cloud project. Lesson 00 shows how.
2. **Work in order**, from lesson 00 to 14. Each lesson builds on the ones before it.
3. **Run a script.** In the Code Editor's Scripts tab choose **NEW → File**, paste the whole
   `.js` file, **Save**, then press **Run**.
4. **Read along.** Read the comments from top to bottom. Results appear on the map (switch
   layers on in the Layers menu) and in the Console. Then do the exercises at the end.
5. **Exports** wait in the **Tasks** tab until you click **RUN**.

## Study area

All scripts use the same area of interest, around Limanowa and the Rożnów Reservoir
(Małopolska):

```js
var aoi = ee.Geometry.Rectangle([20.25, 49.60, 20.80, 49.85]);
```

To work on your own area, change this line at the top of a script. The Kłodne landslide point
and the 2010 dates in Scripts 11 and 13 belong to this area, so replace them with an event from
your own area.

## Using your own data

Scripts 06, 12 and 14 can load your own uploaded assets: a study-area shapefile, field points or
a landslide inventory. Replace `YOUR-PROJECT-ID` with your Cloud project ID and set the matching
`USE_…` setting at the top of the script to `true`. Practice points for Script 06 are in
`practice_data/field_sites_limanowa.csv`.

## Good to know

- Layers called landslide **candidates** (Scripts 08, 13 and 14) show bare or newly cleared
  ground on slopes. Logging, quarries and fields can look the same, so check each one against
  the imagery before calling it a landslide.
- The susceptibility map in Script 14 is a simple **teaching index**, not an official hazard map.
- If a script reports *"Computation timed out"* or *"User memory limit exceeded"*, use a
  coarser `scale`, add `tileScale: 4`, or use a smaller study area.
