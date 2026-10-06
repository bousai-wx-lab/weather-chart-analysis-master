"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const Axis=require("../manual-axis.js"),Share=require("../share-state.js"),Catalog=require("../catalog.js");
const close=(a,b)=>assert.ok(Axis.distance(a,b)<1e-7,`${a} != ${b}`);
const nodes=Axis.smooth([[100,300],[300,550],[650,450],[850,150]],2048,2993);
for(let i=0;i<nodes.length-1;i++) {close(Axis.cubic(nodes[i],nodes[i+1],0),nodes[i].p);close(Axis.cubic(nodes[i],nodes[i+1],1),nodes[i+1].p);}
const split=Axis.insert(nodes,1,.37);
for(let i=0;i<=100;i++) {
  const t=i/100;
  close(Axis.cubic(nodes[1],nodes[2],t),t<=.37?Axis.cubic(split[1],split[2],t/.37):Axis.cubic(split[2],split[3],(t-.37)/.63));
}
const moved=Axis.move(nodes,1,"p",[320,560],2048,2993);
for(const key of ["p","in","out"])close(moved[1][key],nodes[1][key].map((v,k)=>v+[20,10][k]));
assert.deepEqual(nodes[1].p,[300,550]); // Edits never mutate undo history.
const curved=Axis.move(nodes,1,"out",[400,590],2048,2993),n=curved[1];
const v=n.out.map((x,k)=>x-n.p[k]),u=n.in.map((x,k)=>x-n.p[k]);
assert.ok(Math.abs(v[0]*u[1]-v[1]*u[0])<1e-7);assert.ok(v[0]*u[0]+v[1]*u[1]<0);
assert.ok(Math.abs(Axis.distance(n.in,n.p)-Axis.distance(nodes[1].in,nodes[1].p))<1e-7);
const at=Axis.cubic(nodes[1],nodes[2],.42),hit=Axis.nearest(nodes,at);assert.equal(hit.segment,1);assert.ok(Math.abs(hit.t-.42)<.01);assert.ok(hit.distance<.1);
const trough={kind:"axis",id:"test-trough",type:"trough",nodes},ridge={kind:"axis",id:"test-ridge",type:"ridge",nodes:split};
assert.ok(Axis.valid(trough,2048,2993));assert.equal(Axis.valid({...trough,nodes:Axis.smooth([[1,1],[1,1]],2048,2993)},2048,2993),false);
const events=[trough,ridge,{kind:"axis-edit",id:trough.id,nodes:moved},{kind:"axis-delete",id:ridge.id}];
assert.deepEqual(Axis.flattened(events),[{...trough,nodes:moved}]);
assert.equal(Axis.resolved([...events,{kind:"clear"}]).size,0);
assert.equal(Axis.resolved(events.slice(0,-1)).size,2);
const rendered=[];Axis.draw({},trough,{drawTroughs:(ctx,p)=>rendered.push(["trough",p]),drawRidges:()=>assert.fail()});
Axis.draw({},ridge,{drawTroughs:()=>assert.fail(),drawRidges:(ctx,p)=>rendered.push(["ridge",p])});
assert.deepEqual(rendered.map(x=>x[0]),["trough","ridge"]);close(rendered[0][1][0][0],nodes[0].p);
const catalog=Catalog.validate(JSON.parse(fs.readFileSync(path.join(__dirname,"../chart-catalog.json"),"utf8")));
const selected=Catalog.selection(catalog,"aupq35","aupq35-12-20261005",1);
const drawing={history:events,future:[],...Object.fromEntries(Share.flags.map(k=>[k,true])),...Object.fromEntries(Share.opacities.map(k=>[k,.4])),geographyStyle:"paper",overlayTarget:500,overlays:[]};
const state={version:2,chart:Share.identity(selected),drawing:Share.currentDrawing(drawing),view:{fit:true,zoom:1,x:0,y:0}};
(async()=>{
  const fragment=await Share.encode(state);assert.ok(fragment.startsWith("#share=2."));assert.deepEqual(await Share.decode(fragment),state);
  await assert.rejects(Share.decode(fragment.replace("#share=2.","#share=1.")));
  for(const mutate of [s=>s.version=1,s=>s.drawing.history.push({...s.drawing.history[0]}),s=>s.drawing.history[0].nodes[0].in[0]=-1,s=>s.drawing.history[0].nodes[0].p[1]=Infinity,s=>s.drawing.history[0].type="other",s=>s.drawing.history[0].nodes=Array(101).fill(nodes[0]),s=>s.drawing.history[0].nodes[0].extra=true,s=>s.drawing.history[0].id="<script>",s=>s.drawing.history[0].kind="axis-edit"]) {
    const bad=JSON.parse(JSON.stringify(state));mutate(bad);assert.throws(()=>Share.validate(bad));
  }
  console.log("MANUAL_AXIS_TEST_OK interpolation subdivision handles immutable_undo styles v2_share malformed legacy_guard");
})().catch(error=>{console.error(error);process.exitCode=1;});
