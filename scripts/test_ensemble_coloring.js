"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),crypto=require("node:crypto");
const Coloring=require("../ensemble-coloring.js"),Catalog=require("../catalog.js");
const root=require("node:path").resolve(__dirname,"..");
const data=JSON.parse(fs.readFileSync(root+"/ensemble-coloring.json")),catalog=JSON.parse(fs.readFileSync(root+"/chart-catalog.json"));
for(const record of data.selections){
  const selected=Catalog.selection(catalog,record.product,record.variant,record.page);
  const checked=Coloring.validate(data,selected);
  for(const asset of Object.values(checked.layers))assert.equal(crypto.createHash("sha256").update(fs.readFileSync(root+"/"+asset.path)).digest("hex"),asset.sha256);
  for(const asset of Object.values(checked.layers)){
    assert.equal(Coloring.assetURL(asset),`${asset.path}?v=${asset.sha256}`);
    assert.notEqual(Coloring.assetURL(asset),Coloring.assetURL({...asset,sha256:"0".repeat(64)}));
  }
  for(const field of ["source_sha256","image_sha256","width","height"]){
    const bad=structuredClone(data),r=bad.selections.find(x=>x.variant===record.variant);
    r[field]=typeof r[field]==="number"?r[field]+1:"0".repeat(64);
    assert.throws(()=>Coloring.validate(bad,selected));
  }
  const wrong=structuredClone(data);wrong.selections.find(x=>x.variant===record.variant).layers.symbols.path="assets/ensemble/another-date-symbols.png";
  assert.throws(()=>Coloring.validate(wrong,selected));
  const draws=[],ctx={save:()=>{},restore:()=>{},drawImage:(...args)=>draws.push(args)},coloring={images:{precipitation:"mask"}};
  Coloring.draw(ctx,coloring,"precipitation",false);assert.equal(draws.length,0);
  Coloring.draw(ctx,coloring,"precipitation",true);assert.deepEqual(draws,[["mask",0,0]]);
}
assert.throws(()=>Coloring.validate(data,Catalog.selection(catalog,"aupq35","aupq35-reviewed",1)));
assert.match(Coloring.legends("fefe19").note,/雨量・降水確率の違いを表しません/);
assert.deepEqual(Coloring.legends("fzcx50").bands,["10〜50％","50〜90％","90％以上"]);
assert.equal(data.selections.length,6);
for(const r of data.selections.filter(r=>r.product==="fxxn519")){
 assert.deepEqual(Object.keys(r.unavailable_layers).sort(),["cold850","height5880","warm850"]);
 const bad=structuredClone(data),record=bad.selections.find(x=>x.variant===r.variant);
 record.unavailable_layers.symbols="contour-boundary-unverified";
 assert.throws(()=>Coloring.validate(bad,Catalog.selection(catalog,r.product,r.variant,r.page)));
 delete record.unavailable_layers.symbols;record.unavailable_layers.height5880="assume-valid";
 assert.throws(()=>Coloring.validate(bad,Catalog.selection(catalog,r.product,r.variant,r.page)));
}
assert.throws(()=>Coloring.assetURL({path:"https://www.jma.go.jp/mask.png",sha256:"0".repeat(64)}));
assert.match(Coloring.legends("fxxn519").temperature,/3℃ごと/);
assert.match(Coloring.legends("fxxn519").height,/地図・緯度時間断面/);
// Inspect source pixels, rather than only checking that a mask exists.
// The cases below are original glyphs/positive-anomaly patches reported by
// readers. The expected ink is read independently from the uncolored PNG.
function pixels(path){
  const png=fs.readFileSync(root+"/"+path),parts=[];
  let width,height,bpp;
  for(let at=8;at<png.length;){
    const length=png.readUInt32BE(at),type=png.toString("ascii",at+4,at+8),body=png.subarray(at+8,at+8+length);
    if(type==="IHDR"){
      width=body.readUInt32BE(0);height=body.readUInt32BE(4);
      assert.equal(body[8],8);assert.ok([2,6].includes(body[9]));assert.equal(body[12],0);
      bpp=body[9]===6?4:3;
    }
    if(type==="IDAT")parts.push(body);
    at+=length+12;
  }
  const raw=require("node:zlib").inflateSync(Buffer.concat(parts)),stride=width*bpp,out=Buffer.alloc(stride*height);
  assert.equal(raw.length,(stride+1)*height);
  for(let y=0;y<height;y++){
    const row=y*stride,filter=raw[y*(stride+1)];assert.ok(filter<=4);
    for(let x=0;x<stride;x++){
      const a=x>=bpp?out[row+x-bpp]:0,b=y?out[row+x-stride]:0,c=y&&x>=bpp?out[row+x-stride-bpp]:0;
      const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);
      const predictor=[0,a,b,(a+b)>>1,pa<=pb&&pa<=pc?a:pb<=pc?b:c][filter];
      out[row+x]=(raw[y*(stride+1)+1+x]+predictor)&255;
    }
  }
  return {width,height,bpp,at:(x,y)=>out.subarray((y*width+x)*bpp,(y*width+x+1)*bpp)};
}
const fxxn=data.selections.find(r=>r.variant==="fxxn519-20261005");
const page=Catalog.selection(catalog,fxxn.product,fxxn.variant,1).page;
const source=pixels(page.image_path),glyph=pixels(fxxn.layers.symbols.path),anomaly=pixels(fxxn.layers.heightAnomaly.path);
for(const [x,y,w,h,color] of [[555,1760,14,21,[37,99,235]],[242,1384,14,21,[37,99,235]],[551,1401,14,21,[37,99,235]],[968,761,17,26,[220,38,38]]]){
  let ink=0;
  for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)if(source.at(xx,yy)[0]<128){
    assert.deepEqual([...glyph.at(xx,yy)], [...color,255]);ink++;
  }
  assert.ok(ink>=150);
}
// The crowded L has a five-pixel stem in this printing phase. Recolor its
// existing black strokes while keeping the overlapping number/contour clear.
for(let y=904;y<930;y++)for(let x=1931;x<1936;x++)if(source.at(x,y)[0]<128)assert.deepEqual([...glyph.at(x,y)],[220,38,38,255]);
for(const [x,y] of [[1640,875],[1660,875],[1650,890]]){
  const p=anomaly.at(x,y);assert.equal(p[3],100);assert.ok(p[0]>p[2],"Unhatched positive anomaly painted blue");
}
console.log("ENSEMBLE_SOURCE_BINDING_OK selections=6");
