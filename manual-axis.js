"use strict";
const ManualAxis = (() => {
  const maxNodes = 100;
  // Same weather glyph vocabulary as the Bousai Wx Lab daily calendar.
  const weather = Object.freeze([
    ["sun","☀️","晴れ"],["sun-cloud","🌤️","晴れ時々曇り"],["cloud-sun","⛅","曇り時々晴れ"],
    ["cloud","☁️","曇り"],["thin-cloud","🌥️","薄曇り"],["rain","☂️","雨"],
    ["heavy-rain","☔️","大雨"],["snow","☃️","雪"],["ice","❄️","雪・みぞれ"],
    ["lightning","⚡️","雷"],["thunder-rain","⛈️","雷雨"],["fog","🌫️","霧"],
    ["wind","🌬️","風"],["water","💧","みぞれの水滴"],["hail","🧊","ひょう・あられ"]
  ].map(([id,glyph,label])=>Object.freeze({id,glyph,label})));
  const boxTypes = ["rect","ellipse","roundrect","triangle","emoji"];
  const arrows = ["none","arrow","open","circle","diamond"];
  const exact=(o,keys)=>o && typeof o==="object" && !Array.isArray(o) && Object.keys(o).length===keys.length && keys.every(k=>Object.hasOwn(o,k));
  const isBox = object => object?.kind==="vector" && boxTypes.includes(object.type);
  const isCurve = object => object?.kind==="axis" || (object?.kind==="vector" && object.type==="curve");
  const anchors = points => points.map(p=>({p:[...p],in:[...p],out:[...p]}));
  const clone = object => ({...object,nodes:copy(object.nodes),...(object.style?{style:{...object.style}}:{})});
  const copy = nodes => nodes.map(n => ({p:[...n.p],in:[...n.in],out:[...n.out]}));
  const distance = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1]);
  const mix = (a,b,t) => a.map((v,k) => v+(b[k]-v)*t);
  const clamp = (p,w,h) => [Math.max(0,Math.min(w,p[0])),Math.max(0,Math.min(h,p[1]))];
  function smooth(points,w,h) {
    return points.map((p,i) => {
      const prev=points[Math.max(0,i-1)],next=points[Math.min(points.length-1,i+1)];
      const tangent=next.map((v,k)=>(v-prev[k])/(i===0 || i===points.length-1 ? 3 : 6));
      return {p:[...p],in:clamp(p.map((v,k)=>v-tangent[k]),w,h),out:clamp(p.map((v,k)=>v+tangent[k]),w,h)};
    });
  }
  function cubic(a,b,t) {
    const u=1-t;
    return a.p.map((v,k)=>u*u*u*v+3*u*u*t*a.out[k]+3*u*t*t*b.in[k]+t*t*t*b.p[k]);
  }
  function samples(nodes,step=3) {
    const result=[];
    for(let i=0;i<nodes.length-1;i++) {
      const a=nodes[i],b=nodes[i+1];
      const steps=Math.min(256,Math.max(2,Math.ceil((distance(a.p,a.out)+distance(a.out,b.in)+distance(b.in,b.p))/step)));
      for(let j=Number(i>0);j<=steps;j++) {
        const p=cubic(a,b,j/steps);
        if(!result.length || distance(p,result.at(-1))>1e-6)result.push(p);
      }
    }
    return result;
  }
  function nearest(nodes,p) {
    let best={distance:Infinity,segment:0,t:0,point:null};
    for(let i=0;i<nodes.length-1;i++) {
      const a=nodes[i],b=nodes[i+1],steps=Math.min(256,Math.max(24,Math.ceil((distance(a.p,a.out)+distance(a.out,b.in)+distance(b.in,b.p))/4)));
      let prev=cubic(a,b,0);
      for(let j=1;j<=steps;j++) {
        const next=cubic(a,b,j/steps),d=next.map((v,k)=>v-prev[k]),length=d[0]*d[0]+d[1]*d[1];
        const along=length ? Math.max(0,Math.min(1,((p[0]-prev[0])*d[0]+(p[1]-prev[1])*d[1])/length)) : 0;
        const q=mix(prev,next,along),dist=distance(p,q);
        if(dist<best.distance)best={distance:dist,segment:i,t:(j-1+along)/steps,point:q};
        prev=next;
      }
    }
    return best;
  }
  // De Casteljau subdivision inserts an editable vertex without changing the curve.
  function insert(nodes,segment,t) {
    const result=copy(nodes),a=result[segment],b=result[segment+1];
    const ab=mix(a.p,a.out,t),bc=mix(a.out,b.in,t),cd=mix(b.in,b.p,t);
    const left=mix(ab,bc,t),right=mix(bc,cd,t),p=mix(left,right,t);
    a.out=ab;b.in=cd;result.splice(segment+1,0,{p,in:left,out:right});
    return result;
  }
  function move(nodes,index,part,p,w,h) {
    const result=copy(nodes),n=result[index];
    if(part==="p") {
      const delta=p.map((v,k)=>v-n.p[k]);
      for(const key of ["p","in","out"])n[key]=clamp(n[key].map((v,k)=>v+delta[k]),w,h);
    } else {
      const other=part==="in"?"out":"in",radius=distance(n.p,n[other]);
      n[part]=clamp(p,w,h);
      const vector=n[part].map((v,k)=>v-n.p[k]),length=Math.hypot(...vector);
      if(length>1e-6)n[other]=clamp(n.p.map((v,k)=>v-vector[k]*radius/length),w,h);
    }
    return result;
  }
  function resolved(history,override=null) {
    const axes=new Map();
    for(const event of history) {
      if(event.kind==="clear")axes.clear();
      else if(["axis","vector"].includes(event.kind))axes.set(event.id,event);
      else if(event.kind==="axis-edit" && axes.has(event.id))axes.set(event.id,{...axes.get(event.id),nodes:event.nodes});
      else if(event.kind==="vector-edit" && axes.has(event.id))axes.set(event.id,event.value);
      else if(event.kind==="axis-delete")axes.delete(event.id);
    }
    if(override && axes.has(override.id))axes.set(override.id,override.value || {...axes.get(override.id),nodes:override.nodes});
    return axes;
  }
  function flattened(history,override=null) {
    const axes=resolved(history,override),lastClear=history.map(s=>s.kind).lastIndexOf("clear");
    return history.slice(lastClear+1).flatMap(s=>["axis","vector"].includes(s.kind)?(axes.has(s.id)?[axes.get(s.id)]:[]):s.kind.startsWith("axis-") || s.kind==="vector-edit"?[]:[s]);
  }
  function valid(stroke,w,h) {
    const point=p=>Array.isArray(p) && p.length===2 && p.every((v,k)=>typeof v==="number" && Number.isFinite(v) && v>=0 && v<=(k?h:w));
    return exact(stroke,["kind","id","type","nodes"]) && stroke.kind==="axis" && typeof stroke.id==="string" && /^[a-zA-Z0-9-]{1,64}$/.test(stroke.id) && ["trough","ridge"].includes(stroke.type) && Array.isArray(stroke.nodes) && stroke.nodes.length>=2 && stroke.nodes.length<=maxNodes && stroke.nodes.every(n=>exact(n,["p","in","out"]) && [n.p,n.in,n.out].every(point)) && samples(stroke.nodes).length>=2;
  }
  function draw(ctx,stroke,renderer) {
    if(stroke.kind==="vector") {drawVector(ctx,stroke);return;}
    const points=samples(stroke.nodes);
    if(points.length>=2)(stroke.type==="trough"?renderer.drawTroughs:renderer.drawRidges)(ctx,[points]);
  }
  function bounds(object) {
    const [a,b]=object.nodes.map(n=>n.p);
    return {x:Math.min(a[0],b[0]),y:Math.min(a[1],b[1]),width:Math.abs(b[0]-a[0]),height:Math.abs(b[1]-a[1])};
  }
  function corners(object) {
    const b=bounds(object);
    return [[b.x,b.y],[b.x+b.width,b.y],[b.x+b.width,b.y+b.height],[b.x,b.y+b.height]];
  }
  function resize(object,index,p,w,h) {
    const opposite=corners(object)[(index+2)%4],q=clamp(p,w,h);
    for(let k=0;k<2;k++)if(Math.abs(q[k]-opposite[k])<1)q[k]=opposite[k]+(opposite[k]>=(k?h:w)?-1:1);
    if(object.type==="emoji") {
      const sign=q.map((v,k)=>Math.sign(v-opposite[k]));
      const size=Math.max(1,Math.min(Math.max(...q.map((v,k)=>Math.abs(v-opposite[k]))),sign[0]>0?w-opposite[0]:opposite[0],sign[1]>0?h-opposite[1]:opposite[1]));
      q[0]=opposite[0]+sign[0]*size;q[1]=opposite[1]+sign[1]*size;
    }
    return {...clone(object),nodes:anchors([[Math.min(q[0],opposite[0]),Math.min(q[1],opposite[1])],[Math.max(q[0],opposite[0]),Math.max(q[1],opposite[1])]])};
  }
  function translate(object,delta,w,h) {
    const result=clone(object),points=result.nodes.flatMap(n=>[n.p,n.in,n.out]);
    const dx=Math.max(-Math.min(...points.map(p=>p[0])),Math.min(delta[0],w-Math.max(...points.map(p=>p[0]))));
    const dy=Math.max(-Math.min(...points.map(p=>p[1])),Math.min(delta[1],h-Math.max(...points.map(p=>p[1]))));
    for(const node of result.nodes)for(const part of ["p","in","out"])node[part]=[node[part][0]+dx,node[part][1]+dy];
    return result;
  }
  function validVector(o,w,h) {
    const point=p=>Array.isArray(p) && p.length===2 && p.every((v,k)=>typeof v==="number" && Number.isFinite(v) && v>=0 && v<=(k?h:w));
    const hex=c=>typeof c==="string" && /^#[a-f0-9]{6}$/i.test(c);
    const number=(v,min,max)=>typeof v==="number" && Number.isFinite(v) && v>=min && v<=max;
    if(!exact(o,["kind","id","type","nodes","style","emoji"]) || o.kind!=="vector" || typeof o.id!=="string" || !/^[a-zA-Z0-9-]{1,64}$/.test(o.id) || !["curve","line",...boxTypes].includes(o.type) || !Array.isArray(o.nodes) || o.nodes.length<2 || o.nodes.length>maxNodes || o.nodes.some(n=>!exact(n,["p","in","out"]) || ![n.p,n.in,n.out].every(point)))return false;
    const s=o.style;
    if(!exact(s,["stroke","fill","width","opacity","start","end"]) || !hex(s.stroke) || !(s.fill==="none" || hex(s.fill)) || !number(s.width,1,40) || !number(s.opacity,0,1) || ![s.start,s.end].every(a=>arrows.includes(a)))return false;
    if(o.type!=="curve" && (o.nodes.length!==2 || o.nodes.some(n=>distance(n.p,n.in)>1e-6 || distance(n.p,n.out)>1e-6)))return false;
    if(isBox(o)) {
      const b=bounds(o);
      if(b.width<1 || b.height<1 || s.start!=="none" || s.end!=="none")return false;
    } else if(samples(o.nodes).length<2)return false;
    return o.type==="emoji" ? weather.some(e=>e.id===o.emoji) : o.emoji===null;
  }
  function hit(object,p,tolerance) {
    if(!isBox(object))return nearest(object.nodes,p);
    const b=bounds(object),cx=b.x+b.width/2,cy=b.y+b.height/2;
    let inside=p[0]>=b.x && p[0]<=b.x+b.width && p[1]>=b.y && p[1]<=b.y+b.height;
    if(object.type==="ellipse")inside=((p[0]-cx)/(b.width/2))**2+((p[1]-cy)/(b.height/2))**2<=1;
    if(object.type==="triangle")inside=inside && Math.abs(p[0]-cx)<=(p[1]-b.y)*b.width/(2*b.height);
    if(inside)return {distance:0};
    return {distance:Math.hypot(Math.max(b.x-p[0],0,p[0]-b.x-b.width),Math.max(b.y-p[1],0,p[1]-b.y-b.height))+tolerance};
  }
  function arrow(ctx,p,toward,kind,width) {
    if(kind==="none" || distance(p,toward)<1e-6)return;
    const angle=Math.atan2(p[1]-toward[1],p[0]-toward[0]),length=Math.max(14,width*3.5),half=Math.max(7,width*1.7);
    ctx.save();ctx.translate(...p);ctx.rotate(angle);ctx.beginPath();
    if(kind==="circle")ctx.arc(-half,0,half,0,Math.PI*2);
    else if(kind==="diamond") {ctx.moveTo(0,0);ctx.lineTo(-length/2,half);ctx.lineTo(-length,0);ctx.lineTo(-length/2,-half);ctx.closePath();}
    else {ctx.moveTo(-length,-half);ctx.lineTo(0,0);ctx.lineTo(-length,half);if(kind==="arrow")ctx.closePath();}
    if(kind==="open")ctx.stroke();else ctx.fill();ctx.restore();
  }
  function drawVector(ctx,o) {
    const s=o.style;ctx.save();ctx.globalAlpha=s.opacity;ctx.strokeStyle=s.stroke;ctx.fillStyle=s.stroke;ctx.lineWidth=s.width;ctx.lineCap=ctx.lineJoin="round";
    if(isBox(o)) {
      const b=bounds(o);
      if(o.type==="emoji") {
        const glyph=weather.find(e=>e.id===o.emoji)?.glyph;
        if(glyph){ctx.font=`${Math.min(b.width,b.height)*.85}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(glyph,b.x+b.width/2,b.y+b.height/2);}
      } else {
        ctx.beginPath();
        if(o.type==="ellipse")ctx.ellipse(b.x+b.width/2,b.y+b.height/2,b.width/2,b.height/2,0,0,Math.PI*2);
        else if(o.type==="triangle"){ctx.moveTo(b.x+b.width/2,b.y);ctx.lineTo(b.x+b.width,b.y+b.height);ctx.lineTo(b.x,b.y+b.height);ctx.closePath();}
        else if(o.type==="roundrect")ctx.roundRect(b.x,b.y,b.width,b.height,Math.min(b.width,b.height)*.18);
        else ctx.rect(b.x,b.y,b.width,b.height);
        if(s.fill!=="none"){ctx.fillStyle=s.fill;ctx.fill();}ctx.stroke();
      }
    } else {
      ctx.beginPath();ctx.moveTo(...o.nodes[0].p);
      for(let i=1;i<o.nodes.length;i++)ctx.bezierCurveTo(...o.nodes[i-1].out,...o.nodes[i].in,...o.nodes[i].p);
      ctx.stroke();
      const points=samples(o.nodes);
      if(points.length>=2){arrow(ctx,points[0],points[1],s.start,s.width);arrow(ctx,points.at(-1),points.at(-2),s.end,s.width);}
    }
    ctx.restore();
  }
  return {maxNodes,weather,arrows,isBox,isCurve,anchors,clone,bounds,corners,resize,translate,validVector,hit,copy,distance,smooth,cubic,samples,nearest,insert,move,resolved,flattened,valid,draw};
})();
if(typeof module!=="undefined")module.exports=ManualAxis;
