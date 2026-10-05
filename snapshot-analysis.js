"use strict";
const SnapshotAnalysis = (() => {
  const low=typeof LowLevelAnalysis!=="undefined"?LowLevelAnalysis:require("./low-level.js");
  const localHost = hostname => ["127.0.0.1", "localhost", "[::1]", "::1"].includes(hostname);
  const hash = /^[a-f0-9]{64}$/;
  const analysisPath = /^(local-collection|assets)\/analysis\/[a-z0-9-]+\.json$/;
  function merge(base, snapshot, hostname) {
    if (!localHost(hostname)) throw Error("Local collection unavailable on this host");
    ChartCatalog.validate(snapshot, {local:true});
    if(snapshot.collection_kind!=="local" || snapshot.products.length!==base.products.length) throw Error("Local catalog mismatch");
    const data=structuredClone(base);
    for(const p of data.products) {
      const fresh=snapshot.products.find(q=>q.id===p.id);
      if(!fresh || fresh.code!==p.code || fresh.group!==p.group) throw Error("Local product mismatch");
      const old=p.variants.map(v=>({...v,label:v.observation_label ? `${v.observation_label}（以前の解析例）` : `${v.label}（以前の収録）`}));
      if(fresh.variants.some(v=>old.some(o=>o.id===v.id)))throw Error("Duplicate local source");
      p.variants=[...fresh.variants,...old];
    }
    return data;
  }
  function validate(data, selected, hostname) {
    if(!(selected.variant.features==="experimental-snapshot" && selected.variant.analysis_path?.startsWith("assets/analysis/") || localHost(hostname) && selected.variant.features==="experimental-local" && selected.variant.analysis_path?.startsWith("local-collection/analysis/")) ||
       !analysisPath.test(selected.variant.analysis_path) || !hash.test(selected.variant.analysis_sha256) ||
       data?.schema_version!==1 || data.status!=="EXPERIMENTAL_UNVERIFIED" ||
       data.operationally_approved!==false || data.reference_axes_used!==false ||
       data.product!==selected.product.code.replace("FEAS/", "") || data.variant!==selected.variant.id ||
       data.source_sha256!==selected.variant.source_sha256 || data.image_sha256!==selected.page.image_sha256 ||
       data.width!==selected.page.width || data.height!==selected.page.height || data.panels?.length!==2 ||
       !Array.isArray(data.symbols))throw Error("Trial analysis source mismatch");
    const expected={AUPQ35:[300,500],AUPQ78:[700,850],AXFE578:[500,850],FEAS50:[500,850]}[data.product];
    if(!expected)throw Error("Unsupported trial product");
    const point=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>=-5&&p[1]>=-5&&p[0]<=data.width+5&&p[1]<=data.height+5;
    const line=p=>Array.isArray(p)&&p.length>=2&&p.length<=10000&&p.every(point);
    for(const [i,p] of data.panels.entries()) {
      if(p.pressure_hpa!==expected[i] || p.bounds?.length!==4 || !point(p.bounds.slice(0,2)) || !point(p.bounds.slice(2)) || p.bounds[0]>=p.bounds[2] || p.bounds[1]>=p.bounds[3] || !Array.isArray(p.levels) || !Array.isArray(p.troughs) || !Array.isArray(p.ridges))throw Error("Invalid trial panel");
      for(const l of p.levels)if(!Number.isFinite(l.temperature_c)||!Array.isArray(l.labels)||!Array.isArray(l.lines)||l.lines.some(l=>!line(l.points)))throw Error("Invalid trial isotherm");
      for(const key of ["troughs","ridges"])if(p[key].some(a=>!line(a.points)))throw Error("Invalid trial axis");
      for(const a of p.troughs)for(const b of p.ridges)if(crosses(a.points,b.points))throw Error("Same-pressure trough/ridge crossing");
      for(const key of ["wet_rectangles","positive_vorticity_rectangles","ascent_rectangles"])if(p[key]?.some(r=>r.length!==4||!point(r.slice(0,2))||!point(r.slice(2))||r[0]>=r[2]||r[1]>=r[3]))throw Error("Invalid trial fill");
      for(const key of ["cold_bands","wind_bands"])if(p[key]?.some(b=>!Number.isFinite(b.threshold)||!/^#[a-f0-9]{6}$/i.test(b.color)||!Array.isArray(b.rings)||b.rings.some(r=>!line(r))))throw Error("Invalid trial band");
      if(p.wind_bands?.length) {
        if(p.pressure_hpa!==300 || p.wind_bands.length!==5 || p.wind_bands.some((b,j)=>b.threshold!==40+j*20 || b.color!==ChartAnalysis.windPalette[j]))throw Error("Invalid 300hPa wind intervals");
      }
      if(data.product==="AUPQ35" && i===0) {
        if(p.troughs.length || p.ridges.length)throw Error("300hPa uses wind and jet axes");
        const wind={...data,pressure_hpa:300,unit:"kt",bounds:p.bounds,bands:(p.wind_bands||[]).map(b=>({min_kt:b.threshold,rings:b.rings}))};
        // The parent source/image binding also binds the wind and branch guides.
        ChartAnalysis.validateWindBands(wind,data);
        ChartAnalysis.validateJetGuides({...data,pressure_hpa:300,axes:p.jet_guides},data,wind);
      } else if(p.jet_guides?.length)throw Error("Jet axes must use 300hPa wind");
      if(p.ascent_rectangles && p.vertical_velocity_pressure_hpa!==700)throw Error("Ascent must be 700hPa");
      if(data.product==="FEAS50" && i===1 && p.axis_pressure_hpa!==0)throw Error("FEAS axes must use surface pressure");
      if(p.cold_thresholds?.length && JSON.stringify(p.cold_thresholds)!==JSON.stringify(p.pressure_hpa===700?[-15,-18,-21,-24,-27]:[0,-3,-6,-9,-12]))throw Error("Cold threshold mismatch");
    }
    for(const s of data.symbols)if(!["L","H","C","W","D"].includes(s.letter)||!Array.isArray(s.strokes)||s.strokes.some(st=>!line(st.points)||!Number.isFinite(st.width_px)||st.width_px<=0))throw Error("Invalid trial symbol");
    return data;
  }
  function scales(data) {
    return data.panels.map(p=>({pressure_hpa:p.pressure_hpa,values:p.levels.map(l=>l.temperature_c),
      colors:p.levels.map(l=>{const v=l.temperature_c;
        if(p.pressure_hpa===300)return ChartAnalysis.isothermScales[0].colors[Math.max(0,Math.min(4,Math.round((-v-27)/6)))];
        if(p.pressure_hpa===500)return ChartAnalysis.isothermScales[1].colors[Math.max(0,Math.min(9,Math.round((-v-3)/3)))];
        return low.temperatureColor(p.pressure_hpa,v);}),dash:[],opacity:.5}));
  }
  function jetAxes(data) {
    const p=data.panels.find(p=>p.pressure_hpa===300);
    return p?.jet_guides?.length ? ChartAnalysis.jets({bounds:p.bounds,bands:p.wind_bands.map(b=>({min_kt:b.threshold,rings:b.rings}))},{axes:p.jet_guides}) : [];
  }
  function crosses(a,b) {
    for(let i=1;i<a.length;i++)for(let j=1;j<b.length;j++){
      const p=a[i-1],q=b[j-1],u=a[i].map((v,k)=>v-p[k]),v=b[j].map((z,k)=>z-q[k]),w=q.map((z,k)=>z-p[k]);
      const den=u[0]*v[1]-u[1]*v[0];if(Math.abs(den)<1e-9)continue;
      const t=(w[0]*v[1]-w[1]*v[0])/den,s=(w[0]*u[1]-w[1]*u[0])/den;
      if(t>=0&&t<=1&&s>=0&&s<=1)return true;
    }return false;
  }
  // Preserve the already selected trial positions: never re-fit or smooth here.
  function drawAxes(ctx, axes, ridge) {
    ctx.save();ctx.lineCap=ctx.lineJoin="round";ctx.strokeStyle=ridge?"#2563eb":"#ef2323";
    ctx.lineWidth=4;
    for(const a of axes)for(const stroke of axisSymbol(a.points,ridge)){
      ctx.beginPath();ctx.moveTo(...stroke[0]);for(const p of stroke.slice(1))ctx.lineTo(...p);ctx.stroke();
    }
    ctx.restore();
  }
  function axisSymbol(points,ridge) {
    const normal=(p,i)=>{const a=p[Math.max(0,i-1)],b=p[Math.min(p.length-1,i+1)],dx=b[0]-a[0],dy=b[1]-a[1],d=Math.hypot(dx,dy)||1;return [-dy/d,dx/d];};
    if(!ridge)return [-5,5].map(offset=>points.map((p,i)=>{const n=normal(points,i);return [p[0]+offset*n[0],p[1]+offset*n[1]];}));
    const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths.at(-1)+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));
    const total=lengths.at(-1),count=Math.max(4,Math.ceil(total/14)),q=[];let j=1;
    for(let i=0;i<=count;i++){const at=total*i/count;while(j<points.length-1 && lengths[j]<at)j++;const t=(at-lengths[j-1])/(lengths[j]-lengths[j-1]||1);q.push(points[j].map((v,k)=>points[j-1][k]+t*(v-points[j-1][k])));}
    return [q.map((p,i)=>{const n=normal(q,i),offset=i===0||i===q.length-1?0:i%2?6:-6;return [p[0]+offset*n[0],p[1]+offset*n[1]];})];
  }
  function drawTemperature(ctx,data,enabled) {
    for(const [i,p] of data.panels.entries()) {
      if(!enabled[i])continue;
      const scale=scales(data)[i];ctx.save();ctx.globalAlpha=.5;ctx.lineWidth=3.5;ctx.lineCap=ctx.lineJoin="round";
      ctx.beginPath();const [l,t,r,b]=p.bounds;ctx.rect(l,t,r-l,b-t);
      for(const level of p.levels)for(const [x,y,xx,yy] of level.labels)ctx.rect(x-2,y-2,xx-x+4,yy-y+4);ctx.clip("evenodd");
      for(const [j,level] of p.levels.entries())for(const ln of level.lines){ctx.strokeStyle=scale.colors[j];ctx.beginPath();ctx.moveTo(...ln.points[0]);for(const q of ln.points.slice(1))ctx.lineTo(...q);if(ln.closed)ctx.closePath();ctx.stroke();}
      ctx.restore();
    }
  }
  function drawSymbols(ctx,data) {
    ctx.save();ctx.globalAlpha=.5;ctx.lineJoin="miter";
    for(const s of data.symbols)for(const st of s.strokes){ctx.strokeStyle=s.letter==="D"?"#8052a8":ChartAnalysis.symbolPalette[s.letter];ctx.lineWidth=st.width_px+1.5;ctx.lineCap=st.line_cap||"butt";ctx.beginPath();ctx.moveTo(...st.points[0]);for(const p of st.points.slice(1))ctx.lineTo(...p);ctx.stroke();}
    ctx.restore();
  }
  function drawFills(ctx,data,on) {
    if(on.warm850)low.drawWarmFills(ctx,data,on.warmOpacity);
    const paintBands=(bands,opacity)=>{
      const canvas=ctx.canvas.ownerDocument.createElement("canvas");canvas.width=data.width;canvas.height=data.height;
      const sc=canvas.getContext("2d");
      for(const band of bands||[]){sc.fillStyle=band.color;sc.beginPath();for(const ring of band.rings){sc.moveTo(...ring[0]);for(const q of ring.slice(1))sc.lineTo(...q);sc.closePath();}sc.fill("evenodd");}
      ctx.save();ctx.globalAlpha=opacity;ctx.drawImage(canvas,0,0);ctx.restore();
    };
    for(const p of data.panels){ctx.save();const [l,t,r,b]=p.bounds;ctx.beginPath();ctx.rect(l,t,r-l,b-t);ctx.clip();
      if(p.pressure_hpa===700?on.cold700:p.pressure_hpa===850&&on.cold850)paintBands(p.cold_bands,on.opacity);
      if(on.wind && p.pressure_hpa===300)paintBands(p.wind_bands,1);
      for(const [key,color,active] of [["wet_rectangles","#269ed2",on.wet],["positive_vorticity_rectangles","#ec6ca5",on.vorticity],["ascent_rectangles","#fff000",on.ascent]])if(active){ctx.save();ctx.globalAlpha=.3;ctx.fillStyle=color;for(const [x,y,xx,yy] of p[key]||[])ctx.fillRect(x,y,xx-x,yy-y);ctx.restore();}
      ctx.restore();
    }
  }
  return {localHost,merge,validate,scales,jetAxes,crosses,drawAxes,axisSymbol,drawTemperature,drawSymbols,drawFills};
})();
if(typeof module!=="undefined")module.exports=SnapshotAnalysis;
