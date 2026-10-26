# Module 1 · Part 0 — Setting up Google Earth Engine

This handout walks you through everything you need **before** you write your first line of code.
No programming knowledge is needed.

---

## 1. What is Google Earth Engine (GEE)?

Google Earth Engine is a **cloud platform for analysing satellite images and other geospatial data**.

| Traditional GIS / remote sensing (e.g. QGIS, ArcGIS, ENVI) | Google Earth Engine |
|---|---|
| You **download** every image to your computer | The data **already sits in Google's data centres** (many petabytes) |
| Your laptop does the processing | **Google's servers** do the processing |
| Processing 20 years of Landsat takes days and terabytes of disk | Takes seconds to minutes, no downloads |
| Point-and-click menus | You write short **scripts** (JavaScript or Python) |

### How it works (the big idea)

1. You write a script in your web browser (the **Code Editor**).
2. When you press **Run**, the script is sent to Google's servers as a *recipe* (a list of instructions).
3. The servers fetch the data, run the recipe, and send back **only what you asked to see**:
   map tiles, a number, a chart, or a file export.

This is why GEE is fast: you never move the raw data. Everything that starts with `ee.`
in a script (for example `ee.Image`, `ee.ImageCollection`) lives **on the server**.

### When should you use GEE?

**Good for**
- Large areas (district, state, country, continent)
- Long time periods (years or decades of imagery)
- Standard public datasets: Landsat, Sentinel-1/2, MODIS, DEMs, rainfall, land cover…
- Repeatable workflows (run the same analysis for a new year with one change)

**Not ideal for**
- Very small, very detailed jobs with your own drone or LiDAR data (desktop software may be easier)
- Complex cartography / print layouts (export from GEE and finish in QGIS)
- Workflows that need custom algorithms GEE doesn't provide

---

## 2. Creating an account and a Cloud project

GEE is **free for non-commercial use** (students, teachers, researchers, NGOs).
Since 2022 every user needs a **Google Cloud project** registered for Earth Engine.
You do **not** need to enter a credit card for non-commercial use.

> The wording of the sign-up screens changes from time to time. If a button label below is
> slightly different, choose the option that means the same thing.

1. **Get a Google account** — any Gmail account, or your university Google account.
2. Go to **https://code.earthengine.google.com** and sign in.
3. If you are new, you will be sent to the **registration page**. Choose:
   - **Register a Noncommercial or Commercial Cloud project** → **Unpaid usage / Noncommercial**
   - Project type: choose the option that fits you, e.g. **Academia & Research** (or the student / education option if shown).
4. **Create a new Google Cloud project**
   - Project ID: something short and unique, e.g. `gee-yourname-2026`
     (lower-case letters, digits and hyphens only — **write it down**, you will use it for assets).
5. Accept the terms and click **Continue to summary → Confirm**.
6. You will land in the Code Editor. At the top-right you should see your project name.
   If you have several projects, click your profile picture → **Project info** to switch.

**Check that it works:** type `print('Hello');` into the middle panel and press **Run**.
The word *Hello* should appear in the **Console** tab on the right.

---

## 3. Tour of the Code Editor

```
┌──────────────────────────── Search bar (places & datasets) ───────────────────────────┐
│ LEFT PANEL               │ CODE EDITOR (middle)                │ RIGHT PANEL            │
│  • Scripts               │  Get Link | Save | Run | Reset |    │  • Inspector           │
│  • Docs                  │  Apps | ⚙                           │  • Console             │
│  • Assets                │                                      │  • Tasks               │
│                          │  your code goes here                 │                        │
├──────────────────────────┴──────────────────────────────────────┴────────────────────────┤
│ MAP  — geometry drawing tools (top-left), Layers list (top-right), Map/Satellite toggle  │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### Left panel
| Tab | What it is for |
|---|---|
| **Scripts** | Your saved scripts. Create a **repository** (e.g. `GEE_Course`) and save each class script in it. The *Examples* folder has hundreds of official examples. |
| **Docs** | The full list of every Earth Engine function with its arguments. Search here when you forget a function name. |
| **Assets** | Your own uploaded data (shapefiles, CSVs, GeoTIFFs) and exported results. Click **NEW** to upload. |

### Middle panel (the code editor)
| Button | What it does |
|---|---|
| **Run** (Ctrl/Cmd + Enter) | Sends your script to Google's servers and runs it |
| **Save** (Ctrl/Cmd + S) | Saves the script into your repository |
| **Get Link** | Creates a URL that shares a *snapshot* of your script with others |
| **Reset** | Clears the console and the map (and can clear the code) |
| **Apps** | Publish a script as a web app |

Useful tricks:
- **Ctrl/Cmd + /** comments or un-comments the selected lines.
- Red underlines = syntax mistakes. Hover over them to read the hint.
- Typing `ee.` and pausing shows a list of suggestions.

### Right panel
| Tab | What it is for |
|---|---|
| **Inspector** | Click it, then click anywhere on the map to see pixel values of every layer at that point. |
| **Console** | Shows anything you `print()`, plus error messages (in red). Click the small grey triangles to expand objects. |
| **Tasks** | Exports (to Google Drive or Assets) wait here. You must click **RUN** next to each task to start it. |

### The map
- **Geometry tools** (top-left of the map): draw points, lines, polygons and rectangles.
  Each drawing becomes a variable listed in the **Imports** section at the top of your script.
- **Layers** (top-right of the map): switch layers on/off, change transparency, and click the ⚙
  next to a layer to change its colour stretch interactively.
- **Search bar** at the top: type a place name to fly there, or a dataset name
  (e.g. *Sentinel-2*) to find it in the data catalog and click **Import**.

---

## 4. How to use the course scripts

1. In the **Scripts** tab click **NEW → Repository** and name it `GEE_Course`.
2. For each class, click **NEW → File**, give it the script name (e.g. `01_hello_earth_engine`).
3. Copy the whole `.js` file from this folder, paste it into the editor, **Save**, then **Run**.
4. Read the comments (green text starting with `//`) from top to bottom while you run it.
5. Do the **TRY IT YOURSELF** exercises at the end of each script.

Every script starts with a **study area** called `aoi` (area of interest).
To work on your own area, change only that one line (or draw a rectangle and use it instead).
