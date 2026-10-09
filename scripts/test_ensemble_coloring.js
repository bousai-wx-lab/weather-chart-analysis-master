"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),crypto=require("node:crypto");
const Coloring=require("../ensemble-coloring.js"),Catalog=require("../catalog.js");
const root=require("node:path").resolve(__dirname,"..");
const data=JSON.parse(fs.readFileSync(root+"/ensemble-coloring.json")),catalog=JSON.parse(fs.readFileSync(root+"/chart-catalog.json"));
for(const record of data.selections){
  const selected=Catalog.selection(catalog,record.product,record.variant,record.page);
  const checked=Coloring.validate(data,selected);
  for(const asset of Object.values(checked.layers))assert.equal(crypto.createHash("sha256").update(fs.readFileSync(root+"/"+asset.path)).digest("hex"),asset.sha256);
  for(const field of ["source_sha256","image_sha256","width","height"]){
    const bad=structuredClone(data),r=bad.selections.find(x=>x.variant===record.variant);
    r[field]=typeof r[field]==="number"?r[field]+1:"0".repeat(64);
    assert.throws(()=>Coloring.validate(bad,selected));
  }
  const wrong=structuredClone(data);wrong.selections.find(x=>x.variant===record.variant).layers.symbols.path="assets/ensemble/another-date-symbols.png";
  assert.throws(()=>Coloring.validate(wrong,selected));
  const draws=[],ctx={save:()=>{},restore:()=>{},drawImage:(...args)=>draws.push(args)},coloring={images:{precipitation:"mask"}};
  Coloring.draw(ctx,coloring,"precipitation",false);assert.equal(draws.length,0);
  Coloring.draw(ctx,coloring,"precipitation",true);assert.deepEqual(draws,[["mask",0,0]]);
}
assert.throws(()=>Coloring.validate(data,Catalog.selection(catalog,"aupq35","aupq35-reviewed",1)));
assert.match(Coloring.legends("fefe19").note,/雨量・降水確率の違いを表しません/);
assert.deepEqual(Coloring.legends("fzcx50").bands,["10〜50％","50〜90％","90％以上"]);
assert.equal(data.selections.length,6);
assert.match(Coloring.legends("fxxn519").temperature,/3℃ごと/);
assert.match(Coloring.legends("fxxn519").height,/地図・緯度時間断面/);
console.log("ENSEMBLE_SOURCE_BINDING_OK selections=6");
