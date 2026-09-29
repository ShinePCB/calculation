/* Generate browser reference tables directly from the vendored KiCad snapshot. GPL-3.0-or-later */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const src=path.join(root,"src","kicad","pcb_calculator","pcb_calculator");
const es=await readFile(path.join(src,"eseries.cpp"),"utf8");
const block=name=>es.match(new RegExp(`s_${name}table\\s*=\\s*\\{([\\s\\S]*?)\\}`))[1].match(/\d+/g).map(Number);
const corrosion=await readFile(path.join(src,"calculator_panels","panel_galvanic_corrosion.cpp"),"utf8");
const metals=[]; const rx=/CORROSION_TABLE_ENTRY\(\s*_\(\s*"([^"]+)"\s*\),\s*"([^"]+)"\s*,\s*([-+]?\d+(?:\.\d+)?)\s*\)/g;
for(const m of corrosion.matchAll(rx))metals.push({name:m[1],symbol:m[2],potential:Number(m[3])});
const common=await readFile(path.join(src,"common_data.cpp"),"utf8");
const dielectric=[]; const dielectricBlock=common.match(/StandardRelativeDielectricConstantList\(\)[\s\S]*?\{([\s\S]*?)return list/)[1];
for(const m of dielectricBlock.matchAll(/"([0-9.]+)\s*\\t([^\"]+)"/g))dielectric.push({value:Number(m[1]),name:m[2].trim()});
const board=[
 ["最小走线宽度",.80,.50,.31,.21,.15,.12],
 ["最小走线间距",.68,.50,.31,.21,.15,.12],
 ["最小过孔直径差",null,null,.45,.34,.24,.20],
 ["最小镀通孔焊盘直径差",1.19,.78,.60,.49,.39,.35],
 ["最小非镀通孔焊盘直径差",1.57,1.13,.90,null,null,null]
];
await writeFile(path.join(root,"dist","kicad-reference-data.json"),JSON.stringify({e24:block("e24"),e192:block("e192"),metals,board,dielectric}));
