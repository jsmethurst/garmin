# Watchface Studio for the Garmin fēnix 6X Pro

A browser tool to **design, preview and export custom watchfaces** for the fēnix 6X Pro (280×280, 64-colour MIP). Pick a preset or build from scratch, then export a complete **Connect IQ project** that you build once and copy to your watch.

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

Colours are limited to the **64 colours the fēnix 6X display can actually show**; the preview snaps to them so what you see is what you get.

### Presets (none of them are Garmin’s own)

Orbit (nested progress rings, incl. *day elapsed* and *year elapsed*), Terminal, Pilot, Synthwave, Moonlight (live moon phase), Binary, Tactical, Minimal, Pixel LCD.

## Run locally

```sh
npm start          # serves ./site on http://localhost:8080  (or: python3 -m http.server -d site)
npm install && npx playwright install chromium
npm test           # exports every preset and sanity-checks the generated Connect IQ project
```

The tool also works when `site/index.html` is opened straight from disk.

## Hosting

`.github/workflows/pages.yml` publishes `site/` to **GitHub Pages** on every push to `main`.
One-time setup: repository **Settings → Pages → Build and deployment → Source: GitHub Actions**. Any static host works too (Netlify, Vercel, S3…): publish the `site/` folder.

## How it is put together

```
site/
  index.html, css/app.css
  js/core.js       state, undo/redo, 64-colour palette, persistence
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
* **The generated Monkey C is not compiled in this repo’s CI** (that needs Garmin’s SDK and a Garmin login). `npm test` checks structure only. If the compiler reports something, the README in the export has a troubleshooting section, and issues are welcome.
* **Memory.** Watchfaces have a small memory budget. Large images and many big bitmap fonts can make a face fail to load; the export warns about the obvious cases.
* Seconds (text or hand) only update while the wrist is raised; in low-power mode the watch redraws once a minute.
* Only the fēnix 6X Pro / 6X Solar / Sapphire (`fenix6xpro`) is targeted.
