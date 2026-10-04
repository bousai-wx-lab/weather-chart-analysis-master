"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const low=require("../low-level.js"),catalog=require("../catalog.js");
const data=JSON.parse(fs.readFileSync(path.join(root,"aupq78-analysis.json")));
const c=catalog.validate(JSON.parse(fs.readFileSync(path.join(root,"chart-catalog.json"))));
const selected=catalog.selection(c,"aupq78","aupq78-00",1);
assert.equal(low.validate(data,selected),data);
assert.throws(()=>low.validate(data,catalog.selection(c,"aupq78","aupq78-12",1)));
assert.throws(()=>low.validate(data,catalog.selection(c,"aupq35","aupq35-reviewed",1)));
for(const change of [d=>d.source_sha256="0".repeat(64),d=>d.image_sha256="0".repeat(64),d=>d.observation_time="2026-10-03T00:00:00Z",d=>d.width=1024,d=>d.panels[0].pressure_hpa=850,d=>d.panels[1].levels[0].temperature_c=-9,d=>d.panels[1].levels[0].lines[0].points[0]=[0,0],d=>d.panels[1].wet_rectangles[0]=[50,0,100,100],d=>d.symbols[0].letter="X",d=>d.panels[0].troughs[0].height_crossings[0].point=[0,0]]) {const altered=structuredClone(data);change(altered);assert.throws(()=>low.validate(altered,selected));}
for(const threshold of [0,-3,-6]) {
 const rings=low.coldRings(data.panels[1],threshold);assert.ok(rings.length);
 for(const ring of rings)assert.ok(ring.every(p=>p[1]>=1537.68&&p[1]<=2858));
}
assert.deepEqual(low.coldRings(data.panels[1],-9),[]);assert.deepEqual(low.coldRings(data.panels[1],-12),[]);
for(const threshold of [-15,-18,-21,-24,-27])assert.deepEqual(low.coldRings(data.panels[0],threshold),[]);
assert.equal(data.symbols.length,45);
console.log("LOW_LEVEL_TESTS_OK fixed_time_and_source_bound wet_isotherms_symbols_troughs cold_boundaries_missing_fail_closed");
