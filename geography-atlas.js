"use strict";
const GeographyAtlas=(()=>{
  function validate(data,selected) {
    if(data?.schema_version!==1 || data.selections?.length!==61 || data.coast_source?.license!=="Public domain")throw Error("Invalid geography catalog");
    const records=data.selections.filter(r=>r.product===selected.product.id && r.variant===selected.variant.id && r.page===selected.page.number);
    if(records.length!==1)throw Error("Geography selection mismatch");
    const r=records[0];
    if(r.source_sha256!==selected.variant.source_sha256 || r.image_sha256!==selected.page.image_sha256 || r.width!==selected.page.width || r.height!==selected.page.height || !Array.isArray(r.panels) || r.panels.length>20)throw Error("Geography source mismatch");
    for(const p of r.panels) {
      const b=p.bounds;
      if(b?.length!==4 || !b.every(Number.isFinite) || b[0]<0 || b[1]<0 || b[2]>r.width || b[3]>r.height || b[0]>=b[2] || b[1]>=b[3])throw Error("Geography frame mismatch");
      if(p.kind==="polar") {if(p.matrix?.length!==3 || p.matrix.some(v=>v?.length!==2||!v.every(Number.isFinite)) || Math.abs(p.matrix[0][0]*p.matrix[1][1]-p.matrix[0][1]*p.matrix[1][0])<.00001)throw Error("Geography transform mismatch");}
      else if(p.kind!=="linear" || p.longitude?.length!==2 || p.latitude?.length!==2 || ![...p.longitude,...p.latitude].every(Number.isFinite) || p.longitude[1]<=p.longitude[0] || p.latitude[0]<=p.latitude[1])throw Error("Geography projection mismatch");
    }
    if(r.panels.length && (!/^assets\/geography\/land-[a-f0-9]{12}\.png$/.test(r.mask?.path) || !/^[a-f0-9]{64}$/.test(r.mask.sha256) || r.mask.width!==r.width || r.mask.height!==r.height))throw Error("Geography mask mismatch");
    if(!r.panels.length && r.mask)throw Error("Non-map geography mismatch");
    return r;
  }
  function canonical(r) {
    return r.panels.length>0 && r.panels.every(p=>{
      if(p.kind!=="polar")return false;
      const [[a,b],[c,d],[e,f]]=p.matrix,det=a*d-b*c;
      const [l,t,rr,bb]=p.bounds;
      return [[l,t],[rr,t],[rr,bb],[l,bb]].every(([x,y])=>{x-=e;y-=f;const u=(d*x-c*y)/det,v=(-b*x+a*y)/det;return u>=54.9&&u<=1991.1&&v>=121.2&&v<=1441.8;});
    });
  }
  function draw(ctx,data,id,opacity,mask,base,satellite,terrain) {
    const style=ChartGeography.patterns.find(s=>s.id===id);
    if(!style || !mask || opacity<0 || opacity>1)throw Error("Geography unavailable");
    if(style.terrain!==undefined || style.satellite) {
      if(!canonical(data)||!base)throw Error("Geography imagery unavailable");
      for(const p of data.panels) {
        const [l,t,r,b]=p.bounds;ctx.save();ctx.beginPath();ctx.rect(l,t,r-l,b-t);ctx.clip();
        const [[a,bb],[c,d],[e,f]]=p.matrix;ctx.transform(a,bb,c,d,e,f);
        ChartGeography.draw(ctx,{...base,panels:[base.panels[0]]},id,opacity,satellite,terrain);ctx.restore();
      }
      return;
    }
    ctx.save();ctx.globalAlpha=opacity;
    if(style.sea){ctx.fillStyle=ctx.createPattern(ChartGeography.texture(style.sea),"repeat");for(const p of data.panels){const [l,t,r,b]=p.bounds;ctx.fillRect(l,t,r-l,b-t);}}
    if(style.land) {
      const scratch=ctx.canvas.ownerDocument.createElement("canvas");scratch.width=data.width;scratch.height=data.height;
      const sc=scratch.getContext("2d");sc.fillStyle=sc.createPattern(ChartGeography.texture(style.land),"repeat");sc.fillRect(0,0,data.width,data.height);sc.globalCompositeOperation="destination-in";sc.drawImage(mask,0,0);ctx.drawImage(scratch,0,0);
    }
    ctx.restore();
  }
  return {validate,canonical,draw};
})();
if(typeof module!=="undefined")module.exports=GeographyAtlas;
