/* Non-transmission-line pages of KiCad PCB Calculator, ported panel by panel from
 * pcb_calculator/calculator_panels/*.cpp. Numeric kernels come from the WASM bridge where one exists.
 * SPDX-License-Identifier: GPL-3.0-or-later */
import { tr, locale } from "./i18n.js?v=1ad2579f01";
import { $, $$, field, num, setNum, val, rows, wirePickers, fmtG, fmtOut, esc, UNITS } from "./app.js?v=1ad2579f01";

export const CATEGORIES = [tr("通用系统设计"), tr("电源、电流和隔离"), tr("高速"), tr("备忘录")];

const seg = (name, items, checked) =>
  `<div class="seg" role="radiogroup">${items.map(([v, l]) => `<label><input type="radio" name="${name}" value="${v}" ${String(v) === String(checked) ? "checked" : ""}><span>${esc(l)}</span></label>`).join("")}</div>`;
const radio = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value;
const onAny = (root, fn) => { root.addEventListener("input", fn); root.addEventListener("change", fn); };
const lenUnitOptions = (def = "mm") => UNITS.len.map(([n, k]) => `<option value="${k}" ${n === def ? "selected" : ""}>${n}</option>`).join("");

/* =============== 稳压器 (PANEL_REGULATOR::RegulatorsSolve) =============== */
const regulator = {
  id: "regulator", title: tr("稳压器"), cat: tr("通用系统设计"), order: 1,
  desc: tr("由基准电压和分压电阻计算可调稳压器的输出电压，或反推 R1 / R2；按电阻容差和 Vref 范围给出输出电压的最小值与最大值。"),
  mount(body) {
    body.innerHTML = tr`<div class="cols">
      <section class="panel"><h2>稳压器型号 <span class="sub">保存在本浏览器，可导入导出 .pcbcalc 数据文件</span></h2>
        <div class="fields">
          <div class="fld"><label for="rg-lib">型号</label><div class="ctl select-only"><select id="rg-lib"></select></div></div>
          <div class="btn-row">
            <button type="button" class="btn" id="rgNew">新建</button>
            <button type="button" class="btn" id="rgEdit">编辑</button>
            <button type="button" class="btn" id="rgDel">删除</button>
            <label class="btn ghost" for="rgImport">导入 .pcbcalc</label><input type="file" id="rgImport" accept=".pcbcalc,.txt" hidden>
            <button type="button" class="btn ghost" id="rgExport">导出 .pcbcalc</button>
          </div>
          <form id="rgForm" class="sub-form" hidden>
            <div class="fields two">
              ${field({ id: "rgf-name", label: tr("型号名称"), value: "" })}
              ${field({ id: "rgf-type", type: "select", label: tr("类型"), value: 1, options: [[0, tr("标准型（4 端）")], [1, tr("三端可调型")]] })}
              ${field({ id: "rgf-vmin", label: tr("Vref 最小"), value: 1.2, unit: "V" })}
              ${field({ id: "rgf-vtyp", label: tr("Vref 典型"), value: 1.25, unit: "V" })}
              ${field({ id: "rgf-vmax", label: tr("Vref 最大"), value: 1.3, unit: "V" })}
              ${field({ id: "rgf-itp", label: tr("Iadj 典型"), value: 50, unit: "µA" })}
              ${field({ id: "rgf-imx", label: tr("Iadj 最大"), value: 100, unit: "µA" })}
            </div>
            <p class="panel-note err" id="rgfMsg" hidden></p>
            <div class="btn-row"><button type="submit" class="btn primary">保存型号</button><button type="button" class="btn" id="rgfCancel">取消</button></div>
          </form>
          <p class="panel-note" id="rgLibNote"></p>
        </div>
      </section>
      <section class="panel"><h2>参数</h2>
        <div class="fields">
          ${field({ id: "rg-type", type: "select", label: tr("稳压器类型"), value: 1, options: [[0, tr("标准型（带 Sense 脚，4 端）")], [1, tr("三端可调型（如 LM317）")]] })}
          <div class="fld"><span class="lbl">求解</span>${seg("rg-solve", [["r1", "R1"], ["r2", "R2"], ["vout", "Vout"]], "vout")}</div>
        </div>
        <p class="formula" id="rgFormula"></p>
        <p class="group-label">基准与调整端电流</p>
        <div class="fields two">
          ${field({ id: "rg-vrefmin", label: tr("Vref 最小"), value: 1.2, unit: "V" })}
          ${field({ id: "rg-vreftyp", label: tr("Vref 典型"), value: 1.25, unit: "V" })}
          ${field({ id: "rg-vrefmax", label: tr("Vref 最大"), value: 1.3, unit: "V" })}
          ${field({ id: "rg-iadjtyp", label: tr("Iadj 典型"), value: 50, unit: "µA" })}
          ${field({ id: "rg-iadjmax", label: tr("Iadj 最大"), value: 100, unit: "µA" })}
        </div>
        <p class="group-label">电阻与输出</p>
        <div class="fields two">
          ${field({ id: "rg-r1", label: "R1", value: 0.24, unit: "kΩ" })}
          ${field({ id: "rg-r2", label: "R2", value: 0.72, unit: "kΩ" })}
          ${field({ id: "rg-vout", label: "Vout", value: 5, unit: "V" })}
          ${field({ id: "rg-tol", label: tr("电阻容差"), value: 1, unit: "%" })}
        </div>
      </section>
      <section class="panel" aria-live="polite"><h2>结果</h2>
        <div class="table-wrap"><table class="data"><thead><tr><th></th><th>最小</th><th>典型</th><th>最大</th></tr></thead><tbody id="rgTable"></tbody></table></div>
        <div class="readout" style="margin-top:14px;border:0" id="rgSummary"></div>
        <div class="fld"><label for="rg-remark">电源备注（可粘贴到原理图）</label><div class="ctl"><input id="rg-remark" readonly><button type="button" class="pick" id="rgCopy">复制</button></div></div>
        <p class="panel-note err" id="rgMsg" hidden></p>
      </section></div>`;
    const own = (id) => id?.startsWith("rgf-") || id === "rg-lib" || id === "rgImport";
    body.addEventListener("input", (e) => { if (!own(e.target.id)) update(); });
    body.addEventListener("change", (e) => { if (!own(e.target.id)) update(); });
    regulatorLibrary(update);
    update();
    function update() {
      const type = Number(val("rg-type"));
      const solve = radio("rg-solve");
      $("#rgFormula").textContent = type === 1 ? "Vout = Vref × (R1 + R2) / R1 + Iadj × R2" : "Vout = Vref × (R1 + R2) / R2";
      for (const id of ["rg-iadjtyp", "rg-iadjmax"]) $(`[data-fld="${id}"]`).hidden = type !== 1;
      const map = { r1: "rg-r1", r2: "rg-r2", vout: "rg-vout" };
      for (const [k, id] of Object.entries(map)) {
        const f = $(`[data-fld="${id}"]`);
        f.classList.toggle("is-computed", k === solve);
        $(`#${id}`).readOnly = k === solve;
      }
      const msg = $("#rgMsg");
      const fail = (t) => { msg.textContent = t; msg.hidden = false; $("#rgTable").innerHTML = ""; $("#rgSummary").innerHTML = ""; $("#rg-remark").value = ""; };
      msg.hidden = true;
      const restol = num("rg-tol") / 100;
      let r1typ = num("rg-r1") * 1000, r2typ = num("rg-r2") * 1000;
      const vrefmin = num("rg-vrefmin"), vreftyp = num("rg-vreftyp"), vrefmax = num("rg-vrefmax");
      let vouttyp = num("rg-vout");
      if ((vouttyp < vrefmin || vouttyp < vreftyp || vouttyp < vrefmax) && solve !== "vout") return fail(tr("Vout 必须大于 Vref。"));
      if (!vrefmin || !vreftyp || !vrefmax) return fail(tr("Vref 不能为 0。"));
      if (vrefmin > vreftyp || vreftyp > vrefmax) return fail(tr("需满足 Vref 最小 < 典型 < 最大。"));
      if ((r1typ < 0 && solve !== "r1") || (r2typ <= 0 && solve !== "r2")) return fail(tr("R1 / R2 数值不正确。"));
      let r1min, r1max, r2min, r2max, voutmin, voutmax;
      if (type === 1) {
        let iadjtyp = num("rg-iadjtyp"), iadjmax = num("rg-iadjmax");
        if (iadjtyp > iadjmax) return fail(tr("需满足 Iadj 典型 < 最大。"));
        iadjtyp /= 1e6; iadjmax /= 1e6;
        if (solve === "r1") r1typ = vreftyp * r2typ / (vouttyp - vreftyp - r2typ * iadjtyp);
        if (solve === "r2") r2typ = (vouttyp - vreftyp) / (iadjtyp + vreftyp / r1typ);
        if (solve === "vout") vouttyp = vreftyp * (r1typ + r2typ) / r1typ + r2typ * iadjtyp;
        [r1min, r1max, r2min, r2max] = [r1typ * (1 - restol), r1typ * (1 + restol), r2typ * (1 - restol), r2typ * (1 + restol)];
        voutmin = vrefmin * (r1max + r2min) / r1max + r2min * iadjtyp;
        voutmax = vrefmax * (r1min + r2max) / r1min + r2max * iadjmax;
      } else {
        if (solve === "r1") r1typ = (vouttyp / vreftyp - 1) * r2typ;
        if (solve === "r2") r2typ = r1typ / (vouttyp / vreftyp - 1);
        if (solve === "vout") vouttyp = vreftyp * (r1typ + r2typ) / r2typ;
        [r1min, r1max, r2min, r2max] = [r1typ * (1 - restol), r1typ * (1 + restol), r2typ * (1 - restol), r2typ * (1 + restol)];
        voutmin = vrefmin * (r1min + r2max) / r2max;
        voutmax = vrefmax * (r1max + r2min) / r2min;
      }
      // KiCad rounds displayed values to 0.001 (tolerances to 0.01).
      const rt = (v, p = 0.001) => Math.round(v / p) * p;
      const tolmin = (voutmin - vouttyp) / vouttyp * 100;
      const tolmax = (voutmax - vouttyp) / voutmax * 100;
      // setNum leaves the field being typed in untouched.
      setNum("rg-r1", rt(r1typ / 1000));
      setNum("rg-r2", rt(r2typ / 1000));
      setNum("rg-vout", rt(vouttyp));
      const c = (v) => fmtOut(rt(v), 6);
      $("#rgTable").innerHTML = tr`
        <tr><td class="txt">R1 (kΩ)</td><td>${c(r1min / 1000)}</td><td>${c(r1typ / 1000)}</td><td>${c(r1max / 1000)}</td></tr>
        <tr><td class="txt">R2 (kΩ)</td><td>${c(r2min / 1000)}</td><td>${c(r2typ / 1000)}</td><td>${c(r2max / 1000)}</td></tr>
        <tr class="is-hit"><td class="txt">Vout (V)</td><td>${c(voutmin)}</td><td>${c(vouttyp)}</td><td>${c(voutmax)}</td></tr>
        <tr><td class="txt">总容差 (%)</td><td>${fmtOut(rt(tolmin, 0.01))}</td><td class="dim">—</td><td>${fmtOut(rt(tolmax, 0.01))}</td></tr>`;
      // Same text as PANEL_REGULATOR's m_textPowerComment: "%gV [%gV ... %gV]".
      $("#rg-remark").value = `${fmtG(rt(vouttyp, 0.01))}V [${fmtG(rt(voutmin, 0.01))}V ... ${fmtG(rt(voutmax, 0.01))}V]`;
      $("#rgSummary").innerHTML = tr`<div class="primary"><span>输出电压</span><strong>${c(vouttyp)}<small>V</small></strong></div><div><span>范围</span><strong style="font-size:1.1rem">${fmtOut(rt(voutmin, 0.01))} … ${fmtOut(rt(voutmax, 0.01))}<small>V</small></strong></div>`;
    }
  },
};

/* Regulator list (REGULATOR_LIST + DIALOG_REGULATOR_FORM), persisted per browser and exchanged
 * with KiCad's pcb_calculator data file (PCB_CALCULATOR_DATAFILE, s-expression, version 2). */
const REG_KEY = "layerline.regulators";
function loadRegs() {
  try { const v = JSON.parse(localStorage.getItem(REG_KEY) ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
function saveRegs(list) {
  try { localStorage.setItem(REG_KEY, JSON.stringify(list)); return true; } catch { return false; }
}
function sexpr(text) {
  const tokens = text.match(/"(?:\\.|[^"\\])*"|[()]|[^\s()"]+/g) ?? [];
  let i = 0;
  const read = () => {
    const t = tokens[i++];
    if (t === "(") {
      const list = [];
      while (i < tokens.length && tokens[i] !== ")") list.push(read());
      i++;
      return list;
    }
    return t?.startsWith('"') ? JSON.parse(t) : t;
  };
  const out = [];
  while (i < tokens.length) out.push(read());
  return out;
}
function parsePcbcalc(text) {
  const regs = [];
  const walk = (node) => {
    if (!Array.isArray(node)) return;
    if (node[0] === "regulator" && typeof node[1] === "string") {
      const r = { name: node[1], type: 0, vmin: 0, vtyp: 0, vmax: 0, itp: 0, imx: 0 };
      for (const kv of node.slice(2)) {
        if (!Array.isArray(kv)) continue;
        const [k, v] = kv;
        if (k === "reg_vref_min") r.vmin = Number(v);
        if (k === "reg_vref_typ") r.vtyp = Number(v);
        if (k === "reg_vref_max") r.vmax = Number(v);
        if (k === "reg_iadj_typ") r.itp = Number(v);
        if (k === "reg_iadj_max") r.imx = Number(v);
        if (k === "reg_type") r.type = v === "3terminal" ? 1 : 0;
      }
      regs.push(r);
      return;
    }
    node.forEach(walk);
  };
  sexpr(text).forEach(walk);
  return regs;
}
function formatPcbcalc(list) {
  const q = (s) => JSON.stringify(String(s));
  const g = (v) => fmtG(v, 6);
  const body = list.map((r) => [
    `    (regulator ${q(r.name)}`,
    `      (reg_vref_min ${g(r.vmin)})`, `      (reg_vref_typ ${g(r.vtyp)})`, `      (reg_vref_max ${g(r.vmax)})`,
    ...(r.type === 1 ? [`      (reg_iadj_typ ${g(r.itp)})`, `      (reg_iadj_max ${g(r.imx)})`] : []),
    `      (reg_type ${r.type === 1 ? "3terminal" : "normal"})`,
    "    )",
  ].join("\n")).join("\n");
  return `(datafile\n  (version 2)\n  (date ${q(new Date().toISOString())})\n  (tool "LayerLine PCB Calculator")\n  (regulators\n${body}\n  )\n)\n`;
}
function regulatorLibrary(update) {
  let list = loadRegs();
  let editing = null;
  const sel = $("#rg-lib"), form = $("#rgForm"), note = $("#rgLibNote");
  const fill = (name) => {
    sel.innerHTML = tr`<option value="">（不使用型号，手动填写）</option>${list.map((r) => `<option ${r.name === name ? "selected" : ""}>${esc(r.name)}</option>`).join("")}`;
    $("#rgEdit").disabled = $("#rgDel").disabled = !sel.value;
    note.textContent = list.length ? tr`共 ${list.length} 个型号。` : tr("还没有保存的型号：点“新建”，或导入 .pcbcalc 数据文件。");
  };
  const persist = (name) => {
    list.sort((a, b) => a.name.localeCompare(b.name));
    fill(name);
    if (!saveRegs(list)) note.textContent = tr("浏览器禁止本地存储，型号只在本次打开期间有效。");
  };
  const apply = (r) => {
    const set = (id, v) => { document.getElementById(id).value = fmtG(v); };
    $("#rg-type").value = String(r.type);
    set("rg-vrefmin", r.vmin); set("rg-vreftyp", r.vtyp); set("rg-vrefmax", r.vmax);
    if (r.type === 1) { set("rg-iadjtyp", r.itp); set("rg-iadjmax", r.imx); }
    update();
  };
  const toggleIadj = () => {
    const three = val("rgf-type") === "1";
    for (const id of ["rgf-itp", "rgf-imx"]) $(`[data-fld="${id}"]`).hidden = !three;
  };
  const openForm = (r) => {
    editing = r?.name ?? null;
    const set = (id, v) => { document.getElementById(id).value = typeof v === "number" ? fmtG(v) : v; };
    set("rgf-name", r?.name ?? "");
    $("#rgf-type").value = String(r?.type ?? Number(val("rg-type")));
    set("rgf-vmin", r?.vmin ?? num("rg-vrefmin")); set("rgf-vtyp", r?.vtyp ?? num("rg-vreftyp")); set("rgf-vmax", r?.vmax ?? num("rg-vrefmax"));
    set("rgf-itp", r?.itp ?? num("rg-iadjtyp")); set("rgf-imx", r?.imx ?? num("rg-iadjmax"));
    $("#rgfMsg").hidden = true;
    toggleIadj();
    form.hidden = false;
    $("#rgf-name").focus();
  };
  sel.addEventListener("change", () => {
    const r = list.find((x) => x.name === sel.value);
    $("#rgEdit").disabled = $("#rgDel").disabled = !r;
    if (r) apply(r);
  });
  $("#rgNew").onclick = () => openForm(null);
  $("#rgEdit").onclick = () => openForm(list.find((x) => x.name === sel.value));
  $("#rgDel").onclick = () => {
    const btn = $("#rgDel"), name = sel.value;
    if (!name) return;
    // Two-step delete instead of a confirm() dialog.
    if (btn.dataset.confirm !== name) { btn.dataset.confirm = name; btn.textContent = tr`确认删除 ${name}`; return; }
    delete btn.dataset.confirm;
    btn.textContent = tr("删除");
    list = list.filter((x) => x.name !== name);
    persist("");
  };
  $("#rgfCancel").onclick = () => { form.hidden = true; };
  $("#rgf-type").addEventListener("change", toggleIadj);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const msg = $("#rgfMsg");
    const r = { name: val("rgf-name").trim(), type: Number(val("rgf-type")), vmin: num("rgf-vmin"), vtyp: num("rgf-vtyp"), vmax: num("rgf-vmax"), itp: num("rgf-itp"), imx: num("rgf-imx") };
    if (r.type !== 1) { r.itp = 0; r.imx = 0; }
    const bad = !r.name ? tr("请填写型号名称。")
      : ![r.vmin, r.vtyp, r.vmax].every((v) => v > 0) ? tr("Vref 需为正数。")
      : !(r.vmin <= r.vtyp && r.vtyp <= r.vmax) ? tr("需满足 Vref 最小 ≤ 典型 ≤ 最大。")
      : r.type === 1 && !(r.itp >= 0 && r.imx >= r.itp) ? tr("需满足 0 ≤ Iadj 典型 ≤ 最大。")
      : list.some((x) => x.name === r.name && x.name !== editing) ? tr("已有同名型号。") : "";
    if (bad) { msg.textContent = bad; msg.hidden = false; return; }
    list = list.filter((x) => x.name !== editing);
    list.push(r);
    persist(r.name);
    form.hidden = true;
    apply(r);
  });
  $("#rgImport").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const regs = parsePcbcalc(await file.text());
    if (!regs.length) { note.textContent = tr`${file.name} 里没有找到稳压器数据。`; return; }
    const names = new Set(regs.map((r) => r.name));
    list = [...list.filter((x) => !names.has(x.name)), ...regs];
    persist(regs[0].name);
    apply(regs[0]);
    note.textContent = tr`已从 ${file.name} 导入 ${regs.length} 个型号（同名的已覆盖）。`;
  });
  $("#rgExport").onclick = () => {
    if (!list.length) { note.textContent = tr("没有可导出的型号。"); return; }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([formatPcbcalc(list)], { type: "text/plain" }));
    a.download = "regulators.pcbcalc";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $("#rgCopy").onclick = async () => {
    const input = $("#rg-remark"), btn = $("#rgCopy");
    try { await navigator.clipboard.writeText(input.value); btn.textContent = tr("已复制"); }
    catch { input.select(); btn.textContent = tr("按 Ctrl+C"); }
    setTimeout(() => { btn.textContent = tr("复制"); }, 1500);
  };
  fill("");
}

/* =============== 电阻计算器 (RES_EQUIV_CALC, resistor_substitution_utils.cpp) =============== */
const E24 = [100, 110, 120, 130, 150, 160, 180, 200, 220, 240, 270, 300, 330, 360, 390, 430, 470, 510, 560, 620, 680, 750, 820, 910];
const ESUB = { E1: 24, E3: 8, E6: 4, E12: 2, E24: 1 };
const EPS = 1e-12;
function strValue(v) {
  if (v < 1000) return `${Math.trunc(v)}R`;
  let div = 1e3, unit = "K";
  if (v >= 1e6) { div = 1e6; unit = "M"; }
  v /= div;
  const i = Math.trunc(v), mant = v - i;
  return `${i}${unit}${mant > 0 ? Math.round(mant * 10) : ""}`;
}
function seriesData(name) {
  const list = E24.filter((_, i) => i % ESUB[name] === 0);
  const out = [];
  for (let decade = 10; ; decade *= 10) {
    const mult = decade / list[0];
    for (const x of list) {
      const value = mult * x;
      out.push({ value, name: strValue(value), parts: [value] });
      if (value >= 1e6) return out;
    }
  }
}
function resEquiv(target, series, excludes) {
  const base = seriesData(series);
  const r1 = base.filter((r) => !excludes.some((x) => Number.isFinite(x) && Math.abs(r.value - x) < EPS + 1e-9 * x));
  const ser = (a, b) => a + b, par = (a, b) => a * b / (a + b);
  const embrace = (t, sym) => { let lvl = 0, need = false; for (const c of t) { if (c === "(") lvl++; else if (c === ")") lvl--; else if (c === sym && lvl === 0) need = true; } return need ? `(${t})` : t; };
  const S = (a, b) => ({ value: ser(a.value, b.value), name: `${embrace(a.name, "|")} + ${embrace(b.name, "|")}`, parts: [...a.parts, ...b.parts] });
  const Pp = (a, b) => ({ value: par(a.value, b.value), name: `${embrace(a.name, "+")} | ${embrace(b.name, "+")}`, parts: [...a.parts, ...b.parts] });
  const r2 = [];
  for (let i = 0; i < r1.length; i++) for (let j = i; j < r1.length; j++) {
    r2.push({ value: ser(r1[i].value, r1[j].value), name: `${r1[i].name} + ${r1[j].name}`, parts: [r1[i].value, r1[j].value] });
    r2.push({ value: par(r1[i].value, r1[j].value), name: `${r1[i].name} | ${r1[j].name}`, parts: [r1[i].value, r1[j].value] });
  }
  r2.sort((a, b) => a.value - b.value);
  const find = (t) => {
    if (Number.isNaN(t)) return [r2[0], r2[0]];
    if (t <= r2[0].value || t >= r2[r2.length - 1].value) return [r2[0], r2[r2.length - 1]];
    let lo = 0, hi = r2.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (r2[mid].value < t) lo = mid + 1; else hi = mid; }
    return lo === 0 ? [r2[0], r2[0]] : [r2[lo - 1], r2[lo]];
  };
  const uniq = (r) => new Set(r.parts.map((p) => p.toPrecision(12))).size;
  const collector = () => {
    let best = null, dev = Infinity;
    return {
      add([a, b], vf, rf) {
        for (const f of [a, b]) {
          const d = Math.abs(vf(f.value) - target);
          if (d + EPS < dev) { dev = d; best = rf(f); }
          else if (Math.abs(d - dev) < EPS) {
            const c = rf(f);
            if (!best || uniq(c) < uniq(best) || (uniq(c) === uniq(best) && (c.parts.length < best.parts.length || (c.parts.length === best.parts.length && c.name < best.name)))) best = c;
          }
        }
      },
      get best() { return best; },
    };
  };
  const results = {};
  let c = collector();
  c.add(find(target), (v) => v, (f) => f);
  results.r2 = c.best;
  if (Math.abs(results.r2.value - target) > EPS) {
    c = collector();
    for (const r of r1) {
      c.add(find(target - r.value), (v) => ser(v, r.value), (f) => S(f, r));
      c.add(find(target * r.value / (r.value - target)), (v) => par(v, r.value), (f) => Pp(f, r));
    }
    results.r3 = c.best;
    if (Math.abs(results.r3.value - target) > EPS) {
      c = collector();
      for (const rr of r2) {
        c.add(find(target - rr.value), (v) => ser(v, rr.value), (f) => S(f, rr));
        c.add(find(target * rr.value / (rr.value - target)), (v) => par(v, rr.value), (f) => Pp(f, rr));
      }
      for (const a of r1) for (const b of r1) {
        c.add(find((target - a.value) * b.value / (a.value + b.value - target)), (v) => ser(a.value, par(b.value, v)), (f) => S(a, Pp(b, f)));
        c.add(find(target * a.value / (a.value - target) - b.value), (v) => par(a.value, ser(b.value, v)), (f) => Pp(a, S(b, f)));
      }
      results.r4 = c.best;
    }
  }
  return results;
}
const resistor = {
  id: "resistor", title: tr("电阻计算器"), cat: tr("通用系统设计"), order: 2,
  desc: tr("用标准 E 系列电阻的串并联组合（最多 4 只）逼近一个非标阻值。目标值本身会被排除（视为缺料），可再额外排除两个阻值。"),
  mount(body) {
    body.innerHTML = tr`<div class="cols">
      <section class="panel"><h2>输入</h2>
        <div class="fields">
          ${field({ id: "rc-target", label: tr("所需阻值"), value: 5.4, unit: "kΩ" })}
          ${field({ id: "rc-ex1", label: tr("排除阻值 1（可空）"), value: "", unit: "kΩ" })}
          ${field({ id: "rc-ex2", label: tr("排除阻值 2（可空）"), value: "", unit: "kΩ" })}
          <div class="fld"><span class="lbl">可用系列</span>${seg("rc-series", ["E1", "E3", "E6", "E12", "E24"].map((x) => [x, x]), "E6")}</div>
        </div>
        <p class="panel-note">阻值范围 10 Ω – 1 MΩ；可求解的目标为 0.0025 – 4000 kΩ。“+” 表示串联，“|” 表示并联，4K7 即 4.7 kΩ。</p>
      </section>
      <section class="panel" aria-live="polite"><h2>组合方案</h2><div id="rcOut"></div></section></div>`;
    let t = 0;
    onAny(body, () => { clearTimeout(t); t = setTimeout(() => { if (body.isConnected) update(); }, 150); });
    update();
    function update() {
      const target = num("rc-target") * 1000;
      const out = $("#rcOut");
      if (!Number.isFinite(target) || target < 2.5 || target > 4e6) {
        out.innerHTML = tr`<p class="panel-note err">所需阻值无效：请输入 0.0025 – 4000 kΩ 之间的数。</p>`;
        return;
      }
      const res = resEquiv(target, radio("rc-series"), [target, num("rc-ex1") * 1000, num("rc-ex2") * 1000]);
      const line = (n, r) => {
        if (!r) return tr`<div class="row"><span class="k">${n} 只电阻</span><span class="v na">不需要</span></div>`;
        const err = (r.value / target - 1) * 100;
        const es = Math.abs(err) < EPS ? tr("精确") : Math.abs(err) < 0.01 ? "<0.01 %" : `${err > 0 ? "+" : ""}${err.toFixed(2)} %`;
        return tr`<div class="row" style="grid-template-columns:4.5em 1fr auto"><span class="k">${n} 只电阻</span><span class="v" style="text-align:left;white-space:normal">${esc(r.name)}<small>= ${fmtOut(r.value, 6)} Ω</small></span><span class="pill ${Math.abs(err) < 0.1 ? "ok" : Math.abs(err) < 1 ? "warn" : "err"}">${es}</span></div>`;
      };
      out.innerHTML = `<div class="results">${line(2, res.r2)}${line(3, res.r3)}${line(4, res.r4)}</div>`;
    }
  },
};

/* =============== 电气间距 (IPC-2221 table + IEC 60664-1 kernel) =============== */
const IPC = [
  ["0 … 15 V", [0.05, 0.1, 0.1, 0.05, 0.13, 0.13, 0.13]],
  ["16 … 30 V", [0.05, 0.1, 0.1, 0.05, 0.13, 0.25, 0.13]],
  ["31 … 50 V", [0.1, 0.6, 0.6, 0.13, 0.13, 0.4, 0.13]],
  ["51 … 100 V", [0.1, 0.6, 1.5, 0.13, 0.13, 0.5, 0.13]],
  ["101 … 150 V", [0.2, 0.6, 3.2, 0.4, 0.4, 0.8, 0.4]],
  ["151 … 170 V", [0.2, 1.25, 3.2, 0.4, 0.4, 0.8, 0.4]],
  ["171 … 250 V", [0.2, 1.25, 6.4, 0.4, 0.4, 0.8, 0.4]],
  ["251 … 300 V", [0.2, 1.25, 12.5, 0.4, 0.4, 0.8, 0.8]],
  ["301 … 500 V", [0.25, 2.5, 12.5, 0.8, 0.8, 1.5, 0.8]],
];
const IPC_PER_V = [0.0025, 0.005, 0.025, 0.00305, 0.00305, 0.00305, 0.00305];
const IPC_UPPER = [15, 30, 50, 100, 150, 170, 250, 300, 500];
const IPC_COLS = [["B1", tr("内层导体")], ["B2", tr("外层无涂覆，海拔 ≤ 3050 m")], ["B3", tr("外层无涂覆，海拔 > 3050 m")], ["B4", tr("外层永久聚合物涂覆")], ["A5", tr("外层，组装后三防漆")], ["A6", tr("元件引脚/端子，无涂覆")], ["A7", tr("元件引脚/端子，三防漆")]];
const spacing = {
  id: "spacing", title: tr("电气间距"), cat: tr("电源、电流和隔离"), order: 1,
  desc: tr("IPC-2221 导体最小间距表，以及按 IEC 60664-1 计算电气间隙、爬电距离和最小沟槽宽度。"),
  mount(body, { wasm }) {
    body.innerHTML = tr`<div style="display:grid;gap:16px">
      <div>${seg("sp-std", [["ipc", "IPC-2221"], ["iec", "IEC 60664-1"]], "ipc")}</div>
      <div id="spIpc" class="page-body">
        <section class="panel"><div class="fields two" style="max-width:520px">
          ${field({ id: "sp-v", label: tr("电压（>500 V 一行按此计算）"), value: 500, unit: "V" })}
          <div class="fld"><label for="sp-u">显示单位</label><div class="ctl select-only"><select id="sp-u">${lenUnitOptions("mm")}</select></div></div>
        </div></section>
        <div class="table-wrap"><table class="data"><thead><tr><th>导体间电压（DC 或交流峰值）</th>${IPC_COLS.map(([c, d]) => `<th title="${d}">${c}<br><span class="sub">${d}</span></th>`).join("")}</tr></thead><tbody id="spTable"></tbody></table></div>
      </div>
      <div id="spIec" class="cols" hidden>
        <section class="panel"><h2>额定冲击耐受电压</h2><div class="fields two">
          ${field({ id: "iec-rated", label: tr("额定电压（相对地）"), value: 230, unit: "V" })}
          ${field({ id: "iec-ov", type: "select", label: tr("过电压类别"), value: 1, options: [[1, "OV I"], [2, "OV II"], [3, "OV III"], [4, "OV IV"]] })}
        </div><div class="results" style="margin-top:12px" id="iecImpulse"></div>
        <p class="group-label">电气间隙与爬电距离</p><div class="fields two">
          ${field({ id: "iec-rms", label: tr("工作电压有效值"), value: 230, unit: "V" })}
          ${field({ id: "iec-transient", label: tr("瞬态过电压"), value: 1, unit: "kV" })}
          ${field({ id: "iec-peak", label: tr("重复峰值电压"), value: 0.5, unit: "kV" })}
          ${field({ id: "iec-alt", label: tr("海拔"), value: 2000, unit: "m" })}
          ${field({ id: "iec-ins", type: "select", label: tr("绝缘类型"), value: 1, options: [[1, tr("功能绝缘")], [2, tr("基本绝缘")], [3, tr("加强绝缘")]] })}
          ${field({ id: "iec-pd", type: "select", label: tr("污染等级"), value: 1, options: [[1, tr("1 级")], [2, tr("2 级")], [3, tr("3 级")], [4, tr("4 级")]] })}
          ${field({ id: "iec-mg", type: "select", label: tr("材料组（CTI）"), value: 1, options: [[1, "I（CTI ≥ 600）"], [2, "II（400 ≤ CTI < 600）"], [3, "IIIa（175 ≤ CTI < 400）"], [4, "IIIb（100 ≤ CTI < 175）"]] })}
          ${field({ id: "iec-pcb", type: "check", label: tr("爬电路径在印制板材料上"), value: true })}
        </div></section>
        <section class="panel" aria-live="polite"><h2>结果</h2><div class="results" id="iecOut"></div>
          <p class="panel-note">加强绝缘的峰值电压按 1.6 倍计入；海拔高于 2000 m 时电气间隙按修正系数放大。</p></section>
      </div></div>`;
    onAny(body, update);
    update();
    function update() {
      const iec = radio("sp-std") === "iec";
      $("#spIpc").hidden = iec; $("#spIec").hidden = !iec;
      if (!iec) {
        const v = num("sp-v"), scale = Number(val("sp-u")) / 1e-3;
        const hit = Number.isFinite(v) ? (v > 500 ? 9 : IPC_UPPER.findIndex((u) => v <= u)) : -1;
        const vv = Math.max(Number.isFinite(v) ? v : 500, 500);
        const last = IPC[8][1].map((x, i) => x + IPC_PER_V[i] * (vv - 500));
        const unit = $("#sp-u").selectedOptions[0].textContent;
        $("#spTable").innerHTML = [...IPC, [tr`> 500 V（按 ${fmtG(vv)} V）`, last]].map(([l, vals], i) =>
          `<tr class="${i === hit ? "is-hit" : ""}"><td class="txt">${l}</td>${vals.map((x) => `<td>${fmtG(x / scale, 4)}</td>`).join("")}</tr>`).join("") +
          tr`<tr><td class="txt dim" colspan="8">单位：${unit}。&gt; 500 V 时，每列在 500 V 值的基础上每伏再加：${IPC_PER_V.map((x) => fmtG(x / scale, 4)).join(" / ")} ${unit}。</td></tr>`;
      } else {
        const args = [num("iec-rated"), num("iec-rms"), num("iec-peak"), num("iec-transient"), num("iec-alt"), 50, +val("iec-pd"), +val("iec-ov"), +val("iec-mg"), +val("iec-ins"), 1, val("iec-pcb") ? 1 : 0];
        const get = (i) => { const r = wasm.pcbcalc_iec60664(i, ...args); return r >= 0 ? r : tr("错误"); };
        const imp = get(3);
        $("#iecImpulse").innerHTML = rows([[tr("额定冲击耐受电压"), typeof imp === "number" ? imp / 1000 : imp, "kV", "hl"]]);
        $("#iecOut").innerHTML = rows([[tr("电气间隙"), get(0), "mm", "hl"], [tr("爬电距离"), get(1), "mm", "hl"], [tr("最小沟槽宽度"), get(2), "mm"]]);
      }
    }
  },
};

/* =============== 过孔尺寸 (PANEL_VIA_SIZE::OnViaCalculate) =============== */
const via = {
  id: "via", title: tr("过孔尺寸"), cat: tr("电源、电流和隔离"), order: 2,
  desc: tr("由孔径、镀层和焊盘尺寸估算过孔的电阻、载流量、热阻，以及高速信号下的寄生电容、电感和上升时间劣化。"),
  mount(body, { wasm }) {
    const L = (id, label, value) => field({ id, label, value, unit: "len" });
    body.innerHTML = tr`<div class="cols">
      <section class="panel"><h2>过孔几何</h2><div class="fields two">
        ${L("via-hole", tr("成品孔径"), 0.4)}${L("via-plating", tr("镀层厚度"), 0.035)}${L("via-len", tr("过孔长度（板厚）"), 1.6)}
        ${L("via-pad", tr("焊盘直径"), 0.6)}${L("via-clear", tr("反焊盘（避空）直径"), 1)}
      </div>
      <p class="group-label">电气与材料</p><div class="fields two">
        ${field({ id: "via-z0", label: tr("走线特性阻抗"), value: 50, unit: "Ω" })}
        ${field({ id: "via-i", label: tr("施加电流"), value: 1, unit: "A" })}
        ${field({ id: "via-rho", label: tr("镀层电阻率"), value: 1.72e-8, unit: "Ω·m", pick: "rho" })}
        ${field({ id: "via-er", label: tr("板材相对介电常数"), sym: "εr", value: 4.5, pick: "er" })}
        ${field({ id: "via-dt", label: tr("允许温升"), value: 10, unit: "°C" })}
        ${field({ id: "via-rise", label: tr("脉冲上升时间"), value: 1, unit: "ns" })}
      </div></section>
      <section class="panel" aria-live="polite"><h2>结果</h2><div id="viaDiagram"></div><div class="results" id="viaOut"></div>
        <p class="panel-note" id="viaNote"></p></section></div>`;
    wirePickers(body);
    onAny(body, update);
    update();
    function update() {
      const a = ["via-hole", "via-plating", "via-len", "via-pad", "via-clear"].map((id) => Math.abs(num(id)));
      const args = [...a, Math.abs(num("via-z0")), Math.abs(num("via-i")), Math.abs(num("via-rho")), Math.abs(num("via-er")), Math.abs(num("via-dt")), Math.abs(num("via-rise"))];
      // The kernel already returns pF / ps / nH and takes the rise time in ns, exactly like KiCad.
      const g = (i) => wasm.pcbcalc_via(i, ...args);
      $("#viaOut").innerHTML = rows([
        [tr("过孔电阻"), g(0), "Ω"], [tr("压降"), g(1), "V"], [tr("功耗"), g(2), "W"], [tr("估算载流量（IPC-2221 外层）"), g(3), "A", "hl"],
        [tr("热阻"), g(4), "°C/W"], [tr("寄生电容"), g(5), "pF", "hl"], [tr("上升时间劣化"), g(6), "ps"], [tr("寄生电感"), g(7), "nH", "hl"], [tr("感抗（按上升时间）"), g(8), "Ω"],
      ]);
      $("#viaDiagram").innerHTML = viaDiagram();
      $("#viaNote").textContent = a[4] <= a[3] ? tr("反焊盘直径不大于焊盘直径（过孔位于铺铜内），电容相关结果无意义。") : tr("载流量沿用 IPC-2221 外层走线公式，只作估算。");
      $("#viaNote").className = `panel-note${a[4] <= a[3] ? " warn" : ""}`;
    }
  },
};


function viaDiagram() {
  const lab = (id, sym) => {
    const input = document.getElementById(id), u = document.getElementById(`${id}-u`);
    return `${sym} ${input.value}${u ? ` ${u.selectedOptions[0].textContent}` : ""}`;
  };
  const h = (x1, x2, y, t, hot) => `<path class="dim" d="M${x1} ${y}H${x2}M${x1} ${y - 4}v8M${x2} ${y - 4}v8"/><text class="dim-t${hot ? " hot" : ""}" x="${(x1 + x2) / 2}" y="${y - 7}" text-anchor="middle">${esc(t)}</text>`;
  const v = (x, y1, y2, t) => `<path class="dim" d="M${x} ${y1}V${y2}M${x - 4} ${y1}h8M${x - 4} ${y2}h8"/><text class="dim-t" x="${x + 8}" y="${(y1 + y2) / 2 + 4}">${esc(t)}</text>`;
  return tr`<svg class="xsec" viewBox="0 0 400 214" role="img" aria-label="过孔截面示意">
    <rect class="fr4" x="30" y="66" width="270" height="100"/>
    <rect class="cu" x="30" y="114" width="85" height="5"/><rect class="cu" x="215" y="114" width="85" height="5"/>
    <rect class="cu" x="130" y="58" width="70" height="8"/><rect class="cu" x="130" y="166" width="70" height="8"/>
    <rect class="cu" x="148" y="58" width="7" height="116"/><rect class="cu" x="175" y="58" width="7" height="116"/>
    <rect class="air" x="155" y="58" width="20" height="116"/>
    ${h(130, 200, 26, lab("via-pad", tr("焊盘")))}${h(155, 175, 48, lab("via-hole", tr("孔径")), true)}
    <path class="dim" d="M115 119V200M215 119V200" stroke-dasharray="2 3"/>
    ${h(115, 215, 200, lab("via-clear", tr("反焊盘")))}${v(314, 66, 166, lab("via-len", "L"))}
    <text class="dim-t" x="186" y="98">${esc(lab("via-plating", "T"))}</text>
    <text class="dim-t" x="34" y="110" style="font-weight:400">内层平面</text>
  </svg>`;
}

/* =============== 走线宽度 (PANEL_TRACK_WIDTH) =============== */
const track = {
  id: "track", title: tr("走线宽度"), cat: tr("电源、电流和隔离"), order: 3,
  desc: tr("按 IPC-2221 由电流求外层和内层走线宽度，或由任一层线宽反求允许电流。最后编辑的电流或线宽作为基准（加粗显示）。"),
  formula: tr("I = k × ΔT<sup>0.44</sup> × (W × T)<sup>0.725</sup>　外层 k = 0.048，内层 k = 0.024（尺寸单位 mil）"),
  mount(body, { wasm }) {
    const layer = (p, name, t) => `<section class="panel"><h2>${name}</h2><div class="fields two">
        ${field({ id: `tw-${p}w`, label: tr("线宽"), value: 0.2, unit: "len" })}
        ${field({ id: `tw-${p}t`, label: tr("铜厚"), value: t, unit: "len", defUnit: "µm" })}
      </div><div class="results" style="margin-top:12px" id="tw-${p}out"></div></section>`;
    body.innerHTML = tr`<section class="panel"><h2>通用参数</h2><div class="fields two">
        ${field({ id: "tw-i", label: tr("电流"), value: 1, unit: "A" })}
        ${field({ id: "tw-dt", label: tr("允许温升"), sym: "ΔT", value: 10, unit: "°C" })}
        ${field({ id: "tw-len", label: tr("导体长度"), value: 20, unit: "len" })}
        ${field({ id: "tw-rho", label: tr("电阻率（IPC 公式仅适用于铜）"), value: 1.72e-8, unit: "Ω·m", readonly: true })}
      </div></section>
      <div class="cols">${layer("e", tr("外层"), 35)}${layer("i", tr("内层"), 35)}</div>
      <p class="panel-note">公式来自 IPC-2221，适用范围：外层电流 ≤ 35 A、内层 ≤ 17.5 A，温升 ≤ 100 °C，线宽 ≤ 400 mil（10 mm）。超出范围的结果只能作参考。</p>`;
    let master = "current";
    body.addEventListener("input", (e) => {
      if (e.target.id === "tw-i") master = "current";
      if (e.target.id === "tw-ew") master = "ext";
      if (e.target.id === "tw-iw") master = "int";
      update();
    });
    body.addEventListener("change", update);
    update();
    function update() {
      const dt = Math.abs(num("tw-dt")), et = Math.abs(num("tw-et")), it = Math.abs(num("tw-it"));
      let I = Math.abs(num("tw-i")), ew = Math.abs(num("tw-ew")), iw = Math.abs(num("tw-iw"));
      if (master === "current") { ew = wasm.pcbcalc_track_width(I, et, dt, 0); iw = wasm.pcbcalc_track_width(I, it, dt, 1); }
      if (master === "ext") { I = wasm.pcbcalc_track_current(ew, et, dt, 0); iw = wasm.pcbcalc_track_width(I, it, dt, 1); }
      if (master === "int") { I = wasm.pcbcalc_track_current(iw, it, dt, 1); ew = wasm.pcbcalc_track_width(I, et, dt, 0); }
      if (master !== "current") setNum("tw-i", I);
      if (master !== "ext") setNum("tw-ew", ew);
      if (master !== "int") setNum("tw-iw", iw);
      for (const [id, m] of [["tw-i", "current"], ["tw-ew", "ext"], ["tw-iw", "int"]]) $(`[data-fld="${id}"]`).classList.toggle("is-master", master === m);
      const len = Math.abs(num("tw-len")), rho = 1.72e-8;
      for (const [p, w, t] of [["e", ew, et], ["i", iw, it]]) {
        const s = Number($(`#tw-${p}w-u`).value), un = $(`#tw-${p}w-u`).selectedOptions[0].textContent;
        const aux = (k) => wasm.pcbcalc_track_aux(k, I, w, t, len, rho);
        $(`#tw-${p}out`).innerHTML = rows([[tr("截面积"), (w * t) / (s * s), `${un}²`], [tr("电阻"), aux(0), "Ω"], [tr("压降"), aux(1), "V"], [tr("功耗"), aux(2), "W"]]);
      }
    }
  },
};

/* =============== 熔断电流 (PANEL_FUSING_CURRENT) =============== */
const fusing = {
  id: "fusing", title: tr("熔断电流"), cat: tr("电源、电流和隔离"), order: 4,
  desc: tr("绝热模型下铜走线的熔断：给定其余三项，求线宽、铜厚、电流或熔断时间中的一项。只适用于短脉冲（绝热假设）。"),
  mount(body) {
    body.innerHTML = tr`<div class="cols"><section class="panel"><h2>参数</h2>
      <div class="fld" style="margin-bottom:12px"><span class="lbl">求解</span>${seg("fu-solve", [["width", tr("线宽")], ["thickness", tr("铜厚")], ["current", tr("电流")], ["time", tr("时间")]], "current")}</div>
      <div class="fields two">
        ${field({ id: "fu-ta", label: tr("环境温度"), value: 25, unit: "°C" })}
        ${field({ id: "fu-tm", label: tr("熔点（铜 1084 °C）"), value: 1084, unit: "°C" })}
        ${field({ id: "fu-width", label: tr("线宽"), value: 0.1, unit: "len" })}
        ${field({ id: "fu-thickness", label: tr("铜厚"), value: 0.035, unit: "len" })}
        ${field({ id: "fu-current", label: tr("电流"), value: 10, unit: "A" })}
        ${field({ id: "fu-time", label: tr("时间"), value: 0.01, unit: "s" })}
      </div></section>
      <section class="panel" aria-live="polite"><h2>结果</h2><div class="readout" id="fuOut" style="border:0"></div><p class="panel-note" id="fuNote"></p></section></div>`;
    onAny(body, update);
    update();
    function update() {
      const solve = radio("fu-solve");
      for (const k of ["width", "thickness", "current", "time"]) {
        $(`[data-fld="fu-${k}"]`).classList.toggle("is-computed", k === solve);
        $(`#fu-${k}`).readOnly = k === solve;
      }
      const Tm = num("fu-tm"), Ta = num("fu-ta");
      let W = num("fu-width"), T = num("fu-thickness"), I = num("fu-current"), t = num("fu-time");
      const valid = Tm > Ta && Ta > -273.15 && [W, T, I, t].every((x, i) => ["width", "thickness", "current", "time"][i] === solve || x > 0);
      const note = $("#fuNote");
      if (!valid) { $("#fuOut").innerHTML = tr`<div><span>结果</span><strong>错误</strong></div>`; note.textContent = tr("所有输入需为正数，且熔点高于环境温度。"); note.className = "panel-note err"; return; }
      const energy = 8940 * ((Tm - Ta) * 385 + 205350);
      const R = (((Ta + 273.15 - 293) * 0.00393 + 1) * 1.72e-8 + ((Tm + 273.15 - 293) * 0.00393 + 1) * 1.72e-8) / 2;
      const coeff = energy / R;
      let A = W * T, out;
      if (solve === "width") { A = I / Math.sqrt(coeff / t); W = A / T; setNum("fu-width", W); out = [tr("线宽"), W / Number($("#fu-width-u").value), $("#fu-width-u").selectedOptions[0].textContent]; }
      if (solve === "thickness") { A = I / Math.sqrt(coeff / t); T = A / W; setNum("fu-thickness", T); out = [tr("铜厚"), T / Number($("#fu-thickness-u").value), $("#fu-thickness-u").selectedOptions[0].textContent]; }
      if (solve === "current") { I = A * Math.sqrt(coeff / t); setNum("fu-current", I); out = [tr("熔断电流"), I, "A"]; }
      if (solve === "time") { t = coeff * A * A / I / I; setNum("fu-time", t); out = [tr("熔断时间"), t, "s"]; }
      $("#fuOut").innerHTML = `<div class="primary"><span>${out[0]}</span><strong>${fmtOut(out[1])}<small>${out[2]}</small></strong></div>`;
      // Validity domain (adam-research TRM white paper 10): radiative time constant.
      const r = Math.sqrt(A / Math.PI), tmK = Tm + 273.15;
      const tau = 385 * 8940 * r / (5.67e-8 * 0.5 * 0.5 * (tmK + 293) ** 3 * 2);
      const long = 2 * t >= tau;
      note.textContent = long ? tr("熔断时间较长，散热不可忽略，计算的电流偏小（保守）。") : tr("绝热假设成立：熔断时间远小于导体的散热时间常数。");
      note.className = `panel-note${long ? " warn" : ""}`;
    }
  },
};

/* =============== 线缆尺寸 (PANEL_CABLE_SIZE) =============== */
const AWG = [["AWG0000", 0.005842], ["AWG000", 0.00520192], ["AWG00", 0.00463296], ["AWG0", 0.00412623], ["AWG1", 0.00367411], ["AWG2", 0.00327152], ["AWG3", 0.00291338], ["AWG4", 0.00259461], ["AWG5", 0.00231013], ["AWG6", 0.0020574], ["AWG7", 0.00183261], ["AWG8", 0.00163195], ["AWG9", 0.00145288], ["AWG10", 0.00129413], ["AWG11", 0.00115189], ["AWG12", 0.00102616], ["AWG13", 0.0009144], ["AWG14", 0.00081407], ["AWG15", 0.00072517], ["AWG16", 0.00064516], ["AWG17", 0.00057531], ["AWG18", 0.00051181], ["AWG19", 0.00045593], ["AWG20", 0.0004046], ["AWG21", 0.00036195], ["AWG22", 0.00032258], ["AWG23", 0.00028702], ["AWG24", 0.00025527], ["AWG25", 0.00022773], ["AWG26", 0.00020193], ["AWG27", 0.00018034], ["AWG28", 0.00016002], ["AWG29", 0.00014351], ["AWG30", 0.000127]];
const MU0 = 1.256637e-6;
const cable = {
  id: "cable", title: tr("线缆尺寸"), cat: tr("电源、电流和隔离"), order: 5,
  desc: tr("圆导体的尺寸、线电阻、载流量和“趋肤深度等于半径”的频率互相联动：改其中任何一项，其余各项随之更新。下方按实际电流和长度计算压降与功耗。"),
  mount(body, { wasm }) {
    body.innerHTML = tr`<div class="cols">
      <section class="panel"><h2>导线</h2><div class="fields two">
        ${field({ id: "cb-awg", type: "select", label: tr("标准线规"), value: "", options: [["", tr("自定义")], ...AWG.map(([n], i) => [i, n])] })}
        ${field({ id: "cb-d", label: tr("直径"), value: 1, unit: "len" })}
        ${field({ id: "cb-area", label: tr("截面积"), value: "", unit: "mm²" })}
        ${field({ id: "cb-linres", label: tr("线电阻"), value: "", unit: "linres" })}
        ${field({ id: "cb-freq", label: tr("趋肤深度 = 半径时的频率"), value: "", unit: "freq", defUnit: "kHz" })}
        ${field({ id: "cb-amp", label: tr("载流量"), value: "", unit: "A" })}
        <div class="fld"><label for="cb-density">电流密度 <span class="sym" id="cb-density-v">3 A/mm²</span></label><input type="range" id="cb-density" min="3" max="12" step="1" value="3" style="accent-color:var(--cu)"></div>
      </div>
      <p class="group-label">导体材料</p><div class="fields two">
        ${field({ id: "cb-rho", label: tr("20 °C 电阻率"), value: 1.72e-8, unit: "Ω·m", pick: "cableRho" })}
        ${field({ id: "cb-temp", label: tr("导体温度"), value: 20, unit: "°C" })}
        ${field({ id: "cb-alpha", label: tr("电阻温度系数"), value: 3.93e-3, unit: "/°C", pick: "cableAlpha" })}
      </div></section>
      <section class="panel"><h2>应用</h2><div class="fields two">
        ${field({ id: "cb-i", label: tr("电流"), value: 1, unit: "A" })}
        ${field({ id: "cb-len", label: tr("长度"), value: 1, unit: "len", defUnit: "m" })}
        ${field({ id: "cb-r", label: tr("直流电阻"), value: "", unit: "Ω" })}
        ${field({ id: "cb-v", label: tr("压降"), value: "", unit: "volt" })}
        ${field({ id: "cb-p", label: tr("功耗"), value: "", unit: "watt" })}
      </div><p class="panel-note">改电阻、压降或功耗会反推所需的导线直径（电流和长度保持不变）。</p></section></div>`;
    wirePickers(body);
    let radius = 0.0005;
    const rhoT = () => num("cb-rho") * (1 + num("cb-alpha") * (num("cb-temp") - 20));
    const density = () => Number($("#cb-density").value) * 1e6;
    body.addEventListener("input", (e) => {
      const id = e.target.id, v = num(id), rho = rhoT(), len = num("cb-len"), I = num("cb-i");
      let r = null;
      if (id === "cb-d") r = v / 2;
      if (id === "cb-area") r = Math.sqrt(v * 1e-6 / Math.PI);
      if (id === "cb-linres") r = Math.sqrt(rho / v / Math.PI);
      if (id === "cb-freq") r = Math.sqrt(rho / v / Math.PI / MU0);
      if (id === "cb-amp") r = Math.sqrt(v / density() / Math.PI);
      if (id === "cb-r") r = Math.sqrt(rho / v * len / Math.PI);
      if (id === "cb-v") r = Math.sqrt(rho / v * len * I / Math.PI);
      if (id === "cb-p") r = Math.sqrt(rho / v * len * I * I / Math.PI);
      if (r !== null) { if (Number.isFinite(r) && r > 0) radius = r; $("#cb-awg").value = ""; }
      print(id);
    });
    body.addEventListener("change", (e) => {
      if (e.target.id === "cb-awg" && e.target.value !== "") radius = AWG[Number(e.target.value)][1] / 2;
      if (e.target.classList.contains("unit")) return;
      print(e.target.id);
    });
    print();
    function print(skip) {
      $("#cb-density-v").textContent = `${$("#cb-density").value} A/mm²`;
      const args = [radius * 2, num("cb-rho"), num("cb-alpha"), num("cb-temp"), density(), 0, num("cb-len"), num("cb-i")];
      const g = (i) => wasm.pcbcalc_cable(i, ...args);
      const put = (id, v) => { if (id !== skip) setNum(id, v); };
      put("cb-d", radius * 2);
      put("cb-area", g(0) * 1e6);
      put("cb-linres", g(1));
      put("cb-freq", g(1) / MU0);
      put("cb-amp", g(2));
      put("cb-r", g(4));
      put("cb-v", g(5));
      put("cb-p", g(6));
    }
  },
};

/* =============== 波长 (PANEL_WAVELENGTH) =============== */
const wavelength = {
  id: "wavelength", title: tr("波长"), cat: tr("高速"), order: 1,
  desc: tr("频率、周期、真空波长和介质中波长互相换算，改任意一项其余自动更新；介质中的传播速度由 εr 和 μr 决定。"),
  formula: "λ = c / (f × √(εr μr))",
  mount(body, { wasm }) {
    body.innerHTML = tr`<div class="cols"><section class="panel"><h2>换算</h2><div class="fields">
        ${field({ id: "wl-f", label: tr("频率"), value: 1, unit: "freq", defUnit: "GHz" })}
        ${field({ id: "wl-t", label: tr("周期"), value: "", unit: "time", defUnit: "ns" })}
        ${field({ id: "wl-l0", label: tr("真空中的波长"), value: "", unit: "len", defUnit: "cm" })}
        ${field({ id: "wl-l", label: tr("介质中的波长"), value: "", unit: "len", defUnit: "cm" })}
        ${field({ id: "wl-v", label: tr("介质中的速度"), value: "", unit: "speed", readonly: true })}
      </div></section>
      <section class="panel"><h2>介质</h2><div class="fields two">
        ${field({ id: "wl-er", label: tr("相对介电常数"), sym: "εr", value: 4.5, pick: "er" })}
        ${field({ id: "wl-mur", label: tr("相对磁导率"), sym: "μr", value: 1 })}
      </div><p class="panel-note">改变 εr / μr 时保持频率不变。</p></section></div>`;
    wirePickers(body);
    let f = 1e9;
    body.addEventListener("input", (e) => {
      const id = e.target.id, v = num(id), c = 299792458, root = Math.sqrt(num("wl-er") * num("wl-mur"));
      let nf = null;
      if (id === "wl-f") nf = v;
      if (id === "wl-t") nf = 1 / v;
      if (id === "wl-l0") nf = c / v;
      if (id === "wl-l") nf = c / v / root;
      if (nf !== null && nf > 0 && Number.isFinite(nf)) f = nf;
      print(id);
    });
    print();
    function print(skip) {
      const er = num("wl-er"), mur = num("wl-mur");
      const g = (i) => wasm.pcbcalc_wavelength(i, f, er, mur);
      const put = (id, v) => { if (id !== skip) setNum(id, v); };
      put("wl-f", f); put("wl-t", g(0)); put("wl-l0", g(1)); put("wl-l", g(2)); setNum("wl-v", g(3));
    }
  },
};

/* =============== RF 衰减器 (attenuator_classes.cpp) =============== */
const ATT = {
  pi: { name: tr("π 型"), formula: "R2 = (L − 1)/2 · √(Zin·Zout/L)，R1 = 1 / (A/Zin − 1/R2)，R3 = 1 / (A/Zout − 1/R2)，L = 10^(dB/10)，A = (L+1)/(L−1)", out: ["R1", "R2", "R3"] },
  tee: { name: tr("T 型"), formula: "R2 = 2√(L·Zin·Zout) / (L − 1)，R1 = Zin·A − R2，R3 = Zout·A − R2", out: ["R1", "R2", "R3"] },
  bridge: { name: tr("桥 T 型"), formula: tr("L = 10^(dB/20)，R1 = Z0·(L − 1)，R2 = Z0 / (L − 1)；另外两只电阻等于 Z0"), out: ["R1", "R2"] },
  splitter: { name: tr("电阻功分器"), formula: tr("R1 = R2 = R3 = Z0 / 3，固定 6 dB"), out: ["R1", "R2", "R3"] },
};
function attSchematic(t) {
  const Rh = (x, y, l) => `<rect class="r" x="${x}" y="${y - 7}" width="40" height="14" rx="2"/><text class="t" x="${x + 20}" y="${y - 12}" text-anchor="middle">${l}</text>`;
  const Rv = (x, y, l) => `<rect class="r" x="${x - 7}" y="${y}" width="14" height="36" rx="2"/><text class="t" x="${x + 12}" y="${y + 22}">${l}</text>`;
  const gnd = (x, y) => `<path class="g" d="M${x - 10} ${y}h20M${x - 6} ${y + 4}h12M${x - 2} ${y + 8}h4"/>`;
  const io = `<circle class="r" cx="16" cy="40" r="4"/><circle class="r" cx="284" cy="40" r="4"/><text class="t" x="10" y="26">IN</text><text class="t" x="268" y="26">OUT</text><path class="w" d="M20 110H280"/>`;
  let d = "";
  if (t === "pi") d = `<path class="w" d="M20 40H130M170 40H280M70 40V58M70 94V110M230 40V58M230 94V110"/>${Rh(130, 40, "R2")}${Rv(70, 58, "R1")}${Rv(230, 58, "R3")}`;
  if (t === "tee") d = `<path class="w" d="M20 40H70M110 40H190M230 40H280M150 40V58M150 94V110"/>${Rh(70, 40, "R1")}${Rh(190, 40, "R3")}${Rv(150, 58, "R2")}`;
  if (t === "bridge") d = `<path class="w" d="M20 40H90M130 40H170M210 40H280M60 40V18H130M170 18H240V40M150 40V58M150 94V110"/>${Rh(90, 40, "Z0")}${Rh(170, 40, "Z0")}${Rh(130, 18, "R1")}${Rv(150, 58, "R2")}`;
  if (t === "splitter") d = `<path class="w" d="M20 40H60M100 40H150V20H200M240 20H270V40H280M150 40V70H200M240 70H284"/>${Rh(60, 40, "R1")}${Rh(200, 20, "R2")}${Rh(200, 70, "R3")}<circle class="r" cx="284" cy="70" r="4"/>`;
  return tr`<svg class="schem" viewBox="0 0 300 124" role="img" aria-label="${ATT[t].name}衰减器电路">${t === "splitter" ? `<circle class="r" cx="16" cy="40" r="4"/><circle class="r" cx="284" cy="40" r="4"/><text class="t" x="10" y="26">IN</text><text class="t" x="250" y="108">OUT ×2</text>` : io}${d}${t !== "splitter" ? gnd(t === "pi" ? 70 : 150, 112) : ""}</svg>`;
}
const attenuator = {
  id: "attenuator", title: tr("RF 衰减器"), cat: tr("高速"), order: 2,
  desc: tr("π 型、T 型、桥 T 型衰减器和电阻功分器的电阻值合成。输入输出阻抗不同时，衰减不能低于匹配所需的最小值。"),
  mount(body, { wasm }) {
    body.innerHTML = tr`<div class="cols">
      <section class="panel"><h2>拓扑与指标</h2>
        <div style="margin-bottom:14px">${seg("at-top", Object.entries(ATT).map(([k, v]) => [k, v.name]), "pi")}</div>
        <div id="atSchem"></div>
        <div class="fields two" style="margin-top:12px">
          ${field({ id: "at-att", label: tr("衰减"), value: 6, unit: "dB" })}
          ${field({ id: "at-zin", label: tr("输入阻抗 Zin"), value: 50, unit: "Ω" })}
          ${field({ id: "at-zout", label: tr("输出阻抗 Zout"), value: 50, unit: "Ω" })}
        </div><p class="formula" id="atFormula"></p></section>
      <section class="panel" aria-live="polite"><h2>电阻值</h2><div class="results" id="atOut"></div><p class="panel-note" id="atNote"></p></section></div>`;
    onAny(body, update);
    update();
    function update() {
      const top = radio("at-top"), t = Object.keys(ATT).indexOf(top);
      $("#atSchem").innerHTML = attSchematic(top);
      $("#atFormula").textContent = ATT[top].formula;
      const zinF = $("#at-zin"), attF = $("#at-att");
      zinF.readOnly = top === "bridge" || top === "splitter";
      attF.readOnly = top === "splitter";
      $('[data-fld="at-zin"]').classList.toggle("is-computed", zinF.readOnly);
      $('[data-fld="at-att"]').classList.toggle("is-computed", attF.readOnly);
      const zout = num("at-zout");
      if (zinF.readOnly) setNum("at-zin", zout);
      if (attF.readOnly) setNum("at-att", 6);
      const zin = num("at-zin"), att = num("at-att");
      const minAtt = wasm.pcbcalc_attenuator(t, 3, zin, zout, att);
      const vals = ATT[top].out.map((n, i) => [n, wasm.pcbcalc_attenuator(t, i, zin, zout, att), "Ω", "hl"]);
      const note = $("#atNote");
      if (top !== "splitter" && minAtt > att) {
        $("#atOut").innerHTML = rows(ATT[top].out.map((n) => [n, "—", ""]));
        note.textContent = tr`衰减过小：Zin 与 Zout 匹配至少需要 ${fmtOut(minAtt, 4)} dB。`;
        note.className = "panel-note err";
      } else {
        $("#atOut").innerHTML = rows(vals);
        note.textContent = top === "splitter" ? tr("三端口各自匹配到 Z0，每个输出比输入低 6 dB。") : Math.abs(zin - zout) > 1e-9 ? tr`阻抗匹配所需的最小衰减：${fmtOut(minAtt, 4)} dB。` : "";
        note.className = "panel-note";
      }
    }
  },
};

/* =============== E 系列 (PANEL_ESERIES_DISPLAY) =============== */
const eseries = {
  id: "eseries", title: tr("E 系列"), cat: tr("备忘录"), order: 1,
  desc: tr("IEC 60063 优选数。数值为一个十倍程内的三位有效数字，乘以 10ⁿ 得到实际阻值或容值；每个格子覆盖的行数表示它在该系列中的取值区间。"),
  mount(body, { ref }) {
    const e192 = ref.e192, e96 = e192.filter((_, i) => i % 2 === 0), e24 = ref.e24;
    // Column colours from panel_eseries_display.h (s_cE*BGR), alternate cells lightened as in KiCad.
    const cell = (v, span, col, alt) => `<td rowspan="${span}" class="es es-${col}${alt ? " alt" : ""}">${v}</td>`;
    // E1 / E3 / E6 / E12: one row per E12 value.
    let small = `<table class="eseries"><thead><tr><th>E1</th><th>E3</th><th>E6</th><th>E12</th></tr></thead><tbody>`;
    for (let i = 0; i < 12; i++) {
      small += "<tr>";
      if (i === 0) small += cell(e24[0], 12, "e1", false);
      if (i % 4 === 0) small += cell(e24[i * 2], 4, "e3", (i / 4) % 2 === 1);
      if (i % 2 === 0) small += cell(e24[i * 2], 2, "e6", (i / 2) % 2 === 1);
      small += cell(e24[i * 2], 1, "e12", i % 2 === 1);
      small += "</tr>";
    }
    small += "</tbody></table>";
    // E24 / E48 / E96 laid out in four blocks of 24 E96 rows, like KiCad.
    const block = (b) => {
      let t = `<table class="eseries"><thead><tr><th>E24</th><th>E48</th><th>E96</th></tr></thead><tbody>`;
      for (let r = 0; r < 24; r++) {
        const i = b * 24 + r;
        t += "<tr>";
        if (i % 4 === 0) t += cell(e24[i / 4], 4, "e24", (i / 4) % 2 === 1);
        if (i % 2 === 0) t += cell(e96[i], 2, "e48", (i / 2) % 2 === 1);
        t += cell(e96[i], 1, "e96", i % 2 === 1);
        t += "</tr>";
      }
      return `${t}</tbody></table>`;
    };
    let big192 = `<table class="eseries"><thead><tr><th>E192</th><th>E192</th><th>E192</th><th>E192</th></tr></thead><tbody>`;
    for (let r = 0; r < 48; r++) big192 += `<tr>${[0, 1, 2, 3].map((b) => `<td>${e192[b * 48 + r]}</td>`).join("")}</tr>`;
    big192 += "</tbody></table>";
    body.innerHTML = tr`<div class="eseries-wrap">
        <section class="panel"><h2>E24、E48、E96 <span class="sub">±5 % · ±2 % · ±1 %</span></h2><div class="table-wrap es-blocks">${[0, 1, 2, 3].map(block).join("")}</div></section>
        <section class="panel"><h2>E1、E3、E6、E12 <span class="sub">±20 % 以上 · ±10 %</span></h2><div class="table-wrap es-blocks">${small}</div></section>
      </div>
      <section class="panel"><h2>怎么选值</h2>
        <p class="panel-note" style="margin-top:0">无源元件通常按精度选用对应的 E 系列：电容常用 E12；±10 % 和 ±5 % 电阻常用 E24；±1 % 电阻用 E96；其他系列不常用。</p>
        <p class="panel-note">选值时，把计算出的目标值四舍五入：E24 及以下保留 2 位有效数字，E48 及以上保留 3 位；再在表中找最接近的数替换这几位。例如目标 16,834.2 Ω 取 3 位为 16,800 Ω，E96 中最接近 168 的是 169，所以选 16.9 kΩ。</p>
        <p class="panel-note">0 是特例，不属于任何系列。</p>
        <details class="more"><summary>E192（±0.5 % 及以上精度）</summary><div class="table-wrap es-blocks" style="margin-top:10px">${big192}</div></details>
      </section>`;
  },
};

/* =============== 色环 (PANEL_COLOR_CODE) =============== */
const BANDS = [
  [tr("黑"), "#1c1c1c", 0, 1, null], [tr("棕"), "#7a4a24", 1, 10, 1], [tr("红"), "#c8302a", 2, 100, 2], [tr("橙"), "#e8812b", 3, 1e3, null],
  [tr("黄"), "#f2cf2e", 4, 1e4, null], [tr("绿"), "#2f8f46", 5, 1e5, 0.5], [tr("蓝"), "#2f5fb8", 6, 1e6, 0.25], [tr("紫"), "#7b3fa6", 7, 1e7, 0.1],
  [tr("灰"), "#8c8c8c", 8, 1e8, 0.05], [tr("白"), "#f4f4f4", 9, 1e9, null], [tr("金"), "#c9a13b", null, 0.1, 5], [tr("银"), "#b8bcc2", null, 0.01, 10],
];
const ohm = (v) => v >= 1e6 ? `${fmtOut(v / 1e6, 4)} MΩ` : v >= 1e3 ? `${fmtOut(v / 1e3, 4)} kΩ` : `${fmtOut(v, 4)} Ω`;
const color = {
  id: "color", title: tr("色环电阻"), cat: tr("备忘录"), order: 2,
  desc: tr("容差 ±5 % 或 ±10 % 的电阻用 2 位有效数字（4 环）；容差 ≤ ±2 % 的用 3 位有效数字（5 环）。选择各环颜色即可读出阻值。"),
  mount(body) {
    const opt = (filter, def) => BANDS.map((b, i) => [i, b]).filter(([, b]) => filter(b)).map(([i, b]) => `<option value="${i}" ${i === def ? "selected" : ""}>${b[0]}${b[2] !== null && filter === digitF ? ` ${b[2]}` : ""}</option>`).join("");
    const digitF = (b) => b[2] !== null;
    body.innerHTML = tr`<div class="cols">
      <section class="panel"><h2>读色环</h2>
        <div style="margin-bottom:14px">${seg("cc-mode", [["4", tr("4 环（±5 % / ±10 %）")], ["5", tr("5 环（≤ ±2 %）")]], "4")}</div>
        <svg class="resistor" viewBox="0 0 420 90" id="ccSvg" role="img" aria-label="电阻色环示意"></svg>
        <div class="fields two" style="margin-top:12px">
          ${[tr("第 1 位"), tr("第 2 位"), tr("第 3 位")].map((l, i) => `<div class="fld" data-fld="cc-d${i}"><label for="cc-d${i}">${l}</label><div class="ctl select-only"><select id="cc-d${i}">${opt(digitF, [4, 7, 0][i])}</select></div></div>`).join("")}
          <div class="fld"><label for="cc-m">倍率</label><div class="ctl select-only"><select id="cc-m">${BANDS.map((b, i) => `<option value="${i}" ${i === 2 ? "selected" : ""}>${b[0]} ×${fmtG(b[3])}</option>`).join("")}</select></div></div>
          <div class="fld"><label for="cc-t">容差</label><div class="ctl select-only"><select id="cc-t"></select></div></div>
        </div></section>
      <section class="panel" aria-live="polite"><h2>阻值</h2><div class="readout" id="ccOut" style="border:0"></div>
        <p class="group-label">色码表</p>
        <div class="table-wrap"><table class="data"><thead><tr><th>颜色</th><th>数字</th><th>倍率</th><th>容差</th></tr></thead><tbody>
        ${BANDS.map(([n, c, d, m, t]) => `<tr><td class="txt"><span class="swatch" style="background:${c}"></span>${n}</td><td>${d ?? "—"}</td><td>×${fmtG(m)}</td><td>${t ? `±${t} %` : "—"}</td></tr>`).join("")}
        </tbody></table></div></section></div>`;
    onAny(body, update);
    update();
    function update(e) {
      const five = radio("cc-mode") === "5";
      $('[data-fld="cc-d2"]').hidden = !five;
      const tsel = $("#cc-t");
      if (!e || e.target.name === "cc-mode") {
        const allowed = BANDS.map((b, i) => [i, b]).filter(([, b]) => b[4] !== null && (five ? b[4] <= 2 : b[4] >= 5));
        tsel.innerHTML = allowed.map(([i, b]) => `<option value="${i}">${b[0]} ±${b[4]} %</option>`).join("");
      }
      const d = [0, 1, 2].map((i) => BANDS[Number(val(`cc-d${i}`))]);
      const m = BANDS[Number(val("cc-m"))], t = BANDS[Number(tsel.value)];
      const digits = five ? d[0][2] * 100 + d[1][2] * 10 + d[2][2] : d[0][2] * 10 + d[1][2];
      const value = digits * m[3];
      const bands = [...(five ? d : d.slice(0, 2)), m, t];
      const xs = five ? [120, 160, 200, 240, 310] : [130, 175, 220, 310];
      $("#ccSvg").innerHTML = `<line class="lead" x1="10" y1="45" x2="410" y2="45"/><rect class="body" x="90" y="15" width="250" height="60" rx="26"/>${bands.map((b, i) => `<rect x="${xs[i]}" y="${i === bands.length - 1 ? 17 : 16}" width="16" height="${i === bands.length - 1 ? 56 : 58}" fill="${b[1]}"/>`).join("")}`;
      $("#ccOut").innerHTML = tr`<div class="primary"><span>标称值</span><strong>${ohm(value)}</strong></div><div><span>容差 ±${t[4]} %</span><strong style="font-size:1.05rem">${ohm(value * (1 - t[4] / 100))} … ${ohm(value * (1 + t[4] / 100))}</strong></div>`;
    }
  },
};

/* =============== 电路板类别 (PANEL_BOARD_CLASS) =============== */
const board = {
  id: "board", title: tr("电路板类别"), cat: tr("备忘录"), order: 3,
  desc: tr("按制造精度划分的 1 – 6 级电路板最小尺寸。“—” 表示该级别未规定。"),
  mount(body, { ref }) {
    body.innerHTML = tr`<section class="panel"><div class="fields two" style="max-width:260px;margin-bottom:14px">
      <div class="fld"><label for="bc-u">显示单位</label><div class="ctl select-only"><select id="bc-u">${lenUnitOptions("mm")}</select></div></div></div>
      <div class="table-wrap"><table class="data"><thead><tr><th>项目</th>${[1, 2, 3, 4, 5, 6].map((x) => `<th>${locale === "en" ? `Class ${x}` : `${x} 级`}</th>`).join("")}</tr></thead><tbody id="bcBody"></tbody></table></div></section>`;
    const update = () => {
      const s = Number(val("bc-u")) / 1e-3;
      $("#bcBody").innerHTML = ref.board.map(([n, ...v]) => `<tr><td class="txt">${tr(n)}</td>${v.map((x) => `<td class="${x == null ? "dim" : ""}">${x == null ? "—" : fmtG(x / s, 4)}</td>`).join("")}</tr>`).join("");
    };
    onAny(body, update);
    update();
  },
};

/* =============== 电偶腐蚀 (PANEL_GALVANIC_CORROSION) =============== */
const galvanic = {
  id: "galvanic", title: tr("电偶腐蚀"), cat: tr("备忘录"), order: 4,
  desc: tr("两种金属接触时的电位差（mV，行减列）。差值越大，较活泼的一方越容易被腐蚀；超过阈值的格子按正负着色。"),
  mount(body, { ref }) {
    body.innerHTML = tr`<section class="panel"><div class="fields two" style="max-width:560px;margin-bottom:14px">
        ${field({ id: "gc-th", label: tr("着色阈值"), value: 0, unit: "mV" })}
        <div class="fld"><span class="lbl">材料显示为</span>${seg("gc-names", [["sym", tr("化学符号")], ["name", tr("名称")]], "sym")}</div>
      </div>
      <div class="table-wrap tall"><table class="matrix" id="gcTable"></table></div>
      <p class="panel-note">电位相对标准氢电极。蓝色：行材料电位高于列（行为阴极）；橙色：行材料更活泼、易被腐蚀；实际风险还取决于面积比、电解质和表面处理。</p></section>`;
    const update = () => {
      const th = Number.isFinite(num("gc-th")) ? num("gc-th") : 0;
      const nm = (m) => (radio("gc-names") === "name" ? m.name : m.symbol);
      const M = ref.metals;
      let h = `<thead><tr><th class="corner"></th>${M.map((m) => `<th scope="col" title="${esc(m.name)}">${esc(nm(m))}</th>`).join("")}</tr></thead><tbody>`;
      for (const a of M) {
        h += `<tr><th scope="row" title="${esc(a.name)}">${esc(nm(a))}</th>`;
        for (const b of M) {
          const diff = a.potential - b.potential, mv = Math.round(diff * 1000);
          const pct = Math.min(60, 12 + Math.abs(diff) * 70);
          const bg = diff === 0 ? "color-mix(in srgb, var(--gal-zero) 70%, var(--surface))" : Math.abs(mv) > th ? `color-mix(in srgb, ${diff > 0 ? "var(--gal-pos)" : "var(--gal-neg)"} ${pct}%, var(--surface))` : "transparent";
          h += `<td style="background:${bg}" title="${esc(`${a.name} − ${b.name}`)}">${mv}</td>`;
        }
        h += "</tr>";
      }
      $("#gcTable").innerHTML = `${h}</tbody>`;
    };
    onAny(body, update);
    update();
  },
};

export const PAGES = [regulator, resistor, spacing, via, track, fusing, cable, wavelength, attenuator, eseries, color, board, galvanic];
