/* GPL-3.0-or-later */
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { instance } = await WebAssembly.instantiate(await readFile(path.join(root, "dist", "kicad-transline.wasm")));
const e = instance.exports;
assert.equal(e.tl_abi_version(), 1);
assert.equal(e.pcbcalc_abi_version(), 1);
const vacuumCm = e.pcbcalc_wavelength(1, 1e9, 3.55, 1) * 100;
const mediumCm = e.pcbcalc_wavelength(2, 1e9, 3.55, 1) * 100;
const mediumSpeed = e.pcbcalc_wavelength(3, 1e9, 3.55, 1);
assert.ok(Math.abs(vacuumCm - 29.9792) < 0.0001, `vacuum wavelength=${vacuumCm}`);
assert.ok(Math.abs(mediumCm - 15.9113) < 0.0001, `medium wavelength=${mediumCm}`);
assert.ok(Math.abs(mediumSpeed - 1.59113e8) < 500, `medium speed=${mediumSpeed}`);

const handle = e.tl_create(0);
assert.ok(handle, "microstrip handle");
const values = new Map([
  [0, 4.4], [1, 0.02], [3, 1e-3], [4, 1e20], [5, 35e-6],
  [6, 1.875e-3], [10, 0.1], [11, 0], [12, 1], [13, 1],
  [14, 1e6], [23, 5.8e7], [44, 0], [45, 1e9], [46, 0],
  [47, 0], [48, 3.5], [49, 0.025],
]);
for (const [parameter, value] of values) assert.equal(e.tl_set_parameter(handle, parameter, value), 1);
assert.equal(e.tl_analyse(handle), 1);
const z0 = e.tl_get_parameter(handle, 18);
const eEff = e.tl_get_parameter(handle, 28);
assert.ok(Math.abs(z0 - 49.6) / 49.6 < 0.03, `Z0=${z0}`);
assert.ok(Math.abs(eEff - 3.33) / 3.33 < 0.03, `epsilonEff=${eEff}`);
assert.equal(e.tl_get_analysis_status(handle, 18), 0);
e.tl_destroy(handle);

for (let model = 0; model < 8; model += 1) {
  const probe = e.tl_create(model);
  assert.ok(probe, `model ${model} handle`);
  e.tl_destroy(probe);
}

function analyseCoplanar(backMetal) {
  const cpw = e.tl_create(4);
  const parameters = new Map([[0,4.5],[1,.02],[3,.2e-3],[5,.035e-3],[6,.2e-3],
    [8,.2e-3],[10,.05],[13,1],[14,1e9],[23,1/1.72e-8],[43,backMetal],[44,0]]);
  for (const [parameter,value] of parameters) assert.equal(e.tl_set_parameter(cpw,parameter,value),1);
  assert.equal(e.tl_analyse(cpw),1);
  const value=e.tl_get_parameter(cpw,18);
  e.tl_destroy(cpw);
  return value;
}
const ungroundedCpw=analyseCoplanar(0),groundedCpw=analyseCoplanar(1);
assert.ok(Number.isFinite(ungroundedCpw) && Number.isFinite(groundedCpw));
assert.notEqual(ungroundedCpw,groundedCpw);

// Coupled-line outputs live only in the analysis result map; read them through the value export.
const cms = e.tl_create(1);
for (const [parameter, value] of new Map([[0,4.5],[1,.02],[23,1/1.72e-8],[3,.2e-3],[4,1e17],[5,.035e-3],[6,.2e-3],[8,.2e-3],[10,.05],[13,1],[14,1e9]]))
  assert.equal(e.tl_set_parameter(cms, parameter, value), 1);
assert.equal(e.tl_analyse(cms), 1);
const zdiff = e.tl_get_analysis_value(cms, 40), zodd = e.tl_get_parameter(cms, 20);
assert.ok(Math.abs(zdiff - 2 * zodd) < 1e-9, `Zdiff=${zdiff} Zodd=${zodd}`);
assert.ok(e.tl_get_analysis_value(cms, 29) > e.tl_get_analysis_value(cms, 30), "even-mode εeff above odd-mode");
assert.ok(Number.isNaN(e.tl_get_analysis_value(cms, 18)), "missing result reads as NaN");
e.tl_destroy(cms);

// Propagating-mode strings: WR-style 10 × 5 mm guide at 10 GHz carries only TE10.
const readCString = (ptr) => { const bytes = new Uint8Array(e.memory.buffer, ptr); return new TextDecoder().decode(bytes.subarray(0, bytes.indexOf(0))); };
const wg = e.tl_create(6);
for (const [parameter, value] of new Map([[0,4.5],[1,.02],[23,1/1.72e-8],[6,10e-3],[8,5e-3],[10,.05],[12,1],[13,1],[14,10e9]]))
  assert.equal(e.tl_set_parameter(wg, parameter, value), 1);
assert.equal(e.tl_analyse(wg), 1);
const teModes = readCString(e.tl_get_modes(wg, 0)).trim(), tmModes = readCString(e.tl_get_modes(wg, 1)).trim();
assert.equal(teModes, "H(1,0)");
assert.equal(tmModes, "");
e.tl_destroy(wg);

console.log(JSON.stringify({ abi: 1, z0, effectivePermittivity: eEff, models: 8, ungroundedCpw, groundedCpw, coupledZdiff: zdiff, teModes }));
