"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const Axis=require("../manual-axis.js"),Share=require("../share-state.js"),Catalog=require("../catalog.js");
const clone=o=>JSON.parse(JSON.stringify(o));
const style={stroke:"#123abc",fill:"none",width:8,opacity:.37,start:"arrow",end:"open"};
const curve={kind:"vector",id:"curve",type:"curve",nodes:Axis.smooth([[100,200],[350,500],[700,200]],2048,2993),style,emoji:null};
const line={...curve,id:"line",type:"line",nodes:Axis.anchors([[100,600],[800,900]])};
const vectors=[curve,line,...["rect","ellipse","roundrect","triangle",...Axis.weather.map(e=>e.id)].map((type,i)=>({
  kind:"vector",id:`box-${i}`,type:i<4?type:"emoji",emoji:i<4?null:type,
  nodes:Axis.anchors([[100,1100],[400,1400]]),style:{...style,fill:"#555555",start:"none",end:"none"}
}))];
assert.equal(Axis.weather.length,15);assert.equal(new Set(Axis.weather.map(e=>e.glyph)).size,15);
for(const vector of vectors)assert.ok(Axis.validVector(vector,2048,2993),vector.type);
const original=clone(curve),moved=Axis.translate(curve,[50,-20],2048,2993);
for(let i=0;i<curve.nodes.length;i++)for(const key of ["p","in","out"])assert.deepEqual(moved.nodes[i][key],curve.nodes[i][key].map((v,k)=>v+[50,-20][k]));
assert.deepEqual(curve,original);
assert.ok(Axis.validVector(Axis.translate(curve,[5000,-5000],2048,2993),2048,2993));
for(const corner of [0,1,2,3]) {
  const box=vectors[2],resized=Axis.resize(box,corner,[900,1900],2048,2993);
  assert.ok(Axis.validVector(resized,2048,2993));assert.deepEqual(Axis.corners(resized).find(p=>Axis.distance(p,Axis.corners(box)[(corner+2)%4])<1e-6),Axis.corners(box)[(corner+2)%4]);
}
const emoji=Axis.resize(vectors[6],0,[0,700],2048,2993),b=Axis.bounds(emoji);
assert.equal(b.width,b.height);assert.ok(Axis.validVector(emoji,2048,2993));
const edit={kind:"vector-edit",id:curve.id,value:moved};
assert.deepEqual(Axis.flattened([curve,edit]),[moved]);assert.deepEqual(Axis.flattened([curve,edit].slice(0,-1)),[curve]);
assert.deepEqual(Axis.flattened([curve,edit,{kind:"axis-delete",id:curve.id}]),[]);
assert.deepEqual(Axis.flattened([curve,{kind:"clear"},line]),[line]);
// Exercise every endpoint and shape on a canvas-like recorder; pixels are checked in browser QA.
const calls=[],ctx=new Proxy({}, {get:(_,key)=>(...args)=>calls.push([key,...args]),set:(_,key,value)=>{calls.push([key,value]);return true;}});
for(const arrow of Axis.arrows)Axis.draw(ctx,{...curve,style:{...style,start:arrow,end:arrow}});
for(const vector of vectors.slice(1))Axis.draw(ctx,vector);
assert.equal(calls.filter(c=>c[0]==="fillText").length,15);assert.ok(calls.some(c=>c[0]==="roundRect"));assert.ok(calls.some(c=>c[0]==="ellipse"));
for(const mutate of [o=>o.id=null,o=>o.style.width=NaN,o=>o.style.opacity=1.1,o=>o.style.stroke="url(x)",o=>o.style.start="script",o=>o.nodes[0].p[0]=-1,o=>o.nodes[0].extra=1,o=>o.emoji="other"]) {
  const invalid=clone(curve);mutate(invalid);assert.equal(Axis.validVector(invalid,2048,2993),false);
}
assert.equal(Axis.validVector({...line,nodes:curve.nodes},2048,2993),false);
assert.equal(Axis.validVector({...vectors[2],style},2048,2993),false);
const catalog=Catalog.validate(JSON.parse(fs.readFileSync(path.join(__dirname,"../chart-catalog.json"),"utf8")));
const selected=Catalog.selection(catalog,"aupq35","aupq35-12-20261005",1);
const drawing={history:vectors,future:[],...Object.fromEntries(Share.flags.map(k=>[k,true])),...Object.fromEntries(Share.opacities.map(k=>[k,.4])),geographyStyle:"paper",overlayTarget:500,overlays:[]};
const state={version:3,chart:Share.identity(selected),drawing,view:{fit:true,zoom:1,x:0,y:0}};
(async()=>{
  const fragment=await Share.encode(state);assert.ok(fragment.startsWith("#share=3."));assert.deepEqual(await Share.decode(fragment),state);
  await assert.rejects(Share.decode(fragment.replace("#share=3.","#share=2.")));
  for(const version of [1,2])assert.throws(()=>Share.validate({...state,version}));
  const duplicate=clone(state);duplicate.drawing.history.push(curve);assert.throws(()=>Share.validate(duplicate));
  console.log("DRAWING_TOOLS_TEST_OK curves lines endpoints shapes weather movement resizing undo v3_share validation");
})().catch(error=>{console.error(error);process.exitCode=1;});
