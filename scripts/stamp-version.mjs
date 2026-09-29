/* Cache busting for dist/: stamps every reference to a versioned file with ?v=<content hash>.
 * The hash covers all versioned files (ignoring existing stamps), so any change to the page code,
 * styles, WASM or reference data yields a new URL for all of them at once.
 * Run after editing anything in dist/ (build-wasm.mjs runs it automatically).
 * GPL-3.0-or-later */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dist = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), "dist");
const TEXT = ["index.html", "app.js", "pages.js", "transline.js", "styles.css"];
const BINARY = ["kicad-transline.wasm", "kicad-reference-data.json"];
const STAMP = /\?v=[0-9a-f]+/g;
// Every in-page reference to a versioned file, e.g. "./app.js" or "./app.js?v=0123abcd".
// Modules must all use the same URL for app.js, or the browser would load it twice.
const REF = /(\.\/(?:styles\.css|app\.js|pages\.js|transline\.js|kicad-transline\.wasm|kicad-reference-data\.json))(?:\?v=[0-9a-f]+)?(?=["'`])/g;

const texts = Object.fromEntries(await Promise.all(TEXT.map(async (f) => [f, await readFile(path.join(dist, f), "utf8")])));
const hash = createHash("sha256");
for (const f of TEXT) hash.update(f).update(texts[f].replace(STAMP, ""));
for (const f of BINARY) hash.update(f).update(await readFile(path.join(dist, f)));
const version = hash.digest("hex").slice(0, 10);

let changed = 0;
for (const f of TEXT) {
  const next = texts[f].replace(REF, `$1?v=${version}`);
  if (next !== texts[f]) { await writeFile(path.join(dist, f), next); changed++; }
}
console.log(`dist version ${version} (${changed} file${changed === 1 ? "" : "s"} updated)`);
