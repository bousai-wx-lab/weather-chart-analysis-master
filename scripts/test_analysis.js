"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const analysis = require("../analysis.js");
const root = path.resolve(__dirname, "..");
const marks = JSON.parse(fs.readFileSync(path.join(root, "center-symbols.json")));
const actual = JSON.parse(fs.readFileSync(path.join(root, "contours.json")));
const chart = JSON.parse(fs.readFileSync(path.join(root, "chart.json")));
const temperatures = JSON.parse(fs.readFileSync(path.join(root, "isotherms.json")));
analysis.validateIsotherms(temperatures, chart);
assert.deepEqual(temperatures.panels.map(p=>p.pressure_hpa),[300,500]);
assert.deepEqual(temperatures.panels.map(p=>p.levels.map(l=>l.temperature_c)),[[-27,-33,-39,-45,-51],[-3,-6,-9,-12,-15,-18,-21,-24,-27,-30]]);
assert.deepEqual(temperatures.panels[0].levels.at(-1).lines.map(l=>l.points.length),[30,3],"include northern stamps, preserve the real gap");
for (const key of ["source_sha256","image_sha256","observation_time","width","height","unit"]) assert.throws(()=>analysis.validateIsotherms({...temperatures,[key]:"wrong"},chart));
for (const change of [
 d=>{d.panels.reverse();},
 d=>{d.panels[1].pressure_hpa=850;},
 d=>{d.panels[0].levels[0].temperature_c=-36;},
 d=>{d.panels[0].levels[0].lines[0].points[1][1]=2000;},
 d=>{d.panels[1].levels[0].lines[0].points[1][1]=900;},
 d=>{d.panels[1].levels[0].lines[0].points[1][0]=NaN;},
 d=>{d.panels[0].levels[0].lines[0].closed=false;},
 d=>{d.panels[1].levels[0].labels[0][0]+=3;},
 d=>{d.panels[0].levels.at(-1).lines=[{points:d.panels[0].levels.at(-1).lines.flatMap(l=>l.points),closed:false}];},
 d=>{d.panels[1].bounds[1]=100;}
]) {const bad=structuredClone(temperatures);change(bad);assert.throws(()=>analysis.validateIsotherms(bad,chart));}
for (const pressure of [300,500]) {
 const strokes=[],coords=[],clips=[],rects=[],dashes=[],widths=[],alphas=[];
 const ctx={save(){},restore(){},setLineDash(dash){this.dash=[...dash];},beginPath(){},rect(...r){rects.push(r);},clip(rule){clips.push(rule);},moveTo(){},bezierCurveTo(...c){coords.push(c);},stroke(){strokes.push(this.strokeStyle);dashes.push([...this.dash]);widths.push(this.lineWidth);alphas.push(this.globalAlpha);},fill(){throw Error("temperature area fill forbidden");}};
 analysis.drawIsotherms(ctx,temperatures,[pressure]);
 const panel=temperatures.panels.find(p=>p.pressure_hpa===pressure),scale=analysis.isothermScales.find(s=>s.pressure_hpa===pressure);
 assert.deepEqual(strokes,panel.levels.flatMap((l,i)=>Array(l.lines.length).fill(scale.colors[i])));
 assert.ok(dashes.every(d=>d.length===0),"do not introduce a second dash pattern over the original chart");
 assert.ok(alphas.every(a=>a===(pressure===500?0.5:1)),"500hPa reveals original black dashes; 300hPa stays opaque");
 assert.ok(widths.every(w=>w===3.5),"both temperature guides use the requested thinner stroke");
 assert.deepEqual(clips,["evenodd"],"protect printed stamps in each independently clipped panel");
 assert.deepEqual(rects[0],[panel.bounds[0],panel.bounds[1],panel.bounds[2]-panel.bounds[0],panel.bounds[3]-panel.bounds[1]]);
 assert.ok(coords.flat().every(Number.isFinite));
 assert.ok(coords.every(c=>c.filter((_,i)=>i%2).every(y=>pressure===300?y<chart.height/2:y>chart.height/2)),"never draw a plane's temperature guide on the other panel");
 const brightness=scale.colors.map(c=>c.slice(1).match(/../g).map(v=>parseInt(v,16))).map(rgb=>rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722);
 assert.ok(brightness.every((v,i)=>i===0||v<brightness[i-1]),"each colder step must become darker");
}
const roundedBend=analysis.isothermSegments([[100,100],[200,100],[200,200]]);
assert.ok(roundedBend[0].end.every((v,k)=>v-roundedBend[0].c2[k]>0),"soft tangent at right-angle stamp sequence");
for (const panel of temperatures.panels) for (const level of panel.levels) for (const line of level.lines) {
 const segments=analysis.isothermSegments(line.points,line.closed);
 assert.equal(segments.length,line.points.length-1+Number(line.closed));
 for (let i=Number(!line.closed);i<segments.length;i++) {
  const previous=segments[(i+segments.length-1)%segments.length],current=segments[i];
  assert.deepEqual(previous.end,current.start,"curves interpolate every stamp, including loop closure");
  const u=previous.end.map((v,k)=>v-previous.c2[k]),v=current.c1.map((n,k)=>n-current.start[k]);
  assert.ok(Math.abs(u[0]*v[1]-u[1]*v[0])<1e-6,"continuous tangent through all points and the closed seam");
  assert.ok(u[0]*v[0]+u[1]*v[1]>=-1e-8,"no tangent reversal");
 }
}
console.log("TEMPERATURE_LINES_OK 300hPa=5_levels_6_runs 500hPa=10_levels_24_runs closed_seams=smooth binding=checked plane_isolation=checked labels=protected cold_darkening=checked");
analysis.validateSymbols(marks, chart);
for (const [hpa, expected] of [[300, {L:5,H:5,C:9,W:6}], [500, {L:2,H:3,C:9,W:11}]]) {
  const counts = Object.fromEntries(Object.keys(expected).map(letter => [letter, marks.symbols.filter(s => s.letter === letter && s.pressure_hpa === hpa).length]));
  assert.deepEqual(counts, expected, `all four letter types must be covered on the ${hpa} hPa panel`);
}
assert.deepEqual(analysis.symbolPalette, { L: "#dc2626", H: "#2563eb", C: "#38bdf8", W: "#f97316" });
for (const key of ["source_sha256", "image_sha256", "observation_time", "width", "height"]) assert.throws(() => analysis.validateSymbols({ ...marks, [key]: "mismatch" }, chart));
for (const change of [
  (m) => { m.symbols.pop(); },
  (m) => { m.symbols[0].letter = "X"; },
  (m) => { m.symbols[0].pressure_hpa = 500; },
  (m) => { m.symbols[0].strokes[0].width_px = 30; },
  (m) => { m.symbols[0].strokes[0].points[0][0] = -1; },
  (m) => { m.symbols[0].strokes[0].points[0][1] = NaN; }
]) { const bad = structuredClone(marks); change(bad); assert.throws(() => analysis.validateSymbols(bad, chart)); }
const symbolStrokes = [];
const symbolCtx = { save(){}, restore(){}, beginPath(){}, moveTo(){}, lineTo(){}, stroke(){symbolStrokes.push({ color:this.strokeStyle, width:this.lineWidth, composite:this.globalCompositeOperation, alpha:this.globalAlpha });}, fill(){throw Error("symbol background fill forbidden");}, fillRect(){throw Error("symbol rectangle fill forbidden");} };
analysis.drawSymbols(symbolCtx, marks);
assert.equal(symbolStrokes.length, marks.symbols.reduce((n,s) => n+s.strokes.length,0));
assert.ok(symbolStrokes.every(s => Object.values(analysis.symbolPalette).includes(s.color) && s.composite === "source-over" && s.alpha === 0.5));
assert.deepEqual(symbolStrokes.map(s=>s.width), marks.symbols.flatMap(s=>s.strokes.map(stroke=>stroke.width_px+1.5)), "color extends slightly beyond original glyph strokes");
console.log("CENTER_SYMBOL_COLORS_OK fixed_glyphs=50 both_panels=checked source_binding=checked original_black=visible opacity=50_percent stroke_expansion=1.5px background_fill=absent malformed_data=blocked");
assert.throws(() => analysis.analyze({panels:[{}, {pressure_hpa:500}]}), "missing reviewed height axes must not silently fall back to an incomplete heuristic");
analysis.validate(actual, chart);
for (const key of ["source_sha256", "image_sha256", "observation_time", "width", "height"]) assert.throws(() => analysis.validate({ ...actual, [key]: "mismatch" }, chart));
const invalid = structuredClone(actual); invalid.panels[0].curves[0][0][0] = Infinity;
assert.throws(() => analysis.validate(invalid, chart));
const result = analysis.analyze(actual);
assert.equal(result.troughs.length, 4); assert.equal(result.ridges.length, 2); assert.equal(result.jets.length, 0, "height contours alone must not create a strong-wind axis");
for (const [name, index] of [["troughs", 1],["ridges",1]]) {
  const [left, top, right, bottom] = actual.panels[index].bounds;
  for (const curve of result[name]) for (const [x, y] of curve) assert.ok(x >= left && x <= right && y >= top && y <= bottom, "candidate must stay inside its pressure panel");
}
assert.deepEqual(actual.height_axes.axes.filter(a=>a.kind==="trough").map(a=>a.id),["west-short","north-short","low-southwest","japan"]);
assert.deepEqual(actual.height_axes.axes.filter(a=>a.kind==="ridge").map(a=>a.id),["west-ridge","east-ridge"]);
assert.equal(actual.height_axes.axes[0].contour_crossings.length,2,"short waves are no longer excluded by a three-open-contour condition");
assert.ok(actual.height_axes.axes[2].contour_crossings.some(h=>h.curve_index===2),"the low-adjacent trough includes a closed height contour");
for (const change of [
 d=>{delete d.height_axes;},d=>{d.height_axes.pressure_hpa=300;},
 d=>{d.height_axes.axes[0].kind="jet";},d=>{d.height_axes.axes[0].points[0][1]=200;},
 d=>{d.height_axes.axes[0].points[0][0]=NaN;},d=>{d.height_axes.axes[0].contour_crossings[0].curve_index=100;},
 d=>{d.height_axes.axes[0].contour_crossings[0].point[0]+=20;},
 d=>{d.height_axes.axes.push(structuredClone(d.height_axes.axes[0]));},
 d=>{d.panels[1].curves[7]=d.panels[1].curves[7].map(p=>[p[0]+30,p[1]]);}
]) {const bad=structuredClone(actual);change(bad);assert.throws(()=>analysis.validateHeightAxes(bad));}
console.log("HEIGHT_AXES_OK reviewed_troughs=4 reviewed_ridges=2 short_waves=covered closed_low=covered source_contour_anchors=checked malformed_and_missing=blocked");
for (const points of [...result.troughs, [[100,100],[100,200],[200,200]], [[100,100],[100,200]]]) {
  const input = structuredClone(points), paths = [];
  let segments, start, previous, saved;
  const ctx = { globalAlpha: 1, save(){ saved = this.globalAlpha; }, restore(){ this.globalAlpha = saved; },
    beginPath(){ segments = []; }, moveTo(x,y){ start = previous = [x,y]; },
    bezierCurveTo(x1,y1,x2,y2,x,y){ const end=[x,y]; segments.push({start:previous,c1:[x1,y1],c2:[x2,y2],end}); previous=end; },
    lineTo(){ throw Error("troughs must use curves, not straight vertices"); },
    stroke(){ paths.push({start,segments,color:this.strokeStyle,width:this.lineWidth,alpha:this.globalAlpha}); }
  };
  analysis.drawTroughs(ctx,[points]);
  assert.deepEqual(points,input,"display smoothing must not change analysis anchors");
  assert.equal(paths.length,2); assert.equal(ctx.globalAlpha,1);
  assert.ok(paths.every(p=>p.color==="#f02020" && p.width===4 && p.alpha===0.85));
  assert.equal(paths[0].segments.length,paths[1].segments.length);
  const vertices=paths.map(p=>[p.start,...p.segments.map(s=>s.end)]);
  const centers=vertices[0].map((p,i)=>p.map((v,k)=>(v+vertices[1][i][k])/2));
  for (const anchor of points) assert.ok(centers.some(p=>Math.hypot(p[0]-anchor[0],p[1]-anchor[1])<1e-7),"curved center must pass through every original anchor");
  for (const [i,p] of vertices[0].entries()) assert.ok(Math.abs(Math.hypot(p[0]-vertices[1][i][0],p[1]-vertices[1][i][1])-10)<1e-7,"double-line separation stays ten pixels");
  for (const path of paths) for (const [i,s] of path.segments.entries()) {
    assert.ok([s.start,s.c1,s.c2,s.end].flat().every(Number.isFinite));
    if (i) {
      const before=path.segments[i-1],u=before.end.map((v,k)=>v-before.c2[k]),v=s.c1.map((n,k)=>n-s.start[k]);
      assert.ok(Math.abs(u[0]*v[1]-u[1]*v[0])<1e-6 && u[0]*v[0]+u[1]*v[1]>0,"no corner or reversal at a curve join");
    }
  }
}
console.log("TROUGH_CURVES_OK anchors=preserved shared_tangents=continuous double_line_spacing=10px color=red straight_and_bent_and_reviewed=checked");
for (const points of [...result.ridges,[[100,100],[212,100]]]) {
 const paths=[];let current,saved;
 const ctx={globalAlpha:1,save(){saved=this.globalAlpha;},restore(){this.globalAlpha=saved;},beginPath(){current=[];},moveTo(x,y){current.push([x,y]);},lineTo(x,y){current.push([x,y]);},stroke(){paths.push({points:current,color:this.strokeStyle,width:this.lineWidth,alpha:this.globalAlpha});}};
 analysis.drawRidges(ctx,[points]);
 assert.equal(paths.length,1);assert.equal(ctx.globalAlpha,1);
 const path=paths[0];assert.equal(path.color,"#2563eb");assert.equal(path.width,4);assert.equal(path.alpha,0.85);
 assert.deepEqual(path.points[0],points[0]);assert.deepEqual(path.points.at(-1),points.at(-1));
 assert.ok(path.points.flat().every(Number.isFinite));assert.ok(path.points.length>4);
 if (points[0][0]===100) for (const [i,p] of path.points.slice(1,-1).entries()) {
  assert.ok(Math.abs(p[0]-(114+i*14))<1e-7);assert.ok(Math.abs(p[1]-(100+(i%2 ? -6:6)))<1e-7,"ridge must alternate across the axis in a true zigzag");
 }
}
console.log("RIDGE_ZIGZAG_OK blue=checked alternating_teeth=checked spacing=14px amplitude=6px endpoints=preserved actual_branches=checked");
const wind = JSON.parse(fs.readFileSync(path.join(root, "wind-bands.json")));
analysis.validateWindBands(wind, chart);
for (const key of ["source_sha256", "image_sha256", "observation_time", "width", "height", "pressure_hpa", "unit"]) assert.throws(() => analysis.validateWindBands({ ...wind, [key]: "mismatch" }, chart));
for (const change of [
  (w) => { w.bands[0].min_kt = 20; },
  (w) => { w.bands[0].rings = []; },
  (w) => { w.bands[0].rings[0][0][1] = 2000; },
  (w) => { w.bands[0].rings[0][0][0] = NaN; },
  (w) => { w.bounds = [0, 0, chart.width, chart.height]; }
]) { const bad = structuredClone(wind); change(bad); assert.throws(() => analysis.validateWindBands(bad, chart)); }
// Independent ray casting checks region topology, including weak-wind holes.
function inRegion([x, y], rings) {
  let inside = false;
  for (const ring of rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
const intervalAt = (point) => wind.bands.filter((b) => inRegion(point, b.rings)).at(-1)?.min_kt || 0;
for (const [point, expected] of [[[1500,640],120],[[1850,390],100],[[735,330],80],[[1780,490],60],[[1880,550],40],[[1400,280],0],[[400,180],0],[[450,140],40],[[1000,1800],0]]) assert.equal(intervalAt(point),expected,"reviewed wind interval or weak-wind hole");
let samples = 0;
for (let x = 75; x < 1990; x += 20) for (let y = 135; y < 1440; y += 20) {
  const inside = wind.bands.map((b) => inRegion([x,y],b.rings));
  for (let i = 1; i < inside.length; i++) assert.ok(!inside[i] || inside[i-1],"higher-speed region must be inside lower threshold");
  samples++;
}
const luminance = (hex) => {
  const rgb = hex.slice(1).match(/../g).map((v) => parseInt(v,16)/255).map((v) => v <= 0.04045 ? v/12.92 : ((v+0.055)/1.055)**2.4);
  return rgb[0]*0.2126 + rgb[1]*0.7152 + rgb[2]*0.0722;
};
const lightness = analysis.windPalette.map(luminance);
for (let i = 1; i < lightness.length; i++) assert.ok(lightness[i] < lightness[i-1],"higher wind speeds must have darker colors");
const fills = [];
const ctx = { save(){},restore(){},beginPath(){},rect(){},clip(){},moveTo(){},lineTo(){},closePath(){},fill(rule){fills.push([this.fillStyle,rule]);} };
analysis.drawWindBands(ctx,wind);
assert.deepEqual(fills,analysis.windPalette.map((color) => [color,"evenodd"]));
console.log(`ISOTACH_BANDS_OK source_binding=checked units=checked malformed_data=blocked known_intervals=checked nested_samples=${samples} darkening=checked weak_holes=checked`);

const guides = JSON.parse(fs.readFileSync(path.join(root, "jet-guides.json")));
analysis.validateJetGuides(guides, chart, wind);
for (const key of ["source_sha256", "image_sha256", "observation_time", "width", "height", "pressure_hpa"]) assert.throws(() => analysis.validateJetGuides({ ...guides, [key]: "mismatch" }, chart, wind));
for (const change of [
  (g) => { g.axes[0].points[0][1] = 2000; },
  (g) => { g.axes[0].points[1] = [...g.axes[0].points[0]]; },
  (g) => { g.axes[0].points[0][0] = Infinity; },
  (g) => { g.axes[0].search_radius_px = 1000; }
]) { const bad = structuredClone(guides); change(bad); assert.throws(() => analysis.validateJetGuides(bad, chart, wind)); }
const rectangle = (y0, y1) => [[[0,y0],[400,y0],[400,y1],[0,y1]]];
const syntheticWind = { bounds:[0,0,400,400], bands:[{min_kt:40,rings:rectangle(120,280)},{min_kt:60,rings:rectangle(150,260)},{min_kt:80,rings:rectangle(210,230)}] };
const syntheticGuide = { axes:[{search_radius_px:90,points:[[50,200],[150,200],[250,200],[350,200]]}] };
for (const center of analysis.jets(syntheticWind,syntheticGuide)[0].centers) assert.equal(center.point[1],220,"known fastest strip, not the wider surrounding band's center");
const shiftedWind = structuredClone(syntheticWind); shiftedWind.bands[2].rings = rectangle(180,200);
for (const center of analysis.jets(shiftedWind,syntheticGuide)[0].centers) assert.equal(center.point[1],190,"moving the wind maximum moves the axis with an unchanged guide");
assert.equal(analysis.jets({...syntheticWind,bands:[]},syntheticGuide).length,0,"missing wind must not produce an axis by copying the guide");
const strongAxes = analysis.analyze(actual,wind,guides).jets;
assert.equal(strongAxes.length,3,"three separate downwind branches on the reviewed chart");
const bezier = (s,t) => [0,1].map(i => (1-t)**3*s.start[i]+3*(1-t)**2*t*s.c1[i]+3*(1-t)*t*t*s.c2[i]+t**3*s.end[i]);
let curveSamples = 0;
for (const axis of strongAxes) {
  for (const center of axis.centers) assert.equal(intervalAt(center.point),center.min_kt,"center must lie in the selected strongest wind interval");
  for (const [index, s] of axis.segments.entries()) {
    if (index) {
      const before = axis.segments[index-1];
      for (const i of [0,1]) assert.ok(Math.abs((before.end[i]-before.c2[i])-(s.c1[i]-s.start[i]))<1e-8,"shared curve tangents must not form corners");
    }
    for (let step=0; step<=50; step++) {
      const p=bezier(s,step/50);
      assert.ok(p[0]>=wind.bounds[0] && p[0]<=wind.bounds[2] && p[1]>=wind.bounds[1] && p[1]<=wind.bounds[3],"smooth axis must remain in the upper panel");
      assert.ok(intervalAt(p)>=40,"smooth axis must stay in a strong-wind band");
      curveSamples++;
    }
  }
}
assert.ok(strongAxes[0].segments.at(-1).end[0]>strongAxes[0].segments[0].start[0] && strongAxes[0].segments.at(-1).end[1]>strongAxes[0].segments[0].start[1],"western branch flows southeast");
assert.ok(strongAxes[1].segments.at(-1).end[1]>strongAxes[1].segments[0].start[1],"northern branch flows south then southeast");
assert.ok(strongAxes[2].segments.at(-1).end[0]>1900,"main branch flows into the eastern edge");
const drawCalls=[];
const jetCtx={save(){},restore(){},beginPath(){},rect(){},clip(){},moveTo(){},lineTo(){},stroke(){drawCalls.push(['stroke',this.strokeStyle]);},bezierCurveTo(){drawCalls.push(['curve']);}};
analysis.drawJetAxes(jetCtx,strongAxes,wind.bounds);
assert.equal(drawCalls.filter(c=>c[0]==='stroke').length,6,"one smooth shaft and one arrowhead per branch");
assert.ok(drawCalls.filter(c=>c[0]==='stroke').every(c=>c[1]==='#f02020'),"all axes and arrowheads use the same red");
console.log(`WIND_AXES_OK strongest_strip=checked shifted_maximum=checked no_height_only_axis=checked source_binding=checked branches=3 smooth_samples=${curveSamples} directions=checked arrows=checked`);

const geography = require("../geography.js");
const coast = JSON.parse(fs.readFileSync(path.join(root, "land-sea.json")));
geography.validate(coast, chart);
assert.equal(geography.patterns.length, 10);
assert.equal(new Set(geography.patterns.map(p => p.id)).size, 10);
assert.deepEqual(geography.patterns.map(p => p.id), ['dots', 'elevation', 'diagonal', 'cross', 'elevation-relief', 'waves', 'paper', 'sand', 'satellite', 'grass']);
for (const key of ["source_sha256", "image_sha256", "observation_time", "width", "height"]) assert.throws(() => geography.validate({ ...coast, [key]: "mismatch" }, chart));
for (const change of [
  g => { g.rings.pop(); },
  g => { g.rings[0].pop(); },
  g => { g.rings[0][1][0] = NaN; },
  g => { g.panels[1].offset_y = 1400; },
  g => { g.satellite.path = "unexpected.png"; }
]) { const bad = structuredClone(coast); change(bad); assert.throws(() => geography.validate(bad, chart)); }
const geoPoint = (longitude, latitude) => {
  const radius = coast.projection.radius_scale_px * Math.tan((90 - latitude) * Math.PI / 360);
  const angle = (longitude - 140) * Math.PI / 180;
  return [coast.projection.pole[0] + radius * Math.sin(angle), coast.projection.pole[1] + radius * Math.cos(angle)];
};
for (const [longitude, latitude, land, name] of [
  [116.4, 39.9, true, "Beijing"], [139.76, 35.68, true, "Tokyo"],
  [137, 36, true, "central Honshu"], [143, 43, true, "Hokkaido"],
  [126.5, 38.2, true, "Korea"], [103, 45, true, "Mongolia"],
  [160, 30, false, "Pacific"], [135, 40, false, "Sea of Japan"],
  [108, 53.5, false, "Lake Baikal"], [130, 30, false, "East China Sea"]
]) assert.equal(inRegion(geoPoint(longitude, latitude), coast.rings), land, name);
assert.equal(require("node:crypto").createHash("sha256").update(fs.readFileSync(path.join(root, coast.satellite.path))).digest("hex"), coast.satellite.image_sha256);
assert.ok(coast.projection.maximum_graticule_fit_error_px < 0.5);
console.log("LAND_SEA_OK patterns=10 source_binding=checked malformed_data=blocked geographic_land_and_water=10 satellite_hash=checked projection_fit=checked");

const terrain = JSON.parse(fs.readFileSync(path.join(root, "elevation.json")));
geography.validateElevation(terrain, chart);
for (const key of ["source_sha256", "image_sha256", "observation_time", "width", "height"]) assert.throws(() => geography.validateElevation({ ...terrain, [key]: "mismatch" }, chart));
for (const change of [
  t => { t.source.units = "feet"; },
  t => { t.source.native_resolution_arc_seconds = 1; },
  t => { t.image.height = 1322; },
  t => { t.image.sha256 = "unverified"; },
  t => { t.legend.boundaries_m.reverse(); },
  t => { t.styles[1].row = 0; }
]) { const bad = structuredClone(terrain); change(bad); assert.throws(() => geography.validateElevation(bad, chart)); }
assert.equal(require("node:crypto").createHash("sha256").update(fs.readFileSync(path.join(root, terrain.image.path))).digest("hex"), terrain.image.sha256);
assert.deepEqual(terrain.legend.boundaries_m, [200, 500, 1000, 2000, 4000, 6000]);
for (const p of terrain.reviewed_points) assert.ok(p.elevation_m >= p.expected_range_m[0] && p.elevation_m <= p.expected_range_m[1], p.place);
console.log("ELEVATION_OK native_units=metres source_binding=checked atlas_hash=checked legend=checked source_points=5 removed_options=3 invalid_data=blocked");

const registration = analysis.validatePanelRegistration(coast,chart);
assert.equal(registration.observation_time,"2026-10-02T00:00:00Z");
for (const key of ["source_sha256","image_sha256","observation_time","width","height"]) assert.throws(() => analysis.validatePanelRegistration({...coast,[key]:"mismatch"},chart));
for (const change of [
 d=>{d.panels.reverse();}, d=>{d.panels[1].offset_y+=10;}, d=>{d.panels[0].bounds[0]+=10;},
 d=>{d.panels[1].pressure_hpa=850;}, d=>{d.projection.type="mercator";}, d=>{d.projection.radius_scale_px=NaN;}
]) { const bad=structuredClone(coast);change(bad);assert.throws(()=>analysis.validatePanelRegistration(bad,chart)); }
const overlayCandidates = analysis.analyze(actual,wind,guides), untouchedCandidates = JSON.stringify(overlayCandidates);
function recordCanvas() {
 const stack=[],strokes=[],clips=[];let points=[],rectangles=[];
 return { tx:0,ty:0,globalAlpha:1,strokes,clips,
  save(){stack.push({tx:this.tx,ty:this.ty,globalAlpha:this.globalAlpha});},
  restore(){Object.assign(this,stack.pop());},
  translate(x,y){this.tx+=x;this.ty+=y;},
  beginPath(){points=[];rectangles=[];},
  rect(x,y,w,h){rectangles.push([x+this.tx,y+this.ty,w,h]);},clip(){clips.push(...rectangles);},
  moveTo(x,y){points.push([x+this.tx,y+this.ty]);},lineTo(x,y){points.push([x+this.tx,y+this.ty]);},
  bezierCurveTo(...p){for(let i=0;i<p.length;i+=2)points.push([p[i]+this.tx,p[i+1]+this.ty]);},
  stroke(){strokes.push({points:[...points],alpha:this.globalAlpha,color:this.strokeStyle,width:this.lineWidth});}
 };
}
for (const tool of analysis.overlayAnalyses) {
 const targetHpa=tool.source_hpa===300 ? 500 : 300;
 const layer=analysis.createPanelOverlay(registration,"reviewed-source",tool.id,targetHpa);
 const base=recordCanvas();
 if(tool.kind==="jet")analysis.drawJetAxes(base,overlayCandidates.jets,coast.panels[0].bounds);
 if(tool.kind==="trough")analysis.drawTroughs(base,overlayCandidates.troughs);
 if(tool.kind==="ridge")analysis.drawRidges(base,overlayCandidates.ridges);
 // Independent geographic expectation: corresponding pixels have identical x
 // and a fixed 1416.38px map-origin separation in this reviewed source page.
 const expectedShift=targetHpa===500 ? 1416.38 : -1416.38;
 for(const opacity of [0,.35,1]) {
  const copy=recordCanvas();analysis.drawPanelOverlay(copy,overlayCandidates,registration,{...layer,opacity},"reviewed-source");
  assert.equal(copy.strokes.length,base.strokes.length);
  for(let i=0;i<base.strokes.length;i++) {
   const original=base.strokes[i],overlaid=copy.strokes[i];
   assert.equal(overlaid.color,original.color);assert.equal(overlaid.width,original.width);
   assert.ok(Math.abs(overlaid.alpha-original.alpha*opacity)<1e-12);
   assert.equal(overlaid.points.length,original.points.length);
   for(let j=0;j<original.points.length;j++) {
    assert.ok(Math.abs(overlaid.points[j][0]-original.points[j][0])<1e-9);
    assert.ok(Math.abs(overlaid.points[j][1]-original.points[j][1]-expectedShift)<1e-9);
   }
  }
  const bounds=coast.panels.find(p=>p.pressure_hpa===targetHpa).bounds;
  assert.deepEqual(copy.clips[0],[bounds[0],bounds[1],bounds[2]-bounds[0],bounds[3]-bounds[1]],"clip to destination map, including jet arrowheads");
  assert.equal(copy.tx,0);assert.equal(copy.ty,0);assert.equal(copy.globalAlpha,1);
 }
}
const sampleOverlay=analysis.createPanelOverlay(registration,"reviewed-source","jet",500);
for(const opacity of [-.1,1.1,NaN,Infinity])assert.throws(()=>analysis.drawPanelOverlay(recordCanvas(),overlayCandidates,registration,{...sampleOverlay,opacity},"reviewed-source"));
assert.throws(()=>analysis.drawPanelOverlay(recordCanvas(),overlayCandidates,null,sampleOverlay,"reviewed-source"));
assert.throws(()=>analysis.createPanelOverlay(registration,"reviewed-source","jet",850));
assert.throws(()=>analysis.createPanelOverlay(registration,"reviewed-source","jet",300));
assert.throws(()=>analysis.createPanelOverlay(registration,"reviewed-source","unknown",500));
for(const [key,value] of [["source_hpa",500],["source_key","other-source"],["observation_time","2026-10-01T12:00:00Z"],["source_sha256","other-file"],["image_sha256","other-image"],["enabled","yes"]]) {
 assert.throws(()=>analysis.validatePanelOverlay({...sampleOverlay,[key]:value},registration,"reviewed-source"));
}
const restored=JSON.parse(JSON.stringify({...sampleOverlay,enabled:false,opacity:.35}));
analysis.validatePanelOverlay(restored,registration,"reviewed-source");
assert.equal(restored.enabled,false);assert.equal(restored.opacity,.35);
assert.equal(sampleOverlay.id,analysis.createPanelOverlay(registration,"reviewed-source","jet",500).id,"the same source/item/destination has one stable identity");
assert.notEqual(sampleOverlay.id,analysis.createPanelOverlay(registration,"other-source","jet",500).id,"different source charts have distinct identities");
assert.equal(JSON.stringify(overlayCandidates),untouchedCandidates,"copies never modify native analyses");
console.log("PANEL_OVERLAYS_OK directions=both types=jet_trough_ridge geometry=every_vertex_and_arrowhead clip=destination opacity=zero_middle_full source_and_time_binding=checked originals=unchanged invalid_registration=blocked");
