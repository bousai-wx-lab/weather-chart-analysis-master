"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,".."),catalog=require("../catalog.js"),dynamics=require("../dynamics.js"),low=require("../low-level.js");
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f))),c=catalog.validate(read("chart-catalog.json"));
for(const [file,id,variant,symbols] of [["axfe578-analysis.json","axfe578","axfe578-00",56],["feas50-analysis.json","feas-feas50","feas50-12",28]]) {
 const d=read(file),s=catalog.selection(c,id,variant,1);assert.equal(dynamics.validate(d,s),d);assert.equal(d.symbols.length,symbols);
 assert.deepEqual(d.panels[1].cold_thresholds,[0,-3,-6,-9,-12]);
 for(const t of d.panels[1].cold_thresholds)assert.ok(low.coldRings(d.panels[1],t).length);
 assert.deepEqual(low.coldRings({...d.panels[1],levels:[]},-12),[]);
 const scale=dynamics.scalesFor(d)[1];assert.equal(scale.pressure_hpa,850);
 for(const [i,t] of low.scales[1].values.entries())assert.equal(scale.colors[scale.values.indexOf(t)],low.scales[1].colors[i]);
 for(const mutate of [x=>x.source_sha256="0".repeat(64),x=>x.image_sha256="0".repeat(64),x=>x.observation_time="2026-10-03T00:00:00Z",x=>x.panels[0].pressure_hpa=850,x=>x.panels[1].levels[0].temperature_c=-15,x=>x.panels[0].troughs[0].points[0]=[0,0]]) {const bad=structuredClone(d);mutate(bad);assert.throws(()=>dynamics.validate(bad,s));}
 if(id==="axfe578") {assert.equal(d.panels[1].vertical_velocity_pressure_hpa,700);const bad=structuredClone(d);bad.panels[1].vertical_velocity_pressure_hpa=850;assert.throws(()=>dynamics.validate(bad,s));assert.throws(()=>dynamics.validate(d,catalog.selection(c,id,"axfe578-12",1)));}
 else {assert.equal(d.panels[1].axis_pressure_hpa,0);assert.equal(d.panels[1].ascent_rectangles,undefined);const bad=structuredClone(d);bad.panels[1].vertical_velocity_pressure_hpa=700;assert.throws(()=>dynamics.validate(bad,s));}
}
console.log("DYNAMICS_TESTS_OK source_time_pressure_labels_and_missing_cold_boundaries");
