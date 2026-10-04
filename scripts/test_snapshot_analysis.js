"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const root=path.resolve(__dirname,".."),read=f=>JSON.parse(fs.readFileSync(path.join(root,f)));
global.ChartCatalog=require("../catalog.js");
const snapshot=require("../snapshot-analysis.js"),atlas=require("../geography-atlas.js");
const catalog=ChartCatalog.validate(read("chart-catalog.json")),geo=read("geography-catalog.json"),allow=read("release-allowlist.json");
assert.equal(snapshot.localHost("bousai-wx-lab.github.io"),false);
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
    analyses++;
  }
  recent++;
}
assert.equal(recent,61);assert.equal(analyses,7);assert.equal(maps,57);
const a=catalog.products.find(p=>p.id==="aupq35");assert.match(a.variants[0].label,/2026-10-04 12:00 UTC/);assert.match(a.variants[1].label,/2026-10-04 00:00 UTC/);assert.equal(a.variants[2].id,"aupq35-reviewed");
const bad=structuredClone(catalog);bad.products.find(p=>p.id==="aupq35").variants[0].analysis_path="../private/trial.json";assert.throws(()=>ChartCatalog.validate(bad));
console.log(`SNAPSHOT_TESTS_OK latest_pages=${recent} trial_sources=${analyses} maps=${maps} public_source_binding_checked local_trial_not_public approved_status_not_fabricated`);
