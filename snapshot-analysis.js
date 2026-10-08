"use strict";
const SnapshotAnalysis = (() => {
  const low=typeof LowLevelAnalysis!=="undefined"?LowLevelAnalysis:require("./low-level.js");
  const chart=typeof ChartAnalysis!=="undefined"?ChartAnalysis:require("./analysis.js"),rules=chart.coloringRules;
  const localHost = hostname => ["127.0.0.1", "localhost", "[::1]", "::1"].includes(hostname);
  const hash = /^[a-f0-9]{64}$/;
  const analysisPath = /^(local-collection|assets)\/analysis\/[a-z0-9-]+\.json$/;
  const precipitationColors=rules.precipitationColors;
  const precipitationLabels=["0–10 mm","10–20 mm","20–30 mm","30–40 mm","40–50 mm","50 mm以上"];
  const feasHours={FEAS502:24,FEAS504:48,FEAS507:72,FEAS509:96,FEAS512:120,FEAS514:144,FEAS516:168,FEAS519:192,FEAS521:216,FEAS524:240,FEAS526:264};
  const equivalentStops=rules.equivalentStops;
  function equivalentColor(value) {
    const v=Math.max(260,Math.min(370,value));
    const i=Math.min(equivalentStops.length-2,equivalentStops.findIndex((s,j)=>j<equivalentStops.length-1&&v<=equivalentStops[j+1][0]));
    const [a,ca]=equivalentStops[i],[b,cb]=equivalentStops[i+1],f=(v-a)/(b-a);
    return chart.mixColor(ca,cb,f);
  }
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
       data.product!==selected.product.code.split("/").at(-1) || data.variant!==selected.variant.id ||
       data.source_sha256!==selected.variant.source_sha256 || data.image_sha256!==selected.page.image_sha256 ||
       data.width!==selected.page.width || data.height!==selected.page.height || !Array.isArray(data.panels) ||
       !Array.isArray(data.symbols))throw Error("Trial analysis source mismatch");
    const surfaceHours={FXFE502:[12,24,12,24],FXFE504:[36,48,36,48],FXFE507:[72,72]}[data.product];
    const forecastHours={FXFE5782:[12,24,12,24],FXFE5784:[36,48,36,48],FXFE577:[72,72]}[data.product];
    const feasHour=feasHours[data.product];
    const equivalent=data.product==="FXJP854";
    if(equivalent!==Boolean(data.equivalent_temperature))throw Error("Invalid equivalent temperature product");
    const expected=equivalent?[850,850,850,850]:feasHour?[500,850]:surfaceHours ? (surfaceHours.length===4?[500,500,0,0]:[500,0]) : forecastHours ? (forecastHours.length===4?[500,500,850,850]:[500,850]) : {AUPA20:[200],AUPA25:[250],AUPQ35:[300,500],AUPQ78:[700,850],AXFE578:[500,850],FEAS50:[500,850]}[data.product];
    if(!expected || data.panels.length!==expected.length || (forecastHours && data.color_only!==true))throw Error("Unsupported trial product");
    if(Boolean(surfaceHours)!==Boolean(data.surface_forecast))throw Error("Invalid surface forecast product");
    if(Boolean(feasHour)!==Boolean(data.feas_forecast))throw Error("Invalid FEAS forecast product");
    const point=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>=-5&&p[1]>=-5&&p[0]<=data.width+5&&p[1]<=data.height+5;
    const line=p=>Array.isArray(p)&&p.length>=2&&p.length<=10000&&p.every(point);
    for(const [i,p] of data.panels.entries()) {
      if(p.pressure_hpa!==expected[i] || p.bounds?.length!==4 || !point(p.bounds.slice(0,2)) || !point(p.bounds.slice(2)) || p.bounds[0]>=p.bounds[2] || p.bounds[1]>=p.bounds[3] || !Array.isArray(p.levels) || !Array.isArray(p.troughs) || !Array.isArray(p.ridges))throw Error("Invalid trial panel");
      if(equivalent) {
        const within=q=>point(q)&&q[0]>=p.bounds[0]-.02&&q[0]<=p.bounds[2]+.02&&q[1]>=p.bounds[1]-.02&&q[1]<=p.bounds[3]+.02;
        if(data.unit!=="K" || JSON.stringify(data.range_k)!=="[260,370]" || p.forecast_hour!==[12,24,36,48][i] || p.levels.length || p.troughs.length || p.ridges.length || ["cold_bands","wet_rectangles","ascent_rectangles","positive_vorticity_rectangles","wind_bands","precipitation_bands"].some(k=>p[k]?.length))throw Error("Invalid equivalent temperature plane");
        const trace=p.equivalent_trace,levels=p.equivalent_levels,bands=p.equivalent_bands;
        if(trace?.method!=="native_solid_contours" || trace.interval_k!==3 || trace.label_interval_k!==6 || !levels?.length || bands?.length!==levels.length)throw Error("Missing equivalent contours");
        const seen=new Set();
        for(const [j,level]of levels.entries()){
          const band=bands[j];
          if(!Number.isFinite(level.value_k)||level.value_k<260||level.value_k>400||level.value_k%3||(j&&level.value_k!==levels[j-1].value_k+3)||!level.lines?.length||band.threshold_k!==level.value_k||band.color_value_k!==Math.min(370,level.value_k+1.5)||band.side_agreement<=.9||band.side_agreement>1||!band.rings?.length||band.rings.some(r=>!line(r)||!r.every(within)))throw Error("Invalid equivalent band");
          for(const ln of level.lines){if(!line(ln.points)||!ln.points.every(within)||typeof ln.closed!=="boolean"||!ln.source_paths?.length)throw Error("Invalid equivalent source contour");for(const id of ln.source_paths){if(!Number.isInteger(id)||id<0||seen.has(id))throw Error("Repeated equivalent source path");seen.add(id);}}
        }
        if(levels.reduce((n,l)=>n+l.lines.length,0)!==trace.source_contours||!trace.labels?.length||trace.labels.length!==trace.labels_read||trace.labels.some(l=>!Number.isFinite(l.value_k)||l.value_k%6||!point(l.point)))throw Error("Invalid equivalent source trace");
        if(data.panels.slice(0,i).some(q=>Math.min(p.bounds[2],q.bounds[2])>Math.max(p.bounds[0],q.bounds[0])&&Math.min(p.bounds[3],q.bounds[3])>Math.max(p.bounds[1],q.bounds[1])))throw Error("Overlapping equivalent panels");
      } else if(p.equivalent_levels||p.equivalent_bands)throw Error("Unsupported equivalent product");
      if(feasHour){
        const within=q=>point(q)&&q[0]>=p.bounds[0]-.25&&q[1]>=p.bounds[1]-.25&&q[0]<=p.bounds[2]+.25&&q[1]<=p.bounds[3]+.25;
        if(p.forecast_hour!==feasHour || p.wet_rectangles?.length || p.ascent_rectangles?.length || p.wind_bands?.length || p.jet_guides?.length || p.precipitation_bands?.length || p.axis_pressure_hpa===0)throw Error("Invalid FEAS forecast layers");
        if(i===0 ? (p.levels.length || p.cold_bands?.length || !p.positive_vorticity_rectangles?.length) : (!p.levels.length || p.temperature_interval_c!==3 || p.temperature_label_interval_c!==6 || !p.temperature_trace || !p.cold_thresholds?.length || p.troughs.length || p.ridges.length || p.positive_vorticity_rectangles?.length))throw Error("FEAS forecast pressure mismatch");
        if(p.levels.some(l=>l.lines.some(l=>!l.points.every(within))) || p.cold_bands?.some(b=>b.rings.some(r=>!r.every(within))) || p.positive_vorticity_rectangles?.some(r=>!within(r.slice(0,2))||!within(r.slice(2))) || [...p.troughs,...p.ridges].some(a=>!a.points.every(within)))throw Error("FEAS forecast outside panel");
        if(i && p.bounds[1]<=data.panels[0].bounds[3])throw Error("Overlapping FEAS forecast panels");
      }
      if(surfaceHours){
        const within=q=>point(q)&&q[0]>=p.bounds[0]-.25&&q[1]>=p.bounds[1]-.25&&q[0]<=p.bounds[2]+.25&&q[1]<=p.bounds[3]+.25;
        if(p.forecast_hour!==surfaceHours[i] || p.levels.length || p.wet_rectangles?.length || p.ascent_rectangles?.length || p.cold_bands?.length || p.wind_bands?.length || p.jet_guides?.length)throw Error("Invalid surface forecast layers");
        if(p.pressure_hpa===500){
          if(!p.positive_vorticity_rectangles?.length || p.precipitation_bands?.length)throw Error("Invalid forecast vorticity plane");
          if(p.positive_vorticity_rectangles.some(r=>!within(r.slice(0,2))||!within(r.slice(2))) || [...p.troughs,...p.ridges].some(a=>!a.points.every(within)))throw Error("500hPa forecast outside panel");
        }else{
          const accumulationHours=data.product==="FXFE507"?24:12;
          if(p.troughs.length || p.ridges.length || p.positive_vorticity_rectangles?.length || p.precipitation_unit!=="mm" || p.accumulation_hours!==accumulationHours || p.accumulation_start_hour!==p.forecast_hour-accumulationHours || p.accumulation_end_hour!==p.forecast_hour)throw Error("Invalid precipitation period or plane");
          const bands=p.precipitation_bands,trace=p.precipitation_trace;
          if(!bands?.length || bands[0].threshold!==0 || bands.some((b,j)=>b.threshold%10 || b.threshold<0 || b.threshold>50 || (j&&b.threshold<=bands[j-1].threshold) || b.color!==precipitationColors[b.threshold/10] || !b.rings?.length || b.rings.some(r=>!line(r)||!r.every(within))) || trace?.method!=="native_short_dash_contours" || trace.interval_mm!==10 || trace.maximum_contour_mm!==50)throw Error("Invalid native precipitation contours");
        }
        if(data.panels.slice(0,i).some(q=>Math.min(p.bounds[2],q.bounds[2])>Math.max(p.bounds[0],q.bounds[0])&&Math.min(p.bounds[3],q.bounds[3])>Math.max(p.bounds[1],q.bounds[1])))throw Error("Overlapping surface forecast panels");
      }else if(p.precipitation_bands?.length)throw Error("Unsupported precipitation product");
      if(forecastHours) {
        const inPanel=q=>point(q)&&q[0]>=p.bounds[0]-.25&&q[1]>=p.bounds[1]-.25&&q[0]<=p.bounds[2]+.25&&q[1]<=p.bounds[3]+.25;
        if(p.forecast_hour!==forecastHours[i] || p.temperature_interval_c!==(p.pressure_hpa===850?3:6) || p.temperature_label_interval_c!==6 || p.troughs.length || p.ridges.length || p.positive_vorticity_rectangles?.length || p.wind_bands?.length || p.jet_guides?.length)throw Error("Invalid forecast color layer");
        if(p.levels.some(l=>l.temperature_c%(p.pressure_hpa===850?3:6) || l.lines.some(l=>!l.points.every(inPanel))) || p.cold_bands?.some(b=>b.rings.some(r=>!r.every(inPanel))))throw Error("Forecast contour outside panel");
        if(expected[i]===500 ? (p.wet_pressure_hpa!==700 || !p.wet_rectangles?.length || p.ascent_rectangles?.length || p.cold_bands?.length) : (p.vertical_velocity_pressure_hpa!==700 || !p.ascent_rectangles?.length || p.wet_rectangles?.length))throw Error("Forecast weather layer pressure mismatch");
        for(const key of ["wet_rectangles","ascent_rectangles"])if(p[key]?.some(r=>!inPanel(r.slice(0,2))||!inPanel(r.slice(2))))throw Error("Forecast fill outside panel");
        if(data.panels.slice(0,i).some(q=>Math.min(p.bounds[2],q.bounds[2])>Math.max(p.bounds[0],q.bounds[0])&&Math.min(p.bounds[3],q.bounds[3])>Math.max(p.bounds[1],q.bounds[1])))throw Error("Overlapping forecast panels");
      }
      for(const l of p.levels)if(!Number.isFinite(l.temperature_c)||!Array.isArray(l.labels)||!Array.isArray(l.lines)||l.lines.some(l=>!line(l.points)))throw Error("Invalid trial isotherm");
      if((data.product==="FEAS50" || feasHour) && i===1 && p.temperature_trace){
        const trace=p.temperature_trace,seen=new Set();
        if(trace.method!=="native_regular_dash_connectivity" || p.temperature_interval_c!==3 || trace.unassigned_groups!==0 ||
           !Number.isFinite(trace.dash_length_px) || trace.dash_length_px<=0 || !Number.isFinite(trace.numeric_label_font_px) || trace.numeric_label_font_px<=0)throw Error("Invalid source dash trace");
        if(feasHour && (!Number.isFinite(trace.frame_margin_px)||trace.frame_margin_px<=0||trace.frame_margin_px>35||trace.frame_margin_px>trace.numeric_label_font_px+2*trace.dash_length_px+.02))throw Error("Invalid native frame inset");
        for(const level of p.levels)for(const ln of level.lines){
          if(level.temperature_c%3 || !Array.isArray(ln.source_paths) || ln.source_paths.length<3 || !Array.isArray(ln.source_bridges))throw Error("Missing native isotherm strokes");
          for(const id of ln.source_paths){if(!Number.isInteger(id)||id<0||seen.has(id))throw Error("Repeated native isotherm stroke");seen.add(id);}
          for(let j=1;j<ln.points.length;j++)if(Math.hypot(...ln.points[j].map((v,k)=>v-ln.points[j-1][k]))>trace.numeric_label_font_px*(feasHour?3.6:3.5)+.1)throw Error("Unsupported isotherm connector");
          if(ln.closed && Math.hypot(...ln.points[0].map((v,k)=>v-ln.points.at(-1)[k]))>trace.dash_length_px*1.12+.05)throw Error("Unsupported closed isotherm");
          if(ln.source_bridges.some(b=>b.kind!=="numeric_stamp" || b.value!==level.temperature_c || b.points?.length!==2 || !b.points.every(point)))throw Error("Invalid numeric isotherm gap");
        }
      }
      for(const key of ["troughs","ridges"])if(p[key].some(a=>!line(a.points)))throw Error("Invalid trial axis");
      for(const a of p.troughs)for(const b of p.ridges)if(crosses(a.points,b.points))throw Error("Same-pressure trough/ridge crossing");
      for(const key of ["wet_rectangles","positive_vorticity_rectangles","ascent_rectangles"])if(p[key]?.some(r=>r.length!==4||!point(r.slice(0,2))||!point(r.slice(2))||r[0]>=r[2]||r[1]>=r[3]))throw Error("Invalid trial fill");
      for(const key of ["cold_bands","wind_bands"])if(p[key]?.some(b=>!Number.isFinite(b.threshold)||!/^#[a-f0-9]{6}$/i.test(b.color)||!Array.isArray(b.rings)||b.rings.some(r=>!line(r))))throw Error("Invalid trial band");
      if(p.wind_bands?.length) {
        if(!(p.pressure_hpa===300||data.product==="AUPA20"&&p.pressure_hpa===200||data.product==="AUPA25"&&p.pressure_hpa===250) || p.wind_bands.length!==5 || p.wind_bands.some((b,j)=>b.threshold!==40+j*20 || b.color!==ChartAnalysis.windPalette[j]))throw Error("Invalid upper-level wind intervals");
      }
      if(data.product==="AUPA25") {
        const within=q=>point(q)&&q[0]>=p.bounds[0]-.02&&q[1]>=p.bounds[1]-.02&&q[0]<=p.bounds[2]+.02&&q[1]<=p.bounds[3]+.02,trace=p.wind_trace;
        if(p.troughs.length||p.ridges.length||p.wind_bands?.length!==5||trace?.unit!=="kt"||trace.interval!==20||!Number.isFinite(trace.order_fit_cost)||trace.order_fit_cost>2||!Number.isInteger(trace.source_contours)||trace.source_contours<=0||!trace.levels?.length||!trace.labels?.length||trace.labels.some(l=>!Number.isFinite(l.value)||l.value<20||l.value>160||l.value%20||!within(l.point)))throw Error("Invalid AUPA25 source fields");
        const ids=new Set();
        for(const level of trace.levels){
          if(!Number.isFinite(level.speed_kt)||level.speed_kt<20||level.speed_kt>180||level.speed_kt%20||!level.lines?.length)throw Error("Invalid 250hPa source isotach");
          for(const ln of level.lines){if(!line(ln.points)||!ln.points.every(within)||typeof ln.closed!=="boolean"||!ln.source_paths?.length)throw Error("Invalid 250hPa source contour");for(const id of ln.source_paths){if(!Number.isInteger(id)||id<0||ids.has(id))throw Error("Repeated 250hPa source path");ids.add(id);}}
        }
        if(p.wind_bands.some(b=>!b.rings.length||b.rings.some(r=>!r.every(within)))||!p.levels.length||p.levels.some(l=>l.temperature_c%6||l.lines.some(ln=>ln.value_origin!=="printed_stamp_sequence"||!ln.points.every(within)||ln.points.slice(1).some((q,j)=>Math.hypot(q[0]-ln.points[j][0],q[1]-ln.points[j][1])>110.02))))throw Error("250hPa field outside frame or stamp sequence");
        if(!p.excluded_boxes?.length||p.excluded_boxes.some(b=>b.length!==4||!b.every(Number.isFinite)||b[0]>=b[2]||b[1]>=b[3]))throw Error("Missing 250hPa legend masks");
      }
      if(data.product==="AUPA20") {
        const trace=p.tropopause_trace,levels=p.tropopause_levels,bands=p.tropopause_bands;
        const within=q=>point(q)&&q[0]>=p.bounds[0]-.02&&q[1]>=p.bounds[1]-.02&&q[0]<=p.bounds[2]+.02&&q[1]<=p.bounds[3]+.02;
        if(p.pressure_hpa!==200||p.troughs.length||p.ridges.length||p.jet_guides?.length||p.wind_bands?.length!==5||p.wind_trace?.unit!=="kt"||p.wind_trace.interval!==20||!Number.isFinite(p.wind_trace.order_fit_cost)||p.wind_trace.order_fit_cost>2||trace?.unit!=="hPa"||trace.interval!==50||trace.label_interval!==100||!Number.isFinite(trace.order_fit_cost)||(!Number.isInteger(trace.source_contours)||trace.source_contours<=0)||trace.order_fit_cost/trace.source_contours>1||!levels?.length||bands?.length!==levels.length||!trace.labels?.length||trace.labels.some(l=>!Number.isFinite(l.value)||l.value<100||l.value>500||l.value%100||!within(l.point)))throw Error("Invalid AUPA20 source fields");
        if(p.wind_bands.some(b=>b.rings.some(r=>!r.every(within)))||p.levels.some(l=>l.lines.some(ln=>!ln.points.every(within))))throw Error("AUPA20 field outside frame");
        const ids=new Set();
        for(const [j,level] of levels.entries()){
          const band=bands[j];
          if(!Number.isFinite(level.pressure_hpa)||level.pressure_hpa<50||level.pressure_hpa>500||level.pressure_hpa%50||(j&&level.pressure_hpa!==levels[j-1].pressure_hpa+50)||!level.lines?.length||band.threshold!==level.pressure_hpa||band.side_agreement<=.95||band.side_agreement>1||!band.rings?.length||band.rings.some(r=>!line(r)||!r.every(within)))throw Error("Invalid tropopause pressure bands");
          for(const ln of level.lines)if(!line(ln.points)||!ln.points.every(within)||typeof ln.closed!=="boolean"||!ln.source_paths?.length)throw Error("Invalid tropopause contours");
        }
        if(!p.native_jet_strokes?.length||p.native_jet_strokes.some(st=>!line(st.points)||!st.points.every(within)||st.points.length>3||!Number.isInteger(st.source_path)||st.source_path<0||!Number.isFinite(st.width_px)||st.width_px<=0||st.width_px>8||ids.has(st.source_path)||!ids.add(st.source_path)))throw Error("Invalid native 200hPa jet");
        if(!p.excluded_boxes?.length||p.excluded_boxes.some(b=>b.length!==4||!b.every(Number.isFinite)||b[0]>=b[2]||b[1]>=b[3]))throw Error("Missing map legend masks");
      } else if(p.tropopause_bands||p.tropopause_levels||p.native_jet_strokes)throw Error("Unsupported tropopause product");
      if(data.product==="AUPQ35" && i===0 || data.product==="AUPA25") {
        if(p.troughs.length || p.ridges.length)throw Error("300hPa uses wind and jet axes");
        const wind={...data,pressure_hpa:p.pressure_hpa,unit:"kt",bounds:p.bounds,bands:(p.wind_bands||[]).map(b=>({min_kt:b.threshold,rings:b.rings}))};
        // The parent source/image binding also binds the wind and branch guides.
        if(p.pressure_hpa===300)ChartAnalysis.validateWindBands(wind,data);
        ChartAnalysis.validateJetGuides({...data,pressure_hpa:p.pressure_hpa,axes:p.jet_guides},data,wind);
      } else if(p.jet_guides?.length)throw Error("Jet axes must use 300hPa wind");
      if(p.ascent_rectangles && p.vertical_velocity_pressure_hpa!==700)throw Error("Ascent must be 700hPa");
      if(data.product==="FEAS50" && i===1 && p.axis_pressure_hpa!==0)throw Error("FEAS axes must use surface pressure");
      if(p.cold_thresholds?.length && JSON.stringify(p.cold_thresholds)!==JSON.stringify(rules.coldThresholds[p.pressure_hpa]))throw Error("Cold threshold mismatch");
    }
    for(const s of data.symbols)if(!["L","H","C","W","D"].includes(s.letter)||!Array.isArray(s.strokes)||s.strokes.some(st=>!line(st.points)||!Number.isFinite(st.width_px)||st.width_px<=0))throw Error("Invalid trial symbol");
    return data;
  }
  function scales(data) {
    return data.panels.map(p=>chart.temperatureScale(p.pressure_hpa,p.levels.map(l=>l.temperature_c)));
  }
  // Both forecast hours share a toggle and legend for their pressure level.
  // Drawing still uses each panel's own coordinates and colors.
  function displayScales(data) {
    if(data.equivalent_temperature)return [0,1].map(()=>chart.temperatureScale(850,[]));
    const all=scales(data);
    if(!data.color_only&&!data.surface_forecast)return all;
    return [500,data.surface_forecast?0:850].map(pressure=>{
      const entries=all.filter(s=>s.pressure_hpa===pressure),colors=new Map(entries.flatMap(s=>s.values.map((v,i)=>[v,s.colors[i]])));
      const values=[...colors.keys()].sort((a,b)=>a-b);
      return {pressure_hpa:pressure,values,colors:values.map(v=>colors.get(v)),dash:[],opacity:rules.temperatureOpacity};
    });
  }
  function temperatureEnabled(data, enabled) {
    return data.color_only ? data.panels.map(p=>enabled[p.pressure_hpa===500?0:1]) : enabled;
  }
  function jetAxes(data) {
    const p=data.panels.find(p=>[250,300].includes(p.pressure_hpa));
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
    ctx.save();ctx.lineCap=ctx.lineJoin="round";ctx.strokeStyle=ridge?rules.axes.ridge:rules.axes.trough;
    ctx.lineWidth=rules.axes.width;ctx.globalAlpha=rules.axes.opacity;
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
  function clipPanel(ctx,p) {
    const [l,t,r,b]=p.bounds;ctx.beginPath();ctx.rect(l,t,r-l,b-t);
    for(const [x,y,xx,yy]of p.excluded_boxes||[])ctx.rect(Math.max(l,x),Math.max(t,y),Math.min(r,xx)-Math.max(l,x),Math.min(b,yy)-Math.max(t,y));
    ctx.clip("evenodd");
  }
  function tropopauseColor(value) {
    if(value<rules.tropopauseMinimum)return null;
    const stops=rules.tropopauseStops,v=Math.max(stops[0][0],Math.min(stops.at(-1)[0],value));
    const i=Math.min(stops.length-2,stops.findIndex((s,j)=>j<stops.length-1&&v<=stops[j+1][0]));
    return chart.mixColor(stops[i][1],stops[i+1][1],(v-stops[i][0])/(stops[i+1][0]-stops[i][0]));
  }
  function tropopauseLegend() {
    return [{value:rules.tropopauseMinimum-50,label:`${rules.tropopauseMinimum} hPa未満（無色）`,color:null},...rules.tropopauseStops.map(([value,color],i,a)=>({value,color,label:i<a.length-1?`${value}–${a[i+1][0]} hPa`:`${value} hPa以上`}))];
  }
  function drawNativeJets(ctx,data) {
    for(const p of data.panels)if(p.native_jet_strokes?.length){ctx.save();clipPanel(ctx,p);ctx.lineJoin=ctx.lineCap="round";
      for(const [color,extra] of [[rules.jetOutline.color,rules.jetOutline.width],[rules.axes.trough,0]]){ctx.strokeStyle=color;
        for(const st of p.native_jet_strokes){ctx.lineWidth=st.width_px+1+extra;ctx.beginPath();ctx.moveTo(...st.points[0]);for(const q of st.points.slice(1))ctx.lineTo(...q);ctx.stroke();}
      }ctx.restore();}
  }
  function drawTropopause(ctx,data) {
    for(const p of data.panels)if(p.tropopause_bands?.length){ctx.save();clipPanel(ctx,p);
      const canvas=ctx.canvas.ownerDocument.createElement("canvas");canvas.width=data.width;canvas.height=data.height;const c=canvas.getContext("2d");
      for(const band of p.tropopause_bands){const color=tropopauseColor(band.threshold);if(!color)continue;c.fillStyle=color;c.beginPath();for(const ring of band.rings){c.moveTo(...ring[0]);for(const q of ring.slice(1))c.lineTo(...q);c.closePath();}c.fill("evenodd");}
      ctx.globalAlpha=rules.tropopauseOpacity;ctx.drawImage(canvas,0,0);
      ctx.globalAlpha=rules.tropopauseBoundary.opacity;ctx.strokeStyle=rules.tropopauseBoundary.color;ctx.lineWidth=rules.tropopauseBoundary.width;ctx.lineJoin=ctx.lineCap="round";
      for(const level of p.tropopause_levels)for(const line of level.lines){ctx.beginPath();ctx.moveTo(...line.points[0]);for(const q of line.points.slice(1))ctx.lineTo(...q);if(line.closed)ctx.closePath();ctx.stroke();}
      ctx.restore();}
  }
  function drawTemperature(ctx,data,enabled) {
    for(const [i,p] of data.panels.entries()) {
      if(!enabled[i])continue;
      const scale=scales(data)[i];ctx.save();ctx.globalAlpha=scale.opacity;ctx.lineWidth=3.5;ctx.lineCap=ctx.lineJoin="round";
      clipPanel(ctx,p);
      ctx.beginPath();const [l,t,r,b]=p.bounds;ctx.rect(l,t,r-l,b-t);
      for(const level of p.levels)for(const [x,y,xx,yy] of level.labels)ctx.rect(x-2,y-2,xx-x+4,yy-y+4);ctx.clip("evenodd");
      for(const [j,level] of p.levels.entries())for(const ln of level.lines){ctx.strokeStyle=scale.colors[j];ctx.beginPath();ctx.moveTo(...ln.points[0]);if(["AUPA20","AUPA25"].includes(data.product))for(const segment of chart.isothermSegments(ln.points,ln.closed))ctx.bezierCurveTo(...segment.c1,...segment.c2,...segment.end);else {for(const q of ln.points.slice(1))ctx.lineTo(...q);if(ln.closed)ctx.closePath();}ctx.stroke();}
      ctx.restore();
    }
  }
  function drawSymbols(ctx,data) {
    ctx.save();ctx.globalAlpha=rules.symbolOpacity;ctx.lineJoin="miter";
    for(const s of data.symbols)for(const st of s.strokes){ctx.strokeStyle=s.letter==="D"?"#8052a8":ChartAnalysis.symbolPalette[s.letter];ctx.lineWidth=st.width_px+1.5;ctx.lineCap=st.line_cap||"butt";ctx.beginPath();ctx.moveTo(...st.points[0]);for(const p of st.points.slice(1))ctx.lineTo(...p);ctx.stroke();}
    ctx.restore();
  }
  function drawFills(ctx,data,on) {
    if(on.warm850)low.drawWarmFills(ctx,data,on.warmOpacity);
    const paintBands=(bands,opacity,colorFor=band=>band.color)=>{
      const canvas=ctx.canvas.ownerDocument.createElement("canvas");canvas.width=data.width;canvas.height=data.height;
      const sc=canvas.getContext("2d");
      for(const band of bands||[]){const color=colorFor(band);if(!color)continue;sc.fillStyle=color;sc.beginPath();for(const ring of band.rings){sc.moveTo(...ring[0]);for(const q of ring.slice(1))sc.lineTo(...q);sc.closePath();}sc.fill("evenodd");}
      ctx.save();ctx.globalAlpha=opacity;ctx.drawImage(canvas,0,0);ctx.restore();
    };
    for(const p of data.panels){ctx.save();const [l,t,r,b]=p.bounds;clipPanel(ctx,p);
      if(on.equivalent && data.equivalent_temperature){
        const frame=[[l,t],[r,t],[r,b],[l,b]];
        paintBands([{color:equivalentColor(p.equivalent_levels[0].value_k-1.5),rings:[frame]},...p.equivalent_bands.map(b=>({...b,color:equivalentColor(b.color_value_k)}))],on.equivalentOpacity??rules.equivalentOpacity);
      }
      // Source bands own the geometry; the shared palette owns display colors
      // so stored legacy colors cannot disagree with the UI and PNG legends.
      if(p.pressure_hpa===700?on.cold700:p.pressure_hpa===850&&on.cold850)paintBands(p.cold_bands,on.opacity??rules.coldOpacity,band=>chart.coldColor(p.pressure_hpa,band.threshold));
      if(on.wind && [200,250,300].includes(p.pressure_hpa))paintBands(p.wind_bands,1,band=>chart.windPalette[(band.threshold-40)/20]);
      if(on.precipitation && p.pressure_hpa===0)paintBands(p.precipitation_bands,rules.precipitationOpacity,band=>precipitationColors[band.threshold/10]);
      for(const [key,style,active] of [["wet_rectangles",rules.wet,on.wet],["positive_vorticity_rectangles",rules.vorticity,on.vorticity],["ascent_rectangles",rules.ascent,on.ascent]])if(active)chart.drawRectangleFill(ctx,p[key],style);
      ctx.restore();
    }
  }
  return {localHost,merge,validate,scales,displayScales,temperatureEnabled,jetAxes,crosses,drawAxes,axisSymbol,drawTemperature,drawSymbols,drawFills,drawNativeJets,drawTropopause,tropopauseColor,tropopauseLegend,precipitationColors,precipitationLabels,equivalentColor,equivalentStops};
})();
if(typeof module!=="undefined")module.exports=SnapshotAnalysis;
