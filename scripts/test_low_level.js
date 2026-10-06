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
assert.equal(data.panels[1].troughs.length,3);assert.equal(data.panels[1].ridges.length,2);
for (const [i,panel] of data.panels.entries()) for (const axis of [...panel.troughs,...panel.ridges]) {
 if(i===1) {assert.equal(axis.review,"user-drawn fixed-source branch");continue;}
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

const invalidS=structuredClone(data);invalidS.panels[1].troughs[2].points=[[1500,1900],[1540,1950],[1500,2000],[1540,2050]];assert.throws(()=>low.validate(invalidS,selected));
assert.ok(data.panels[1].troughs.every(a=>a.points.every(p=>p[1]<2240)));

// Independent geometric cases: a warm strip, separated sides, and a cold hole.
const bandContains=(rings,[x,y])=>rings.reduce((odd,ring)=>ring.reduce((hit,a,i)=>{
 const b=ring[(i+1)%ring.length];return (a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]?!hit:hit;
},odd),false);
const contour=(points,closed=false)=>({points,closed});
const lev=(temperature_c,...lines)=>({temperature_c,lines});
const thermal=levels=>({pressure_hpa:850,bounds:[0,0,400,400],levels});
const stripe=thermal([lev(12,contour([[100,0],[100,400]]),contour([[300,0],[300,400]])),lev(9,contour([[30,30],[30,370]]),contour([[370,30],[370,370]])),lev(15,contour([[200,30],[200,370]]))]);
const stripRings=low.warmRings(stripe,12);
assert.equal(bandContains(stripRings,[200,200]),true);assert.equal(bandContains(stripRings,[50,200]),false);assert.equal(bandContains(stripRings,[350,200]),false);
const square=(a,b)=>contour([[a,a],[b,a],[b,b],[a,b]],true);
const island=thermal([lev(12,square(100,300),square(160,240)),lev(15,contour([[120,120],[140,140]])),lev(9,contour([[30,30],[50,50]]),contour([[190,190],[210,210]]))]);
const islands=low.warmRings(island,12);
assert.equal(bandContains(islands,[130,130]),true);assert.equal(bandContains(islands,[200,200]),false);assert.equal(bandContains(islands,[50,50]),false);
assert.deepEqual(low.warmRings(stripe,24),[]);
assert.deepEqual(low.warmRings(thermal([lev(12,contour([[100,100],[100,300]])),lev(15,contour([[200,50],[200,350]]))]),12),[]);
// Source dashes stop just before the frame: preserve the warm strip, but do
// not promote an interior break or an inward-facing endpoint to a boundary.
const nativeTrace={method:"native_regular_dash_connectivity",unassigned_groups:0,dash_length_px:6,numeric_label_font_px:24};
const inset=structuredClone(stripe);inset.temperature_trace=nativeTrace;
inset.levels[0].lines=inset.levels[0].lines.map(line=>({...line,points:line.points.map(([x,y])=>[x,y===0?25:375])}));
const insetRings=low.warmRings(inset,12);
assert.equal(bandContains(insetRings,[200,390]),true);assert.equal(bandContains(insetRings,[50,390]),false);
assert.equal(bandContains(insetRings,[350,390]),false);
const broken=thermal([lev(12,contour([[100,100],[100,300]])),lev(15,contour([[200,50],[200,350]]))]);broken.temperature_trace=nativeTrace;
assert.deepEqual(low.warmRings(broken,12),[]);
const inward=structuredClone(inset);inward.levels[0].lines[0].points=[[100,25],[100,0],[100,375]];
assert.deepEqual(low.warmRings(inward,12),[]);
// Actual FEAS regression: the 21 C band reaches the southern frame between
// two open contours, while the colder side and the northern cold area stay out.
const feas=JSON.parse(fs.readFileSync(path.join(root,"assets/analysis/feas50-12-20261005.json"))).panels[1];
const warm21=low.warmRings(feas,21);
assert.equal(bandContains(warm21,[450,2400]),true);
assert.equal(bandContains(warm21,[480,2460]),true);
assert.equal(bandContains(warm21,[200,2350]),false);
assert.equal(bandContains(warm21,[1450,2200]),false);
assert.equal(bandContains(warm21,[1150,1800]),false);
assert.equal(low.temperatureColor(850,24),"#8b3fc7");assert.equal(low.temperatureColor(700,15),"#8b3fc7");
assert.equal(low.temperatureColor(850,-24),"#6f2da8");assert.equal(low.temperatureColor(700,-36),"#6f2da8");
assert.equal(low.temperatureColor(850,0),low.temperatureColor(700,0));
assert.deepEqual(low.warmThresholds,[9,12,15,18,21,24]);
console.log("WARM_GRADIENT_TESTS_OK warm_side_cold_hole_missing_incomplete_boundaries_plane_endpoints");
