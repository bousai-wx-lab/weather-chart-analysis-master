"use strict";
const ManualAxis = (() => {
  const maxNodes = 100;
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
      else if(event.kind==="axis")axes.set(event.id,event);
      else if(event.kind==="axis-edit" && axes.has(event.id))axes.set(event.id,{...axes.get(event.id),nodes:event.nodes});
      else if(event.kind==="axis-delete")axes.delete(event.id);
    }
    if(override && axes.has(override.id))axes.set(override.id,{...axes.get(override.id),nodes:override.nodes});
    return axes;
  }
  function flattened(history,override=null) {
    const axes=resolved(history,override),lastClear=history.map(s=>s.kind).lastIndexOf("clear");
    return history.slice(lastClear+1).flatMap(s=>s.kind==="axis"?(axes.has(s.id)?[axes.get(s.id)]:[]):s.kind.startsWith("axis-")?[]:[s]);
  }
  function valid(stroke,w,h) {
    const exact=(o,keys)=>o && typeof o==="object" && !Array.isArray(o) && Object.keys(o).length===keys.length && keys.every(k=>Object.hasOwn(o,k));
    const point=p=>Array.isArray(p) && p.length===2 && p.every((v,k)=>typeof v==="number" && Number.isFinite(v) && v>=0 && v<=(k?h:w));
    return exact(stroke,["kind","id","type","nodes"]) && stroke.kind==="axis" && typeof stroke.id==="string" && /^[a-zA-Z0-9-]{1,64}$/.test(stroke.id) && ["trough","ridge"].includes(stroke.type) && Array.isArray(stroke.nodes) && stroke.nodes.length>=2 && stroke.nodes.length<=maxNodes && stroke.nodes.every(n=>exact(n,["p","in","out"]) && [n.p,n.in,n.out].every(point)) && samples(stroke.nodes).length>=2;
  }
  function draw(ctx,stroke,renderer) {
    const points=samples(stroke.nodes);
    if(points.length>=2)(stroke.type==="trough"?renderer.drawTroughs:renderer.drawRidges)(ctx,[points]);
  }
  return {maxNodes,copy,distance,smooth,cubic,samples,nearest,insert,move,resolved,flattened,valid,draw};
})();
if(typeof module!=="undefined")module.exports=ManualAxis;
