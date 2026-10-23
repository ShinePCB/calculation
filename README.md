# LayerLine · KiCad PCB Calculator for the web

[在线使用](https://calculation.shinepcba.com/) · [下载 Android App](https://github.com/ShinePCB/calculation/releases/latest/download/shinepcb-calculator-android.apk) · [GPL-3.0-or-later](LICENSE)

A browser port of KiCad's PCB Calculator.  It includes the complete
`common/transline_calculations` C++ module and the corresponding
`pcb_calculator` source snapshot. Numeric calculator formulae are exposed by
small C ABI bridges, compiled to WebAssembly, and run locally in the browser.
The interface does not maintain material presets.

## Included pages

- Regulators and resistor equivalents
- IPC-2221 / IEC-60664 electrical spacing references
- Via size, track width, fusing current, and cable size
- Wavelength and RF attenuators
- Transmission lines (the eight upstream models below)
- E-series, resistor color code, board classes, and galvanic corrosion references

## Included transmission-line models

- Microstrip
- Coupled microstrip
- Stripline
- Coupled stripline
- Coplanar waveguide / grounded coplanar waveguide
- Coaxial line
- Rectangular waveguide
- Twisted pair

The port also retains the upstream frequency dispersion, dielectric and
conductor loss, surface roughness, soldermask correction, analysis, and
synthesis code paths supported by each class.

## Build the WASM module

The toolchain is pinned to **Emscripten 6.0.10** for reproducible builds:

```sh
emsdk install 6.0.10
emsdk activate 6.0.10
# PowerShell: . <emsdk>/emsdk_env.ps1   ·   bash: source <emsdk>/emsdk_env.sh
node scripts/build-wasm.mjs
```

The build refuses to run with another Emscripten version; set
`EMSDK_ALLOW_OTHER=1` to override on purpose. Set `EMXX` to an absolute
`em++` path when it is not on `PATH`.

The build creates `dist/kicad-transline.wasm` directly from the vendored KiCad
sources, `src/wasm/kicad_bridge.cpp`, and `src/wasm/pcb_calculator_bridge.cpp`.

The transmission-line page reads coupled-line εeff / delay / loss, Zdiff and
similar outputs through `tl_get_analysis_value` / `tl_get_synthesis_value`
(the KiCad classes keep them only in their result maps), and the propagating
TE / TM mode lists of the coax and rectangular-waveguide models through
`tl_get_modes`. A `.wasm` built before these exports existed still loads;
those rows then show "—".

The regulator page keeps its regulator list in the browser (`localStorage`)
and imports / exports KiCad's pcb_calculator data file format.

## Front end

`dist/` is a static site with no build step:

- `app.js` – shell, router, unit selectors, field helpers, material pickers
- `transline.js` – the nine transmission-line models (Analyse ↓ / Synthesize ↑)
- `pages.js` – the other 13 panels, each ported from its
  `pcb_calculator/calculator_panels/*.cpp` counterpart
- `styles.css` – light and dark themes

## Cache busting

Every reference to `styles.css`, `app.js`, `pages.js`, `transline.js`,
`kicad-transline.wasm` and `kicad-reference-data.json` carries `?v=<hash>`,
a hash of all of those files. `build-wasm.mjs` refreshes it automatically;
after editing only front-end files run:

```sh
node scripts/stamp-version.mjs
```

Serve `index.html` itself without long-lived caching (e.g. `Cache-Control:
no-cache`) so browsers pick up new stamps; the stamped files can be cached
for as long as you like.

## Run locally

Serve `dist/` with any static HTTP server. Opening `index.html` directly will not load the WASM module in some browsers.

## Interface languages

`?lang=zh` selects Chinese and `?lang=en` selects English. The standalone
page has a language switch that preserves the selected tool (URL fragment).
The original URL without a language parameter keeps its Chinese interface;
other explicit language values use English.

Both languages use the same pages, formulas, input defaults and WASM engine.
`dist/i18n.js` translates application text and static template segments.
User-entered model names, imported data and numeric results are not translated.
Reference-table labels, validation messages, file-operation messages and
material-picker descriptions are included in the English interface.

## Embed in the ShinePCB website

Load `https://calculation.shinepcba.com/?lang=en&embed=1` in an iframe to use the
optional website integration. `dist/embed.js` accepts initialization messages
only from its parent at `https://shinepcba.com`, `https://www.shinepcba.com`
or an HTTP localhost/127.0.0.1 development origin. It reports the natural
content height, tool navigation and viewport-aware dialog positioning.
The standalone UI and calculation engine retain their existing behavior.
The host's Chinese route uses `lang=zh`; all six other website languages use
`lang=en`. The standalone language switch is hidden in embedded mode so the
host page determines the calculator language.

The host must allow scripts, the calculator's origin/storage, forms and file
downloads in its iframe sandbox. Delegate `clipboard-write` for the copy
button; the calculator retains its manual-copy fallback. Allow popups to open
external links without inheriting the iframe sandbox. Keep the GPL source
link to [GitHub](https://github.com/ShinePCB/calculation) available; no source
archive is hosted with the calculator. Deploy this embed support before publishing the
website's `/<locale>/calculator/` page.

## Deploy

The production site is deployed to Cloudflare Workers Static Assets at
<https://calculation.shinepcba.com/>. After changing files in `dist/`, refresh
the cache stamp, run the tests, and deploy with the pinned Wrangler version:

```sh
pnpm run stamp
pnpm test
pnpm run deploy:check
pnpm run deploy
```

## Native mobile app

`app/` contains the Capacitor 8 Android and iOS projects. After changing the
website, run `node scripts/stamp-version.mjs`, then `cd app` and `npm run sync`
to copy the latest `dist/` into both native projects. See `app/README.md` for
Android Studio, Xcode, signing, and build commands.

The latest installable Android APK is available from
[GitHub Releases](https://github.com/ShinePCB/calculation/releases/latest).

## License

GPL-3.0-or-later. See `LICENSE`, `NOTICE.md`, the preserved source headers, and
`KICAD_AUTHORS.txt`.
