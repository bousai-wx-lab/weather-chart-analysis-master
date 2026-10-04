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
// The Japan-relevant branches stay separate and never reverse direction.
const analysis=require('../analysis.js');
assert.equal(data.panels[0].troughs.length,4);assert.equal(data.panels[0].ridges.length,2);
assert.equal(data.panels[1].troughs.length,1);assert.equal(data.panels[1].ridges.length,0);
for (const [i,panel] of data.panels.entries()) for (const axis of [...panel.troughs,...panel.ridges]) {
 assert.ok(axis.height_crossings.length>=2);
 assert.ok(axis.height_crossings.every(c=>![3347,3351,11508,11510].includes(c.height_path)));
 for (const seg of analysis.isothermSegments(axis.points)) for (const dim of [0,1]) {
  const delta=axis.points.at(-1)[dim]-axis.points[0][dim];
  assert.ok((seg.c1[dim]-seg.start[dim])*delta>=0 && (seg.c2[dim]-seg.c1[dim])*delta>=0 && (seg.end[dim]-seg.c2[dim])*delta>=0);
 }
 const restored=structuredClone(data);restored.panels[i].troughs.push(structuredClone(panel.troughs[0]));assert.throws(()=>low.validate(restored,selected));
 const substituted=structuredClone(data);substituted.panels[i].troughs[0].height_crossings[0].height_path=i?11508:3347;assert.throws(()=>low.validate(substituted,selected));
}
const bent=structuredClone(data);bent.panels[0].troughs[2].points=[[1400,500],[1420,600],[1390,700]];assert.throws(()=>low.validate(bent,selected));
const remote=structuredClone(data);remote.panels[0].ridges[0].points[0][1]=180;assert.throws(()=>low.validate(remote,selected));
console.log("LOW_LEVEL_TESTS_OK fixed_time_and_source_bound wet_isotherms_symbols_troughs cold_boundaries_missing_fail_closed");
