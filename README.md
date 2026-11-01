# Garmin Studio

A browser tool to **design, preview and export custom watch faces and data fields** for the Garmin fēnix 6X Pro (280×280, 64-color MIP). It has two sections, **Watch faces** and **Data fields**. Pick a preset or build from scratch, then export a complete **Connect IQ project** that you build once and copy to your watch.

No server, no build step, no tracking: it is a static site in [`site/`](site).

## Using it

1. Open the site (or run it locally, see below).
2. **Presets** → pick a starting point, or add elements yourself.
3. Drag things around, tweak them in the **Inspector**, check the **Test data** tab to see how it looks with different values.
4. **Get it on my watch →** downloads a ZIP with everything needed. Its `README.md` walks through the one-time Garmin SDK setup, building a `.prg` (VS Code or `./build.sh`) and copying it to `GARMIN/APPS` over USB.

### What you can put on a face

| Element | Notes |
| --- | --- |
| Text / data fields | time, date (custom formats), steps, calories, floors, intensity minutes, distance, heart rate, Body Battery, stress, SpO₂, respiration, battery % and days, notifications, temperature, weather text, altitude, sunrise/sunset, day/year progress, moon phase… 12/24 h, units follow the watch |
| Arc gauges | any numeric source, custom empty/full values, rounded ends, any start/length/direction |
| Analog hands, dial ticks | bar / taper / sword hands, optional second hand (awake only) |
| Shapes | lines, boxes (rounded), circles |
| Weather icon | drawn from vector shapes, **no bitmaps needed** |
| Moon phase, binary clock | drawn on the watch from the date/time, no data connection needed |
| Bar chart | last 7 days + today of steps, calories, intensity minutes or floors |
| Move bar | Garmin-style 5-segment ramp |
| Images, world map + “you are here” marker | PNG/JPG/SVG, resized for you at export |
| **Bitmap fonts** | any bundled typeface (or your own TTF/OTF) is rasterised to a Garmin `.fnt` + `.png` and added to the project automatically |

The **Big Data** preset uses a serif time with sans-serif readouts (all bitmap fonts) and has Turkish labels. In the export dialog you can export it upright, rotated 30° to the right, or both; rotated versions use pre-rotated bitmap fonts.

### Data fields

The **Data fields** section builds Connect IQ data fields (the screens you flip through during an activity). A field is made of **data cells**; each cell shows one value in a standard Garmin system font (`FONT_XTINY` to `FONT_NUMBER_THAI_HOT`) and has a label, alignment, colors, optional heart-rate-zone fill and divider lines. Values: timer, elapsed time, time of day, distance, lap distance, pace, average / lap / last-lap pace, speed, lap number, heart rate (with zone), average and max heart rate, cadence, power, altitude, ascent, calories and battery. Pick one of the 12 SDK activity-screen layouts and which slot the field fills; the editor then shows that exact rectangle. Whole-field settings: light / dark / match-watch screen colors, and units (laps come from the watch: the Lap button and the activity's own Auto Lap). Layouts: the Run screen and a blank field.

Colors are limited to the **64 colors the fēnix 6X display can actually show**; the preview snaps to them so what you see is what you get.

### Presets (none of them are Garmin’s own)

Orbit (nested progress rings, incl. *day elapsed* and *year elapsed*), Terminal, Pilot, Synthwave, Moonlight (live moon phase), Binary, Tactical, Minimal, Pixel LCD.

## Run locally

```sh
npm start          # serves ./site on http://localhost:8080  (or: python3 -m http.server -d site)
npm install && npx playwright install chromium
npm test           # exports every preset and sanity-checks the generated Connect IQ project
```

The tool also works when `site/index.html` is opened straight from disk.

## Hosting and one-click builds (Vercel)

The repo is a Vercel project: `site/` is served as static files and `api/` holds the backend.

* `api/build` compiles the exported project with Garmin's real compiler inside a persistent **Vercel Sandbox** and returns the finished `.prg`, so you can skip the manual SDK/VS Code steps. The export dialog has a **Build my watchface / data field (.prg)** button.
* `api/setup` prepares that sandbox once: it downloads the Connect IQ SDK, the fēnix 6X Pro device files and creates a signing key. Garmin only releases device files to a logged-in Garmin account, so it needs these Vercel environment variables (Project → Settings → Environment Variables, mark the password *Sensitive*):

| Name | Value |
| --- | --- |
| `GARMIN_USERNAME` | your Garmin account email |
| `GARMIN_PASSWORD` | your Garmin account password (use an account without 2-factor sign-in) |
| `GARMIN_SDK_AGREEMENT` | `accept` (you accept Garmin's Connect IQ SDK licence) |

After redeploying, open the site → **Get it on my watch** → **Set up the builder**. This is a personal tool: keep Vercel's deployment protection on so only you can reach `/api/*`.

The site still works as plain static hosting; without the backend the build button simply hides and you use the ZIP + README flow.

## How it is put together

```
site/
  index.html, css/app.css
  js/core.js       state, undo/redo, 64-color palette, persistence
  js/sources.js    data sources: preview value + the Monkey C that reads it on the watch
  js/elements.js   element types: defaults, inspector fields, preview drawing, Monkey C generation
  js/fonts.js      system-font approximation + bitmap-font metrics/rasteriser (shared by preview & export)
  js/codegen.js    design -> Monkey C views, shared helper methods, manifest data
  js/export.js     assembles the project ZIP (README, build scripts, resources, icon, fonts, images)
  js/presets.js    the preset designs
  js/ui.js, main.js  panels, canvas interaction, dialogs
  fonts/           self-hosted OFL typefaces (see fonts/LICENSES.txt)
tests/smoke.js     export every preset and validate the output
```

Each element is drawn by its own generated method (`drawEl0`, `drawEl1`, …) and shared data helpers (`stepsNow()`, `hrNow()`, …) are only emitted when something uses them, so the generated code stays small and readable.

## Limitations worth knowing

* **Preview fidelity.** Garmin’s built-in fonts are approximated (Rajdhani, calibrated against a fēnix 6). Positions of built-in-font text can be a few pixels off on the real watch; bitmap fonts are exact because they are rasterised by the tool.
* `npm test` checks the generated project's structure only; the real compile happens in the cloud builder (or on your machine).
* **Memory.** Watchfaces have a small memory budget. Large images and many big bitmap fonts can make a face fail to load; the export warns about the obvious cases.
* Seconds (text or hand) only update while the wrist is raised; in low-power mode the watch redraws once a minute.
* Only the fēnix 6X Pro / 6X Solar / Sapphire (`fenix6xpro`) is targeted.

## Watch model and re-opening builds

- The drop-down at the top left picks the watch: fēnix 6X Pro (280×280) or fēnix 6 / 6 Pro (260×260). The design canvas is that watch's real screen, so the coordinates, the data-field layouts and the pixels that get built are the same. Every design remembers the size it was made at and is converted (every size and position scaled once) when opened on the other watch. The cloud builder needs the fēnix 6 / 6 Pro device files, which the builder setup downloads together with the 6X Pro ones (press the setup button once more).
- Every `.prg` / `.iq` built here carries its editable design inside (a text resource, `GWD1_…_GWD1`). **Layouts → Open a .prg, .iq or project .zip** reads it back. `.iq` and `.zip` files are opened with a bundled WebAssembly copy of 7-Zip (`site/vendor/7z`). Builds made before this feature, and files from other developers, have no design inside.
- A `.prg` built elsewhere has no design inside, but its drawing program is readable: `site/js/prgimport.js` follows the program's instructions (a stack machine; the instruction set and file layout come from the open-source qduff/mcdec and pzl/ciqdb projects), collects the text / bitmap / arc drawing calls with their constant arguments, decodes the background picture, and recreates them as elements. It is best-effort: the file's own bitmap fonts are replaced by the closest bundled typeface, and drawing that depends on stored data (history charts) is listed as not imported.
