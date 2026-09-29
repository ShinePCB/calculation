/* Transmission-line page: drives KiCad's transline_calculations classes through the WASM C ABI,
 * mirroring pcb_calculator/transline/*.cpp (parameter set, Analyse / Synthesize, result rows).
 * SPDX-License-Identifier: GPL-3.0-or-later */
import { $, $$, field, num, setNum, val, setFieldState, rows, wirePickers, wireUnits, fmtOut, esc } from "./app.js?v=1d24384213";

const P = {
  EPSILONR: 0, TAND: 1, H: 3, H_T: 4, T: 5, W: 6, DIN: 7, S: 8, DOUT: 9, LEN: 10, ROUGH: 11, MUR: 12, MURC: 13,
  FREQ: 14, A: 15, TWIST: 16, ENV: 17, Z0: 18, Z0E: 19, Z0O: 20, ANG: 21, SIGMA: 23, SKIN: 24, LOSS_D: 25,
  LOSS_C: 26, CUTOFF: 27, EEFF: 28, EEFF_E: 29, EEFF_O: 30, DELAY: 31, DELAY_O: 32, DELAY_E: 33, AC: 34, ACE: 35,
  ACO: 36, AD: 37, ADE: 38, ADO: 39, ZDIFF: 40, ZCOMM: 41, K: 42, BACKMETAL: 43, DIEL: 44, SPEC: 45, SM: 46,
  SM_T: 47, SM_ER: 48, SM_TAND: 49, SM_FILL: 50,
};

/* Field catalogue. Defaults follow transline_ident.cpp / TRANSLINE::Init. */
const F = {
  er: { p: P.EPSILONR, label: "介电常数", sym: "εr", value: 4.5, pick: "er" },
  tand: { p: P.TAND, label: "介质损耗角正切", sym: "tan δ", value: 0.02, pick: "tand" },
  rho: { p: P.SIGMA, inv: true, label: "导体电阻率", sym: "ρ", value: 1.72e-8, unit: "Ω·m", pick: "rho" },
  h: { p: P.H, label: "基板厚度", sym: "H", value: 0.2, unit: "len" },
  ht: { p: P.H_T, label: "到顶部屏蔽盖高度", sym: "H_t", value: 1e20, unit: "len" },
  t: { p: P.T, label: "导体厚度", sym: "T", value: 0.035, unit: "len" },
  rough: { p: P.ROUGH, label: "导体表面粗糙度", sym: "Rough", value: 0, unit: "len" },
  mur: { p: P.MUR, label: "基板相对磁导率", sym: "μr", value: 1 },
  murc: { p: P.MURC, label: "导体相对磁导率", sym: "μr(导体)", value: 1 },
  // KiCad defaults a = H = 0.2 mm, which puts the strip on the top plane and yields NaN; start centred: a = (H − T) / 2.
  aSl: { p: P.A, label: "导体到上地平面距离（居中为 (H−T)/2）", sym: "a", value: 0.0825, unit: "len" },
  aCsl: { p: P.A, label: "导体到最近地平面距离（0 为居中）", sym: "a", value: 0, unit: "len" },
  twist: { p: P.TWIST, label: "单位长度绞合数", sym: "Twists", value: 0, unit: "/m" },
  env: { p: P.ENV, label: "环境介电常数", sym: "εr(环境)", value: 1 },
  freq: { p: P.FREQ, label: "频率", sym: "f", value: 1, unit: "freq", defUnit: "GHz" },
  diel: { p: P.DIEL, type: "select", label: "介质频散模型", value: 0, options: [[0, "常数（不随频率变化）"], [1, "Djordjevic–Sarkar 宽带模型"]] },
  spec: { p: P.SPEC, label: "εr / tan δ 的标定频率", value: 1, unit: "freq", defUnit: "GHz" },
  sm: { p: P.SM, type: "check", label: "表面有阻焊层", value: false },
  smT: { p: P.SM_T, label: "阻焊厚度", value: 20, unit: "len", defUnit: "µm" },
  smEr: { p: P.SM_ER, label: "阻焊介电常数", sym: "εr", value: 3.5 },
  smTand: { p: P.SM_TAND, label: "阻焊损耗角正切", sym: "tan δ", value: 0.025 },
  smFill: { p: P.SM_FILL, type: "check", label: "阻焊填满共面间隙", value: true },
  w: { p: P.W, label: "线宽", sym: "W", value: 0.2, unit: "len" },
  s: { p: P.S, label: "间距", sym: "S", value: 0.2, unit: "len" },
  l: { p: P.LEN, label: "线长", sym: "L", value: 50, unit: "len" },
  wa: { p: P.W, label: "波导宽边", sym: "a", value: 10, unit: "len" },
  sb: { p: P.S, label: "波导窄边", sym: "b", value: 5, unit: "len" },
  din: { p: P.DIN, label: "内导体直径", sym: "Din", value: 1, unit: "len" },
  dout: { p: P.DOUT, label: "绝缘层外径", sym: "Dout", value: 8, unit: "len" },
  z0: { p: P.Z0, label: "特性阻抗", sym: "Z0", value: 50, unit: "Ω" },
  z0e: { p: P.Z0E, label: "偶模阻抗", sym: "Zeven", value: 50, unit: "Ω" },
  z0o: { p: P.Z0O, label: "奇模阻抗", sym: "Zodd", value: 50, unit: "Ω" },
  zdiff: { p: P.ZDIFF, label: "目标差分阻抗", sym: "Zdiff", value: 100, unit: "Ω" },
  zcomm: { p: P.ZCOMM, label: "目标共模阻抗", sym: "Zcomm", value: 25, unit: "Ω" },
  ang: { p: P.ANG, label: "电长度", sym: "Ang_l", value: 0, unit: "angle" },
};

/* Result rows, in the order of each *_UI::showAnalyze(). */
const r = (label, fn, unit) => ({ label, fn, unit });
const RES = {
  eeff: r("有效介电常数 εeff", (g) => g(P.EEFF), ""),
  eeffCoax: r("有效介电常数 εeff", (g) => g(P.EPSILONR), ""),
  delay: r("单位传播延时", (g) => g(P.DELAY), "ps/cm"),
  ac: r("导体损耗", (g) => g(P.AC), "dB"),
  ad: r("介质损耗", (g) => g(P.AD), "dB"),
  lc: r("导体损耗", (g) => g(P.LOSS_C), "dB"),
  ld: r("介质损耗", (g) => g(P.LOSS_D), "dB"),
  skin: r("趋肤深度", (g) => g(P.SKIN) * 1e6, "µm"),
  eeffE: r("有效介电常数（偶模）", (g) => g(P.EEFF_E), ""),
  eeffO: r("有效介电常数（奇模）", (g) => g(P.EEFF_O), ""),
  delayE: r("单位传播延时（偶模）", (g) => g(P.DELAY_E), "ps/cm"),
  delayO: r("单位传播延时（奇模）", (g) => g(P.DELAY_O), "ps/cm"),
  acE: r("导体损耗（偶模）", (g) => g(P.ACE), "dB"),
  acO: r("导体损耗（奇模）", (g) => g(P.ACO), "dB"),
  adE: r("介质损耗（偶模）", (g) => g(P.ADE), "dB"),
  adO: r("介质损耗（奇模）", (g) => g(P.ADO), "dB"),
  zdiff: r("差分阻抗 Zdiff", (g) => g(P.ZDIFF), "Ω"),
  zcomm: r("共模阻抗 Zcomm", (g) => g(P.ZCOMM), "Ω"),
  k: r("耦合系数 k", (g) => g(P.K), ""),
  zf: r("场阻抗 ZF(H10) = Ey / Hx", (g) => { const e = g(P.EEFF); return e > 0 ? 376.730313668 / Math.sqrt(e) : 0; }, "Ω"),
  cutoff: r("TE₁₀ 截止频率", (g) => g(P.CUTOFF) / 1e9, "GHz"),
  cutoffCoax: r("最低高次模截止频率", (g) => g(P.CUTOFF) / 1e9, "GHz"),
  // Mode lists come from GetTEModes / GetTMModes; the second argument reads them.
  te: r("TE 模式", (g, modes) => modes(0), ""),
  tm: r("TM 模式", (g, modes) => modes(1), ""),
};

const MODELS = [
  { key: "ms", id: 0, name: "微带线", cls: "MICROSTRIP", subs: ["er", "tand", "rho", "h", "ht", "t", "rough", "mur", "murc"], phys: ["w", "l"], elec: ["z0", "ang"], mask: true, res: ["eeff", "delay", "ac", "ad", "skin"] },
  { key: "cms", id: 1, name: "耦合微带线", cls: "COUPLED_MICROSTRIP", subs: ["er", "tand", "rho", "h", "ht", "t", "rough", "murc"], phys: ["w", "s", "l"], elec: ["z0e", "z0o", "ang"], mask: true, coupled: true, strategies: [[0, "同时求 W 和 S"], [1, "保持 W，求 S"], [2, "保持 S，求 W"]], res: ["eeffE", "eeffO", "delayE", "delayO", "acE", "acO", "adE", "adO", "skin", "zdiff"] },
  { key: "sl", id: 2, name: "带状线", cls: "STRIPLINE", subs: ["er", "tand", "rho", "h", "aSl", "t", "murc"], phys: ["w", "l"], elec: ["z0", "ang"], res: ["eeff", "delay", "lc", "ld", "skin"] },
  { key: "csl", id: 3, name: "耦合带状线", cls: "COUPLED_STRIPLINE", subs: ["er", "tand", "rho", "h", "aCsl", "t", "murc"], phys: ["w", "s", "l"], elec: ["z0e", "z0o", "ang"], coupled: true, strategies: [[0, "同时求 W 和 S"], [1, "保持 W，求 S"], [2, "保持 S，求 W"], [3, "按 Zdiff / Zcomm 求 W 和 S"]], res: ["eeffE", "eeffO", "delayE", "delayO", "skin", "zdiff", "zcomm", "k"] },
  { key: "cpw", id: 4, bm: 0, name: "共面波导", cls: "COPLANAR", subs: ["er", "tand", "rho", "h", "t", "murc"], phys: ["w", "s", "l"], elec: ["z0", "ang"], mask: true, fill: true, targets: ["w", "s"], res: ["eeff", "delay", "lc", "ld", "skin"] },
  { key: "gcpw", id: 4, bm: 1, name: "接地共面波导", cls: "GROUNDED COPLANAR", subs: ["er", "tand", "rho", "h", "t", "murc"], phys: ["w", "s", "l"], elec: ["z0", "ang"], mask: true, fill: true, targets: ["w", "s"], res: ["eeff", "delay", "lc", "ld", "skin"] },
  { key: "rwg", id: 6, name: "矩形波导", cls: "RECTWAVEGUIDE", subs: ["er", "tand", "rho", "mur", "murc"], phys: ["wa", "sb", "l"], elec: ["z0", "ang"], res: ["zf", "eeff", "lc", "ld", "te", "tm", "cutoff"], synthNote: "合成只求宽边 a，窄边 b 保持不变。" },
  { key: "coax", id: 5, name: "同轴线", cls: "COAX", subs: ["er", "tand", "rho", "mur", "murc"], phys: ["din", "dout", "l"], elec: ["z0", "ang"], targets: ["din", "dout"], res: ["eeffCoax", "lc", "ld", "te", "tm", "cutoffCoax"] },
  { key: "tp", id: 7, name: "双绞线", cls: "TWISTEDPAIR", subs: ["er", "tand", "rho", "twist", "murc", "env"], phys: ["din", "dout", "l"], elec: ["z0", "ang"], targets: ["din", "dout"], res: ["eeff", "lc", "ld", "skin"] },
];

let wasm;
let model = MODELS[0];
const saved = {};
let timer = 0;
let lastRun = null;

const fid = (k) => `tl-${k}`;

function spec(k, extra = {}) {
  const f = F[k];
  return { ...f, id: fid(k), ...extra };
}

/* ---------- cross-section pictures: KiCad's own bitmaps (resources/images, GPL-3.0) ---------- */
const PICTURES = { ms: "microstrip", cms: "c_microstrip", sl: "stripline", csl: "coupled_stripline", cpw: "cpw", gcpw: "cpw_back", rwg: "rectwaveguide", coax: "coax", tp: "twistedpair" };
function diagram() {
  const img = (name, alt) => `<img class="k-light" src="./img/kicad/${name}.png" alt="${alt}"><img class="k-dark" src="./img/kicad/${name}_dark.png" alt="${alt}">`;
  // Coupled lines also get the odd / even excitation picture, as in transline_dlg_funct.cpp.
  const modes = model.coupled ? `<span class="kimg-item">${img("microstrip_zodd_zeven", "奇模与偶模激励示意")}</span>` : "";
  return `<div class="kimg"><span class="kimg-item">${img(PICTURES[model.key], `${model.name}截面示意`)}</span>${modes}</div>`;
}
// Model list thumbnails use the same KiCad bitmaps as the main picture.
function mini(key) {
  const name = PICTURES[key];
  return `<span class="tl-thumb" aria-hidden="true"><img class="k-light" src="./img/kicad/${name}.png" alt=""><img class="k-dark" src="./img/kicad/${name}_dark.png" alt=""></span>`;
}

/* ---------- state keeping per model ---------- */
function allKeys(m) {
  return [...m.subs, "freq", "diel", "spec", ...(m.mask ? ["sm", "smT", "smEr", "smTand"] : []), ...(m.fill ? ["smFill"] : []), ...m.phys, ...m.elec, ...(m.key === "csl" ? ["zdiff", "zcomm"] : [])];
}
function saveModel() {
  const st = {};
  for (const k of allKeys(model)) {
    const el = document.getElementById(fid(k));
    if (!el) continue;
    const u = document.getElementById(`${fid(k)}-u`);
    st[k] = { v: el.type === "checkbox" ? el.checked : el.value, u: u?.value };
  }
  st.$strategy = val("tl-strategy");
  st.$target = $("input[name=tl-target]:checked")?.value;
  saved[model.key] = st;
}
function restoreModel() {
  const st = saved[model.key];
  if (!st) return;
  for (const [k, entry] of Object.entries(st)) {
    if (k.startsWith("$") || !entry) continue;
    const { v, u } = entry;
    const el = document.getElementById(fid(k));
    if (!el) continue;
    const us = document.getElementById(`${fid(k)}-u`);
    if (us && u) us.value = u;
    if (el.type === "checkbox") el.checked = v; else el.value = v;
  }
  if (st.$strategy != null && $("#tl-strategy")) $("#tl-strategy").value = st.$strategy;
  if (st.$target) { const t = $(`input[name=tl-target][value="${st.$target}"]`); if (t) t.checked = true; }
}

/* ---------- rendering ---------- */
function render() {
  const m = model;
  $$(".tl-model").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.model === m.key)));

  const target = (k, i) => (m.targets?.includes(k) ? { radio: { name: "tl-target", value: k, checked: i === 0 } } : {});
  $("#tlInputs").innerHTML = `
    <h2>基板与材料 <span class="sub">${m.cls}</span></h2>
    <div class="fields two">${m.subs.map((k) => field(spec(k))).join("")}</div>
    <p class="group-label">元件参数</p>
    <div class="fields two">${field(spec("freq"))}</div>
    <details class="more" id="tlDisp"><summary>介质频散模型</summary>
      <div class="fields two">${field(spec("diel"))}${field(spec("spec"))}</div>
      <p class="panel-note">选 Djordjevic–Sarkar 时，εr 与 tan δ 视为在标定频率下测得，计算频率处的值由模型外推。</p>
    </details>
    ${m.mask ? `<details class="more" id="tlMask"><summary>阻焊层修正</summary>
      <div class="fields two">${field(spec("sm"))}${m.fill ? field(spec("smFill")) : ""}${field(spec("smT"))}${field(spec("smEr"))}${field(spec("smTand"))}</div>
    </details>` : ""}`;

  $("#tlGeom").innerHTML = `
    <div id="tlDiagram"></div>
    <p class="group-label">物理参数</p>
    <div class="fields two">${m.phys.map((k) => field(spec(k, target(k, m.targets?.indexOf(k))))).join("")}</div>
    ${m.strategies ? `<div class="fields" style="margin-top:10px">${field({ id: "tl-strategy", type: "select", label: "合成方式", value: 0, options: m.strategies })}</div>` : ""}
    <div class="tl-actions">
      <button class="btn primary" type="button" id="tlAnalyse">分析 ↓ <span class="sub" style="color:inherit;opacity:.8">由尺寸求阻抗</span></button>
      <button class="btn" type="button" id="tlSynth">↑ 合成 <span class="sub">由阻抗求尺寸</span></button>
      <p class="hint">改尺寸或材料会自动重新分析；改下方电气参数后点“合成”反求尺寸${m.targets ? "（勾选“合成求解”的尺寸会被求出）" : ""}。${m.synthNote ?? ""}</p>
    </div>
    <p class="group-label">电气参数</p>
    <div class="fields two">${m.elec.map((k) => field(spec(k))).join("")}${m.key === "csl" ? `<div class="fields two" id="tlZdz" style="grid-column:1/-1" hidden>${field(spec("zdiff"))}${field(spec("zcomm"))}</div>` : ""}</div>`;

  $("#tlDiagram").innerHTML = diagram();
  restoreModel();
  wireUnits($("#tlInputs"));
  wireUnits($("#tlGeom"));
  wirePickers($("#tlInputs"));
  toggleMask();
  toggleZdz();
  run("analyse");
}

function toggleMask() {
  if (!model.mask) return;
  const on = val(fid("sm"));
  for (const k of ["smT", "smEr", "smTand", "smFill"]) {
    const f = document.querySelector(`[data-fld="${fid(k)}"]`);
    if (!f) continue;
    f.setAttribute("aria-disabled", String(!on));
    const input = document.getElementById(fid(k));
    input.disabled = !on;
  }
  if (on) $("#tlMask").open = true;
}
function toggleZdz() {
  const box = $("#tlZdz");
  if (box) box.hidden = val("tl-strategy") !== "3";
}

/* Input checks from TRANSLINE::checkProperties(); returns {key: 1 (warning)}. */
function inputWarnings() {
  const w = {};
  const g = (k) => num(fid(k));
  const has = (k) => document.getElementById(fid(k));
  const bad = (v, strict) => !Number.isFinite(v) || (strict ? v <= 0 : v < 0);
  if (bad(g("er"), true)) w.er = 1;
  if (bad(g("tand"))) w.tand = 1;
  if (bad(g("rho"), true)) w.rho = 1;
  if (has("h") && bad(g("h"))) w.h = 1;
  if (has("twist") && bad(g("twist"))) w.twist = 1;
  if (has("mur") && bad(g("mur"))) w.mur = 1;
  if (bad(g("murc"))) w.murc = 1;
  if (has("env") && bad(g("env"), true)) w.env = 1;
  if (bad(g("freq"), true)) w.freq = 1;
  const h = g("h"), t = g("t"), ht = g("ht");
  if (has("ht") && (bad(ht, true) || (h > 0 && Number.isFinite(t) && ht < t + 0.1 * h))) w.ht = 1;
  for (const ak of ["aSl", "aCsl"]) {
    if (!has(ak)) continue;
    const a = g(ak);
    if (ak === "aSl" && bad(a, true)) w[ak] = 1;
    if (a > 0 && h > 0 && (a / h < 0.2 || a / h > 0.8)) w[ak] = 1;
  }
  if (has("t") && t > 0 && h > 0 && t / h > 0.2) w.t = 1;
  return w;
}

function run(mode) {
  const m = model;
  const errBox = $("#tlError");
  errBox.hidden = true;
  const warn = inputWarnings();

  const h = wasm.tl_create(m.id);
  const set = (p, v) => { if (wasm.tl_has_parameter(h, p)) wasm.tl_set_parameter(h, p, v); };
  try {
    // Parameters the KiCad UI always pushes even when the model hides them.
    set(P.MUR, 1); set(P.MURC, 1); set(P.ROUGH, 0);
    set(P.SM, 0); set(P.SM_T, 20e-6); set(P.SM_ER, 3.5); set(P.SM_TAND, 0.025); set(P.SM_FILL, 1);
    if (m.bm !== undefined) set(P.BACKMETAL, m.bm);

    const bad = [];
    const keys = [...m.subs, "freq", "diel", "spec", ...(m.mask ? ["sm", "smT", "smEr", "smTand"] : []), ...(m.fill ? ["smFill"] : []), ...m.phys, ...m.elec];
    if (m.key === "csl" && val("tl-strategy") === "3") keys.push("zdiff", "zcomm");
    for (const k of keys) {
      const f = F[k];
      let v;
      if (f.type === "select") v = Number(val(fid(k)));
      else if (f.type === "check") v = val(fid(k)) ? 1 : 0;
      else {
        v = num(fid(k));
        if (!Number.isFinite(v)) { bad.push(f.label); continue; }
        if (f.inv) v = 1 / v;
      }
      set(f.p, v);
    }
    if (bad.length) throw new Error(`请填写有效数字：${bad.join("、")}`);

    let ok;
    if (mode === "synth") {
      const opt = m.strategies ? Number(val("tl-strategy")) : 0;
      const tk = $("input[name=tl-target]:checked")?.value ?? m.phys[0];
      ok = wasm.tl_synthesize(h, opt, F[tk].p) === 1;
    } else {
      ok = wasm.tl_analyse(h) === 1;
    }
    show(h, mode, ok, warn);
  } catch (e) {
    errBox.textContent = e.message;
    errBox.hidden = false;
  } finally {
    wasm.tl_destroy(h);
  }
}

function show(h, mode, ok, warn) {
  const m = model;
  const status = (p) => (mode === "synth" ? wasm.tl_get_synthesis_status(h, p) : wasm.tl_get_analysis_status(h, p));
  // Prefer the result maps the KiCad UI reads; fall back to the parameter map on older WASM builds.
  const hasVal = typeof wasm.tl_get_analysis_value === "function";
  const g = (p) => {
    if (hasVal) {
      if (mode === "synth" && wasm.tl_get_synthesis_status(h, p) !== -1) return wasm.tl_get_synthesis_value(h, p);
      if (wasm.tl_get_analysis_status(h, p) !== -1) return wasm.tl_get_analysis_value(h, p);
    }
    const v = wasm.tl_get_parameter(h, p);
    return wasm.tl_last_error() ? NaN : v;
  };
  const modes = (which) => {
    if (typeof wasm.tl_get_modes !== "function") return "—";
    const ptr = wasm.tl_get_modes(h, which);
    const bytes = new Uint8Array(wasm.memory.buffer, ptr);
    const text = new TextDecoder().decode(bytes.subarray(0, bytes.indexOf(0))).trim();
    return text || "无";
  };
  // Result-only values read as 0 from an old build: show "—" rather than a wrong zero.
  const gr = (p) => {
    if (hasVal) return g(p);
    if (p === P.ZDIFF) return 2 * g(P.Z0O);
    const v = g(p);
    return v === 0 ? NaN : v;
  };

  // Analysis fills the electrical side; synthesis fills the physical side (and recomputed Z/Ang_l).
  const out = mode === "synth" ? [...m.phys, ...m.elec] : m.elec;
  for (const k of out) {
    if (mode === "synth" && m.targets && m.phys.includes(k) && k !== "l" && $("input[name=tl-target]:checked")?.value !== k) continue;
    const el = document.getElementById(fid(k));
    const v = g(F[k].p);
    if (el && Number.isFinite(v)) el.value = fmtG6(v / unitOf(k));
  }

  let worst = 0;
  for (const k of allKeys(m)) {
    const s = Math.max(warn[k] ?? 0, Math.max(0, status(F[k].p)));
    worst = Math.max(worst, s);
    setFieldState(fid(k), s);
  }

  const single = !m.coupled;
  const read = single
    ? [["特性阻抗 Z0", g(P.Z0), "Ω", true], m.key === "coax" ? ["εeff", gr(P.EPSILONR), ""] : ["εeff", gr(P.EEFF), ""], ...(m.res.includes("delay") ? [["延时", gr(P.DELAY), "ps/cm"]] : [])]
    : [["差分阻抗 Zdiff", gr(P.ZDIFF), "Ω", true], ["Zeven", g(P.Z0E), "Ω"], ["Zodd", g(P.Z0O), "Ω"]];
  const notes = [];
  if (m.key === "rwg") {
    const fc = gr(P.CUTOFF), f = num(fid("freq"));
    if (fc > 0 && f < fc) notes.push(`工作频率低于 TE₁₀ 截止频率 ${fmtOut(fc / 1e9, 4)} GHz，波导不传输（倏逝模），Z0 与 εeff 为 0。`);
  }
  if (!hasVal) notes.push("当前 kicad-transline.wasm 是旧版本，只存于结果表的数值（显示为“—”）需要重新编译 WASM 后才能显示。");
  const pill = !ok ? `<span class="pill err">${mode === "synth" ? "合成未收敛" : "计算失败"}</span>` : worst === 2 ? `<span class="pill err">有错误</span>` : worst === 1 ? `<span class="pill warn">有参数超出适用范围</span>` : `<span class="pill ok">正常</span>`;
  $("#tlResults").innerHTML = `
    <h2>计算结果 <span class="tl-status">${mode === "synth" ? "Synthesize()" : "Analyse()"} · ${pill}</span></h2>
    <div class="readout">${read.map(([k, v, u, p]) => `<div class="${p ? "primary" : ""}"><span>${k}</span><strong>${fmtOut(v, 6)}${u ? `<small>${u}</small>` : ""}</strong></div>`).join("")}</div>
    <div class="results">${rows(m.res.map((key) => [RES[key].label, RES[key].fn(gr, modes), RES[key].unit]))}</div>
    ${worst ? `<p class="panel-note warn">黄色/红色的输入框表示警告或错误：参数超出公式的适用范围时结果可能不准。</p>` : ""}
    ${notes.map((n) => `<p class="panel-note">${n}</p>`).join("")}`;
  lastRun = mode;
}
const fmtG6 = (v) => String(Number(v.toPrecision(6)));
const unitOf = (k) => { const u = document.getElementById(`${fid(k)}-u`); return u ? Number(u.value) : 1; };

function mount(body, ctx) {
  wasm = ctx.wasm;
  body.innerHTML = `<div class="tl">
    <div class="tl-models" role="group" aria-label="传输线模型">${MODELS.map((m) => `<button type="button" class="tl-model" data-model="${m.key}" aria-pressed="false">${mini(m.key)}<span>${m.name}<small>${m.cls}</small></span></button>`).join("")}</div>
    <section class="panel" id="tlInputs"></section>
    <div class="tl-out" style="display:grid;gap:20px;min-width:0">
      <section class="panel" id="tlGeom"></section>
      <div class="err-box" id="tlError" role="alert" hidden></div>
      <section class="panel" id="tlResults" aria-live="polite"></section>
    </div>
  </div>`;

  for (const b of $$(".tl-model", body)) {
    b.onclick = () => {
      if (b.dataset.model === model.key) return;
      saveModel();
      model = MODELS.find((x) => x.key === b.dataset.model);
      render();
    };
  }
  const schedule = () => { clearTimeout(timer); timer = setTimeout(() => { if (body.isConnected) run("analyse"); }, 120); };
  body.addEventListener("input", (e) => {
    const id = e.target.id ?? "";
    const key = id.replace(/^tl-/, "");
    if (model.elec.includes(key) || key === "zdiff" || key === "zcomm") return;
    if (e.target.type === "checkbox" || e.target.tagName === "SELECT") return;
    schedule();
  });
  body.addEventListener("change", (e) => {
    const id = e.target.id ?? "";
    if (id === fid("sm")) toggleMask();
    if (id === "tl-strategy") { toggleZdz(); return; }
    if (e.target.name === "tl-target" || e.target.classList.contains("unit")) return;
    if (e.target.type === "checkbox" || (e.target.tagName === "SELECT" && !e.target.classList.contains("unit"))) schedule();
  });
  body.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.target.tagName !== "INPUT") return;
    const key = e.target.id.replace(/^tl-/, "");
    run(model.elec.includes(key) || key === "zdiff" || key === "zcomm" ? "synth" : "analyse");
  });
  body.addEventListener("click", (e) => {
    if (e.target.closest("#tlAnalyse")) run("analyse");
    if (e.target.closest("#tlSynth")) run("synth");
  });
  render();
}

export const PAGE = {
  id: "transline",
  title: "传输线",
  cat: "高速",
  order: 3,
  desc: "九种传输线模型：由几何尺寸分析阻抗、损耗和延时，或由目标阻抗合成出线宽、间距和长度。",
  mount,
};
