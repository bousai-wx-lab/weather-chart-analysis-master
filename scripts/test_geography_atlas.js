"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const root=path.resolve(__dirname,".."),atlas=require("../geography-atlas.js"),catalog=require("../catalog.js"),read=f=>JSON.parse(fs.readFileSync(path.join(root,f)));
const c=catalog.validate(read("chart-catalog.json")),a=read("geography-catalog.json"),allowed=read("release-allowlist.json"),nomap=[];
for(const product of c.products)for(const variant of product.variants)for(const page of variant.pages) {
 const s=catalog.selection(c,product.id,variant.id,page.number),r=atlas.validate(a,s);
 if(!r.panels.length){if(!variant.id.endsWith("-20261005"))nomap.push(variant.id);continue;}
 const bytes=fs.readFileSync(path.join(root,r.mask.path));assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"),r.mask.sha256);
 assert.equal(bytes.readUInt32BE(16),r.width);assert.equal(bytes.readUInt32BE(20),r.height);assert.equal(bytes[25],6);
 const approved=allowed.allowed_binary_assets.find(x=>x.path===r.mask.path);assert.equal(approved?.sha256,r.mask.sha256);
 const bad=structuredClone(a),row=bad.selections.find(x=>x.variant===variant.id);row.image_sha256="0".repeat(64);assert.throws(()=>atlas.validate(bad,s));
}
assert.deepEqual(nomap.sort(),["axjp140-00","axjp140-12","fcvx14-12","fcvx24-12"].sort());
assert.equal(atlas.canonical(atlas.validate(a,catalog.selection(c,"axfe578","axfe578-00",1))),true);
assert.equal(atlas.canonical(atlas.validate(a,catalog.selection(c,"feas-feas50","feas50-12",1))),false);
const f=a.selections.find(r=>r.variant==="fcvx21-12");assert.equal(f.panels.length,7);assert.ok(f.panels.every(p=>p.bounds[2]<1000||p.bounds[3]<1600));
console.log("GEOGRAPHY_ATLAS_TESTS_OK all_catalog_sources_frames_masks_bound graphs_excluded");
