#!/usr/bin/env python3
"""Build the course web page from the scripts in this folder.

Run it again after editing any script, the setup guide or the practice CSV:

    python3 web/build.py

It reads web/template.html, embeds every lesson, and writes
web/earth_engine_for_beginners.html.
"""
import html
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
WEB = ROOT / "web"
TEMPLATE = WEB / "template.html"
OUTPUT = WEB / "earth_engine_for_beginners.html"

# Folder → (key, sidebar label, module title, one-line description)
MODULES = [
    ("Module1_Getting_Started", "m1", "Module 1", "Getting started",
     "What Earth Engine is, setting up, the Code Editor, and the JavaScript you need."),
    ("Module2_Working_with_Data", "m2", "Module 2", "Working with data",
     "Vector and raster data, the data catalog, filtering, and moving your own data in and out."),
    ("Module3_Image_Processing", "m3", "Module 3", "Image processing",
     "Cloud-free composites, spectral indices, functions over collections, and statistics."),
    ("Module4_Analysis", "m4", "Module 4", "Analysis",
     "Time series, supervised classification with accuracy assessment, and change detection."),
    ("Final_Project", "final", "Final project", "Map your study area",
     "Put everything together for your own study area and produce finished maps."),
]

SUMMARIES = {
    "01": "Your first script: print to the Console, move the map, load a DEM and a Sentinel-2 image, and read pixels with the Inspector.",
    "02": "Variables, lists, dictionaries and functions, plus the key idea of client and server objects.",
    "03": "Points, lines, polygons and buffers; features with attributes; filtering collections; district boundaries.",
    "04": "Inspect images, filter collections by area, date and cloud cover, clip, and compare a mosaic with a median.",
    "05": "Landsat, Sentinel-1 and -2, MODIS, DEMs, CHIRPS rainfall, ERA5 climate, land cover and surface water.",
    "06": "Upload shapefiles, CSVs and GeoTIFFs as assets, then export images and tables to Drive or Assets.",
    "07": "Mask clouds with Cloud Score+, SCL and Landsat QA bits, then build median, seasonal and annual composites.",
    "08": "NDVI, EVI, SAVI, NDWI, MNDWI, NDBI and NBR; thresholds, masks, simple classes and area.",
    "09": "Write your own functions and run them over every image, feature or list item with .map().",
    "10": "Statistics for an area, area per land-cover class, zonal statistics per district, charts and CSV export.",
    "11": "NDVI and rainfall time series, multi-site and day-of-year charts, trend maps, and click-to-chart.",
    "12": "Training data, Random Forest, CART and SVM, confusion matrix and kappa, area per class, and a legend.",
    "13": "Land-cover transitions, NDVI loss, Hansen forest loss, and burn severity from dNBR.",
    "14": "The whole workflow on your own study area, ending in a finished map with legend, inset and exports.",
}

SETUP_SUMMARY = "What Earth Engine is, how to get an account and a Cloud project, and a tour of the Code Editor."

# Lesson number → slide deck link (shown as a "Slides" button on each lesson)
SLIDES = {
    "00": "https://claude.ai/artifact/VHJ5FSC7x5HpHRynVTZ2bE",
    "01": "https://claude.ai/artifact/CpR7dGjLgWi7sXmaonDaUB",
    "02": "https://claude.ai/artifact/19SWHHQMYCKhS9PchPACNn",
    "03": "https://claude.ai/artifact/RcEQykiqSBUeu4FxhZTYgA",
    "04": "https://claude.ai/artifact/EFi9EFTSMED7uy6KJKopt6",
    "05": "https://claude.ai/artifact/Y42UTBZJaeH1NbVQQu5kE1",
    "06": "https://claude.ai/artifact/6wvNzEB2q1qiuxKLmc5WXw",
    "07": "https://claude.ai/artifact/EvJQqVtdBPYotSdCb4RgGE",
    "08": "https://claude.ai/artifact/9GmbFFLH57PakkcAK6Yapn",
    "09": "https://claude.ai/artifact/7NK7SvK1WmGwe3txZDhMJV",
    "10": "https://claude.ai/artifact/U7StN2tAg9weBhhYbWGSV5",
    "11": "https://claude.ai/artifact/Su77TzeVXXjkjRerf6Mo1B",
    "12": "https://claude.ai/artifact/1NBJ7RnqGsnckzqWUVfTZR",
    "13": "https://claude.ai/artifact/NHN25rtbKtQhqoARszxnEp",
    "14": "https://claude.ai/artifact/3JCenbTZjTHYcqbmKkyLxF",
}

SAMPLE = """// Load the SRTM elevation model (one global image).
var dem = ee.Image('USGS/SRTMGL1_003');

// Colour it from 500 m (green) to 4000 m (white) and add it to the map.
Map.addLayer(dem, {min: 500, max: 4000, palette: ['green', 'white']}, 'Elevation');"""

HEADER_RE = re.compile(r"^\s*\*\s+(.*?·\s*Script\s+(\d+))\s+—\s+(.+?)\s*$")
PART_RE = re.compile(r"^// PART (\S+) — (.+?)\s*$")
BULLET_RE = re.compile(r"^\s*\*\s+•\s+(.+?)\s*$")


def parse_script(path, module_key):
    code = path.read_text(encoding="utf-8")
    lines = code.split("\n")
    label = title = num = None
    learn, parts = [], []
    in_learn = False
    for i, line in enumerate(lines, start=1):
        if label is None:
            m = HEADER_RE.match(line)
            if m:
                label, num, title = m.group(1), m.group(2), m.group(3)
                label = label.replace("FINAL PROJECT", "Final project")
                continue
        if "WHAT YOU WILL LEARN" in line:
            in_learn = True
            continue
        if in_learn:
            b = BULLET_RE.match(line)
            if b:
                learn.append(b.group(1))
                continue
            if learn:
                in_learn = False
        p = PART_RE.match(line)
        if p:
            parts.append({"key": p.group(1), "title": p.group(2), "line": i})
    if label is None:
        raise SystemExit(f"No 'Module · Script NN — Title' header found in {path}")
    label = label.replace("Script", "Lesson")
    return {
        "id": "s" + num,
        "num": num,
        "module": module_key,
        "label": label,
        "title": title,
        "summary": SUMMARIES.get(num, ""),
        "slides": SLIDES.get(num, ""),
        "learn": learn,
        "parts": parts,
        "file": path.name,
        "lines": len(lines) - (1 if code.endswith("\n") else 0),
        "code": code.rstrip("\n") + "\n",
    }


# ---------------------------------------------------------------- Markdown ----
def inline(text):
    t = html.escape(text, quote=False)
    codes = []

    def keep(m):
        codes.append("<code>" + m.group(1) + "</code>")
        return f"\x00{len(codes) - 1}\x00"

    t = re.sub(r"`([^`]+)`", keep, t)
    t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])", r"<em>\1</em>", t)
    t = re.sub(r"(https?://[^\s<)]+)", r'<a href="\1" target="_blank" rel="noopener">\1</a>', t)
    return re.sub("\x00(\\d+)\x00", lambda m: codes[int(m.group(1))], t)


def md_to_html(md):
    lines = md.splitlines()
    out, i = [], 0
    block_start = re.compile(r"^(#{1,4}\s|```|\||>|-\s|\d+\.\s|---\s*$)")
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        if line.startswith("```"):
            buf, i = [], i + 1
            while i < len(lines) and not lines[i].startswith("```"):
                buf.append(lines[i])
                i += 1
            out.append('<div class="pre-wrap"><pre class="diagram">' + html.escape("\n".join(buf)) + "</pre></div>")
            i += 1
            continue
        m = re.match(r"^(#{1,4})\s+(.*)", line)
        if m:
            level = len(m.group(1)) + 1
            out.append(f"<h{level}>{inline(m.group(2))}</h{level}>")
            i += 1
            continue
        if line.strip() == "---":
            out.append("<hr>")
            i += 1
            continue
        if line.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                rows.append([c.strip() for c in lines[i].strip().strip("|").split("|")])
                i += 1
            head = "".join(f"<th>{inline(c)}</th>" for c in rows[0])
            body = "".join("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>" for r in rows[2:])
            out.append(f'<div class="table-wrap"><table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table></div>')
            continue
        if line.startswith(">"):
            buf = []
            while i < len(lines) and lines[i].startswith(">"):
                buf.append(lines[i].lstrip(">").strip())
                i += 1
            out.append("<blockquote><p>" + inline(" ".join(b for b in buf if b)) + "</p></blockquote>")
            continue
        if re.match(r"^(\d+\.|-)\s", line):
            tag = "ol" if re.match(r"^\d+\.\s", line) else "ul"
            items = []
            while i < len(lines) and (re.match(r"^(\d+\.|-)\s", lines[i]) or re.match(r"^\s{2,}\S", lines[i])):
                l = lines[i]
                if re.match(r"^\s{2,}-\s", l):
                    items[-1]["sub"].append(re.sub(r"^\s+-\s+", "", l))
                elif re.match(r"^\s{2,}\S", l):
                    if items[-1]["sub"]:
                        items[-1]["sub"][-1] += " " + l.strip()
                    else:
                        items[-1]["text"] += " " + l.strip()
                else:
                    items.append({"text": re.sub(r"^(\d+\.|-)\s+", "", l), "sub": []})
                i += 1
            parts = []
            for it in items:
                sub = ("<ul>" + "".join(f"<li>{inline(s)}</li>" for s in it["sub"]) + "</ul>") if it["sub"] else ""
                parts.append(f"<li>{inline(it['text'])}{sub}</li>")
            out.append(f"<{tag}>" + "".join(parts) + f"</{tag}>")
            continue
        buf = []
        while i < len(lines) and lines[i].strip() and not block_start.match(lines[i]):
            buf.append(lines[i].strip())
            i += 1
        out.append("<p>" + inline(" ".join(buf)) + "</p>")
    return "\n".join(out)


def main():
    modules, scripts = [], []
    for folder, key, label, title, blurb in MODULES:
        modules.append({"key": key, "label": label, "title": title, "blurb": blurb})
        for path in sorted((ROOT / folder).glob("*.js")):
            scripts.append(parse_script(path, key))

    setup_md = (ROOT / "Module1_Getting_Started" / "00_Setup_and_Code_Editor_Tour.md").read_text(encoding="utf-8")
    setup_md = re.sub(r"^# .*\n", "", setup_md, count=1)          # the page shows its own title
    csv = (ROOT / "practice_data" / "field_sites_mandi.csv").read_text(encoding="utf-8")

    data = {
        "modules": modules,
        "scripts": scripts,
        "setupHtml": md_to_html(setup_md),
        "setupSummary": SETUP_SUMMARY,
        "setupSlides": SLIDES.get("00", ""),
        "csv": csv,
        "sample": SAMPLE,
    }
    payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/").replace("<!--", "<\\!--")
    page = TEMPLATE.read_text(encoding="utf-8").replace("/*__COURSE_DATA__*/", payload)
    OUTPUT.write_text(page, encoding="utf-8")
    print(f"Wrote {OUTPUT.relative_to(ROOT)}: {len(scripts)} scripts, "
          f"{sum(s['lines'] for s in scripts)} lines, {OUTPUT.stat().st_size / 1024:.0f} KB")
    for s in scripts:
        print(f"  {s['num']}  {s['title'][:52]:52}  learn={len(s['learn'])}  parts={len(s['parts'])}")


if __name__ == "__main__":
    main()
