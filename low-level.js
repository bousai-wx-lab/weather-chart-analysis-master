"use strict";
const LowLevelAnalysis = (() => {
  const coldColors = ["#a0d8fa", "#74b9ef", "#558ee0", "#7460cb", "#4c1d95"];
  const scales = [
    {pressure_hpa:700,values:[-12,-6,0,6,12]},
    {pressure_hpa:850,values:[-6,-3,0,3,6,9,12,15,18,21]}
  ].map(s => ({...s,colors:s.values.map((v,i) => {
    const colors=["#4c1d95","#5932a4","#6847b3","#6d5dc4","#6071ce","#5485d7","#5799df","#6aafe8","#85c5f1","#a0d8fa"];
    return colors[s.pressure_hpa===850?Math.round((v+12)*9/39):Math.round(i*(colors.length-1)/(s.values.length-1))];
  }),dash:[],opacity:.5}));
  const sourceHash = "58be2c8fd8bcc5b27c87a8fa748869a2145ca7d8403a9ecdc3ce586cfc95f249";
  const imageHash = "a45b011b2c5329b4f3c2dabd035ef7daac90669fb08d848974cf95852321382c";
  function validate(data, selected) {
    if (selected.product.id!=="aupq78" || selected.variant.id!=="aupq78-00" || selected.page.number!==1 || data?.schema_version!==1 || data.product!=="AUPQ78" || data.unit!=="degC" || data.source_sha256!==sourceHash || data.image_sha256!==imageHash || data.source_sha256!==selected.variant.source_sha256 || data.image_sha256!==selected.page.image_sha256 || data.width!==2048 || data.height!==2993 || data.width!==selected.page.width || data.height!==selected.page.height || data.observation_time!=="2026-10-02T00:00:00Z" || data.panels?.length!==2 || data.symbols?.length!==45) throw Error("AUPQ78の解析資料が原図と一致しません");
    const expectedBounds=[[55,121.3,1990.96,1441.63],[55,1537.68,1990.96,2858]];
    const inside=(p,b)=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>=b[0]-8&&p[0]<=b[2]+8&&p[1]>=b[1]-8&&p[1]<=b[3]+8;
    for (const [index,panel] of data.panels.entries()) {
      const scale=scales[index], b=expectedBounds[index];
      if (panel.pressure_hpa!==scale.pressure_hpa || !Array.isArray(panel.bounds) || panel.bounds.length!==4 || panel.bounds.some((v,i)=>v!==b[i]) || panel.levels?.length!==scale.values.length || JSON.stringify(panel.cold_thresholds)!==JSON.stringify(index? [0,-3,-6,-9,-12]:[-15,-18,-21,-24,-27]) || !Array.isArray(panel.wet_rectangles) || !panel.wet_rectangles.length || panel.wet_rectangles.length>600 || panel.troughs?.length!==(index?3:4) || panel.ridges?.length!==2) throw Error("AUPQ78の気圧面を確認できません");
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
  function drawFills(ctx,data,{wet=false,cold700=false,cold850=false,opacity=.35}={}) {
    ctx.save();
    for (const panel of data.panels) {
      ctx.save();const [l,t,r,b]=panel.bounds;ctx.beginPath();ctx.rect(l,t,r-l,b-t);ctx.clip();
      // Paint cumulative thresholds opaquely on a scratch layer, then apply
      // opacity once. A colder band never compounds alpha with a warmer band.
      if (panel.pressure_hpa===700?cold700:cold850) {
        const scratch=ctx.canvas.ownerDocument.createElement("canvas");scratch.width=data.width;scratch.height=data.height;
        const sc=scratch.getContext("2d");
        panel.cold_thresholds.forEach((threshold,index)=> {
          const rings=coldRings(panel,threshold); if (!rings.length) return;
          sc.fillStyle=coldColors[index];sc.beginPath();
          for (const ring of rings) {sc.moveTo(...ring[0]);for(const p of ring.slice(1))sc.lineTo(...p);sc.closePath();}sc.fill("evenodd");
        });
        ctx.globalAlpha=opacity;ctx.drawImage(scratch,0,0);
      }
      if (wet) {ctx.globalAlpha=.3;ctx.fillStyle="#269ed2";ctx.beginPath();for (const [x0,y0,x1,y1] of panel.wet_rectangles)ctx.rect(x0,y0,x1-x0,y1-y0);ctx.fill();}
      ctx.restore();
    }
    ctx.restore();
  }
  return {validate,scales,coldColors,coldRings,drawFills};
})();
if (typeof module!=="undefined") module.exports=LowLevelAnalysis;
