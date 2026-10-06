"use strict";
const LowLevelAnalysis = (() => {
  const chart=typeof ChartAnalysis!=="undefined"?ChartAnalysis:require("./analysis.js"),rules=chart.coloringRules;
  const {coldColors,warmThresholds,warmColors}=rules;
  const temperatureColor=chart.temperatureColor;
  const warmCache = new WeakMap();
  function warmRings(panel, threshold) {
    if (panel.pressure_hpa!==850 || !warmThresholds.includes(threshold)) return [];
    return thermalRings(panel,threshold,true);
  }
  function thermalRings(panel, threshold, warmer) {
    const level=panel.levels.find(l=>l.temperature_c===threshold);
    if (!level?.lines.length) return [];
    const [l,t,r,b]=panel.bounds,w=r-l,h=b-t,total=2*(w+h);
    const frame=[[l,t],[r,t],[r,b],[l,b]];
    const contains=(ring,[x,y])=>{
      let hit=false;
      for(let i=0,j=ring.length-1;i<ring.length;j=i++){
        const a=ring[i],c=ring[j];
        if((a[1]>y)!==(c[1]>y) && x<(c[0]-a[0])*(y-a[1])/(c[1]-a[1])+a[0])hit=!hit;
      }return hit;
    };
    const trace=panel.temperature_trace;
    const nativeDash=trace?.method==="native_regular_dash_connectivity" && trace.unassigned_groups===0 &&
      Number.isFinite(trace.dash_length_px) && trace.dash_length_px>0 && Number.isFinite(trace.numeric_label_font_px) && trace.numeric_label_font_px>0;
    const edge=(points)=>{
      const [x,y]=points[0];
      const choices=[[Math.abs(y-t),Math.max(0,Math.min(w,x-l)),[0,-1]],[Math.abs(x-r),w+Math.max(0,Math.min(h,y-t)),[1,0]],[Math.abs(y-b),w+h+Math.max(0,Math.min(w,r-x)),[0,1]],[Math.abs(x-l),2*w+h+Math.max(0,Math.min(h,b-y)),[-1,0]]].sort((a,b)=>a[0]-b[0]);
      const [distance,position,normal]=choices[0];
      if(distance<12)return position;
      // FEAS forecast PDF contours are clipped in a narrow inset of the map
      // frame. A tangential curve can terminate there as well as an outward
      // one; the bound is supplied and validated with this native source.
      if(nativeDash && Number.isFinite(trace.frame_margin_px) && distance<=trace.frame_margin_px)return position;
      // Native FEAS dashes can stop in the narrow margin before the frame.
      // Close the fill across that margin only when the source curve heads
      // outward. Interior breaks never become invented chart-wide boundaries.
      if(!nativeDash || distance>trace.numeric_label_font_px+2*trace.dash_length_px)return null;
      const next=points.find(p=>Math.hypot(p[0]-x,p[1]-y)>2*trace.dash_length_px);
      if(!next)return null;
      const dx=x-next[0],dy=y-next[1];
      return (dx*normal[0]+dy*normal[1])/Math.hypot(dx,dy)>.4?position:null;
    };
    const at=s=>{s=((s%total)+total)%total;return s<=w?[l+s,t]:s<=w+h?[r,t+s-w]:s<=2*w+h?[r-(s-w-h),b]:[l,b-(s-2*w-h)];};
    const refs=panel.levels.filter(v=>v.temperature_c!==threshold).flatMap(v=>v.lines.flatMap(line=>[.25,.5,.75].map(f=>({value:v.temperature_c,point:line.points[Math.floor((line.points.length-1)*f)]}))));
    if (!refs.length) return [];
    const rings=[];let incomplete=false;
    for(const line of level.lines){
      if(line.closed){rings.push(line.points);continue;}
      const start=edge([...line.points].reverse()),end0=edge(line.points);
      if(start===null || end0===null){incomplete=true;continue;}
      const end=end0<=start?end0+total:end0;
      const corners=[0,w,w+h,2*w+h].flatMap(s=>[s,s+total]).filter(s=>s>start&&s<end).sort((a,b)=>a-b);
      rings.push([...line.points,at(start),...corners.map(at),at(end)]);
    }
    if(!rings.length)return [];
    if(incomplete){
      // An unfinished contour cannot define a chart-wide warm side. Keep only
      // closed warm islands supported by adjacent, independently valued lines.
      return level.lines.filter(line=>line.closed).map(line=>line.points).filter(ring=>{
        const inside=refs.filter(ref=>contains(ring,ref.point));
        if(inside.length)return inside.every(ref=>warmer?ref.value>threshold:ref.value<threshold);
        const distance=ref=>Math.min(...ring.filter((_,i)=>i%8===0).map(p=>Math.hypot(p[0]-ref.point[0],p[1]-ref.point[1])));
        return [...refs].sort((a,b)=>distance(a)-distance(b)).slice(0,3).every(ref=>warmer?ref.value<threshold:ref.value>threshold);
      });
    }
    // Across each complete isotherm the warm/cold side alternates. Infer the
    // parity from other printed contour values, preserving separate islands
    // and cold holes without stacking overlapping half-chart polygons.
    const votes=refs.map(ref=>({same:rings.reduce((hit,ring)=>hit!==contains(ring,ref.point),false)===(warmer?ref.value>threshold:ref.value<threshold)}));
    const same=votes.filter(v=>v.same).length;
    if(Math.max(same,votes.length-same)/votes.length<.9)return [];
    return same>=votes.length/2?rings:[frame,...rings];
  }
  function warmBands(panel) {
    if(!warmCache.has(panel))warmCache.set(panel,warmThresholds.map((threshold,i)=>({threshold,color:warmColors[i],rings:warmRings(panel,threshold)})));
    return warmCache.get(panel);
  }
  function drawWarmFills(ctx,data,opacity=rules.warmOpacity) {
    for(const panel of data.panels.filter(p=>p.pressure_hpa===850)){
      const canvas=ctx.canvas.ownerDocument.createElement("canvas");canvas.width=data.width;canvas.height=data.height;
      const sc=canvas.getContext("2d");
      for(const band of warmBands(panel)){sc.fillStyle=band.color;sc.beginPath();for(const ring of band.rings){sc.moveTo(...ring[0]);for(const p of ring.slice(1))sc.lineTo(...p);sc.closePath();}sc.fill("evenodd");}
      const [l,t,r,b]=panel.bounds;ctx.save();ctx.beginPath();ctx.rect(l,t,r-l,b-t);ctx.clip();ctx.globalAlpha=opacity;ctx.drawImage(canvas,0,0);ctx.restore();
    }
  }
  const scales = [
    {pressure_hpa:700,values:[-12,-6,0,6,12]},
    {pressure_hpa:850,values:[-6,-3,0,3,6,9,12,15,18,21]}
  ].map(s => chart.temperatureScale(s.pressure_hpa,s.values));
  const sourceHash = "58be2c8fd8bcc5b27c87a8fa748869a2145ca7d8403a9ecdc3ce586cfc95f249";
  const imageHash = "a45b011b2c5329b4f3c2dabd035ef7daac90669fb08d848974cf95852321382c";
  function validate(data, selected) {
    if (selected.product.id!=="aupq78" || selected.variant.id!=="aupq78-00" || selected.page.number!==1 || data?.schema_version!==1 || data.product!=="AUPQ78" || data.unit!=="degC" || data.source_sha256!==sourceHash || data.image_sha256!==imageHash || data.source_sha256!==selected.variant.source_sha256 || data.image_sha256!==selected.page.image_sha256 || data.width!==2048 || data.height!==2993 || data.width!==selected.page.width || data.height!==selected.page.height || data.observation_time!=="2026-10-02T00:00:00Z" || data.panels?.length!==2 || data.symbols?.length!==45) throw Error("AUPQ78の解析資料が原図と一致しません");
    const expectedBounds=[[55,121.3,1990.96,1441.63],[55,1537.68,1990.96,2858]];
    const inside=(p,b)=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>=b[0]-8&&p[0]<=b[2]+8&&p[1]>=b[1]-8&&p[1]<=b[3]+8;
    for (const [index,panel] of data.panels.entries()) {
      const scale=scales[index], b=expectedBounds[index];
      if (panel.pressure_hpa!==scale.pressure_hpa || !Array.isArray(panel.bounds) || panel.bounds.length!==4 || panel.bounds.some((v,i)=>v!==b[i]) || panel.levels?.length!==scale.values.length || JSON.stringify(panel.cold_thresholds)!==JSON.stringify(rules.coldThresholds[panel.pressure_hpa]) || !Array.isArray(panel.wet_rectangles) || !panel.wet_rectangles.length || panel.wet_rectangles.length>600 || panel.troughs?.length!==(index?3:4) || panel.ridges?.length!==2) throw Error("AUPQ78の気圧面を確認できません");
      for (const [i,level] of panel.levels.entries()) {
        if (level.temperature_c!==scale.values[i] || !Array.isArray(level.lines) || !level.lines.length || !Array.isArray(level.labels)) throw Error("AUPQ78の等温線を確認できません");
        for (const line of level.lines) if (typeof line.closed!=="boolean" || line.points?.length<2 || line.points.length>1500 || !line.points.every(p=>inside(p,b)) || line.points.some((p,j)=>j&&Math.hypot(p[0]-line.points[j-1][0],p[1]-line.points[j-1][1])<.1)) throw Error("AUPQ78の等温線の位置を確認できません");
        for (const box of level.labels) if (box?.length!==4 || !inside(box.slice(0,2),b) || !inside(box.slice(2),b) || box[0]>=box[2] || box[1]>=box[3]) throw Error("AUPQ78の気温ラベルを確認できません");
      }
      for (const r of panel.wet_rectangles) if (r?.length!==4 || !inside(r.slice(0,2),b) || !inside(r.slice(2),b) || r[2]<=r[0] || r[3]<=r[1] || r[3]-r[1]>14.1) throw Error("AUPQ78の湿域を確認できません");
      const reviewedCrossings=index?[11503,11507,11509,11514]:[3336,3341,3342,3344,3345,3349];
      if (JSON.stringify(panel.troughs.map(a=>a.id))!==JSON.stringify(index?['west-low','northeast-low','east-low']:['west-low','southwest','japan','east-low']) || JSON.stringify(panel.ridges.map(a=>a.id))!==JSON.stringify(index?['northwest-ridge','east-ridge']:['west-ridge','east-ridge'])) throw Error("AUPQ78の解析の枝が一致しません");
      const area=index?[1060,1655,1930,2240]:[930,290,1880,825];
      for (const [kind,axes] of [['trough',panel.troughs],['ridge',panel.ridges]]) for (const axis of axes) {
        if (axis.kind!==kind || axis.points?.length<2 || axis.points.length>6 || !axis.points.every(p=>inside(p,area)) || (!index && axis.height_crossings?.length<2) || axis.height_crossings.some(c=>!reviewedCrossings.includes(c.height_path)||!inside(c.point,b))) throw Error("AUPQ78の谷・尾根を確認できません");
        if (!index) for (const dim of [0,1]) {const sign=Math.sign(axis.points.at(-1)[dim]-axis.points[0][dim]);if (!sign || axis.points.some((p,j)=>j&&sign*(p[dim]-axis.points[j-1][dim])<=0)) throw Error("AUPQ78の軸の方向を確認できません");}
      }
    }
    for (const axis of [...data.panels[1].troughs,...data.panels[1].ridges]) {
      if (axis.review!=="user-drawn fixed-source branch") throw Error("850hPaの参照解析を確認できません");
      const turns=axis.points.slice(2).map((p,i)=>{const a=axis.points[i],b=axis.points[i+1];return (b[0]-a[0])*(p[1]-b[1])-(b[1]-a[1])*(p[0]-b[0]);}).filter(v=>Math.abs(v)>100);
      if (turns.some(v=>v*turns[0]<0)) throw Error("850hPaの軸がS字に反転しています");
    }
    for (const s of data.symbols) {
      const b=data.panels.find(p=>p.pressure_hpa===s.pressure_hpa)?.bounds;
      if (!b || !["L","H","C","W"].includes(s.letter) || s.bounds?.length!==4 || !inside(s.bounds.slice(0,2),b) || !inside(s.bounds.slice(2),b) || s.strokes?.length!==(s.letter==="H"?3:1)) throw Error("AUPQ78の文字を確認できません");
      for (const stroke of s.strokes) if (!Number.isFinite(stroke.width_px) || stroke.width_px<1 || stroke.width_px>4 || !["butt","round","square"].includes(stroke.line_cap) || stroke.points?.length<2 || !stroke.points.every(p=>inside(p,b))) throw Error("AUPQ78の字形を確認できません");
    }
    return data;
  }
  function coldRings(panel, threshold) {
    if(panel.pressure_hpa===850 && panel.temperature_trace?.frame_margin_px && [0,-3,-6,-9,-12].includes(threshold))return thermalRings(panel,threshold,false);
    const level=panel.levels.find(l=>l.temperature_c===threshold);
    if (!level) return []; // No extrapolation below the lowest printed contour.
    const [left,top,right,bottom]=panel.bounds;
    return level.lines.map(line=> {
      if (line.closed) return line.points;
      // Reviewed 850hPa cold contours all meet the northern frame. Close only
      // those verified endpoints; do not invent a boundary for another chart.
      const first=line.points[0],last=line.points.at(-1);
      if (Math.abs(first[1]-top)>8 || Math.abs(last[1]-top)>8) throw Error("寒気域の枠との接続を確認できません");
      return [...line.points,[last[0],top],[first[0],top]];
    });
  }
  function drawFills(ctx,data,{wet=false,cold700=false,cold850=false,warm850=false,warmOpacity=rules.warmOpacity,opacity=rules.coldOpacity}={}) {
    if(warm850)drawWarmFills(ctx,data,warmOpacity);
    ctx.save();
    for (const panel of data.panels) {
      ctx.save();const [l,t,r,b]=panel.bounds;ctx.beginPath();ctx.rect(l,t,r-l,b-t);ctx.clip();
      // Paint cumulative thresholds opaquely on a scratch layer, then apply
      // opacity once. A colder band never compounds alpha with a warmer band.
      if (panel.pressure_hpa===700?cold700:cold850) {
        const scratch=ctx.canvas.ownerDocument.createElement("canvas");scratch.width=data.width;scratch.height=data.height;
        const sc=scratch.getContext("2d");
        panel.cold_thresholds.forEach(threshold=> {
          const rings=coldRings(panel,threshold); if (!rings.length) return;
          sc.fillStyle=chart.coldColor(panel.pressure_hpa,threshold);sc.beginPath();
          for (const ring of rings) {sc.moveTo(...ring[0]);for(const p of ring.slice(1))sc.lineTo(...p);sc.closePath();}sc.fill("evenodd");
        });
        ctx.globalAlpha=opacity;ctx.drawImage(scratch,0,0);
      }
      if (wet) chart.drawRectangleFill(ctx,panel.wet_rectangles,rules.wet);
      ctx.restore();
    }
    ctx.restore();
  }
  return {validate,scales,temperatureColor,coldColors,coldRings,warmThresholds,warmColors,warmRings,warmBands,drawWarmFills,drawFills};
})();
if (typeof module!=="undefined") module.exports=LowLevelAnalysis;
