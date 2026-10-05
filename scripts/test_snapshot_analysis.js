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
assert.equal(recent,61);assert.equal(analyses,7);assert.equal(maps,57);
const a=catalog.products.find(p=>p.id==="aupq35");assert.match(a.variants[0].label,/2026-10-04 12:00 UTC/);assert.match(a.variants[1].label,/2026-10-04 00:00 UTC/);assert.equal(a.variants[2].id,"aupq35-reviewed");
const bad=structuredClone(catalog);bad.products.find(p=>p.id==="aupq35").variants[0].analysis_path="../private/trial.json";assert.throws(()=>ChartCatalog.validate(bad));
console.log(`SNAPSHOT_TESTS_OK latest_pages=${recent} trial_sources=${analyses} maps=${maps} public_source_binding_checked local_trial_not_public approved_status_not_fabricated`);
