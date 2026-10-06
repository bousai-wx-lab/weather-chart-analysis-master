"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const Share = require("../share-state.js"), Catalog = require("../catalog.js");
const catalog = Catalog.validate(JSON.parse(fs.readFileSync(path.join(__dirname,"../chart-catalog.json"),"utf8")));
const selected = Catalog.selection(catalog,"fxjp854","fxjp854-12-20261005",1);
const clone = value => JSON.parse(JSON.stringify(value));
const drawing = {
  history:[{kind:"clear"},{kind:"paint",color:"#ef2323",width:17.382875372,opacity:.43,points:[{x:123.45678901234,y:321.56789012345},{x:2048,y:0}]},{kind:"erase",color:"#2563eb",width:42.3,opacity:.5,points:[{x:125,y:325}]}],
  future:[{kind:"paint",color:"#2563eb",width:3,opacity:.7,points:[{x:500,y:800}]}],
  ...Object.fromEntries(Share.flags.map((key,i) => [key,i%2===0])),
  geographyOpacity:.37,equivalentOpacity:.29,warmOpacity:.68,coldOpacity:.26,
  geographyStyle:"elevation-relief",overlayTarget:500,overlays:[]
};
const state = {version:1,chart:Share.identity(selected),drawing,view:{fit:false,zoom:1.375,x:.213,y:.42}};
const mutate = fn => { const bad=clone(state);fn(bad);assert.throws(() => Share.validate(bad)); };
(async () => {
  const fragment = await Share.encode(state);
  assert.ok(fragment.startsWith("#share=1.d."));
  assert.deepEqual(await Share.decode(fragment),state);
  const visible = Share.currentDrawing(drawing);
  assert.deepEqual(visible.history,drawing.history.slice(1));assert.deepEqual(visible.future,[]);
  const cleared = Share.currentDrawing({...drawing,history:[...drawing.history,{kind:"clear"}]});
  assert.deepEqual(cleared.history,[]);assert.deepEqual(cleared.future,[]);
  Share.bind(state,selected,["elevation-relief"]);
  assert.equal(await Share.decode("#other"),null);
  mutate(s => s.version=3);
  mutate(s => s.drawing.showEquivalent="false");
  mutate(s => s.drawing.equivalentOpacity=1.1);
  mutate(s => s.drawing.history[1].points[0].x=-1);
  mutate(s => s.drawing.history[1].width=Infinity);
  mutate(s => s.drawing.history[1].color="url(example)");
  mutate(s => s.drawing.history[1].kind="script");
  mutate(s => s.drawing.history[1].points=[]);
  mutate(s => s.drawing.history[0].unexpected="extra");
  mutate(s => s.drawing.history[1].points=Array(50001).fill({x:1,y:1}));
  mutate(s => s.view.zoom=10);
  const wrong=clone(state);wrong.chart.image="0".repeat(64);
  assert.throws(() => Share.bind(wrong,selected,["elevation-relief"]),/同じ原図/);
  const wrongAnalysis=clone(state);wrongAnalysis.chart.analysis="0".repeat(64);
  assert.throws(() => Share.bind(wrongAnalysis,selected,["elevation-relief"]));
  assert.throws(() => Share.bind(state,selected,["paper"]));
  for (const fragment of ["#share=2.d.aaa","#share=1.d.abc","#share=1.j.ab!","#share=1.j.","#share="+"a".repeat(Share.maxFragment)]) await assert.rejects(Share.decode(fragment));
  const registration=JSON.parse(fs.readFileSync(path.join(__dirname,"../land-sea.json"),"utf8"));
  const Analysis=require("../analysis.js"), original=Catalog.selection(catalog,"aupq35","aupq35-reviewed",1);
  const overlayState=clone(state);overlayState.chart=Share.identity(original);
  const registered=Analysis.validatePanelRegistration(registration,JSON.parse(fs.readFileSync(path.join(__dirname,"../chart.json"),"utf8")));
  overlayState.drawing.overlays=[{...Analysis.createPanelOverlay(registered,original.key,"jet",500),source_product:original.product.code,opacity:.28,enabled:false}];
  Share.bind(overlayState,original,["elevation-relief"]);
  assert.deepEqual(await Share.decode(await Share.encode(overlayState)),overlayState);
  const duplicate=clone(overlayState);duplicate.drawing.overlays.push({...duplicate.drawing.overlays[0]});assert.throws(() => Share.validate(duplicate));
  const unrelated=clone(overlayState);unrelated.drawing.overlays[0].source_key="another/chart/1";assert.throws(() => Share.validate(unrelated));
  const compressed=await new Response(new Blob([" ".repeat(2000001)]).stream().pipeThrough(new CompressionStream("deflate"))).arrayBuffer();
  await assert.rejects(Share.decode("#share=1.d."+Buffer.from(compressed).toString("base64url")),/収まりません/);
  const saved=globalThis.CompressionStream;
  try {
    globalThis.CompressionStream=undefined;
    const plain=await Share.encode(state);assert.ok(plain.startsWith("#share=1.j."));assert.deepEqual(await Share.decode(plain),state);
    const large=clone(state);large.drawing.history[1].points=Array.from({length:4000},(_,i) => ({x:i*.1,y:i*.2}));
    await assert.rejects(Share.encode(large),/収まりません/);
  } finally { globalThis.CompressionStream=saved; }
  console.log("SHARE_STATE_TEST_OK exact_strokes overlays source_binding malformed bounded_decode plain_fallback");
})().catch(error => { console.error(error);process.exitCode=1; });
