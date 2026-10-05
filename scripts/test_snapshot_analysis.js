"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const root=path.resolve(__dirname,".."),read=f=>JSON.parse(fs.readFileSync(path.join(root,f)));
global.ChartCatalog=require("../catalog.js");
global.ChartAnalysis=require("../analysis.js");
const snapshot=require("../snapshot-analysis.js"),atlas=require("../geography-atlas.js");
const catalog=ChartCatalog.validate(read("chart-catalog.json")),geo=read("geography-catalog.json"),allow=read("release-allowlist.json");
assert.equal(snapshot.localHost("bousai-wx-lab.github.io"),false);
const straight=[[10,10],[110,10]],double=snapshot.axisSymbol(straight,false),zigzag=snapshot.axisSymbol(straight,true)[0];
assert.equal(double.length,2);assert.deepEqual(double.map(s=>s.map(p=>p[1])),[[5,5],[15,15]]);
assert.equal(zigzag[0][1],10);assert.equal(zigzag.at(-1)[1],10);
assert.ok(zigzag.slice(1,-1).every((p,i)=>p[1]===(i%2?4:16)));
assert.ok(snapshot.crosses([[10,10],[30,30]],[[10,30],[30,10]]));
assert.equal(snapshot.crosses([[10,10],[30,10]],[[10,30],[30,30]]),false);
let recent=0,analyses=0,maps=0;
for(const p of catalog.products)for(const v of p.variants)if(v.id.endsWith("-20261005"))for(const page of v.pages){
  const selected=ChartCatalog.selection(catalog,p.id,v.id,page.number);
  const bytes=fs.readFileSync(path.join(root,page.image_path));
  assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"),page.image_sha256);
  const g=atlas.validate(geo,selected);if(g.panels.length)maps++;
  if(v.analysis_path){
    const raw=fs.readFileSync(path.join(root,v.analysis_path));assert.equal(crypto.createHash("sha256").update(raw).digest("hex"),v.analysis_sha256);
    assert.ok(allow.allowed_files.includes(v.analysis_path));
    const data=snapshot.validate(JSON.parse(raw),selected,"bousai-wx-lab.github.io");
    assert.equal(snapshot.validate(data,selected,"localhost"),data);
    for(const change of [x=>x.source_sha256="0".repeat(64),x=>x.image_sha256="0".repeat(64),x=>x.operationally_approved=true,x=>x.reference_axes_used=true]){const bad=structuredClone(data);change(bad);assert.throws(()=>snapshot.validate(bad,selected,"bousai-wx-lab.github.io"));}
    const local=structuredClone(selected);local.variant.features="experimental-local";local.variant.analysis_path="local-collection/analysis/trial.json";assert.throws(()=>snapshot.validate(data,local,"bousai-wx-lab.github.io"));
    if(data.product==="AXFE578"){const bad=structuredClone(data);bad.panels[1].vertical_velocity_pressure_hpa=850;assert.throws(()=>snapshot.validate(bad,selected,"localhost"));}
    if(data.product==="AUPQ35") {
      const upper=data.panels[0],jets=snapshot.jetAxes(data);
      assert.equal(upper.troughs.length+upper.ridges.length,0);
      assert.equal(jets.length,upper.jet_guides.length);
      assert.ok(jets.every(j=>j.centers.every(c=>c.min_kt>=40)&&j.segments.length>=2));
      assert.deepEqual(upper.wind_bands.map(b=>b.threshold),[40,60,80,100,120]);
      const contains=([x,y],rings)=>rings.reduce((odd,ring)=>ring.reduce((hit,a,i)=>{
        const b=ring[(i+1)%ring.length];
        return (a[1]>y)!==(b[1]>y) && x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0] ? !hit : hit;
      },odd),false);
      const windAt=p=>upper.wind_bands.filter(b=>contains(p,b.rings)).at(-1)?.threshold||0;
      assert.equal(windAt([300,300]),0,"northwest weak wind must remain uncolored");
      assert.equal(windAt([1100,520]),0,"central weak-wind hole must remain uncolored");
      assert.ok(windAt([1000,700])>=80,"southern strong-wind band must remain filled");
      assert.equal(windAt([1800,900]),0,"south of 40kt contour must remain uncolored");
      for(const change of [
        x=>x.panels[0].troughs.push({points:[[100,200],[200,300]]}),
        x=>x.panels[0].ridges.push({points:[[100,200],[200,300]]}),
        x=>x.panels[0].wind_bands[0].threshold=20,
        x=>x.panels[0].wind_bands[0].color="#ffffff",
        x=>x.panels[1].wind_bands=x.panels[0].wind_bands,
        x=>x.panels[0].jet_guides[0].points[0]=[0,0],
        x=>delete x.panels[0].jet_guides
      ]){const bad=structuredClone(data);change(bad);assert.throws(()=>snapshot.validate(bad,selected,"localhost"));}
    }
    analyses++;
  }
  recent++;
}
assert.equal(recent,61);assert.equal(analyses,13);assert.equal(maps,57);
const lowLevel=require("../low-level.js");
function inRing(r,[x,y]){
  let hit=false;
  for(let i=0,j=r.length-1;i<r.length;j=i++){
    const a=r[i],b=r[j];
    if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;
  }return hit;
}
function checkTemperatureSide(panel,band,warmer){
  // Source contours one or more intervals from the boundary must fall on
  // the correct side. This catches a shifted 0 C boundary and warm holes.
  for(const level of panel.levels.filter(l=>l.temperature_c!==band.threshold))for(const line of level.lines)for(const f of [.25,.5,.75]){
    const p=line.points[Math.floor((line.points.length-1)*f)];
    const painted=band.rings.reduce((hit,r)=>hit!==inRing(r,p),false);
    assert.equal(painted,warmer?level.temperature_c>band.threshold:level.temperature_c<band.threshold,`T${panel.forecast_hour} ${band.threshold} C region disagrees with ${level.temperature_c} C source contour`);
  }
}
let forecasts=0;
for(const p of catalog.products.filter(p=>["FXFE5782","FXFE5784","FXFE577"].includes(p.code)))for(const v of p.variants){
  const selected=ChartCatalog.selection(catalog,p.id,v.id,1),raw=fs.readFileSync(path.join(root,v.analysis_path));
  assert.equal(crypto.createHash("sha256").update(raw).digest("hex"),v.analysis_sha256);
  assert.ok(allow.allowed_files.includes(v.analysis_path));
  const data=snapshot.validate(JSON.parse(raw),selected,"bousai-wx-lab.github.io");
  assert.equal(data.color_only,true);
  const four=p.code!=="FXFE577",hours=p.code==="FXFE5782"?[12,24,12,24]:p.code==="FXFE5784"?[36,48,36,48]:[72,72];
  assert.deepEqual(data.panels.map(p=>p.forecast_hour),hours);
  assert.deepEqual(snapshot.displayScales(data).map(s=>s.pressure_hpa),[500,850]);
  assert.deepEqual(snapshot.temperatureEnabled(data,[true,false]),four?[true,true,false,false]:[true,false]);
  assert.deepEqual(snapshot.temperatureEnabled(data,[false,true]),four?[false,false,true,true]:[false,true]);
  for(const panel of data.panels){
    const rects=panel.pressure_hpa===500?panel.wet_rectangles:panel.ascent_rectangles;
    assert.ok(rects.length>100,"Source hatches must produce a filled area");
    // A single meridian or text stroke cannot become a full-height fill column.
    assert.ok(rects.every(r=>r[3]-r[1]<panel.bounds[3]-panel.bounds[1]));
    if(panel.pressure_hpa===850){
      assert.equal(panel.temperature_interval_c,3);
      assert.equal(panel.temperature_label_interval_c,6);
      assert.ok([3,9,15].every(t=>panel.levels.some(l=>l.temperature_c===t)),"Unnumbered native 3 C contours must be decoded");
      assert.deepEqual(panel.cold_thresholds,[0,-3,-6,-9,-12]);
      assert.ok(panel.cold_bands.length>0);
      assert.ok(panel.cold_bands.every(b=>panel.levels.some(l=>l.temperature_c===b.threshold)));
      for(const band of panel.cold_bands)checkTemperatureSide(panel,band,false);
      for(const band of lowLevel.warmBands(panel)){
        if(!panel.levels.some(l=>l.temperature_c===band.threshold))assert.equal(band.rings.length,0,"Missing contours must not be fabricated");
        else {assert.ok(band.rings.length,"Supported warm thresholds must not disappear");checkTemperatureSide(panel,band,true);}
      }
    }
  }
  for(const change of [x=>delete x.color_only,x=>x.panels.pop(),x=>x.panels[0].forecast_hour=6,
    x=>x.panels[0].pressure_hpa=850,x=>x.panels[0].wet_pressure_hpa=850,
    x=>x.panels.at(-1).vertical_velocity_pressure_hpa=850,
    x=>x.panels[0].wet_rectangles[0][0]=x.panels[0].bounds[0]-10,
    x=>x.panels[0].positive_vorticity_rectangles=[[200,100,205,105]],
    x=>x.panels[0].troughs=[{points:[[200,100],[210,110]]}],
    x=>x.panels[0].levels[0].temperature_c=-9,
    x=>x.panels.at(-1).temperature_interval_c=6,
    x=>delete x.panels.at(-1).temperature_label_interval_c]){
    const bad=structuredClone(data);change(bad);assert.throws(()=>snapshot.validate(bad,selected,"bousai-wx-lab.github.io"));
  }
  forecasts++;
}
assert.equal(forecasts,12);
const a=catalog.products.find(p=>p.id==="aupq35");assert.match(a.variants[0].label,/2026-10-04 12:00 UTC/);assert.match(a.variants[1].label,/2026-10-04 00:00 UTC/);assert.equal(a.variants[2].id,"aupq35-reviewed");
const bad=structuredClone(catalog);bad.products.find(p=>p.id==="aupq35").variants[0].analysis_path="../private/trial.json";assert.throws(()=>ChartCatalog.validate(bad));
console.log(`SNAPSHOT_TESTS_OK latest_pages=${recent} trial_sources=${analyses} forecast_color_sources=${forecasts} maps=${maps} public_source_binding_checked local_trial_not_public approved_status_not_fabricated`);
