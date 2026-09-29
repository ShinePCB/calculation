/* GPL-3.0-or-later */
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(root, "src", "kicad", "transline_calculations");
const output = path.join(root, "dist", "kicad-transline.wasm");
const compiler = process.env.EMXX || "em++";

// Pinned toolchain for reproducible builds: `emsdk install 6.0.10 && emsdk activate 6.0.10`.
// Set EMSDK_ALLOW_OTHER=1 to build with a different Emscripten on purpose.
const EMSDK_VERSION = "6.0.10";
const probe = spawnSync(compiler, ["--version"], { encoding: "utf8", shell: process.platform === "win32" });
if (probe.error || probe.status !== 0) {
  console.error(`Cannot run ${compiler}. Activate emsdk ${EMSDK_VERSION} (emsdk_env) or set EMXX.`);
  process.exit(1);
}
const found = /\) (\d+\.\d+\.\d+)/.exec(probe.stdout)?.[1] ?? "unknown";
if (found !== EMSDK_VERSION && process.env.EMSDK_ALLOW_OTHER !== "1") {
  console.error(`Emscripten ${found} found, but this project is pinned to ${EMSDK_VERSION}.\n` +
    `Run: emsdk install ${EMSDK_VERSION} && emsdk activate ${EMSDK_VERSION}\n` +
    "or set EMSDK_ALLOW_OTHER=1 to override.");
  process.exit(1);
}

const sources = readdirSync(sourceDir)
  .filter((name) => name.endsWith(".cpp"))
  .map((name) => path.join(sourceDir, name));

const args = [
  path.join(root, "src", "wasm", "kicad_bridge.cpp"),
  path.join(root, "src", "wasm", "pcb_calculator_bridge.cpp"),
  path.join(root, "src", "kicad", "pcb_calculator", "pcb_calculator", "calculator_panels", "iec60664.cpp"),
  ...sources,
  "-I", path.join(root, "src", "kicad"),
  "-I", path.join(root, "src", "kicad", "pcb_calculator"),
  "-std=c++17",
  "-O3",
  "-fexceptions",
  "-fwasm-exceptions",
  "-s", "STANDALONE_WASM=1",
  "-s", "EXPORTED_FUNCTIONS=['_tl_abi_version','_tl_create','_tl_destroy','_tl_has_parameter','_tl_set_parameter','_tl_get_parameter','_tl_analyse','_tl_synthesize','_tl_get_analysis_status','_tl_get_synthesis_status','_tl_get_analysis_value','_tl_get_synthesis_value','_tl_get_modes','_tl_last_error','_pcbcalc_abi_version','_pcbcalc_iec60664','_pcbcalc_via','_pcbcalc_track_width','_pcbcalc_track_current','_pcbcalc_track_aux','_pcbcalc_fusing','_pcbcalc_wavelength','_pcbcalc_attenuator','_pcbcalc_cable']",
  "-Wl,--no-entry",
  "-o", output,
];

const result = spawnSync(compiler, args, { stdio: "inherit", shell: process.platform === "win32" });
if (result.error) throw result.error;
if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
const dataResult = spawnSync(process.execPath, [path.join(root, "scripts", "build-reference-data.mjs")], { stdio: "inherit" });
if (dataResult.error) throw dataResult.error;
if ((dataResult.status ?? 1) !== 0) process.exit(dataResult.status ?? 1);
const stampResult = spawnSync(process.execPath, [path.join(root, "scripts", "stamp-version.mjs")], { stdio: "inherit" });
if (stampResult.error) throw stampResult.error;
process.exit(stampResult.status ?? 1);
