"use strict";
// Review-bound height axes and wind-band centerlines on one chart.
const ChartAnalysis = (() => {
  // Pressure and element own the style; product-specific data own geometry.
  const coloringRules = Object.freeze({
    temperatureOpacity: .5, symbolOpacity: .5, coldOpacity: .35, warmOpacity: .35,
    coldThresholds: Object.freeze({700:Object.freeze([-15,-18,-21,-24,-27]),850:Object.freeze([0,-3,-6,-9,-12])}),
    coldColors: Object.freeze(["#a0d8fa","#74b9ef","#558ee0","#2c64b7","#173f8a"]),
    warmThresholds: Object.freeze([9,12,15,18,21,24]),
    warmColors: Object.freeze(["#fff3a6","#ffd166","#ff914d","#ef4444","#c92d35","#991b1b"]),
    wet: Object.freeze({color:"#269ed2",opacity:.3}),
    vorticity: Object.freeze({color:"#ec6ca5",opacity:.3}),
    ascent: Object.freeze({color:"#a3d84b",opacity:.3}),
    axes: Object.freeze({trough:"#ef2323",ridge:"#2563eb",opacity:1,width:4}),
    jetOutline: Object.freeze({color:"#ffffff",width:4}),
    tropopauseMinimum: 150, tropopauseOpacity: .35,
    tropopauseBoundary: Object.freeze({color:"#7e22ce",width:1.5,opacity:.7}),
    tropopauseStops: Object.freeze([[150,"#f8bbd0"],[200,"#ec4899"],[250,"#c026d3"],[300,"#9333ea"],[350,"#6b21a8"],[400,"#3b0764"]].map(Object.freeze)),
    precipitationOpacity: .45,
    precipitationColors: Object.freeze(["#bceefa","#91dbf4","#60c2eb","#329fdc","#147fc0","#0861a8"]),
    equivalentOpacity: .45,
    equivalentStops: Object.freeze([[260,"#173f8a"],[280,"#3485d4"],[300,"#7acbef"],[315,"#eef4d3"],[330,"#ffd166"],[350,"#ef7046"],[370,"#991b1b"]].map(Object.freeze))
  });
  function mixColor(a,b,f) {
    const rgb=c=>c.slice(1).match(/../g).map(v=>parseInt(v,16));
    return "#"+rgb(a).map((v,j)=>Math.round(v+(rgb(b)[j]-v)*f).toString(16).padStart(2,"0")).join("");
  }
  function temperatureColor(pressure,value) {
    if([200,250].includes(pressure))return mixColor("#a0d8fa","#4c1d95",Math.max(0,Math.min(1,(-value-42)/24)));
    if(pressure===300 || pressure===500){
      const scale=isothermScales.find(s=>s.pressure_hpa===pressure);
      const i=Math.max(0,Math.min(scale.colors.length-1,Math.round((-value-(pressure===300?27:3))/(pressure===300?6:3))));
      return scale.colors[i];
    }
    if(![700,850].includes(pressure))throw Error("Unsupported temperature pressure");
    const warm=value>0,limit=warm?(pressure===850?24:15):(pressure===850?24:36);
    const stops=warm?["#b8b8b8","#f4d35e","#f89c3c","#e63946",coloringRules.warmColors.at(-1)]:["#b8b8b8","#7acbef","#3485d4","#2c64b7",coloringRules.coldColors.at(-1)];
    const step=Math.min(4,Math.abs(value)/limit*4),i=Math.min(3,Math.floor(step));
    return mixColor(stops[i],stops[i+1],step-i);
  }
  function coldColor(pressure,threshold) {
    return coloringRules.coldColors[coloringRules.coldThresholds[pressure]?.indexOf(threshold)];
  }
  function temperatureScale(pressure,values) {
    return {pressure_hpa:pressure,values,colors:values.map(v=>temperatureColor(pressure,v)),dash:[],opacity:coloringRules.temperatureOpacity};
  }
  function drawRectangleFill(ctx,rectangles,style) {
    if(!rectangles?.length)return;
    ctx.save();ctx.globalAlpha=style.opacity;ctx.fillStyle=style.color;ctx.beginPath();
    for(const [x,y,r,b]of rectangles)ctx.rect(x,y,r-x,b-y);
    ctx.fill();ctx.restore();
  }
  function validate(data, chart) {
    if (data.schema_version !== 1 || data.source_sha256 !== chart.source_sha256 || data.image_sha256 !== chart.image_sha256 || data.observation_time !== chart.observation_time || data.width !== chart.width || data.height !== chart.height || !Array.isArray(data.panels) || data.panels.length !== 2) throw new Error("解析資料が原図と一致しません");
    for (const [index, panel] of data.panels.entries()) {
      if (panel.pressure_hpa !== [300, 500][index] || panel.bounds.length !== 4 || panel.pole.length !== 2 || ![...panel.bounds, ...panel.pole].every(Number.isFinite) || !Array.isArray(panel.curves) || panel.curves.length > 100) throw new Error("解析資料の形式を確認できません");
      for (const curve of panel.curves) if (!Array.isArray(curve) || curve.length < 2 || curve.length > 1500 || !curve.every((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && p[0] >= 0 && p[0] <= data.width && p[1] >= 0 && p[1] <= data.height)) throw new Error("解析資料の線を確認できません");
    }
    if (data.height_axes) validateHeightAxes(data);
    return data;
  }
  function validateHeightAxes(data) {
    const reviewed = data.height_axes, panel = data.panels[1];
    if (!reviewed || reviewed.pressure_hpa !== 500 || panel.pressure_hpa !== 500 || !Array.isArray(reviewed.axes) || !reviewed.axes.length || reviewed.axes.length > 20) throw new Error("トラフ・リッジの資料を確認できません");
    const ids = new Set(), [left, top, right, bottom] = panel.bounds;
    const validPoint = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && left <= p[0] && p[0] <= right && top <= p[1] && p[1] <= bottom;
    const distanceToSegment = (p,a,b) => {
      const dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;
      const t=length ? Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length)) : 0;
      return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
    };
    for (const axis of reviewed.axes) {
      if (typeof axis.id !== "string" || !/^[a-z-]{1,40}$/.test(axis.id) || ids.has(axis.id) || !["trough","ridge"].includes(axis.kind) || !Array.isArray(axis.points) || axis.points.length < 2 || axis.points.length > 100 || !axis.points.every((p,i) => validPoint(p) && (!i || Math.hypot(p[0]-axis.points[i-1][0],p[1]-axis.points[i-1][1]) > 1)) || !Array.isArray(axis.contour_crossings) || axis.contour_crossings.length < 2 || axis.contour_crossings.length > 50) throw new Error("トラフ・リッジの軸が不正です");
      ids.add(axis.id);
      const contours = new Set();
      for (const crossing of axis.contour_crossings) {
        const curve = panel.curves[crossing.curve_index];
        if (!Number.isInteger(crossing.curve_index) || !curve || !validPoint(crossing.point) || !axis.points.some(p => Math.hypot(p[0]-crossing.point[0],p[1]-crossing.point[1]) < 0.01) || !curve.slice(1).some((p,i) => distanceToSegment(crossing.point,curve[i],p) < 0.01)) throw new Error("解析軸と原図の等高度線が一致しません");
        contours.add(crossing.curve_index);
      }
      if (contours.size < 2) throw new Error("解析軸の等高度線を確認できません");
    }
    return reviewed;
  }
  function analyze(data, wind, guides) {
    const axes = validateHeightAxes(data).axes;
    return { troughs: axes.filter(a => a.kind === "trough").map(a => a.points), ridges: axes.filter(a => a.kind === "ridge").map(a => a.points), jets: wind && guides ? jets(wind, guides) : [] };
  }
  const windPalette = ["#dcfce7", "#a7edbc", "#65d58d", "#2aaf63", "#087c3d"];
  function validateWindBands(data, chart) {
    if (data.schema_version !== 1 || data.source_sha256 !== chart.source_sha256 || data.image_sha256 !== chart.image_sha256 || data.observation_time !== chart.observation_time || data.width !== chart.width || data.height !== chart.height || data.pressure_hpa !== 300 || data.unit !== "kt" || !Array.isArray(data.bands) || data.bands.length !== 5 || !Array.isArray(data.bounds) || data.bounds.length !== 4 || !data.bounds.every(Number.isFinite)) throw new Error("風速の資料が原図と一致しません");
    const [left, top, right, bottom] = data.bounds;
    if (!(0 <= left && left < right && right <= chart.width && 0 <= top && top < bottom && bottom <= chart.height / 2)) throw new Error("風速の表示範囲が不正です");
    for (const [index, band] of data.bands.entries()) {
      if (band.min_kt !== 40 + index * 20 || !Array.isArray(band.rings) || !band.rings.length || band.rings.length > 10) throw new Error("風速の区分が不正です");
      for (const ring of band.rings) if (!Array.isArray(ring) || ring.length < 3 || ring.length > 2000 || !ring.every((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && p[0] >= left && p[0] <= right && p[1] >= top && p[1] <= bottom)) throw new Error("風速の境界を確認できません");
    }
    return data;
  }
  function drawWindBands(ctx, data) {
    ctx.save();
    const [left, top, right, bottom] = data.bounds;
    ctx.beginPath(); ctx.rect(left, top, right - left, bottom - top); ctx.clip();
    // Threshold regions overlap: the highest interval supplies one opaque color.
    // Even-odd filling leaves genuine weak-wind holes uncolored.
    for (const [index, band] of data.bands.entries()) {
      ctx.fillStyle = windPalette[index]; ctx.beginPath();
      for (const ring of band.rings) {
        ctx.moveTo(...ring[0]);
        for (const point of ring.slice(1)) ctx.lineTo(...point);
        ctx.closePath();
      }
      ctx.fill("evenodd");
    }
    ctx.restore();
  }
  function validateJetGuides(data, chart, wind) {
    if (data.schema_version !== 1 || data.source_sha256 !== chart.source_sha256 || data.image_sha256 !== chart.image_sha256 || data.observation_time !== chart.observation_time || data.width !== chart.width || data.height !== chart.height || ![250,300].includes(data.pressure_hpa) || data.pressure_hpa !== wind.pressure_hpa || !Array.isArray(data.axes) || !data.axes.length || data.axes.length > 6) throw new Error("強風軸の資料が原図と一致しません");
    const [left, top, right, bottom] = wind.bounds;
    for (const axis of data.axes) {
      if (!Number.isFinite(axis.search_radius_px) || axis.search_radius_px < 10 || axis.search_radius_px > 150 || !Array.isArray(axis.points) || axis.points.length < 3 || axis.points.length > 30 || !axis.points.every((p, i) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && p[0] >= left && p[0] <= right && p[1] >= top && p[1] <= bottom && (!i || Math.hypot(p[0] - axis.points[i - 1][0], p[1] - axis.points[i - 1][1]) >= 10))) throw new Error("強風軸の流れを確認できません");
    }
    return data;
  }
  function inside(point, rings) {
    const [x, y] = point;
    let found = false;
    for (const ring of rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) found = !found;
    }
    return found;
  }
  function strongestCenter(wind, point, normal, radius) {
    const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
    const at = (t) => [point[0] + normal[0] * t, point[1] + normal[1] * t];
    const inBounds = ([x, y]) => x >= wind.bounds[0] && y >= wind.bounds[1] && x <= wind.bounds[2] && y <= wind.bounds[3];
    // Intersect each threshold polygon with a section across the reviewed flow.
    // The highest occupied interval wins, not the closest-spaced height lines.
    for (const band of [...wind.bands].reverse()) {
      const hits = [-radius, radius];
      for (const ring of band.rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = ring[j], b = ring[i], edge = [b[0] - a[0], b[1] - a[1]], delta = [a[0] - point[0], a[1] - point[1]];
        const den = cross(normal, edge);
        if (Math.abs(den) < 1e-8) continue;
        const t = cross(delta, edge) / den, u = cross(delta, normal) / den;
        if (t > -radius && t < radius && u >= 0 && u < 1) hits.push(t);
      }
      hits.sort((a, b) => a - b);
      const intervals = [];
      for (let i = 1; i < hits.length; i++) {
        const mid = (hits[i - 1] + hits[i]) / 2;
        if (hits[i] - hits[i - 1] >= 4 && inBounds(at(mid)) && inside(at(mid), band.rings)) intervals.push(mid);
      }
      if (intervals.length) {
        const offset = intervals.sort((a, b) => Math.abs(a) - Math.abs(b))[0];
        return { point: at(offset), min_kt: band.min_kt };
      }
    }
    return null;
  }
  function smoothCurve(points) {
    // Cubic Hermite interpolation, expressed as Bézier segments. A shared
    // tangent at each join avoids corners; these are display coordinates.
    return points.slice(1).map((end, i) => {
      const start = points[i], before = points[Math.max(0, i - 1)], after = points[Math.min(points.length - 1, i + 2)];
      return { start, c1: [start[0] + (end[0] - before[0]) / 6, start[1] + (end[1] - before[1]) / 6], c2: [end[0] - (after[0] - start[0]) / 6, end[1] - (after[1] - start[1]) / 6], end };
    });
  }
  function jets(wind, guides) {
    const axes = [];
    for (const guide of guides.axes) {
      const centers = guide.points.map((point, i) => {
        const before = guide.points[Math.max(0, i - 1)], after = guide.points[Math.min(guide.points.length - 1, i + 1)];
        const dx = after[0] - before[0], dy = after[1] - before[1], length = Math.hypot(dx, dy);
        return strongestCenter(wind, point, [-dy / length, dx / length], guide.search_radius_px);
      });
      // Missing wind support does not get replaced with the guide itself.
      if (centers.some((p) => !p)) continue;
      axes.push({ segments: smoothCurve(centers.map((p) => p.point)), centers });
    }
    return axes;
  }
  function drawJetAxes(ctx, axes, bounds, opacity = 1) {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.beginPath(); ctx.rect(bounds[0], bounds[1], bounds[2] - bounds[0], bounds[3] - bounds[1]); ctx.clip();
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (const [color,width] of [[coloringRules.jetOutline.color,10+coloringRules.jetOutline.width],["#f02020",10]]) {
      ctx.strokeStyle=color;ctx.lineWidth=width;
      for (const axis of axes) {
        ctx.beginPath(); ctx.moveTo(...axis.segments[0].start);
        for (const segment of axis.segments) ctx.bezierCurveTo(...segment.c1, ...segment.c2, ...segment.end);
        ctx.stroke();
        const last = axis.segments.at(-1), tip = last.end;
        const dx = tip[0] - last.c2[0], dy = tip[1] - last.c2[1], length = Math.hypot(dx, dy);
        const tx = dx / length, ty = dy / length;
        ctx.beginPath(); ctx.moveTo(tip[0] - 30 * tx - 16 * ty, tip[1] - 30 * ty + 16 * tx);
        ctx.lineTo(...tip); ctx.lineTo(tip[0] - 30 * tx + 16 * ty, tip[1] - 30 * ty - 16 * tx); ctx.stroke();
      }
    }
    ctx.restore();
  }
  const symbolPalette = Object.freeze({ L: "#dc2626", H: "#2563eb", C: "#38bdf8", W: "#f97316" });
  function validateSymbols(data, chart) {
    if (!data || data.schema_version !== 1 || data.source_sha256 !== chart.source_sha256 || data.image_sha256 !== chart.image_sha256 || data.observation_time !== chart.observation_time || data.width !== chart.width || data.height !== chart.height || !Array.isArray(data.symbols) || data.symbols.length !== 50) throw new Error("文字の資料が原図と一致しません");
    const counts = { L: 0, H: 0, C: 0, W: 0 };
    for (const symbol of data.symbols) {
      if (!Object.keys(symbolPalette).includes(symbol.letter) || ![300, 500].includes(symbol.pressure_hpa) || !Array.isArray(symbol.bounds) || symbol.bounds.length !== 4 || !symbol.bounds.every(Number.isFinite) || !Array.isArray(symbol.strokes) || symbol.strokes.length !== (symbol.letter === "H" ? 3 : 1)) throw new Error("文字の形式を確認できません");
      const [left, top, right, bottom] = symbol.bounds;
      const lower = symbol.pressure_hpa === 300 ? 0 : chart.height / 2;
      const upper = symbol.pressure_hpa === 300 ? chart.height / 2 : chart.height;
      if (!(0 <= left && left < right && right <= chart.width && lower <= top && top < bottom && bottom <= upper && right - left <= 30 && bottom - top <= 40)) throw new Error("文字の位置を確認できません");
      for (const stroke of symbol.strokes) {
        if (!Number.isFinite(stroke.width_px) || stroke.width_px < 1 || stroke.width_px > 4 || !["butt", "round", "square"].includes(stroke.line_cap) || !Array.isArray(stroke.points) || stroke.points.length < 2 || stroke.points.length > 10 || !stroke.points.every((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && p[0] >= left && p[0] <= right && p[1] >= top && p[1] <= bottom)) throw new Error("文字の線を確認できません");
      }
      counts[symbol.letter]++;
    }
    if (counts.L !== 7 || counts.H !== 8 || counts.C !== 18 || counts.W !== 17) throw new Error("文字の種類が原図と一致しません");
    return data;
  }
  function drawSymbols(ctx, data) {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = coloringRules.symbolOpacity;
    ctx.lineJoin = "miter";
    for (const symbol of data.symbols) for (const stroke of symbol.strokes) {
      ctx.strokeStyle = symbolPalette[symbol.letter]; ctx.lineWidth = stroke.width_px + 1.5; ctx.lineCap = stroke.line_cap;
      ctx.beginPath(); ctx.moveTo(...stroke.points[0]);
      for (const point of stroke.points.slice(1)) ctx.lineTo(...point);
      ctx.stroke();
    }
    ctx.restore();
  }
  const isothermScales = [
    { pressure_hpa:300, values:[-27,-33,-39,-45,-51], colors:["#a0d8fa","#74b9ef","#558ee0","#7460cb","#4c1d95"], dash:[], opacity:coloringRules.temperatureOpacity },
    { pressure_hpa:500, values:[-3,-6,-9,-12,-15,-18,-21,-24,-27,-30], colors:["#a0d8fa","#85c5f1","#6aafe8","#5799df","#5485d7","#6071ce","#6d5dc4","#6847b3","#5932a4","#4c1d95"], dash:[], opacity:coloringRules.temperatureOpacity }
  ];
  const isothermPalette = isothermScales[0].colors;
  function validateIsotherms(data, chart) {
    if (data?.schema_version !== 2 || data.source_sha256 !== chart.source_sha256 || data.image_sha256 !== chart.image_sha256 || data.observation_time !== chart.observation_time || data.width !== chart.width || data.height !== chart.height || data.unit !== "degC" || !Array.isArray(data.panels) || data.panels.length !== 2) throw Error("気温線の資料が原図と一致しません");
    const runCounts = [[1,1,1,1,2],[7,2,1,1,1,2,1,1,6,2]];
    const labelCounts = [[20,29,27,23,33],[5,2,1,1,1,1,1,1,3,2]];
    const closures = [[[true],[false],[false],[false],[false,false]], [Array(7).fill(true),[false,true],[false],[false],[false],[false,false],[false],[false],[false,true,true,true,true,true],[false,true]]];
    for (const [plane, panel] of data.panels.entries()) {
      if (panel.pressure_hpa !== isothermScales[plane].pressure_hpa || !Array.isArray(panel.bounds) || panel.bounds.length !== 4 || !panel.bounds.every(Number.isFinite) || !Array.isArray(panel.levels) || panel.levels.length !== isothermScales[plane].values.length) throw Error("気温線の気圧面を確認できません");
      const [left, top, right, bottom] = panel.bounds;
      if (!(left>0 && left<right && right<chart.width && top>0 && top<bottom && bottom<chart.height && (plane===0 ? bottom<chart.height/2 : top>chart.height/2))) throw Error("気温線の気圧面を確認できません");
      for (const [index, level] of panel.levels.entries()) {
        if (level.temperature_c !== isothermScales[plane].values[index] || !Array.isArray(level.lines) || level.lines.length !== runCounts[plane][index] || !Array.isArray(level.labels) || level.labels.length !== labelCounts[plane][index]) throw Error("気温線の値と並びを確認できません");
        const points = level.lines.flatMap(line=>line.points || []);
        for (const [run, line] of level.lines.entries()) {
          if (line.closed!==closures[plane][index][run] || !Array.isArray(line.points) || line.points.length < (line.closed?3:2) || line.points.length>1500 || (plane===0 && line.points.length!==[[20],[29],[27],[23],[30,3]][index][run]) || !line.points.every(p => Array.isArray(p) && p.length===2 && p.every(Number.isFinite) && p[0]>=left && p[0]<=right && p[1]>=top && p[1]<=bottom)) throw Error("気温線の位置を確認できません");
          const pairs = line.points.slice(1).map((q,i)=>[line.points[i],q]);
          if (line.closed) pairs.push([line.points.at(-1),line.points[0]]);
          for (const [p,q] of pairs) {
            const distance = Math.hypot(q[0]-p[0],q[1]-p[1]);
            if (distance<.1 || distance >= (plane===0?110:85)) throw Error("気温線の接続を確認できません");
          }
        }
        for (const box of level.labels) {
          if (!Array.isArray(box) || box.length!==4 || !box.every(Number.isFinite) || !(left<=box[0] && box[0]<box[2] && box[2]<=right && top<=box[1] && box[1]<box[3] && box[3]<=bottom && box[2]-box[0]<(plane===0?30:60) && box[3]-box[1]<(plane===0?15:30)) || !points.some(p=>Math.hypot(p[0]-(box[0]+box[2])/2,p[1]-(box[1]+box[3])/2)<.02)) throw Error("原図の気温表示との対応を確認できません");
        }
      }
    }
    return data;
  }
  function isothermSegments(points, closed=false) {
    const segments = [];
    for (let i = 1; i < points.length + Number(closed); i++) {
      const p = points[i-1], q = points[i%points.length];
      const before = points[i-2] || (closed?points.at(-1):p.map((v,k) => 2*v-q[k]));
      const after = points[i+1] || (closed?points[(i+1)%points.length]:q.map((v,k) => 2*v-p[k]));
      const a = Math.sqrt(Math.hypot(p[0]-before[0],p[1]-before[1]));
      const b = Math.sqrt(Math.hypot(q[0]-p[0],q[1]-p[1]));
      const c = Math.sqrt(Math.hypot(after[0]-q[0],after[1]-q[1]));
      // Centripetal Catmull-Rom. Shared stamp tangents remain continuous;
      // clipping individual handles would introduce corners at those stamps.
      const c1 = p.map((v,k) => v+b*((v-before[k])/a-(q[k]-before[k])/(a+b)+(q[k]-v)/b)/3);
      const c2 = q.map((v,k) => v-b*((v-p[k])/b-(after[k]-p[k])/(b+c)+(after[k]-v)/c)/3);
      segments.push({start:p,c1,c2,end:q});
    }
    return segments;
  }
  function drawIsotherms(ctx, data, pressures=[300,500], scales=isothermScales) {
    for (const panel of data.panels) {
    if (!pressures.includes(panel.pressure_hpa)) continue;
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    const [left, top, right, bottom] = panel.bounds;
    // Leave the printed temperatures legible, including other levels' stamps.
    ctx.beginPath(); ctx.rect(left, top, right-left, bottom-top);
    for (const level of panel.levels) for (const [x0,y0,x1,y1] of level.labels) ctx.rect(x0-2,y0-2,x1-x0+4,y1-y0+4);
    ctx.clip("evenodd");
    ctx.lineWidth = 3.5; ctx.lineCap = ctx.lineJoin = "round";
    const scale = scales.find(s=>s.pressure_hpa===panel.pressure_hpa);
    ctx.setLineDash(scale.dash); ctx.lineDashOffset = 0;
    ctx.globalAlpha = scale.opacity;
    for (const [index, level] of panel.levels.entries()) for (const line of level.lines) {
      ctx.strokeStyle = scale.colors[index]; ctx.beginPath(); ctx.moveTo(...line.points[0]);
      for (const segment of isothermSegments(line.points,line.closed)) ctx.bezierCurveTo(...segment.c1,...segment.c2,...segment.end);
      ctx.stroke();
    }
    ctx.restore();
    }
  }
  function drawTroughs(ctx, curves, opacity = 1) {
    ctx.save(); ctx.strokeStyle = coloringRules.axes.trough; ctx.lineWidth = coloringRules.axes.width;
    ctx.globalAlpha = coloringRules.axes.opacity * opacity; ctx.lineCap = ctx.lineJoin = "round";
    for (const points of curves) {
      if (points.length < 2) continue;
      const sides = [[], []];
      // Offset the smooth centerline along its own normals, then interpolate
      // both edges. Short samples keep the two red curves evenly separated.
      for (const [index, segment] of isothermSegments(points).entries()) {
        const {start, c1, c2, end} = segment;
        const steps = Math.max(2, Math.ceil((Math.hypot(c1[0]-start[0],c1[1]-start[1]) + Math.hypot(c2[0]-c1[0],c2[1]-c1[1]) + Math.hypot(end[0]-c2[0],end[1]-c2[1])) / 4));
        for (let i = Number(index > 0); i <= steps; i++) {
          const t = i / steps, u = 1 - t;
          const center = start.map((v,k) => u*u*u*v + 3*u*u*t*c1[k] + 3*u*t*t*c2[k] + t*t*t*end[k]);
          let dx = u*u*(c1[0]-start[0]) + 2*u*t*(c2[0]-c1[0]) + t*t*(end[0]-c2[0]);
          let dy = u*u*(c1[1]-start[1]) + 2*u*t*(c2[1]-c1[1]) + t*t*(end[1]-c2[1]);
          if (Math.hypot(dx,dy) < 1e-9) { dx = end[0]-start[0]; dy = end[1]-start[1]; }
          const length = Math.hypot(dx,dy);
          for (const [side,sign] of [-1,1].entries()) sides[side].push([center[0]-sign*dy*5/length,center[1]+sign*dx*5/length]);
        }
      }
      for (const side of sides) {
        ctx.beginPath(); ctx.moveTo(...side[0]);
        for (const segment of isothermSegments(side)) ctx.bezierCurveTo(...segment.c1,...segment.c2,...segment.end);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  function drawRidges(ctx, curves, opacity = 1) {
    ctx.save(); ctx.strokeStyle = coloringRules.axes.ridge; ctx.lineWidth = coloringRules.axes.width;
    ctx.globalAlpha = coloringRules.axes.opacity * opacity; ctx.lineCap = "round"; ctx.lineJoin = "miter";
    for (const points of curves) {
      if (points.length < 2) continue;
      const samples = []; let distance = 0;
      for (const [index,{start,c1,c2,end}] of isothermSegments(points).entries()) {
        const steps = Math.max(2,Math.ceil((Math.hypot(c1[0]-start[0],c1[1]-start[1])+Math.hypot(c2[0]-c1[0],c2[1]-c1[1])+Math.hypot(end[0]-c2[0],end[1]-c2[1]))/2));
        for (let i=Number(index>0);i<=steps;i++) {
          const t=i/steps,u=1-t;
          const p=start.map((v,k)=>u*u*u*v+3*u*u*t*c1[k]+3*u*t*t*c2[k]+t*t*t*end[k]);
          if (samples.length) distance+=Math.hypot(p[0]-samples.at(-1).point[0],p[1]-samples.at(-1).point[1]);
          samples.push({point:p,distance});
        }
      }
      ctx.beginPath(); ctx.moveTo(...points[0]);
      let index=1,sign=1;
      // Equal distances along the curved axis keep the zigzag evenly spaced.
      for (let along=14;along<distance;along+=14) {
        while (samples[index].distance<along) index++;
        const a=samples[index-1],b=samples[index],dx=b.point[0]-a.point[0],dy=b.point[1]-a.point[1];
        const length=Math.hypot(dx,dy),t=(along-a.distance)/(b.distance-a.distance);
        ctx.lineTo(a.point[0]+t*dx-sign*dy*6/length,a.point[1]+t*dy+sign*dx*6/length);
        sign=-sign;
      }
      ctx.lineTo(...points.at(-1)); ctx.stroke();
    }
    ctx.restore();
  }
  // Register analyses by their source, rather than every possible destination.
  const overlayAnalyses = Object.freeze([
    { id: "jet", kind: "jet", source_hpa: 300, label: "強風軸" },
    { id: "trough", kind: "trough", source_hpa: 500, label: "トラフ" },
    { id: "ridge", kind: "ridge", source_hpa: 500, label: "リッジ" }
  ].map(Object.freeze));
  function validatePanelRegistration(data, chart) {
    for (const key of ["source_sha256", "image_sha256", "observation_time", "width", "height"])
      if (data?.[key] !== chart[key]) throw Error("重ね合わせの資料が原図と一致しません");
    if (data.projection?.type !== "north-polar-stereographic" || data.projection.central_longitude !== 140 ||
        !Number.isFinite(data.projection.radius_scale_px) || data.projection.radius_scale_px <= 0 ||
        !Array.isArray(data.projection.pole) || data.projection.pole.length !== 2 || !data.projection.pole.every(Number.isFinite) ||
        !Array.isArray(data.panels) || data.panels.length !== 2 || !Number.isFinite(Date.parse(data.observation_time))) throw Error("重ね合わせの地図を確認できません");
    const expected = [[55,121.3,1990.96,1441.63], [55,1537.68,1990.96,2858]];
    const panels = data.panels.map((panel, i) => {
      if (panel.pressure_hpa !== [300,500][i] || panel.offset_y !== [0,1416.38][i] ||
          !Array.isArray(panel.bounds) || panel.bounds.length !== 4 || !panel.bounds.every((v,k) => Number.isFinite(v) && Math.abs(v-expected[i][k]) < .001)) throw Error("重ね合わせの位置を確認できません");
      return Object.freeze({ pressure_hpa: panel.pressure_hpa, offset_y: panel.offset_y, bounds: Object.freeze([...panel.bounds]) });
    });
    return Object.freeze({ source_sha256: data.source_sha256, image_sha256: data.image_sha256, observation_time: data.observation_time, panels: Object.freeze(panels) });
  }
  function validatePanelOverlay(layer, registration, sourceKey) {
    const tool = overlayAnalyses.find(t => t.id === layer?.analysis_id && t.source_hpa === layer.source_hpa);
    const source = registration?.panels.find(p => p.pressure_hpa === layer?.source_hpa);
    const target = registration?.panels.find(p => p.pressure_hpa === layer?.target_hpa);
    if (!tool || !source || !target || source === target || !sourceKey || layer.source_key !== sourceKey ||
        ["source_sha256", "image_sha256", "observation_time"].some(key => layer[key] !== registration[key]) ||
        typeof layer.enabled !== "boolean" || !Number.isFinite(layer.opacity) || layer.opacity < 0 || layer.opacity > 1)
      throw Error("重ね合わせの設定を確認できません");
    return { tool, source, target };
  }
  function createPanelOverlay(registration, sourceKey, analysisId, targetHpa) {
    const tool = overlayAnalyses.find(t => t.id === analysisId);
    const layer = { id: `${sourceKey}|${registration?.observation_time}|${analysisId}|${targetHpa}`, source_key: sourceKey,
      source_hpa: tool?.source_hpa, analysis_id: analysisId, target_hpa: targetHpa,
      source_sha256: registration?.source_sha256, image_sha256: registration?.image_sha256,
      observation_time: registration?.observation_time, enabled: true, opacity: .6 };
    validatePanelOverlay(layer, registration, sourceKey);
    return layer;
  }
  function drawPanelOverlay(ctx, candidates, registration, layer, sourceKey) {
    const { tool, source, target } = validatePanelOverlay(layer, registration, sourceKey);
    if (!candidates) throw Error("重ね合わせの解析を確認できません");
    const opacity = layer.opacity;
    ctx.save();
    try {
      const [left,top,right,bottom] = target.bounds;
      ctx.beginPath(); ctx.rect(left,top,right-left,bottom-top); ctx.clip();
      // Both reviewed panels share their geographic frame. Move only the
      // analysis, and clip it to the destination map without altering its data.
      ctx.translate(0, target.offset_y-source.offset_y);
      if (tool.kind === "jet") drawJetAxes(ctx,candidates.jets,source.bounds,opacity);
      if (tool.kind === "trough") drawTroughs(ctx,candidates.troughs,opacity);
      if (tool.kind === "ridge") drawRidges(ctx,candidates.ridges,opacity);
    } finally { ctx.restore(); }
  }
  return { coloringRules, mixColor, temperatureColor, temperatureScale, coldColor, drawRectangleFill, validate, validateHeightAxes, analyze, jets, validateWindBands, drawWindBands, windPalette, validateJetGuides, strongestCenter, drawJetAxes, symbolPalette, validateSymbols, drawSymbols, isothermPalette, isothermScales, validateIsotherms, drawIsotherms, isothermSegments, drawTroughs, drawRidges, overlayAnalyses, validatePanelRegistration, validatePanelOverlay, createPanelOverlay, drawPanelOverlay };
})();
if (typeof module !== "undefined") module.exports = ChartAnalysis;
