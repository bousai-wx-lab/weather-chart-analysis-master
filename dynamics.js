"use strict";
const ChartDynamics = (() => {
  const low=typeof LowLevelAnalysis!=="undefined"?LowLevelAnalysis:require("./low-level.js");
  const sourceHash="edf5a4b0abb162616c308700160e3715fae1433271a79141e3e86787cc3a7372";
  const imageHash="716824b7789fbeebcf47ee750531c91644c7698f2e634f6e58e54b2176e2506f";
  const values=Array.from({length:12},(_,i)=>-12+i*3);
  const scales=[{pressure_hpa:500,values:[],colors:[],dash:[],opacity:.5},{pressure_hpa:850,values,colors:values.map((v,i)=>low.temperatureColor(850,v)),dash:[],opacity:.5}];
  function scalesFor(data) {
    const values=data.panels[1].levels.map(l=>l.temperature_c);
    return [{pressure_hpa:500,values:[],colors:[],dash:[],opacity:.5},{...scales[1],values,colors:values.map((v,i)=>low.temperatureColor(850,v))}];
  }
  function validateFeas(data,selected) {
    if(data?.trough_analysis && data.trough_analysis.operationally_approved!==true)throw Error("500hPaトラフは検証中のため表示できません");
    if(selected.product.id!=="feas-feas50" || selected.variant.id!=="feas50-12" || selected.page.number!==1 || data?.schema_version!==1 || data.product!=="FEAS50" || data.unit!=="degC" || data.source_sha256!=="dfd41a8166153acb51060740a879f0bc3643e61d0b887aad48f087eaa064f8b9" || data.image_sha256!=="870cf0872dabb09e4bccad522f4be247125bb875bd0675cdbe372049f4ee6b09" || data.source_sha256!==selected.variant.source_sha256 || data.image_sha256!==selected.page.image_sha256 || data.width!==2048 || data.height!==2605 || data.observation_time!=="2026-10-02T12:00:00Z" || data.symbols?.length!==28 || data.panels?.length!==2)throw Error("FEAS50の資料が原図と一致しません");
    const inside=(p,b)=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>=b[0]-5&&p[0]<=b[2]+5&&p[1]>=b[1]-5&&p[1]<=b[3]+5;
    for(const [i,p] of data.panels.entries()) {
      const b=p.bounds;
      if(p.pressure_hpa!==[500,850][i] || b?.length!==4 || !b.every(Number.isFinite) || b[0]<117 || b[2]>1929 || b[1]<[146,1402][i] || b[3]>[1213,2469][i] || !Array.isArray(p.troughs) || (i && p.troughs.length!==2) || p.ridges?.length!==2 || p.troughs.some(a=>a.points?.length<(i?3:2)||!a.points.every(q=>inside(q,b))) || p.ridges.some(a=>a.points?.length<3||!a.points.every(q=>inside(q,b))))throw Error("FEAS50の気圧面が一致しません");
      if(i) {
        if(p.axis_pressure_hpa!==0 || p.vertical_velocity_pressure_hpa!==undefined || p.ascent_rectangles!==undefined || JSON.stringify(p.cold_thresholds)!==JSON.stringify([0,-3,-6,-9,-12]) || p.levels?.length!==14)throw Error("FEAS下段の要素が一致しません");
        for(const [j,l] of p.levels.entries())if(l.temperature_c!==-12+3*j || !l.lines?.length || l.lines.some(line=>typeof line.closed!=="boolean"||line.points?.length<2||!line.points.every(q=>inside(q,b))))throw Error("FEASの等温線が一致しません");
      } else if(p.positive_vorticity_rectangles?.length!==613 || p.positive_vorticity_rectangles.some(r=>r?.length!==4||!inside(r.slice(0,2),b)||!inside(r.slice(2),b)||r[0]>=r[2]||r[1]>=r[3]||r[2]-r[0]>15))throw Error("FEAS50の渦度境界が一致しません");
    }
    for(const s of data.symbols){const b=data.panels.find(p=>p.pressure_hpa===s.pressure_hpa)?.bounds;if(!b||!["L","H","C","W"].includes(s.letter)||s.strokes?.length!==(s.letter==="H"?3:1)||s.strokes.some(st=>st.points?.length<2||!st.points.every(q=>inside(q,b))||st.width_px<=0||st.width_px>7))throw Error("FEASの文字が一致しません");}
    return data;
  }
  function validate(data,selected) {
    if(selected.product.id==="feas-feas50")return validateFeas(data,selected);
    if(selected.product.id!=="axfe578" || selected.variant.id!=="axfe578-00" || selected.page.number!==1 || data?.schema_version!==1 || data.product!=="AXFE578" || data.unit!=="degC" || data.source_sha256!==sourceHash || data.image_sha256!==imageHash || data.source_sha256!==selected.variant.source_sha256 || data.image_sha256!==selected.page.image_sha256 || data.width!==selected.page.width || data.height!==selected.page.height || data.width!==2048 || data.height!==3101 || data.observation_time!=="2026-10-02T00:00:00Z" || data.panels?.length!==2 || data.symbols?.length!==56)throw Error("AXFE578の資料が原図と一致しません");
    const inside=(p,b)=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>=b[0]-2&&p[0]<=b[2]+2&&p[1]>=b[1]-2&&p[1]<=b[3]+2;
    for(const [i,panel] of data.panels.entries()) {
      const b=panel.bounds;
      if(panel.pressure_hpa!==[500,850][i] || !Array.isArray(b) || b.length!==4 || !b.every(Number.isFinite) || b[0]<179 || b[2]>1986 || b[1]<[37,1527][i] || b[3]>[1432,2922][i])throw Error("AXFE578の気圧面が一致しません");
      const rects=i?panel.ascent_rectangles:panel.positive_vorticity_rectangles;
      if(rects?.length!==[917,972][i] || rects.some(r=>r?.length!==4||!inside(r.slice(0,2),b)||!inside(r.slice(2),b)||r[0]>=r[2]||r[1]>=r[3]||r[2]-r[0]>15))throw Error("AXFE578の色塗り境界を確認できません");
      if(i) {
        if(panel.vertical_velocity_pressure_hpa!==700 || JSON.stringify(panel.cold_thresholds)!==JSON.stringify([0,-3,-6,-9,-12]) || panel.levels?.length!==12)throw Error("AXFE578の要素が一致しません");
        for(const [j,l] of panel.levels.entries()) {
          if(l.temperature_c!==values[j] || !l.lines?.length || !Array.isArray(l.labels))throw Error("AXFE578の等温線が一致しません");
          for(const line of l.lines)if(typeof line.closed!=="boolean"||line.points?.length<2||!line.points.every(p=>inside(p,b)))throw Error("AXFE578の等温線の位置が一致しません");
          if(l.labels.some(r=>r?.length!==4||!inside(r.slice(0,2),b)||!inside(r.slice(2),b)))throw Error("AXFE578のラベルが一致しません");
        }
      }else if(panel.troughs?.length!==4 || panel.troughs.some(a=>a.points?.length<2||!a.points.every(p=>inside(p,b))))throw Error("AXFE578のトラフが一致しません");
    }
    if(data.registration?.source_product!=="AUPQ35" || data.registration.pressure_hpa!==500 || data.registration.observation_time!==data.observation_time || data.registration.maximum_coast_fit_error_px>.03)throw Error("500hPaの位置合わせを確認できません");
    for(const s of data.symbols) {
      const b=data.panels.find(p=>p.pressure_hpa===s.pressure_hpa)?.bounds;
      if(!b||!["L","H","C","W"].includes(s.letter)||s.strokes?.length!==(s.letter==="H"?3:1)||s.strokes.some(st=>st.points?.length<2||!st.points.every(p=>inside(p,b))||!Number.isFinite(st.width_px)||st.width_px<=0||st.width_px>7))throw Error("AXFE578の文字を確認できません");
    }
    return data;
  }
  function drawFills(ctx,data,{vorticity=true,ascent=true,cold=false,warm=false,opacity=.35,warmOpacity=.35}={}) {
    if(warm)low.drawWarmFills(ctx,data,warmOpacity);
    if(cold)low.drawFills(ctx,{...data,panels:[data.panels[1]]},{cold850:true,opacity});
    ctx.save();ctx.globalAlpha=.3;
    for(const [i,p] of data.panels.entries()) {
      if(i?(!ascent || !p.ascent_rectangles):!vorticity)continue;
      ctx.save();const [x,y,r,b]=p.bounds;ctx.beginPath();ctx.rect(x,y,r-x,b-y);ctx.clip();
      ctx.fillStyle=i?"#a3d84b":"#ec72ae";ctx.beginPath();
      for(const [x0,y0,x1,y1] of i?p.ascent_rectangles:p.positive_vorticity_rectangles)ctx.rect(x0,y0,x1-x0,y1-y0);
      ctx.fill();ctx.restore();
    }
    ctx.restore();
  }
  return {validate,scales,scalesFor,drawFills};
})();
if(typeof module!=="undefined")module.exports=ChartDynamics;
