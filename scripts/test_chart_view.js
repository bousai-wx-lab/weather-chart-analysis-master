"use strict";
const assert=require("node:assert/strict"),view=require("../chart-view.js"),catalog=require("../catalog.js"),atlas=require("../geography-atlas.js");
const c=catalog.validate(require("../chart-catalog.json")),a=require("../geography-catalog.json");
function frames(product,variant){const s=catalog.selection(c,product,variant,1);return view.rows(s,atlas.validate(a,s));}
const upperLower=frames("aupq35","aupq35-reviewed");
assert.ok(upperLower[0][1]<121.3 && upperLower[0][3]>1441.63 && upperLower[0][3]<1537.68);
assert.ok(upperLower[1][1]>1441.63 && upperLower[1][1]<1537.68 && upperLower[1][3]>2858);
const four=frames("fxjp854","fxjp854-12-20261005");
assert.ok(four[0][0]<23 && four[0][2]>2022 && four[0][3]<1209);
assert.ok(four[1][1]>1113 && four[1][3]>2201);
const forecast=frames("fxfe5782","fxfe5782-12-20261005");
assert.notDeepEqual(four,forecast);
assert.equal(frames("aupa20","aupa20-12-20261005"),null);
assert.ok(frames("axjp130-axjp140","axjp140-12-20261005")[1][1]>1400);
// Both a wide desktop and a narrow phone must contain the complete requested row.
for(const size of [{width:1400,height:960},{width:350,height:740}])for(const f of [...upperLower,...four,...forecast]){
 const width=view.fittedWidth(f,2048,size),scale=width/2048;
 assert.ok((f[2]-f[0])*scale<=size.width && (f[3]-f[1])*scale<=size.height);
 assert.ok(Math.min(size.width-(f[2]-f[0])*scale,size.height-(f[3]-f[1])*scale)<1);
}
const s={product:{id:"unknown"},page:{width:100,height:100}};
assert.equal(view.rows(s,{width:100,height:100,panels:[{bounds:[0,0,40,90]},{bounds:[50,0,90,90]}]}),null);
assert.equal(view.rows(s,{width:100,height:100,panels:[{bounds:[0,0,40,40]},{bounds:[50,60,101,100]}]}),null);
assert.equal(view.rows(s,{width:101,height:100,panels:[]}),null);
console.log("CHART_VIEW_TESTS_OK two_row four_panel single_map diagram source_dimensions aspect_fit");
