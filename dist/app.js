/* LayerLine · KiCad PCB Calculator web UI – shell, units and form helpers.
 * SPDX-License-Identifier: GPL-3.0-or-later */

export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];

/* ---------- units (scale to SI) ---------- */
export const UNITS = {
  len: [["mm", 1e-3], ["µm", 1e-6], ["cm", 1e-2], ["m", 1], ["mil", 2.54e-5], ["inch", 0.0254]],
  freq: [["Hz", 1], ["kHz", 1e3], ["MHz", 1e6], ["GHz", 1e9]],
  time: [["s", 1], ["ms", 1e-3], ["µs", 1e-6], ["ns", 1e-9], ["ps", 1e-12]],
  angle: [["rad", 1], ["°", Math.PI / 180]],
  linres: [["Ω/m", 1], ["Ω/km", 1e-3], ["Ω/ft", 1 / 0.3048], ["Ω/kft", 1 / 304.8]],
  speed: [["m/s", 1], ["km/s", 1e3], ["c", 299792458]],
  volt: [["V", 1], ["mV", 1e-3]],
  watt: [["W", 1], ["mW", 1e-3]],
};

/* ---------- number formatting ---------- */
export function fmtG(v, p = 6) {
  if (!Number.isFinite(v)) return "";
  if (v === 0) return "0";
  const a = Math.abs(v);
  if (a >= 1e7 || a < 1e-4) {
    const [m, e] = v.toExponential(p - 1).split("e");
    return `${String(Number(m))}e${Number(e)}`;
  }
  return String(Number(v.toPrecision(p)));
}
export function fmtOut(v, p = 6) {
  if (!Number.isFinite(v)) return "—";
  if (v === 0) return "0";
  const a = Math.abs(v);
  if (a >= 1e9 || a < 1e-4) {
    const [m, e] = v.toExponential(p - 1).split("e");
    return `${Number(m)}×10${sup(Number(e))}`;
  }
  const s = String(Number(v.toPrecision(p)));
  return a >= 1e4 ? Number(s).toLocaleString("en-US", { maximumFractionDigits: 6 }) : s;
}
const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
const sup = (n) => String(n).split("").map((c) => SUP[c] ?? c).join("");
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/* ---------- fields ----------
 * spec: { id, label, sym, value, unit (UNITS key or literal), defUnit, pick, readonly, type, options, radio }
 * value is expressed in defUnit (or the literal unit). */
export function field(s) {
  const lbl = `<label for="${s.id}">${esc(s.label)}${s.sym ? ` <span class="sym">${esc(s.sym)}</span>` : ""}${s.radio ? `<span class="radio-inline"><input type="radio" name="${s.radio.name}" value="${s.radio.value}" ${s.radio.checked ? "checked" : ""} id="${s.id}-sel" aria-label="合成时求解 ${esc(s.label)}"><span>合成求解</span></span>` : ""}</label>`;
  if (s.type === "select") {
    return `<div class="fld" data-fld="${s.id}">${lbl}<div class="ctl select-only"><select id="${s.id}">${s.options.map(([v, l]) => `<option value="${v}" ${String(v) === String(s.value) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></div></div>`;
  }
  if (s.type === "check") {
    return `<div class="fld" data-fld="${s.id}"><label class="check"><input type="checkbox" id="${s.id}" ${s.value ? "checked" : ""}>${esc(s.label)}</label></div>`;
  }
  let unit = "";
  const kind = UNITS[s.unit];
  if (kind) {
    const def = s.defUnit ?? kind[0][0];
    unit = `<select class="unit" id="${s.id}-u" aria-label="${esc(s.label)} 单位">${kind.map(([n, k]) => `<option value="${k}" ${n === def ? "selected" : ""}>${n}</option>`).join("")}</select>`;
  } else if (s.unit) {
    unit = `<span class="unit-fixed">${esc(s.unit)}</span>`;
  }
  // Icon button with a hover / focus tooltip; opens the KiCad material list for this field.
  const tip = `从常用材料表选择${esc(s.label)}`;
  const pick = s.pick ? `<button type="button" class="pick pick-icon" data-pick="${s.pick}" data-for="${s.id}" data-tip="${tip}" aria-label="${tip}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 3.5h11M2.5 8h11M2.5 12.5h6.5"/><circle cx="12.5" cy="12.5" r="1.6"/></svg></button>` : "";
  const v = typeof s.value === "number" ? fmtG(s.value) : (s.value ?? "");
  return `<div class="fld${s.readonly ? " is-computed" : ""}" data-fld="${s.id}">${lbl}<div class="ctl"><input id="${s.id}" inputmode="decimal" autocomplete="off" spellcheck="false" value="${esc(v)}" ${s.readonly ? "readonly" : ""}>${pick}${unit}</div></div>`;
}

export function unitScale(id) {
  const u = document.getElementById(`${id}-u`);
  return u ? Number(u.value) : 1;
}
/** Parse the field, accepting "," as decimal separator. Returns SI value or NaN. */
export function num(id) {
  const el = document.getElementById(id);
  if (!el) return NaN;
  const raw = el.value.trim().replace(",", ".");
  if (raw === "") return NaN;
  const v = Number(raw);
  return Number.isFinite(v) ? v * unitScale(id) : NaN;
}
export function setNum(id, si, p = 6) {
  const el = document.getElementById(id);
  if (!el || document.activeElement === el && !el.readOnly) return;
  el.value = Number.isFinite(si) ? fmtG(si / unitScale(id), p) : "错误";
}
export function val(id) {
  const el = document.getElementById(id);
  if (!el) return undefined;
  return el.type === "checkbox" ? el.checked : el.value;
}
export function setFieldState(id, state) {
  const f = document.querySelector(`[data-fld="${id}"]`);
  if (!f) return;
  f.classList.toggle("st-warn", state === 1);
  f.classList.toggle("st-err", state === 2);
}

/** Wire unit selectors so switching units rescales the displayed number instead of changing the physical value. */
export function wireUnits(root) {
  for (const sel of $$("select.unit", root)) {
    if (sel.dataset.wired) continue;
    sel.dataset.wired = "1";
    sel.dataset.prev = sel.value;
    sel.addEventListener("change", () => {
      const id = sel.id.slice(0, -2);
      const input = document.getElementById(id);
      const prev = Number(sel.dataset.prev);
      const v = Number(input.value.replace(",", "."));
      if (input.value.trim() !== "" && Number.isFinite(v)) input.value = fmtG((v * prev) / Number(sel.value));
      sel.dataset.prev = sel.value;
      sel.dispatchEvent(new CustomEvent("unit-rescaled", { bubbles: true }));
    });
  }
}

/* ---------- results ---------- */
export function rows(list) {
  return list.map(([k, v, u, cls]) => {
    const text = typeof v === "number" ? fmtOut(v) : v;
    const na = text === "—";
    return `<div class="row${cls ? ` ${cls}` : ""}"><span class="k">${esc(k)}</span><span class="v${na ? " na" : ""}">${esc(text)}${u && !na ? `<small>${esc(u)}</small>` : ""}</span></div>`;
  }).join("");
}

/* ---------- material pickers (KiCad common_data.cpp) ---------- */
export const PICK_LISTS = {
  er: { title: "相对介电常数 εr", items: [["4.5", "FR4"], ["3.67", "Isola FR408"], ["4.04", "Isola 370HR"], ["3.55", "Rogers RO4003C"], ["3.66", "Rogers R4350B"], ["9.8", "氧化铝 (Al2O3)"], ["3.78", "熔融石英"], ["3.38", "RO4003"], ["2.2", "RT/duroid 5880"], ["10.2", "RT/duroid 6010LM"], ["2.1", "聚四氟乙烯 (PTFE)"], ["4.0", "PVC"], ["2.3", "PE"], ["6.6", "氧化铍 (BeO)"], ["8.7", "氮化铝"], ["11.9", "硅"], ["12.9", "GaAs"]] },
  tand: { title: "介质损耗角正切 tan δ", items: [["0.02", "FR4 @ 1 GHz"], ["0.012", "Isola FR408 @ 2 GHz"], ["0.021", "Isola 370HR @ 2 GHz"], ["0.0027", "Rogers RO4003C @ 10 GHz"], ["0.0021", "Rogers RO4003C @ 2.5 GHz"], ["0.0037", "Rogers RO4350B @ 10 GHz"], ["0.0031", "Rogers RO4350B @ 2.5 GHz"], ["3e-4", "氧化铍 @ 10 GHz"], ["2e-4", "氧化铝 @ 10 GHz"], ["1e-4", "熔融石英 @ 10 GHz"], ["0.002", "RO4003 @ 10 GHz"], ["9e-4", "RT/duroid 5880 @ 10 GHz"], ["2e-4", "PTFE @ 1 MHz"], ["0.05", "PVC @ 1 MHz"], ["2e-4", "PE @ 1 MHz"], ["0.001", "氮化铝 @ 10 GHz"], ["0.015", "硅 @ 10 GHz"], ["0.002", "GaAs @ 10 GHz"]] },
  rho: { title: "电阻率 ρ（Ω·m）", items: [["2.4e-8", "金"], ["1.72e-8", "铜"], ["1.62e-8", "银"], ["12.4e-8", "锡"], ["10.5e-8", "铂"], ["2.62e-8", "铝"], ["6.9e-8", "镍"], ["3.9e-8", "黄铜 (66Cu 34Zn)"], ["9.71e-8", "铁"], ["6.0e-8", "锌"]] },
  cableRho: { title: "导体电阻率（20 °C，Ω·m）", items: [["1.72e-8", "Cu 铜"], ["2.62e-8", "Al 铝"], ["100e-8", "NiCr 镍铬"], ["9.71e-8", "Fe 铁"], ["5.6e-8", "W 钨"]] },
  cableAlpha: { title: "电阻温度系数（/°C）", items: [["3.93e-3", "Cu 铜"], ["4.29e-3", "Al 铝"], ["0.4e-3", "NiCr 镍铬"], ["5e-3", "Fe 铁"], ["4.5e-3", "W 钨"]] },
};
export function wirePickers(root, onPick) {
  for (const b of $$("[data-pick]", root)) {
    b.addEventListener("click", () => {
      const list = PICK_LISTS[b.dataset.pick];
      openPicker(list.title, list.items, (v) => {
        const input = document.getElementById(b.dataset.for);
        input.value = v;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        onPick?.(b.dataset.for);
      });
    });
  }
}
function openPicker(title, items, done) {
  const d = document.createElement("dialog");
  d.className = "picker";
  d.innerHTML = `<div class="picker-head"><span>${esc(title)}</span><button type="button" class="btn ghost" data-close>关闭</button></div><div class="picker-list">${items.map(([v, l]) => `<button type="button" data-v="${esc(v)}"><b>${esc(v)}</b><span>${esc(l)}</span></button>`).join("")}</div>`;
  document.body.append(d);
  d.addEventListener("close", () => d.remove());
  d.querySelector("[data-close]").onclick = () => d.close();
  d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
  for (const b of $$("[data-v]", d)) b.onclick = () => { done(b.dataset.v); d.close(); };
  d.showModal();
}

/* ---------- app shell ---------- */
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};

async function boot() {
  // Status indicator was removed with the header; keep a no-op stand-in so boot() stays simple.
  const state = $("#engineState") ?? { dataset: {}, lastElementChild: {} };
  let wasm, ref;
  try {
    const [wasmResp, refResp] = await Promise.all([fetch("./kicad-transline.wasm?v=1d24384213"), fetch("./kicad-reference-data.json?v=1d24384213")]);
    if (!wasmResp.ok) throw new Error(`kicad-transline.wasm 返回 HTTP ${wasmResp.status}`);
    const { instance } = await WebAssembly.instantiate(await wasmResp.arrayBuffer());
    wasm = instance.exports;
    if (wasm.tl_abi_version() !== 1 || wasm.pcbcalc_abi_version() !== 1) throw new Error("WASM 接口版本与页面不匹配，请重新构建。");
    ref = await refResp.json();
    state.dataset.state = "ready";
    state.lastElementChild.textContent = "计算内核已就绪 · 本地计算";
  } catch (err) {
    state.dataset.state = "error";
    state.lastElementChild.textContent = "计算内核载入失败";
    $("#pageTitle").textContent = "无法载入计算内核";
    $("#pageBody").innerHTML = `<div class="err-box">${esc(err.message)}。请通过 HTTP 服务器打开本页（直接双击 index.html 时浏览器会拦截 WASM）。</div>`;
    return;
  }

  const [{ PAGES, CATEGORIES }, transline] = await Promise.all([import("./pages.js?v=1d24384213"), import("./transline.js?v=1d24384213")]);
  const all = [...PAGES, transline.PAGE];
  const ctx = { wasm, ref };

  $("#sideNav").innerHTML = CATEGORIES.map((c) => `<div class="nav-group"><h2>${c}</h2>${all.filter((p) => p.cat === c).sort((a, b) => a.order - b.order).map((p) => `<a href="#${p.id}" data-page="${p.id}">${p.title}</a>`).join("")}</div>`).join("") +
    // GPL-3.0: keep a way to obtain the corresponding source.
    `<p class="nav-source"><a href="./layerline-kicad-source.tar.gz">GPL-3.0 源码</a></p>`;

  const nav = $("#sideNav"), toggle = $("#navToggle");
  toggle.onclick = () => { const open = !nav.classList.contains("is-open"); nav.classList.toggle("is-open", open); toggle.setAttribute("aria-expanded", String(open)); };

  function show() {
    const id = location.hash.slice(1);
    const page = all.find((p) => p.id === id) ?? all.find((p) => p.id === store.get("layerline.page")) ?? transline.PAGE;
    for (const a of $$("[data-page]", nav)) {
      if (a.dataset.page === page.id) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    }
    $("#pageCat").textContent = page.cat;
    $("#pageTitle").textContent = page.title;
    $("#pageDesc").innerHTML = page.desc + (page.formula ? `<br><span class="formula">${page.formula}</span>` : "");
    document.title = `${page.title} · LayerLine PCB 计算器`;
    // Pages attach listeners to their body; mount each page on a fresh element so none leak across pages.
    const old = $("#pageBody");
    const body = old.cloneNode(false);
    old.replaceWith(body);
    page.mount(body, ctx);
    wireUnits(body);
    store.set("layerline.page", page.id);
    nav.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
  }
  addEventListener("hashchange", () => { show(); $("#main").focus({ preventScroll: true }); scrollTo({ top: 0 }); });
  show();
}

boot();
