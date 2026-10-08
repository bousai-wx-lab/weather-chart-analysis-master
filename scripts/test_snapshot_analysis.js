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
// 200hPa and tropopause have separate units and source geometry on all four inputs.
for(const v of catalog.products.find(p=>p.id==="aupa20").variants){
  const selected=ChartCatalog.selection(catalog,"aupa20",v.id,1),data=snapshot.validate(read(v.analysis_path),selected,"bousai-wx-lab.github.io"),panel=data.panels[0];
  assert.equal(data.panels.length,1);assert.equal(panel.pressure_hpa,200);
  assert.deepEqual(panel.wind_bands.map(b=>b.threshold),[40,60,80,100,120]);
  assert.ok(panel.tropopause_levels.some(l=>l.pressure_hpa===150));
  assert.ok(panel.tropopause_levels.some(l=>l.pressure_hpa===250));
  assert.deepEqual([...new Set(data.symbols.map(s=>s.letter))].sort(),["C","H","L","W"]);
  assert.ok(panel.native_jet_strokes.length>50);
  assert.equal(snapshot.displayScales(data).length,1);
  for(const change of [x=>x.panels[0].pressure_hpa=300,x=>x.panels[0].tropopause_trace.unit="m",x=>x.panels[0].tropopause_trace.interval=100,x=>x.panels[0].tropopause_levels[1].pressure_hpa+=25,x=>x.panels[0].native_jet_strokes[0].source_path=-1,x=>x.panels[0].native_jet_strokes[0].points[0]=[0,0],x=>x.panels[0].wind_bands[0].threshold=20]){const bad=structuredClone(data);change(bad);assert.throws(()=>snapshot.validate(bad,selected,"bousai-wx-lab.github.io"));}
}
assert.equal(snapshot.tropopauseColor(100),null);assert.equal(snapshot.tropopauseColor(400),"#3b0764");
assert.notEqual(snapshot.tropopauseColor(150),snapshot.tropopauseColor(250));
assert.equal(ChartAnalysis.temperatureColor(200,-42),"#a0d8fa");assert.equal(ChartAnalysis.temperatureColor(200,-66),"#4c1d95");
// 250hPa uses its own four originals and has no tropopause field.
for(const v of catalog.products.find(p=>p.id==="aupa25").variants){
  const selected=ChartCatalog.selection(catalog,"aupa25",v.id,1),data=snapshot.validate(read(v.analysis_path),selected,"bousai-wx-lab.github.io"),panel=data.panels[0],jets=snapshot.jetAxes(data);
  assert.equal(data.panels.length,1);assert.equal(panel.pressure_hpa,250);
  assert.equal(panel.tropopause_bands,undefined);assert.equal(panel.native_jet_strokes,undefined);
  assert.deepEqual(panel.wind_bands.map(b=>b.threshold),[40,60,80,100,120]);
  checkJetSupport(panel,jets);assert.ok(jets.every(j=>j.centers.every(c=>c.min_kt>=40)));
  assert.deepEqual([...new Set(data.symbols.map(s=>s.letter))].sort(),["C","H","L","W"]);
  assert.equal(snapshot.displayScales(data)[0].pressure_hpa,250);
  for(const value of panel.levels.map(l=>l.temperature_c))assert.equal(ChartAnalysis.temperatureColor(250,value),ChartAnalysis.temperatureColor(200,value));
  for(const change of [x=>x.source_sha256="0".repeat(64),x=>x.image_sha256="0".repeat(64),x=>x.panels[0].pressure_hpa=200,x=>x.panels[0].tropopause_bands=[],x=>x.panels[0].wind_trace.unit="m/s",x=>x.panels[0].jet_guides[0].points[0]=[0,0],x=>x.panels[0].levels[0].lines[0].points[0]=[0,0],x=>x.panels[0].wind_bands[0].threshold=20]){const bad=structuredClone(data);change(bad);assert.throws(()=>snapshot.validate(bad,selected,"bousai-wx-lab.github.io"));}
}
// 300hPa uses its own four originals and has no tropopause field.
for(const v of catalog.products.find(p=>p.id==="aupn30").variants){
  const selected=ChartCatalog.selection(catalog,"aupn30",v.id,1),data=snapshot.validate(read(v.analysis_path),selected,"bousai-wx-lab.github.io"),panel=data.panels[0],jets=snapshot.jetAxes(data);
  assert.equal(data.panels.length,1);assert.equal(panel.pressure_hpa,300);
  assert.equal(panel.tropopause_bands,undefined);assert.equal(panel.native_jet_strokes,undefined);
  assert.deepEqual(panel.wind_bands.map(b=>b.threshold),[40,60,80,100,120]);
  checkJetSupport(panel,jets);assert.ok(jets.every(j=>j.centers.every(c=>c.min_kt>=40)));
  assert.deepEqual([...new Set(data.symbols.map(s=>s.letter))].sort(),["C","H","L","W"]);
  assert.equal(snapshot.displayScales(data)[0].pressure_hpa,300);
  for(const value of panel.levels.map(l=>l.temperature_c))assert.equal(ChartAnalysis.temperatureColor(300,value),ChartAnalysis.isothermScales[0].colors[Math.max(0,Math.min(4,Math.round((-value-27)/6)))]);
  for(const change of [x=>x.source_sha256="0".repeat(64),x=>x.image_sha256="0".repeat(64),x=>x.panels[0].pressure_hpa=200,x=>x.panels[0].tropopause_bands=[],x=>x.panels[0].wind_trace.unit="m/s",x=>x.panels[0].jet_guides[0].points[0]=[0,0],x=>x.panels[0].levels[0].lines[0].points[0]=[0,0],x=>x.panels[0].wind_bands[0].threshold=20]){const bad=structuredClone(data);change(bad);assert.throws(()=>snapshot.validate(bad,selected,"bousai-wx-lab.github.io"));}
}
// Forecasts bind all 16 own sources, with the same pressure palettes as observations.
for(const [product,pressure]of [["fupa252",250],["fupa302",300],["fupa402",400],["fupa502",500]])for(const v of catalog.products.find(p=>p.id===product).variants){
  const selected=ChartCatalog.selection(catalog,product,v.id,1),data=snapshot.validate(read(v.analysis_path),selected,"bousai-wx-lab.github.io"),panel=data.panels[0];
  assert.equal(panel.pressure_hpa,pressure);assert.equal(panel.forecast_hour,24);assert.equal(data.panels.length,1);
  assert.equal(panel.tropopause_bands,undefined);assert.equal(snapshot.displayScales(data)[0].pressure_hpa,pressure);
  assert.ok(data.symbols.some(s=>s.letter==="L")&&data.symbols.some(s=>s.letter==="H"));
  if(pressure===500){assert.ok(panel.troughs.length&&panel.ridges.length);assert.equal(panel.wind_bands,undefined);assert.equal(snapshot.jetAxes(data).length,0);}
  else{
    assert.deepEqual(panel.wind_bands.map(b=>b.threshold),[40,60,80,100,120]);
    assert.equal(panel.wind_trace.levels[0].speed_kt,20);
    const jets=snapshot.jetAxes(data);checkJetSupport(panel,jets);assert.ok(jets.every(j=>j.centers.every(c=>c.min_kt>=40)));
    assert.equal(inBands([250,1450],panel.wind_bands),false,"weak southern winds stay uncolored");
    assert.ok(inBands([1100,1070],panel.wind_bands),"main strong-wind region stays colored");
  }
  for(const change of [x=>x.source_sha256="0".repeat(64),x=>x.panels[0].forecast_hour=48,x=>x.panels[0].pressure_hpa=850,x=>x.panels[0].tropopause_bands=[],x=>x.panels[0].levels[0].lines[0].points[0]=[0,0],...(pressure===500?[x=>x.panels[0].troughs[0].contour_crossings=[],x=>x.panels[0].ridges[0].control_points.pop()]:[x=>x.panels[0].wind_bands[0].threshold=20,x=>x.panels[0].jet_guides[0].points[0]=[0,0]])]){const bad=structuredClone(data);change(bad);assert.throws(()=>snapshot.validate(bad,selected,"bousai-wx-lab.github.io"));}
}
// Teacher case: four distinct flows, sparse NW convex representatives and both central branches.
{
 const d=read("assets/analysis/fupa252-12-20261005.json"),axes=snapshot.jetAxes(d),levels=d.panels[0].wind_trace.levels;
 const points=guide=>axes.filter(a=>a.guide_index===guide).flatMap(a=>a.centers.map(c=>c.point));
 const contains=(guide,p)=>points(guide).some(q=>Math.hypot(...q.map((v,k)=>v-p[k]))<1e-7);
 const level=speed=>levels.find(l=>l.speed_kt===speed);
 for(const [line,indices]of [[0,[64,1]],[3,[65,29]],[6,[58,5]]])for(const i of indices)assert.ok(contains(0,level(120).lines[line].points[i]),"the southern main flow must pass through the independently selected source 120kt lobe tips");
 for(const i of [0,9])assert.ok(contains(3,level(80).lines[3].points[i]),"the central flow must pass through the source 80kt closed-lobe tips instead of the former weak 40kt path");
 assert.ok(contains(3,[1325.24,814.36]),"the eastern open-lobe convex tip is also required, not just elliptical closed contours");
}
{
 const axes=snapshot.jetAxes(read("assets/analysis/fupa402-00.json")).filter(a=>a.guide_index===3);
 for(const axis of axes)for(let i=1;i<axis.centers.length;i++)assert.ok(axis.centers[i].point[1]>axis.centers[i-1].point[1],"adjacent closed lobes on this southward flow must not interleave their endpoints and reverse upstream");
}
{
 const d=read("assets/analysis/fupa302-12-20261005.json"),j=snapshot.jetAxes(d);
 assert.equal(j.length,4);assert.deepEqual(j.map(a=>a.guide_index),[0,1,2,3]);
 const nw=j[1];assert.ok(nw.segments.length<=6,"a broad convex lobe must not be interpolated through dozens of noisy transverse centers");
 for(const seg of nw.segments)for(let i=1;i<=100;i++){
  const at=t=>[0,1].map(k=>(1-t)**3*seg.start[k]+3*(1-t)**2*t*seg.c1[k]+3*(1-t)*t*t*seg.c2[k]+t**3*seg.end[k]);
  const a=at((i-1)/100),b=at(i/100);assert.ok(b[0]>=a[0]&&b[1]>=a[1],"the NW convex flow advances smoothly southeast without the former zigzag");
 }
 assert.ok(j[2].segments.at(-1).end[1]>j[2].segments[0].start[1]);
 assert.ok(j[3].segments.at(-1).end[0]>j[3].segments[0].start[0]);
}
function checkJetSupport(panel,jets){
  assert.ok(jets.length>0,"confirmed wind structures remain visible; unconfirmed intervals may be absent or separate");
  assert.equal(new Set(jets.map(a=>a.guide_index+":"+a.run_index)).size,jets.length);
  for(const axis of jets){
    for(let i=1;i<axis.segments.length;i++) {
      const before=axis.segments[i-1],s=axis.segments[i],u=before.end.map((v,k)=>v-before.c2[k]),v=s.c1.map((n,k)=>n-s.start[k]);
      assert.ok(Math.abs(u[0]*v[1]-u[1]*v[0])<1e-6 && u[0]*v[0]+u[1]*v[1]>0,"shared tangent directions prevent corners or reversals at short convex tip pairs");
    }
    for(const peak of axis.convex_peaks) {
      const line=panel.wind_trace?.levels.find(l=>l.speed_kt===peak.speed_kt)?.lines[peak.line_index];
      if(line)for(const [i,point]of peak.tips.entries())assert.deepEqual(point,line.points[peak.tip_indices[i]],"the convex anchor must be the actual original isotach vertex");
      for(const point of peak.tips)assert.ok(jets.filter(a=>a.guide_index===axis.guide_index).flatMap(a=>a.centers).some(c=>Math.hypot(...c.point.map((v,k)=>v-point[k]))<1e-7),"both convex tips must actually appear on the drawn flow, including across separately confirmed runs");
    }
    for(const tip of axis.open_tips) {
      const line=panel.wind_trace?.levels.find(l=>l.speed_kt===tip.speed_kt)?.lines[tip.line_index];
      if(line)assert.ok(line.points.some(p=>p.every((v,k)=>v===tip.point[k])),"an open-lobe anchor must also be on the original isotach");
    }
  }
  for(const axis of jets)for(const s of axis.segments)for(let j=0;j<=100;j++){
    const t=j/100,u=1-t,q=[0,1].map(k=>u*u*u*s.start[k]+3*u*u*t*s.c1[k]+3*u*t*t*s.c2[k]+t*t*t*s.end[k]);
    assert.ok(inBands(q,panel.wind_bands.filter(b=>b.threshold>=40)),"wind-free gaps remain unconnected between the independently verified convex anchors");
  }
}
function inBands(p,bands){return bands.some(b=>b.rings.reduce((odd,r)=>odd!==inRing(r,p),false));}
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
    if(data.product==="FEAS50" && data.variant==="feas50-12-20261005"){
      const panel=data.panels[1];
      assert.deepEqual(panel.levels.map(l=>l.temperature_c),Array.from({length:16},(_,i)=>-15+i*3),"All native 3 C contours, including -9 C, must remain recognized");
      assert.deepEqual(panel.cold_bands.map(b=>b.threshold),[0,-3,-6,-9,-12]);
      assert.equal(panel.temperature_trace.method,"native_regular_dash_connectivity");
      assert.equal(panel.temperature_trace.labels_read,32);
      for(const change of [
        x=>x.panels[1].levels[0].lines[0].points.splice(1,0,[200,2300]),
        x=>x.panels[1].levels[0].lines[0].closed=true,
        x=>x.panels[1].levels[0].lines[0].source_paths.push(x.panels[1].levels[0].lines[0].source_paths[0]),
        x=>x.panels[1].temperature_trace.unassigned_groups=1
      ]){const bad=structuredClone(data);change(bad);assert.throws(()=>snapshot.validate(bad,selected,"localhost"));}
    }
    if(data.product==="AUPQ35") {
      const upper=data.panels[0],jets=snapshot.jetAxes(data);
      assert.equal(upper.troughs.length+upper.ridges.length,0);
      checkJetSupport(upper,jets);
      assert.ok(jets.every(j=>j.centers.every(c=>c.min_kt>=40)&&j.segments.length>=1));
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
assert.equal(recent,61);assert.equal(analyses,45);assert.equal(maps,57);
// Source-read FXJP854 checks: a cool closed island in the southern map,
// its warmer surroundings, and the hot tropical-cyclone core.
const eqSelected=ChartCatalog.selection(catalog,"fxjp854","fxjp854-12-20261005",1);
const eq=read(eqSelected.variant.analysis_path);
assert.equal(snapshot.equivalentColor(260),"#173f8a");
assert.equal(snapshot.equivalentColor(370),"#991b1b");
assert.equal(snapshot.equivalentColor(250),snapshot.equivalentColor(260));
assert.equal(snapshot.equivalentColor(380),snapshot.equivalentColor(370));
const eqAt=point=>eq.panels[0].equivalent_bands.filter(b=>b.rings.reduce((odd,r)=>odd!==inRing(r,point),false)).at(-1)?.threshold_k;
assert.equal(eqAt([520,950]),330);
assert.equal(eqAt([660,960]),345);
assert.ok(eqAt([930,880])>=370);
for(const mutate of [d=>d.unit="degC",d=>d.range_k[1]=380,d=>d.panels[0].forecast_hour=36,d=>d.panels[0].equivalent_bands[0].rings[0][0]=[0,0],d=>d.panels[0].equivalent_levels[0].lines[0].source_paths.push(d.panels[0].equivalent_levels[0].lines[0].source_paths[0]),d=>d.panels[0].equivalent_bands[0].side_agreement=.8]){
  const bad=structuredClone(eq);mutate(bad);assert.throws(()=>snapshot.validate(bad,eqSelected,"bousai-wx-lab.github.io"));
}
let surfaces=0;
for(const p of catalog.products.filter(p=>["FXFE502","FXFE504","FXFE507"].includes(p.code)))for(const v of p.variants){
  const selected=ChartCatalog.selection(catalog,p.id,v.id,1),raw=fs.readFileSync(path.join(root,v.analysis_path));
  assert.equal(crypto.createHash("sha256").update(raw).digest("hex"),v.analysis_sha256);
  const data=snapshot.validate(JSON.parse(raw),selected,"bousai-wx-lab.github.io");
  assert.equal(data.surface_forecast,true);
  assert.deepEqual(snapshot.displayScales(data).map(s=>s.pressure_hpa),[500,0]);
  const upper=data.panels.filter(p=>p.pressure_hpa===500),lower=data.panels.filter(p=>p.pressure_hpa===0);
  assert.ok(upper.every(p=>p.troughs.length && p.ridges.length && p.positive_vorticity_rectangles.length));
  assert.ok(lower.every(q=>q.precipitation_bands.length && q.accumulation_hours===(p.code==="FXFE507"?24:12) && q.accumulation_start_hour===q.forecast_hour-q.accumulation_hours && q.levels.length===0));
  assert.ok(data.symbols.some(s=>s.letter==="L")&&data.symbols.some(s=>s.letter==="H"));
  for(const mutate of [
    d=>d.panels.at(-1).accumulation_hours=p.code==="FXFE507"?12:24,
    d=>d.panels.at(-1).accumulation_start_hour++,
    d=>d.panels.at(-1).precipitation_bands[0].threshold=3,
    d=>d.panels.at(-1).precipitation_bands[0].color="#ff0000",
    d=>d.panels.at(-1).precipitation_bands[0].rings[0][0]=[0,0],
    d=>d.panels[0].precipitation_bands=d.panels.at(-1).precipitation_bands,
    d=>d.panels.at(-1).troughs=d.panels[0].troughs
  ]){const bad=structuredClone(data);mutate(bad);assert.throws(()=>snapshot.validate(bad,selected,"localhost"));}
  surfaces++;
}
assert.equal(surfaces,12);
// Rainfall examples read from the original 12-hour FXFE502 source:
// dry inland area, light rain west of Japan, intense tropical cyclone rain,
// and a rain region clipped by the western map frame.
const rainPanel=read("assets/analysis/fxfe502-12-20261005-surface.json").panels[2];
const rainAt=point=>rainPanel.precipitation_bands.filter(b=>b.rings.reduce((odd,r)=>odd!==inRing(r,point),false)).at(-1)?.threshold??null;
assert.equal(rainAt([500,1000]),null,"Dry area must retain the land/water background");
assert.equal(rainAt([660,1140]),0,"Light precipitation must use the first cyan band");
assert.equal(rainAt([840,1380]),50,"Rain beyond the last 50-mm contour must use the darkest blue");
assert.equal(rainAt([100,1300]),0,"An open rain region at the map edge must remain filled on its wet side");
const lowLevel=require("../low-level.js");
// Legacy source band colors must not override the palette shown in the legend.
// Use the actual FEAS source and a 700hPa panel with missing intermediate bands.
const fillColors=[],scratch={beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){fillColors.push(this.fillStyle);}};
const fillCtx={canvas:{ownerDocument:{createElement(){return {getContext(){return scratch;}};}}},save(){},restore(){},beginPath(){},rect(){},clip(){},drawImage(){}};
const feasColors=read("assets/analysis/feas50-12-20261005.json");
snapshot.drawFills(fillCtx,feasColors,{cold850:true,opacity:.35});
assert.deepEqual(fillColors,lowLevel.coldColors,"FEAS fill must match the shared cold legend, including navy instead of stored purple");
fillColors.length=0;
const sparse700={pressure_hpa:700,bounds:[0,0,100,100],cold_thresholds:[-15,-18,-21,-24,-27],cold_bands:[{threshold:-27,color:"#4c1d95",rings:[[[0,0],[100,0],[100,100]]]}]};
snapshot.drawFills(fillCtx,{width:100,height:100,panels:[sparse700]},{cold700:true,opacity:.35});
assert.deepEqual(fillColors,["#173f8a"],"Missing intermediate bands must not shift the temperature-to-color assignment");
fillColors.length=0;
snapshot.drawFills(fillCtx,{width:100,height:100,panels:[{pressure_hpa:300,bounds:[0,0,100,100],wind_bands:[{threshold:40,color:ChartAnalysis.windPalette[0],rings:sparse700.cold_bands[0].rings}]}]},{wind:true});
assert.deepEqual(fillColors,[ChartAnalysis.windPalette[0]],"Temperature palette changes must preserve the wind palette");
fillColors.length=0;
snapshot.drawFills(fillCtx,{width:2048,height:1600,panels:[rainPanel]},{precipitation:true});
assert.deepEqual(fillColors,rainPanel.precipitation_bands.map(b=>snapshot.precipitationColors[b.threshold/10]),"Rain rendering and the legend must use the same threshold colors");
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
let feasForecasts=0;
const feasHours={FEAS502:24,FEAS504:48,FEAS507:72,FEAS509:96,FEAS512:120,FEAS514:144,FEAS516:168,FEAS519:192,FEAS521:216,FEAS524:240,FEAS526:264};
for(const product of catalog.products.filter(p=>feasHours[p.code.split("/").at(-1)]))for(const variant of product.variants){
  const selected=ChartCatalog.selection(catalog,product.id,variant.id,1),raw=fs.readFileSync(path.join(root,variant.analysis_path));
  assert.equal(crypto.createHash("sha256").update(raw).digest("hex"),variant.analysis_sha256);
  assert.ok(allow.allowed_files.includes(variant.analysis_path));
  const data=snapshot.validate(JSON.parse(raw),selected,"bousai-wx-lab.github.io");
  assert.equal(data.feas_forecast,true);
  assert.deepEqual(data.panels.map(p=>p.pressure_hpa),[500,850]);
  assert.ok(atlas.validate(geo,selected).panels.length===2,"Both original map frames need land/water coverage");
  const [upper,lower]=data.panels;
  assert.ok(upper.troughs.length && upper.ridges.length && upper.positive_vorticity_rectangles.length);
  assert.ok(upper.positive_vorticity_rectangles.every(r=>r[3]-r[1]<upper.bounds[3]-upper.bounds[1]),"A meridian must not become a full-height pink fill");
  assert.equal(lower.troughs.length+lower.ridges.length,0);
  assert.equal(lower.temperature_interval_c,3);
  assert.equal(lower.temperature_label_interval_c,6);
  assert.ok([3,9,15,21].every(t=>lower.levels.some(l=>l.temperature_c===t)),"Unnumbered intermediate isotherms must remain present");
  assert.deepEqual(lower.cold_bands.map(b=>b.threshold),[0,-3,-6,-9,-12]);
  for(const band of lower.cold_bands){assert.ok(band.rings.length);checkTemperatureSide(lower,band,false);}
  for(const band of lowLevel.warmBands(lower)){assert.ok(band.rings.length,"Supported warm bands must reach the map edge");checkTemperatureSide(lower,band,true);}
  assert.ok(data.symbols.some(s=>s.letter==="L") && data.symbols.some(s=>s.letter==="H") && data.symbols.some(s=>s.letter==="C") && data.symbols.some(s=>s.letter==="W"));
  for(const axis of [...upper.troughs,...upper.ridges]){
    const turns=[];
    for(let i=2;i<axis.points.length;i++){
      const a=axis.points[i-2],b=axis.points[i-1],c=axis.points[i];
      const cross=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);
      const dot=(b[0]-a[0])*(c[0]-b[0])+(b[1]-a[1])*(c[1]-b[1]);
      if(Math.abs(Math.atan2(cross,dot))>.005)turns.push(Math.sign(cross));
    }
    assert.ok(new Set(turns).size<=1,"One broad phenomenon must not turn into a small S curve");
  }
  for(const mutate of [d=>delete d.feas_forecast,d=>d.panels[0].forecast_hour++,d=>d.panels[1].pressure_hpa=0,
    d=>d.panels[1].temperature_interval_c=6,d=>delete d.panels[1].temperature_trace,
    d=>d.panels[1].temperature_trace.frame_margin_px=100,d=>d.panels[1].temperature_trace.unassigned_groups=1,
    d=>d.panels[1].troughs=d.panels[0].troughs,d=>d.panels[0].positive_vorticity_rectangles[0][0]=0]){
    const bad=structuredClone(data);mutate(bad);assert.throws(()=>snapshot.validate(bad,selected,"localhost"));
  }
  feasForecasts++;
}
assert.equal(feasForecasts,22);
const a=catalog.products.find(p=>p.id==="aupq35");assert.match(a.variants[0].label,/2026-10-04 12:00 UTC/);assert.match(a.variants[1].label,/2026-10-04 00:00 UTC/);assert.equal(a.variants[2].id,"aupq35-reviewed");
const bad=structuredClone(catalog);bad.products.find(p=>p.id==="aupq35").variants[0].analysis_path="../private/trial.json";assert.throws(()=>ChartCatalog.validate(bad));
console.log(`SNAPSHOT_TESTS_OK latest_pages=${recent} trial_sources=${analyses} forecast_color_sources=${forecasts} feas_forecast_sources=${feasForecasts} maps=${maps} public_source_binding_checked local_trial_not_public approved_status_not_fabricated`);

// Identical values must render alike across fixed and forecast input paths.
const low=require("../low-level.js"),dynamics=require("../dynamics.js");
for(const [pressure,value,color]of [[300,-39,"#558ee0"],[500,-15,"#5485d7"],[700,0,"#b8b8b8"],[850,0,"#b8b8b8"],[700,-36,"#173f8a"],[850,-24,"#173f8a"],[700,15,"#991b1b"],[850,24,"#991b1b"]]){
  assert.equal(ChartAnalysis.temperatureColor(pressure,value),color);
  const scale=snapshot.scales({panels:[{pressure_hpa:pressure,levels:[{temperature_c:value}]}]})[0];
  assert.deepEqual(scale.colors,[color]);assert.equal(scale.opacity,.5);
  if(pressure>=700)assert.equal(low.temperatureColor(pressure,value),color);
}
assert.ok(ChartAnalysis.isothermScales.every(s=>s.opacity===.5));
assert.ok(low.scales.every(s=>s.opacity===.5));
assert.equal(dynamics.scalesFor({panels:[{}, {levels:[{temperature_c:0}]}]})[1].colors[0],"#b8b8b8");
assert.equal(ChartAnalysis.coldColor(850,-12),"#173f8a");
assert.equal(ChartAnalysis.coldColor(850,3),undefined);
assert.equal(ChartAnalysis.coldColor(700,-27),"#173f8a");
assert.throws(()=>ChartAnalysis.temperatureColor(925,0));
const rectangles=[[10,10,60,60],[40,40,90,90]],rectPanel=pressure_hpa=>({pressure_hpa,bounds:[0,0,100,100],levels:[],wet_rectangles:pressure_hpa===700?rectangles:undefined,positive_vorticity_rectangles:pressure_hpa===500?rectangles:undefined,ascent_rectangles:pressure_hpa===850?rectangles:undefined});
const rectangleContext=()=>({fills:[],rectangles:[],save(){},restore(){},clip(){},beginPath(){this.rectangles=[];},rect(...r){this.rectangles.push(r);},fill(){this.fills.push({color:this.fillStyle,opacity:this.globalAlpha,rectangles:[...this.rectangles]});},fillRect(){throw Error("Overlapping fill cells must be composed together before applying transparency");}});
const fixedCtx=rectangleContext(),forecastCtx=rectangleContext(),wetCtx=rectangleContext();
const rectData={panels:[rectPanel(500),rectPanel(850)]};
dynamics.drawFills(fixedCtx,rectData);snapshot.drawFills(forecastCtx,rectData,{vorticity:true,ascent:true});
assert.deepEqual(fixedCtx.fills,forecastCtx.fills);
assert.deepEqual(fixedCtx.fills.map(f=>[f.color,f.opacity]),[["#ec6ca5",.3],["#a3d84b",.3]]);
const wetData={panels:[rectPanel(700)]};low.drawFills(wetCtx,wetData,{wet:true});
const forecastWetCtx=rectangleContext();snapshot.drawFills(forecastWetCtx,wetData,{wet:true});
assert.deepEqual(wetCtx.fills,forecastWetCtx.fills);assert.deepEqual(wetCtx.fills.map(f=>[f.color,f.opacity]),[["#269ed2",.3]]);
console.log("COMMON_COLOR_RULES_OK fixed_and_forecast temperatures_axes_cold_hatches shared_opacity_and_single_fill");
